/**
 * Builds "The hoot65 Opening Book": every core opening lesson, weakness drill and trap lesson of the
 * curriculum, plus the tailored repertoire lines, as one dense printable document.
 *
 * Printed double-sided, every page with questions is the front of a sheet whose back holds its answers,
 * so each sheet can be used on its own. The four drill pages from hoot65's games come first, each
 * with its answers on the back. The lesson chapters that follow are study pages: the annotated line,
 * the opponent's known replies and the mistakes to avoid. The practice for every lesson (the line and
 * each reply as blanks, and the exercises) is gathered at the end as practice items, which
 * `npm run book:pdf` packs onto practice sheets, moving each sheet's answers to its back.
 *
 * Laid out for paper: diagrams are vector drawings in the app's own piece set (no font decides how a
 * piece looks), dark squares are a light grey and all text is black. The page fits both US Letter and
 * A4; `npm run book:pdf` renders Letter unless BOOK_PAPER=a4.
 *
 *   npx tsx scripts/lesson-book.ts            -> book/lesson-book.html (`npm run book:pdf` renders the PDF)
 *
 * The output folder is ignored by git (no PDF is ever tracked).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Chess } from 'chess.js';
import QRCode from 'qrcode';
import { allCurriculumLessons, curriculumCourses } from '../src/curriculum';
import { PatternGroup, patternGroupOf, patternPath, inPatternOrder } from '../src/curriculum/patternPath';
import { plyLabel, replyOptions } from '../src/curriculum/builder';
import { drillSetOf, gameDrillData } from '../src/curriculum/gameDrills';
import { MOTIF_LABEL, isControl, numberLine, practiceDeck, type TacticPosition } from '../src/services/tacticsDeck';
import { lessonUrl } from '../src/router';
import { boardCardRows } from '../src/views/PointsCard';
import { exerciseCode, exercisesToPractise, isLessonMastered, lessonCode, masteredCodes, tacticCode } from '../src/curriculum/itemCodes';
import { getRecommendedWhiteRepertoire, getRecommendedBlackRepertoire } from '../src/analytics/repertoire';
import { CurriculumLesson, CurriculumMove } from '../src/types/curriculum';
import { RepertoirePlan } from '../src/types/diagnostics';

const OUT_DIR = resolve(process.cwd(), 'book');
const PIECES_DIR = resolve(process.cwd(), 'public/pieces');

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attr(s: string): string {
  return esc(s).replace(/"/g, '&quot;');
}

/** An item's code in a small box (src/curriculum/itemCodes.ts): once the code is on the mastered list, the next printing leaves the item out. */
function codeTag(code: string | undefined): string {
  return code ? `<span class="code">${esc(code)}</span>` : '';
}

/** The app's piece set (public/pieces) as SVG symbols, defined once and referenced by every diagram. */
const pieceSymbols = readdirSync(PIECES_DIR)
  .filter((f) => /^[wb][KQRBNP]\.svg$/.test(f))
  .map((f) => {
    const svg = readFileSync(resolve(PIECES_DIR, f), 'utf8');
    const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 45 45';
    const inner = svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    return `<symbol id="${f.slice(0, 2)}" viewBox="${viewBox}">${inner}</symbol>`;
  })
  .join('');

/** Square size in diagram units (the piece drawings are 45 units square). */
const SQ = 45;

/**
 * A printable diagram of a FEN from `orientation`'s side, as one vector image: white light squares,
 * light grey dark squares, the app's pieces, and the coordinates outside the board.
 */
function diagram(fen: string, orientation: 'w' | 'b' = 'w'): string {
  const rows = fen.split(' ')[0].split('/').map((row) => row.replace(/\d/g, (d) => '.'.repeat(Number(d))));
  let squares = '';
  let pieces = '';
  let coords = '';
  for (let r = 0; r < 8; r++) {
    const rank = orientation === 'w' ? 8 - r : r + 1;
    coords += `<text x="${-SQ / 4}" y="${r * SQ + SQ * 0.64}">${rank}</text>`;
    for (let f = 0; f < 8; f++) {
      const file = orientation === 'w' ? f : 7 - f;
      if ((file + rank) % 2 === 1) squares += `<rect x="${f * SQ}" y="${r * SQ}" width="${SQ}" height="${SQ}"/>`;
      const ch = rows[8 - rank][file];
      if (ch !== '.') {
        pieces += `<use href="#${ch === ch.toUpperCase() ? 'w' : 'b'}${ch.toUpperCase()}" x="${f * SQ}" y="${r * SQ}" width="${SQ}" height="${SQ}"/>`;
      }
    }
  }
  for (let f = 0; f < 8; f++) coords += `<text x="${f * SQ + SQ / 2}" y="${8 * SQ + SQ * 0.4}">${'abcdefgh'[orientation === 'w' ? f : 7 - f]}</text>`;
  const m = SQ / 2;
  return `<svg class="board" viewBox="${-m} 0 ${8 * SQ + m} ${8 * SQ + m}" role="img" aria-label="Chess diagram"><g class="dark">${squares}</g>${pieces}<rect class="edge" width="${8 * SQ}" height="${8 * SQ}"/><g class="coords">${coords}</g></svg>`;
}

/** "1.e4 e5 2.Nf3" style move text for a sequence starting from `fen` (a leading Black move keeps "1..."). */
function moveText(fen: string, moves: string[]): string {
  return moves.map((san, i) => (i === 0 ? plyLabel(fen, i, san) : plyLabel(fen, i, san).replace(/^\d+\.\.\./, ''))).join(' ');
}

function fenAfter(fen: string, moves: string[]): string {
  const c = new Chess(fen);
  for (const m of moves) c.move(m);
  return c.fen();
}

/** Every blank, exercise and drill position the reader answers. */
let answerCount = 0;

