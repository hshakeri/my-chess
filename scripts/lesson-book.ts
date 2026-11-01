/**
 * Builds "The hoot65 Opening Book": every core opening lesson, weakness drill and trap lesson of the
 * curriculum, plus the tailored repertoire lines, as one dense printable document. Each chapter first
 * explains the position (the annotated line, the opponent's known replies, the mistakes to avoid),
 * then gives an over-the-board practice section whose answers sit in a key at the very end. The three
 * drill sets from hoot65's games are one page each: twelve positions to solve.
 *
 * Laid out for paper: the title and contents share the first page, chapters run on instead of each
 * opening a new page, diagrams are vector drawings in the app's own piece set (no font decides how a
 * piece looks), dark squares are a light grey, all text is black, and the key is two columns of run-in
 * answers. The page fits both US Letter and A4; `npm run book:pdf` renders Letter unless BOOK_PAPER=a4.
 *
 *   npx tsx scripts/lesson-book.ts            -> book/lesson-book.html (`npm run book:pdf` renders the PDF)
 *
 * The output folder is ignored by git (no PDF is ever tracked).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Chess } from 'chess.js';
import { allCurriculumLessons, curriculumCourses } from '../src/curriculum';
import { PatternGroup, patternGroupOf, patternPath, inPatternOrder } from '../src/curriculum/patternPath';
import { plyLabel, replyOptions } from '../src/curriculum/builder';
import { drillSetOf, gameDrillData } from '../src/curriculum/gameDrills';
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

interface KeyEntry {
  chapter: string;
  label: string;
  answer: string;
}
const answerKey: KeyEntry[] = [];
/** Every blank, exercise and drill position the reader answers (a key entry can hold several). */
let answerCount = 0;

interface TocEntry {
  /** The chapter heading as printed, which is also the title of its PDF bookmark. */
  heading: string;
  id: string;
  no: string;
  title: string;
}
/** The contents in print order; `npm run book:pdf` fills in each page number from the PDF's bookmarks. */
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
 * Practice list for a sequence: the student's moves as blanks, the replies given. The sequence's answers
 * go to the key as one run-in entry ("Line: 2.exd5 3.Nc3 4.d4").
 */
function practiceList(lesson: CurriculumLesson, moves: CurriculumMove[], plyOffset: number, chapter: string, keyLabel: string): string {
  let html = `<ol class="practice">`;
  const answers: string[] = [];
  moves.forEach((move, i) => {
    const label = plyLabel(lesson.initialFen, plyOffset + i, move.san);
    const no = `${label.split(/\.+/)[0]}${label.includes('...') ? '...' : '.'}`;
    if (move.isUserMove) {
      html += `<li class="blank"><b>${esc(no)}</b> ________ <span class="hint">(${esc(move.hintTheme || move.hintPiece || 'find the move')})</span></li>`;
      answers.push(`${no}${move.san}${move.accept?.san?.length ? ` (also ${move.accept.san.join(', ')})` : ''}`);
      answerCount++;
    } else {
      html += `<li class="given"><b>${esc(label)}</b> (given)</li>`;
    }
  });
  if (answers.length) answerKey.push({ chapter, label: keyLabel, answer: answers.join(' ') });
  return `${html}</ol>`;
}

/** The heading block of a chapter, kept together and with what follows it. */
function chapterHead(title: string, group: PatternGroup | undefined, extra = ''): string {
  return `<header class="chapter-head">${group ? groupIntro(group) : ''}<h2>${esc(title)}</h2>${extra}</header>`;
}

