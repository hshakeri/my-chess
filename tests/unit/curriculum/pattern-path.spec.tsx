import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Chess, Square } from 'chess.js';
import { allCurriculumLessons } from '../../../src/curriculum';
import { patternPath, patternGroupOf, inPatternOrder } from '../../../src/curriculum/patternPath';
import { missedThreatLessons, freePieceLessons, hangingMoveLessons, allowedMateLessons } from '../../../src/curriculum/gameDrills';
import { LessonsView } from '../../../src/views/LessonsView';
import { CurriculumLesson } from '../../../src/types/curriculum';

const lesson = (id: string): CurriculumLesson => {
  const l = allCurriculumLessons.find((x) => x.id === id);
  if (!l) throw new Error(`no lesson ${id}`);
  return l;
};
const group = (id: string) => patternPath.find((g) => g.id === id)!;
const core = allCurriculumLessons.filter((l) => l.relevance !== 'outside-repertoire');

/** The first solution move of each exercise, played from the exercise position. */
function firstMoves(l: CurriculumLesson) {
  return l.exercises.map((e) => {
    const before = new Chess(e.fen);
    const after = new Chess(e.fen);
    const move = after.move(e.solutionSan[0]);
    return { e, before, after, move };
  });
}

/** Play an exercise's whole solution and return the final position. */
function solved(e: CurriculumLesson['exercises'][number]): Chess {
  const c = new Chess(e.fen);
  for (const san of e.solutionSan) c.move(san);
  return c;
}

