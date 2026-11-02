// Renders book/lesson-book.html to book/lesson-book.pdf with the Playwright Chromium.
// Run after `npm run book`. The deploy workflow copies both files into dist/book/.
// US Letter by default; BOOK_PAPER=a4 renders A4 (the layout fits both).
//
// Printed double-sided, every page with questions is the front of a sheet with its answers on the back.
// The drill sheets are laid out that way in the HTML. The practice items at the end are packed here,
// in the browser, where fonts and widths are those of the print: as many items as fit on a page make a
// sheet, and that sheet's answers become the page after it. Chromium cannot put a page on a front side
// (it treats `break-before: right` as a plain page break), so the book is rendered once as a draft:
// its bookmarks say where each heading landed, a notes page goes in wherever a sheet would otherwise
// start on the back of a page (rendering again after each), the contents get their page numbers, and
// the last rendering is the book. The build fails if any sheet is not a front page followed by its answers.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Decodes a PDF string token: a literal "(...)" with escapes, or "<hex>" (UTF-16BE when it starts FEFF). */
function decodePdfString(token) {
  let bytes;
  if (token.startsWith('<')) {
    bytes = Buffer.from(token.slice(1, -1).replace(/\s+/g, ''), 'hex');
  } else {
    const body = token.slice(1, -1).replace(/\\(?:([0-7]{1,3})|(\r\n|\r|\n)|([\s\S]))/g, (_, octal, newline, ch) => {
      if (octal) return String.fromCharCode(parseInt(octal, 8));
      if (newline) return '';
      return { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[ch] ?? ch;
    });
    bytes = Buffer.from(body, 'latin1');
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return bytes.subarray(2).swap16().toString('utf16le');
  return bytes.toString('latin1');
}

/**
 * The page count of a Chromium PDF and the page each bookmark points to, by title. Chromium writes the
 * outline and the page tree as plain objects: a bookmark is << /Title (...) /Dest [N 0 R /XYZ ...] >>,
 * and the page tree's /Kids give the page order.
 */
function bookmarkPages(pdfBuffer) {
  const text = pdfBuffer.toString('latin1');
  const dict = (id) => {
    const m = new RegExp(`(?:^|[\\r\\n])${id} 0 obj\\s*<<([\\s\\S]*?)>>\\s*(?:endobj|stream)`).exec(text);
    if (!m) throw new Error(`PDF object ${id} not found`);
    return m[1];
  };
  const catalog = dict(/\/Root (\d+) 0 R/.exec(text)[1]);
  const order = [];
  const walk = (id) => {
    const d = dict(id);
    if (/\/Type\s*\/Pages\b/.test(d)) for (const [, kid] of /\/Kids\s*\[([^\]]*)\]/.exec(d)[1].matchAll(/(\d+) 0 R/g)) walk(kid);
    else order.push(id);
  };
  walk(/\/Pages (\d+) 0 R/.exec(catalog)[1]);
  const pageOf = new Map(order.map((id, i) => [id, i + 1]));
  const pages = new Map();
  for (const m of text.matchAll(/\/Title\s*(\((?:\\[\s\S]|[^\\)])*\)|<[0-9A-Fa-f\s]*>)\s*\/Dest\s*\[(\d+) 0 R/g)) {
    const title = decodePdfString(m[1]).replace(/\s+/g, ' ').trim();
    if (!pages.has(title)) pages.set(title, pageOf.get(m[2]));
  }
  return { pages, pageCount: order.length };
}

/**
 * Runs in the page. Opens the drill sheets' answers for print, packs the practice items onto sheets
 * (front: the items that fit; back: their answers, by chapter) and reports anything taller than a page.
 */
async function layOutSheets({ widthMm, heightMm }) {
  await document.fonts.ready;
  const limit = (heightMm * 96) / 25.4 - 2;
  const measure = document.createElement('div');
  measure.style.cssText = `position:absolute;left:0;top:0;width:${widthMm}mm;visibility:hidden`;
  document.body.append(measure);
  const fits = (el) => el.getBoundingClientRect().height <= limit;
  const tooTall = [];

  // The drill sheets are written as front and back: open the backs and check that each side fits a page
  for (const d of document.querySelectorAll('.sheet-back > details.answers')) d.open = true;
  for (const side of document.querySelectorAll('.drill-set, .drill-set + .sheet-back')) {
    const copy = side.cloneNode(true);
    measure.replaceChildren(copy);
    if (!fits(copy)) tooTall.push(side.querySelector('h2')?.textContent);
  }

  // Practice items: each keeps its question part; its answers wait for the back of the sheet it lands on
  const host = document.getElementById('practice-items');
  const part = document.getElementById('practice');
  const items = [...host.querySelectorAll(':scope > .pitem')].map((el) => {
    const details = el.querySelector(':scope > details.answers');
    const answers = details ? details.querySelector('.answer-body').innerHTML : '';
    details?.remove();
    return { el, chapter: el.dataset.chapter, start: el.classList.contains('pstart'), answers };
  });
  const sheets = [];
  const newSheet = () => {
    const front = document.createElement('section');
    front.className = 'sheet sheet-front';
    if (sheets.length === 0) front.append(part); // the part heading opens the first sheet
    const title = document.createElement('h2');
    title.className = 'sheet-title';
    title.textContent = `Practice sheet ${sheets.length + 1}`;
    front.append(title);
    const sheet = { front, items: [] };
    sheets.push(sheet);
    measure.replaceChildren(front);
    return sheet;
  };
  // A chapter that carries over to a new sheet is named again at the top of it
  const place = (sheet, item, force) => {
    const added = [];
    if (!item.start && !sheet.items.some((i) => i.chapter === item.chapter)) {
      const cont = document.createElement('p');
      cont.className = 'cont';
      cont.textContent = `${item.chapter} (continued)`;
      added.push(cont);
    }
    added.push(item.el);
    sheet.front.append(...added);
    if (force || fits(sheet.front)) {
      sheet.items.push(item);
      return true;
    }
    for (const node of added) node.remove();
    return false;
  };
  let sheet = newSheet();
  for (const item of items) {
    if (place(sheet, item, false)) continue;
    if (sheet.items.length > 0) sheet = newSheet();
    if (!place(sheet, item, false)) {
      tooTall.push(`practice item of ${item.chapter}`);
      place(sheet, item, true);
    }
  }

  const sides = [];
  sheets.forEach((s, i) => {
    const back = document.createElement('section');
    back.className = 'sheet sheet-back';
    const title = document.createElement('h2');
    title.className = 'sheet-title';
    title.textContent = `Practice sheet ${i + 1} · answers`;
    const body = document.createElement('div');
    body.className = 'answer-body';
    let chapter = null;
    for (const item of s.items) {
      if (!item.answers) continue;
      if (item.chapter !== chapter) {
        chapter = item.chapter;
        const label = document.createElement('p');
        label.className = 'ach';
        label.textContent = chapter;
        body.append(label);
      }
      body.insertAdjacentHTML('beforeend', item.answers);
    }
    back.append(title, body);
    measure.replaceChildren(back);
    if (!fits(back)) tooTall.push(`answers of practice sheet ${i + 1}`);
    sides.push(s.front, back);
  });
  measure.remove();
  host.replaceChildren(...sides);
  return { sheets: sheets.length, tooTall };
}

/** Runs in the page: the heading on each sheet's front and back, in print order. */
function sheetHeadings() {
  const heading = (el) => (el.querySelector('.chapter-head h2') ?? el.querySelector('.sheet-title')).textContent.replace(/\s+/g, ' ').trim();
  return [...document.querySelectorAll('.sheet-front')].map((front) => ({ front: heading(front), back: heading(front.nextElementSibling) }));
}

const a4 = (process.env.BOOK_PAPER || '').toLowerCase() === 'a4';
const paper = a4 ? { format: 'A4', widthMm: 210, heightMm: 297 } : { format: 'Letter', widthMm: 215.9, heightMm: 279.4 };
const margin = { top: 12, bottom: 14, left: 12, right: 12 };
const html = resolve('book/lesson-book.html');
const pdf = resolve('book/lesson-book.pdf');
const executablePath = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href);
const options = {
  format: paper.format,
  printBackground: true,
  // Bookmarks for every heading: for reading on screen, and for finding where each heading landed
  tagged: true,
  outline: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="font-size:8px;font-family:Arial,\'Liberation Sans\',sans-serif;color:#000;width:100%;text-align:center;">The hoot65 Opening Book · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  margin: { top: `${margin.top}mm`, bottom: `${margin.bottom}mm`, left: `${margin.left}mm`, right: `${margin.right}mm` },
};

