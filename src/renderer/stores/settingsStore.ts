import { create } from 'zustand';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';

interface SettingsState {
  transcoder: string;
  setTranscoder: (t: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  transcoder: TRANSCODER_TYPES[0],
  setTranscoder: (t) => set({ transcoder: t }),
}));
