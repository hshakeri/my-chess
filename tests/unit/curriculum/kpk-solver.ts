/**
 * Exact king and pawn against king (White has the pawn), by retrograde analysis: the TypeScript twin of
 * scripts/game-analysis/kpk-solve.mjs, for the tests of the king and pawn lesson. A White-to-move
 * position with the pawn on the seventh, the queening square empty and the black king not next to it
 * (or the white king next to it) is won at once; Black to move, taking an undefended pawn or
 * stalemate is a draw; everything not proved won is a draw. `dtw` counts the plies to such a
 * promotion with best play.
 */
const file = (s: number) => s & 7;
const rank = (s: number) => s >> 3;
const dist = (a: number, b: number) => Math.max(Math.abs(file(a) - file(b)), Math.abs(rank(a) - rank(b)));
const idx = (stm: number, wk: number, bk: number, wp: number) => ((stm * 64 + wk) * 64 + bk) * 64 + wp;
const KING: number[][] = [];
for (let s = 0; s < 64; s++) {
  KING[s] = [];
  for (let df = -1; df <= 1; df++)
    for (let dr = -1; dr <= 1; dr++) {
      const f = file(s) + df;
      const r = rank(s) + dr;
      if ((df || dr) && f >= 0 && f < 8 && r >= 0 && r < 8) KING[s].push(r * 8 + f);
    }
}
const pawnAttacks = (wp: number, s: number) => rank(s) === rank(wp) + 1 && Math.abs(file(s) - file(wp)) === 1;

export const sq = (name: string) => (Number(name[1]) - 1) * 8 + (name.charCodeAt(0) - 97);

function whiteMoves(wk: number, bk: number, wp: number): Array<[string, number, number]> {
  const out: Array<[string, number, number]> = [];
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

function blackMoves(wk: number, bk: number, wp: number): number[] {
  return KING[bk].filter((t) => dist(t, wk) > 1 && !pawnAttacks(wp, t));
}

const WIN = 1;
const DRAW = 2;
let solved: { res: Uint8Array; dtw: Uint16Array } | null = null;

function solve() {
  if (solved) return solved;
  const N = 2 * 64 * 64 * 64;
  const res = new Uint8Array(N);
  const dtw = new Uint16Array(N);
  const legal = (stm: number, wk: number, bk: number, wp: number) =>
    rank(wp) >= 1 && rank(wp) <= 6 && wk !== bk && wk !== wp && bk !== wp && dist(wk, bk) >= 2 && !(stm === 0 && pawnAttacks(wp, bk));
  for (let stm = 0; stm < 2; stm++)
    for (let wk = 0; wk < 64; wk++)
      for (let bk = 0; bk < 64; bk++)
        for (let wp = 0; wp < 64; wp++) {
          const i = idx(stm, wk, bk, wp);
          if (!legal(stm, wk, bk, wp)) {
            res[i] = 3;
            continue;
          }
          if (stm === 0) {
            const q = wp + 8;
            if (rank(wp) === 6 && q !== wk && q !== bk && (dist(bk, q) > 1 || dist(wk, q) === 1)) res[i] = WIN;
          } else {
            const ms = blackMoves(wk, bk, wp);
            if ((!ms.length && !pawnAttacks(wp, bk)) || ms.includes(wp)) res[i] = DRAW;
          }
        }
  for (let ply = 1; ; ply++) {
    const found: number[] = [];
    for (let stm = 0; stm < 2; stm++)
      for (let wk = 0; wk < 64; wk++)
        for (let bk = 0; bk < 64; bk++)
          for (let wp = 8; wp < 56; wp++) {
            const i = idx(stm, wk, bk, wp);
            if (res[i] !== 0) continue;
            if (stm === 0) {
              if (whiteMoves(wk, bk, wp).some(([kind, nk, np]) => kind !== 'promo' && res[idx(1, nk, bk, np)] === WIN && dtw[idx(1, nk, bk, np)] === ply - 1)) found.push(i);
            } else {
              const ms = blackMoves(wk, bk, wp);
              if (ms.length && ms.every((t) => res[idx(0, wk, t, wp)] === WIN && dtw[idx(0, wk, t, wp)] <= ply - 1)) found.push(i);
            }
          }
    if (!found.length) break;
    for (const i of found) {
      res[i] = WIN;
      dtw[i] = ply;
    }
  }
  for (let i = 0; i < N; i++) if (res[i] === 0) res[i] = DRAW;
  solved = { res, dtw };
  return solved;
}

/** The pieces of a K+P v K position from its FEN (White has the pawn). */
function parse(fen: string) {
  const [board, turn] = fen.split(' ');
  const at: Record<string, number> = {};
  board.split('/').forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else at[ch] = (7 - r) * 8 + f++;
    }
  });
  return { wk: at.K, bk: at.k, wp: at.P, stm: turn === 'w' ? 0 : 1 };
}

/** Whether White wins the position, and in how many plies to a safe promotion. */
export function kpk(fen: string): { win: boolean; dtw: number } {
  const { res, dtw } = solve();
  const { wk, bk, wp, stm } = parse(fen);
  const i = idx(stm, wk, bk, wp);
  return { win: res[i] === WIN, dtw: dtw[i] };
}
