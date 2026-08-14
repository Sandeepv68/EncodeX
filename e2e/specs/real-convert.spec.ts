import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { launchApp, closeApp, AppSession } from '../fixtures/app';
import { generateTestMedia } from '../helpers';

const IS_REAL = process.env.E2E_REAL === '1';

async function gotoConvert(page: import('playwright').Page): Promise<void> {
  await page.locator('[data-testid="nav-item-convert"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-convert"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/convert'));
}

describe.runIf(IS_REAL)('Real conversion (Tier B)', () => {
  let session: AppSession;
  let workDir: string;
  let inputPath: string;
  let outputPath: string;

  beforeAll(async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-real-'));
    inputPath = generateTestMedia(workDir, 'input.mp4');
    outputPath = path.join(workDir, 'output.mp4');

    session = await launchApp({
      mock: false,
      env: { E2E_REAL: '1', E2E_REAL_INPUT_FILE: inputPath, E2E_REAL_OUTPUT_FILE: outputPath },
    });
    await gotoConvert(session.page);
  }, 120000);

  afterAll(async () => {
    await closeApp(session.app, session.userDataDir);
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  });

  it('converts a real media file through the real preload and ffmpeg', async () => {
    const { page } = session;

    await page.locator('[data-testid="file-drop-zone"]').click();
    await expect.poll(() => page.locator('[data-testid="convert-input-file"]').textContent(), { timeout: 30000 }).toContain('input.mp4');

    await page.locator('[data-testid="convert-output"] button').click();
    await expect.poll(() => page.locator('[data-testid="convert-output"] input').inputValue(), { timeout: 30000 }).toBe(outputPath);

    await expect.poll(() => page.locator('[data-testid="convert-start"]').isEnabled()).toBe(true);
    await page.locator('[data-testid="convert-start"]').click();

    await expect
      .poll(() => page.locator('[role="alert"]').filter({ hasText: 'Conversion complete' }).count(), { timeout: 60000 })
      .toBeGreaterThan(0);

    const stat = fs.statSync(outputPath, { throwIfNoEntry: false });
    expect(stat).toBeTruthy();
    expect(stat!.size).toBeGreaterThan(0);
  }, 90000);
});
