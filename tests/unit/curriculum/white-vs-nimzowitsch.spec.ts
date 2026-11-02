import { describe, it, expect } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { nimzowitschForWhiteLesson } from '../../../src/curriculum/openings';
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
const Q = ['e4', 'Nc6', 'Nf3', 'd5', 'exd5', 'Qxd5', 'Nc3'];

describe('Against 1...Nc6 as White: every fact the lesson states, replayed', () => {
  it('2...e5 is the Italian position after 3.Bc4; 2...d5 attacks e4; 4.Nc3 hits the queen', () => {
    const key = (c: Chess) => c.fen().split(' ').slice(0, 4).join(' ');
    expect(key(after('e4', 'Nc6', 'Nf3', 'e5', 'Bc4'))).toBe(key(after('e4', 'e5', 'Nf3', 'Nc6', 'Bc4')));
    expect(attacks(after('e4', 'Nc6', 'Nf3', 'd5'), 'e4', 'b')).toContain('d5');
    expect(attacks(after(...Q), 'd5', 'w')).toContain('c3');
  });

  it('after 4...Qa5 5.Bb5 pins the knight to the king; after 4...Qh5 5.Nb5 eyes c7, where a check forks king and rook', () => {
    const pin = after(...Q, 'Qa5', 'Bb5');
    expect(pin.get('d7')).toBeUndefined();
    expect(attacks(pin, 'c6', 'w')).toContain('b5');
    const nb5 = after(...Q, 'Qh5', 'Nb5');
    expect(attacks(nb5, 'c7', 'w')).toContain('b5');
    expect(attacks(nb5, 'c7', 'b')).toEqual([]);
    // If Black ignores it: the knight on c7 checks and attacks a8
    const fork = new Chess(nb5.fen().replace(' b ', ' w '));
    fork.move('Nxc7+');
    expect(fork.inCheck()).toBe(true);
    expect(attacks(fork, 'a8', 'w')).toContain('c7');
  });

  it('the counts and weights come from the seed games', () => {
    const white = seed.filter((g) => g.userColor === 'white' && g.movesSan[0] === 'e4' && g.movesSan[1] === 'Nc6');
    const pts = (gs: StoredGame[]) => gs.reduce((n, g) => n + (g.userResult === 'win' ? 1 : g.userResult === 'draw' ? 0.5 : 0), 0);
    expect([white.length, pts(white)]).toEqual([5, 2]);
    expect(white.every((g) => g.movesSan[2] === 'Nf3')).toBe(true);
    const count = (prefix: string[]) => white.filter((g) => prefix.every((m, k) => g.movesSan[k] === m)).length;
    const m = nimzowitschForWhiteLesson.moves;
    expect(m[3].frequency).toBe(count(['e4', 'Nc6', 'Nf3', 'd5']));
    expect(m[3].alternatives!.e5[0].frequency).toBe(count(['e4', 'Nc6', 'Nf3', 'e5']));
    expect(m[3].alternatives!.a6[0].frequency).toBe(count(['e4', 'Nc6', 'Nf3', 'a6']));
    // "3.e5 was your move in both of these games (1 point)"
    const d5 = white.filter((g) => g.movesSan[3] === 'd5');
    expect(d5.map((g) => g.movesSan[4])).toEqual(['e5', 'e5']);
    expect(pts(d5)).toBe(1);
  });

  it('sits with the king-in-the-centre lessons; its header names no answer; the exercise is the 4...Qh5 position', () => {
    expect(patternPath.find((g) => g.lessonIds.includes(nimzowitschForWhiteLesson.id))?.id).toBe('pattern-king-in-the-centre');
    for (const header of [nimzowitschForWhiteLesson.title, nimzowitschForWhiteLesson.subtitle ?? '']) expect(header).not.toMatch(/Nf3|exd5|Nc3|d4|Bb5|Nb5/);
    expect(nimzowitschForWhiteLesson.exercises[0].fen).toBe(after(...Q, 'Qh5').fen());
  });
});
