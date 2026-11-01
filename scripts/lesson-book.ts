/**
 * Builds "The hoot65 Opening Book": every core opening lesson, weakness drill and trap lesson of the
 * curriculum, plus the tailored repertoire lines, as one dense printable document. Each chapter first
 * explains the position (the annotated line, the opponent's known replies, the mistakes to avoid),
 * then gives an over-the-board practice section whose answers sit in a key at the very end. The two
 * drill sets from hoot65's games are one chapter each: a page of positions to solve.
 *
 *   npx tsx scripts/lesson-book.ts            -> book/lesson-book.html and book/lesson-book.pdf
 *
 * The output folder is ignored by git (no PDF is ever tracked).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
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
const GLYPH: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A compact printable diagram of a FEN, from the side to move's point of view unless `flip` says otherwise. */
function diagram(fen: string, orientation: 'w' | 'b' = 'w'): string {
  const rows = fen.split(' ')[0].split('/');
  const ranks = orientation === 'w' ? rows : [...rows].reverse();
  let html = '<table class="board"><tbody>';
  ranks.forEach((row, ri) => {
    const rankNo = orientation === 'w' ? 8 - ri : ri + 1;
    const cells: string[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) cells.push('');
      else cells.push(GLYPH[ch] || ch);
    }
    const ordered = orientation === 'w' ? cells : [...cells].reverse();
    html += `<tr><th>${rankNo}</th>`;
    ordered.forEach((c, fi) => {
      const fileIdx = orientation === 'w' ? fi : 7 - fi;
      const dark = (fileIdx + (8 - rankNo)) % 2 === 1;
      html += `<td class="${dark ? 'd' : 'l'}">${c}</td>`;
    });
    html += '</tr>';
  });
  const files = orientation === 'w' ? 'abcdefgh' : 'hgfedcba';
  html += `<tr><th></th>${files.split('').map((f) => `<th>${f}</th>`).join('')}</tr></tbody></table>`;
  return html;
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

/** Practice list for a sequence: the student's moves as blanks (answers to the key), the replies given. */
function practiceList(lesson: CurriculumLesson, moves: CurriculumMove[], plyOffset: number, chapter: string, keyPrefix: string): string {
  let html = `<ol class="practice">`;
  moves.forEach((move, i) => {
    const label = plyLabel(lesson.initialFen, plyOffset + i, move.san);
    const no = `${label.split(/\.+/)[0]}${label.includes('...') ? '...' : '.'}`;
    if (move.isUserMove) {
      html += `<li class="blank"><b>${esc(no)}</b> ________ <span class="hint">(${esc(move.hintTheme || move.hintPiece || 'find the move')})</span></li>`;
      answerKey.push({ chapter, label: `${keyPrefix}${no}`, answer: `${move.san}${move.accept?.san?.length ? ` (also ${move.accept.san.join(', ')})` : ''}` });
    } else {
      html += `<li class="given"><b>${esc(label)}</b> (given)</li>`;
    }
  });
  return `${html}</ol>`;
}

