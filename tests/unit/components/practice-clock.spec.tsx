// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { PracticeClock, newClockStore } from '../../../src/components/PracticeClock';
import { cannotMate } from '../../../src/analytics/finalPosition';

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
    // The flagged clock stays at zero once the clocks stop
    view.rerender(<PracticeClock {...props} live={false} turn="b" ply={1} />);
    expect(clock('b')?.textContent).toBe('Maia 0:00');
  });

  it('after the student\'s move N compares the clock with the opponents\' pace at the same control', () => {
    vi.useFakeTimers();
    let t = 0;
    const now = () => t;
    const pace = { control: '600+0', targets: { 2: 590 } };
    const props = { resetKey: 0, student: 'w' as const, live: true, onFlag: () => undefined, pace, now };
    const view = render(<PracticeClock {...props} turn="w" ply={0} />);
    fireEvent.change(view.container.querySelector('select[data-select="practice-clock"]')!, { target: { value: '600+0' } });
    t += 3_000;
    view.rerender(<PracticeClock {...props} turn="b" ply={1} />);
    t += 1_000;
    view.rerender(<PracticeClock {...props} turn="w" ply={2} />);
    expect(view.container.querySelector('[data-pace-note]')).toBeNull();
    // White's second move after 4 s: 593 s left against the opponents' 590
    t += 4_000;
    view.rerender(<PracticeClock {...props} turn="b" ply={3} />);
    const note = view.container.querySelector('[data-pace-note]')!;
    expect(note.getAttribute('data-pace-note')).toBe('3');
    expect(note.textContent).toBe("After move 2: 9:53 left, 3 s ahead of your opponents' 9:50");
    // Another control: no pace
    fireEvent.change(view.container.querySelector('select[data-select="practice-clock"]')!, { target: { value: '300+0' } });
    expect(view.container.querySelector('[data-pace-note]')).toBeNull();
  });

  it('keeps its clocks when it leaves the screen and comes back to the same game, and a move after zero is a flag', () => {
    vi.useFakeTimers();
    let t = 0;
    const now = () => t;
    const store = newClockStore();
    const flags: string[] = [];
    const resets: number[] = [];
    const props = { resetKey: 7, student: 'w' as const, live: true, onFlag: (s: 'w' | 'b') => flags.push(s), onReset: () => resets.push(t), store, now };
    const first = render(<PracticeClock {...props} turn="w" ply={0} />);
    fireEvent.change(first.container.querySelector('select[data-select="practice-clock"]')!, { target: { value: '180+2' } });
    t += 10_000;
    first.rerender(<PracticeClock {...props} turn="b" ply={1} />);
    const resetsBefore = resets.length;
    first.unmount();
    // Another tab for a minute; Black's clock ran on meanwhile
    t += 60_000;
    const again = render(<PracticeClock {...props} turn="b" ply={1} />);
    expect(resets.length).toBe(resetsBefore);
    expect(again.container.querySelector('[data-clock-side="w"]')?.textContent).toBe('You 2:52');
    expect(again.container.querySelector('[data-clock-side="b"]')?.textContent).toBe('Maia 2:00');
    // Black moves after its clock ran out: the flag, and no increment
    t += 130_000;
    again.rerender(<PracticeClock {...props} turn="w" ply={2} />);
    expect(flags).toEqual(['b']);
    expect(again.container.querySelector('[data-clock-side="b"]')?.textContent).toBe('Maia 0:00');
  });

  it('a flag against a lone king, or a king and one minor piece, is a draw: that side cannot mate', () => {
    expect(cannotMate('8/8/8/4k3/8/8/8/4K3 w - - 0 1', 'w')).toBe(true);
    expect(cannotMate('8/8/8/4k3/8/8/8/3NK3 w - - 0 1', 'w')).toBe(true);
    expect(cannotMate('8/8/8/4k3/8/8/8/2BNK3 w - - 0 1', 'w')).toBe(false);
    expect(cannotMate('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1', 'w')).toBe(false);
    // Black's material does not count for White
    expect(cannotMate('3qk3/8/8/8/8/8/8/4K3 w - - 0 1', 'w')).toBe(true);
    expect(cannotMate('3qk3/8/8/8/8/8/8/4K3 w - - 0 1', 'b')).toBe(false);
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
