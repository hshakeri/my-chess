import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { buildVerifiedLesson, firstUserDecision, positionKey, LessonConfig, MoveInput } from '../../../src/curriculum/builder';
import { allCurriculumLessons } from '../../../src/curriculum';
import { CurriculumMove } from '../../../src/types/curriculum';
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
  });

  it('every shipped mistake record is reachable: it triggers from a position where the student is to move, at or after the drill point, on the main line or in a branch', () => {
    for (const lesson of allCurriculumLessons) {
      const keys = new Set<string>();
      const startPly = lesson.startPly ?? 0;
      const walk = (moves: CurriculumMove[], fromFen: string, isMain: boolean) => {
        const chess = new Chess(fromFen);
        moves.forEach((m, i) => {
          const active = !isMain || i >= startPly;
          if (active && m.isUserMove) keys.add(positionKey(chess.fen()));
          if (active && m.alternatives) {
            for (const [altSan, continuation] of Object.entries(m.alternatives)) {
              const branch = new Chess(chess.fen());
              branch.move(altSan);
              walk(continuation, branch.fen(), false);
            }
          }
          chess.move(m.san);
        });
      };
      walk(lesson.moves, lesson.initialFen, true);
      for (const mt of lesson.commonMistakesAndTraps || []) {
        expect(keys.has(positionKey(mt.triggerFen)), `${lesson.id}: ${mt.attemptedSan} trap is unreachable`).toBe(true);
      }
    }
  });

  describe('opponent alternatives (branches)', () => {
    const withBranch = (alternatives: Record<string, MoveInput[]>, extra: Partial<MoveInput> = {}): LessonConfig =>
      base({ moves: [{ san: 'e4' }, { san: 'e5', frequency: 5, alternatives, ...extra }, { san: 'Nf3' }] });

    it('verifies every continuation from the branch FEN, numbers plies on from the alternative and derives hints', () => {
      const lesson = buildVerifiedLesson(
        withBranch({
          c5: [{ san: 'Nf3', frequency: 3 }, { san: 'd6' }, { san: 'd4', annotation: 'Open Sicilian.' }],
        })
      );
      const node = lesson.moves[1];
      expect(node.frequency).toBe(5);
      expect(Object.keys(node.alternatives!)).toEqual(['c5']);
      const branch = node.alternatives!.c5;
      expect(branch.map((m) => m.ply)).toEqual([3, 4, 5]);
      expect(branch.map((m) => m.isUserMove)).toEqual([true, false, true]);
      expect(branch[0].frequency).toBe(3);
      expect(branch[0].hintPiece).toBe('Knight on g1');
      expect(branch[0].hintSquare).toBe('f3');
      expect(branch[2].uci).toBe('d2d4');
      expect(branch[2].annotation).toBe('Open Sicilian.');
      const chess = new Chess();
      for (const san of ['e4', 'c5', 'Nf3', 'd6', 'd4']) chess.move(san);
      expect(branch[2].fenAfter).toBe(chess.fen());
      // The main line is untouched by the branch probing
      expect(lesson.moves[2].san).toBe('Nf3');
      expect(lesson.moves[2].ply).toBe(3);
    });

    it('normalises alternative keys to chess.js SAN', () => {
      const lesson = buildVerifiedLesson(withBranch({ 'Nc6': [{ san: 'Bb5' }], 'e6': [{ san: 'd4' }] }));
      expect(Object.keys(lesson.moves[1].alternatives!)).toEqual(['Nc6', 'e6']);
      const disambiguated = buildVerifiedLesson(
        base({ moves: [{ san: 'e4' }, { san: 'e5' }, { san: 'Nf3' }, { san: 'Nc6', alternatives: { Ngf6: [{ san: 'Nxe5' }] } }] })
      );
      expect(Object.keys(disambiguated.moves[3].alternatives!)).toEqual(['Nf6']);
    });

    it('throws on an illegal alternative key', () => {
      expect(() => buildVerifiedLesson(withBranch({ Qh5: [{ san: 'Nf3' }] }))).toThrow(/Illegal alternative key 'Qh5'/);
      expect(() => buildVerifiedLesson(withBranch({ e4: [{ san: 'Nf3' }] }))).toThrow(/Illegal alternative key 'e4'/);
    });

    it('throws on an illegal continuation move, naming the branch', () => {
      expect(() => buildVerifiedLesson(withBranch({ c5: [{ san: 'Nf3' }, { san: 'Nc6' }, { san: 'Bc6' }] }))).toThrow(
        /Illegal move 'Bc6' at ply 5 \(branch 1\.\.\.c5\)/
      );
      expect(() => buildVerifiedLesson(withBranch({ c5: [{ san: 'Nf6' }] }))).toThrow(/Illegal move 'Nf6'/);
    });

    it('validates nested branches recursively and names the path in errors', () => {
      const ok = buildVerifiedLesson(
        withBranch({ c5: [{ san: 'Nf3' }, { san: 'd6', alternatives: { Nc6: [{ san: 'd4' }, { san: 'cxd4' }, { san: 'Nxd4' }] } }] })
      );
      const nested = ok.moves[1].alternatives!.c5[1].alternatives!.Nc6;
      expect(nested.map((m) => m.ply)).toEqual([5, 6, 7]);
      expect(() =>
        buildVerifiedLesson(
          withBranch({ c5: [{ san: 'Nf3' }, { san: 'd6', alternatives: { Nc6: [{ san: 'd4' }, { san: 'cxd4' }, { san: 'Nxe5' }] } }] })
        )
      ).toThrow(/Illegal move 'Nxe5' at ply 7 \(branch 1\.\.\.c5 > branch 2\.\.\.Nc6\)/);
    });

    it('rejects alternatives on a user move, duplicates of the scripted reply, empty continuations and continuations that do not start with the student', () => {
      expect(() => buildVerifiedLesson(base({ moves: [{ san: 'e4', alternatives: { d4: [{ san: 'd5' }] } }] }))).toThrow(
        /only allowed on opponent moves/
      );
      expect(() => buildVerifiedLesson(withBranch({ e5: [{ san: 'Nf3' }] }))).toThrow(/duplicates the scripted reply 'e5'/);
      expect(() => buildVerifiedLesson(withBranch({ c5: [] }))).toThrow(/needs a continuation/);
      expect(() => buildVerifiedLesson(withBranch({ c5: [{ san: 'Nf3', isUserMove: false }] }))).toThrow(
        /must start with the student's reply/
      );
    });

    it('applies the acceptance rules inside a branch: user moves only, final move of the branch only', () => {
      const ok = buildVerifiedLesson(withBranch({ c5: [{ san: 'Nf3' }, { san: 'd6' }, { san: 'd4', accept: { san: ['c3'] } }] }));
      expect(ok.moves[1].alternatives!.c5[2].accept?.san).toEqual(['c3']);
      expect(() =>
        buildVerifiedLesson(withBranch({ c5: [{ san: 'Nf3', accept: { san: ['Nc3'] } }, { san: 'd6' }, { san: 'd4' }] }))
      ).toThrow(/final move/);
      expect(() =>
        buildVerifiedLesson(withBranch({ c5: [{ san: 'Nf3' }, { san: 'd6', accept: { san: ['Nc6'] } }] }))
      ).toThrow(/only allowed on user moves/);
      expect(() =>
        buildVerifiedLesson(withBranch({ c5: [{ san: 'Nf3' }, { san: 'd6' }, { san: 'd4', accept: { san: ['Qh5'] } }] }))
      ).toThrow(/Illegal acceptance alternative 'Qh5'/);
    });

    it('rejects a negative or non-finite frequency', () => {
      expect(() => buildVerifiedLesson(withBranch({ c5: [{ san: 'Nf3', frequency: -1 }] }))).toThrow(/frequency/);
      expect(() => buildVerifiedLesson(withBranch({ c5: [{ san: 'Nf3' }] }, { frequency: Number.NaN }))).toThrow(/frequency/);
    });

    it('anchors plyIndex mistakes to the main line and leaves branch positions to triggerFen', () => {
      const lesson = buildVerifiedLesson(
        withBranch({ c5: [{ san: 'Nf3' }, { san: 'd6' }, { san: 'd4' }] })
      );
      const built = buildVerifiedLesson({
        ...withBranch({ c5: [{ san: 'Nf3' }, { san: 'd6' }, { san: 'd4' }] }),
        mistakesAndTraps: [
          {
            plyIndex: 2,
            attemptedSan: 'Qh5',
            isTrap: false,
            severity: 'inaccuracy',
            explanatoryFeedback: 'x',
            refutationSanList: ['Nc6'],
            punishmentSummary: 'y',
          },
        ],
      });
      // plyIndex 2 is the main-line position after 1.e4 e5 (not the branch after 1...c5)
      expect(positionKey(built.commonMistakesAndTraps![0].triggerFen)).toBe(positionKey(lesson.moves[1].fenAfter!));
    });
  });

  it('rejects a mistake record anchored to a ply the lesson does not have', () => {
    expect(() =>
      buildVerifiedLesson(
        base({
          mistakesAndTraps: [
            {
              plyIndex: 99,
              attemptedSan: 'd4',
              isTrap: false,
              severity: 'inaccuracy',
              explanatoryFeedback: 'x',
              refutationSanList: [],
              punishmentSummary: 'y',
            },
          ],
        })
      )
    ).toThrow(/plyIndex 99 is out of range/);
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