function renderLesson(lesson: CurriculumLesson, n: number, group?: PatternGroup): string {
  const startPly = lesson.startPly ?? 0;
  const prefix = lesson.moves.slice(0, startPly).map((m) => m.san);
  const drillFen = fenAfter(lesson.initialFen, prefix);
  const side: 'w' | 'b' = lesson.targetColor === 'black' ? 'b' : 'w';
  const sideName = side === 'w' ? 'White' : 'Black';
  const toMove = new Chess(drillFen).turn();
  const userMoves = lesson.moves.filter((m, i) => i >= startPly && m.isUserMove);
  const branches = collectBranches(lesson.moves, [], startPly);
  const chapter = `${n}. ${lesson.title}`;

  let html = `<section class="chapter">${group ? groupIntro(group) : ''}<h2>${esc(chapter)}</h2>`;
  html += `<p class="meta">${lesson.eco ? `ECO ${esc(lesson.eco)} · ` : ''}You play ${side === 'w' ? 'White' : 'Black'} · ${esc(lesson.sourceBook)}, ${esc(lesson.author)}${lesson.pagesRef ? ` (${esc(lesson.pagesRef)})` : ''}</p>`;
  if (lesson.subtitle) html += `<p class="lead">${esc(lesson.subtitle)}</p>`;

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
  html += `<div class="explain"><div class="diagram">${diagram(drillFen, side)}<div class="caption">${startCaption}</div></div>`;
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
  html += practiceList(lesson, lesson.moves.slice(startPly), startPly, chapter, 'Line · ');
  if (branches.length) {
    html += `<h4>The other replies</h4>`;
    branches.forEach((b, k) => {
      const tag = branchTag(k);
      html += `<div class="branch-practice"><p><b>Reply ${tag}</b> · reach it with <b>${esc(moveText(lesson.initialFen, b.path))}</b></p>`;
      html += practiceList(lesson, b.continuation, b.path.length, chapter, `Reply ${tag} · `);
      html += `</div>`;
    });
  }

  if (lesson.exercises.length > 0) {
    html += `<h4>Exercises</h4>`;
    lesson.exercises.forEach((ex, k) => {
      const turn = ex.turn ?? (new Chess(ex.fen).turn() as 'w' | 'b');
      const label = `Exercise ${n}.${k + 1}`;
      html += `<div class="exercise"><div class="diagram">${diagram(ex.fen, turn)}<div class="caption">${esc(label)}${ex.title ? `: ${esc(ex.title)}` : ''} · ${turn === 'w' ? 'White' : 'Black'} to move</div></div><p>${esc(ex.prompt)}</p><p class="blankline">Your answer: ____________________</p></div>`;
      answerKey.push({ chapter, label, answer: `${moveText(ex.fen, ex.solutionSan)}. ${ex.explanation}` });
    });
  }
  html += `</section>`;
  return html;
}

const drillById = new Map([...gameDrillData.threat, ...gameDrillData.free].map((d) => [`lesson-game-${d.id}`, d] as const));

/**
 * A drill set from hoot65's games as one chapter: each position as a diagram from the student's side,
 * just after the opponent's move, with the right moves and the game's story in the key.
 */
function renderDrillSet(lessons: CurriculumLesson[], n: number, group?: PatternGroup): string {
  const chapter = `${n}. ${group ? group.title : 'Positions from your games'}`;
  let html = `<section class="chapter">${group ? groupIntro(group) : ''}<h2>${esc(chapter)}</h2>`;
  html += `<p>${lessons.length} positions from your recent games, newest first. Each diagram is drawn from your side just after your opponent's move, which is named under it. Find your move and write it down, then check the key: it lists every move that is right and what happened in the game.</p><div class="drills">`;
  lessons.forEach((lesson, k) => {
    const [opp, mine] = lesson.moves;
    const drill = drillById.get(lesson.id);
    const side: 'w' | 'b' = lesson.targetColor === 'black' ? 'b' : 'w';
    const label = `${n}.${k + 1}`;
    const caption = `vs ${drill?.opponent ?? ''}, ${drill?.date ?? ''}. After ${plyLabel(lesson.initialFen, 0, opp.san)}, ${side === 'w' ? 'White' : 'Black'} to move.`;
    html += `<div class="drill"><div class="diagram small">${diagram(opp.fenAfter || lesson.initialFen, side)}<div class="caption"><b>${esc(label)}</b> ${esc(caption)}</div></div><p class="blankline">Your move: __________</p></div>`;
    const also = mine.accept?.san?.length ? ` (also ${mine.accept.san.join(', ')})` : '';
    answerKey.push({ chapter, label, answer: `${mine.san}${also}. ${mine.annotation ?? ''} ${lesson.thematicObjective ?? ''}`.trim() });
  });
  html += `</div></section>`;
  return html;
}

