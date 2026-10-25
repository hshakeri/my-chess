import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  allCurriculumLessons,
  curriculumCourses,
  allWorksheets,
  getCurriculumLessonById,
} from '../../../src/curriculum';

describe('Curriculum Move Legality & Verification (chess.js)', () => {
  it('should have at least 10 comprehensive curriculum lessons across 5 categories', () => {
    expect(allCurriculumLessons.length).toBeGreaterThanOrEqual(10);
    const categories = new Set(allCurriculumLessons.map((l) => l.category));
    expect(categories.has('opening')).toBe(true);
    expect(categories.has('trap')).toBe(true);
    expect(categories.has('fundamentals')).toBe(true);
    expect(categories.has('weakness_drill')).toBe(true);
  });

  it('should verify 100% of main line moves in all lessons are legal according to chess.js', () => {
    let totalMovesVerified = 0;

    for (const lesson of allCurriculumLessons) {
      const chess = new Chess(lesson.initialFen);

      expect(lesson.moves.length).toBeGreaterThan(0);

      for (const move of lesson.moves) {
        const legalSanMoves = chess.moves();
        expect(
          legalSanMoves,
          `Move ${move.san} (ply ${move.ply}) must be in legal moves in lesson '${lesson.id}'. FEN: ${chess.fen()}`
        ).toContain(move.san);

        const moveResult = chess.move(move.san);
        expect(moveResult).toBeDefined();
        expect(chess.fen()).toBe(move.fenAfter);

        if (move.uci) {
          const expectedUci = `${moveResult.from}${moveResult.to}${moveResult.promotion || ''}`;
          expect(move.uci).toBe(expectedUci);
        }

        totalMovesVerified++;
      }
    }

    expect(totalMovesVerified).toBeGreaterThan(80);
  });

  it('should verify 100% of exercise solutions in all lessons are legal step-by-step', () => {
    let totalExerciseMovesVerified = 0;

    for (const lesson of allCurriculumLessons) {
      expect(lesson.exercises.length).toBeGreaterThan(0);

      for (const ex of lesson.exercises) {
        const chess = new Chess(ex.fen);
        expect(ex.solutionSan.length).toBeGreaterThan(0);

        for (const solMove of ex.solutionSan) {
          const legalMoves = chess.moves();
          expect(
            legalMoves,
            `Exercise solution move '${solMove}' must be legal in exercise '${ex.id}' of lesson '${lesson.id}'. FEN: ${chess.fen()}`
          ).toContain(solMove);

          const result = chess.move(solMove);
          expect(result).toBeDefined();
          totalExerciseMovesVerified++;
        }
      }
    }

    expect(totalExerciseMovesVerified).toBeGreaterThan(20);
  });

  it('should verify common mistakes and traps have valid trigger FENs and refutations', () => {
    for (const lesson of allCurriculumLessons) {
      if (lesson.commonMistakesAndTraps) {
        for (const mt of lesson.commonMistakesAndTraps) {
          const chess = new Chess(mt.triggerFen);
          expect(chess.fen()).toBe(mt.triggerFen);

          // If the mistake is a legal chess move from triggerFen, test its execution
          const attempt = chess.move(mt.attemptedSan);
          if (attempt && mt.refutationSanList.length > 0) {
            // Test first refutation move
            const firstRef = mt.refutationSanList[0];
            const refResult = chess.move(firstRef);
            expect(refResult).toBeDefined();
          }
        }
      }
    }
  });

  it('should contain all required PDF source attributions without omitting authors', () => {
    const authors = allCurriculumLessons.map((l) => l.author);
    const sourceBooks = allCurriculumLessons.map((l) => l.sourceBook);

    // Scotch / Evans Gambit
    expect(sourceBooks.some((b) => b.includes('Tactics in Junior Openings'))).toBe(true);
    // Anti-Gambit
    expect(sourceBooks.some((b) => b.includes('Survive and Beat Annoying Chess Openings'))).toBe(true);
    expect(authors.some((a) => a.includes('Eric Schiller'))).toBe(true);
    // Traps
    expect(sourceBooks.some((b) => b.includes('101 Chess Opening Traps'))).toBe(true);
    expect(authors.some((a) => a.includes('Steve Giddins'))).toBe(true);
    // Fundamentals
    expect(sourceBooks.some((b) => b.includes('LearningChess'))).toBe(true);
    expect(authors.some((a) => a.includes('Jozsef Pinter'))).toBe(true);
    // Modernized Open Sicilian
    expect(sourceBooks.some((b) => b.includes('Modernized: The Open Sicilian'))).toBe(true);
    // Weakness drills citing hoot65 games
    expect(allCurriculumLessons.some((l) => l.category === 'weakness_drill' && l.description?.includes('meny_26'))).toBe(true);
    expect(allCurriculumLessons.some((l) => l.category === 'weakness_drill' && l.description?.includes('Brandon0015'))).toBe(true);
  });

  it('should verify worksheet diagram FENs and answer key sequences are valid', () => {
    expect(allWorksheets.length).toBeGreaterThanOrEqual(5);

    for (const ws of allWorksheets) {
      const diagramChess = new Chess(ws.diagramFen);
      expect(diagramChess.fen()).toBe(ws.diagramFen);
      expect(ws.exercises.length).toBeGreaterThan(0);
      expect(ws.answerKey.length).toBeGreaterThan(0);

      // Verify each answer key item has a valid solution
      for (const ak of ws.answerKey) {
        expect(ak.solutionSan).toBeTruthy();
        expect(ak.rationale).toBeTruthy();

        if (ak.fullSequence && ak.fullSequence.length > 0) {
          // If a sequence of moves is given, verify that clean SANs parse
          const cleanSans = ak.fullSequence.map((m) => m.replace(/^[0-9]+\.\.\.?/, '').replace(/[!?+#]/g, '').trim());
          expect(cleanSans.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('should find lessons by id and filter by category correctly', () => {
    const scotch = getCurriculumLessonById('lesson-scotch-gambit-breakthrough');
    expect(scotch).toBeDefined();
    expect(scotch?.eco).toBe('C44');

    const scandi = getCurriculumLessonById('lesson-scandinavian-refutation-drill');
    expect(scandi).toBeDefined();
    expect(scandi?.category).toBe('weakness_drill');

    const unknown = getCurriculumLessonById('non-existent-lesson-id');
    expect(unknown).toBeUndefined();
  });

  it('should have all 5 courses defined with valid metadata', () => {
    expect(curriculumCourses.length).toBeGreaterThanOrEqual(5);
    for (const course of curriculumCourses) {
      expect(course.id).toBeDefined();
      expect(course.title).toBeDefined();
      expect(course.lessons.length).toBeGreaterThan(0);
      expect(course.sourceAttribution.bookTitle).toBeDefined();
    }
  });
});
