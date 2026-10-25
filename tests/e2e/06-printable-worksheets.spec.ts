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
    const worksheetItem = page.locator('.worksheet-item, button:has-text("Scandinavian"), button:has-text("Scotch")').first();
    if (await worksheetItem.isVisible()) {
      await worksheetItem.click();
    }

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
});
