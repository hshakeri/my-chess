import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  allCurriculumLessons,
  curriculumCourses,
  allWorksheets,
  getCurriculumLessonById,
  isGameDrill,
} from '../../../src/curriculum';
import seedGamesRaw from '../../../src/data/seed_hoot65_games.json';
import { CurriculumMove } from '../../../src/types/curriculum';
import { worksheetSan, worksheetLine, worksheetSetupMoves, fenSideToMove } from '../../../src/curriculum/worksheetLines';

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
    // The opening study order (docs/handoff-prompt.md) added the Blackburne-Shilling drill, the Alapin
    // and the seven Black repertoire lessons, all with archive-weighted branches. The Stockfish pass gave
    // the Konikowski lesson a 9...Bd7 branch (unobserved in the archive, so unweighted). The king and pawn
    // ending has the other way to give way, 1...Kc8 (an ending, so unweighted too). The Caro-Kann
    // lesson against 2.Bc4 (2026-11-02) branches on White's fourth and fifth moves, and the Exchange lesson on
    // White's fourth and fifth, the Two Knights lesson with 4.d4 on Black's fifth, and White's lesson against
    // the Caro-Kann on Black's third and fourth, weighted from the seed; the Caro-Kann lesson against 2.e5 and 2.d3 branches on White's second and third moves.
    // White's lesson against the French (2026-11-02) branches on Black's third move (weighted from the seed by
    // position), fourth and sixth (unobserved, so unweighted).
    expect([...lessonsWithBranches].sort()).toEqual([
      'lesson-alapin-sicilian-centre',
      'lesson-black-caro-bg4-timing',
      'lesson-black-caro-exchange',
      'lesson-black-caro-kann-advance',
      'lesson-black-caro-kann-classical',
      'lesson-black-caro-vs-bc4',
      'lesson-black-caro-vs-e5-d3',
      'lesson-black-caro-vs-f4',
      'lesson-black-slav-wall',
      'lesson-black-wall-vs-flank',
      'lesson-black-wall-vs-london',
      'lesson-black-wall-vs-nc3-bg5',
      'lesson-blackburne-shilling-drill',
      'lesson-caro-kann-discipline-drill',
      'lesson-evans-gambit-destruction',
      'lesson-king-pawn-opposition',
      'lesson-refuting-konikowski-gambit',
      'lesson-scandinavian-refutation-drill',
      'lesson-two-knights-d4',
      'lesson-white-vs-caro-kann',
      'lesson-white-vs-damiano',
      'lesson-white-vs-french',
      'lesson-white-vs-nimzowitsch',
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
      // A drill position from hoot65's games is itself the exercise: one decision, nothing after it
      if (!isGameDrill(lesson.id)) expect(lesson.exercises.length).toBeGreaterThan(0);

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

  it('every refutation line shows what the mistake costs', () => {
    // Material in centipawns from `color`'s side; kings count nothing
    const VALUE: Record<string, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };
    const MATE = 100000;
    const balance = (chess: Chess, color: 'w' | 'b') =>
      chess
        .board()
        .flat()
        .reduce((s, sq) => s + (sq ? (sq.color === color ? 1 : -1) * VALUE[sq.type] : 0), 0);
    // Material from the side to move once the captures still on the board are played out (checks answered)
    const settled = (chess: Chess, alpha: number, beta: number, depth: number): number => {
      const inCheck = chess.inCheck();
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) return inCheck ? -MATE : 0;
      if (depth === 0) return balance(chess, chess.turn());
      if (!inCheck) {
        const standPat = balance(chess, chess.turn());
        if (standPat >= beta) return standPat;
        alpha = Math.max(alpha, standPat);
      }
      for (const m of moves) {
        if (!inCheck && !m.captured && !m.promotion) continue;
        chess.move(m);
        const score = -settled(chess, -beta, -alpha, depth - 1);
        chess.undo();
        if (score >= beta) return score;
        alpha = Math.max(alpha, score);
      }
      return alpha;
    };

    // After a blunder or a trap the line ends in mate, in a material gain of at least a pawn over the position
    // before the mistake that survives the captures still available, or in stalemate when the side that erred was
    // a piece or more up. An inaccuracy's line may be a quiet continuation (2.e5 d4 in the Scandinavian), but it
    // may not hand material back: it ends at least as well for the refuting side as the position after the mistake.
    let checked = 0;
    for (const lesson of allCurriculumLessons) {
      for (const mt of lesson.commonMistakesAndTraps ?? []) {
        const chess = new Chess(mt.triggerFen);
        const erring = chess.turn();
        const refuting = erring === 'w' ? 'b' : 'w';
        const outcome = () =>
          chess.isGameOver() ? balance(chess, refuting) : (chess.turn() === refuting ? 1 : -1) * settled(chess, -Infinity, Infinity, 8);
        const before = balance(chess, refuting);
        chess.move(mt.attemptedSan);
        const afterMistake = outcome();
        for (const san of mt.refutationSanList) chess.move(san);
        const label = `${lesson.id}: ${mt.attemptedSan} ${mt.refutationSanList.join(' ')}`;
        const mated = chess.isCheckmate() && chess.turn() === erring;
        const after = outcome();
        if (mt.severity === 'inaccuracy') {
          expect(after - afterMistake, label).toBeGreaterThanOrEqual(0);
        } else {
          // The gain shows on the board where the line stops, and the captures left do not take it back
          const stalemateFromAhead = chess.isStalemate() && before <= -300;
          const shown = balance(chess, refuting) - before;
          expect(mated || stalemateFromAhead || (shown >= 100 && after - before >= 100), `${label} (gain ${shown}, settled ${after - before})`).toBe(true);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(30);
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
      // The sheet's own line passes through its diagram, so "Moves to reach Diagram 1" is real
      expect(worksheetSetupMoves(ws), `${ws.id} never reaches its diagram`).not.toBeNull();

      // Every exercise position is a legal FEN, and the side to move it states is the FEN's
      for (const ex of ws.exercises) {
        const fen = ex.diagramFen ?? ws.diagramFen;
        expect(new Chess(fen).fen(), `${ws.id}: ${fen}`).toBe(fen);
        if (ex.turn) expect(fenSideToMove(fen), `${ws.id}: ${ex.prompt}`).toBe(ex.turn);
      }

      // Each answer is legal in its exercise's position, and its follow-up replays from there
      for (const ak of ws.answerKey) {
        expect(ak.rationale).toBeTruthy();
        const ex = ws.exercises[ak.exerciseIndex - 1];
        expect(ex, `${ws.id}: answer ${ak.exerciseIndex} has no exercise`).toBeDefined();
        const fen = ex.diagramFen ?? ws.diagramFen;
        const solution = worksheetSan(ak.solutionSan);
        expect(() => new Chess(fen).move(solution), `${ws.id}: ${ak.solutionSan} from ${fen}`).not.toThrow();
        if (ak.fullSequence && ak.fullSequence.length > 0) {
          expect(worksheetSan(ak.fullSequence[0])).toBe(solution);
          const replay = new Chess(fen);
          for (const san of ak.fullSequence) {
            expect(() => replay.move(worksheetSan(san)), `${ws.id}: ${san} in ${ak.fullSequence.join(' ')}`).not.toThrow();
          }
        }
      }

      // A trap warning's mistake and its punishment replay from the position before the mistake
      if (ws.trapWarning) {
        const numbered = ws.trapWarning.blunderSan.match(/^(\d+)\.(\.\.)?/);
        expect(numbered, ws.trapWarning.blunderSan).not.toBeNull();
        const ply = (Number(numbered![1]) - 1) * 2 + (numbered![2] ? 1 : 0);
        const before = new Chess();
        for (const san of worksheetLine(ws).slice(0, ply)) before.move(san);
        expect(() => before.move(worksheetSan(ws.trapWarning!.blunderSan))).not.toThrow();
        for (const san of ws.trapWarning.refutationSan.split(/\s+/)) {
          expect(() => before.move(worksheetSan(san)), `${ws.id}: ${san}`).not.toThrow();
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
