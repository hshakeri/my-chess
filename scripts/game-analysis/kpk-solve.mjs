// Exact K+P v K by retrograde analysis (White has the pawn).
// A White-to-move position with the pawn on the 7th rank, the queening square empty, and the black
// king not next to it (or the white king next to it) is a win at once (the Stockfish bitbase rule).
// Black to move: taking an undefended pawn, or stalemate, is a draw. Everything not proved won is a draw.
// dtw = plies until such a promotion, with best play (White fastest, Black slowest).
export const UNKNOWN = 0, WIN = 1, DRAW = 2, ILLEGAL = 3;
const file = (s) => s & 7, rank = (s) => s >> 3;
const dist = (a, b) => Math.max(Math.abs(file(a) - file(b)), Math.abs(rank(a) - rank(b)));
const idx = (stm, wk, bk, wp) => ((stm * 64 + wk) * 64 + bk) * 64 + wp;
const KING = [];
for (let s = 0; s < 64; s++) {
  KING[s] = [];
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    if (!df && !dr) continue;
    const f = file(s) + df, r = rank(s) + dr;
    if (f >= 0 && f < 8 && r >= 0 && r < 8) KING[s].push(r * 8 + f);
  }
}
const pawnAttacks = (wp, s) => rank(s) === rank(wp) + 1 && Math.abs(file(s) - file(wp)) === 1;

function legal(stm, wk, bk, wp) {
  if (rank(wp) < 1 || rank(wp) > 6) return false;
  if (wk === bk || wk === wp || bk === wp || dist(wk, bk) < 2) return false;
  if (stm === 0 && pawnAttacks(wp, bk)) return false; // Black in check with White to move
  return true;
}

/** White's moves: [kind, wk, wp] with kind 'k' | 'p' | 'promo'. */
export function whiteMoves(wk, bk, wp) {
  const out = [];
  for (const t of KING[wk]) if (t !== wp && dist(t, bk) > 1) out.push(['k', t, wp]);
  const one = wp + 8;
  if (one !== wk && one !== bk) {
    if (rank(one) === 7) out.push(['promo', wk, one]);
    else {
      out.push(['p', wk, one]);
      const two = wp + 16;
      if (rank(wp) === 1 && two !== wk && two !== bk) out.push(['p', wk, two]);
    }
  }
  return out;
}

/** Black's moves: [kind, bk] with kind 'k' | 'x' (takes the pawn). */
export function blackMoves(wk, bk, wp) {
  const out = [];
  for (const t of KING[bk]) {
    if (dist(t, wk) < 2 || pawnAttacks(wp, t)) continue;
    out.push([t === wp ? 'x' : 'k', t]);
  }
  return out;
}

export function solve() {
  const N = 2 * 64 * 64 * 64;
  const res = new Uint8Array(N), dtw = new Uint16Array(N);
  for (let stm = 0; stm < 2; stm++) for (let wk = 0; wk < 64; wk++) for (let bk = 0; bk < 64; bk++) for (let wp = 0; wp < 64; wp++) {
    const i = idx(stm, wk, bk, wp);
    if (!legal(stm, wk, bk, wp)) { res[i] = ILLEGAL; continue; }
    if (stm === 0) {
      const q = wp + 8;
      if (rank(wp) === 6 && q !== wk && q !== bk && (dist(bk, q) > 1 || dist(wk, q) === 1)) { res[i] = WIN; dtw[i] = 0; }
    } else {
      const ms = blackMoves(wk, bk, wp);
      if (!ms.length && !pawnAttacks(wp, bk)) res[i] = DRAW; // stalemate
      else if (ms.some(([k, t]) => k === 'x' && dist(t, wk) > 1)) res[i] = DRAW;
    }
  }
  for (let ply = 1; ; ply++) {
    const found = [];
    for (let stm = 0; stm < 2; stm++) for (let wk = 0; wk < 64; wk++) for (let bk = 0; bk < 64; bk++) for (let wp = 8; wp < 56; wp++) {
      const i = idx(stm, wk, bk, wp);
      if (res[i] !== UNKNOWN) continue;
      if (stm === 0) {
        for (const [kind, nk, np] of whiteMoves(wk, bk, wp)) {
          if (kind === 'promo') continue; // not a win here, or it would be known already
          const j = idx(1, nk, bk, np);
          if (res[j] === WIN && dtw[j] === ply - 1) { found.push(i); break; }
        }
      } else {
        const ms = blackMoves(wk, bk, wp);
        let all = ms.length > 0, deepest = -1;
        for (const [, t] of ms) {
          const j = idx(0, wk, t, wp);
          if (res[j] !== WIN || dtw[j] > ply - 1) { all = false; break; }
          deepest = Math.max(deepest, dtw[j]);
        }
        if (all && deepest === ply - 1) found.push(i);
      }
    }
    if (!found.length) break;
    for (const i of found) { res[i] = WIN; dtw[i] = ply; }
  }
  for (let i = 0; i < N; i++) if (res[i] === UNKNOWN) res[i] = DRAW;
  return { res, dtw, idx };
}

export const sq = (name) => (Number(name[1]) - 1) * 8 + (name.charCodeAt(0) - 97);
export const name = (s) => String.fromCharCode(97 + file(s)) + (rank(s) + 1);
