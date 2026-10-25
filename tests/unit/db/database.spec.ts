import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { ChessDatabase } from '../../../src/db/database';
import { GamesRepository, computeDedupKey, deriveTimeClass, deriveUserResult } from '../../../src/db/gamesRepo';
import type { StoredGame } from '../../../src/types/db';

describe('Persistent Database & GamesRepo (IndexedDB via Dexie)', () => {
  let testDb: ChessDatabase;
  let repo: GamesRepository;

  beforeEach(() => {
    const dbName = `test_chess_db_${Math.random().toString(36).substring(2, 9)}`;
    testDb = new ChessDatabase(dbName, { indexedDB, IDBKeyRange });
    repo = new GamesRepository(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  const sampleGame1: StoredGame = {
    id: 'chesscom:185031553576',
    dedupKey: 'chesscom:185031553576',
    source: 'chesscom',
    url: 'https://www.chess.com/game/live/185031553576',
    pgn: '[Event "Live Chess"]\n[White "hoot65"]\n[Black "OpponentA"]\n[Result "0-1"]\n[ECO "B01"]\n\n1. e4 d5 2. e5 d4 3. Nf3 f6 4. d3 fxe5 0-1',
    white: { name: 'hoot65', rating: 1120 },
    black: { name: 'OpponentA', rating: 1140 },
    result: '0-1',
    eco: 'B01',
    openingName: 'Scandinavian Defense',
    timestamp: 1792880000000,
    timeClass: 'rapid',
    movesSan: ['e4', 'd5', 'e5', 'd4', 'Nf3', 'f6', 'd3', 'fxe5'],
    userColor: 'white',
    userResult: 'loss',
  };

  const sampleGame2: StoredGame = {
    id: 'chesscom:185894059676',
    dedupKey: 'chesscom:185894059676',
    source: 'chesscom',
    url: 'https://www.chess.com/game/live/185894059676',
    pgn: '[Event "Live Chess"]\n[White "hoot65"]\n[Black "abhinavghadage"]\n[Result "1-0"]\n[ECO "C55"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 1-0',
    white: { name: 'hoot65', rating: 1121 },
    black: { name: 'abhinavghadage', rating: 1087 },
    result: '1-0',
    eco: 'C55',
    openingName: 'Scotch Game',
    timestamp: 1792890000000,
    timeClass: 'rapid',
    movesSan: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd4'],
    userColor: 'white',
    userResult: 'win',
  };

  const sampleGame3: StoredGame = {
    id: 'chesscom:185282462950',
    dedupKey: 'chesscom:185282462950',
    source: 'chesscom',
    url: 'https://www.chess.com/game/live/185282462950',
    pgn: '[Event "Live Chess"]\n[White "MasterX"]\n[Black "hoot65"]\n[Result "1-0"]\n[ECO "B12"]\n\n1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 Bg4 1-0',
    white: { name: 'MasterX', rating: 1180 },
    black: { name: 'hoot65', rating: 1115 },
    result: '1-0',
    eco: 'B12',
    openingName: 'Caro Kann Defense',
    timestamp: 1792870000000,
    timeClass: 'blitz',
    movesSan: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6', 'Be2', 'Bg4'],
    userColor: 'black',
    userResult: 'loss',
  };

  it('initializes all required Dexie tables with valid schema', () => {
    expect(testDb.games).toBeDefined();
    expect(testDb.repertoires).toBeDefined();
    expect(testDb.srs_cards).toBeDefined();
    expect(testDb.diagnostics).toBeDefined();
    expect(testDb.name).toContain('test_chess_db_');
  });

  describe('Deduplication Key Computation', () => {
    it('uses Chess.com UUID when present', () => {
      const key = computeDedupKey({ uuid: 'abc-123-xyz' });
      expect(key).toBe('chesscom:abc-123-xyz');
    });

    it('extracts ID from live Chess.com URL', () => {
      const key = computeDedupKey({ url: 'https://www.chess.com/game/live/185031553576' });
      expect(key).toBe('chesscom:185031553576');
    });

    it('generates composite move signature hash for manual PGNs', () => {
      const key1 = computeDedupKey({
        white: { name: 'Alice' },
        black: { name: 'Bob' },
        date: '2026-10-24',
        movesSan: ['e4', 'e5', 'Nf3', 'Nc6'],
      });
      const key2 = computeDedupKey({
        white: { name: 'Alice' },
        black: { name: 'Bob' },
        date: '2026-10-24',
        movesSan: ['e4', 'e5', 'Nf3', 'Nc6'],
      });
      const keyDifferentMoves = computeDedupKey({
        white: { name: 'Alice' },
        black: { name: 'Bob' },
        date: '2026-10-24',
        movesSan: ['d4', 'd5'],
      });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(keyDifferentMoves);
      expect(key1.startsWith('pgn:')).toBe(true);
    });
  });

  describe('Single Game Insert & Duplicate Detection', () => {
    it('successfully adds new game and detects subsequent duplicate', async () => {
      const first = await repo.addGame(sampleGame1);
      expect(first.success).toBe(true);
      expect(first.duplicate).toBe(false);
      expect(first.id).toBe(sampleGame1.id);

      expect(await repo.getGamesCount()).toBe(1);

      // Re-add same game
      const duplicate = await repo.addGame(sampleGame1);
      expect(duplicate.success).toBe(false);
      expect(duplicate.duplicate).toBe(true);
      expect(await repo.getGamesCount()).toBe(1);
    });
  });

  describe('Batch Insert with Deduplication Reporting', () => {
    it('accurately reports added and duplicatesSkipped on batches', async () => {
      const batch1 = [sampleGame1, sampleGame2];
      const res1 = await repo.batchAddGames(batch1);
      expect(res1.added).toBe(2);
      expect(res1.duplicatesSkipped).toBe(0);
      expect(await repo.getGamesCount()).toBe(2);

      // Insert batch with 1 existing game, 1 new game, and 1 intra-batch duplicate
      const batch2 = [
        sampleGame2, // already in DB
        sampleGame3, // new
        sampleGame3, // duplicate inside batch
      ];
      const res2 = await repo.batchAddGames(batch2);
      expect(res2.added).toBe(1); // only sampleGame3
      expect(res2.duplicatesSkipped).toBe(2); // sampleGame2 (from DB) + sampleGame3 (intra-batch)
      expect(await repo.getGamesCount()).toBe(3);
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(async () => {
      await repo.batchAddGames([sampleGame1, sampleGame2, sampleGame3]);
    });

    it('filters by user color', async () => {
      const whiteGames = await repo.filterGames({ color: 'white' });
      expect(whiteGames.length).toBe(2);
      expect(whiteGames.every((g) => g.userColor === 'white')).toBe(true);

      const blackGames = await repo.filterGames({ color: 'black' });
      expect(blackGames.length).toBe(1);
      expect(blackGames[0].id).toBe(sampleGame3.id);
    });

    it('filters by user result', async () => {
      const wins = await repo.filterGames({ result: 'win' });
      expect(wins.length).toBe(1);
      expect(wins[0].id).toBe(sampleGame2.id);

      const losses = await repo.filterGames({ result: 'loss' });
      expect(losses.length).toBe(2);
    });

    it('filters by time control class', async () => {
      const rapid = await repo.filterGames({ timeClass: 'rapid' });
      expect(rapid.length).toBe(2);

      const blitz = await repo.filterGames({ timeClass: 'blitz' });
      expect(blitz.length).toBe(1);
      expect(blitz[0].id).toBe(sampleGame3.id);
    });

    it('filters by search substring across opponent, ECO, and opening', async () => {
      // Search by ECO
      const ecoSearch = await repo.filterGames({ search: 'B01' });
      expect(ecoSearch.length).toBe(1);
      expect(ecoSearch[0].id).toBe(sampleGame1.id);

      // Search by opening name
      const openingSearch = await repo.filterGames({ search: 'scandi' });
      expect(openingSearch.length).toBe(1);
      expect(openingSearch[0].openingName).toBe('Scandinavian Defense');

      // Search by opponent name
      const oppSearch = await repo.filterGames({ search: 'abhinav' });
      expect(oppSearch.length).toBe(1);
      expect(oppSearch[0].black.name).toBe('abhinavghadage');
    });
  });

  describe('Database Export and Import Round-Trip', () => {
    it('exports complete database to JSON and re-imports losslessly', async () => {
      await repo.batchAddGames([sampleGame1, sampleGame2, sampleGame3]);
      expect(await repo.getGamesCount()).toBe(3);

      const exportedBackup = await repo.exportDatabaseJson();
      expect(exportedBackup.version).toBe(1);
      expect(exportedBackup.games.length).toBe(3);
      expect(exportedBackup.exportedAt).toBeDefined();

      // Clear DB
      await repo.clearAllGames();
      expect(await repo.getGamesCount()).toBe(0);

      // Re-import
      const importRes = await repo.importDatabaseJson(exportedBackup);
      expect(importRes.gamesAdded).toBe(3);
      expect(importRes.gamesSkipped).toBe(0);
      expect(await repo.getGamesCount()).toBe(3);

      const restored1 = await repo.getGame(sampleGame1.id);
      expect(restored1).toBeDefined();
      expect(restored1?.movesSan).toEqual(sampleGame1.movesSan);
      expect(restored1?.openingName).toBe('Scandinavian Defense');
    });

    it('exports games to multi-game PGN string and imports cleanly', async () => {
      await repo.batchAddGames([sampleGame1, sampleGame2]);
      const pgnExport = await repo.exportGamesPgn();

      expect(pgnExport).toContain('[White "hoot65"]');
      expect(pgnExport).toContain('[ECO "B01"]');
      expect(pgnExport).toContain('[ECO "C55"]');

      // Clear DB and re-import via PGN parser
      await repo.clearAllGames();
      expect(await repo.getGamesCount()).toBe(0);

      const pgnImportRes = await repo.importPgnText(pgnExport, 'hoot65');
      expect(pgnImportRes.added).toBe(2);
      expect(pgnImportRes.duplicatesSkipped).toBe(0);
      expect(await repo.getGamesCount()).toBe(2);
    });
  });

  describe('Seeding Behavior', () => {
    it('seeds when database is empty and skips when already populated', async () => {
      const seedResult = await repo.seedIfEmpty([sampleGame1, sampleGame2]);
      expect(seedResult.seeded).toBe(true);
      expect(seedResult.count).toBe(2);
      expect(await repo.getGamesCount()).toBe(2);

      // Second seed call does nothing
      const secondCall = await repo.seedIfEmpty([sampleGame3]);
      expect(secondCall.seeded).toBe(false);
      expect(secondCall.count).toBe(2);
      expect(await repo.getGamesCount()).toBe(2);
    });
  });

  describe('Helper Functions', () => {
    it('derives time class correctly', () => {
      expect(deriveTimeClass('60')).toBe('bullet');
      expect(deriveTimeClass('180')).toBe('blitz');
      expect(deriveTimeClass('600')).toBe('rapid');
      expect(deriveTimeClass('86400')).toBe('daily');
      expect(deriveTimeClass(undefined, 'Live Chess Blitz')).toBe('blitz');
    });

    it('derives user result correctly', () => {
      expect(deriveUserResult('1-0', 'white')).toBe('win');
      expect(deriveUserResult('0-1', 'white')).toBe('loss');
      expect(deriveUserResult('1/2-1/2', 'white')).toBe('draw');
      expect(deriveUserResult('0-1', 'black')).toBe('win');
      expect(deriveUserResult('1-0', 'black')).toBe('loss');
      expect(deriveUserResult('1/2-1/2', 'black')).toBe('draw');
    });
  });
});
