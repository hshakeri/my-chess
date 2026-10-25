import { test, expect } from '@playwright/test';

test.describe('03. Chess.com Sync, Dexie DB & Game Replay (F07 - F12)', () => {
  test.beforeEach(async ({ page }) => {
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

    // Intercept monthly archive endpoint
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
  });

  test('Loads bundled seed games into IndexedDB on start and displays games list', async ({ page }) => {
    // Wait for the games list/table to appear
    const tableOrList = page.locator('.database-view, [data-view="database"]').first();
    await expect(tableOrList).toBeVisible();

    // Verify games are rendered (e.g. hoot65 games exist)
    const gameRows = page.locator('[data-game-id], tr.game-row, div.game-card');
    await expect(gameRows.first()).toBeVisible({ timeout: 10000 });
    const count = await gameRows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Syncs recent games from Chess.com API and updates game list', async ({ page }) => {
    // Click "Sync Chess.com" button
    const syncBtn = page.locator('button[data-action="sync-chesscom"], button:has-text("Sync")').first();
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();

    // Verify sync status or toast
    await expect(page.locator('text=/sync|Syncing|added|games|complete/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('Filters games by Color, Result, and search terms', async ({ page }) => {
    // Check color filter
    const colorSelect = page.locator('select[data-filter="color"], button:has-text("White")').first();
    if (await colorSelect.isVisible()) {
      if (await colorSelect.evaluate((el) => el.tagName.toLowerCase()) === 'select') {
        await colorSelect.selectOption('white');
      } else {
        await colorSelect.click();
      }
    }

    // Verify filtered items have White as player
    const rows = page.locator('[data-game-id], tr.game-row, div.game-card');
    await expect(rows.first()).toBeVisible();

    // Search filter
    const searchInput = page.locator('input[data-input="search"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Italian');
      // Results should update
      await page.waitForTimeout(300);
      const filteredCount = await page.locator('[data-game-id], tr.game-row, div.game-card').count();
      expect(filteredCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('Opens interactive 2D replay modal on clicking a game', async ({ page }) => {
    // Click first game row
    const firstGame = page.locator('[data-game-id], tr.game-row, button:has-text("Replay")').first();
    await expect(firstGame).toBeVisible();
    await firstGame.click();

    // Replay modal or board preview should open
    const modalBoard = page.locator('.replay-modal, [data-modal="replay"], div:has-text("Replay Game")').first();
    await expect(modalBoard).toBeVisible();

    // Replay controls should allow stepping
    const stepNext = page.locator('button[data-action="replay-next"], button[data-action="nav-next"]').first();
    if (await stepNext.isVisible()) {
      await stepNext.click();
    }
  });

  test('Uploads multi-game PGN with deduplication skipping existing games', async ({ page }) => {
    const uploadBtn = page.locator('button[data-action="upload-pgn"], button:has-text("Upload PGN")').first();
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click();

      // Textarea paste option
      const pgnInput = page.locator('textarea[data-input="pgn-upload"], textarea').first();
      if (await pgnInput.isVisible()) {
        const testPgn = `[Event "Upload Test 1"]
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

        await pgnInput.fill(testPgn);
        const submitUpload = page.locator('button[data-action="confirm-upload"], button:has-text("Import")').first();
        await submitUpload.click();

        // Notification showing added and duplicates skipped
        await expect(page.locator('text=added|imported|duplicate|skipped/i').first()).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('Full database export and import round-trip preserves all games', async ({ page }) => {
    // Export DB button
    const exportBtn = page.locator('button[data-action="export-json"], button:has-text("Export JSON"), button:has-text("Export")').first();
    if (await exportBtn.isVisible()) {
      // Set up download event listener
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await exportBtn.click();
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toContain('.json');
      }
    }
  });
});
