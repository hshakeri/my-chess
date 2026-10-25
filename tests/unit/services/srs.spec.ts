import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateNextReview,
  createInitialCard,
  suggestGrade,
  SrsService,
  toStoredSrsCard,
  fromStoredSrsCard,
} from '../../../src/services/srs';
import { scotchGambitBreakthrough } from '../../../src/curriculum/openings';
import { scandinavianRefutationDrill } from '../../../src/curriculum/drills';

describe('Spaced Repetition Service (SM-2 & Leitner 5-Box)', () => {
  beforeEach(async () => {
    await SrsService.resetAllCards();
  });

  describe('Pure Algorithm (calculateNextReview)', () => {
    it('should initialize a fresh card correctly', () => {
      const card = createInitialCard(scotchGambitBreakthrough, 1000000);
      expect(card.box).toBe(1);
      expect(card.repetitionCount).toBe(0);
      expect(card.intervalDays).toBe(1);
      expect(card.easeFactor).toBe(2.5);
      expect(card.nextReviewTimestamp).toBe(1000000);
      expect(card.expectedMoveSan).toBe('e4');
    });

    it('keys a drill card to its first real decision, not the start position', () => {
      const card = createInitialCard(scandinavianRefutationDrill, 1000000);
      expect(card.expectedMoveSan).toBe('exd5');
      expect(card.fen).toBe('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    });

    it('infers the grade from what happened in the run (downgrade-only suggestion)', () => {
      expect(suggestGrade({ mistakes: 0, hintLevel: 0 })).toBe(5);
      expect(suggestGrade({ mistakes: 1, hintLevel: 0 })).toBe(4);
      expect(suggestGrade({ mistakes: 0, hintLevel: 1 })).toBe(4);
      expect(suggestGrade({ mistakes: 2, hintLevel: 0 })).toBe(3);
      expect(suggestGrade({ mistakes: 0, hintLevel: 2 })).toBe(3);
      expect(suggestGrade({ mistakes: 3, hintLevel: 0 })).toBe(1);
      expect(suggestGrade({ mistakes: 0, hintLevel: 3 })).toBe(1);
    });

    it('records mistakes and hint usage in the review history', () => {
      const card = createInitialCard(scotchGambitBreakthrough, 1000000);
      const reviewed = calculateNextReview(card, 3, 1000000, { mistakeCount: 2, hintLevel: 2 });
      expect(reviewed.history?.[0]).toMatchObject({ grade: 3, mistakeCount: 2, usedHint: true, hintLevel: 2 });
      const clean = calculateNextReview(card, 5, 1000000, { mistakeCount: 0, hintLevel: 0 });
      expect(clean.history?.[0]).toMatchObject({ grade: 5, mistakeCount: 0, usedHint: false, hintLevel: 0 });
    });

    it('should advance repetition and box smoothly on consecutive perfect grades (5)', () => {
      let card = createInitialCard(scotchGambitBreakthrough, 1000000);
      const now = 1000000;

      // Review 1: Grade 5
      card = calculateNextReview(card, 5, now);
      expect(card.box).toBe(1);
      expect(card.repetitionCount).toBe(1);
      expect(card.intervalDays).toBe(1);
      expect(card.easeFactor).toBeCloseTo(2.6, 2);
      expect(card.nextReviewTimestamp).toBe(now + 1 * 24 * 60 * 60 * 1000);

      // Review 2: Grade 5 -> Advances to Box 2, interval 3 days
      card = calculateNextReview(card, 5, now);
      expect(card.box).toBe(2);
      expect(card.repetitionCount).toBe(2);
      expect(card.intervalDays).toBe(3);
      expect(card.easeFactor).toBeCloseTo(2.7, 2);

      // Review 3: Grade 5 -> Advances to Box 3, interval 7 days
      card = calculateNextReview(card, 5, now);
      expect(card.box).toBe(3);
      expect(card.repetitionCount).toBe(3);
      expect(card.intervalDays).toBe(7);

      // Review 4: Grade 5 -> Advances to Box 4, interval 14 days
      card = calculateNextReview(card, 5, now);
      expect(card.box).toBe(4);
      expect(card.repetitionCount).toBe(4);
      expect(card.intervalDays).toBe(14);

      // Review 5: Grade 5 -> Advances to Box 5, interval = 14 * EF (~39-40 days)
      card = calculateNextReview(card, 5, now);
      expect(card.box).toBe(5);
      expect(card.repetitionCount).toBe(5);
      expect(card.intervalDays).toBeGreaterThan(30);
    });

    it('should demote card to Box 1 and reset interval to 1 on failure (grade < 3)', () => {
      let card = createInitialCard(scotchGambitBreakthrough, 1000000);
      // Advance to Box 4
      card = calculateNextReview(card, 5, 1000000);
      card = calculateNextReview(card, 5, 1000000);
      card = calculateNextReview(card, 5, 1000000);
      card = calculateNextReview(card, 5, 1000000);
      expect(card.box).toBe(4);
      expect(card.repetitionCount).toBe(4);

      // Fail review: Grade 1
      const failedCard = calculateNextReview(card, 1, 2000000);
      expect(failedCard.box).toBe(1);
      expect(failedCard.repetitionCount).toBe(0);
      expect(failedCard.intervalDays).toBe(1);
      expect(failedCard.consecutiveMistakes).toBe(1);
      expect(failedCard.easeFactor).toBeLessThan(card.easeFactor);
    });

    it('should never reduce easeFactor below minimum 1.3', () => {
      let card = createInitialCard(scotchGambitBreakthrough, 1000000);
      card.easeFactor = 1.35;

      // Repeated failures
      card = calculateNextReview(card, 0, 1000000);
      expect(card.easeFactor).toBe(1.3);

      card = calculateNextReview(card, 0, 1000000);
      expect(card.easeFactor).toBe(1.3);
    });
  });

  describe('Service Persistence & Queries', () => {
    it('should initialize cards for lessons and prevent duplicate entries', async () => {
      const lessons = [scotchGambitBreakthrough, scandinavianRefutationDrill];
      const initialized = await SrsService.initializeCardsForLessons(lessons);

      expect(initialized.length).toBe(2);

      // Attempting second initialization should not duplicate
      const secondCall = await SrsService.initializeCardsForLessons(lessons);
      expect(secondCall.length).toBe(2);
    });

    it('should record review updates and persist card state', async () => {
      const now = 1000000000;
      await SrsService.recordReview('test-card-1', 5, { now, moveSan: 'e4', mistakeCount: 1, hintLevel: 1 });

      const fetched = await SrsService.getCard('test-card-1');
      expect(fetched).toBeDefined();
      expect(fetched?.cardId).toBe('test-card-1');
      expect(fetched?.repetitionCount).toBe(1);
      expect(fetched?.lastReviewTimestamp).toBe(now);
      expect(fetched?.history?.length).toBe(1);
      expect(fetched?.history?.[0].grade).toBe(5);
      expect(fetched?.history?.[0].mistakeCount).toBe(1);
      expect(fetched?.history?.[0].usedHint).toBe(true);
    });

    it('should filter due cards accurately by timestamp', async () => {
      const baseTime = 1000000000;
      const oneDayMs = 24 * 60 * 60 * 1000;

      // Card 1: Due at baseTime (interval 1 day, next = baseTime + 1d)
      await SrsService.recordReview('card-1', 4, { now: baseTime });
      // Card 2: Due at baseTime + 5 days
      await SrsService.recordReview('card-2', 5, { now: baseTime + 5 * oneDayMs });

      // Check immediately at baseTime: neither is due yet (since review just happened and pushed to next day)
      const dueImmediately = await SrsService.getDueCards(baseTime);
      expect(dueImmediately.length).toBe(0);

      // Check at baseTime + 2 days: card-1 is due!
      const dueAtTwoDays = await SrsService.getDueCards(baseTime + 2 * oneDayMs);
      expect(dueAtTwoDays.length).toBe(1);
      expect(dueAtTwoDays[0].cardId).toBe('card-1');

      // Check at baseTime + 10 days: both are due!
      const dueAtTenDays = await SrsService.getDueCards(baseTime + 10 * oneDayMs);
      expect(dueAtTenDays.length).toBe(2);
    });

    it('should calculate box statistics correctly', async () => {
      const now = 1000000000;
      await SrsService.recordReview('card-box-1', 1, { now }); // box 1
      await SrsService.recordReview('card-box-2a', 5, { now });
      await SrsService.recordReview('card-box-2a', 5, { now }); // box 2

      const stats = await SrsService.getBoxStats(now + 10 * 24 * 60 * 60 * 1000);
      expect(stats.total).toBe(2);
      expect(stats.box1).toBe(1);
      expect(stats.box2).toBe(1);
      expect(stats.dueToday).toBe(2);
    });

    it('should round-trip between StoredSrsCard and SRSCardState', () => {
      const original = createInitialCard(scotchGambitBreakthrough, 12345);
      original.box = 3;
      original.intervalDays = 7;
      original.repetitionCount = 3;

      const stored = toStoredSrsCard(original);
      expect(stored.id).toBe(original.cardId);
      expect(stored.box).toBe(3);
      expect(stored.interval).toBe(7);

      const reconstructed = fromStoredSrsCard(stored, original.title);
      expect(reconstructed.cardId).toBe(original.cardId);
      expect(reconstructed.box).toBe(3);
      expect(reconstructed.intervalDays).toBe(7);
      expect(reconstructed.title).toBe(original.title);
    });
  });
});
