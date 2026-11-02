// Tactics deck (DC-2): positions from the archive right after a blunder by either player, where the
// side to move now has one clearly winning move, by Stockfish.
//
//   node tactics.mjs scan <out.json> [max=3000] [depth=14]   candidates after a Maia-scored blunder, vetted by Stockfish
//
// A candidate is the position after a move that cost its player 0.3 or more of Maia's expected score
// (at the players' ratings), with the other player not already clearly winning before it. Stockfish
// (multipv 3) keeps it when the best move wins at least 2.5 pawns (or mates in 3 or fewer) and the
// second best is at least 2 pawns worse (or both mate). The accepted moves are those within 1 pawn of
// the best and still winning 2.5 pawns, or every mate when the best move mates.
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { Stockfish, MATE } from './stockfish.mjs';

const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const [mode, outFile = 'tactics-cands.json', maxArg = '3000', depthArg = '14'] = process.argv.slice(2);
if (mode !== 'scan') throw new Error('usage: node tactics.mjs scan <out.json> [max] [depth]');

const games = fs.readFileSync('games.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const maia = new Map();
for (const f of ['pass1-0.jsonl', 'pass1-1.jsonl']) {
  for (const line of fs.readFileSync(f, 'utf8').trim().split('\n')) {
    const r = JSON.parse(line);
    if (r[2] !== null) maia.set(r[0] * 1000 + r[1], r);
  }
}

// Candidates, newest game first
const order = games.map((g, i) => i).sort((a, b) => games[b].end - games[a].end);
const cands = [];
for (const gi of order) {
  const g = games[gi];
  if (g.tc === 'daily') continue;
  for (let p = 10; p + 1 < g.fens.length; p++) {
    const before = maia.get(gi * 1000 + p), after = maia.get(gi * 1000 + p + 1);
    if (!before || !after) continue;
    const moverBefore = before[2], solverAfter = after[2];
    const drop = moverBefore - (1 - solverAfter);
    if (drop >= 0.3 && solverAfter >= 0.6 && 1 - moverBefore <= 0.65) {
      const lastMove = new Chess(g.fens[p]).move({ from: g.uci[p].slice(0, 2), to: g.uci[p].slice(2, 4), promotion: g.uci[p][4] });
      cands.push({ gi, ply: p + 1, fen: g.fens[p + 1], last: lastMove.san, lastTo: lastMove.to, lastCapture: Boolean(lastMove.captured), top3: after[5], solverIsMe: (p + 1) % 2 === 0 === (g.me === 'w'), date: new Date(g.end * 1000).toISOString().slice(0, 10), url: g.url });
      p++; // the next position is the punishment's own: skip it
    }
  }
  if (cands.length >= Number(maxArg)) break;
}
console.error(`${cands.length} candidates`);

const value = (c, sq) => { const p = c.get(sq); return p ? V[p.type] : 0; };
function motif(fen, uci, mateIn) {
  if (mateIn !== null) return mateIn === 1 ? 'mate-in-one' : 'mate';
  const c = new Chess(fen);
  const me = c.turn(), them = me === 'w' ? 'b' : 'w';
  const from = uci.slice(0, 2), to = uci.slice(2, 4);
  const mover = c.get(from);
  const target = c.get(to);
  const defended = target ? c.attackers(to, them).length > 0 : false;
  const m = c.move({ from, to, promotion: uci[4] });
  if (m.promotion) return 'promotion';
  if (target && (!defended || V[target.type] > V[mover.type])) return 'free-piece';
  // A fork: the moved piece now attacks two or more pieces it can win (the king counts)
  const hits = [];
  for (const row of c.board()) for (const sq of row) {
    if (!sq || sq.color !== them) continue;
    if (!c.attackers(sq.square, me).includes(to)) continue;
    const loose = c.attackers(sq.square, them).length === 0;
    if (sq.type === 'k' || (V[sq.type] >= 3 && (loose || V[sq.type] > V[mover.type]))) hits.push(sq.type);
  }
  if (hits.length >= 2) return 'fork';
  if (c.inCheck()) return 'check';
  return 'other';
}

const sf = await Stockfish.start({ engine: 'full', threads: 6, hash: 256 });
const out = [];
let done = 0;
const t0 = Date.now();
for (const cand of cands) {
  done++;
  const c = new Chess(cand.fen);
  if (c.isGameOver()) continue;
  const r = await sf.analyse(cand.fen, { depth: Number(depthArg), multipv: Math.min(3, c.moves().length) });
  const lines = r.lines;
  if (!lines?.length) continue;
  const best = lines[0].score;
  const mateIn = best > MATE - 1000 ? MATE - best : null;
  const second = lines[1]?.score ?? -MATE;
  let ok, accepted;
  if (mateIn !== null) {
    ok = mateIn <= 3;
    accepted = lines.filter((l) => l.score > MATE - 1000);
  } else {
    ok = best >= 250 && second <= best - 200;
    accepted = lines.filter((l) => l.score >= best - 100 && l.score >= 250);
  }
  if (ok) {
    const uci = lines[0].pv[0];
    const pv = [];
    const replay = new Chess(cand.fen);
    for (const u of lines[0].pv.slice(0, 5)) {
      try { pv.push(replay.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch { break; }
    }
    const san = (u) => new Chess(cand.fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san;
    const maiaShare = cand.top3.find(([u]) => u === uci)?.[1] ?? null;
    out.push({
      id: `${cand.url.split('/').pop()}-${cand.ply}`,
      fen: cand.fen,
      solution: san(uci),
      accepted: accepted.map((l) => san(l.pv[0])),
      pv,
      score: mateIn !== null ? null : best,
      mateIn,
      second: second > MATE - 1000 ? `M${MATE - second}` : second,
      motif: motif(cand.fen, uci, mateIn),
      last: cand.last,
      recapture: cand.lastCapture && uci.slice(2, 4) === cand.lastTo,
      maiaShare,
      solverIsMe: cand.solverIsMe,
      date: cand.date,
      game: cand.url,
      ply: cand.ply,
    });
  }
  if (done % 100 === 0) {
    console.error(`${done}/${cands.length} scored, ${out.length} kept, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  }
}
sf.quit();
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
const byMotif = {};
for (const o of out) byMotif[o.motif] = (byMotif[o.motif] || 0) + 1;
console.error(`done: ${out.length} kept of ${cands.length}`, byMotif);
