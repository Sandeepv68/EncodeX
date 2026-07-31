import { describe, it, expect, beforeEach } from 'vitest';
import { useToastStore } from '../toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('starts with empty toasts', () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('addToast appends a toast with a generated id', () => {
    useToastStore.getState().addToast('success', 'Done', 'detail', 3000);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].id).toMatch(/^toast-\d+$/);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].message).toBe('Done');
    expect(toasts[0].detail).toBe('detail');
    expect(toasts[0].duration).toBe(3000);
  });

  it('appends multiple toasts in order', () => {
    useToastStore.getState().addToast('info', 'one');
    useToastStore.getState().addToast('warning', 'two');
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['one', 'two']);
  });

  it('removeToast removes the toast by id', () => {
    useToastStore.getState().addToast('error', 'err');
    const id = useToastStore.getState().toasts[0].id;
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('convenience helpers create typed toasts', () => {
    const { success, error, warning, info } = useToastStore.getState();
    success('ok');
    error('bad');
    warning('warn');
    info('note');
    expect(useToastStore.getState().toasts.map((t) => t.type)).toEqual(['success', 'error', 'warning', 'info']);
  });
});
