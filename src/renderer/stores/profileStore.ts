/**
 * @fileoverview Zustand store for conversion profile management.
 * Holds the merged list of built-in and user-created profiles, the currently
 * active profile, and the selected category filter. User-created profiles are
 * persisted to localStorage under 'encodex-custom-profiles'.
 *
 * State held:
 *  - profiles: merged builtin + custom profiles
 *  - selectedCategory: category filter in the UI (or null for all)
 *  - recentProfileIds: last 5 most recently applied profile ids
 *
 * The active profile selection is intentionally NOT global: each page that
 * renders a ProfileSelector keeps its own active profile in local component
 * state, so selecting a profile on the Convert page never leaks into the Batch
 * queue page (and vice versa). Applying a profile writes to the target of the
 * page that invoked it; this store exposes `applyProfileToConversionStore` for
 * the Convert default path.
 *
 * Consumers:
 *  - ProfileSelector component (reads profiles, filters)
 *  - ProfileEditorDialog (reads/writes custom profiles)
 *  - ProfileBadge (renders an already-resolved profile, passed via props)
 *  - Convert page / BatchEncodingPanel (apply profile to conversion form)
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import type { ConversionProfile, ProfileCategory } from '../../shared/types';
import { BUILTIN_PROFILES } from '../../shared/profiles';
import { useConversionStore } from './conversionStore';

const STORAGE_KEY = 'encodex-custom-profiles';
const RECENT_KEY = 'encodex-recent-profiles';
const MAX_RECENT = 5;

const log = new Logger('renderer/stores/profileStore');

function loadCustomProfiles(): ConversionProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ConversionProfile =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as ConversionProfile).id === 'string' &&
        typeof (p as ConversionProfile).name === 'string' &&
        (p as ConversionProfile).builtin === false,
    );
  } catch {
    log.warn('Failed to load custom profiles from localStorage');
    return [];
  }
}

function saveCustomProfiles(profiles: ConversionProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    log.warn('Failed to persist custom profiles to localStorage');
  }
}

function loadRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentIds(ids: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {
    // silent
  }
}

interface ProfileState {
  profiles: ConversionProfile[];
  selectedCategory: ProfileCategory | null;
  recentProfileIds: string[];
  setSelectedCategory: (cat: ProfileCategory | null) => void;
  saveCustomProfile: (profile: Omit<ConversionProfile, 'id' | 'builtin'>) => string;
  updateCustomProfile: (id: string, updates: Partial<ConversionProfile>) => void;
  deleteCustomProfile: (id: string) => void;
  getProfileById: (id: string) => ConversionProfile | undefined;
  getProfilesByCategory: (cat: ProfileCategory) => ConversionProfile[];
  getRecentProfiles: () => ConversionProfile[];
  applyProfileToConversionStore: (profile: ConversionProfile) => void;
  recordRecentProfile: (id: string) => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [...BUILTIN_PROFILES, ...loadCustomProfiles()],
  selectedCategory: null,
  recentProfileIds: loadRecentIds(),

  setSelectedCategory: (cat) => {
    log.debug('setSelectedCategory', cat);
    set({ selectedCategory: cat });
  },

  saveCustomProfile: (data) => {
    const id = `custom-${Date.now()}`;
    const profile: ConversionProfile = { ...data, id, builtin: false };
    const customProfiles = [...get().profiles.filter((p) => !p.builtin), profile];
    saveCustomProfiles(customProfiles);
    set({ profiles: [...BUILTIN_PROFILES, ...customProfiles] });
    log.info('Saved custom profile', id, profile.name);
    return id;
  },

  updateCustomProfile: (id, updates) => {
    const all = get().profiles;
    const idx = all.findIndex((p) => p.id === id && !p.builtin);
    if (idx === -1) return;
    const updated = { ...all[idx], ...updates, builtin: false };
    const next = [...all.slice(0, idx), updated, ...all.slice(idx + 1)];
    const customProfiles = next.filter((p) => !p.builtin);
    saveCustomProfiles(customProfiles);
    set({ profiles: next });
    log.info('Updated custom profile', id);
  },

  deleteCustomProfile: (id) => {
    const all = get().profiles;
    const next = all.filter((p) => p.id !== id || p.builtin);
    const customProfiles = next.filter((p) => !p.builtin);
    saveCustomProfiles(customProfiles);
    set({ profiles: next });
    log.info('Deleted custom profile', id);
  },

  getProfileById: (id) => get().profiles.find((p) => p.id === id),

  getProfilesByCategory: (cat) => get().profiles.filter((p) => p.category === cat),

  getRecentProfiles: () => {
    const { profiles, recentProfileIds } = get();
    return recentProfileIds.map((id) => profiles.find((p) => p.id === id)).filter((p): p is ConversionProfile => p !== undefined);
  },

  applyProfileToConversionStore: (profile) => {
    try {
      const store = useConversionStore.getState();

      if (profile.videoCodec) store.setVideoCodec(profile.videoCodec);
      if (profile.audioCodec) store.setAudioCodec(profile.audioCodec);
      if (profile.videoBitrate) store.setVideoBitrate(profile.videoBitrate);
      if (profile.audioBitrate) store.setAudioBitrate(profile.audioBitrate);
      if (profile.crf !== undefined) store.setQscale(profile.crf);
      if (profile.scale) store.setScale(profile.scale);
      if (profile.pixelFormat) store.setPixelFormat(profile.pixelFormat);

      get().recordRecentProfile(profile.id);
      log.info('Applied profile', profile.id, profile.name);
    } catch (err) {
      log.error('Failed to apply profile', profile.id, err);
    }
  },

  recordRecentProfile: (id) => {
    log.debug('recordRecentProfile', id);
    const state = get();
    const recent = state.recentProfileIds.filter((r) => r !== id);
    recent.unshift(id);
    const trimmed = recent.slice(0, MAX_RECENT);
    saveRecentIds(trimmed);
    set({ recentProfileIds: trimmed });
  },
}));
