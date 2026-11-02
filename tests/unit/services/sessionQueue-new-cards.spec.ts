import { describe, it, expect } from 'vitest';
import { buildQueue, isGameCard, lessonOf } from '../../../src/services/sessionQueue';
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

  it('puts cards from reviewed games first among new cards, in at most half the new slots (CL-3)', () => {
    const cards: StoredCard[] = [];
    for (const lesson of ['lesson-a', 'lesson-b']) for (let ply = 0; ply < 5; ply++) cards.push(fresh(`${lesson}-${ply}`, lesson, ply));
    // Six mistakes from two reviewed games, one review lesson id per game
    const fromGame = (id: string, game: string, ply: number): StoredCard => ({
      ...fresh(id, `review:${game}`, ply),
      tags: ['blunder:failed_to_save', `game:${game}`],
    });
    for (const game of ['g1', 'g2']) for (let ply = 0; ply < 3; ply++) cards.push(fromGame(`${game}-${ply}`, game, ply));

    const queue = buildQueue(cards, { now: NOW, maxNew: 6, retrievability: () => 0 });
    expect(queue).toHaveLength(6);
    expect(queue.slice(0, 3).every(isGameCard)).toBe(true);
    expect(queue.slice(3).some(isGameCard)).toBe(false);
    // Both games are represented before either gives a second card
    expect(queue.slice(0, 2).map(lessonOf).sort()).toEqual(['review:g1', 'review:g2']);

    // With few game cards the curriculum fills the rest
    const one = buildQueue([...cards.filter((c) => !isGameCard(c)), fromGame('g3-0', 'g3', 0)], { now: NOW, maxNew: 6, retrievability: () => 0 });
    expect(one.map(isGameCard)).toEqual([true, false, false, false, false, false]);
  });

  it('lessonOf reads the lesson tag and falls back to the first lesson id', () => {
    const tagged = fresh('x', 'lesson-z', 0);
    expect(lessonOf(tagged)).toBe('lesson-z');
    expect(lessonOf({ ...tagged, tags: [] })).toBe('lesson-z');
  });
});
