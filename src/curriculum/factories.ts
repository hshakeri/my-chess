import { Chess } from 'chess.js';
import { CurriculumLesson } from '../types/curriculum';
import { OpeningDeviation, RepertoireLine } from '../types/diagnostics';
import { buildVerifiedLesson, findMoveAtPath, positionKey, MoveInput, MistakeTrapInput } from './builder';
import { canonicalFenKey } from '../services/fenKey';

/**
 * Lesson factories for the diagnose-to-drill loop (roadmap CL-4): a deviation
 * found in the player's own games becomes a one-decision drill, and a repertoire
 * line becomes a lesson. Everything goes through `buildVerifiedLesson`, so an
 * illegal FEN or move throws instead of producing a broken lesson.
 */

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface DeviationLessonOptions {
  id?: string;
  title?: string;
  sourceBook?: string;
  author?: string;
}

export interface RepertoireLineLessonOptions {
  startPly?: number;
  id?: string;
  /** Position the line starts from; defaults to the standard start position. */
  initialFen?: string;
  sourceBook?: string;
  author?: string;
}

/** A SAN token appears in `text` as a whole word (so a title cannot leak the answer). */
function mentionsMove(text: string, san: string): boolean {
  const escaped = san.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}(?![A-Za-z0-9])`).test(text);
}

/**
 * Strip parentheticals that print a move ("(2.exd5!)", "(Disciplined 3...Bf5!)")
 * from a line name, so the lesson title never prints an answer.
 */
export function answerFreeTitle(name: string): string {
  return name
    .replace(/\s*\([^)]*\d+\.{1,3}\s*[A-Za-z][^)]*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function colorName(color: 'white' | 'black'): string {
  return color === 'white' ? 'White' : 'Black';
}

/**
 * A one-decision drill at the deviation's position: the student must find the
 * book move; the move actually played in the game gets its own feedback.
 * Throws when the deviation carries no verified book move, when the FEN or the
 * played move is not legal, or when the title would print the answer.
 */
export function lessonFromDeviation(dev: OpeningDeviation, opts: DeviationLessonOptions = {}): CurriculumLesson {
  if (!dev.bookSan) {
    throw new Error(
      `[Curriculum Factory] Deviation in game ${dev.gameId} at ply ${dev.ply} has no verified book move; a drill needs one.`
    );
  }
  const bookSan = dev.bookSan;
  const playedSan = dev.playedSan.replace(/[!?]/g, '');

  const probe = new Chess(dev.fen); // throws on an invalid FEN
  const expectedTurn = dev.playedColor === 'white' ? 'w' : 'b';
  if (probe.turn() !== expectedTurn) {
    throw new Error(
      `[Curriculum Factory] Deviation in game ${dev.gameId} says ${dev.playedColor} moved, but it is ${probe.turn() === 'w' ? 'White' : 'Black'} to move in ${dev.fen}.`
    );
  }
  try {
    new Chess(dev.fen).move(playedSan);
  } catch {
    throw new Error(
      `[Curriculum Factory] Played move '${dev.playedSan}' is not legal in ${dev.fen} (game ${dev.gameId}).`
    );
  }

  const moveNo = Math.floor((dev.ply - 1) / 2) + 1;
  const withOpponent = `Repertoire drill: move ${moveNo} as ${colorName(dev.playedColor)} vs ${dev.opponent}`;
  // An opponent handle that happens to spell the answer must not leak it into the title
  const title =
    opts.title ?? (mentionsMove(withOpponent, bookSan) ? `Repertoire drill: move ${moveNo} as ${colorName(dev.playedColor)}` : withOpponent);
  if (mentionsMove(title, bookSan)) {
    throw new Error(`[Curriculum Factory] The drill title must not print the answer ('${bookSan}').`);
  }

  const when = dev.gameDate ? ` on ${dev.gameDate}` : '';
  const lineText = dev.lineName ? ` This position belongs to the ${dev.lineName}.` : '';
  const description = `In your game vs ${dev.opponent}${when} (game ${dev.gameId}) you played ${playedSan} here.${lineText} ${dev.description}`.trim();
  const year = dev.gameDate ? Number(dev.gameDate.slice(0, 4)) : undefined;

  const decision: MoveInput = {
    san: bookSan,
    isUserMove: true,
    annotation: dev.lineName ? `The move of your plan here (${dev.lineName}).` : 'The move your repertoire gives here.',
    wrongMoveFeedback: {
      [playedSan]: `This is what you played vs ${dev.opponent}${when}. ${dev.description}`,
    },
  };

  return buildVerifiedLesson({
    id: opts.id ?? `drill-deviation-${dev.gameId}-${dev.ply}`,
    title,
    subtitle: `From your game vs ${dev.opponent}${when}`,
    category: 'weakness_drill',
    sourceBook: opts.sourceBook ?? 'hoot65 Chess.com archive',
    author: opts.author ?? 'hoot65 diagnostic analysis',
    publicationYear: year && Number.isFinite(year) ? year : undefined,
    initialFen: dev.fen,
    description,
    thematicObjective: `Find the repertoire move for ${colorName(dev.playedColor)} in the position where the game left the plan.`,
    targetColor: dev.playedColor,
    targetRatingBand: 'intermediate',
    startPly: 0,
    relevance: 'core',
    moves: [decision],
    exercises: [],
  });
}

/**
 * A lesson that walks a repertoire line: the plan's moves for `color` are the
 * student's decisions, the plan's commentary becomes each move's annotation and
 * its tactical motif the hint theme. The line is replayed with chess.js here and
 * again by the builder.
 */
export function lessonFromRepertoireLine(
  line: RepertoireLine,
  color: 'white' | 'black',
  opts: RepertoireLineLessonOptions = {}
): CurriculumLesson {
  const initialFen = opts.initialFen ?? START_FEN;
  const student: 'w' | 'b' = color === 'white' ? 'w' : 'b';
  const chess = new Chess(initialFen);
  const moves: MoveInput[] = [];

  for (const move of line.moves) {
    const turn = chess.turn();
    try {
      chess.move(move.san);
    } catch {
      throw new Error(
        `[Curriculum Factory] Illegal move '${move.san}' at ply ${move.ply} in repertoire line '${line.id}'. FEN: ${chess.fen()}`
      );
    }
    moves.push({
      san: move.san,
      isUserMove: turn === student,
      annotation: move.commentary,
      hintTheme: move.tacticalMotif,
    });
  }

  return buildVerifiedLesson({
    id: opts.id ?? `lesson-line-${line.id}`,
    title: answerFreeTitle(line.name),
    subtitle: `Repertoire line for ${colorName(color)}`,
    category: 'opening',
    sourceBook: opts.sourceBook ?? 'Tailored repertoire plan',
    author: opts.author ?? 'hoot65 diagnostic analysis',
    eco: line.eco,
    initialFen,
    description: line.description,
    thematicObjective: line.keyIdeas.join('. '),
    targetColor: color,
    targetRatingBand: 'intermediate',
    startPly: opts.startPly ?? 0,
    relevance: 'core',
    moves,
    exercises: [],
  });
}

/** The part of a decision a review card needs: the position, the accepted answers and how the lesson got there. */
export interface DecisionLike {
  fen: string;
  acceptedSan: string[];
  /** SAN moves from the source lesson's initial position to `fen` (empty when unknown). */
  path: string[];
  title?: string;
  lessonId: string;
}

export interface DecisionLessonOptions {
  /** How many plies before the decision are replayed on the board as context (default 4). */
  contextPlies?: number;
  id?: string;
}

/**
 * A one-decision review card as a lesson. When the source lesson and the path are known,
 * the last few plies before the decision are replayed automatically so the position arrives
 * with its context (the over-the-board cue), then the student must find the move; otherwise
 * the bare position is shown. The title is the decision's answer-free label.
 */
export function lessonFromDecision(
  source: CurriculumLesson | undefined,
  spec: DecisionLike,
  opts: DecisionLessonOptions = {}
): CurriculumLesson {
  if (spec.acceptedSan.length === 0) {
    throw new Error(`[Curriculum Factory] A review card for lesson '${spec.lessonId}' has no accepted move.`);
  }
  const key = canonicalFenKey(spec.fen);
  const contextPlies = Math.max(0, Math.min(opts.contextPlies ?? 4, spec.path.length));
  const canReplay = !!source && spec.path.length > 0;

  let initialFen = spec.fen;
  const moves: MoveInput[] = [];
  if (canReplay) {
    const chess = new Chess(source.initialFen);
    const prefix = spec.path.slice(0, spec.path.length - contextPlies);
    for (const san of prefix) {
      try {
        chess.move(san);
      } catch {
        throw new Error(`[Curriculum Factory] Illegal context move '${san}' on the path of lesson '${source.id}'.`);
      }
    }
    initialFen = chess.fen();
    for (const san of spec.path.slice(spec.path.length - contextPlies)) moves.push({ san, isUserMove: false });
  }
  const [main, ...alternatives] = spec.acceptedSan;
  // The source lesson's own teaching for this decision (annotation, hints, feedback, arrows) travels with the card
  const sourceMove = canReplay ? findMoveAtPath(source, [...spec.path, main]) : undefined;
  moves.push({
    san: main,
    isUserMove: true,
    accept: alternatives.length > 0 ? { san: alternatives } : undefined,
    annotation: sourceMove?.annotation,
    hintPiece: sourceMove?.hintPiece,
    hintSquare: sourceMove?.hintSquare,
    hintTheme: sourceMove?.hintTheme,
    wrongMoveFeedback: sourceMove?.wrongMoveFeedback,
    arrows: sourceMove?.arrows,
    highlights: sourceMove?.highlights,
  });
  const decisionKey = positionKey(spec.fen);
  const mistakesAndTraps: MistakeTrapInput[] = (source?.commonMistakesAndTraps || [])
    .filter((t) => positionKey(t.triggerFen) === decisionKey)
    .map((t) => ({
      triggerFen: t.triggerFen,
      attemptedSan: t.attemptedSan,
      isTrap: t.isTrap,
      severity: t.severity,
      explanatoryFeedback: t.explanatoryFeedback,
      refutationSanList: t.refutationSanList,
      punishmentSummary: t.punishmentSummary,
    }));

  const turn = new Chess(spec.fen).turn();
  return buildVerifiedLesson({
    id: opts.id ?? `card-lesson-${key.replace(/[^A-Za-z0-9]/g, '_')}`,
    title: spec.title ?? `${turn === 'w' ? 'White' : 'Black'} to move`,
    subtitle: canReplay ? 'Review card: the line is replayed, then find the move' : 'Review card: find the move',
    category: 'weakness_drill',
    sourceBook: source?.sourceBook ?? 'Review cards',
    author: source?.author ?? 'hoot65 diagnostic analysis',
    eco: source?.eco,
    initialFen,
    description: 'A position from your own study, scheduled by how well you recalled it last time.',
    thematicObjective: source?.thematicObjective,
    keyTacticalMotif: source?.keyTacticalMotif,
    targetColor: turn === 'w' ? 'white' : 'black',
    targetRatingBand: source?.targetRatingBand ?? 'intermediate',
    relevance: 'core',
    moves,
    exercises: [],
    mistakesAndTraps,
  });
}
