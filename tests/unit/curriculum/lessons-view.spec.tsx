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
    expect(html).toContain('Weakness Drill: Scandinavian 2.exd5! Refutation');
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

  it('includes SuperMemo-2 (SM-2) spaced repetition rating buttons including Good (data-grade 4)', () => {
    const html = renderToString(<LessonsView />);

    expect(html).toContain('Spaced Repetition Review (SM-2 / Leitner Box)');
    expect(html).toContain('data-grade="1"');
    expect(html).toContain('data-grade="3"');
    expect(html).toContain('data-grade="4"');
    expect(html).toContain('data-grade="5"');
    expect(html).toContain('>Good<');
  });
});
