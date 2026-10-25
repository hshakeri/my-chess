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
    // (the archive is read from IndexedDB, so wait for the report rather than probing synchronously)
    await expect(view.getByText(/185031553576|185035281692|184582182704|171000270176/).first()).toBeVisible();
    await expect(view.getByText(/Ply 3: e5\?!/).first()).toBeVisible();
    await expect(view.getByText(/Better: exd5!/).first()).toBeVisible();
  });

  test('Cites specific real game IDs and plies for the Black early-queen leak, with measured impact', async ({ page }) => {
    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();

    // The early queen sortie is the measured Black leak (e.g. ...Qa5 / ...Qb6 before the minor pieces)
    await expect(view.getByText(/Queen out before the minor pieces/i).first()).toBeVisible();

    // Must cite real Black games from the archive where the queen came out early
    await expect(view.getByText(/171894388406|185129553252|168910457740|185346239794/).first()).toBeVisible();

    // Impact is measured from the archive, never a constant evaluation
    await expect(view.getByText(/Score impact:/).first()).toBeVisible();
    await expect(view.getByText('+1.20')).toHaveCount(0);

    // The report covers the whole archive, with nothing injected
    await expect(view.locator('[data-stat="games-analyzed"]')).toHaveText(/^\d+$/);
    const analyzed = Number(await view.locator('[data-stat="games-analyzed"]').textContent());
    expect(analyzed).toBeGreaterThanOrEqual(301);
  });

  test('Shows the ...Bg4 habit as measured information rather than a fabricated leak', async ({ page }) => {
    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();
    const pattern = view.locator('[data-pattern="black-bg4-chase"]');
    await expect(pattern).toBeVisible();
    await expect(pattern.getByText(/Bg4/).first()).toBeVisible();
    await expect(pattern.getByText(/games, score/).first()).toBeVisible();
    await expect(pattern.getByText(/not costing points so far/).first()).toBeVisible();
    await expect(pattern.getByText('info')).toBeVisible();
  });

  test('Recommends tailored White (Italian/Anti-Scandi) and Black (Caro-Kann/KID) repertoires', async ({ page }) => {
    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();

    // Tailored White Repertoire recommendation
    await expect(view.getByText(/Italian|Scotch|Anti-Scandinavian|2\.exd5/i).first()).toBeVisible();

    // Tailored Black Repertoire recommendation
    await expect(view.getByText(/Caro-Kann|King's Indian/i).first()).toBeVisible();
  });

  test('Practice Line hands the selected repertoire line over to the matching lesson', async ({ page }) => {
    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();
    await view.getByText('Tailored Opening Repertoires').click();

    const practiceBtn = page.locator('button[data-action="practice-line"]').first();
    await expect(practiceBtn).toBeVisible();
    await practiceBtn.click();

    // The Anti-Scandinavian line opens the Scandinavian drill at its drill point (after 1.e4 d5)
    await expect(page.locator('.lessons-view, [data-view="lessons"]').first()).toBeVisible();
    await expect(page.locator('[data-lesson-id="lesson-scandinavian-refutation-drill"]')).toHaveClass(/border-emerald-500/);
    await expect(page.locator('[data-square="d5"] img')).toBeVisible();
  });

  test.fixme('Provides an "Adopt Repertoire" action that saves the plan (roadmap CL-4)', async () => {
    // Implemented with repertoire divergence detection; see docs/pedagogy-audit.md, item CL-4.
  });
});
