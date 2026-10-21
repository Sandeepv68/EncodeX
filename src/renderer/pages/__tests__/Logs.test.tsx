import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Logs from '../Logs';
import { useLogStore } from '../../stores/logStore';
import { useAuditStore } from '../../stores/auditStore';
import { useToastStore } from '../../stores/toastStore';
import type { LogEntry } from '../../../shared/types';
import type { AuditEntry } from '../../../shared/audit';
import { assertNoAxeViolations } from '../../../test-utils/axe';

function entry(overrides: Partial<LogEntry>): LogEntry {
  return {
    timestamp: '2026-07-31T10:00:00.000Z',
    level: 'INFO',
    text: 'hello',
    source: 'main',
    ...overrides,
  };
}

function auditEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'audit-1',
    timestamp: '2026-07-31T10:00:00.000Z',
    tool: 'convert_media',
    tier: 2,
    argsDigest: 'deadbeef',
    result: 'ok',
    ...overrides,
  };
}

describe('Logs', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    useLogStore.setState({ entries: [] });
    useAuditStore.setState({ entries: [] });
    useToastStore.setState({ toasts: [] });
    vi.restoreAllMocks();
  });

  it('has no axe violations', async () => {
    useLogStore.setState({ entries: [entry({ level: 'INFO', text: 'first line', source: 'main' })] });
    const { container } = render(<Logs />);
    await assertNoAxeViolations(container);
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

  it('renders the level as text so it is not color-only', () => {
    useLogStore.setState({ entries: [entry({ level: 'WARN', text: 'warning line', source: 'main' })] });
    render(<Logs />);
    expect(screen.getByText('[WARN]')).toBeInTheDocument();
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

  it('exposes accessible names for the clear and download buttons', () => {
    render(<Logs />);
    expect(screen.getByRole('button', { name: 'logs.clear' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'logs.download' })).toBeInTheDocument();
  });

  it('labels the filter select for screen readers', () => {
    render(<Logs />);
    expect(screen.getByRole('combobox', { name: 'logs.filter' })).toBeInTheDocument();
  });

  it('falls back to the default color for unknown levels', () => {
    const traceEntry = { timestamp: '2026-07-31T10:00:00.000Z', level: 'TRACE', text: 'trace line', source: 'main' } as unknown as LogEntry;
    useLogStore.setState({ entries: [traceEntry] });
    render(<Logs />);
    expect(screen.getByText(/trace line/)).toBeInTheDocument();
    expect(screen.getByText(/\[TRACE\]/)).toBeInTheDocument();
  });

  it('clears the entries with Ctrl+L', () => {
    useLogStore.setState({ entries: [entry({ text: 'clear me' })] });
    render(<Logs />);
    expect(screen.getByText(/clear me/)).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'KeyL', key: 'l', ctrlKey: true });
    expect(useLogStore.getState().entries).toHaveLength(0);
    expect(screen.getByText('logs.noEntries')).toBeInTheDocument();
  });

  it('downloads the logs with Ctrl+Shift+D', () => {
    useLogStore.setState({ entries: [entry({ text: 'download via shortcut' })] });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<Logs />);
    fireEvent.keyDown(window, { code: 'KeyD', key: 'd', ctrlKey: true, shiftKey: true });
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('hides the audit panel when there are no audit entries', () => {
    render(<Logs />);
    expect(screen.queryByTestId('audit-panel')).not.toBeInTheDocument();
  });

  it('renders the audit trail with tool, tier, result and digest', () => {
    useAuditStore.setState({
      entries: [
        auditEntry({ id: 'a1', tool: 'convert_media', tier: 2, result: 'ok', argsDigest: 'aaaa1111' }),
        auditEntry({ id: 'a2', tool: 'cut_video', tier: 3, result: 'error', argsDigest: 'bbbb2222', detail: 'boom' }),
      ],
    });
    render(<Logs />);
    expect(screen.getByTestId('audit-panel')).toBeInTheDocument();
    expect(screen.getAllByTestId('audit-row')).toHaveLength(2);
    expect(screen.getByText('convert_media')).toBeInTheDocument();
    expect(screen.getByText('T3')).toBeInTheDocument();
    expect(screen.getByText('ok')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('#aaaa1111')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('shows the newest audit entries first and caps the panel', () => {
    useAuditStore.setState({
      entries: Array.from({ length: 60 }, (_, i) => auditEntry({ id: `a${i}`, tool: `tool-${i}` })),
    });
    render(<Logs />);
    const rows = screen.getAllByTestId('audit-row');
    expect(rows).toHaveLength(50);
    expect(screen.getByText('tool-59')).toBeInTheDocument();
    expect(screen.queryByText('tool-0')).not.toBeInTheDocument();
  });

  it('clears the audit trail from the panel button', () => {
    useAuditStore.setState({ entries: [auditEntry()] });
    render(<Logs />);
    fireEvent.click(screen.getByTestId('audit-clear'));
    expect(useAuditStore.getState().entries).toHaveLength(0);
    expect(screen.queryByTestId('audit-panel')).not.toBeInTheDocument();
  });

  it('has no axe violations with an audit trail present', async () => {
    useLogStore.setState({ entries: [entry({ text: 'first line' })] });
    useAuditStore.setState({ entries: [auditEntry()] });
    const { container } = render(<Logs />);
    await assertNoAxeViolations(container);
  });

  it('labels the search field for screen readers', () => {
    render(<Logs />);
    expect(screen.getByRole('textbox', { name: 'logs.search' })).toBeInTheDocument();
  });

  it('filters the entries by the search text', () => {
    useLogStore.setState({
      entries: [entry({ text: 'conversion started' }), entry({ text: 'something else' })],
    });
    render(<Logs />);
    fireEvent.change(screen.getByRole('textbox', { name: 'logs.search' }), { target: { value: 'conversion' } });
    expect(screen.getByText(/conversion started/)).toBeInTheDocument();
    expect(screen.queryByText(/something else/)).not.toBeInTheDocument();
  });

  it('matches the search case-insensitively', () => {
    useLogStore.setState({
      entries: [entry({ text: 'conversion started' }), entry({ text: 'something else' })],
    });
    render(<Logs />);
    fireEvent.change(screen.getByRole('textbox', { name: 'logs.search' }), { target: { value: 'CONVERSION' } });
    expect(screen.getByText(/conversion started/)).toBeInTheDocument();
    expect(screen.queryByText(/something else/)).not.toBeInTheDocument();
  });

  it('matches the search against the level and the source', () => {
    useLogStore.setState({
      entries: [entry({ level: 'ERROR', text: 'boom', source: 'main' }), entry({ level: 'INFO', text: 'fine', source: 'renderer' })],
    });
    render(<Logs />);
    const search = screen.getByRole('textbox', { name: 'logs.search' });
    fireEvent.change(search, { target: { value: 'error' } });
    expect(screen.getByText(/boom/)).toBeInTheDocument();
    expect(screen.queryByText(/fine/)).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'renderer' } });
    expect(screen.getByText(/fine/)).toBeInTheDocument();
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
  });

  it('combines the level filter with the search', () => {
    useLogStore.setState({
      entries: [
        entry({ level: 'INFO', text: 'alpha entry' }),
        entry({ level: 'ERROR', text: 'alpha failure' }),
        entry({ level: 'ERROR', text: 'beta failure' }),
      ],
    });
    render(<Logs />);
    fireEvent.change(screen.getByRole('textbox', { name: 'logs.search' }), { target: { value: 'alpha' } });
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('logs.levelError'));
    expect(screen.getByText(/alpha failure/)).toBeInTheDocument();
    expect(screen.queryByText(/alpha entry/)).not.toBeInTheDocument();
    expect(screen.queryByText(/beta failure/)).not.toBeInTheDocument();
  });

  it('shows the no-match message when the search matches nothing', () => {
    useLogStore.setState({ entries: [entry({ text: 'conversion started' })] });
    render(<Logs />);
    fireEvent.change(screen.getByRole('textbox', { name: 'logs.search' }), { target: { value: 'nothing matches this' } });
    expect(screen.getByText('logs.noMatches')).toBeInTheDocument();
    expect(screen.queryByText('logs.noEntries')).not.toBeInTheDocument();
  });

  it('clears the search from the clear button', () => {
    useLogStore.setState({ entries: [entry({ text: 'conversion started' }), entry({ text: 'something else' })] });
    render(<Logs />);
    const search = screen.getByRole('textbox', { name: 'logs.search' });
    fireEvent.change(search, { target: { value: 'conversion' } });
    expect(screen.queryByText(/something else/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('logs-search-clear'));
    expect(search).toHaveValue('');
    expect(screen.getByText(/something else/)).toBeInTheDocument();
  });

  it('focuses the search field with F', () => {
    render(<Logs />);
    fireEvent.keyDown(window, { code: 'KeyF', key: 'f' });
    expect(screen.getByRole('textbox', { name: 'logs.search' })).toHaveFocus();
  });

  it('shows the filtered entry count while the list is narrowed', () => {
    useLogStore.setState({ entries: [entry({ text: 'conversion started' }), entry({ text: 'something else' })] });
    render(<Logs />);
    expect(screen.getByText('logs.entryCount')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'logs.search' }), { target: { value: 'conversion' } });
    expect(screen.getByText('logs.filteredCount')).toBeInTheDocument();
    expect(screen.queryByText('logs.entryCount')).not.toBeInTheDocument();
  });

  it('exports only the entries that match the search', async () => {
    useLogStore.setState({ entries: [entry({ text: 'download me' }), entry({ text: 'keep me out' })] });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<Logs />);
    fireEvent.change(screen.getByRole('textbox', { name: 'logs.search' }), { target: { value: 'download' } });
    fireEvent.click(document.querySelector('[data-icon="download"]')!);
    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const exported = await blob.text();
    expect(exported).toContain('download me');
    expect(exported).not.toContain('keep me out');
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});
