import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Logs from '../Logs';
import { useLogStore } from '../../stores/logStore';
import { useToastStore } from '../../stores/toastStore';
import type { LogEntry } from '../../../shared/types';

function entry(overrides: Partial<LogEntry>): LogEntry {
  return {
    timestamp: '2026-07-31T10:00:00.000Z',
    level: 'INFO',
    text: 'hello',
    source: 'main',
    ...overrides,
  };
}

describe('Logs', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    useLogStore.setState({ entries: [] });
    useToastStore.setState({ toasts: [] });
    vi.restoreAllMocks();
  });

  it('shows the empty message when there are no entries', () => {
    render(<Logs />);
    expect(screen.getByText('logs.noEntries')).toBeInTheDocument();
  });

  it('renders all log entries by default', () => {
    useLogStore.setState({
      entries: [entry({ level: 'INFO', text: 'first line', source: 'main' }), entry({ level: 'ERROR', text: 'boom', source: 'renderer' })],
    });
    render(<Logs />);
    expect(screen.getByText(/first line/)).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
    expect(screen.getByText('logs.entryCount')).toBeInTheDocument();
  });

  it('filters entries by the selected level', () => {
    useLogStore.setState({
      entries: [entry({ level: 'INFO', text: 'info line' }), entry({ level: 'ERROR', text: 'error line' })],
    });
    render(<Logs />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('logs.levelError'));
    expect(screen.getByText(/error line/)).toBeInTheDocument();
    expect(screen.queryByText(/info line/)).not.toBeInTheDocument();
  });

  it('clears the entries when the clear button is clicked', () => {
    useLogStore.setState({ entries: [entry({ text: 'to be cleared' })] });
    render(<Logs />);
    expect(screen.getByText(/to be cleared/)).toBeInTheDocument();
    fireEvent.click(document.querySelector('[data-icon="eraser"]')!);
    expect(useLogStore.getState().entries).toHaveLength(0);
    expect(screen.getByText('logs.noEntries')).toBeInTheDocument();
  });

  it('downloads the logs as a text file', () => {
    useLogStore.setState({ entries: [entry({ text: 'download me' })] });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<Logs />);
    fireEvent.click(document.querySelector('[data-icon="download"]')!);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'toast.logsDownloaded')).toBe(true);
  });

  it('falls back to the default color for unknown levels', () => {
    const traceEntry = { timestamp: '2026-07-31T10:00:00.000Z', level: 'TRACE', text: 'trace line', source: 'main' } as unknown as LogEntry;
    useLogStore.setState({ entries: [traceEntry] });
    render(<Logs />);
    expect(screen.getByText(/trace line/)).toBeInTheDocument();
    expect(screen.getByText(/\[TRACE\]/)).toBeInTheDocument();
  });
});
