import { describe, it, expect, beforeEach } from 'vitest';
import { useDismissedAlertsStore, DISMISSED_ALERT_KEYS } from '../dismissedAlertsStore';

describe('dismissedAlertsStore', () => {
  beforeEach(() => {
    useDismissedAlertsStore.setState({ dismissed: [] });
  });

  it('starts with no dismissed alerts', () => {
    expect(useDismissedAlertsStore.getState().dismissed).toEqual([]);
  });

  it('dismiss marks the alert key as dismissed', () => {
    useDismissedAlertsStore.getState().dismiss(DISMISSED_ALERT_KEYS.HARDWARE_ACCEL);
    expect(useDismissedAlertsStore.getState().isDismissed(DISMISSED_ALERT_KEYS.HARDWARE_ACCEL)).toBe(true);
    expect(useDismissedAlertsStore.getState().dismissed).toEqual(['hardwareAccel']);
  });

  it('dismiss is idempotent for the same key', () => {
    const { dismiss } = useDismissedAlertsStore.getState();
    dismiss(DISMISSED_ALERT_KEYS.COMPAT);
    dismiss(DISMISSED_ALERT_KEYS.COMPAT);
    expect(useDismissedAlertsStore.getState().dismissed).toEqual(['compat']);
  });

  it('tracks distinct alert keys independently', () => {
    const { dismiss } = useDismissedAlertsStore.getState();
    dismiss(DISMISSED_ALERT_KEYS.OPTIONS_EDITABLE);
    expect(useDismissedAlertsStore.getState().isDismissed(DISMISSED_ALERT_KEYS.OPTIONS_EDITABLE)).toBe(true);
    expect(useDismissedAlertsStore.getState().isDismissed(DISMISSED_ALERT_KEYS.OPTIONS_LOCKED)).toBe(false);
  });

  it('returns false for keys that were never dismissed', () => {
    expect(useDismissedAlertsStore.getState().isDismissed(DISMISSED_ALERT_KEYS.HARDWARE_ACCEL)).toBe(false);
  });
});
