import { ChessDatabase, db as defaultDb } from './database';
import { PgnHandler } from '../engine/pgn';
import type {
  StoredGame,
  GameFilter,
  BatchInsertResult,
  DatabaseExportData,
} from '../types/db';

/**
 * Normalizes a player name for matching and hashing
 */
function normalizeName(name: string): string {
  return (name || '').trim().toLowerCase();
}

/**
 * Computes a unique, deterministic deduplication key for a game
 */
export function computeDedupKey(game: {
  id?: string;
  url?: string;
  uuid?: string;
  white?: { name: string };
  black?: { name: string };
  date?: string;
  timestamp?: number;
  movesSan?: string[];
  pgn?: string;
}): string {
  // 1. Explicit ID if already prefixed
  if (game.id && (game.id.startsWith('chesscom:') || game.id.startsWith('pgn:') || game.id.startsWith('local:'))) {
    return game.id;
  }

  // 2. Chess.com UUID or live game URL
  if (game.uuid) {
    return `chesscom:${game.uuid}`;
  }
  if (game.url) {
    const parts = game.url.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      return `chesscom:${lastPart}`;
    }
  }

  // 3. Composite hash from players, date/timestamp, and move signature
  const whiteName = normalizeName(game.white?.name || 'unknown');
  const blackName = normalizeName(game.black?.name || 'unknown');
  const dateStr = game.date || (game.timestamp ? new Date(game.timestamp).toISOString().split('T')[0] : 'unknown');
  const movesSignature = (game.movesSan || []).slice(0, 15).join('-');

  if (movesSignature) {
    return `pgn:${whiteName}|${blackName}|${dateStr}|${movesSignature}`;
  }

  // Fallback: simple hash of raw PGN
  if (game.pgn) {
    let hash = 0;
    const clean = game.pgn.trim();
    for (let i = 0; i < clean.length; i++) {
      hash = ((hash << 5) - hash + clean.charCodeAt(i)) | 0;
    }
    return `pgn:${whiteName}|${blackName}|${dateStr}|${Math.abs(hash).toString(36)}`;
  }

  return `pgn:${whiteName}|${blackName}|${dateStr}|${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Derives time class from Chess.com or PGN headers
 */
export function deriveTimeClass(timeControl?: string, eventName?: string): string {
  if (timeControl) {
    // Chess.com format: e.g. "600" or "600+0" or "180+2"
    const match = timeControl.match(/^(\d+)/);
    if (match) {
      const baseSeconds = parseInt(match[1], 10);
      if (baseSeconds < 180) return 'bullet';
      if (baseSeconds < 600) return 'blitz';
      if (baseSeconds <= 3600) return 'rapid';
      return 'daily';
    }
    if (timeControl.includes('/')) return 'daily';
  }

  const ev = (eventName || '').toLowerCase();
  if (ev.includes('bullet')) return 'bullet';
  if (ev.includes('blitz')) return 'blitz';
  if (ev.includes('rapid')) return 'rapid';
  if (ev.includes('daily') || ev.includes('correspondence')) return 'daily';

  return 'rapid';
}

/**
 * Derives user outcome (win, loss, draw) from result and color
 */
export function deriveUserResult(
  result: string,
  userColor?: 'white' | 'black'
): 'win' | 'loss' | 'draw' | '*' {
  if (result === '1/2-1/2') return 'draw';
  if (!userColor || result === '*') return '*';

  if (userColor === 'white') {
    if (result === '1-0') return 'win';
    if (result === '0-1') return 'loss';
  } else {
    if (result === '0-1') return 'win';
    if (result === '1-0') return 'loss';
  }
  return '*';
}

export class GamesRepository {
  constructor(private db: ChessDatabase = defaultDb) {}

  /**
   * Insert a single game with deduplication check
   */
  async addGame(game: StoredGame): Promise<{ success: boolean; id: string; duplicate: boolean }> {
    const id = game.id || computeDedupKey(game);
    const existing = await this.db.games.get(id);

    if (existing) {
      return { success: false, id, duplicate: true };
    }

    const toStore: StoredGame = {
      ...game,
      id,
      dedupKey: id,
    };

    await this.db.games.put(toStore);
    return { success: true, id, duplicate: false };
  }

  /**
   * Batch insert games with deduplication reporting { added, duplicatesSkipped }
   */
  async batchAddGames(games: StoredGame[]): Promise<BatchInsertResult> {
    if (!games || games.length === 0) {
      return { added: 0, duplicatesSkipped: 0 };
    }

    // Normalize keys and drop intra-batch duplicates
    const uniqueBatchMap = new Map<string, StoredGame>();
    let intraBatchDuplicates = 0;

    for (const game of games) {
      const id = game.id || computeDedupKey(game);
      const normalized: StoredGame = {
        ...game,
        id,
        dedupKey: id,
      };

      if (uniqueBatchMap.has(id)) {
        intraBatchDuplicates++;
      } else {
        uniqueBatchMap.set(id, normalized);
      }
    }

    const candidateGames = Array.from(uniqueBatchMap.values());
    const candidateIds = candidateGames.map((g) => g.id);

    // Query existing keys in DB in chunks to avoid URL/query limits
    const CHUNK_SIZE = 500;
    const existingKeySet = new Set<string>();

    for (let i = 0; i < candidateIds.length; i += CHUNK_SIZE) {
      const chunk = candidateIds.slice(i, i + CHUNK_SIZE);
      const foundRecords = await this.db.games.where('id').anyOf(chunk).toArray();
      for (const rec of foundRecords) {
        existingKeySet.add(rec.id);
      }
    }

    const toInsert: StoredGame[] = [];
    let dbDuplicates = 0;

    for (const game of candidateGames) {
      if (existingKeySet.has(game.id)) {
        dbDuplicates++;
      } else {
        toInsert.push(game);
      }
    }

    if (toInsert.length > 0) {
      await this.db.games.bulkPut(toInsert);
    }

    return {
      added: toInsert.length,
      duplicatesSkipped: dbDuplicates + intraBatchDuplicates,
    };
  }

  /**
   * Retrieve game by ID
   */
  async getGame(id: string): Promise<StoredGame | undefined> {
    return this.db.games.get(id);
  }

  /**
   * Retrieve all games ordered by timestamp descending
   */
  async getAllGames(): Promise<StoredGame[]> {
    return this.db.games.orderBy('timestamp').reverse().toArray();
  }

  /**
   * Total count of games stored
   */
  async getGamesCount(): Promise<number> {
    return this.db.games.count();
  }

  /**
   * Delete game by ID
   */
  async deleteGame(id: string): Promise<void> {
    await this.db.games.delete(id);
  }

  /**
   * Delete all games in DB
   */
  async clearAllGames(): Promise<void> {
    await this.db.games.clear();
  }

  /**
   * Search and filter stored games
   */
  async filterGames(filter: GameFilter): Promise<StoredGame[]> {
    let all = await this.getAllGames();

    if (filter.color && filter.color !== 'all') {
      all = all.filter((g) => g.userColor === filter.color);
    }

    if (filter.result && filter.result !== 'all') {
      all = all.filter((g) => g.userResult === filter.result);
    }

    if (filter.timeClass && filter.timeClass !== 'all') {
      all = all.filter((g) => (g.timeClass || '').toLowerCase() === filter.timeClass?.toLowerCase());
    }

    if (filter.startDate) {
      all = all.filter((g) => g.timestamp >= filter.startDate!);
    }

    if (filter.endDate) {
      all = all.filter((g) => g.timestamp <= filter.endDate!);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      all = all.filter((g) => {
        const white = (g.white?.name || '').toLowerCase();
        const black = (g.black?.name || '').toLowerCase();
        const eco = (g.eco || '').toLowerCase();
        const opening = (g.openingName || '').toLowerCase();
        return white.includes(q) || black.includes(q) || eco.includes(q) || opening.includes(q);
      });
    }

    return all;
  }

  /**
   * Seed database if empty
   */
  async seedIfEmpty(seedGames: StoredGame[]): Promise<{ seeded: boolean; count: number }> {
    const currentCount = await this.getGamesCount();
    if (currentCount === 0 && seedGames && seedGames.length > 0) {
      const res = await this.batchAddGames(seedGames);
      return { seeded: true, count: res.added };
    }
    return { seeded: false, count: currentCount };
  }

  /**
   * Export all games to standard PGN multi-game string
   */
  async exportGamesPgn(games?: StoredGame[]): Promise<string> {
    const list = games || (await this.getAllGames());
    return list.map((g) => g.pgn.trim()).join('\n\n') + (list.length > 0 ? '\n' : '');
  }

  /**
   * Export entire database to JSON backup
   */
  async exportDatabaseJson(): Promise<DatabaseExportData> {
    const games = await this.getAllGames();
    const repertoires = await this.db.repertoires.toArray();
    const srsCards = await this.db.srs_cards.toArray();
    const diagnostics = await this.db.diagnostics.toArray();

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      games,
      repertoires,
      srsCards,
      diagnostics,
    };
  }

  /**
   * Import database from JSON backup with validation
   */
  async importDatabaseJson(
    dataOrJson: string | DatabaseExportData
  ): Promise<{ gamesAdded: number; gamesSkipped: number; version: number }> {
    let parsed: DatabaseExportData;
    if (typeof dataOrJson === 'string') {
      try {
        parsed = JSON.parse(dataOrJson);
      } catch (err: any) {
        throw new Error(`Invalid JSON format: ${err?.message || err}`);
      }
    } else {
      parsed = dataOrJson;
    }

    if (!parsed || !Array.isArray(parsed.games)) {
      throw new Error('Invalid database backup: missing "games" array.');
    }

    const result = await this.batchAddGames(parsed.games);

    if (Array.isArray(parsed.repertoires) && parsed.repertoires.length > 0) {
      await this.db.repertoires.bulkPut(parsed.repertoires);
    }
    if (Array.isArray(parsed.srsCards) && parsed.srsCards.length > 0) {
      await this.db.srs_cards.bulkPut(parsed.srsCards);
    }
    if (Array.isArray(parsed.diagnostics) && parsed.diagnostics.length > 0) {
      await this.db.diagnostics.bulkPut(parsed.diagnostics);
    }

    return {
      gamesAdded: result.added,
      gamesSkipped: result.duplicatesSkipped,
      version: parsed.version || 1,
    };
  }

  /**
   * Import games from raw multi-game PGN text
   */
  async importPgnText(
    pgnText: string,
    defaultPlayer = 'hoot65'
  ): Promise<BatchInsertResult> {
    const rawChunks = PgnHandler.splitMultiGamePgn(pgnText);
    const storedGames: StoredGame[] = [];

    for (const chunk of rawChunks) {
      if (!chunk.trim()) continue;
      const parsed = PgnHandler.parsePgn(chunk);

      const whiteName = parsed.headers.White || 'White';
      const blackName = parsed.headers.Black || 'Black';
      const whiteElo = parsed.headers.WhiteElo ? parseInt(parsed.headers.WhiteElo, 10) : undefined;
      const blackElo = parsed.headers.BlackElo ? parseInt(parsed.headers.BlackElo, 10) : undefined;

      const normDefault = defaultPlayer.toLowerCase();
      let userColor: 'white' | 'black' | undefined = undefined;
      if (whiteName.toLowerCase() === normDefault) userColor = 'white';
      else if (blackName.toLowerCase() === normDefault) userColor = 'black';

      // Parse date
      let timestamp = Date.now();
      if (parsed.headers.Date) {
        const dateParts = parsed.headers.Date.replace(/\./g, '-');
        const parsedTime = Date.parse(dateParts);
        if (!isNaN(parsedTime)) {
          timestamp = parsedTime;
        }
      }

      const timeClass = deriveTimeClass(parsed.headers.TimeControl, parsed.headers.Event);
      const userResult = deriveUserResult(parsed.result, userColor);

      const id = computeDedupKey({
        white: { name: whiteName },
        black: { name: blackName },
        date: parsed.headers.Date,
        timestamp,
        movesSan: parsed.movesSan,
        pgn: chunk,
      });

      storedGames.push({
        id,
        dedupKey: id,
        source: 'upload',
        pgn: chunk,
        white: { name: whiteName, rating: isNaN(whiteElo!) ? undefined : whiteElo },
        black: { name: blackName, rating: isNaN(blackElo!) ? undefined : blackElo },
        result: (parsed.result as any) || '*',
        eco: parsed.headers.ECO,
        openingName: parsed.headers.Opening || parsed.headers.Event,
        timestamp,
        timeClass,
        movesSan: parsed.movesSan,
        userColor,
        userResult,
      });
    }

    return this.batchAddGames(storedGames);
  }
}

export const gamesRepo = new GamesRepository();
