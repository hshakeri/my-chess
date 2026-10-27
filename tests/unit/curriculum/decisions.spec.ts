import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  buildVerifiedLesson,
  enumerateDecisions,
  chooseOpponentReply,
  replyOptions,
  firstUserDecision,
  positionKey,
  plyLabel,
  LessonConfig,
} from '../../../src/curriculum/builder';
import { allCurriculumLessons } from '../../../src/curriculum';
import { evansGambitDestruction } from '../../../src/curriculum/openings';
import { scandinavianRefutationDrill, caroKannDisciplineDrill } from '../../../src/curriculum/drills';

/** Small deterministic LCG so sampling tests are reproducible. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return (s % 2147483648) / 2147483648;
  };
}

const base = (over: Partial<LessonConfig>): LessonConfig => ({
  id: 'lesson-test-tree',
  title: 'Test',
  category: 'opening',
  sourceBook: 'Test Book',
  author: 'Tester',
  targetColor: 'white',
  moves: [{ san: 'e4' }, { san: 'e5' }, { san: 'Nf3' }],
  exercises: [],
  ...over,
});

describe('enumerateDecisions', () => {
  it('lists every student decision of every lesson with a replayable path and a legal accepted move', () => {
    for (const lesson of allCurriculumLessons) {
      const decisions = enumerateDecisions(lesson);
      expect(decisions.length, lesson.id).toBeGreaterThan(0);
      for (const d of decisions) {
        const chess = new Chess(lesson.initialFen);
        for (const san of d.path) chess.move(san);
        expect(positionKey(chess.fen()), `${lesson.id} path ${d.path.join(' ')}`).toBe(positionKey(d.fen));
        expect(chess.turn()).toBe(d.color);
        expect(d.acceptedSan.length).toBeGreaterThan(0);
        for (const san of d.acceptedSan) {
          expect(new Chess(d.fen).moves(), `${lesson.id}: ${san} at ${d.fen}`).toContain(san);
        }
        expect(d.lessonId).toBe(lesson.id);
        expect(d.tags).toContain(`lesson:${lesson.id}`);
        expect(d.tags).toContain(`family:${lesson.category}`);
        expect(d.tags).toContain(`color:${d.color}`);
        expect(d.tags.some((t) => t.startsWith('opening:'))).toBe(true);
        expect(d.reachProb).toBeGreaterThan(0);
        expect(d.reachProb).toBeLessThanOrEqual(1);
        // The title never prints the answer (the student's move, with its move number)
        for (const san of d.acceptedSan) {
          expect(d.title || '').not.toContain(plyLabel(lesson.initialFen, d.path.length, san));
        }
      }
    }
  });

  it('counts main-line and branch decisions of the Evans lesson and derives the opening tag from the id', () => {
    const decisions = enumerateDecisions(evansGambitDestruction);
    const main = decisions.filter((d) => d.reachProb === 1);
    const branch = decisions.filter((d) => d.reachProb !== 1);
    expect(main.length).toBe(9);
    expect(branch.length).toBe(17);
    expect(decisions.every((d) => d.tags.includes('opening:evans-gambit-destruction'))).toBe(true);
    expect(decisions.every((d) => d.tags.includes('family:opening'))).toBe(true);
    expect(decisions.every((d) => d.color === 'w')).toBe(true);
  });

  it('gives branch decisions the sibling share as reachProb and multiplies it along nested branches', () => {
    const decisions = enumerateDecisions(evansGambitDestruction);
    const after = (path: string) => decisions.find((d) => d.path.join(' ') === path)!;
    const italian = 'e4 e5 Nf3 Nc6 Bc4';

    // After 3.Bc4 the archive replies are Bc5 11, Nf6 12, Nd4 5, h6 16 (44 in total)
    const nf6 = after(`${italian} Nf6`);
    const nd4 = after(`${italian} Nd4`);
    const h6 = after(`${italian} h6`);
    expect(nf6.reachProb).toBeCloseTo(12 / 44, 6);
    expect(nd4.reachProb).toBeCloseTo(5 / 44, 6);
    expect(h6.reachProb).toBeCloseTo(16 / 44, 6);
    const shares = replyOptions(evansGambitDestruction.moves[5]);
    expect(shares.map((s) => s.san)).toEqual(['Bc5', 'Nf6', 'Nd4', 'h6']);
    expect(shares.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 9);
    expect(shares[0].share).toBeCloseTo(11 / 44, 6);

    // Decisions deeper in the same branch keep the branch's reach
    expect(after(`${italian} Nf6 d3 Bc5`).reachProb).toBeCloseTo(12 / 44, 6);
    expect(after(`${italian} Nf6 d3 Bc5 c3 d6`).reachProb).toBeCloseTo(12 / 44, 6);

    // Nested branch: after 4.Nxd4 exd4 5.c3 the replies ...dxc3 (main) and ...Bc5 weigh 1 each
    expect(after(`${italian} Nd4 Nxd4 exd4 c3 dxc3`).reachProb).toBeCloseTo(5 / 44, 6);
    expect(after(`${italian} Nd4 Nxd4 exd4 c3 Bc5`).reachProb).toBeCloseTo(5 / 44 / 2, 6);
    expect(after(`${italian} Nd4 Nxd4 exd4 c3 Bc5 cxd4 Bb6`).reachProb).toBeCloseTo(5 / 44 / 2, 6);

    // 4...Bxb4 was played 7 of 7 times; the declined ...Bb6 is unobserved (weight 1)
    expect(after(`${italian} Bc5 b4 Bb6`).reachProb).toBeCloseTo(1 / 8, 6);
    // 7...dxc3 happened in 4 of 4 games; the book 7...d6 is unobserved (weight 1)
    expect(after(`${italian} Bc5 b4 Bxb4 c3 Bc5 d4 exd4 O-O dxc3`).reachProb).toBeCloseTo(4 / 5, 6);
  });

  it('indexes branch decisions by their position in the branch sequence and main-line ones by their line index', () => {
    const decisions = enumerateDecisions(evansGambitDestruction);
    const nf6Branch = decisions.filter((d) => d.path.slice(0, 6).join(' ') === 'e4 e5 Nf3 Nc6 Bc4 Nf6');
    expect(nf6Branch.map((d) => d.ply)).toEqual([0, 2, 4]);
    expect(nf6Branch.map((d) => d.acceptedSan[0])).toEqual(['d3', 'c3', 'O-O']);
    expect(nf6Branch.map((d) => d.title)).toEqual([
      'White to move after 3...Nf6',
      'White to move after 4...Bc5',
      'White to move after 5...d6',
    ]);
    const mainAfterBc5 = decisions.find((d) => d.path.join(' ') === 'e4 e5 Nf3 Nc6 Bc4 Bc5')!;
    expect(mainAfterBc5.ply).toBe(6);
    expect(mainAfterBc5.acceptedSan).toEqual(['b4']);
    expect(mainAfterBc5.title).toBe('White to move after 3...Bc5');
  });

  it('starts at startPly: the Scandinavian drill has no decision before 2.exd5 and firstUserDecision is unchanged', () => {
    const decisions = enumerateDecisions(scandinavianRefutationDrill);
    expect(decisions[0].path).toEqual(['e4', 'd5']);
    expect(decisions[0].ply).toBe(2);
    expect(decisions[0].acceptedSan).toEqual(['exd5']);
    expect(decisions.some((d) => d.path.length === 0)).toBe(false);
    expect(decisions.filter((d) => d.reachProb === 1).length).toBe(9);
    // ...Nf6 (unobserved) against ...Qxd5 (2 of 2)
    const nf6 = decisions.find((d) => d.path.join(' ') === 'e4 d5 exd5 Nf6')!;
    expect(nf6.reachProb).toBeCloseTo(1 / 3, 6);
    expect(nf6.acceptedSan).toEqual(['d4']);
    const first = firstUserDecision(scandinavianRefutationDrill);
    expect(first?.index).toBe(2);
    expect(first?.move.san).toBe('exd5');
    expect(scandinavianRefutationDrill.moves[3].san).toBe('Qxd5');
    expect(scandinavianRefutationDrill.moves[3].isUserMove).toBe(false);
  });

  it('includes the Caro-Kann branches with two or more student decisions each', () => {
    const decisions = enumerateDecisions(caroKannDisciplineDrill);
    const nf6 = decisions.filter((d) => d.path.slice(0, 6).join(' ') === 'e4 c6 d4 d5 Nc3 Nf6');
    const g6 = decisions.filter((d) => d.path.slice(0, 6).join(' ') === 'e4 c6 d4 d5 Nc3 g6');
    expect(nf6.length).toBeGreaterThanOrEqual(2);
    expect(g6.length).toBeGreaterThanOrEqual(2);
    expect(nf6.map((d) => d.acceptedSan[0])).toEqual(['e5', 'f4', 'Nf3']);
    expect(g6.map((d) => d.acceptedSan[0])).toEqual(['Nf3', 'h3', 'Bd3']);
  });

  it('ignores branches that hang off the auto-played prefix before startPly', () => {
    const lesson = buildVerifiedLesson(
      base({
        startPly: 2,
        moves: [{ san: 'e4' }, { san: 'e5', alternatives: { c5: [{ san: 'Nf3' }] } }, { san: 'Nf3' }],
      })
    );
    const decisions = enumerateDecisions(lesson);
    expect(decisions.map((d) => d.path.join(' '))).toEqual(['e4 e5']);
  });

  it('carries acceptance alternatives into acceptedSan with the scripted move first', () => {
    const lesson = buildVerifiedLesson(base({ moves: [{ san: 'e4', accept: { san: ['d4', 'e4'] } }] }));
    expect(enumerateDecisions(lesson)[0].acceptedSan).toEqual(['e4', 'd4']);
  });
});

describe('chooseOpponentReply', () => {
  it('returns the scripted reply when there are no alternatives', () => {
    const r = chooseOpponentReply(evansGambitDestruction.moves[1], () => 0.99);
    expect(r).toEqual({ san: 'e5', continuation: null });
  });

  it('is deterministic for a given rng value and walks the options in order', () => {
    const node = evansGambitDestruction.moves[5]; // 3...Bc5 with Nf6, Nd4, h6
    expect(chooseOpponentReply(node, () => 0).san).toBe('Bc5');
    expect(chooseOpponentReply(node, () => 11 / 44 - 1e-9).san).toBe('Bc5');
    expect(chooseOpponentReply(node, () => 11 / 44 + 1e-9).san).toBe('Nf6');
    expect(chooseOpponentReply(node, () => 23 / 44 + 1e-9).san).toBe('Nd4');
    expect(chooseOpponentReply(node, () => 0.999).san).toBe('h6');
    expect(chooseOpponentReply(node, () => 1).san).toBe('h6'); // clamped, never out of range
    const h6 = chooseOpponentReply(node, () => 0.999);
    expect(h6.continuation?.[0].san).toBe('d4');
    expect(h6.continuation?.[0].isUserMove).toBe(true);
  });

  it('respects the weights over many seeded draws', () => {
    const node = evansGambitDestruction.moves[5];
    const rng = seededRng(2026);
    const counts: Record<string, number> = {};
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const r = chooseOpponentReply(node, rng);
      counts[r.san] = (counts[r.san] || 0) + 1;
    }
    expect(counts.Bc5 / n).toBeCloseTo(11 / 44, 1);
    expect(counts.Nf6 / n).toBeCloseTo(12 / 44, 1);
    expect(counts.Nd4 / n).toBeCloseTo(5 / 44, 1);
    expect(counts.h6 / n).toBeCloseTo(16 / 44, 1);
    // The ordering of the shares is reproduced exactly
    expect(counts.h6).toBeGreaterThan(counts.Nf6);
    expect(counts.Nf6).toBeGreaterThan(counts.Bc5);
    expect(counts.Bc5).toBeGreaterThan(counts.Nd4);
    // Same seed, same sequence
    const again = seededRng(2026);
    const first = Array.from({ length: 10 }, () => chooseOpponentReply(node, again).san);
    const replay = seededRng(2026);
    expect(Array.from({ length: 10 }, () => chooseOpponentReply(node, replay).san)).toEqual(first);
  });

  it('falls back to the scripted reply when every weight is zero', () => {
    const lesson = buildVerifiedLesson(
      base({ moves: [{ san: 'e4' }, { san: 'e5', frequency: 0, alternatives: { c5: [{ san: 'Nf3', frequency: 0 }] } }] })
    );
    expect(chooseOpponentReply(lesson.moves[1], () => 0.5)).toEqual({ san: 'e5', continuation: null });
    expect(replyOptions(lesson.moves[1]).map((o) => o.share)).toEqual([1, 0]);
  });

  it('never picks a zero-weight scripted reply when an alternative has weight', () => {
    const lesson = buildVerifiedLesson(
      base({ moves: [{ san: 'e4' }, { san: 'e5', frequency: 0, alternatives: { c5: [{ san: 'Nf3', frequency: 3 }] } }] })
    );
    for (const u of [0, 0.25, 0.5, 0.999]) expect(chooseOpponentReply(lesson.moves[1], () => u).san).toBe('c5');
  });
});
