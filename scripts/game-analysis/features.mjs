// One row per move (both sides): board features from chess.js plus Maia's value before and after.
import fs from 'node:fs';
import { Chess } from 'chess.js';
const [gamesFile, outFile, shardArg, nShardsArg, ...passFiles] = process.argv.slice(2);
const SHARD = Number(shardArg), NSHARDS = Number(nShardsArg);
const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const pass = new Map();
for (const f of passFiles) for (const l of fs.readFileSync(f, 'utf8').split('\n')) { if (!l) continue; const r = JSON.parse(l); pass.set(r[0] * 1000 + r[1], r); }
const other = (c) => (c === 'w' ? 'b' : 'w');
/** Pieces of `color` that the other side could win now: undefended, or attacked by something cheaper. */
function enPrise(chess, color) {
  let best = 0, squares = [];
  for (const row of chess.board()) for (const pc of row) {
    if (!pc || pc.color !== color || pc.type === 'k') continue;
    const att = chess.attackers(pc.square, other(color));
    if (!att.length) continue;
    const def = chess.attackers(pc.square, color);
    const minAtt = Math.min(...att.map((s) => V[chess.get(s).type]));
    let gain = 0;
    if (!def.length) gain = V[pc.type];
    else if (minAtt < V[pc.type]) gain = V[pc.type] - minAtt;
    if (gain > 0) { squares.push(pc.square); best = Math.max(best, gain); }
  }
  return { best, squares };
}
const material = (chess, color) => chess.board().flat().filter((pc) => pc && pc.color === color && pc.type !== 'k').reduce((s, pc) => s + V[pc.type], 0);
const cols = ['g', 'ply', 'mover', 'tc', 'base', 'inc', 'end', 'myElo', 'oppElo', 'score', 'moveNo', 'piece', 'cap', 'check', 'castle', 'promo',
  'inCheck', 'nLegal', 'threatBefore', 'freeBefore', 'mate1Avail', 'hangAfter', 'hangMoved', 'allowMate1', 'ignoredThreat', 'missedFree', 'missedMate',
  'oppLastCap', 'recapture', 'castledBefore', 'kingMovedNoCastle', 'pawnShield', 'earlyQueen', 'matTotal', 'matDiff',
  'clockBefore', 'spent', 'wpBefore', 'wpAfter', 'delta', 'pPlayed', 'rankPlayed', 'san'];
const out = fs.createWriteStream(outFile);
if (SHARD === 0) out.write(cols.join(',') + '\n');
let gi = -1;
for (const line of fs.readFileSync(gamesFile, 'utf8').split('\n')) {
  if (!line) continue; gi++;
  if (gi % NSHARDS !== SHARD) continue;
  const g = JSON.parse(line);
  let prevMove = null;
  const castled = { w: false, b: false }, kingMoved = { w: false, b: false }, side = { w: null, b: null };
  for (let p = 0; p < g.san.length; p++) {
    const b0 = new Chess(g.fens[p]);
    const before = new Chess(g.fens[p]);
    const c = before.turn(), o = other(c);
    const mover = (c === g.me) ? 'H' : 'O';
    const legal = before.moves();
    const mv = before.move(g.san[p]); // before now holds the position after the move
    const after = before;
    const threat = enPrise(b0, c).best;
    const free = enPrise(b0, o).best;
    const capVal = mv.captured ? V[mv.captured] : 0;
    const hang = enPrise(after, c);
    const oppMoves = after.isGameOver() ? [] : after.moves();
    const prev = p > 0 ? prevMove : null;
    const clkBefore = p >= 2 && g.clk[p - 2] != null ? g.clk[p - 2] : g.base;
    const spent = g.clk[p] != null && clkBefore != null ? +(clkBefore - g.clk[p] + (p >= 2 ? g.inc : 0)).toFixed(1) : '';
    const pb = pass.get(gi * 1000 + p), pa = pass.get(gi * 1000 + p + 1);
    const wpBefore = pb && pb[2] != null ? pb[2] : null;
    let wpAfter = null;
    if (pa && pa[2] != null) wpAfter = +(1 - pa[2]).toFixed(4);
    else if (after.isCheckmate()) wpAfter = 1;
    else if (after.isDraw()) wpAfter = 0.5;
    const isCastle = mv.flags.includes('k') || mv.flags.includes('q');
    const shield = castled[c] && mv.piece === 'p' && ((side[c] === 'k' && 'fgh'.includes(mv.from[0])) || (side[c] === 'q' && 'abc'.includes(mv.from[0])));
    const row = [gi, p, mover, g.tc, g.base, g.inc, g.end, g.myElo, g.oppElo, g.score, Math.floor(p / 2) + 1, mv.piece, mv.captured || '', /[+#]/.test(mv.san) ? 1 : 0, isCastle ? 1 : 0, mv.promotion ? 1 : 0,
      b0.inCheck() ? 1 : 0, legal.length, threat, free, legal.some((s) => s.endsWith('#')) ? 1 : 0,
      hang.best, hang.squares.includes(mv.to) ? 1 : 0, oppMoves.some((s) => s.endsWith('#')) ? 1 : 0,
      threat >= 2 && hang.best >= threat && capVal < threat ? 1 : 0, free >= 2 && capVal < free ? 1 : 0, legal.some((s) => s.endsWith('#')) && !mv.san.endsWith('#') ? 1 : 0,
      prev && prev.captured ? 1 : 0, prev && prev.captured && mv.captured && mv.to === prev.to ? 1 : 0,
      castled[c] ? 1 : 0, kingMoved[c] && !castled[c] ? 1 : 0, shield ? 1 : 0, Math.floor(p / 2) + 1 <= 8 && mv.piece === 'q' ? 1 : 0,
      material(b0, 'w') + material(b0, 'b'), material(b0, c) - material(b0, o),
      clkBefore ?? '', spent, wpBefore ?? '', wpAfter ?? '', wpBefore != null && wpAfter != null ? +(wpAfter - wpBefore).toFixed(4) : '',
      pb && pb[3] != null ? pb[3] : '', pb && pb[4] != null ? pb[4] : '', mv.san];
    out.write(row.join(',') + '\n');
    prevMove = mv;
    if (isCastle) { castled[c] = true; side[c] = mv.flags.includes('k') ? 'k' : 'q'; }
    if (mv.piece === 'k' && !isCastle) kingMoved[c] = true;
  }
}
out.end();
console.log('games', gi + 1);
