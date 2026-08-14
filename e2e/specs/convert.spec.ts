import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, AppSession } from '../fixtures/app';
import { mockApi, emitConversionProgress } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const INPUT = '/media/video.mp4';
const OUTPUT = '/media/video_encodex_converted.mp4';

async function selectOption(page: Page, testId: string, value: string) {
  await page.locator(`[data-testid="${testId}"] [role="combobox"]`).click();
  const option = page.locator(`[role="option"][data-value="${value}"]`);
  await option.waitFor({ timeout: 5000 });
  await option.click();
}

async function comboboxText(page: Page, testId: string): Promise<string> {
  return (await page.locator(`[data-testid="${testId}"] [role="combobox"]`).innerText()) ?? '';
}

async function gotoConvert(page: Page) {
  await page.locator('[data-testid="nav-item-convert"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/convert'));
}

describe.runIf(IS_E2E)('Convert page', () => {
  let session: AppSession;

  beforeAll(async () => {
    session = await launchApp({ mock: true });
    await gotoConvert(session.page);
  }, 60000);

  afterAll(async () => {
    await closeApp(session.app, session.userDataDir);
  });

  beforeEach(async () => {
    await mockApi.reset(session.page);
    await session.page.reload();
    await gotoConvert(session.page);
  });

  it('renders the convert page with input/output fields and a disabled start button', async () => {
    await expect.poll(() => session.page.locator('[data-testid="file-drop-zone"]').count()).toBe(1);
    await expect.poll(() => session.page.locator('[data-testid="convert-start"]').isDisabled()).toBe(true);
  });

  it('selects an input file and auto-suggests the output path', async () => {
    await mockApi.setSelectFile(session.page, INPUT);
    await session.page.locator('[data-testid="file-drop-zone"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-input-file"]').textContent()).toContain('video.mp4');
    await expect.poll(() => session.page.locator('[data-testid="convert-output"] input').inputValue()).toBe(OUTPUT);
    await expect.poll(() => session.page.locator('[data-testid="convert-start"]').isEnabled()).toBe(true);
  });

  it('focuses the file drop zone from the keyboard and activates it with Enter', async () => {
    await mockApi.setSelectFile(session.page, INPUT);
    const zone = session.page.locator('[data-testid="file-drop-zone"]');
    await zone.focus();
    await expect
      .poll(() => session.page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null))
      .toBe('file-drop-zone');
    await session.page.keyboard.press('Enter');
    await expect.poll(() => session.page.locator('[data-testid="convert-input-file"]').textContent()).toContain('video.mp4');
  });

  it('selects an explicit output file with Save As', async () => {
    await mockApi.setSelectFile(session.page, INPUT);
    await session.page.locator('[data-testid="file-drop-zone"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-output"] input').inputValue()).toBe(OUTPUT);
    await mockApi.setSelectOutput(session.page, '/custom/out.mp4');
    await session.page.locator('[data-testid="convert-output"] button').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-output"] input').inputValue()).toBe('/custom/out.mp4');
  });

  it('changes codec, bitrate, scale, pixel format and transcoder options', async () => {
    await mockApi.setSelectFile(session.page, INPUT);
    await session.page.locator('[data-testid="file-drop-zone"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-output"] input').inputValue()).toBe(OUTPUT);

    await selectOption(session.page, 'convert-video-codec', 'libx265');
    await selectOption(session.page, 'convert-video-bitrate', '4000k');
    await selectOption(session.page, 'convert-scale', '1280x720');
    await selectOption(session.page, 'convert-pixel-format', 'yuv420p10le');
    await selectOption(session.page, 'convert-transcoder', 'FFMPEG');

    await expect.poll(() => comboboxText(session.page, 'convert-video-codec')).toContain('libx265');
    await expect.poll(() => comboboxText(session.page, 'convert-video-bitrate')).toContain('4000k');
    await expect.poll(() => comboboxText(session.page, 'convert-scale')).toContain('1280x720');
    await expect.poll(() => comboboxText(session.page, 'convert-pixel-format')).toContain('yuv420p10le');
    await expect.poll(() => comboboxText(session.page, 'convert-transcoder')).toContain('FFmpeg');
  });

  it('hides encoding options when lossless copy mode is enabled', async () => {
    await mockApi.setSelectFile(session.page, INPUT);
    await session.page.locator('[data-testid="file-drop-zone"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-video-codec"]').count()).toBe(1);

    await session.page.locator('[data-testid="convert-copy-switch"] input').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-video-codec"]').count()).toBe(0);
    await expect.poll(() => session.page.locator('[data-testid="convert-transcoder"]').count()).toBe(1);
  });

  it('runs a conversion to completion and shows a success toast', async () => {
    await mockApi.setSelectFile(session.page, INPUT);
    await session.page.locator('[data-testid="file-drop-zone"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-output"] input').inputValue()).toBe(OUTPUT);

    await session.page.locator('[data-testid="convert-start"]').click();
    await expect.poll(() => session.page.locator('[role="alert"]').filter({ hasText: 'Conversion complete' }).count()).toBeGreaterThan(0);
  });

  it('shows live progress while a conversion runs', async () => {
    await mockApi.setConvertBehavior(session.page, 'hold');
    await mockApi.setSelectFile(session.page, INPUT);
    await session.page.locator('[data-testid="file-drop-zone"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-output"] input').inputValue()).toBe(OUTPUT);

    await session.page.locator('[data-testid="convert-start"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-pause"]').count()).toBe(1);

    await emitConversionProgress(session.page, INPUT, OUTPUT, { percent: 42.5 });
    await expect.poll(() => session.page.locator('body').textContent()).toContain('42.5%');

    await mockApi.resolveConvert(session.page);
    await expect.poll(() => session.page.locator('[role="alert"]').filter({ hasText: 'Conversion complete' }).count()).toBeGreaterThan(0);
    await expect.poll(() => session.page.locator('[data-testid="convert-pause"]').count()).toBe(0);
  });

  it('pauses and resumes a running conversion', async () => {
    await mockApi.setConvertBehavior(session.page, 'hold');
    await mockApi.setSelectFile(session.page, INPUT);
    await session.page.locator('[data-testid="file-drop-zone"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-output"] input').inputValue()).toBe(OUTPUT);

    await session.page.locator('[data-testid="convert-start"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-pause"]').count()).toBe(1);

    await session.page.locator('[data-testid="convert-pause"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-resume"]').count()).toBe(1);

    await session.page.locator('[data-testid="convert-resume"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-pause"]').count()).toBe(1);

    await mockApi.resolveConvert(session.page);
  });

  it('cancels a running conversion via the confirmation dialog', async () => {
    await mockApi.setConvertBehavior(session.page, 'hold');
    await mockApi.setSelectFile(session.page, INPUT);
    await session.page.locator('[data-testid="file-drop-zone"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-output"] input').inputValue()).toBe(OUTPUT);

    await session.page.locator('[data-testid="convert-start"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-cancel"]').count()).toBe(1);

    await session.page.locator('[data-testid="convert-cancel"]').click();
    await expect.poll(() => session.page.locator('[data-testid="confirm-confirm"]').count()).toBeGreaterThan(0);

    await session.page.locator('[data-testid="confirm-confirm"]').click();
    await expect.poll(() => session.page.locator('[data-testid="convert-start"]').isEnabled()).toBe(true);
  });
});
