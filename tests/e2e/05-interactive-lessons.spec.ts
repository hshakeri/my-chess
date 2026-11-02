import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import type { GameDrill } from '../../src/curriculum/gameDrills';

// Read as a file: the test runner loads specs as ES modules, where a JSON import needs an attribute
const gameDrills: { threat: GameDrill[]; free: GameDrill[]; hang: GameDrill[]; mate: GameDrill[] } = JSON.parse(readFileSync('src/data/game_drills.json', 'utf8'));

test.describe('05. Interactive Lessons, Feedback Loops & Spaced Repetition (F16 - F18)', () => {
  test.beforeEach(async ({ page }) => {
    // These tests drive lesson moves; the board question before each move (CL-5) is tested on its own, with it on
    await page.addInitScript(() => window.localStorage.setItem('my_chess_cct_gate', 'off'));
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

  test('Drill positions from your games: a tile opens one, the game move shows its capture, a right move leads on', async ({ page }) => {
    // The newest threat drill, worked out from the data so a refreshed drill set keeps this test valid
    const d = gameDrills.threat[0];
    const board = new Chess(d.fenBefore);
    const last = board.move(d.lastSan);
    const played = new Chess(board.fen()).move(d.played);
    const right = new Chess(board.fen()).move(d.accepted[0]);
    const alt = (m: { color: string; piece: string }) => `${m.color === 'w' ? 'White' : 'Black'} ${m.piece}`;

    // The study path opens with the four sets as rows of numbered tiles
    const tiles = page.locator('[data-drill-set] [data-lesson-id]');
    await expect(tiles).toHaveCount(gameDrills.threat.length + gameDrills.free.length + gameDrills.hang.length + gameDrills.mate.length);
    await tiles.first().click();

    // The opponent's move is replayed; there is no lesson tree, which would print the answer
    await expect(page.locator(`[data-square="${last.to}"] img[alt="${alt(last)}"]`)).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-tree-root="lesson"]')).toHaveCount(0);
    await expect(page.locator('[data-feedback="opponent-idea"]')).toContainText('What does it attack?');

    // The move from the game is answered with what it cost, then rolled back
    await page.locator(`[data-square="${played.from}"]`).click();
    await page.locator(`[data-square="${played.to}"]`).click();
    await expect(page.locator('.wrong-move-feedback, [data-feedback="wrong"]').first()).toContainText(d.opponent, { timeout: 5000 });
    await expect(page.locator(`[data-square="${played.from}"] img[alt="${alt(played)}"]`)).toBeVisible({ timeout: 5000 });

    // A right answer finishes the position and offers the next one
    await page.locator(`[data-square="${right.from}"]`).click();
    await page.locator(`[data-square="${right.to}"]`).click();
    await expect(page.locator('[data-section="drill-next"]')).toContainText(`Position 1 of ${gameDrills.threat.length}`, { timeout: 5000 });
    await page.locator('button[data-action="next-drill"]').click();
    await expect(tiles.nth(1)).toHaveClass(/border-emerald-500/);
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

  test('With the switch on, a board question comes before each move: the board waits for the answer (CL-5)', async ({ page }) => {
    await page.locator('input[data-toggle="cct-gate"]').check();
    await page.locator('[data-lesson-id="lesson-scandinavian-refutation-drill"]').click();
    const question = page.locator('[data-section="board-question"]');
    await expect(question).toHaveAttribute('data-question-kind', 'attacks');
    await expect(question).toContainText('which of your pieces does d5 attack?');

    // The board waits for the answer
    await page.locator('[data-square="e4"]').click();
    await page.locator('[data-square="d5"]').click();
    await expect(page.locator('[data-square="e4"] img[alt="White p"]')).toBeVisible();

    // 1...d5 attacks only a pawn: the answer is Nothing
    await question.locator('button[data-action="question-none"]').click();
    await expect(question).toHaveAttribute('data-question-status', 'right');
    await page.locator('[data-square="e4"]').click();
    await page.locator('[data-square="d5"]').click();
    await expect(page.locator('.correct-feedback')).toBeVisible();

    // After the reply the next decision opens with a question about 2...Qxd5
    await expect(question).toHaveAttribute('data-question-status', 'asking', { timeout: 5000 });
    await expect(question).toContainText('Qxd5');
  });

  test('The two-minute warm-up asks board questions on positions from your games (CL-5)', async ({ page }) => {
    await page.locator('button[data-action="warmup"]').click();
    const modal = page.locator('[data-modal="warmup"]');
    await expect(modal).toBeVisible();
    const question = modal.locator('[data-section="board-question"]');
    await expect(question).toHaveAttribute('data-question-status', 'asking', { timeout: 10000 });
    // The kind of question is chosen at random: answer whichever it is
    const kind = await question.getAttribute('data-question-kind');
    expect(['knight', 'loose', 'safe', 'checks']).toContain(kind);
    if (kind === 'safe') await question.locator('button[data-answer="yes"]').click();
    else if (kind === 'checks') await question.locator('button[data-answer="0"]').click();
    else if (kind === 'loose') await question.locator('button[data-action="question-none"]').click();
    else {
      await modal.locator('[data-square="a1"]').click();
      await question.locator('button[data-action="question-done"]').click();
    }
    await expect(question).toHaveAttribute('data-question-status', /right|wrong/);
    await expect(modal.locator('[data-warmup-score]')).toContainText('of 1 right so far');
    await question.locator('button[data-action="question-next"]').click();
    await expect(question).toHaveAttribute('data-question-status', 'asking');
    await modal.locator('button[data-action="warmup-close"]').click();
    await expect(modal).toHaveCount(0);
  });

  test('Speed run: the lesson\'s line against the clock, the replies at once', async ({ page }) => {
    await page.locator('[data-lesson-id="lesson-scandinavian-refutation-drill"]').click();
    await page.locator('button[data-action="speed-run"]').click();
    const modal = page.locator('[data-modal="speed-run"]');
    await expect(modal).toHaveAttribute('data-speed-phase', 'ready');
    await modal.locator('button[data-action="speed-start"]').click();
    // The drill starts after 1.e4 d5: the student plays 2.exd5, and 2...Qxd5 comes at once
    await modal.locator('[data-square="e4"]').click();
    await modal.locator('[data-square="d5"]').click();
    await expect(modal.locator('[data-speed-move]')).toHaveCount(1);
    await expect(modal.locator('[data-square="d5"] img[alt="Black q"]')).toBeVisible();
    await modal.locator('button[data-action="speed-close"]').click();
    await expect(modal).toHaveCount(0);
  });

  test('Progress: a decision played is a reviewed card, with the reviews due over two weeks (DC-8)', async ({ page }) => {
    await page.locator('[data-lesson-id="lesson-scandinavian-refutation-drill"]').click();
    await expect(page.locator('[data-square="e4"] img[alt="White p"]')).toBeVisible();
    await page.locator('[data-square="e4"]').click();
    await page.locator('[data-square="d5"]').click();
    await expect(page.locator('.correct-feedback')).toBeVisible();
    await page.locator('button[data-action="progress"]').click();
    const summary = page.locator('[data-modal="progress"] [data-section="progress-summary"]');
    await expect(summary).toBeVisible();
    await expect(summary).toHaveAttribute('data-reviewed', '1');
    await expect(summary.locator('[data-due-day]')).toHaveCount(14);
    await page.locator('[data-action="progress-close"]').click();
    await expect(page.locator('[data-modal="progress"]')).toHaveCount(0);
  });

  test('Plan review: the position a line reaches, the plan on demand, and the student\'s own grade (CL-7)', async ({ page }) => {
    const button = page.locator('button[data-action="plans"]');
    const due = Number(await button.locator('[data-plans-due]').getAttribute('data-plans-due'));
    expect(due).toBeGreaterThan(5);
    await button.click();
    const modal = page.locator('[data-modal="plans"]');
    await expect(modal).toHaveAttribute('data-plans-left', String(due));
    await modal.locator('[data-action="plans-show"]').click();
    await expect(modal.locator('[data-section="plan-answer"]')).toBeVisible();
    await modal.locator('[data-grade="good"]').click();
    await expect(modal).toHaveAttribute('data-plans-left', String(due - 1));
    await modal.locator('[data-action="plans-close"]').click();
    // The graded plan is no longer due
    await expect(button.locator('[data-plans-due]')).toHaveAttribute('data-plans-due', String(due - 1));
  });

  test('Spar: the finished Scandinavian line is played on against Maia, with the plan goals and a review (CL-6)', async ({ page }) => {
    test.setTimeout(150_000);
    await page.locator('[data-lesson-id="lesson-scandinavian-refutation-drill"]').click();
    // The lesson's main line after 1.e4 d5 (its unit tests replay it); Black's replies are played by the lesson
    const line = ['exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4', 'Nf6', 'Nf3', 'c6', 'Bc4', 'Bf5', 'Bd2', 'e6', 'Nd5', 'Qd8', 'Nxf6+', 'Qxf6', 'Qe2'];
    const mirror = new Chess();
    mirror.move('e4');
    mirror.move('d5');
    for (const san of line) {
      const move = mirror.move(san);
      if (move.color === 'w') {
        await page.locator(`[data-square="${move.from}"]`).click();
        await page.locator(`[data-square="${move.to}"]`).click();
      }
      await expect(page.locator(`[data-square="${move.to}"] img[alt="${move.color === 'w' ? 'White' : 'Black'} ${move.piece}"]`)).toBeVisible({ timeout: 5000 });
    }

    // The line is done: play its last position on against Maia 1100
    await page.locator('button[data-action="spar"][data-elo="1100"]').click();
    await expect(page.locator('[data-square="e2"] img[alt="White q"]')).toBeVisible();
    const panel = page.locator('[data-section="spar"]');
    await expect(panel).toContainText('Weakness Drill: Meeting the Scandinavian Defense');
    await expect(panel.locator('[data-milestone="Castle"]')).toHaveAttribute('data-status', 'missed');
    await expect(panel.locator('[data-milestone="Bring out every knight and bishop"]')).toHaveAttribute('data-status', 'already');
    // Maia answers 10.Qe2 (the game so far is 19 plies)
    await expect(page.locator('button[data-ply="20"]').first()).toBeVisible({ timeout: 30000 });

    // One move of White's, chosen from the board: a legal quiet move
    const placement = await page.evaluate(() => {
      const rows: string[] = [];
      for (let r = 8; r >= 1; r--) {
        let row = '';
        let empty = 0;
        for (const f of 'abcdefgh') {
          const piece = document.querySelector(`[data-square="${f}${r}"]`)?.getAttribute('data-piece');
          if (!piece) {
            empty++;
            continue;
          }
          if (empty) row += String(empty);
          empty = 0;
          row += piece[0] === 'w' ? piece[1].toUpperCase() : piece[1];
        }
        rows.push(row + (empty ? String(empty) : ''));
      }
      return rows.join('/');
    });
    const position = new Chess(`${placement} w - - 0 11`);
    const quiet = position.moves({ verbose: true }).filter((m) => !m.captured && m.piece !== 'k');
    const pick = quiet.find((m) => m.piece === 'p') ?? quiet[0];
    await page.locator(`[data-square="${pick.from}"]`).click();
    await page.locator(`[data-square="${pick.to}"]`).click();
    await expect(panel).toHaveAttribute('data-spar-moves', '1');
    await expect(page.locator('button[data-ply="22"]').first()).toBeVisible({ timeout: 30000 });

    // The review: the goals and the moves that cost expected score
    await panel.locator('button[data-action="spar-review"]').click();
    await expect(panel.locator('[data-section="spar-review"]')).toBeVisible({ timeout: 60000 });
    await expect(panel.locator('[data-milestone="Castle"]')).toHaveAttribute('data-status', /met|missed/);
    const log = await page.evaluate(() => JSON.parse(window.localStorage.getItem('my_chess_spar_log_v1') || '[]'));
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ lessonId: 'lesson-scandinavian-refutation-drill', elo: 1100, studentColor: 'w' });
    expect(log[0].moves).toHaveLength(3);
  });
});

test.describe('05b. Lessons on a phone (iPhone viewport)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('The lesson picker sits above the board and an opening drill can be played by tapping', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-tab="lessons"]').tap();
    await expect(page.locator('.lessons-view, [data-view="lessons"]').first()).toBeVisible({ timeout: 10000 });

    const picker = page.locator('select[data-select="lesson-mobile"]');
    await expect(picker).toBeVisible();
    // The card list is hidden on a phone; the picker replaces it
    await expect(page.locator('[data-lesson-id="lesson-evans-gambit-destruction"]')).toBeHidden();
    const pickerBox = (await picker.boundingBox())!;
    const boardBox = (await page.locator('[data-square="a8"]').boundingBox())!;
    expect(pickerBox.y).toBeLessThan(boardBox.y);
    const widths = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
    expect(widths.doc).toBeLessThanOrEqual(widths.win);

    await picker.selectOption('lesson-scandinavian-refutation-drill');
    await expect(page.locator('[data-square="d5"] img[alt="Black p"]')).toBeVisible();
    // The board question before the move (CL-5, on by default) works by tapping too: 1...d5 attacks no piece
    const question = page.locator('[data-section="board-question"]');
    await expect(question).toHaveAttribute('data-question-kind', 'attacks');
    await question.locator('button[data-action="question-none"]').tap();
    await expect(question).toHaveAttribute('data-question-status', 'right');
    await page.locator('[data-square="e4"]').tap();
    await page.locator('[data-square="d5"]').tap();
    await expect(page.locator('.correct-feedback')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-square="d5"] img[alt="Black q"]')).toBeVisible({ timeout: 3000 });
  });
});
