import { describe, it, expect } from 'vitest';
import { startOfDay, todayRoutine, WARMUP_ANSWERS } from '../../../src/services/today';
import type { CctEvent } from '../../../src/services/cctLog';

const NOW = new Date(2026, 10, 2, 15, 0).getTime();
const answer = (at: number, source: CctEvent['source'] = 'warmup'): CctEvent => ({ at, kind: 'knight', correct: true, ms: 2000, source, fen: '' });

describe("Today's routine", () => {
  it('marks each step done from today\'s logs and counts: warm-up answers, due cards, a tactics session, the plans', () => {
    const today = startOfDay(NOW);
    const fresh = todayRoutine({ now: NOW, cct: [], tacticSessions: [], dueCards: 12, plansDue: 3 });
    expect(fresh.map((s) => [s.key, s.done, s.left])).toEqual([
      ['warmup', false, undefined],
      ['cards', false, 12],
      ['tactics', false, undefined],
      ['plans', false, 3],
    ]);
    // Yesterday's warm-up and session do not count; lesson answers are not the warm-up
    const yesterday = today - 3600_000;
    const cct = [...Array.from({ length: WARMUP_ANSWERS }, () => answer(yesterday)), ...Array.from({ length: 9 }, () => answer(today + 1000, 'lesson'))];
    expect(todayRoutine({ now: NOW, cct, tacticSessions: [{ at: yesterday, good: 10, hard: 0, again: 0, ms: 1 }], dueCards: 0, plansDue: 0 }).map((s) => s.done)).toEqual([
      false,
      true,
      false,
      true,
    ]);
    const done = todayRoutine({
      now: NOW,
      cct: Array.from({ length: WARMUP_ANSWERS }, (_, k) => answer(today + k)),
      tacticSessions: [{ at: today + 5, good: 5, hard: 5, again: 0, ms: 1 }],
      dueCards: 0,
      plansDue: 0,
    });
    expect(done.every((s) => s.done)).toBe(true);
  });
});
