import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import HistoryToolbar from '../HistoryToolbar';
import HistoryDetails from '../HistoryDetails';
import HistoryRow from '../HistoryRow';
import HistoryThumbnail from '../HistoryThumbnail';
import type { HistoryEntry } from '../../../../shared/history/types';
import type { HistoryQuery } from '../../../stores/types';

vi.mock('../../../../shared/history/types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/history/types')>();
  return {
    ...actual,
    HISTORY_FAMILIES: [...actual.HISTORY_FAMILIES, 'bogus' as (typeof actual.HISTORY_FAMILIES)[number]],
    HISTORY_SOURCES: [...actual.HISTORY_SOURCES, 'bogus' as (typeof actual.HISTORY_SOURCES)[number]],
    HISTORY_STATUSES: [...actual.HISTORY_STATUSES, 'bogus' as (typeof actual.HISTORY_STATUSES)[number]],
  };
});

vi.mock('../../../utils/history', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/history')>();
  const valid = (value: unknown) => value !== 'bogus';
  return {
    ...actual,
    historySortKeys: () => [...actual.historySortKeys(), 'bogus' as ReturnType<typeof actual.historySortKeys>[number]],
    isHistoryStatus: ((value: unknown) =>
      valid(value) && typeof value === 'string' && actual.isHistoryStatus(value)) as typeof actual.isHistoryStatus,
    isHistoryFamily: ((value: unknown) =>
      valid(value) && typeof value === 'string' && actual.isHistoryFamily(value)) as typeof actual.isHistoryFamily,
    isHistorySource: ((value: unknown) =>
      valid(value) && typeof value === 'string' && actual.isHistorySource(value)) as typeof actual.isHistorySource,
    isHistorySortKey: ((value: unknown) =>
      valid(value) && typeof value === 'string' && actual.isHistorySortKey(value)) as typeof actual.isHistorySortKey,
  };
});

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'a',
    family: 'convert',
    source: 'gui',
    status: 'succeeded',
    startedAt: 1000,
    finishedAt: 2500,
    durationMs: 1500,
    inputs: ['/tmp/a.mp4'],
    outputs: ['/tmp/a.mkv'],
    metadata: {},
    ...overrides,
  };
}

function baseQuery(overrides: Partial<HistoryQuery> = {}): HistoryQuery {
  return { search: '', status: 'all', family: 'all', source: 'all', sort: 'newest', ...overrides };
}

function choose(testId: string, value: string): void {
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
}

