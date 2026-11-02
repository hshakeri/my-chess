import { test, expect } from '@playwright/test';

test.describe('06. Printable Physical-Board Worksheets & @media print (F19 - F20)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const worksheetTab = page.locator('button:has-text("Printable Worksheets"), button:has-text("Worksheets"), [data-tab="worksheets"]').first();
    await expect(worksheetTab).toBeVisible();
    await worksheetTab.click();
    await expect(page.locator('.worksheets-view, [data-view="worksheets"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('Renders printable worksheet selector (Curriculum Lessons & hoot65 Weakness Drills)', async ({ page }) => {
    const view = page.locator('.worksheets-view, [data-view="worksheets"]').first();

    // Verify worksheet choices exist
    await expect(view.getByText(/Worksheet|Curriculum|Lesson|Drill/i).first()).toBeVisible();

    // Verify hoot65 drill option exists
    await expect(view.getByText(/hoot65|Scandinavian|Caro-Kann/i).first()).toBeVisible();
  });

  test('Renders high-contrast 2D diagram with rank (1-8) and file (a-h) coordinates', async ({ page }) => {
    // Select a worksheet
    await page.locator('.worksheet-item').first().click();

    // Verify 2D diagram exists on the sheet
    const diagram = page.locator('.print-diagram, .worksheet-board, [data-printable="board"]').first();
    await expect(diagram).toBeVisible();

    // Verify coordinates are visible on the worksheet diagram
    await expect(diagram.getByText('1').first()).toBeVisible();
    await expect(diagram.getByText('8').first()).toBeVisible();
    await expect(diagram.getByText('a').first()).toBeVisible();
    await expect(diagram.getByText('h').first()).toBeVisible();
  });

  test('Includes guided exercises with fill-in-the-blank lines and moves notation', async ({ page }) => {
    const sheet = page.locator('.printable-sheet, [data-printable="sheet"]').first();
    await expect(sheet).toBeVisible();

    // Exercises section
    await expect(sheet.getByText(/Exercise|Find the move|Challenge/i).first()).toBeVisible();

    // Fill-in lines or prompt inputs
    const fillInLines = page.locator('.fill-in-line, hr.blank-line, div:has-text("_____")');
    await expect(fillInLines.first()).toBeVisible();
  });

  test('Answer key is separated with page break (page-break-before: always / break-before: page)', async ({ page }) => {
    const answerKey = page.locator('.worksheet-answer-key, [data-printable="answer-key"]').first();
    await expect(answerKey).toBeVisible();

    // Check CSS rule for print page break
    const hasPageBreak = await answerKey.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return (
        style.breakBefore === 'page' ||
        style.pageBreakBefore === 'always' ||
        el.classList.contains('break-before-page') ||
        el.classList.contains('page-break-always')
      );
    });

    expect(hasPageBreak).toBe(true);
  });

  test('Printing keeps the board chequered, and a Black sheet is drawn from Black\'s side', async ({ page }) => {
    await page.locator('.worksheet-item', { hasText: 'Siberian' }).click();
    const board = page.locator('[data-printable="board"]');
    await expect(page.locator('[data-printable="diagram-caption"]')).toContainText('Black to move');
    // Rank 1 at the top and the h-file on the left, as on a board set up with Black nearest you
    await expect(board.locator('[data-ws-square]').first()).toHaveAttribute('data-ws-square', 'h1');

    await page.emulateMedia({ media: 'print' });
    const dark = await board.locator('[data-shade="dark"]').first().evaluate((el) => {
      const style = window.getComputedStyle(el) as CSSStyleDeclaration & { printColorAdjust?: string; webkitPrintColorAdjust?: string };
      return { background: style.backgroundColor, adjust: style.printColorAdjust || style.webkitPrintColorAdjust };
    });
    expect(dark.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(dark.adjust).toBe('exact');
    await page.emulateMedia({ media: null });
  });

  test('@media print CSS hides navigation bars, buttons, and app chrome', async ({ page }) => {
    // Emulate print media type
    await page.emulateMedia({ media: 'print' });

    // Header/navbar and interactive buttons should be hidden in print mode
    const navBar = page.locator('nav, header, .app-navbar, .board-controls-bar').first();
    if (await navBar.count() > 0) {
      const isHiddenInPrint = await navBar.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden' || el.classList.contains('print:hidden');
      });
      expect(isHiddenInPrint).toBe(true);
    }

    // Reset media
    await page.emulateMedia({ media: null });
  });
  test('The sheet of your own reviewed mistakes waits for a review, and the worksheets come back (DC-4)', async ({ page }) => {
    await page.locator('button[data-action="mistake-sheet"]').click();
    const sheet = page.locator('[data-section="mistake-sheet"]');
    await expect(sheet).toHaveAttribute('data-items', '0');
    await expect(sheet).toContainText('No reviewed game has a mistake');
    await page.locator('button[data-action="mistake-sheet"]').click();
    await expect(page.locator('[data-printable="sheet"]').first()).toBeVisible();
    await expect(sheet).toHaveCount(0);
  });

  test('The tactics sheet prints the next twelve positions of the deck, the answers on a page of their own (DC-2)', async ({ page }) => {
    await page.locator('button[data-action="tactics-sheet"]').click();
    const sheet = page.locator('[data-section="tactics-sheet"]');
    await expect(sheet).toHaveAttribute('data-items', '12');
    await expect(sheet.locator('[data-tactics-item]')).toHaveCount(12);
    await expect(sheet.locator('[data-tactics-answer]')).toHaveCount(12);
    await expect(sheet.locator('[data-printable="answer-key"]')).toHaveCSS('break-before', 'page');
    await page.locator('button[data-action="tactics-sheet"]').click();
    await expect(sheet).toHaveCount(0);
    // Two moves ahead: the same sheet, drawn two moves earlier
    await page.locator('button[data-action="ahead-sheet"]').click();
    await expect(sheet).toHaveAttribute('data-ahead', 'true');
    await expect(sheet.locator('[data-tactics-item]')).toHaveCount(12);
    await expect(sheet.locator('[data-tactics-item="1"]')).toContainText('to play and win');
  });

  test('The card of the checks prints on its own, in the order they come up at the board', async ({ page }) => {
    await page.locator('button[data-action="board-card"]').click();
    const card = page.locator('[data-section="board-card"]');
    await expect(card.locator('[data-card-row]')).toHaveCount(6);
    await expect(card.locator('[data-card-row]').first()).toContainText('what it attacks');
    await expect(card.locator('[data-card-row="hang"]')).toContainText('5.7');
    await page.locator('button[data-action="board-card"]').click();
    await expect(card).toHaveCount(0);
  });
});
