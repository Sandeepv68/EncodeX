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
import { screen, waitFor, fireEvent } from '@testing-library/react';
import type { CopilotPlan } from '../../shared/copilot';

const PLAN_FIXTURE: CopilotPlan = {
  goal: 'compress for web',
  actions: [
    {
      id: 'convert_0',
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
      input: '/in/two.mkv',
      output: '/in/two_optimized.mkv',
      confidence: 0.7,
      rationale: ['Re-encodes to a web-friendly size.'],
      estimatedSizeBytes: 1_000_000,
      estimatedSavings: 0.6,
      options: { videoCodec: 'libx265' },
    },
  ],
  skips: [{ input: '/in/broken.mov', reason: 'read failed' }],
  rationale: ['Planned 2 conversion(s) toward "compress for web".'],
  notes: [],
  plan: { valid: true, order: ['convert_0', 'convert_1'], steps: [], issues: [], summary: '2 steps' },
  isEstimated: true,
};

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
});
