import { Chess } from 'chess.js';
import type { StoredGame } from '../types/db';
import type { GameReview, MistakeType } from '../types/review';

/**
 * The habit scorecard (DC-8): opening habits read from every game's moves, and one board habit from
 * the reviewed games, each with how often it held, how often in the newest games, and the score in
 * the games with it against the games without it.
 *
 * - castled: hoot65 castled by their 10th move;
 * - developed: all four knights and bishops had left their starting squares by the 10th move;
 * - queen_home: the queen did not move before two knights or bishops were out;
 * - nothing_hung: the review of the game found no piece left where it could be taken.
 *
 * Games shorter than 20 plies are left out (too short for the opening habits to apply).
 */

export type HabitKey = 'castled' | 'developed' | 'queen_home' | 'nothing_hung';

export const HABIT_LABEL: Record<HabitKey, string> = {
  castled: 'Castled by move 10',
  developed: 'All knights and bishops out by move 10',
  queen_home: 'Queen kept home until two minor pieces were out',
  nothing_hung: 'No piece left where it could be taken (reviewed games)',
};

const HANGING: MistakeType[] = ['moved_piece_hangs', 'left_piece_hangs', 'failed_to_save'];
const MIN_PLIES = 20;
const OPENING_MOVES = 10;

export interface GameHabits {
  gameId: string;
  timestamp: number;
  /** 1 a win, 0.5 a draw, 0 a loss. */
  score: number;
  habits: Partial<Record<HabitKey, boolean>>;
}

export interface HabitRow {
  key: HabitKey;
  label: string;
  /** Games the habit could be judged in, and how many kept it. */
  games: number;
  kept: number;
  rate: number;
  /** The same over the newest games. */
  recentGames: number;
  recentRate: number;
  /** hoot65's score in the games with the habit and without it (null with no such game). */
  scoreWith: number | null;
  scoreWithout: number | null;
}

const HOME: Record<'w' | 'b', string[]> = { w: ['b1', 'g1', 'c1', 'f1'], b: ['b8', 'g8', 'c8', 'f8'] };

/** The habits of one game of hoot65's, or null when the game is too short or unreadable. */
export function habitsOfGame(game: StoredGame, review?: GameReview): GameHabits | null {
  if (!game.userColor || game.movesSan.length < MIN_PLIES) return null;
  const me: 'w' | 'b' = game.userColor === 'white' ? 'w' : 'b';
  const chess = new Chess();
  const leftHome = new Set<string>();
  let castled = false;
  let queenEarly = false;
  let ownMoves = 0;
  for (const san of game.movesSan) {
    let move;
    try {
      move = chess.move(san);
    } catch {
      return null;
    }
    if (move.color !== me) continue;
    ownMoves++;
    if (ownMoves > OPENING_MOVES) break;
    if (move.flags.includes('k') || move.flags.includes('q')) castled = true;
    if (HOME[me].includes(move.from) && (move.piece === 'n' || move.piece === 'b')) leftHome.add(move.from);
    if (move.piece === 'q' && leftHome.size < 2) queenEarly = true;
  }
  const habits: GameHabits['habits'] = { castled, developed: leftHome.size === 4, queen_home: !queenEarly };
  if (review) habits.nothing_hung = !review.criticalMoments.some((m) => HANGING.includes(m.type));
  const score = game.userResult === 'win' ? 1 : game.userResult === 'draw' ? 0.5 : 0;
  return { gameId: game.id, timestamp: game.timestamp, score, habits };
}

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function summarizeHabits(games: StoredGame[], reviews: GameReview[] = [], recent = 20): HabitRow[] {
  const reviewOf = new Map(reviews.map((r) => [r.gameId, r]));
  const all = games
    .filter((g) => g.userResult && g.userResult !== '*')
    .map((g) => habitsOfGame(g, reviewOf.get(g.id)))
    .filter((h): h is GameHabits => h !== null)
    .sort((a, b) => b.timestamp - a.timestamp);
  return (Object.keys(HABIT_LABEL) as HabitKey[]).map((key) => {
    const judged = all.filter((h) => h.habits[key] !== undefined);
    const kept = judged.filter((h) => h.habits[key]);
    const newest = judged.slice(0, recent);
    return {
      key,
      label: HABIT_LABEL[key],
      games: judged.length,
      kept: kept.length,
      rate: judged.length ? kept.length / judged.length : 0,
      recentGames: newest.length,
      recentRate: newest.length ? newest.filter((h) => h.habits[key]).length / newest.length : 0,
      scoreWith: mean(kept.map((h) => h.score)),
      scoreWithout: mean(judged.filter((h) => !h.habits[key]).map((h) => h.score)),
    };
  });
}
