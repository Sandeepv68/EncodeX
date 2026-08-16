import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { RefObject } from 'react';
import BatchControls from '../BatchControls';
import { useDismissedAlertsStore } from '../../stores/dismissedAlertsStore';
import { BATCH_OPERATIONS, DEFAULT_SUFFIX } from '../../../shared/media-options';
import { TRANSCODER_TYPES } from '../../../shared/transcoder-constants';
import { assertNoAxeViolations } from '../../../test-utils/axe';

function renderControls(
  hasCompleted = false,
  concurrency = 1,
  opts: {
    paused?: boolean;
    hasRunning?: boolean;
    hasQueued?: boolean;
    hasActive?: boolean;
    whenDone?: { enabled: boolean; action: string; force: boolean };
    hardwareAccelAlert?: boolean;
  } = {},
) {
  const operation = BATCH_OPERATIONS[0].value;
  const onOperationChange = vi.fn();
  const transcoderRef = { current: TRANSCODER_TYPES[0] } as RefObject<(typeof TRANSCODER_TYPES)[number]>;
  const suffixRef = { current: DEFAULT_SUFFIX } as RefObject<string>;
  const onAddFiles = vi.fn();
  const onCancelAll = vi.fn();
  const onClearCompleted = vi.fn();
  const onConcurrencyChange = vi.fn();
  const onPause = vi.fn();
  const onResume = vi.fn();
  const onStart = vi.fn();
  const onOutputDirChange = vi.fn();
  const onBrowseDir = vi.fn();
  const onOverwriteChange = vi.fn();
  const whenDone = opts.whenDone ?? { enabled: false, action: 'shutdown', force: false };
  const onWhenDoneChange = vi.fn();
  const onExport = vi.fn();
  const onImport = vi.fn();
  const renderResult = render(
    <BatchControls
      operation={operation}
      onOperationChange={onOperationChange}
      transcoderRef={transcoderRef}
      suffixRef={suffixRef}
      onAddFiles={onAddFiles}
      onCancelAll={onCancelAll}
      onClearCompleted={onClearCompleted}
      hasCompleted={hasCompleted}
      concurrency={concurrency}
      onConcurrencyChange={onConcurrencyChange}
      paused={opts.paused ?? false}
      onPause={onPause}
      onResume={onResume}
      hasRunning={opts.hasRunning ?? false}
      hasQueued={opts.hasQueued ?? false}
      onStart={onStart}
      hasActive={opts.hasActive ?? false}
      outputDir=""
      onOutputDirChange={onOutputDirChange}
      onBrowseDir={onBrowseDir}
      overwrite={false}
      onOverwriteChange={onOverwriteChange}
      whenDone={whenDone}
      onWhenDoneChange={onWhenDoneChange}
      onExport={onExport}
      onImport={onImport}
      hardwareAccelAlert={opts.hardwareAccelAlert ?? false}
    />,
  );
  return {
    renderResult,
    operation,
    onOperationChange,
    transcoderRef,
    suffixRef,
    onAddFiles,
    onCancelAll,
    onClearCompleted,
    onConcurrencyChange,
    onPause,
    onResume,
    onStart,
    onOutputDirChange,
    onBrowseDir,
    onOverwriteChange,
    whenDone,
    onWhenDoneChange,
    onExport,
    onImport,
  };
}

