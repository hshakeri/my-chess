import { describe, it, expect } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { caroKannF4Lesson } from '../../../src/curriculum/blackRepertoire';
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
const F = ['e4', 'c6', 'f4', 'd5'];

describe('Caro-Kann vs 2.f4: every fact the lesson states, replayed', () => {
  it('3.e5 makes the chain e5-f4; ...Bf5 comes out before ...e6; ...c5 and ...Nc6 attack d4 twice', () => {
    expect(attacks(after(...F, 'e5'), 'e5', 'w')).toContain('f4');
    const nc6 = after(...F, 'e5', 'Bf5', 'd4', 'e6', 'Nf3', 'c5', 'c3', 'Nc6');
    expect(attacks(nc6, 'd4', 'b')).toEqual(['c5', 'c6']);
  });

  it('against 3.Nf3: after 3...dxe4 the pawn hits the knight; after 4.Ne5, 4...f6?? 5.Qh5+ g6 6.Nxg6 hxg6 7.Qxh8 wins the rook', () => {
    expect(attacks(after(...F, 'Nf3', 'dxe4'), 'f3', 'b')).toContain('e4');
    expect(attacks(after(...F, 'Nf3', 'dxe4', 'Ne5', 'Nd7'), 'e5', 'b')).toContain('d7');
    const trap = after(...F, 'Nf3', 'dxe4', 'Ne5', 'f6', 'Qh5+');
    expect(trap.inCheck()).toBe(true);
    trap.move('g6');
    expect(trap.move('Nxg6').captured).toBe('p');
    expect(attacks(trap, 'h8', 'w')).toContain('g6');
    trap.move('hxg6');
    expect(trap.move('Qxh8').captured).toBe('r');
  });

  it('against 3.Nc3 and 3.d3: ...Nf6 hits the e4 knight; after 3.d3 dxe4 4.dxe4 Qxd1+ 5.Kxd1 White cannot castle', () => {
    expect(attacks(after(...F, 'Nc3', 'dxe4', 'Nxe4', 'Nf6'), 'e4', 'b')).toContain('f6');
    const kd1 = after(...F, 'd3', 'dxe4', 'dxe4', 'Qxd1+', 'Kxd1');
    expect(kd1.getCastlingRights('w')).toEqual({ k: false, q: false });
  });

  it('the counts and weights come from the seed games', () => {
    const f4 = seed.filter((g) => g.userColor === 'black' && ['e4', 'c6', 'f4'].every((m, k) => g.movesSan[k] === m));
    expect(f4.map((g) => g.userResult)).toEqual(['loss', 'loss']);
    expect(f4.map((g) => g.movesSan[3]).sort()).toEqual(['d5', 'd6']);
    const m = caroKannF4Lesson.moves;
    expect(m[2].frequency).toBe(f4.length);
    const count = (prefix: string[]) => f4.filter((g) => prefix.every((mv, k) => g.movesSan[k] === mv)).length;
    expect(m[4].frequency).toBe(count([...F, 'e5']));
    expect(m[6].frequency).toBe(count([...F, 'e5', 'Bf5', 'd4']));
    expect(m[10].frequency).toBe(count([...F, 'e5', 'Bf5', 'd4', 'e6', 'Nf3', 'c5', 'c3']));
    // "In your game 6...Nh6 came here"
    expect(f4.find((g) => g.movesSan[3] === 'd5')!.movesSan[11]).toBe('Nh6');
  });

  it('sits with the Caro-Kann bishop lessons; its header names no answer; the exercise is on the trap position', () => {
    expect(patternPath.find((g) => g.lessonIds.includes(caroKannF4Lesson.id))?.id).toBe('pattern-caro-bishop-both-sides');
    for (const header of [caroKannF4Lesson.title, caroKannF4Lesson.subtitle ?? '']) expect(header).not.toMatch(/d5|Bf5|dxe4|Nd7|c5/);
    expect(caroKannF4Lesson.exercises[0].fen).toBe(after(...F, 'Nf3', 'dxe4', 'Ne5', 'f6').fen());
  });
});