function renderPlan(plan: RepertoirePlan, n: number): string {
  let html = `<section class="chapter"><h2>${n}. Repertoire plan: ${esc(plan.name)}</h2><p>${esc(plan.description)}</p>`;
  if (plan.keyThemes.length) html += `<p><b>Themes.</b> ${plan.keyThemes.map(esc).join('; ')}.</p>`;
  plan.lines.forEach((line, i) => {
    const student = plan.color === 'white' ? 'w' : 'b';
    html += `<h3>${n}.${i + 1} ${esc(line.name)} (${esc(line.eco)})</h3><p>${esc(line.description)}</p>`;
    html += `<p class="moves"><b>${esc(moveText(plan.rootFen, line.movesSan))}</b></p>`;
    const notes = line.moves.filter((m) => m.commentary);
    if (notes.length) {
      html += `<ul class="notes">${notes.map((m) => `<li><b>${esc(plyLabel(plan.rootFen, m.ply - 1, m.san))}</b> ${esc(m.commentary || '')}</li>`).join('')}</ul>`;
    }
    html += `<div class="diagram small">${diagram(line.moves[line.moves.length - 1]?.fen || plan.rootFen, student)}<div class="caption">End of the line.</div></div>`;
    if (line.keyIdeas.length) html += `<p><b>Key ideas.</b> ${line.keyIdeas.map(esc).join('. ')}.</p>`;
    html += `<p class="practice-inline"><b>Practice.</b> From the start position, play your side of this line from memory; the opponent's moves are: ${esc(
      line.movesSan.filter((_, k) => (k % 2 === 0 ? 'w' : 'b') !== student).join(', ')
    )}.</p>`;
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

let n = 0;
const chapters: string[] = [];
chapters.push(`<section class="part"><h1>Part I · Your drills and repertoire lessons</h1><p>These chapters come from your own Chess.com games (hoot65) and the openings you actually play, in the order of the app's study path: lessons that repeat the same pattern follow one another, and each group opens with the check that catches it. The first two chapters are positions from your recent games: a piece your opponent's move attacked that stayed where it was, and a piece of theirs that could have been won. Each lesson chapter after them explains the position first; the practice section that follows, for the main line and for every other reply your opponents chose, is meant to be done on a real board with the explanation covered. Answers are in the key at the end.</p></section>`);
let previousGroup: PatternGroup | undefined;
const renderedSets = new Set<CurriculumLesson[]>();
for (const lesson of openingLessons) {
  const group = patternGroupOf(lesson.id);
  const set = drillSetOf(lesson.id);
  if (set) {
    // A drill set is one chapter of positions, printed where its first position falls
    if (!renderedSets.has(set)) chapters.push(renderDrillSet(set, ++n, group !== previousGroup ? group : undefined));
    renderedSets.add(set);
  } else {
    chapters.push(renderLesson(lesson, ++n, group !== previousGroup ? group : undefined));
  }
  previousGroup = group;
}
chapters.push(`<section class="part"><h1>Part II · The repertoire plans</h1><p>The full lines behind the lessons: White's Italian with the Evans Gambit and the Anti-Scandinavian, Black's Caro-Kann and the c6-d5 wall against 1.d4, 1.c4 and 1.Nf3.</p></section>`);
chapters.push(renderPlan(getRecommendedWhiteRepertoire(), ++n));
chapters.push(renderPlan(getRecommendedBlackRepertoire(), ++n));
chapters.push(`<section class="part"><h1>Part III · Pattern library</h1><p>Openings you do not play, kept for the patterns in them.</p></section>`);
for (const lesson of library) chapters.push(renderLesson(lesson, ++n));

let key = `<section class="chapter key"><h1>Answer key</h1>`;
let currentChapter = '';
for (const e of answerKey) {
  if (e.chapter !== currentChapter) {
    currentChapter = e.chapter;
    key += `<h3>${esc(currentChapter)}</h3>`;
  }
  key += `<p><b>${esc(e.label)}</b> ${esc(e.answer)}</p>`;
}
key += `</section>`;

const playing = (l: CurriculumLesson) => `${l.title} (you play ${l.targetColor === 'black' ? 'Black' : 'White'})`;
// A drill set takes one line of the contents, like its one chapter
const partOne = openingLessons.flatMap((l) => {
  const set = drillSetOf(l.id);
  if (!set) return [playing(l)];
  return set[0] === l ? [`${patternGroupOf(l.id)?.title ?? 'Positions from your games'} (${set.length} positions from your games)`] : [];
});
const drillCount = openingLessons.filter((l) => drillSetOf(l.id)).length;
const toc = `<section class="toc"><h1>Contents</h1><ol>${[...partOne, getRecommendedWhiteRepertoire().name, getRecommendedBlackRepertoire().name, ...library.map((l) => l.title)]
  .map((t) => `<li>${esc(t)}</li>`)
  .join('')}<li>Answer key</li></ol></section>`;

const css = `
@page { size: A4; margin: 16mm 14mm; }
body { font: 10.5pt/1.35 Georgia, 'Times New Roman', serif; color: #111; margin: 0; }
h1 { font-size: 20pt; margin: 0 0 8pt; }
h2 { font-size: 15pt; margin: 0 0 4pt; border-bottom: 1px solid #999; padding-bottom: 2pt; }
h3 { font-size: 11.5pt; margin: 10pt 0 3pt; text-transform: uppercase; letter-spacing: .04em; }
h4 { font-size: 11pt; margin: 8pt 0 3pt; }
p { margin: 0 0 5pt; text-align: justify; }
.cover { text-align: center; padding-top: 120pt; page-break-after: always; }
.cover h1 { font-size: 30pt; }
.cover p { text-align: center; }
.toc, .part { page-break-before: always; }
.chapter { page-break-before: always; }
.meta { font-size: 9pt; color: #444; margin-bottom: 2pt; }
.lead { font-style: italic; }
.explain { display: flex; gap: 10pt; align-items: flex-start; }
.explain .diagram { flex: 0 0 auto; }
.explain ol.line { flex: 1 1 auto; }
ol.line { margin: 0; padding-left: 14pt; }
ol.line li { margin: 0 0 3pt; }
ol.line li.opp { color: #333; }
ol.line li.you b { color: #0a5c36; }
.branches { margin: 3pt 0 4pt 6pt; padding: 3pt 6pt; border-left: 2px solid #bbb; font-size: 9.5pt; }
.branches-title { font-style: italic; color: #444; }
.branch { margin: 2pt 0; }
.branch ol.line { padding-left: 12pt; }
.warn { color: #9b1c1c; font-weight: bold; }
ul.traps { padding-left: 14pt; }
ul.traps li { margin-bottom: 3pt; }
table.board { border-collapse: collapse; font-size: 14pt; line-height: 1; }
table.board td { width: 18pt; height: 18pt; text-align: center; vertical-align: middle; border: 0.3pt solid #777; }
table.board td.d { background: #cfcfcf; }
table.board td.l { background: #fff; }
table.board th { font: 7pt Helvetica, Arial, sans-serif; color: #555; padding: 0 2pt; }
.diagram { display: inline-block; margin: 0 8pt 4pt 0; }
.diagram.small table.board td { width: 14pt; height: 14pt; font-size: 11pt; }
.caption { font: 8.5pt Helvetica, Arial, sans-serif; color: #444; margin-top: 2pt; max-width: 160pt; }
.practice-title { margin-top: 12pt; border-top: 1px dashed #999; padding-top: 6pt; }
ol.practice { columns: 2; padding-left: 14pt; margin: 0 0 6pt; }
ol.practice li { break-inside: avoid; margin-bottom: 2pt; }
ol.practice li.given { color: #555; }
.branch-practice { break-inside: avoid; margin: 0 0 4pt; }
.branch-practice p { margin: 2pt 0; }
.hint { font-size: 9pt; color: #555; }
.exercise { display: flex; gap: 10pt; align-items: flex-start; margin: 4pt 0 8pt; break-inside: avoid; }
.blankline { color: #555; }
.moves { font-size: 10.5pt; }
ul.notes { padding-left: 14pt; font-size: 9.5pt; }
.key p { margin-bottom: 3pt; }
.drills { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6pt 8pt; }
.drill { break-inside: avoid; }
.drill .caption { max-width: none; }
.group { border: 1px solid #0a5c36; padding: 4pt 7pt; margin: 0 0 8pt; }
.group-title { font: bold 9.5pt Helvetica, Arial, sans-serif; text-transform: uppercase; letter-spacing: .04em; color: #0a5c36; margin-bottom: 2pt; }
.group p { margin: 0 0 2pt; font-size: 9.5pt; }
code { font-size: 8.5pt; }
`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The hoot65 Opening Book</title><style>${css}</style></head><body>
<section class="cover"><h1>The hoot65 Opening Book</h1><p>Personalized opening lessons, weakness drills and repertoire lines,<br>generated from the my-chess curriculum on ${new Date().toISOString().slice(0, 10)}.</p><p>${openingLessons.length - drillCount} lessons · ${drillCount} positions from your games · ${answerKey.length} practice answers · ${library.length} pattern-library chapters</p></section>
${toc}
${chapters.join('\n')}
${key}
</body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
const htmlPath = resolve(OUT_DIR, 'lesson-book.html');
writeFileSync(htmlPath, html);
console.log(`wrote ${htmlPath} (${openingLessons.length - drillCount} lessons, ${drillCount} positions from your games, ${library.length} library chapters, ${answerKey.length} answers)`);
