import { CardService } from '../services/cards';
import { patternPath } from '../curriculum/patternPath';
import type { StoredCard, StoredRevlog } from '../types/db';

/**
 * Progress from the review cards (DC-8): the cards by FSRS state, how much of what has been reviewed
 * would be recalled today, the positions most likely to cost a game (how often the position comes up
 * times the chance of having forgotten it), the wrong moves played most often instead of an answer,
 * and the reviews falling due over the next two weeks.
 */

export const STATE_LABEL = ['New', 'Learning', 'Review', 'Relearning'] as const;

export interface RiskRow {
  card: StoredCard;
  /** Probability of recall now. */
  recall: number;
  /** reachProb x (1 - recall). */
  risk: number;
}

export interface ConfusionRow {
  card: StoredCard;
  wrong: string;
  count: number;
}

/** A card counts as mastered once FSRS expects it to last a week (stability of 7 days or more). */
export const MASTERY_DAYS = 7;

export interface GroupMastery {
  groupId: string;
  title: string;
  /** Cards of the group's lessons, those reviewed at least once, and those mastered. */
  cards: number;
  reviewed: number;
  mastered: number;
  /** Mean recall now of the reviewed cards; null when none is reviewed. */
  recall: number | null;
}

export interface ProgressSummary {
  total: number;
  byState: Array<{ state: number; label: string; count: number }>;
  /** Cards reviewed at least once. */
  reviewed: number;
  /** Mean probability of recall now over the reviewed cards; null when none is reviewed. */
  meanRecall: number | null;
  riskiest: RiskRow[];
  confusions: ConfusionRow[];
  /** Reviewed cards falling due on each of the next days (day 0 is today and counts the overdue ones). */
  dueByDay: number[];
  /** Mastery by study-path group, in path order (DC-1's skill tree, as a table). */
  byGroup: GroupMastery[];
}

const DAY_MS = 86_400_000;

export function summarizeProgress(cards: StoredCard[], revlog: StoredRevlog[], now = Date.now(), days = 14): ProgressSummary {
  const reviewedCards = cards.filter((c) => c.state !== 0);
  const recall = new Map(reviewedCards.map((c) => [c.id, CardService.retrievability(c, now)]));

  const riskiest = reviewedCards
    .map((card) => {
      const r = recall.get(card.id) ?? 0;
      return { card, recall: r, risk: (card.reachProb ?? 1) * (1 - r) };
    })
    .filter((row) => row.risk > 0)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 10);

  const byId = new Map(cards.map((c) => [c.id, c]));
  const confusionCount = new Map<string, ConfusionRow>();
  for (const log of revlog) {
    const card = byId.get(log.cardId);
    if (!card || !log.wrongSan || card.accepted.includes(log.wrongSan)) continue;
    const key = `${log.cardId}|${log.wrongSan}`;
    const row = confusionCount.get(key) ?? { card, wrong: log.wrongSan, count: 0 };
    row.count++;
    confusionCount.set(key, row);
  }

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dueByDay = Array.from({ length: days }, () => 0);
  for (const card of reviewedCards) {
    const day = Math.max(0, Math.floor((card.due - startOfToday.getTime()) / DAY_MS));
    if (day < days) dueByDay[day]++;
  }

  return {
    total: cards.length,
    byState: STATE_LABEL.map((label, state) => ({ state, label, count: cards.filter((c) => c.state === state).length })),
    reviewed: reviewedCards.length,
    meanRecall: reviewedCards.length ? [...recall.values()].reduce((a, b) => a + b, 0) / reviewedCards.length : null,
    riskiest,
    confusions: [...confusionCount.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    dueByDay,
    byGroup: patternPath.map((g) => {
      const own = cards.filter((c) => c.lessonIds.some((id) => g.lessonIds.includes(id)));
      const seen = own.filter((c) => c.state !== 0);
      return {
        groupId: g.id,
        title: g.title,
        cards: own.length,
        reviewed: seen.length,
        mastered: seen.filter((c) => c.state === 2 && c.stability >= MASTERY_DAYS).length,
        recall: seen.length ? seen.reduce((sum, c) => sum + (recall.get(c.id) ?? 0), 0) / seen.length : null,
      };
    }),
  };
}
