// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LessonsView } from '../../../src/views/LessonsView';
import { CardService } from '../../../src/services/cards';
import { canonicalFenKey } from '../../../src/services/fenKey';
import { db } from '../../../src/db/database';

/**
 * Interaction tests for the lesson player, driven through the real DOM (jsdom) with real timers
 * so the line-complete hold, the opponent replies and the IndexedDB writes behave as in the browser.
 */

const STALEMATE_FEN = 'k7/8/1K1Q4/8/8/8/8/8 w - - 0 1';
const STALEMATE_KEY = canonicalFenKey(STALEMATE_FEN);

const sq = (s: string): HTMLElement => {
  const el = document.querySelector(`[data-square="${s}"]`);
  if (!el) throw new Error(`square ${s} not rendered`);
  return el as HTMLElement;
};
const clickMove = (from: string, to: string) => {
  fireEvent.click(sq(from));
  fireEvent.click(sq(to));
};
const card = (lessonId: string): HTMLElement => {
  const el = document.querySelector(`[data-lesson-id="${lessonId}"]`);
  if (!el) throw new Error(`lesson card ${lessonId} not rendered`);
  return el as HTMLElement;
};
const reviewLog = () => Array.from(document.querySelectorAll('[data-review-log] [data-rating]')).map((el) => el.getAttribute('data-rating'));

/** Plays the one-move stalemate lesson to the end: 1.Qd8#, the exercise, then "Finish lesson". */
async function completeStalemateLesson() {
  await waitFor(() => expect(sq('d6').querySelector('img[alt="White q"]')).toBeTruthy());
  clickMove('d6', 'd8');
  await waitFor(() => expect(document.querySelector('.correct-feedback')).toBeTruthy());
  // The finished line is held on the board before the exercise loads
  expect(document.querySelector('[data-exercise]')).toBeNull();
  await waitFor(() => expect(document.querySelector('[data-exercise]')).toBeTruthy(), { timeout: 4000 });
  clickMove('d6', 'd8');
  const finish = await waitFor(() => {
    const btn = document.querySelector('button[data-action="next-exercise"]');
    expect(btn).toBeTruthy();
    return btn as HTMLButtonElement;
  });
  fireEvent.click(finish);
  await waitFor(() => expect(screen.getByText(/Lesson Completed!/)).toBeTruthy());
}

