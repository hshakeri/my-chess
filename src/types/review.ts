/** Post-game review (CL-3): the moments of one game where hoot65's expected score fell, and why. */

export type MistakeType =
  | 'allowed_mate'
  | 'missed_mate'
  | 'failed_to_save'
  | 'moved_piece_hangs'
  | 'left_piece_hangs'
  | 'missed_capture'
  | 'tactical_other'
  | 'positional';

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

export interface CriticalMoment {
  /** Index of the move in the game's move list (ply 0 is White's first move). */
  ply: number;
  /** The move as it is printed: "23...Qxb2". */
  label: string;
  fenBefore: string;
  played: string;
  /** hoot65's expected score before and after the move (0 to 1, a draw counting half), from Maia. */
  expectedBefore?: number;
  expectedAfter?: number;
  /** How often Maia expects a player of hoot65's rating to play this move in this position. */
  playedShare?: number;
  /** The move Maia expects most often from a player of hoot65's rating. */
  maiaBest?: string;
  type: MistakeType;
  /** Material given up against the best move, in centipawns (0 for mates and positional mistakes). */
  loss: number;
  /** Moves that avoid the mistake (keep the material, allow no mate in one), best first. */
  keeping: string[];
  /** The opponent's reply that wins the material or mates. */
  refutation?: string;
  /** The capture or mate that was missed. */
  missed?: string;
  /** Squares of the pieces the move left in danger. */
  squares: string[];
  /** Seconds on hoot65's clock before the move, and seconds spent on it. */
  clockLeft?: number;
  spent?: number;
  phase: GamePhase;
}

/** A move the student marked as a mistake before seeing the engine, with the reason in one line. */
export interface StudentMark {
  ply: number;
  reason: string;
}

export interface GameReview {
  gameId: string;
  reviewedAt: number;
  /** 'maia': moments are the moves that cost at least 15 points of expected score; 'material': Maia was not available and only material mistakes are found. */
  engine: 'maia' | 'material';
  userColor: 'white' | 'black';
  /** hoot65's moves scored in the review. */
  movesReviewed: number;
  criticalMoments: CriticalMoment[];
  /** The student's own marks, made before the engine's moments were shown. */
  marks: StudentMark[];
  /** The one reason the student gives for the result, after the reveal. */
  lossCause?: string;
  /** Review cards made from the moments (canonical FEN keys). */
  cardIds: string[];
}
