import { db } from '../db/database';
import { StoredSrsCard } from '../types/db';
import { SRSCardState, CurriculumLesson } from '../types/curriculum';
import { firstUserDecision } from '../curriculum/builder';

export const SRS_STORAGE_KEY = 'my_chess_srs_state_v1';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Infer an SM-2 grade (1, 3, 4 or 5) from what actually happened during a run:
 * no mistakes and no hints is a perfect recall; a single slip or a theme-only
 * hint is "Good"; needing the piece hint or two slips is "Hard"; the square hint
 * or three slips means the move was not recalled.
 */
export function suggestGrade(run: { mistakes: number; hintLevel: number }): 1 | 3 | 4 | 5 {
  const mistakes = Math.max(0, run.mistakes);
  const hint = Math.max(0, run.hintLevel);
  if (hint >= 3 || mistakes >= 3) return 1;
  if (hint === 2 || mistakes === 2) return 3;
  if (hint === 1 || mistakes === 1) return 4;
  return 5;
}

/**
 * Pure function: calculates the next SRS state using SM-2 & Leitner 5-box algorithm
 * @param card Current SRS card state
 * @param grade Grade 0-5 (0-2: Failure, 3: Hard pass, 4: Good pass, 5: Perfect)
 * @param now Optional timestamp (defaults to Date.now())
 */
export function calculateNextReview(
  card: SRSCardState,
  grade: number,
  now: number = Date.now(),
  performance?: { mistakeCount?: number; usedHint?: boolean; hintLevel?: number }
): SRSCardState {
  const clampedGrade = Math.max(0, Math.min(5, Math.round(grade)));
  let { box, repetitionCount, intervalDays, easeFactor, consecutiveMistakes } = card;

  // Ensure baseline defaults
  easeFactor = easeFactor || 2.5;

  if (clampedGrade < 3) {
    // Failure (Grade 0, 1, 2)
    // Demote to Leitner Box 1, reset repetitions to 0, interval to 1 day
    box = 1;
    repetitionCount = 0;
    intervalDays = 1;
    consecutiveMistakes = (consecutiveMistakes || 0) + 1;

    // SM-2 penalty on ease factor
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else {
    // Success (Grade 3, 4, 5)
    // Advance Leitner box and repetitions
    if (repetitionCount === 0) {
      intervalDays = 1;
      box = 1;
    } else if (repetitionCount === 1) {
      intervalDays = 3;
      box = 2;
    } else if (repetitionCount === 2) {
      intervalDays = 7;
      box = 3;
    } else if (repetitionCount === 3) {
      intervalDays = 14;
      box = 4;
    } else {
      intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
      box = 5;
    }

    repetitionCount += 1;
    consecutiveMistakes = 0;

    // Standard SuperMemo-2 Ease Factor formula:
    // EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    const delta = 0.1 - (5 - clampedGrade) * (0.08 + (5 - clampedGrade) * 0.02);
    easeFactor = Math.max(1.3, Number((easeFactor + delta).toFixed(4)));
  }

  const nextReviewTimestamp = now + intervalDays * MS_PER_DAY;

  const newHistoryItem = {
    timestamp: now,
    grade: clampedGrade,
    mistakeCount: performance?.mistakeCount ?? (clampedGrade < 3 ? 1 : 0),
    usedHint: performance?.usedHint ?? (performance?.hintLevel ?? 0) > 0,
    hintLevel: performance?.hintLevel ?? 0,
  };

  const history = card.history ? [...card.history, newHistoryItem] : [newHistoryItem];

  return {
    ...card,
    box,
    repetitionCount,
    intervalDays,
    easeFactor,
    lastReviewTimestamp: now,
    nextReviewTimestamp,
    consecutiveMistakes,
    history,
  };
}

/**
 * Creates an initial Box 1 card for a lesson. The card is keyed to the lesson's
 * first real decision (the position at its start ply), not to the start position.
 */
export function createInitialCard(
  lesson: CurriculumLesson,
  now: number = Date.now()
): SRSCardState {
  const decision = firstUserDecision(lesson);
  const expectedSan = decision ? decision.move.san : (lesson.moves[0]?.san || '');
  const fen = decision ? decision.fenBefore : lesson.initialFen;

  return {
    cardId: lesson.id,
    repertoireId: lesson.category,
    title: lesson.title,
    fen,
    expectedMoveSan: expectedSan,
    box: 1,
    repetitionCount: 0,
    intervalDays: 1,
    easeFactor: 2.5,
    lastReviewTimestamp: 0,
    nextReviewTimestamp: now, // Due immediately
    consecutiveMistakes: 0,
    history: [],
  };
}

/**
 * Maps an SRSCardState to StoredSrsCard format for Dexie table
 */
export function toStoredSrsCard(card: SRSCardState): StoredSrsCard {
  return {
    id: card.cardId,
    repertoireId: card.repertoireId,
    fen: card.fen,
    expectedMoveSan: card.expectedMoveSan,
    dueDate: card.nextReviewTimestamp,
    interval: card.intervalDays,
    easeFactor: card.easeFactor,
    repetitions: card.repetitionCount,
    box: card.box,
    lastReviewed: card.lastReviewTimestamp,
  };
}

/**
 * Maps a StoredSrsCard to SRSCardState format
 */
export function fromStoredSrsCard(stored: StoredSrsCard, title?: string): SRSCardState {
  return {
    cardId: stored.id,
    repertoireId: stored.repertoireId,
    title: title || stored.id,
    fen: stored.fen,
    expectedMoveSan: stored.expectedMoveSan,
    box: stored.box || 1,
    repetitionCount: stored.repetitions || 0,
    intervalDays: stored.interval || 1,
    easeFactor: stored.easeFactor || 2.5,
    lastReviewTimestamp: stored.lastReviewed || 0,
    nextReviewTimestamp: stored.dueDate || Date.now(),
    consecutiveMistakes: 0,
    history: [],
  };
}

// In-memory fallback cache for SSR or environments where both IndexedDB and localStorage are restricted
const memoryFallbackMap = new Map<string, SRSCardState>();

/**
 * Reads all cards from LocalStorage fallback
 */
function readLocalStorage(): Map<string, SRSCardState> {
  const map = new Map<string, SRSCardState>();
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryFallbackMap;
  }
  try {
    const raw = window.localStorage.getItem(SRS_STORAGE_KEY);
    if (raw) {
      const parsed: SRSCardState[] = JSON.parse(raw);
      parsed.forEach((c) => map.set(c.cardId, c));
    }
  } catch (err) {
    console.warn('[SRS Service] Error reading LocalStorage fallback:', err);
  }
  return map;
}

