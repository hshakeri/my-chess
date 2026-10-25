import Dexie, { type Table, type DexieOptions } from 'dexie';
import type {
  StoredGame,
  StoredRepertoire,
  StoredSrsCard,
  StoredDiagnostic,
} from '../types/db';

/**
 * Dexie-based persistent IndexedDB database for my-chess
 * Meets PROJECT.md § 3. Database & Sync Contract
 */
export class ChessDatabase extends Dexie {
  games!: Table<StoredGame, string>;
  repertoires!: Table<StoredRepertoire, string>;
  srs_cards!: Table<StoredSrsCard, string>;
  diagnostics!: Table<StoredDiagnostic, string>;

  constructor(dbName = 'MyChessDB', options?: DexieOptions) {
    super(dbName, options);

    this.version(1).stores({
      games:
        '&id, dedupKey, source, timestamp, userColor, userResult, timeClass, eco, openingName, [userColor+userResult]',
      repertoires: '&id, color, name, updatedAt',
      srs_cards: '&id, repertoireId, dueDate, box, interval',
      diagnostics: '&id, timestamp, playerHandle',
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
