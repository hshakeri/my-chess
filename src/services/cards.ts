import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  State,
  type Card,
  type Grade,
} from 'ts-fsrs';
import { db } from '../db/database';
import type { StoredCard, StoredRevlog } from '../types/db';
import { canonicalFenKey } from './fenKey';

/**
 * Input describing one student decision in a lesson. Structurally identical to
 * `DecisionSpec` exported by `src/curriculum/builder.ts` (module B); declared
 * here so the card layer has no import from the curriculum layer.
 */
export interface DecisionSpec {
  fen: string;
  acceptedSan: string[];
  lessonId: string;
  ply: number;
  color: 'w' | 'b';
  path: string[];
  tags: string[];
  title?: string;
  reachProb?: number;
}

export type CardRating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewContext {
  now?: number;
  responseMs?: number;
  hintLevel?: number;
  wrongSan?: string;
  lessonId?: string;
  sessionId?: string;
}

export interface RunObservation {
  wrongFirstTry: boolean;
  hintLevel: number;
  responseMs: number;
  meanMs: number;
  state: number;
  retrievability: number;
  reps: number;
}

/** Scheduler parameters fixed by the pedagogy audit (CL-1). */
export const CARD_PARAMETERS = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
});

/** localStorage flag set once the legacy SM-2 cards have been migrated. */
export const CARDS_MIGRATED_KEY = 'my_chess_cards_migrated_v2';

/**
 * localStorage mirror written by the legacy service (`services/srs.ts`,
 * `SRS_STORAGE_KEY`). Declared here rather than imported so this module does
 * not depend on the legacy code that the integration step replaces.
 */
export const LEGACY_SRS_STORAGE_KEY = 'my_chess_srs_state_v1';

/** Slow-answer threshold: never below 12 s, else 2.5 times the card's mean. */
export const SLOW_RESPONSE_FLOOR_MS = 12000;
export const SLOW_RESPONSE_FACTOR = 2.5;
export const EASY_MAX_RESPONSE_MS = 3000;
export const EASY_MIN_RETRIEVABILITY = 0.95;
export const EASY_MIN_REPS = 3;

const RATING_TO_GRADE: Record<CardRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

/** Legacy SM-2 grade (0-5) to FSRS rating: 0-2 again, 3 hard, 4 good, 5 easy. */
export function legacyGradeToRating(grade: number): CardRating {
  const g = Math.round(grade);
  if (g <= 2) return 'again';
  if (g === 3) return 'hard';
  if (g === 4) return 'good';
  return 'easy';
}

const scheduler = fsrs(CARD_PARAMETERS);

interface LegacyHistoryItem {
  timestamp: number;
  grade: number;
  mistakeCount?: number;
  usedHint?: boolean;
  hintLevel?: number;
}

interface LegacyLocalCard {
  cardId: string;
  history?: LegacyHistoryItem[];
}

function safeStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    const candidate = (globalThis as Record<string, unknown>)[kind] as Storage | undefined;
    if (candidate && typeof candidate.getItem === 'function') return candidate;
  } catch {
    // Access to storage can throw in private browsing or sandboxed frames.
  }
  return null;
}

function toFsrsCard(stored: StoredCard): Card {
  return {
    due: new Date(stored.due),
    stability: stored.stability,
    difficulty: stored.difficulty,
    elapsed_days: stored.elapsed_days,
    scheduled_days: stored.scheduled_days,
    learning_steps: stored.learning_steps ?? 0,
    reps: stored.reps,
    lapses: stored.lapses,
    state: stored.state as State,
    last_review: stored.last_review !== undefined ? new Date(stored.last_review) : undefined,
  };
}

function withFsrsCard(stored: StoredCard, card: Card): StoredCard {
  const next: StoredCard = {
    ...stored,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
  };
  if (card.last_review) {
    next.last_review = card.last_review.getTime();
  } else {
    delete next.last_review;
  }
  return next;
}

function unionInOrder(...lists: Array<readonly string[] | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const item of list) {
      if (!seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
  }
  return out;
}

function clampProb(p: number | undefined): number {
  if (typeof p !== 'number' || !Number.isFinite(p)) return 1;
  return Math.min(1, Math.max(0, p));
}

function newStoredCard(id: string, spec: DecisionSpec, now: number): StoredCard {
  const empty = createEmptyCard(new Date(now));
  const base: StoredCard = {
    id,
    fen: spec.fen,
    accepted: unionInOrder(spec.acceptedSan),
    lessonIds: unionInOrder([spec.lessonId]),
    tags: unionInOrder(spec.tags),
    ply: spec.ply,
    reachProb: clampProb(spec.reachProb),
    color: spec.color,
    due: 0,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: State.New,
    responseStats: { n: 0, meanMs: 0 },
    createdAt: now,
  };
  if (spec.title) base.title = spec.title;
  return withFsrsCard(base, empty);
}

/**
 * Merge a decision spec into an existing card. Only the descriptive fields
 * (accepted moves, lesson ids, tags, reach probability, title) change; the
 * scheduling fields are never touched.
 */