const layout = await page.evaluate(layOutSheets, {
  widthMm: paper.widthMm - margin.left - margin.right,
  heightMm: paper.heightMm - margin.top - margin.bottom,
});
if (layout.tooTall.length) throw new Error(`taller than a page: ${layout.tooTall.join('; ')}`);

// The draft says where each sheet lands: the first one that would start on the back of a page gets a
// notes page before it, and the book is drawn again, until every sheet starts on a front
let draft = bookmarkPages(await page.pdf(options));
for (let pass = 0; pass < 12; pass++) {
  const fronts = await page.evaluate(sheetHeadings);
  const k = fronts.findIndex(({ front }) => (draft.pages.get(front) ?? 1) % 2 === 0);
  if (k < 0) break;
  await page.evaluate((k) => {
    const notes = document.createElement('section');
    notes.className = 'sheet notes-page';
    notes.innerHTML = '<h2 class="sheet-title">Notes</h2>';
    document.querySelectorAll('.sheet-front')[k].before(notes);
  }, k);
  draft = bookmarkPages(await page.pdf(options));
}

/** Writes the page of each referenced heading into its placeholder; returns the headings with no bookmark. */
const fillPages = (pages) =>
  page.evaluate((byHeading) => {
    const missing = [];
    for (const span of document.querySelectorAll('.pg[data-page-of]')) {
      const p = byHeading[span.dataset.pageOf];
      if (p) span.textContent = String(p);
      else missing.push(span.dataset.pageOf);
    }
    return missing;
  }, Object.fromEntries(pages));
