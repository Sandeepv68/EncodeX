import { describe, expect, it, vi } from 'vitest';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import { DEFAULT_DASHBOARD_ROUTES } from '../../constants/dashboard';

vi.mock('../../utils/storage', () => ({
  loadJson: vi.fn((_key: string, fallback: unknown, onError?: (err: unknown) => void) => {
    onError?.(new Error('corrupt layout'));
    return fallback;
  }),
  saveJson: vi.fn(),
}));

describe('dashboardLayoutStore load failure', () => {
  it('falls back to the default layout and logs the storage error', async () => {
    expectAppLog('warn', 'renderer/stores/dashboardLayoutStore');
    const { useDashboardLayoutStore } = await import('../dashboardLayoutStore');
    const state = useDashboardLayoutStore.getState();

    expect(state.order).toEqual(DEFAULT_DASHBOARD_ROUTES);
    expect(state.customGroups).toEqual([]);
    expect(state.assignments).toEqual({});
  });
});
