import { PgnHandler } from '../engine/pgn';
import { gamesRepo, GamesRepository, deriveTimeClass } from '../db/gamesRepo';
import type { StoredGame, SyncResult } from '../types/db';

export interface ChessComPlayerInfo {
  rating?: number;
  result: string;
  '@id'?: string;
  username: string;
  uuid?: string;
}

export interface ChessComRawGame {
  url: string;
  pgn?: string;
  time_control?: string;
  end_time?: number;
  rated?: boolean;
  fen?: string;
  time_class?: string;
  rules?: string;
  white: ChessComPlayerInfo;
  black: ChessComPlayerInfo;
  eco?: string;
  uuid?: string;
}

export interface SyncProgress {
  phase: 'fetching_archives' | 'syncing_month' | 'complete' | 'error';
  currentArchiveIndex: number;
  totalArchives: number;
  currentArchiveName: string;
  gamesAdded: number;
  duplicatesSkipped: number;
  message: string;
}

export interface SyncOptions {
  username?: string;
  repo?: GamesRepository;
  maxArchives?: number;
  sinceDate?: string; // e.g. "2026/01"
  onProgress?: (progress: SyncProgress) => void;
}

/**
 * Extracts opening name from ECO URL or slug
 */
function extractOpeningName(ecoUrl?: string): string | undefined {
  if (!ecoUrl) return undefined;
  const match = ecoUrl.match(/\/openings\/([^/?#]+)/);
  if (match && match[1]) {
    return match[1].replace(/-/g, ' ');
  }
  return undefined;
}

/**
 * Parses a Chess.com game into a StoredGame record
 */
export function parseChessComGame(
  raw: ChessComRawGame,
  defaultPlayer = 'hoot65'
): StoredGame {
  const normUser = defaultPlayer.toLowerCase();
  const whiteName = raw.white?.username || 'White';
  const blackName = raw.black?.username || 'Black';

  let userColor: 'white' | 'black' | undefined = undefined;
  if (whiteName.toLowerCase() === normUser) {
    userColor = 'white';
  } else if (blackName.toLowerCase() === normUser) {
    userColor = 'black';
  }

  // Parse PGN if available
  const pgn = raw.pgn || '';
  let movesSan: string[] = [];
  let eco = raw.eco;
  let openingName: string | undefined = undefined;
  let pgnResult: string = '*';

  if (pgn) {
    const parsed = PgnHandler.parsePgn(pgn);
    movesSan = parsed.movesSan;
    if (parsed.headers.ECO) {
      eco = parsed.headers.ECO;
    }
    if (parsed.headers.ECOUrl) {
      openingName = extractOpeningName(parsed.headers.ECOUrl);
    } else if (parsed.headers.Opening) {
      openingName = parsed.headers.Opening;
    }
    pgnResult = parsed.result;
  }

  if (!openingName && raw.eco) {
    openingName = extractOpeningName(raw.eco);
  }

  // Standard Result ('1-0' | '0-1' | '1/2-1/2' | '*')
  let result: '1-0' | '0-1' | '1/2-1/2' | '*' = '*';
  if (['1-0', '0-1', '1/2-1/2', '*'].includes(pgnResult)) {
    result = pgnResult as any;
  } else if (raw.white?.result === 'win') {
    result = '1-0';
  } else if (raw.black?.result === 'win') {
    result = '0-1';
  } else if (
    ['agreed', 'repetition', 'stalemate', 'timevsinsufficient', 'insufficient', '50move'].includes(
      raw.white?.result || ''
    )
  ) {
    result = '1/2-1/2';
  }

  // User Result
  let userResult: 'win' | 'loss' | 'draw' | '*' = '*';
  if (userColor === 'white') {
    if (raw.white?.result === 'win') userResult = 'win';
    else if (
      ['agreed', 'repetition', 'stalemate', 'timevsinsufficient', 'insufficient', '50move'].includes(
        raw.white?.result || ''
      )
    )
      userResult = 'draw';
    else userResult = 'loss';
  } else if (userColor === 'black') {
    if (raw.black?.result === 'win') userResult = 'win';
    else if (
      ['agreed', 'repetition', 'stalemate', 'timevsinsufficient', 'insufficient', '50move'].includes(
        raw.black?.result || ''
      )
    )
      userResult = 'draw';
    else userResult = 'loss';
  }

  const timestamp = raw.end_time ? raw.end_time * 1000 : Date.now();
  const timeClass = raw.time_class || deriveTimeClass(raw.time_control);

  // Clean ID: use UUID if available, else game URL last token
  let cleanId = raw.uuid;
  if (!cleanId && raw.url) {
    const parts = raw.url.split('/').filter(Boolean);
    cleanId = parts[parts.length - 1];
  }
  const id = `chesscom:${cleanId || Math.random().toString(36).substring(2, 10)}`;

  return {
    id,
    dedupKey: id,
    source: 'chesscom',
    url: raw.url,
    pgn,
    white: {
      name: whiteName,
      rating: raw.white?.rating,
    },
    black: {
      name: blackName,
      rating: raw.black?.rating,
    },
    result,
    eco,
    openingName,
    timestamp,
    timeClass,
    movesSan,
    userColor,
    userResult,
  };
}

/**
 * Fetch all monthly archive URLs for a player from Chess.com Published-Data API
 * CRITICAL: Simple GET request with NO custom headers to avoid CORS OPTIONS preflight
 */
export async function fetchArchives(username = 'hoot65'): Promise<string[]> {
  const url = `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`;
  const response = await fetch(url, {
    method: 'GET',
    // NO custom headers here to prevent Cloudflare 403 preflight
  });

  if (!response.ok) {
    throw new Error(
      `Chess.com archive fetch failed: HTTP ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return Array.isArray(data.archives) ? data.archives : [];
}

/**
 * Fetch games for a single monthly archive
 */
export async function fetchMonthGames(archiveUrl: string): Promise<ChessComRawGame[]> {
  const response = await fetch(archiveUrl, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(
      `Chess.com month games fetch failed: HTTP ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return Array.isArray(data.games) ? data.games : [];
}

/**
 * Synchronize games from Chess.com archives into IndexedDB
 */
export async function syncPlayerGames(options: SyncOptions = {}): Promise<SyncResult> {
  const username = options.username || 'hoot65';
  const repo = options.repo || gamesRepo;
  const onProgress = options.onProgress || (() => {});

  onProgress({
    phase: 'fetching_archives',
    currentArchiveIndex: 0,
    totalArchives: 0,
    currentArchiveName: '',
    gamesAdded: 0,
    duplicatesSkipped: 0,
    message: `Fetching archive list for ${username}...`,
  });

  let archives: string[] = [];
  try {
    archives = await fetchArchives(username);
  } catch (err: any) {
    onProgress({
      phase: 'error',
      currentArchiveIndex: 0,
      totalArchives: 0,
      currentArchiveName: '',
      gamesAdded: 0,
      duplicatesSkipped: 0,
      message: `Failed to fetch archives: ${err?.message || err}`,
    });
    throw err;
  }

  // Filter archives by sinceDate if specified
  if (options.sinceDate) {
    const minPattern = options.sinceDate.replace('-', '/');
    archives = archives.filter((url) => {
      const match = url.match(/(\d{4}\/\d{2})$/);
      return match ? match[1] >= minPattern : true;
    });
  }

  // If maxArchives specified, take the most recent N
  if (options.maxArchives && options.maxArchives > 0 && archives.length > options.maxArchives) {
    archives = archives.slice(archives.length - options.maxArchives);
  }

  // Process from most recent archive to older
  const reversedArchives = [...archives].reverse();
  let totalAdded = 0;
  let totalDuplicates = 0;
  let latestGameDate: string | undefined = undefined;

  for (let i = 0; i < reversedArchives.length; i++) {
    const archiveUrl = reversedArchives[i];
    const match = archiveUrl.match(/(\d{4}\/\d{2})$/);
    const archiveName = match ? match[1] : archiveUrl;

    onProgress({
      phase: 'syncing_month',
      currentArchiveIndex: i + 1,
      totalArchives: reversedArchives.length,
      currentArchiveName: archiveName,
      gamesAdded: totalAdded,
      duplicatesSkipped: totalDuplicates,
      message: `Syncing ${archiveName} (${i + 1}/${reversedArchives.length})...`,
    });

    try {
      const rawGames = await fetchMonthGames(archiveUrl);
      if (rawGames.length > 0) {
        const storedGames = rawGames.map((g) => parseChessComGame(g, username));
        if (!latestGameDate && storedGames[0]) {
          latestGameDate = new Date(storedGames[0].timestamp).toISOString().split('T')[0];
        }

        const batchRes = await repo.batchAddGames(storedGames);
        totalAdded += batchRes.added;
        totalDuplicates += batchRes.duplicatesSkipped;
      }
    } catch (err: any) {
      console.warn(`Error syncing archive ${archiveUrl}:`, err);
    }
  }

  const finalResult: SyncResult = {
    totalArchives: archives.length,
    syncedArchives: reversedArchives.length,
    gamesAdded: totalAdded,
    duplicatesSkipped: totalDuplicates,
    latestGameDate,
  };

  onProgress({
    phase: 'complete',
    currentArchiveIndex: reversedArchives.length,
    totalArchives: reversedArchives.length,
    currentArchiveName: '',
    gamesAdded: totalAdded,
    duplicatesSkipped: totalDuplicates,
    message: `Sync complete! Added ${totalAdded} new games, ${totalDuplicates} duplicates skipped.`,
  });

  return finalResult;
}