function renderLesson(lesson: CurriculumLesson, n: number, group?: PatternGroup, newPage = false, tocTitle = lesson.title): string {
  const startPly = lesson.startPly ?? 0;
  const prefix = lesson.moves.slice(0, startPly).map((m) => m.san);
  const drillFen = fenAfter(lesson.initialFen, prefix);
  const side: 'w' | 'b' = lesson.targetColor === 'black' ? 'b' : 'w';
  const sideName = side === 'w' ? 'White' : 'Black';
  const toMove = new Chess(drillFen).turn();
  const userMoves = lesson.moves.filter((m, i) => i >= startPly && m.isUserMove);
  const branches = collectBranches(lesson.moves, [], startPly);
  const chapter = `${n}. ${lesson.title}`;
  toc.push({ heading: chapter, id: `ch-${n}`, no: `${n}.`, title: tocTitle });

  const meta = `<p class="meta">${lesson.eco ? `ECO ${esc(lesson.eco)} · ` : ''}You play ${sideName} · ${esc(lesson.sourceBook)}, ${esc(lesson.author)}${lesson.pagesRef ? ` (${esc(lesson.pagesRef)})` : ''}</p>`;
  let html = `<section class="chapter${newPage ? ' new-page' : ''}" id="ch-${n}">${chapterHead(chapter, group, `${meta}${lesson.subtitle ? `<p class="lead">${esc(lesson.subtitle)}</p>` : ''}`)}`;

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

  // Practice section: cover the answers, set up the start, play your moves
  html += `<h3 class="practice-title">Practice over the board</h3>`;
  html += `<p>Set up the start position of the drill (FEN <code>${esc(drillFen)}</code>) with ${sideName} nearest you, cover the explanation above, and play your ${userMoves.length} move${userMoves.length === 1 ? '' : 's'} of the line while a partner (or you, with the key) plays the replies. Each move you have to find is listed as a blank below; the opponent's replies are given so you can continue.${
    branches.length ? ` Then do the same for the ${branches.length} other repl${branches.length === 1 ? 'y' : 'ies'} after it: play the given moves to reach the position and find yours.` : ''
  }</p>`;
  html += practiceList(lesson, lesson.moves.slice(startPly), startPly, chapter, 'Line');
  if (branches.length) {
    html += `<h4>The other replies</h4>`;
    branches.forEach((b, k) => {
      const tag = branchTag(k);
      html += `<div class="branch-practice"><p><b>Reply ${tag}</b> · reach it with <b>${esc(moveText(lesson.initialFen, b.path))}</b></p>`;
      html += practiceList(lesson, b.continuation, b.path.length, chapter, `Reply ${tag}`);
      html += `</div>`;
    });
  }

  if (lesson.exercises.length > 0) {
    html += `<h4>Exercises</h4><div class="exercises">`;
    lesson.exercises.forEach((ex, k) => {
      const turn = ex.turn ?? (new Chess(ex.fen).turn() as 'w' | 'b');
      const label = `Exercise ${n}.${k + 1}`;
      html += `<div class="exercise"><figure class="diagram">${diagram(ex.fen, turn)}<figcaption><b>${esc(label)}</b>${ex.title ? `: ${esc(ex.title)}` : ''} · ${turn === 'w' ? 'White' : 'Black'} to move</figcaption></figure><div><p>${esc(ex.prompt)}</p><p class="blankline">Your answer: ______________</p></div></div>`;
      answerKey.push({ chapter, label, answer: `${moveText(ex.fen, ex.solutionSan)}. ${ex.explanation}` });
      answerCount++;
    });
    html += `</div>`;
  }
  html += `</section>`;
  return html;
}

const drillById = new Map([...gameDrillData.threat, ...gameDrillData.free, ...gameDrillData.hang].map((d) => [`lesson-game-${d.id}`, d] as const));

/**
 * A drill set from hoot65's games as one chapter on one page: each position as a diagram from the
 * student's side, just after the opponent's move, with the right moves and the game's story in the key.
 */