describe('LessonsView interactions (jsdom)', () => {
  beforeEach(async () => {
    await CardService.resetAll();
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    cleanup();
  });

  it('switching lesson during the exercise phase starts the new lesson on its own line', async () => {
    render(<LessonsView initialLessonId="lesson-stalemate-catastrophes" />);
    await waitFor(() => expect(sq('d6').querySelector('img[alt="White q"]')).toBeTruthy());
    clickMove('d6', 'd8');
    await waitFor(() => expect(document.querySelector('[data-exercise]')).toBeTruthy(), { timeout: 4000 });

    fireEvent.click(card('lesson-legals-mate'));

    // The new lesson starts from its own initial position, in the line phase, nothing completed
    await waitFor(() => expect(sq('e2').querySelector('img[alt="White p"]')).toBeTruthy());
    expect(document.querySelector('[data-exercise]')).toBeNull();
    expect(screen.queryByText(/Lesson Completed!/)).toBeNull();
    expect(screen.getByText(/Your turn: find White/)).toBeTruthy();
    expect(reviewLog()).toEqual([]);

    // ...and its first move is graded against the line, so the board is alive
    clickMove('e2', 'e4');
    await waitFor(() => expect(document.querySelector('.correct-feedback')).toBeTruthy());
    expect(sq('e4').querySelector('img[alt="White p"]')).toBeTruthy();
    await waitFor(() => expect(reviewLog()).toHaveLength(1));
  });

  it('switching lesson after completion clears the completion state and the review log', async () => {
    render(<LessonsView initialLessonId="lesson-stalemate-catastrophes" />);
    await completeStalemateLesson();
    await waitFor(() => expect(reviewLog()).toHaveLength(1));

    fireEvent.click(card('lesson-legals-mate'));
    await waitFor(() => expect(screen.queryByText(/Lesson Completed!/)).toBeNull());
    expect(reviewLog()).toEqual([]);
    expect(screen.getByText(/Each decision you play is scheduled on its own card/)).toBeTruthy();
  });

  it('schedules each decision on its own FSRS card as it is played: a clean first try is Good', async () => {
    render(<LessonsView initialLessonId="lesson-stalemate-catastrophes" />);
    await completeStalemateLesson();

    await waitFor(() => expect(reviewLog()).toEqual(['good']));
    const stored = await CardService.getCard(STALEMATE_KEY);
    expect(stored?.reps).toBe(1);
    expect(stored?.lapses).toBe(0);
    expect(stored?.lessonIds).toContain('lesson-stalemate-catastrophes');
    const log = await db.revlog.where('cardId').equals(STALEMATE_KEY).toArray();
    expect(log).toHaveLength(1);
    expect(log[0].lessonId).toBe('lesson-stalemate-catastrophes');
    expect(log[0].wrongSan).toBeUndefined();
    // The exercise that follows is not a card: still exactly one review
    expect(await db.revlog.count()).toBe(1);
    await waitFor(() => expect(document.querySelector('[data-srs-message]')?.textContent).toMatch(/Good: next review in/));
  });

  it('a wrong first try rates the decision Again, records the wrong move, and the card comes back within minutes', async () => {
    render(<LessonsView initialLessonId="lesson-stalemate-catastrophes" />);
    await waitFor(() => expect(sq('d6').querySelector('img[alt="White q"]')).toBeTruthy());

    // 1.Qc7?? is the authored stalemate trap: feedback, then rollback
    clickMove('d6', 'c7');
    await waitFor(() => expect(document.querySelector('[data-feedback="wrong"]')).toBeTruthy());
    await waitFor(() => expect(sq('d6').querySelector('img[alt="White q"]')).toBeTruthy(), { timeout: 3000 });
    clickMove('d6', 'd8');
    await waitFor(() => expect(document.querySelector('.correct-feedback')).toBeTruthy());

    await waitFor(() => expect(reviewLog()).toEqual(['again']));
    const stored = await CardService.getCard(STALEMATE_KEY);
    expect(stored?.reps).toBe(1);
    expect(stored!.due - Date.now()).toBeLessThan(5 * 60 * 1000);
    const log = await db.revlog.where('cardId').equals(STALEMATE_KEY).toArray();
    expect(log[0].wrongSan).toBe('Qc7');
  });

  it('clears the rating confirmation when another lesson is opened', async () => {
    render(<LessonsView initialLessonId="lesson-stalemate-catastrophes" />);
    await completeStalemateLesson();
    await waitFor(() => expect(document.querySelector('[data-srs-message]')).toBeTruthy());

    fireEvent.click(card('lesson-legals-mate'));
    await waitFor(() => expect(document.querySelector('[data-srs-message]')).toBeNull());
  });

  it("today's session presents due cards one position at a time and ends with a summary", async () => {
    // Make the stalemate decision the only due card
    render(<LessonsView initialLessonId="lesson-legals-mate" />);
    await waitFor(() => expect(Number(document.querySelector('[data-due-count]')?.getAttribute('data-due-count'))).toBeGreaterThan(1), {
      timeout: 4000,
    });
    const farFuture = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const all = await CardService.getAllCards();
    for (const c of all) {
      if (c.id !== STALEMATE_KEY) await db.cards.update(c.id, { due: farFuture });
    }
    cleanup();

    render(<LessonsView initialLessonId="lesson-legals-mate" />);
    await waitFor(() => expect(document.querySelector('[data-due-count]')?.getAttribute('data-due-count')).toBe('1'), { timeout: 4000 });
    fireEvent.click(document.querySelector('button[data-action="review-due"]')!);

    // The card arrives as its own position, with no lesson name in the title
    await waitFor(() => expect(document.querySelector('[data-session-progress]')?.textContent).toMatch(/card 1 of 1/));
    await waitFor(() => expect(sq('d6').querySelector('img[alt="White q"]')).toBeTruthy());
    expect(document.querySelector('h3')?.textContent).not.toMatch(/Stalemate/);
    expect(document.querySelector('[data-tree="lesson"]')).toBeNull();

    clickMove('d6', 'd8');
    await waitFor(() => expect(screen.getByText(/Lesson Completed!/)).toBeTruthy());
    await waitFor(() => expect(reviewLog()).toEqual(['good']));
    // Only after the answer is the source lesson named
    expect(document.querySelector('[data-section="session-card"]')?.textContent).toMatch(/Avoiding Stalemate Catastrophes/);

    fireEvent.click(document.querySelector('button[data-action="next-card"]')!);
    await waitFor(() => expect(document.querySelector('[data-section="session-summary"]')).toBeTruthy());
    expect(document.querySelector('[data-section="session-summary"]')?.textContent).toMatch(/1 card reviewed: 0 again, 0 hard, 1 good, 0 easy/);
    expect(document.querySelector('[data-due-count]')?.getAttribute('data-due-count')).toBe('0');
    // No further "Next card" once the session is over: the count cannot be inflated
    expect(document.querySelector('button[data-action="next-card"]')).toBeNull();
    // The review was logged under the source lesson, not the ad-hoc card lesson
    const log = await db.revlog.where('cardId').equals(STALEMATE_KEY).toArray();
    expect(log.at(-1)?.lessonId).toBe('lesson-stalemate-catastrophes');

    fireEvent.click(document.querySelector('[data-section="session-summary"] button[data-action="end-session"]')!);
    await waitFor(() => expect(document.querySelector('[data-section="session-summary"]')).toBeNull());
    expect(document.querySelector('h3')?.textContent).toMatch(/Legal/);
  });

  it('a hand-off to a pattern-library lesson opens the Pattern Library list so the card is visible', async () => {
    render(<LessonsView initialLessonId="lesson-scotch-gambit-breakthrough" />);
    expect(card('lesson-scotch-gambit-breakthrough')).toBeTruthy();
    expect(document.querySelector('[data-lesson-id="lesson-siberian-trap"]')).toBeTruthy();
    expect(document.querySelector('[data-lesson-id="lesson-evans-gambit-destruction"]')).toBeNull();
    await waitFor(() => expect(document.querySelector('h3')?.textContent).toMatch(/Scotch Gambit/));
  });
});
