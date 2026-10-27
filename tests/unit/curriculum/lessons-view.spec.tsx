import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { LessonsView } from '../../../src/views/LessonsView';

describe('LessonsView Component', () => {
  it('renders without crashing and contains required root view attributes', () => {
    const html = renderToString(<LessonsView />);

    expect(html).toContain('lessons-view');
    expect(html).toContain('data-view="lessons"');
    expect(html).toContain('Interactive Repertoire &amp; Curriculum Lessons');
  });

  it('renders lesson cards with data-lesson-id and button.lesson-item', () => {
    const html = renderToString(<LessonsView />);

    expect(html).toContain('lesson-card');
    expect(html).toContain('data-lesson-id="lesson-scandinavian-refutation-drill"');
    expect(html).toContain('lesson-item');
    // Titles never print the answer the drill asks for
    expect(html).toContain('Weakness Drill: Meeting the Scandinavian Defense');
    expect(html).not.toContain('2.exd5! Refutation');
  });

  it('hides pattern-library lessons from the default list and offers them behind a toggle', () => {
    const html = renderToString(<LessonsView />).replace(/<!-- -->/g, '');

    expect(html).toContain('data-lesson-id="lesson-evans-gambit-destruction"');
    expect(html).toContain('data-lesson-id="lesson-legals-mate"');
    expect(html).not.toContain('data-lesson-id="lesson-siberian-trap"');
    expect(html).not.toContain('data-lesson-id="lesson-adams-attack-sicilian"');
    expect(html).toContain('data-course="pattern-library"');
    expect(html).toContain('Pattern Library (8)');
  });

  it('renders the session control and explains per-decision scheduling instead of a self-grade bar', () => {
    const html = renderToString(<LessonsView />);

    expect(html).toContain('data-action="review-due"');
    expect(html).toContain('Each decision you play is scheduled on its own card');
    expect(html).toContain('data-review-log');
    // No self-reported grade buttons any more: the rating is inferred from the run
    expect(html).not.toContain('data-grade=');
  });

  it('renders the lesson tree with the main line and the opponent branches', () => {
    const html = renderToString(<LessonsView initialLessonId="lesson-evans-gambit-destruction" />);

    expect(html).toContain('data-tree="lesson"');
    expect(html).toContain('data-branches="true"');
    expect(html).toContain('data-node="Nd4"');
  });

  it('displays visible book source attribution text matching required curriculum authors', () => {
    const html = renderToString(<LessonsView />);

    // Test attribution regex: /Tactics in Junior Openings|101|Schiller|Pinter|MCO/i
    const matchesSourceAttribution = /Tactics in Junior Openings|101|Schiller|Pinter|MCO/i.test(html);
    expect(matchesSourceAttribution).toBe(true);

    expect(html).toContain('Tactics in Junior Openings');
    expect(html).toContain('Dave');
  });

  it('renders interactive 2D chessboard with data-square and img pieces', () => {
    const html = renderToString(<LessonsView />);

    expect(html).toContain('data-square="e4"');
    expect(html).toContain('data-square="d5"');
    expect(html).toContain('data-square="e5"');
    expect(html).toContain('<img');
  });

  it('includes progressive hint button and hint controls', () => {
    const html = renderToString(<LessonsView />);

    expect(html).toContain('data-action="hint"');
    expect(html).toContain('Hint');
  });

  it('labels the scheduler as FSRS (deliberate change from the SM-2 / Leitner label)', () => {
    const html = renderToString(<LessonsView />);

    expect(html).toContain('Spaced Repetition Review (FSRS)');
    expect(html).toContain('Spaced Repetition (FSRS)');
    expect(html).not.toContain('SM-2');
  });
});
