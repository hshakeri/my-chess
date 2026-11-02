import { describe, it, expect } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { damianoForWhiteLesson } from '../../../src/curriculum/openings';
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
const D = ['e4', 'e5', 'Nf3', 'f6'];

describe('Against 2...f6 as White: every fact the lesson states, replayed', () => {
  it('2...f6 defends e5 with the pawn alone and opens h5-e8; after 3.Nxe5 fxe5 the queen checks on h5', () => {
    const f6 = after(...D);
    expect(attacks(f6, 'e5', 'b')).toEqual(['f6']);
    for (const sq of ['f7', 'g6']) expect(f6.get(sq as Square)).toBeUndefined();
    const check = after(...D, 'Nxe5', 'fxe5', 'Qh5+');
    expect(check.inCheck()).toBe(true);
  });

  it('4.Qh5+ Ke7 5.Qxe5+ Kf7 6.Bc4+ keeps checking; after 4...g6 5.Qxe5+ checks and hits h8', () => {
    const line = after(...D, 'Nxe5', 'fxe5', 'Qh5+', 'Ke7', 'Qxe5+');
    expect(line.inCheck()).toBe(true);
    line.move('Kf7');
    line.move('Bc4+');
    expect(line.inCheck()).toBe(true);
    const g6 = after(...D, 'Nxe5', 'fxe5', 'Qh5+', 'g6', 'Qxe5+');
    expect(g6.inCheck()).toBe(true);
    expect(attacks(g6, 'h8', 'w')).toContain('e5');
  });

  it('3...Qe7 attacks the knight with e4 behind it; 4.Qh5+?? g6 5.Nxg6 Qxe4+ 6.Be2 Qxg6 wins the knight', () => {
    const qe7 = after(...D, 'Nxe5', 'Qe7');
    expect(attacks(qe7, 'e5', 'b')).toContain('e7');
    expect(attacks(qe7, 'e4', 'b')).not.toContain('e7');
    expect(attacks(after(...D, 'Nxe5', 'Qe7', 'Nf3'), 'e4', 'b')).toContain('e7');
    const trap = after(...D, 'Nxe5', 'Qe7', 'Qh5+', 'g6', 'Nxg6', 'Qxe4+', 'Be2');
    expect(trap.move('Qxg6').captured).toBe('n');
  });

  it('after 4.Nf3 Qxe4+ 5.Be2 the queen has moved twice and the king is on e8; against 4...d5, 5.d3 guards e4 and opens the c1 bishop', () => {
    const be2 = after(...D, 'Nxe5', 'Qe7', 'Nf3', 'Qxe4+', 'Be2');
    expect(be2.history().filter((m, k) => k % 2 === 1 && m.startsWith('Q'))).toHaveLength(2);
    expect(be2.get('e8')).toMatchObject({ type: 'k', color: 'b' });
    const d3 = after(...D, 'Nxe5', 'Qe7', 'Nf3', 'd5', 'd3');
    expect(attacks(d3, 'e4', 'w')).toContain('d3');
    expect(d3.get('d2')).toBeUndefined();
  });

  it('the counts and weights come from the seed games', () => {
    const white = seed.filter((g) => g.userColor === 'white' && ['e4', 'e5', 'Nf3'].every((m, k) => g.movesSan[k] === m));
    const by = (m: string) => white.filter((g) => g.movesSan[3] === m);
    expect([by('Nc6').length, by('d6').length, by('f6').length]).toEqual([53, 12, 2]);
    expect(by('f6').map((g) => [g.movesSan[4], g.userResult])).toEqual([
      ['Bc4', 'loss'],
      ['Bc4', 'loss'],
    ]);
    expect(damianoForWhiteLesson.moves[3].frequency).toBe(by('f6').length);
  });

  it('sits with the king-in-the-centre lessons; its header names no answer; the exercise is after 3...fxe5', () => {
    expect(patternPath.find((g) => g.lessonIds.includes(damianoForWhiteLesson.id))?.id).toBe('pattern-king-in-the-centre');
    for (const header of [damianoForWhiteLesson.title, damianoForWhiteLesson.subtitle ?? '']) expect(header).not.toMatch(/Nxe5|Qh5|Nf3|Be2/);
    expect(damianoForWhiteLesson.exercises[0].fen).toBe(after(...D, 'Nxe5', 'fxe5').fen());
  });
});
