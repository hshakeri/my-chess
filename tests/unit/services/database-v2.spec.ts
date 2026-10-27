import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { ChessDatabase } from '../../../src/db/database';
import { GamesRepository } from '../../../src/db/gamesRepo';
import { DATABASE_EXPORT_VERSION, type StoredCard, type StoredRevlog, type StoredGame, type StoredSrsCard, type DatabaseExportData } from '../../../src/types/db';

const NOW = Date.UTC(2026, 9, 25, 9, 0, 0);

function sampleCard(id: string, extra: Partial<StoredCard> = {}): StoredCard {
  return {
    id,
    fen: `${id} 0 1`,
    accepted: ['e4'],
    lessonIds: ['italian-evans'],
    tags: ['lesson:italian-evans', 'family:opening', 'color:w'],
    ply: 0,
    reachProb: 1,
    color: 'w',
    due: NOW,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    responseStats: { n: 0, meanMs: 0 },
    createdAt: NOW,
    ...extra,
  };
}

function sampleRevlog(cardId: string, review: number): StoredRevlog {
  return {
    cardId,
    rating: 3,
    state: 0,
    due: review,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    last_elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    review,
    lessonId: 'italian-evans',
    sessionId: 's-1',
  };
}

const sampleGame: StoredGame = {
  id: 'chesscom:185031553576',
  dedupKey: 'chesscom:185031553576',
  source: 'chesscom',
  pgn: '[Event "Live Chess"]\n[White "hoot65"]\n[Black "OpponentA"]\n[Result "0-1"]\n\n1. e4 d5 2. e5 d4 0-1',
  white: { name: 'hoot65', rating: 1120 },
  black: { name: 'OpponentA', rating: 1140 },
  result: '0-1',
  timestamp: 1792880000000,
  timeClass: 'rapid',
  movesSan: ['e4', 'd5', 'e5', 'd4'],
  userColor: 'white',
  userResult: 'loss',
};

const legacySrs: StoredSrsCard = {
  id: 'italian-evans',
  repertoireId: 'opening',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  expectedMoveSan: 'e4',
  dueDate: NOW,
  interval: 3,
  easeFactor: 2.5,
  repetitions: 2,
  box: 2,
  lastReviewed: NOW - 86_400_000,
};

/** The schema exactly as version 1 shipped, to simulate an existing install. */
class LegacyV1Database extends Dexie {
  constructor(name: string) {
    super(name, { indexedDB, IDBKeyRange });
    this.version(1).stores({
      games:
        '&id, dedupKey, source, timestamp, userColor, userResult, timeClass, eco, openingName, [userColor+userResult]',
      repertoires: '&id, color, name, updatedAt',
      srs_cards: '&id, repertoireId, dueDate, box, interval',
      diagnostics: '&id, timestamp, playerHandle',
    });
  }
}

