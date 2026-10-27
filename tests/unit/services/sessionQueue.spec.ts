import { describe, it, expect, afterEach } from 'vitest';
import {
  buildQueue,
  familyOf,
  queuePriority,
  interleaveByFamily,
  LearningSteps,
  saveSessionState,
  loadSessionState,
  clearSessionState,
  SESSION_STATE_KEY,
  DEFAULT_MAX_REVIEWS,
  DEFAULT_MAX_NEW,
  type SessionState,
} from '../../../src/services/sessionQueue';
import type { StoredCard } from '../../../src/types/db';

const NOW = 1_800_000_000_000;
const STATE_NEW = 0;
const STATE_REVIEW = 2;

interface CardOpts {
  family?: string | null;
  reachProb?: number;
  due?: number;
  state?: number;
  R?: number;
}

const retrievabilityById = new Map<string, number>();

function card(id: string, opts: CardOpts = {}): StoredCard {
  const tags = ['color:w'];
  if (opts.family !== null) tags.push(`family:${opts.family ?? 'opening'}`);
  retrievabilityById.set(id, opts.R ?? 0.5);
  return {
    id,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    accepted: ['e4'],
    lessonIds: ['lesson'],
    tags,
    ply: 0,
    reachProb: opts.reachProb ?? 1,
    color: 'w',
    due: opts.due ?? NOW - 1000,
    stability: 1,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: opts.state === STATE_NEW ? 0 : 3,
    lapses: 0,
    state: opts.state ?? STATE_REVIEW,
    responseStats: { n: 0, meanMs: 0 },
    createdAt: NOW - 100_000,
  };
}

const R = (c: StoredCard) => retrievabilityById.get(c.id) ?? 0;

/** Every adjacent same-family pair must be in the unavoidable single-family tail. */
function assertInterleaved(queue: StoredCard[]): void {
  for (let i = 0; i + 1 < queue.length; i++) {
    if (familyOf(queue[i]) === familyOf(queue[i + 1])) {
      const tail = queue.slice(i + 1);
      const families = new Set(tail.map(familyOf));
      expect(families.size, `cards ${queue[i].id} and ${queue[i + 1].id} share a family while other families remain`).toBe(1);
      expect(families.has(familyOf(queue[i]))).toBe(true);
    }
  }
}

describe('sessionQueue helpers', () => {
  it('familyOf reads the family tag and falls back to the empty string', () => {
    expect(familyOf(card('a', { family: 'weakness_drill' }))).toBe('weakness_drill');
    expect(familyOf(card('b', { family: null }))).toBe('');
  });

  it('queuePriority is (1 - R) x (0.5 + reachProb)', () => {
    expect(queuePriority(card('a', { reachProb: 1 }), 0)).toBeCloseTo(1.5);
    expect(queuePriority(card('b', { reachProb: 0.5 }), 0.5)).toBeCloseTo(0.5);
    expect(queuePriority(card('c', { reachProb: 0 }), 0.9)).toBeCloseTo(0.05);
    // garbage retrievability is clamped
    expect(queuePriority(card('d', { reachProb: 1 }), Number.NaN)).toBeCloseTo(1.5);
    expect(queuePriority(card('e', { reachProb: 1 }), 2)).toBe(0);
  });
});

