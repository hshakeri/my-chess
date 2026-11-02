import { Chess } from 'chess.js';
import type { MistakeType } from '../types/review';

export type { MistakeType };

/**
 * Names what a move got wrong, with checks a player can make at the board (CL-3).
 *
 * A material search (two plies, then captures and check evasions until quiet) compares the move
 * played with the best move. The same search and loose-piece test pick hoot65's drill positions
 * (scripts/game-analysis/drills.mjs); here they label a mistake found in a game review. The search
 * counts material only, so a move that loses points without losing material is called positional
 * and gets no tactical label.
 */

export const PIECE_VALUE: Record<string, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };
const MATE = 100000;
/** Plies searched after a move before the capture search. */
const DEPTH = 2;
/** A loss of at least this many centipawns against the best move is a material mistake. */
export const MIN_LOSS = 200;
/** Margin for keeping the material: a move scoring this close to what the mover has (or to the best, if lower) keeps it. */
const KEEP_MARGIN = 50;
/** Plies of captures (and check evasions) searched after DEPTH. */
const QDEPTH = 6;

export const MISTAKE_LABEL: Record<MistakeType, string> = {
  allowed_mate: 'Allowed mate in one',
  missed_mate: 'Missed a mate in one',
  failed_to_save: 'Left an attacked piece where it was',
  moved_piece_hangs: 'Moved a piece to a square where it can be taken',
  left_piece_hangs: 'Left another piece where it can be taken',
  missed_capture: 'Missed a piece that could be won',
  tactical_other: 'Lost material to a combination',
  positional: 'No material lost: a positional or strategic mistake',
};

/** The board check that catches each kind of mistake. */
export const MISTAKE_CHECK: Record<MistakeType, string> = {
  allowed_mate: 'Before every move: after it, can my opponent give mate?',
  missed_mate: 'Look for checks first: is one of them mate?',
  failed_to_save: 'After every opponent move: what does it attack, and is that piece defended?',
  moved_piece_hangs: 'Before every move: on its new square, is the piece defended, and is anything cheaper attacking it?',
  left_piece_hangs: 'Before every move: does it take a defender away from another piece?',
  missed_capture: 'Before every move: is a piece of theirs undefended, or attacked by something cheaper?',
  tactical_other: 'Before every move: what are all the checks and captures my opponent has after it?',
  positional: 'Compare the plans of both sides; the material search sees no loss here.',
};

export interface Classification {
  type: MistakeType;
  /** Material the move gave up against the best move, in centipawns (0 for a mate or a positional mistake). */
  loss: number;
  /** Moves that avoid the mistake: they keep the material and allow no mate in one. Best first. */
  keeping: string[];
  /** The opponent's reply that wins the material or gives mate. */
  refutation?: string;
  /** The capture or mate that was missed. */
  missed?: string;
  /** Squares of the pieces the mistake left in danger. */
  squares: string[];
}

const other = (c: 'w' | 'b'): 'w' | 'b' => (c === 'w' ? 'b' : 'w');
const dest = (san: string): string | undefined => (san.match(/[a-h][1-8]/g) || []).pop();

export interface LoosePiece {
  square: string;
  type: string;
  gain: number;
}

/**
 * Pieces of `color` (a minor piece or more) the other side could win now: undefended, or attacked by
 * something cheaper. A king can only take a piece that nothing defends.
 */
export function enPrise(chess: Chess, color: 'w' | 'b'): LoosePiece[] {
  const out: LoosePiece[] = [];
  for (const row of chess.board()) {
    for (const pc of row) {
      if (!pc || pc.color !== color || pc.type === 'k' || pc.type === 'p') continue;
      const defenders = chess.attackers(pc.square, color);
      const attackers = chess.attackers(pc.square, other(color)).filter((s) => !(defenders.length && chess.get(s)?.type === 'k'));
      if (!attackers.length) continue;
      const cheapest = Math.min(...attackers.map((s) => PIECE_VALUE[chess.get(s)!.type]));
      const gain = !defenders.length ? PIECE_VALUE[pc.type] : cheapest < PIECE_VALUE[pc.type] ? PIECE_VALUE[pc.type] - cheapest : 0;
      if (gain >= MIN_LOSS) out.push({ square: pc.square, type: pc.type, gain });
    }
  }
  return out.sort((a, b) => b.gain - a.gain);
}

/** Material from the side to move's point of view. */
function material(chess: Chess): number {
  let s = 0;
  const me = chess.turn();
  for (const row of chess.board()) for (const pc of row) if (pc) s += (pc.color === me ? 1 : -1) * PIECE_VALUE[pc.type];
  return s;
}

