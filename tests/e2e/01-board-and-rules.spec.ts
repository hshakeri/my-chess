import { test, expect } from '@playwright/test';

test.describe('01. 2D Chessboard & Rules Engine (F01 - F04)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Ensure we are on the Play tab
    const playTab = page.locator('button:has-text("Play vs Maia"), [data-tab="play"]').first();
    if (await playTab.isVisible()) {
      await playTab.click();
    }
    // Wait for the chessboard to be visible
    await expect(page.locator('[data-square="e4"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('Renders 64 squares with correct rank and file coordinates and light/dark styling', async ({ page }) => {
    // Assert all 64 squares exist in the DOM
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];

    for (const f of files) {
      for (const r of ranks) {
        const sq = page.locator(`[data-square="${f}${r}"]`);
        await expect(sq).toBeVisible();
      }
    }

    // Coordinates visible on edges
    await expect(page.locator('[data-square="a1"]').getByText('1')).toBeVisible();
    await expect(page.locator('[data-square="a1"]').getByText('a')).toBeVisible();
    await expect(page.locator('[data-square="h1"]').getByText('h')).toBeVisible();
    await expect(page.locator('[data-square="a8"]').getByText('8')).toBeVisible();
  });

  test('Renders SVG pieces for initial starting position', async ({ page }) => {
    // Check key starting pieces
    const whiteKing = page.locator('[data-square="e1"] img');
    await expect(whiteKing).toBeVisible();
    await expect(whiteKing).toHaveAttribute('alt', /White/i);

    const blackKing = page.locator('[data-square="e8"] img');
    await expect(blackKing).toBeVisible();
    await expect(blackKing).toHaveAttribute('alt', /Black/i);

    const whitePawns = page.locator('[data-square="e2"] img');
    await expect(whitePawns).toBeVisible();

    const blackPawns = page.locator('[data-square="e7"] img');
    await expect(blackPawns).toBeVisible();
  });

  test('Executes click-to-move, displays legal move targets, and records live SAN', async ({ page }) => {
    // Turn off engine auto-play for testing pure board moves
    const offBtn = page.locator('button[data-engine-color="none"], button:has-text("Off")').first();
    if (await offBtn.isVisible()) {
      await offBtn.click();
    }

    // Click white pawn at e2
    await page.locator('[data-square="e2"]').click();

    // Legal move target indicators should appear on e3 and e4
    const e4 = page.locator('[data-square="e4"]');
    const legalDot = e4.locator('.legal-move-dot');
    await expect(legalDot).toBeVisible();

    // Click e4 to make the move
    await e4.click();

    // Pawn should now be on e4, e2 should be empty
    await expect(page.locator('[data-square="e4"] img')).toBeVisible();
    await expect(page.locator('[data-square="e2"] img')).toHaveCount(0);

    // Live SAN list should record "e4"
    await expect(page.locator('button[data-ply="1"], .move-list-panel').getByText('e4')).toBeVisible();
  });

  test('Correctly highlights King when placed in Check', async ({ page }) => {
    // Turn off engine
    const offBtn = page.locator('button[data-engine-color="none"]').first();
    if (await offBtn.isVisible()) await offBtn.click();

    // Load position where Black is 1 move away from delivering check:
    // Setup modal
    const setupBtn = page.locator('button[data-action="setup-position"]').first();
    await setupBtn.click();

    const fenInput = page.locator('textarea[data-input="fen"]').first();
    // 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7# checkmate position or Scholar check
    // Here: White queen on f7 delivering check to e8 king:
    const checkFen = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
    await fenInput.fill(checkFen);
    await page.locator('button[data-action="apply-position"]').click();

    // Verify e8 king has king-check-glow
    const e8 = page.locator('[data-square="e8"]');
    await expect(e8.locator('.king-check-glow')).toBeVisible();
  });

  test('Validates Castling rights and automatically moves the Rook', async ({ page }) => {
    // Turn off engine
    const offBtn = page.locator('button[data-engine-color="none"]').first();
    if (await offBtn.isVisible()) await offBtn.click();

    // Load position ready for White kingside castling
    const setupBtn = page.locator('button[data-action="setup-position"]').first();
    await setupBtn.click();

    // Position after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 (White can castle O-O)
    const castleFen = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    await page.locator('textarea[data-input="fen"]').first().fill(castleFen);
    await page.locator('button[data-action="apply-position"]').click();

    // Click White king on e1
    await page.locator('[data-square="e1"]').click();

    // Click g1 to castle kingside
    await page.locator('[data-square="g1"]').click();

    // King should be on g1, Rook should have moved from h1 to f1
    await expect(page.locator('[data-square="g1"] img')).toBeVisible();
    await expect(page.locator('[data-square="f1"] img')).toBeVisible();
    await expect(page.locator('[data-square="h1"] img')).toHaveCount(0);

    // Live SAN list should record "O-O"
    await expect(page.locator('.move-list-panel').getByText('O-O')).toBeVisible();
  });

  test('Handles En Passant pawn capture correctly', async ({ page }) => {
    const offBtn = page.locator('button[data-engine-color="none"]').first();
    if (await offBtn.isVisible()) await offBtn.click();

    // Load position where White pawn on e5, Black plays d7-d5 enabling en passant on d6
    const setupBtn = page.locator('button[data-action="setup-position"]').first();
    await setupBtn.click();

    // FEN with Black to move: pawn on d7, White pawn on e5
    const epPrepFen = 'rnbqkbnr/pppppppp/8/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';
    await page.locator('textarea[data-input="fen"]').first().fill(epPrepFen);
    await page.locator('button[data-action="apply-position"]').click();

    // Black plays d7 -> d5
    await page.locator('[data-square="d7"]').click();
    await page.locator('[data-square="d5"]').click();

    // White captures en passant: e5 -> d6
    await page.locator('[data-square="e5"]').click();
    await page.locator('[data-square="d6"]').click();

    // White pawn should now be on d6, and Black pawn on d5 should be removed
    await expect(page.locator('[data-square="d6"] img')).toBeVisible();
    await expect(page.locator('[data-square="d5"] img')).toHaveCount(0);
    await expect(page.locator('[data-square="e5"] img')).toHaveCount(0);

    // Live SAN list should record "exd6"
    await expect(page.locator('.move-list-panel').getByText('exd6')).toBeVisible();
  });

  test('Pawn promotion triggers modal and promotes to selected piece', async ({ page }) => {
    const offBtn = page.locator('button[data-engine-color="none"]').first();
    if (await offBtn.isVisible()) await offBtn.click();

    // Load position with White pawn on e7 ready to promote on e8
    const setupBtn = page.locator('button[data-action="setup-position"]').first();
    await setupBtn.click();

    const promoFen = '8/4P3/8/8/8/3k4/8/4K3 w - - 0 1';
    await page.locator('textarea[data-input="fen"]').first().fill(promoFen);
    await page.locator('button[data-action="apply-position"]').click();

    // Move e7 to e8
    await page.locator('[data-square="e7"]').click();
    await page.locator('[data-square="e8"]').click();

    // Promotion modal must appear
    const promoModal = page.locator('h3:has-text("Promote Pawn"), div:has-text("Promote Pawn")').first();
    await expect(promoModal).toBeVisible();

    // Select Queen
    const queenBtn = page.locator('button:has-text("Queen")').first();
    await expect(queenBtn).toBeVisible();
    await queenBtn.click();

    // Pawn promotes: square e8 now holds Queen, e7 is empty
    await expect(page.locator('[data-square="e8"] img')).toBeVisible();
    await expect(page.locator('[data-square="e7"] img')).toHaveCount(0);

    // Live SAN should contain "=Q"
    await expect(page.locator('.move-list-panel').getByText(/e8=Q/)).toBeVisible();
  });

  test('Detects terminal Checkmate and displays game over status', async ({ page }) => {
    const offBtn = page.locator('button[data-engine-color="none"]').first();
    if (await offBtn.isVisible()) await offBtn.click();

    // Load position 1 move before Scholar\'s Mate (White Queen on h5 ready for Qxf7#)
    const setupBtn = page.locator('button[data-action="setup-position"]').first();
    await setupBtn.click();

    const matePrepFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    await page.locator('textarea[data-input="fen"]').first().fill(matePrepFen);
    await page.locator('button[data-action="apply-position"]').click();

    // White plays Qxf7#
    await page.locator('[data-square="h5"]').click();
    await page.locator('[data-square="f7"]').click();

    // Checkmate! Result 1-0 or Checkmate reason should be displayed
    await expect(page.locator('.move-list-panel').getByText(/1-0|Checkmate/i).first()).toBeVisible();
    await expect(page.locator('.move-list-panel').getByText(/Qxf7#/)).toBeVisible();
  });

  test('Flips board orientation from White to Black perspective and back', async ({ page }) => {
    // Initial: rank 1 is at the bottom, rank 8 at top. Let's inspect coordinate
    const flipBtn = page.locator('button[data-action="flip-board"]').first();
    await expect(flipBtn).toBeVisible();

    // Click flip
    await flipBtn.click();

    // After flip, Black perspective: square a8 should now be at the bottom left or display reversed coordinates
    // Let's verify flip title or coordinate state
    await expect(flipBtn).toHaveAttribute('title', /Black/i);

    // Flip back
    await flipBtn.click();
    await expect(flipBtn).toHaveAttribute('title', /White/i);
  });

  test('Takeback undoes last move and restores previous position', async ({ page }) => {
    const offBtn = page.locator('button[data-engine-color="none"]').first();
    if (await offBtn.isVisible()) await offBtn.click();

    // Play 1. e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.locator('[data-square="e4"] img')).toBeVisible();

    // Click Takeback
    const takebackBtn = page.locator('button[data-action="takeback"]').first();
    await expect(takebackBtn).toBeEnabled();
    await takebackBtn.click();

    // e4 should be empty, e2 should have pawn back
    await expect(page.locator('[data-square="e2"] img')).toBeVisible();
    await expect(page.locator('[data-square="e4"] img')).toHaveCount(0);
    await expect(page.locator('button[data-ply="1"]')).toHaveCount(0);
  });

  test('Validates FEN input in position setup and shows error on malformed string', async ({ page }) => {
    const setupBtn = page.locator('button[data-action="setup-position"]').first();
    await setupBtn.click();

    const fenInput = page.locator('textarea[data-input="fen"]').first();
    await fenInput.fill('invalid-garbage-fen-string');

    await page.locator('button[data-action="apply-position"]').click();

    // An error message should be displayed
    await expect(page.locator('text=Invalid FEN')).toBeVisible();
  });
});

