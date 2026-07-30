import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';

const log = new Logger('renderer/stores/settingsStore');

interface SettingsState {
  transcoder: string;
  setTranscoder: (t: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  transcoder: TRANSCODER_TYPES[0],
  setTranscoder: (t) => {
    log.debug('setTranscoder:', t);
    set({ transcoder: t });
  },
}));