/**
 * Writes all cards to LocalStorage fallback
 */
function writeLocalStorage(map: Map<string, SRSCardState>): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    map.forEach((v, k) => memoryFallbackMap.set(k, v));
    return;
  }
  try {
    const array = Array.from(map.values());
    window.localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(array));
  } catch (err) {
    console.warn('[SRS Service] Error writing LocalStorage fallback:', err);
  }
}

/**
 * Spaced Repetition Service
 * Persists to IndexedDB (`db.srs_cards`) with LocalStorage fallback.
 */
export class SrsService {
  /**
   * Save or update an SRS card
   */
  public static async saveCard(card: SRSCardState): Promise<void> {
    // 1. Update memory / LocalStorage fallback
    const localMap = readLocalStorage();
    localMap.set(card.cardId, card);
    writeLocalStorage(localMap);

    // 2. Persist to Dexie table if available
    try {
      if (db && db.srs_cards) {
        const stored = toStoredSrsCard(card);
        await db.srs_cards.put(stored);
      }
    } catch (err) {
      // In non-browser / node test environments, IndexedDB might be mocked or unavailable
      // LocalStorage already recorded the state
    }
  }

  /**
   * Get an SRS card by cardId
   */
  public static async getCard(cardId: string): Promise<SRSCardState | undefined> {
    // 1. Try Dexie table
    try {
      if (db && db.srs_cards) {
        const stored = await db.srs_cards.get(cardId);
        if (stored) {
          const localMap = readLocalStorage();
          const local = localMap.get(cardId);
          return {
            ...fromStoredSrsCard(stored, local?.title),
            title: local?.title || stored.id,
            history: local?.history || [],
            consecutiveMistakes: local?.consecutiveMistakes || 0,
          };
        }
      }
    } catch (err) {
      // Fallback
    }

    // 2. Fallback to LocalStorage
    const localMap = readLocalStorage();
    return localMap.get(cardId);
  }

