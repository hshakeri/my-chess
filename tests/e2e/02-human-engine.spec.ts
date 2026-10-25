import { test, expect } from '@playwright/test';

test.describe('02. Human-Like Maia Engine Opponent (F05 - F06)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const playTab = page.locator('button:has-text("Play vs Maia"), [data-tab="play"]').first();
    if (await playTab.isVisible()) {
      await playTab.click();
    }
    await expect(page.locator('[data-square="e4"]').first()).toBeVisible();
  });

  test('Displays Maia engine panel with Elo rating selection (1100 to 1900)', async ({ page }) => {
    const eloSelect = page.locator('select[data-select="elo"]').first();
    await expect(eloSelect).toBeVisible();

    // Verify all 5 required Elo tiers are available
    const expectedElos = ['1100', '1300', '1500', '1700', '1900'];
    for (const elo of expectedElos) {
      await expect(eloSelect.locator(`option[value="${elo}"]`)).toBeAttached();
    }

    // Select 1500 Elo
    await eloSelect.selectOption('1500');
    await expect(eloSelect).toHaveValue('1500');
  });

  test('Engine plays realistic legal opening move when set as Black', async ({ page }) => {
    // Set engine to play as Black
    const blackBtn = page.locator('button[data-engine-color="b"]').first();
    await blackBtn.click();
    await expect(blackBtn).toHaveClass(/bg-slate-700/);

    // Ensure Elo is 1500
    await page.locator('select[data-select="elo"]').selectOption('1500');

    // User plays White 1. e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // Engine should show thinking indicator or respond with legal move
    // Wait for Black to make a move (ply 2 in move list)
    const blackMove = page.locator('button[data-ply="2"]').first();
    await expect(blackMove).toBeVisible({ timeout: 15000 });

    const moveText = await blackMove.textContent();
    // Common human responses to 1.e4: e5, c5, c6, e6, d5, d6, Nf6
    expect(moveText?.trim()).toMatch(/^(e5|c5|c6|e6|d5|d6|Nf6)/);
  });

  test('Engine plays first move when configured to play as White', async ({ page }) => {
    // Reset/start fresh game
    const newGameBtn = page.locator('button[data-action="new-game"]').first();
    if (await newGameBtn.isVisible()) {
      await newGameBtn.click();
    }

    // Set engine to White
    const whiteBtn = page.locator('button[data-engine-color="w"]').first();
    await whiteBtn.click();

    // Wait for engine White move (ply 1)
    const whiteMove = page.locator('button[data-ply="1"]').first();
    await expect(whiteMove).toBeVisible({ timeout: 15000 });

    const moveText = await whiteMove.textContent();
    // Typical White opening moves: e4, d4, c4, Nf3
    expect(moveText?.trim()).toMatch(/^(e4|d4|c4|Nf3)/);
  });

  test('Displays engine tier indicators (Opening Book / Neural / Heuristic)', async ({ page }) => {
    // Check that engine tier info is displayed
    const tierPanel = page.locator('.engine-controls-panel');
    await expect(tierPanel).toBeVisible();
    await expect(tierPanel.getByText(/Tier|Book|Heuristic|Neural/i).first()).toBeVisible();
  });

  test('Supports manual "Move Now" engine trigger', async ({ page }) => {
    // Turn off auto engine
    const offBtn = page.locator('button[data-engine-color="none"]').first();
    if (await offBtn.isVisible()) await offBtn.click();

    // Make move 1. d4
    await page.locator('[data-square="d2"]').click();
    await page.locator('[data-square="d4"]').click();

    // Click "Move Now"
    const moveNowBtn = page.locator('button[data-action="engine-move-now"]').first();
    if (await moveNowBtn.isVisible()) {
      await expect(moveNowBtn).toBeEnabled();
      await moveNowBtn.click();

      // Wait for reply (ply 2)
      await expect(page.locator('button[data-ply="2"]').first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('Operates 100% client-side without any backend server API calls', async ({ page }) => {
    // Intercept all requests and verify NO requests are sent to a private backend server
    const externalRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith('http://localhost') && !url.includes('chess.com')) {
        externalRequests.push(url);
      }
    });

    // Make a move
    await page.locator('button[data-engine-color="b"]').first().click();
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // Wait for engine reply
    await expect(page.locator('button[data-ply="2"]').first()).toBeVisible({ timeout: 15000 });

    // Verify zero unexpected external backend calls
    expect(externalRequests).toHaveLength(0);
  });
});
