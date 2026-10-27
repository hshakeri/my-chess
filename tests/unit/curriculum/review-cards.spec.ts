import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { enumerateDecisions, findMoveAtPath, matingMoves, positionKey } from '../../../src/curriculum/builder';
import { lessonFromDecision } from '../../../src/curriculum/factories';
import { stalemateCatastrophes } from '../../../src/curriculum/fundamentals';
import { evansGambitDestruction, scotchGambitBreakthrough } from '../../../src/curriculum/openings';
import { allCurriculumLessons } from '../../../src/curriculum';
import { canonicalFenKey } from '../../../src/services/fenKey';

/**
 * Review cards are rebuilt from the card store, not from one lesson: they must accept every answer
 * the card accepts, keep the lesson's teaching for that decision, and never print the answer.
 */
describe('Review cards built from decisions', () => {
  it('expands a checkmate predicate into every mating move so the card accepts all of them', () => {
    expect(matingMoves('k7/8/1K1Q4/8/8/8/8/8 w - - 0 1').sort()).toEqual(['Qd8#', 'Qf8#']);
    const [decision] = enumerateDecisions(stalemateCatastrophes);
    expect(decision.acceptedSan[0]).toBe('Qd8#');
    expect(decision.acceptedSan).toContain('Qf8#');

    const lesson = lessonFromDecision(stalemateCatastrophes, decision);
    expect(lesson.moves[0].san).toBe('Qd8#');
    expect(lesson.moves[0].accept?.san).toEqual(['Qf8#']);
    // The lesson's own stalemate trap travels with the card
    expect(lesson.commonMistakesAndTraps?.map((t) => t.attemptedSan)).toEqual(['Qc7']);
    expect(lesson.commonMistakesAndTraps?.[0].explanatoryFeedback).toMatch(/STALEMATE/);
  });

  it('keeps every accepted answer of a position shared by several lessons', () => {
    // After 1.e4 e5 2.Nf3 Nc6 the Evans lesson plays 3.Bc4 and the Scotch lesson 3.d4: one card, two answers
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const evansSpec = enumerateDecisions(evansGambitDestruction).find((d) => canonicalFenKey(d.fen) === canonicalFenKey(fen))!;
    const scotchSpec = enumerateDecisions(scotchGambitBreakthrough).find((d) => canonicalFenKey(d.fen) === canonicalFenKey(fen))!;
    expect(evansSpec.acceptedSan).toEqual(['Bc4']);
    expect(scotchSpec.acceptedSan).toEqual(['d4']);

    const lesson = lessonFromDecision(evansGambitDestruction, {
      ...evansSpec,
      acceptedSan: ['Bc4', 'd4', 'Bb5'],
    });
    const decision = lesson.moves[lesson.moves.length - 1];
    expect(decision.isUserMove).toBe(true);
    expect(decision.san).toBe('Bc4');
    expect(decision.accept?.san).toEqual(['d4', 'Bb5']);
    // The context plies before the decision are replayed, the student's own earlier moves included
    expect(lesson.moves.slice(0, -1).every((m) => !m.isUserMove)).toBe(true);
    expect(lesson.moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    expect(lesson.initialFen).toBe(new Chess().fen());
    // The lesson's teaching for this decision is kept
    expect(decision.annotation).toBe(evansGambitDestruction.moves[4].annotation);
    expect(decision.hintSquare).toBe('c4');
  });

  it('finds the lesson move at a path through a branch and through the main line', () => {
    const main = findMoveAtPath(evansGambitDestruction, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    expect(main?.san).toBe('Bc4');
    expect(main?.isUserMove).toBe(true);
    const branchReply = findMoveAtPath(evansGambitDestruction, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4']);
    expect(branchReply?.san).toBe('Nd4');
    expect(branchReply?.isUserMove).toBe(false);
    const inBranch = findMoveAtPath(evansGambitDestruction, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxd4']);
    expect(inBranch?.isUserMove).toBe(true);
    expect(inBranch?.san).toBe('Nxd4');
    expect(findMoveAtPath(evansGambitDestruction, ['e4', 'c5'])).toBeUndefined();
  });

  it('labels a decision in a non-start position by its move number, never by the answer', () => {
    const fen = 'rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3';
    const lesson = lessonFromDecision(undefined, { fen, acceptedSan: ['Bf5'], path: [], lessonId: 'drill-x' });
    expect(lesson.title).toBe('Black to move');
    expect(lesson.moves).toHaveLength(1);
    expect(lesson.initialFen).toBe(fen);
    // enumerateDecisions on that ad-hoc lesson labels the card by the move number
    const [spec] = enumerateDecisions(lesson);
    expect(spec.title).toBe('Black to move (move 3)');
    expect(spec.title).not.toContain('Bf5');
  });

  it('every card title of every shipped lesson is answer-free and its key equals the canonical position', () => {
    for (const lesson of allCurriculumLessons) {
      for (const spec of enumerateDecisions(lesson)) {
        for (const san of spec.acceptedSan) {
          expect(spec.title ?? '', `${lesson.id} ${spec.path.join(' ')}`).not.toMatch(new RegExp(`(^|[^A-Za-z0-9])${san.replace(/[+#]/g, '')}(?![A-Za-z0-9])`));
        }
        expect(positionKey(spec.fen)).toBe(positionKey(new Chess(spec.fen).fen()));
      }
    }
  });
});
