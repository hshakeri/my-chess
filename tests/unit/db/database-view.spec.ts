import { describe, it, expect } from 'vitest';
import DatabaseView, { DatabaseView as NamedDatabaseView } from '../../../src/views/DatabaseView';
import seedGamesRaw from '../../../src/data/seed_hoot65_games.json';
import type { StoredGame } from '../../../src/types/db';

describe('DatabaseView Component & Seed Integration', () => {
  it('exports DatabaseView as both default and named export', () => {
    expect(DatabaseView).toBeDefined();
    expect(typeof DatabaseView).toBe('function');
    expect(NamedDatabaseView).toBeDefined();
    expect(NamedDatabaseView).toBe(DatabaseView);
  });

  it('contains valid genuine seed games for hoot65', () => {
    const seed = seedGamesRaw as unknown as StoredGame[];
    expect(Array.isArray(seed)).toBe(true);
    expect(seed.length).toBeGreaterThanOrEqual(300);

    // Verify key cited games are in seed data
    const keyIds = [
      '185031553576',
      '185035281692',
      '184582182704',
      '171000270176',
      '185282462950',
      '173676860416',
      '171894388406',
      '184720164178',
    ];

    for (const keyId of keyIds) {
      const match = seed.find((g) => g.id.includes(keyId) || (g.url && g.url.includes(keyId)));
      expect(match).toBeDefined();
      expect(match?.movesSan.length).toBeGreaterThan(0);
      expect(match?.pgn).toBeDefined();
    }
  });

  it('seed games have correct White and Black player metadata', () => {
    const seed = seedGamesRaw as unknown as StoredGame[];
    const whiteGames = seed.filter((g) => g.userColor === 'white');
    const blackGames = seed.filter((g) => g.userColor === 'black');

    expect(whiteGames.length).toBeGreaterThan(50);
    expect(blackGames.length).toBeGreaterThan(50);

    // Every White game should have hoot65 as White
    for (const g of whiteGames) {
      expect(g.white.name.toLowerCase()).toBe('hoot65');
      expect(['win', 'loss', 'draw', '*']).toContain(g.userResult);
    }

    // Every Black game should have hoot65 as Black
    for (const g of blackGames) {
      expect(g.black.name.toLowerCase()).toBe('hoot65');
      expect(['win', 'loss', 'draw', '*']).toContain(g.userResult);
    }
  });
});
