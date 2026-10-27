import { describe, it, expect } from 'vitest';
import { buildQueue, lessonOf } from '../../../src/services/sessionQueue';
import { StoredCard } from '../../../src/types/db';

const STATE_NEW = 0;
const NOW = 1_700_000_000_000;

function fresh(id: string, lesson: string, ply: number): StoredCard {
  return {
    id,
    fen: id,
    accepted: ['e4'],
    lessonIds: [lesson],
    tags: [`lesson:${lesson}`, 'family:opening', 'color:w'],
    ply,
    reachProb: 1,
    color: 'w',
    due: NOW - 1000,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: STATE_NEW,
    responseStats: { n: 0, meanMs: 0 },
    createdAt: NOW - 1000,
  };
}

describe('New cards in a session are spread across lessons before the daily cap', () => {
  it('takes the first decisions of several lessons rather than one lesson in FEN order', () => {
    const cards: StoredCard[] = [];
    // Three lessons with nine decisions each, all New, created in one batch (same due)
    for (const lesson of ['lesson-a', 'lesson-b', 'lesson-c']) {
      for (let ply = 0; ply < 9; ply++) cards.push(fresh(`${lesson}-${String.fromCharCode(97 + ply)}`, lesson, ply));
    }
    const queue = buildQueue(cards, { now: NOW, maxNew: 6, retrievability: () => 0 });
    expect(queue).toHaveLength(6);
    const lessons = queue.map(lessonOf);
    expect(new Set(lessons).size).toBe(3);
    // Round-robin: no two consecutive cards from the same lesson while others remain
    for (let i = 0; i + 1 < lessons.length; i++) expect(lessons[i]).not.toBe(lessons[i + 1]);
    // Within a lesson, earlier decisions come first
    expect(queue.filter((c) => lessonOf(c) === 'lesson-a').map((c) => c.ply)).toEqual([0, 1]);
  });

  it('lessonOf reads the lesson tag and falls back to the first lesson id', () => {
    const tagged = fresh('x', 'lesson-z', 0);
    expect(lessonOf(tagged)).toBe('lesson-z');
    expect(lessonOf({ ...tagged, tags: [] })).toBe('lesson-z');
  });
});
