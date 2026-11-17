/**
 * @fileoverview Tests for the MCP view plumbing: the payload latch, the
 * background polling and the provider's payload handling.
 *
 * The views latch a payload on its content, so a host that re-delivers the
 * same proposal must not reset the form. The polling must not run while the
 * window is hidden, and an empty result must not blank the view.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('react-i18next');

import ConfirmView from '../views/ConfirmView';
import ConvertView from '../views/ConvertView';
import JobView from '../views/JobView';
import { FakeViewHost, renderView } from './harness';
import { useMcpViewPolling } from '../useMcpViewPolling';
import { useMcpView } from '../McpViewProvider';
import type { McpViewToolResult } from '../host';
import { contentKey } from '../format';

/**
 * A component that polls a tool, used to drive the polling hook directly.
 * @param {{intervalMs: number}} props - The polling interval.
 * @returns {null} It renders nothing.
 */
function PollingHarness({ intervalMs }: { intervalMs: number }): null {
  useMcpViewPolling({ tool: 'ping', intervalMs, enabled: true });
  return null;
}

/**
 * A component that renders one field of the published payload.
 * @returns {React.JSX.Element} The label of the payload, or 'none'.
 */
function PayloadProbe() {
  const { data } = useMcpView();
  const label = (data as { label?: string } | undefined)?.label;
  return <span data-testid="payload-label">{label ?? 'none'}</span>;
}

/**
 * Overrides the `document.hidden` flag for the duration of a test.
 * @param {boolean} hidden - The value the flag should report.
 * @returns {() => void} A function that restores the original flag.
 */
function setDocumentHidden(hidden: boolean): () => void {
  const original = Object.getOwnPropertyDescriptor(document, 'hidden');
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  return () => {
    // The flag lives on the document prototype in jsdom, so an own property
    // has to be removed again - restoring "no own property" is what puts the
    // prototype getter back in charge.
    if (original) Object.defineProperty(document, 'hidden', original);
    else Reflect.deleteProperty(document, 'hidden');
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('contentKey', () => {
  it('returns the same key for the same content', () => {
    expect(contentKey({ a: 1 })).toBe(contentKey({ a: 1 }));
  });

  it('returns an empty key for a value it cannot serialize', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(contentKey(circular)).toBe('');
  });

  it('returns an empty key for undefined', () => {
    expect(contentKey(undefined)).toBe('');
  });
});

describe('the proposal latch', () => {
  it('keeps the card when the host re-delivers the same proposal', async () => {
    const host = new FakeViewHost();
    const confirmation = { operation: 'cut_video', title: 'Cut', summary: 'Trims', args: {} };
    renderView(<ConfirmView />, host, { confirmation });
    expect(screen.getByTestId('mcp-view-confirm')).toBeTruthy();

    // The host delivers the same proposal again, as a fresh object.
    await act(async () => {
      host.push({ structuredContent: { confirmation: { ...confirmation } } });
    });

    expect(screen.getByTestId('mcp-view-confirm')).toBeTruthy();
  });

  it('shows the proposal when the host delivers it after the view mounted', async () => {
    const host = new FakeViewHost();
    renderView(<ConfirmView />, host);
    expect(screen.getByTestId('mcp-view-confirm-empty')).toBeTruthy();

    await act(async () => {
      host.push({ structuredContent: { confirmation: { operation: 'cut_video', title: 'Cut', summary: 'Trims', args: {} } } });
    });

    await waitFor(() => expect(screen.queryByTestId('mcp-view-confirm-empty')).toBeNull());
    expect(screen.getByTestId('mcp-view-confirm')).toBeTruthy();
  });

  it('keeps the fields the user edited when a new proposal arrives', async () => {
    const host = new FakeViewHost();
    renderView(<ConvertView />, host, {
      confirmation: { operation: 'convert_media', title: 'Convert', summary: 'Convert it', args: { input: '/a.mkv' } },
    });

    const input = screen.getByTestId('mcp-view-convert-input');
    await userEvent.clear(input);
    await userEvent.type(input, '/edited.mkv');

    // A different proposal arrives: the untouched fields follow it, the
    // edited one does not.
    await act(async () => {
      host.push({
        structuredContent: {
          confirmation: { operation: 'convert_media', title: 'Convert', summary: 'Convert it', args: { input: '/other.mkv' } },
        },
      });
    });

    await waitFor(() => expect((input as HTMLInputElement).value).toBe('/edited.mkv'));
  });
});

describe('the provider payload handling', () => {
  it('does not blank the view with an empty result', async () => {
    const host = new FakeViewHost();
    renderView(<JobView />, host, { job: { id: 'a', input: '/a.mkv', output: '/a.mp4', status: 'running', progress: 10 } });
    expect(screen.getByTestId('mcp-view-job')).toBeTruthy();

    await act(async () => {
      host.push({ structuredContent: {} });
    });

    expect(screen.getByTestId('mcp-view-job')).toBeTruthy();
  });

  it('publishes a payload it cannot serialize instead of dropping it', async () => {
    const host = new FakeViewHost();
    renderView(<PayloadProbe />, host);

    // A circular payload cannot be turned into an identity key, but it is
    // still live data: the provider has to deliver it.
    const circular: Record<string, unknown> = { label: 'circular' };
    circular.self = circular;
    await act(async () => {
      host.push({ structuredContent: circular });
    });

    expect(screen.getByTestId('payload-label')).toHaveTextContent('circular');
  });
});

describe('the background polling', () => {
  it('does not call the tool while the window is hidden', async () => {
    const restore = setDocumentHidden(true);
    try {
      const host = new FakeViewHost();
      vi.useFakeTimers();
      renderView(<PollingHarness intervalMs={100} />, host);

      await act(async () => {
        vi.advanceTimersByTime(0);
      });
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(host.calls).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('polls the tool while the window is visible', async () => {
    const host = new FakeViewHost();
    vi.useFakeTimers();
    renderView(<PollingHarness intervalMs={100} />, host);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(host.calls.some((call) => call.name === 'ping')).toBe(true);
  });

  it('stops scheduling once the view unmounts while a poll is in flight', async () => {
    const host = new FakeViewHost();
    let calls = 0;
    let settle: ((result: McpViewToolResult) => void) | null = null;
    host.callTool = () => {
      calls += 1;
      return new Promise<McpViewToolResult>((resolve) => {
        settle = resolve;
      });
    };
    vi.useFakeTimers();
    const { unmount } = renderView(<PollingHarness intervalMs={100} />, host);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(calls).toBe(1);

    // The call is still in flight when the view goes away. It settles after the
    // unmount, and the hook must not arm another tick from it.
    unmount();
    await act(async () => {
      settle!({ structuredContent: {} });
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(calls).toBe(1);
  });
});
