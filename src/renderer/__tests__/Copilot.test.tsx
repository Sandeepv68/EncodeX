/**
 * @fileoverview Unit tests for the Copilot page (roadmap 7.4, R6) and its
 * ChatGPT-style conversation UI.
 *
 * The page must be inert on mount (no bridge calls while rendering), plan only
 * on user intent through the existing bridge, and commit through the Batch Queue
 * rather than inventing a second approval system. The composer is a Lexical
 * editor, so these tests drive it the way the browser does: an `input` event
 * carrying the inserted text, and a `keydown` for Enter/Shift+Enter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderPage } from '../../test-utils/page-render';
import { screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { NavigationGuardProvider } from '../NavigationGuardContext';
import { useToastStore } from '../stores/toastStore';
import { useAiConnectionStore } from '../stores/aiConnectionStore';
import type { CopilotPlan } from '../../shared/copilot';

/** The most recent route the page navigated to, captured by {@link LocationProbe}. */
let lastPath = '';

/**
 * Composes the current router location into a module-level variable so a test
 * can assert where the page navigated without rendering the whole route table.
 * @returns {null} Renders nothing.
 */
function LocationProbe() {
  lastPath = useLocation().pathname;
  return null;
}

/**
 * Flushes React work and asserts the router landed on `expected`.
 *
 * A `navigate` issued from an async click handler re-renders the provider tree
 * without touching the page's own DOM, so `waitFor`'s DOM polling alone does
 * not observe it; each turn is pushed through `act` until the probe sees the
 * new path.
 * @param {string} expected - The pathname the probe should report.
 * @returns {Promise<void>} Resolves once the path matches.
 */
async function expectPath(expected: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (lastPath === expected) return;
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
  expect(lastPath).toBe(expected);
}

const PLAN_FIXTURE: CopilotPlan = {
  goal: 'compress for web',
  operation: 'convert',
  actions: [
    {
      id: 'convert_0',
      operation: 'convert',
      input: '/in/one.mp4',
      output: '/in/one_optimized.mp4',
      confidence: 0.8,
      rationale: ['Re-encodes to a web-friendly size.'],
      estimatedSizeBytes: 500_000,
      estimatedSavings: 0.5,
      options: { videoCodec: 'libx264', videoBitrate: '1000k' },
    },
    {
      id: 'convert_1',
      operation: 'convert',
      input: '/in/two.mkv',
      output: '/in/two_optimized.mkv',
      confidence: 0.7,
      rationale: ['Re-encodes to a web-friendly size.'],
      estimatedSizeBytes: 1_000_000,
      estimatedSavings: 0.6,
      options: { videoCodec: 'libx265' },
    },
  ],
  results: [],
  skips: [{ input: '/in/broken.mov', reason: 'read failed' }],
  rationale: ['Planned 2 conversion(s) toward "compress for web".'],
  notes: [],
  plan: { valid: true, order: ['convert_0', 'convert_1'], steps: [], issues: [], summary: '2 steps' },
  providerId: 'rules',
  isEstimated: true,
};

/** Minimal shape of a React fiber node needed to walk up to the page handler. */
interface ReactFiberNode {
  memoizedProps?: { onClick?: unknown };
  return?: ReactFiberNode | null;
  alternate?: ReactFiberNode | null;
}

/**
 * Finds the first `onClick` a fiber's ancestors received, walking past MUI's
 * own click wrapper (which it passes down to the host `<button>`).
 * @param {ReactFiberNode} start - The fiber to begin walking from.
 * @param {unknown} muiOnClick - MUI's wrapper, ignored while searching.
 * @returns {(() => unknown) | undefined} The page handler, if found.
 */
function findPageHandler(start: ReactFiberNode | null | undefined, muiOnClick: unknown): (() => unknown) | undefined {
  let fiber = start?.return ?? null;
  while (fiber) {
    const onClick = fiber.memoizedProps?.onClick;
    const isMuiWrapper = typeof onClick === 'function' && (onClick as { name?: string }).name === 'handleClick';
    if (typeof onClick === 'function' && onClick !== muiOnClick && !isMuiWrapper) return onClick as () => unknown;
    fiber = fiber.return ?? null;
  }
  return undefined;
}

