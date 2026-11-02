import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  attackedByMove,
  isMoveSafe,
  knightSquares,
  opponentChecks,
  questionBeforeDecision,
  sameSquares,
  undefendedPieces,
} from '../../../src/services/microQuestions';
import { isRight } from '../../../src/components/BoardQuestion';

const after = (...moves: string[]) => {
  const c = new Chess();
  for (const m of moves) c.move(m);
  return c.fen();
};

describe('microQuestions: board questions with answers from chess.js (CL-5)', () => {
  it('what a move attacks: the moved piece, and a line it opens', () => {
    // 3.Bb5 attacks the c6 knight
    expect(attackedByMove(after('e4', 'e5', 'Nf3', 'Nc6'), 'Bb5')).toMatchObject({ squares: ['c6'], moved: 'b5' });
    // Pawns don't count: 2.Nf3 attacks only the e5 pawn
    expect(attackedByMove(after('e4', 'e5'), 'Nf3').squares).toEqual([]);
    // The knight leaves the a-file and the a1 rook now attacks the a8 rook
    expect(attackedByMove('r3k3/8/8/8/N7/8/8/R3K3 w - - 0 1', 'Nc3').squares).toEqual(['a8']);
    // A check attacks the king, and here the queen on f7 also hits the f8 bishop and the g8 knight
    expect(attackedByMove(after('e4', 'e5', 'Qh5', 'Nc6'), 'Qxf7+').squares).toEqual(['e8', 'f8', 'g8']);
  });

  it('undefended pieces, not counting pawns and the king', () => {
    // At the start only the corner rooks have no defender
    expect(undefendedPieces(new Chess().fen(), 'w')).toEqual(['a1', 'h1']);
    expect(undefendedPieces('4k3/8/8/8/3N4/8/8/4K3 w - - 0 1', 'w')).toEqual(['d4']);
    // The d6 queen of the stalemate lesson: the b6 king does not reach d6
    expect(undefendedPieces('k7/8/1K1Q4/8/8/8/8/8 w - - 0 1', 'w')).toEqual(['d6']);
  });

  it('the checks the opponent would have if it were their move', () => {
    // Black to move; White's rook could check along the eighth rank only (the e1 king blocks the first rank)
    expect(opponentChecks('7k/8/8/8/8/8/8/R3K3 b - - 0 1')).toEqual(['Ra8+']);
    expect(opponentChecks(new Chess().fen())).toEqual([]);
    // No question when the side to move is in check
    expect(opponentChecks(after('e4', 'e5', 'Qh5', 'Nc6', 'Qxf7+'))).toEqual([]);
  });

  it('knight squares', () => {
    expect(knightSquares('b1')).toEqual(['a3', 'c3', 'd2']);
    expect(knightSquares('e4')).toEqual(['c3', 'c5', 'd2', 'd6', 'f2', 'f6', 'g3', 'g5']);
    expect(knightSquares('h8')).toEqual(['f7', 'g6']);
  });

  it('whether a move is safe: nothing new left to take and no mate in one', () => {
    const fen = after('e4', 'e5', 'Qh5', 'Nc6');
    expect(isMoveSafe(fen, 'Qxe5+')).toMatchObject({ safe: false, reason: 'After Qxe5+, the queen on e5 can be taken.' });
    expect(isMoveSafe(fen, 'Bc4').safe).toBe(true);
    expect(isMoveSafe(after('f3', 'e5'), 'g4')).toEqual({ safe: false, reason: 'After g4 the opponent mates with Qh4#.' });
  });

  it('the question before a decision, and how answers are judged', () => {
    const q1 = questionBeforeDecision(after('e4', 'e5', 'Nf3', 'Nc6', 'Bb5'), { fenBefore: after('e4', 'e5', 'Nf3', 'Nc6'), san: 'Bb5' });
    expect(q1).toMatchObject({ kind: 'attacks', answer: ['c6'], focus: ['b5'], noneLabel: 'Nothing' });
    expect(isRight(q1, ['c6'])).toBe(true);
    expect(isRight(q1, [])).toBe(false);
    expect(isRight(q1, ['c6', 'e5'])).toBe(false);

    const q2 = questionBeforeDecision('4k3/8/8/8/3N4/8/8/4K3 w - - 0 1', null);
    expect(q2).toMatchObject({ kind: 'undefended', answer: ['d4'] });

    // Everything defended and no opponent move before: the checks question
    const q3 = questionBeforeDecision('7k/8/8/8/8/8/8/R3K3 b - - 0 1', null);
    expect(q3).toMatchObject({ kind: 'checks', answer: 1, checks: ['Ra8+'] });
    expect(isRight(q3, 1)).toBe(true);
    expect(isRight(q3, 0)).toBe(false);
    expect(isRight({ kind: 'checks', prompt: '', answer: 5, checks: [] }, 4)).toBe(true);

    expect(sameSquares(['a1', 'b2'], ['b2', 'a1'])).toBe(true);
  });
});

describe('warm-up questions on positions from the student\'s games (CL-5)', () => {
  it('asks about a position where the student is to move, with an answer worked out from the position', async () => {
    const { makeWarmupItem } = await import('../../../src/views/WarmupPanel');
    const { enPrise } = await import('../../../src/analytics/errorTaxonomy');
    const seed = (await import('../../../src/data/seed_hoot65_games.json')).default as any[];
    // A seeded random, so the test always sees the same positions
    let state = 7;
    const random = () => ((state = (state * 48271) % 2147483647) / 2147483647);
    const kinds = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const item = makeWarmupItem(seed, random)!;
      expect(item).toBeTruthy();
      const chess = new Chess(item.fen);
      expect(chess.turn()).toBe(item.orientation);
      const q = item.question;
      kinds.add(q.kind);
      if (q.kind === 'knight') {
        expect(chess.get(q.focus[0] as any)).toMatchObject({ type: 'n', color: item.orientation });
        expect(q.answer).toEqual(knightSquares(q.focus[0]));
      } else if (q.kind === 'loose') {
        expect(q.answer).toEqual(enPrise(chess, item.orientation).map((p) => p.square).sort());
      } else if (q.kind === 'safe') {
        expect(q.answer).toBe(isMoveSafe(item.fen, q.move).safe);
      }
    }
    expect(kinds).toEqual(new Set(['knight', 'loose', 'safe']));
  });
});
