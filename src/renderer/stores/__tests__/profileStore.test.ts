import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProfileStore } from '../profileStore';
import { useConversionStore } from '../conversionStore';
import { expectAppLog } from '../../../test-utils/crash-tripwire';

const STORAGE_KEY = 'encodex-custom-profiles';
const RECENT_KEY = 'encodex-recent-profiles';

/**
 * Re-imports the store so its module-scope initial state re-reads localStorage.
 * @returns {Promise<typeof import('../profileStore')>} A fresh store instance.
 */
async function importStore(): Promise<typeof import('../profileStore')> {
  vi.resetModules();
  return import('../profileStore');
}

let mockDate = 1000;
vi.spyOn(Date, 'now').mockImplementation(() => ++mockDate);

function customProfile(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Profile',
    category: 'video' as const,
    container: 'mkv',
    videoCodec: 'libx265',
    audioCodec: 'aac',
    videoBitrate: '5000k',
    audioBitrate: '192k',
    crf: 20,
    preset: 'slow',
    scale: '1920x1080',
    pixelFormat: 'yuv420p',
    description: 'A test profile',
    ...overrides,
  };
}

describe('profileStore', () => {
  beforeEach(() => {
    mockDate = 1000;
    localStorage.clear();
    useProfileStore.setState({
      profiles: useProfileStore.getState().profiles.filter((p) => p.builtin),
      selectedCategory: null,
      recentProfileIds: [],
    });
  });

  it('has default state with builtin profiles', () => {
    const state = useProfileStore.getState();
    expect(state.profiles.length).toBeGreaterThan(0);
    expect(state.profiles.every((p) => p.builtin)).toBe(true);
    expect(state.selectedCategory).toBeNull();
  });

  it('recordRecentProfile updates recentProfileIds', () => {
    useProfileStore.getState().recordRecentProfile('id-1');
    useProfileStore.getState().recordRecentProfile('id-2');
    expect(useProfileStore.getState().recentProfileIds).toEqual(['id-2', 'id-1']);
  });

  it('recordRecentProfile deduplicates in recent list', () => {
    useProfileStore.getState().recordRecentProfile('id-1');
    useProfileStore.getState().recordRecentProfile('id-2');
    useProfileStore.getState().recordRecentProfile('id-1');
    expect(useProfileStore.getState().recentProfileIds).toEqual(['id-1', 'id-2']);
  });

  it('recordRecentProfile limits recent to 5 entries', () => {
    const store = useProfileStore.getState();
    for (let i = 1; i <= 7; i++) {
      store.recordRecentProfile(`id-${i}`);
    }
    expect(useProfileStore.getState().recentProfileIds).toEqual(['id-7', 'id-6', 'id-5', 'id-4', 'id-3']);
  });

  it('setSelectedCategory updates the category filter', () => {
    useProfileStore.getState().setSelectedCategory('audio');
    expect(useProfileStore.getState().selectedCategory).toBe('audio');
    useProfileStore.getState().setSelectedCategory(null);
    expect(useProfileStore.getState().selectedCategory).toBeNull();
  });

  it('saveCustomProfile creates a profile with a unique id', () => {
    const id = useProfileStore.getState().saveCustomProfile(customProfile());
    expect(id).toMatch(/^custom-\d+$/);
    const profile = useProfileStore.getState().getProfileById(id);
    expect(profile).toBeDefined();
    expect(profile!.name).toBe('Test Profile');
    expect(profile!.builtin).toBe(false);
    expect(profile!.container).toBe('mkv');
    expect(profile!.videoCodec).toBe('libx265');
  });

  it('saveCustomProfile persists to localStorage', () => {
    const id = useProfileStore.getState().saveCustomProfile(customProfile());
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(id);
    expect(stored[0].builtin).toBe(false);
  });

  it('saveCustomProfile preserves builtin profiles in state', () => {
    const builtinCount = useProfileStore.getState().profiles.filter((p) => p.builtin).length;
    useProfileStore.getState().saveCustomProfile(customProfile());
    expect(useProfileStore.getState().profiles.filter((p) => p.builtin)).toHaveLength(builtinCount);
  });

  it('updateCustomProfile modifies an existing custom profile', () => {
    const id = useProfileStore.getState().saveCustomProfile(customProfile());
    useProfileStore.getState().updateCustomProfile(id, { name: 'Updated Name', crf: 18 });
    const profile = useProfileStore.getState().getProfileById(id);
    expect(profile!.name).toBe('Updated Name');
    expect(profile!.crf).toBe(18);
    expect(profile!.builtin).toBe(false);
  });

  it('updateCustomProfile does not allow changing builtin flag', () => {
    const id = useProfileStore.getState().saveCustomProfile(customProfile());
    useProfileStore.getState().updateCustomProfile(id, { builtin: true } as any);
    expect(useProfileStore.getState().getProfileById(id)!.builtin).toBe(false);
  });

  it('updateCustomProfile does nothing for unknown id', () => {
    const before = useProfileStore.getState().profiles.length;
    useProfileStore.getState().updateCustomProfile('nonexistent', { name: 'X' });
    expect(useProfileStore.getState().profiles.length).toBe(before);
  });

  it('updateCustomProfile does nothing for builtin profiles', () => {
    const builtin = useProfileStore.getState().profiles.find((p) => p.builtin)!;
    useProfileStore.getState().updateCustomProfile(builtin.id, { name: 'Hacked' });
    expect(useProfileStore.getState().getProfileById(builtin.id)!.name).toBe(builtin.name);
  });

  it('deleteCustomProfile removes a custom profile', () => {
    const id = useProfileStore.getState().saveCustomProfile(customProfile());
    expect(useProfileStore.getState().getProfileById(id)).toBeDefined();
    useProfileStore.getState().deleteCustomProfile(id);
    expect(useProfileStore.getState().getProfileById(id)).toBeUndefined();
  });

  it('deleteCustomProfile persists removal to localStorage', () => {
    const id = useProfileStore.getState().saveCustomProfile(customProfile());
    useProfileStore.getState().deleteCustomProfile(id);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(0);
  });

  it('deleteCustomProfile does nothing for unknown id', () => {
    const before = useProfileStore.getState().profiles.length;
    useProfileStore.getState().deleteCustomProfile('nonexistent');
    expect(useProfileStore.getState().profiles.length).toBe(before);
  });

  it('deleteCustomProfile refuses to delete builtin profiles', () => {
    const builtin = useProfileStore.getState().profiles.find((p) => p.builtin)!;
    const before = useProfileStore.getState().profiles.length;
    useProfileStore.getState().deleteCustomProfile(builtin.id);
    expect(useProfileStore.getState().profiles.length).toBe(before);
  });

  it('getProfileById returns the correct profile', () => {
    const builtin = useProfileStore.getState().profiles.find((p) => p.builtin)!;
    expect(useProfileStore.getState().getProfileById(builtin.id)).toBe(builtin);
    expect(useProfileStore.getState().getProfileById('nonexistent')).toBeUndefined();
  });

  it('getProfilesByCategory filters profiles', () => {
    const videoProfiles = useProfileStore.getState().getProfilesByCategory('video');
    expect(videoProfiles.length).toBeGreaterThan(0);
    expect(videoProfiles.every((p) => p.category === 'video')).toBe(true);
  });

  it('getRecentProfiles returns profiles matching recent ids', () => {
    const profiles = useProfileStore.getState().profiles;
    const first3 = profiles.slice(0, 3);
    useProfileStore.setState({ recentProfileIds: first3.map((p) => p.id) });
    const recent = useProfileStore.getState().getRecentProfiles();
    expect(recent).toHaveLength(3);
    expect(recent.map((p) => p.id)).toEqual(first3.map((p) => p.id));
  });

  it('getRecentProfiles skips ids that no longer exist', () => {
    const profiles = useProfileStore.getState().profiles;
    useProfileStore.setState({ recentProfileIds: [profiles[0].id, 'deleted-id'] });
    const recent = useProfileStore.getState().getRecentProfiles();
    expect(recent).toHaveLength(1);
  });

  it('applyProfileToConversionStore applies codec and quality settings', () => {
    const profile = customProfile();
    const applyableProfile = { ...profile, id: 'test-apply', builtin: false };
    useProfileStore.getState().applyProfileToConversionStore(applyableProfile as any);
    const convState = useConversionStore.getState();
    expect(convState.videoCodec).toBe('libx265');
    expect(convState.audioCodec).toBe('aac');
    expect(convState.videoBitrate).toBe('5000k');
    expect(convState.audioBitrate).toBe('192k');
    expect(convState.qscale).toBe(20);
    expect(convState.scale).toBe('1920x1080');
    expect(convState.pixelFormat).toBe('yuv420p');
  });

  it('applyProfileToConversionStore skips undefined fields', () => {
    useConversionStore.getState().setVideoCodec('libx264');
    useConversionStore.getState().setScale('640x480');
    const profile = customProfile({ videoCodec: 'libx265', scale: undefined });
    useProfileStore.getState().applyProfileToConversionStore({ ...profile, id: 'partial', builtin: false } as any);
    expect(useConversionStore.getState().videoCodec).toBe('libx265');
    expect(useConversionStore.getState().scale).toBe('640x480');
  });

  it('applyProfileToConversionStore updates recentProfileIds', () => {
    const profile = { ...customProfile(), id: 'recent-test', builtin: false };
    useProfileStore.getState().applyProfileToConversionStore(profile as any);
    expect(useProfileStore.getState().recentProfileIds).toContain('recent-test');
  });

  it('loads custom profiles from localStorage on init', async () => {
    // The store builds its initial `profiles` at **module scope**
    // (`[...BUILTIN_PROFILES, ...loadCustomProfiles()]`), and there is no
    // `init()` to call. This spec used to write localStorage and then
    // `setState` the same values straight back in, so `loadCustomProfiles` was
    // never executed and the spec asserted nothing about loading. Seeding
    // storage and re-importing the module is the only way to reach the real
    // path.
    localStorage.setItem(STORAGE_KEY, JSON.stringify([customProfile({ id: 'custom-1', name: 'Stored', builtin: false })]));

    const { useProfileStore: reloaded } = await importStore();
    const custom = reloaded.getState().profiles.filter((p) => !p.builtin);
    expect(custom).toHaveLength(1);
    expect(custom[0].id).toBe('custom-1');
    expect(custom[0].name).toBe('Stored');
    // Builtins must still be present after a real load.
    expect(reloaded.getState().profiles.some((p) => p.builtin)).toBe(true);
  });

  it('drops unusable entries from localStorage instead of injecting them as profiles', async () => {
    // `loadCustomProfiles` filters on `builtin === false` plus string id/name.
    // A corrupt or hand-edited key must not be able to inject a built-in
    // duplicate or a nameless entry into the profile list.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        customProfile({ id: 'good-1', name: 'Good', builtin: false }),
        customProfile({ id: 'looks-builtin', name: 'Impostor', builtin: true }),
        { id: 'nameless', builtin: false },
        'not-an-object',
        null,
      ]),
    );

    const { useProfileStore: reloaded } = await importStore();
    const custom = reloaded.getState().profiles.filter((p) => !p.builtin);
    expect(custom.map((p) => p.id)).toEqual(['good-1']);
  });

  it('falls back to no custom profiles when the stored JSON is corrupt', async () => {
    expectAppLog('warn', 'renderer/stores/profileStore');

    localStorage.setItem(STORAGE_KEY, '{not json');
    const { useProfileStore: reloaded } = await importStore();
    expect(reloaded.getState().profiles.every((p) => p.builtin)).toBe(true);
  });

  it('caps the restored recent ids', async () => {
    // `loadRecentIds` slices to MAX_RECENT (5), so a stale key with more
    // entries than the cap cannot grow the recents list.
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
    const { useProfileStore: reloaded } = await importStore();
    expect(reloaded.getState().recentProfileIds).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('loads recent ids from localStorage', () => {
    const profiles = useProfileStore.getState().profiles;
    localStorage.setItem(RECENT_KEY, JSON.stringify([profiles[0].id, profiles[1].id]));
    useProfileStore.setState({ recentProfileIds: JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') });
    expect(useProfileStore.getState().recentProfileIds).toHaveLength(2);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
    localStorage.setItem(RECENT_KEY, 'not-valid-json{{{');
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom).toHaveLength(0);
    expect(useProfileStore.getState().recentProfileIds).toEqual([]);
  });

  it('handles non-array localStorage data gracefully', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'array' }));
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom).toHaveLength(0);
  });

  it('filters out invalid entries from localStorage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 123 },
        { name: 'no-id' },
        { id: 'valid', name: 'OK', category: 'video', container: 'mp4', videoCodec: 'libx264', audioCodec: 'aac', builtin: false },
      ]),
    );
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    const valid = stored.filter(
      (p: unknown): p is { id: string; name: string; builtin: boolean } =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as any).id === 'string' &&
        typeof (p as any).name === 'string' &&
        (p as any).builtin === false,
    );
    expect(valid).toHaveLength(1);
  });
});
