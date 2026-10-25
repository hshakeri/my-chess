/**
 * Diagnostics & Repertoire TypeScript Interfaces
 * Conforms to PROJECT.md § 4. Diagnostics & Repertoire Contract
 */

/**
 * Measured impact of a recurring pattern on the player's own results.
 * Scores count a draw as half a point. `gamesWithout` are the player's other
 * games of the same colour(s) the pattern applies to.
 */
export interface PatternImpact {
  gamesWith: number;
  scoreWith: number; // 0..1
  gamesWithout: number;
  scoreWithout: number; // 0..1
}

export interface OpeningDeviation {
  gameId: string;
  gameUrl: string;
  opponent: string;
  playedColor: 'white' | 'black';
  ply: number;
  fen: string;
  playedSan: string;
  /**
   * A legal, verified better move in `fen`, when the repertoire or a rule gives
   * one. Omitted when the honest answer is a plan rather than a single move.
   */
  bookSan?: string;
  /**
   * Human-readable score impact of the pattern this deviation belongs to,
   * e.g. "-5.1 pts" (score points with the pattern minus score points without).
   */
  evaluationDelta: string;
  description: string;
  patternId?: string;
  impact?: PatternImpact;
  /** Date of the game as YYYY-MM-DD, taken from the PGN header when available. */
  gameDate?: string;
}

export interface PatternSummary {
  id: string;
  label: string;
  color: 'white' | 'black' | 'both';
  description: string;
  /**
   * 'inferior': opening theory calls the habit a mistake regardless of results;
   * 'neutral': theory-approved in some lines, so it counts as a leak only when the
   * measured impact in the player's own games is negative.
   */
  theoryVerdict: 'inferior' | 'neutral';
  /** True when the pattern is listed among the player's key leaks. */
  isLeak: boolean;
  impact: PatternImpact;
  deviations: OpeningDeviation[];
}

export interface OpeningStats {
  eco: string;
  openingName: string;
  /** The first plies that define this group, e.g. "e4 e5 Nf3 Nc6 Bc4 h6". */
  lineSan?: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  /** Score rate: (wins + draws/2) / totalGames. Draws count half. */
  winRate: number;
}

export interface ColorDiagnosticStats {
  winRate: number;
  keyLeaks: OpeningDeviation[];
  totalGames?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  openings?: OpeningStats[];
}

export interface DiagnosticReport {
  playerHandle: 'hoot65';
  totalGamesAnalyzed: number;
  whiteStats: {
    winRate: number;
    keyLeaks: OpeningDeviation[];
    totalGames?: number;
    wins?: number;
    losses?: number;
    draws?: number;
    openings?: OpeningStats[];
  };
  blackStats: {
    winRate: number;
    keyLeaks: OpeningDeviation[];
    totalGames?: number;
    wins?: number;
    losses?: number;
    draws?: number;
    openings?: OpeningStats[];
  };
  /** Recurring patterns with measured impact; keyLeaks above are the flattened deviations. */
  patterns?: PatternSummary[];
  recommendedWhiteRepertoire: string; // e.g. "Italian Game & Anti-Scandinavian (2.exd5!)"
  recommendedBlackRepertoire: string; // e.g. "Caro-Kann & King's Indian"
  whiteRepertoirePlan?: RepertoirePlan;
  blackRepertoirePlan?: RepertoirePlan;
  generatedAt?: number;
}

export interface RepertoireMove {
  ply: number;
  san: string;
  fen: string;
  commentary?: string;
  annotation?: string; // e.g. "!", "!?", "?!"
  tacticalMotif?: string;
  sourceBook?: string;
  isKeyMove?: boolean;
  children?: RepertoireMove[];
}

export interface RepertoireLine {
  id: string;
  name: string;
  eco: string;
  movesSan: string[];
  description: string;
  keyIdeas: string[];
  moves: RepertoireMove[];
  pgn: string;
}

export interface RepertoirePlan {
  id: string;
  color: 'white' | 'black';
  name: string;
  description: string;
  targetOpponentResponses: string[];
  keyThemes: string[];
  rootFen: string;
  lines: RepertoireLine[];
  pgn: string;
  sourceReferences: string[];
}
