import { test, expect } from '@playwright/test';

// Deep links (DC-5): the hash opens a tab, a lesson or a position, and follows what is on screen
test.describe('11. Deep links', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('my_chess_cct_gate', 'off'));
  });

  test('a lesson link opens that lesson, and the hash follows the lesson and the tab', async ({ page }) => {
    await page.goto('/#/lesson/lesson-rook-back-rank-mate');
    await expect(page.locator('.lessons-view, [data-view="lessons"]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Checkmate with the Rook: The Back-Rank Cage').first()).toBeVisible();
    // The rook mate starts with the white king on e1 and the rook on h1
    await expect(page.locator('[data-square="h1"] img[alt="White r"]')).toBeVisible();
    await expect(page).toHaveURL(/#\/lesson\/lesson-rook-back-rank-mate$/);

    await page.locator('[data-lesson-id="lesson-legals-mate"]').first().click();
    await expect(page).toHaveURL(/#\/lesson\/lesson-legals-mate$/);
    await page.locator('[data-tab="diagnostics"]').click();
    await expect(page).toHaveURL(/#\/diagnostics$/);

    // Back to a lesson link while the app is open
    await page.evaluate(() => (window.location.hash = '#/lesson/lesson-queen-cage-box-mate'));
    await expect(page.locator('[data-square="f1"] img[alt="White q"]')).toBeVisible();
  });

  test('a game link opens the stored game\'s replay and review on the Games tab', async ({ page }) => {
    const id = 'chesscom:23e807b0-45fc-11f1-80e2-8556be01000f';
    await page.goto(`/#/game/${encodeURIComponent(id)}`);
    await expect(page.locator('[data-modal="replay"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-modal="replay"] [data-section="game-review"]')).toBeVisible();
  });

  test('a position link opens it on the Play tab from the given side', async ({ page }) => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
    await page.goto(`/#/play?fen=${encodeURIComponent(fen)}&color=b`);
    await expect(page.locator('[data-square="c4"] img[alt="White b"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-square="c6"] img[alt="Black n"]')).toBeVisible();
    // Black's side at the bottom: a8 is in the last row of squares, h1 in the first
    const squares = page.locator('[data-square]');
    await expect(squares.first()).toHaveAttribute('data-square', 'h1');
  });
});
