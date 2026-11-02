// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { Chess } from 'chess.js';
import { allCurriculumLessons } from '../../../src/curriculum';
import { patternPath } from '../../../src/curriculum/patternPath';
import { dueIdeas, gradeIdea, ideaLessons, ideaPosition, IDEA_STORAGE_KEY } from '../../../src/services/ideaCards';
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
});