describe('BatchControls', () => {
  beforeEach(() => {
    useDismissedAlertsStore.setState({ dismissed: [] });
  });

  it('has no axe violations', async () => {
    const { renderResult } = renderControls();
    await assertNoAxeViolations(renderResult.container);
  });

  it('renders the operation, transcoder, suffix, concurrency and action buttons', () => {
    renderControls();
    expect(screen.getByRole('button', { name: 'batchQueue.addFiles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'batchQueue.cancelAll' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'batchQueue.start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'batchQueue.clearCompleted' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'batchQueue.exportQueue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'batchQueue.importQueue' })).toBeInTheDocument();
    expect(screen.getByLabelText('batchQueue.suffix')).toBeInTheDocument();
    expect(screen.getAllByText('batchQueue.concurrency').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
    expect(screen.getByRole('combobox', { name: 'batchQueue.operation' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'batchQueue.detailsTranscoder' })).toBeInTheDocument();
    expect(screen.getByLabelText('batchQueue.outputDir')).toBeInTheDocument();
  });

  it('fires onConcurrencyChange when a different concurrency is chosen', () => {
    const { onConcurrencyChange } = renderControls(false, 1);
    fireEvent.mouseDown(screen.getAllByRole('combobox')[2]);
    fireEvent.click(screen.getByText('3'));
    expect(onConcurrencyChange).toHaveBeenCalledWith(3);
  });

  it('fires onOperationChange when a different operation is chosen', () => {
    const { onOperationChange } = renderControls();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('batchQueue.operationExtractAudio'));
    expect(onOperationChange).toHaveBeenCalledWith('extract_audio');
  });

  it('updates the transcoder ref when a different transcoder is chosen', () => {
    const { transcoderRef } = renderControls();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    fireEvent.click(screen.getByText('BMF'));
    expect(transcoderRef.current).toBe('BMF');
  });

  it('updates the suffix ref when the suffix field changes', () => {
    const { suffixRef } = renderControls();
    fireEvent.change(screen.getByLabelText('batchQueue.suffix'), { target: { value: '_bak' } });
    expect(suffixRef.current).toBe('_bak');
  });

  it('fires onAddFiles when the add files button is clicked', () => {
    const { onAddFiles } = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    expect(onAddFiles).toHaveBeenCalledOnce();
  });

  it('fires onCancelAll when the cancel all button is clicked', () => {
    const { onCancelAll } = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.cancelAll' }));
    expect(onCancelAll).toHaveBeenCalledOnce();
  });

  it('disables the clear completed button when no jobs are completed', () => {
    renderControls(false);
    expect(screen.getByRole('button', { name: 'batchQueue.clearCompleted' })).toBeDisabled();
  });

  it('enables the clear completed button when completed jobs exist', () => {
    renderControls(true);
    expect(screen.getByRole('button', { name: 'batchQueue.clearCompleted' })).toBeEnabled();
  });

  it('fires onClearCompleted when the clear completed button is clicked', () => {
    const { onClearCompleted } = renderControls(true);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.clearCompleted' }));
    expect(onClearCompleted).toHaveBeenCalledOnce();
  });

  it('renders a Pause button when jobs are running that fires onPause', () => {
    const { onPause } = renderControls(false, 1, { hasRunning: true, hasActive: true });
    expect(screen.queryByRole('button', { name: 'batchQueue.start' })).not.toBeInTheDocument();
    const pause = screen.getByRole('button', { name: 'batchQueue.pause' });
    expect(pause).toBeEnabled();
    fireEvent.click(pause);
    expect(onPause).toHaveBeenCalledOnce();
  });

  it('disables the Pause button when no jobs are queued or running', () => {
    renderControls(false, 1, { hasRunning: true, hasActive: false });
    expect(screen.getByRole('button', { name: 'batchQueue.pause' })).toBeDisabled();
  });

  it('renders a Start button when nothing is running and fires onStart', () => {
    const { onStart } = renderControls(false, 1, { hasQueued: true });
    expect(screen.queryByRole('button', { name: 'batchQueue.pause' })).not.toBeInTheDocument();
    const start = screen.getByRole('button', { name: 'batchQueue.start' });
    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('disables the Start button when no jobs are queued', () => {
    renderControls(false, 1, { hasQueued: false });
    expect(screen.getByRole('button', { name: 'batchQueue.start' })).toBeDisabled();
  });

  it('renders a Resume button instead of Start/Pause when paused and fires onResume', () => {
    const { onResume } = renderControls(false, 1, { paused: true });
    expect(screen.queryByRole('button', { name: 'batchQueue.pause' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'batchQueue.start' })).not.toBeInTheDocument();
    const resume = screen.getByRole('button', { name: 'batchQueue.resume' });
    fireEvent.click(resume);
    expect(onResume).toHaveBeenCalledOnce();
  });

  it('renders the output directory field and browse button', () => {
    renderControls();
    expect(screen.getByPlaceholderText('batchQueue.outputDirPlaceholder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'batchQueue.browse' })).toBeInTheDocument();
  });

  it('fires onBrowseDir when the browse button is clicked', () => {
    const { onBrowseDir } = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.browse' }));
    expect(onBrowseDir).toHaveBeenCalledOnce();
  });

  it('fires onOutputDirChange when the output directory field changes', () => {
    const { onOutputDirChange } = renderControls();
    fireEvent.change(screen.getByPlaceholderText('batchQueue.outputDirPlaceholder'), { target: { value: '/out' } });
    expect(onOutputDirChange).toHaveBeenCalledWith('/out');
  });

  it('fires onOverwriteChange when the overwrite checkbox is toggled', () => {
    const { onOverwriteChange } = renderControls();
    fireEvent.click(screen.getByLabelText('batchQueue.overwrite'));
    expect(onOverwriteChange).toHaveBeenCalledWith(true);
  });

  it('fires onExport when the export button is clicked', () => {
    const { onExport } = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.exportQueue' }));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('fires onImport when the import button is clicked', () => {
    const { onImport } = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.importQueue' }));
    expect(onImport).toHaveBeenCalledOnce();
  });

  it('hides the when-done action select and force checkbox while disabled', () => {
    renderControls(false, 1, { whenDone: { enabled: false, action: 'shutdown', force: false } });
    expect(screen.getByLabelText('batchQueue.whenDone')).toBeInTheDocument();
    expect(screen.queryByLabelText('batchQueue.whenDoneAction')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('batchQueue.whenDoneForce')).not.toBeInTheDocument();
  });

  it('fires onWhenDoneChange with enabled true when the when-done checkbox is toggled on', () => {
    const { onWhenDoneChange } = renderControls(false, 1, { whenDone: { enabled: false, action: 'shutdown', force: false } });
    fireEvent.click(screen.getByLabelText('batchQueue.whenDone'));
    expect(onWhenDoneChange).toHaveBeenCalledWith({ enabled: true, action: 'shutdown', force: false });
  });

  it('reveals the action select and force checkbox when enabled', () => {
    renderControls(false, 1, { whenDone: { enabled: true, action: 'shutdown', force: false } });
    expect(screen.getByRole('combobox', { name: 'batchQueue.whenDoneAction' })).toBeInTheDocument();
    expect(screen.getByLabelText('batchQueue.whenDoneForce')).toBeInTheDocument();
  });

  it('fires onWhenDoneChange with the new action when a different action is chosen', () => {
    const { onWhenDoneChange } = renderControls(false, 1, { whenDone: { enabled: true, action: 'shutdown', force: false } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'batchQueue.whenDoneAction' }));
    fireEvent.click(screen.getByText('batchQueue.whenDoneSleep'));
    expect(onWhenDoneChange).toHaveBeenCalledWith({ enabled: true, action: 'sleep', force: false });
  });

  it('fires onWhenDoneChange with force true when the force checkbox is toggled', () => {
    const { onWhenDoneChange } = renderControls(false, 1, { whenDone: { enabled: true, action: 'shutdown', force: false } });
    fireEvent.click(screen.getByLabelText('batchQueue.whenDoneForce'));
    expect(onWhenDoneChange).toHaveBeenCalledWith({ enabled: true, action: 'shutdown', force: true });
  });

  it('shows the hardware acceleration alert when hardware acceleration is enabled', () => {
    renderControls(false, 1, { hardwareAccelAlert: true });
    expect(screen.getByRole('alert')).toHaveTextContent('convert.hardwareAccelAlert');
  });

  it('does not show the hardware acceleration alert by default', () => {
    renderControls();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('dismisses the hardware acceleration alert via its close button', () => {
    renderControls(false, 1, { hardwareAccelAlert: true });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
