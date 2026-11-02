import { describe, it, expect } from 'vitest';
import { Chess, Square } from 'chess.js';
import {
  gameDrillData,
  missedThreatLessons,
  freePieceLessons,
  hangingMoveLessons,
  allowedMateLessons,
  gameDrillLessons,
  drillSetOf,
  isGameDrill,
  GameDrill,
} from '../../../src/curriculum/gameDrills';
import { allCurriculumLessons, curriculumCourses } from '../../../src/curriculum';
import { enumerateDecisions, plyLabel } from '../../../src/curriculum/builder';
import { lessonFromDecision, mentionsMove } from '../../../src/curriculum/factories';
import { patternPath } from '../../../src/curriculum/patternPath';
import { CurriculumLesson } from '../../../src/types/curriculum';

/**
 * The drill sets from hoot65's games (src/data/game_drills.json, picked by
 * scripts/game-analysis/drills.mjs). Every fact a drill's text states is worked out again here from
 * the position with chess.js, independently of the lesson factory.
 */

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const other = (c: 'w' | 'b'): 'w' | 'b' => (c === 'w' ? 'b' : 'w');

/** The cheapest piece of `by` that attacks `sq` and can take there (a king only takes an undefended piece). */
function cheapest(chess: Chess, sq: Square, by: 'w' | 'b') {
  const owner = chess.get(sq)?.color;
  const defended = owner ? chess.attackers(sq, owner).length > 0 : false;
  return chess
    .attackers(sq, by)
    .filter((s) => !(defended && chess.get(s)?.type === 'k'))
    .map((s) => ({ square: s, type: chess.get(s)!.type }))
    .sort((a, b) => VALUE[a.type] - VALUE[b.type])[0];
}

/** The piece on `sq` can be won: nothing defends it, or a cheaper piece attacks it. */
function loose(chess: Chess, sq: Square): boolean {
  const piece = chess.get(sq);
  if (!piece) return false;
  const att = cheapest(chess, sq, other(piece.color));
  if (!att) return false;
  return chess.attackers(sq, piece.color).length === 0 || VALUE[att.type] < VALUE[piece.type];
}

function decision(d: GameDrill) {
  const chess = new Chess(d.fenBefore);
  const last = chess.move(d.lastSan);
  return { chess, last, fen: chess.fen(), me: (d.color === 'white' ? 'w' : 'b') as 'w' | 'b' };
}

function after(fen: string, san: string) {
  const chess = new Chess(fen);
  const move = chess.move(san);
  return { chess, move, fen: chess.fen() };
}

const lessonOf = (d: GameDrill): CurriculumLesson => {
  const l = gameDrillLessons.find((x) => x.id === `lesson-game-${d.id}`);
  if (!l) throw new Error(`no lesson for ${d.id}`);
  return l;
};
const answers = (l: CurriculumLesson) => [l.moves[1].san, ...(l.moves[1].accept?.san ?? [])];
const playedNote = (l: CurriculumLesson, d: GameDrill) => {
  const san = new Chess(decision(d).fen).move(d.played).san;
  return l.moves[1].wrongMoveFeedback?.[san] ?? '';
};

