# Dashboard Actions Row, Editable Cards & Quick Links Plan

## Goal

Enhance the `/` Dashboard page so that:

1. An **actions row** sits above the "Getting started" banner.
2. A single **icon-only ghost toggle button** switches the content area between the Dashboard card grid and the Quick Links panel. The **Edit** action is also icon-only and only visible while the Dashboard panel is active. Both buttons show tooltips, matching the ghost `IconButton` pattern used in BatchQueue.
3. In edit mode, feature cards can be **reordered by drag-and-drop** and **grouped** into a built-in **Favourites** group or user-created **custom groups**. Group-management controls remain edit-only, but saved group sections stay visible after Done instead of the layout appearing to reset.
4. The **Quick Links panel** lists links to app features inside the Dashboard page; the link list is initially empty and ready to be populated later.

## Decisions

| Topic | Decision | Rationale |
| --- | --- | --- |
| View switch | Local `DashboardView` state toggled by one tooltip-equipped ghost icon button; no route change | Only the content panel changes, so the welcome/logo container, banner and footer stay mounted. |
| Page chrome | Dashboard keeps the banner and swaps only the card grid for the Quick Links panel | Keeps `GettingStartedCard`, shortcuts and page identity unaffected. |
| Edit state | Local React state in `Dashboard`, reset to `false` on unmount / view change | Transient UI state; the layout itself is persisted immediately and its group sections remain visible after Done. |
| DnD | `@dnd-kit/core` + `@dnd-kit/sortable` (already installed and used by `BatchQueue` / `MuxQueuePanel`) | No new dependency; keyboard sensor gives accessible reordering. |
| Grouping model | Each route key belongs to at most one group: built-in `favourites`, a custom group id, or ungrouped | Avoids duplicate cards and ambiguous drag targets. Assignment is changed from a per-card menu. |
| Persistence | Zustand store persisted to `localStorage` under `encodex-dashboard-layout` via `loadJson` / `saveJson` | Same pattern as `settingsStore`, `termsStore`, `profileStore`; survives restarts without IPC. |
| Reconciliation | Pure helper merges persisted layout with the current `NAV_ITEMS` at read time | New/removed tools and deleted groups must never break the grid. |
| Quick Links data | `QUICK_LINKS: QuickLink[] = []` and `QUICK_LINK_CATEGORIES` in a constants file | "Populated later" — the UI scaffold and empty state ship now, data is a one-line addition later. |

Non-goals for this change: adding Quick Links to `AppDrawer`/`NAV_ITEMS`, drag-onto-group-header assignment (group changes happen via menu), renaming the built-in Favourites group, backend/IPC persistence.

## Data model

New types in `src/renderer/stores/types.ts` (no local types — `lint:types` rule):

```ts
export type DashboardGroupId = string;              // 'favourites' | custom uuid-like id
export interface DashboardCustomGroup {
  id: DashboardGroupId;
  name: string;                                     // user-authored, length-capped
}
export interface DashboardLayoutState {
  order: string[];                                  // route keys, canonical order
  assignments: Record<string, DashboardGroupId | null>; // route -> group (null = ungrouped)
  customGroups: DashboardCustomGroup[];             // display order
  reorder: (activeRoute: string, overRoute: string) => void;
  assignGroup: (route: string, groupId: DashboardGroupId | null) => void;
  createGroup: (name: string) => DashboardGroupId;
  renameGroup: (id: DashboardGroupId, name: string) => void;
  deleteGroup: (id: DashboardGroupId) => void;      // unassigns its cards
  resetLayout: () => void;
}
export interface QuickLink { to: string; labelKey: string; descriptionKey?: string; category: string; }
```

Constants in `src/renderer/constants/dashboard.ts` (new):

- `DASHBOARD_LAYOUT_STORAGE_KEY = 'encodex-dashboard-layout'`
- `FAVOURITES_GROUP_ID = 'favourites'`
- `DEFAULT_DASHBOARD_ROUTES` derived from the same filter as today's card grid (extracted so store and page cannot drift).
- `QUICK_LINKS` (empty array) and `QUICK_LINK_CATEGORIES` (`['all']` initially).

Pure helpers in `src/renderer/utils/dashboard-layout.ts` (new):

- `reconcileDashboardLayout(raw: unknown): PersistedLayout` — validates shape, drops unknown routes, appends new routes in canonical order, drops assignments to missing groups, de-dupes, caps custom group count/name length; falls back to defaults on any malformed input.
- `reorderedRoutes(order: string[], activeRoute: string, overRoute: string): string[]` — wraps `arrayMove` logic as a pure, unit-testable helper.
- `normalizeGroupName(name: string): string` — trim + length cap.

## UI structure

### Actions row (shared component)

