/**
 * @fileoverview Unit tests for the Copilot page (roadmap 7.4, R6).
 *
 * The page must be inert on mount (no bridge calls while rendering, so every
 * hostile/i18n matrix suite can mount it), plan only on user intent through the
 * existing bridge, and commit through the Batch Queue rather than inventing a
 * second approval system. These are exactly the four behaviours exercised here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderPage } from '../../test-utils/page-render';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import type { CopilotPlan } from '../../shared/copilot';

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
 * `disabled`.
 *
 * The button mirrors `buildPlan`'s own guards (`goal.trim() === ''` /
 * `inputs.length === 0`) in its `disabled` prop, so the two error branches are
 * unreachable by a real click: a disabled native button swallows mouse events,
 * and MUI's own click wrapper short-circuits on `disabled`. The harness walks
 * the committed React fiber (and its `alternate`, which carries the newest
 * render) up to the `ButtonBase` that received the page's handler, then calls
 * it inside `act` -- exercising the same code a user could only reach if the
 * guard order in the component ever drifts.
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

describe('Copilot page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.electronAPI.selectFolderFiles).mockResolvedValue(['/in/one.mp4', '/in/two.mkv']);
    vi.mocked(window.electronAPI.copilotPlan).mockResolvedValue(PLAN_FIXTURE);
  });

  it('mounts without touching any bridge method', () => {
    renderPage('Copilot');
    expect(window.electronAPI.copilotPlan).not.toHaveBeenCalled();
    expect(window.electronAPI.selectFolderFiles).not.toHaveBeenCalled();
    expect(window.electronAPI.queueAdd).not.toHaveBeenCalled();
    expect(screen.getByTestId('copilot-plan')).toBeDefined();
  });

  it('keeps Plan disabled until both a goal and a folder are provided', () => {
    renderPage('Copilot');
    expect((screen.getByTestId('copilot-plan') as HTMLButtonElement).disabled).toBe(true);
    const goalInput = screen.getByRole('textbox');
    fireEvent.change(goalInput, { target: { value: 'compress for web' } });
    expect((screen.getByTestId('copilot-plan') as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks the bridge to plan only after the user clicks Plan', async () => {
    renderPage('Copilot');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'compress for web' } });

    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    await waitFor(() => expect(window.electronAPI.selectFolderFiles).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('copilot-plan'));
    await waitFor(() =>
      expect(window.electronAPI.copilotPlan).toHaveBeenCalledWith({
        goal: 'compress for web',
        inputs: ['/in/one.mp4', '/in/two.mkv'],
        recursive: true,
        maxFiles: 50,
      }),
    );

    const summary = await screen.findByTestId('copilot-plan-summary');
    expect(summary).toBeDefined();
    expect(screen.getByTestId('copilot-action-convert_0')).toBeDefined();
    expect(screen.getByTestId('copilot-action-convert_1')).toBeDefined();
    expect(screen.getAllByTestId('copilot-skip')).toHaveLength(1);
    expect(window.electronAPI.queueAdd).not.toHaveBeenCalled();
  });

  it('lists read-only results when the plan reports them', async () => {
    vi.mocked(window.electronAPI.copilotPlan).mockResolvedValue({
      ...PLAN_FIXTURE,
      results: [{ operation: 'analyze', input: '/in/one.mp4', summary: 'H.264, 1080p' }],
    });
    renderPage('Copilot');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'analyze this' } });
    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    await waitFor(() => expect(window.electronAPI.selectFolderFiles).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');
    expect(screen.getByTestId('copilot-result')).toBeDefined();
    expect(screen.getByText('H.264, 1080p')).toBeDefined();
  });

  it('adds every planned action to the Batch Queue via queueAdd', async () => {
    renderPage('Copilot');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'compress for web' } });
    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    await waitFor(() => expect(window.electronAPI.selectFolderFiles).toHaveBeenCalledTimes(1));
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
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'compress for web' } });
    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    await waitFor(() => expect(window.electronAPI.selectFolderFiles).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('copilot-plan'));
    expect(await screen.findByTestId('copilot-error')).toBeDefined();
    expect(screen.queryByTestId('copilot-plan-summary')).toBeNull();
  });

  it('surfaces a rejected plan request as an inline error', async () => {
    vi.mocked(window.electronAPI.copilotPlan).mockRejectedValue(Object.assign(new Error('nope'), { code: 'PROBE_FAILED' }));
    renderPage('Copilot');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'compress' } });
    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    await waitFor(() => expect(window.electronAPI.selectFolderFiles).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('copilot-plan'));
    expect(await screen.findByTestId('copilot-error')).toBeDefined();
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
    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    await waitFor(() => expect(window.electronAPI.selectFolderFiles).toHaveBeenCalledTimes(1));
    await invokeOnClick(screen.getByTestId('copilot-plan'));
    expect(await screen.findByTestId('copilot-error')).toHaveTextContent('copilot.errorNoGoal');
    expect(window.electronAPI.copilotPlan).not.toHaveBeenCalled();
  });

  it('flags missing inputs when the plan guard runs without a folder', async () => {
    renderPage('Copilot');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'compress for web' } });
    await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('compress for web'));
    await invokeOnClick(screen.getByTestId('copilot-plan'));
    expect(await screen.findByTestId('copilot-error')).toHaveTextContent('copilot.errorNoInputs');
    expect(window.electronAPI.copilotPlan).not.toHaveBeenCalled();
  });

  it('reports a partial enqueue when some queueAdd calls fail', async () => {
    renderPage('Copilot');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'compress for web' } });
    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    await waitFor(() => expect(window.electronAPI.selectFolderFiles).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');
    vi.mocked(window.electronAPI.queueAdd).mockResolvedValueOnce('').mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByTestId('copilot-add-to-queue'));
    expect(await screen.findByTestId('copilot-error')).toHaveTextContent('copilot.partiallyAdded');
  });

  it('reports a total enqueue failure when every queueAdd call fails', async () => {
    renderPage('Copilot');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'compress for web' } });
    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    await waitFor(() => expect(window.electronAPI.selectFolderFiles).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('copilot-plan'));
    await screen.findByTestId('copilot-plan-summary');
    vi.mocked(window.electronAPI.queueAdd).mockRejectedValue(new Error('boom'));
    fireEvent.click(screen.getByTestId('copilot-add-to-queue'));
    expect(await screen.findByTestId('copilot-error')).toHaveTextContent('copilot.errorEnqueue');
  });

  it('passes a search phrase when the transcript-search operation is chosen', async () => {
    renderPage('Copilot');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'find the pricing bit' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'copilot.operationLabel' }));
    fireEvent.click(await screen.findByText('copilot.op.search_transcript'));
    fireEvent.change(await screen.findByRole('textbox', { name: 'copilot.queryLabel' }), { target: { value: 'pricing' } });
    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    await waitFor(() => expect(window.electronAPI.selectFolderFiles).toHaveBeenCalledTimes(1));
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
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'compress for web' } });
    fireEvent.click(screen.getByTestId('copilot-choose-files'));
    await waitFor(() => expect(window.electronAPI.selectFiles).toHaveBeenCalledTimes(1));
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

  it('passes a target language when the translate operation is chosen', async () => {
    renderPage('Copilot');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'translate the subtitles' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'copilot.operationLabel' }));
    fireEvent.click(await screen.findByText('copilot.op.translate'));
    fireEvent.change(await screen.findByRole('textbox', { name: 'copilot.targetLanguageLabel' }), { target: { value: 'es' } });
    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    await waitFor(() => expect(window.electronAPI.selectFolderFiles).toHaveBeenCalledTimes(1));
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
});
