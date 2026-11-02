import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  cardSpecsFromReview,
  clocksFromPgn,
  MAIA_RATING_OFFSET,
  moveLabel,
  phaseOf,
  ReviewCancelled,
  reviewGame,
  timeControlFromPgn,
  type PositionScorer,
  type ScoreRequest,
} from '../../../src/analytics/review';

// Scholar's mate: hoot65 has Black and allows 4.Qxf7# with 3...Nf6
const moves = ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'];
const pgn =
  '[TimeControl "600+5"]\n\n1. e4 {[%clk 0:09:58]} 1... e5 {[%clk 0:09:55]} 2. Bc4 {[%clk 0:09:50]} 2... Nc6 {[%clk 0:09:40]} 3. Qh5 {[%clk 0:09:45]} 3... Nf6 {[%clk 0:09:20.5]} 4. Qxf7# {[%clk 0:09:44]} 1-0';
const input = { gameId: 'g', movesSan: moves, userColor: 'black' as const, whiteRating: 1200, blackRating: 1150, pgn };

/** A stand-in for Maia: every position even, except those listed as won for White (White to move). */
function fakeMaia(seen: ScoreRequest[][], wonForWhite: string[]): PositionScorer {
  return async (requests, onProgress) => {
    seen.push(requests);
    onProgress?.(requests.length, requests.length);
    return requests.map((r) => {
      const c = new Chess(r.fen);
      if (c.moves().length === 0) return null;
      const won = wonForWhite.some((prefix) => r.fen.startsWith(prefix));
      const legal = c.moves({ verbose: true });
      return { winProbability: won ? 0.95 : 0.5, moves: new Map(legal.map((m) => [`${m.from}${m.to}`, 1 / legal.length])) };
    });
  };
}
const AFTER_NF6 = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w';
const AFTER_NC6 = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w';

describe('reviewGame: the moves that cost hoot65 points, and why (CL-3)', () => {
  it('flags the move that lost the expected score, names it, and reads the clock', async () => {
    const seen: ScoreRequest[][] = [];
    const review = await reviewGame(input, fakeMaia(seen, [AFTER_NF6]), { now: 1 });
    expect(review.engine).toBe('maia');
    expect(review.movesReviewed).toBe(3);
    expect(review.criticalMoments).toHaveLength(1);
    const m = review.criticalMoments[0];
    expect(m).toMatchObject({ ply: 5, label: '3...Nf6', played: 'Nf6', type: 'allowed_mate', refutation: 'Qxf7#', phase: 'opening', expectedBefore: 0.5 });
    expect(m.expectedAfter).toBeCloseTo(0.05);
    expect(m.playedShare).toBeGreaterThan(0);
    // Black's clock showed 9:40 after 2...Nc6 and 9:20.5 after 3...Nf6, with a 5 s increment
    expect(m.clockLeft).toBe(580);
    expect(m.spent).toBe(25);
    // Maia saw every position with up to seven before it, and both ratings plus the Lichess offset
    const requests = seen[0];
    expect(requests).toHaveLength(moves.length + 1);
    expect(requests[1]).toMatchObject({ selfElo: 1150 + MAIA_RATING_OFFSET, oppoElo: 1200 + MAIA_RATING_OFFSET });
    expect(requests[2]).toMatchObject({ selfElo: 1200 + MAIA_RATING_OFFSET, oppoElo: 1150 + MAIA_RATING_OFFSET });
    expect(requests[7].priorFens).toHaveLength(7);
    expect(requests[3].priorFens).toEqual(requests[4].priorFens.slice(0, 3));
  });

  it('keeps a flagged move that loses no material as positional, and makes a card only for the mistake it can check', async () => {
    const review = await reviewGame(input, fakeMaia([], [AFTER_NF6, AFTER_NC6]), { now: 1 });
    expect(review.criticalMoments.map((m) => [m.label, m.type])).toEqual([
      ['2...Nc6', 'positional'],
      ['3...Nf6', 'allowed_mate'],
    ]);
    const specs = cardSpecsFromReview(review, 'rival');
    expect(specs).toHaveLength(1);
    const [spec] = specs;
    expect(spec).toMatchObject({ lessonId: 'review:g', color: 'b', ply: 5, path: [], tags: ['blunder:allowed_mate', 'game:g'], title: 'Your game vs rival, move 3' });
    expect(spec.fen).toBe(review.criticalMoments[1].fenBefore);
    // Every accepted answer stops the mate
    expect(spec.acceptedSan).toContain('g6');
    for (const san of spec.acceptedSan) {
      const c = new Chess(spec.fen);
      c.move(san);
      expect(c.moves().some((x) => x.endsWith('#')), san).toBe(false);
    }
  });

  it('without Maia, finds the material and mate mistakes alone', async () => {
    const review = await reviewGame(input, null, { now: 1 });
    expect(review.engine).toBe('material');
    expect(review.criticalMoments.map((m) => [m.label, m.type, m.expectedBefore])).toEqual([['3...Nf6', 'allowed_mate', undefined]]);
  });

  it('stops when cancelled', async () => {
    await expect(reviewGame(input, fakeMaia([], [AFTER_NF6]), { isCancelled: () => true })).rejects.toBeInstanceOf(ReviewCancelled);
  });

  it('reads clocks and time controls, and labels plies and phases as the archive scan does', () => {
    expect(clocksFromPgn(pgn)).toEqual([598, 595, 590, 580, 585, 560.5, 584]);
    expect(clocksFromPgn(undefined)).toEqual([]);
    expect(timeControlFromPgn(pgn)).toEqual({ base: 600, increment: 5 });
    expect(timeControlFromPgn('[TimeControl "180"]')).toEqual({ base: 180, increment: 0 });
    expect(timeControlFromPgn('')).toBeNull();
    expect([phaseOf(0), phaseOf(19), phaseOf(20), phaseOf(59), phaseOf(60)]).toEqual(['opening', 'opening', 'middlegame', 'middlegame', 'endgame']);
    expect([moveLabel(0, 'e4'), moveLabel(5, 'Nf6')]).toEqual(['1.e4', '3...Nf6']);
  });
});
