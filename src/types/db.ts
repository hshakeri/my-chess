/**
 * Database & Sync TypeScript Interfaces
 * Conforms to PROJECT.md § 3. Database & Sync Contract
 */

export interface StoredGame {
  id: string; // dedupKey
  dedupKey?: string; // Explicit dedupKey matching id
  source: 'chesscom' | 'upload' | 'local_play';
  url?: string;
  pgn: string;
  white: { name: string; rating?: number };
  black: { name: string; rating?: number };
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  eco?: string;
  openingName?: string;
  timestamp: number; // Unix timestamp in ms
  timeClass?: string; // 'rapid' | 'blitz' | 'bullet' | 'daily', etc.
  movesSan: string[];
  userColor?: 'white' | 'black';
  userResult?: 'win' | 'loss' | 'draw' | '*';
}

export interface SyncResult {
  totalArchives: number;
  syncedArchives: number;
  gamesAdded: number;
  duplicatesSkipped: number;
  latestGameDate?: string;
}

export interface BatchInsertResult {
  added: number;
  duplicatesSkipped: number;
}

export interface GameFilter {
  color?: 'all' | 'white' | 'black';
  result?: 'all' | 'win' | 'loss' | 'draw';
  timeClass?: 'all' | 'rapid' | 'blitz' | 'bullet' | 'daily';
  search?: string; // Substring search on opponent name, ECO, or opening name
  startDate?: number;
  endDate?: number;
}

export interface StoredRepertoire {
  id: string;
  color: 'white' | 'black';
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  moves: any; // Tree or array of moves
}

export interface StoredSrsCard {
  id: string;
  repertoireId: string;
  fen: string;
  expectedMoveSan: string;
  dueDate: number;
  interval: number;
  easeFactor: number;
  repetitions: number;
  box: number;
  lastReviewed?: number;
}

export interface StoredDiagnostic {
  id: string;
  timestamp: number;
  playerHandle: string;
  totalGamesAnalyzed: number;
  whiteStats: any;
  blackStats: any;
  recommendedWhiteRepertoire: string;
  recommendedBlackRepertoire: string;
}

export interface DatabaseExportData {
  version: number;
  exportedAt: string;
  games: StoredGame[];
  repertoires?: StoredRepertoire[];
  srsCards?: StoredSrsCard[];
  diagnostics?: StoredDiagnostic[];
}
