// Practical audit of lesson decisions: node practical-audit.mjs <decisions.json> <out.json>
// For each decision: the lesson's answer and Stockfish's two best other moves, each scored against best
// play (Stockfish, depth 16) and against the replies Maia expects at 1150 (expected score, Lichess curve).
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { Maia3 } from 'maia3-js';
import { Stockfish, MATE } from './stockfish.mjs';
const [inFile, outFile] = process.argv.slice(2);
const decisions = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const maia = new Maia3({ variant: '5m', modelPath: new URL('./node_modules/maia3-js/models/maia3_5m.onnx', import.meta.url).pathname, intraOpNumThreads: 2 });
await maia.load();
const sf = await Stockfish.start({ engine: 'full', threads: 6, hash: 512 });
const ELO = 1150 + 400, COVER = 0.85;
const cap = (s) => Math.max(-1000, Math.min(1000, Math.abs(s) > MATE - 1000 ? Math.sign(s) * 1000 : s));
const exp = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
const uciOf = (fen, san) => { const m = new Chess(fen).move(san); return m.from + m.to + (m.promotion ?? ''); };
const sanOf = (fen, u) => new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san;
const results = [];
let k = 0;
for (const d of decisions) {
  k++;
  const c = new Chess(d.initialFen);
  const fens = [c.fen()];
  for (const m of d.history) { c.move(m); fens.push(c.fen()); }
  const fen = c.fen();
  const top = await sf.analyse(fen, { depth: 16, multipv: 3 });
  const sfOf = new Map(top.lines.map((l) => [sanOf(fen, l.pv[0]), cap(l.score)]));
  const answer = new Chess(fen).move(d.answer).san;
  const cands = [answer, ...[...sfOf.keys()].filter((s) => s !== answer)].slice(0, 3);
  const row = { ...d, fen, cands: [] };
  for (const cand of cands) {
    let bestPlay = sfOf.get(cand);
    if (bestPlay === undefined) bestPlay = cap((await sf.analyse(fen, { depth: 16, searchmoves: [uciOf(fen, cand)] })).score);
    const after = new Chess(fen); after.move(cand);
    const hist = [...fens, after.fen()];
    let practical = null;
    if (!after.isGameOver()) {
      const [r] = await maia.predictBatch([{ fen: after.fen(), priorFens: hist.slice(Math.max(0, hist.length - 8), -1), selfElo: ELO, oppoElo: ELO }], { onError: 'collect' });
      if (!(r instanceof Error)) {
        let mass = 0, score = 0;
        for (const [u, p] of [...r.moves.entries()].sort((a, b) => b[1] - a[1])) {
          if (mass >= COVER) break;
          const pos = new Chess(after.fen());
          pos.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
          const s = pos.isCheckmate() ? -MATE : (await sf.analyse(pos.fen(), { depth: 13 })).score;
          score += p * exp(cap(s));
          mass += p;
        }
        practical = score / mass;
      }
    } else practical = after.isCheckmate() ? 100 : 50;
    row.cands.push({ san: cand, bestPlay, bestPlayExp: exp(bestPlay), practical });
  }
  const a = row.cands[0];
  row.flags = row.cands.slice(1).filter((x) => x.practical !== null && a.practical !== null && ((x.bestPlay >= a.bestPlay + 50 && x.practical >= a.practical - 2) || (x.practical >= a.practical + 5 && x.bestPlay >= a.bestPlay - 30))).map((x) => x.san);
  results.push(row);
  const fmt = (x) => `${x.san} sf ${(x.bestPlay / 100).toFixed(2)} pr ${x.practical === null ? '-' : x.practical.toFixed(0)}%`;
  console.log(`${k}/${decisions.length} ${d.lessonId} ${d.history.length}: ${row.cands.map(fmt).join(' | ')}${row.flags.length ? '  << ' + row.flags.join(',') : ''}`);
}
sf.quit();
fs.writeFileSync(outFile, JSON.stringify(results, null, 1));
