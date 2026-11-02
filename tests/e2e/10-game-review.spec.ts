import { test, expect } from '@playwright/test';

// The seed game vs chestrine2 (2026-05-02): hoot65 has Black, plays 23...Nxh3+ with 23...Qxg2# on the
// board, and loses. The review finds that move with Maia and, when the model cannot load, with the
// material search alone, so the test holds either way.
const GAME = 'chesscom:23e807b0-45fc-11f1-80e2-8556be01000f';

test.describe('10. Post-game review (CL-3)', () => {
  test('marks first, then the engine review beside the marks, the cards in Today\'s session, and a saved review', async ({ page }) => {
    // Maia loads in the engine worker (22 MB) and scores 54 positions before the reveal
    test.setTimeout(180_000);
    await page.goto('/');
    await page.locator('[data-tab="database"]').click();
    const row = page.locator(`[data-game-id="${GAME}"]`);
    await row.scrollIntoViewIfNeeded();
    await row.click();

    const panel = page.locator('[data-section="game-review"]');
    await expect(panel).toHaveAttribute('data-review-phase', 'idle');
    await panel.locator('[data-action="review-start"]').click();
    await expect(panel).toHaveAttribute('data-review-phase', 'marking');

    // Marking needs one of hoot65's moves on the board
    await expect(panel.locator('[data-action="review-mark"]')).toBeDisabled();
    for (let i = 0; i < 44; i++) await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Ply 44 / 54')).toBeVisible();
    await expect(panel.locator('[data-action="review-mark"]')).toHaveText('Mark 22...Nf4 as a mistake');
    await panel.locator('[data-action="review-mark"]').click();
    await panel.locator('[data-input="review-reason"]').fill('missed something on the kingside');
    // Typing the reason does not step through the game
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('Ply 44 / 54')).toBeVisible();

    // The engine's moments only now, with the mark beside them
    await panel.locator('[data-action="review-reveal"]').click();
    await expect(panel).toHaveAttribute('data-review-phase', 'revealed', { timeout: 150_000 });
    await expect(panel.locator('[data-review-moment="45"]')).toHaveAttribute('data-moment-type', 'missed_mate');
    await expect(panel.locator('[data-review-moment="45"]')).toContainText('23...Qxg2#');
    await expect(panel.getByText('missed something on the kingside')).toBeVisible();
    const cards = Number(await panel.locator('[data-review-cards]').getAttribute('data-review-cards'));
    expect(cards).toBeGreaterThan(0);

    // A moment shows its position: the board goes to the move before the mistake
    await panel.locator('[data-review-moment="45"] button').first().click();
    await expect(page.getByText('Ply 45 / 54')).toBeVisible();

    // Saved: the game opens on its review
    await page.keyboard.press('Escape');
    await row.click();
    await expect(panel).toHaveAttribute('data-review-phase', 'revealed');
    await page.keyboard.press('Escape');

    // The mistakes come first among the new cards of Today's session
    await page.locator('[data-tab="lessons"]').click();
    await page.locator('button[data-action="review-due"]').click();
    await expect(page.locator('h3').first()).toContainText('Your game vs chestrine2, move');

    // A moment can be played again against Maia, from the move before it, on the Play tab
    await page.locator('[data-tab="database"]').click();
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await expect(panel).toHaveAttribute('data-review-phase', 'revealed');
    await panel.locator('[data-review-moment="45"] [data-action="review-spar"]').click();
    const spar = page.locator('[data-section="spar"]');
    await expect(spar).toBeVisible();
    await expect(spar).toContainText('Your game vs chestrine2, move 23');
    await expect(spar).toContainText('Play on from your game');
    await expect(spar).toContainText('You have Black against Maia 1100');
    await expect(page.getByText('45 plies')).toBeVisible();
  });
});
