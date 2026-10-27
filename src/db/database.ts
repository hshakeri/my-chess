import Dexie, { type Table, type DexieOptions } from 'dexie';
import type {
  StoredGame,
  StoredRepertoire,
  StoredSrsCard,
  StoredDiagnostic,
  StoredCard,
  StoredRevlog,
  StoredReview,
  StoredExplorerCache,
} from '../types/db';

/**
 * Dexie-based persistent IndexedDB database for my-chess
 * Meets PROJECT.md § 3. Database & Sync Contract
 *
 * Schema history
 * - version 1: games, repertoires, srs_cards (legacy SM-2), diagnostics
 * - version 2: adds cards + revlog (FSRS position cards, CL-1), reviews
 *   (post-game review, CL-3) and explorer_cache (DC-6). The legacy
 *   `srs_cards` table stays readable for the one-shot migration and is
 *   dropped in a later version(3).
 */
export class ChessDatabase extends Dexie {
  games!: Table<StoredGame, string>;
  repertoires!: Table<StoredRepertoire, string>;
  srs_cards!: Table<StoredSrsCard, string>;
  diagnostics!: Table<StoredDiagnostic, string>;
  cards!: Table<StoredCard, string>;
  revlog!: Table<StoredRevlog, number>;
  reviews!: Table<StoredReview, string>;
  explorer_cache!: Table<StoredExplorerCache, string>;

  constructor(dbName = 'MyChessDB', options?: DexieOptions) {
    super(dbName, options);

    this.version(1).stores({
      games:
        '&id, dedupKey, source, timestamp, userColor, userResult, timeClass, eco, openingName, [userColor+userResult]',
      repertoires: '&id, color, name, updatedAt',
      srs_cards: '&id, repertoireId, dueDate, box, interval',
      diagnostics: '&id, timestamp, playerHandle',
    });

    // Version 2 only adds tables. Dexie carries every version-1 store forward
    // unchanged, so the upgrade needs no data migration and is idempotent.
    this.version(2).stores({
      cards: '&id, due, state, *tags, *lessonIds',
      revlog: '++id, cardId, review, lessonId, sessionId',
      reviews: '&gameId, reviewedAt',
      explorer_cache: '&key, fetchedAt',
    });
  }
}

/**
 * Factory for creating custom or isolated database instances (e.g. for testing)
 */
export function createChessDatabase(
  dbName = 'MyChessDB',
  options?: DexieOptions
): ChessDatabase {
  return new ChessDatabase(dbName, options);
}

/**
 * Application default singleton database instance
 */
export const db = createChessDatabase();