`src/renderer/components/DashboardActionsRow.tsx` + `src/renderer/styles/DashboardActionsRow.styles.ts` (new):

```
┌──────────────────────────────────────────────────────────┐
│                                   [ ⇄ ]       [ ✎ ]     │
└──────────────────────────────────────────────────────────┘
```

- Props: `view: 'dashboard' | 'quick-links'`, `onToggleView: () => void`, optional `editing: boolean`, optional `onToggleEdit: () => void`.
- One ghost (unbordered) `IconButton` toggles local panel state; its tooltip and `aria-label` name the destination panel and it records `dashboard_view_changed`.
- Ghost icon-only Edit/Done `IconButton` rendered only when `view === 'dashboard'`, with a matching tooltip; edit mode works regardless of onboarding state.
- Responsive: wrap onto two lines on `xs`, right-align the Edit button, respect theme spacing/shape, no inline styles or raw px/colors (custom styled props prefixed `$` and filtered with `shouldForwardProp`).

### Dashboard view (`src/renderer/pages/Dashboard.tsx`)

Render order: `WelcomeTitle` → `DashboardSubtitle` → **`<DashboardActionsRow view="dashboard" … />`** → `GettingStartedCard` → (edit-mode group bar) → `FeatureGrid` → footer.

- Extract the current card filter/title/description mapping into small local helpers so both normal and edit rendering share one card list.
- Non-edit mode: card click and hotkeys (`1`–`8`) behave exactly as today.
- Edit mode:
  - `CardLink` becomes non-navigating (`disabled` prop) so drags cannot trigger navigation.
  - Each `FeatureGridItem` wraps a `useSortable`-based `SortableFeatureCard`; `DndContext` + `SortableContext` (`rectSortingStrategy`) + `DragOverlay` wrap the grid.
  - Sensors: `PointerSensor` with `activationConstraint: { distance: 6 }`, `KeyboardSensor` with `sortableKeyboardCoordinates`; `closestCenter` collision detection.
  - `faGripVertical` drag handle `IconButton` with `aria-label={t('dashboard.edit.dragHandle', { title })}`; dragging state gets a raised/accent style in the styles file; overlay mirrors the card.
  - `onDragEnd` → `reorder(active.data.current.route, over.data.current.route)` via the store; no-op when `over` is null or identical; record analytics.
  - Drag handles are keyboard reachable and the grid keeps DOM order == visual order.

### Grouping UI (edit mode only)

- A `GroupBar` above the grid: chips for **Favourites** (built-in) → custom groups in order → `+ New group` button; each custom chip opens a `Menu` with Rename / Delete (delete confirms via existing dialog pattern if available, otherwise inline menu action + toast).
- A `Reset layout` button restores defaults (also clears groups and assignments).
- Each card shows a `GroupMenuButton` (`IconButton` + `Menu`) listing: **Favourites**, **Ungrouped**, every custom group, and **New group…**.
  - Selecting `New group…` opens a small `Dialog` with a `TextField`; on save, create the group and assign the card to it.
- Rendering: group sections in order `Favourites` → custom groups → `Ungrouped` ("All tools"), each with a `GroupHeader` (label + count) and its cards in `order`. Only the edit bar/handles are edit-only; saved group sections also render outside edit mode. When no card has a saved group, fall back to the current flat grid so first-run visuals do not change.
- Group labels for built-ins come from i18n; custom group names are user text (never sent to analytics).

### Quick Links panel (new)

- `src/renderer/components/QuickLinksPanel.tsx` + `src/renderer/styles/QuickLinks.styles.ts`.
- Rendered in place of the card grid when `view === 'quick-links'`; the welcome/logo container, getting-started banner and footer remain mounted.
- Body: MUI `Tabs` + `Tab` per `QUICK_LINK_CATEGORIES`, active category held in local state, tab change records `quick_links_tab_viewed`.
- Content: `QUICK_LINKS.filter(link => category === 'all' || link.category === category)` rendered as a responsive grid of cards (icon/title/description/navigate), each analytics `dashboard_card_clicked`-style `quick_link_clicked`.
- Because `QUICK_LINKS` is empty, render a themed empty state (`quickLinks.empty` copy) so the panel is not blank; adding entries later needs no component changes.
- No `/quick-links` route, page skeleton, or drawer entry is added; `NAV_ITEMS` stays untouched.

## Analytics

Add to `src/shared/analytics/types.ts` (payload map) and `src/shared/analytics/events.ts` (`ANALYTICS_EVENT_GROUP`, all `'nav'` or `'ux'`):

