/**
 * @fileoverview Zustand store for toast notification state.
 * Manages toast messages and notifications.
 */

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  detail?: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, detail?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, detail?: string, duration?: number) => void;
  error: (message: string, detail?: string, duration?: number) => void;
  warning: (message: string, detail?: string, duration?: number) => void;
  info: (message: string, detail?: string, duration?: number) => void;
}

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
