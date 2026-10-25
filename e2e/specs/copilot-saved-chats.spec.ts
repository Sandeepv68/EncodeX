/**
 * @fileoverview Copilot saved conversations and AI status E2E suite (Tier A, mock preload).
 *
 * Covers the user-facing contract of the saved-chats side panel and the
 * composer's AI status chip:
 *  - each entry shows its message-count badge, a relative "time ago" stamp and
 *    the icon of the provider that produced that conversation (with a tooltip),
 *  - the whole entry opens the conversation; only the red cross deletes it,
 *  - opening a saved chat over an unsaved transcript asks first,
 *  - saving writes to storage and the panel reflects it,
 *  - the AI status chip names the connected provider and model,
 *  - "Start fresh conversation" clears the transcript after confirmation.
 *
 * Saved chats are seeded straight into localStorage, the same way the page
 * persists them, so the list under test is exactly what a returning user sees.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, ensureLiveSession, reloadSession, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';
import type { CopilotPlan } from '../../src/shared/copilot';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

/** localStorage key the Copilot page persists saved chats under (see stores/copilotChats.ts). */
const SAVED_CHATS_KEY = 'encodex-copilot-saved-chats';
const DAY_MS = 24 * 60 * 60 * 1000;

const FOLDER_FILES = ['C:/media/one.mp4', 'C:/media/two.mkv'];
const GOAL = 'shrink these for the web';

const PLAN: CopilotPlan = {
  goal: GOAL,
  operation: 'convert',
  actions: [
    {
      id: 'convert_0',
      operation: 'convert',
      input: 'C:/media/one.mp4',
      output: 'C:/media/one_web.mp4',
      confidence: 0.8,
      rationale: ['Re-encodes to a web-friendly size.'],
      estimatedSizeBytes: 500_000,
      estimatedSavings: 0.5,
      options: { videoCodec: 'libx264', videoBitrate: '1000k' },
    },
  ],
  results: [],
  skips: [],
  rationale: ['Planned 1 conversion(s).'],
  notes: [],
  plan: { valid: true, order: ['convert_0'], steps: [], issues: [], summary: '1 step' },
  providerId: 'rules',
  isEstimated: true,
} as unknown as CopilotPlan;

/** A saved chat as the page writes it: a user turn, and an assistant turn tagged with its provider. */
function savedChat(id: string, title: string, savedAt: number, providerId: string | null, extraUserTurns = 0) {
  const messages: Record<string, unknown>[] = [{ id: `${id}-u0`, role: 'user', content: title, timestamp: savedAt }];
  for (let i = 0; i < extraUserTurns; i += 1) {
    messages.push({ id: `${id}-u${i + 1}`, role: 'user', content: `follow-up ${i + 1}`, timestamp: savedAt });
  }
  messages.push({
    id: `${id}-a`,
    role: 'assistant',
    plan: null,
    timestamp: savedAt,
    ...(providerId ? { providerId } : {}),
  });
  return { id, title, savedAt, messages };
}

async function seedSavedChats(page: Page, chats: unknown[]): Promise<void> {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [SAVED_CHATS_KEY, chats] as const);
}

async function readSavedChats(page: Page): Promise<{ id: string }[]> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), SAVED_CHATS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function gotoCopilot(page: Page): Promise<void> {
  await page.locator('[data-testid="nav-item-copilot"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-copilot"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/copilot'));
  await page.locator('[data-testid="copilot-conversation"]').waitFor({ timeout: 15000 });
}

async function openSavedChatsPanel(page: Page): Promise<void> {
  await page.locator('[data-testid="copilot-saved-chats"]').click();
  await page.locator('[data-testid="saved-chats-drawer"]').waitFor({ timeout: 10000 });
}

/** Types a goal into the Lexical editor. */
async function typeGoal(page: Page, goal: string): Promise<void> {
  await page.locator('[contenteditable="true"]').click();
  await page.keyboard.type(goal);
}

/** Builds an active transcript with one planned turn. */
async function startActivePlan(page: Page): Promise<void> {
  await mockApi.setSelectFolderFiles(page, FOLDER_FILES);
  await page.locator('[data-testid="copilot-choose-folder"]').click();
  await expect.poll(() => page.locator('[data-testid="copilot-choose-folder"]').isDisabled()).toBe(false);
  await mockApi.setCopilotPlan(page, PLAN);
  await typeGoal(page, GOAL);
  await page.locator('[data-testid="copilot-plan"]').click();
  await page.locator('[data-testid="copilot-plan-summary"]').waitFor({ timeout: 15000 });
}

