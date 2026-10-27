import { Chess } from 'chess.js';
import {
  CurriculumLesson,
  CurriculumMove,
  CurriculumExercise,
  CurriculumMistakeTrap,
  MoveAcceptance,
} from '../types/curriculum';

export interface MoveInput {
  san: string;
  annotation?: string;
  isUserMove?: boolean;
  wrongMoveFeedback?: Record<string, string>;
  arrows?: Array<{ from: string; to: string; color?: 'green' | 'red' | 'yellow' | 'blue' }>;
  highlights?: Array<{ square: string; color?: 'green' | 'red' | 'yellow' | 'blue' }>;
  hintPiece?: string;
  hintSquare?: string;
  hintTheme?: string;
  accept?: MoveAcceptance;
  /**
   * Opponent moves only: replies the opponent may play instead of `san`, keyed by
   * the alternative's SAN, each with the verified continuation that starts with the
   * student's reply. See `CurriculumMove.alternatives`.
   */
  alternatives?: Record<string, MoveInput[]>;
  /** Observed count (or authored weight) of this reply. See `CurriculumMove.frequency`. */
  frequency?: number;
}

export interface ExerciseInput {
  id: string;
  title?: string;
  prompt: string;
  fen?: string; // If omitted, uses final FEN of previous moves or lesson FEN
  turn?: 'w' | 'b';
  difficultyRating?: number;
  solutionSan: string[];
  explanation: string;
  sourceGame?: {
    white: string;
    black: string;
    event?: string;
    year?: number;
    eco?: string;
  };
}

export interface MistakeTrapInput {
  triggerFen?: string;
  plyIndex?: number; // 0-based index into the MAIN LINE moves array to grab trigger fen (branches need triggerFen)
  attemptedSan: string;
  isTrap: boolean;
  severity: 'blunder' | 'inaccuracy' | 'trap_victim';
  explanatoryFeedback: string;
  refutationSanList: string[];
  punishmentSummary: string;
}

export interface LessonConfig {
  id: string;
  title: string;
  subtitle?: string;
  category: 'opening' | 'trap' | 'weakness_drill' | 'fundamentals';
  sourceBook: string;
  author: string;
  publicationYear?: number;
  pagesRef?: string;
  eco?: string;
  initialFen?: string;
  description?: string;
  thematicObjective?: string;
  keyTacticalMotif?: string;
  targetColor?: 'white' | 'black' | 'both';
  targetRatingBand?: 'beginner' | 'intermediate' | 'advanced';
  startPly?: number;
  relevance?: 'core' | 'outside-repertoire';
  moves: MoveInput[];
  exercises: ExerciseInput[];
  mistakesAndTraps?: MistakeTrapInput[];
}

/**
 * One student decision in a lesson tree: the position before the student's move,
 * every SAN the lesson accepts there, and where it sits in the tree. This is the
 * input shape of the position-level card store (module A declares an identical
 * structural type on its side).
 */
export interface DecisionSpec {
  fen: string; // full FEN of the position BEFORE the student's move
  acceptedSan: string[]; // every SAN the lesson accepts at this decision (main move first)
  lessonId: string;
  ply: number; // 0-based index into the line (main line) or into the branch sequence
  color: 'w' | 'b'; // side to move = the student
  path: string[]; // SAN sequence from the lesson's initialFen to this position
  tags: string[]; // e.g. 'opening:italian', 'color:w', 'lesson:<id>', 'family:<course category>'
  title?: string; // short human label for the decision (never the answer)
  reachProb?: number; // 0..1 product of branch frequencies along the path (1 for main line)
}

const PIECE_NAMES: Record<string, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

/** Human-readable piece hint derived from a verified move, e.g. "Knight on g1". */
export function derivePieceHint(move: { piece: string; from: string; san: string }): string {
  if (move.san === 'O-O' || move.san === 'O-O-O') return 'King (castling)';
  return `${PIECE_NAMES[move.piece] || 'Piece'} on ${move.from}`;
}

/** Weight of a reply: its observed frequency, or 1 when nothing was observed. */
const DEFAULT_WEIGHT = 1;

function weightOf(move: CurriculumMove | undefined): number {
  const f = move?.frequency;
  return typeof f === 'number' && Number.isFinite(f) && f >= 0 ? f : DEFAULT_WEIGHT;
}

