import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test.describe('04. Personalized Diagnostics & Repertoire Recommendation (F13 - F15)', () => {
  test.beforeEach(async ({ page }) => {
    // These tests drive lesson moves; the board question before each move (CL-5) is tested on its own, with it on
    await page.addInitScript(() => window.localStorage.setItem('my_chess_cct_gate', 'off'));
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
    await expect(view.getByText(/185031553576|185035281692|184582182704|171000270176/).first()).toBeVisible({ timeout: 15000 });
    await expect(view.getByText(/Ply 3: e5\?!/).first()).toBeVisible();
    await expect(view.getByText(/Better: exd5!/).first()).toBeVisible();
  });

  test('Cites specific real game IDs and plies for the Black early-queen leak, with measured impact', async ({ page }) => {
    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();

    // The early queen sortie is the measured Black leak (e.g. ...Qa5 / ...Qb6 before the minor pieces)
    await expect(view.getByText(/Queen out before the minor pieces/i).first()).toBeVisible();

    // Must cite real Black games from the archive where the queen came out early
    await expect(view.getByText(/171894388406|185129553252|168910457740|185346239794/).first()).toBeVisible({ timeout: 15000 });

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
    await expect(pattern.getByText('info', { exact: true })).toBeVisible();
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

  test('Adopt Repertoire remembers the plan and opens its first line as a lesson', async ({ page }) => {
    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();
    await view.getByText('Tailored Opening Repertoires').click();

    const adoptBtn = page.locator('button[data-action="adopt-repertoire"]').first();
    await expect(adoptBtn).toBeVisible();
    await expect(adoptBtn).toHaveAttribute('data-adopted', 'false');
    await adoptBtn.click();

    // The White plan's first line is the Anti-Scandinavian: its drill opens at the drill point (after 1.e4 d5)
    await expect(page.locator('.lessons-view, [data-view="lessons"]').first()).toBeVisible();
    await expect(page.locator('[data-lesson-id="lesson-scandinavian-refutation-drill"]')).toHaveClass(/border-emerald-500/);
    await expect(page.locator('[data-square="d5"] img')).toBeVisible();
  });

  test('Where you leave the repertoire: the first move off the plan becomes a one-decision drill', async ({ page }) => {
    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();
    const section = view.locator('[data-section="repertoire-leaks"]');
    await expect(section).toBeVisible();
    // The archive's 2.e5?! Scandinavians leave the plan at ply 3 (2.exd5 is the book move)
    const scandi = section.locator('[data-repertoire-leak="e5"]');
    await expect(scandi).toBeVisible({ timeout: 10000 });
    await expect(scandi).toContainText('Ply 3: e5?!');
    await expect(scandi).toContainText('exd5!');

    await scandi.locator('button[data-action="practice-deviation"]').click();

    // A drill at that very position: White to move after 1.e4 d5, the answer never printed in the title
    await expect(page.locator('.lessons-view, [data-view="lessons"]').first()).toBeVisible();
    await expect(page.locator('h3').first()).toContainText(/Repertoire drill/);
    await expect(page.locator('h3').first()).not.toContainText('exd5');
    await expect(page.locator('[data-square="d5"] img[alt="Black p"]')).toBeVisible();
    await expect(page.locator('[data-square="e4"] img[alt="White p"]')).toBeVisible();
    await page.locator('[data-square="e4"]').click();
    await page.locator('[data-square="d5"]').click();
    await expect(page.locator('.correct-feedback')).toBeVisible();
    await expect(page.locator('[data-review-log] [data-rating]')).toHaveCount(1);
  });

  test('Your mistake patterns: the reviewed games counted, and a batch review of the newest unreviewed games (CL-3)', async ({ page }) => {
    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();
    await view.locator('[data-diag-tab="mistakes"]').click();
    const panel = page.locator('[data-section="mistake-patterns"]');
    await expect(panel).toBeVisible();
    // A fresh profile has no review yet
    await expect(panel.locator('[data-section="mistake-summary"]')).toHaveAttribute('data-games', '0');
    // Every seed game of hoot65's with ten plies or more is waiting for a review
    const seed: Array<{ movesSan: string[]; userColor?: string }> = JSON.parse(readFileSync('src/data/seed_hoot65_games.json', 'utf8'));
    const waiting = seed.filter((g) => g.userColor && g.movesSan.length >= 10).length;
    await expect(panel.locator('[data-batch-status]')).toHaveText(`${waiting} of your games are not reviewed yet.`, { timeout: 15000 });
    await expect(panel.locator('[data-action="batch-review"]')).toBeEnabled();
    await expect(panel.locator('select[data-select="batch-size"]')).toHaveValue('10');
    // The habit scorecard reads the opening habits from every game; the board habit waits for reviews
    const habits = panel.locator('[data-section="habits"]');
    for (const key of ['castled', 'developed', 'queen_home']) {
      await expect(habits.locator(`[data-habit="${key}"]`)).toHaveAttribute('data-rate', /^0\.\d{3}$/);
    }
    await expect(habits.locator('[data-habit="nothing_hung"]')).toContainText('review some games first');
    // Kept a three-point lead for ten moves: 88 of the 116 seed games with such a lead
    await expect(habits.locator('[data-habit="kept_lead"]')).toHaveAttribute('data-rate', '0.759');
  });

  test('Where your points go: the archive analysis on the first tab, each habit linked to its drill (DC-8)', async ({ page }) => {
    const card = page.locator('[data-section="points"]');
    await expect(card.locator('[data-points-row]')).toHaveCount(6);
    await expect(card.locator('[data-points-row="hang"]')).toContainText('5.7');
    await card.locator('[data-points-clock="clock"]').click();
    await expect(page.locator('[data-section="clock-panel"]')).toBeVisible();
    await page.locator('[data-view="diagnostics"] .overflow-x-auto > button').first().click();
    await card.locator('[data-points-train="hang"]').click();
    await expect(page).toHaveURL(/#\/lesson\/lesson-game-/);
    await expect(page.locator('[data-view="lessons"]')).toBeVisible();
  });

  test('Your clock: games lost on time, the pace against the opponents, and the games lost on time while ahead (DC-3)', async ({ page }) => {
    const view = page.locator('.diagnostics-view, [data-view="diagnostics"]').first();
    await view.locator('[data-diag-tab="clock"]').click();
    const clock = page.locator('[data-section="clock-panel"] [data-section="clock"]');
    // The seed: 300 games at 10+0 with clock times; hoot65 lost 25 on time, the opponents 5
    await expect(clock).toHaveAttribute('data-games', '300', { timeout: 15000 });
    await expect(clock).toHaveAttribute('data-lost-on-time', '25');
    await expect(clock).toHaveAttribute('data-won-on-time', '5');
    await expect(clock.locator('[data-pace-move]')).toHaveCount(4);
    await expect(clock.locator('[data-lost-ahead]')).toHaveCount(5);
    await expect(clock.locator('[data-section="clock-advice"]')).toContainText('cap a think at 30 seconds');
    // How the games end: 89 resignations, 38 with less than a rook down and no mate in one coming; the newest can be played on against Maia
    const endings = page.locator('[data-section="endings"]');
    await expect(endings).toHaveAttribute('data-resigned', '89');
    await expect(endings).toHaveAttribute('data-resigned-early', '38');
    // All 301 games here: the 26th time loss is the one 3+2 game, which the clock section leaves out
    await expect(endings.locator('[data-ending="loss-time"]')).toHaveAttribute('data-count', '26');
    await expect(endings.locator('[data-resigned-early]')).toHaveCount(10);
    await expect(endings.locator('[data-resigned-early] [data-action="ending-replay"]').first()).toHaveAttribute('href', /^#\/game\/chesscom%3A/);
    await endings.locator('[data-resigned-early] [data-action="ending-spar"]').first().click();
    const spar = page.locator('[data-section="spar"]');
    await expect(spar).toBeVisible();
    await expect(spar).toContainText('Play on from your game');
    await expect(spar).toContainText('play on from the end');
  });
});
