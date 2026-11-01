// Renders book/lesson-book.html to book/lesson-book.pdf with the Playwright Chromium.
// Run after `npm run book`. The deploy workflow copies both files into dist/book/.
// US Letter by default; BOOK_PAPER=a4 renders A4 (the layout fits both).
//
// Chapters run on rather than each opening a page, so the contents need page numbers. Chromium cannot
// print them itself, so the book is rendered twice: the first PDF's bookmarks say where each chapter
// heading landed, those pages are written into the contents, and the second rendering is the book.
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

const a4 = (process.env.BOOK_PAPER || '').toLowerCase() === 'a4';
const html = resolve('book/lesson-book.html');
const pdf = resolve('book/lesson-book.pdf');
const executablePath = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href);
const options = {
  format: a4 ? 'A4' : 'Letter',
  printBackground: true,
  // Bookmarks for every heading: for reading on screen, and for the contents' page numbers
  tagged: true,
  outline: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="font-size:8px;font-family:Arial,\'Liberation Sans\',sans-serif;color:#000;width:100%;text-align:center;">The hoot65 Opening Book · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' },
};

/** Writes each chapter's page into the contents; returns the headings that have no bookmark. */
const fillContents = (pages) =>
  page.evaluate((byHeading) => {
    const missing = [];
    for (const li of document.querySelectorAll('ol.toc li[data-heading]')) {
      const p = byHeading[li.dataset.heading];
      if (p) li.querySelector('.pg').textContent = String(p);
      else missing.push(li.dataset.heading);
    }
    return missing;
  }, Object.fromEntries(pages));

const draft = bookmarkPages(await page.pdf(options));
const missing = await fillContents(draft.pages);
if (missing.length) throw new Error(`no bookmark for: ${missing.join('; ')}`);
await page.pdf({ ...options, path: pdf });

// The page numbers sit on the first page, so they cannot move a chapter; check it anyway
const final = bookmarkPages(readFileSync(pdf));
const moved = await page.evaluate(
  (byHeading) => [...document.querySelectorAll('ol.toc li[data-heading]')].filter((li) => String(byHeading[li.dataset.heading]) !== li.querySelector('.pg').textContent).map((li) => li.dataset.heading),
  Object.fromEntries(final.pages)
);
if (moved.length) throw new Error(`chapters moved after the contents got their page numbers: ${moved.join('; ')}`);
await browser.close();
console.log(`wrote ${pdf} (${final.pageCount} ${a4 ? 'A4' : 'US Letter'} pages)`);