describe('Study path: every core lesson once, grouped by a pattern its lessons repeat', () => {
  it('places each core lesson in exactly one group and keeps the pattern library out', () => {
    const onPath = patternPath.flatMap((g) => g.lessonIds);
    expect(new Set(onPath).size).toBe(onPath.length);
    expect([...onPath].sort()).toEqual(core.map((l) => l.id).sort());
    for (const g of patternPath) expect(g.lessonIds.length, `${g.id} repeats its pattern`).toBeGreaterThanOrEqual(2);
    expect(patternGroupOf('lesson-siberian-trap')).toBeUndefined();
  });

  it('orders the default list by the path: the drill sets from the games, then the Scandinavian drill', () => {
    const ordered = inPatternOrder(core).map((l) => l.id);
    expect(ordered).toEqual(patternPath.flatMap((g) => g.lessonIds));
    // The path opens with the positions from hoot65's own games (the costliest checks), then the lessons
    const sets = [...missedThreatLessons, ...freePieceLessons, ...hangingMoveLessons, ...allowedMateLessons];
    const drills = sets.length;
    expect(ordered.slice(0, drills)).toEqual(sets.map((l) => l.id));
    expect(ordered[drills]).toBe('lesson-scandinavian-refutation-drill');
  });

  it('group 1: each lesson has an exercise where the queen takes an undefended piece on g4', () => {
    for (const id of group('pattern-queen-takes-on-g4').lessonIds) {
      const hits = firstMoves(lesson(id)).filter(({ move }) => move.san === 'Qxg4');
      expect(hits.length, id).toBeGreaterThan(0);
      for (const { before, move } of hits) {
        expect(['b', 'n']).toContain(move.captured);
        expect(before.attackers('g4' as Square, before.turn() === 'w' ? 'b' : 'w'), `${id}: g4 undefended`).toEqual([]);
        if (move.from === 'd1') {
          // The d1-g4 diagonal is open: the e-pawn has left e2 and f3 is empty
          expect(before.get('e2' as Square)).toBeFalsy();
          expect(before.get('f3' as Square)).toBeFalsy();
        } else {
          expect(move.from).toBe('a4'); // along the fourth rank
        }
      }
    }
  });

  it('group 2: the long lines win the undefended b2 pawn, the queen on c2, and bishops on d3 and b5', () => {
    // The London plan: after ...Qb6 nothing defends b2, because the c1 bishop has gone to f4
    const london = lesson('lesson-black-wall-vs-london');
    const c = new Chess(london.initialFen);
    for (const m of london.moves) {
      c.move(m.san);
      if (m.san === 'Qb6') break;
    }
    expect(c.get('c1' as Square)).toBeFalsy();
    expect(c.attackers('b2' as Square, 'w')).toEqual([]);
    expect(c.attackers('b2' as Square, 'b')).toEqual(['b6']);

    const expected: Record<string, [string, string]> = {
      'lesson-black-slav-wall': ['c2', 'q'],
      'lesson-black-wall-vs-flank': ['d3', 'b'],
      'lesson-black-caro-kann-advance': ['b5', 'b'],
    };
    for (const [id, [square, piece]] of Object.entries(expected)) {
      const hit = firstMoves(lesson(id)).find(({ move }) => move.to === square && move.captured === piece);
      expect(hit, id).toBeDefined();
      expect(['b', 'q']).toContain(hit!.move.piece);
      expect(hit!.before.attackers(square as Square, hit!.before.turn() === 'w' ? 'b' : 'w'), `${id}: ${square} undefended`).toEqual([]);
    }
  });

  it('group 3: three knight mates against a king that never castled, and the Evans castles before taking back', () => {
    const mates: Array<[string, string | null]> = [
      ['lesson-legals-mate', null], // nothing can take the d5 knight
      ['lesson-black-wall-vs-nc3-bg5', 'e2'], // the e7 pawn is pinned by the queen on e2
      ['lesson-blackburne-shilling-drill', 'e4'], // the e2 bishop is pinned by the queen on e4
    ];
    for (const [id, pinner] of mates) {
      const e = lesson(id).exercises.find((x) => solved(x).isCheckmate())!;
      const end = solved(e);
      const last = end.history({ verbose: true }).at(-1)!;
      expect(last.piece, id).toBe('n');
      const mated = end.turn();
      const takers = end.attackers(last.to, mated);
      if (pinner === null) {
        expect(takers, id).toEqual([]);
      } else {
        expect(takers.length, id).toBe(1);
        // Remove the pinning queen: the capture becomes legal, so the queen was what stopped it
        const fen = end.fen();
        const without = new Chess(fen);
        expect(without.get(pinner as Square)?.type).toBe('q');
        without.remove(pinner as Square);
        expect(without.moves({ square: takers[0], verbose: true }).some((m) => m.to === last.to), id).toBe(true);
      }
    }
    expect(lesson('lesson-evans-gambit-destruction').exercises[0].solutionSan).toEqual(['O-O', 'd6', 'cxd4']);
  });

  it('group 4: the same Classical line from both sides', () => {
    const line = lesson('lesson-black-caro-kann-classical').moves.map((m) => m.san);
    const route = ['Bf5', 'Bg6', 'Bh7'].map((san) => line.indexOf(san));
    expect(route.every((i) => i >= 0)).toBe(true);
    expect([...route].sort((a, b) => a - b)).toEqual(route);
    expect(line.indexOf('h4')).toBeLessThan(line.indexOf('h5'));
    const drill = lesson('lesson-caro-kann-discipline-drill');
    expect(drill.moves.slice(0, 12).map((m) => m.san)).toEqual(line.slice(0, 12));
    expect(drill.exercises[0].solutionSan.slice(0, 3)).toEqual(['Ng3', 'Bg6', 'h4']);
  });

  it('group 5: the rook mate keeps the king on the back rank, waits a move, and mates without stalemate', () => {
    const l = lesson('lesson-rook-back-rank-mate');
    const at = (ply: number) => {
      const x = new Chess(l.initialFen);
      for (const m of l.moves.slice(0, ply)) x.move(m.san);
      return x;
    };
    // 1.Rh7: every move of the black king stays on the back rank (1.Rh8+ would let it up)
    expect(at(1).moves({ verbose: true }).every((m) => m.to[1] === '8')).toBe(true);
    const check = at(0);
    check.move('Rh8+');
    expect(check.moves().some((m) => m.startsWith('K') && /7$/.test(m))).toBe(true);
    // 6.Kd6: the kings face to face, Black to move and only stepping aside
    expect(at(11).moves().sort()).toEqual(['Kc8', 'Ke8']);
    // 7.Ra7: if the king steps in front of yours, Ra8 is mate; the same after 8.Ke6 and 9.Kf6
    for (const [ply, step] of [[13, 'Kd8'], [15, 'Ke8'], [17, 'Kf8']] as const) {
      const x = at(ply);
      x.move(step);
      x.move('Ra8#');
      expect(x.isCheckmate(), `${ply} ${step}`).toBe(true);
    }
    // 10.Kg6 leaves one move, Kg8; 10.Rg7?? is stalemate
    expect(at(19).moves()).toEqual(['Kg8']);
    const trap = at(18);
    trap.move('Rg7');
    expect(trap.isStalemate()).toBe(true);
    // The mate: the king on g6 covers f7, g7 and h7
    const end = at(21);
    expect(end.isCheckmate()).toBe(true);
    expect(['f7', 'g7', 'h7'].every((sq) => end.attackers(sq as Square, 'w').includes('g6' as Square))).toBe(true);
    // The exercises: face to face Rh8# is the only mate; in the corner 1.Kg6 and 1.Rg7?? stalemates
    expect(new Chess(l.exercises[0].fen).moves().filter((m) => m.endsWith('#'))).toEqual(['Rh8#']);
    const corner = new Chess(l.exercises[1].fen);
    corner.move('Rg7');
    expect(corner.isStalemate()).toBe(true);
  });

  it('shows the groups in the lesson list, each with its check, in path order', () => {
    const html = renderToString(<LessonsView />);
    const positions = patternPath.map((g) => html.indexOf(`data-pattern-group="${g.id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // The first group's heading comes before the first lesson card, and every card follows its heading
    for (const g of patternPath) {
      const head = html.indexOf(`data-pattern-group="${g.id}"`);
      for (const id of g.lessonIds) expect(html.indexOf(`data-lesson-id="${id}"`), id).toBeGreaterThan(head);
    }
    expect(html).toContain('Check:');
    // Each drill set is one row of numbered tiles, not a card per position
    for (const set of [missedThreatLessons, freePieceLessons, hangingMoveLessons, allowedMateLessons]) {
      const row = html.slice(html.indexOf(`data-drill-set="${set[0].id}"`));
      expect(row.length).toBeLessThan(html.length);
      expect((row.slice(0, row.indexOf('</div>')).match(/data-lesson-id=/g) || []).length).toBe(set.length);
    }
    expect(html).toContain(`<button type="button" data-lesson-id="${missedThreatLessons[0].id}"`);
    expect(html).not.toContain(`<div data-lesson-id="${missedThreatLessons[0].id}"`);
  });
});
