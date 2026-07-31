import { describe, it, expect } from 'vitest';
import { useSettingsStore } from '../settingsStore';
import { TRANSCODER_TYPES } from '../../../shared/transcoder-constants';

describe('settingsStore', () => {
  it('defaults transcoder to the first type', () => {
    expect(useSettingsStore.getState().transcoder).toBe(TRANSCODER_TYPES[0]);
  });

  it('setTranscoder updates the value', () => {
    useSettingsStore.getState().setTranscoder('BMF');
    expect(useSettingsStore.getState().transcoder).toBe('BMF');
  });
});
