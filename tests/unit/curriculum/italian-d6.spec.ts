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
const D6 = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'd6'];
const BG4 = [...D6, 'O-O', 'Bg4'];
const ND4 = [...BG4, 'Re1', 'Nd4'];

describe('The Italian against 3...d6: every fact the branch states, replayed', () => {
  it('3...d6 leaves the f8 bishop only e7; 4...Bg4 pins the f3 knight to the queen, and nothing defends the bishop', () => {
    expect(after(...D6, 'O-O').moves({ square: 'f8' })).toEqual(['Be7']);
    const bg4 = after(...BG4);
    expect(bg4.get('e2')).toBeUndefined();
    expect(attacks(bg4, 'f3', 'b')).toEqual(['g4']);
    expect(attacks(bg4, 'g4', 'b')).toEqual([]);
  });

  it('after 5.Re1 Nd4 the knight and the bishop both hit f3; 6.Re3? loses the exchange, 6.c3? and 6.h3? let ...Nxf3+ gxf3', () => {
    expect(attacks(after(...ND4), 'f3', 'b')).toEqual(['d4', 'g4']);
    expect(material(after(...ND4, 'Re3', 'Bxf3', 'Rxf3', 'Nxf3+', 'Qxf3'))).toBe(-2);
    for (const move of ['c3', 'h3']) {
      const broken = after(...ND4, move, 'Nxf3+', 'gxf3');
      expect(broken.get('g2'), move).toBeUndefined();
    }
    expect(material(after(...ND4, 'h3', 'Nxf3+', 'gxf3', 'Bxh3'))).toBe(-1);
    expect(after(...ND4, 'c3', 'Nxf3+', 'gxf3').moves()).toContain('Bh3');
    expect(after(...ND4, 'Nxd4', 'Bxd1').get('d1')).toMatchObject({ type: 'b', color: 'b' });
  });

  it('6.Be2 lets the bishop take back on f3; 6...Nxe2+ is check, and after 7.Qxe2 material is level', () => {
    expect(after(...ND4, 'Be2', 'Nxf3+').moves()).toContain('Bxf3');
    const trade = after(...ND4, 'Be2', 'Nxe2+');
    expect(trade.inCheck()).toBe(true);
    trade.move('Qxe2');
    expect(material(trade)).toBe(0);
  });

  it('after 5.h3 Bxf3 6.Qxf3 the queen and the c4 bishop threaten Qxf7#; after 4...Be6 5.Bxe6 fxe6 Black has two e-pawns and one piece out', () => {
    const q = after(...BG4, 'h3', 'Bxf3', 'Qxf3');
    expect(attacks(q, 'f7', 'w')).toEqual(['c4', 'f3']);
    const ignored = new Chess(q.fen());
    ignored.move('a6');
    ignored.move('Qxf7+');
    expect(ignored.isCheckmate()).toBe(true);
    const bishops = (color: 'w' | 'b') => q.board().flat().filter((p) => p && p.type === 'b' && p.color === color).length;
    expect([bishops('w'), bishops('b')]).toEqual([2, 1]);

    const e6 = after(...D6, 'O-O', 'Be6', 'Bxe6', 'fxe6');
    expect([e6.get('e6'), e6.get('e5')]).toEqual([{ type: 'p', color: 'b' }, { type: 'p', color: 'b' }]);
    const home = new Set(['a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8']);
    const out = e6.board().flat().filter((p) => p && p.color === 'b' && p.type !== 'p' && p.type !== 'k' && !home.has(p.square));
    expect(out.map((p) => p!.square)).toEqual(['c6']);
    expect(e6.get('e8')).toMatchObject({ type: 'k', color: 'b' });
  });

  it('the counts come from the seed games, and the weights on the branch are those counts', () => {
    const white = seed.filter((g) => g.userColor === 'white' && D6.every((m, k) => g.movesSan[k] === m));
    const count = (prefix: string[]) => white.filter((g) => prefix.every((m, k) => g.movesSan[k] === m)).length;
    // "as you did in three of your four games with 3...d6"
    expect([white.length, count([...D6, 'O-O'])]).toEqual([4, 3]);
    // "5.Re1?! was your move in both of these games, and you lost both"
    const re1 = white.filter((g) => [...BG4, 'Re1'].every((m, k) => g.movesSan[k] === m));
    expect([count(BG4), re1.length, re1.map((g) => g.userResult)]).toEqual([2, 2, ['loss', 'loss']]);
    // "Trade the bishops, as in your game"
    expect(count([...D6, 'O-O', 'Be6', 'Bxe6'])).toBe(1);

    const bc5 = evansGambitDestruction.moves[5];
    const branch = bc5.alternatives!.d6 as CurriculumMove[];
    expect(branch[0].frequency).toBe(white.length);
    expect(branch[1].frequency).toBe(count(BG4));
    expect(branch[1].alternatives!.Be6[0].frequency).toBe(count([...D6, 'O-O', 'Be6']));
  });

  it('the exercise is the position after 5.Re1 Nd4, and its title names no move', () => {
    const ex = evansGambitDestruction.exercises.find((e) => e.id === 'ex-italian-d6-two-on-f3')!;
    expect(ex.fen).toBe(after(...ND4).fen());
    expect(ex.title).not.toMatch(/Be2|Nd4|Re1/);
  });
});
