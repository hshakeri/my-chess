import { describe, it, expect } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { caroKannBc4Lesson } from '../../../src/curriculum/blackRepertoire';
import { patternPath } from '../../../src/curriculum/patternPath';
import seedGamesRaw from '../../../src/data/seed_hoot65_games.json';
import type { StoredGame } from '../../../src/types/db';

const seed = seedGamesRaw as unknown as StoredGame[];
const after = (...moves: string[]) => {
  const chess = new Chess();
  for (const m of moves) chess.move(m);
  return chess;
};
const attacks = (chess: Chess, square: string, color: 'w' | 'b') => chess.attackers(square as Square, color);
const MAIN = ['e4', 'c6', 'Bc4', 'd5', 'exd5', 'cxd5'];

describe('Caro-Kann vs 2.Bc4: every fact the lesson states, replayed', () => {
  it('2...d5 hits the bishop and e4 and closes the line to f7; 3...cxd5 hits the bishop again; 3...Qxd5?? 4.Bxd5', () => {
    expect(attacks(after('e4', 'c6', 'Bc4'), 'f7', 'w')).toContain('c4');
    const d5 = after('e4', 'c6', 'Bc4', 'd5');
    expect(attacks(d5, 'c4', 'b')).toContain('d5');
    expect(attacks(d5, 'e4', 'b')).toContain('d5');
    expect(attacks(d5, 'f7', 'w')).not.toContain('c4');
    expect(attacks(after(...MAIN), 'c4', 'b')).toContain('d5');
    const blunder = after('e4', 'c6', 'Bc4', 'd5', 'exd5', 'Qxd5');
    expect(blunder.move('Bxd5').captured).toBe('q');
  });

  it('4.Bb3 Nf6: the queen and the knight defend d5; 5.d4 Bg4 attacks the queen, and the f6 knight defends g4', () => {
    const nf6 = after(...MAIN, 'Bb3', 'Nf6');
    expect(attacks(nf6, 'd5', 'w')).toContain('b3');
    expect(attacks(nf6, 'd5', 'b').sort()).toEqual(['d8', 'f6']);
    const bg4 = after(...MAIN, 'Bb3', 'Nf6', 'd4', 'Bg4');
    expect(attacks(bg4, 'd1', 'b')).toContain('g4');
    expect(bg4.get('e2')).toBeUndefined();
    expect(bg4.get('f3')).toBeUndefined();
    expect(attacks(bg4, 'g4', 'w')).toContain('d1');
    expect(attacks(bg4, 'g4', 'b')).toEqual(['f6']);
    bg4.move('Qxg4');
    expect(bg4.move('Nxg4').captured).toBe('q');
  });

  it('after ...bxc6 the c6 pawn supports d5 and Black has the two bishops; 6.d4 Bg4?? 7.Qxg4', () => {
    for (const line of [
      [...MAIN, 'Bb5+', 'Nc6', 'Bxc6+', 'bxc6'],
      [...MAIN, 'Bb5+', 'Nc6', 'Nf3', 'a6', 'Bxc6+', 'bxc6'],
    ]) {
      const chess = after(...line);
      expect(attacks(chess, 'd5', 'b')).toContain('c6');
      const bishops = (color: 'w' | 'b') => chess.board().flat().filter((p) => p && p.type === 'b' && p.color === color).length;
      expect([bishops('b'), bishops('w')]).toEqual([2, 1]);
    }
    const hangs = after(...MAIN, 'Bb5+', 'Nc6', 'Bxc6+', 'bxc6', 'd4', 'Bg4');
    expect(attacks(hangs, 'g4', 'w')).toEqual(['d1']);
    expect(attacks(hangs, 'g4', 'b')).toEqual([]);
    expect(hangs.move('Qxg4').captured).toBe('b');
  });

  it('5.d3 Qa5+ checks and hits the loose b5 bishop; against 6.Nc3 the pinned knight guards b5 and ...d4 attacks it', () => {
    const d3 = after(...MAIN, 'Bb5+', 'Nc6', 'd3');
    for (const sq of ['d2', 'c3', 'b4'] as const) expect(d3.get(sq)).toBeUndefined();
    const check = after(...MAIN, 'Bb5+', 'Nc6', 'd3', 'Qa5+');
    expect(check.inCheck()).toBe(true);
    expect(attacks(check, 'b5', 'b')).toContain('a5');
    expect(attacks(check, 'b5', 'w')).toEqual([]);
    for (const block of ['c3', 'Bd2', 'Nd2']) {
      const line = after(...MAIN, 'Bb5+', 'Nc6', 'd3', 'Qa5+', block);
      expect(line.move('Qxb5').captured).toBe('b');
    }
    const nc3 = after(...MAIN, 'Bb5+', 'Nc6', 'd3', 'Qa5+', 'Nc3');
    expect(attacks(nc3, 'b5', 'w')).toContain('c3');
    expect(nc3.moves({ square: 'c3' })).toEqual([]);
    const trap = after(...MAIN, 'Bb5+', 'Nc6', 'd3', 'Qa5+', 'Nc3', 'Qxb5');
    expect(trap.move('Nxb5').captured).toBe('q');
    expect(attacks(after(...MAIN, 'Bb5+', 'Nc6', 'd3', 'Qa5+', 'Nc3', 'd4'), 'c3', 'b')).toContain('d4');
  });

  it('7...e6 lets the f8 bishop out', () => {
    const line = [...MAIN, 'Bb5+', 'Nc6', 'Nf3', 'a6', 'Bxc6+', 'bxc6', 'd4'];
    // Black to move before 7...e6: the f8 bishop has no move. After it, with Black to move again, it has
    expect(after(...line).moves({ square: 'f8' })).toEqual([]);
    const passed = after(...line, 'e6').fen().replace(' w ', ' b ');
    expect(new Chess(passed).moves({ square: 'f8' }).length).toBeGreaterThan(0);
  });

  it('the counts it gives come from the seed games', () => {
    const black = seed.filter((g) => g.userColor === 'black');
    const caro = black.filter((g) => g.movesSan[0] === 'e4' && g.movesSan[1] === 'c6');
    const bc4 = caro.filter((g) => g.movesSan[2] === 'Bc4');
    const points = (games: StoredGame[]) => games.reduce((n, g) => n + (g.userResult === 'win' ? 1 : g.userResult === 'draw' ? 0.5 : 0), 0);
    expect([caro.length, bc4.length, points(bc4)]).toEqual([67, 8, 5.5]);
    expect(bc4.every((g) => g.movesSan.slice(3, 6).join(' ') === 'd5 exd5 cxd5')).toBe(true);
    const by4 = (m: string) => bc4.filter((g) => g.movesSan[6] === m);
    expect([by4('Bb5+').length, points(by4('Bb5+')), by4('Bb3').length, points(by4('Bb3'))]).toEqual([5, 4.5, 3, 1]);
    expect(by4('Bb5+').every((g) => g.movesSan[7] === 'Nc6')).toBe(true);
    expect(by4('Bb3').filter((g) => g.movesSan[7] === 'Bf5')).toHaveLength(2);
    // The game with 5.d3: you played 5...a6
    expect(by4('Bb5+').filter((g) => g.movesSan[8] === 'd3').map((g) => g.movesSan[9])).toEqual(['a6']);
    expect(by4('Bb5+').filter((g) => g.movesSan[8] === 'Nf3').map((g) => g.movesSan[9]).sort()).toEqual(['Bg4', 'a6']);

    // The weights on the lesson's opponent moves are these counts
    const count = (prefix: string[]) => bc4.filter((g) => prefix.every((m, k) => g.movesSan[k] === m)).length;
    const m = caroKannBc4Lesson.moves;
    expect(m[2].frequency).toBe(count(['e4', 'c6', 'Bc4']));
    expect(m[4].frequency).toBe(count([...MAIN.slice(0, 5)]));
    expect(m[6].frequency).toBe(count([...MAIN, 'Bb5+']));
    expect(m[6].alternatives!.Bb3[0].frequency).toBe(count([...MAIN, 'Bb3']));
    expect(m[6].alternatives!.Bb3[1].frequency).toBe(count([...MAIN, 'Bb3', 'Nf6', 'd4']));
    expect(m[8].frequency).toBe(count([...MAIN, 'Bb5+', 'Nc6', 'Nf3']));
    for (const alt of ['Bxc6+', 'd3', 'Nc3']) expect(m[8].alternatives![alt][0].frequency, alt).toBe(count([...MAIN, 'Bb5+', 'Nc6', alt]));
    expect(m[8].alternatives!['Bxc6+'][1].frequency).toBe(count([...MAIN, 'Bb5+', 'Nc6', 'Bxc6+', 'bxc6', 'd4']));
    expect(m[10].frequency).toBe(count([...MAIN, 'Bb5+', 'Nc6', 'Nf3', 'a6', 'Bxc6+']));
    expect(m[12].frequency).toBe(count([...MAIN, 'Bb5+', 'Nc6', 'Nf3', 'a6', 'Bxc6+', 'bxc6', 'd4']));
  });

  it('sits in the study path with the other lessons on loose pieces on long lines', () => {
    const group = patternPath.find((g) => g.lessonIds.includes(caroKannBc4Lesson.id));
    expect(group?.id).toBe('pattern-loose-pieces-long-lines');
    expect(caroKannBc4Lesson.title).not.toMatch(/cxd5|Qa5/);
  });
});
