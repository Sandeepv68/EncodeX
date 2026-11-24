import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFeatureFlagsForTests, useFeatureFlag } from '../useFeatureFlags';

describe('useFeatureFlag', () => {
  beforeEach(() => {
    resetFeatureFlagsForTests();
    (window as any).electronAPI = {
      analyticsGetState: vi.fn().mockResolvedValue({ enabled: true, backend: 'posthog', featureFlags: { automations_page: false } }),
    };
  });

  it('returns fallback then resolved flag value', async () => {
    const { result } = renderHook(() => useFeatureFlag('automations_page', true));
    expect(result.current).toBe(true);
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});