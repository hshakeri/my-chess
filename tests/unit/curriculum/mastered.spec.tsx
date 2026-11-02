// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor, screen } from '@testing-library/react';

// On the mastered list: the Evans Gambit lesson, the Scandinavian drill's first exercise, the stalemate
// lesson's only exercise, the newest position of the first drill set, the deck's first tactic and the
// Scandinavian worksheet
vi.mock('../../../src/data/mastered.json', () => ({
  default: { L9: '2026-11-02', E1: '2026-11-02', E34: '2026-11-02', G1: '2026-11-02', T1: '2026-11-02', W4: '2026-11-02' },
}));

import { scandinavianRefutationDrill } from '../../../src/curriculum/drills';
import { exerciseCode, exercisesToPractise, isLessonMastered, masteredCodes } from '../../../src/curriculum/itemCodes';
import { practiceDeck, tacticsDeck } from '../../../src/services/tacticsDeck';
import { dueIdeas, ideaLessons } from '../../../src/services/ideaCards';
import { allCurriculumLessons } from '../../../src/curriculum';
import { CardService } from '../../../src/services/cards';
import { LessonsView } from '../../../src/views/LessonsView';
import { TacticsSheet } from '../../../src/views/TacticsSheet';
import { WorksheetsView } from '../../../src/views/WorksheetsView';

const EVANS = 'lesson-evans-gambit-destruction';
const G1 = 'lesson-game-threat-186294577658-12';
const codesShown = (root: ParentNode) => Array.from(root.querySelectorAll('[data-code]')).map((el) => el.getAttribute('data-code'));

describe('What is on the mastered list is left out of the app', () => {
  beforeEach(async () => {
    await CardService.resetAll();
    localStorage.clear();
    localStorage.setItem('my_chess_cct_gate', 'off');
  });
  afterEach(() => cleanup());

  it('the lists of codes, exercises and tactics leave the mastered ones out', () => {
    expect(masteredCodes()).toEqual(['L9', 'E1', 'E34', 'G1', 'T1', 'W4']);
    expect(isLessonMastered(EVANS)).toBe(true);
    const left = exercisesToPractise(scandinavianRefutationDrill);
    expect(left.length).toBe(scandinavianRefutationDrill.exercises.length - 1);
    expect(left.map((ex) => exerciseCode(ex.id))).toEqual(['E2', 'E3']);
    expect(practiceDeck.length).toBe(tacticsDeck.length - 1);
    expect(practiceDeck[0].id).toBe(tacticsDeck[1].id);
    // A mastered lesson's plan card does not come due
    const plans = dueIdeas(allCurriculumLessons).map((l) => l.id);
    expect(ideaLessons(allCurriculumLessons).map((l) => l.id)).toContain(EVANS);
    expect(plans.length).toBeGreaterThan(0);
    expect(plans).not.toContain(EVANS);
  });

  it('the study path drops a mastered lesson and position; the Mastered list keeps them, and every card shows its code', async () => {
    const { container: c } = render(<LessonsView />);
    await waitFor(() => expect(c.querySelector('[data-lesson-id="lesson-scandinavian-refutation-drill"] [data-code="L1"]')).not.toBeNull());
    expect(c.querySelector(`[data-lesson-id="${EVANS}"]`)).toBeNull();
    expect(c.querySelector(`[data-lesson-id="${G1}"]`)).toBeNull();
    // The set's next position is there, with its code on the tile
    expect(c.querySelector('[data-code="G2"]')).not.toBeNull();
    const mastered = c.querySelector('[data-course="mastered"]') as HTMLButtonElement;
    expect(mastered.textContent).toBe('Mastered (2)');
    fireEvent.click(mastered);
    await waitFor(() => expect(c.querySelector(`[data-lesson-id="${EVANS}"] [data-code="L9"]`)).not.toBeNull());
    expect(c.querySelector(`[data-lesson-id="${G1}"]`)).not.toBeNull();
    // Opened from there, the lesson says it is mastered
    fireEvent.click(c.querySelector(`[data-lesson-id="${EVANS}"]`)!);
    await waitFor(() => expect(c.querySelector('[data-mastered="true"]')).not.toBeNull());
  });

  it("a lesson whose only exercise is mastered ends with its line", async () => {
    render(<LessonsView initialLessonId="lesson-stalemate-catastrophes" />);
    const square = (s: string) => document.querySelector(`[data-square="${s}"]`) as HTMLElement;
    await waitFor(() => expect(square('d6').querySelector('img[alt="White q"]')).toBeTruthy());
    fireEvent.click(square('d6'));
    fireEvent.click(square('d8'));
    await waitFor(() => expect(screen.getByText(/Lesson Completed!/)).toBeTruthy(), { timeout: 4000 });
    expect(document.querySelector('[data-exercise]')).toBeNull();
  });

  it('the tactics sheet and the worksheets leave the mastered ones out and show the codes', () => {
    const sheet = render(<TacticsSheet />);
    const shown = codesShown(sheet.container);
    expect(shown).toHaveLength(12);
    expect(shown).not.toContain('T1');
    expect(shown.every((code) => /^T\d+$/.test(code ?? ''))).toBe(true);
    cleanup();

    const worksheets = render(<WorksheetsView />);
    const listed = codesShown(worksheets.container);
    expect(listed).not.toContain('W4');
    expect(listed).toContain('W1');
    // With the Scandinavian worksheet mastered, the first worksheet opens instead
    expect(worksheets.container.textContent).toContain('W1 · ECO');
  });
});
