import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Chess } from 'chess.js';
import { State, Rating } from 'ts-fsrs';
import {
  CardService,
  CARDS_MIGRATED_KEY,
  LEGACY_SRS_STORAGE_KEY,
  legacyGradeToRating,
  type DecisionSpec,
} from '../../../src/services/cards';
import { canonicalFenKey } from '../../../src/services/fenKey';
import { db } from '../../../src/db/database';
import type { StoredSrsCard } from '../../../src/types/db';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const NOW = Date.UTC(2026, 9, 25, 9, 0, 0);

/** Walk a line with chess.js and emit one DecisionSpec per student move. */
function decisionsFor(lessonId: string, sans: string[], color: 'w' | 'b', family: string): DecisionSpec[] {
  const chess = new Chess();
  const out: DecisionSpec[] = [];
  sans.forEach((san, ply) => {
    if (chess.turn() === color) {
      out.push({
        fen: chess.fen(),
        acceptedSan: [san],
        lessonId,
        ply,
        color,
        path: sans.slice(0, ply),
        tags: [`lesson:${lessonId}`, `family:${family}`, `color:${color}`, `opening:${lessonId}`],
        title: `${lessonId} decision ${ply}`,
        reachProb: 1,
      });
    }
    chess.move(san);
  });
  return out;
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
  } as Storage;
}

function installLocalStorage(): Storage {
  const storage = memoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  return storage;
}

