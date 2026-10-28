/**
 * @fileoverview Integration coverage for MCP run entry.
 */

import { describe, it, expect } from 'vitest';
import { runMcpServer } from '../run';

describe('runMcpServer', () => {
  it('is exported', () => {
    expect(typeof runMcpServer).toBe('function');
  });
});