/**
 * A page number the PDF step fills in from the bookmark of the heading `heading` (empty in the HTML).
 * In print it keeps the width of a three-digit number, so filling it in cannot move a line or a page.
 */
function pageOf(heading: string): string {
  return `<span class="pg" data-page-of="${attr(heading)}"></span>`;
}

interface TocEntry {
  /** The heading the entry points to, as printed, which is also the title of its PDF bookmark. */
  heading: string;
  id: string;
  no: string;
  title: string;
  /** A lesson chapter's code. */
  code?: string;
}
/** The contents in print order. */
const toc: TocEntry[] = [];

function renderLine(lesson: CurriculumLesson, moves: CurriculumMove[], startFen: string, pathPrefix: string[], depth: number): string {
  const chess = new Chess(startFen);
  let html = '<ol class="line">';
  moves.forEach((move, i) => {
    const label = plyLabel(lesson.initialFen, pathPrefix.length + i, move.san);
    const who = move.isUserMove ? 'you' : 'opp';
    const notes: string[] = [];
    if (move.annotation) notes.push(esc(move.annotation));
    if (move.hintTheme && move.isUserMove) notes.push(`<em>Idea: ${esc(move.hintTheme)}.</em>`);
    if (move.wrongMoveFeedback) {
      for (const [san, text] of Object.entries(move.wrongMoveFeedback)) notes.push(`<span class="warn">Not ${esc(san)}?!</span> ${esc(text)}`);
    }
    html += `<li class="${who}"><b>${esc(label)}</b> ${notes.join(' ')}`;
    if (!move.isUserMove && move.alternatives) {
      const options = replyOptions(move);
      html += `<div class="branches"><div class="branches-title">Other replies you meet here (share of your games in brackets):</div>`;
      for (const opt of options.slice(1)) {
        if (!opt.continuation) continue;
        const altFen = fenAfter(chess.fen(), [opt.san]);
        html += `<div class="branch"><b>${esc(plyLabel(lesson.initialFen, pathPrefix.length + i, opt.san))}</b> [${Math.round(opt.share * 100)}%]`;
        html += renderLine(lesson, opt.continuation, altFen, [...pathPrefix, ...moves.slice(0, i).map((m) => m.san), opt.san], depth + 1);
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</li>';
    chess.move(move.san);
  });
  html += '</ol>';
  return html;
}

/** A, B, ..., Z, AA, AB, ... */
function branchTag(k: number): string {
  return k < 26 ? String.fromCharCode(65 + k) : `${branchTag(Math.floor(k / 26) - 1)}${String.fromCharCode(65 + (k % 26))}`;
}

interface BranchDrill {
  /** Moves from the lesson's initial position up to and including the opponent's other reply. */
  path: string[];
  continuation: CurriculumMove[];
}

/** Every opponent reply other than the scripted one, at or after `activeFrom`, including replies inside branches. */
function collectBranches(moves: CurriculumMove[], pathPrefix: string[], activeFrom: number): BranchDrill[] {
  const out: BranchDrill[] = [];
  moves.forEach((move, i) => {
    if (i < activeFrom || move.isUserMove || !move.alternatives) return;
    for (const opt of replyOptions(move).slice(1)) {
      if (!opt.continuation) continue;
      const path = [...pathPrefix, ...moves.slice(0, i).map((m) => m.san), opt.san];
      out.push({ path, continuation: opt.continuation });
      out.push(...collectBranches(opt.continuation, path, 0));
    }
  });
  return out;
}

/**
 * Practice list for a sequence, one row per move number as on a scoresheet: the student's moves are
 * blanks with a hint, the replies are given. `answer` is "2.exd5 3.Nc3 4.d4" for the back of the sheet.
 */
function practiceList(lesson: CurriculumLesson, moves: CurriculumMove[], plyOffset: number): { html: string; answer: string } {
  const rows: { no: string; white: string; black: string }[] = [];
  const answers: string[] = [];
  moves.forEach((move, i) => {
    const label = plyLabel(lesson.initialFen, plyOffset + i, move.san);
    const no = label.split(/\.+/)[0];
    const isBlack = label.includes('...');
    let cell = `<span class="given">${esc(move.san)}</span>`;
    if (move.isUserMove) {
      cell = `<span class="blank">________</span> <span class="hint">(${esc(move.hintTheme || move.hintPiece || 'find the move')})</span>`;
      answers.push(`${no}${isBlack ? '...' : '.'}${move.san}${move.accept?.san?.length ? ` (also ${move.accept.san.join(', ')})` : ''}`);
      answerCount++;
    }
    const last = rows[rows.length - 1];
    if (isBlack && last && last.no === no && !last.black) last.black = cell;
    else rows.push({ no, white: isBlack ? '…' : cell, black: isBlack ? cell : '' });
  });
  const html = `<ol class="practice">${rows.map((r) => `<li><b>${r.no}.</b> ${r.white}${r.black ? ` ${r.black}` : ''}</li>`).join('')}</ol>`;
  return { html, answer: answers.join(' ') };
}

/**
 * One block of the practice sheets. In the HTML its answers fold out under it; `npm run book:pdf`
 * packs the blocks onto sheets and moves the answers of each sheet to the back of that sheet.
 */
function practiceItem(chapter: string, body: string, answers: string, kind = ''): string {
  return `<div class="pitem${kind}" data-chapter="${attr(chapter)}">${body}<details class="answers"><summary>Answers</summary><div class="answer-body">${answers}</div></details></div>`;
}

/** The heading of a lesson's practice, which the study chapter points to. */
const practiceHeading = (chapter: string) => `Practice · ${chapter}`;

/** The heading block of a chapter, kept together and with what follows it. */
/** A QR code as an SVG drawn module by module (black squares on white, no margin). */
function qrSvg(text: string): string {
  const { size, data } = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules;
  let path = '';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (data[r * size + c]) path += `M${c} ${r}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${size + 2} ${size + 2}" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${size + 2}" height="${size + 2}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

/** A chapter's QR code: scanned with a phone, it opens the lesson in the app (DC-5 deep links). */
function qrLink(lessonId: string): string {
  const url = lessonUrl(lessonId);
  return `<a class="qr" href="${esc(url)}" title="${esc(url)}">${qrSvg(url)}<span>Open in the app</span></a>`;
}

function chapterHead(title: string, group: PatternGroup | undefined, extra = '', lessonId?: string): string {
  return `<header class="chapter-head">${group ? groupIntro(group) : ''}${lessonId ? qrLink(lessonId) : ''}<h2>${esc(title)}</h2>${extra}</header>`;
}

/** Practice items for a lesson, gathered at the end of the book: the line and each reply as blanks, then the exercises. */
const practiceItems: string[] = [];

function renderPractice(lesson: CurriculumLesson, n: number, chapter: string): string {
  const startPly = lesson.startPly ?? 0;
  const prefix = lesson.moves.slice(0, startPly).map((m) => m.san);
  const drillFen = fenAfter(lesson.initialFen, prefix);
  const side: 'w' | 'b' = lesson.targetColor === 'black' ? 'b' : 'w';
  const sideName = side === 'w' ? 'White' : 'Black';
  const toMove = new Chess(drillFen).turn();
  const userMoves = lesson.moves.filter((m, i) => i >= startPly && m.isUserMove);
  const branches = collectBranches(lesson.moves, [], startPly);

  const caption = toMove === side ? `${sideName} to move.` : `You play ${sideName}; ${toMove === 'w' ? 'White' : 'Black'} moves first (given).`;
  const intro = `<p>Set up this position${prefix.length ? ` (after ${esc(moveText(lesson.initialFen, prefix))})` : ''} with ${sideName} nearest you and find your ${userMoves.length} move${userMoves.length === 1 ? '' : 's'}: each blank is one, and the replies are given. FEN <code>${esc(drillFen)}</code>.${
    branches.length ? ` Then the same for the ${branches.length} other repl${branches.length === 1 ? 'y' : 'ies'} below, reached by the given moves.` : ''
  }</p>`;
  const line = practiceList(lesson, lesson.moves.slice(startPly), startPly);
  let html = practiceItem(
    chapter,
    `<h3 id="practice-${n}">${esc(practiceHeading(chapter))}</h3><figure class="diagram">${diagram(drillFen, side)}<figcaption>${codeTag(lessonCode(lesson.id))} ${caption}</figcaption></figure>${intro}${line.html}`,
    line.answer ? `<p><b>Line</b> ${esc(line.answer)}</p>` : '',
    ' pstart'
  );
  // The other replies two to a row, each row one block
  for (let k = 0; k < branches.length; k += 2) {
    let body = '';
    let answers = '';
    branches.slice(k, k + 2).forEach((b, j) => {
      const tag = branchTag(k + j);
      const list = practiceList(lesson, b.continuation, b.path.length);
      body += `<div class="reply"><p class="reply-head"><b>Reply ${tag}</b> · after <b>${esc(moveText(lesson.initialFen, b.path))}</b></p>${list.html}</div>`;
      if (list.answer) answers += `<p><b>Reply ${tag}</b> ${esc(list.answer)}</p>`;
    });
    html += practiceItem(chapter, body, answers, ' replies');
  }
  // Exercises two to a row, each row one block; the mastered ones are left out
  const exercises = exercisesToPractise(lesson);
  for (let k = 0; k < exercises.length; k += 2) {
    let body = k === 0 ? '<h4>Exercises</h4>' : '';
    let answers = '';
    exercises.slice(k, k + 2).forEach((ex, j) => {
      const turn = ex.turn ?? (new Chess(ex.fen).turn() as 'w' | 'b');
      const label = `Exercise ${n}.${k + j + 1}`;
      body += `<div class="exercise"><figure class="diagram">${diagram(ex.fen, turn)}<figcaption><b>${esc(label)}</b> ${codeTag(exerciseCode(ex.id))}${ex.title ? ` ${esc(ex.title)}` : ''} · ${turn === 'w' ? 'White' : 'Black'} to move</figcaption></figure><div><p>${esc(ex.prompt)}</p><p class="blankline">Your answer: ______________</p></div></div>`;
      answers += `<p><b>${esc(label)}</b> ${esc(`${moveText(ex.fen, ex.solutionSan)}. ${ex.explanation}`)}</p>`;
      answerCount++;
    });
    html += practiceItem(chapter, body, answers, ' exercises');
  }
  return html;
}

function renderLesson(lesson: CurriculumLesson, n: number, group?: PatternGroup, newPage = false, tocTitle = lesson.title): string {
  const startPly = lesson.startPly ?? 0;
  const prefix = lesson.moves.slice(0, startPly).map((m) => m.san);
  const drillFen = fenAfter(lesson.initialFen, prefix);
  const side: 'w' | 'b' = lesson.targetColor === 'black' ? 'b' : 'w';
  const sideName = side === 'w' ? 'White' : 'Black';
  const toMove = new Chess(drillFen).turn();
  const chapter = `${n}. ${lesson.title}`;
  toc.push({ heading: chapter, id: `ch-${n}`, no: `${n}.`, title: tocTitle, code: lessonCode(lesson.id) });

  const meta = `<p class="meta">${codeTag(lessonCode(lesson.id))} ${lesson.eco ? `ECO ${esc(lesson.eco)} · ` : ''}You play ${sideName} · ${esc(lesson.sourceBook)}, ${esc(lesson.author)}${lesson.pagesRef ? ` (${esc(lesson.pagesRef)})` : ''}</p>`;
  let html = `<section class="chapter${newPage ? ' new-page' : ''}" id="ch-${n}">${chapterHead(chapter, group, `${meta}${lesson.subtitle ? `<p class="lead">${esc(lesson.subtitle)}</p>` : ''}`, lesson.id)}`;

  html += `<h3>Why this position</h3>`;
  if (lesson.description) html += `<p>${esc(lesson.description)}</p>`;
  if (lesson.thematicObjective) html += `<p><b>Objective.</b> ${esc(lesson.thematicObjective)}</p>`;
  if (lesson.keyTacticalMotif) html += `<p><b>Motifs.</b> ${esc(lesson.keyTacticalMotif)}</p>`;

  html += `<h3>The line, explained</h3>`;
  if (prefix.length > 0) html += `<p>The drill starts after <b>${esc(moveText(lesson.initialFen, prefix))}</b>; those moves are given.</p>`;
  const startCaption =
    toMove === side
      ? `Start of the drill. ${sideName} to move.`
      : `Start of the drill. You play ${sideName}; ${toMove === 'w' ? 'White' : 'Black'}'s move comes first and is given.`;
  // The diagram floats right, so the line runs beside it and then at full width below it
  html += `<div class="explain"><figure class="diagram">${diagram(drillFen, side)}<figcaption>${startCaption}</figcaption></figure>`;
  html += renderLine(lesson, lesson.moves.slice(startPly), drillFen, prefix, 0);
  html += `</div>`;

  if (lesson.commonMistakesAndTraps && lesson.commonMistakesAndTraps.length > 0) {
    html += `<h3>Mistakes to avoid</h3><ul class="traps">`;
    for (const t of lesson.commonMistakesAndTraps) {
      const refutation = t.refutationSanList.length ? ` Punishment: <b>${esc(t.attemptedSan)} ${esc(t.refutationSanList.join(' '))}</b>.` : '';
      html += `<li><span class="warn">${esc(t.attemptedSan)}${t.severity === 'blunder' ? '??' : '?!'}</span> ${esc(t.explanatoryFeedback)}${refutation} <em>${esc(t.punishmentSummary)}</em></li>`;
    }
    html += `</ul>`;
  }

  // The practice is on the practice sheets at the end, with its answers on the backs
  html += `<p class="see-practice"><a href="#practice-${n}">Practice for this chapter</a> is on the practice sheets at the end of the book<span class="pg-ref">, page ${pageOf(practiceHeading(chapter))}</span>.</p>`;
  practiceItems.push(renderPractice(lesson, n, chapter));
  html += `</section>`;
  return html;
}

/** Diagrams on one drill sheet: three rows of four. */
const SHEET_DRILLS = 12;

const drillById = new Map(
  [...gameDrillData.threat, ...gameDrillData.free, ...gameDrillData.hang, ...(gameDrillData.mate ?? [])].map((d) => [`lesson-game-${d.id}`, d] as const)
);

/**
 * A drill set from hoot65's games as one sheet: the front holds each position as a diagram from the
 * student's side, just after the opponent's move; the back holds the right moves and the game's story.
 */
function renderDrillSet(lessons: CurriculumLesson[], n: number, group: PatternGroup | undefined, before = ''): string {
  const name = group ? group.title : 'Positions from your games';
  const chapter = `${n}. ${name}`;
  toc.push({ heading: chapter, id: `ch-${n}`, no: `${n}.`, title: `${name} (${lessons.length} positions from your games)` });
  const intro = `<p>${lessons.length} positions from your games, newest first. Each diagram is drawn from your side just after your opponent's move, which is named under it. Find your move and write it down. The answers are on the back of this page: every move that is right, and what happened in the game.</p>`;
  let front = `<section class="sheet sheet-front drill-set" id="ch-${n}">${before}${chapterHead(chapter, group, intro, lessons[0].id)}<div class="drills">`;
  let answers = '';
  lessons.forEach((lesson, k) => {
    const [opp, mine] = lesson.moves;
    const drill = drillById.get(lesson.id);
    const side: 'w' | 'b' = lesson.targetColor === 'black' ? 'b' : 'w';
    const label = `${n}.${k + 1}`;
    const caption = `vs ${drill?.opponent ?? ''}, ${drill?.date ?? ''}. After ${plyLabel(lesson.initialFen, 0, opp.san)}, ${side === 'w' ? 'White' : 'Black'} to move.`;
    front += `<div class="drill"><figure class="diagram">${diagram(opp.fenAfter || lesson.initialFen, side)}<figcaption><b>${esc(label)}</b> ${codeTag(lessonCode(lesson.id))} ${esc(caption)}</figcaption></figure><p class="blankline">Your move: __________</p></div>`;
    const also = mine.accept?.san?.length ? ` (also ${mine.accept.san.join(', ')})` : '';
    answers += `<p><b>${esc(label)}</b> ${esc(`${mine.san}${also}. ${mine.annotation ?? ''} ${lesson.thematicObjective ?? ''}`.trim())}</p>`;
    answerCount++;
  });
  front += `</div></section>`;
  const back = `<section class="sheet sheet-back"><details class="answers"><summary>Answers to ${esc(chapter)}</summary><h2 class="sheet-title">Answers · ${esc(chapter)}</h2><div class="answer-body">${answers}</div></details></section>`;
  return front + back;
}

/** The tactics deck's first positions on sheets of twelve: the deck follows the study path, pieces to take and mates in one first. */
const BOOK_TACTICS = 24;

/** A sheet of the tactics deck: each position just after a mistake in one of hoot65's games, from the side to move; the back holds the answers. */
function renderTacticsSheet(positions: TacticPosition[], n: number, sheetNo: number, sheets: number, ahead = false, before = ''): string {
  const name = ahead ? 'Two moves ahead' : `Tactics from your games${sheets > 1 ? `, sheet ${sheetNo} of ${sheets}` : ''}`;
  const chapter = `${n}. ${name}`;
  toc.push({ heading: chapter, id: `ch-${n}`, no: `${n}.`, title: `${name} (${positions.length} positions)` });
  const intro = ahead
    ? `<p>The same kind of positions, two moves earlier: each diagram is drawn two moves before the tactic, with the two moves that were played under it. Play them in your head, without moving anything, and find the winning move in the position they reach. The answers are on the back.</p>`
    : sheetNo === 1
      ? `<p>Positions from your games, each just after a mistake, yours or your opponent's: in most of them one move wins clearly, and in a few nothing does and a solid move is right (checked with Stockfish 19). Each diagram is drawn from the side to move, with the move that had just been played. Aim for under a minute each. The answers are on the back. The app's Tactics deck holds ${practiceDeck.length} of them and brings back the ones you miss.</p>`
      : '';
  let front = `<section class="sheet sheet-front drill-set" id="ch-${n}">${before}${chapterHead(chapter, undefined, intro)}<div class="drills">`;
  let answers = '';
  positions.forEach((t, k) => {
    const side: 'w' | 'b' = t.fen.split(' ')[1] === 'b' ? 'b' : 'w';
    const label = `${n}.${k + 1}`;
    const shown = ahead && t.before ? t.before.fen : t.fen;
    const caption = ahead && t.before ? `After ${numberLine(t.before.fen, t.before.moves)}, ${side === 'w' ? 'White' : 'Black'} to play and win.` : `${side === 'w' ? 'White' : 'Black'} to play, after ${t.lastMove.san}.`;
    front += `<div class="drill"><figure class="diagram">${diagram(shown, side)}<figcaption><b>${esc(label)}</b> ${codeTag(tacticCode(t.id))} ${esc(caption)}</figcaption></figure><p class="blankline">Your move: __________</p></div>`;
    const also = t.accepted.filter((san) => san !== t.solution);
    const others = !also.length
      ? ''
      : isControl(t)
      ? ` (as good: ${also.slice(0, 3).join(', ')})`
      : ` (${also.join(' and ')} also win${also.length === 1 ? 's' : ''})`;
    answers += `<p><b>${esc(label)}</b> ${esc(`${t.solution}: ${MOTIF_LABEL[t.motif].toLowerCase()}${others}. Stockfish's line: ${numberLine(t.fen, t.line)}. From your game of ${t.date}.`)}</p>`;
    answerCount++;
  });
  front += `</div></section>`;
  const back = `<section class="sheet sheet-back"><details class="answers"><summary>Answers to ${esc(chapter)}</summary><h2 class="sheet-title">Answers · ${esc(chapter)}</h2><div class="answer-body">${answers}</div></details></section>`;
  return front + back;
}

function renderPlan(plan: RepertoirePlan, n: number): string {
  toc.push({ heading: `${n}. Repertoire plan: ${plan.name}`, id: `ch-${n}`, no: `${n}.`, title: plan.name });
  let html = `<section class="chapter" id="ch-${n}">${chapterHead(`${n}. Repertoire plan: ${plan.name}`, undefined)}<p>${esc(plan.description)}</p>`;
  if (plan.keyThemes.length) html += `<p><b>Themes.</b> ${plan.keyThemes.map(esc).join('; ')}.</p>`;
  plan.lines.forEach((line, i) => {
    const student = plan.color === 'white' ? 'w' : 'b';
    html += `<div class="plan-line"><h3>${n}.${i + 1} ${esc(line.name)} (${esc(line.eco)})</h3>`;
    html += `<figure class="diagram">${diagram(line.moves[line.moves.length - 1]?.fen || plan.rootFen, student)}<figcaption>End of the line.</figcaption></figure>`;
    html += `<p>${esc(line.description)}</p><p class="moves"><b>${esc(moveText(plan.rootFen, line.movesSan))}</b></p>`;
    const notes = line.moves.filter((m) => m.commentary);
    if (notes.length) {
      html += `<ul class="notes">${notes.map((m) => `<li><b>${esc(plyLabel(plan.rootFen, m.ply - 1, m.san))}</b> ${esc(m.commentary || '')}</li>`).join('')}</ul>`;
    }
    if (line.keyIdeas.length) html += `<p><b>Key ideas.</b> ${line.keyIdeas.map(esc).join('. ')}.</p>`;
    html += `<p class="practice-inline"><b>Practice.</b> From the start position, play your side of this line from memory; the opponent's moves are: ${esc(
      line.movesSan.filter((_, k) => (k % 2 === 0 ? 'w' : 'b') !== student).join(', ')
    )}.</p></div>`;
  });
  html += `</section>`;
  return html;
}

// The mastered lessons and positions are left out (src/data/mastered.json)
const core = allCurriculumLessons.filter((l) => l.relevance !== 'outside-repertoire' && !isLessonMastered(l.id));
// Part I follows the app's study path: lessons grouped by the pattern they repeat
const openingLessons = inPatternOrder(core.filter((l) => l.category !== 'fundamentals'));

/** The heading that opens a study-path group, printed above the group's first chapter. */
function groupIntro(group: PatternGroup): string {
  return `<div class="group"><div class="group-title">Pattern ${patternPath.indexOf(group) + 1} · ${esc(group.title)}</div><p>${esc(group.idea)}</p><p><b>Check before you move:</b> ${esc(group.check)}</p></div>`;
}
const library = allCurriculumLessons.filter((l) => l.relevance === 'outside-repertoire' && !isLessonMastered(l.id));

/** A part heading; it runs on with the chapter after it. */
function partHead(title: string, text: string, extraClass = '', id = ''): string {
  return `<section class="part${extraClass}"${id ? ` id="${id}"` : ''}><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ''}</section>`;
}

/** What each drill sheet holds, by the kind in its positions' ids (lesson-game-threat-..., -free-, -hang-, -mate-). */
const SET_SUBJECT: Record<string, string> = {
  threat: "a piece your opponent's move attacked that stayed where it was",
  free: 'a piece of theirs that could have been won',
  hang: 'a move of yours that left a piece where it could be taken',
  mate: 'a move of yours that let your opponent give mate',
};
const setKind = (lessonId: string) => lessonId.slice('lesson-game-'.length).split('-')[0];
const NUMBER_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const count = (k: number, noun: string) => `${NUMBER_WORD[k] ?? k} ${noun}${k === 1 ? '' : 's'}`;
const listOf = (parts: string[]) => (parts.length < 3 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`);

/** How to use the book, said of the sheets it holds: mastered positions can leave a drill sheet or a tactics sheet out. */
function howToUse(): string {
  const sets = setKinds.length
    ? `${setKinds.length === 1 ? 'The first chapter is' : `The first ${NUMBER_WORD[setKinds.length]} chapters are`} positions from your games: ${listOf(setKinds.map((k) => SET_SUBJECT[k]))}. `
    : '';
  const tactics = tacticSheets
    ? ` Part I closes with ${tacticSheets === 1 ? 'a sheet' : `${NUMBER_WORD[tacticSheets]} sheets`} of tactics from your games, positions just after a mistake, yours or your opponent's, where one move wins${
        aheadTactics.length ? ', and a sheet of the same kind two moves earlier, to be solved in your head' : ''
      }.`
    : '';
  return `These chapters come from your own Chess.com games (hoot65) and the openings you actually play, in the order of the app's study path: lessons that repeat the same pattern follow one another, and each group opens with the check that catches it. ${sets}Each lesson chapter${sets ? ' after them' : ''} explains the position: the line with its notes, the other replies your opponents chose, and the mistakes to avoid. The practice for every lesson, the main line and each of those replies as moves to find plus the exercises, is on the practice sheets at the end of the book, to be played out on a real board. The QR code beside a chapter opens its lesson in the app, where "On paper" records how the sheet went, and the app schedules the lesson's review cards from it.${tactics}`;
}

const codes =
  'Every lesson, exercise and position has a code in a small box: L for a lesson, E for an exercise, G for a position from your games, T for a tactic. When you have mastered one, ask for its code to go on the mastered list (npm run codes -- master L12): the next printing leaves it out, a lesson with its practice and its exercises, and the sheets of positions from your games and of tactics take the next ones in its place. The app leaves it out too.';

function printing(): string {
  const tactics = tacticSheets + (aheadTactics.length ? 1 : 0);
  const pages = setKinds.length + tactics;
  const sheets = listOf([setKinds.length ? count(setKinds.length, 'drill sheet') : '', tactics ? count(tactics, 'tactics sheet') : ''].filter(Boolean));
  return `Print the book double-sided, flipping on the long edge. Every page with questions, ${pages ? `the ${count(pages, 'page')} of positions from your games (${sheets}) and ` : ''}each practice sheet, is the front of a sheet with its answers on the back, so each sheet can be taken to the board on its own. Where a practice sheet would otherwise start on the back of a page, a page for notes comes first.`;
}

// The habits the archive ranks (the app's "Where your points go"), in the order a player meets them at
// the board (the app's own card, `boardCardRows`): a card to cut out
const boardCard = `<div class="card"><table><thead><tr><th colspan="2">At the board, every move: the checks in order</th><th class="pts">Points</th></tr></thead><tbody>${boardCardRows()
  .map((r, k) => `<tr><td class="n">${k + 1}.</td><td>${esc(r.habit)}</td><td class="pts">${esc(r.points)}</td></tr>`)
  .join('')}</tbody></table><p class="card-note">From your 4,101 Chess.com games: the points per 100 games each habit would have won if kept every time (near a 50% score, one point per 100 games is about 7 rating points). Cut along the dashed line and keep it by the board.</p></div>`;

const playing = (l: CurriculumLesson) => `${l.title} (you play ${l.targetColor === 'black' ? 'Black' : 'White'})`;

let n = 0;
const chapters: string[] = [];
const partOne = (extraClass = '') => partHead('Part I · Your drills and repertoire lessons', '', extraClass);
let previousGroup: PatternGroup | undefined;
let previousLessonId = '';
const renderedSets = new Set<CurriculumLesson[]>();
/** The kinds of the drill sheets printed, in print order. */
const setKinds: string[] = [];
for (const lesson of openingLessons) {
  const group = patternGroupOf(lesson.id);
  const set = drillSetOf(lesson.id);
  if (set) {
    // A drill set is one sheet of positions, printed where its first position falls; the first one carries the part heading
    if (!renderedSets.has(set)) {
      const before = chapters.length === 0 ? partOne() : '';
      // One sheet holds twelve diagrams: the newest twelve of the set not yet mastered (the app has them all)
      const left = set.filter((l) => !isLessonMastered(l.id));
      chapters.push(renderDrillSet(left.slice(0, SHEET_DRILLS), ++n, group !== previousGroup ? group : undefined, before));
      setKinds.push(setKind(left[0].id));
    }
    renderedSets.add(set);
  } else {
    // With every drill sheet mastered, the part heading opens the first lesson's page
    if (chapters.length === 0) chapters.push(partOne(' new-page'));
    // The lesson after the drill sheets opens a page; later lessons run on
    chapters.push(
      renderLesson(lesson, ++n, group !== previousGroup ? group : undefined, previousGroup !== undefined && renderedSets.size > 0 && !!drillSetOf(previousLessonId), playing(lesson))
    );
  }
  previousGroup = group;
  previousLessonId = lesson.id;
}
// The tactics deck closes Part I, two sheets of twelve
// The deck less the mastered tactics, as the app has it
const deck = practiceDeck;
const bookTactics = deck.slice(0, BOOK_TACTICS);
const tacticSheets = Math.ceil(bookTactics.length / SHEET_DRILLS);
// Then a visualization sheet: the next twelve tactics (quiet positions left out), each two moves before it
const aheadTactics = deck.filter((t) => t.before && !isControl(t) && !bookTactics.includes(t)).slice(0, SHEET_DRILLS);
// With every lesson and position of Part I mastered, the first tactics sheet carries the part heading
const partOneFirst = () => (chapters.length === 0 ? partOne() : '');
for (let k = 0; k < tacticSheets; k++) {
  chapters.push(renderTacticsSheet(bookTactics.slice(k * SHEET_DRILLS, (k + 1) * SHEET_DRILLS), ++n, k + 1, tacticSheets, false, partOneFirst()));
}
if (aheadTactics.length) chapters.push(renderTacticsSheet(aheadTactics, ++n, 1, 1, true, partOneFirst()));
chapters.push(
  partHead(
    'Part II · The repertoire plans',
    "The full lines behind the lessons: White's Italian with the Evans Gambit and the Anti-Scandinavian, Black's Caro-Kann and the c6-d5 wall against 1.d4, 1.c4 and 1.Nf3."
  )
);
chapters.push(renderPlan(getRecommendedWhiteRepertoire(), ++n));
chapters.push(renderPlan(getRecommendedBlackRepertoire(), ++n));
chapters.push(partHead('Part III · Pattern library', 'Openings you do not play, kept for the patterns in them.'));
for (const lesson of library) chapters.push(renderLesson(lesson, ++n));

// Part IV: the practice of every lesson, as blocks the PDF step packs onto sheets with their answers on the backs
const practiceTitle = 'Part IV · Practice sheets';
toc.push({ heading: practiceTitle, id: 'practice', no: '', title: 'Practice sheets, with the answers on the back of each sheet' });
const practicePart = `${partHead(
  practiceTitle,
  'The practice for each lesson chapter, in chapter order: set up the position, play your moves of the line and of each reply, and solve the exercises. The answers to each sheet are on its back.',
  ' practice-part',
  'practice'
)}<div id="practice-items">${practiceItems.join('')}</div>`;

const drillCount = openingLessons.filter((l) => drillSetOf(l.id)).length;
const mastered = masteredCodes();
// One line per chapter (a drill set is one chapter)
const contents = `<h2>Contents</h2><ol class="toc">${toc
  .map((e) => `<li><a href="#${e.id}"><span class="no">${esc(e.no)}</span><span class="t">${esc(e.title)}${e.code ? ` ${codeTag(e.code)}` : ''}</span>${pageOf(e.heading)}</a></li>`)
  .join('')}</ol>`;

const SERIF = `'Times New Roman', 'Liberation Serif', Times, serif`;
const SANS = `Arial, 'Liberation Sans', Helvetica, sans-serif`;
// Times New Roman and Arial on macOS and Windows, their metric twins Liberation Serif and Sans on the
// Linux runner that builds the deployed PDF: the same line breaks and page breaks everywhere
const css = `
@page { margin: 12mm 12mm 14mm; }
body { font: 10pt/1.3 ${SERIF}; color: #000; margin: 0; }
@media screen { body { max-width: 190mm; margin: 0 auto; padding: 12mm; } }
h1, h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
h1 { font-size: 16pt; margin: 0 0 6pt; }
h2 { font-size: 13pt; margin: 0 0 2pt; }
h3 { font: bold 9pt/1.3 ${SANS}; margin: 8pt 0 2pt; }
h4 { font-size: 10.5pt; margin: 6pt 0 2pt; }
p { margin: 0 0 4pt; text-align: justify; }
ul, ol { margin: 0 0 4pt; }
a { color: inherit; }
.new-page, .howto, .sheet-front, .sheet-back, .notes-page { break-before: page; page-break-before: always; }
.front .title { font-size: 24pt; margin: 0 0 4pt; }
.front .subtitle { font-style: italic; margin-bottom: 2pt; }
.front .counts { font: 9pt ${SANS}; }
.front h2, .howto h2 { margin-top: 12pt; border-bottom: .75pt solid #000; padding-bottom: 1pt; }
.howto h2 { margin-top: 0; }
ol.toc { list-style: none; columns: 2; column-gap: 8mm; padding: 0; margin-top: 4pt; }
ol.toc li { break-inside: avoid; margin-bottom: 1.5pt; }
ol.toc a { display: flex; align-items: baseline; gap: 4pt; text-decoration: none; }
ol.toc .no { flex: 0 0 1.4em; text-align: right; }
ol.toc .t { flex: 1 1 auto; }
ol.toc .pg { flex: 0 0 auto; }
.pg:empty { display: none; }
.pg-ref:has(.pg:empty) { display: none; }
@media print {
  .pg, .pg:empty { display: inline-block; min-width: 1.6em; text-align: right; }
  .pg-ref, .pg-ref:has(.pg:empty) { display: inline; }
  details.answers > summary { display: none; }
}
.part { margin: 14pt 0 0; }
.part h1 { border-bottom: 2pt solid #000; padding-bottom: 2pt; }
.part + .chapter { margin-top: 6pt; }
.chapter { margin-top: 16pt; }
.chapter-head { border-top: 1.5pt solid #000; padding-top: 4pt; break-inside: avoid; break-after: avoid; page-break-after: avoid; }
.part + .chapter .chapter-head, .part + .chapter-head { border-top: none; padding-top: 0; }
.meta { font: 8.5pt/1.3 ${SANS}; margin-bottom: 2pt; }
.code { font: bold 7pt/1 ${SANS}; border: .6pt solid #000; border-radius: 1.5pt; padding: .5pt 1.5pt; white-space: nowrap; }
.qr { float: right; width: 14mm; margin: 1pt 0 2pt 6pt; text-align: center; font: 6pt/1.1 ${SANS}; color: #000; text-decoration: none; }
.qr svg { display: block; width: 14mm; height: 14mm; }
.lead { font-style: italic; }
.group { border-bottom: .5pt solid #000; padding: 0 0 3pt; margin: 0 0 5pt; }
.group-title { font: bold 9pt/1.3 ${SANS}; margin-bottom: 1pt; }
.group p { margin: 0 0 1pt; font-size: 9pt; }
figure { margin: 0; }
figcaption { font: 8pt/1.25 ${SANS}; margin-top: 2pt; text-align: left; }
svg.board { display: block; width: 100%; height: auto; }
svg.board .dark { fill: #d9d9d9; }
svg.board .edge { fill: none; stroke: #000; stroke-width: 1.5; }
svg.board .coords { font: 15px ${SANS}; text-anchor: middle; fill: #000; }
.explain { display: flow-root; }
.explain > figure { float: right; width: 48mm; margin: 2pt 0 4pt 10pt; }
ol.line { list-style: none; margin: 0; padding: 0; }
ol.line li { margin: 0 0 2.5pt; }
.branches { margin: 2pt 0 3pt 2pt; padding: 0 0 0 7pt; border-left: 1pt solid #000; font-size: 9.5pt; }
.branches-title { font-style: italic; }
.branch { margin: 2pt 0; }
.branch ol.line { padding-left: 8pt; }
.warn { font-weight: bold; font-style: italic; }
ul.traps { padding-left: 13pt; }
ul.traps li { margin-bottom: 2pt; }
.see-practice { margin-top: 6pt; font-style: italic; }
.sheet { display: flow-root; }
.sheet-title { font: bold 10pt/1.3 ${SANS}; border-bottom: .75pt solid #000; padding-bottom: 1pt; margin: 0 0 6pt; }
.pitem { display: flow-root; margin: 0 0 7pt; }
.pitem h3 { margin-top: 0; }
.pstart { border-top: 1pt solid #000; padding-top: 4pt; }
.pstart > figure { float: right; width: 38mm; margin: 0 0 4pt 8pt; }
.cont { font: italic 8.5pt/1.3 ${SANS}; border-top: 1pt solid #000; padding-top: 3pt; margin: 0 0 3pt; }
.reply-head { margin: 0 0 2pt; }
ol.practice { list-style: none; columns: 2; column-gap: 8mm; padding: 0; margin: 0 0 3pt; font-size: 9.5pt; }
ol.practice li { break-inside: avoid; margin-bottom: 1.5pt; text-indent: -1.2em; padding-left: 1.2em; }
.hint { font-size: 8pt; }
.pitem.replies { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8mm; }
.pitem.replies > details { grid-column: 1 / -1; }
.reply ol.practice { columns: 1; }
.reply-head { text-align: left; }
.pitem.exercises { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt 8mm; }
.pitem.exercises > h4, .pitem.exercises > details { grid-column: 1 / -1; margin: 0; }
.exercise { display: flex; gap: 6pt; align-items: flex-start; }
.exercise > figure { flex: 0 0 38mm; }
.exercise p { text-align: left; font-size: 9.5pt; }
.blankline { text-align: left; margin: 3pt 0 0; }
code { font: 8pt 'Courier New', 'Liberation Mono', monospace; }
.card { border: 1pt dashed #000; padding: 6pt 9pt 5pt; margin: 14pt 0 0; width: 140mm; break-inside: avoid; }
.card table { border-collapse: collapse; width: 100%; margin: 0 0 4pt; font-size: 10.5pt; }
.card th { font: bold 9pt ${SANS}; text-align: left; padding: 0 0 3pt; border-bottom: .75pt solid #000; }
.card td { padding: 3pt 0 2pt; vertical-align: top; border-bottom: .25pt solid #999; }
.card td.n { width: 1.4em; }
.card .pts { text-align: right; white-space: nowrap; padding-left: 8pt; font-family: ${SANS}; font-size: 9pt; }
.card-note { font: 7.5pt/1.25 ${SANS}; text-align: left; margin: 0; }
details.answers { margin: 2pt 0 0; }
details.answers > summary { font: 8.5pt ${SANS}; cursor: pointer; }
.answer-body { columns: 2; column-gap: 8mm; font-size: 9pt; line-height: 1.25; }
.answer-body p { text-align: left; margin: 0 0 3pt; break-inside: avoid; }
.answer-body .ach { font: bold 8.5pt/1.3 ${SANS}; margin: 5pt 0 2pt; break-after: avoid; }
.answer-body .ach:first-child { margin-top: 0; }
.drills { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7pt 4mm; margin-top: 4pt; }
.drill .blankline { font-size: 9pt; }
.plan-line { display: flow-root; }
.plan-line > figure { float: right; width: 40mm; margin: 0 0 4pt 10pt; }
.moves { font-size: 10pt; }
ul.notes { padding-left: 13pt; font-size: 9.5pt; }
`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The hoot65 Opening Book</title><style>${css}</style></head><body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">${pieceSymbols}</svg>
<section class="front"><h1 class="title">The hoot65 Opening Book</h1><p class="subtitle">Personalized opening lessons, weakness drills and repertoire lines, generated from the my-chess curriculum on ${new Date().toISOString().slice(0, 10)}.</p><p class="counts">${openingLessons.length - drillCount} lessons · ${drillCount} positions from your games · ${answerCount} practice answers · ${library.length} pattern-library chapters</p>${
  mastered.length ? `<p class="counts">Left out as mastered: ${mastered.join(', ')}.</p>` : ''
}${contents}</section>
<section class="howto"><h2>How to use this book</h2><p>${esc(howToUse())}</p><p>${esc(printing())}</p><p>${esc(codes)}</p>${boardCard}</section>
${chapters.join('\n')}
${practicePart}
</body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
const htmlPath = resolve(OUT_DIR, 'lesson-book.html');
writeFileSync(htmlPath, html);
console.log(`wrote ${htmlPath} (${openingLessons.length - drillCount} lessons, ${drillCount} positions from your games, ${library.length} library chapters, ${answerCount} answers)`);
