// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { summarizeProgress } from '../../../src/analytics/progress';
import { ProgressSummaryView } from '../../../src/views/ProgressPanel';
import { patternPath } from '../../../src/curriculum/patternPath';
import type { StoredCard, StoredRevlog } from '../../../src/types/db';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 1, 12);
const FEN = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';

function card(id: string, extra: Partial<StoredCard>): StoredCard {
  return {
    id,
    fen: FEN,
    accepted: ['exd5'],
    lessonIds: ['lesson-scandinavian-refutation-drill'],
    tags: [],
    ply: 2,
    reachProb: 1,
    color: 'w',
    due: NOW,
    stability: 0,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    responseStats: { n: 0, meanMs: 0 },
    createdAt: NOW - 30 * DAY,
    ...extra,
  };
}

// A Review card last seen as many days ago as its stability: FSRS puts its recall at 90%
const reviewed = (id: string, reachProb: number, dueInDays: number) =>
  card(id, { state: 2, stability: 10, reps: 3, last_review: NOW - 10 * DAY, due: NOW + dueInDays * DAY, reachProb });

describe('Progress from the review cards (DC-8)', () => {
  afterEach(() => cleanup());

  it('counts the cards by state, the recall of the reviewed ones and the reviews due by day', () => {
    const cards = [card('new', {}), reviewed('a', 1, -2), reviewed('b', 0.25, 3), card('learning', { state: 1, stability: 1, reps: 1, last_review: NOW - 3600_000, due: NOW + 600_000 })];
    const s = summarizeProgress(cards, [], NOW);
    expect(s.total).toBe(4);
    expect(s.byState.map((r) => [r.label, r.count])).toEqual([
      ['New', 1],
      ['Learning', 1],
      ['Review', 2],
      ['Relearning', 0],
    ]);
    expect(s.reviewed).toBe(3);
    // Overdue counts today; the learning card is due later today
    expect(s.dueByDay[0]).toBe(2);
    expect(s.dueByDay[3]).toBe(1);
    expect(s.dueByDay.reduce((a, b) => a + b, 0)).toBe(3);
    // The two Review cards are at 90%: the main-line one (reached every time) is the bigger risk
    const [first, second] = s.riskiest.filter((r) => r.card.state === 2);
    expect(first.card.id).toBe('a');
    expect(first.recall).toBeCloseTo(0.9, 2);
    expect(first.risk).toBeCloseTo(0.1, 2);
    expect(second.risk).toBeCloseTo(0.025, 3);
    expect(s.riskiest.some((r) => r.card.id === 'new')).toBe(false);
  });

  it('lists the wrong moves played instead of a card\'s answer, most frequent first', () => {
    const cards = [reviewed('a', 1, 1)];
    const log = (wrongSan?: string): StoredRevlog => ({ cardId: 'a', rating: 1, state: 2, due: NOW, stability: 1, difficulty: 5, elapsed_days: 1, last_elapsed_days: 1, scheduled_days: 1, learning_steps: 0, review: NOW, wrongSan });
    const s = summarizeProgress(cards, [log('e5'), log('e5'), log('Nc3'), log(undefined), log('exd5')], NOW);
    expect(s.confusions.map((c) => [c.wrong, c.count])).toEqual([
      ['e5', 2],
      ['Nc3', 1],
    ]);
    const view = render(<ProgressSummaryView summary={s} />);
    expect(view.container.querySelector('[data-confusion="e5"]')?.textContent).toContain('you played 2.e5 instead of 2.exd5 (2 times)');
  });

  it('counts mastery by study-path group: a Review card that FSRS expects to last a week or more', () => {
    const cards = [
      // The g4 group (the Scandinavian lesson): one mastered, one reviewed but short-lived, one new
      reviewed('a', 1, 1),
      card('short', { state: 2, stability: 3, reps: 2, last_review: NOW - DAY, due: NOW + 2 * DAY }),
      card('new', {}),
      // The rook mate, in "Finish the game", in relearning: reviewed, not mastered
      card('rook', { lessonIds: ['lesson-rook-back-rank-mate'], state: 3, stability: 9, reps: 4, lapses: 1, last_review: NOW - DAY, due: NOW + DAY }),
    ];
    const s = summarizeProgress(cards, [], NOW);
    expect(s.byGroup.map((g) => g.groupId)).toEqual(patternPath.map((g) => g.id));
    const g4 = s.byGroup.find((g) => g.groupId === 'pattern-queen-takes-on-g4')!;
    expect([g4.cards, g4.reviewed, g4.mastered]).toEqual([3, 2, 1]);
    expect(g4.recall).not.toBeNull();
    const finish = s.byGroup.find((g) => g.groupId === 'pattern-finish-the-game')!;
    expect([finish.cards, finish.reviewed, finish.mastered]).toEqual([1, 1, 0]);
    const empty = s.byGroup.find((g) => g.groupId === 'pattern-caro-bishop-both-sides')!;
    expect([empty.cards, empty.reviewed, empty.mastered, empty.recall]).toEqual([0, 0, 0, null]);
    const view = render(<ProgressSummaryView summary={s} />);
    const row = view.container.querySelector('[data-mastery-group="pattern-queen-takes-on-g4"]')!;
    expect(row.getAttribute('data-mastered')).toBe('1');
    expect(row.textContent).toContain('1/3 mastered, recall');
    expect(view.container.querySelector('[data-mastery-group="pattern-caro-bishop-both-sides"]')?.textContent).toContain('0/0 mastered');
  });

  it('offers to open the lesson of a risky card', () => {
    const s = summarizeProgress([reviewed('a', 1, 1)], [], NOW);
    const opened: string[] = [];
    const view = render(<ProgressSummaryView summary={s} onOpenLesson={(id) => opened.push(id)} />);
    fireEvent.click(view.container.querySelector('[data-action="progress-open"]')!);
    expect(opened).toEqual(['lesson-scandinavian-refutation-drill']);
    expect(view.container.querySelector('[data-section="progress-summary"]')?.getAttribute('data-reviewed')).toBe('1');
  });
});