function mergeSpec(card: StoredCard, spec: DecisionSpec): StoredCard {
  const merged: StoredCard = {
    ...card,
    accepted: unionInOrder(card.accepted, spec.acceptedSan),
    lessonIds: unionInOrder(card.lessonIds, [spec.lessonId]),
    tags: unionInOrder(card.tags, spec.tags),
    reachProb: Math.max(clampProb(card.reachProb), clampProb(spec.reachProb)),
  };
  if (!merged.title && spec.title) merged.title = spec.title;
  return merged;
}

function sameDescriptor(a: StoredCard, b: StoredCard): boolean {
  return (
    a.title === b.title &&
    a.reachProb === b.reachProb &&
    a.accepted.join('\u0000') === b.accepted.join('\u0000') &&
    a.lessonIds.join('\u0000') === b.lessonIds.join('\u0000') &&
    a.tags.join('\u0000') === b.tags.join('\u0000')
  );
}

/**
 * Position-level FSRS card store (CL-1). All state lives in IndexedDB through
 * the shared Dexie instance; localStorage is touched only for the one-shot
 * migration flag.
 */
export class CardService {
  /**
   * Create one New card per unique canonical FEN key and merge descriptive
   * fields into cards that already exist. Returns the affected cards in order
   * of first appearance.
   */
  public static async ensureCards(specs: DecisionSpec[], now: number = Date.now()): Promise<StoredCard[]> {
    if (!specs || specs.length === 0) return [];

    const order: string[] = [];
    const byKey = new Map<string, DecisionSpec[]>();
    for (const spec of specs) {
      const key = canonicalFenKey(spec.fen);
      if (!byKey.has(key)) {
        byKey.set(key, []);
        order.push(key);
      }
      byKey.get(key)!.push(spec);
    }

    return db.transaction('rw', db.cards, async () => {
      const existing = await db.cards.bulkGet(order);
      const toWrite: StoredCard[] = [];
      const result: StoredCard[] = [];

      order.forEach((key, i) => {
        const group = byKey.get(key)!;
        const current = existing[i];
        let card = current ?? newStoredCard(key, group[0], now);
        for (const spec of group) {
          card = mergeSpec(card, spec);
        }
        if (!current || !sameDescriptor(current, card)) {
          toWrite.push(card);
        }
        result.push(card);
      });

      if (toWrite.length > 0) {
        await db.cards.bulkPut(toWrite);
      }
      return result;
    });
  }

  public static async getCard(id: string): Promise<StoredCard | undefined> {
    return db.cards.get(id);
  }

  public static async getAllCards(): Promise<StoredCard[]> {
    return db.cards.toArray();
  }

  /** Cards whose `due` is at or before `now`, earliest first. */
  public static async getDueCards(now: number = Date.now()): Promise<StoredCard[]> {
    return db.cards.where('due').belowOrEqual(now).sortBy('due');
  }

  public static async getCardsForLesson(lessonId: string): Promise<StoredCard[]> {
    return db.cards.where('lessonIds').equals(lessonId).toArray();
  }

  /**
   * Apply one rating to a card through ts-fsrs, append a revlog row and fold
   * the response time into the card's running mean.
   */
  public static async review(cardId: string, rating: CardRating, ctx: ReviewContext = {}): Promise<StoredCard> {
    const now = ctx.now ?? Date.now();
    const grade = RATING_TO_GRADE[rating];
    if (grade === undefined) {
      throw new Error(`CardService.review: unknown rating "${String(rating)}"`);
    }

    return db.transaction('rw', db.cards, db.revlog, async () => {
      const stored = await db.cards.get(cardId);
      if (!stored) {
        throw new Error(`CardService.review: no card with id "${cardId}"`);
      }

      const { card, log } = scheduler.next(toFsrsCard(stored), new Date(now), grade);

      let responseStats = stored.responseStats ?? { n: 0, meanMs: 0 };
      if (typeof ctx.responseMs === 'number' && Number.isFinite(ctx.responseMs) && ctx.responseMs >= 0) {
        const n = responseStats.n + 1;
        const meanMs = responseStats.meanMs + (ctx.responseMs - responseStats.meanMs) / n;
        responseStats = { n, meanMs };
      }

      const updated: StoredCard = { ...withFsrsCard(stored, card), responseStats };

      const row: StoredRevlog = {
        cardId,
        rating: log.rating,
        state: log.state,
        due: log.due.getTime(),
        stability: log.stability,
        difficulty: log.difficulty,
        elapsed_days: log.elapsed_days,
        last_elapsed_days: log.last_elapsed_days,
        scheduled_days: log.scheduled_days,
        learning_steps: log.learning_steps,
        review: log.review.getTime(),
      };
      if (ctx.responseMs !== undefined) row.responseMs = ctx.responseMs;
      if (ctx.hintLevel !== undefined) row.hintLevel = ctx.hintLevel;
      if (ctx.wrongSan !== undefined) row.wrongSan = ctx.wrongSan;
      if (ctx.lessonId !== undefined) row.lessonId = ctx.lessonId;
      if (ctx.sessionId !== undefined) row.sessionId = ctx.sessionId;

      await db.cards.put(updated);
      await db.revlog.add(row);
      return updated;
    });
  }