function isUserMoveFor(turn: 'w' | 'b', targetColor: LessonConfig['targetColor'], input: MoveInput): boolean {
  if (input.isUserMove !== undefined) return input.isUserMove;
  return targetColor === 'black' ? turn === 'b' : turn === 'w';
}

function tryMove(fen: string, san: string): { san: string; fen: string; from: string; to: string; piece: string; promotion?: string } | null {
  const probe = new Chess(fen);
  try {
    const res = probe.move(san);
    return res ? { san: res.san, fen: probe.fen(), from: res.from, to: res.to, piece: res.piece, promotion: res.promotion } : null;
  } catch {
    return null;
  }
}

interface SequenceContext {
  lessonId: string;
  targetColor: LessonConfig['targetColor'];
  /** Human label of the sequence for error messages: 'main line' or 'branch 3...Nf6'. */
  where: string;
}

/**
 * Verifies one move sequence (the main line or a branch continuation) from `startFen`.
 * Returns the verified moves and the FEN before each move plus the final FEN.
 */
function verifySequence(
  startFen: string,
  inputs: MoveInput[],
  firstPly: number,
  ctx: SequenceContext
): { moves: CurriculumMove[]; fenHistory: string[] } {
  const chess = new Chess(startFen);
  const verified: CurriculumMove[] = [];
  const fenHistory: string[] = [startFen];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const ply = firstPly + i;
    const turn = chess.turn();
    const fenBefore = chess.fen();
    const isUser = isUserMoveFor(turn, ctx.targetColor, input);
    const isLast = i === inputs.length - 1;

    // Acceptance alternatives are validated from the position BEFORE the move
    if (input.accept) {
      if (!isUser) {
        throw new Error(
          `[Curriculum Builder] 'accept' is only allowed on user moves (ply ${ply}, ${ctx.where}, lesson '${ctx.lessonId}').`
        );
      }
      if (!isLast) {
        throw new Error(
          `[Curriculum Builder] 'accept' alternatives are only allowed on the final move of the line (ply ${ply}, ${ctx.where}, lesson '${ctx.lessonId}'), because the scripted continuation assumes the scripted move.`
        );
      }
      for (const altSan of input.accept.san || []) {
        if (!tryMove(fenBefore, altSan)) {
          throw new Error(
            `[Curriculum Builder] Illegal acceptance alternative '${altSan}' at ply ${ply} (${ctx.where}) in lesson '${ctx.lessonId}'. FEN: ${fenBefore}`
          );
        }
      }
    }

    if (input.frequency !== undefined && !(Number.isFinite(input.frequency) && input.frequency >= 0)) {
      throw new Error(
        `[Curriculum Builder] 'frequency' must be a non-negative number (ply ${ply}, ${ctx.where}, lesson '${ctx.lessonId}').`
      );
    }

    let moveResult;
    try {
      moveResult = chess.move(input.san);
    } catch {
      moveResult = null;
    }
    if (!moveResult) {
      throw new Error(
        `[Curriculum Builder] Illegal move '${input.san}' at ply ${ply} (${ctx.where}) in lesson '${ctx.lessonId}'. Current FEN: ${fenBefore}`
      );
    }

    if (input.accept?.predicate === 'checkmate' && !chess.isCheckmate()) {
      throw new Error(
        `[Curriculum Builder] 'accept.predicate: checkmate' requires the scripted move to be checkmate (ply ${ply}, ${ctx.where}, lesson '${ctx.lessonId}').`
      );
    }

    // Opponent alternatives: each key must be a legal move in the position before the
    // scripted opponent move, and each continuation is verified from the branch FEN.
    let alternatives: Record<string, CurriculumMove[]> | undefined;
    if (input.alternatives) {
      if (isUser) {
        throw new Error(
          `[Curriculum Builder] 'alternatives' are only allowed on opponent moves (ply ${ply}, ${ctx.where}, lesson '${ctx.lessonId}').`
        );
      }
      if (Object.keys(input.alternatives).length === 0) {
        throw new Error(
          `[Curriculum Builder] 'alternatives' must not be empty (ply ${ply}, ${ctx.where}, lesson '${ctx.lessonId}').`
        );
      }
      alternatives = {};
      for (const [altKey, continuation] of Object.entries(input.alternatives)) {
        const alt = tryMove(fenBefore, altKey);
        if (!alt) {
          throw new Error(
            `[Curriculum Builder] Illegal alternative key '${altKey}' for the opponent at ply ${ply} (${ctx.where}) in lesson '${ctx.lessonId}'. FEN: ${fenBefore}`
          );
        }
        if (alt.san === moveResult.san) {
          throw new Error(
            `[Curriculum Builder] Alternative '${altKey}' duplicates the scripted reply '${moveResult.san}' at ply ${ply} (${ctx.where}) in lesson '${ctx.lessonId}'.`
          );
        }
        if (alternatives[alt.san]) {
          throw new Error(
            `[Curriculum Builder] Alternative '${altKey}' is listed twice at ply ${ply} (${ctx.where}) in lesson '${ctx.lessonId}'.`
          );
        }
        if (!Array.isArray(continuation) || continuation.length === 0) {
          throw new Error(
            `[Curriculum Builder] Alternative '${altKey}' at ply ${ply} (${ctx.where}) in lesson '${ctx.lessonId}' needs a continuation starting with the student's reply.`
          );
        }
        const replyTurn = new Chess(alt.fen).turn();
        if (!isUserMoveFor(replyTurn, ctx.targetColor, continuation[0])) {
          throw new Error(
            `[Curriculum Builder] The continuation after '${altKey}' at ply ${ply} (${ctx.where}) in lesson '${ctx.lessonId}' must start with the student's reply.`
          );
        }
        const branchLabel = `${ctx.where === 'main line' ? '' : ctx.where + ' > '}branch ${plyLabel(fenBefore, 0, alt.san)}`;
        const branch = verifySequence(alt.fen, continuation, ply + 1, { ...ctx, where: branchLabel });
        alternatives[alt.san] = branch.moves;
      }
    }

    const fenAfter = chess.fen();
    fenHistory.push(fenAfter);

    const uci = `${moveResult.from}${moveResult.to}${moveResult.promotion || ''}`;

    verified.push({
      ply,
      san: moveResult.san,
      uci,
      fenAfter,
      annotation: input.annotation,
      isUserMove: isUser,
      wrongMoveFeedback: input.wrongMoveFeedback,
      arrows: input.arrows,
      highlights: input.highlights,
      hintPiece: input.hintPiece || derivePieceHint(moveResult),
      hintSquare: input.hintSquare || moveResult.to,
      hintTheme: input.hintTheme,
      accept: input.accept,
      alternatives,
      frequency: input.frequency,
    });
  }

  return { moves: verified, fenHistory };
}