describe('ChessDatabase version 2 (cards, revlog, reviews, explorer_cache)', () => {
  let name: string;
  let testDb: ChessDatabase;

  beforeEach(() => {
    name = `test_chess_db_v2_${Math.random().toString(36).substring(2, 9)}`;
    testDb = new ChessDatabase(name, { indexedDB, IDBKeyRange });
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('declares the new tables and keeps the version-1 ones', async () => {
    await testDb.open();
    expect(testDb.verno).toBe(2);
    const names = testDb.tables.map((t) => t.name).sort();
    expect(names).toEqual(['cards', 'diagnostics', 'explorer_cache', 'games', 'repertoires', 'reviews', 'revlog', 'srs_cards']);
  });

  it('indexes cards by due, state and the multi-entry tags and lessonIds', async () => {
    await testDb.cards.bulkPut([
      sampleCard('a', { due: NOW - 1, state: 2, tags: ['family:opening', 'lesson:x'], lessonIds: ['x'] }),
      sampleCard('b', { due: NOW + 1, state: 0, tags: ['family:weakness_drill', 'lesson:x', 'lesson:y'], lessonIds: ['x', 'y'] }),
      sampleCard('c', { due: NOW, state: 1, tags: ['family:opening', 'lesson:y'], lessonIds: ['y'] }),
    ]);
    expect((await testDb.cards.where('due').belowOrEqual(NOW).sortBy('due')).map((c) => c.id)).toEqual(['a', 'c']);
    expect((await testDb.cards.where('state').equals(0).toArray()).map((c) => c.id)).toEqual(['b']);
    expect((await testDb.cards.where('tags').equals('family:opening').sortBy('id')).map((c) => c.id)).toEqual(['a', 'c']);
    expect((await testDb.cards.where('lessonIds').equals('y').sortBy('id')).map((c) => c.id)).toEqual(['b', 'c']);
    expect((await testDb.cards.where('lessonIds').equals('x').sortBy('id')).map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('auto-increments revlog ids and indexes cardId, review, lessonId and sessionId', async () => {
    const id1 = await testDb.revlog.add(sampleRevlog('a', NOW));
    const id2 = await testDb.revlog.add(sampleRevlog('a', NOW + 1));
    await testDb.revlog.add({ ...sampleRevlog('b', NOW + 2), sessionId: 's-2', lessonId: 'other' });
    expect(id2).toBe((id1 as number) + 1);
    expect(await testDb.revlog.where('cardId').equals('a').count()).toBe(2);
    expect(await testDb.revlog.where('review').above(NOW).count()).toBe(2);
    expect(await testDb.revlog.where('lessonId').equals('other').count()).toBe(1);
    expect(await testDb.revlog.where('sessionId').equals('s-1').count()).toBe(2);
  });

  it('stores reviews and explorer_cache placeholders', async () => {
    await testDb.reviews.put({ gameId: 'g1', reviewedAt: NOW, criticalMoments: [{ ply: 12 }] });
    await testDb.explorer_cache.put({ key: 'fen|rapid', fetchedAt: NOW, payload: { moves: [] } });
    expect((await testDb.reviews.get('g1'))?.criticalMoments).toEqual([{ ply: 12 }]);
    expect((await testDb.explorer_cache.where('fetchedAt').aboveOrEqual(NOW).toArray()).map((r) => r.key)).toEqual(['fen|rapid']);
  });

  it('upgrades an existing version-1 database without losing srs_cards, and the upgrade is idempotent', async () => {
    await testDb.delete();
    const legacy = new LegacyV1Database(name);
    await legacy.open();
    expect(legacy.verno).toBe(1);
    await legacy.table('srs_cards').put(legacySrs);
    await legacy.table('games').put(sampleGame);
    legacy.close();

    const upgraded = new ChessDatabase(name, { indexedDB, IDBKeyRange });
    await upgraded.open();
    expect(upgraded.verno).toBe(2);
    expect(await upgraded.srs_cards.get('italian-evans')).toEqual(legacySrs);
    expect(await upgraded.games.count()).toBe(1);
    await upgraded.cards.put(sampleCard('k1'));
    upgraded.close();

    const reopened = new ChessDatabase(name, { indexedDB, IDBKeyRange });
    await reopened.open();
    expect(reopened.verno).toBe(2);
    expect(await reopened.srs_cards.count()).toBe(1);
    expect(await reopened.cards.count()).toBe(1);
    expect((await reopened.srs_cards.where('box').equals(2).toArray()).map((r) => r.id)).toEqual(['italian-evans']);
    reopened.close();

    testDb = new ChessDatabase(name, { indexedDB, IDBKeyRange });
  });
});

describe('Export / import version 2', () => {
  let testDb: ChessDatabase;
  let repo: GamesRepository;

  beforeEach(() => {
    testDb = new ChessDatabase(`test_export_${Math.random().toString(36).substring(2, 9)}`, { indexedDB, IDBKeyRange });
    repo = new GamesRepository(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('exports version 2 with cards and revlog and round-trips them', async () => {
    await repo.addGame(sampleGame);
    await testDb.srs_cards.put(legacySrs);
    await testDb.cards.bulkPut([sampleCard('a', { reps: 2, state: 2, due: NOW + 86_400_000, last_review: NOW }), sampleCard('b')]);
    await testDb.revlog.bulkAdd([sampleRevlog('a', NOW - 1000), sampleRevlog('a', NOW), sampleRevlog('b', NOW)]);

    const exported = await repo.exportDatabaseJson();
    expect(exported.version).toBe(2);
    expect(DATABASE_EXPORT_VERSION).toBe(2);
    expect(exported.games).toHaveLength(1);
    expect(exported.srsCards).toHaveLength(1);
    expect(exported.cards).toHaveLength(2);
    expect(exported.revlog).toHaveLength(3);
    expect(exported.revlog!.every((r) => typeof r.id === 'number')).toBe(true);

    // JSON round trip must keep the numbers that the indexes rely on
    const json = JSON.stringify(exported);

    await repo.clearAllGames();
    await testDb.srs_cards.clear();
    await testDb.cards.clear();
    await testDb.revlog.clear();

    const res = await repo.importDatabaseJson(json);
    expect(res).toEqual({ gamesAdded: 1, gamesSkipped: 0, version: 2 });
    expect(await testDb.cards.count()).toBe(2);
    expect(await testDb.cards.get('a')).toEqual(exported.cards![0]);
    expect(await testDb.srs_cards.count()).toBe(1);
    const revlog = await testDb.revlog.orderBy('review').toArray();
    expect(revlog).toHaveLength(3);
    expect(revlog.map((r) => [r.cardId, r.review])).toEqual([
      ['a', NOW - 1000],
      ['a', NOW],
      ['b', NOW],
    ]);
    expect((await testDb.cards.where('due').belowOrEqual(NOW).toArray()).map((c) => c.id)).toEqual(['b']);

    // importing the same backup again adds no duplicate revlog rows
    const again = await repo.importDatabaseJson(json);
    expect(again.gamesSkipped).toBe(1);
    expect(await testDb.revlog.count()).toBe(3);
    expect(await testDb.cards.count()).toBe(2);
  });

  it('imports revlog rows from another database without id collisions', async () => {
    await testDb.revlog.add(sampleRevlog('local', NOW)); // takes id 1 locally
    const foreign: DatabaseExportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      games: [],
      cards: [sampleCard('foreign')],
      revlog: [{ ...sampleRevlog('foreign', NOW + 5), id: 1 }],
    };
    await repo.importDatabaseJson(foreign);
    const rows = await testDb.revlog.toArray();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.cardId).sort()).toEqual(['foreign', 'local']);
  });

  it('accepts a version-1 backup unchanged', async () => {
    const v1: DatabaseExportData = {
      version: 1,
      exportedAt: '2026-10-01T00:00:00.000Z',
      games: [sampleGame],
      repertoires: [],
      srsCards: [legacySrs],
      diagnostics: [],
    };
    const res = await repo.importDatabaseJson(JSON.stringify(v1));
    expect(res).toEqual({ gamesAdded: 1, gamesSkipped: 0, version: 1 });
    expect(await testDb.games.count()).toBe(1);
    expect(await testDb.srs_cards.get('italian-evans')).toEqual(legacySrs);
    expect(await testDb.cards.count()).toBe(0);
    expect(await testDb.revlog.count()).toBe(0);
  });

  it('still rejects a backup without a games array', async () => {
    await expect(repo.importDatabaseJson('{"version":2}')).rejects.toThrow(/games/);
    await expect(repo.importDatabaseJson('not json')).rejects.toThrow(/Invalid JSON/);
  });
});