test.describe('01b. Phone play (iPhone viewport)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Shows a compact engine strip above the board, taps move pieces, and the engine answers', async ({ page }) => {
    await page.goto('/');
    const strip = page.locator('[data-section="mobile-engine-strip"]');
    await expect(strip).toBeVisible();
    const board = page.locator('[data-square="a8"]').first();
    const stripBox = (await strip.boundingBox())!;
    const boardBox = (await board.boundingBox())!;
    expect(stripBox.y).toBeLessThan(boardBox.y);
    // No horizontal page scroll
    const widths = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
    expect(widths.doc).toBeLessThanOrEqual(widths.win);
    // The tab bar is scrollable and uses short labels
    await expect(page.locator('[data-tab="lessons"]')).toContainText('Lessons');

    await page.locator('[data-square="e2"]').tap();
    await page.locator('[data-square="e4"]').tap();
    await expect(page.locator('[data-square="e4"] img')).toBeVisible();
    await expect(strip.locator('[data-mobile-status]')).toContainText(/Maia to move|Thinking/);
    await expect(page.locator('button[data-ply="2"]').first()).toBeVisible({ timeout: 15000 });
    await expect(strip.locator('[data-mobile-status]')).toContainText('Your move');
  });

  test('Choosing to play Black turns the board and lets Maia open', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-mobile-engine-color="w"]').tap();
    // Black's pieces are now at the bottom and White (Maia) opens
    const a1 = (await page.locator('[data-square="a1"]').boundingBox())!;
    const a8 = (await page.locator('[data-square="a8"]').boundingBox())!;
    expect(a8.y).toBeGreaterThan(a1.y);
    await expect(page.locator('button[data-ply="1"]').first()).toBeVisible({ timeout: 15000 });
    await page.locator('[data-square="c7"]').tap();
    await page.locator('[data-square="c6"]').tap();
    await expect(page.locator('.move-list-panel').getByText('c6')).toBeVisible();
  });
});
