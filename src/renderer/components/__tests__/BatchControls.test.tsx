import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { RefObject } from 'react';
import BatchControls from '../BatchControls';
import { BATCH_OPERATIONS, DEFAULT_SUFFIX } from '../../../shared/media-options';
import { TRANSCODER_TYPES } from '../../../shared/transcoder-constants';

function renderControls() {
  const operationRef = { current: BATCH_OPERATIONS[0].value } as RefObject<string>;
  const transcoderRef = { current: TRANSCODER_TYPES[0] } as RefObject<(typeof TRANSCODER_TYPES)[number]>;
  const suffixRef = { current: DEFAULT_SUFFIX } as RefObject<string>;
  const onAddFiles = vi.fn();
  const onCancelAll = vi.fn();
  render(
    <BatchControls
      operationRef={operationRef}
      transcoderRef={transcoderRef}
      suffixRef={suffixRef}
      onAddFiles={onAddFiles}
      onCancelAll={onCancelAll}
    />,
  );
  return { operationRef, transcoderRef, suffixRef, onAddFiles, onCancelAll };
}

describe('BatchControls', () => {
  it('renders the operation, transcoder, suffix and action buttons', () => {
    renderControls();
    expect(screen.getByText('batchQueue.addFiles')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.cancelAll')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('batchQueue.suffix')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
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
});
