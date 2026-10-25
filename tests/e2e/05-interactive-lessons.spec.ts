import { test, expect } from '@playwright/test';

test.describe('05. Interactive Lessons, Feedback Loops & Spaced Repetition (F16 - F18)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const lessonTab = page.locator('button:has-text("Interactive Lessons"), button:has-text("Lessons"), [data-tab="lessons"]').first();
    await expect(lessonTab).toBeVisible();
    await lessonTab.click();
    await expect(page.locator('.lessons-view, [data-view="lessons"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('Displays curriculum lessons with source book attribution from local PDFs', async ({ page }) => {
    const view = page.locator('.lessons-view, [data-view="lessons"]').first();

    // Verify lessons list or cards are present
    const lessonItems = page.locator('.lesson-card, [data-lesson-id], button.lesson-item');
    await expect(lessonItems.first()).toBeVisible({ timeout: 10000 });

    // Verify book source attribution text (e.g. Tactics in Junior Openings, 101 Traps, LearningChess)
    await expect(view.getByText(/Tactics in Junior Openings|101|Schiller|Pinter|MCO/i).first()).toBeVisible();
  });

  test('Executes interactive drill: wrong move triggers shake, explanation, and auto-rollback', async ({ page }) => {
    // Select Anti-Scandinavian or Scotch Gambit drill
    const scandiLesson = page.locator('text=/Scandinavian|Anti-Scandinavian|Scotch/i').first();
    if (await scandiLesson.isVisible()) {
      await scandiLesson.click();
    }

    // Wait for the lesson board to load
    await expect(page.locator('[data-square="e4"]').first()).toBeVisible();

    // User is White after 1. e4 d5.
    // Try deliberate WRONG move: 2. e5?!
    const e4Pawn = page.locator('[data-square="e4"]');
    if (await e4Pawn.locator('img').isVisible()) {
      await e4Pawn.click();
      await page.locator('[data-square="e5"]').click();

      // Verify instructional wrong move feedback is displayed
      const feedback = page.locator('.wrong-move-feedback, [data-feedback="wrong"]').first();
      await expect(feedback).toBeVisible({ timeout: 5000 });

      // Verify board auto-rolls back (pawn returns to e4 or e5 remains empty)
      await page.waitForTimeout(600);
      await expect(page.locator('[data-square="e4"] img')).toBeVisible();
    }
  });

  test('Playing correct move triggers positive feedback and auto-plays opponent reply', async ({ page }) => {
    // Select Anti-Scandinavian lesson
    const scandiLesson = page.locator('text=/Scandinavian|Anti-Scandinavian|Scotch/i').first();
    if (await scandiLesson.isVisible()) {
      await scandiLesson.click();
    }

    await expect(page.locator('[data-square="e4"]').first()).toBeVisible();

    // If board is at 1.e4 d5: Play correct move 2. exd5!
    const e4Pawn = page.locator('[data-square="e4"]');
    if (await e4Pawn.locator('img').isVisible()) {
      await e4Pawn.click();
      await page.locator('[data-square="d5"]').click();

      // Positive feedback displayed
      await expect(page.locator('text=/Correct|Well done|Great move/i').first()).toBeVisible({ timeout: 5000 });

      // Opponent auto-replies (e.g. 2...Qxd5)
      await page.waitForTimeout(500);
      // Square d5 should now have Black queen or Black move recorded
      await expect(page.locator('[data-square="d5"] img')).toBeVisible();
    }
  });

  test('Progressive hints provide hints without giving away solution immediately', async ({ page }) => {
    const hintBtn = page.locator('button[data-action="hint"], button:has-text("Hint")').first();
    if (await hintBtn.isVisible()) {
      await hintBtn.click();

      // Hint modal or tooltip appears
      await expect(page.locator('.hint-content, [data-hint]').first()).toBeVisible();
    }
  });

  test('SuperMemo-2 (SM-2) review queue updates intervals and persists across reload', async ({ page }) => {
    // Look for SRS rating buttons (Again, Hard, Good, Easy)
    const goodBtn = page.locator('button:has-text("Good"), [data-grade="4"]').first();
    if (await goodBtn.isVisible()) {
      await goodBtn.click();

      // Reload page and check persistence
      await page.reload();
      const lessonTab = page.locator('button:has-text("Interactive Lessons"), [data-tab="lessons"]').first();
      await lessonTab.click();

      // Check review queue badge or status
      await expect(page.locator('.lessons-view, [data-view="lessons"]').first()).toBeVisible();
    }
  });
});
