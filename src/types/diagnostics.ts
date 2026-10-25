/**
 * Diagnostics & Repertoire TypeScript Interfaces
 * Conforms to PROJECT.md § 4. Diagnostics & Repertoire Contract
 */

export interface OpeningDeviation {
  gameId: string;
  gameUrl: string;
  opponent: string;
  playedColor: 'white' | 'black';
  ply: number;
  fen: string;
  playedSan: string;
  bookSan: string;
  evaluationDelta: string;
  description: string;
}

export interface OpeningStats {
  eco: string;
  openingName: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
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
