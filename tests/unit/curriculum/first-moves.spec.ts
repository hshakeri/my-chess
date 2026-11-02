import { describe, it, expect } from 'vitest';
import { allCurriculumLessons } from '../../../src/curriculum';
import seedGamesRaw from '../../../src/data/seed_hoot65_games.json';
import type { StoredGame } from '../../../src/types/db';

const seed = seedGamesRaw as unknown as StoredGame[];
const points = (games: StoredGame[]) => games.reduce((n, g) => n + (g.userResult === 'win' ? 1 : g.userResult === 'draw' ? 0.5 : 0), 0);
const games = (color: 'white' | 'black', prefix: string[]) => seed.filter((g) => g.userColor === color && prefix.every((m, k) => g.movesSan[k] === m));
const lesson = (id: string) => allCurriculumLessons.find((l) => l.id === id)!;

describe('The moves hoot65 plays instead of the repertoire\'s, answered with the seed games\' numbers', () => {
  it('as Black: 1...d6 against 1.e4 and 1...Nf6 against 1.d4, in every lesson that asks the first move', () => {
    expect([games('black', ['e4', 'd6']).length, points(games('black', ['e4', 'd6']))]).toEqual([41, 20]);
    expect([games('black', ['e4', 'c6']).length, points(games('black', ['e4', 'c6']))]).toEqual([67, 36]);
    expect([games('black', ['d4', 'Nf6']).length, games('black', ['d4']).length, points(games('black', ['d4', 'Nf6']))]).toEqual([29, 30, 11]);
    const caro = allCurriculumLessons.filter((l) => l.targetColor === 'black' && l.relevance === 'core' && l.moves[0]?.san === 'e4' && l.moves[1]?.san === 'c6');
    const wall = allCurriculumLessons.filter((l) => l.targetColor === 'black' && l.relevance === 'core' && l.moves[0]?.san === 'd4' && l.moves[1]?.san === 'd5');
    expect(caro.length).toBe(5);
    expect(wall.length).toBe(3);
    for (const l of caro) expect(l.moves[1].wrongMoveFeedback?.d6, l.id).toMatch(/41 of your games, 20 points; the Caro-Kann scored 36 in 67/);
    for (const l of wall) expect(l.moves[1].wrongMoveFeedback?.Nf6, l.id).toMatch(/29 of your 30 games against 1\.d4 \(11 points\)/);
  });

  it('as White: 4.O-O against 3...Bc5 scored none in 3 and the Evans 6 in 7', () => {
    const pre = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'];
    expect([games('white', [...pre, 'b4']).length, points(games('white', [...pre, 'b4']))]).toEqual([7, 6]);
    expect([games('white', [...pre, 'O-O']).length, points(games('white', [...pre, 'O-O']))]).toEqual([3, 0]);
    const evans = lesson('lesson-evans-gambit-destruction');
    const b4 = evans.moves.find((m, k) => m.san === 'b4' && pre.every((p, j) => evans.moves[j].san === p) && k === pre.length)!;
    expect(b4.wrongMoveFeedback?.['O-O']).toMatch(/4\.b4 scored 6 points in 7 and 4\.O-O none in 3/);
  });
});