describe('buildQueue', () => {
  it('returns an empty queue when nothing is due', () => {
    const cards = [card('a', { due: NOW + 1 }), card('b', { due: NOW + 60_000 })];
    expect(buildQueue(cards, { now: NOW, retrievability: R })).toEqual([]);
    expect(buildQueue([], { now: NOW, retrievability: R })).toEqual([]);
  });

  it('includes cards due exactly now and excludes future ones', () => {
    const cards = [card('a', { due: NOW }), card('b', { due: NOW + 1 })];
    expect(buildQueue(cards, { now: NOW, retrievability: R }).map((c) => c.id)).toEqual(['a']);
  });

  it('orders a single family by (1 - R) x (0.5 + reachProb) descending', () => {
    const cards = [
      card('low', { R: 0.9, reachProb: 1 }), // 0.15
      card('high', { R: 0.2, reachProb: 1 }), // 1.2
      card('mid', { R: 0.5, reachProb: 0.8 }), // 0.65
      card('rare', { R: 0.2, reachProb: 0.1 }), // 0.48
    ];
    expect(buildQueue(cards, { now: NOW, retrievability: R }).map((c) => c.id)).toEqual(['high', 'mid', 'rare', 'low']);
  });

  it('breaks priority ties by earliest due then id', () => {
    const cards = [card('b', { R: 0.5, due: NOW - 10 }), card('a', { R: 0.5, due: NOW - 10 }), card('c', { R: 0.5, due: NOW - 20 })];
    expect(buildQueue(cards, { now: NOW, retrievability: R }).map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('caps reviews at maxReviews (default 30) and new cards at maxNew (default 8)', () => {
    const reviews = Array.from({ length: 40 }, (_, i) => card(`r${i}`, { R: 0.1 + i * 0.01 }));
    const fresh = Array.from({ length: 12 }, (_, i) => card(`n${i}`, { state: STATE_NEW, R: 0, reachProb: 1 - i * 0.05 }));
    const queue = buildQueue([...reviews, ...fresh], { now: NOW, retrievability: R });
    expect(queue.filter((c) => c.state === STATE_NEW)).toHaveLength(DEFAULT_MAX_NEW);
    expect(queue.filter((c) => c.state !== STATE_NEW)).toHaveLength(DEFAULT_MAX_REVIEWS);
    // the most urgent reviews and the most reachable new cards survive the cap
    const ids = new Set(queue.map((c) => c.id));
    for (let i = 0; i < 30; i++) expect(ids.has(`r${i}`)).toBe(true);
    for (let i = 0; i < 8; i++) expect(ids.has(`n${i}`)).toBe(true);

    const small = buildQueue([...reviews, ...fresh], { now: NOW, retrievability: R, maxReviews: 3, maxNew: 2 });
    expect(small).toHaveLength(5);
    expect(small.filter((c) => c.state === STATE_NEW).map((c) => c.id).sort()).toEqual(['n0', 'n1']);
    expect(small.filter((c) => c.state !== STATE_NEW).map((c) => c.id).sort()).toEqual(['r0', 'r1', 'r2']);

    const noNew = buildQueue([...reviews, ...fresh], { now: NOW, retrievability: R, maxNew: 0 });
    expect(noNew.some((c) => c.state === STATE_NEW)).toBe(false);
  });

  it('round-robins across families so consecutive cards differ while more than one family remains', () => {
    const cards = [
      card('o1', { family: 'opening', R: 0.1 }),
      card('o2', { family: 'opening', R: 0.2 }),
      card('o3', { family: 'opening', R: 0.3 }),
      card('o4', { family: 'opening', R: 0.4 }),
      card('d1', { family: 'weakness_drill', R: 0.15 }),
      card('d2', { family: 'weakness_drill', R: 0.35 }),
      card('g1', { family: 'anti_gambit', R: 0.25 }),
    ];
    const queue = buildQueue(cards, { now: NOW, retrievability: R });
    expect(queue).toHaveLength(7);
    // families are visited in the order of their most urgent card: opening (o1), drill (d1), anti_gambit (g1)
    expect(queue.map((c) => c.id)).toEqual(['o1', 'd1', 'g1', 'o2', 'd2', 'o3', 'o4']);
    assertInterleaved(queue);
  });

  it('keeps the most urgent card first', () => {
    const cards = [
      card('o1', { family: 'opening', R: 0.6 }),
      card('d1', { family: 'weakness_drill', R: 0.05 }),
      card('o2', { family: 'opening', R: 0.7 }),
    ];
    const queue = buildQueue(cards, { now: NOW, retrievability: R });
    expect(queue[0].id).toBe('d1');
    assertInterleaved(queue);
  });

  it('interleaves new and review cards and cards without a family tag', () => {
    const cards = [
      card('n1', { state: STATE_NEW, R: 0, family: 'opening' }),
      card('n2', { state: STATE_NEW, R: 0, family: 'tactic' }),
      card('r1', { R: 0.4, family: 'opening' }),
      card('r2', { R: 0.3, family: 'tactic' }),
      card('x1', { R: 0.5, family: null }),
      card('x2', { R: 0.6, family: null }),
    ];
    const queue = buildQueue(cards, { now: NOW, retrievability: R });
    expect(queue).toHaveLength(6);
    // Overdue reviews always precede new material; interleaving holds within each segment
    const firstNew = queue.findIndex((c) => c.state === STATE_NEW);
    expect(queue.slice(firstNew).every((c) => c.state === STATE_NEW)).toBe(true);
    assertInterleaved(queue.slice(0, firstNew));
    assertInterleaved(queue.slice(firstNew));
  });

  it('interleaving holds for a large mixed set', () => {
    const families = ['opening', 'weakness_drill', 'anti_gambit', 'tactic'];
    const cards: StoredCard[] = [];
    let seed = 42;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 60; i++) {
      cards.push(
        card(`c${i}`, {
          family: families[Math.floor(rnd() * rnd() * families.length)],
          R: rnd(),
          reachProb: rnd(),
          state: rnd() < 0.3 ? STATE_NEW : STATE_REVIEW,
          due: NOW - Math.floor(rnd() * 1000),
        })
      );
    }
    const queue = buildQueue(cards, { now: NOW, retrievability: R, maxReviews: 30, maxNew: 8 });
    expect(queue.length).toBeLessThanOrEqual(38);
    expect(new Set(queue.map((c) => c.id)).size).toBe(queue.length);
    const firstNew = queue.findIndex((c) => c.state === STATE_NEW);
    const reviews = firstNew === -1 ? queue : queue.slice(0, firstNew);
    const fresh = firstNew === -1 ? [] : queue.slice(firstNew);
    expect(fresh.every((c) => c.state === STATE_NEW)).toBe(true);
    expect(reviews.every((c) => c.state !== STATE_NEW)).toBe(true);
    assertInterleaved(reviews);
    assertInterleaved(fresh);
  });

  it('interleaveByFamily leaves a single family in priority order', () => {
    const cards = [card('a', { R: 0.5 }), card('b', { R: 0.1 }), card('c', { R: 0.9 })];
    const out = interleaveByFamily(cards, (c) => queuePriority(c, R(c)));
    expect(out.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('LearningSteps min-heap', () => {
  it('pops cards in due order once their step time has passed', () => {
    const heap = new LearningSteps();
    heap.push('ten', NOW + 10 * 60_000);
    heap.push('one', NOW + 60_000);
    heap.push('five', NOW + 5 * 60_000);
    expect(heap.size).toBe(3);
    expect(heap.peek()).toEqual({ cardId: 'one', dueAt: NOW + 60_000 });

    expect(heap.popDue(NOW)).toBeNull();
    expect(heap.popDue(NOW + 59_999)).toBeNull();
    expect(heap.popDue(NOW + 60_000)).toBe('one');
    expect(heap.popDue(NOW + 60_000)).toBeNull();
    expect(heap.popDue(NOW + 20 * 60_000)).toBe('five');
    expect(heap.popDue(NOW + 20 * 60_000)).toBe('ten');
    expect(heap.popDue(NOW + 20 * 60_000)).toBeNull();
    expect(heap.size).toBe(0);
    expect(heap.peek()).toBeNull();
  });

  it('is stable for equal due times and survives many random operations', () => {
    const heap = new LearningSteps();
    heap.push('a', NOW);
    heap.push('b', NOW);
    heap.push('c', NOW);
    expect([heap.popDue(NOW), heap.popDue(NOW), heap.popDue(NOW)]).toEqual(['a', 'b', 'c']);

    const expected: Array<{ id: string; t: number }> = [];
    let seed = 7;
    for (let i = 0; i < 200; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const t = NOW + (seed % 1000);
      heap.push(`k${i}`, t);
      expected.push({ id: `k${i}`, t });
    }
    expected.sort((x, y) => x.t - y.t || Number(x.id.slice(1)) - Number(y.id.slice(1)));
    const popped: string[] = [];
    let id: string | null;
    while ((id = heap.popDue(NOW + 10_000)) !== null) popped.push(id);
    expect(popped).toEqual(expected.map((e) => e.id));
  });

  it('re-pushing a card replaces its entry', () => {
    const heap = new LearningSteps();
    heap.push('x', NOW + 60_000);
    heap.push('y', NOW + 120_000);
    heap.push('x', NOW + 600_000);
    expect(heap.size).toBe(2);
    expect(heap.has('x')).toBe(true);
    expect(heap.popDue(NOW + 60_000)).toBeNull();
    expect(heap.popDue(NOW + 120_000)).toBe('y');
    expect(heap.popDue(NOW + 600_000)).toBe('x');
  });

  it('supports remove, clear and JSON round trip', () => {
    const heap = new LearningSteps();
    heap.push('a', NOW + 3);
    heap.push('b', NOW + 1);
    heap.push('c', NOW + 2);
    expect(heap.remove('c')).toBe(true);
    expect(heap.remove('c')).toBe(false);
    expect(heap.toJSON()).toEqual([
      { cardId: 'b', dueAt: NOW + 1 },
      { cardId: 'a', dueAt: NOW + 3 },
    ]);
    const restored = new LearningSteps(heap.toJSON());
    expect(restored.popDue(NOW + 10)).toBe('b');
    expect(restored.popDue(NOW + 10)).toBe('a');
    heap.clear();
    expect(heap.size).toBe(0);
  });
});

describe('session state persistence', () => {
  const state: SessionState = {
    sessionId: 's-1',
    startedAt: NOW,
    queueIds: ['a', 'b', 'c'],
    cursor: 1,
    learning: [{ cardId: 'a', dueAt: NOW + 60_000 }],
    completed: ['z'],
  };

  function installSessionStorage(): Map<string, string> {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => {
        map.set(k, String(v));
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    } as unknown as Storage;
    Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true, writable: true });
    return map;
  }

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
  });

  it('round-trips through sessionStorage', () => {
    const map = installSessionStorage();
    expect(saveSessionState(state)).toBe(true);
    expect(map.has(SESSION_STATE_KEY)).toBe(true);
    expect(loadSessionState()).toEqual(state);
    clearSessionState();
    expect(loadSessionState()).toBeNull();
  });

  it('returns null for malformed or partial data and drops bad entries', () => {
    const map = installSessionStorage();
    map.set(SESSION_STATE_KEY, '{oops');
    expect(loadSessionState()).toBeNull();
    map.set(SESSION_STATE_KEY, JSON.stringify({ sessionId: 's', startedAt: 'yesterday', queueIds: [], cursor: 0 }));
    expect(loadSessionState()).toBeNull();
    map.set(
      SESSION_STATE_KEY,
      JSON.stringify({ sessionId: 's', startedAt: 1, queueIds: ['a', 5, null], cursor: 0, learning: [{ cardId: 'a' }, { cardId: 'b', dueAt: 2 }] })
    );
    expect(loadSessionState()).toEqual({
      sessionId: 's',
      startedAt: 1,
      queueIds: ['a'],
      cursor: 0,
      learning: [{ cardId: 'b', dueAt: 2 }],
      completed: [],
    });
  });

  it('is a no-op without sessionStorage', () => {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
    expect(saveSessionState(state)).toBe(false);
    expect(loadSessionState()).toBeNull();
    expect(() => clearSessionState()).not.toThrow();
  });

  it('swallows storage errors', () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('quota');
        },
        removeItem: () => {
          throw new Error('blocked');
        },
      },
    });
    expect(saveSessionState(state)).toBe(false);
    expect(loadSessionState()).toBeNull();
    expect(() => clearSessionState()).not.toThrow();
  });
});
