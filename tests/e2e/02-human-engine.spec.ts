import { test, expect } from '@playwright/test';

test.describe('02. Human-Like Maia Engine Opponent (F05 - F06)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-tab="play"]').click();
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
    await page.locator('button[data-action="new-game"]').click();

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
    await page.locator('button[data-engine-color="none"]').click();

    // Make move 1. d4
    await page.locator('[data-square="d2"]').click();
    await page.locator('[data-square="d4"]').click();

    // Click "Move Now"
    const moveNowBtn = page.locator('button[data-action="engine-move-now"]');
    await expect(moveNowBtn).toBeEnabled();
    await moveNowBtn.click();

    // Wait for reply (ply 2)
    await expect(page.locator('button[data-ply="2"]').first()).toBeVisible({ timeout: 15000 });
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

// QW-6: the deploy no longer carries public/wasm (26 runtime files, 99 MB). The runtime must still find
// the one wasm file it needs, beside its own bundle, and the model must load from the site's base path.
test('02. The Maia model loads with one ONNX runtime wasm file, served by the site itself', async ({ page }) => {
  test.setTimeout(90000);
  const requests: string[] = [];
  // The context sees the engine worker's requests too, not only the page's
  page.context().on('request', (req) => requests.push(req.url()));

  await page.goto('/');
  await expect(page.getByText('Maia Neural ONNX')).toBeVisible({ timeout: 60000 });

  const paths = requests.filter((u) => u.startsWith('http')).map((u) => new URL(u).pathname);
  const wasm = paths.filter((p) => p.endsWith('.wasm'));
  expect(wasm).toHaveLength(1);
  expect(wasm[0]).toMatch(/ort-wasm-simd-threaded\.jsep[^/]*\.wasm$/);
  expect(paths.filter((p) => p.startsWith('/my-chess/wasm/'))).toEqual([]);
  expect(paths).toContain('/my-chess/models/maia3_5m.onnx');
  expect(requests.filter((u) => u.startsWith('http') && !u.startsWith('http://localhost'))).toEqual([]);
});
