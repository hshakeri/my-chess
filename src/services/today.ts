import type { CctEvent } from './cctLog';
import type { TacticSession } from './tacticsDeck';

/**
 * Today's routine on the Lessons tab: the two-minute warm-up, the cards that are due, ten tactics and
 * the plans that are due, in that order (board vision first, then retrieval, then pattern speed, then
 * the plans), each marked done once today's share is done. Read from this browser's logs.
 */

export type TodayKey = 'warmup' | 'cards' | 'tactics' | 'plans';

export interface TodayStep {
  key: TodayKey;
  label: string;
  done: boolean;
  /** A count still to do (cards and plans due), when there is one. */
  left?: number;
}

/** Warm-up answers that make a day's warm-up (it asks about one question every ten seconds). */
export const WARMUP_ANSWERS = 5;

export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** `dueCards` is the size of today's session (the queue of due reviews and new cards), not every card due. */
export function todayRoutine(input: { now: number; cct: CctEvent[]; tacticSessions: TacticSession[]; dueCards: number; plansDue: number }): TodayStep[] {
  const since = startOfDay(input.now);
  const warmups = input.cct.filter((e) => e.source === 'warmup' && e.at >= since).length;
  return [
    { key: 'warmup', label: 'Warm-up', done: warmups >= WARMUP_ANSWERS },
    { key: 'cards', label: "Today's cards", done: input.dueCards === 0, left: input.dueCards },
    { key: 'tactics', label: 'Ten tactics', done: input.tacticSessions.some((s) => s.at >= since) },
    { key: 'plans', label: 'Plans', done: input.plansDue === 0, left: input.plansDue },
  ];
}
