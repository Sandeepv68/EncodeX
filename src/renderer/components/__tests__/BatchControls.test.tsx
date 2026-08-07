import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { RefObject } from 'react';
import BatchControls from '../BatchControls';
import { BATCH_OPERATIONS, DEFAULT_SUFFIX } from '../../../shared/media-options';
import { TRANSCODER_TYPES } from '../../../shared/transcoder-constants';

function renderControls(hasCompleted = false, concurrency = 1, opts: { paused?: boolean; hasActive?: boolean } = {}) {
  const operationRef = { current: BATCH_OPERATIONS[0].value } as RefObject<string>;
  const transcoderRef = { current: TRANSCODER_TYPES[0] } as RefObject<(typeof TRANSCODER_TYPES)[number]>;
  const suffixRef = { current: DEFAULT_SUFFIX } as RefObject<string>;
  const onAddFiles = vi.fn();
  const onCancelAll = vi.fn();
  const onClearCompleted = vi.fn();
  const onConcurrencyChange = vi.fn();
  const onPause = vi.fn();
  const onResume = vi.fn();
  const onOutputDirChange = vi.fn();
  const onBrowseDir = vi.fn();
  const onOverwriteChange = vi.fn();
  const onExport = vi.fn();
  const onImport = vi.fn();
  render(
    <BatchControls
      operationRef={operationRef}
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
      hasActive={opts.hasActive ?? false}
      outputDir=""
      onOutputDirChange={onOutputDirChange}
      onBrowseDir={onBrowseDir}
      overwrite={false}
      onOverwriteChange={onOverwriteChange}
      onExport={onExport}
      onImport={onImport}
    />,
  );
  return {
    operationRef,
    transcoderRef,
    suffixRef,
    onAddFiles,
    onCancelAll,
    onClearCompleted,
    onConcurrencyChange,
    onPause,
    onResume,
    onOutputDirChange,
    onBrowseDir,
    onOverwriteChange,
    onExport,
    onImport,
  };
}

describe('BatchControls', () => {
  it('renders the operation, transcoder, suffix, concurrency and action buttons', () => {
    renderControls();
    expect(screen.getByText('batchQueue.addFiles')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.cancelAll')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.pause')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.clearCompleted')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.exportQueue')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.importQueue')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('batchQueue.suffix')).toBeInTheDocument();
    expect(screen.getAllByText('batchQueue.concurrency').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
  });

  it('fires onConcurrencyChange when a different concurrency is chosen', () => {
    const { onConcurrencyChange } = renderControls(false, 1);
    fireEvent.mouseDown(screen.getAllByRole('combobox')[2]);
    fireEvent.click(screen.getByText('3'));
    expect(onConcurrencyChange).toHaveBeenCalledWith(3);
  });

  it('updates the operation ref when a different operation is chosen', () => {
    const { operationRef } = renderControls();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('batchQueue.operationExtractAudio'));
    expect(operationRef.current).toBe('extract_audio');
  });

  it('updates the transcoder ref when a different transcoder is chosen', () => {
    const { transcoderRef } = renderControls();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    fireEvent.click(screen.getByText('BMF'));
    expect(transcoderRef.current).toBe('BMF');
  });

  it('updates the suffix ref when the suffix field changes', () => {
    const { suffixRef } = renderControls();
    fireEvent.change(screen.getByPlaceholderText('batchQueue.suffix'), { target: { value: '_bak' } });
    expect(suffixRef.current).toBe('_bak');
  });

  it('fires onAddFiles when the add files button is clicked', () => {
    const { onAddFiles } = renderControls();
    fireEvent.click(screen.getByText('batchQueue.addFiles'));
    expect(onAddFiles).toHaveBeenCalledOnce();
  });

  it('fires onCancelAll when the cancel all button is clicked', () => {
    const { onCancelAll } = renderControls();
    fireEvent.click(screen.getByText('batchQueue.cancelAll'));
    expect(onCancelAll).toHaveBeenCalledOnce();
  });

  it('disables the clear completed button when no jobs are completed', () => {
    renderControls(false);
    expect(screen.getByText('batchQueue.clearCompleted')).toBeDisabled();
  });

  it('enables the clear completed button when completed jobs exist', () => {
    renderControls(true);
    expect(screen.getByText('batchQueue.clearCompleted')).toBeEnabled();
  });

  it('fires onClearCompleted when the clear completed button is clicked', () => {
    const { onClearCompleted } = renderControls(true);
    fireEvent.click(screen.getByText('batchQueue.clearCompleted'));
    expect(onClearCompleted).toHaveBeenCalledOnce();
  });

  it('renders a Pause button that fires onPause', () => {
    const { onPause } = renderControls(false, 1, { hasActive: true });
    const pause = screen.getByText('batchQueue.pause');
    expect(pause).toBeEnabled();
    fireEvent.click(pause);
    expect(onPause).toHaveBeenCalledOnce();
  });

  it('disables the Pause button when no jobs are queued or running', () => {
    renderControls(false, 1, { hasActive: false });
    expect(screen.getByText('batchQueue.pause')).toBeDisabled();
  });

  it('renders a Resume button instead of Pause when paused and fires onResume', () => {
    const { onResume } = renderControls(false, 1, { paused: true });
    expect(screen.queryByText('batchQueue.pause')).not.toBeInTheDocument();
    const resume = screen.getByText('batchQueue.resume');
    fireEvent.click(resume);
    expect(onResume).toHaveBeenCalledOnce();
  });

  it('renders the output directory field and browse button', () => {
    renderControls();
    expect(screen.getByPlaceholderText('batchQueue.outputDirPlaceholder')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.browse')).toBeInTheDocument();
  });

  it('fires onBrowseDir when the browse button is clicked', () => {
    const { onBrowseDir } = renderControls();
    fireEvent.click(screen.getByText('batchQueue.browse'));
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
    fireEvent.click(screen.getByText('batchQueue.exportQueue'));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('fires onImport when the import button is clicked', () => {
    const { onImport } = renderControls();
    fireEvent.click(screen.getByText('batchQueue.importQueue'));
    expect(onImport).toHaveBeenCalledOnce();
  });
});
