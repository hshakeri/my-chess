import { describe, it, expect } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { frenchAdvanceForWhiteLesson } from '../../../src/curriculum/openings';
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
const A = ['e4', 'e6', 'd4', 'd5', 'e5'];
const Q = [...A, 'c5', 'c3', 'Nc6', 'Nf3', 'Qb6'];

// Positions are compared by placement, side to move and castling rights, so move orders transpose
const key = (c: Chess) => c.fen().split(' ').slice(0, 3).join(' ');
// hoot65's White games through their first 20 plies, indexed by position once
let index: Map<string, Array<{ game: StoredGame; next: string }>> | undefined;
/** hoot65's White games that reached the position after `moves`, by any move order, with the move played there. */
function reached(moves: string[]): Array<{ game: StoredGame; next: string }> {
  if (!index) {
    index = new Map();
    for (const game of seed) {
      if (game.userColor !== 'white') continue;
      const c = new Chess();
      for (const san of game.movesSan.slice(0, 20)) {
        const k = key(c);
        if (!index.has(k)) index.set(k, []);
        index.get(k)!.push({ game, next: san });
        c.move(san);
      }
    }
  }
  return index.get(key(after(...moves))) ?? [];
}
const tally = (hits: Array<{ next: string }>) => hits.reduce<Record<string, number>>((t, h) => ({ ...t, [h.next]: (t[h.next] ?? 0) + 1 }), {});
const points = (hits: Array<{ game: StoredGame }>) =>
  hits.reduce((n, h) => n + (h.game.userResult === 'win' ? 1 : h.game.userResult === 'draw' ? 0.5 : 0), 0);

