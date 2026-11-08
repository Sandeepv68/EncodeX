/**
 * @fileoverview Covers the route shell's page loader: the minimum skeleton
 * hold, the synchronous render once a chunk is cached, and the cancelled paths
 * that fire when the route changes or unmounts while a chunk is in flight or
 * its skeleton timer is pending. A failed load is re-thrown during render so the
 * route's `ErrorBoundary` reports it instead of the skeleton staying on screen
 * forever.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ComponentType } from 'react';
import { RouteLoader } from '../App';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { expectCrash } from '../../test-utils/crash-tripwire';
import { deferred, flushMicrotasks } from '../../test-utils/deferred';
import type { PageLoader } from '../types';

function LoadedPage() {
  return <div>loaded page</div>;
}

function chunk(): { default: ComponentType } {
  return { default: LoadedPage };
}

describe('RouteLoader', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-throws a failed chunk load so the route error boundary reports it', async () => {
    expectCrash('consoleError', 'Error: chunk failed');
    const load = vi.fn(() => Promise.reject(new Error('chunk failed')));
    const loader: PageLoader = load;

    render(
      <ErrorBoundary fallback={<div>boundary fallback</div>}>
        <RouteLoader load={loader} skeleton={<div>route skeleton</div>} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('route skeleton')).toBeInTheDocument();
    expect(await screen.findByText('boundary fallback')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('holds the skeleton for the minimum visible time', async () => {
    vi.useFakeTimers();
    const load: PageLoader = vi.fn(() => Promise.resolve(chunk()));

    render(<RouteLoader load={load} skeleton={<div>route skeleton</div>} minVisibleMs={200} />);

    expect(screen.getByText('route skeleton')).toBeInTheDocument();
    await act(async () => {
      await flushMicrotasks();
    });
    expect(screen.queryByText('loaded page')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText('loaded page')).toBeInTheDocument();
  });

  it('renders immediately when the minimum visible time is zero', async () => {
    const load: PageLoader = vi.fn(() => Promise.resolve(chunk()));

    render(<RouteLoader load={load} skeleton={<div>route skeleton</div>} minVisibleMs={0} />);

    expect(screen.getByText('route skeleton')).toBeInTheDocument();
    await act(async () => {
      await flushMicrotasks();
    });
    expect(screen.getByText('loaded page')).toBeInTheDocument();
  });

  it('renders a cached page synchronously on a later visit', async () => {
    const load: PageLoader = vi.fn(() => Promise.resolve(chunk()));
    const first = render(<RouteLoader load={load} skeleton={<div>first skeleton</div>} minVisibleMs={0} />);
    await act(async () => {
      await flushMicrotasks();
    });
    expect(screen.getByText('loaded page')).toBeInTheDocument();
    first.unmount();

    render(<RouteLoader load={load} skeleton={<div>second skeleton</div>} minVisibleMs={0} />);
    expect(screen.getByText('loaded page')).toBeInTheDocument();
    expect(screen.queryByText('second skeleton')).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('drops a chunk that resolves after unmount', async () => {
    const gate = deferred<{ default: ComponentType }>();
    const load: PageLoader = vi.fn(() => gate.promise);
    const { unmount } = render(<RouteLoader load={load} skeleton={<div>route skeleton</div>} />);

    unmount();
    gate.resolve(chunk());
    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.queryByText('loaded page')).not.toBeInTheDocument();
  });

  it('drops a chunk whose skeleton timer fires after unmount', async () => {
    vi.useFakeTimers();
    const gate = deferred<{ default: ComponentType }>();
    const load: PageLoader = vi.fn(() => gate.promise);
    const { unmount } = render(<RouteLoader load={load} skeleton={<div>route skeleton</div>} minVisibleMs={200} />);

    gate.resolve(chunk());
    await act(async () => {
      await flushMicrotasks();
    });
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText('loaded page')).not.toBeInTheDocument();
  });

  it('swallows a rejection that arrives after unmount', async () => {
    const gate = deferred<{ default: ComponentType }>();
    const load: PageLoader = vi.fn(() => gate.promise);
    const { unmount } = render(<RouteLoader load={load} skeleton={<div>route skeleton</div>} />);

    unmount();
    gate.reject(new Error('late chunk failure'));
    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.queryByText('route skeleton')).not.toBeInTheDocument();
  });
});
