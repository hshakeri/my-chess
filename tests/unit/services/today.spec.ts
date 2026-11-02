import { describe, it, expect } from 'vitest';
import { GAME_CHECKS, startOfDay, todayRoutine, WARMUP_ANSWERS } from '../../../src/services/today';
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
      ['game', false, undefined],
    ]);
    // Yesterday's warm-up and session do not count; lesson answers are not the warm-up
    const yesterday = today - 3600_000;
    const cct = [...Array.from({ length: WARMUP_ANSWERS }, () => answer(yesterday)), ...Array.from({ length: 9 }, () => answer(today + 1000, 'lesson'))];
    expect(todayRoutine({ now: NOW, cct, tacticSessions: [{ at: yesterday, good: 10, hard: 0, again: 0, ms: 1 }], dueCards: 0, plansDue: 0 }).map((s) => s.done)).toEqual([
      false,
      true,
      false,
      true,
      false,
    ]);
    const done = todayRoutine({
      now: NOW,
      cct: [...Array.from({ length: WARMUP_ANSWERS }, (_, k) => answer(today + k)), ...Array.from({ length: GAME_CHECKS }, (_, k) => answer(today + 100 + k, 'play'))],
      tacticSessions: [{ at: today + 5, good: 5, hard: 5, again: 0, ms: 1 }],
      dueCards: 0,
      plansDue: 0,
    });
    expect(done.every((s) => s.done)).toBe(true);
  });

  it('ticks the cards once today\'s session is finished, though new cards still wait; tactics after ten positions today', () => {
    const today = startOfDay(NOW);
    const steps = todayRoutine({
      now: NOW,
      cct: [],
      tacticSessions: [
        { at: today + 1, good: 3, hard: 1, again: 0, ms: 1 },
        { at: today + 2, good: 4, hard: 0, again: 1, ms: 1 },
      ],
      dueCards: 8,
      plansDue: 2,
      sessionDoneAt: today + 3,
    });
    expect(steps.map((s) => [s.key, s.done, s.left])).toEqual([
      ['warmup', false, undefined],
      ['cards', true, undefined],
      ['tactics', false, undefined],
      ['plans', false, 2],
      ['game', false, undefined],
    ]);
    // A session finished yesterday does not tick today; two more positions make ten
    const later = todayRoutine({ now: NOW, cct: [], tacticSessions: [{ at: today + 1, good: 10, hard: 0, again: 0, ms: 1 }], dueCards: 8, plansDue: 0, sessionDoneAt: today - 1 });
    expect(later.map((s) => s.done)).toEqual([false, false, true, true, false]);
  });

  it('counts the checks answered in games today toward the game step, with how many are left', () => {
    const today = startOfDay(NOW);
    const game = (cct: CctEvent[]) => todayRoutine({ now: NOW, cct, tacticSessions: [], dueCards: 0, plansDue: 0 }).find((s) => s.key === 'game')!;
    const inGame = (n: number, at = today + 10) => Array.from({ length: n }, (_, k) => answer(at + k, 'play'));
    expect(game(inGame(3))).toMatchObject({ done: false, left: GAME_CHECKS - 3 });
    // Yesterday's game and today's warm-up do not count
    expect(game([...inGame(GAME_CHECKS, today - 3600_000), ...Array.from({ length: 12 }, () => answer(today + 5))])).toMatchObject({ done: false, left: undefined });
    expect(game(inGame(GAME_CHECKS))).toMatchObject({ done: true, left: undefined });
  });
});
