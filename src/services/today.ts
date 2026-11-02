import type { CctEvent } from './cctLog';
import type { TacticSession } from './tacticsDeck';

/**
 * Today's routine on the Lessons tab: the two-minute warm-up, the cards that are due, ten tactics, the
 * plans that are due, and a game against Maia with the Play tab's two checks on, in that order (board
 * vision first, then retrieval, pattern speed and the plans, then the habits the archive ranks first
 * and second, practised where they count: in a game), each marked done once today's share is done.
 * Read from this browser's logs.
 */

export type TodayKey = 'warmup' | 'cards' | 'tactics' | 'plans' | 'game';

export interface TodayStep {
  key: TodayKey;
  label: string;
  done: boolean;
  /** A count still to do (cards and plans due), when there is one. */
  left?: number;
}

/** Warm-up answers that make a day's warm-up (it asks about one question every ten seconds). */
export const WARMUP_ANSWERS = 5;
/** Tactics positions that make a day's tactics, in one session or several. */
export const TACTICS_PER_DAY = 10;
/**
 * Board questions and safety checks answered in games that make a day's game with the checks: with
 * both switched on each move of the student's brings two, so about fifteen moves.
 */
export const GAME_CHECKS = 30;
/** When today's session of cards was last finished (new cards are always waiting, so "none due" never comes). */
export const SESSION_DONE_KEY = 'my_chess_session_done_v1';

export function readSessionDoneAt(): number {
  try {
    return Number(window.localStorage.getItem(SESSION_DONE_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function writeSessionDoneAt(at: number): void {
  try {
    window.localStorage.setItem(SESSION_DONE_KEY, String(at));
  } catch {
    // the step is not ticked then, that is all
  }
}

export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * `dueCards` is the size of today's session (the queue of due reviews and new cards), not every card
 * due; `sessionDoneAt` is when a session was last finished, which ticks the step for the day.
 */
export function todayRoutine(input: {
  now: number;
  cct: CctEvent[];
  tacticSessions: TacticSession[];
  dueCards: number;
  plansDue: number;
  sessionDoneAt?: number;
}): TodayStep[] {
  const since = startOfDay(input.now);
  const warmups = input.cct.filter((e) => e.source === 'warmup' && e.at >= since).length;
  const tactics = input.tacticSessions.filter((s) => s.at >= since).reduce((n, s) => n + s.good + s.hard + s.again, 0);
  const cardsDone = input.dueCards === 0 || (input.sessionDoneAt ?? 0) >= since;
  const inGames = input.cct.filter((e) => e.source === 'play' && e.at >= since).length;
  return [
    { key: 'warmup', label: 'Warm-up', done: warmups >= WARMUP_ANSWERS },
    { key: 'cards', label: "Today's cards", done: cardsDone, left: cardsDone ? undefined : input.dueCards },
    { key: 'tactics', label: 'Ten tactics', done: tactics >= TACTICS_PER_DAY },
    { key: 'plans', label: 'Plans', done: input.plansDue === 0, left: input.plansDue },
    { key: 'game', label: 'A game with the checks', done: inGames >= GAME_CHECKS, left: inGames > 0 && inGames < GAME_CHECKS ? GAME_CHECKS - inGames : undefined },
  ];
}
