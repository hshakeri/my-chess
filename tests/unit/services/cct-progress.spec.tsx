// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { cctBySource, type CctEvent } from '../../../src/services/cctLog';
import { BoardQuestionLines } from '../../../src/views/ProgressPanel';

const event = (at: number, source: CctEvent['source'], correct: boolean): CctEvent => ({ at, kind: 'attacks', correct, ms: 1000, source, fen: '' });

describe('Board questions in Progress (CL-5)', () => {
  afterEach(() => cleanup());

  it('counts the answers by where they were asked, and the newest 20 against the 20 before', () => {
    // 40 lesson answers: the first 20 half right, the newest 20 all right; 3 in games, none in the warm-up
    const events = [
      ...Array.from({ length: 20 }, (_, k) => event(k, 'lesson', k % 2 === 0)),
      ...Array.from({ length: 20 }, (_, k) => event(100 + k, 'lesson', true)),
      event(5, 'play', true),
      event(6, 'play', false),
      event(7, 'play', true),
    ];
    const rows = cctBySource(events);
    expect(rows.map((r) => [r.source, r.n, r.correct, r.recent, r.before])).toEqual([
      ['lesson', 40, 30, 1, 0.5],
      ['play', 3, 2, 2 / 3, null],
    ]);
    const view = render(<BoardQuestionLines rows={rows} />);
    expect(view.container.querySelector('[data-cct-source="lesson"]')?.textContent).toBe('Board questions in lessons: 40 answered, 75% right (the newest 20: 100%; the 20 before: 50%).');
    expect(view.container.querySelector('[data-cct-source="play"]')?.textContent).toBe('Board questions in games: 3 answered, 67% right.');
    expect(view.container.querySelector('[data-cct-source="warmup"]')).toBeNull();
  });

  it('gives the safety checks in games a line of their own, apart from the board question', () => {
    const events = [event(1, 'play', true), { ...event(2, 'play', true), kind: 'safe' as const }, { ...event(3, 'play', false), kind: 'safe' as const }, { ...event(4, 'warmup', false), kind: 'safe' as const }];
    const rows = cctBySource(events);
    expect(rows.map((r) => [r.source, r.n, r.correct])).toEqual([
      ['play', 1, 1],
      ['play-safety', 2, 1],
      ['warmup', 1, 0],
    ]);
    const view = render(<BoardQuestionLines rows={rows} />);
    expect(view.container.querySelector('[data-cct-source="play-safety"]')?.textContent).toBe('Safety checks in games: 2 answered, 50% right.');
    expect(view.container.querySelector('[data-cct-source="warmup"]')?.textContent).toBe('Board questions in the warm-up: 1 answered, 0% right.');
  });

  it('compares with the 20 before only once there are 20 before', () => {
    // 21 answers in games: the oldest wrong, the newest 20 right. One answer is not "the 20 before"
    const events = [event(0, 'play', false), ...Array.from({ length: 20 }, (_, k) => event(10 + k, 'play', true))];
    const [row] = cctBySource(events);
    expect([row.n, row.recent, row.before]).toEqual([21, 1, null]);
    const view = render(<BoardQuestionLines rows={[row]} />);
    expect(view.container.querySelector('[data-cct-source="play"]')?.textContent).toBe('Board questions in games: 21 answered, 95% right.');
  });
});