/**
 * Invokes the page's committed `onClick` even while the Plan button is
 * `disabled`, exercising the guards a real click cannot reach.
 * @param {HTMLElement} element - The button whose page handler should run.
 * @returns {Promise<void>} Resolves once the handler and its state updates settle.
 */
async function invokeOnClick(element: HTMLElement): Promise<void> {
  const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber'));
  expect(fiberKey).toBeDefined();
  const hostFiber = (element as unknown as Record<string, ReactFiberNode | undefined>)[fiberKey!];
  expect(hostFiber).toBeDefined();
  const muiOnClick = hostFiber!.memoizedProps?.onClick;
  const handler = findPageHandler(hostFiber!.alternate, muiOnClick) ?? findPageHandler(hostFiber, muiOnClick);
  expect(typeof handler).toBe('function');
  const pageHandler = handler!;
  await act(async () => {
    await pageHandler();
  });
}

/** Returns the Lexical contenteditable root. */
function getEditor(): HTMLElement {
  const el = document.querySelector('[data-lexical-editor="true"]');
  if (!el) throw new Error('Lexical editor not found');
  return el as HTMLElement;
}

/**
 * Types text into the Lexical composer the way the browser does.
 * @param {string} text - The text to insert.
 * @returns {Promise<void>} Resolves once the change has settled.
 */
async function typeMessage(text: string): Promise<void> {
  const editor = getEditor();
  await act(async () => {
    editor.focus();
    fireEvent.input(editor, { data: text, inputType: 'insertText' });
  });
}

/**
 * Opens the advanced-options popover and selects an operation.
 * @param {string} operationKey - The `copilot.op.*` label of the operation.
 * @returns {Promise<void>} Resolves once the operation is selected.
 */
async function chooseOperation(operationKey: string): Promise<void> {
  fireEvent.click(screen.getByTestId('copilot-advanced'));
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'copilot.operationLabel' }));
  fireEvent.click(await screen.findByText(operationKey));
}

/**
 * Chooses the fixture folder and waits for the selection to flush into state.
 * @param {boolean} [waitEnabled] - When a goal is present, also wait for Plan to
 *   become enabled (which proves the chosen inputs reached the page state).
 * @returns {Promise<void>} Resolves once the folder has been applied.
 */
async function chooseFolder(waitEnabled = true): Promise<void> {
  fireEvent.click(screen.getByTestId('copilot-choose-folder'));
  await waitFor(() => expect(window.electronAPI.selectFolderFiles).toHaveBeenCalledTimes(1));
  if (waitEnabled) {
    await waitFor(() => expect((screen.getByTestId('copilot-plan') as HTMLButtonElement).disabled).toBe(false));
  }
}

