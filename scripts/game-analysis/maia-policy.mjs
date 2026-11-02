// Maia's move shares for players of a rating: node maia-policy.mjs <elo> <file with "label | SAN moves from the start" lines>
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { Maia3 } from 'maia3-js';
const [eloArg = '1150', file] = process.argv.slice(2);
const elo = Number(eloArg) + 400; // Chess.com to Maia's Lichess scale, as in the archive analysis
const maia = new Maia3({ variant: '5m', modelPath: new URL('./node_modules/maia3-js/models/maia3_5m.onnx', import.meta.url).pathname, intraOpNumThreads: 2 });
await maia.load();
for (const row of fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.includes('|'))) {
  const [label, moves] = row.split('|').map((s) => s.trim());
  const c = new Chess();
  const fens = [c.fen()];
  for (const san of moves.split(/\s+/).filter(Boolean)) { c.move(san); fens.push(c.fen()); }
  const fen = fens[fens.length - 1];
  const [r] = await maia.predictBatch([{ fen, priorFens: fens.slice(Math.max(0, fens.length - 8), -1), selfElo: elo, oppoElo: elo }], { onError: 'collect' });
  const top = [...r.moves.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([u, p]) => {
    const san = new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san;
    return `${san} ${(p * 100).toFixed(0)}%`;
  });
  console.log(`${label}: win ${(r.winProbability * 100).toFixed(0)}% | ${top.join(', ')}`);
}