const italian = decisionsFor('italian-evans', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'], 'w', 'opening');
const italianViaBishop = decisionsFor('italian-bishop-first', ['e4', 'e5', 'Bc4', 'Nc6', 'Nf3', 'Bc5', 'b4'], 'w', 'opening');
const scandinavian = decisionsFor('scandi-drill', ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3'], 'w', 'weakness_drill');
const caroKann = decisionsFor('caro-kann', ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4'], 'b', 'opening');

describe('CardService (FSRS position cards, fake-indexeddb)', () => {
  beforeEach(async () => {
    installLocalStorage();
    await CardService.resetAll();
    await db.srs_cards.clear();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  describe('ensureCards', () => {
    it('creates one New ts-fsrs card per decision keyed by the canonical FEN key', async () => {
      const cards = await CardService.ensureCards(italian, NOW);
      expect(cards).toHaveLength(4); // e4, Nf3, Bc4, b4
      for (const [i, card] of cards.entries()) {
        const spec = italian[i];
        expect(card.id).toBe(canonicalFenKey(spec.fen));
        expect(card.fen).toBe(spec.fen);
        expect(card.accepted).toEqual(spec.acceptedSan);
        expect(card.lessonIds).toEqual(['italian-evans']);
        expect(card.tags).toEqual(spec.tags);
        expect(card.ply).toBe(spec.ply);
        expect(card.color).toBe('w');
        expect(card.title).toBe(spec.title);
        expect(card.reachProb).toBe(1);
        // createEmptyCard(now): due now, New, nothing scheduled yet
        expect(card.state).toBe(State.New);
        expect(card.due).toBe(NOW);
        expect(card.reps).toBe(0);
        expect(card.lapses).toBe(0);
        expect(card.stability).toBe(0);
        expect(card.difficulty).toBe(0);
        expect(card.learning_steps).toBe(0);
        expect(card.last_review).toBeUndefined();
        expect(card.responseStats).toEqual({ n: 0, meanMs: 0 });
        expect(card.createdAt).toBe(NOW);
      }
      expect(await db.cards.count()).toBe(4);
    });

    it('is idempotent', async () => {
      await CardService.ensureCards(italian, NOW);
      const again = await CardService.ensureCards(italian, NOW + DAY);
      expect(again).toHaveLength(4);
      expect(await db.cards.count()).toBe(4);
      expect(again.every((c) => c.createdAt === NOW)).toBe(true);
    });

    it('returns an empty list for no specs', async () => {
      expect(await CardService.ensureCards([], NOW)).toEqual([]);
    });

    it('shares one card between transposing lessons, merging lessonIds, tags and accepted moves', async () => {
      await CardService.ensureCards(italian, NOW);
      await CardService.ensureCards(italianViaBishop, NOW);

      // The position before 4.b4 is identical in both move orders.
      const sharedFen = italian[3].fen;
      expect(canonicalFenKey(sharedFen)).toBe(canonicalFenKey(italianViaBishop[3].fen));

      const shared = await CardService.getCard(canonicalFenKey(sharedFen));
      expect(shared).toBeDefined();
      expect(shared!.lessonIds).toEqual(['italian-evans', 'italian-bishop-first']);
      expect(shared!.tags).toContain('lesson:italian-evans');
      expect(shared!.tags).toContain('lesson:italian-bishop-first');
      expect(shared!.tags.filter((t) => t === 'family:opening')).toHaveLength(1);
      expect(shared!.accepted).toEqual(['b4']);

      // The position after 1.e4 e5 is also shared, and the two lessons continue
      // differently from it: both replies are accepted, main move of the first lesson first.
      const afterE5 = await CardService.getCard(canonicalFenKey(italian[1].fen));
      expect(afterE5!.accepted).toEqual(['Nf3', 'Bc4']);
      expect(afterE5!.lessonIds).toEqual(['italian-evans', 'italian-bishop-first']);

      // 4 + 4 decisions, three shared (start, after 1.e4 e5, and the pre-b4 position)
      expect(await db.cards.count()).toBe(5);
      expect(await CardService.getCardsForLesson('italian-bishop-first')).toHaveLength(4);
      expect(await CardService.getCardsForLesson('italian-evans')).toHaveLength(4);
    });

    it('merges a different accepted move at the same position without losing the first', async () => {
      const spec = italian[1];
      await CardService.ensureCards([spec], NOW);
      await CardService.ensureCards([{ ...spec, lessonId: 'other', acceptedSan: ['Nc3', 'Nf3'], reachProb: 0.4 }], NOW);
      const card = await CardService.getCard(canonicalFenKey(spec.fen));
      expect(card!.accepted).toEqual(['Nf3', 'Nc3']);
      expect(card!.reachProb).toBe(1); // max of the paths that reach it
    });

    it('never resets the scheduling fields of an existing card', async () => {
      const [card] = await CardService.ensureCards([italian[0]], NOW);
      const reviewed = await CardService.review(card.id, 'good', { now: NOW + MINUTE });
      expect(reviewed.reps).toBe(1);

      const [merged] = await CardService.ensureCards(
        [{ ...italian[0], lessonId: 'another-lesson', tags: ['lesson:another-lesson', 'family:opening'] }],
        NOW + DAY
      );
      expect(merged.id).toBe(card.id);
      expect(merged.lessonIds).toEqual(['italian-evans', 'another-lesson']);
      expect(merged.reps).toBe(1);
      expect(merged.due).toBe(reviewed.due);
      expect(merged.state).toBe(reviewed.state);
      expect(merged.stability).toBe(reviewed.stability);
      expect(merged.last_review).toBe(reviewed.last_review);
      expect(merged.createdAt).toBe(NOW);
    });

    it('rejects a decision with an illegal FEN', async () => {
      await expect(
        CardService.ensureCards([{ ...italian[0], fen: 'not a fen' }], NOW)
      ).rejects.toThrow();
      expect(await db.cards.count()).toBe(0);
    });
  });

  describe('queries', () => {
    it('getDueCards returns cards due at or before now, earliest first', async () => {
      const cards = await CardService.ensureCards([...italian, ...scandinavian], NOW);
      expect(cards).toHaveLength(6); // 4 italian + exd5 + Nc3 (the start position is shared)
      // Push one card into the future with an Easy review (Review state, days away).
      const future = await CardService.review(cards[0].id, 'easy', { now: NOW });
      expect(future.due).toBeGreaterThan(NOW + DAY);

      const due = await CardService.getDueCards(NOW);
      expect(due.map((c) => c.id)).not.toContain(future.id);
      expect(due).toHaveLength(cards.length - 1);
      for (let i = 1; i < due.length; i++) expect(due[i].due).toBeGreaterThanOrEqual(due[i - 1].due);

      const later = await CardService.getDueCards(future.due);
      expect(later).toHaveLength(cards.length);
    });

    it('getCardsForLesson uses the multi-entry lessonIds index', async () => {
      await CardService.ensureCards([...italian, ...caroKann], NOW);
      const caro = await CardService.getCardsForLesson('caro-kann');
      expect(caro).toHaveLength(3); // c6, d5, dxe4
      expect(caro.every((c) => c.color === 'b')).toBe(true);
      expect(await CardService.getCardsForLesson('missing')).toEqual([]);
      expect(await CardService.getAllCards()).toHaveLength(7);
    });
  });

  describe('review', () => {
    it('applies the ts-fsrs learning steps and writes a revlog row', async () => {
      const [card] = await CardService.ensureCards([italian[0]], NOW);
      const after = await CardService.review(card.id, 'again', {
        now: NOW,
        responseMs: 8000,
        hintLevel: 3,
        wrongSan: 'd4',
        lessonId: 'italian-evans',
        sessionId: 'session-1',
      });

      expect(after.state).toBe(State.Learning);
      expect(after.due).toBe(NOW + 1 * MINUTE); // first learning step 1m
      expect(after.reps).toBe(1);
      expect(after.lapses).toBe(0);
      expect(after.last_review).toBe(NOW);
      expect(after.responseStats).toEqual({ n: 1, meanMs: 8000 });

      const stored = await CardService.getCard(card.id);
      expect(stored).toEqual(after);

      const log = await db.revlog.where('cardId').equals(card.id).toArray();
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({
        cardId: card.id,
        rating: Rating.Again,
        state: State.New, // state before the review
        due: NOW,
        review: NOW,
        responseMs: 8000,
        hintLevel: 3,
        wrongSan: 'd4',
        lessonId: 'italian-evans',
        sessionId: 'session-1',
      });
      expect(typeof log[0].id).toBe('number');
    });

    it('graduates to Review after two Good answers and relearns after a lapse', async () => {
      const [card] = await CardService.ensureCards([italian[0]], NOW);
      const first = await CardService.review(card.id, 'good', { now: NOW, responseMs: 4000 });
      expect(first.state).toBe(State.Learning);
      expect(first.due).toBe(NOW + 10 * MINUTE); // second learning step
      expect(first.learning_steps).toBe(1);

      const second = await CardService.review(card.id, 'good', { now: first.due, responseMs: 2000 });
      expect(second.state).toBe(State.Review);
      expect(second.scheduled_days).toBeGreaterThanOrEqual(1);
      expect(second.due - first.due).toBe(second.scheduled_days * DAY);
      expect(second.responseStats.n).toBe(2);
      expect(second.responseStats.meanMs).toBe(3000);

      const lapsed = await CardService.review(card.id, 'again', { now: second.due });
      expect(lapsed.state).toBe(State.Relearning);
      expect(lapsed.lapses).toBe(1);
      expect(lapsed.due).toBe(second.due + 10 * MINUTE); // relearning step 10m

      expect(await db.revlog.where('cardId').equals(card.id).count()).toBe(3);
    });

    it('caps the interval at maximum_interval (365 days)', async () => {
      const [card] = await CardService.ensureCards([italian[0]], NOW);
      let current = card;
      let t = NOW;
      for (let i = 0; i < 15; i++) {
        current = await CardService.review(current.id, 'easy', { now: t });
        t = current.due;
      }
      expect(current.state).toBe(State.Review);
      // At request_retention 0.9 the uncapped interval equals the stability,
      // which is far beyond a year by now; ts-fsrs clamps every grade's interval
      // at maximum_interval and then keeps hard < good < easy by adding one day
      // per step, so Easy can land at most two days past the cap.
      expect(current.stability).toBeGreaterThan(365);
      expect(current.scheduled_days).toBeLessThanOrEqual(365 + 2);
      expect(current.due - current.last_review!).toBe(current.scheduled_days * DAY);

      // Good from the same card stays within one day of the cap.
      const good = await CardService.review(current.id, 'good', { now: current.due });
      expect(good.scheduled_days).toBeLessThanOrEqual(365 + 1);
    });

    it('is deterministic for a fixed clock (fuzz is seeded)', async () => {
      const [a] = await CardService.ensureCards([italian[0]], NOW);
      const [b] = await CardService.ensureCards([scandinavian[1]], NOW);
      let ca = a;
      let cb = b;
      let t = NOW;
      for (const r of ['good', 'good', 'good', 'easy', 'good'] as const) {
        ca = await CardService.review(ca.id, r, { now: t });
        cb = await CardService.review(cb.id, r, { now: t });
        t = ca.due;
      }
      expect(ca.due).toBe(cb.due);
      expect(ca.stability).toBe(cb.stability);
    });

    it('ignores missing or negative response times in the running mean', async () => {
      const [card] = await CardService.ensureCards([italian[0]], NOW);
      const a = await CardService.review(card.id, 'good', { now: NOW });
      expect(a.responseStats).toEqual({ n: 0, meanMs: 0 });
      const b = await CardService.review(card.id, 'good', { now: a.due, responseMs: -5 });
      expect(b.responseStats).toEqual({ n: 0, meanMs: 0 });
    });

    it('throws for an unknown card or rating and writes nothing', async () => {
      await expect(CardService.review('no-such-card', 'good', { now: NOW })).rejects.toThrow(/no card/);
      const [card] = await CardService.ensureCards([italian[0]], NOW);
      await expect(
        CardService.review(card.id, 'perfect' as unknown as 'good', { now: NOW })
      ).rejects.toThrow(/unknown rating/);
      expect(await db.revlog.count()).toBe(0);
    });
  });

  describe('inferRating', () => {
    const base = {
      wrongFirstTry: false,
      hintLevel: 0,
      responseMs: 5000,
      meanMs: 6000,
      state: State.Learning,
      retrievability: 0.8,
      reps: 1,
    };

    it('wrong first try is Again whatever else happened', () => {
      expect(CardService.inferRating({ ...base, wrongFirstTry: true })).toBe('again');
      expect(CardService.inferRating({ ...base, wrongFirstTry: true, responseMs: 500, state: State.Review, retrievability: 0.99, reps: 9 })).toBe('again');
    });

    it('a move-revealing hint (level 3) is Again', () => {
      expect(CardService.inferRating({ ...base, hintLevel: 3 })).toBe('again');
      expect(CardService.inferRating({ ...base, hintLevel: 4 })).toBe('again');
    });

    it('a plan hint (level 1-2) is Hard', () => {
      expect(CardService.inferRating({ ...base, hintLevel: 1 })).toBe('hard');
      expect(CardService.inferRating({ ...base, hintLevel: 2 })).toBe('hard');
    });

    it('a slow answer is Hard: slower than max(12 s, 2.5 x meanMs)', () => {
      // meanMs 0 (new card): the floor of 12 s applies
      expect(CardService.inferRating({ ...base, meanMs: 0, responseMs: 12000 })).toBe('good');
      expect(CardService.inferRating({ ...base, meanMs: 0, responseMs: 12001 })).toBe('hard');
      // meanMs 6000: threshold 15 s
      expect(CardService.inferRating({ ...base, meanMs: 6000, responseMs: 15000 })).toBe('good');
      expect(CardService.inferRating({ ...base, meanMs: 6000, responseMs: 15001 })).toBe('hard');
      // meanMs 2000: threshold stays at the 12 s floor
      expect(CardService.inferRating({ ...base, meanMs: 2000, responseMs: 11999 })).toBe('good');
      expect(CardService.inferRating({ ...base, meanMs: 2000, responseMs: 12001 })).toBe('hard');
    });

    it('a clean, normally paced answer is Good', () => {
      expect(CardService.inferRating(base)).toBe('good');
      expect(CardService.inferRating({ ...base, state: State.New, reps: 0, retrievability: 0 })).toBe('good');
    });

    it('Easy only for a Review card with R > 0.95, under 3 s and at least three reps', () => {
      const easy = { ...base, state: State.Review, retrievability: 0.96, responseMs: 2999, reps: 3 };
      expect(CardService.inferRating(easy)).toBe('easy');
      expect(CardService.inferRating({ ...easy, state: State.Learning })).toBe('good');
      expect(CardService.inferRating({ ...easy, state: State.Relearning })).toBe('good');
      expect(CardService.inferRating({ ...easy, retrievability: 0.95 })).toBe('good');
      expect(CardService.inferRating({ ...easy, responseMs: 3000 })).toBe('good');
      expect(CardService.inferRating({ ...easy, reps: 2 })).toBe('good');
      expect(CardService.inferRating({ ...easy, hintLevel: 1 })).toBe('hard');
    });
  });

  describe('retrievability', () => {
    it('is 0 for a New card, 1 at the moment of review and decays afterwards', async () => {
      const [card] = await CardService.ensureCards([italian[0]], NOW);
      expect(CardService.retrievability(card, NOW)).toBe(0);

      const reviewed = await CardService.review(card.id, 'easy', { now: NOW });
      expect(reviewed.state).toBe(State.Review);
      expect(CardService.retrievability(reviewed, NOW)).toBe(1);
      const atDue = CardService.retrievability(reviewed, reviewed.due);
      expect(atDue).toBeGreaterThan(0.8);
      expect(atDue).toBeLessThan(1);
      const muchLater = CardService.retrievability(reviewed, reviewed.due + 100 * DAY);
      expect(muchLater).toBeLessThan(atDue);
    });
  });

  describe('legacy grade map', () => {
    it('maps SM-2 grades 0-2 again, 3 hard, 4 good, 5 easy', () => {
      expect(legacyGradeToRating(0)).toBe('again');
      expect(legacyGradeToRating(1)).toBe('again');
      expect(legacyGradeToRating(2)).toBe('again');
      expect(legacyGradeToRating(3)).toBe('hard');
      expect(legacyGradeToRating(4)).toBe('good');
      expect(legacyGradeToRating(5)).toBe('easy');
    });
  });

  describe('migrateLegacy', () => {
    const legacyRow = (id: string, extra: Partial<StoredSrsCard> = {}): StoredSrsCard => ({
      id,
      repertoireId: 'opening',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      expectedMoveSan: 'e4',
      dueDate: NOW,
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      box: 1,
      ...extra,
    });

    const specsByLesson: Record<string, DecisionSpec[]> = {
      'italian-evans': italian,
      'scandi-drill': scandinavian,
      'caro-kann': caroKann,
    };

    it('creates the decision cards and replays the localStorage history through the scheduler', async () => {
      const t1 = NOW - 10 * DAY;
      const t2 = NOW - 3 * DAY;
      const t3 = NOW - 1 * DAY;
      await db.srs_cards.bulkPut([
        legacyRow('italian-evans', { repetitions: 2, box: 2 }),
        legacyRow('scandi-drill'),
        legacyRow('unknown-lesson'),
      ]);
      globalThis.localStorage.setItem(
        LEGACY_SRS_STORAGE_KEY,
        JSON.stringify([
          {
            cardId: 'italian-evans',
            // deliberately out of order: the migration sorts by timestamp
            history: [
              { timestamp: t3, grade: 2, mistakeCount: 2, usedHint: true, hintLevel: 3 },
              { timestamp: t1, grade: 5, mistakeCount: 0, usedHint: false, hintLevel: 0 },
              { timestamp: t2, grade: 4, mistakeCount: 1, usedHint: false, hintLevel: 0 },
            ],
          },
          { cardId: 'scandi-drill', history: [] },
        ])
      );

      const result = await CardService.migrateLegacy(specsByLesson, NOW);
      expect(result.migrated).toBe(2); // italian + scandi; unknown-lesson has no specs

      // italian-evans: 4 cards, each with 3 replayed reviews
      const italianCards = await CardService.getCardsForLesson('italian-evans');
      expect(italianCards).toHaveLength(4);
      for (const card of italianCards) {
        expect(card.reps).toBe(3);
        expect(card.lapses).toBe(1); // grade 2 after reaching Review
        expect(card.state).toBe(State.Relearning);
        expect(card.last_review).toBe(t3);
        expect(card.due).toBe(t3 + 10 * MINUTE);
        const log = await db.revlog.where('cardId').equals(card.id).sortBy('review');
        expect(log.map((l) => l.review)).toEqual([t1, t2, t3]);
        expect(log.map((l) => l.rating)).toEqual([Rating.Easy, Rating.Good, Rating.Again]);
        expect(log.map((l) => l.hintLevel)).toEqual([0, 0, 3]);
        expect(log.every((l) => l.lessonId === 'italian-evans' && l.sessionId === 'legacy-migration')).toBe(true);
      }

      // scandi-drill: cards created, no history, still New and due now
      const scandiCards = await CardService.getCardsForLesson('scandi-drill');
      expect(scandiCards).toHaveLength(3); // e4 (shared with italian), exd5, Nc3
      for (const san of ['exd5', 'Nc3']) {
        const fresh = scandiCards.find((c) => c.accepted.includes(san))!;
        expect(fresh.state).toBe(State.New);
        expect(fresh.reps).toBe(0);
        expect(fresh.due).toBe(NOW);
      }

      // the start position is shared: it was reviewed by the italian replay and
      // the scandi pass must not replay anything into it
      const start = scandiCards.find((c) => c.accepted.includes('e4'))!;
      expect(start.lessonIds).toEqual(['italian-evans', 'scandi-drill']);
      expect(start.reps).toBe(3);

      // caro-kann had no legacy row, so no cards were created for it
      expect(await CardService.getCardsForLesson('caro-kann')).toEqual([]);
      expect(await db.cards.count()).toBe(6); // 4 italian + exd5 + Nc3

      // legacy rows are left in place; the completion flag is set
      expect(await db.srs_cards.count()).toBe(3);
      expect(globalThis.localStorage.getItem(CARDS_MIGRATED_KEY)).toBe(String(NOW));
    });

    it('runs only once', async () => {
      await db.srs_cards.put(legacyRow('italian-evans'));
      globalThis.localStorage.setItem(
        LEGACY_SRS_STORAGE_KEY,
        JSON.stringify([{ cardId: 'italian-evans', history: [{ timestamp: NOW - DAY, grade: 4, mistakeCount: 0, usedHint: false }] }])
      );
      const first = await CardService.migrateLegacy(specsByLesson, NOW);
      expect(first.migrated).toBe(1);
      const revlogCount = await db.revlog.count();
      expect(revlogCount).toBe(4);

      const second = await CardService.migrateLegacy(specsByLesson, NOW + DAY);
      expect(second.migrated).toBe(0);
      expect(await db.revlog.count()).toBe(revlogCount);
      expect(await db.cards.count()).toBe(4);
    });

    it('tolerates a corrupt localStorage mirror and a missing one', async () => {
      await db.srs_cards.put(legacyRow('scandi-drill'));
      globalThis.localStorage.setItem(LEGACY_SRS_STORAGE_KEY, '{not json');
      const result = await CardService.migrateLegacy(specsByLesson, NOW);
      expect(result.migrated).toBe(1);
      const cards = await CardService.getCardsForLesson('scandi-drill');
      expect(cards).toHaveLength(3);
      expect(cards.every((c) => c.state === State.New)).toBe(true);
      expect(await db.revlog.count()).toBe(0);
    });

    it('does nothing when there are no legacy rows but still marks completion', async () => {
      const result = await CardService.migrateLegacy(specsByLesson, NOW);
      expect(result.migrated).toBe(0);
      expect(await db.cards.count()).toBe(0);
      expect(globalThis.localStorage.getItem(CARDS_MIGRATED_KEY)).toBe(String(NOW));
    });

    it('works without localStorage (SSR or restricted storage)', async () => {
      Reflect.deleteProperty(globalThis, 'localStorage');
      await db.srs_cards.put(legacyRow('scandi-drill'));
      const result = await CardService.migrateLegacy(specsByLesson, NOW);
      expect(result.migrated).toBe(1);
      expect(await db.cards.count()).toBe(3);
    });
  });

  describe('resetAll', () => {
    it('clears cards, revlog and the migration flag', async () => {
      const [card] = await CardService.ensureCards([italian[0]], NOW);
      await CardService.review(card.id, 'good', { now: NOW });
      globalThis.localStorage.setItem(CARDS_MIGRATED_KEY, '1');
      await CardService.resetAll();
      expect(await db.cards.count()).toBe(0);
      expect(await db.revlog.count()).toBe(0);
      expect(globalThis.localStorage.getItem(CARDS_MIGRATED_KEY)).toBeNull();
    });
  });
});
