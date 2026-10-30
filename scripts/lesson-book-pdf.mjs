// Renders book/lesson-book.html to book/lesson-book.pdf with the Playwright Chromium.
// Run after `npm run book`. The deploy workflow copies both files into dist/book/.
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const html = resolve('book/lesson-book.html');
const pdf = resolve('book/lesson-book.pdf');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href);
await page.pdf({
  path: pdf,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="font-size:8px;color:#666;width:100%;text-align:center;">The hoot65 Opening Book · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
});
await browser.close();
console.log(`wrote ${pdf}`);
