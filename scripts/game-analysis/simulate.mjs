// Engine simulator: from each start position, play R games forward with Maia sampling
// both sides at their own ratings, for up to PLIES plies, then score the end position
// with Maia's value head (or the result, if the game ended). Output: mean score for hoot65.
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { Maia3 } from 'maia3-js';
const [inFile, outFile, rolloutsArg, pliesArg, seedArg] = process.argv.slice(2);
const R = Number(rolloutsArg ?? 16), PLIES = Number(pliesArg ?? 20);
let seed = Number(seedArg ?? 1) >>> 0;
const rand = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const maia = new Maia3({ variant: '5m', modelPath: new URL('./node_modules/maia3-js/models/maia3_5m.onnx', import.meta.url).pathname, intraOpNumThreads: 8 });
await maia.load();
const starts = JSON.parse(fs.readFileSync(inFile, 'utf8'));
// One rollout = one live game. me: 'w' | 'b' is hoot65's colour.
const games = [];
for (const s of starts) for (let r = 0; r < R; r++) {
  const chess = new Chess(s.fen), hist = [...(s.priorFens || [])];
  if (s.move) { hist.push(chess.fen()); chess.move({ from: s.move.slice(0, 2), to: s.move.slice(2, 4), promotion: s.move[4] }); }
  const g = { s, chess, hist, plies: 0, result: null };
  if (chess.isCheckmate()) g.result = chess.turn() === s.me ? 0 : 1; else if (chess.isDraw()) g.result = 0.5;
  games.push(g);
}
const t0 = Date.now();
for (let step = 0; step <= PLIES; step++) {
  const live = games.filter((g) => g.result === null);
  if (!live.length) break;
  const inputs = live.map((g) => {
    const stmIsMe = g.chess.turn() === g.s.me;
    return { fen: g.chess.fen(), priorFens: g.hist.slice(-8), selfElo: stmIsMe ? g.s.myElo : g.s.oppElo, oppoElo: stmIsMe ? g.s.oppElo : g.s.myElo };
  });
  const res = await maia.predictBatch(inputs, { onError: 'collect', maxBatchSize: 256 });
  live.forEach((g, i) => {
    const r = res[i];
    const stmIsMe = g.chess.turn() === g.s.me;
    if (g.chess.isCheckmate()) { g.result = stmIsMe ? 0 : 1; return; }
    if (g.chess.isDraw()) { g.result = 0.5; return; }
    if (r instanceof Error) { g.result = 0.5; return; }
    if (step === PLIES) { g.result = stmIsMe ? r.winProbability : 1 - r.winProbability; return; }
    let x = rand(), pick = null;
    for (const [uci, p] of r.moves) { x -= p; if (x <= 0) { pick = uci; break; } }
    if (!pick) pick = [...r.moves.keys()][0];
    g.hist.push(g.chess.fen());
    g.chess.move({ from: pick.slice(0, 2), to: pick.slice(2, 4), promotion: pick[4] });
    g.plies++;
    if (g.chess.isCheckmate()) g.result = g.chess.turn() === g.s.me ? 0 : 1;
    else if (g.chess.isDraw()) g.result = 0.5;
  });
}
const by = new Map();
for (const g of games) { const k = g.s.id; if (!by.has(k)) by.set(k, []); by.get(k).push(g.result); }
const out = starts.map((s) => { const xs = by.get(s.id); const m = xs.reduce((a, b) => a + b, 0) / xs.length; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); return { id: s.id, mean: +m.toFixed(4), se: +(sd / Math.sqrt(xs.length)).toFixed(4), n: xs.length }; });
fs.writeFileSync(outFile, JSON.stringify(out));
console.error(`simulated ${games.length} games from ${starts.length} starts in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