describe.runIf(IS_E2E)('Copilot saved conversations and AI status', () => {
  let session: AppSession;

  beforeAll(async () => {
    session = await launchApp({ mock: true });
  }, 60000);

  afterAll(async () => {
    await closeApp(session.app, session.userDataDir);
  });

  beforeEach(async () => {
    session = await ensureLiveSession(session);
    await mockApi.reset(session.page);
    session = await reloadSession(session);
    await session.page.evaluate((key) => localStorage.removeItem(key), SAVED_CHATS_KEY);
    await gotoCopilot(session.page);
  }, 30000);

  it('lists each saved chat with its message count, relative time and provider icon', async () => {
    const { page } = session;
    const now = Date.now();
    await seedSavedChats(page, [
      savedChat('chat-a', 'Compress for web', now - 3 * DAY_MS, 'openai', 2),
      savedChat('chat-b', 'Quick remux', now - 45_000, null),
    ]);
    await openSavedChatsPanel(page);

    const items = page.locator('[data-testid="saved-chat-item"]');
    await expect.poll(() => items.count()).toBe(2);

    // Newest first: chat-b (45 s ago, 2 turns) then chat-a (3 days ago, 4 turns).
    const counts = page.locator('[data-testid="saved-chat-count"]');
    await expect.poll(() => counts.nth(0).innerText()).toBe('2');
    await expect.poll(() => counts.nth(1).innerText()).toBe('4');
    await expect.poll(() => items.nth(1).innerText()).toContain('3 days ago');
    await expect.poll(() => items.nth(0).innerText()).toContain('sec. ago');

    // Every row carries a provider icon, including the one with no recorded provider.
    await expect.poll(() => page.locator('[data-testid="saved-chat-provider"]').count()).toBe(2);
  });

  it('names the provider behind each chat icon through its tooltip label', async () => {
    const { page } = session;
    await seedSavedChats(page, [savedChat('chat-a', 'Compress for web', Date.now(), 'openai')]);
    await openSavedChatsPanel(page);

    // MUI exposes a string tooltip title as the wrapped element's aria-label, so this
    // checks the tooltip contract without depending on hover timing in the renderer.
    const icon = page.locator('[data-testid="saved-chat-provider"]').first();
    await expect.poll(() => icon.getAttribute('aria-label')).toBe('OpenAI');
  });

  it('opens a saved chat when the entry itself is clicked', async () => {
    const { page } = session;
    await seedSavedChats(page, [savedChat('chat-a', 'Compress for web', Date.now(), 'openai')]);
    await openSavedChatsPanel(page);

    await page.locator('[data-testid="saved-chat-open"]').first().click();
    await expect.poll(() => page.locator('[data-testid="copilot-conversation"]').innerText()).toContain('Compress for web');
  });

  it('deletes a saved chat only through the red cross', async () => {
    const { page } = session;
    await seedSavedChats(page, [
      savedChat('chat-a', 'Keep me', Date.now(), 'openai'),
      savedChat('chat-b', 'Delete me', Date.now() - DAY_MS, null),
    ]);
    await openSavedChatsPanel(page);

    await expect.poll(() => page.locator('[data-testid="saved-chat-item"] button.MuiIconButton-colorError').count()).toBe(2);

    await page.locator('[data-testid="saved-chat-item"]').nth(1).locator('button.MuiIconButton-colorError').click();
    await expect.poll(() => page.locator('[data-testid="saved-chat-item"]').count()).toBe(1);
    await expect.poll(() => readSavedChats(page).then((chats) => chats.map((c) => c.id))).toEqual(['chat-a']);
  });

  it('asks before replacing an unsaved transcript with a saved chat', async () => {
    const { page } = session;
    await seedSavedChats(page, [savedChat('chat-a', 'Saved transcript', Date.now(), 'openai')]);
    await startActivePlan(page);

    await openSavedChatsPanel(page);
    await page.locator('[data-testid="saved-chat-open"]').first().click();
    await expect.poll(() => page.locator('[data-testid="open-chat-confirm"]').count()).toBe(1);

    await page.locator('[data-testid="open-chat-discard"]').click();
    await expect.poll(() => page.locator('[data-testid="copilot-conversation"]').innerText()).toContain('Saved transcript');
  });

  it('saves the active transcript and lists it in the panel', async () => {
    const { page } = session;
    await startActivePlan(page);

    await page.locator('[data-testid="copilot-save-chat"]').click();
    await expect.poll(() => readSavedChats(page).then((chats) => chats.length)).toBe(1);

    await openSavedChatsPanel(page);
    await expect.poll(() => page.locator('[data-testid="saved-chat-item"]').count()).toBe(1);
    await expect.poll(() => page.locator('[data-testid="saved-chat-item"]').first().innerText()).toContain(GOAL);
  });

  it('names the connected provider and model in the AI status chip', async () => {
    const { page } = session;
    await mockApi.setAiSettingsView(page, {
      providerId: 'openai',
      model: 'gpt-4o-mini',
      hasKey: true,
      connected: true,
      connectedAt: Date.now(),
      connectedModel: 'gpt-4o-mini',
    });
    session = await reloadSession(session);
    await gotoCopilot(session.page);

    await expect.poll(() => session.page.locator('[data-testid="copilot-ai-status"]').textContent()).toContain('OpenAI');
    await expect.poll(() => session.page.locator('[data-testid="copilot-ai-status"]').textContent()).toContain('gpt-4o-mini');
  });

  it('reports "not connected" in the AI status chip when no provider is configured', async () => {
    const { page } = session;
    await expect.poll(() => page.locator('[data-testid="copilot-ai-status"]').textContent()).toContain('Not connected');
  });

  it('clears the transcript when a fresh conversation is confirmed', async () => {
    const { page } = session;
    await startActivePlan(page);

    await page.locator('[data-testid="copilot-reset-conversation"]').click();
    // The confirm dialog has no test id; its confirm action is the second button (cancel comes first).
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ timeout: 5000 });
    await dialog.getByRole('button').nth(1).click();
    await expect.poll(() => page.locator('[data-testid="copilot-plan-summary"]').count()).toBe(0);
    await expect.poll(() => page.locator('[data-testid="copilot-conversation"]').innerText()).toContain('How can I help?');
  });
});
