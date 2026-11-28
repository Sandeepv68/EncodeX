import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import History from '../History';
import { useHistoryStore } from '../../stores/historyStore';
import type { HistoryEntry } from '../../../shared/history/types';
import { assertNoAxeViolations } from '../../../test-utils/axe';

function makeEntry(id: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id,
    family: 'convert',
    source: 'gui',
    status: 'succeeded',
    startedAt: 1_700_000_000_000,
    finishedAt: 1_700_000_001_000,
    durationMs: 1000,
    inputs: [`/tmp/${id}.mp4`],
    outputs: [`/tmp/${id}.mkv`],
    metadata: {},
    ...overrides,
  };
}

describe('History', () => {
  beforeEach(() => {
    useHistoryStore.getState().reset();
    vi.mocked(window.electronAPI.historyList).mockResolvedValue([
      makeEntry('a', { family: 'convert', status: 'succeeded' }),
      makeEntry('b', { family: 'batch', status: 'failed', error: { message: 'boom' }, inputs: ['/tmp/batch.mov'] }),
    ]);
    vi.mocked(window.electronAPI.historyGetThumbnail).mockResolvedValue(null);
    vi.mocked(window.electronAPI.historyClear).mockResolvedValue(undefined);
    vi.mocked(window.electronAPI.historyRemove).mockResolvedValue(true);
  });

  it('loads and lists operation history', async () => {
    render(<History />);
    await waitFor(() => expect(screen.getByTestId('history-row-a')).toBeInTheDocument());
    expect(screen.getByTestId('history-row-b')).toBeInTheDocument();
    expect(screen.getByText('history.familyLabels.convert')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('filters entries by search text', async () => {
    render(<History />);
    await waitFor(() => expect(screen.getByTestId('history-row-a')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('history-search'), { target: { value: 'batch.mov' } });
    expect(screen.queryByTestId('history-row-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('history-row-b')).toBeInTheDocument();
  });

  it('selects an entry and opens its details', async () => {
    render(<History />);
    await waitFor(() => expect(screen.getByTestId('history-row-a')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('history-select-a'));
    expect(screen.getByTestId('history-details-dialog')).toBeInTheDocument();
    expect(within(screen.getByTestId('history-details-dialog')).getByText('/tmp/a.mp4')).toBeInTheDocument();
  });

  it('asks for confirmation before clearing', async () => {
    render(<History />);
    await waitFor(() => expect(screen.getByTestId('history-row-a')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('history-clear'));
    expect(screen.getByTestId('history-clear-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('history-clear-confirm'));
    expect(window.electronAPI.historyClear).toHaveBeenCalled();
    expect(screen.queryByTestId('history-row-a')).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<History />);
    await waitFor(() => expect(screen.getByTestId('history-row-a')).toBeInTheDocument());
    await assertNoAxeViolations(container);
  });
});