/**
 * Builds and strictly validates a CurriculumLesson using chess.js.
 * Ensures 100% of moves, acceptance alternatives, opponent alternatives and their
 * continuations, exercise solutions and refutation lines are legal. Fills in
 * piece/square hints from the move itself when the author did not provide them,
 * so a hint ladder never has to fall back to printing the move.
 */
export function buildVerifiedLesson(config: LessonConfig): CurriculumLesson {
  const startFen = config.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // 1. Process and verify every main line move (and, recursively, every branch)
  const { moves: verifiedMoves, fenHistory } = verifySequence(startFen, config.moves, 1, {
    lessonId: config.id,
    targetColor: config.targetColor,
    where: 'main line',
  });
  const chess = new Chess(fenHistory[fenHistory.length - 1]);

  if (config.startPly !== undefined && (config.startPly < 0 || config.startPly > verifiedMoves.length)) {
    throw new Error(`[Curriculum Builder] startPly ${config.startPly} is out of range in lesson '${config.id}'.`);
  }

  // 2. Process and verify exercises
  const verifiedExercises: CurriculumExercise[] = [];
  for (const exInput of config.exercises) {
    const exFen = exInput.fen || chess.fen();
    const exChess = new Chess(exFen);

    for (const solSan of exInput.solutionSan) {
      let res;
      try {
        res = exChess.move(solSan);
      } catch {
        res = null;
      }
      if (!res) {
        throw new Error(
          `[Curriculum Builder] Illegal solution move '${solSan}' in exercise '${exInput.id}' (lesson '${config.id}'). Exercise FEN: ${exChess.fen()}`
        );
      }
    }

    verifiedExercises.push({
      id: exInput.id,
      title: exInput.title,
      prompt: exInput.prompt,
      fen: exFen,
      turn: exInput.turn || new Chess(exFen).turn(),
      difficultyRating: exInput.difficultyRating ?? 2,
      solutionSan: exInput.solutionSan,
      explanation: exInput.explanation,
      sourceGame: exInput.sourceGame,
    });
  }

  // 3. Process mistakes and traps: the attempted move and every refutation move must be legal.
  //    `plyIndex` anchors to the main line only; a branch position needs an explicit `triggerFen`.
  const verifiedMistakes: CurriculumMistakeTrap[] = [];
  if (config.mistakesAndTraps) {
    for (const mInput of config.mistakesAndTraps) {
      let triggerFen = mInput.triggerFen;
      if (!triggerFen && mInput.plyIndex !== undefined) {
        const anchored = fenHistory[mInput.plyIndex];
        if (!anchored) {
          throw new Error(
            `[Curriculum Builder] plyIndex ${mInput.plyIndex} is out of range for the mistake '${mInput.attemptedSan}' in lesson '${config.id}'`
          );
        }
        triggerFen = anchored;
      }
      if (!triggerFen) {
        triggerFen = startFen;
      }

      const testChess = new Chess(triggerFen);
      let attemptRes;
      try {
        attemptRes = testChess.move(mInput.attemptedSan);
      } catch {
        attemptRes = null;
      }
      if (!attemptRes) {
        throw new Error(
          `[Curriculum Builder] Mistake move '${mInput.attemptedSan}' is not legal from its trigger FEN in lesson '${config.id}'. FEN: ${triggerFen}`
        );
      }
      for (const refSan of mInput.refutationSanList) {
        let refRes;
        try {
          refRes = testChess.move(refSan);
        } catch {
          refRes = null;
        }
        if (!refRes) {
          throw new Error(
            `[Curriculum Builder] Illegal refutation move '${refSan}' after '${mInput.attemptedSan}' in lesson '${config.id}'. FEN: ${testChess.fen()}`
          );
        }
      }

      verifiedMistakes.push({
        triggerFen,
        attemptedSan: mInput.attemptedSan,
        isTrap: mInput.isTrap,
        severity: mInput.severity,
        explanatoryFeedback: mInput.explanatoryFeedback,
        refutationSanList: mInput.refutationSanList,
        punishmentSummary: mInput.punishmentSummary,
      });
    }
  }

  return {
    id: config.id,
    title: config.title,
    subtitle: config.subtitle,
    category: config.category,
    sourceBook: config.sourceBook,
    author: config.author,
    publicationYear: config.publicationYear,
    pagesRef: config.pagesRef,
    eco: config.eco,
    initialFen: startFen,
    description: config.description,
    thematicObjective: config.thematicObjective,
    keyTacticalMotif: config.keyTacticalMotif,
    targetColor: config.targetColor ?? 'white',
    targetRatingBand: config.targetRatingBand ?? 'intermediate',
    startPly: config.startPly ?? 0,
    relevance: config.relevance ?? 'core',
    moves: verifiedMoves,
    exercises: verifiedExercises,
    commonMistakesAndTraps: verifiedMistakes,
  };
}

