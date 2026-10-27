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

/**
 * One position card for the FSRS scheduler (CL-1).
 * `id` is the canonical FEN key from `services/fenKey.ts`, so a position
 * reached from several lessons or move orders is one card.
 * Scheduling fields are the ts-fsrs `Card` flattened to JSON-safe numbers
 * (`due` and `last_review` are epoch milliseconds, `state` is the ts-fsrs
 * `State` enum value: 0 New, 1 Learning, 2 Review, 3 Relearning).
 */
export interface StoredCard {
  id: string;
  fen: string;
  accepted: string[];
  lessonIds: string[];
  tags: string[];
  ply: number;
  reachProb: number;
  color: 'w' | 'b';
  title?: string;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: number;
  responseStats: { n: number; meanMs: number };
  createdAt: number;
}

/**
 * One review of a card. The FSRS fields mirror the ts-fsrs `ReviewLog`
 * (state and due are the values BEFORE the review; `rating` is the ts-fsrs
 * `Rating` enum value: 1 Again, 2 Hard, 3 Good, 4 Easy). `id` is assigned by
 * Dexie (`++id`).
 */
export interface StoredRevlog {
  id?: number;
  cardId: string;
  rating: number;
  state: number;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  review: number;
  responseMs?: number;
  hintLevel?: number;
  wrongSan?: string;
  lessonId?: string;
  sessionId?: string;
}

/** Placeholder for the post-game review pipeline (CL-3). */
export interface StoredReview {
  gameId: string;
  reviewedAt: number;
  criticalMoments: unknown[];
}

/** Placeholder for the opening-explorer snapshot cache (DC-6). */
export interface StoredExplorerCache {
  key: string;
  fetchedAt: number;
  payload: unknown;
}

/**
 * JSON backup format.
 * - version 1: games, repertoires, srsCards, diagnostics
 * - version 2: adds `cards` and `revlog`. Version-1 files import unchanged.
 */
export interface DatabaseExportData {
  version: number;
  exportedAt: string;
  games: StoredGame[];
  repertoires?: StoredRepertoire[];
  srsCards?: StoredSrsCard[];
  diagnostics?: StoredDiagnostic[];
  cards?: StoredCard[];
  revlog?: StoredRevlog[];
}

export const DATABASE_EXPORT_VERSION = 2;
