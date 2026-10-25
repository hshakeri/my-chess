import { describe, it, expect } from 'vitest';
import { buildVerifiedLesson, firstUserDecision, positionKey, LessonConfig } from '../../../src/curriculum/builder';
import { allCurriculumLessons } from '../../../src/curriculum';
import { scandinavianRefutationDrill } from '../../../src/curriculum/drills';
import { stalemateCatastrophes } from '../../../src/curriculum/fundamentals';

const base = (over: Partial<LessonConfig>): LessonConfig => ({
  id: 'test-lesson',
  title: 'Test',
  category: 'opening',
  sourceBook: 'Test Book',
  author: 'Tester',
  targetColor: 'white',
  moves: [{ san: 'e4' }, { san: 'e5' }, { san: 'Nf3' }],
  exercises: [],
  ...over,
});

describe('Curriculum builder: derived hints, acceptance rules and strict legality', () => {
  it('derives a piece and square hint for every user move so hints never fall back to the move itself', () => {
    for (const lesson of allCurriculumLessons) {
      for (const move of lesson.moves) {
        expect(move.hintPiece, `${lesson.id} ply ${move.ply}`).toBeTruthy();
        expect(move.hintSquare, `${lesson.id} ply ${move.ply}`).toMatch(/^[a-h][1-8]$/);
      }
    }
    const lesson = buildVerifiedLesson(base({}));
    expect(lesson.moves[2].hintPiece).toBe('Knight on g1');
    expect(lesson.moves[2].hintSquare).toBe('f3');
  });

  it('keeps authored hints when present', () => {
    const lesson = buildVerifiedLesson(base({ moves: [{ san: 'e4', hintPiece: 'King Pawn', hintSquare: 'e4' }] }));
    expect(lesson.moves[0].hintPiece).toBe('King Pawn');
  });

  it('accepts a checkmate predicate only when the scripted move is mate, and only on the final move', () => {
    expect(stalemateCatastrophes.moves[0].accept?.predicate).toBe('checkmate');
    expect(() =>
      buildVerifiedLesson(base({ moves: [{ san: 'e4', accept: { predicate: 'checkmate' } }] }))
    ).toThrow(/checkmate/);
    expect(() =>
      buildVerifiedLesson(base({ moves: [{ san: 'e4', accept: { san: ['d4'] } }, { san: 'e5' }] }))
    ).toThrow(/final move/);
  });

  it('validates acceptance alternatives against the position and rejects illegal ones', () => {
    const ok = buildVerifiedLesson(base({ moves: [{ san: 'e4', accept: { san: ['d4', 'Nf3'] } }] }));
    expect(ok.moves[0].accept?.san).toEqual(['d4', 'Nf3']);
    expect(() =>
      buildVerifiedLesson(base({ moves: [{ san: 'e4', accept: { san: ['Qh5'] } }] }))
    ).toThrow(/Illegal acceptance alternative/);
  });

  it('throws when a refutation line contains an illegal move instead of silently skipping it', () => {
    expect(() =>
      buildVerifiedLesson(
        base({
          mistakesAndTraps: [
            {
              plyIndex: 0,
              attemptedSan: 'f3',
              isTrap: false,
              severity: 'inaccuracy',
              explanatoryFeedback: 'x',
              refutationSanList: ['e5', 'Qh5'],
              punishmentSummary: 'y',
            },
          ],
        })
      )
    ).toThrow(/Illegal refutation move 'Qh5'/);
    // Every shipped refutation line replays legally (the builder would have thrown otherwise)
    for (const lesson of allCurriculumLessons) {
      expect(lesson.commonMistakesAndTraps).toBeDefined();
    }
  });

  it('records startPly and relevance and rejects an out-of-range start ply', () => {
    expect(scandinavianRefutationDrill.startPly).toBe(2);
    expect(scandinavianRefutationDrill.relevance).toBe('core');
    expect(() => buildVerifiedLesson(base({ startPly: 9 }))).toThrow(/startPly/);
    const defaults = buildVerifiedLesson(base({}));
    expect(defaults.startPly).toBe(0);
    expect(defaults.relevance).toBe('core');
  });

  it('firstUserDecision returns the position of the drill point, not the start position', () => {
    const decision = firstUserDecision(scandinavianRefutationDrill);
    expect(decision?.move.san).toBe('exd5');
    expect(positionKey(decision!.fenBefore)).toBe('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -');
  });

  it('marks exactly the off-repertoire lessons as pattern library', () => {
    const outside = allCurriculumLessons.filter((l) => l.relevance === 'outside-repertoire').map((l) => l.id).sort();
    expect(outside).toEqual(
      [
        'lesson-adams-attack-sicilian',
        'lesson-elephant-trap-qgd',
        'lesson-noahs-ark-trap',
        'lesson-refuting-elephant-gambit',
        'lesson-refuting-konikowski-gambit',
        'lesson-refuting-latvian-gambit',
        'lesson-scotch-gambit-breakthrough',
        'lesson-siberian-trap',
      ].sort()
    );
  });
});