/**
 * Normalise a FEN to its first four fields so positions can be compared
 * regardless of move counters.
 */
export function positionKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

/**
 * Numbered SAN label for the move played `index` plies after `fromFen`,
 * e.g. "3...Nf6" or "4.d3". Honours the FEN's side to move and move number.
 */
export function plyLabel(fromFen: string, index: number, san: string): string {
  const fields = fromFen.trim().split(/\s+/);
  const startTurn = fields[1] === 'b' ? 1 : 0;
  const startNumber = Number.parseInt(fields[5] || '1', 10) || 1;
  const halfMoves = startTurn + index;
  const moveNumber = startNumber + Math.floor(halfMoves / 2);
  return halfMoves % 2 === 0 ? `${moveNumber}.${san}` : `${moveNumber}...${san}`;
}

/** The first user decision of a lesson at or after its start ply. */
export function firstUserDecision(lesson: CurriculumLesson): { index: number; move: CurriculumMove; fenBefore: string } | null {
  const start = lesson.startPly ?? 0;
  for (let i = start; i < lesson.moves.length; i++) {
    if (lesson.moves[i].isUserMove) {
      const fenBefore = i === 0 ? lesson.initialFen : lesson.moves[i - 1].fenAfter || lesson.initialFen;
      return { index: i, move: lesson.moves[i], fenBefore };
    }
  }
  return null;
}