describe('Against the French as White: every fact the lesson states, replayed', () => {
  it('3.e5 takes f6 from the knight; 3.exd5 exd5 clears the c8 bishop\'s diagonal; after 2.Nc3 d5 3.e5 the knight stands on c3 and 3...d4 hits it', () => {
    expect(attacks(after(...A), 'f6', 'w')).toEqual(['e5']);
    const exchange = after('e4', 'e6', 'd4', 'd5', 'exd5', 'exd5');
    for (const sq of ['d7', 'e6', 'f5', 'g4', 'h3']) expect(exchange.get(sq as Square), sq).toBeUndefined();
    const nc3 = after('e4', 'e6', 'Nc3', 'd5', 'e5', 'd4');
    expect(nc3.get('c3')).toEqual({ type: 'n', color: 'w' });
    expect(attacks(nc3, 'c3', 'b')).toEqual(['d4']);
  });

  it('after 3...c5: 4.c3 lets the c-pawn take back on d4; 4.Nf3 cxd4 5.Nxd4 and 4.dxc5 leave e5 without a pawn behind it; 4.Bb5+ Nc6 adds an attacker on d4', () => {
    expect(after(...A, 'c5', 'c3', 'cxd4', 'cxd4').get('d4')).toEqual({ type: 'p', color: 'w' });
    const nf3 = after(...A, 'c5', 'Nf3', 'cxd4', 'Nxd4');
    expect(nf3.get('d4')).toEqual({ type: 'n', color: 'w' });
    expect(attacks(nf3, 'e5', 'w')).toEqual([]);
    expect(attacks(after(...A, 'c5', 'dxc5'), 'e5', 'w')).toEqual([]);
    expect(attacks(after(...A, 'c5', 'Bb5+', 'Nc6'), 'd4', 'b')).toEqual(['c5', 'c6']);
  });

  it('after 4...Nc6 5.Nf3 d4 has three defenders; 5.Bd3 blocks the queen\'s guard; 5.Be3 Qb6 leaves b2 unguarded', () => {
    expect(attacks(after(...A, 'c5', 'c3', 'Nc6', 'Nf3'), 'd4', 'w')).toEqual(['c3', 'd1', 'f3']);
    expect(attacks(after(...A, 'c5', 'c3', 'Nc6', 'Bd3'), 'd4', 'w')).toEqual(['c3']);
    const be3 = after(...A, 'c5', 'c3', 'Nc6', 'Be3', 'Qb6');
    expect([attacks(be3, 'b2', 'b'), attacks(be3, 'b2', 'w')]).toEqual([['b6'], []]);
  });

  it('5...Qb6 hits b2, which only the c1 bishop guards, and stands behind the c5 pawn on the diagonal to d4', () => {
    const q = after(...Q);
    expect([attacks(q, 'b2', 'b'), attacks(q, 'b2', 'w')]).toEqual([['b6'], ['c1']]);
    expect(attacks(q, 'd4', 'b')).toEqual(['c5', 'c6']);
    expect(q.get('c5')).toEqual({ type: 'p', color: 'b' });
    // Once the c-pawns are traded the queen sees d4
    expect(attacks(after(...Q, 'a3', 'cxd4', 'cxd4'), 'd4', 'b')).toContain('b6');
  });

  it('every c1-bishop move on move 6 drops b2: 6.Be3 Qxb2 is a pawn, and after 6.Bd2 Qxb2 the a1 rook hangs too', () => {
    for (const bishop of ['Be3', 'Bd2', 'Bf4', 'Bg5']) {
      const line = after(...Q, bishop);
      expect(attacks(line, 'b2', 'w'), bishop).toEqual([]);
      line.move('Qxb2');
      expect(material(line), bishop).toBe(-1);
    }
    const bd2 = after(...Q, 'Bd2', 'Qxb2');
    expect([attacks(bd2, 'a1', 'b'), attacks(bd2, 'a1', 'w')]).toEqual([['b2'], []]);
    // "In one of your games the bishop went to d2 like this, and the queen took b2 and then the rook"
    const game = seed.filter((g) => g.userColor === 'white' && g.movesSan.slice(0, 24).join(' ') === 'e4 e6 Nf3 d5 e5 c5 c3 Nc6 Bb5 Bd7 Bxc6 Bxc6 d4 Qa5 Bd2 Qb6 Ng5 Qxb2 Qf3 f6 exf6 Nxf6 O-O Qxa1');
    expect(game.map((g) => g.userResult)).toEqual(['loss']);
  });

  it('6.dxc5 Bxc5 hits f2; 6.Bd3 cxd4 7.cxd4 leaves d4 one defender against two attackers; 6.a3 guards b4 once the c-pawns are traded', () => {
    expect(attacks(after(...Q, 'dxc5', 'Bxc5'), 'f2', 'b')).toEqual(['c5']);
    const bd3 = after(...Q, 'Bd3', 'cxd4', 'cxd4');
    expect([attacks(bd3, 'd4', 'w'), attacks(bd3, 'd4', 'b')]).toEqual([['f3'], ['b6', 'c6']]);
    expect(attacks(after(...Q, 'a3', 'cxd4', 'cxd4'), 'b4', 'w')).toEqual(['a3']);
  });

  it('after 6...c4 d4 has two attackers against three defenders; 7.Bf4, 7.Be3 or 7.Bg5 Qxb2 8.Nbd2 Qxc3 is two pawns and hits a1; 7.Bd3 cxd3 loses the bishop', () => {
    for (const bishop of ['Be3', 'Bg5']) {
      const line = after(...Q, 'a3', 'c4', bishop, 'Qxb2', 'Nbd2', 'Qxc3');
      expect([material(line), attacks(line, 'a1', 'b')], bishop).toEqual([-2, ['c3']]);
    }
    const c4 = after(...Q, 'a3', 'c4');
    expect([attacks(c4, 'd4', 'b'), attacks(c4, 'd4', 'w')]).toEqual([['b6', 'c6'], ['c3', 'd1', 'f3']]);
    const bf4 = after(...Q, 'a3', 'c4', 'Bf4', 'Qxb2', 'Nbd2', 'Qxc3');
    expect(material(bf4)).toBe(-2);
    expect(attacks(bf4, 'a1', 'b')).toEqual(['c3']);
    expect(attacks(after(...Q, 'a3', 'c4'), 'd3', 'b')).toContain('c4');
    expect(material(after(...Q, 'a3', 'c4', 'Bd3', 'cxd3'))).toBe(-3);
  });

  it('against 4...Qb6, 5.Be3 Qxb2 6.Nd2 Qxc3 is two pawns; against 4...cxd4, 5.Qxd4 Nc6 hits the queen and 5.Nf3 dxc3 6.Nxc3 is a pawn down; against 6...cxd4, 7.b4 dxc3 8.Nxc3 is a pawn down', () => {
    expect(material(after(...A, 'c5', 'c3', 'Qb6', 'Be3', 'Qxb2', 'Nd2', 'Qxc3'))).toBe(-2);
    expect(attacks(after(...A, 'c5', 'c3', 'cxd4', 'Qxd4', 'Nc6'), 'd4', 'b')).toContain('c6');
    expect(material(after(...A, 'c5', 'c3', 'cxd4', 'Nf3', 'dxc3', 'Nxc3'))).toBe(-1);
    expect(material(after(...Q, 'a3', 'cxd4', 'b4', 'dxc3', 'Nxc3'))).toBe(-1);
  });

  it('against 3...f6 4.Bd3: the diagonal from h5 to e8 stays open after 4...Be7, 5.Qh5+ leaves the king, g6 or nothing, and ...g6 loses to Bxg6+; 4...fxe5 5.Nf3?? e4 forks', () => {
    const F = [...A, 'f6', 'Bd3'];
    const be7 = after(...F, 'Be7');
    for (const sq of ['f7', 'g6']) expect(be7.get(sq as Square), sq).toBeUndefined();
    expect(after(...F, 'Be7', 'Qh5+').moves().sort()).toEqual(['Kd7', 'Kf8', 'g6']);
    expect(material(after(...F, 'Be7', 'Qh5+', 'g6', 'Bxg6+', 'hxg6', 'Qxh8'))).toBe(3);
    // After 4...fxe5 5.Qh5+ g6 6.Bxg6+ the king walks, or 6...hxg6 7.Qxh8 takes the rook
    expect(after(...F, 'fxe5', 'Qh5+', 'g6', 'Bxg6+').moves().sort()).toEqual(['Kd7', 'Ke7', 'hxg6']);
    const rook = after(...F, 'fxe5', 'Qh5+', 'g6', 'Bxg6+', 'hxg6');
    expect(rook.move('Qxh8').captured).toBe('r');
    const fork = after(...F, 'fxe5', 'Nf3', 'e4');
    expect([attacks(fork, 'd3', 'b'), attacks(fork, 'f3', 'b')]).toEqual([['e4'], ['e4']]);
  });

  it('against 6...Bd7: 7.b4 hits c5; 8.Nxd4 Nxe5 loses the pawn; after 8.cxd4 Rc8 the c-file has no pawns, 9.Bb2 guards d4 behind the b4 pawn, and 9.Bd3 leaves it one defender', () => {
    const B = [...Q, 'a3', 'Bd7', 'b4'];
    expect(attacks(after(...B), 'c5', 'w')).toContain('b4');
    const nxd4 = after(...B, 'cxd4', 'Nxd4');
    expect([attacks(nxd4, 'e5', 'w'), attacks(nxd4, 'e5', 'b')]).toEqual([[], ['c6']]);
    expect(material(after(...B, 'cxd4', 'Nxd4', 'Nxe5'))).toBe(-1);
    const rc8 = after(...B, 'cxd4', 'cxd4', 'Rc8');
    for (let rank = 2; rank <= 7; rank++) expect(rc8.get(`c${rank}` as Square)?.type, `c${rank}`).not.toBe('p');
    const bb2 = after(...B, 'cxd4', 'cxd4', 'Rc8', 'Bb2');
    expect(attacks(bb2, 'd4', 'w')).toEqual(['b2', 'd1', 'f3']);
    expect(attacks(bb2, 'b2', 'b')).toEqual([]);
    const bd3 = after(...B, 'cxd4', 'cxd4', 'Rc8', 'Bd3');
    expect([attacks(bd3, 'd4', 'w'), attacks(bd3, 'd4', 'b')]).toEqual([['f3'], ['b6', 'c6']]);
  });

  it('the exercise: ...f6 opened the diagonal from h5 to e8, the d6 bishop hits e5, and after 6.Qh5+ g6 7.Nxg6 the knight hits h8; 7...hxg6 8.Qxh8 wins the rook', () => {
    const ex = frenchAdvanceForWhiteLesson.exercises[0];
    const start = new Chess(ex.fen);
    for (const sq of ['f7', 'g6']) expect(start.get(sq as Square), sq).toBeUndefined();
    expect(attacks(start, 'e5', 'b')).toEqual(['d6']);
    const line = new Chess(ex.fen);
    for (const san of ex.solutionSan) line.move(san);
    expect(attacks(line, 'h8', 'w')).toEqual(['g6']);
    expect(material(line)).toBe(1);
    line.move('hxg6');
    line.move('Qxh8');
    expect(material(line)).toBe(3);
    // The position is the one from hoot65's game
    const game = seed.find((g) => g.movesSan.slice(0, 14).join(' ') === 'e4 d5 e5 e6 d4 f6 Nf3 fxe5 Nxe5 Bd6 Qh5+ g6 Nxg6 Nf6');
    expect(game?.userColor).toBe('white');
    expect(after(...game!.movesSan.slice(0, 10)).fen()).toBe(ex.fen);
  });

  it('the counts come from the seed games, by position, and the weights on the lesson are those counts', () => {
    // "1...e6 came up in 10 of your White games: you answered 2.Nc3 in 7, 2.Nf3 in 2 and 2.d4 once"
    expect(tally(reached(['e4', 'e6']))).toEqual({ Nc3: 7, Nf3: 2, d4: 1 });
    // "The position after 2.d4 d5 3.e5 came up in 6 of your games, five of them through 1.e4 d5 2.e5 e6 3.d4, and you scored 5 points"
    const advance = reached(A);
    expect(advance.length).toBe(6);
    expect(advance.filter((h) => h.game.movesSan.slice(0, 5).join(' ') === 'e4 d5 e5 e6 d4').length).toBe(5);
    expect(points(advance)).toBe(5);
    expect(tally(advance)).toEqual({ c5: 3, f6: 1, Bd7: 1, a6: 1 });
    // "4.Nf3, your move in 2 of these 3 games (you won both)", "4.Bb5+, your move in the third game"
    const c5 = reached([...A, 'c5']);
    expect(tally(c5)).toEqual({ Nf3: 2, 'Bb5+': 1 });
    expect(c5.filter((h) => h.next === 'Nf3').map((h) => h.game.userResult)).toEqual(['win', 'win']);
    // "4.Nf3, your move in this game" against 3...f6; "4.Nc3, your move in this game (you lost it)" against 3...a6
    expect(reached([...A, 'f6']).map((h) => h.next)).toEqual(['Nf3']);
    expect(reached([...A, 'a6']).map((h) => [h.next, h.game.userResult])).toEqual([['Nc3', 'loss']]);

    const m = frenchAdvanceForWhiteLesson.moves;
    expect(m[3].frequency).toBe(tally(reached(['e4', 'e6', 'd4'])).d5);
    expect(m[5].frequency).toBe(3);
    for (const alt of ['f6', 'Bd7', 'a6']) expect(m[5].alternatives![alt][0].frequency, alt).toBe(1);
    // No seed game reached 4.c3, so nothing after it carries a count
    expect(reached([...A, 'c5', 'c3'])).toEqual([]);
    expect(m[7].frequency).toBeUndefined();
    for (const continuation of Object.values(m[7].alternatives!)) expect(continuation[0].frequency).toBeUndefined();
  });

  it('sits in the group on loose pieces on the long lines after the Caro-Kann Advance; its header names no answer', () => {
    const group = patternPath.find((g) => g.lessonIds.includes(frenchAdvanceForWhiteLesson.id))!;
    expect(group.id).toBe('pattern-loose-pieces-long-lines');
    expect(group.lessonIds.indexOf(frenchAdvanceForWhiteLesson.id)).toBe(group.lessonIds.indexOf('lesson-black-caro-kann-advance') + 1);
    for (const header of [frenchAdvanceForWhiteLesson.title, frenchAdvanceForWhiteLesson.subtitle ?? '']) {
      expect(header).not.toMatch(/d4|e5|c3|Nf3|a3|Be2|Bd3|Qh5/);
    }
    expect(frenchAdvanceForWhiteLesson.exercises[0].title).not.toMatch(/Qh5|Nxg6|check/i);
  });
});