  /**
   * Get all SRS cards
   */
  public static async getAllCards(): Promise<SRSCardState[]> {
    const localMap = readLocalStorage();

    try {
      if (db && db.srs_cards) {
        const storedList = await db.srs_cards.toArray();
        if (storedList.length > 0) {
          return storedList.map((stored) => {
            const local = localMap.get(stored.id);
            return {
              ...fromStoredSrsCard(stored, local?.title),
              title: local?.title || stored.id,
              history: local?.history || [],
              consecutiveMistakes: local?.consecutiveMistakes || 0,
            };
          });
        }
      }
    } catch (err) {
      // Fallback
    }

    return Array.from(localMap.values());
  }

  /**
   * Get cards due for review as of `referenceTime` (defaults to Date.now())
   */
  public static async getDueCards(referenceTime: number = Date.now()): Promise<SRSCardState[]> {
    const all = await this.getAllCards();
    return all
      .filter((card) => card.nextReviewTimestamp <= referenceTime)
      .sort((a, b) => a.nextReviewTimestamp - b.nextReviewTimestamp);
  }

  /**
   * Record a review response (grade 0-5)
   */
  public static async recordReview(
    cardId: string,
    grade: number,
    options?: { moveSan?: string; usedHint?: boolean; hintLevel?: number; mistakeCount?: number; now?: number }
  ): Promise<SRSCardState> {
    let card = await this.getCard(cardId);
    const now = options?.now || Date.now();

    if (!card) {
      card = {
        cardId,
        repertoireId: 'general',
        title: cardId,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        expectedMoveSan: options?.moveSan || '',
        box: 1,
        repetitionCount: 0,
        intervalDays: 1,
        easeFactor: 2.5,
        lastReviewTimestamp: 0,
        nextReviewTimestamp: now,
        consecutiveMistakes: 0,
        history: [],
      };
    }

    const updated = calculateNextReview(card, grade, now, {
      mistakeCount: options?.mistakeCount,
      usedHint: options?.usedHint,
      hintLevel: options?.hintLevel,
    });

    await this.saveCard(updated);
    return updated;
  }

  /**
   * Seed cards for curriculum lessons if they do not yet exist
   */
  public static async initializeCardsForLessons(
    lessons: CurriculumLesson[],
    now: number = Date.now()
  ): Promise<SRSCardState[]> {
    const existing = await this.getAllCards();
    const existingIds = new Set(existing.map((c) => c.cardId));

    const created: SRSCardState[] = [];
    for (const lesson of lessons) {
      if (!existingIds.has(lesson.id)) {
        const initial = createInitialCard(lesson, now);
        await this.saveCard(initial);
        created.push(initial);
      }
    }

    return await this.getAllCards();
  }

  /**
   * Calculate box breakdown and review statistics
   */
  public static async getBoxStats(now: number = Date.now()): Promise<{
    box1: number;
    box2: number;
    box3: number;
    box4: number;
    box5: number;
    total: number;
    dueToday: number;
  }> {
    const cards = await this.getAllCards();
    let box1 = 0, box2 = 0, box3 = 0, box4 = 0, box5 = 0, dueToday = 0;

    for (const c of cards) {
      if (c.box === 1) box1++;
      else if (c.box === 2) box2++;
      else if (c.box === 3) box3++;
      else if (c.box === 4) box4++;
      else box5++;

      if (c.nextReviewTimestamp <= now) {
        dueToday++;
      }
    }

    return {
      box1,
      box2,
      box3,
      box4,
      box5,
      total: cards.length,
      dueToday,
    };
  }

  /**
   * Clear all cards (useful for tests or user reset)
   */
  public static async resetAllCards(): Promise<void> {
    memoryFallbackMap.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(SRS_STORAGE_KEY);
      } catch (e) {
        // Ignore
      }
    }

    try {
      if (db && db.srs_cards) {
        await db.srs_cards.clear();
      }
    } catch (e) {
      // Ignore
    }
  }
}