  /**
   * Grade inference from what happened during the run (pedagogy audit CL-1):
   * a wrong first try or a move-revealing hint (level 3) is Again; a plan hint
   * (level 1-2) or a slow answer is Hard; otherwise Good; Easy only for a
   * Review-state card recalled fast with high retrievability and some history.
   */
  public static inferRating(run: RunObservation): CardRating {
    const hintLevel = Math.max(0, Math.floor(run.hintLevel || 0));
    if (run.wrongFirstTry || hintLevel >= 3) return 'again';
    if (hintLevel >= 1) return 'hard';

    const meanMs = Number.isFinite(run.meanMs) && run.meanMs > 0 ? run.meanMs : 0;
    const slowThreshold = Math.max(SLOW_RESPONSE_FLOOR_MS, SLOW_RESPONSE_FACTOR * meanMs);
    if (run.responseMs > slowThreshold) return 'hard';

    if (
      run.state === State.Review &&
      run.retrievability > EASY_MIN_RETRIEVABILITY &&
      run.responseMs < EASY_MAX_RESPONSE_MS &&
      run.reps >= EASY_MIN_REPS
    ) {
      return 'easy';
    }
    return 'good';
  }

  /** Probability of recall at `now` per ts-fsrs (0 for a New card). */
  public static retrievability(card: StoredCard, now: number = Date.now()): number {
    return scheduler.get_retrievability(toFsrsCard(card), new Date(now), false);
  }

  /**
   * One-shot migration from the legacy lesson-level SM-2 store. For every
   * `srs_cards` row whose lesson id has decision specs, create the lesson's
   * cards and replay the lesson's localStorage review history (grade map
   * 0-2 again, 3 hard, 4 good, 5 easy, oldest first) through the scheduler
   * into every card of that lesson that has not been reviewed yet. Completion
   * is recorded under `CARDS_MIGRATED_KEY` so it runs once; the legacy rows
   * and the localStorage mirror are left in place for the legacy service.
   * `migrated` counts the legacy rows (lessons) whose decision cards were
   * created; rows whose lesson id has no specs are skipped and not counted.
   */
  public static async migrateLegacy(
    specsByLesson: Record<string, DecisionSpec[]>,
    now: number = Date.now()
  ): Promise<{ migrated: number }> {
    const storage = safeStorage('localStorage');
    if (storage && storage.getItem(CARDS_MIGRATED_KEY)) {
      return { migrated: 0 };
    }

    const historyByLesson = new Map<string, LegacyHistoryItem[]>();
    if (storage) {
      try {
        const raw = storage.getItem(LEGACY_SRS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as LegacyLocalCard[];
          if (Array.isArray(parsed)) {
            for (const legacy of parsed) {
              if (legacy && typeof legacy.cardId === 'string' && Array.isArray(legacy.history)) {
                const items = legacy.history
                  .filter((h) => h && Number.isFinite(h.timestamp) && Number.isFinite(h.grade))
                  .sort((a, b) => a.timestamp - b.timestamp);
                historyByLesson.set(legacy.cardId, items);
              }
            }
          }
        }
      } catch {
        // A corrupt mirror is ignored; the cards are still created as New.
      }
    }

    const legacyRows = await db.srs_cards.toArray();
    let migrated = 0;

    for (const row of legacyRows) {
      const specs = specsByLesson[row.id];
      if (!specs || specs.length === 0) continue;

      const cards = await CardService.ensureCards(specs, now);
      const history = historyByLesson.get(row.id) ?? [];

      for (const card of cards) {
        let current = await db.cards.get(card.id);
        if (!current || current.reps > 0) continue;
        for (const item of history) {
          current = await CardService.review(current.id, legacyGradeToRating(item.grade), {
            now: item.timestamp,
            hintLevel: item.hintLevel,
            lessonId: row.id,
            sessionId: 'legacy-migration',
          });
        }
      }
      migrated++;
    }

    if (storage) {
      try {
        storage.setItem(CARDS_MIGRATED_KEY, String(now));
      } catch {
        // Storage quota or privacy mode: the migration simply re-runs next time,
        // which is harmless because ensureCards is idempotent and reviewed
        // cards are skipped.
      }
    }

    return { migrated };
  }

  /** Clear cards, revlog and the migration flag (tests and user reset). */
  public static async resetAll(): Promise<void> {
    await db.transaction('rw', db.cards, db.revlog, async () => {
      await db.cards.clear();
      await db.revlog.clear();
    });
    const storage = safeStorage('localStorage');
    if (storage) {
      try {
        storage.removeItem(CARDS_MIGRATED_KEY);
      } catch {
        // Ignore
      }
    }
  }
}
