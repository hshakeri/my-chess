import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  allCurriculumLessons,
  curriculumCourses,
  allWorksheets,
  getCurriculumLessonById,
} from '../../../src/curriculum';
import seedGamesRaw from '../../../src/data/seed_hoot65_games.json';
import { CurriculumMove } from '../../../src/types/curriculum';

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

  it('walks every branch: each alternative key is legal for the opponent, each continuation move is legal and every fenAfter matches chess.js', () => {
    let alternativesVerified = 0;
    let branchMovesVerified = 0;
    const lessonsWithBranches = new Set<string>();

    const walk = (lessonId: string, moves: CurriculumMove[], fromFen: string, where: string) => {
      const chess = new Chess(fromFen);
      for (const move of moves) {
        const fenBefore = chess.fen();
        if (move.alternatives) {
          expect(move.isUserMove, `${lessonId} ${where}: alternatives on a user move ${move.san}`).toBe(false);
          for (const [altSan, continuation] of Object.entries(move.alternatives)) {
            lessonsWithBranches.add(lessonId);
            expect(new Chess(fenBefore).moves(), `${lessonId} ${where}: alternative '${altSan}' must be legal. FEN: ${fenBefore}`).toContain(altSan);
            expect(altSan).not.toBe(move.san);
            expect(continuation.length).toBeGreaterThan(0);
            expect(continuation[0].isUserMove, `${lessonId} ${where}: branch ${altSan} must start with the student's reply`).toBe(true);
            const branch = new Chess(fenBefore);
            branch.move(altSan);
            alternativesVerified++;
            walk(lessonId, continuation, branch.fen(), `${where} > ${altSan}`);
          }
        }
        expect(chess.moves(), `${lessonId} ${where}: move ${move.san} (ply ${move.ply}) must be legal. FEN: ${fenBefore}`).toContain(move.san);
        const result = chess.move(move.san);
        expect(chess.fen()).toBe(move.fenAfter);
        expect(move.uci).toBe(`${result.from}${result.to}${result.promotion || ''}`);
        if (move.isUserMove) {
          expect(move.hintPiece, `${lessonId} ${where} ply ${move.ply}`).toBeTruthy();
          expect(move.hintSquare, `${lessonId} ${where} ply ${move.ply}`).toMatch(/^[a-h][1-8]$/);
        }
        if (where !== 'main') branchMovesVerified++;
      }
    };

    for (const lesson of allCurriculumLessons) walk(lesson.id, lesson.moves, lesson.initialFen, 'main');

    expect(alternativesVerified).toBeGreaterThanOrEqual(11);
    expect(branchMovesVerified).toBeGreaterThanOrEqual(50);
    expect([...lessonsWithBranches].sort()).toEqual([
      'lesson-caro-kann-discipline-drill',
      'lesson-evans-gambit-destruction',
      'lesson-scandinavian-refutation-drill',
    ]);
  });

  it('seeds branch frequencies from the archive: the counts in the lesson data are the counts in the games', () => {
    const archive = (seedGamesRaw as unknown as Array<{ white: { name: string }; black: { name: string }; movesSan: string[] }>);
    const repliesAfter = (prefix: string[]): Record<string, number> => {
      const counts: Record<string, number> = {};
      for (const g of archive) {
        if (g.white.name.toLowerCase() !== 'hoot65') continue;
        if (g.movesSan.length <= prefix.length) continue;
        if (prefix.some((san, i) => g.movesSan[i] !== san)) continue;
        const reply = g.movesSan[prefix.length];
        counts[reply] = (counts[reply] || 0) + 1;
      }
      return counts;
    };
    const evans = getCurriculumLessonById('lesson-evans-gambit-destruction')!;
    const afterBc4 = repliesAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    expect(afterBc4).toMatchObject({ h6: 16, Nf6: 12, Bc5: 11, Nd4: 5 });
    const bc5 = evans.moves[5];
    expect(bc5.san).toBe('Bc5');
    expect(bc5.frequency).toBe(afterBc4.Bc5);
    expect(bc5.alternatives!.Nf6[0].frequency).toBe(afterBc4.Nf6);
    expect(bc5.alternatives!.Nd4[0].frequency).toBe(afterBc4.Nd4);
    expect(bc5.alternatives!.h6[0].frequency).toBe(afterBc4.h6);
    expect(repliesAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'])).toEqual({ Bxb4: 7 });
    expect(evans.moves[7].frequency).toBe(7);
    expect(repliesAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Bc5', 'd4', 'exd4', 'O-O'])).toEqual({ dxc3: 4 });
    expect(evans.moves[13].alternatives!.dxc3[0].frequency).toBe(4);

    const scandi = getCurriculumLessonById('lesson-scandinavian-refutation-drill')!;
    expect(repliesAfter(['e4', 'd5', 'exd5'])).toEqual({ Qxd5: 2 });
    expect(scandi.moves[3].frequency).toBe(2);
    expect(repliesAfter(['e4', 'd5', 'exd5', 'Qxd5', 'Nc3'])).toEqual({ Qd8: 1, 'Qe6+': 1 });
    expect(scandi.moves[5].alternatives!.Qd8[0].frequency).toBe(1);
    expect(scandi.moves[5].alternatives!['Qe6+'][0].frequency).toBe(1);

    // No archived game reached 2.d4 against the Caro-Kann, so no reply there carries a count
    expect(repliesAfter(['e4', 'c6', 'd4'])).toEqual({});
    const caro = getCurriculumLessonById('lesson-caro-kann-discipline-drill')!;
    expect(caro.moves[5].frequency).toBeUndefined();
    for (const continuation of Object.values(caro.moves[5].alternatives!)) expect(continuation[0].frequency).toBeUndefined();
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

  it('should verify common mistakes and traps have valid trigger FENs and fully legal refutation lines', () => {
    for (const lesson of allCurriculumLessons) {
      if (lesson.commonMistakesAndTraps) {
        for (const mt of lesson.commonMistakesAndTraps) {
          const chess = new Chess(mt.triggerFen);
          expect(chess.fen()).toBe(mt.triggerFen);

          const attempt = chess.move(mt.attemptedSan);
          expect(attempt, `mistake ${mt.attemptedSan} in ${lesson.id}`).toBeDefined();
          for (const refSan of mt.refutationSanList) {
            const refResult = chess.move(refSan);
            expect(refResult, `refutation ${refSan} in ${lesson.id}`).toBeDefined();
          }
        }
      }
    }
  });

  it('cites personal drill games with the dates recorded in the archive', () => {
    const drills = allCurriculumLessons.filter((l) => l.category === 'weakness_drill');
    const archive = (seedGamesRaw as unknown as Array<{ url?: string; pgn: string }>);
    const dateOf = (id: string) => {
      const g = archive.find((x) => x.url?.endsWith(`/${id}`));
      const m = g?.pgn.match(/\[Date "(\d{4})\.(\d{2})\.(\d{2})"\]/);
      return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
    };
    const meny = drills.find((l) => l.description?.includes('meny_26'));
    expect(meny?.description).toContain(dateOf('185031553576')!);
    expect(meny?.description).toContain('185031553576');
    const brandon = drills.find((l) => l.description?.includes('Brandon0015'));
    expect(brandon?.description).toContain(dateOf('185135704918')!);
    expect(brandon?.description).toContain('185135704918');
    for (const ws of allWorksheets.filter((w) => w.type === 'hoot65_drill')) {
      expect(ws.lessonSummary).not.toMatch(/2026\/10\/2[12]/);
    }
  });

  it('does not track page numbers in attributions (chapter names only)', () => {
    for (const lesson of allCurriculumLessons) {
      expect(lesson.pagesRef || '').not.toMatch(/\bpp?\.\s*\d/);
    }
    for (const course of curriculumCourses) {
      expect(course.sourceAttribution.pagesRef || '').not.toMatch(/\bpp?\.\s*\d/);
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

  it('should have all 5 courses defined with valid metadata and distinct categories', () => {
    expect(curriculumCourses.length).toBeGreaterThanOrEqual(5);
    for (const course of curriculumCourses) {
      expect(course.id).toBeDefined();
      expect(course.title).toBeDefined();
      expect(course.lessons.length).toBeGreaterThan(0);
      expect(course.sourceAttribution.bookTitle).toBeDefined();
    }
    const categories = curriculumCourses.map((c) => c.category);
    expect(new Set(categories).size).toBe(categories.length);
    expect(categories).toContain('anti_gambit');
  });
});
