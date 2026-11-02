// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { Chess } from 'chess.js';
import { allCurriculumLessons } from '../../../src/curriculum';
import { patternPath } from '../../../src/curriculum/patternPath';
import { dueIdeas, gradeIdea, ideaLessons, ideaPosition, planChoices, IDEA_STORAGE_KEY } from '../../../src/services/ideaCards';
import { PlanReviewPanel } from '../../../src/views/PlanReviewPanel';

const NOW = Date.UTC(2026, 10, 1, 12);

describe('Plan review: idea cards for the openings (CL-7)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it('takes the opening lessons of the study path, each at the position its main line reaches', () => {
    const lessons = ideaLessons(allCurriculumLessons);
    const openingGroups = patternPath.filter((g) => !g.lessonIds[0].startsWith('lesson-game-') && g.id !== 'pattern-finish-the-game');
    expect(lessons.map((l) => l.id).sort()).toEqual(openingGroups.flatMap((g) => g.lessonIds).sort());
    for (const l of lessons) {
      const c = new Chess(l.initialFen);
      for (const m of l.moves) c.move(m.san);
      expect(ideaPosition(l)).toBe(c.fen());
      expect(l.thematicObjective).toBeTruthy();
    }
  });

  it('schedules each card by the student\'s grade: a forgotten plan comes back within minutes, a good one in days', () => {
    const [first, second] = ideaLessons(allCurriculumLessons);
    expect(dueIdeas(allCurriculumLessons, NOW)).toHaveLength(ideaLessons(allCurriculumLessons).length);
    const forgot = gradeIdea(first.id, 'again', NOW);
    const good = gradeIdea(second.id, 'good', NOW);
    expect(forgot - NOW).toBeLessThanOrEqual(10 * 60_000);
    expect(dueIdeas(allCurriculumLessons, NOW + 11 * 60_000).map((l) => l.id)).toContain(first.id);
    expect(good - NOW).toBeGreaterThan(60_000);
    // A second good recall pushes the card out by days
    const later = gradeIdea(second.id, 'good', good);
    expect(later - good).toBeGreaterThan(24 * 3_600_000);
    expect(JSON.parse(window.localStorage.getItem(IDEA_STORAGE_KEY)!)[second.id].reps).toBe(2);
  });

  it('asks for the plan, shows it on demand, and moves on after the grade', () => {
    const view = render(<PlanReviewPanel onClose={() => undefined} />);
    const modal = () => view.container.querySelector('[data-modal="plans"]')!;
    const total = Number(modal().getAttribute('data-plans-left'));
    const firstId = view.container.querySelector('[data-plan-lesson]')!.getAttribute('data-plan-lesson')!;
    expect(view.container.querySelector('[data-section="plan-answer"]')).toBeNull();
    fireEvent.click(view.container.querySelector('[data-action="plans-show"]')!);
    const lesson = allCurriculumLessons.find((l) => l.id === firstId)!;
    expect(view.container.querySelector('[data-section="plan-answer"]')?.textContent).toContain(lesson.thematicObjective!);
    fireEvent.click(view.container.querySelector('[data-grade="good"]')!);
    expect(Number(modal().getAttribute('data-plans-left'))).toBe(total - 1);
    expect(view.container.querySelector('[data-plan-lesson]')?.getAttribute('data-plan-lesson')).not.toBe(firstId);
  });

  it('offers three plans to choose from: the line\'s own and two of other lessons for the same colour', () => {
    for (const lesson of ideaLessons(allCurriculumLessons)) {
      const choices = planChoices(lesson, allCurriculumLessons);
      expect(choices, lesson.id).toHaveLength(3);
      expect(new Set(choices).size, lesson.id).toBe(3);
      expect(choices, lesson.id).toContain(lesson.thematicObjective);
      const sameColour = ideaLessons(allCurriculumLessons).filter((l) => l.targetColor === lesson.targetColor).map((l) => l.thematicObjective);
      for (const c of choices) expect(sameColour, lesson.id).toContain(c);
      expect(planChoices(lesson, allCurriculumLessons)).toEqual(choices);
    }
    // The right plan is not always in the same place
    const places = new Set(ideaLessons(allCurriculumLessons).map((l) => planChoices(l, allCurriculumLessons).indexOf(l.thematicObjective!)));
    expect(places.size).toBeGreaterThan(1);
  });

  it('a wrong choice shows the plan and suggests Forgot; a right one suggests Good', () => {
    const view = render(<PlanReviewPanel onClose={() => undefined} />);
    const id = view.container.querySelector('[data-plan-lesson]')!.getAttribute('data-plan-lesson')!;
    const lesson = allCurriculumLessons.find((l) => l.id === id)!;
    const buttons = [...view.container.querySelectorAll('[data-plan-choice]')] as HTMLElement[];
    const wrong = buttons.find((b) => b.textContent !== lesson.thematicObjective)!;
    fireEvent.click(wrong);
    const answer = view.container.querySelector('[data-section="plan-answer"]')!;
    expect(answer.getAttribute('data-choice-result')).toBe('wrong');
    expect(answer.textContent).toContain(lesson.thematicObjective!);
    expect(answer.querySelector('[data-suggested="true"]')?.getAttribute('data-grade')).toBe('again');
    fireEvent.click(answer.querySelector('[data-grade="again"]')!);
    // The next card: choose right
    const next = allCurriculumLessons.find((l) => l.id === view.container.querySelector('[data-plan-lesson]')!.getAttribute('data-plan-lesson'))!;
    fireEvent.click(([...view.container.querySelectorAll('[data-plan-choice]')] as HTMLElement[]).find((b) => b.textContent === next.thematicObjective)!);
    expect(view.container.querySelector('[data-section="plan-answer"]')?.getAttribute('data-choice-result')).toBe('right');
    expect(view.container.querySelector('[data-suggested="true"]')?.getAttribute('data-grade')).toBe('good');
  });
});
