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
  plyIndex?: number; // 0-based index into moves array to grab trigger fen
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

/**
 * Builds and strictly validates a CurriculumLesson using chess.js.
 * Ensures 100% of moves, acceptance alternatives, exercise solutions and
 * refutation lines are legal. Fills in piece/square hints from the move itself
 * when the author did not provide them, so a hint ladder never has to fall back
 * to printing the move.
 */
export function buildVerifiedLesson(config: LessonConfig): CurriculumLesson {
  const startFen = config.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const chess = new Chess(startFen);

  const verifiedMoves: CurriculumMove[] = [];
  const fenHistory: string[] = [startFen];

  // 1. Process and verify every main line move
  for (let i = 0; i < config.moves.length; i++) {
    const input = config.moves[i];
    const ply = i + 1;
    const turn = chess.turn();
    const fenBefore = chess.fen();

    // Determine if user move: default to the target perspective, or respect input.isUserMove
    const isUser = input.isUserMove !== undefined
      ? input.isUserMove
      : (config.targetColor === 'black' ? turn === 'b' : turn === 'w');

    // Acceptance alternatives are validated from the position BEFORE the move
    if (input.accept) {
      if (!isUser) {
        throw new Error(
          `[Curriculum Builder] 'accept' is only allowed on user moves (ply ${ply}, lesson '${config.id}').`
        );
      }
      if (i !== config.moves.length - 1) {
        throw new Error(
          `[Curriculum Builder] 'accept' alternatives are only allowed on the final move of the line (ply ${ply}, lesson '${config.id}'), because the scripted continuation assumes the scripted move.`
        );
      }
      for (const altSan of input.accept.san || []) {
        const probe = new Chess(fenBefore);
        let ok = true;
        try {
          probe.move(altSan);
        } catch {
          ok = false;
        }
        if (!ok) {
          throw new Error(
            `[Curriculum Builder] Illegal acceptance alternative '${altSan}' at ply ${ply} in lesson '${config.id}'. FEN: ${fenBefore}`
          );
        }
      }
    }

    let moveResult;
    try {
      moveResult = chess.move(input.san);
    } catch {
      moveResult = null;
    }
    if (!moveResult) {
      throw new Error(
        `[Curriculum Builder] Illegal move '${input.san}' at ply ${ply} in lesson '${config.id}'. Current FEN: ${fenBefore}`
      );
    }

    if (input.accept?.predicate === 'checkmate' && !chess.isCheckmate()) {
      throw new Error(
        `[Curriculum Builder] 'accept.predicate: checkmate' requires the scripted move to be checkmate (ply ${ply}, lesson '${config.id}').`
      );
    }

    const fenAfter = chess.fen();
    fenHistory.push(fenAfter);

    const uci = `${moveResult.from}${moveResult.to}${moveResult.promotion || ''}`;

    verifiedMoves.push({
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
    });
  }

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

  // 3. Process mistakes and traps: the attempted move and every refutation move must be legal
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
