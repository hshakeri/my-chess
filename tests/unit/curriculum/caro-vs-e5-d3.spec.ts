import { describe, it, expect } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { caroKannE5D3Lesson } from '../../../src/curriculum/blackRepertoire';
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
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const material = (chess: Chess) => chess.board().flat().reduce((n, p) => n + (p ? (p.color === 'w' ? 1 : -1) * VALUE[p.type] : 0), 0);
const placement = (chess: Chess) => chess.fen().split(' ').slice(0, 2).join(' ');
const E5 = ['e4', 'c6', 'e5'];

describe('Caro-Kann vs 2.e5 and 2.d3: every fact the lesson states, replayed', () => {
  it('nothing defends the e5 pawn, and 2...d6 hits it; 2...d5 3.d4 is the Advance position', () => {
    const d6 = after(...E5, 'd6');
    expect(attacks(d6, 'e5', 'w')).toEqual([]);
    expect(attacks(d6, 'e5', 'b')).toEqual(['d6']);
    expect(placement(after(...E5, 'd5', 'd4'))).toBe(placement(after('e4', 'c6', 'd4', 'd5', 'e5')));
  });

  it('2...f6 opens the diagonal from h5; after 3.d4 fxe5 4.Qh5+ g6 5.Qxe5 the pawn is back and the queen hits h8; the game line checked on h5', () => {
    const f6 = after(...E5, 'f6');
    for (const sq of ['f7', 'g6']) expect(f6.get(sq as Square)).toBeUndefined();
    expect(f6.moves()).toContain('Qh5+');
    const back = after(...E5, 'f6', 'd4', 'fxe5', 'Qh5+', 'g6', 'Qxe5');
    expect(material(back)).toBe(0);
    expect(attacks(back, 'h8', 'w')).toEqual(['e5']);
    expect(after(...E5, 'f6', 'd4', 'Qa5+', 'Nc3', 'd5', 'Bd3', 'fxe5', 'Qh5+').inCheck()).toBe(true);
  });

  it('3.d4? dxe5 4.dxe5 Qa5+ checks and hits e5, and 5...Qxe5+ follows whatever White plays', () => {
    const qa5 = after(...E5, 'd6', 'd4', 'dxe5', 'dxe5', 'Qa5+');
    expect(qa5.inCheck()).toBe(true);
    expect(attacks(qa5, 'e5', 'b')).toContain('a5');
    for (const reply of qa5.moves()) {
      const line = after(...E5, 'd6', 'd4', 'dxe5', 'dxe5', 'Qa5+', reply);
      expect(line.move('Qxe5+').captured, reply).toBe('p');
      expect(line.inCheck(), reply).toBe(true);
      expect(material(line), reply).toBe(-1);
    }
    // Before the check, the e5 pawn had nothing behind it
    expect(attacks(after(...E5, 'd6', 'd4', 'dxe5', 'dxe5'), 'e5', 'w')).toEqual([]);
  });

  it('3...exd6 frees e7; after 4.d4 d5 each side has one pawn in the centre', () => {
    expect(after(...E5, 'd6', 'exd6', 'exd6').get('e7')).toBeUndefined();
    const d5 = after(...E5, 'd6', 'exd6', 'exd6', 'd4', 'd5');
    const centre = (color: 'w' | 'b') => ['d4', 'd5', 'e4', 'e5'].filter((sq) => d5.get(sq as Square)?.color === color && d5.get(sq as Square)?.type === 'p');
    expect([centre('w'), centre('b')]).toEqual([['d4'], ['d5']]);
  });

  it('against 2.d3: 3...d4 hits the c3 knight; after 3...e5 4.exd5 cxd5 the pawns stand on d5 and e5; Nc3 would hit a queen on d5; 3...dxe4 trades the centre pawn', () => {
    expect(attacks(after('e4', 'c6', 'd3', 'd5', 'Nc3', 'd4'), 'c3', 'b')).toContain('d4');
    const centre = after('e4', 'c6', 'd3', 'd5', 'Nc3', 'e5', 'exd5', 'cxd5');
    expect([centre.get('d5'), centre.get('e5')]).toEqual([{ type: 'p', color: 'b' }, { type: 'p', color: 'b' }]);
    const queen = after('e4', 'c6', 'd3', 'd5', 'exd5', 'Qxd5');
    queen.move('Nc3');
    expect(attacks(queen, 'd5', 'w')).toContain('c3');
    // 3...dxe4 trades off Black's only centre pawn, whichever way White takes back
    for (const back of ['dxe4', 'Nxe4']) {
      const traded = after('e4', 'c6', 'd3', 'd5', 'Nc3', 'dxe4', back);
      expect(['d4', 'd5', 'e4', 'e5'].some((sq) => traded.get(sq as Square)?.color === 'b'), back).toBe(false);
    }
  });

  it('the counts come from the seed games, and the weights on the lesson are those counts', () => {
    const black = seed.filter((g) => g.userColor === 'black' && g.movesSan[0] === 'e4' && g.movesSan[1] === 'c6');
    const count = (prefix: string[]) => black.filter((g) => prefix.every((m, k) => g.movesSan[k] === m)).length;
    const points = (prefix: string[]) =>
      black.filter((g) => prefix.every((m, k) => g.movesSan[k] === m)).reduce((n, g) => n + (g.userResult === 'win' ? 1 : g.userResult === 'draw' ? 0.5 : 0), 0);
    // "came up in 3 of your Caro-Kann games each, and you scored 1 point against each"
    expect([count(E5), points(E5), count(['e4', 'c6', 'd3']), points(['e4', 'c6', 'd3'])]).toEqual([3, 1, 3, 1]);
    // "2...f6?! was your move in two of these games (1 point)"
    expect([count([...E5, 'f6']), points([...E5, 'f6'])]).toEqual([2, 1]);
    // "in one game 3...Qa5+? 4.Nc3 d5 5.Bd3 fxe5 6.Qh5+"
    expect(count([...E5, 'f6', 'd4', 'Qa5+', 'Nc3', 'd5', 'Bd3', 'fxe5', 'Qh5+'])).toBe(1);
    // Against 2.d3: 3.Nc3 twice, 3.exd5 once (taken back with the pawn); after 3.Nc3, 3...e5 won and 3...dxe4 did not
    expect([count(['e4', 'c6', 'd3', 'd5', 'Nc3']), count(['e4', 'c6', 'd3', 'd5', 'exd5', 'cxd5'])]).toEqual([2, 1]);
    expect([points(['e4', 'c6', 'd3', 'd5', 'Nc3', 'e5']), points(['e4', 'c6', 'd3', 'd5', 'Nc3', 'dxe4'])]).toEqual([1, 0]);

    const m = caroKannE5D3Lesson.moves;
    expect(m[2].frequency).toBe(count(E5));
    expect(m[2].alternatives!.d3[0].frequency).toBe(count(['e4', 'c6', 'd3']));
    expect(m[2].alternatives!.d3[1].frequency).toBe(count(['e4', 'c6', 'd3', 'd5', 'Nc3']));
    expect(m[2].alternatives!.d3[1].alternatives!.exd5[0].frequency).toBe(count(['e4', 'c6', 'd3', 'd5', 'exd5']));
  });

  it('sits in the group on the king in the centre after the Damiano; its header names no answer; the exercise is the 4.dxe5 position', () => {
    const group = patternPath.find((g) => g.lessonIds.includes(caroKannE5D3Lesson.id))!;
    expect(group.id).toBe('pattern-king-in-the-centre');
    expect(group.lessonIds.indexOf(caroKannE5D3Lesson.id)).toBe(group.lessonIds.indexOf('lesson-white-vs-damiano') + 1);
    for (const header of [caroKannE5D3Lesson.title, caroKannE5D3Lesson.subtitle ?? '']) expect(header).not.toMatch(/d6|d5|Qa5|f6|exd6/);
    expect(caroKannE5D3Lesson.exercises[0].fen).toBe(after(...E5, 'd6', 'd4', 'dxe5', 'dxe5').fen());
  });
});
