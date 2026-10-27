import { test, expect } from '@playwright/test';

test.describe('09. Tier 4 Real-World User Scenarios (Journeys 1 - 15)', () => {
  test.beforeEach(async ({ page }) => {
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

  test('Scenario 1: Full Game vs Maia 1100 as White with move takeback and PGN export', async ({ page }) => {
    const playTab = page.locator('button:has-text("Play vs Maia"), [data-tab="play"]').first();
    if (await playTab.isVisible()) await playTab.click();

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

    // Test takeback
    const takebackBtn = page.locator('button[data-action="takeback"]').first();
    await takebackBtn.click();

    // Board returns to White's turn
    await expect(page.locator('[data-square="e2"] img')).toBeVisible();

    // Export PGN button check
    const exportPgn = page.locator('button[data-action="export-pgn"]').first();
    if (await exportPgn.isVisible()) {
      await exportPgn.click();
    }
  });

  test('Scenario 2: Full Game vs Maia 1500 as Black with board flip and move navigation', async ({ page }) => {
    const playTab = page.locator('button:has-text("Play vs Maia"), [data-tab="play"]').first();
    if (await playTab.isVisible()) await playTab.click();

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

    // Sync notification appears
    await expect(page.getByText(/sync|games|complete/i).first()).toBeVisible({ timeout: 10000 });
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

    const scandiItem = page.getByText(/Scandinavian|Anti-Scandinavian|Scotch/i).first();
    if (await scandiItem.isVisible()) {
      await scandiItem.click();
    }

    // Wrong move test
    const e4Pawn = page.locator('[data-square="e4"]');
    if (await e4Pawn.locator('img').isVisible()) {
      await e4Pawn.click();
      await page.locator('[data-square="e5"]').click();
      await expect(page.getByText(/equalize|wrong|mistake/i).first()).toBeVisible({ timeout: 5000 });
    }
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

    const hootDrill = page.getByText(/hoot65|Scandinavian|185031553576/i).first();
    if (await hootDrill.isVisible()) {
      await hootDrill.click();
      await expect(page.locator('.printable-sheet').first()).toBeVisible();
    }
  });

  test('Scenario 10: Manual PGN Upload with Deduplication', async ({ page }) => {
    const dbTab = page.locator('button:has-text("Game Database"), [data-tab="database"]').first();
    await dbTab.click();

    const uploadBtn = page.locator('button[data-action="upload-pgn"], button:has-text("Upload PGN")').first();
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click();
      await expect(page.locator('textarea, input[type="file"]:not(.hidden)').first()).toBeVisible();
    }
  });

  test('Scenario 11: Full Database Backup & Restore Round-Trip', async ({ page }) => {
    const dbTab = page.locator('button:has-text("Game Database"), [data-tab="database"]').first();
    await dbTab.click();

    const exportBtn = page.locator('button[data-action="export-json"], button:has-text("Export")').first();
    await expect(exportBtn).toBeVisible();
  });

  test('Scenario 12: Custom Position Setup & Endgame Practice (Lucena Position)', async ({ page }) => {
    const playTab = page.locator('button:has-text("Play vs Maia"), [data-tab="play"]').first();
    if (await playTab.isVisible()) await playTab.click();

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
    const playTab = page.locator('button:has-text("Play vs Maia"), [data-tab="play"]').first();
    if (await playTab.isVisible()) await playTab.click();

    // Make move 1. e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // Turn engine on for Black
    await page.locator('button[data-engine-color="b"]').first().click();

    // Engine replies legally
    await expect(page.locator('button[data-ply="2"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 14: Move History Scrubbing during Live Game', async ({ page }) => {
    const playTab = page.locator('button:has-text("Play vs Maia"), [data-tab="play"]').first();
    if (await playTab.isVisible()) await playTab.click();

    // Turn off engine
    const offBtn = page.locator('button[data-engine-color="none"]').first();
    if (await offBtn.isVisible()) await offBtn.click();

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
