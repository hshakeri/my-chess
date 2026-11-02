import { Chess } from 'chess.js';
import type { StoredGame } from '../types/db';

/**
 * A game's final position without replaying it when the PGN says it: Chess.com writes
 * [CurrentPosition "<FEN>"]. Otherwise the moves are replayed once, and the result is kept per game,
 * so a summary over thousands of games does not replay any game twice.
 */

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const cache = new Map<string, string | null>();

export function finalFen(game: StoredGame): string | null {
  const key = `${game.id}:${game.movesSan.length}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let fen = /\[CurrentPosition "([^"]+)"\]/.exec(game.pgn ?? '')?.[1] ?? null;
  if (!fen) {
    const chess = new Chess();
    try {
      for (const san of game.movesSan) chess.move(san);
      fen = chess.fen();
    } catch {
      fen = null;
    }
  }
  cache.set(key, fen);
  return fen;
}

/** The material lead of `color` in a FEN (pawn 1, knight and bishop 3, rook 5, queen 9), read from the placement field. */
export function leadInFen(fen: string, color: 'w' | 'b'): number {
  let lead = 0;
  for (const ch of fen.split(' ')[0]) {
    const type = ch.toLowerCase();
    const value = VALUE[type];
    if (value === undefined) continue;
    const white = ch !== type;
    lead += (white === (color === 'w') ? 1 : -1) * value;
  }
  return lead;
}

/**
 * Whether `color` cannot mate with what it has: a lone king, or a king and one knight or bishop. A
 * player who runs out of time against such a side does not lose but draws (Chess.com's "timeout vs
 * insufficient material").
 */
export function cannotMate(fen: string, color: 'w' | 'b'): boolean {
  let minors = 0;
  for (const ch of fen.split(' ')[0]) {
    if (!/[a-z]/i.test(ch)) continue;
    const white = ch !== ch.toLowerCase();
    if (white !== (color === 'w')) continue;
    const type = ch.toLowerCase();
    if (type === 'p' || type === 'r' || type === 'q') return false;
    if (type === 'n' || type === 'b') minors++;
  }
  return minors <= 1;
}
