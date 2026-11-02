// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { PracticeClock } from '../../../src/components/PracticeClock';

describe('Practice clock (DC-3)', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('runs the clock of the side to move, restores it on a takeback, cues a long think and flags at zero', () => {
    vi.useFakeTimers();
    let t = 1_000_000;
    const now = () => t;
    const flags: string[] = [];
    const props = { resetKey: 0, student: 'w' as const, live: true, onFlag: (s: 'w' | 'b') => flags.push(s), now };
    const view = render(<PracticeClock {...props} turn="w" ply={0} />);
    const clock = (side: string) => view.container.querySelector(`[data-clock-side="${side}"]`);
    // Off by default
    expect(clock('w')).toBeNull();
    fireEvent.change(view.container.querySelector('select[data-select="practice-clock"]')!, { target: { value: '600+0' } });
    expect(clock('w')?.textContent).toBe('You 10:00');
    expect(clock('b')?.textContent).toBe('Maia 10:00');

    // White thinks 12 seconds, then moves; Black answers in one
    t += 12_000;
    act(() => vi.advanceTimersByTime(200));
    expect(clock('w')?.getAttribute('data-ms')).toBe('588000');
    view.rerender(<PracticeClock {...props} turn="b" ply={1} />);
    t += 1_000;
    view.rerender(<PracticeClock {...props} turn="w" ply={2} />);
    expect(clock('w')?.textContent).toBe('You 9:48');
    expect(clock('b')?.textContent).toBe('Maia 9:59');

    // Past 30 seconds on a move: the cue, and the long think counted once the move is made
    t += 31_000;
    act(() => vi.advanceTimersByTime(200));
    expect(view.container.querySelector('[data-think-cue]')).not.toBeNull();
    view.rerender(<PracticeClock {...props} turn="b" ply={3} />);
    expect(view.container.querySelector('[data-long-thinks]')?.getAttribute('data-long-thinks')).toBe('1');
    expect(clock('w')?.getAttribute('data-ms')).toBe(String(588_000 - 31_000));

    // A takeback of two plies: the clocks of the position after ply 1
    view.rerender(<PracticeClock {...props} turn="b" ply={1} />);
    expect(clock('w')?.getAttribute('data-ms')).toBe('588000');
    expect(clock('b')?.getAttribute('data-ms')).toBe('600000');

    // Black (Maia) to move runs out: the flag
    t += 600_000;
    act(() => vi.advanceTimersByTime(200));
    expect(flags).toEqual(['b']);
  });

  it('adds the increment from the first move on, and starts again on a new game', () => {
    vi.useFakeTimers();
    let t = 0;
    const now = () => t;
    const resets: number[] = [];
    const props = { student: 'both' as const, live: true, onFlag: () => undefined, onReset: () => resets.push(t), now };
    const view = render(<PracticeClock {...props} resetKey={0} turn="w" ply={0} />);
    fireEvent.change(view.container.querySelector('select[data-select="practice-clock"]')!, { target: { value: '180+2' } });
    t += 5_000;
    view.rerender(<PracticeClock {...props} resetKey={0} turn="b" ply={1} />);
    expect(view.container.querySelector('[data-clock-side="w"]')?.textContent).toBe('White 2:57');
    view.rerender(<PracticeClock {...props} resetKey={1} turn="w" ply={0} />);
    expect(view.container.querySelector('[data-clock-side="w"]')?.textContent).toBe('White 3:00');
    expect(resets.length).toBeGreaterThanOrEqual(3);
  });
});
