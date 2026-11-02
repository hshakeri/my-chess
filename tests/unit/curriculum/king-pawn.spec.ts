import { describe, it, expect } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { allCurriculumLessons } from '../../../src/curriculum';
import { patternGroupOf } from '../../../src/curriculum/patternPath';
import { kpk } from './kpk-solver';

const lesson = allCurriculumLessons.find((l) => l.id === 'lesson-king-pawn-opposition')!;

/** Whether White's move `san` in `fen` keeps the win: a queen or rook the black king cannot take (and no stalemate), else the solver. */
function wins(fen: string, san: string): boolean {
  const c = new Chess(fen);
  const m = c.move(san);
  if (m.promotion) return 'qr'.includes(m.promotion) && !c.isStalemate() && !c.moves({ verbose: true }).some((r) => r.to === m.to);
  return kpk(c.fen()).win;
}
const winningMoves = (fen: string) => new Chess(fen).moves().filter((san) => wins(fen, san)).sort();
const after = (fen: string, ...sans: string[]) => {
  const c = new Chess(fen);
  for (const san of sans) c.move(san);
  return c;
};

describe('King and pawn against king (Finish the game)', () => {
  it('sits in the Finish the game group, after the rook mate and before stalemate', () => {
    const group = patternGroupOf(lesson.id)!;
    expect(group.id).toBe('pattern-finish-the-game');
    expect(group.lessonIds).toEqual(['lesson-queen-cage-box-mate', 'lesson-rook-back-rank-mate', 'lesson-king-pawn-opposition', 'lesson-stalemate-catastrophes']);
  });

  it('every White move of the main line is the only win until the last, which accepts every winning move; Black defends longest', () => {
    const board = new Chess(lesson.initialFen);
    expect(kpk(board.fen()).win).toBe(true);
    const userMoves = lesson.moves.filter((m) => m.isUserMove);
    for (const m of lesson.moves) {
      const fen = board.fen();
      if (m.isUserMove) {
        const last = m === userMoves[userMoves.length - 1];
        expect(winningMoves(fen), `${m.san} in ${fen}`).toEqual(last ? [m.san, ...(m.accept?.san ?? [])].sort() : [m.san]);
      } else {
        // The scripted reply loses slowest, or as slowly as any other
        const replies = board.moves().map((san) => ({ san, dtw: kpk(after(fen, san).fen()).dtw }));
        const longest = Math.max(...replies.map((r) => r.dtw));
        expect(replies.find((r) => r.san === m.san)!.dtw, `${m.san} in ${fen}`).toBe(longest);
        expect(replies.every((r) => kpk(after(fen, r.san).fen()).win)).toBe(true);
      }
      board.move(m.san);
    }
    expect(board.history().slice(-1)[0]).toBe('e8=Q');
    // The first call solves the whole ending (a few seconds)
  }, 60_000);

  it('the branch 1...Kc8 lets the pawn run, and every move the lesson accepts there wins', () => {
    const fen = after(lesson.initialFen, 'Kd6', 'Kc8').fen();
    const branch = lesson.moves[1].alternatives!.Kc8[0];
    expect(winningMoves(fen)).toEqual([branch.san, ...branch.accept!.san!].sort());
    // After 2.e7 the black king cannot reach d7 or d8: the pawn promotes next move
    const run = after(fen, 'e7');
    for (const reply of run.moves()) expect(wins(after(run.fen(), reply).fen(), 'e8=Q'), reply).toBe(true);
  });

  it('the wrong moves the lesson names draw, with the reply it names', () => {
    const start = lesson.initialFen;
    // 1.Ke5? Ke7 and 1.e7+? Kxe7
    expect(kpk(after(start, 'Ke5', 'Ke7').fen()).win).toBe(false);
    expect(after(start, 'e7+', 'Kxe7').isInsufficientMaterial()).toBe(true);
    // 2.Kc7? Ke7 and 2.Ke5? Ke7
    const two = after(start, 'Kd6', 'Ke8').fen();
    expect(kpk(after(two, 'Kc7', 'Ke7').fen()).win).toBe(false);
    expect(kpk(after(two, 'Ke5', 'Ke7').fen()).win).toBe(false);
    // After 2.e7 the black king's only move is to f7
    expect(after(two, 'e7').moves()).toEqual(['Kf7']);
    // 3.e8=Q+?? Kxe8, the trap at ply 4; 3.Kd7 guards e8 and e7
    const three = after(two, 'e7', 'Kf7');
    expect(lesson.commonMistakesAndTraps?.[0]).toMatchObject({ triggerFen: three.fen(), attemptedSan: 'e8=Q+', refutationSanList: ['Kxe8'] });
    expect(after(three.fen(), 'e8=Q+', 'Kxe8').isInsufficientMaterial()).toBe(true);
    const guarded = after(three.fen(), 'Kd7');
    expect(['e8', 'e7'].every((s) => guarded.attackers(s as Square, 'w').includes('d7' as Square))).toBe(true);
  });

  it('each exercise has one winning first move, and its explanation holds', () => {
    const [opposition, square, stalemate] = lesson.exercises;
    // Step in front: 1.Ke4 only; 1.e4? Kf6 draws
    expect(winningMoves(opposition.fen)).toEqual(['Ke4']);
    expect(kpk(after(opposition.fen, 'e4', 'Kf6').fen()).win).toBe(false);
    // The square: 1.e4 only (the double step); 1.e3? Kg3 draws
    expect(winningMoves(square.fen)).toEqual(['e4']);
    expect(kpk(after(square.fen, 'e3', 'Kg3').fen()).win).toBe(false);
    // Promote, not stalemate: 1.Kd6 only; 1.Ke6?? is stalemate; 1...Kf7 is forced, and 2.Kd7 wins
    expect(winningMoves(stalemate.fen)).toEqual(['Kd6']);
    expect(after(stalemate.fen, 'Ke6').isStalemate()).toBe(true);
    expect(after(stalemate.fen, 'Kd6').moves()).toEqual(['Kf7']);
    expect(winningMoves(after(stalemate.fen, 'Kd6', 'Kf7').fen())).toEqual(['Kd7']);
    expect(stalemate.solutionSan).toEqual(['Kd6', 'Kf7', 'Kd7']);
  });
});
