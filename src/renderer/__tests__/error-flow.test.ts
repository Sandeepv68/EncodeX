import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { formatError, createError, ErrorCode } from '../../shared/errors';
import { useErrorStore } from '../stores/errorStore';
import { ERROR_HISTORY_MAX } from '../../shared/constants';

describe('renderer error flow', () => {
  beforeEach(() => {
    useErrorStore.setState({ currentError: null, errorHistory: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatError at a renderer call site', () => {
    const normalize = (err: unknown) => formatError(err);

    it('passes AppError instances through unchanged', () => {
      const original = createError(ErrorCode.FILE_NOT_FOUND, 'keep me', 'detail');
      expect(normalize(original)).toBe(original);
    });

    it('normalizes raw Error inputs to an AppError', () => {
      const appError = normalize(new Error('boom'));
      expect(appError.code).toBeDefined();
      expect(appError.message.length).toBeGreaterThan(0);
      expect(appError).toMatchObject({ code: ErrorCode.UNKNOWN });
    });

    it('normalizes non-Error inputs (string) to an AppError', () => {
      const appError = normalize('just a string');
      expect(appError.code).toBeDefined();
      expect(appError.detail).toBe('just a string');
    });

    it('normalizes non-Error inputs (number) to an AppError', () => {
      const appError = normalize(42);
      expect(appError.code).toBeDefined();
      expect(appError.detail).toBe('42');
    });

    it('always yields an object with message+code like the toast contract', () => {
      for (const input of [new Error('x'), 'str', 42, { foo: 'bar' }]) {
        const appError = normalize(input);
        expect(typeof appError.message).toBe('string');
        expect(typeof appError.code).toBe('string');
      }
    });
  });

  describe('errorStore.showError normalization', () => {
    it.each([
      ['Error', () => new Error('probe failed')],
      ['string', () => 'probe failed'],
      ['object', () => ({ foo: 'bar' })],
    ])('normalizes %s input into an AppError', (_label, makeInput) => {
      useErrorStore.getState().showError(makeInput());
      const { currentError } = useErrorStore.getState();
      expect(currentError).not.toBeNull();
      expect(typeof currentError?.code).toBe('string');
      expect(typeof currentError?.message).toBe('string');
    });

    it('keeps an AppError shape when the same error is thrown by AppError', () => {
      const original = createError(ErrorCode.CONVERSION_FAILED, 'failed');
      useErrorStore.getState().showError(original);
      expect(useErrorStore.getState().currentError?.code).toBe(ErrorCode.CONVERSION_FAILED);
    });

    it('pushes each error onto a bounded history', () => {
      const store = useErrorStore.getState();
      for (let i = 0; i < ERROR_HISTORY_MAX + 5; i += 1) {
        useErrorStore.getState().showError(new Error(`err-${i}`));
      }
      void store;
      expect(useErrorStore.getState().errorHistory.length).toBe(ERROR_HISTORY_MAX);
    });
  });
});
