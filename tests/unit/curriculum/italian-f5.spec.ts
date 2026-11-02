import { describe, it, expect } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { evansGambitDestruction } from '../../../src/curriculum/openings';
import seedGamesRaw from '../../../src/data/seed_hoot65_games.json';
import type { StoredGame } from '../../../src/types/db';
import type { CurriculumMove } from '../../../src/types/curriculum';

const seed = seedGamesRaw as unknown as StoredGame[];
const after = (...moves: string[]) => {
  const chess = new Chess();
  for (const m of moves) chess.move(m);
  return chess;
};
const attacks = (chess: Chess, square: string, color: 'w' | 'b') => chess.attackers(square as Square, color).sort();
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const material = (chess: Chess) => chess.board().flat().reduce((n, p) => n + (p ? (p.color === 'w' ? 1 : -1) * VALUE[p.type] : 0), 0);
const F5 = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'f5'];

describe('The Italian against 3...f5: every fact the branch states, replayed', () => {
  it('3...f5 hits the e4 pawn, which nothing defends, and opens the c4 bishop\'s diagonal to g8; 4.d3 holds e4', () => {
    const f5 = after(...F5);
    expect(attacks(f5, 'e4', 'b')).toEqual(['f5']);
    expect(attacks(f5, 'e4', 'w')).toEqual([]);
    expect(attacks(f5, 'g8', 'w')).toEqual(['c4']);
    expect(attacks(after(...F5, 'd3'), 'e4', 'w')).toEqual(['d3']);
  });

  it('after 4.exf5 e4, 4.O-O fxe4 and 4.Nc3 fxe4 the pawn on e4 hits the f3 knight', () => {
    for (const line of [
      [...F5, 'exf5', 'e4'],
      [...F5, 'O-O', 'fxe4'],
      [...F5, 'Nc3', 'fxe4'],
    ]) {
      expect(attacks(after(...line), 'f3', 'b'), line.join(' ')).toEqual(['e4']);
    }
  });

  it('after 4.O-O fxe4, 5.Ng5 Qxg5 and 5.Nxe5 Nxe5 lose the knight; after 5.Ne1 d5 Black has three pawns in the centre', () => {
    expect(material(after(...F5, 'O-O', 'fxe4', 'Ng5', 'Qxg5'))).toBe(-4);
    expect(material(after(...F5, 'O-O', 'fxe4', 'Nxe5', 'Nxe5'))).toBe(-3);
    const ne1 = after(...F5, 'O-O', 'fxe4', 'Ne1', 'd5');
    expect(['d4', 'd5', 'e4', 'e5'].filter((sq) => ne1.get(sq as Square)?.color === 'b')).toEqual(['d5', 'e4', 'e5']);
  });

  it('after 4.d3 fxe4, 5.dxe4 takes back; 5.Ng5? d5 hits the c4 bishop and leaves Black the e4 pawn', () => {
    expect(material(after(...F5, 'd3', 'fxe4', 'dxe4'))).toBe(0);
    const ng5 = after(...F5, 'd3', 'fxe4', 'Ng5', 'd5');
    expect(attacks(ng5, 'c4', 'b')).toContain('d5');
    expect(ng5.get('e4')).toMatchObject({ type: 'p', color: 'b' });
  });

  it('the counts come from the seed games, and the weight on the branch is their number', () => {
    const white = seed.filter((g) => g.userColor === 'white' && F5.every((m, k) => g.movesSan[k] === m));
    // "4.exf5, your move in all three of these games ... your 5.Qe2 and 5.Ng1 both lost"
    expect(white.map((g) => g.movesSan[6])).toEqual(['exf5', 'exf5', 'exf5']);
    const fifth = (move: string) => white.filter((g) => g.movesSan[7] === 'e4' && g.movesSan[8] === move).map((g) => g.userResult);
    expect([fifth('Qe2'), fifth('Ng1')]).toEqual([['loss'], ['loss']]);
    const branch = evansGambitDestruction.moves[5].alternatives!.f5 as CurriculumMove[];
    expect(branch[0].frequency).toBe(white.length);
  });
});
