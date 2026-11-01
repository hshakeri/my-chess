import { describe, it, expect } from 'vitest';
import { Chess, Square } from 'chess.js';
import { allCurriculumLessons, curriculumCourses, getCurriculumLessonById, positionKey, findMoveAtPath } from '../../../src/curriculum';
import { REPERTOIRE_LINE_TO_LESSON } from '../../../src/curriculum/repertoireLessons';
import { getAllRecommendedRepertoires } from '../../../src/analytics/repertoire';
import seedGamesRaw from '../../../src/data/seed_hoot65_games.json';
import { CurriculumLesson, CurriculumMove } from '../../../src/types/curriculum';
import { TacticalEvaluator } from '../../../src/engine/human/tacticalEvaluator';

/**
 * The opening study order (docs/handoff-prompt.md): the branch weights in the new lessons are the
 * counts in hoot65's archive, and every chess fact the new exercises state is replayed here.
 */

type ArchiveGame = { white: { name: string }; black: { name: string }; movesSan: string[]; url?: string };
const archive = seedGamesRaw as unknown as ArchiveGame[];

/** Replies after `prefix` in the archive games where hoot65 had `color`. */
function repliesAfter(color: 'white' | 'black', prefix: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const g of archive) {
    const side = color === 'white' ? g.white : g.black;
    if (side.name.toLowerCase() !== 'hoot65') continue;
    if (g.movesSan.length <= prefix.length) continue;
    if (prefix.some((san, i) => g.movesSan[i] !== san)) continue;
    const reply = g.movesSan[prefix.length];
    counts[reply] = (counts[reply] || 0) + 1;
  }
  return counts;
}

const lesson = (id: string): CurriculumLesson => {
  const found = getCurriculumLessonById(id);
  if (!found) throw new Error(`missing lesson ${id}`);
  return found;
};

/** The opponent move reached by `path` (main line or branch) with its alternatives. */
const moveAt = (l: CurriculumLesson, path: string[]): CurriculumMove => {
  const prefix = path.slice(0, -1);
  const last = path[path.length - 1];
  // Walk to the sequence that holds the last move
  let sequence = l.moves;
  let index = 0;
  for (const san of prefix) {
    const m = sequence[index];
    if (m.san === san) {
      index += 1;
      continue;
    }
    // A branch continuation starts with the student's reply, the next move on the path
    sequence = m.alternatives![san];
    index = 0;
  }
  const m = sequence[index];
  expect(m?.san, path.join(' ')).toBe(last);
  return m;
};

const play = (line: string, fen?: string) => {
  const c = new Chess(fen);
  for (const san of line.split(/\s+/).filter(Boolean)) c.move(san);
  return c;
};

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const materialFor = (c: Chess, color: 'w' | 'b') => {
  let total = 0;
  for (const row of c.board()) for (const p of row) if (p) total += (p.color === color ? 1 : -1) * VALUE[p.type];
  return total;
};

/**
 * Material for the mover after `san`, the opponent's best reply and the mover's best capture
 * (a small fixed-depth check; mate scores 100).
 */
function swingAfter(fen: string, san: string): number {
  const c = new Chess(fen);
  const me = c.turn();
  c.move(san);
  if (c.isCheckmate()) return 100;
  let worst = Infinity;
  for (const reply of c.moves()) {
    c.move(reply);
    let best = materialFor(c, me);
    for (const cap of c.moves({ verbose: true }).filter((m) => m.captured)) {
      c.move(cap.san);
      best = Math.max(best, c.isCheckmate() ? 100 : materialFor(c, me));
      c.undo();
    }
    c.undo();
    worst = Math.min(worst, best);
  }
  return worst === Infinity ? materialFor(c, me) : worst;
}

