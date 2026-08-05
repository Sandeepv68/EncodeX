/**
 * @fileoverview Zustand store for toast notification state.
 * Manages toast messages and notifications.
 */

import { create } from 'zustand';
import type { ToastType, Toast, ToastState } from './types';

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (type, message, detail, duration) => {
    const id = `toast-${++counter}`;
    const toast: Toast = { id, type, message, detail, duration };
    set((s) => ({ toasts: [...s.toasts, toast] }));
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  success: (message, detail, duration) => get().addToast('success', message, detail, duration),
  error: (message, detail, duration) => get().addToast('error', message, detail, duration),
  warning: (message, detail, duration) => get().addToast('warning', message, detail, duration),
  info: (message, detail, duration) => get().addToast('info', message, detail, duration),
}));
