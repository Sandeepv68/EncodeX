/**
 * @fileoverview Zustand store for toast notification state.
 * Manages the list of active toast notifications and the actions to add and
 * remove them.
 *
 * State held:
 *  - toasts: active toasts in insertion order
 *
 * Behavior notes:
 *  - Each toast gets a monotonically increasing 'toast-<n>' id from a module
 *    counter.
 *  - success / error / warning / info are convenience wrappers around addToast
 *    that fix the toast type.
 *
 * Consumers:
 *  - The toast notification UI (renderer)
 *  - Stores and actions that notify the user of outcomes, e.g.
 *    audioExtractStore on a successful extraction
 */

import { create } from 'zustand';
import type { ToastType, Toast, ToastState } from './types';

/**
 * Monotonically increasing counter used to generate unique toast ids.
 * @type {number}
 */
let counter = 0;

/**
 * Zustand store for toast notification state.
 * Holds the active toasts and provides addToast / removeToast plus the typed
 * convenience wrappers success / error / warning / info. Implemented as a
 * module-level singleton so any renderer module can push a toast via
 * useToastStore.getState().
 * @const {UseBoundStore<StoreApi<ToastState>>} useToastStore
 */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  /**
   * Appends a new toast with a unique auto-generated id ('toast-<n>') and the
   * given severity, message, and optional detail/duration.
   * @param {ToastType} type - Severity/kind of the toast.
   * @param {string} message - The main toast text.
   * @param {string} [detail] - Optional secondary detail line.
   * @param {number} [duration] - Optional display duration in milliseconds.
   */
  addToast: (type, message, detail, duration) => {
    const id = `toast-${++counter}`;
    const toast: Toast = { id, type, message, detail, duration };
    set((s) => ({ toasts: [...s.toasts, toast] }));
  },
  /**
   * Removes the toast with the given id.
   * @param {string} id - The toast id to remove.
   */
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  /**
   * Adds a 'success' toast.
   * @param {string} message - The main toast text.
   * @param {string} [detail] - Optional secondary detail line.
   * @param {number} [duration] - Optional display duration in milliseconds.
   */
  success: (message, detail, duration) => get().addToast('success', message, detail, duration),
  /**
   * Adds an 'error' toast.
   * @param {string} message - The main toast text.
   * @param {string} [detail] - Optional secondary detail line.
   * @param {number} [duration] - Optional display duration in milliseconds.
   */
  error: (message, detail, duration) => get().addToast('error', message, detail, duration),
  /**
   * Adds a 'warning' toast.
   * @param {string} message - The main toast text.
   * @param {string} [detail] - Optional secondary detail line.
   * @param {number} [duration] - Optional display duration in milliseconds.
   */
  warning: (message, detail, duration) => get().addToast('warning', message, detail, duration),
  /**
   * Adds an 'info' toast.
   * @param {string} message - The main toast text.
   * @param {string} [detail] - Optional secondary detail line.
   * @param {number} [duration] - Optional display duration in milliseconds.
   */
  info: (message, detail, duration) => get().addToast('info', message, detail, duration),
}));
