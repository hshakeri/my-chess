// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Chess } from 'chess.js';
import { allCurriculumLessons } from '../../../src/curriculum';
import { SpeedRunPanel, SPEED_LOG_KEY, bestSpeedRun, readSpeedRecords, speedMoves, type SpeedRecord } from '../../../src/views/SpeedRunPanel';

const lesson = (id: string) => allCurriculumLessons.find((l) => l.id === id)!;
const sq = (s: string) => document.querySelector(`[data-square="${s}"]`) as HTMLElement;

/** Click the student's move `san` from the position `fen`. */
function play(fen: string, san: string) {
  const m = new Chess(fen).move(san);
  fireEvent.click(sq(m.from));
  fireEvent.click(sq(m.to));
}

describe('Opening speed run', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it('counts the student moves after the auto-played start, and keeps the best clean run', () => {
    expect(speedMoves(lesson('lesson-queen-cage-box-mate'))).toBe(11);
    const scandi = lesson('lesson-scandinavian-refutation-drill');
    expect(speedMoves(scandi)).toBe(scandi.moves.slice(scandi.startPly ?? 0).filter((m) => m.isUserMove).length);
    const runs: SpeedRecord[] = [
      { lessonId: 'x', at: 1, totalMs: 9000, moves: 5, errors: 0, slow: 1 },
      { lessonId: 'x', at: 2, totalMs: 7000, moves: 5, errors: 2, slow: 0 },
      { lessonId: 'x', at: 3, totalMs: 8000, moves: 5, errors: 0, slow: 1 },
      { lessonId: 'y', at: 4, totalMs: 1000, moves: 5, errors: 0, slow: 0 },
    ];
    expect(bestSpeedRun('x', runs)?.totalMs).toBe(8000);
    expect(bestSpeedRun('z', runs)).toBeUndefined();
  });

  it('plays the line against the clock: a wrong move counts and does not advance, and the run is kept', async () => {
    const l = lesson('lesson-queen-cage-box-mate');
    const view = render(<SpeedRunPanel lesson={l} onClose={() => undefined} />);
    const modal = () => view.container.querySelector('[data-modal="speed-run"]')!;
    expect(modal().getAttribute('data-speed-phase')).toBe('ready');
    fireEvent.click(view.container.querySelector('[data-action="speed-start"]')!);
    expect(modal().getAttribute('data-speed-phase')).toBe('running');

    const board = new Chess(l.initialFen);
    // A legal move that is not the line's: counted as wrong, the board stays
    play(board.fen(), 'Qf5+');
    expect(view.container.querySelector('[data-speed-errors]')?.getAttribute('data-speed-errors')).toBe('1');
    expect(sq('f1').querySelector('img[alt="White q"]')).toBeTruthy();

    for (const m of l.moves) {
      if (m.isUserMove) play(board.fen(), m.san);
      board.move(m.san);
    }
    await waitFor(() => expect(modal().getAttribute('data-speed-phase')).toBe('done'));
    expect(view.container.querySelectorAll('[data-speed-move]')).toHaveLength(11);
    const [run] = readSpeedRecords();
    expect(run).toMatchObject({ lessonId: l.id, moves: 11, errors: 1 });
    expect(JSON.parse(window.localStorage.getItem(SPEED_LOG_KEY)!)).toHaveLength(1);
    expect(view.container.querySelector('[data-section="speed-summary"]')?.textContent).toContain('11 moves in');
  });

  it('starts a Black lesson after the auto-played opening moves, with the board from Black\'s side', () => {
    const l = lesson('lesson-black-caro-kann-advance');
    const view = render(<SpeedRunPanel lesson={l} onClose={() => undefined} />);
    fireEvent.click(view.container.querySelector('[data-action="speed-start"]')!);
    // 1.e4 is played for the student, who answers 1...c6
    expect(sq('e4').querySelector('img[alt="White p"]')).toBeTruthy();
    const after = new Chess();
    after.move('e4');
    play(after.fen(), 'c6');
    expect(view.container.querySelectorAll('[data-speed-move]')).toHaveLength(1);
    // White's 2.d4 came at once
    expect(sq('d4').querySelector('img[alt="White p"]')).toBeTruthy();
  });
});