function renderDrillSet(lessons: CurriculumLesson[], n: number, group: PatternGroup | undefined, newPage: boolean): string {
  const name = group ? group.title : 'Positions from your games';
  const chapter = `${n}. ${name}`;
  toc.push({ heading: chapter, id: `ch-${n}`, no: `${n}.`, title: `${name} (${lessons.length} positions from your games)` });
  const intro = `<p>${lessons.length} positions from your recent games, newest first. Each diagram is drawn from your side just after your opponent's move, which is named under it. Find your move and write it down, then check the key: it lists every move that is right and what happened in the game.</p>`;
  let html = `<section class="chapter drill-set${newPage ? ' new-page' : ''}" id="ch-${n}">${chapterHead(chapter, group, intro)}<div class="drills">`;
  lessons.forEach((lesson, k) => {
    const [opp, mine] = lesson.moves;
    const drill = drillById.get(lesson.id);
    const side: 'w' | 'b' = lesson.targetColor === 'black' ? 'b' : 'w';
    const label = `${n}.${k + 1}`;
    const caption = `vs ${drill?.opponent ?? ''}, ${drill?.date ?? ''}. After ${plyLabel(lesson.initialFen, 0, opp.san)}, ${side === 'w' ? 'White' : 'Black'} to move.`;
    html += `<div class="drill"><figure class="diagram">${diagram(opp.fenAfter || lesson.initialFen, side)}<figcaption><b>${esc(label)}</b> ${esc(caption)}</figcaption></figure><p class="blankline">Your move: __________</p></div>`;
    const also = mine.accept?.san?.length ? ` (also ${mine.accept.san.join(', ')})` : '';
    answerKey.push({ chapter, label, answer: `${mine.san}${also}. ${mine.annotation ?? ''} ${lesson.thematicObjective ?? ''}`.trim() });
    answerCount++;
  });
  html += `</div></section>`;
  return html;
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

const core = allCurriculumLessons.filter((l) => l.relevance !== 'outside-repertoire');
// Part I follows the app's study path: lessons grouped by the pattern they repeat
const openingLessons = inPatternOrder(core.filter((l) => l.category !== 'fundamentals'));

/** The heading that opens a study-path group, printed above the group's first chapter. */
function groupIntro(group: PatternGroup): string {
  return `<div class="group"><div class="group-title">Pattern ${patternPath.indexOf(group) + 1} · ${esc(group.title)}</div><p>${esc(group.idea)}</p><p><b>Check before you move:</b> ${esc(group.check)}</p></div>`;
}
const library = allCurriculumLessons.filter((l) => l.relevance === 'outside-repertoire');

/** A part heading; it runs on with the chapter after it unless `newPage`. */
function partHead(title: string, text: string, newPage = false): string {
  return `<section class="part${newPage ? ' new-page' : ''}"><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ''}</section>`;
}

const howToUse =
  "These chapters come from your own Chess.com games (hoot65) and the openings you actually play, in the order of the app's study path: lessons that repeat the same pattern follow one another, and each group opens with the check that catches it. The first three chapters are positions from your recent games: a piece your opponent's move attacked that stayed where it was, a piece of theirs that could have been won, and a move of yours that left a piece where it could be taken. Each lesson chapter after them explains the position first; the practice section that follows, for the main line and for every other reply your opponents chose, is meant to be done on a real board with the explanation covered. Answers are in the key at the end.";

const playing = (l: CurriculumLesson) => `${l.title} (you play ${l.targetColor === 'black' ? 'Black' : 'White'})`;

let n = 0;
const chapters: string[] = [];
// Part I opens the second page: the first drill set fills it, and each set after it gets a page of its own
chapters.push(partHead('Part I · Your drills and repertoire lessons', '', true));
let previousGroup: PatternGroup | undefined;
let previousLessonId = '';
const renderedSets = new Set<CurriculumLesson[]>();
for (const lesson of openingLessons) {
  const group = patternGroupOf(lesson.id);
  const set = drillSetOf(lesson.id);
  if (set) {
    // A drill set is one chapter of positions, printed where its first position falls
    if (!renderedSets.has(set)) chapters.push(renderDrillSet(set, ++n, group !== previousGroup ? group : undefined, renderedSets.size > 0));
    renderedSets.add(set);
  } else {
    // The drill pages hold nothing else, so the first lesson after them opens a page; later lessons run on
    chapters.push(
      renderLesson(lesson, ++n, group !== previousGroup ? group : undefined, previousGroup !== undefined && renderedSets.size > 0 && !!drillSetOf(previousLessonId), playing(lesson))
    );
  }
  previousGroup = group;
  previousLessonId = lesson.id;
}
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

// The key starts a new page (printed double-sided, that can be the back of the last practice page); two columns of run-in entries
toc.push({ heading: 'Answer key', id: 'key', no: '', title: 'Answer key' });
let key = `<section class="key new-page" id="key"><h1>Answer key</h1><div class="key-body">`;
let currentChapter = '';
for (const e of answerKey) {
  if (e.chapter !== currentChapter) {
    currentChapter = e.chapter;
    key += `<h3>${esc(currentChapter)}</h3>`;
  }
  key += `<p><b>${esc(e.label)}</b> ${esc(e.answer)}</p>`;
}
key += `</div></section>`;

const drillCount = openingLessons.filter((l) => drillSetOf(l.id)).length;
// One line per chapter (a drill set is one chapter); the page column stays empty in the HTML
const contents = `<h2>Contents</h2><ol class="toc">${toc
  .map((e) => `<li data-heading="${attr(e.heading)}"><a href="#${e.id}"><span class="no">${esc(e.no)}</span><span class="t">${esc(e.title)}</span><span class="pg"></span></a></li>`)
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
.new-page { break-before: page; page-break-before: always; }
.front .title { font-size: 24pt; margin: 0 0 4pt; }
.front .subtitle { font-style: italic; margin-bottom: 2pt; }
.front .counts { font: 9pt ${SANS}; }
.front h2 { margin-top: 12pt; border-bottom: .75pt solid #000; padding-bottom: 1pt; }
ol.toc { list-style: none; columns: 2; column-gap: 8mm; padding: 0; margin-top: 4pt; }
ol.toc li { break-inside: avoid; margin-bottom: 1.5pt; }
ol.toc a { display: flex; align-items: baseline; gap: 4pt; color: inherit; text-decoration: none; }
ol.toc .no { flex: 0 0 1.4em; text-align: right; }
ol.toc .t { flex: 1 1 auto; }
ol.toc .pg { flex: 0 0 auto; padding-left: 4pt; }
ol.toc .pg:empty { display: none; }
.part { margin: 14pt 0 0; }
.part h1 { border-bottom: 2pt solid #000; padding-bottom: 2pt; }
.part + .chapter { margin-top: 6pt; }
.chapter { margin-top: 16pt; }
.chapter-head { border-top: 1.5pt solid #000; padding-top: 4pt; break-inside: avoid; break-after: avoid; page-break-after: avoid; }
.part + .chapter .chapter-head { border-top: none; padding-top: 0; }
.meta { font: 8.5pt/1.3 ${SANS}; margin-bottom: 2pt; }
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
.practice-title { margin-top: 10pt; border-top: .75pt dashed #000; padding-top: 5pt; }
ol.practice { list-style: none; columns: 2; column-gap: 8mm; padding: 0; margin: 0 0 5pt; }
ol.practice li { break-inside: avoid; margin-bottom: 1.5pt; }
.hint { font-size: 8.5pt; }
.branch-practice { break-inside: avoid; margin: 0 0 3pt; }
.branch-practice p { margin: 2pt 0; }
.exercises { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt 8mm; }
.exercise { display: flex; gap: 6pt; align-items: flex-start; break-inside: avoid; }
.exercise > figure { flex: 0 0 38mm; }
.exercise p { text-align: left; font-size: 9.5pt; }
.blankline { text-align: left; margin: 3pt 0 0; }
code { font: 8pt 'Courier New', 'Liberation Mono', monospace; }
.drills { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7pt 4mm; margin-top: 4pt; }
.drill { break-inside: avoid; }
.drill .blankline { font-size: 9pt; }
.plan-line { display: flow-root; }
.plan-line > figure { float: right; width: 40mm; margin: 0 0 4pt 10pt; }
.moves { font-size: 10pt; }
ul.notes { padding-left: 13pt; font-size: 9.5pt; }
.key-body { columns: 2; column-gap: 8mm; font-size: 8.5pt; line-height: 1.25; }
.key-body h3 { font-size: 8pt; margin: 5pt 0 1pt; }
.key-body h3:first-child { margin-top: 0; }
.key-body p { text-align: left; margin: 0 0 2pt; }
`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The hoot65 Opening Book</title><style>${css}</style></head><body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">${pieceSymbols}</svg>
<section class="front"><h1 class="title">The hoot65 Opening Book</h1><p class="subtitle">Personalized opening lessons, weakness drills and repertoire lines, generated from the my-chess curriculum on ${new Date().toISOString().slice(0, 10)}.</p><p class="counts">${openingLessons.length - drillCount} lessons · ${drillCount} positions from your games · ${answerCount} practice answers · ${library.length} pattern-library chapters</p><h2>How to use this book</h2><p>${esc(howToUse)}</p>${contents}</section>
${chapters.join('\n')}
${key}
</body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
const htmlPath = resolve(OUT_DIR, 'lesson-book.html');
writeFileSync(htmlPath, html);
console.log(`wrote ${htmlPath} (${openingLessons.length - drillCount} lessons, ${drillCount} positions from your games, ${library.length} library chapters, ${answerCount} answers)`);
