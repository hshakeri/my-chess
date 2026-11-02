import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { DEFAULT_MILESTONES, evaluateMilestones } from '../../../src/analytics/planMilestones';
import { replyLabel, labelAt, reviewGame } from '../../../src/analytics/review';

const after = (...moves: string[]) => {
  const c = new Chess();
  for (const m of moves) c.move(m);
  return c.fen();
};
const byLabel = (results: ReturnType<typeof evaluateMilestones>) => Object.fromEntries(results.map((r) => [r.label, r]));

describe('plan milestones of a spar (CL-6)', () => {
  const italian = after('e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5');

  it('castling, developing and keeping the material, as the spar goes', () => {
    const r = byLabel(evaluateMilestones(italian, ['O-O', 'Nf6', 'Nc3', 'O-O', 'd3', 'd6', 'Bg5'], 'w', DEFAULT_MILESTONES));
    expect(r['Castle']).toMatchObject({ status: 'met', ply: 0 });
    // The last minor piece at home, the c1 bishop, comes out with the student's move at ply 6
    expect(r['Bring out every knight and bishop']).toMatchObject({ status: 'met', ply: 6 });
    expect(r['Keep the material']).toMatchObject({ status: 'met' });
  });

  it('a goal reached before the spar is reported as such, one not reached as missed', () => {
    const castled = after('e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O', 'Nf6');
    const r = byLabel(evaluateMilestones(castled, ['d3', 'O-O'], 'w', DEFAULT_MILESTONES));
    expect(r['Castle'].status).toBe('already');
    expect(r['Bring out every knight and bishop'].status).toBe('missed');
    // Black's goals in the same moves: castled during the spar
    expect(byLabel(evaluateMilestones(castled, ['d3', 'O-O'], 'b', DEFAULT_MILESTONES))['Castle']).toMatchObject({ status: 'met', ply: 1 });
  });

  it('material lost in the spar misses the goal and says how much', () => {
    // 4.Bxf7+?? Kxf7: a bishop for a pawn
    const r = byLabel(evaluateMilestones(italian, ['Bxf7+', 'Kxf7'], 'w', DEFAULT_MILESTONES));
    expect(r['Keep the material']).toMatchObject({ status: 'missed', detail: '2 points of material down at the end' });
    // A pawn given up counts too
    const pawn = byLabel(evaluateMilestones(after('e4', 'd5'), ['Nc3', 'dxe4'], 'w', DEFAULT_MILESTONES));
    expect(pawn['Keep the material']).toMatchObject({ status: 'missed', detail: 'a pawn down at the end' });
  });

  it('a lesson\'s own goals: a pawn break, a key square, the bishop pair', () => {
    const goals = [
      { kind: 'pawn_to' as const, square: 'd4', label: 'Play d4' },
      { kind: 'piece_on' as const, square: 'd5', piece: 'n' as const, label: 'A knight on d5' },
      { kind: 'bishop_pair' as const },
    ];
    const r = byLabel(evaluateMilestones(italian, ['c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb6', 'Nc3', 'd6', 'Nd5', 'O-O'], 'w', goals));
    expect(r['Play d4']).toMatchObject({ status: 'met', ply: 2 });
    expect(r['A knight on d5']).toMatchObject({ status: 'met', ply: 8 });
    expect(r['Keep both bishops']).toMatchObject({ status: 'met' });
    expect(byLabel(evaluateMilestones(after('d4', 'd5'), [], 'w', goals))['Play d4'].status).toBe('already');
  });
});

describe('a review from a position that is not the start (a spar)', () => {
  it('numbers the moves and the phase from the position\'s own move number', async () => {
    // From the Italian after 3...Bc5 (move 4, White to move): 4.Bxf7+?? loses a bishop for a pawn
    const fen = after('e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5');
    const review = await reviewGame({ gameId: 's', movesSan: ['Bxf7+', 'Kxf7', 'O-O'], userColor: 'white', initialFen: fen }, null);
    expect(review.movesReviewed).toBe(2);
    expect(review.criticalMoments).toHaveLength(1);
    expect(review.criticalMoments[0]).toMatchObject({ ply: 0, label: '4.Bxf7+', type: 'moved_piece_hangs', refutation: 'Kxf7', phase: 'opening' });
    expect(replyLabel(review.criticalMoments[0].fenBefore, 'Kxf7')).toBe('4...Kxf7');
    expect(labelAt(after('e4', 'e5', 'Nf3'), 'Nc6')).toBe('2...Nc6');
  });
});
