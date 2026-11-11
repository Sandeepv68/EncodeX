/**
 * @fileoverview Unit tests for the mux queue navigation helper.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { MUX_QUEUE_HASH_ROUTE, navigateToMuxQueue } from '../mux-queue-navigation';

describe('navigateToMuxQueue', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('points at the batch page with the mux tab selected', () => {
    expect(MUX_QUEUE_HASH_ROUTE).toBe('#/batch?tab=mux');
  });

  it('navigates to the mux queue tab', () => {
    navigateToMuxQueue();
    expect(window.location.hash).toBe('#/batch?tab=mux');
  });
});
