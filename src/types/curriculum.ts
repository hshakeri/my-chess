/**
 * Curriculum & Printable Worksheets TypeScript Interfaces
 * Conforms to PROJECT.md § 5. Curriculum & Printable Worksheets Contract
 * and Explorer 3's surveyed curriculum data models.
 */

export interface CurriculumMove {
  ply: number;
  san: string;
  uci?: string;
  fenAfter?: string;
  annotation?: string;
  isUserMove: boolean;
  wrongMoveFeedback?: Record<string, string>; // SAN -> explanation
  arrows?: Array<{ from: string; to: string; color?: 'green' | 'red' | 'yellow' | 'blue' }>;
  highlights?: Array<{ square: string; color?: 'green' | 'red' | 'yellow' }>;
  hintPiece?: string; // e.g. "White Queen"
  hintSquare?: string; // e.g. "d5"
  hintTheme?: string; // e.g. "Double attack against f7 and c6"
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
  category: 'white_repertoire' | 'black_repertoire' | 'opening_traps' | 'tactical_patterns' | 'beginner_fundamentals' | 'hoot65_drills';
  targetColor: 'white' | 'black' | 'both';
  targetRatingBand: 'beginner' | 'intermediate' | 'advanced';
  description: string;
  sourceAttribution: {
    bookTitle: string;
    author: string;
    publicationYear: number;
    pagesRef: string;
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
  }>;
}
