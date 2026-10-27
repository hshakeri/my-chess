import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { lessonFromDeviation, lessonFromRepertoireLine, answerFreeTitle } from '../../../src/curriculum/factories';
import { DiagnosticAnalyzer, CANONICAL_HOOT65_GAMES, detectRepertoireDivergence } from '../../../src/analytics/diagnostics';
import { buildRepertoireTree, getAllRecommendedRepertoires, getRecommendedBlackRepertoire } from '../../../src/analytics/repertoire';
import { StoredGame } from '../../../src/types/db';
import { OpeningDeviation } from '../../../src/types/diagnostics';

const byId = (id: string): StoredGame => {
  const g = CANONICAL_HOOT65_GAMES.find((x) => x.id === id);
  if (!g) throw new Error(`fixture ${id} missing`);
  return g;
};

const synthetic = (movesSan: string[], color: 'white' | 'black'): StoredGame => ({
  id: `synthetic-${movesSan.join('-')}`,
  source: 'upload',
  pgn: '[Date "2026.03.01"]\n',
  white: { name: color === 'white' ? 'hoot65' : 'rival' },
  black: { name: color === 'black' ? 'hoot65' : 'rival' },
  result: '0-1',
  timestamp: 0,
  movesSan,
  userColor: color,
  userResult: color === 'black' ? 'win' : 'loss',
});

/** A move token such as "2.exd5" or "3...Bf5" anywhere in the text. */
const printsAMove = (text: string) => /\d+\.{1,3}\s*[KQRBN]?[a-h]?x?[a-h][1-8]|O-O/.test(text);

/** The student's moves of a line as printed tokens ("2.exd5", "3...Bf5"). */
const studentMoveTokens = (sans: string[], student: 'w' | 'b'): string[] => {
  const tokens: string[] = [];
  sans.forEach((san, i) => {
    const white = i % 2 === 0;
    if ((student === 'w') === white) tokens.push(`${Math.floor(i / 2) + 1}${white ? '.' : '...'}${san}`);
  });
  return tokens;
};

describe('lessonFromDeviation', () => {
  const scandi = byId('185031553576');
  const dev = DiagnosticAnalyzer.detectWhiteScandinavianLeak(scandi, scandi.movesSan)!;

  it('builds a verified one-decision drill at the deviation position with the book move as the only user move', () => {
    const lesson = lessonFromDeviation(dev);

    expect(lesson.category).toBe('weakness_drill');
    expect(lesson.relevance).toBe('core');
    expect(lesson.targetColor).toBe('white');
    expect(lesson.initialFen).toBe(dev.fen);
    expect(lesson.startPly).toBe(0);
    expect(lesson.moves).toHaveLength(1);
    expect(lesson.exercises).toEqual([]);

    const decision = lesson.moves[0];
    expect(decision.san).toBe('exd5');
    expect(decision.isUserMove).toBe(true);
    expect(decision.hintPiece).toBe('Pawn on e4');
    expect(decision.hintSquare).toBe('d5');
    expect(decision.wrongMoveFeedback?.e5).toContain('meny_26');
    expect(decision.wrongMoveFeedback?.e5).toContain('2026-10-08');

    // Verified through the builder: the move is legal from the drill FEN and fenAfter matches chess.js
    const chess = new Chess(lesson.initialFen);
    chess.move(decision.san);
    expect(chess.fen()).toBe(decision.fenAfter);

    // The title never prints the answer; the description cites the game
    expect(lesson.title).not.toContain('exd5');
    expect(printsAMove(lesson.title)).toBe(false);
    expect(lesson.title).toContain('as White');
    expect(lesson.description).toContain('185031553576');
    expect(lesson.description).toContain('meny_26');
    expect(lesson.description).toContain('2026-10-08');
    expect(lesson.publicationYear).toBe(2026);
    expect(lesson.id).toBe('drill-deviation-185031553576-3');
  });

  it('turns a repertoire divergence into a drill whose wrong-move feedback names the line that was left', () => {
    const black = getRecommendedBlackRepertoire();
    const tree = buildRepertoireTree(black);
    const lineNames = Object.fromEntries(black.lines.map((l) => [l.id, l.name]));
    const game = synthetic(['d4', 'Nf6', 'c4', 'g6'], 'black');
    const divergence = detectRepertoireDivergence(game, tree, 'black', { lineNames })!;
    expect(divergence.bookSan).toBe('d5');

    const lesson = lessonFromDeviation(divergence, { id: 'drill-wall-1' });
    expect(lesson.id).toBe('drill-wall-1');
    expect(lesson.targetColor).toBe('black');
    expect(lesson.title).toBe('Repertoire drill: move 1 as Black vs rival');
    expect(lesson.moves[0].san).toBe('d5');
    expect(lesson.moves[0].annotation).toContain('Slav Defence');
    expect(lesson.moves[0].wrongMoveFeedback?.Nf6).toMatch(/left the Slav Defence/);
    expect(lesson.description).toContain('Slav Defence');
    const afterD4 = new Chess();
    afterD4.move('d4');
    expect(lesson.initialFen).toBe(afterD4.fen());
    expect(lesson.moves[0].fenAfter).toBe(new Chess(afterD4.fen()).move('d5') && afterD4.move('d5') && afterD4.fen());
  });

  it('refuses a deviation without a verified book move', () => {
    const game = byId('171894388406');
    const sortie = DiagnosticAnalyzer.detectEarlyQueenSortie(game, game.movesSan, 'black')!;
    expect(sortie.bookSan).toBeUndefined();
    expect(() => lessonFromDeviation(sortie)).toThrow(/no verified book move/);
  });

  it('refuses a title that prints the answer, an illegal played move, a wrong side to move and an illegal book move', () => {
    expect(() => lessonFromDeviation(dev, { title: 'Play exd5 now' })).toThrow(/must not print the answer/);
    expect(() => lessonFromDeviation({ ...dev, playedSan: 'Nf6' })).toThrow(/not legal/);
    expect(() => lessonFromDeviation({ ...dev, playedColor: 'black' } as OpeningDeviation)).toThrow(/to move/);
    expect(() => lessonFromDeviation({ ...dev, bookSan: 'Nd5' })).toThrow(/Illegal move 'Nd5'/);
  });
});

