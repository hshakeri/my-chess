// Tactics deck: the full list of right moves for the control positions (quiet and keep-the-lead),
// with every legal move scored (multipv over all of them), so no right move goes unaccepted when the
// first search stopped at its line limit. Same thresholds as the scans: quiet, within 0.8 pawns of the
// best; keep-the-lead, a win of 2.5 pawns or more within 1.5 pawns of the best.
//
//   node tactics-complete.mjs <deck.json> [depth=12]   (rewrites it in place)
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { Stockfish } from './stockfish.mjs';
const [deckFile, depthArg = '12'] = process.argv.slice(2);
const deck = JSON.parse(fs.readFileSync(deckFile, 'utf8'));
const sf = await Stockfish.start({ engine: 'full', threads: 6, hash: 256 });
const san = (fen, u) => new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san;
let changed = 0;
for (const t of deck) {
  if (t.motif !== 'quiet' && t.motif !== 'lead') continue;
  const n = new Chess(t.fen).moves().length;
  const r = await sf.analyse(t.fen, { depth: Number(depthArg), maxMs: 8000, multipv: Math.min(n, 60) });
  const best = r.lines[0].score;
  const keep = t.motif === 'quiet' ? (s) => s >= best - 80 : (s) => s >= Math.max(250, best - 150);
  const accepted = r.lines.filter((l) => keep(l.score)).map((l) => san(t.fen, l.pv[0]));
  // The game move is never accepted: it is what the position is about
  const next = [...new Set([t.solution, ...accepted])].filter((m) => m !== t.played);
  if (next.length !== t.accepted.length) changed++;
  console.error(`${t.id} ${t.motif}: ${t.accepted.length} -> ${next.length}`);
  t.accepted = next;
}
sf.quit();
// A control position needs two right moves at least; one that is left with a single one is a tactic, not a control
const kept = deck.filter((t) => (t.motif !== 'quiet' && t.motif !== 'lead') || t.accepted.length >= 2);
fs.writeFileSync(deckFile, JSON.stringify(kept, null, 1) + '\n');
console.error(`complete: ${changed} control positions changed, ${deck.length - kept.length} dropped`);
