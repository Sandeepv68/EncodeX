/**
 * @fileoverview Toast notification container.
 *
 * Renders queued toast notifications as a single top-right Snackbar driven by
 * the shared toast store. Only one toast is visible at a time: the active
 * toast is shown until it is dismissed or its duration elapses, then the next
 * toast in the queue is promoted after the exit transition completes.
 *
 * Each toast is rendered as a filled alert with its message and an optional
 * detail line, using the toast's severity and per-toast duration (falling
 * back to TOAST_DEFAULT_DURATION_MS).
 */

import { useState, useEffect, useRef } from 'react';
import { Snackbar } from '@mui/material';
import { useToastStore } from '../stores/toastStore';
import type { Toast } from '../stores/types';
import { ToastAlert, ToastMessage, ToastDetail } from '../styles/ToastContainer.styles';
import { TOAST_DEFAULT_DURATION_MS } from '../../shared/constants';

/**
 * Renders the active toast from the toast queue.
 *
 * Syncs the internal queue with the store's toast list and promotes toasts one
 * at a time: when the current toast is dismissed ({@link handleClose}) it is
 * removed from the store, and after the Snackbar's exit transition
 * ({@link handleExited}) the next queued toast is promoted. Returns null while
 * no toast is active.
 * @returns {JSX.Element | null} The Snackbar with the active toast, or null.
 */
export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);
  const [active, setActive] = useState<Toast | null>(null);
  /**
   * Mirror of the store's toast list, read on exit to determine the next
   * toast to promote.
   * @type {React.MutableRefObject<Toast[]>}
   */
  const queueRef = useRef<Toast[]>([]);
  /**
   * True while a Snackbar is currently open/animating; gates promotion of the
   * next toast.
   * @type {React.MutableRefObject<boolean>}
   */
  const openRef = useRef(false);

  /**
   * Syncs the local queue with the store and opens the first toast whenever
   * the container is idle and toasts exist.
   * @returns {void}
   */
  useEffect(() => {
    queueRef.current = toasts;
    if (!openRef.current && toasts.length > 0) {
      openRef.current = true;
      setActive(toasts[0]);
    }
  }, [toasts]);

  /**
   * Dismisses the active toast: marks the container as closed, clears the
   * active toast, and removes it from the store so it is not shown again.
   * @returns {void}
   */
  const handleClose = () => {
    openRef.current = false;
    const current = active;
    setActive(null);
    if (current) {
      removeToast(current.id);
    }
  };

  /**
   * Snackbar exit-transition callback that promotes the next toast from the
   * queue, or does nothing when the queue is empty.
   * @returns {void}
   */
  const handleExited = () => {
    const remaining = queueRef.current.filter((t) => t.id !== active?.id);
    if (remaining.length > 0) {
      openRef.current = true;
      setActive(remaining[0]);
    }
  };

  if (!active) return null;

  return (
    <Snackbar
      key={active.id}
      open
      autoHideDuration={active.duration ?? TOAST_DEFAULT_DURATION_MS}
      onClose={handleClose}
      slotProps={{ transition: { onExited: handleExited } }}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <ToastAlert onClose={handleClose} severity={active.type} variant="filled">
        <ToastMessage>{active.message}</ToastMessage>
        {active.detail && <ToastDetail>{active.detail}</ToastDetail>}
      </ToastAlert>
    </Snackbar>
  );
}
