import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore } from '../taskStore';

describe('taskStore', () => {
  beforeEach(() => {
    useTaskStore.setState({ isConverting: false });
  });

  it('starts with no active media task', () => {
    expect(useTaskStore.getState().isConverting).toBe(false);
  });

  it('setIsConverting(true) marks a media task as running', () => {
    useTaskStore.getState().setIsConverting(true);
    expect(useTaskStore.getState().isConverting).toBe(true);
  });

  it('setIsConverting(false) clears the running flag', () => {
    useTaskStore.getState().setIsConverting(true);
    useTaskStore.getState().setIsConverting(false);
    expect(useTaskStore.getState().isConverting).toBe(false);
  });
});
