// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { BoardCardSheet, BOARD_ORDER, PointsCard, POINTS_ROWS } from '../../../src/views/PointsCard';
import { patternPath } from '../../../src/curriculum/patternPath';

describe('Where your points go (Diagnostics)', () => {
  afterEach(() => cleanup());

  it('states the archive analysis figures as docs/game-analysis.md has them, in its order', () => {
    const doc = readFileSync('docs/game-analysis.md', 'utf8');
    const table = doc.slice(doc.indexOf('## The tweaks, ranked'), doc.indexOf('## Results'));
    const rows = table.split('\n').filter((l) => /^\| [A-Z]/.test(l) && !l.startsWith('| Tweak'));
    expect(rows).toHaveLength(POINTS_ROWS.length);
    rows.forEach((line, k) => {
      const cells = line.split('|').map((c) => c.trim());
      expect(cells[1], POINTS_ROWS[k].key).toBe(POINTS_ROWS[k].habit);
      expect(cells[3], POINTS_ROWS[k].key).toBe(POINTS_ROWS[k].points);
    });
    const prose = doc.replace(/\s+/g, ' ');
    expect(prose).toContain('one point per 100 games is about 7 rating points near a 50% score');
    expect(prose).toContain('worth even 0.005 points per game');
  });

  it('links each board check to the first lesson of its study-path group, and the clock rows to the Clock tab', () => {
    let opened = 0;
    const view = render(<PointsCard onOpenClock={() => opened++} />);
    for (const row of POINTS_ROWS.filter((r) => r.group)) {
      const link = view.container.querySelector(`[data-points-train="${row.key}"]`)!;
      expect(link.getAttribute('href')).toBe(`#/lesson/${patternPath.find((g) => g.id === row.group)!.lessonIds[0]}`);
    }
    fireEvent.click(view.container.querySelector('[data-points-clock="clock"]')!);
    fireEvent.click(view.container.querySelector('[data-points-clock="resign"]')!);
    expect(opened).toBe(2);
  });

  it('prints the same habits as a card for the board, in the order they come up at the board', () => {
    expect([...BOARD_ORDER].sort()).toEqual(POINTS_ROWS.map((r) => r.key).sort());
    const view = render(<BoardCardSheet />);
    const rows = Array.from(view.container.querySelectorAll('[data-card-row]'));
    expect(rows.map((r) => r.getAttribute('data-card-row'))).toEqual([...BOARD_ORDER]);
    rows.forEach((r) => {
      const row = POINTS_ROWS.find((p) => p.key === r.getAttribute('data-card-row'))!;
      expect(r.textContent).toContain(row.habit);
      expect(r.textContent).toContain(row.points);
    });
  });

  it('offers a game with the checks from the two board-check rows the Play tab practises', () => {
    let played = 0;
    const view = render(<PointsCard onPlayWithChecks={() => played++} />);
    const buttons = Array.from(view.container.querySelectorAll('[data-points-play]'));
    expect(buttons.map((b) => b.getAttribute('data-points-play'))).toEqual(['hang', 'threat']);
    fireEvent.click(buttons[0]);
    expect(played).toBe(1);
    // Without the handler there is nothing to click
    cleanup();
    expect(render(<PointsCard />).container.querySelector('[data-points-play]')).toBeNull();
  });
});