export interface ReplyOption {
  san: string;
  weight: number;
  /** Share of the weight among the scripted reply and its alternatives (0..1). */
  share: number;
  /** null for the scripted reply (the lesson continues on its own line). */
  continuation: CurriculumMove[] | null;
}

/**
 * The scripted reply and every alternative at an opponent move, with their weights
 * (frequency, default 1) and shares. The scripted reply is always first.
 */
export function replyOptions(move: CurriculumMove): ReplyOption[] {
  const options: Array<Omit<ReplyOption, 'share'>> = [{ san: move.san, weight: weightOf(move), continuation: null }];
  for (const [san, continuation] of Object.entries(move.alternatives || {})) {
    options.push({ san, weight: weightOf(continuation[0]), continuation });
  }
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  return options.map((o) => ({ ...o, share: total > 0 ? o.weight / total : o.san === move.san ? 1 : 0 }));
}

/**
 * Weighted choice of the opponent's reply at a scripted opponent move: the scripted
 * reply weighs its own `frequency` (default 1), each alternative weighs its first
 * move's `frequency` (default 1). Pure: the same `rng` output always gives the same
 * reply. A total weight of zero falls back to the scripted reply.
 */
export function chooseOpponentReply(
  move: CurriculumMove,
  rng: () => number
): { san: string; continuation: CurriculumMove[] | null } {
  const options = replyOptions(move);
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  if (options.length === 1 || total <= 0) return { san: move.san, continuation: null };
  const u = Math.min(Math.max(rng(), 0), 1 - Number.EPSILON);
  let r = u * total;
  for (const o of options) {
    r -= o.weight;
    if (r < 0) return { san: o.san, continuation: o.continuation };
  }
  const last = options[options.length - 1];
  return { san: last.san, continuation: last.continuation };
}

/** Lesson id without its `lesson-` prefix, used as the `opening:` tag. */
export function openingSlug(lessonId: string): string {
  return lessonId.replace(/^lesson-/, '');
}

function sideName(turn: 'w' | 'b'): string {
  return turn === 'w' ? 'White' : 'Black';
}

/**
 * Every student decision of a lesson: the main line from `startPly` onward and every
 * branch reachable from it, each with its path from `initialFen`, its reach
 * probability (main line 1; a branch multiplies the reply shares along the path) and
 * the tags the card store indexes on.
 */
export function enumerateDecisions(lesson: CurriculumLesson): DecisionSpec[] {
  const out: DecisionSpec[] = [];
  const start = lesson.startPly ?? 0;
  const baseTags = [`lesson:${lesson.id}`, `family:${lesson.category}`, `opening:${openingSlug(lesson.id)}`];

  const walk = (moves: CurriculumMove[], fenAtStart: string, pathPrefix: string[], reach: number, isMain: boolean) => {
    let fen = fenAtStart;
    const path = [...pathPrefix];
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const active = !isMain || i >= start;
      const turn = new Chess(fen).turn();
      if (active && move.isUserMove) {
        const acceptedSan = [move.san, ...(move.accept?.san || []).filter((s) => s !== move.san)];
        const lastSan = path.length > 0 ? path[path.length - 1] : null;
        // A recapture with the same SAN as the opponent's move would print the answer: use a neutral label then
        const last =
          lastSan && !acceptedSan.includes(lastSan) ? plyLabel(lesson.initialFen, path.length - 1, lastSan) : null;
        const moveNumber = Math.floor(path.length / 2) + 1;
        out.push({
          fen,
          acceptedSan,
          lessonId: lesson.id,
          ply: i,
          color: turn,
          path: [...path],
          tags: [...baseTags, `color:${turn}`],
          title: last
            ? `${sideName(turn)} to move after ${last}`
            : lastSan
              ? `${sideName(turn)} to move (move ${moveNumber})`
              : `${sideName(turn)} to move from the start position`,
          reachProb: reach,
        });
      }
      if (active && !move.isUserMove && move.alternatives) {
        for (const option of replyOptions(move)) {
          if (!option.continuation) continue;
          const alt = tryMove(fen, option.san);
          if (!alt) continue; // cannot happen for a built lesson; the builder verified every key
          walk(option.continuation, alt.fen, [...path, option.san], reach * option.share, false);
        }
      }
      path.push(move.san);
      fen = move.fenAfter || tryMove(fen, move.san)?.fen || fen;
    }
  };

  walk(lesson.moves, lesson.initialFen, [], 1, true);
  return out;
}
