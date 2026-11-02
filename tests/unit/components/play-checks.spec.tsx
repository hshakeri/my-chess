// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react';

// Maia is replaced by scripted replies; the safety check runs the real search, answering a little later like the worker
const mocks = vi.hoisted(() => ({ replies: [] as string[], safetyDelay: 0, safetyCalls: 0 }));

vi.mock('../../../src/engine/worker/engineClient', async () => {
  const { Chess } = await import('chess.js');
  const { moveVerdict } = await import('../../../src/services/microQuestions');
  const { withinNodes } = await import('../../../src/analytics/errorTaxonomy');
  class EngineClient {
    onStatusChange() {
      return () => undefined;
    }
    isModelLoaded() {
      return false;
    }
    async requestMove(req: { fen: string }) {
      const chess = new Chess(req.fen);
      let san = mocks.replies.shift();
      try {
        if (!san) throw new Error('no reply scripted');
        chess.move(san);
      } catch {
        san = chess.moves()[0];
      }
      return { type: 'move', bestMoveSan: san, bestMoveUci: '', candidateMoves: [], tierUsed: 'heuristic_fallback' };
    }
    checkMoveSafety(fen: string, san: string, maxNodes: number) {
      mocks.safetyCalls++;
      return new Promise((resolve) => setTimeout(() => resolve(withinNodes(maxNodes, () => moveVerdict(fen, san)) ?? null), mocks.safetyDelay));
    }
    reviewGame() {
      return { result: Promise.resolve(null), cancel: () => undefined };
    }
    terminate() {}
  }
  return { EngineClient };
});

import { App } from '../../../src/App';

(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => undefined;
const square = (c: HTMLElement, s: string) => c.querySelector(`[data-square="${s}"]`) as HTMLElement;
const piece = (c: HTMLElement, s: string) => square(c, s).getAttribute('data-piece');
const move = (c: HTMLElement, from: string, to: string) => {
  fireEvent.click(square(c, from));
  fireEvent.click(square(c, to));
};
const questions = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-section="board-question"]')) as HTMLElement[];
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
// White to move: after 1.h3 the move ...h6 is safe, after 1.a3 it leaves the b4 bishop to be taken
const FEN = '4k3/7p/8/8/1b6/8/PP5P/6K1 w - - 0 1';
const playAsBlack = async (fen: string) => {
  await act(async () => {
    window.location.hash = `#/play?fen=${encodeURIComponent(fen)}&color=b`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};

describe("The Play tab's checks stay with their position", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.replies = [];
    mocks.safetyDelay = 0;
    mocks.safetyCalls = 0;
  });
  afterEach(() => cleanup());

  it('a new game asks the board question about its own position, not the last game\'s', async () => {
    localStorage.setItem('my_chess_play_gate', 'on');
    mocks.replies = ['e5', 'c5'];
    const { container: c } = render(<App />);
    await waitFor(() => expect(piece(c, 'e2')).toBe('wp'));
    move(c, 'e2', 'e4');
    await waitFor(() => expect(questions(c)[0]?.textContent).toContain('does e5 attack'), { timeout: 5000 });
    // Left unanswered: a new game, the same first move, another reply
    fireEvent.click(c.querySelector('[data-action="new-game"]')!);
    await waitFor(() => expect(piece(c, 'e4')).toBe(null));
    move(c, 'e2', 'e4');
    await waitFor(() => expect(piece(c, 'c5')).toBe('bp'), { timeout: 5000 });
    await waitFor(() => expect(questions(c)[0]?.textContent).toContain('does c5 attack'));
    expect(questions(c)).toHaveLength(1);
  });

  it('a safety check answered before a takeback does not play its move after the engine moves again', async () => {
    localStorage.setItem('my_chess_play_safety', 'on');
    mocks.replies = ['h3', 'a3'];
    mocks.safetyDelay = 400;
    const { container: c } = render(<App />);
    await waitFor(() => expect(piece(c, 'e2')).toBe('wp'));
    await playAsBlack(FEN);
    await waitFor(() => expect(piece(c, 'h3')).toBe('wp'), { timeout: 5000 });
    move(c, 'h7', 'h6');
    await waitFor(() => expect(questions(c)).toHaveLength(1));
    fireEvent.click(c.querySelector('[data-answer="yes"]')!);
    // The verdict is still on its way: take back the engine's move, and it plays another
    fireEvent.click(c.querySelector('[data-action="takeback"]')!);
    await waitFor(() => expect(piece(c, 'a3')).toBe('wp'), { timeout: 5000 });
    await pause(800);
    expect(piece(c, 'h7')).toBe('bp');
    expect(piece(c, 'h6')).toBe(null);
    expect(questions(c)).toHaveLength(0);
    expect(localStorage.getItem('my_chess_cct_log_v1')).toBe(null);
  });

  it('an unanswered safety check does not come back after a takeback: the next move gets its own', async () => {
    localStorage.setItem('my_chess_play_safety', 'on');
    mocks.replies = ['h3', 'a3'];
    const { container: c } = render(<App />);
    await waitFor(() => expect(piece(c, 'e2')).toBe('wp'));
    await playAsBlack(FEN);
    await waitFor(() => expect(piece(c, 'h3')).toBe('wp'), { timeout: 5000 });
    move(c, 'h7', 'h6');
    await waitFor(() => expect(questions(c)).toHaveLength(1));
    fireEvent.click(c.querySelector('[data-action="takeback"]')!);
    await waitFor(() => expect(piece(c, 'a3')).toBe('wp'), { timeout: 5000 });
    expect(questions(c)).toHaveLength(0);
    const searches = mocks.safetyCalls;
    move(c, 'b4', 'e7');
    await waitFor(() => expect(questions(c)[0]?.textContent).toContain('Before Be7 is played'));
    expect(mocks.safetyCalls).toBe(searches + 1);
  });

  it('a safe move that leaves a free piece is not played at once: the check names the capture', async () => {
    localStorage.setItem('my_chess_play_safety', 'on');
    const { container: c } = render(<App />);
    await waitFor(() => expect(piece(c, 'e2')).toBe('wp'));
    // 1.e4 e5 2.Nf3 Qh4??, White to move: the queen on h4 can be taken
    await act(async () => {
      window.location.hash = `#/play?fen=${encodeURIComponent('rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3')}&color=w`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => expect(piece(c, 'h4')).toBe('bq'), { timeout: 5000 });
    move(c, 'd2', 'd3');
    await waitFor(() => expect(questions(c)).toHaveLength(1));
    fireEvent.click(c.querySelector('[data-answer="yes"]')!);
    await waitFor(() => expect(c.querySelector('[data-safety-missed]')?.getAttribute('data-safety-missed')).toBe('Nxh4'));
    // Not played: the student can take instead
    expect(piece(c, 'd2')).toBe('wp');
    move(c, 'f3', 'h4');
    await waitFor(() => expect(questions(c)[0]?.textContent).toContain('Before Nxh4 is played'));
  });
});