describe('Copilot page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: [] });
    useAiConnectionStore.getState().reset();
    lastPath = '';
    vi.mocked(window.electronAPI.selectFolderFiles).mockResolvedValue(['/in/one.mp4', '/in/two.mkv']);
    vi.mocked(window.electronAPI.selectFiles).mockReset().mockResolvedValue([]);
    vi.mocked(window.electronAPI.queueAdd).mockReset().mockResolvedValue('');
    vi.mocked(window.electronAPI.copilotPlan).mockResolvedValue(PLAN_FIXTURE);
  });

  it('mounts without touching any bridge method', () => {
    renderPage('Copilot');
    expect(window.electronAPI.copilotPlan).not.toHaveBeenCalled();
    expect(window.electronAPI.selectFolderFiles).not.toHaveBeenCalled();
    expect(window.electronAPI.queueAdd).not.toHaveBeenCalled();
    expect(screen.getByTestId('copilot-plan')).toBeDefined();
    expect(getEditor()).toBeDefined();
  });

  it('shows the disconnected AI status without fetching settings on mount', () => {
    renderPage('Copilot');
    expect(window.electronAPI.aiGetSettings).not.toHaveBeenCalled();
    const status = screen.getByTestId('copilot-ai-status');
    expect(status).toHaveTextContent('copilot.ai.notConnected');
  });

  it('marks the empty transcript so the welcome and composer share the center', async () => {
    renderPage('Copilot');
    const conversation = screen.getByTestId('copilot-conversation');
    expect(conversation).toHaveAttribute('data-empty', 'true');
    expect(screen.getByTestId('copilot-plan')).toBeInTheDocument();

    await typeMessage('compress for web');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');

    expect(screen.getByTestId('copilot-conversation')).not.toHaveAttribute('data-empty');
  });

  it('clears the conversation and inputs when a reset is confirmed', async () => {
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');

    fireEvent.click(screen.getByTestId('copilot-reset-conversation'));
    const dialog = await screen.findByRole('dialog');
    // DialogActions order: cancel first, confirm second.
    fireEvent.click(within(dialog).getAllByRole('button')[1]);

    await waitFor(() => expect(screen.queryByTestId('copilot-plan-summary')).not.toBeInTheDocument());
    expect(screen.getByTestId('copilot-conversation')).toHaveAttribute('data-empty', 'true');
    expect(getEditor().textContent ?? '').toBe('');
  });

  it('shows the connected provider and model from the mirrored connection', async () => {
    renderPage('Copilot');
    act(() => {
      useAiConnectionStore.setState({
        view: {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          hasKey: true,
          keyHint: '••••••••',
          storedInsecurely: false,
          encryptionAvailable: true,
          connected: false,
          activeConnection: { providerId: 'openai', model: 'gpt-4o-mini', at: 9 },
        },
      });
    });
    const status = await screen.findByTestId('copilot-ai-status');
    // The test i18n mock returns keys, so assert on the connected branch's key
    // (the interpolated provider/model live in the localized string).
    expect(status).toHaveTextContent('settings.ai.headerConnected');
    expect(status).not.toHaveTextContent('copilot.ai.notConnected');
    expect(window.electronAPI.aiGetSettings).not.toHaveBeenCalled();
  });

  it('keeps Plan disabled until both a goal and a folder are provided', async () => {
    renderPage('Copilot');
    expect((screen.getByTestId('copilot-plan') as HTMLButtonElement).disabled).toBe(true);
    await typeMessage('compress for web');
    expect((screen.getByTestId('copilot-plan') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    await waitFor(() => expect((screen.getByTestId('copilot-plan') as HTMLButtonElement).disabled).toBe(false));
  });

  it('asks the bridge to plan only after the user clicks Plan', async () => {
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();
    expect(window.electronAPI.copilotPlan).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('copilot-plan'));
    await waitFor(() =>
      expect(window.electronAPI.copilotPlan).toHaveBeenCalledWith({
        goal: 'compress for web',
        inputs: ['/in/one.mp4', '/in/two.mkv'],
        recursive: true,
        maxFiles: 50,
      }),
    );

    expect(await screen.findByTestId('copilot-plan-summary')).toBeDefined();
    expect(screen.getByTestId('copilot-action-convert_0')).toBeDefined();
    expect(screen.getByTestId('copilot-action-convert_1')).toBeDefined();
    expect(screen.getAllByTestId('copilot-skip')).toHaveLength(1);
    expect(window.electronAPI.queueAdd).not.toHaveBeenCalled();
  });

  it('submits on Enter', async () => {
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();

    await act(async () => {
      fireEvent.keyDown(getEditor(), { key: 'Enter' });
    });
    await waitFor(() => expect(window.electronAPI.copilotPlan).toHaveBeenCalledTimes(1));
  });

  it('does not submit on Shift+Enter', async () => {
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();

    await act(async () => {
      fireEvent.keyDown(getEditor(), { key: 'Enter', shiftKey: true });
    });
    expect(window.electronAPI.copilotPlan).not.toHaveBeenCalled();
  });

  it('lists read-only results when the plan reports them', async () => {
    vi.mocked(window.electronAPI.copilotPlan).mockResolvedValue({
      ...PLAN_FIXTURE,
      results: [{ operation: 'analyze', input: '/in/one.mp4', summary: 'H.264, 1080p' }],
    });
    renderPage('Copilot');
    await typeMessage('analyze this');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');
    expect(screen.getByTestId('copilot-result')).toBeDefined();
    expect(screen.getByText('H.264, 1080p')).toBeDefined();
  });

  it('adds every planned action to the Batch Queue via queueAdd', async () => {
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');

    fireEvent.click(screen.getByTestId('copilot-add-to-queue'));
    await waitFor(() => expect(window.electronAPI.queueAdd).toHaveBeenCalledTimes(2));
    expect(window.electronAPI.queueAdd).toHaveBeenNthCalledWith(
      1,
      '/in/one.mp4',
      '/in/one_optimized.mp4',
      PLAN_FIXTURE.actions[0].options,
      'FFMPEG',
      false,
    );
    expect(window.electronAPI.queueAdd).toHaveBeenNthCalledWith(
      2,
      '/in/two.mkv',
      '/in/two_optimized.mkv',
      PLAN_FIXTURE.actions[1].options,
      'FFMPEG',
      false,
    );
  });

  it('survives a malformed plan payload with an inline error', async () => {
    vi.mocked(window.electronAPI.copilotPlan).mockResolvedValue({ actions: 'nope', skips: [] } as never);
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    expect(await screen.findByTestId('copilot-error')).toBeDefined();
    expect(screen.queryByTestId('copilot-plan-summary')).toBeNull();
  });

  it('surfaces a rejected plan request as an inline error', async () => {
    vi.mocked(window.electronAPI.copilotPlan).mockRejectedValue(Object.assign(new Error('nope'), { code: 'PROBE_FAILED' }));
    renderPage('Copilot');
    await typeMessage('compress');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    expect(await screen.findByTestId('copilot-error')).toBeDefined();
  });

  it('shows a timeout error when the plan request never settles', async () => {
    vi.mocked(window.electronAPI.copilotPlan).mockReturnValue(new Promise<CopilotPlan>(() => {}));
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();
    vi.useFakeTimers();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    vi.useRealTimers();
    expect(await screen.findByTestId('copilot-error')).toHaveTextContent('copilot.bridgeTimeout');
  });

  it('closes the advanced popover on Escape', async () => {
    renderPage('Copilot');
    fireEvent.click(screen.getByTestId('copilot-advanced'));
    const operation = await screen.findByTestId('copilot-operation');
    fireEvent.keyDown(operation, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('copilot-operation')).toBeNull());
  });

  it('shows a notice when the chosen folder contains no media files', async () => {
    vi.mocked(window.electronAPI.selectFolderFiles).mockResolvedValue([]);
    renderPage('Copilot');
    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    expect(await screen.findByTestId('copilot-notice')).toBeInTheDocument();
    expect(window.electronAPI.copilotPlan).not.toHaveBeenCalled();
  });

  it('flags a missing goal when the plan guard runs without one', async () => {
    renderPage('Copilot');
    await chooseFolder(false);
    await invokeOnClick(screen.getByTestId('copilot-plan'));
    expect(await screen.findByTestId('copilot-error')).toHaveTextContent('copilot.errorNoGoal');
    expect(window.electronAPI.copilotPlan).not.toHaveBeenCalled();
  });

  it('flags missing inputs when the plan guard runs without a folder', async () => {
    renderPage('Copilot');
    await typeMessage('compress for web');
    await invokeOnClick(screen.getByTestId('copilot-plan'));
    expect(await screen.findByTestId('copilot-error')).toHaveTextContent('copilot.errorNoInputs');
    expect(window.electronAPI.copilotPlan).not.toHaveBeenCalled();
  });

  it('reports a partial enqueue when some queueAdd calls fail', async () => {
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');
    vi.mocked(window.electronAPI.queueAdd).mockResolvedValueOnce('').mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByTestId('copilot-add-to-queue'));
    expect(await screen.findByTestId('copilot-error')).toHaveTextContent('copilot.partiallyAdded');
  });

  it('reports a total enqueue failure when every queueAdd call fails', async () => {
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');
    vi.mocked(window.electronAPI.queueAdd).mockRejectedValue(new Error('boom'));
    fireEvent.click(screen.getByTestId('copilot-add-to-queue'));
    expect(await screen.findByTestId('copilot-error')).toHaveTextContent('copilot.errorEnqueue');
  });

  it('passes a search phrase when the transcript-search operation is chosen', async () => {
    renderPage('Copilot');
    await typeMessage('find the pricing bit');
    await chooseOperation('copilot.op.search_transcript');
    fireEvent.change(screen.getByRole('textbox', { name: 'copilot.queryLabel' }), { target: { value: 'pricing' } });
    fireEvent.click(screen.getByTestId('copilot-advanced-close'));
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await waitFor(() =>
      expect(window.electronAPI.copilotPlan).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'search_transcript', query: 'pricing' }),
      ),
    );
  });

  it('adds files chosen through the file dialog to the inputs', async () => {
    vi.mocked(window.electronAPI.selectFiles).mockResolvedValue(['/in/one.mp4', '/in/two.mkv']);
    renderPage('Copilot');
    await typeMessage('compress for web');
    fireEvent.click(screen.getByTestId('copilot-choose-files'));
    await waitFor(() => expect(window.electronAPI.selectFiles).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((screen.getByTestId('copilot-plan') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await waitFor(() =>
      expect(window.electronAPI.copilotPlan).toHaveBeenCalledWith(expect.objectContaining({ inputs: ['/in/one.mp4', '/in/two.mkv'] })),
    );
  });

  it('shows a notice when the file dialog returns no files', async () => {
    vi.mocked(window.electronAPI.selectFiles).mockResolvedValue([]);
    renderPage('Copilot');
    fireEvent.click(screen.getByTestId('copilot-choose-files'));
    expect(await screen.findByTestId('copilot-notice')).toBeInTheDocument();
    expect(window.electronAPI.copilotPlan).not.toHaveBeenCalled();
  });

  it('removes an attachment when its chip delete icon is clicked', async () => {
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();
    expect(screen.getByText('one.mp4')).toBeInTheDocument();
    expect(screen.getByText('two.mkv')).toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId('CancelIcon')[0]);
    await waitFor(() => expect(screen.queryByText('one.mp4')).toBeNull());
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await waitFor(() => expect(window.electronAPI.copilotPlan).toHaveBeenCalledWith(expect.objectContaining({ inputs: ['/in/two.mkv'] })));
  });

  it('passes a target language when the translate operation is chosen', async () => {
    renderPage('Copilot');
    await typeMessage('translate the subtitles');
    await chooseOperation('copilot.op.translate');
    fireEvent.change(screen.getByRole('textbox', { name: 'copilot.targetLanguageLabel' }), { target: { value: 'es' } });
    fireEvent.click(screen.getByTestId('copilot-advanced-close'));
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await waitFor(() =>
      expect(window.electronAPI.copilotPlan).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'translate', targetLanguage: 'es' }),
      ),
    );
  });

  it('links to Settings for AI provider configuration without calling the bridge', () => {
    renderPage('Copilot');
    fireEvent.click(screen.getByTestId('copilot-ai-settings'));
    expect(window.electronAPI.aiGetSettings).not.toHaveBeenCalled();
  });

  it('navigates to Settings without prompting when no chat is active', async () => {
    renderPage('Copilot', {
      wrap: (children) => (
        <NavigationGuardProvider>
          <LocationProbe />
          {children}
        </NavigationGuardProvider>
      ),
    });
    fireEvent.click(screen.getByTestId('copilot-ai-settings'));
    await expectPath('/settings');
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('asks before leaving the page while a chat is active', async () => {
    renderPage('Copilot', {
      wrap: (children) => (
        <NavigationGuardProvider>
          <LocationProbe />
          {children}
        </NavigationGuardProvider>
      ),
    });
    await typeMessage('compress for web');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');

    fireEvent.click(screen.getByTestId('copilot-ai-settings'));
    expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument();
    await expectPath('/copilot');

    fireEvent.click(screen.getByTestId('confirm-cancel'));
    await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument());
    await expectPath('/copilot');

    fireEvent.click(screen.getByTestId('copilot-ai-settings'));
    fireEvent.click(await screen.findByTestId('confirm-confirm'));
    await expectPath('/settings');
  });

  it('shows a success toast and navigates to the batch queue after a full enqueue', async () => {
    renderPage('Copilot', {
      wrap: (children) => (
        <NavigationGuardProvider>
          <LocationProbe />
          {children}
        </NavigationGuardProvider>
      ),
    });
    await typeMessage('compress for web');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');

    fireEvent.click(screen.getByTestId('copilot-add-to-queue'));
    await waitFor(() => expect(window.electronAPI.queueAdd).toHaveBeenCalledTimes(2));
    await expectPath('/batch');
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    const toasts = useToastStore.getState().toasts;
    expect(toasts.map((toast) => toast.message)).toContain('copilot.addedToQueue');
    expect(toasts[0].type).toBe('success');
  });

  it('does not toast when every enqueue call fails', async () => {
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');

    vi.mocked(window.electronAPI.queueAdd).mockRejectedValue(new Error('boom'));
    fireEvent.click(screen.getByTestId('copilot-add-to-queue'));
    expect(await screen.findByTestId('copilot-error')).toHaveTextContent('copilot.errorEnqueue');
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('shows an inline error when the folder dialog rejects', async () => {
    vi.mocked(window.electronAPI.selectFolderFiles).mockRejectedValue(new Error('nope'));
    renderPage('Copilot');
    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    expect(await screen.findByTestId('copilot-error')).toHaveTextContent('copilot.dialogFailed');
  });

  it('shows an inline error when the file dialog rejects', async () => {
    vi.mocked(window.electronAPI.selectFiles).mockRejectedValue(new Error('nope'));
    renderPage('Copilot');
    fireEvent.click(screen.getByTestId('copilot-choose-files'));
    expect(await screen.findByTestId('copilot-error')).toHaveTextContent('copilot.dialogFailed');
  });

  it('ignores a folder dialog that never settles', async () => {
    vi.mocked(window.electronAPI.selectFolderFiles).mockReturnValue(new Promise<string[]>(() => {}));
    renderPage('Copilot');
    vi.useFakeTimers();
    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    vi.useRealTimers();
    expect(screen.queryByTestId('copilot-error')).toBeNull();
    expect(screen.queryByTestId('copilot-notice')).toBeNull();
  });

  it('shows the thinking state while a plan request is in flight', async () => {
    vi.mocked(window.electronAPI.copilotPlan).mockReturnValue(new Promise<CopilotPlan>(() => {}));
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();

    fireEvent.click(screen.getByTestId('copilot-plan'));
    await waitFor(() => expect(screen.getByText('copilot.planning', { selector: 'button' })).toBeDefined());
    expect((screen.getByTestId('copilot-plan') as HTMLButtonElement).disabled).toBe(true);
  });

  it('de-duplicates a file chosen through both the folder and file dialogs', async () => {
    vi.mocked(window.electronAPI.selectFolderFiles).mockResolvedValue(['/in/one.mp4']);
    vi.mocked(window.electronAPI.selectFiles).mockResolvedValue(['/in/one.mp4', '/in/two.mkv']);
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-choose-files'));
    await waitFor(() => expect(window.electronAPI.selectFiles).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await waitFor(() =>
      expect(window.electronAPI.copilotPlan).toHaveBeenCalledWith(expect.objectContaining({ inputs: ['/in/one.mp4', '/in/two.mkv'] })),
    );
  });

  it('clears a previous error when a new plan starts', async () => {
    renderPage('Copilot');
    await invokeOnClick(screen.getByTestId('copilot-plan'));
    expect(await screen.findByTestId('copilot-error')).toHaveTextContent('copilot.errorNoGoal');
    await typeMessage('compress for web');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');
    expect(screen.queryByTestId('copilot-error')).toBeNull();
  });

  it('resets the busy state and drops the placeholder when planning fails', async () => {
    vi.mocked(window.electronAPI.copilotPlan).mockRejectedValue(new Error('boom'));
    renderPage('Copilot');
    await typeMessage('compress for web');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    expect(await screen.findByTestId('copilot-error')).toBeDefined();
    expect(screen.queryByText('copilot.planning')).toBeNull();
    expect(screen.getByTestId('copilot-plan')).toHaveTextContent('copilot.plan');
  });

  it('sends only the operation for a forced remux plan', async () => {
    renderPage('Copilot');
    await typeMessage('remux to mkv');
    await chooseOperation('copilot.op.remux');
    fireEvent.click(screen.getByTestId('copilot-advanced-close'));
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await waitFor(() => expect(window.electronAPI.copilotPlan).toHaveBeenCalled());
    const arg = vi.mocked(window.electronAPI.copilotPlan).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(arg).toMatchObject({ operation: 'remux' });
    expect(arg).not.toHaveProperty('query');
    expect(arg).not.toHaveProperty('targetLanguage');
  });

  it('does not send a stale search phrase for a non-search operation', async () => {
    renderPage('Copilot');
    await typeMessage('plan this media');
    fireEvent.click(screen.getByTestId('copilot-advanced'));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'copilot.operationLabel' }));
    fireEvent.click(await screen.findByText('copilot.op.search_transcript'));
    fireEvent.change(screen.getByRole('textbox', { name: 'copilot.queryLabel' }), { target: { value: 'pricing' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'copilot.operationLabel' }));
    fireEvent.click(await screen.findByText('copilot.op.remux'));
    fireEvent.click(screen.getByTestId('copilot-advanced-close'));
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await waitFor(() => expect(window.electronAPI.copilotPlan).toHaveBeenCalled());
    const arg = vi.mocked(window.electronAPI.copilotPlan).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(arg).toMatchObject({ operation: 'remux' });
    expect(arg).not.toHaveProperty('query');
  });

  it('does not send a stale target language for a non-translate operation', async () => {
    renderPage('Copilot');
    await typeMessage('plan this media');
    fireEvent.click(screen.getByTestId('copilot-advanced'));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'copilot.operationLabel' }));
    fireEvent.click(await screen.findByText('copilot.op.translate'));
    fireEvent.change(screen.getByRole('textbox', { name: 'copilot.targetLanguageLabel' }), { target: { value: 'es' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'copilot.operationLabel' }));
    fireEvent.click(await screen.findByText('copilot.op.remux'));
    fireEvent.click(screen.getByTestId('copilot-advanced-close'));
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await waitFor(() => expect(window.electronAPI.copilotPlan).toHaveBeenCalled());
    const arg = vi.mocked(window.electronAPI.copilotPlan).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(arg).not.toHaveProperty('targetLanguage');
  });

  it('renders an empty-action plan without an add-to-queue button', async () => {
    vi.mocked(window.electronAPI.copilotPlan).mockResolvedValue({
      ...PLAN_FIXTURE,
      actions: [],
      plan: { ...PLAN_FIXTURE.plan, steps: [] },
    });
    renderPage('Copilot');
    await typeMessage('nothing to change');
    await chooseFolder();
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');
    expect(screen.getByText(/copilot.noActions/)).toBeDefined();
    expect(screen.queryByTestId('copilot-add-to-queue')).toBeNull();
    expect(window.electronAPI.queueAdd).not.toHaveBeenCalled();
  });
});
