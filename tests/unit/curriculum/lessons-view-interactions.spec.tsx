// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LessonsView } from '../../../src/views/LessonsView';
import { CardService } from '../../../src/services/cards';
import { canonicalFenKey } from '../../../src/services/fenKey';
import { db } from '../../../src/db/database';
import { missedThreatLessons } from '../../../src/curriculum/gameDrills';

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
      // These tests drive the moves; the board question before each move (CL-5) has its own tests, which switch it on
      window.localStorage.setItem('my_chess_cct_gate', 'off');
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
    expect(document.querySelector('[data-section="session-card"]')?.textContent).toMatch(/Avoiding Stalemate/);

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

  it('clicking a node of the lesson tree jumps to that position, branches included', async () => {
    render(<LessonsView initialLessonId="lesson-evans-gambit-destruction" />);
    await waitFor(() => expect(sq('e2').querySelector('img[alt="White p"]')).toBeTruthy());

    // The Blackburne-Shilling branch after 3.Bc4: the board shows the knight on d4, White to move
    const node = document.querySelector('[data-tree="lesson"] [data-node="Nd4"] button[data-action="select-node"]') as HTMLButtonElement;
    expect(node).toBeTruthy();
    fireEvent.click(node);
    await waitFor(() => expect(sq('d4').querySelector('img[alt="Black n"]')).toBeTruthy());
    expect(sq('c4').querySelector('img[alt="White b"]')).toBeTruthy();
    expect(screen.getByText(/Your turn: find White/)).toBeTruthy();
    expect(document.querySelector('[data-tree="lesson"] [data-current="true"]')?.getAttribute('data-node')).toBe('Nd4');

    // The branch's own answer is graded there: 4.Nxd4 is the lesson's move
    clickMove('f3', 'd4');
    await waitFor(() => expect(document.querySelector('.correct-feedback')).toBeTruthy());

    // Jumping back to a main-line node after the student's move lets the opponent reply first
    const e4 = document.querySelector('[data-tree="lesson"] [data-node="e4"] button[data-action="select-node"]') as HTMLButtonElement;
    fireEvent.click(e4);
    await waitFor(() => expect(sq('e5').querySelector('img[alt="Black p"]')).toBeTruthy(), { timeout: 3000 });
    expect(sq('d4').querySelector('img')).toBeNull();
  });

  it('a hand-off to a pattern-library lesson opens the Pattern Library list so the card is visible', async () => {
    render(<LessonsView initialLessonId="lesson-scotch-gambit-breakthrough" />);
    expect(card('lesson-scotch-gambit-breakthrough')).toBeTruthy();
    expect(document.querySelector('[data-lesson-id="lesson-siberian-trap"]')).toBeTruthy();
    expect(document.querySelector('[data-lesson-id="lesson-evans-gambit-destruction"]')).toBeNull();
    await waitFor(() => expect(document.querySelector('h3')?.textContent).toMatch(/Scotch Gambit/));
  });
  it('a drill position from the games: the game move replays its capture, a right move offers the next position', async () => {
    // The newest threat drill: after 6...Ne5 the queen on f3 is attacked; the game went 7.Bxf7+ Nxf7
    const [first, second] = missedThreatLessons;
    render(<LessonsView initialLessonId={first.id} />);
    // The opponent's move is replayed first, and the lesson tree (which would print the answer) is hidden
    await waitFor(() => expect(sq('e5').querySelector('img[alt="Black n"]')).toBeTruthy());
    expect(document.querySelector('[data-tree-root="lesson"]')).toBeNull();
    expect(screen.getByText(/What does it attack\?/)).toBeTruthy();

    // The move from the game is answered with what it cost, and the capture is played out
    clickMove('c4', 'f7');
    await waitFor(() => expect(screen.getByText(/This is what you played vs robertduta/)).toBeTruthy());
    await waitFor(() => expect(sq('f7').querySelector('img[alt="Black n"]')).toBeTruthy(), { timeout: 3000 });
    await waitFor(() => expect(sq('c4').querySelector('img[alt="White b"]')).toBeTruthy(), { timeout: 4000 });

    // Any move that saves the queen is right; the position is done and the next one is offered
    clickMove('f3', 'g3');
    await waitFor(() => expect(screen.getByText(/Lesson Completed!/)).toBeTruthy());
    expect(screen.getByText(/took the bishop on f7/)).toBeTruthy();
    expect(document.querySelector('[data-section="drill-next"]')?.textContent).toMatch(/Position 1 of 12/);
    fireEvent.click(document.querySelector('button[data-action="next-drill"]') as HTMLButtonElement);
    await waitFor(() => expect(document.querySelector(`[data-lesson-id="${second.id}"]`)?.className).toMatch(/border-emerald-500/));
  });
  it('a board question comes before the move: the board waits for the answer, and the right answer leaves the grade alone (CL-5)', async () => {
    window.localStorage.setItem('my_chess_cct_gate', 'on');
    render(<LessonsView initialLessonId="lesson-scandinavian-refutation-drill" />);
    // The drill starts after 1.e4 d5: the question asks what 1...d5 attacks, which is no piece (pawns don't count)
    const question = await waitFor(() => {
      const el = document.querySelector('[data-section="board-question"]');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(question.getAttribute('data-question-kind')).toBe('attacks');
    expect(question.textContent).toContain('which of your pieces does d5 attack?');

    // Until it is answered the board takes no move
    clickMove('e4', 'd5');
    await new Promise((r) => setTimeout(r, 300));
    expect(sq('e4').querySelector('img[alt="White p"]')).toBeTruthy();
    expect(reviewLog()).toEqual([]);

    fireEvent.click(document.querySelector('button[data-action="question-none"]')!);
    await waitFor(() => expect(document.querySelector('[data-section="board-question"]')?.getAttribute('data-question-status')).toBe('right'));
    expect(document.querySelector('[data-question-feedback]')?.textContent).toContain('It attacks none of your pieces.');

    clickMove('e4', 'd5');
    await waitFor(() => expect(reviewLog()).toEqual(['good']));
    expect(JSON.parse(window.localStorage.getItem('my_chess_cct_log_v1') || '[]')).toMatchObject([{ kind: 'attacks', correct: true, source: 'lesson' }]);
  });

  it('a wrong answer shows the answer on the board and counts like a hint: the decision is rated Hard (CL-5)', async () => {
    window.localStorage.setItem('my_chess_cct_gate', 'on');
    render(<LessonsView initialLessonId="lesson-stalemate-catastrophes" />);
    // No opponent move before the first decision: which of your pieces has no defender? The queen on d6.
    const question = await waitFor(() => {
      const el = document.querySelector('[data-section="board-question"]');
      expect(el?.getAttribute('data-question-kind')).toBe('undefended');
      return el as HTMLElement;
    });
    expect(question).toBeTruthy();
    // Pick the king instead, and answer
    fireEvent.click(sq('b6'));
    fireEvent.click(document.querySelector('button[data-action="question-done"]')!);
    await waitFor(() => expect(document.querySelector('[data-section="board-question"]')?.getAttribute('data-question-status')).toBe('wrong'));
    expect(sq('d6').className).toContain('ring-emerald-400');
    expect(sq('b6').className).toContain('ring-rose-500');

    clickMove('d6', 'd8');
    await waitFor(() => expect(reviewLog()).toEqual(['hard']));
  });

  it('the switch turns the question off and remembers it', async () => {
    window.localStorage.setItem('my_chess_cct_gate', 'on');
    render(<LessonsView initialLessonId="lesson-stalemate-catastrophes" />);
    await waitFor(() => expect(document.querySelector('[data-section="board-question"]')).toBeTruthy());
    fireEvent.click(document.querySelector('input[data-toggle="cct-gate"]')!);
    await waitFor(() => expect(document.querySelector('[data-section="board-question"]')).toBeNull());
    expect(window.localStorage.getItem('my_chess_cct_gate')).toBe('off');
    clickMove('d6', 'd8');
    await waitFor(() => expect(reviewLog()).toEqual(['good']));
  });
});