describe('history components', () => {
  it('routes toolbar filter changes through the query callback', () => {
    const onQueryChange = vi.fn();
    render(
      <HistoryToolbar
        query={baseQuery()}
        resultCount={1}
        totalCount={2}
        onQueryChange={onQueryChange}
        onRefresh={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    choose('history-status-filter', 'failed');
    choose('history-family-filter', 'batch');
    choose('history-source-filter', 'mcp');
    choose('history-sort', 'oldest');

    expect(onQueryChange).toHaveBeenCalledWith({ status: 'failed' });
    expect(onQueryChange).toHaveBeenCalledWith({ family: 'batch' });
    expect(onQueryChange).toHaveBeenCalledWith({ source: 'mcp' });
    expect(onQueryChange).toHaveBeenCalledWith({ sort: 'oldest' });
  });

  it('accepts the all option for each filter', () => {
    const onQueryChange = vi.fn();
    render(
      <HistoryToolbar
        query={baseQuery({ status: 'failed', family: 'batch', source: 'mcp' })}
        resultCount={1}
        totalCount={2}
        onQueryChange={onQueryChange}
        onRefresh={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    choose('history-status-filter', 'all');
    choose('history-family-filter', 'all');
    choose('history-source-filter', 'all');

    expect(onQueryChange).toHaveBeenCalledWith({ status: 'all' });
    expect(onQueryChange).toHaveBeenCalledWith({ family: 'all' });
    expect(onQueryChange).toHaveBeenCalledWith({ source: 'all' });
  });

  it('falls back to safe filter values when a hostile value is supplied', () => {
    const onQueryChange = vi.fn();
    render(
      <HistoryToolbar
        query={baseQuery()}
        resultCount={1}
        totalCount={2}
        onQueryChange={onQueryChange}
        onRefresh={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    choose('history-status-filter', 'bogus');
    choose('history-family-filter', 'bogus');
    choose('history-source-filter', 'bogus');
    choose('history-sort', 'bogus');

    expect(onQueryChange.mock.calls.map(([patch]) => patch)).toEqual([
      { status: 'all' },
      { family: 'all' },
      { source: 'all' },
      { sort: 'newest' },
    ]);
  });

  it('shows filtered counts and handles refresh and clear actions', () => {
    const onRefresh = vi.fn();
    const onClear = vi.fn();
    render(
      <HistoryToolbar query={baseQuery()} resultCount={1} totalCount={3} onQueryChange={vi.fn()} onRefresh={onRefresh} onClear={onClear} />,
    );

    expect(screen.getByTestId('history-count')).toHaveTextContent('history.filteredCount');
    fireEvent.click(screen.getByTestId('history-refresh'));
    fireEvent.click(screen.getByTestId('history-clear'));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('renders details metadata and removes or closes the selected entry', () => {
    const onClose = vi.fn();
    const onRemove = vi.fn();
    render(<HistoryDetails entry={makeEntry({ metadata: { codec: 'h264' } })} thumbnail={null} onClose={onClose} onRemove={onRemove} />);

    expect(screen.getByTestId('history-metadata-codec')).toHaveTextContent('h264');
    fireEvent.click(screen.getByTestId('history-details-remove'));
    fireEvent.click(screen.getByTestId('history-details-close'));

    expect(onRemove).toHaveBeenCalledWith('a');
    expect(onClose).toHaveBeenCalled();
  });

  it('supplies a no-op thumbnail loader to the details thumbnail', () => {
    render(
      <HistoryDetails
        entry={makeEntry({ thumbnail: { path: '/tmp/a.png', mimeType: 'image/png' } })}
        thumbnail={undefined}
        onClose={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByTestId('history-thumbnail-empty-a')).toBeInTheDocument();
  });

  it('renders a no-selection message without a dialog', () => {
    render(<HistoryDetails entry={null} thumbnail={undefined} onClose={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('history.noSelection')).toBeInTheDocument();
    expect(screen.queryByTestId('history-details-dialog')).not.toBeInTheDocument();
  });

  it('renders row thumbnails and routes selection and removal callbacks', () => {
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    const thumbnail = 'data:image/png;base64,YWJj';
    render(
      <HistoryRow entry={makeEntry()} selected thumbnail={thumbnail} onSelect={onSelect} onRemove={onRemove} onLoadThumbnail={vi.fn()} />,
    );

    expect(screen.getByTestId('history-thumbnail-a')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('history-select-a'));
    fireEvent.click(screen.getByTestId('history-remove-a'));
    expect(onSelect).toHaveBeenCalledWith('a');
    expect(onRemove).toHaveBeenCalledWith('a');
  });

  it('uses the entry id as the row fallback label', () => {
    render(
      <HistoryRow
        entry={makeEntry({ inputs: [], outputs: [] })}
        selected={false}
        thumbnail={undefined}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onLoadThumbnail={vi.fn()}
      />,
    );
    expect(screen.getByTestId('history-select-a')).toHaveAttribute('aria-label', 'a');
  });

  it('loads a missing thumbnail and renders the loaded image', () => {
    const onLoadThumbnail = vi.fn();
    const entry = makeEntry({ thumbnail: { path: '/tmp/a.png', mimeType: 'image/png' } });
    const { rerender } = render(<HistoryThumbnail entry={entry} thumbnail={undefined} onLoadThumbnail={onLoadThumbnail} />);

    expect(onLoadThumbnail).toHaveBeenCalledWith(entry);
    rerender(<HistoryThumbnail entry={entry} thumbnail="data:image/png;base64,YWJj" onLoadThumbnail={onLoadThumbnail} />);
    expect(screen.getByTestId('history-thumbnail-a')).toBeInTheDocument();
  });
});
