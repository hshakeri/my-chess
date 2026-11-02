import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { allCurriculumLessons } from '../../../src/curriculum';
import type { CurriculumMove } from '../../../src/types/curriculum';

/**
 * Claims lint (DC-1): the material and mate statements in lesson annotations are checked against the
 * position after the annotated move. "White is a pawn up", "Black is two pawns up", "material is
 * level" must match the material count (pawn 1, knight and bishop 3, rook 5, queen 9), and an
 * annotation that opens with "Checkmate" or "Mate" must sit on a move that mates.
 */

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const WORD: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4 };

/** White's material minus Black's, in pawns. */
function balance(chess: Chess): number {
  return chess.board().flat().reduce((sum, p) => sum + (p ? (p.color === 'w' ? 1 : -1) * VALUE[p.type] : 0), 0);
}

interface Annotated {
  lessonId: string;
  san: string;
  text: string;
  after: Chess;
}

function collect(): Annotated[] {
  const out: Annotated[] = [];
  const walk = (lessonId: string, moves: CurriculumMove[], fromFen: string) => {
    const chess = new Chess(fromFen);
    for (const move of moves) {
      const before = chess.fen();
      for (const [alt, continuation] of Object.entries(move.alternatives ?? {})) {
        const branch = new Chess(before);
        branch.move(alt);
        walk(lessonId, continuation, branch.fen());
      }
      chess.move(move.san);
      if (move.annotation) out.push({ lessonId, san: move.san, text: move.annotation, after: new Chess(chess.fen()) });
    }
  };
  for (const l of allCurriculumLessons) walk(l.id, l.moves, l.initialFen);
  return out;
}

describe('Claims lint: the material and mate statements in lesson annotations', () => {
  const annotated = collect();

  it('finds the annotations to check', () => {
    expect(annotated.length).toBeGreaterThan(150);
  });

  it('"White is a pawn up" and the like match the material on the board', () => {
    const pattern = /\b(White|Black) is (?:still )?(a|one|two|three|four) pawns? (up|down)\b/g;
    let checked = 0;
    for (const a of annotated) {
      for (const m of a.text.matchAll(pattern)) {
        const [, side, count, dir] = m;
        const expected = WORD[count] * (dir === 'up' ? 1 : -1) * (side === 'White' ? 1 : -1);
        expect(balance(a.after), `${a.lessonId} ${a.san}: "${m[0]}"`).toBe(expected);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(10);
  });

  it('"material is level" matches the material on the board', () => {
    let checked = 0;
    for (const a of annotated) {
      if (!/\bmaterial is level\b/i.test(a.text)) continue;
      expect(balance(a.after), `${a.lessonId} ${a.san}: ${a.text}`).toBe(0);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(3);
  });

  it('an annotation that opens with "Checkmate" or "Mate" is on a move that mates', () => {
    let checked = 0;
    for (const a of annotated) {
      if (!/^(Checkmate|Mate)\b/.test(a.text)) continue;
      expect(a.after.isCheckmate(), `${a.lessonId} ${a.san}: ${a.text}`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(3);
  });
});
