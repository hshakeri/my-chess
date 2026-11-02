// The practical value of candidate moves against opponents of a rating: for each candidate, Maia's
// replies for that rating (until COVER of its probability is reached) are each scored by Stockfish,
// and the scores are averaged by Maia's shares. Scores are centipawns for the side making the
// candidate move, capped at +/-1000; "expected" turns each score into an expected score first (the
// Lichess curve, 50 + 50 * (2 / (1 + e^(-0.00368208 * cp)) - 1) percent), so a reply that leaves the
// game level counts for what it is rather than being averaged away by a blunder elsewhere.
//   node practical.mjs <elo> <depth> <file with "label | SAN moves from the start | candidate,candidate,..." lines>
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { Maia3 } from 'maia3-js';
import { Stockfish, MATE } from './stockfish.mjs';
const [eloArg = '1150', depthArg = '18', file] = process.argv.slice(2);
const elo = Number(eloArg) + 400;
const depth = Number(depthArg);
const COVER = 0.9;
const maia = new Maia3({ variant: '5m', modelPath: new URL('./node_modules/maia3-js/models/maia3_5m.onnx', import.meta.url).pathname, intraOpNumThreads: 2 });
await maia.load();
const sf = await Stockfish.start({ engine: 'full', threads: Number(process.env.THREADS ?? 6), hash: 512 });
const cap = (s) => Math.max(-1000, Math.min(1000, Math.abs(s) > MATE - 1000 ? Math.sign(s) * 1000 : s));
const expectedOf = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
for (const row of fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.includes('|'))) {
  const [label, moves, cands] = row.split('|').map((s) => s.trim());
  const c = new Chess();
  const fens = [c.fen()];
  for (const san of moves.split(/\s+/).filter(Boolean)) { c.move(san); fens.push(c.fen()); }
  console.log(`\n## ${label}`);
  for (const cand of cands.split(',').map((s) => s.trim())) {
    const after = new Chess(fens[fens.length - 1]);
    after.move(cand);
    const hist = [...fens, after.fen()];
    const [r] = await maia.predictBatch([{ fen: after.fen(), priorFens: hist.slice(Math.max(0, hist.length - 8), -1), selfElo: elo, oppoElo: elo }], { onError: 'collect' });
    const replies = [...r.moves.entries()].sort((a, b) => b[1] - a[1]);
    let mass = 0, total = 0, score = 0;
    const parts = [];
    for (const [u, p] of replies) {
      if (mass >= COVER) break;
      const pos = new Chess(after.fen());
      const m = pos.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      const s = pos.isCheckmate() ? -MATE : (await sf.analyse(pos.fen(), { depth })).score; // side to move = the candidate's side
      total += p * cap(s);
      score += p * expectedOf(cap(s));
      mass += p;
      parts.push(`${m.san} ${(p * 100).toFixed(0)}%: ${(cap(s) / 100).toFixed(2)}`);
    }
    const best = (await sf.analyse(after.fen(), { depth })).score;
    console.log(
      `  ${cand.padEnd(6)} practical ${(total / mass / 100).toFixed(2)}, expected ${(score / mass).toFixed(0)}%  (Stockfish ${(-cap(best) / 100).toFixed(2)}, ${expectedOf(-cap(best)).toFixed(0)}%)  ${parts.join(', ')}`
    );
  }
}
sf.quit();
