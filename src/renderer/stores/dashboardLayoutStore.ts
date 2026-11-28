/**
 * @fileoverview Zustand store for the Dashboard's customizable card layout.
 *
 * Holds the card order, the built-in/custom group definitions and each card's
 * group assignment. Every mutation validates its input, persists the resulting
 * snapshot to localStorage under 'encodex-dashboard-layout' and updates the
 * store in one step. Reads go through `reconcileDashboardLayout`, so a layout
 * saved by an older app version never breaks the card grid.
 *
 * Consumers:
 *  - Dashboard page (edit mode, sortable grid, grouped sections)
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { DASHBOARD_LAYOUT_STORAGE_KEY, FAVOURITES_GROUP_ID, MAX_CUSTOM_GROUPS } from '../constants/dashboard';
import { loadJson, saveJson } from '../utils/storage';
import {
  createDefaultLayout,
  createGroupId,
  normalizeGroupName,
  reorderedRoutes,
  reconcileDashboardLayout,
} from '../utils/dashboard-layout';
import type { DashboardGroupId, DashboardLayoutSnapshot, DashboardLayoutState } from './types';

const log = new Logger('renderer/stores/dashboardLayoutStore');

/**
 * Reads the persisted layout, falling back to defaults for missing/corrupt data.
 * @returns {DashboardLayoutSnapshot} A validated layout snapshot.
 */
function loadLayout(): DashboardLayoutSnapshot {
  const parsed = loadJson<unknown>(DASHBOARD_LAYOUT_STORAGE_KEY, null, (err) =>
    log.warn('Failed to load dashboard layout from localStorage', err),
  );
  return reconcileDashboardLayout(parsed);
}

/**
 * Persists only the data fields (never the actions).
 * @param {DashboardLayoutSnapshot} snapshot - Layout to store.
 * @returns {void}
 */
function persistLayout(snapshot: DashboardLayoutSnapshot): void {
  saveJson(DASHBOARD_LAYOUT_STORAGE_KEY, snapshot, (err) => log.warn('Failed to persist dashboard layout to localStorage', err));
}

/** Extracts the data fields from the full store state. @function snapshotOf */
function snapshotOf(state: DashboardLayoutSnapshot): DashboardLayoutSnapshot {
  return { order: [...state.order], assignments: { ...state.assignments }, customGroups: state.customGroups.map((g) => ({ ...g })) };
}

const initialLayout = loadLayout();

/** Singleton dashboard layout store used by the Dashboard page. */
export const useDashboardLayoutStore = create<DashboardLayoutState>((set, get) => ({
  ...initialLayout,

  reorder: (activeRoute, overRoute) => {
    const state = get();
    const order = reorderedRoutes(state.order, activeRoute, overRoute);
    if (order.every((route, index) => route === state.order[index])) return;
    const next = { ...snapshotOf(state), order };
    persistLayout(next);
    set({ order });
  },

  assignGroup: (route, groupId) => {
    const state = get();
    if (!state.order.includes(route)) return;
    const validGroup = groupId === null || groupId === FAVOURITES_GROUP_ID || state.customGroups.some((group) => group.id === groupId);
    if (!validGroup || state.assignments[route] === groupId) return;
    const assignments = { ...state.assignments, [route]: groupId };
    persistLayout({ ...snapshotOf(state), assignments });
    set({ assignments });
  },

  createGroup: (name) => {
    const state = get();
    const normalized = normalizeGroupName(name);
    if (!normalized || state.customGroups.length >= MAX_CUSTOM_GROUPS) return null;
    const existing = state.customGroups.find((group) => group.name.toLowerCase() === normalized.toLowerCase());
    if (existing) return existing.id;
    const id: DashboardGroupId = createGroupId();
    const customGroups = [...state.customGroups, { id, name: normalized }];
    persistLayout({ ...snapshotOf(state), customGroups });
    set({ customGroups });
    return id;
  },

  renameGroup: (id, name) => {
    const state = get();
    const normalized = normalizeGroupName(name);
    if (!normalized) return;
    if (!state.customGroups.some((group) => group.id === id)) return;
    const customGroups = state.customGroups.map((group) => (group.id === id ? { ...group, name: normalized } : group));
    persistLayout({ ...snapshotOf(state), customGroups });
    set({ customGroups });
  },

  deleteGroup: (id) => {
    const state = get();
    if (!state.customGroups.some((group) => group.id === id)) return;
    const customGroups = state.customGroups.filter((group) => group.id !== id);
    const assignments = { ...state.assignments };
    for (const route of Object.keys(assignments)) {
      if (assignments[route] === id) assignments[route] = null;
    }
    persistLayout({ ...snapshotOf(state), assignments, customGroups });
    set({ assignments, customGroups });
  },

  resetLayout: () => {
    const next = createDefaultLayout();
    persistLayout(next);
    set(next);
  },
}));
