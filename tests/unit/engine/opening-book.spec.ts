import { describe, it, expect } from 'vitest';
import { HumanOpeningBook } from '@/engine/human/openingBook';

describe('F05 Tier 1 Human Opening Book', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('provides human opening moves with frequencies from starting position', () => {
    const candidates = HumanOpeningBook.lookup(startFen);
    expect(candidates).not.toBeNull();
    expect(candidates!.length).toBeGreaterThanOrEqual(4);

    const moves = candidates!.map((c) => c.san);
    expect(moves).toContain('e4');
    expect(moves).toContain('d4');
    expect(moves).toContain('c4');
    expect(moves).toContain('Nf3');

    // Probabilities sum to 1.0 (within float tolerance)
    const totalProb = candidates!.reduce((acc, c) => acc + c.probability, 0);
    expect(totalProb).toBeCloseTo(1.0, 2);
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
