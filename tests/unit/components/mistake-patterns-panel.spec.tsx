// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { db } from '../../../src/db/database';
import { EngineContext } from '../../../src/engine/EngineContext';
import type { EngineClient } from '../../../src/engine/worker/engineClient';
import { MistakePatternsPanel } from '../../../src/views/MistakePatternsPanel';
import { GameReviewPanel } from '../../../src/views/GameReviewPanel';
import type { StoredGame } from '../../../src/types/db';
import type { CriticalMoment, GameReview } from '../../../src/types/review';

// hoot65's game vs Itilogic: 4.Nxe5? Qg5 and 7...Nf3# (White is hoot65)
const MOVES = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+', 'Be2', 'Nf3#'];
const game = (id: string, day: number): StoredGame => ({
  id,
  source: 'upload',
  pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3# 0-1',
  white: { name: 'hoot65', rating: 1150 },
  black: { name: 'Itilogic', rating: 1150 },
  result: '0-1',
  timestamp: Date.UTC(2026, 9, day),
  movesSan: MOVES,
  userColor: 'white',
});
const MOMENT: CriticalMoment = {
  ply: 6,
  label: '4.Nxe5',
  fenBefore: 'r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  played: 'Nxe5',
  type: 'moved_piece_hangs',
  loss: 300,
  keeping: ['Nxd4'],
  refutation: 'Qg5',
  squares: ['e5'],
  phase: 'opening',
};
const reviewOf = (gameId: string, extra: Partial<GameReview> = {}): GameReview => ({
  gameId,
  reviewedAt: Date.now(),
  engine: 'maia',
  userColor: 'white',
  movesReviewed: 7,
  criticalMoments: [MOMENT],
  marks: [],
  cardIds: [],
  ...extra,
});

/** An engine client whose reviews come back at once, or never (to test stopping), and that counts its calls. */
function fakeClient(mode: 'instant' | 'never' | 'forbidden') {
  const calls: string[] = [];
  const client = {
    reviewGame: (input: { gameId: string }) => {
      calls.push(input.gameId);
      if (mode === 'forbidden') throw new Error('the engine should not run');
      return {
        result: mode === 'instant' ? Promise.resolve(reviewOf(input.gameId)) : new Promise<GameReview | null>(() => undefined),
        cancel: () => undefined,
      };
    },
  } as unknown as EngineClient;
  return { client, calls };
}

describe('Mistake patterns and the batch review (CL-3)', () => {
  beforeEach(async () => {
    await db.reviews.clear();
    await db.cards.clear();
  });
  afterEach(() => cleanup());

  it('summarises the saved reviews and reviews the newest unreviewed games in a batch, saved as batch reviews', async () => {
    await db.reviews.put(reviewOf('a'));
    const games = [game('a', 1), game('b', 2), game('c', 3)];
    const { client, calls } = fakeClient('instant');
    const view = render(
      <EngineContext.Provider value={client}>
        <MistakePatternsPanel games={games} />
      </EngineContext.Provider>
    );
    const summary = () => view.container.querySelector('[data-section="mistake-summary"]');
    await waitFor(() => expect(summary()?.getAttribute('data-games')).toBe('1'));
    // 7 moves of hoot65's, one mistake: 14.3 per 100 moves, in the opening
    expect(summary()?.getAttribute('data-per100')).toBe('14.3');
    expect(view.container.querySelector('[data-mistake-type="moved_piece_hangs"]')).toBeTruthy();
    expect(view.container.querySelector('[data-batch-status]')?.textContent).toBe('2 of your games are not reviewed yet.');

    fireEvent.click(view.container.querySelector('[data-action="batch-review"]')!);
    await waitFor(() => expect(summary()?.getAttribute('data-games')).toBe('3'));
    expect(calls).toEqual(['c', 'b']); // newest first
    expect((await db.reviews.get('b'))?.source).toBe('batch');
    expect((await db.reviews.get('a'))?.source).toBeUndefined();
    expect(view.container.querySelector('[data-batch-status]')?.textContent).toBe('2 of 2 reviewed.');
    expect((view.container.querySelector('[data-action="batch-review"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('stops a batch on demand', async () => {
    const { client } = fakeClient('never');
    const view = render(
      <EngineContext.Provider value={client}>
        <MistakePatternsPanel games={[game('a', 1), game('b', 2)]} />
      </EngineContext.Provider>
    );
    await waitFor(() => expect(view.container.querySelector('[data-section="mistake-summary"]')?.getAttribute('data-games')).toBe('0'));
    fireEvent.click(view.container.querySelector('[data-action="batch-review"]')!);
    await waitFor(() => expect(view.container.querySelector('[data-section="batch-review"]')?.getAttribute('data-batch-running')).toBe('true'));
    fireEvent.click(view.container.querySelector('[data-action="batch-cancel"]')!);
    await waitFor(() => expect(view.container.querySelector('[data-section="batch-review"]')?.getAttribute('data-batch-running')).toBe('false'));
    expect(await db.reviews.count()).toBe(0);
  });

  it('a game with a batch review still asks for the marks first, then shows the batch review without running the engine', async () => {
    await db.reviews.put(reviewOf('b', { source: 'batch' }));
    const { client, calls } = fakeClient('forbidden');
    const view = render(
      <EngineContext.Provider value={client}>
        <GameReviewPanel game={game('b', 2)} currentPly={0} onShowPly={() => undefined} />
      </EngineContext.Provider>
    );
    const panel = () => view.container.querySelector('[data-section="game-review"]')!;
    await waitFor(() => expect(panel().getAttribute('data-review-phase')).toBe('idle'));
    expect(view.container.querySelector('[data-review-batch]')).toBeTruthy();
    fireEvent.click(view.container.querySelector('[data-action="review-start"]')!);
    expect(panel().getAttribute('data-review-phase')).toBe('marking');
    fireEvent.click(view.container.querySelector('[data-action="review-reveal"]')!);
    await waitFor(() => expect(panel().getAttribute('data-review-phase')).toBe('revealed'));
    expect(view.container.querySelector('[data-review-moment="6"]')).toBeTruthy();
    expect(calls).toEqual([]);
    const saved = await db.reviews.get('b');
    expect(saved?.source).toBeUndefined();
    expect(saved?.cardIds.length).toBe(1);
  });
});
