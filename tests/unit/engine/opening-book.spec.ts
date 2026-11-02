import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { HumanOpeningBook } from '@/engine/human/openingBook';
import bookData from '@/data/openingBook.json';

describe('F05 Tier 1 Human Opening Book', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('provides human opening moves with frequencies from starting position', () => {
    // The book is hoot65's opponents' moves (DC-6, scripts/game-analysis/opening-book.mjs): as White
    // they open 1.e4 most, then 1.d4 and 1.c4 (1.Nf3 is under the 2% a move needs)
    const candidates = HumanOpeningBook.lookup(startFen);
    expect(candidates).not.toBeNull();
    const moves = candidates!.map((c) => c.san);
    expect(moves.slice(0, 2)).toEqual(['e4', 'd4']);
    expect(moves).toContain('c4');

    // Probabilities sum to 1.0 (within float tolerance)
    const totalProb = candidates!.reduce((acc, c) => acc + c.probability, 0);
    expect(totalProb).toBeCloseTo(1.0, 2);
  });

  it('every book position is a legal position, every move legal there, and the shares add up to 1', () => {
    const entries = Object.entries(bookData as Record<string, Array<{ san: string; uci: string; probability: number }>>);
    expect(entries.length).toBeGreaterThanOrEqual(200);
    for (const [fen, candidates] of entries) {
      for (const c of candidates) {
        const move = new Chess(fen).move(c.san);
        expect(move.from + move.to + (move.promotion ?? ''), `${fen} ${c.san}`).toBe(c.uci);
        expect(c.probability).toBeGreaterThan(0);
      }
      expect(candidates.reduce((a, c) => a + c.probability, 0), fen).toBeCloseTo(1, 3);
    }
  });

  it('provides human response distribution against 1.e4', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const candidates = HumanOpeningBook.lookup(afterE4);
    expect(candidates).not.toBeNull();

    const sans = candidates!.map((c) => c.san);
    expect(sans).toContain('e5');
    expect(sans).toContain('c5'); // Sicilian
    expect(sans).toContain('c6'); // Caro-Kann
    expect(sans).toContain('d5'); // Scandinavian
  });

  it('selects move according to weighted human frequencies', () => {
    const selection = HumanOpeningBook.selectMove(startFen);
    expect(selection).not.toBeNull();
    expect(['e4', 'd4', 'c4', 'Nf3']).toContain(selection!.bestMoveSan);
    expect(selection!.candidateMoves.length).toBeGreaterThan(0);
    expect(selection!.bestMoveUci).toBeDefined();
  });

  it('normalizes FEN ignoring move number and 50-move clock', () => {
    // Exact same position but with move count 99 and clock 10
    const modifiedFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 10 99';
    const candidates = HumanOpeningBook.lookup(modifiedFen);
    expect(candidates).not.toBeNull();
    expect(candidates!.map((c) => c.san)).toContain('e4');
  });

  it('returns null when position is outside the opening book', () => {
    // Middlegame or endgame position
    const endgameFen = '8/8/8/4k3/8/8/4K3/8 w - - 0 40';
    const candidates = HumanOpeningBook.lookup(endgameFen);
    expect(candidates).toBeNull();

    const selection = HumanOpeningBook.selectMove(endgameFen);
    expect(selection).toBeNull();
  });

  it('handles empty or malformed FEN gracefully without throwing', () => {
    expect(HumanOpeningBook.lookup('')).toBeNull();
    expect(HumanOpeningBook.lookup('garbage_fen_string')).toBeNull();
    expect(HumanOpeningBook.selectMove('')).toBeNull();
  });
});
