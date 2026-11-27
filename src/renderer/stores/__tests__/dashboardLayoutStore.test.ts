import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_DASHBOARD_ROUTES, DASHBOARD_LAYOUT_STORAGE_KEY, FAVOURITES_GROUP_ID, MAX_CUSTOM_GROUPS } from '../../constants/dashboard';
import { useDashboardLayoutStore } from '../dashboardLayoutStore';

function state() {
  return useDashboardLayoutStore.getState();
}

function stored() {
  return JSON.parse(localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY) ?? '{}') as {
    order: string[];
    assignments: Record<string, string | null>;
    customGroups: Array<{ id: string; name: string }>;
  };
}

beforeEach(() => {
  localStorage.clear();
  state().resetLayout();
});

describe('dashboardLayoutStore', () => {
  it('starts with the default order and no groups', () => {
    expect(state().order).toEqual(DEFAULT_DASHBOARD_ROUTES);
    expect(state().customGroups).toEqual([]);
    expect(Object.keys(state().assignments)).toHaveLength(0);
  });

  it('reorders cards and persists the new order', () => {
    const first = state().order[0];
    const third = state().order[2];
    state().reorder(first, third);
    expect(state().order[2]).toBe(first);
    expect(stored().order).toEqual(state().order);
  });

  it('ignores a reorder with unknown routes', () => {
    const before = state().order;
    state().reorder('/missing', before[0]);
    expect(state().order).toEqual(before);
  });

  it('assigns a card to Favourites and to a custom group', () => {
    const route = state().order[0];
    state().assignGroup(route, FAVOURITES_GROUP_ID);
    expect(state().assignments[route]).toBe(FAVOURITES_GROUP_ID);

    const id = state().createGroup('My tools');
    expect(id).not.toBeNull();
    state().assignGroup(route, id);
    expect(state().assignments[route]).toBe(id);
    expect(stored().assignments[route]).toBe(id);
  });

  it('ignores assignments to unknown routes or groups', () => {
    state().assignGroup('/missing', FAVOURITES_GROUP_ID);
    state().assignGroup(state().order[0], 'deleted');
    expect(Object.keys(state().assignments)).toHaveLength(0);
  });

  it('reuses a group when the same name is created twice', () => {
    const first = state().createGroup('  My tools  ');
    const second = state().createGroup('my tools');
    expect(second).toBe(first);
    expect(state().customGroups).toHaveLength(1);
    expect(state().customGroups[0].name).toBe('My tools');
  });

  it('does not create groups beyond the cap or with an empty name', () => {
    for (let index = 0; index < MAX_CUSTOM_GROUPS; index += 1) {
      expect(state().createGroup(`Group ${index}`)).not.toBeNull();
    }
    expect(state().createGroup('Too many')).toBeNull();
    expect(state().createGroup('   ')).toBeNull();
    expect(state().customGroups).toHaveLength(MAX_CUSTOM_GROUPS);
  });

  it('renames a custom group but not the built-in group', () => {
    const id = state().createGroup('Old');
    state().renameGroup(id!, '  New  ');
    expect(state().customGroups[0].name).toBe('New');
    state().renameGroup(FAVOURITES_GROUP_ID, 'Nope');
    expect(state().customGroups).toHaveLength(1);
  });

  it('deletes a group and unassigns its cards', () => {
    const id = state().createGroup('Temp')!;
    state().assignGroup(state().order[0], id);
    state().deleteGroup(id);
    expect(state().customGroups).toEqual([]);
    expect(state().assignments[state().order[0]]).toBeNull();
    expect(stored().customGroups).toEqual([]);
  });

  it('resets order, groups and assignments', () => {
    const route = state().order[0];
    state().assignGroup(route, FAVOURITES_GROUP_ID);
    state().createGroup('Temp');
    state().reorder(state().order[0], state().order[3]);
    state().resetLayout();
    expect(state().order).toEqual(DEFAULT_DASHBOARD_ROUTES);
    expect(state().customGroups).toEqual([]);
    expect(state().assignments[route]).toBeUndefined();
  });
});
