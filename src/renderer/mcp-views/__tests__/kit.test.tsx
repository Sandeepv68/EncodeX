/**
 * @fileoverview Tests for the MCP App view kit and the view plumbing.
 *
 * The kit carries the behaviour the views share: the two-click arming of a
 * destructive action, the button that shows the armed label, the step list with
 * its optional secondary text, the provider that owns the payload, and the
 * polling helper.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('react-i18next');

import ViewButton from '../kit/ViewButton';
import ViewSteps from '../kit/ViewSteps';
import { useArmedAction, ARM_TIMEOUT_MS } from '../kit/useArmedAction';
import { McpViewProvider, useMcpView } from '../McpViewProvider';
import { useMcpViewPolling } from '../useMcpViewPolling';
import { FakeViewHost } from './harness';

describe('useArmedAction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('arms on the first click and runs on the second', async () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(onConfirm);
    act(() => result.current.trigger());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(result.current.armed).toBe(true);
    await act(async () => {
      result.current.trigger();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disarms itself when the timer runs out', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(onConfirm);
    act(() => result.current.trigger());
    act(() => {
      vi.advanceTimersByTime(ARM_TIMEOUT_MS + 10);
    });
    expect(result.current.armed).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('reports the failure of the action it ran', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(onConfirm);
    act(() => result.current.trigger());
    await act(async () => {
      result.current.trigger();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.error).toBe('boom');
  });

  it('resets the armed state', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(onConfirm);
    act(() => result.current.trigger());
    act(() => result.current.reset());
    expect(result.current.armed).toBe(false);
  });

  it('ignores a click while the action is running', async () => {
    let release: (() => void) | undefined;
    const onConfirm = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { result } = renderHook(onConfirm);
    act(() => result.current.trigger());
    await act(async () => {
      result.current.trigger();
    });
    await act(async () => {
      result.current.trigger();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => release?.());
  });
});

/**
 * Renders a hook and exposes its latest value.
 * @param {() => void | Promise<void>} onConfirm - The action the hook arms.
 * @returns {{result: {current: ReturnType<typeof useArmedAction>}}} The hook result.
 */
function renderHook(onConfirm: () => void | Promise<void>) {
  const result = { current: undefined as unknown as ReturnType<typeof useArmedAction> };
  function Probe() {
    result.current = useArmedAction(onConfirm);
    return null;
  }
  render(<Probe />);
  return { result };
}

describe('kit primitives', () => {
  it('shows the confirm label while the button is armed', () => {
    render(<ViewButton label="Cancel" confirmLabel="Confirm cancel" armed onClick={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Confirm cancel' })).toBeTruthy();
  });

  it('falls back to the plain label when there is no confirm label', () => {
    render(<ViewButton label="Cancel" armed onClick={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('renders a step without its secondary text', () => {
    render(<ViewSteps steps={[{ primary: 'convert_media (a)' }]} />);
    expect(screen.getByText('convert_media (a)')).toBeTruthy();
  });

  it('renders a step with its secondary text', () => {
    render(<ViewSteps steps={[{ primary: 'convert_media (a)', secondary: 'needs b' }]} />);
    expect(screen.getByText('needs b')).toBeTruthy();
  });
});

describe('McpViewProvider', () => {
  it('refuses to be used outside its provider', () => {
    function Probe() {
      useMcpView();
      return null;
    }
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => render(<Probe />)).toThrow(/McpViewProvider/);
    } finally {
      quiet.mockRestore();
    }
  });

  it('exposes the payload it was given', () => {
    const host = new FakeViewHost();
    function Probe() {
      const { data } = useMcpView();
      return <span data-testid="payload">{JSON.stringify(data)}</span>;
    }
    render(
      <McpViewProvider host={host} initialData={{ jobs: [] }}>
        <Probe />
      </McpViewProvider>,
    );
    expect(screen.getByTestId('payload').textContent).toBe('{"jobs":[]}');
  });

  it('reports a failing tool call', async () => {
    const host = new FakeViewHost();
    host.callTool = vi.fn().mockRejectedValue(new Error('boom'));
    function Probe() {
      const { error, callTool } = useMcpView();
      return (
        <button type="button" onClick={() => void callTool('list_jobs').catch(() => undefined)}>
          {error ?? 'no error'}
        </button>
      );
    }
    render(
      <McpViewProvider host={host}>
        <Probe />
      </McpViewProvider>,
    );
    await userEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('boom'));
  });

  it('takes the payload the host pushes', async () => {
    const host = new FakeViewHost();
    function Probe() {
      const { data } = useMcpView();
      return <span data-testid="payload">{JSON.stringify(data)}</span>;
    }
    render(
      <McpViewProvider host={host}>
        <Probe />
      </McpViewProvider>,
    );
    act(() => host.push({ structuredContent: { jobs: [1] } }));
    await waitFor(() => expect(screen.getByTestId('payload').textContent).toBe('{"jobs":[1]}'));
  });
});

describe('useMcpViewPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the polled tool on every tick', async () => {
    const host = new FakeViewHost();
    function Probe() {
      useMcpViewPolling({ tool: 'list_jobs', intervalMs: 1000 });
      return null;
    }
    render(
      <McpViewProvider host={host}>
        <Probe />
      </McpViewProvider>,
    );
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(host.calls.filter((call) => call.name === 'list_jobs').length).toBeGreaterThan(0);
  });

  it('does not poll when there is no tool', async () => {
    const host = new FakeViewHost();
    function Probe() {
      useMcpViewPolling({ intervalMs: 1000 });
      return null;
    }
    render(
      <McpViewProvider host={host}>
        <Probe />
      </McpViewProvider>,
    );
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(host.calls).toHaveLength(0);
  });

  it('does not poll while it is disabled', async () => {
    const host = new FakeViewHost();
    function Probe() {
      useMcpViewPolling({ tool: 'list_jobs', intervalMs: 1000, enabled: false });
      return null;
    }
    render(
      <McpViewProvider host={host}>
        <Probe />
      </McpViewProvider>,
    );
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(host.calls).toHaveLength(0);
  });

  it('stops polling when the tool fails', async () => {
    const host = new FakeViewHost();
    const callTool = vi.fn().mockRejectedValue(new Error('boom'));
    host.callTool = callTool;
    function Probe() {
      useMcpViewPolling({ tool: 'list_jobs', intervalMs: 1000 });
      return null;
    }
    render(
      <McpViewProvider host={host}>
        <Probe />
      </McpViewProvider>,
    );
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    const callsAfterFirstFailure = callTool.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });
    expect(callTool.mock.calls.length).toBe(callsAfterFirstFailure);
  });
});