describe('Opening study order: archive weights', () => {
  it('weights the Alapin branches by Black\'s second move in the archived Sicilians', () => {
    const counts: Record<string, number> = {};
    for (const g of archive) {
      if (g.white.name.toLowerCase() !== 'hoot65' || g.movesSan[0] !== 'e4' || g.movesSan[1] !== 'c5') continue;
      if (g.movesSan.length < 4) continue; // one game ended before Black's second move
      counts[g.movesSan[3]] = (counts[g.movesSan[3]] || 0) + 1;
    }
    expect(counts).toEqual({ d6: 5, Nc6: 5, e6: 2, a6: 2 });
    expect(repliesAfter('white', ['e4', 'c5'])).toMatchObject({ Nf3: 12, Bc4: 2 });
    const l = lesson('lesson-alapin-sicilian-centre');
    const d6 = moveAt(l, ['e4', 'c5', 'c3', 'd6']);
    expect(d6.frequency).toBe(counts.d6);
    expect(d6.alternatives!.Nc6[0].frequency).toBe(counts.Nc6);
    expect(d6.alternatives!.e6[0].frequency).toBe(counts.e6);
    expect(d6.alternatives!.d5[0].frequency).toBeUndefined();
    expect(d6.alternatives!.Nf6[0].frequency).toBeUndefined();
  });

  it('builds the Blackburne-Shilling drill on the five archived 3...Nd4 games', () => {
    const nd4 = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4'];
    expect(repliesAfter('white', nd4)).toEqual({ Nxd4: 3, Nxe5: 2 });
    expect(repliesAfter('white', [...nd4, 'Nxd4', 'exd4'])).toEqual({ Qf3: 3 });
    const l = lesson('lesson-blackburne-shilling-drill');
    expect(l.startPly).toBe(6);
    const c3 = l.moves[8];
    expect(c3.san).toBe('c3');
    expect(c3.isUserMove).toBe(true);
    expect(Object.keys(c3.wrongMoveFeedback!)).toContain('Qf3');
    for (const id of ['169351731946', '184018513142', '169462171410', '173560422718', '185142463810']) {
      expect(l.description).toContain(id);
      expect(archive.some((g) => g.url?.endsWith(`/${id}`))).toBe(true);
    }
  });

  it('weights the wall lessons by White\'s moves in the 1.d4 games', () => {
    expect(repliesAfter('black', ['d4', 'Nf6'])).toEqual({ Bf4: 11, c4: 7, Nc3: 6, Bg5: 3, e3: 1, Nf3: 1 });
    expect(repliesAfter('black', ['d4', 'Nf6', 'c4', 'c6'])).toEqual({ Nc3: 4, Nf3: 1 });
    expect(repliesAfter('black', ['d4', 'Nf6', 'Bf4', 'c6'])).toEqual({ e3: 2, Nf3: 1 });
    expect(repliesAfter('black', ['d4', 'Nf6', 'Nc3', 'c6'])).toEqual({ e4: 4, Bf4: 2 });

    const slav = lesson('lesson-black-slav-wall');
    expect(moveAt(slav, ['d4', 'd5', 'c4']).frequency).toBe(7);
    expect(moveAt(slav, ['d4', 'd5', 'c4']).alternatives!.Nf3[0].frequency).toBe(1);
    expect(moveAt(slav, ['d4', 'd5', 'c4', 'c6', 'Nc3']).frequency).toBe(4);
    expect(moveAt(slav, ['d4', 'd5', 'c4', 'c6', 'Nc3']).alternatives!.Nf3[0].frequency).toBe(1);

    const london = lesson('lesson-black-wall-vs-london');
    expect(moveAt(london, ['d4', 'd5', 'Bf4']).frequency).toBe(11);
    expect(moveAt(london, ['d4', 'd5', 'Bf4', 'c6', 'e3']).frequency).toBe(2);
    expect(moveAt(london, ['d4', 'd5', 'Bf4', 'c6', 'e3']).alternatives!.Nf3[0].frequency).toBe(1);

    const nc3 = lesson('lesson-black-wall-vs-nc3-bg5');
    expect(moveAt(nc3, ['d4', 'd5', 'Nc3']).frequency).toBe(6);
    expect(moveAt(nc3, ['d4', 'd5', 'Nc3']).alternatives!.Bg5[0].frequency).toBe(3);
    expect(moveAt(nc3, ['d4', 'd5', 'Nc3', 'c6', 'e4']).frequency).toBe(4);
    expect(moveAt(nc3, ['d4', 'd5', 'Nc3', 'c6', 'e4']).alternatives!.Bf4[0].frequency).toBe(2);
  });

  it('weights the Caro-Kann lessons by the archived Caro-Kann games', () => {
    expect(repliesAfter('black', ['e4', 'c6'])).toMatchObject({ d4: 25, Nf3: 20, Bc4: 8, Nc3: 4 });
    expect(repliesAfter('black', ['e4', 'c6', 'Nf3', 'd5'])).toMatchObject({ exd5: 8, e5: 8, d3: 2 });
    expect(repliesAfter('black', ['e4', 'c6', 'Nf3', 'd5', 'e5'])).toEqual({ Bg4: 7, Bf5: 1 });
    expect(repliesAfter('black', ['e4', 'c6', 'Nf3', 'd5', 'e5', 'Bg4'])).toEqual({ d4: 4, h3: 2, Be2: 1 });
    expect(repliesAfter('black', ['e4', 'c6', 'Nf3', 'd5', 'exd5', 'cxd5'])).toEqual({ d4: 3, 'Bb5+': 2, c3: 1, d3: 1, Nc3: 1 });
    expect(repliesAfter('black', ['e4', 'c6', 'Nc3', 'd5'])).toEqual({ exd5: 3, Nf3: 1 });
    expect(repliesAfter('black', ['e4', 'c6', 'd4', 'd5'])).toMatchObject({ e5: 14 });
    expect(repliesAfter('black', ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5'])).toEqual({ Nf3: 6, Bd3: 3, c4: 1, Nc3: 1, Bf4: 1, g3: 1, f4: 1 });
    expect(repliesAfter('black', ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6'])).toEqual({ Bd3: 2, c3: 2, c4: 1, b3: 1 });

    const bg4 = lesson('lesson-black-caro-bg4-timing');
    const nf3 = moveAt(bg4, ['e4', 'c6', 'Nf3']);
    expect(nf3.frequency).toBe(20);
    expect(nf3.alternatives!.Nc3[0].frequency).toBe(4);
    const exd5 = moveAt(bg4, ['e4', 'c6', 'Nf3', 'd5', 'exd5']);
    expect(exd5.frequency).toBe(8);
    expect(exd5.alternatives!.e5[0].frequency).toBe(8);
    expect(moveAt(bg4, ['e4', 'c6', 'Nf3', 'd5', 'exd5', 'cxd5', 'd4']).frequency).toBe(3);

    const advance = lesson('lesson-black-caro-kann-advance');
    expect(moveAt(advance, ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3']).frequency).toBe(6);
    expect(moveAt(advance, ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3']).alternatives!.Bd3[0].frequency).toBe(3);
    expect(moveAt(advance, ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6', 'c3']).frequency).toBe(2);
  });

  it('weights the 1.c4 and 1.Nf3 lesson by White\'s moves in those six games', () => {
    expect(repliesAfter('black', [])).toEqual({ e4: 108, d4: 30, c4: 4, Nf3: 2, b4: 2, e3: 1, d3: 1, Nc3: 1, b3: 1, g4: 1 });
    // White's second move whatever Black answered (1...Nf6 in four of the six games)
    const secondMove = (first: string) => {
      const counts: Record<string, number> = {};
      for (const reply of Object.keys(repliesAfter('black', [first]))) {
        for (const [san, n] of Object.entries(repliesAfter('black', [first, reply]))) counts[san] = (counts[san] || 0) + n;
      }
      return counts;
    };
    expect(repliesAfter('black', ['c4'])).toEqual({ Nf6: 3, d6: 1 });
    expect(secondMove('c4')).toEqual({ Nc3: 2, b3: 2 });
    expect(secondMove('Nf3')).toEqual({ d4: 2 });
    expect(repliesAfter('black', ['c4', 'Nf6', 'Nc3', 'c6'])).toEqual({ d4: 2 });
    // The description's 3...Qa5, one move short of the Slav
    expect(repliesAfter('black', ['c4', 'Nf6', 'Nc3', 'c6', 'd4'])).toEqual({ Qa5: 2 });

    const flank = lesson('lesson-black-wall-vs-flank');
    const c4 = moveAt(flank, ['c4']);
    expect(c4.frequency).toBe(4);
    expect(c4.alternatives!.Nf3[0].frequency).toBe(2);
    expect(moveAt(flank, ['Nf3', 'c6', 'd4']).frequency).toBe(2);
    const b3 = moveAt(flank, ['c4', 'c6', 'b3']);
    expect(b3.frequency).toBe(2);
    expect(b3.alternatives!.Nc3[0].frequency).toBe(2);
    expect(moveAt(flank, ['c4', 'c6', 'Nc3', 'd5', 'd4']).frequency).toBe(2);
  });
});

describe('Opening study order: the facts the lessons state', () => {
  it('10.Ba3 in the 5...Ba5 Evans takes kingside castling away from Black', () => {
    const c = play('e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O Nge7 cxd4 d5 exd5 Nxd5 Ba3');
    expect(c.moves()).not.toContain('O-O');
    expect(c.fen().split(' ')[2]).toContain('k'); // the right is still there; the bishop covers f8
  });

  it('5.Qf3 after 4.Nxd4 exd4 threatens mate on f7, and 5.c3 hits a d4 pawn nothing defends', () => {
    expect(play('e4 e5 Nf3 Nc6 Bc4 Nd4 Nxd4 exd4 Qf3 a6 Qxf7').isCheckmate()).toBe(true);
    const c3 = play('e4 e5 Nf3 Nc6 Bc4 Nd4 Nxd4 exd4 c3');
    expect(c3.attackers('d4' as Square, 'w')).toEqual(['c3']);
    expect(c3.attackers('d4' as Square, 'b')).toEqual([]);
  });

  it('the d4 pawn is what closes the fourth rank in the ...Bg4 lesson', () => {
    const open = play('e4 c6 Nf3 d5 exd5 cxd5 c3 Bg4 Qa4+');
    expect(open.isCheck()).toBe(true);
    expect(open.attackers('g4' as Square, 'w')).toEqual(['a4']);
    for (const block of ['Bd7', 'Qd7']) {
      const kept = play(`e4 c6 Nf3 d5 exd5 cxd5 c3 Bg4 Qa4+ ${block}`);
      const g4 = kept.get('g4' as Square);
      // Either the bishop went back to d7 or the queen on d7 now guards g4
      expect(!g4 || kept.attackers('g4' as Square, 'b').includes('d7' as Square)).toBe(true);
    }
    const closed = play('e4 c6 Nf3 d5 exd5 cxd5 d4 Bg4');
    expect(closed.get('d4' as Square)?.type).toBe('p');
  });

  it('b2 has no defender once the c1 bishop has left in the London and the 2.Bg5 lines', () => {
    expect(play('d4 d5 Bf4').attackers('b2' as Square, 'w')).toEqual([]);
    expect(play('d4 d5 Bg5 c6 e3').attackers('b2' as Square, 'w')).toEqual([]);
    expect(play('d4 d5 Bf4 c6 e3 Bf5 Nf3 e6 Bd3 Bxd3 Qxd3 Qb6').attackers('b2' as Square, 'w')).toEqual([]);
  });

  it('in the Advance ...Qb6 stands behind the c5 pawn rather than attacking d4 itself', () => {
    const c = play('e4 c6 d4 d5 e5 Bf5 Nf3 e6 c3 c5 Be2 Nc6 O-O Qb6');
    expect(c.attackers('d4' as Square, 'b').sort()).toEqual(['c5', 'c6']);
    expect(c.attackers('d4' as Square, 'w').sort()).toEqual(['c3', 'd1', 'f3']);
  });

  it('the pinned-queen exercises pin what they say they pin', () => {
    const london = play('d4 d5 Bf4 c6 e3 Bf5 Nf3 e6 Bd3 Bxd3 Qxd3 Qb6 Qc3 Bb4');
    const queenMoves = london.moves({ verbose: true }).filter((m) => m.piece === 'q').map((m) => m.san).sort();
    expect(queenMoves).toEqual(['Qd2', 'Qxb4']);
    const scandi = play('e4 d5 exd5 Qxd5 Nc3 Qe6+ Be2 Qc6 Bb5');
    const blackQueen = scandi.moves({ verbose: true }).filter((m) => m.piece === 'q').map((m) => m.san).sort();
    expect(blackQueen).toEqual(['Qd7', 'Qxb5']);
  });

  it('the wall lessons count the defenders of d5 correctly', () => {
    const slav = play('d4 d5 c4 c6 Nc3 Nf6');
    expect(slav.attackers('d5' as Square, 'w').sort()).toEqual(['c3', 'c4']);
    expect(slav.attackers('d5' as Square, 'b').sort()).toEqual(['c6', 'd8', 'f6']);
    expect(play('d4 d5 c4 c6 Nf3 Nf6').attackers('d5' as Square, 'b').sort()).toEqual(['c6', 'd8', 'f6']);
    const english = play('c4 c6 b3 d5 Bb2 Nf6');
    expect(english.attackers('d5' as Square, 'w')).toEqual(['c4']);
    expect(english.attackers('d5' as Square, 'b').sort()).toEqual(['c6', 'd8', 'f6']);
    // In the Exchange Slav ...Nc6 covers d4 and e5, not d5
    for (const line of ['d4 d5 c4 c6 cxd5 cxd5 Nf3 Nf6 Nc3 Nc6', 'c4 c6 Nc3 d5 cxd5 cxd5 d4 Nf6 Nf3 Nc6']) {
      const c = play(line);
      expect(c.attackers('d5' as Square, 'b')).not.toContain('c6');
      expect(c.attackers('d4' as Square, 'b')).toContain('c6');
      expect(c.attackers('e5' as Square, 'b')).toContain('c6');
    }
  });

  it('the 1.c4 and 1.Nf3 lesson transposes where it says and states only what the board shows', () => {
    const same = (a: string, b: string) => expect(positionKey(play(a).fen()), `${a} = ${b}`).toBe(positionKey(play(b).fen()));
    same('c4 c6 Nc3 d5 d4 Nf6', 'd4 d5 c4 c6 Nc3 Nf6');
    same('c4 Nf6 Nc3 c6 d4 d5', 'd4 d5 c4 c6 Nc3 Nf6');
    same('c4 c6 Nc3 d5 cxd5 cxd5 d4 Nf6 Nf3 Nc6 Bf4 Bf5', 'd4 d5 c4 c6 cxd5 cxd5 Nf3 Nf6 Nc3 Nc6 Bf4 Bf5');
    same('Nf3 c6 d4 d5', 'd4 d5 Nf3 c6');
    same('Nf3 c6 e4 d5', 'e4 c6 Nf3 d5');

    // From f5 the bishop watches c2, d3 and e4; ...Bd6 aims at h2
    const bf5 = play('c4 c6 b3 d5 Bb2 Nf6 Nf3 Bf5');
    for (const sq of ['c2', 'd3', 'e4']) expect(bf5.attackers(sq as Square, 'b')).toContain('f5');
    expect(play('c4 c6 b3 d5 Bb2 Nf6 Nf3 Bf5 e3 e6 Be2 Nbd7 O-O Bd6').attackers('h2' as Square, 'b')).toEqual(['d6']);
    // d6 is free here; in the London the f4 bishop covers it when Black plays ...Be7
    expect(play('c4 c6 b3 d5 Bb2 Nf6 Nf3 Bf5 e3 e6 Be2 Nbd7 O-O').attackers('d6' as Square, 'w')).toEqual([]);
    expect(play('d4 d5 Bf4 c6 e3 Bf5 Nf3 e6 Bd3 Bxd3 Qxd3 Qb6 b3 Nf6 O-O Nbd7 c4').attackers('d6' as Square, 'w')).toEqual(['f4']);

    // 6.Bd3 is loose: the c-pawn is on c4 and the d2 pawn blocks the queen. In the London c2 and d1 guard d3
    const loose = play('c4 c6 b3 d5 Bb2 Nf6 Nf3 Bf5 e3 e6 Bd3');
    expect(loose.attackers('d3' as Square, 'w')).toEqual([]);
    expect(loose.get('d2' as Square)?.type).toBe('p');
    expect(play('d4 d5 Bf4 c6 e3 Bf5 Nf3 e6 Bd3').attackers('d3' as Square, 'w').sort()).toEqual(['c2', 'd1']);

    // The wrong-move feedback: 1...d5 2.cxd5 Qxd5 3.Nc3 and 3...Qxd5 in the 2.Nc3 branch both put the queen on a knight's square
    expect(play('c4 d5 cxd5 Qxd5 Nc3').attackers('d5' as Square, 'w')).toEqual(['c3']);
    expect(play('c4 c6 Nc3 d5 cxd5 Qxd5').attackers('d5' as Square, 'w')).toEqual(['c3']);
    // 1...Nf6 2.b3 d5 3.cxd5 Nxd5 against herbimbim left no black pawn on d4, d5, e4 or e5
    expect(archive.some((g) => g.url?.endsWith('/185135374698') && g.movesSan.slice(0, 6).join(' ') === 'c4 Nf6 b3 d5 cxd5 Nxd5')).toBe(true);
    const herbimbim = play('c4 Nf6 b3 d5 cxd5 Nxd5');
    for (const sq of ['d4', 'd5', 'e4', 'e5']) {
      const p = herbimbim.get(sq as Square);
      expect(p?.type === 'p' && p.color === 'b').toBe(false);
    }
  });

  it('every new exercise has one clearly best answer that wins material or mates', () => {
    const ids = [
      'ex-italian-h6-bishop',
      'ex-two-knights-e4-guard',
      'ex-scandi-qd8-pin-too-early',
      'ex-scandi-qe6-pinned-queen',
      'ex-blackburne-mate-pattern',
      'ex-alapin-e4-guard',
      'ex-alapin-knight-to-g4',
      'ex-slav-bishop-diagonal',
      'ex-london-queen-pin',
      'ex-caro-smothered-d6',
      'ex-advance-queen-on-b-file',
      'ex-caro-qa4-check',
      'ex-classical-open-diagonal',
      'ex-flank-wall-loose-bishop',
    ];
    const exercises = allCurriculumLessons.flatMap((l) => l.exercises);
    for (const id of ids) {
      const ex = exercises.find((e) => e.id === id);
      expect(ex, id).toBeDefined();
      const before = materialFor(new Chess(ex!.fen), new Chess(ex!.fen).turn());
      const answer = swingAfter(ex!.fen, ex!.solutionSan[0]);
      expect(answer - before, `${id}: ${ex!.solutionSan[0]} gains`).toBeGreaterThanOrEqual(2);
      // Uniqueness with the repository's own evaluator (depth 2 with quiescence): the answer beats
      // every other legal move by at least 1.5 pawns
      const probe = new Chess(ex!.fen);
      const sign = probe.turn() === 'w' ? 1 : -1;
      const scored = probe.moves().map((san) => {
        probe.move(san);
        const v = probe.isCheckmate() ? 100000 : sign * TacticalEvaluator.search(probe, 1);
        probe.undo();
        return { san, v };
      });
      const solution = scored.find((m) => m.san === ex!.solutionSan[0])!;
      for (const other of scored) {
        if (other.san === solution.san || (ex!.solutionSan[0].endsWith('#') && other.v === 100000)) continue;
        expect(solution.v - other.v, `${id}: ${solution.san} vs ${other.san}`).toBeGreaterThanOrEqual(150);
      }
    }
  }, 120000);
});

describe('Opening study order: lessons, courses and the repertoire plan agree', () => {
  it('groups the Black lessons in their own course, each starting with the opponent\'s first move', () => {
    const course = curriculumCourses.find((c) => c.id === 'course-black-repertoire')!;
    expect(course.category).toBe('black_repertoire');
    expect(course.lessons.map((l) => l.id).sort()).toEqual([
      'lesson-black-caro-bg4-timing',
      'lesson-black-caro-kann-advance',
      'lesson-black-caro-kann-classical',
      'lesson-black-slav-wall',
      'lesson-black-wall-vs-flank',
      'lesson-black-wall-vs-london',
      'lesson-black-wall-vs-nc3-bg5',
    ]);
    for (const l of course.lessons) {
      expect(l.targetColor).toBe('black');
      expect(l.relevance).toBe('core');
      expect(l.moves[0].isUserMove).toBe(false);
    }
    const white = curriculumCourses.find((c) => c.id === 'course-white-repertoire')!;
    expect(white.lessons.map((l) => l.id)).toContain('lesson-alapin-sicilian-centre');
  });

  it('maps every repertoire line with a lesson to a lesson whose tree reaches the line\'s position', () => {
    const lines = getAllRecommendedRepertoires().flatMap((p) => p.lines);
    for (const [lineId, lessonId] of Object.entries(REPERTOIRE_LINE_TO_LESSON)) {
      const line = lines.find((l) => l.id === lineId);
      expect(line, lineId).toBeDefined();
      const l = lesson(lessonId);
      // Every position in the lesson tree, so transpositions count
      const keys = new Set<string>();
      const walk = (moves: CurriculumMove[], fen: string) => {
        const c = new Chess(fen);
        for (const m of moves) {
          if (m.alternatives) {
            for (const [alt, cont] of Object.entries(m.alternatives)) {
              const b = new Chess(c.fen());
              b.move(alt);
              keys.add(positionKey(b.fen()));
              walk(cont, b.fen());
            }
          }
          c.move(m.san);
          keys.add(positionKey(c.fen()));
        }
      };
      walk(l.moves, l.initialFen);
      const depth = Math.min(line!.movesSan.length, 10);
      const reached = play(line!.movesSan.slice(0, depth).join(' '));
      expect(keys.has(positionKey(reached.fen())), `${lineId} -> ${lessonId}`).toBe(true);
    }
  });

  it('keeps the Advance plan line equal to the lesson\'s main line', () => {
    const plan = getAllRecommendedRepertoires().flatMap((p) => p.lines).find((l) => l.id === 'black-caro-kann-advance')!;
    const l = lesson('lesson-black-caro-kann-advance');
    expect(plan.movesSan).toEqual(l.moves.map((m) => m.san));
    expect(findMoveAtPath(l, plan.movesSan)?.san).toBe('Qb6');
  });
});