describe('Drill positions from hoot65 games: the data', () => {
  it('holds sixteen positions per set from the newest games, one per game, inside the stated dates', () => {
    for (const [kind, set] of [
      ['threat', gameDrillData.threat],
      ['free', gameDrillData.free],
      ['hang', gameDrillData.hang],
      ['mate', gameDrillData.mate ?? []],
    ] as const) {
      expect(set).toHaveLength(16);
      const dates = set.map((d) => d.date);
      expect([...dates].sort().reverse(), `${kind} newest first`).toEqual(dates);
      for (const d of set) {
        expect(d.date >= gameDrillData.from && d.date <= gameDrillData.to).toBe(true);
        // The id names the game and the ply of the decision; the position before it is one ply earlier
        const [idKind, gameId, ply] = d.id.split('-');
        expect(idKind).toBe(kind);
        expect(d.url).toBe(`https://www.chess.com/game/live/${gameId}`);
        const [, side, , , , fullmove] = d.fenBefore.split(' ');
        expect((Number(fullmove) - 1) * 2 + (side === 'b' ? 1 : 0)).toBe(Number(ply) - 1);
      }
      expect(new Set(set.map((d) => d.url)).size, `${kind}: one position per game`).toBe(set.length);
    }
    // A position belongs to one set only
    const keys = [gameDrillData.threat, gameDrillData.free, gameDrillData.hang, gameDrillData.mate ?? []].flatMap((set) => set.map((d) => d.id.slice(d.id.indexOf('-') + 1)));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('threat: the last move put a piece in danger, the move played left it there, every answer meets the threat', () => {
    for (const d of gameDrillData.threat) {
      const { chess, fen, me } = decision(d);
      const target = d.target as Square;
      const piece = chess.get(target);
      expect(piece?.color, d.id).toBe(me);
      expect(['n', 'b', 'r', 'q']).toContain(piece!.type);
      expect(loose(chess, target), `${d.id}: the piece can be won`).toBe(true);
      expect(loose(new Chess(d.fenBefore), target), `${d.id}: it could not before the last move`).toBe(false);

      const played = after(fen, d.played);
      expect(d.accepted.map((s) => after(fen, s).move.san)).not.toContain(played.move.san);
      if (played.move.from !== target) expect(loose(played.chess, target), `${d.id}: still loose after ${d.played}`).toBe(true);
      const punish = after(played.fen, d.refutation!);
      expect(punish.move.captured, `${d.id}: ${d.refutation} captures`).toBeTruthy();

      let safe = 0;
      for (const san of d.accepted) {
        const { chess: c, move } = after(fen, san);
        const where = move.from === target ? (move.to as Square) : target;
        const isSafe = !loose(c, where);
        if (isSafe) safe++;
        expect(isSafe || !!move.captured || c.inCheck(), `${d.id}: ${san} answers the threat`).toBe(true);
      }
      expect(safe, `${d.id}: some answer leaves the piece safe`).toBeGreaterThan(0);
    }
  });

  it('free: a piece of theirs could be won, every answer is a capture and one takes it, the move played did not', () => {
    for (const d of gameDrillData.free) {
      const { chess, fen, me } = decision(d);
      const target = d.target as Square;
      const piece = chess.get(target);
      expect(piece?.color, d.id).toBe(other(me));
      expect(['n', 'b', 'r', 'q']).toContain(piece!.type);
      expect(loose(chess, target), `${d.id}: the piece can be won`).toBe(true);
      const moves = d.accepted.map((s) => after(fen, s).move);
      expect(moves.every((m) => !!m.captured), `${d.id}: every answer captures`).toBe(true);
      expect(moves.some((m) => m.to === target), `${d.id}: an answer takes on ${target}`).toBe(true);
      expect(after(fen, d.played).move.to).not.toBe(target);
    }
  });

  it('hang: nothing was in danger, the move played left a piece to take, every answer leaves nothing to take', () => {
    const looseOf = (chess: Chess, color: 'w' | 'b') =>
      chess.board().flat().filter((pc) => pc && pc.color === color && 'nbrq'.includes(pc.type) && loose(chess, pc.square));
    for (const d of gameDrillData.hang) {
      const { chess, fen, me } = decision(d);
      expect(looseOf(chess, me), `${d.id}: nothing of yours in danger`).toEqual([]);
      expect(looseOf(chess, other(me)), `${d.id}: nothing of theirs to take`).toEqual([]);

      const played = after(fen, d.played);
      const target = d.target as Square;
      const piece = played.chess.get(target);
      expect(piece?.color, d.id).toBe(me);
      expect(['n', 'b', 'r', 'q']).toContain(piece!.type);
      expect(loose(played.chess, target), `${d.id}: ${d.played} left the piece on ${target} to take`).toBe(true);
      // Not a fair trade: whatever the move captured is worth less than the piece it left
      expect(played.move.captured ? VALUE[played.move.captured] : 0).toBeLessThan(VALUE[piece!.type]);
      expect(d.accepted.map((s) => after(fen, s).move.san)).not.toContain(played.move.san);
      const punish = after(played.fen, d.refutation!);
      expect(punish.move.captured, `${d.id}: ${d.refutation} captures`).toBeTruthy();

      for (const san of d.accepted) {
        const { chess: c, move } = after(fen, san);
        expect(looseOf(c, me).length === 0 || !!move.captured || c.inCheck(), `${d.id}: ${san} leaves nothing to take`).toBe(true);
      }
    }
  });

  it('mate: the move played let the opponent mate at once, no answer does, and there was no mate to give first', () => {
    const mates = (c: Chess) => c.moves().filter((m) => m.endsWith('#'));
    for (const d of gameDrillData.mate ?? []) {
      const { chess, fen } = decision(d);
      // Not in check and no mate of hoot65's own: the decision was only whether the move allows mate
      expect(chess.inCheck(), d.id).toBe(false);
      expect(mates(chess), d.id).toEqual([]);
      const played = after(fen, d.played);
      const mate = after(played.fen, d.refutation!);
      expect(mate.chess.isCheckmate(), `${d.id}: ${d.refutation} mates`).toBe(true);
      expect(mate.move.to).toBe(d.target);
      expect(d.accepted.map((s) => after(fen, s).move.san)).not.toContain(played.move.san);
      for (const san of d.accepted) expect(mates(after(fen, san).chess), `${d.id}: ${san} allows no mate`).toEqual([]);
    }
  });
});

describe('Drill positions from hoot65 games: the lessons', () => {
  it('each position is a one-decision lesson: the opponent move is replayed, then every answer is accepted', () => {
    for (const d of [...gameDrillData.threat, ...gameDrillData.free, ...gameDrillData.hang, ...(gameDrillData.mate ?? [])]) {
      const l = lessonOf(d);
      const { fen, last } = decision(d);
      expect(l.initialFen).toBe(d.fenBefore);
      expect(l.targetColor).toBe(d.color);
      expect(l.relevance).toBe('core');
      expect(l.exercises).toEqual([]);
      expect(l.moves).toHaveLength(2);
      expect(l.moves[0]).toMatchObject({ san: last.san, isUserMove: false });
      expect(l.moves[1].isUserMove).toBe(true);
      expect(answers(l)).toEqual(d.accepted.map((s) => after(fen, s).move.san));
      for (const san of answers(l)) expect(mentionsMove(`${l.title} ${l.subtitle}`, san), `${l.id} leaks ${san}`).toBe(false);

      // One review card per position, reached through the opponent's move
      const specs = enumerateDecisions(l);
      expect(specs).toHaveLength(1);
      expect(specs[0]).toMatchObject({ fen, path: [last.san], acceptedSan: answers(l) });
      // ...and the review lesson built from that card keeps the context move and the game move's story
      const review = lessonFromDecision(l, specs[0]);
      expect(review.moves[0]).toMatchObject({ san: last.san, isUserMove: false });
      expect(review.moves[1].wrongMoveFeedback).toEqual(l.moves[1].wrongMoveFeedback);
      expect(review.commonMistakesAndTraps).toEqual(l.commonMistakesAndTraps);
    }
  });

  it('threat text: what the last move attacked or opened, why the piece could be won, what the move played cost', () => {
    for (const d of gameDrillData.threat) {
      const l = lessonOf(d);
      const { chess, fen, last, me } = decision(d);
      const lastLabel = plyLabel(d.fenBefore, 0, last.san);
      const takeaway = l.thematicObjective ?? '';
      expect(l.moves[0].annotation).toBe(`${lastLabel} in your game vs ${d.opponent}. What does it attack?`);
      expect(takeaway.startsWith(`After every opponent move, ask what it attacks. ${lastLabel} `), l.id).toBe(true);

      // "attacked the X on s1 and the Y on s2": the moved piece attacks each, and each is that piece
      const direct = takeaway.match(new RegExp(`${lastLabel.replace(/[.+]/g, '\\$&')} attacked (.*?)(, and opened|\\. )`));
      for (const [, name, sq] of direct ? direct[1].matchAll(/the (\w+) on ([a-h][1-8])/g) : []) {
        expect(NAME[chess.get(sq as Square)!.type]).toBe(name);
        expect(chess.attackers(sq as Square, other(me))).toContain(last.to);
      }
      // "opened the line of the X on s1 to the Y on s2": the piece on s1 attacks s2, the moved piece does not
      for (const [, by, from, name, sq] of takeaway.matchAll(/opened the line of the (\w+) on ([a-h][1-8]) to the (\w+) on ([a-h][1-8])/g)) {
        expect(NAME[chess.get(from as Square)!.type]).toBe(by);
        expect(NAME[chess.get(sq as Square)!.type]).toBe(name);
        expect(chess.attackers(sq as Square, other(me))).toContain(from);
        expect(chess.attackers(sq as Square, other(me))).not.toContain(last.to);
        expect(new Chess(d.fenBefore).attackers(sq as Square, other(me))).not.toContain(from);
      }
      expect(!!direct || /opened the line/.test(takeaway), l.id).toBe(true);

      // Why the target could be won
      const target = d.target as Square;
      const name = NAME[chess.get(target)!.type];
      if (takeaway.includes(`Nothing defended the ${name} on ${target}.`)) {
        expect(chess.attackers(target, me)).toEqual([]);
      } else {
        const why = takeaway.match(/A (\w+) is worth less than a (\w+), so the (\w+) on ([a-h][1-8]) could be won\./);
        expect(why, l.id).not.toBeNull();
        const att = cheapest(chess, target, other(me))!;
        expect([why![1], why![2], why![3], why![4]]).toEqual([NAME[att.type], name, name, target]);
        expect(VALUE[att.type]).toBeLessThan(VALUE[chess.get(target)!.type]);
      }

      // What the move played cost: the capture, replayed
      const played = after(fen, d.played);
      const punish = after(played.fen, d.refutation!);
      const took = `the ${NAME[punish.move.captured!]} on ${punish.move.to}`;
      const playedLabel = plyLabel(fen, 0, played.move.san);
      const punishLabel = plyLabel(played.fen, 0, punish.move.san);
      expect(l.moves[1].annotation).toBe(
        d.refutationPlayed
          ? `In the game you played ${playedLabel}, and ${punishLabel} took ${took}.`
          : `In the game you played ${playedLabel}; ${punishLabel} would have taken ${took}.`
      );
      expect(playedNote(l, d)).toBe(`This is what you played vs ${d.opponent} on ${d.date}: ${punishLabel} takes ${took}.`);
      // Playing the game move again replays the capture on the board
      expect(l.commonMistakesAndTraps).toEqual([
        expect.objectContaining({ triggerFen: fen, attemptedSan: played.move.san, refutationSanList: [punish.move.san] }),
      ]);
    }
  });

  it('free text: why the piece could be won, and what the game reply did', () => {
    for (const d of gameDrillData.free) {
      const l = lessonOf(d);
      const { chess, fen, me } = decision(d);
      const target = d.target as Square;
      const name = NAME[chess.get(target)!.type];
      const note = playedNote(l, d);
      expect(note.startsWith(`This is what you played vs ${d.opponent} on ${d.date}. The ${name} on ${target} could have been won: `), l.id).toBe(true);
      if (note.endsWith('nothing defended it.')) {
        expect(chess.attackers(target, other(me))).toEqual([]);
      } else {
        const why = note.match(/your (\w+) on ([a-h][1-8]) attacked it, and a (\w+) is worth less than a (\w+)\.$/);
        expect(why, l.id).not.toBeNull();
        const att = cheapest(chess, target, me)!;
        expect([why![1], why![2], why![3], why![4]]).toEqual([NAME[att.type], att.square, NAME[att.type], name]);
        expect(VALUE[att.type]).toBeLessThan(VALUE[chess.get(target)!.type]);
      }

      const played = after(fen, d.played);
      let story = `In the game you played ${plyLabel(fen, 0, played.move.san)}`;
      if (d.reply) {
        const reply = after(played.fen, d.reply);
        const label = plyLabel(played.fen, 0, reply.move.san);
        if (reply.move.captured) story += `, and ${label} took the ${NAME[reply.move.captured]} on ${reply.move.to}`;
        else if (reply.move.from === target) story += `, and ${label} moved the ${name} away`;
      }
      expect(l.moves[1].annotation).toBe(`${story}.`);
    }
  });

  it('hang text: what the move played left to take and why, and the capture that followed', () => {
    for (const d of gameDrillData.hang) {
      const l = lessonOf(d);
      const { fen, last, me } = decision(d);
      const played = after(fen, d.played);
      const target = d.target as Square;
      const name = NAME[played.chess.get(target)!.type];
      const playedLabel = plyLabel(fen, 0, played.move.san);
      expect(l.moves[0].annotation).toBe(
        `${plyLabel(d.fenBefore, 0, last.san)} in your game vs ${d.opponent}. Before you move: what could they take after your move?`
      );
      const lead = `Before every move, ask what your opponent could take after it. After ${playedLabel}, the ${name} on ${target} could be taken: `;
      const takeaway = l.thematicObjective ?? '';
      expect(takeaway.startsWith(lead), l.id).toBe(true);
      const why = takeaway.slice(lead.length);
      if (why === 'nothing defended it.') {
        expect(played.chess.attackers(target, me)).toEqual([]);
      } else {
        const m = why.match(/^the (\w+) on ([a-h][1-8]) attacked it, and a (\w+) is worth less than a (\w+)\.$/);
        expect(m, l.id).not.toBeNull();
        const att = cheapest(played.chess, target, other(me))!;
        expect([m![1], m![2], m![3], m![4]]).toEqual([NAME[att.type], att.square, NAME[att.type], name]);
        expect(VALUE[att.type]).toBeLessThan(VALUE[played.chess.get(target)!.type]);
      }

      const punish = after(played.fen, d.refutation!);
      const took = `the ${NAME[punish.move.captured!]} on ${punish.move.to}`;
      const punishLabel = plyLabel(played.fen, 0, punish.move.san);
      expect(l.moves[1].annotation).toBe(
        d.refutationPlayed
          ? `In the game you played ${playedLabel}, and ${punishLabel} took ${took}.`
          : `In the game you played ${playedLabel}; ${punishLabel} would have taken ${took}.`
      );
      expect(playedNote(l, d)).toBe(`This is what you played vs ${d.opponent} on ${d.date}: ${punishLabel} takes ${took}.`);
      expect(l.commonMistakesAndTraps).toEqual([
        expect.objectContaining({ triggerFen: fen, attemptedSan: played.move.san, refutationSanList: [punish.move.san] }),
      ]);
    }
  });

  it('mate text: the mate the move played allowed, and for each other wrong move whether it allows one', () => {
    for (const d of gameDrillData.mate ?? []) {
      const l = lessonOf(d);
      const { fen, last } = decision(d);
      const played = after(fen, d.played);
      const playedLabel = plyLabel(fen, 0, played.move.san);
      const mate = after(played.fen, d.refutation!);
      const mateLabel = plyLabel(played.fen, 0, mate.move.san);
      expect(l.moves[0].annotation).toBe(
        `${plyLabel(d.fenBefore, 0, last.san)} in your game vs ${d.opponent}. Before you move: after your move, can your opponent give mate?`
      );
      expect(l.moves[1].annotation).toBe(
        d.refutationPlayed ? `In the game you played ${playedLabel}, and ${mateLabel} was mate.` : `In the game you played ${playedLabel}; ${mateLabel} would have been mate.`
      );
      expect(l.thematicObjective).toBe(`Before every move, look at the checks your opponent would have after it. After ${playedLabel}, ${mateLabel} is mate.`);
      expect(playedNote(l, d)).toBe(`This is what you played vs ${d.opponent} on ${d.date}: ${mateLabel} is mate.`);
      expect(l.commonMistakesAndTraps).toEqual([
        expect.objectContaining({ triggerFen: fen, attemptedSan: played.move.san, refutationSanList: [mate.move.san] }),
      ]);
      // A wrong move that allows mate asks for the checks; one that stops it is told there is a better move
      const feedback = l.moves[1].wrongMoveFeedback ?? {};
      for (const san of new Chess(fen).moves()) {
        if (answers(l).includes(san) || san === played.move.san) continue;
        const allows = after(fen, san).chess.moves().some((m) => m.endsWith('#'));
        expect(feedback[san], `${d.id}: ${san}`).toBe(
          allows
            ? 'Not this one. After it, which checks would your opponent have, and is one of them mate?'
            : 'That stops the mate, but it costs you more than it should: there is a stronger move.'
        );
      }
    }
  });
});

describe('Drill positions from hoot65 games: where they appear', () => {
  it('opens the study path with the four sets, newest first, and lists them as a course', () => {
    expect(patternPath[0].lessonIds).toEqual(gameDrillData.threat.map((d) => `lesson-game-${d.id}`));
    expect(patternPath[1].lessonIds).toEqual(gameDrillData.free.map((d) => `lesson-game-${d.id}`));
    expect(patternPath[2].lessonIds).toEqual(gameDrillData.hang.map((d) => `lesson-game-${d.id}`));
    expect(patternPath[3].lessonIds).toEqual((gameDrillData.mate ?? []).map((d) => `lesson-game-${d.id}`));
    expect(missedThreatLessons.map((l) => l.id)).toEqual(patternPath[0].lessonIds);
    expect(freePieceLessons.map((l) => l.id)).toEqual(patternPath[1].lessonIds);
    expect(hangingMoveLessons.map((l) => l.id)).toEqual(patternPath[2].lessonIds);
    expect(allowedMateLessons.map((l) => l.id)).toEqual(patternPath[3].lessonIds);
    for (const l of gameDrillLessons) {
      expect(isGameDrill(l.id)).toBe(true);
      expect(allCurriculumLessons).toContain(l);
    }
    expect(drillSetOf(missedThreatLessons[3].id)).toBe(missedThreatLessons);
    expect(drillSetOf(freePieceLessons[0].id)).toBe(freePieceLessons);
    expect(drillSetOf(hangingMoveLessons[5].id)).toBe(hangingMoveLessons);
    expect(drillSetOf(allowedMateLessons[2].id)).toBe(allowedMateLessons);
    expect(drillSetOf('lesson-legals-mate')).toBeUndefined();
    expect(allCurriculumLessons.filter((l) => !isGameDrill(l.id)).every((l) => drillSetOf(l.id) === undefined)).toBe(true);
    expect(curriculumCourses.find((c) => c.id === 'course-game-drills')?.lessons).toEqual(gameDrillLessons);
  });
});
