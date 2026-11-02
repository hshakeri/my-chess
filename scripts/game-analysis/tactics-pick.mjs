// Tactics deck, second step: pick the deck from the scan and check every pick again, deeper.
//
//   node tactics-pick.mjs <cands.json> <out deck.json> [depth=18]
//
// Leaves out plain recaptures, positions with two legal moves or fewer, and the ones Maia's players
// of the game's ratings find nine times in ten or more (too easy to train anything); one position
// per game; at most a set number per motif, newest first. Each pick is analysed again (multipv 3) and
// kept only if it still passes the scan's test; the accepted moves come from the deeper search.
// The deck follows the study path: pieces to take and mates in one first (its second and fourth
// groups), then forks and checks, then longer mates, promotions and combinations; easiest first within
// each tier, by Maia's share of the winning move. New positions come up in this order.
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { Stockfish, MATE } from './stockfish.mjs';

const [candFile, outFile, depthArg = '18'] = process.argv.slice(2);
const CAP = { 'mate-in-one': 40, mate: 35, 'free-piece': 80, fork: 45, check: 30, promotion: 10, other: 40 };
const cands = JSON.parse(fs.readFileSync(candFile, 'utf8'));
const games = new Map(fs.readFileSync('games.jsonl', 'utf8').trim().split('\n').map((l) => { const g = JSON.parse(l); return [g.url.split('/').pop(), g]; }));

const seenGame = new Set();
const perMotif = {};
const picked = [];
for (const c of [...cands].sort((a, b) => b.date.localeCompare(a.date))) {
  if (c.recapture) continue;
  if (c.maiaShare !== null && c.maiaShare >= 0.9) continue;
  if (new Chess(c.fen).moves().length <= 2) continue;
  const gid = c.id.split('-')[0];
  if (seenGame.has(gid)) continue;
  if ((perMotif[c.motif] ?? 0) >= CAP[c.motif]) continue;
  seenGame.add(gid);
  perMotif[c.motif] = (perMotif[c.motif] ?? 0) + 1;
  picked.push(c);
}
console.error(`${picked.length} picked`, perMotif);

const sf = await Stockfish.start({ engine: 'full', threads: 6, hash: 256 });
const deck = [];
const san = (fen, u) => new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san;
for (const [k, c] of picked.entries()) {
  const r = await sf.analyse(c.fen, { depth: Number(depthArg), multipv: Math.min(3, new Chess(c.fen).moves().length) });
  const lines = r.lines;
  const best = lines[0].score;
  const mateIn = best > MATE - 1000 ? MATE - best : null;
  const second = lines[1]?.score ?? -MATE;
  const ok = mateIn !== null ? mateIn <= 3 : best >= 250 && second <= best - 200;
  if (!ok || san(c.fen, lines[0].pv[0]) !== c.solution) {
    console.error(`dropped ${c.id}: ${mateIn !== null ? 'M' + mateIn : best} / ${second}, best ${san(c.fen, lines[0].pv[0])} (scan: ${c.solution})`);
    continue;
  }
  const accepted = (mateIn !== null ? lines.filter((l) => l.score > MATE - 1000) : lines.filter((l) => l.score >= best - 100 && l.score >= 250)).map((l) => san(c.fen, l.pv[0]));
  const line = [];
  const replay = new Chess(c.fen);
  for (const u of lines[0].pv.slice(0, 5)) {
    try { line.push(replay.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch { break; }
  }
  const g = games.get(c.id.split('-')[0]);
  const u = g.uci[c.ply - 1];
  deck.push({
    id: c.id,
    fen: c.fen,
    lastMove: { from: u.slice(0, 2), to: u.slice(2, 4), san: c.last },
    solution: c.solution,
    accepted: [...new Set(accepted)],
    line,
    motif: c.motif,
    mateIn,
    date: c.date,
    ownSide: c.solverIsMe,
    played: g.san[c.ply],
    game: c.game,
    maiaShare: c.maiaShare,
  });
  if ((k + 1) % 25 === 0) console.error(`${k + 1}/${picked.length} checked, ${deck.length} kept`);
}
sf.quit();
const TIER = { 'free-piece': 0, 'mate-in-one': 0, fork: 1, check: 1, mate: 2, promotion: 2, other: 2 };
deck.sort((a, b) => TIER[a.motif] - TIER[b.motif] || (b.maiaShare ?? 0) - (a.maiaShare ?? 0));
fs.writeFileSync(outFile, JSON.stringify(deck.map(({ maiaShare, ...t }) => t), null, 1) + '\n');
const byMotif = {};
for (const t of deck) byMotif[t.motif] = (byMotif[t.motif] ?? 0) + 1;
console.error(`deck: ${deck.length}`, byMotif, 'own side', deck.filter((t) => t.ownSide).length);
