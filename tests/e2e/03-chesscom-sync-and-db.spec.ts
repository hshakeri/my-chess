import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { StoredGame } from '../../src/types/db';

// The bundled seed the database starts from (read as a file: specs load as ES modules)
const seed: StoredGame[] = JSON.parse(readFileSync('src/data/seed_hoot65_games.json', 'utf8'));

const uploadPgn = `[Event "Upload Test 1"]
[Site "Local"]
[Date "2026.10.25"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 1-0

[Event "Upload Test 2"]
[Site "Local"]
[Date "2026.10.25"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 1-0`;

test.describe('03. Chess.com Sync, Dexie DB & Game Replay (F07 - F12)', () => {
  let unmocked: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Every Chess.com request the tests do not mock is answered 404 and recorded, so no test reaches the live API
    unmocked = [];
    await page.route('https://api.chess.com/**', async (route) => {
      unmocked.push(route.request().url());
      await route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
    });

    // Intercept Chess.com Archives endpoint to ensure deterministic testing without live rate-limits
    await page.route('https://api.chess.com/pub/player/hoot65/games/archives', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          archives: [
            'https://api.chess.com/pub/player/hoot65/games/2026/09',
            'https://api.chess.com/pub/player/hoot65/games/2026/10',
          ],
        }),
      });
    });

    // Intercept both monthly archive endpoints: September is empty, October holds one new game
    await page.route('https://api.chess.com/pub/player/hoot65/games/2026/09', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ games: [] }),
      });
    });
    await page.route('https://api.chess.com/pub/player/hoot65/games/2026/10', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          games: [
            {
              url: 'https://www.chess.com/game/live/185894059676',
              pgn: '[Event "Live Chess"]\n[Site "Chess.com"]\n[Date "2026.10.24"]\n[White "hoot65"]\n[Black "test_rival"]\n[Result "1-0"]\n[ECO "C50"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0',
              time_control: '600',
              end_time: 1792886339,
              rated: true,
              uuid: 'sync-test-uuid-001',
              time_class: 'rapid',
              rules: 'chess',
              white: { rating: 1125, result: 'win', username: 'hoot65', uuid: 'u-hoot65' },
              black: { rating: 1100, result: 'resigned', username: 'test_rival', uuid: 'u-rival' },
              eco: 'https://www.chess.com/openings/Italian-Game',
            },
          ],
        }),
      });
    });

    await page.goto('/');
    // Navigate to Database view
    const dbTab = page.locator('button:has-text("Game Database"), button:has-text("Database"), [data-tab="database"]').first();
    await expect(dbTab).toBeVisible();
    await dbTab.click();
    // The seed is in IndexedDB before any test starts
    await expect(page.locator('[data-stat="db-games"]')).toHaveText(String(seed.length), { timeout: 10000 });
  });

  test.afterEach(() => {
    expect(unmocked, 'Chess.com requests without a mock').toEqual([]);
  });

  test('Loads bundled seed games into IndexedDB on start and displays games list', async ({ page }) => {
    // Wait for the games list/table to appear
    const tableOrList = page.locator('.database-view, [data-view="database"]').first();
    await expect(tableOrList).toBeVisible();

    // Every seed game is listed, newest first
    await expect(page.locator('[data-stat="filtered-games"]')).toHaveText(String(seed.length));
    const newest = [...seed].sort((a, b) => b.timestamp - a.timestamp)[0];
    await expect(page.locator('[data-game-id]').first()).toHaveAttribute('data-game-id', newest.id);
  });

  test('Syncs recent games from Chess.com API and updates game list', async ({ page }) => {
    // Click "Sync Chess.com" button
    const syncBtn = page.locator('button[data-action="sync-chesscom"]');
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();

    // Both mocked months are read and the one new game is added
    const dialog = page.locator('[data-modal="feedback"]');
    await expect(dialog).toHaveAttribute('data-feedback-type', 'success', { timeout: 10000 });
    await expect(dialog).toContainText('Chess.com Sync Complete');
    await expect(dialog).toContainText('Successfully synchronized 2 monthly archives');
    await expect(dialog).toContainText('Added: 1 new games');
    await expect(dialog).toContainText('Duplicates Skipped: 0');
    await expect(page.locator('[data-stat="db-games"]')).toHaveText(String(seed.length + 1));
    await expect(page.locator('[data-game-id="chesscom:sync-test-uuid-001"]')).toBeVisible();
  });

  test('Filters games by Color, Result, and search terms', async ({ page }) => {
    const filtered = page.locator('[data-stat="filtered-games"]');

    // Color: only the games hoot65 played as White are listed
    const white = page.locator('button[data-filter="color"][data-value="white"]');
    await white.click();
    await expect(white).toHaveAttribute('aria-pressed', 'true');
    await expect(filtered).toHaveText(String(seed.filter((g) => g.userColor === 'white').length));
    await expect(page.locator('[data-game-id]:not([data-user-color="white"])')).toHaveCount(0);

    // Result: White wins only
    await page.locator('button[data-filter="result"][data-value="win"]').click();
    await expect(filtered).toHaveText(String(seed.filter((g) => g.userColor === 'white' && g.userResult === 'win').length));

    // Search, with the other filters back on "all": opponent, ECO code or opening name
    await page.locator('button[data-filter="color"][data-value="all"]').click();
    await page.locator('button[data-filter="result"][data-value="all"]').click();
    await expect(filtered).toHaveText(String(seed.length));
    await page.locator('input[placeholder*="Search"]').fill('Italian');
    const italian = seed.filter((g) =>
      [g.white?.name, g.black?.name, g.eco, g.openingName].some((s) => (s || '').toLowerCase().includes('italian')),
    ).length;
    expect(italian).toBeGreaterThan(0);
    await expect(filtered).toHaveText(String(italian));
  });

  test('Opens interactive 2D replay modal on clicking a game', async ({ page }) => {
    // Click first game row
    const firstGame = page.locator('[data-game-id]').first();
    await expect(firstGame).toBeVisible();
    await firstGame.click();

    // The replay opens at the start position
    const modal = page.locator('[data-modal="replay"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Ply 0 \/ \d+/)).toBeVisible();

    // Stepping forward plays the game's first move
    await page.locator('button[data-action="replay-next"]').click();
    await expect(modal.getByText(/Ply 1 \/ \d+/)).toBeVisible();
  });

  test('Uploads multi-game PGN with deduplication skipping existing games', async ({ page }) => {
    const dialog = page.locator('[data-modal="feedback"]');
    const upload = async () => {
      await page.locator('button[data-action="upload-pgn"]').click();
      await page.locator('textarea[data-input="pgn-upload"]').fill(uploadPgn);
      await page.locator('button[data-action="confirm-upload"]').click();
      await expect(dialog).toContainText('PGN Upload Result', { timeout: 10000 });
    };

    // The two games differ only in the Event tag, so the second is a duplicate of the first
    await upload();
    await expect(dialog).toContainText('Games Added: 1');
    await expect(dialog).toContainText('Duplicates Skipped: 1');
    await expect(page.locator('[data-stat="db-games"]')).toHaveText(String(seed.length + 1));

    // Uploading the same text again adds nothing
    await page.locator('button[data-action="dismiss-feedback"]').click();
    await upload();
    await expect(dialog).toContainText('Games Added: 0');
    await expect(dialog).toContainText('Duplicates Skipped: 2');
    await expect(page.locator('[data-stat="db-games"]')).toHaveText(String(seed.length + 1));
  });

  test('Full database export and import round-trip preserves all games', async ({ page, browser }) => {
    // A synced game is not in the seed, so the backup holds a game a fresh database lacks
    await page.locator('button[data-action="sync-chesscom"]').click();
    await expect(page.locator('[data-modal="feedback"]')).toContainText('Added: 1 new games', { timeout: 10000 });
    await page.locator('button[data-action="dismiss-feedback"]').click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('button[data-action="export-json"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^my-chess-database-\d{4}-\d{2}-\d{2}\.json$/);
    const backup = await download.path();
    expect(JSON.parse(readFileSync(backup, 'utf8')).games).toHaveLength(seed.length + 1);

    // Restore it in a fresh browser profile, whose database starts from the seed alone
    const fresh = await browser.newContext();
    try {
      const other = await fresh.newPage();
      await other.goto(new URL('/my-chess/', page.url()).href);
      await other.locator('[data-tab="database"]').click();
      await expect(other.locator('[data-stat="db-games"]')).toHaveText(String(seed.length), { timeout: 10000 });
      await other.locator('input[type="file"][accept=".json"]').setInputFiles(backup);
      const dialog = other.locator('[data-modal="feedback"]');
      await expect(dialog).toContainText('Database Import Complete');
      await expect(dialog).toContainText('Games Added: 1');
      await expect(dialog).toContainText(`Duplicates Skipped: ${seed.length}`);
      await expect(other.locator('[data-stat="db-games"]')).toHaveText(String(seed.length + 1));
      await expect(other.locator('[data-game-id="chesscom:sync-test-uuid-001"]')).toBeVisible();
    } finally {
      await fresh.close();
    }
  });
});
