import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import {
  fetchArchives,
  fetchMonthGames,
  parseChessComGame,
  syncPlayerGames,
  type ChessComRawGame,
  type SyncProgress,
} from '../../../src/services/chesscom';
import { ChessDatabase } from '../../../src/db/database';
import { GamesRepository } from '../../../src/db/gamesRepo';

describe('Chess.com API Service & Sync', () => {
  let testDb: ChessDatabase;
  let repo: GamesRepository;

  beforeEach(() => {
    const dbName = `test_chesscom_${Math.random().toString(36).substring(2, 9)}`;
    testDb = new ChessDatabase(dbName, { indexedDB, IDBKeyRange });
    repo = new GamesRepository(testDb);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await testDb.delete();
  });

  const mockRawGameWhiteWin: ChessComRawGame = {
    url: 'https://www.chess.com/game/live/185894059676',
    uuid: 'e17861a6-d006-11f1-b280-1bd5c501000f',
    pgn: '[Event "Live Chess"]\n[White "hoot65"]\n[Black "abhinavghadage"]\n[Result "1-0"]\n[ECO "C55"]\n[ECOUrl "https://www.chess.com/openings/Scotch-Game-Dubois-Reti-Max-Lange-Attack"]\n[WhiteElo "1121"]\n[BlackElo "1087"]\n[TimeControl "600"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 exd4 1-0',
    time_control: '600',
    time_class: 'rapid',
    end_time: 1792887246,
    rated: true,
    white: {
      username: 'hoot65',
      rating: 1121,
      result: 'win',
    },
    black: {
      username: 'abhinavghadage',
      rating: 1087,
      result: 'resigned',
    },
    eco: 'https://www.chess.com/openings/Scotch-Game-Dubois-Reti-Max-Lange-Attack',
  };

  const mockRawGameBlackLoss: ChessComRawGame = {
    url: 'https://www.chess.com/game/live/185282462950',
    uuid: '8cb45aa2-cfc6-11f1-8663-2c213b01000f',
    pgn: '[Event "Live Chess"]\n[White "OpponentKing"]\n[Black "hoot65"]\n[Result "1-0"]\n[ECO "B12"]\n[ECOUrl "https://www.chess.com/openings/Caro-Kann-Defense-Advance-Variation"]\n\n1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 Bg4 1-0',
    time_control: '180+2',
    time_class: 'blitz',
    end_time: 1792859433,
    white: {
      username: 'OpponentKing',
      rating: 1185,
      result: 'win',
    },
    black: {
      username: 'hoot65',
      rating: 1115,
      result: 'checkmated',
    },
  };

  const mockRawGameDraw: ChessComRawGame = {
    url: 'https://www.chess.com/game/live/185000000000',
    uuid: '11111111-2222-3333-4444-555555555555',
    pgn: '[Event "Live Chess"]\n[White "hoot65"]\n[Black "Friend"]\n[Result "1/2-1/2"]\n\n1. e4 e5 2. Nf3 Nc6 1/2-1/2',
    time_control: '600',
    time_class: 'rapid',
    end_time: 1792800000,
    white: {
      username: 'hoot65',
      rating: 1120,
      result: 'repetition',
    },
    black: {
      username: 'Friend',
      rating: 1125,
      result: 'repetition',
    },
  };

  describe('fetchArchives', () => {
    it('fetches archive list with simple GET request and parses response', async () => {
      const mockArchives = [
        'https://api.chess.com/pub/player/hoot65/games/2026/08',
        'https://api.chess.com/pub/player/hoot65/games/2026/09',
        'https://api.chess.com/pub/player/hoot65/games/2026/10',
      ];

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ archives: mockArchives }),
      } as Response);

      const result = await fetchArchives('hoot65');
      expect(result).toEqual(mockArchives);

      // Verify NO custom headers were attached to avoid CORS preflight
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.chess.com/pub/player/hoot65/games/archives',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('throws descriptive error on HTTP failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(fetchArchives('nonexistent_user_xyz')).rejects.toThrow(
        /Chess.com archive fetch failed: HTTP 404/
      );
    });
  });

  describe('fetchMonthGames', () => {
    it('fetches month games correctly', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ games: [mockRawGameWhiteWin] }),
      } as Response);

      const games = await fetchMonthGames(
        'https://api.chess.com/pub/player/hoot65/games/2026/10'
      );
      expect(games.length).toBe(1);
      expect(games[0].uuid).toBe(mockRawGameWhiteWin.uuid);
    });
  });

  describe('parseChessComGame', () => {
    it('correctly parses game when hoot65 plays White and wins', () => {
      const stored = parseChessComGame(mockRawGameWhiteWin, 'hoot65');

      expect(stored.id).toBe(`chesscom:${mockRawGameWhiteWin.uuid}`);
      expect(stored.source).toBe('chesscom');
      expect(stored.userColor).toBe('white');
      expect(stored.userResult).toBe('win');
      expect(stored.result).toBe('1-0');
      expect(stored.white.name).toBe('hoot65');
      expect(stored.white.rating).toBe(1121);
      expect(stored.black.name).toBe('abhinavghadage');
      expect(stored.black.rating).toBe(1087);
      expect(stored.eco).toBe('C55');
      expect(stored.openingName).toBe('Scotch Game Dubois Reti Max Lange Attack');
      expect(stored.timeClass).toBe('rapid');
      expect(stored.timestamp).toBe(mockRawGameWhiteWin.end_time! * 1000);
      expect(stored.movesSan).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd4', 'exd4']);
    });

    it('correctly parses game when hoot65 plays Black and loses', () => {
      const stored = parseChessComGame(mockRawGameBlackLoss, 'hoot65');

      expect(stored.userColor).toBe('black');
      expect(stored.userResult).toBe('loss');
      expect(stored.result).toBe('1-0');
      expect(stored.white.name).toBe('OpponentKing');
      expect(stored.black.name).toBe('hoot65');
      expect(stored.eco).toBe('B12');
      expect(stored.openingName).toBe('Caro Kann Defense Advance Variation');
      expect(stored.timeClass).toBe('blitz');
      expect(stored.movesSan).toEqual([
        'e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6', 'Be2', 'Bg4',
      ]);
    });

    it('correctly parses draw outcome', () => {
      const stored = parseChessComGame(mockRawGameDraw, 'hoot65');

      expect(stored.userResult).toBe('draw');
      expect(stored.result).toBe('1/2-1/2');
    });
  });

  describe('syncPlayerGames', () => {
    it('syncs archives into database and emits progress updates', async () => {
      const mockArchives = [
        'https://api.chess.com/pub/player/hoot65/games/2026/09',
        'https://api.chess.com/pub/player/hoot65/games/2026/10',
      ];

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const u = url.toString();
        if (u.endsWith('/archives')) {
          return {
            ok: true,
            json: async () => ({ archives: mockArchives }),
          } as Response;
        }
        if (u.endsWith('2026/10')) {
          return {
            ok: true,
            json: async () => ({ games: [mockRawGameWhiteWin] }),
          } as Response;
        }
        if (u.endsWith('2026/09')) {
          return {
            ok: true,
            json: async () => ({ games: [mockRawGameBlackLoss] }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const progressLogs: SyncProgress[] = [];
      const result = await syncPlayerGames({
        username: 'hoot65',
        repo,
        onProgress: (p) => progressLogs.push({ ...p }),
      });

      expect(result.syncedArchives).toBe(2);
      expect(result.gamesAdded).toBe(2);
      expect(result.duplicatesSkipped).toBe(0);
      expect(await repo.getGamesCount()).toBe(2);

      // Verify phases were reported
      expect(progressLogs.some((p) => p.phase === 'fetching_archives')).toBe(true);
      expect(progressLogs.some((p) => p.phase === 'syncing_month')).toBe(true);
      expect(progressLogs.some((p) => p.phase === 'complete')).toBe(true);

      // Subsequent sync skips duplicates
      const secondSync = await syncPlayerGames({
        username: 'hoot65',
        repo,
      });
      expect(secondSync.gamesAdded).toBe(0);
      expect(secondSync.duplicatesSkipped).toBe(2);
      expect(await repo.getGamesCount()).toBe(2);
    });

    it('respects sinceDate and maxArchives options', async () => {
      const mockArchives = [
        'https://api.chess.com/pub/player/hoot65/games/2026/07',
        'https://api.chess.com/pub/player/hoot65/games/2026/08',
        'https://api.chess.com/pub/player/hoot65/games/2026/09',
        'https://api.chess.com/pub/player/hoot65/games/2026/10',
      ];

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const u = url.toString();
        if (u.endsWith('/archives')) {
          return {
            ok: true,
            json: async () => ({ archives: mockArchives }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ games: [] }),
        } as Response;
      });

      // Filter by sinceDate: only 2026/09 and 2026/10
      const res = await syncPlayerGames({
        username: 'hoot65',
        repo,
        sinceDate: '2026/09',
      });
      expect(res.syncedArchives).toBe(2);

      // Limit by maxArchives: 1
      const resMax = await syncPlayerGames({
        username: 'hoot65',
        repo,
        maxArchives: 1,
      });
      expect(resMax.syncedArchives).toBe(1);
    });
  });
});
