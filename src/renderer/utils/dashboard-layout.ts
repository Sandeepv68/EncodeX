/**
 * @fileoverview Pure helpers for the persisted dashboard layout.
 *
 * Reads from localStorage can contain anything (older app versions, manual
 * edits, corrupt JSON), so `reconcileDashboardLayout` turns an unknown value
 * into a layout that only references routes and groups that exist now. The
 * reorder helper keeps the dnd-kit permutation unit-testable.
 */

import { arrayMove } from '@dnd-kit/sortable';
import {
  DEFAULT_DASHBOARD_ROUTES,
  FAVOURITES_GROUP_ID,
  MAX_CUSTOM_GROUPS,
  MAX_GROUP_NAME_LENGTH,
  UNGROUPED_GROUP_ID,
} from '../constants/dashboard';
import type { DashboardCustomGroup, DashboardGroupId, DashboardLayoutSnapshot } from '../stores/types';

/**
 * Returns the analytics-safe kind of a group id.
 * @param {DashboardGroupId | null} groupId - Group id from the layout.
 * @returns {'favourites' | 'custom' | 'ungrouped'} Categorical group kind.
 */
export function groupKind(groupId: DashboardGroupId | null): 'favourites' | 'custom' | 'ungrouped' {
  if (groupId === null) return 'ungrouped';
  if (groupId === FAVOURITES_GROUP_ID) return 'favourites';
  return 'custom';
}

/** Returns the unmodified default layout. @returns {DashboardLayoutSnapshot} */
export function createDefaultLayout(): DashboardLayoutSnapshot {
  return { order: [...DEFAULT_DASHBOARD_ROUTES], assignments: {}, customGroups: [] };
}

/** Trims and length-caps a user-entered group name. @function normalizeGroupName */
export function normalizeGroupName(name: string): string {
  return name.trim().slice(0, MAX_GROUP_NAME_LENGTH);
}

/**
 * Generates an id for a new custom group. Falls back to a timestamp-based id
 * in environments without the Web Crypto API.
 * @returns {DashboardGroupId} A fresh group id.
 */
export function createGroupId(): DashboardGroupId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `group-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Validates a persisted layout against the current set of card routes.
 * Unknown/duplicate routes are dropped, missing routes are appended in their
 * canonical order, and assignments to deleted groups become ungrouped.
 * @param {unknown} raw - Parsed localStorage value.
 * @returns {DashboardLayoutSnapshot} A safe, complete layout.
 */
export function reconcileDashboardLayout(raw: unknown): DashboardLayoutSnapshot {
  const knownRoutes = new Set<string>(DEFAULT_DASHBOARD_ROUTES);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return createDefaultLayout();
  const candidate = raw as Partial<DashboardLayoutSnapshot>;

  const order: string[] = [];
  if (Array.isArray(candidate.order)) {
    for (const route of candidate.order) {
      if (typeof route === 'string' && knownRoutes.has(route) && !order.includes(route)) order.push(route);
    }
  }
  for (const route of DEFAULT_DASHBOARD_ROUTES) {
    if (!order.includes(route)) order.push(route);
  }

  const customGroups: DashboardCustomGroup[] = [];
  if (Array.isArray(candidate.customGroups)) {
    for (const entry of candidate.customGroups) {
      if (customGroups.length >= MAX_CUSTOM_GROUPS) break;
      if (entry === null || typeof entry !== 'object') continue;
      const group = entry as Partial<DashboardCustomGroup>;
      if (typeof group.id !== 'string' || !group.id || group.id === FAVOURITES_GROUP_ID || group.id === UNGROUPED_GROUP_ID) {
        continue;
      }
      if (customGroups.some((existing) => existing.id === group.id)) continue;
      const name = typeof group.name === 'string' ? normalizeGroupName(group.name) : '';
      if (!name) continue;
      customGroups.push({ id: group.id, name });
    }
  }

  const allowedGroups = new Set<string>([FAVOURITES_GROUP_ID, ...customGroups.map((group) => group.id)]);
  const storedAssignments =
    candidate.assignments !== null && typeof candidate.assignments === 'object' && !Array.isArray(candidate.assignments)
      ? (candidate.assignments as Record<string, unknown>)
      : {};
  const assignments: Record<string, DashboardGroupId | null> = {};
  for (const route of order) {
    const value = storedAssignments[route];
    assignments[route] = typeof value === 'string' && allowedGroups.has(value) ? value : null;
  }

  return { order, assignments, customGroups };
}

/**
 * Moves one route to another route's position without mutating the input.
 * @param {string[]} order - Current card order.
 * @param {string} activeRoute - Route being dragged.
 * @param {string} overRoute - Route under the drag target.
 * @returns {string[]} The next order (identical input when either route is missing).
 */
export function reorderedRoutes(order: readonly string[], activeRoute: string, overRoute: string): string[] {
  if (activeRoute === overRoute) return [...order];
  const from = order.indexOf(activeRoute);
  const to = order.indexOf(overRoute);
  if (from < 0 || to < 0) return [...order];
  return arrayMove([...order], from, to);
}
