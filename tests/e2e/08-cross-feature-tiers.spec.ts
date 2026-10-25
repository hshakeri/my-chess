import { test, expect } from '@playwright/test';

test.describe('08. Tier 3 Cross-Feature Integration Combinations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const playTab = page.locator('button:has-text("Play vs Maia"), [data-tab="play"]').first();
    if (await playTab.isVisible()) {
      await playTab.click();
    }
    await expect(page.locator('[data-square="e4"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('Combination 1: Play vs Engine -> Live SAN Update -> Move List Step Navigation', async ({ page }) => {
    // Set engine to Black
    const blackBtn = page.locator('button[data-engine-color="b"]').first();
    await blackBtn.click();

    // Play 1. e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // Wait for Black engine reply (ply 2)
    const ply2 = page.locator('button[data-ply="2"]').first();
    await expect(ply2).toBeVisible({ timeout: 15000 });

    // Click on ply 1 (1. e4) in move list
    const ply1 = page.locator('button[data-ply="1"]').first();
    await ply1.click();

    // Verify ply 1 is active
    await expect(ply1).toHaveAttribute('data-active', 'true');

    // Click "Step to End" button
    const navEnd = page.locator('button[data-action="nav-end"]').first();
    await navEnd.click();
    await expect(ply2).toHaveAttribute('data-active', 'true');
  });

  test('Combination 2: Takeback during active game resets board and cancels pending state', async ({ page }) => {
    // Play 1. e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // Immediately click Takeback
    const takebackBtn = page.locator('button[data-action="takeback"]').first();
    await expect(takebackBtn).toBeEnabled();
    await takebackBtn.click();

    // Position should be back at starting position
    await expect(page.locator('[data-square="e2"] img')).toBeVisible();
    await expect(page.locator('[data-square="e4"] img')).toHaveCount(0);
  });

  test('Combination 3: Custom FEN Setup -> Play vs Engine from custom endgame', async ({ page }) => {
    const setupBtn = page.locator('button[data-action="setup-position"]').first();
    await setupBtn.click();

    // King + Rook endgame FEN
    const rookEndgameFen = '8/8/8/8/8/3k4/8/R3K3 w - - 0 1';
    await page.locator('textarea[data-input="fen"]').first().fill(rookEndgameFen);
    await page.locator('button[data-action="apply-position"]').click();

    // Turn engine on for Black
    const blackBtn = page.locator('button[data-engine-color="b"]').first();
    await blackBtn.click();

    // White plays 1. Ra3+
    await page.locator('[data-square="a1"]').click();
    await page.locator('[data-square="a3"]').click();

    // Live SAN should record check Ra3+
    await expect(page.locator('.move-list-panel').getByText(/Ra3\+/)).toBeVisible();

    // Black engine should respond with legal king move
    await expect(page.locator('button[data-ply="2"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('Combination 4: Orientation Flip -> Coordinate Inversion & Legal Move Interaction', async ({ page }) => {
    // Turn off engine
    const offBtn = page.locator('button[data-engine-color="none"]').first();
    if (await offBtn.isVisible()) await offBtn.click();

    // Flip board
    const flipBtn = page.locator('button[data-action="flip-board"]').first();
    await flipBtn.click();

    // Move White pawn on e2 -> e4 from flipped view
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    await expect(page.locator('[data-square="e4"] img')).toBeVisible();
    await expect(page.locator('.move-list-panel').getByText('e4')).toBeVisible();
  });

  test('Combination 5: Diagnostic Weakness Detection -> Repertoire Unlock & Lesson Launch', async ({ page }) => {
    // Navigate to Diagnostics
    const diagTab = page.locator('button:has-text("Opening Diagnostics"), [data-tab="diagnostics"]').first();
    await diagTab.click();

    // Verify Scandinavian leak is shown
    await expect(page.getByText(/Scandinavian|2\.e5/i).first()).toBeVisible();

    // Navigate to Lessons to practice the refutation
    const lessonTab = page.locator('button:has-text("Interactive Lessons"), [data-tab="lessons"]').first();
    await lessonTab.click();

    // Anti-Scandinavian drill available
    await expect(page.getByText(/Scandinavian|Anti-Scandinavian|Refutation/i).first()).toBeVisible();
  });

  test('Combination 6: Pawn Promotion to Knight -> live SAN records exd8=N', async ({ page }) => {
    // Turn off engine
    const offBtn = page.locator('button[data-engine-color="none"]').first();
    if (await offBtn.isVisible()) await offBtn.click();

    // Setup position: White pawn on e7, black rook on d8
    const setupBtn = page.locator('button[data-action="setup-position"]').first();
    await setupBtn.click();

    const promoFen = '3r4/4P3/8/8/8/3k4/8/4K3 w - - 0 1';
    await page.locator('textarea[data-input="fen"]').first().fill(promoFen);
    await page.locator('button[data-action="apply-position"]').click();

    // Capture on d8: e7 -> d8
    await page.locator('[data-square="e7"]').click();
    await page.locator('[data-square="d8"]').click();

    // Promotion modal opens: select Knight
    const knightBtn = page.locator('button:has-text("Knight")').first();
    await expect(knightBtn).toBeVisible();
    await knightBtn.click();

    // Verify piece on d8 is Knight
    await expect(page.locator('[data-square="d8"] img')).toHaveAttribute('alt', /Knight|n/i);

    // Live SAN list should record exd8=N
    await expect(page.locator('.move-list-panel').getByText(/exd8=N/)).toBeVisible();
  });

  test('Combination 7: Mid-game Elo Slider Change propagates without crashing game', async ({ page }) => {
    const eloSelect = page.locator('select[data-select="elo"]').first();
    await eloSelect.selectOption('1100');

    // Make move 1. e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // Change Elo slider mid-game to 1900
    await eloSelect.selectOption('1900');
    await expect(eloSelect).toHaveValue('1900');

    // Game state remains intact
    await expect(page.locator('[data-square="e4"] img')).toBeVisible();
  });
});
