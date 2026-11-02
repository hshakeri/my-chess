import { describe, it, expect } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { caroKannExchangeLesson } from '../../../src/curriculum/blackRepertoire';
import { patternPath } from '../../../src/curriculum/patternPath';
import seedGamesRaw from '../../../src/data/seed_hoot65_games.json';
import type { StoredGame } from '../../../src/types/db';

const seed = seedGamesRaw as unknown as StoredGame[];
const after = (...moves: string[]) => {
  const chess = new Chess();
  for (const m of moves) chess.move(m);
  return chess;
};
const attacks = (chess: Chess, square: string, color: 'w' | 'b') => chess.attackers(square as Square, color).sort();
const material = (chess: Chess) => {
  const v: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return chess.board().flat().reduce((n, p) => n + (p ? (p.color === 'w' ? 1 : -1) * v[p.type] : 0), 0);
};
const X = ['e4', 'c6', 'd4', 'd5', 'exd5', 'cxd5'];

describe('Caro-Kann Exchange: every fact the lesson states, replayed', () => {
  it('4.Nf3 Bg4 pins the knight, and the d4 pawn closes the fourth rank; ...Bf5 comes out before ...e6 would shut it in', () => {
    const bg4 = after(...X, 'Nf3', 'Bg4');
    expect(bg4.get('e2')).toBeUndefined();
    expect(attacks(bg4, 'f3', 'b')).toContain('g4');
    expect(bg4.get('d4')).toMatchObject({ type: 'p', color: 'w' });
    // On the c8-f5 diagonal, e6 is the square ...e6 would block
    expect(after(...X, 'Nc3', 'Bf5').get('e6')).toBeUndefined();
  });

  it('against 5.Bd3 the lesson trades or retreats; an undefended bishop on f5 is taken; 5...e6 6.Bxf5 exf5 7.Qe2+ Be7 8.Qb5+ Nc6 9.Nxd5 wins the d5 pawn', () => {
    const bd3 = after(...X, 'Nc3', 'Bf5', 'Bd3');
    expect(attacks(bd3, 'f5', 'w')).toContain('d3');
    expect(attacks(bd3, 'f5', 'b')).toEqual([]);
    // After 5...e6 the bishop is defended, and 6.Bxf5 is a trade
    expect(attacks(after(...X, 'Nc3', 'Bf5', 'Bd3', 'e6'), 'f5', 'b')).toEqual(['e6']);
    const line = after(...X, 'Nc3', 'Bf5', 'Bd3', 'e6', 'Bxf5', 'exf5', 'Qe2+', 'Be7', 'Qb5+', 'Nc6');
    const before = material(line);
    expect(line.move('Nxd5').captured).toBe('p');
    expect(material(line) - before).toBe(1);
    // Black's f-pawns are doubled
    expect(['f7', 'f5'].map((sq) => line.get(sq as Square))).toEqual([
      { type: 'p', color: 'b' },
      { type: 'p', color: 'b' },
    ]);
  });

  it('after 5...Nc6 a bishop on b5 pins without check; after 5...e6 it checks, and against ...Nd7 the knight on e5 makes two attackers', () => {
    const pin = after(...X, 'Nc3', 'Bf5', 'Nf3', 'Nc6', 'Bb5');
    expect(pin.inCheck()).toBe(false);
    expect(pin.get('d7')).toBeUndefined();
    expect(attacks(pin, 'c6', 'w')).toContain('b5');
    const check = after(...X, 'Nc3', 'Bf5', 'Nf3', 'e6', 'Bb5+');
    expect(check.inCheck()).toBe(true);
    expect(check.moves().sort()).toEqual(['Ke7', 'Nc6', 'Nd7', 'Qd7']);
    const twice = after(...X, 'Nc3', 'Bf5', 'Nf3', 'e6', 'Bb5+', 'Nd7', 'Ne5');
    expect(attacks(twice, 'd7', 'w')).toEqual(['b5', 'e5']);
    const won = after(...X, 'Nc3', 'Bf5', 'Nf3', 'e6', 'Bb5+', 'Nd7', 'Ne5', 'Nf6', 'Bg5', 'Be7', 'Bxf6', 'gxf6', 'Nxd7');
    expect(material(won)).toBe(3);
    won.move('Qxd7');
    expect(won.move('Bxd7+').captured).toBe('q');
  });

  it('...a6 asks the bishop, and after ...bxc6 the c6 pawn supports d5 with the f5 bishop still on the board', () => {
    expect(attacks(after(...X, 'Nc3', 'Bf5', 'Nf3', 'Nc6', 'Bb5', 'a6'), 'b5', 'b')).toContain('a6');
    const end = after(...X, 'Nc3', 'Bf5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6+', 'bxc6');
    expect(attacks(end, 'd5', 'b')).toContain('c6');
    expect(end.get('f5')).toMatchObject({ type: 'b', color: 'b' });
  });

  it('the counts and weights come from the seed games', () => {
    const caro = seed.filter((g) => g.userColor === 'black' && g.movesSan[0] === 'e4' && g.movesSan[1] === 'c6');
    const count = (prefix: string[]) => caro.filter((g) => prefix.every((m, k) => g.movesSan[k] === m)).length;
    const exchange = caro.filter((g) => X.slice(0, 5).every((m, k) => g.movesSan[k] === m));
    const points = exchange.reduce((n, g) => n + (g.userResult === 'win' ? 1 : g.userResult === 'draw' ? 0.5 : 0), 0);
    expect([exchange.length, points]).toEqual([4, 2]);
    const m = caroKannExchangeLesson.moves;
    expect(m[4].frequency).toBe(count(X.slice(0, 5)));
    expect(m[6].frequency).toBe(count([...X, 'Nc3']));
    expect(m[6].alternatives!.Nf3[0].frequency).toBe(count([...X, 'Nf3']));
    expect(m[6].alternatives!.Nf3[1].frequency).toBe(count([...X, 'Nf3', 'Bg4', 'Be2']));
    expect(m[8].frequency).toBe(count([...X, 'Nc3', 'Bf5', 'Nf3']));
    expect(m[8].alternatives!.Bd3[0].frequency).toBe(count([...X, 'Nc3', 'Bf5', 'Bd3']));
    // "as you did" (5...Bg6) and "you chose it in both games" (5...e6)
    expect(exchange.filter((g) => g.movesSan[8] === 'Bd3').map((g) => g.movesSan[9])).toEqual(['Bg6']);
    expect(exchange.filter((g) => g.movesSan[8] === 'Nf3').map((g) => g.movesSan[9])).toEqual(['e6', 'e6']);
  });

  it('sits in the study path with the Caro-Kann bishop lessons', () => {
    const group = patternPath.find((g) => g.lessonIds.includes(caroKannExchangeLesson.id));
    expect(group?.id).toBe('pattern-caro-bishop-both-sides');
    // The header names no answer: not the square f5, the knight's c6 or the trade
    for (const header of [caroKannExchangeLesson.title, caroKannExchangeLesson.subtitle ?? '']) expect(header).not.toMatch(/f5|g6|c6|Bxd3/);
  });
});
