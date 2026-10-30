/**
 * @fileoverview Two-step confirmation for destructive view actions.
 *
 * The hand-written views armed their cancel buttons with a duplicated click
 * handler: the first click switched the label to "Confirm" and started a
 * four-second timer, the second click issued the call. This hook owns that
 * behaviour once, so every view arms the same way.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArmedAction } from './types';

export type { ArmedAction };

/** How long an armed action stays armed before it reverts. @const {number} */
export const ARM_TIMEOUT_MS = 4000;

/**
 * Creates an armed action.
 * @param {() => void | Promise<void>} onConfirm - The action to run once armed.
 * @param {number} [timeoutMs] - How long the action stays armed.
 * @returns {ArmedAction} The armed-action controller.
 */
export function useArmedAction(onConfirm: () => void | Promise<void>, timeoutMs: number = ARM_TIMEOUT_MS): ArmedAction {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setArmed(false);
    setError(undefined);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const trigger = useCallback(() => {
    if (busy) return;
    if (!armed) {
      setArmed(true);
      setError(undefined);
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setArmed(false);
      }, timeoutMs);
      return;
    }
    clearTimer();
    setArmed(false);
    setBusy(true);
    setError(undefined);
    void Promise.resolve()
      .then(() => confirmRef.current())
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setBusy(false));
  }, [armed, busy, clearTimer, timeoutMs]);

  return { armed, busy, error, trigger, reset };
}
