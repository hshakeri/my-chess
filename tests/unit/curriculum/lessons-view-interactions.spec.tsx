// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LessonsView } from '../../../src/views/LessonsView';
import { SrsService } from '../../../src/services/srs';

/**
 * Interaction tests for the lesson player, driven through the real DOM (jsdom) with real timers
 * so the line-complete hold, the opponent replies and the IndexedDB writes behave as in the browser.
 */

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
const gradeButton = (grade: number) => document.querySelector(`[data-grade="${grade}"]`) as HTMLButtonElement;

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
    await SrsService.resetAllCards();
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
    for (const g of [1, 3, 4, 5]) expect(gradeButton(g).disabled).toBe(true);

    // ...and its first move is graded against the line, so the board is alive
    clickMove('e2', 'e4');
    await waitFor(() => expect(document.querySelector('.correct-feedback')).toBeTruthy());
    expect(sq('e4').querySelector('img[alt="White p"]')).toBeTruthy();
  });

  it('switching lesson after completion re-gates the grade bar for the new lesson', async () => {
    render(<LessonsView initialLessonId="lesson-stalemate-catastrophes" />);
    await completeStalemateLesson();
    await waitFor(() => expect(gradeButton(4).disabled).toBe(false));

    fireEvent.click(card('lesson-legals-mate'));
    await waitFor(() => expect(screen.queryByText(/Lesson Completed!/)).toBeNull());
    for (const g of [1, 3, 4, 5]) expect(gradeButton(g).disabled).toBe(true);
    expect(screen.getByText(/Complete the lesson to record a review|Complete it to record a review/)).toBeTruthy();
  });

  it('records exactly one review when a grade button is double-clicked', async () => {
    render(<LessonsView initialLessonId="lesson-stalemate-catastrophes" />);
    await completeStalemateLesson();
    const good = gradeButton(4);
    await waitFor(() => expect(good.disabled).toBe(false));

    fireEvent.click(good);
    fireEvent.click(good);

    await waitFor(() => expect(document.querySelector('[data-srs-message]')?.textContent).toMatch(/Rated Good/));
    const stored = await SrsService.getCard('lesson-stalemate-catastrophes');
    expect(stored?.repetitionCount).toBe(1);
    expect(stored?.history?.length).toBe(1);
    expect(stored?.history?.[0].grade).toBe(4);
    for (const g of [1, 3, 4, 5]) expect(gradeButton(g).disabled).toBe(true);
  });

  it('clears the rating confirmation when another lesson is opened', async () => {
    render(<LessonsView initialLessonId="lesson-stalemate-catastrophes" />);
    await completeStalemateLesson();
    await waitFor(() => expect(gradeButton(4).disabled).toBe(false));
    fireEvent.click(gradeButton(4));
    await waitFor(() => expect(document.querySelector('[data-srs-message]')).toBeTruthy());

    fireEvent.click(card('lesson-legals-mate'));
    await waitFor(() => expect(document.querySelector('[data-srs-message]')).toBeNull());
  });

  it('a hand-off to a pattern-library lesson opens the Pattern Library list so the card is visible', async () => {
    render(<LessonsView initialLessonId="lesson-scotch-gambit-breakthrough" />);
    expect(card('lesson-scotch-gambit-breakthrough')).toBeTruthy();
    expect(document.querySelector('[data-lesson-id="lesson-siberian-trap"]')).toBeTruthy();
    expect(document.querySelector('[data-lesson-id="lesson-evans-gambit-destruction"]')).toBeNull();
    await waitFor(() => expect(document.querySelector('h3')?.textContent).toMatch(/Scotch Gambit/));
  });
});