- `dashboard_view_changed` `{ route: 'dashboard' | 'quick-links' }`
- `dashboard_edit_toggled` `{ enabled: boolean }`
- `dashboard_card_reordered` `{ route: string; groupId: string | 'ungrouped' }`
- `dashboard_group_created` `{ groupCount: number }`
- `dashboard_group_assigned` `{ groupKind: 'favourites' | 'custom' | 'ungrouped' }`
- `quick_links_tab_viewed` `{ category: string }`
- `quick_link_clicked` `{ route: string }`

Categorical payloads only — no group names or personal data (taxonomy privacy contract).

## i18n

Add keys under `dashboard` (`actions.dashboard`, `actions.quickLinks`, `edit`, `done`, `resetLayout`, `editHint`, `dragHandle`, `group`, `ungrouped`, `newGroup`, `groupName`, `create`, `rename`, `delete`, `groups.favourites`, `groups.ungrouped`) and a new `quickLinks` namespace (`title`, `tabs.all`, `empty`, `cardAria`) to **all 56** locale files, using the en-US string as fallback in non-English locales per existing convention. Run `npm run validate:locales`.

## Files touched

| Area | File |
| --- | --- |
| Plan | `plans/DASHBOARD_ACTIONS_AND_QUICK_LINKS_PLAN.md` (this file) |
| Constants | `src/renderer/constants/dashboard.ts` (new) |
| Store | `src/renderer/stores/dashboardLayoutStore.ts` (new), `src/renderer/stores/types.ts` |
| Utils | `src/renderer/utils/dashboard-layout.ts` (new) |
| Component | `src/renderer/components/DashboardActionsRow.tsx` (new), `src/renderer/components/QuickLinksPanel.tsx` (new) |
| Styles | `src/renderer/styles/DashboardActionsRow.styles.ts` (new), `src/renderer/styles/Dashboard.styles.ts`, `src/renderer/styles/QuickLinks.styles.ts` (new) |
| Pages | `src/renderer/pages/Dashboard.tsx` |
| Routing | Unchanged (no new route) |
| Analytics | `src/shared/analytics/events.ts`, `src/shared/analytics/types.ts` |
| i18n | `src/renderer/i18n/locales/*.json` (56 files) |
| Tests | `src/renderer/pages/__tests__/Dashboard.test.tsx`, new `QuickLinksPanel.test.tsx`, new `DashboardActionsRow.test.tsx`, new `dashboardLayoutStore.test.ts`, new `dashboard-layout.test.ts`, `e2e/specs/dashboard.spec.ts` |

## Checkpoints

Status legend: `[ ]` pending, `[x]` done.

- [x] C0. Create this plan document.
- [x] C1. Extract canonical dashboard route list and quick-links data/category constants; pure `dashboard-layout` helpers with unit tests.
- [x] C2. Add persisted `dashboardLayoutStore` (reorder/assign/create/rename/delete/reset) with store tests.
- [x] C3. Add tooltip-equipped ghost icon-only `DashboardActionsRow` above `GettingStartedCard`; verify the toggle switches panels in place.
- [x] C4. Build `QuickLinksPanel` with empty state and tab scaffold; panel tests.
- [x] C5. Add edit mode: dnd-kit context, sortable cards, keyboard + pointer sensors, drag handle, overlay, reorder persistence; update Dashboard tests.
- [x] C6. Add grouping UI: edit-only group bar, per-card group menu, create/rename/delete dialogs, grouped sections persisted after Done, reset; store + component tests.
- [x] C7. Wire analytics taxonomy and event calls; verify consent-gated facade usage and no personal data in payloads.
- [x] C8. Propagate new i18n keys to all locales; run `npm run validate:locales` and `npm run test:locale-matrix`.
- [x] C9. Update E2E dashboard spec: ghost icon-only actions with tooltips, in-place panel toggle, edit-only grouping controls, saved groups still visible after Done. Route-list/a11y fixtures keep the original 14 routes. Reorder and group assignment are covered by store/Dashboard unit tests.
- [x] C10. Verify: `npm test`, `npm run lint`, `npm run lint:px`, `npm run lint:colors`, `npm run lint:rem`, `npm run lint:inline-styles`, `npm run lint:strings`, `npm run lint:types`, `npm run typecheck`, `npm run format:check`.

## Verification notes

- Existing Dashboard tests assert the exact card set, navigation, hotkeys and footer; they must all still pass unchanged except for new assertions.
- `test:axe-all-pages` / `i18n-matrix` / `rtl-direction` fixtures enumerate the original 14 routes — no new route was added.
- `no-dom-prop-leak` style test: all new styled-component props must use the `$` prefix or be filtered by `shouldForwardProp`.
- Manual smoke: reorder with mouse and keyboard, group a card as Favourite, leave edit mode and confirm the group section remains, create a custom group and move a card into it, delete it, reload the app to confirm persistence, switch to Quick Links and back, run with a hostile/absent `localStorage` payload to confirm safe fallback.