const missing = await fillPages(draft.pages);
if (missing.length) throw new Error(`no bookmark for: ${missing.join('; ')}`);
await page.pdf({ ...options, path: pdf });

// Checks on the book as written: no page number moved, and every sheet is a front page with its answers on the back
const final = bookmarkPages(readFileSync(pdf));
const moved = await page.evaluate(
  (byHeading) => [...document.querySelectorAll('.pg[data-page-of]')].filter((s) => String(byHeading[s.dataset.pageOf]) !== s.textContent).map((s) => s.dataset.pageOf),
  Object.fromEntries(final.pages)
);
if (moved.length) throw new Error(`headings moved after the page numbers were filled in: ${moved.join('; ')}`);
const sheets = await page.evaluate(sheetHeadings);
const misplaced = sheets.filter(({ front, back }) => {
  const f = final.pages.get(front);
  return !f || f % 2 === 0 || final.pages.get(back) !== f + 1;
});
if (misplaced.length) throw new Error(`not a front page with its answers on the back: ${misplaced.map((s) => `${s.front} (page ${final.pages.get(s.front)})`).join('; ')}`);
await browser.close();
console.log(`wrote ${pdf} (${final.pageCount} ${a4 ? 'A4' : 'US Letter'} pages; ${sheets.length} sheets with the answers on the back: ${sheets.length - layout.sheets} of positions from the games, ${layout.sheets} of practice)`);
