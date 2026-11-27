import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DASHBOARD_ROUTES,
  FAVOURITES_GROUP_ID,
  MAX_CUSTOM_GROUPS,
  MAX_GROUP_NAME_LENGTH,
  UNGROUPED_GROUP_ID,
} from '../../constants/dashboard';
import { createDefaultLayout, createGroupId, normalizeGroupName, reconcileDashboardLayout, reorderedRoutes } from '../dashboard-layout';

describe('createDefaultLayout', () => {
  it('returns every canonical card route in order with no groups', () => {
    expect(createDefaultLayout()).toEqual({
      order: DEFAULT_DASHBOARD_ROUTES,
      assignments: {},
      customGroups: [],
    });
  });

  it('returns a fresh array so callers cannot mutate the constant', () => {
    const first = createDefaultLayout();
    first.order.pop();
    expect(createDefaultLayout().order).toEqual(DEFAULT_DASHBOARD_ROUTES);
  });
});

describe('normalizeGroupName', () => {
  it('trims whitespace and caps the length', () => {
    expect(normalizeGroupName('  My tools  ')).toBe('My tools');
    expect(normalizeGroupName('a'.repeat(MAX_GROUP_NAME_LENGTH + 20))).toHaveLength(MAX_GROUP_NAME_LENGTH);
  });
});

describe('createGroupId', () => {
  it('returns a non-empty unique id', () => {
    const first = createGroupId();
    expect(first.length).toBeGreaterThan(0);
    expect(createGroupId()).not.toBe(first);
  });
});

describe('reconcileDashboardLayout', () => {
  it('falls back to defaults for malformed input', () => {
    for (const raw of [null, undefined, 42, 'oops', [], true]) {
      expect(reconcileDashboardLayout(raw)).toEqual(createDefaultLayout());
    }
  });

  it('preserves a valid order and appends newly added routes', () => {
    const result = reconcileDashboardLayout({ order: ['/convert', '/batch'] });
    expect(result.order.slice(0, 2)).toEqual(['/convert', '/batch']);
    expect(result.order).toHaveLength(DEFAULT_DASHBOARD_ROUTES.length);
    expect(new Set(result.order).size).toBe(DEFAULT_DASHBOARD_ROUTES.length);
  });

  it('drops unknown and duplicate routes', () => {
    const result = reconcileDashboardLayout({
      order: ['/convert', '/convert', '/not-a-page', '/remux', 7],
    });
    expect(result.order).toEqual(['/convert', '/remux', ...DEFAULT_DASHBOARD_ROUTES.filter((r) => !['/convert', '/remux'].includes(r))]);
  });

  it('keeps valid custom groups and drops invalid ones', () => {
    const result = reconcileDashboardLayout({
      customGroups: [
        { id: 'mine', name: '  My tools  ' },
        { id: 'mine', name: 'duplicate' },
        { id: FAVOURITES_GROUP_ID, name: 'not allowed' },
        { id: UNGROUPED_GROUP_ID, name: 'not allowed' },
        { id: '', name: 'empty id' },
        { id: 'nameless', name: '' },
        null,
        'bad',
      ],
    });
    expect(result.customGroups).toEqual([{ id: 'mine', name: 'My tools' }]);
  });

  it('caps the number of custom groups', () => {
    const groups = Array.from({ length: MAX_CUSTOM_GROUPS + 5 }, (_, index) => ({
      id: `group-${index}`,
      name: `Group ${index}`,
    }));
    expect(reconcileDashboardLayout({ customGroups: groups }).customGroups).toHaveLength(MAX_CUSTOM_GROUPS);
  });

  it('accepts assignments only to existing groups and unassigns the rest', () => {
    const result = reconcileDashboardLayout({
      customGroups: [{ id: 'mine', name: 'My tools' }],
      assignments: {
        '/convert': FAVOURITES_GROUP_ID,
        '/batch': 'mine',
        '/remux': 'deleted',
        '/demux': UNGROUPED_GROUP_ID,
        '/media-info': 5,
      },
    });
    expect(result.assignments['/convert']).toBe(FAVOURITES_GROUP_ID);
    expect(result.assignments['/batch']).toBe('mine');
    expect(result.assignments['/remux']).toBeNull();
    expect(result.assignments['/demux']).toBeNull();
    expect(result.assignments['/media-info']).toBeNull();
  });

  it('assigns every route in the reconciled order', () => {
    const result = reconcileDashboardLayout({ order: ['/convert'], assignments: { '/convert': FAVOURITES_GROUP_ID } });
    for (const route of result.order) {
      expect(Object.hasOwn(result.assignments, route)).toBe(true);
    }
  });
});

describe('reorderedRoutes', () => {
  it('moves the active route to the target position', () => {
    const order = ['a', 'b', 'c', 'd'];
    expect(reorderedRoutes(order, 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
    expect(reorderedRoutes(order, 'd', 'a')).toEqual(['d', 'a', 'b', 'c']);
    expect(order).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is a no-op for identical or unknown routes', () => {
    const order = ['a', 'b'];
    expect(reorderedRoutes(order, 'a', 'a')).toEqual(order);
    expect(reorderedRoutes(order, 'missing', 'a')).toEqual(order);
    expect(reorderedRoutes(order, 'a', 'missing')).toEqual(order);
  });
});
