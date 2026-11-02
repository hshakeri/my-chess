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
 * - nothing_hung: the review of the game found no piece left where it could be taken;
 * - kept_lead: once hoot65 was three points of material ahead after move 8 (two plies running), still
 *   three ahead ten moves later (on that ply or the next, so a recapture still to come is no loss), or
 *   at the end of a shorter game. Judged only in games with such a
 *   lead. In the archive this, not trading pieces, is what the score follows: with the lead kept,
 *   hoot65 scored about 82% whether pieces were traded or not, and 35% in the 27% of games where the
 *   lead was gone ten moves later.
 *
 * Games shorter than 20 plies are left out (too short for the opening habits to apply).
 */

export type HabitKey = 'castled' | 'developed' | 'queen_home' | 'nothing_hung' | 'kept_lead';

export const HABIT_LABEL: Record<HabitKey, string> = {
  castled: 'Castled by move 10',
  developed: 'All knights and bishops out by move 10',
  queen_home: 'Queen kept home until two minor pieces were out',
  nothing_hung: 'No piece left where it could be taken (reviewed games)',
  kept_lead: 'Kept a lead of 3 points for the next 10 moves',
};

const HANGING: MistakeType[] = ['moved_piece_hangs', 'left_piece_hangs', 'failed_to_save'];
const MIN_PLIES = 20;
const OPENING_MOVES = 10;
const LEAD = 3;
const LEAD_FROM_PLY = 16;
const HOLD_PLIES = 20;
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

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

// The habits read from the moves, kept per game: a replay is the slow part (tens of seconds for a full archive)
const moveHabitsCache = new Map<string, GameHabits | null>();

/** The habits of one game of hoot65's, or null when the game is too short or unreadable. */
export function habitsOfGame(game: StoredGame, review?: GameReview): GameHabits | null {
  const key = `${game.id}:${game.movesSan.length}:${game.userColor}:${game.userResult}`;
  let base = moveHabitsCache.get(key);
  if (base === undefined) {
    base = moveHabitsOf(game);
    moveHabitsCache.set(key, base);
  }
  if (!base) return null;
  if (!review) return base;
  return { ...base, habits: { ...base.habits, nothing_hung: !review.criticalMoments.some((m) => HANGING.includes(m.type)) } };
}

/** Whether a game's habits are already read (so a summary of it is quick). */
export const habitsReady = (game: StoredGame): boolean => moveHabitsCache.has(`${game.id}:${game.movesSan.length}:${game.userColor}:${game.userResult}`);

function moveHabitsOf(game: StoredGame): GameHabits | null {
  if (!game.userColor || game.movesSan.length < MIN_PLIES) return null;
  const me: 'w' | 'b' = game.userColor === 'white' ? 'w' : 'b';
  const chess = new Chess();
  const leftHome = new Set<string>();
  let castled = false;
  let queenEarly = false;
  let ownMoves = 0;
  // hoot65's material lead after each ply (index 0 is the start), followed from captures and promotions
  const leads = [0];
  let lead = 0;
  let ahead = -1;
  for (const san of game.movesSan) {
    let move;
    try {
      move = chess.move(san);
    } catch {
      return null;
    }
    const sign = move.color === me ? 1 : -1;
    if (move.captured) lead += sign * VALUE[move.captured];
    if (move.promotion) lead += sign * (VALUE[move.promotion] - VALUE.p);
    leads.push(lead);
    const ply = leads.length - 1;
    if (ahead < 0 && ply >= LEAD_FROM_PLY && lead >= LEAD && leads[ply - 1] >= LEAD) ahead = ply;
    if (move.color === me) {
      ownMoves++;
      if (ownMoves <= OPENING_MOVES) {
        if (move.flags.includes('k') || move.flags.includes('q')) castled = true;
        if (HOME[me].includes(move.from) && (move.piece === 'n' || move.piece === 'b')) leftHome.add(move.from);
        if (move.piece === 'q' && leftHome.size < 2) queenEarly = true;
      }
    }
    // Both questions answered: the opening's ten moves, and the lead's ten moves after it appeared
    if (ownMoves > OPENING_MOVES && ahead >= 0 && ply > ahead + HOLD_PLIES) break;
  }
  const habits: GameHabits['habits'] = { castled, developed: leftHome.size === 4, queen_home: !queenEarly };
  // Kept unless the lead is gone on both plies at the end of the window, so a recapture still to come is not a loss
  if (ahead >= 0) {
    const end = Math.min(ahead + HOLD_PLIES, leads.length - 1);
    habits.kept_lead = Math.max(leads[end], leads[end + 1] ?? -Infinity) >= LEAD;
  }
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
