import { describe, it, expect } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { caroKannForWhiteLesson } from '../../../src/curriculum/openings';
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
const bishops = (chess: Chess, color: 'w' | 'b') => chess.board().flat().filter((p) => p && p.type === 'b' && p.color === color).length;
const K = ['e4', 'c6', 'Nc3', 'd5', 'Nf3'];

describe('Against the Caro-Kann as White: every fact the lesson states, replayed', () => {
  it('2.Nc3 guards e4, which 2...d5 attacks; 2.Nf3 d5 3.Nc3 is the same position', () => {
    const nc3 = after('e4', 'c6', 'Nc3');
    expect(attacks(nc3, 'e4', 'w')).toContain('c3');
    expect(attacks(after('e4', 'c6', 'Nc3', 'd5'), 'e4', 'b')).toContain('d5');
    const key = (c: Chess) => c.fen().split(' ').slice(0, 4).join(' ');
    expect(key(after('e4', 'c6', 'Nf3', 'd5', 'Nc3'))).toBe(key(after(...K)));
  });

  it('3...Bg4 pins the knight to the queen; 4.h3 asks the bishop; on h5 it can be chased', () => {
    const pin = after(...K, 'Bg4');
    expect(pin.get('e2')).toBeUndefined();
    expect(attacks(pin, 'f3', 'b')).toContain('g4');
    expect(attacks(after(...K, 'Bg4', 'h3'), 'g4', 'w')).toContain('h3');
  });

  it('after 4...Bxf3 5.Qxf3 White has the two bishops', () => {
    const q = after(...K, 'Bg4', 'h3', 'Bxf3', 'Qxf3');
    expect([bishops(q, 'w'), bishops(q, 'b')]).toEqual([2, 1]);
  });

  it('after 4...Bh5 5.exd5 cxd5 6.g4, 6...Bxg4?? 7.hxg4 loses the bishop; 7.Ne5 hits the g6 bishop, and Nxg6 hxg6 gives White the two bishops', () => {
    const g4 = after(...K, 'Bg4', 'h3', 'Bh5', 'exd5', 'cxd5', 'g4');
    expect(attacks(g4, 'h5', 'w')).toContain('g4');
    const blunder = after(...K, 'Bg4', 'h3', 'Bh5', 'exd5', 'cxd5', 'g4', 'Bxg4');
    expect(blunder.move('hxg4').captured).toBe('b');
    const ne5 = after(...K, 'Bg4', 'h3', 'Bh5', 'exd5', 'cxd5', 'g4', 'Bg6', 'Ne5');
    expect(attacks(ne5, 'g6', 'w')).toContain('e5');
    ne5.move('Nc6');
    ne5.move('Nxg6');
    ne5.move('hxg6');
    expect([bishops(ne5, 'w'), bishops(ne5, 'b')]).toEqual([2, 1]);
  });

  it('against 3...dxe4: after 5.Nxf6+ exf6 the f-pawns are doubled, and 6.Bc4 aims at f7', () => {
    const bc4 = after(...K, 'dxe4', 'Nxe4', 'Nf6', 'Nxf6+', 'exf6', 'Bc4');
    expect(['f7', 'f6'].map((sq) => bc4.get(sq as Square))).toEqual([
      { type: 'p', color: 'b' },
      { type: 'p', color: 'b' },
    ]);
    expect(attacks(bc4, 'f7', 'w')).toContain('c4');
  });

  it('the counts and weights come from the seed games', () => {
    const white = seed.filter((g) => g.userColor === 'white' && g.movesSan[0] === 'e4' && g.movesSan[1] === 'c6');
    const count = (prefix: string[]) => white.filter((g) => prefix.every((m, k) => g.movesSan[k] === m)).length;
    expect([white.length, count(['e4', 'c6', 'Nc3']), count(['e4', 'c6', 'Nf3'])]).toEqual([19, 10, 8]);
    const two = white.filter((g) => K.every((m, k) => g.movesSan[k] === m));
    expect(two.reduce((n, g) => n + (g.userResult === 'win' ? 1 : g.userResult === 'draw' ? 0.5 : 0), 0)).toBe(4);
    const m = caroKannForWhiteLesson.moves;
    expect(m[3].frequency).toBe(count(['e4', 'c6', 'Nc3', 'd5']));
    expect(m[5].frequency).toBe(count([...K, 'Bg4']));
    expect(m[5].alternatives!.dxe4[0].frequency).toBe(count([...K, 'dxe4']));
    expect(m[5].alternatives!.dxe4[1].frequency).toBe(count([...K, 'dxe4', 'Nxe4', 'Nf6']));
    expect(m[5].alternatives!.dxe4[3].frequency).toBe(count([...K, 'dxe4', 'Nxe4', 'Nf6', 'Nxf6+', 'exf6']));
    expect(m[7].frequency).toBe(count([...K, 'Bg4', 'h3', 'Bh5']));
    // "your move in both of these games" (5.g4) and "You lost the game with 3.h3"
    expect(white.filter((g) => [...K, 'Bg4', 'h3', 'Bh5'].every((mv, k) => g.movesSan[k] === mv)).map((g) => g.movesSan[8])).toEqual(['g4', 'g4']);
    expect(white.filter((g) => ['e4', 'c6', 'Nc3', 'd5', 'h3'].every((mv, k) => g.movesSan[k] === mv)).map((g) => g.userResult)).toEqual(['loss']);
  });

  it('sits with the Caro-Kann bishop lessons, and its header names no answer', () => {
    expect(patternPath.find((g) => g.lessonIds.includes(caroKannForWhiteLesson.id))?.id).toBe('pattern-caro-bishop-both-sides');
    for (const header of [caroKannForWhiteLesson.title, caroKannForWhiteLesson.subtitle ?? '']) expect(header).not.toMatch(/Nc3|Nf3|h3|exd5|g4\b|Ne5|knight/i);
    expect(caroKannForWhiteLesson.exercises[0].fen).toBe(after(...K, 'Bg4', 'h3', 'Bh5', 'exd5', 'cxd5', 'g4', 'Bxg4').fen());
  });
});
