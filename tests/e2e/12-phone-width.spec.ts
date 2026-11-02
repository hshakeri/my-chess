import { test, expect, type Page } from '@playwright/test';

/**
 * No view scrolls sideways on a narrow phone. The viewport is not a mobile one on purpose: a mobile
 * browser widens the layout to fit content that overflows (and zooms out), so there the page width
 * always equals the window width and an overflow cannot be seen that way.
 */
test.describe('12. Every view fits a 375-pixel phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  const pageWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

  test('Play, Lessons, Games, Diagnostics (every tab) and Worksheets have no horizontal scroll', async ({ page }) => {
    // Nine screens, and Diagnostics analyses the whole archive: more than the default 30 s on a slow runner
    test.setTimeout(90_000);
    await page.addInitScript(() => window.localStorage.setItem('my_chess_cct_gate', 'off'));
    for (const route of ['play', 'lessons', 'database', 'worksheets']) {
      await page.goto(`/#/${route}`);
      await expect(page.locator('[data-tab]').first()).toBeVisible();
      await page.waitForTimeout(300);
      expect(await pageWidth(page), route).toBeLessThanOrEqual(375);
    }
    await page.goto('/#/diagnostics');
    const view = page.locator('[data-view="diagnostics"]');
    await expect(view.locator('[data-stat="games-analyzed"]')).toHaveText('301', { timeout: 15000 });
    const tabs = view.locator('.overflow-x-auto > button');
    await expect(tabs).toHaveCount(5);
    for (let k = 0; k < 5; k++) {
      await tabs.nth(k).click();
      await page.waitForTimeout(300);
      expect(await pageWidth(page), `diagnostics tab ${k + 1}`).toBeLessThanOrEqual(375);
    }
  });
});
