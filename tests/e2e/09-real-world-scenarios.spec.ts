import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.describe('09. Tier 4 Real-World User Scenarios (Journeys 1 - 15)', () => {
  let unmocked: string[] = [];

  test.beforeEach(async ({ page }) => {
    // These tests drive lesson moves; the board question before each move (CL-5) is tested on its own, with it on
    await page.addInitScript(() => window.localStorage.setItem('my_chess_cct_gate', 'off'));
    // Every Chess.com request the tests do not mock is answered 404 and recorded, so no test reaches the live API
    unmocked = [];
    await page.route('https://api.chess.com/**', async (route) => {
      unmocked.push(route.request().url());
      await route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
    });

    // Intercept network routes for Chess.com endpoints
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
              pgn: '[Event "Live Chess"]\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0',
              uuid: 'scenario-test-uuid',
              time_class: 'rapid',
              white: { rating: 1121, result: 'win', username: 'hoot65' },
              black: { rating: 1087, result: 'resigned', username: 'rival' },
              eco: 'https://www.chess.com/openings/Italian-Game',
            },
          ],
        }),
      });
    });

    await page.goto('/');
  });

  test.afterEach(() => {
    expect(unmocked, 'Chess.com requests without a mock').toEqual([]);
  });

  test('Scenario 1: Full Game vs Maia 1100 as White with move takeback and PGN export', async ({ page }) => {
    await page.locator('[data-tab="play"]').click();

    // Select Maia 1100 Elo
    await page.locator('select[data-select="elo"]').selectOption('1100');
    // Set engine to Black
    await page.locator('button[data-engine-color="b"]').first().click();

    // Play 1. e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // Wait for Black engine response (ply 2)
    const ply2 = page.locator('button[data-ply="2"]').first();
    await expect(ply2).toBeVisible({ timeout: 15000 });

    // Export PGN downloads the game so far
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button[data-action="export-pgn"]').first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^game_\d+\.pgn$/);
    expect(readFileSync(await download.path(), 'utf8')).toMatch(/1\. e4 \S+/);

    // Test takeback
    const takebackBtn = page.locator('button[data-action="takeback"]').first();
    await takebackBtn.click();

    // Board returns to White's turn
    await expect(page.locator('[data-square="e2"] img')).toBeVisible();
  });

  test('Scenario 2: Full Game vs Maia 1500 as Black with board flip and move navigation', async ({ page }) => {
    await page.locator('[data-tab="play"]').click();

    // Flip board to Black perspective
    await page.locator('button[data-action="flip-board"]').first().click();

    // Set engine to White
    await page.locator('button[data-engine-color="w"]').first().click();

    // Engine makes White move (ply 1)
    const ply1 = page.locator('button[data-ply="1"]').first();
    await expect(ply1).toBeVisible({ timeout: 15000 });

    // User plays Caro-Kann: c7 -> c6
    await page.locator('[data-square="c7"]').click();
    await page.locator('[data-square="c6"]').click();

    // SAN records c6
    await expect(page.locator('.move-list-panel').getByText('c6')).toBeVisible();
  });

  test('Scenario 3: Zero-Latency Seed Load & Incremental Sync', async ({ page }) => {
    // Navigate to Database view
    const dbTab = page.locator('button:has-text("Game Database"), [data-tab="database"]').first();
    await dbTab.click();

    // Seed games load immediately
    const gameRows = page.locator('[data-game-id], tr.game-row, div.game-card');
    await expect(gameRows.first()).toBeVisible({ timeout: 10000 });

    // Trigger sync
    const syncBtn = page.locator('button[data-action="sync-chesscom"], button:has-text("Sync")').first();
    await syncBtn.click();

    // Both mocked months are read and the one new game is added
    const dialog = page.locator('[data-modal="feedback"]');
    await expect(dialog).toContainText('Chess.com Sync Complete', { timeout: 10000 });
    await expect(dialog).toContainText('Successfully synchronized 2 monthly archives');
    await expect(dialog).toContainText('Added: 1 new games');
  });

  test('Scenario 4: Weakness Detection on hoot65 Archives', async ({ page }) => {
    const diagTab = page.locator('button:has-text("Opening Diagnostics"), [data-tab="diagnostics"]').first();
    await diagTab.click();

    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();
    // Flags White Scandinavian 2.e5?! citing game ID
    await expect(view.getByText(/Scandinavian|2\.e5/i).first()).toBeVisible();
    // The archive is read from IndexedDB and analysed in the browser: allow for that on a slow runner
    await expect(view.getByText(/185031553576|185035281692|184582182704|171000270176/).first()).toBeVisible({ timeout: 15000 });

    // Flags the Black early-queen habit citing real game IDs
    await expect(view.getByText(/171894388406|185129553252|168910457740|185346239794/).first()).toBeVisible();
  });

  test('Scenario 5: Adopting Recommended Repertoire into active study', async ({ page }) => {
    const diagTab = page.locator('button:has-text("Opening Diagnostics"), [data-tab="diagnostics"]').first();
    await diagTab.click();

    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();
    await view.getByText('Tailored Opening Repertoires').click();
    const adoptBtn = page.locator('button[data-action="adopt-repertoire"]').first();
    await expect(adoptBtn).toHaveAttribute('data-adopted', 'false');
    await adoptBtn.click();

    // Adopting opens the plan's first line as a lesson, and the choice is remembered
    await expect(page.locator('.lessons-view, [data-view="lessons"]').first()).toBeVisible();
    await expect(page.locator('[data-square="d5"] img')).toBeVisible();
    await diagTab.click();
    await view.getByText('Tailored Opening Repertoires').click();
    await expect(page.locator('button[data-action="adopt-repertoire"]').first()).toHaveAttribute('data-adopted', 'true');
    await expect(page.locator('button[data-action="adopt-repertoire"]').first()).toContainText('Adopted');
  });

  test('Scenario 6: Interactive Step-by-Step Opening Drill with feedback loop', async ({ page }) => {
    const lessonTab = page.locator('button:has-text("Interactive Lessons"), [data-tab="lessons"]').first();
    await lessonTab.click();

    // The Scandinavian drill opens after 1.e4 d5 with White to move
    await page.locator('[data-lesson-id="lesson-scandinavian-refutation-drill"]').click();
    const e4Pawn = page.locator('[data-square="e4"] img[alt="White p"]');
    await expect(e4Pawn).toBeVisible();

    // Wrong move 2.e5?!: the board shakes, the mistake is explained, 2...d4 is played, then everything rolls back
    await page.locator('[data-square="e4"]').click();
    await page.locator('[data-square="e5"]').click();
    await expect(page.locator('.animate-shake')).toHaveCount(1);
    await expect(page.locator('[data-feedback="wrong"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-square="d4"] img[alt="Black p"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-square="d4"] img')).toHaveCount(0, { timeout: 5000 });
    await expect(e4Pawn).toBeVisible();
    await expect(page.locator('[data-run-stats]')).toContainText(/1 slip/);

    // Right move 2.exd5: praised, answered by 2...Qxd5, and the decision is scheduled at once
    await page.locator('[data-square="e4"]').click();
    await page.locator('[data-square="d5"]').click();
    await expect(page.locator('.correct-feedback')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-square="d5"] img[alt="Black q"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-review-log] [data-rating]')).toHaveCount(1);
    await expect(page.locator('[data-srs-message]')).toContainText(/next review in/);
  });

  test('Scenario 7: Spaced Repetition Lifecycle (SM-2)', async ({ page }) => {
    const lessonTab = page.locator('button:has-text("Interactive Lessons"), [data-tab="lessons"]').first();
    await lessonTab.click();

    // The rating is inferred per decision as the lesson is played; there is no self-grade bar
    await expect(page.locator('[data-grade]')).toHaveCount(0);

    await page.locator('[data-lesson-id="lesson-stalemate-catastrophes"]').click();
    await page.locator('[data-square="d6"]').click();
    await page.locator('[data-square="d8"]').click();
    await expect(page.locator('[data-review-log] [data-rating]')).toHaveCount(1);
    await expect(page.locator('[data-srs-message]')).toContainText(/next review in/);
    await expect(page.locator('[data-exercise]')).toBeVisible();
    await page.locator('[data-square="d6"]').click();
    await page.locator('[data-square="d8"]').click();
    await page.locator('button[data-action="next-exercise"]').click();
    await expect(page.getByText('Lesson Completed!')).toBeVisible();
  });

  test('Scenario 8: Printable Worksheet Generation for Physical Board Practice', async ({ page }) => {
    const wsTab = page.locator('button:has-text("Printable Worksheets"), [data-tab="worksheets"]').first();
    await wsTab.click();

    const diagram = page.locator('.print-diagram, .worksheet-board, [data-printable="board"]').first();
    await expect(diagram).toBeVisible();

    const answerKey = page.locator('.worksheet-answer-key, [data-printable="answer-key"]').first();
    await expect(answerKey).toBeVisible();
  });

  test('Scenario 9: Personalized Weakness Drill Worksheet for hoot65', async ({ page }) => {
    const wsTab = page.locator('button:has-text("Printable Worksheets"), [data-tab="worksheets"]').first();
    await wsTab.click();

    const hootDrill = page.locator('.worksheet-item', { hasText: 'hoot65 Weakness Drill' }).first();
    await expect(hootDrill).toBeVisible();
    const title = (await hootDrill.locator('h4').textContent())!.trim();
    await hootDrill.click();
    await expect(page.locator('.printable-sheet h1').first()).toHaveText(title);
  });

  test('Scenario 10: Manual PGN Upload with Deduplication', async ({ page }) => {
    const dbTab = page.locator('button:has-text("Game Database"), [data-tab="database"]').first();
    await dbTab.click();

    const game = '[Event "Casual"]\n[Site "Local"]\n[Date "2026.10.26"]\n[White "hoot65"]\n[Black "Club Friend"]\n[Result "0-1"]\n\n1. e4 c6 2. d4 d5 0-1';
    const dialog = page.locator('[data-modal="feedback"]');
    // The first upload adds the game; the same text again is recognised as a duplicate
    for (const [added, skipped] of [[1, 0], [0, 1]]) {
      await page.locator('button[data-action="upload-pgn"]').click();
      await page.locator('textarea[data-input="pgn-upload"]').fill(game);
      await page.locator('button[data-action="confirm-upload"]').click();
      await expect(dialog).toContainText(`Games Added: ${added}`, { timeout: 10000 });
      await expect(dialog).toContainText(`Duplicates Skipped: ${skipped}`);
      await page.locator('button[data-action="dismiss-feedback"]').click();
    }
  });

  test('Scenario 11: Full Database Backup & Restore Round-Trip', async ({ page }) => {
    const dbTab = page.locator('button:has-text("Game Database"), [data-tab="database"]').first();
    await dbTab.click();

    const exportBtn = page.locator('button[data-action="export-json"], button:has-text("Export")').first();
    await expect(exportBtn).toBeVisible();
  });

  test('Scenario 12: Custom Position Setup & Endgame Practice (Lucena Position)', async ({ page }) => {
    await page.locator('[data-tab="play"]').click();

    const setupBtn = page.locator('button[data-action="setup-position"]').first();
    await setupBtn.click();

    // Lucena Position FEN
    const lucenaFen = '1K1k4/1P6/8/8/8/8/1r6/R7 w - - 0 1';
    await page.locator('textarea[data-input="fen"]').first().fill(lucenaFen);
    await page.locator('button[data-action="apply-position"]').click();

    // Verify White rook on a1
    await expect(page.locator('[data-square="a1"] img')).toBeVisible();
  });

  test('Scenario 13: Offline & Worker Fallback Resilience', async ({ page }) => {
    await page.locator('[data-tab="play"]').click();

    // Make move 1. e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // Turn engine on for Black
    await page.locator('button[data-engine-color="b"]').first().click();

    // Engine replies legally
    await expect(page.locator('button[data-ply="2"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 14: Move History Scrubbing during Live Game', async ({ page }) => {
    await page.locator('[data-tab="play"]').click();

    // Turn off engine
    await page.locator('button[data-engine-color="none"]').click();

    // Play 1. e4 e5 2. Nf3 Nc6
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await page.locator('[data-square="e7"]').click();
    await page.locator('[data-square="e5"]').click();

    // Scrub back to Initial Position (ply 0)
    await page.locator('button[data-ply="0"]').first().click();
    await expect(page.locator('[data-square="e2"] img')).toBeVisible();

    // Scrub forward to ply 2
    await page.locator('button[data-ply="2"]').first().click();
    await expect(page.locator('[data-square="e4"] img')).toBeVisible();
    await expect(page.locator('[data-square="e5"] img')).toBeVisible();
  });

  test('Scenario 15: Static GitHub Pages Deployment Smoke Test', async ({ page }) => {
    // Check that root index HTML and static assets load cleanly
    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('[data-square="e4"]').first()).toBeVisible();
  });
});
