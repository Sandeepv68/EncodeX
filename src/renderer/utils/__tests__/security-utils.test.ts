import { describe, it, expect } from 'vitest';
import { generateMcpToken } from '../security-utils';

describe('generateMcpToken', () => {
  it('produces a 43-character token', () => {
    expect(generateMcpToken()).toHaveLength(43);
  });

  it('uses only URL-safe base64 characters', () => {
    for (let i = 0; i < 20; i++) {
      const token = generateMcpToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token).not.toContain('=');
    }
  });

  it('is unique across generations', () => {
    expect(generateMcpToken()).not.toBe(generateMcpToken());
  });
});
