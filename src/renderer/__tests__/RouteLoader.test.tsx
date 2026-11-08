/**
 * @fileoverview Covers the route shell's page loader failure path: a chunk that
 * fails to load must be re-thrown during render so the route's `ErrorBoundary`
 * reports it instead of the skeleton staying on screen forever.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouteLoader } from '../App';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { expectCrash } from '../../test-utils/crash-tripwire';
import type { PageLoader } from '../types';

describe('RouteLoader', () => {
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
});
