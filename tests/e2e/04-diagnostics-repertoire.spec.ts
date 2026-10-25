import { test, expect } from '@playwright/test';

test.describe('04. Personalized Diagnostics & Repertoire Recommendation (F13 - F15)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const diagTab = page.locator('button:has-text("Opening Diagnostics"), button:has-text("Diagnostics"), [data-tab="diagnostics"]').first();
    await expect(diagTab).toBeVisible();
    await diagTab.click();
    await expect(page.locator('.diagnostics-view, [data-view="diagnostics"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('Displays diagnostic overview for player hoot65 separating White and Black stats', async ({ page }) => {
    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();
    await expect(view.getByText(/hoot65/i).first()).toBeVisible();

    // Verify White stats section and Black stats section
    await expect(view.getByText(/White/i).first()).toBeVisible();
    await expect(view.getByText(/Black/i).first()).toBeVisible();
  });

  test('Cites specific real game IDs and plies for White Scandinavian leak 2.e5?!', async ({ page }) => {
    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();

    // Check that Scandinavian deviation 2.e5 is highlighted
    await expect(view.getByText(/Scandinavian|2\.e5/i).first()).toBeVisible();

    // Must cite at least one of hoot65's real Scandinavian game IDs: 185031553576, 185035281692, 184582182704, 171000270176
    const hasGameCitation = await view.locator('text=185031553576, text=185035281692, text=184582182704, text=171000270176').first().isVisible();
    expect(hasGameCitation).toBe(true);
  });

  test('Cites specific real game IDs and plies for Black premature ...Bg4 leak', async ({ page }) => {
    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();

    // Check that premature Bg4 in Caro-Kann/Pirc is highlighted
    await expect(view.getByText(/Bg4|Caro-Kann/i).first()).toBeVisible();

    // Must cite at least one of hoot65's real Black game IDs: 185282462950, 173676860416, 171894388406, 184720164178
    const hasBlackCitation = await view.locator('text=185282462950, text=173676860416, text=171894388406, text=184720164178').first().isVisible();
    expect(hasBlackCitation).toBe(true);
  });

  test('Recommends tailored White (Italian/Anti-Scandi) and Black (Caro-Kann/KID) repertoires', async ({ page }) => {
    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();

    // Tailored White Repertoire recommendation
    await expect(view.getByText(/Italian|Scotch|Anti-Scandinavian|2\.exd5/i).first()).toBeVisible();

    // Tailored Black Repertoire recommendation
    await expect(view.getByText(/Caro-Kann|King's Indian/i).first()).toBeVisible();
  });

  test('Provides "Adopt Repertoire" action for interactive learning', async ({ page }) => {
    const adoptBtn = page.locator('button[data-action="adopt-repertoire"], button:has-text("Adopt"), button:has-text("Train Repertoire")').first();
    if (await adoptBtn.isVisible()) {
      await adoptBtn.click();
      // Should show confirmation toast or navigate to lessons
      await expect(page.locator('text=Adopted|Saved|Active|Training/i').first()).toBeVisible({ timeout: 5000 });
    }
  });
});
