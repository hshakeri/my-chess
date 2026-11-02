import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { classifyMove, enPrise, matesInOne } from '../../../src/analytics/errorTaxonomy';

/** The position after `moves` from the standard start. */
const after = (...moves: string[]) => {
  const c = new Chess();
  for (const m of moves) c.move(m);
  return c.fen();
};

describe('errorTaxonomy: what a move got wrong (CL-3)', () => {
  it('a mate in one that was not played', () => {
    // 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6??: White mates with Qxf7#
    const fen = after('e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6');
    expect(matesInOne(fen)).toEqual(['Qxf7#']);
    const r = classifyMove(fen, 'Qe2');
    expect(r.type).toBe('missed_mate');
    expect(r.missed).toBe('Qxf7#');
    expect(r.keeping).toEqual(['Qxf7#']);
  });

  it('a move after which the opponent mates at once', () => {
    const fen = after('e4', 'e5', 'Bc4', 'Nc6', 'Qh5');
    const r = classifyMove(fen, 'Nf6');
    expect(r.type).toBe('allowed_mate');
    expect(r.refutation).toBe('Qxf7#');
    // Every move offered as an answer stops the mate
    for (const m of r.keeping) {
      const c = new Chess(fen);
      c.move(m);
      expect(c.moves().some((x) => x.endsWith('#')), m).toBe(false);
    }
    expect(r.keeping).toContain('g6');
  });

  it('the moved piece lands where it is taken: 3.Qxe5+?? Nxe5', () => {
    const fen = after('e4', 'e5', 'Qh5', 'Nc6');
    const r = classifyMove(fen, 'Qxe5+');
    expect(r.type).toBe('moved_piece_hangs');
    expect(r.refutation).toBe('Nxe5');
    expect(r.squares).toEqual(['e5']);
    expect(r.loss).toBeGreaterThanOrEqual(700);
    expect(r.keeping).not.toContain('Qxe5+');
  });

  it('an attacked piece left where it was: the b5 bishop after 3...a6', () => {
    const fen = after('e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6');
    expect(enPrise(new Chess(fen), 'w').map((p) => p.square)).toEqual(['b5']);
    const r = classifyMove(fen, 'd3');
    expect(r.type).toBe('failed_to_save');
    expect(r.refutation).toBe('axb5');
    expect(r.squares).toEqual(['b5']);
    expect(r.keeping).toEqual(expect.arrayContaining(['Ba4', 'Bxc6']));
  });

  it('a move that takes the only defender from another piece', () => {
    // The f3 knight is all that guards the e5 bishop from the e8 rook
    const fen = '4r1k1/5ppp/8/4B3/8/5N2/5PPP/6K1 w - - 0 1';
    expect(enPrise(new Chess(fen), 'w')).toEqual([]);
    const r = classifyMove(fen, 'Ng5');
    expect(r.type).toBe('left_piece_hangs');
    expect(r.refutation).toBe('Rxe5');
    expect(r.squares).toEqual(['e5']);
  });

  it('a piece that could be won and was not taken', () => {
    const fen = '4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1';
    const r = classifyMove(fen, 'Ke2');
    expect(r.type).toBe('missed_capture');
    expect(r.missed).toBe('Rxd5');
    expect(r.squares).toEqual(['d5']);
  });

  it('a quiet move that loses no material is positional, with no answer to check', () => {
    const r = classifyMove(new Chess().fen(), 'a3');
    expect(r).toEqual({ type: 'positional', loss: 0, keeping: [], squares: [] });
  });
});
