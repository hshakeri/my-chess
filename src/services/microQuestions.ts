import { Chess, type Square } from 'chess.js';
import { enPrise } from '../analytics/errorTaxonomy';

/**
 * One-click board questions (CL-5): the checks a player makes before moving, asked with answers
 * worked out by chess.js. A lesson asks one before a decision ("plan first"); the warm-up asks them
 * on positions from the student's own games.
 */

export type QuestionKind = 'attacks' | 'undefended' | 'checks' | 'knight' | 'loose' | 'safe';

/** Click the squares that answer it (none at all is a possible answer). */
export interface SquareQuestion {
  kind: 'attacks' | 'undefended' | 'knight' | 'loose';
  prompt: string;
  /** What "no squares" means, for the button that answers with none. */
  noneLabel?: string;
  answer: string[];
  /** Squares the question is about (the piece that moved, the knight), to mark on the board. */
  focus: string[];
}

export interface CountQuestion {
  kind: 'checks';
  prompt: string;
  answer: number;
  /** The checking moves, to show after the answer. */
  checks: string[];
}

export interface YesNoQuestion {
  kind: 'safe';
  prompt: string;
  answer: boolean;
  move: string;
  /** Why, in one line, shown after the answer. */
  reason: string;
}

export type MicroQuestion = SquareQuestion | CountQuestion | YesNoQuestion;

const PIECE_NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const other = (c: 'w' | 'b'): 'w' | 'b' => (c === 'w' ? 'b' : 'w');

function squaresOf(chess: Chess, color: 'w' | 'b', types: string[]): Square[] {
  const out: Square[] = [];
  for (const row of chess.board()) for (const pc of row) if (pc && pc.color === color && types.includes(pc.type)) out.push(pc.square);
  return out.sort();
}

/** "the knight on f6" */
export function pieceOn(fen: string, square: string): string {
  const pc = new Chess(fen).get(square as Square);
  return pc ? `the ${PIECE_NAME[pc.type]} on ${square}` : square;
}

/**
 * The pieces of the side to move (not pawns) that the opponent's last move attacks: every piece with
 * an attacker after the move that it did not have before, whether the moved piece itself or a piece
 * whose line the move opened. Includes the king when the move gives check.
 */
export function attackedByMove(fenBefore: string, san: string): { squares: string[]; moved: string; fenAfter: string } {
  const before = new Chess(fenBefore);
  const after = new Chess(fenBefore);
  const move = after.move(san);
  const mover = move.color;
  const target = other(mover);
  const squares = squaresOf(after, target, ['n', 'b', 'r', 'q', 'k']).filter((sq) => {
    const was = new Set(before.attackers(sq, mover));
    return after.attackers(sq, mover).some((a) => !was.has(a));
  });
  return { squares, moved: move.to, fenAfter: after.fen() };
}

/** The pieces of `color` (not pawns or the king) that nothing of theirs defends. */
export function undefendedPieces(fen: string, color: 'w' | 'b'): string[] {
  const chess = new Chess(fen);
  return squaresOf(chess, color, ['n', 'b', 'r', 'q']).filter((sq) => chess.attackers(sq, color).length === 0);
}

/**
 * The checks the side not to move would have if it were its turn (an opponent's threats to look for
 * before moving). Empty when the side to move is in check, where the question does not arise.
 */
export function opponentChecks(fen: string): string[] {
  const chess = new Chess(fen);
  if (chess.inCheck()) return [];
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  let flipped: Chess;
  try {
    flipped = new Chess(parts.join(' '));
  } catch {
    return [];
  }
  return flipped.moves().filter((m) => m.includes('+') || m.includes('#'));
}

/** Every square a knight on `square` attacks. */
export function knightSquares(square: string): string[] {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  const jumps = [
    [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
  ];
  return jumps
    .map(([df, dr]) => [f + df, r + dr])
    .filter(([x, y]) => x >= 0 && x < 8 && y >= 0 && y < 8)
    .map(([x, y]) => `${String.fromCharCode(97 + x)}${y + 1}`)
    .sort();
}

/**
 * Whether `san` from `fen` leaves nothing to take: after it no piece of the mover's (a minor piece or
 * more) can be won, by an undefended capture or a cheaper attacker, that could not be won before,
 * and the opponent has no mate in one.
 */
export function isMoveSafe(fen: string, san: string): { safe: boolean; reason: string } {
  const before = new Chess(fen);
  const after = new Chess(fen);
  const move = after.move(san);
  const mover = move.color;
  const mates = after.moves().filter((m) => m.endsWith('#'));
  if (mates.length) return { safe: false, reason: `After ${move.san} the opponent mates with ${mates[0]}.` };
  const looseBefore = new Set(enPrise(before, mover).map((p) => p.square));
  const newlyLoose = enPrise(after, mover).filter((p) => !looseBefore.has(p.square) || p.square === move.to);
  if (newlyLoose.length) {
    const p = newlyLoose[0];
    return { safe: false, reason: `After ${move.san}, ${pieceOn(after.fen(), p.square)} can be taken.` };
  }
  return { safe: true, reason: `After ${move.san} nothing of yours can be won and there is no mate in one.` };
}

/** The same squares, in any order. */
export function sameSquares(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

/**
 * The question asked before a lesson decision. After an opponent move: what that move attacks. With
 * no opponent move before the decision: the undefended pieces, or when there are none, the checks the
 * opponent would have.
 */
export function questionBeforeDecision(fen: string, lastMove: { fenBefore: string; san: string } | null): MicroQuestion {
  const toMove = new Chess(fen).turn();
  if (lastMove) {
    const { squares, moved } = attackedByMove(lastMove.fenBefore, lastMove.san);
    const label = `${lastMove.san}`;
    return {
      kind: 'attacks',
      prompt: `Before you move: which of your pieces does ${label} attack? Click them (pawns don't count), then Done.`,
      noneLabel: 'Nothing',
      answer: squares,
      focus: [moved],
    };
  }
  const undefended = undefendedPieces(fen, toMove);
  if (undefended.length) {
    return {
      kind: 'undefended',
      prompt: 'Before you move: which of your pieces have no defender? Click them (pawns and the king don\'t count), then Done.',
      noneLabel: 'None',
      answer: undefended,
      focus: [],
    };
  }
  const checks = opponentChecks(fen);
  return {
    kind: 'checks',
    prompt: 'Before you move: if it were your opponent\'s turn, how many checks would they have?',
    answer: checks.length,
    checks,
  };
}
