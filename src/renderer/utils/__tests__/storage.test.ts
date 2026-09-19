import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadJson, saveJson, loadString, saveString } from '../storage';

describe('storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('loadJson', () => {
    it('returns the parsed value for a stored object', () => {
      localStorage.setItem('k', JSON.stringify({ a: 1 }));
      expect(loadJson('k', { a: 0 })).toEqual({ a: 1 });
    });

    it('returns the fallback for a missing key', () => {
      expect(loadJson('missing', { a: 0 })).toEqual({ a: 0 });
    });

    it('returns the fallback for corrupt JSON', () => {
      localStorage.setItem('bad', '{nope');
      const onError = vi.fn();
      expect(loadJson('bad', { a: 0 }, onError)).toEqual({ a: 0 });
      expect(onError).toHaveBeenCalledOnce();
    });

    it('returns the fallback for JSON null', () => {
      localStorage.setItem('null', 'null');
      expect(loadJson('null', { a: 0 })).toEqual({ a: 0 });
    });

    it('tolerates storage read failure', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied');
      });
      const onError = vi.fn();
      expect(loadJson('k', { a: 0 }, onError)).toEqual({ a: 0 });
      expect(onError).toHaveBeenCalledOnce();
      spy.mockRestore();
    });
  });

  describe('saveJson', () => {
    it('round-trips a value through localStorage', () => {
      saveJson('k', { a: 1, b: 'x' });
      expect(JSON.parse(localStorage.getItem('k')!)).toEqual({ a: 1, b: 'x' });
    });

    it('tolerates storage write failure', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });
      const onError = vi.fn();
      expect(() => saveJson('k', { a: 1 }, onError)).not.toThrow();
      expect(onError).toHaveBeenCalledOnce();
      spy.mockRestore();
    });
  });

  describe('loadString', () => {
    it('returns the stored string', () => {
      localStorage.setItem('k', 'true');
      expect(loadString('k', 'false')).toBe('true');
    });

    it('returns the fallback for a missing key', () => {
      expect(loadString('missing', 'false')).toBe('false');
    });
  });

  describe('saveString', () => {
    it('stores the raw string', () => {
      saveString('k', 'true');
      expect(localStorage.getItem('k')).toBe('true');
    });
  });
});
