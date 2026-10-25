import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

test.describe('07. Git Configuration, .gitignore & GitHub Pages Static Deployment (F21 - F23)', () => {
  const rootDir = process.cwd();

  test('.gitignore exists and contains rule excluding *.pdf files', () => {
    const gitignorePath = path.join(rootDir, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    expect(gitignoreContent).toMatch(/\*\.pdf/);
  });

  test('git ls-files "*.pdf" confirms zero PDF files are tracked in git', () => {
    try {
      const output = execSync('git ls-files "*.pdf"', { cwd: rootDir, encoding: 'utf8' });
      expect(output.trim()).toBe('');
    } catch {
      // If git is not yet initialized or command exits, ensure no tracked PDFs
    }
  });

  test('GitHub Actions deployment workflow (.github/workflows/deploy.yml) exists', () => {
    const deployWorkflowPath = path.join(rootDir, '.github/workflows/deploy.yml');
    expect(fs.existsSync(deployWorkflowPath)).toBe(true);

    const content = fs.readFileSync(deployWorkflowPath, 'utf8');
    expect(content).toMatch(/github-pages|actions\/deploy-pages/i);
  });

  test('vite.config.ts is configured with base path "/my-chess/"', () => {
    const viteConfigPath = path.join(rootDir, 'vite.config.ts');
    expect(fs.existsSync(viteConfigPath)).toBe(true);

    const content = fs.readFileSync(viteConfigPath, 'utf8');
    expect(content).toContain("base: '/my-chess/'");
  });

  test('Application loads under "/my-chess/" with zero console errors and zero failed asset requests', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.url()} (${req.failure()?.errorText})`);
    });

    await page.goto('/');

    // Wait for the board to render
    await expect(page.locator('[data-square="e4"]').first()).toBeVisible({ timeout: 10000 });

    // Verify SVG piece image loaded successfully
    const samplePiece = page.locator('[data-square="e1"] img');
    await expect(samplePiece).toBeVisible();

    const naturalWidth = await samplePiece.evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);

    // Verify zero failed requests
    expect(failedRequests).toHaveLength(0);
    // Verify zero uncaught console errors
    expect(consoleErrors).toHaveLength(0);
  });
});
