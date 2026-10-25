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

  test('Executes interactive drill: wrong move triggers shake, explanation, refutation playback and auto-rollback', async ({ page }) => {
    // The Scandinavian drill opens at its drill point (after 1.e4 d5) with a White pawn on e4
    await page.locator('[data-lesson-id="lesson-scandinavian-refutation-drill"]').click();
    const e4Pawn = page.locator('[data-square="e4"]');
    await expect(e4Pawn.locator('img')).toBeVisible();

    // Deliberate WRONG move: 2. e5?!
    await e4Pawn.click();
    await page.locator('[data-square="e5"]').click();

    // Specific instructional feedback names the game the habit comes from
    const feedback = page.locator('.wrong-move-feedback, [data-feedback="wrong"]').first();
    await expect(feedback).toBeVisible({ timeout: 5000 });
    await expect(feedback).toContainText(/meny_26/);

    // The board shakes, then the refutation (2...d4) is played out before everything rolls back
    await expect(page.locator('.animate-shake')).toHaveCount(1);
    await expect(page.locator('[data-square="d4"] img')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-square="e4"] img')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-square="d5"] img')).toBeVisible();
    await expect(page.locator('[data-run-stats]')).toContainText(/1 slip/);
  });

  test('Playing correct move triggers positive feedback, auto-plays the opponent reply and shows its idea', async ({ page }) => {
    await page.locator('[data-lesson-id="lesson-scandinavian-refutation-drill"]').click();
    const e4Pawn = page.locator('[data-square="e4"]');
    await expect(e4Pawn.locator('img')).toBeVisible();

    // Correct move 2. exd5!
    await e4Pawn.click();
    await page.locator('[data-square="d5"]').click();

    await expect(page.locator('text=/Correct|Well done|Great move/i').first()).toBeVisible({ timeout: 5000 });

    // Opponent auto-replies 2...Qxd5 (Black queen on d5) and the scripted reply is explained
    await expect(page.locator('[data-square="d5"] img[alt="Black q"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-feedback="opponent-idea"]')).toContainText(/queen/i);

    // Playing 3.Nc3 reveals the authored arrow on the board after the move
    await page.locator('[data-square="b1"]').click();
    await page.locator('[data-square="c3"]').click();
    await expect(page.locator('[data-overlay="cues"] [data-arrow="c3d5"]')).toBeVisible({ timeout: 3000 });
  });

  test('Progressive hints go theme, then piece, then square, and never print the move', async ({ page }) => {
    await page.locator('[data-lesson-id="lesson-scandinavian-refutation-drill"]').click();
    await expect(page.locator('[data-square="e4"] img')).toBeVisible();

    const hintBtn = page.locator('button[data-action="hint"]').first();
    await hintBtn.click();
    const hint = page.locator('.hint-content, [data-hint="active"]').first();
    await expect(hint).toBeVisible();
    await expect(hint).toHaveAttribute('data-hint-level', '1');
    await expect(hint).not.toContainText('exd5');

    await hintBtn.click();
    await expect(hint).toHaveAttribute('data-hint-level', '2');
    await expect(hint).toContainText(/Pawn on e4/);
    await expect(hint).not.toContainText('exd5');

    await hintBtn.click();
    await expect(hint).toHaveAttribute('data-hint-level', '3');
    await expect(hint).toContainText('d5');
    await expect(hint).not.toContainText('exd5');
  });

  test('Spaced repetition: grading is gated until the lesson is complete, inferred from the run, and persists across reload', async ({ page }) => {
    // Grade buttons are disabled before any lesson is completed
    const goodBtn = page.locator('[data-grade="4"]').first();
    await expect(goodBtn).toBeDisabled();

    // Complete the one-move stalemate lesson: 1.Qd8# from d6, then its exercise, then finish
    await page.locator('[data-lesson-id="lesson-stalemate-catastrophes"]').click();
    await expect(page.locator('[data-square="d6"] img[alt="White q"]')).toBeVisible();
    await page.locator('[data-square="d6"]').click();
    await page.locator('[data-square="d8"]').click();
    await expect(page.locator('text=/Correct|Well done|Great move/i').first()).toBeVisible({ timeout: 5000 });

    await expect(page.locator('[data-exercise]')).toBeVisible();
    await page.locator('[data-square="d6"]').click();
    await page.locator('[data-square="d8"]').click();
    await page.locator('button[data-action="next-exercise"]').click();

    // Now the lesson is complete: a clean run suggests "Easy" and every lower grade is allowed
    await expect(page.getByText('Lesson Completed!')).toBeVisible();
    await expect(page.getByText(/Suggested from this run: Easy/)).toBeVisible();
    await expect(goodBtn).toBeEnabled();
    await goodBtn.click();
    await expect(page.locator('[data-srs-message]')).toContainText(/Rated Good: Scheduled next review in 1 day/);
    await expect(goodBtn).toBeDisabled();

    // Reload: the card state survives in IndexedDB
    await page.reload();
    const lessonTab = page.locator('button:has-text("Interactive Lessons"), [data-tab="lessons"]').first();
    await lessonTab.click();
    await page.locator('[data-lesson-id="lesson-stalemate-catastrophes"]').click();
    await expect(page.getByText(/Box 1 \/ 5/)).toBeVisible();
    await expect(page.getByText(/1 day\(s\)/).first()).toBeVisible();
  });

  test('Black-perspective lessons play the opponent\'s first move for the student', async ({ page }) => {
    await page.locator('[data-course="pattern-library"]').click();
    await page.locator('[data-lesson-id="lesson-siberian-trap"]').click();

    // 1.e4 is played automatically; Black (the student) is to move and the board is flipped
    await expect(page.locator('[data-square="e4"] img[alt="White p"]')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/Your turn: find Black/)).toBeVisible();
  });
});
