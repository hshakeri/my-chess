// Tactics deck, keep-the-lead positions (DC-2, DC-8): hoot65 was three points of material ahead and
// gave material back with the move played. The archive's scorecard finding is that keeping the lead,
// not trading, is what the score follows (82% against 35%).
//
//   node tactics-lead.mjs <lead-cands.csv> <out.json> [max=24] [depth=12]
//
// A candidate (from the feature table) is a move of hoot65's, three points up and not in check, that
// cost 0.15 or more of Maia's expected score. Stockfish (multipv 8) keeps it when hoot65 is still
// winning by 2.5 pawns or more, the move played gave back 2 pawns or more, and at least two moves keep
// a win of 2.5 pawns within 1.5 pawns of the best (those are accepted).
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { Stockfish, MATE } from './stockfish.mjs';

const [candFile, outFile, maxArg = '24', depthArg = '12'] = process.argv.slice(2);
const games = fs.readFileSync('games.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const rows = fs.readFileSync(candFile, 'utf8').trim().split('\n').slice(1).map((l) => l.split(',').map(Number));
const cands = rows.sort((a, b) => b[2] - a[2]);
const sf = await Stockfish.start({ engine: 'full', threads: 6, hash: 256 });
const san = (fen, u) => new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san;
const out = [];
const seen = new Set();
let done = 0;
for (const [gi, ply] of cands) {
  if (out.length >= Number(maxArg)) break;
  const g = games[gi];
  if (!g || seen.has(gi) || g.tc === 'daily') continue;
  done++;
  const fen = g.fens[ply];
  const c = new Chess(fen);
  const n = c.moves().length;
  if (n < 6) continue;
  const r = await sf.analyse(fen, { depth: Number(depthArg), maxMs: 3000, multipv: Math.min(8, n) });
  const lines = r.lines;
  if (!lines?.length) continue;
  const best = lines[0].score;
  const second = lines[1]?.score ?? -MATE;
  const accepted = lines.filter((l) => l.score >= Math.max(250, best - 150));
  const playedUci = g.uci[ply];
  const pr = await sf.analyse(fen, { depth: Number(depthArg), maxMs: 3000, searchmoves: [playedUci] });
  const playedScore = pr.score;
  if (best < 250 || accepted.length < 2 || playedScore > best - 200) continue;
  seen.add(gi);
  const line = [];
  const replay = new Chess(fen);
  for (const u of lines[0].pv.slice(0, 5)) {
    try { line.push(replay.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch { break; }
  }
  const last = new Chess(g.fens[ply - 1]).move({ from: g.uci[ply - 1].slice(0, 2), to: g.uci[ply - 1].slice(2, 4), promotion: g.uci[ply - 1][4] });
  out.push({
    id: `${g.url.split('/').pop()}-${ply}`,
    fen,
    lastMove: { from: last.from, to: last.to, san: last.san },
    solution: san(fen, lines[0].pv[0]),
    accepted: accepted.map((l) => san(fen, l.pv[0])),
    line,
    motif: 'lead',
    mateIn: null,
    date: new Date(g.end * 1000).toISOString().slice(0, 10),
    ownSide: true,
    played: g.san[ply],
    game: g.url,
    cost: best - playedScore,
  });
  console.error(`${out.length} kept of ${done}: ${out[out.length - 1].id} best ${best}, played ${g.san[ply]} ${playedScore}, ${accepted.length} accepted`);
}
sf.quit();
fs.writeFileSync(outFile, JSON.stringify(out, null, 1) + '\n');
console.error(`lead: ${out.length} kept of ${done} scored`);