function victim(chess: Chess, san: string): number {
  if (!san.includes('x')) return san.includes('=') ? 1 : 0;
  const square = dest(san);
  const pc = square ? chess.get(square as never) : undefined;
  return pc ? PIECE_VALUE[pc.type] : PIECE_VALUE.p;
}

const byVictim = (chess: Chess, moves: string[]) =>
  moves
    .map((m) => [m, victim(chess, m)] as const)
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m);

function quiesce(chess: Chess, alpha: number, beta: number, qdepth: number): number {
  const moves = chess.moves();
  const inCheck = chess.inCheck();
  if (moves.length === 0) return inCheck ? -MATE : 0;
  let best = -Infinity;
  if (!inCheck) {
    best = material(chess);
    if (best >= beta || qdepth <= 0) return best;
    if (best > alpha) alpha = best;
  } else if (qdepth <= 0) {
    return material(chess);
  }
  const candidates = inCheck ? byVictim(chess, moves) : byVictim(chess, moves.filter((m) => m.includes('x') || m.includes('=')));
  for (const m of candidates) {
    chess.move(m);
    const score = -quiesce(chess, -beta, -alpha, qdepth - 1);
    chess.undo();
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

function search(chess: Chess, depth: number, alpha: number, beta: number): number {
  const moves = chess.moves();
  if (moves.length === 0) return chess.inCheck() ? -MATE - depth : 0;
  if (depth === 0) return quiesce(chess, alpha, beta, QDEPTH);
  let best = -Infinity;
  for (const m of byVictim(chess, moves)) {
    chess.move(m);
    const score = -search(chess, depth - 1, -beta, -alpha);
    chess.undo();
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

/** Whether `san` scores at least `threshold` (a null-window test; scores are whole centipawns). */
function reaches(fen: string, san: string, threshold: number): boolean {
  const chess = new Chess(fen);
  chess.move(san);
  return -search(chess, DEPTH, -threshold, -threshold + 1) >= threshold;
}

/** Score of one move from the mover's point of view, exact at depth 2 plus the capture search. */
export function scoreOf(fen: string, san: string): number {
  const chess = new Chess(fen);
  chess.move(san);
  return -search(chess, DEPTH, -Infinity, Infinity);
}

/**
 * The best score in `fen`, its moves, and the exact score of every move that comes within `margin` of
 * the best or reaches `floor`. One pass: a null-window test against min(best so far − margin, floor)
 * drops the clearly worse moves, and only the moves that pass are scored exactly.
 */
export function bestMoves(fen: string, margin = 0, floor = Infinity): { score: number; moves: string[]; scored: Array<[string, number]> } {
  const chess = new Chess(fen);
  let best = -Infinity;
  const scored: Array<[string, number]> = [];
  for (const m of byVictim(chess, chess.moves())) {
    chess.move(m);
    let score: number;
    if (best === -Infinity) {
      score = -search(chess, DEPTH, -Infinity, Infinity);
    } else {
      const threshold = Math.min(best - margin, floor);
      score = -search(chess, DEPTH, -threshold, -threshold + 1);
      // At or above the threshold the null-window result is only a bound: search it again in full
      if (score >= threshold) score = -search(chess, DEPTH, -Infinity, Infinity);
    }
    chess.undo();
    if (score >= Math.min(best - margin, floor)) scored.push([m, score]);
    if (score > best) best = score;
  }
  scored.sort((a, b) => b[1] - a[1]);
  return { score: best, moves: scored.filter(([, s]) => s === best).map(([m]) => m), scored };
}

/** The reply with the best score in `fen`, a capture when one scores as well as the best (moves are tried captures first). */
function bestReply(fen: string): string | undefined {
  const chess = new Chess(fen);
  let alpha = -Infinity;
  let best: string | undefined;
  for (const m of byVictim(chess, chess.moves())) {
    chess.move(m);
    const score = -search(chess, DEPTH, -Infinity, -alpha);
    chess.undo();
    if (score > alpha) {
      alpha = score;
      best = m;
    }
  }
  return best;
}

/**
 * Whether `played` from `fenBefore` loses material the search can see: at least MIN_LOSS against what
 * the mover can keep, which is the material on the board, or the best move's score when every move
 * loses some. A trade is no loss, and neither is a capture left untaken. With the reply that wins it.
 */
export function losesMaterial(fenBefore: string, played: string): { loses: boolean; refutation?: string } {
  const before = new Chess(fenBefore);
  const after = new Chess(fenBefore);
  const san = after.move(played).san;
  const playedScore = scoreOf(fenBefore, san);
  // Keeping the material on the board within MIN_LOSS is never a loss, whatever the best move gains
  if (material(before) - playedScore < MIN_LOSS) return { loses: false };
  const beaten = before.moves().some((m) => m !== san && reaches(fenBefore, m, playedScore + MIN_LOSS));
  return beaten ? { loses: true, refutation: bestReply(after.fen()) } : { loses: false };
}

/** Every move in `fen` that gives mate at once. */
export function matesInOne(fen: string): string[] {
  const chess = new Chess(fen);
  return chess.moves().filter((m) => m.endsWith('#'));
}

/**
 * What the move `played` from `fenBefore` got wrong. Mates come first; then a material loss against
 * the best move of at least two pawns is named by where the material goes: a piece that was already
 * attacked, the moved piece, another piece the move left loose, or a capture that was not taken.
 */
export function classifyMove(fenBefore: string, played: string): Classification {
  const before = new Chess(fenBefore);
  const mover = before.turn();
  const after = new Chess(fenBefore);
  const playedMove = after.move(played);
  const legal = before.moves();
  const allowsMate = (san: string) => {
    const c = new Chess(fenBefore);
    c.move(san);
    return c.moves().some((m) => m.endsWith('#'));
  };

  // A mate in one on the board that was not played
  const mates = matesInOne(fenBefore);
  if (mates.length && !playedMove.san.endsWith('#')) {
    return { type: 'missed_mate', loss: 0, keeping: mates, missed: mates[0], squares: [] };
  }
  // The material the mover has now: a move that avoids a mistake keeps it (as the drill sets accept),
  // so a move is not rejected for missing a gain the two-ply search only imagines
  const base = material(before);

  // A move after which the opponent mates at once
  const opponentMates = after.moves().filter((m) => m.endsWith('#'));
  if (opponentMates.length) {
    const safe = legal.filter((m) => !allowsMate(m)).map((m) => [m, scoreOf(fenBefore, m)] as const);
    const top = Math.max(...safe.map(([, sc]) => sc));
    const keeping = safe
      .filter(([, sc]) => sc >= Math.min(top, base) - KEEP_MARGIN)
      .sort((a, b) => b[1] - a[1])
      .map(([m]) => m);
    return { type: 'allowed_mate', loss: 0, keeping, refutation: opponentMates[0], squares: [] };
  }

  // Material: unless some move beats the one played by MIN_LOSS, nothing was lost a search can see.
  // Most moves a review flags are of that kind, and null-window tests at that bar fail fast.
  const playedScore = scoreOf(fenBefore, played);
  const beaten = legal.some((m) => m !== playedMove.san && reaches(fenBefore, m, playedScore + MIN_LOSS));
  if (!beaten) return { type: 'positional', loss: 0, keeping: [], squares: [] };
  const best = bestMoves(fenBefore, KEEP_MARGIN, base - KEEP_MARGIN);
  const loss = Math.max(0, best.score - playedScore);
  /** The moves scoring at least `bar`, best first, that allow no mate in one. */
  const atLeast = (bar: number) => best.scored.filter(([m, sc]) => sc >= bar && !allowsMate(m)).map(([m]) => m);
  const keeping = atLeast(Math.min(best.score, base) - KEEP_MARGIN);

  // Where the material goes: the opponent's best reply, a capture when one is as good
  const refutation = bestReply(after.fen());
  const target = refutation && refutation.includes('x') ? dest(refutation) : undefined;
  const looseBefore = enPrise(before, mover).map((p) => p.square);
  const looseAfter = enPrise(after, mover).map((p) => p.square);
  const movedTo = playedMove.to;
  const stillLoose = looseBefore.filter((sq) => sq !== playedMove.from && looseAfter.includes(sq));
  const newlyLoose = looseAfter.filter((sq) => !looseBefore.includes(sq) && sq !== movedTo);
  const theirLoose = enPrise(before, other(mover));
  const bestCaptures = best.moves.every((m) => m.includes('x')) && best.score >= material(before) + MIN_LOSS;

  const make = (type: MistakeType, squares: string[], extra: Partial<Classification> = {}): Classification => ({
    type,
    loss,
    keeping,
    refutation,
    squares,
    ...extra,
  });
  if (target && stillLoose.includes(target)) return make('failed_to_save', [target]);
  if (target && target === movedTo && looseAfter.includes(movedTo)) return make('moved_piece_hangs', [movedTo]);
  if (target && newlyLoose.includes(target)) return make('left_piece_hangs', [target]);
  if (bestCaptures && theirLoose.length && !playedMove.captured) {
    // Here the point is the gain: the answers are the captures that win it
    return make('missed_capture', theirLoose.map((p) => p.square), { missed: best.moves[0], keeping: atLeast(best.score - KEEP_MARGIN) });
  }
  if (stillLoose.length) return make('failed_to_save', stillLoose);
  if (looseAfter.includes(movedTo)) return make('moved_piece_hangs', [movedTo]);
  if (newlyLoose.length) return make('left_piece_hangs', newlyLoose);
  return make('tactical_other', target ? [target] : []);
}
