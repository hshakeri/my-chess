/**
 * Curriculum & Printable Worksheets TypeScript Interfaces
 * Conforms to PROJECT.md § 5. Curriculum & Printable Worksheets Contract
 * and Explorer 3's surveyed curriculum data models.
 */

/**
 * How a user move is judged. By default only the scripted SAN is accepted.
 * `san` lists equally good alternatives (validated by the builder); `predicate`
 * accepts any legal move satisfying a condition (currently only 'checkmate').
 * Alternatives are allowed only on the final user move of a line, because the
 * scripted continuation assumes the scripted move.
 */
export interface MoveAcceptance {
  san?: string[];
  predicate?: 'checkmate';
}

export interface CurriculumMove {
  ply: number;
  san: string;
  uci?: string;
  fenAfter?: string;
  annotation?: string;
  isUserMove: boolean;
  wrongMoveFeedback?: Record<string, string>; // SAN -> explanation
  arrows?: Array<{ from: string; to: string; color?: 'green' | 'red' | 'yellow' | 'blue' }>;
  highlights?: Array<{ square: string; color?: 'green' | 'red' | 'yellow' | 'blue' }>;
  hintPiece?: string; // e.g. "White Queen" (derived from the move when not authored)
  hintSquare?: string; // e.g. "d5" (derived from the move when not authored)
  hintTheme?: string; // e.g. "Double attack against f7 and c6"
  accept?: MoveAcceptance;
  /**
   * Opponent moves only. Replies the opponent may play instead of `san`, keyed
   * by the alternative's SAN as chess.js prints it. Each value is the verified
   * continuation after that alternative, starting with the student's reply and
   * numbered on from the alternative's ply; the first move of a continuation
   * carries the alternative's `frequency`. Continuations may branch again.
   */
  alternatives?: Record<string, CurriculumMove[]>;
  /**
   * Observed count of a reply in the student's archive (or an authored weight).
   * On a scripted opponent move it weights the main reply against its
   * `alternatives`; on the first move of an alternative's continuation it
   * weights that alternative. Absent means no observation: weight 1.
   */
  frequency?: number;
}

export interface CurriculumExercise {
  id: string;
  title?: string;
  prompt: string;
  fen: string;
  turn?: 'w' | 'b';
  difficultyRating?: number; // 1 to 6
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

export interface CurriculumMistakeTrap {
  triggerFen: string;
  attemptedSan: string;
  isTrap: boolean;
  severity: 'blunder' | 'inaccuracy' | 'trap_victim';
  explanatoryFeedback: string;
  refutationSanList: string[];
  punishmentSummary: string;
}

/**
 * Base Curriculum Lesson contract matching PROJECT.md § 5
 */
export interface CurriculumLesson {
  id: string;
  title: string;
  subtitle?: string;
  category: 'opening' | 'trap' | 'weakness_drill' | 'fundamentals';
  sourceBook: string;
  author: string;
  publicationYear?: number;
  pagesRef?: string;
  eco?: string;
  initialFen: string;
  description?: string;
  thematicObjective?: string;
  keyTacticalMotif?: string;
  targetColor?: 'white' | 'black' | 'both';
  targetRatingBand?: 'beginner' | 'intermediate' | 'advanced';
  /**
   * Ply index (0-based into `moves`) where the interactive drill starts. The
   * moves before it are replayed automatically as the shared prefix.
   */
  startPly?: number;
  /**
   * 'core' lessons are on hoot65's actual repertoire and shown by default;
   * 'outside-repertoire' lessons are kept as a pattern library and hidden
   * from the default list.
   */
  relevance?: 'core' | 'outside-repertoire';
  moves: CurriculumMove[];
  exercises: CurriculumExercise[];
  commonMistakesAndTraps?: CurriculumMistakeTrap[];
}

/**
 * High-level Course grouping containing multiple chapters/lessons
 */
export interface ChessCurriculumCourse {
  id: string;
  title: string;
  subtitle: string;
  category:
    | 'white_repertoire'
    | 'anti_gambit'
    | 'black_repertoire'
    | 'opening_traps'
    | 'tactical_patterns'
    | 'beginner_fundamentals'
    | 'hoot65_drills';
  targetColor: 'white' | 'black' | 'both';
  targetRatingBand: 'beginner' | 'intermediate' | 'advanced';
  description: string;
  sourceAttribution: {
    bookTitle: string;
    author: string;
    publicationYear: number;
    /** Chapter or section names only; page numbers are not tracked. */
    pagesRef?: string;
  };
  lessons: CurriculumLesson[];
}

/**
 * Printable Worksheet Data matching PROJECT.md § 5
 */
export interface PrintableWorksheetData {
  id?: string;
  title: string;
  subtitle: string;
  type: 'curriculum_lesson' | 'hoot65_drill';
  sourceBook?: string;
  author?: string;
  eco?: string;
  targetColor?: 'white' | 'black' | 'both';
  diagramFen: string;
  coordinates: boolean;
  movesSan: string[];
  lessonSummary?: string;
  physicalBoardSteps?: string[];
  trapWarning?: {
    name: string;
    blunderSan: string;
    refutationSan: string;
    explanation: string;
  };
  exercises: Array<{
    prompt: string;
    diagramFen?: string;
    answer?: string;
    turn?: 'w' | 'b';
    fillInBlankLines?: string[];
  }>;
  answerKey: Array<{
    exerciseIndex: number;
    solutionSan: string;
    rationale: string;
    fullSequence?: string[];
  }>;
}

/**
 * Spaced Repetition Card State for lessons & tactical drills
 */
export interface SRSCardState {
  cardId: string; // matches lesson id or drill id
  repertoireId: string;
  title: string;
  fen: string;
  expectedMoveSan: string;
  box: number; // Leitner box tier (1 to 5)
  repetitionCount: number; // consecutive correct reviews
  intervalDays: number; // days until next review
  easeFactor: number; // default 2.5, min 1.3
  lastReviewTimestamp: number; // epoch ms
  nextReviewTimestamp: number; // epoch ms
  consecutiveMistakes: number;
  history?: Array<{
    timestamp: number;
    grade: number; // 0 to 5
    mistakeCount: number;
    usedHint: boolean;
    hintLevel?: number; // highest hint level used during the run (0 to 3)
  }>;
}
