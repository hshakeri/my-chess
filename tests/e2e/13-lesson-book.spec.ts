import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * The Book tab shows every page of the lesson book. The real book is made when the site is published
 * and no PDF is ever in the repository, so each test makes a small book on the spot (three US Letter
 * pages, with bookmarks from its headings) and serves it where the app looks for the book.
 */
async function makeBook(browser: Browser): Promise<Buffer> {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><body style="font: 28px serif">
    <h1>Part I · Drills</h1><p>The first page of the test book.</p>
    <h2 style="break-before: page">Chapter A</h2><p>The second page.</p>
    <h2 style="break-before: page">Chapter B</h2><p>The third page.</p>
  </body></html>`);
  const pdf = await page.pdf({ format: 'Letter', outline: true, tagged: true });
  await page.close();
  return pdf;
}

const serveBook = (page: Page, body: Buffer | string, status = 200, contentType = 'application/pdf') =>
  page.route('**/book/lesson-book.pdf', (route) => route.fulfill({ status, contentType, body }));

/** How many of a drawn page's pixels are not white (the page's text). */
const inkOn = (page: Page, pageNumber: number) =>
  page.locator(`[data-book-page="${pageNumber}"] canvas`).evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || canvas.width === 0) return 0;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 128) ink++;
    return ink;
  });

test.describe('13. The lesson book, every page, on the Book tab', () => {
  test('the tab draws every page, jumps to a chapter or a page, and offers the PDF itself', async ({ page, browser }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    await serveBook(page, await makeBook(browser));

    await page.goto('/#/play');
    await page.locator('[data-tab="book"]').click();
    await expect(page).toHaveURL(/#\/book$/);
    const view = page.locator('[data-view="book"]');
    await expect(view.locator('[data-book-pages]')).toHaveText('3 pages', { timeout: 15000 });
    await expect(view.locator('[data-book-page]')).toHaveCount(3);
    await expect(view.locator('[data-book-page="1"]')).toHaveAttribute('data-drawn', 'true', { timeout: 15000 });
    expect(await inkOn(page, 1)).toBeGreaterThan(100);

    // The contents are the book's bookmarks: the part, then its chapters with their pages
    const contents = view.locator('[data-book-contents]');
    await expect(contents.locator('optgroup')).toHaveAttribute('label', 'Part I · Drills');
    await expect(contents.locator('option')).toHaveText(['Contents…', 'Part I · Drills', 'Chapter A · p. 2', 'Chapter B · p. 3']);
    await contents.selectOption({ label: 'Chapter B · p. 3' });
    await expect(view.locator('[data-book-page="3"]')).toHaveAttribute('data-drawn', 'true');
    await expect(view.locator('[data-book-page-input]')).toHaveValue('3');
    expect(await inkOn(page, 3)).toBeGreaterThan(100);

    const pageInput = view.locator('[data-book-page-input]');
    await pageInput.fill('2');
    await pageInput.press('Enter');
    await expect(pageInput).toHaveValue('2');
    await expect(view.locator('[data-book-page="2"]')).toHaveAttribute('data-drawn', 'true');

    // The PDF itself, to download or to print from the browser's own viewer
    await expect(view.locator('[data-book-download]')).toHaveAttribute('href', '/my-chess/book/lesson-book.pdf');
    await expect(view.locator('[data-book-download]')).toHaveAttribute('download', 'lesson-book.pdf');
    await expect(view.locator('[data-book-open]')).toHaveAttribute('href', '/my-chess/book/lesson-book.pdf');
    expect(errors).toEqual([]);
  });

  test('a copy of the app with no book says so and links the published one', async ({ page }) => {
    await serveBook(page, 'Not found', 404, 'text/plain');
    await page.goto('/#/book');
    const missing = page.locator('[data-book-missing]');
    await expect(missing).toBeVisible({ timeout: 15000 });
    await expect(missing.locator('a')).toHaveAttribute('href', 'https://hshakeri.github.io/my-chess/book/lesson-book.pdf');
    await expect(page.locator('[data-book-page]')).toHaveCount(0);

    // A server that answers with the app's own page instead of a 404 is no book either
    await page.unroute('**/book/lesson-book.pdf');
    await serveBook(page, '<!doctype html><html><body>app</body></html>', 200, 'text/html');
    await page.reload();
    await expect(page.locator('[data-book-missing]')).toBeVisible({ timeout: 15000 });
  });

  test.describe('on a 375-pixel phone', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('the pages fit the width and the bar that stays on screen is one row', async ({ page, browser }) => {
      await serveBook(page, await makeBook(browser));
      await page.goto('/#/book');
      const view = page.locator('[data-view="book"]');
      await expect(view.locator('[data-book-page="1"]')).toHaveAttribute('data-drawn', 'true', { timeout: 15000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
      const canvas = await view.locator('[data-book-page="1"] canvas').boundingBox();
      expect(canvas?.width ?? 0).toBeGreaterThan(300);
      expect(canvas?.width ?? 999).toBeLessThanOrEqual(375);
      const bar = await view.locator('[data-book-toolbar]').boundingBox();
      expect(bar?.height ?? 999).toBeLessThan(60);
    });
  });
});
