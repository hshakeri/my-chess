import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { canonicalFenKey } from '../../../src/services/fenKey';

function fenAfter(sans: string[]): string {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return chess.fen();
}

describe('canonicalFenKey', () => {
  it('keeps the first four FEN fields and drops the move counters', () => {
    const key = canonicalFenKey('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(key).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -');
    expect(key.split(' ')).toHaveLength(4);
  });

  it('gives transpositions reached by different move orders the same key', () => {
    const viaKnight = fenAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
    const viaBishop = fenAfter(['e4', 'e5', 'Bc4', 'Nc6', 'Nf3', 'Bc5']);
    expect(viaKnight).toBe(viaBishop);
    expect(canonicalFenKey(viaKnight)).toBe(canonicalFenKey(viaBishop));

    const slavA = fenAfter(['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6']);
    const slavB = fenAfter(['d4', 'd5', 'Nf3', 'Nf6', 'c4', 'c6']);
    expect(canonicalFenKey(slavA)).toBe(canonicalFenKey(slavB));
  });

  it('ignores differing halfmove and fullmove counters', () => {
    const a = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
    const b = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 9';
    expect(canonicalFenKey(a)).toBe(canonicalFenKey(b));
  });

  it('accepts a four-field FEN', () => {
    expect(canonicalFenKey('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -')).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
    );
  });

  it('separates positions that differ only in the side to move', () => {
    const placement = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
    expect(canonicalFenKey(`${placement} w KQkq - 0 1`)).not.toBe(canonicalFenKey(`${placement} b KQkq - 0 1`));
  });

  it('separates positions that differ only in castling rights', () => {
    const placement = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w';
    expect(canonicalFenKey(`${placement} KQkq - 0 1`)).not.toBe(canonicalFenKey(`${placement} Kk - 0 1`));
  });

  it('normalises a stale en-passant square to "-" when no capture is legal', () => {
    // After 1.e4 e5 many writers print e6 although no white pawn can capture there.
    const stale = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
    const clean = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    expect(canonicalFenKey(stale)).toBe(canonicalFenKey(clean));
    expect(canonicalFenKey(stale).endsWith(' -')).toBe(true);
  });

  it('keeps the en-passant square when the capture is actually legal', () => {
    // 1.e4 d5 2.e5 f5: exf6 en passant is legal.
    const fen = fenAfter(['e4', 'd5', 'e5', 'f5']);
    expect(fen).toContain(' f6 ');
    const chess = new Chess(fen);
    expect(chess.moves({ verbose: true }).some((m) => m.isEnPassant() && m.san === 'exf6')).toBe(true);
    expect(canonicalFenKey(fen)).toBe('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6');
  });

  it('normalises the square when the only en-passant capture would expose the king', () => {
    // White Ka5, Pe5; Black Kh8, Rh5, Pd5 (just pushed d7-d5). exd6 e.p. would
    // open the fifth rank for the rook, so the capture is illegal.
    const fen = '7k/8/8/K2pP2r/8/8/8/8 w - d6 0 1';
    const chess = new Chess(fen);
    expect(chess.moves({ verbose: true }).some((m) => m.isEnPassant())).toBe(false);
    expect(canonicalFenKey(fen)).toBe('7k/8/8/K2pP2r/8/8/8/8 w - -');
  });

  it('throws on an illegal FEN instead of producing a key', () => {
    expect(() => canonicalFenKey('garbage w - - 0 1')).toThrow();
    expect(() => canonicalFenKey('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w')).toThrow(/four fields/);
    expect(() => canonicalFenKey('')).toThrow();
  });
});