describe('lessonFromRepertoireLine', () => {
  it('turns every line of both plans into a verified lesson whose decisions are the student\'s moves', () => {
    for (const plan of getAllRecommendedRepertoires()) {
      const student = plan.color === 'white' ? 'w' : 'b';
      for (const line of plan.lines) {
        const lesson = lessonFromRepertoireLine(line, plan.color);
        expect(lesson.category).toBe('opening');
        expect(lesson.relevance).toBe('core');
        expect(lesson.targetColor).toBe(plan.color);
        expect(lesson.eco).toBe(line.eco);
        expect(lesson.description).toBe(line.description);
        expect(lesson.moves).toHaveLength(line.moves.length);
        // The title may name the opponent's move ("vs 2.c4") but never prints one of the student's own moves
        for (const token of studentMoveTokens(line.movesSan, student)) expect(lesson.title).not.toContain(token);
        expect(lesson.id).toBe(`lesson-line-${line.id}`);

        const chess = new Chess();
        for (let i = 0; i < line.moves.length; i++) {
          const move = lesson.moves[i];
          expect(move.isUserMove).toBe(chess.turn() === student);
          chess.move(move.san);
          expect(move.fenAfter).toBe(line.moves[i].fen);
          expect(move.annotation).toBe(line.moves[i].commentary);
          expect(move.hintTheme).toBe(line.moves[i].tacticalMotif);
          expect(move.hintPiece).toBeTruthy();
        }
      }
    }
  });

  it('honours startPly and lets the builder reject one out of range', () => {
    const slav = getRecommendedBlackRepertoire().lines.find((l) => l.id === 'black-slav-wall')!;
    expect(lessonFromRepertoireLine(slav, 'black', { startPly: 3 }).startPly).toBe(3);
    expect(() => lessonFromRepertoireLine(slav, 'black', { startPly: 99 })).toThrow(/startPly 99 is out of range/);
  });

  it('rejects a line with an illegal move', () => {
    const slav = getRecommendedBlackRepertoire().lines.find((l) => l.id === 'black-slav-wall')!;
    const bad = { ...slav, moves: [{ ply: 1, san: 'd4', fen: '' }, { ply: 2, san: 'd4', fen: '' }] };
    expect(() => lessonFromRepertoireLine(bad, 'black')).toThrow(/Illegal move 'd4' at ply 2/);
  });

  it('strips move-printing parentheticals from line names so a title cannot leak the answer', () => {
    expect(answerFreeTitle('Anti-Scandinavian Refutation (2.exd5!)')).toBe('Anti-Scandinavian Refutation');
    expect(answerFreeTitle('Caro-Kann Advance (Disciplined 3...Bf5!)')).toBe('Caro-Kann Advance');
    expect(answerFreeTitle('Italian Game: Evans Gambit (4.b4)')).toBe('Italian Game: Evans Gambit');
    expect(answerFreeTitle('Italian Game (Giuoco Piano Classical Center)')).toBe('Italian Game (Giuoco Piano Classical Center)');
  });
});
