import { describe, it, expect } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { twoKnightsD4Lesson } from '../../../src/curriculum/openings';
import { caroKannBc4Lesson, caroKannExchangeLesson } from '../../../src/curriculum/blackRepertoire';
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
const T = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd4', 'exd4', 'O-O'];

describe('Two Knights with 4.d4: every fact the lesson states, replayed', () => {
  it('against 5...Nxe4: the rook pins the knight to the king; 7.Bxd5 takes its defender and 8.Nc3 attacks queen and knight', () => {
    const pin = after(...T, 'Nxe4', 'Re1');
    expect(pin.moves({ square: 'e4' })).toEqual([]);
    expect(pin.get('e8')).toMatchObject({ type: 'k', color: 'b' });
    const d5 = after(...T, 'Nxe4', 'Re1', 'd5');
    expect(attacks(d5, 'e4', 'b')).toContain('d5');
    expect(attacks(d5, 'c4', 'b')).toContain('d5');
    expect(d5.move('Bxd5').captured).toBe('p');
    const nc3 = after(...T, 'Nxe4', 'Re1', 'd5', 'Bxd5', 'Qxd5', 'Nc3');
    expect(attacks(nc3, 'd5', 'w')).toContain('c3');
    expect(attacks(nc3, 'e4', 'w')).toEqual(['c3', 'e1']);
    expect(nc3.moves({ square: 'e4' })).toEqual([]);
    const qa5 = after(...T, 'Nxe4', 'Re1', 'd5', 'Bxd5', 'Qxd5', 'Nc3', 'Qa5');
    expect(attacks(qa5, 'c3', 'b')).toContain('a5');
    expect(qa5.move('Nxe4').captured).toBe('n');
  });

  it('against 5...Bc5: 6.e5 hits the knight; 6...d5 hits the bishop; after 8.Re1+ the move ...Be7?? loses the bishop to fxe7', () => {
    const e5 = after(...T, 'Bc5', 'e5');
    expect(attacks(e5, 'f6', 'w')).toContain('e5');
    expect(attacks(after(...T, 'Bc5', 'e5', 'd5'), 'c4', 'b')).toContain('d5');
    const line = after(...T, 'Bc5', 'e5', 'd5');
    expect(line.move('exf6').captured).toBe('n');
    expect(line.move('dxc4').captured).toBe('b');
    line.move('Re1+');
    expect(line.inCheck()).toBe(true);
    line.move('Be7');
    expect(line.move('fxe7').captured).toBe('b');
    expect(attacks(line, 'd8', 'w')).toContain('e7');
  });

  it('against 5...d6: 6.Nxd4 takes the pawn back', () => {
    expect(after(...T, 'd6').move('Nxd4').captured).toBe('p');
  });

  it('the counts and weights come from the seed games', () => {
    const white = seed.filter((g) => g.userColor === 'white' && T.slice(0, 6).every((m, k) => g.movesSan[k] === m));
    const d4 = white.filter((g) => g.movesSan[6] === 'd4');
    const points = (games: StoredGame[]) => games.reduce((n, g) => n + (g.userResult === 'win' ? 1 : g.userResult === 'draw' ? 0.5 : 0), 0);
    expect([white.length, d4.length, points(d4)]).toEqual([12, 10, 5]);
    const count = (prefix: string[]) => white.filter((g) => prefix.every((m, k) => g.movesSan[k] === m)).length;
    const m = twoKnightsD4Lesson.moves;
    expect(m[7].frequency).toBe(count(T.slice(0, 8)));
    expect(m[9].frequency).toBe(count([...T, 'Nxe4']));
    expect(m[9].alternatives!.Bc5[0].frequency).toBe(count([...T, 'Bc5']));
    expect(m[9].alternatives!.d6[0].frequency).toBe(count([...T, 'd6']));
    expect(m[11].frequency).toBe(count([...T, 'Nxe4', 'Re1', 'd5']));
    // "your move in both games", "two of these games", "one", "you lost both"
    expect(white.filter((g) => T.every((mv, k) => g.movesSan[k] === mv) && g.movesSan[9] === 'Nxe4').map((g) => g.movesSan[12])).toEqual(['Nxd4', 'Nxd4']);
    const vsBc5 = white.filter((g) => T.every((mv, k) => g.movesSan[k] === mv) && g.movesSan[9] === 'Bc5').map((g) => g.movesSan[10]).sort();
    expect(vsBc5).toEqual(['Re1', 'b4', 'b4']);
    const vsD6 = white.filter((g) => T.every((mv, k) => g.movesSan[k] === mv) && g.movesSan[9] === 'd6');
    expect(vsD6.map((g) => [g.movesSan[10], g.userResult])).toEqual([
      ['Re1', 'loss'],
      ['Re1', 'loss'],
    ]);
  });

  it('starts the drill after 4.d4 exd4, so it never shares a decision with the Evans lesson\'s 4.d3', () => {
    expect(twoKnightsD4Lesson.startPly).toBe(8);
    const group = patternPath.find((g) => g.lessonIds.includes(twoKnightsD4Lesson.id));
    expect(group?.id).toBe('pattern-king-in-the-centre');
  });

  it('every exercise of the three new lessons sits on the position its comment names', () => {
    const exercises: Array<[{ fen: string }, string[]]> = [
      [twoKnightsD4Lesson.exercises[0], [...T, 'Nxe4', 'Re1', 'd5']],
      [caroKannBc4Lesson.exercises[0], ['e4', 'c6', 'Bc4', 'd5', 'exd5', 'cxd5', 'Bb5+', 'Nc6', 'd3']],
      [caroKannExchangeLesson.exercises[0], ['e4', 'c6', 'd4', 'd5', 'exd5', 'cxd5', 'Nc3', 'Bf5', 'Nf3', 'e6', 'Bb5+']],
    ];
    for (const [exercise, moves] of exercises) expect(exercise.fen).toBe(after(...moves).fen());
  });
});
