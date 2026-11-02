// Stockfish's best lines for positions: node sf-lines.mjs <depth> <multipv> <file with "label | fen" lines>
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { Stockfish, MATE } from './stockfish.mjs';
const [depthArg = '24', mpvArg = '3', file] = process.argv.slice(2);
const sf = await Stockfish.start({ engine: 'full', threads: Number(process.env.THREADS ?? 6), hash: 1024 });
const show = (s) => (Math.abs(s) > MATE - 1000 ? `${s > 0 ? '' : '-'}M${MATE - Math.abs(s)}` : (s / 100).toFixed(2));
const sanLine = (fen, pv, n = 12) => {
  const c = new Chess(fen);
  const out = [];
  for (const u of pv.slice(0, n)) {
    try {
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      const no = Number(c.fen().split(' ')[5]);
      out.push(m.color === 'w' ? `${no}.${m.san}` : out.length === 0 ? `${no - 1}...${m.san}` : m.san);
    } catch { break; }
  }
  return out.join(' ');
};
for (const row of fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.includes('|'))) {
  const [label, fen] = row.split('|').map((s) => s.trim());
  const r = await sf.analyse(fen, { depth: Number(depthArg), multipv: Number(mpvArg) });
  console.log(`\n## ${label}\n${fen}`);
  for (const l of r.lines) console.log(`  ${show(l.score).padStart(7)} d${l.depth}  ${sanLine(fen, l.pv)}`);
}
sf.quit();
