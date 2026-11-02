/**
 * Engine audit of the curriculum: every move the app accepts as an answer, checked with Stockfish.
 *
 * For every decision of every lesson (main lines and branches, the drills from hoot65's games
 * included), each exercise, and each "Not X?!" warning, Stockfish scores the best move and each
 * move in question at the same depth (UCI `searchmoves`), and the audit reports what a move gives
 * away against the best one, in centipawns:
 *   - an answer that loses 70 or more while the game is still open (|best| < 600),
 *   - an accepted alternative that loses 150 or more,
 *   - a warned-against move ("Not X?!") that loses less than 20 (as good as the answer),
 *   - an exercise solution that loses 70 or more,
 *   - a drill whose move from the game loses less than 100 (the drill's premise is weak).
 *
 * The engine is the `stockfish` npm package (WASM), which is not a dependency of the app: install it
 * in scripts/game-analysis (npm install there) or point STOCKFISH_JS at a Stockfish .js file.
 *
 *   npx tsx scripts/engine-audit.ts [depth=18] [out.json] [lesson-id-prefix]
 */
import { writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { allCurriculumLessons } from '../src/curriculum';
import { enumerateDecisions, findMoveAtPath, plyLabel } from '../src/curriculum/builder';
import { gameDrillData, isGameDrill } from '../src/curriculum/gameDrills';
// @ts-expect-error: a plain ES module of the analysis toolkit, without type declarations
import { Stockfish, MATE } from './game-analysis/stockfish.mjs';

const [depthArg = '18', outFile, only = ''] = process.argv.slice(2);
const DEPTH = Number(depthArg);

interface Finding {
  kind: 'answer' | 'alternative' | 'warning' | 'exercise' | 'drill_played' | 'drill_accepted';
  lessonId: string;
  label: string;
  fen: string;
  move: string;
  loss: number;
  best: string;
  bestScore: number;
  flagged: boolean;
}

const uciOf = (fen: string, san: string): string | null => {
  try {
    const m = new Chess(fen).move(san);
    return `${m.from}${m.to}${m.promotion ?? ''}`;
  } catch {
    return null;
  }
};
const sanOf = (fen: string, uci: string): string => {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return uci;
  }
};
const show = (score: number) => (Math.abs(score) >= MATE - 1000 ? `${score > 0 ? '' : '-'}M${MATE - Math.abs(score)}` : (score / 100).toFixed(2));

async function main() {
  const sf = await Stockfish.start({ engine: 'full', threads: 6, hash: 512 });
  const findings: Finding[] = [];
  const bestCache = new Map<string, { score: number; move: string }>();
  const best = async (fen: string) => {
    if (!bestCache.has(fen)) {
      const r = await sf.analyse(fen, { depth: DEPTH });
      bestCache.set(fen, { score: r.score, move: sanOf(fen, r.bestmove) });
    }
    return bestCache.get(fen)!;
  };
  const lossOf = async (fen: string, san: string) => {
    const b = await best(fen);
    if (san === b.move) return { loss: 0, ...b };
    const uci = uciOf(fen, san);
    if (!uci) return null;
    const r = await sf.analyse(fen, { depth: DEPTH, searchmoves: [uci] });
    return { loss: Math.max(0, b.score - r.score), ...b };
  };
  const record = (f: Omit<Finding, 'flagged'>, flagged: boolean) => findings.push({ ...f, flagged });

  const lessons = allCurriculumLessons.filter((l) => l.id.startsWith(only));
  let done = 0;
  for (const lesson of lessons) {
    const drill = isGameDrill(lesson.id);
    for (const d of enumerateDecisions(lesson)) {
      const label = plyLabel(lesson.initialFen, d.path.length, d.acceptedSan[0]);
      for (const [k, san] of d.acceptedSan.entries()) {
        const r = await lossOf(d.fen, san);
        if (!r) continue;
        const kind = drill ? 'drill_accepted' : k === 0 ? 'answer' : 'alternative';
        const flagged = drill ? r.loss >= 200 : k === 0 ? r.loss >= 70 && Math.abs(r.score) < 600 : r.loss >= 150;
        record({ kind, lessonId: lesson.id, label, fen: d.fen, move: san, loss: r.loss, best: r.move, bestScore: r.score }, flagged);
      }
      // The moves the lesson warns against by name
      const move = findMoveAtPath(lesson, [...d.path, d.acceptedSan[0]]);
      if (!drill) {
        for (const key of Object.keys(move?.wrongMoveFeedback ?? {})) {
          if (/^[a-h][1-8]$/.test(key) || d.acceptedSan.includes(key)) continue;
          const r = await lossOf(d.fen, key);
          if (!r) continue;
          record({ kind: 'warning', lessonId: lesson.id, label, fen: d.fen, move: key, loss: r.loss, best: r.move, bestScore: r.score }, r.loss < 20);
        }
      }
    }
    for (const [k, ex] of lesson.exercises.entries()) {
      const r = await lossOf(ex.fen, ex.solutionSan[0]);
      if (!r) continue;
      record({ kind: 'exercise', lessonId: lesson.id, label: `Exercise ${k + 1}`, fen: ex.fen, move: ex.solutionSan[0], loss: r.loss, best: r.move, bestScore: r.score }, r.loss >= 70);
    }
    done++;
    process.stderr.write(`\r${done}/${lessons.length} lessons, ${findings.length} moves scored`);
  }
  // The move from each drill's game must be a real mistake
  for (const d of [...gameDrillData.threat, ...gameDrillData.free, ...gameDrillData.hang]) {
    if (!`lesson-game-${d.id}`.startsWith(only)) continue;
    const c = new Chess(d.fenBefore);
    c.move(d.lastSan);
    const r = await lossOf(c.fen(), d.played);
    if (!r) continue;
    record({ kind: 'drill_played', lessonId: `lesson-game-${d.id}`, label: `${d.opponent}, ${d.date}`, fen: c.fen(), move: d.played, loss: r.loss, best: r.move, bestScore: r.score }, r.loss < 100);
  }
  sf.quit();
  process.stderr.write('\n');

  if (outFile) writeFileSync(outFile, JSON.stringify({ depth: DEPTH, findings }, null, 1));
  const flagged = findings.filter((f) => f.flagged);
  console.log(`# Engine audit (Stockfish 19, depth ${DEPTH})\n`);
  console.log(`${findings.length} moves scored, ${flagged.length} flagged.\n`);
  for (const kind of ['answer', 'alternative', 'warning', 'exercise', 'drill_accepted', 'drill_played'] as const) {
    const rows = flagged.filter((f) => f.kind === kind).sort((a, b) => b.loss - a.loss);
    if (!rows.length) continue;
    console.log(`\n## ${kind} (${rows.length})\n`);
    console.log('| lesson | position | move | loss (cp) | Stockfish best | best score |');
    console.log('|---|---|---|---|---|---|');
    for (const f of rows) console.log(`| ${f.lessonId} | ${f.label} | ${f.move} | ${f.loss} | ${f.best} | ${show(f.bestScore)} |`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
