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

    // Deliberate WRONG move: 2. e5?!  The board shakes at once...
    await e4Pawn.click();
    await page.locator('[data-square="e5"]').click();
    await expect(page.locator('.animate-shake')).toHaveCount(1);

    // ...specific instructional feedback names the game the habit comes from...
    const feedback = page.locator('.wrong-move-feedback, [data-feedback="wrong"]').first();
    await expect(feedback).toBeVisible({ timeout: 5000 });
    await expect(feedback).toContainText(/meny_26/);

    // ...then the refutation (2...d4) is played out before everything rolls back
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

  test('Spaced repetition: each decision is scheduled on its own card as it is played, and the schedule persists across reload', async ({ page }) => {
    // No self-grade bar: the rating is inferred from the run
    await expect(page.locator('[data-grade]')).toHaveCount(0);

    // Every card starts due today (the count appears once the cards have been created and counted)
    const dueBtn = page.locator('button[data-action="review-due"]');
    await expect(dueBtn).toContainText(/Due today: [1-9]\d*/);
    const dueBefore = Number((await dueBtn.textContent())!.match(/\d+/)![0]);

    // Complete the one-move stalemate lesson: 1.Qd8# from d6, then its exercise, then finish
    await page.locator('[data-lesson-id="lesson-stalemate-catastrophes"]').click();
    await expect(page.locator('[data-lesson-cards]')).toHaveAttribute('data-lesson-cards', '1');
    await expect(page.locator('[data-square="d6"] img[alt="White q"]')).toBeVisible();
    await page.locator('[data-square="d6"]').click();
    await page.locator('[data-square="d8"]').click();
    await expect(page.locator('text=/Correct|Well done|Great move/i').first()).toBeVisible({ timeout: 5000 });

    // The decision was reviewed the moment it was played: a clean first try is Good
    await expect(page.locator('[data-review-log] [data-rating="good"]')).toHaveCount(1);
    await expect(page.locator('[data-srs-message]')).toContainText(/Good: next review in/);

    await expect(page.locator('[data-exercise]')).toBeVisible();
    await page.locator('[data-square="d6"]').click();
    await page.locator('[data-square="d8"]').click();
    await page.locator('button[data-action="next-exercise"]').click();
    await expect(page.getByText('Lesson Completed!')).toBeVisible();
    // The exercise is not a card: still exactly one review this run
    await expect(page.locator('[data-review-log] [data-rating]')).toHaveCount(1);
    await expect(page.locator('[data-section="srs"]')).toContainText('1 decision scheduled this run: 1 good.');

    // Reload: the review survives in IndexedDB, so the card is no longer due and the queue is one shorter
    await page.reload();
    const lessonTab = page.locator('button:has-text("Interactive Lessons"), [data-tab="lessons"]').first();
    await lessonTab.click();
    await expect(page.locator('button[data-action="review-due"]')).toContainText(`Due today: ${dueBefore - 1}`);
    await page.locator('[data-lesson-id="lesson-stalemate-catastrophes"]').click();
    await expect(page.locator('[data-lesson-id="lesson-stalemate-catastrophes"]')).not.toContainText(/\bdue\b/);
    await expect(page.locator('[data-section="srs"]')).toContainText('Each decision you play is scheduled on its own card');
  });

  test("Today's session presents due positions one at a time and can be ended", async ({ page }) => {
    const dueBtn = page.locator('button[data-action="review-due"]');
    await expect(dueBtn).toContainText(/Due today: [1-9]\d*/);
    const due = Number((await dueBtn.textContent())!.match(/\d+/)![0]);

    await dueBtn.click();
    // The session is capped (at most 8 new cards and 30 reviews per day), so it holds at most `due` cards
    await expect(page.locator('[data-session-progress]')).toContainText(/card 1 of [1-9]\d*/);
    const total = Number((await page.locator('[data-session-progress]').textContent())!.match(/of (\d+)/)![1]);
    expect(total).toBeLessThanOrEqual(due);
    // A review card shows a position to solve, not a lesson title or the lesson tree
    await expect(page.locator('[data-square="e4"]').first()).toBeVisible();
    await expect(page.locator('[data-tree="lesson"]')).toHaveCount(0);
    await expect(page.locator('h3').first()).toContainText(/to move/);
    await expect(dueBtn).toBeDisabled();

    await page.locator('button[data-action="end-session"]').first().click();
    await expect(page.locator('[data-session-progress]')).toHaveCount(0);
    await expect(page.locator('[data-tree="lesson"]')).toBeVisible();
  });

  test('Opponent branches: the lesson tree lists the archive replies and the walk-through follows one of them', async ({ page }) => {
    await page.locator('[data-lesson-id="lesson-evans-gambit-destruction"]').click();
    const tree = page.locator('[data-tree="lesson"]');
    await expect(tree).toBeVisible();
    // After 3.Bc4 the archive's replies are branches with their shares
    await expect(tree.locator('[data-node="Nd4"][data-branch="true"]')).toHaveCount(1);
    await expect(tree.locator('[data-node="Nf6"][data-branch="true"]')).toHaveCount(1);
    await expect(tree.locator('[data-share]').first()).toBeVisible();

    // Play 1.e4 e5 2.Nf3 Nc6 3.Bc4: the reply is one of the known branches or the main line
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.locator('[data-square="e5"] img')).toBeVisible({ timeout: 3000 });
    await page.locator('[data-square="g1"]').click();
    await page.locator('[data-square="f3"]').click();
    await expect(page.locator('[data-square="c6"] img')).toBeVisible({ timeout: 3000 });
    await page.locator('[data-square="f1"]').click();
    await page.locator('[data-square="c4"]').click();
    // The first walk-through follows the scripted main line, so the reply is 3...Bc5 and the tree marks it
    const replyNode = page.locator('[data-tree="lesson"] [data-current="true"][data-role="opponent"]');
    await expect(replyNode).toHaveCount(1, { timeout: 3000 });
    await expect(replyNode).toHaveAttribute('data-node', 'Bc5');
    await expect(page.locator('[data-tree="lesson"] [data-current="true"]')).toHaveCount(1);

    // A restart re-rolls the opponent's replies by frequency: whatever comes after 3.Bc4 is a known reply
    await page.locator('button[data-action="restart"]').click();
    await expect(page.locator('[data-square="e2"] img[alt="White p"]')).toBeVisible();
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.locator('[data-square="e5"] img')).toBeVisible({ timeout: 3000 });
    await page.locator('[data-square="g1"]').click();
    await page.locator('[data-square="f3"]').click();
    await expect(page.locator('[data-square="c6"] img')).toBeVisible({ timeout: 3000 });
    await page.locator('[data-square="f1"]').click();
    await page.locator('[data-square="c4"]').click();
    await expect(replyNode).toHaveCount(1, { timeout: 3000 });
    expect(['Bc5', 'Nf6', 'Nd4', 'h6', 'd6', 'f5']).toContain(await replyNode.getAttribute('data-node'));
  });

  test('The lesson tree sits beside the board and clicking a node jumps to that position', async ({ page }) => {
    await page.locator('[data-lesson-id="lesson-evans-gambit-destruction"]').click();
    const board = page.locator('[data-section="board-column"]');
    const side = page.locator('[data-section="side-panel"]');
    await expect(board).toBeVisible();
    await expect(side.locator('[data-tree="lesson"]')).toBeVisible();
    // Side by side on a desktop viewport: the panel starts to the right of the board column
    const b = (await board.boundingBox())!;
    const s = (await side.boundingBox())!;
    expect(s.x).toBeGreaterThan(b.x + b.width - 1);

    await side.locator('[data-node="Nd4"] button[data-action="select-node"]').click();
    await expect(page.locator('[data-square="d4"] img[alt="Black n"]')).toBeVisible();
    await expect(page.locator('[data-tree="lesson"] [data-current="true"]')).toHaveAttribute('data-node', 'Nd4');
    await expect(page.getByText(/Your turn: find White/)).toBeVisible();
    await page.locator('[data-square="f3"]').click();
    await page.locator('[data-square="d4"]').click();
    await expect(page.locator('.correct-feedback')).toBeVisible();
  });

  test('Switching lesson during the exercise phase starts the new lesson cleanly on its own line', async ({ page }) => {
    await page.locator('[data-lesson-id="lesson-stalemate-catastrophes"]').click();
    await page.locator('[data-square="d6"]').click();
    await page.locator('[data-square="d8"]').click();
    await expect(page.locator('[data-exercise]')).toBeVisible();

    await page.locator('[data-lesson-id="lesson-legals-mate"]').click();

    // Legal's mate starts from the initial position in the line phase: nothing completed, grades gated
    await expect(page.locator('[data-square="e2"] img[alt="White p"]')).toBeVisible();
    await expect(page.locator('[data-exercise]')).toHaveCount(0);
    await expect(page.getByText('Lesson Completed!')).toHaveCount(0);
    await expect(page.locator('[data-review-log] [data-rating]')).toHaveCount(0);
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.locator('.correct-feedback')).toBeVisible();
  });

  test('Black-perspective lessons play the opponent\'s first move for the student', async ({ page }) => {
    await page.locator('[data-course="pattern-library"]').click();
    await page.locator('[data-lesson-id="lesson-siberian-trap"]').click();

    // 1.e4 is played automatically; Black (the student) is to move and the board is flipped
    await expect(page.locator('[data-square="e4"] img[alt="White p"]')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/Your turn: find Black/)).toBeVisible();
  });
});
