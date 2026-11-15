# Settings Tabs Restructure Plan

**Status:** IMPLEMENTED - all phases verified; commit not created yet.
**Branch suggestion:** `refactor/settings-tabs`
**Scope:** `src/renderer/pages/Settings.tsx`, `src/renderer/components/settings/**`,
`src/renderer/styles/Settings.styles.ts`, `src/renderer/types.ts`, settings tests,
locale files, renderer docs.

**Goal:** Turn the single long Settings page into a tabbed page:
**General - Advanced - AI**. Group every existing control under the
right tab, preserve all existing behavior (store sync, IPC, analytics,
deep-link from Copilot / Getting Started), and keep the page accessible,
responsive, localized, and fully tested.

**Legend:** `[ ]` not started - `[~]` in progress - `[x]` done - `[-]` skipped
- `[!]` blocked - `[?]` needs decision.

---

## Progress tracker

| Phase | Status | Checkpoint | Verified |
|---|---|---|---|
| 0. Inventory + decisions | `[x]` | This document; all open questions confirmed | Read Settings page, sections, tests, styles, i18n, docs |
| 1. Types + i18n keys + analytics event + sync | `[x]` | `validate:locales`, `validate:locale-usage`, `analytics:schema-check` green | All 56 locales synced; schema snapshot at 129 events |
| 2. Tab styles (`SettingsTabs`, `SettingsTabPanel`) | `[x]` | `lint`, `lint:rem`, `lint:px`, `lint:colors` green | Includes the mandatory `&[hidden]` rule |
| 3. Extract `GeneralSettingsTab` / `AdvancedSettingsTab` / `AiSettingsTab` | `[x]` | `typecheck:renderer` green; page behavior unchanged | Extraction matches the previous section order and ids |
| 4. Rewire `Settings.tsx` shell + deep link | `[x]` | Manual smoke: all three tabs, deep link opens AI tab + editor | Deep link, second navigation, and analytics guard covered by tests |
| 5. Page test migration + new tab tests | `[x]` | `npx vitest run src/renderer/pages/__tests__/Settings.test.tsx` green | 103 tests pass, including 3-tab axe |
| 6. Cross-suite coverage (axe, i18n matrix, longest-string, keyboard) | `[x]` | `test:a11y`, `test:locale-matrix`, targeted unit suites green | 7 a11y + 72 locale-matrix tests pass |
| 7. Docs | `[x]` | `npm run doc:drift` green | Features, renderer architecture, MCP/CLI, drift markers |
| 8. Full verification (commit pending request) | `[x]` | `typecheck`, `lint*`, `format:check`, `analytics:schema-check`, `test:unit` green | 360 files / 5361 tests pass |

---

## 1. Current state (verified)

`src/renderer/pages/Settings.tsx` (190 lines) renders, top to bottom:

1. `ThemeSettingsSection` (theme cards)
2. Always on top switch
3. Launch at startup switch
4. Desktop notifications switch
5. Usage data & error reporting switch (telemetry)
6. `McpSettingsSection` (enable, port, token, endpoint/auth details)
7. `AiProviderSettingsSection` with `autoOpen` from location state (line 136)
8. Hardware acceleration switch
9. Conditional acceleration mode select
10. Conditional encoder type select

Relevant facts:

- Every value except AI/MCP is bound to `useSettingsStore`; the page makes no
  direct IPC calls. `McpSettingsSection` and `AiProviderSettingsSection` call
  their `mcp-*` / `ai-*` bridges themselves.
- `SettingsLocationState` is `{ openAiProvider?: boolean }`
  (`src/renderer/types.ts:76-79`). Copilot and Getting Started navigate with
  `state: { openAiProvider: true }` to open the collapsed AI editor and scroll
  it into view.
- `Settings.styles.ts` owns `SettingsRoot`, `SettingsHeader`, `SettingsTitle`,
  `SettingsSection`, `SettingsLabel`, `SettingsLabelRow`, `ModeSelect`,
  `McpField`, `McpValueRow`, `ModeSettingsSection`.
- A contrast-safe tab pattern already exists: `QueueTabs` in
  `src/renderer/styles/BatchQueue.styles.ts:189-213` (selected =
  `text.primary`, unselected = `text.secondary`, `opacity: 1`,
  `textTransform: none`) plus a `Tab` + `data-testid` usage in
  `BatchQueue.tsx:1379-1406`.
- `InfoTooltip` renders `role="button"` with `aria-label={title}` and
  `data-testid="info-tooltip"` - so tooltips can be queried by their hint text
  instead of by index.
- `src/renderer/pages/__tests__/Settings.test.tsx` has 92 `it(...)` blocks and
  renders the whole page for every interaction. Six tests depend on tooltip
  **index** (lines 203-223, 277, 539, 578); the rest assume all sections are
  visible at once.
- All 56 locale files currently have exact `settings.*` key parity (verified).
- New UI strings must be added to `en-US.json` first, then
  `npm run sync:locales` backfills the other 55 (English placeholder), then
  `npm run validate:locales` enforces parity.

---

## 2. Decisions (locked for v1)

| # | Decision | Rationale |
|---|---|---|
| D1 | Three tabs with plain labels: `General`, `Advanced`, `AI` | Confirmed with product; no numeric prefixes. |
| D2 | **General** = Theme, Always on top, Launch at startup, Desktop notifications | Everyday appearance + app behavior. |
| D3 | **Advanced** = Hardware acceleration (+ mode/encoder), Usage data & error reporting | Performance and privacy/diagnostics. |
| D4 | **AI** = AI provider editor, MCP server | Both are AI surfaces: the Copilot provider and the server external AI assistants connect to. MCP stays self-labelled so it is still discoverable. |
| D5 | Default tab is **General**; the selected tab is not persisted | Predictable landing; deep link still overrides. Persisting the tab is a separate follow-up. |
| D6 | Use MUI's canonical mounted-panel pattern: all three panels stay mounted, inactive ones get `hidden` | Preserves MCP port/token drafts and the AI editor's open state across tab switches, avoids remount IPC, and keeps hidden panels out of the a11y tree. |
| D7 | No sub-group headings inside tabs in v1 | The tabs already group; sections are self-labelled cards. Confirmed with product. |
| D8 | Track tab views with one new `settings_tab_viewed` event (`{ tab }`) | Confirmed with product. Emitted only on user-initiated tab changes (not the initial render or the deep-link effect), so it never double-counts. |
| D9 | Reuse the `QueueTabs` contrast overrides (copy, do not import BatchQueue styles) | Avoids the MUI primary tint that fails the 4.5:1 axe contrast gate; keeps this change scoped. |

> Confirmed: MCP lives in **AI**. If that ever changes, move the one
> `<McpSettingsSection />` render line from `AiSettingsTab` to
> `AdvancedSettingsTab`; nothing else changes.

---

## 3. Target information architecture

| Current control | Tab | Owner after refactor | State / bridge | Test id (unchanged) |
|---|---|---|---|---|
| Theme cards | General | `GeneralSettingsTab` -> `ThemeSettingsSection` | `useColorMode` | theme buttons |
| Always on top | General | `GeneralSettingsTab` | `settingsStore.alwaysOnTop` | `settings-always-on-top` |
| Launch at startup | General | `GeneralSettingsTab` | `settingsStore.launchAtLogin` | `settings-launch-at-login` |
| Desktop notifications | General | `GeneralSettingsTab` | `settingsStore.desktopNotificationsEnabled` | `settings-desktop-notifications` |
| Usage data & error reporting | Advanced | `AdvancedSettingsTab` | `settingsStore.monitoringEnabled` | `settings-monitoring-error-reporting` |
| Hardware acceleration | Advanced | `AdvancedSettingsTab` | `settingsStore.hardwareAcceleration` | `settings-hardware-acceleration` |
| Acceleration mode (conditional) | Advanced | `AdvancedSettingsTab` | `settingsStore.hwaccelMode` | `settings-hwaccel-mode` |
| Encoder type (conditional) | Advanced | `AdvancedSettingsTab` | `settingsStore.encoderType` | `settings-encoder-type` |
| AI provider editor | AI | `AiSettingsTab` -> `AiProviderSettingsSection` | `ai-*` bridge | `settings-ai-toggle`, `settings-ai` |
| MCP server | AI | `AiSettingsTab` -> `McpSettingsSection` | `mcp-*` bridge / store | `settings-mcp-server` + existing MCP ids |

Keep every existing `data-testid`, `aria-label`, and translation key exactly as
is. The only new ids are on the tab strip / panels.

---

## 4. Files and changes

### 4.1 `src/renderer/types.ts`
- [ ] Add exported type next to `SettingsLocationState`:
  ```ts
  /**
   * The Settings page tabs. `general` is the default; `ai` is selected when a
   * caller deep-links to the AI-provider editor.
   */
  export type SettingsTab = 'general' | 'advanced' | 'ai';
  ```
  Must live here, not in `Settings.tsx`, because `lint:types`
  (`no-local-types`) forbids local type declarations in components.

### 4.2 `src/renderer/i18n/locales/en-US.json`
- [ ] Add under `settings` (next to `title`/`theme`):
  ```json
  "tabs": {
    "ariaLabel": "Settings sections",
    "general": "General",
    "advanced": "Advanced",
    "ai": "AI"
  }
  ```
- [ ] Run `npm run sync:locales` (backfills all 56 locales with English
  placeholders; never overwrites existing translations).
- [ ] Run `npm run validate:locales` and `npm run validate:locale-usage`.
- [-] Sub-group headings: rejected for v1 (tabs only), so no `settings.groups.*`
  keys are added.

### 4.3 `src/renderer/styles/Settings.styles.ts`
- [ ] Import `Tabs` from `@mui/material`.
- [ ] Add `SettingsTabs` mirroring the `QueueTabs` contrast-safe recipe:
  ```ts
  export const SettingsTabs = styled(Tabs)(({ theme }) => ({
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&&& .MuiTab-root': {
      minWidth: theme.typography.pxToRem(132),
      whiteSpace: 'nowrap',
      opacity: 1,
      color: theme.palette.text.secondary,
      textTransform: 'none',
    },
    '&&& .MuiTab-root.Mui-selected': {
      color: theme.palette.text.primary,
      fontWeight: theme.typography.fontWeightBold,
    },
  }));
  ```
- [ ] Add `SettingsTabPanel`:
  ```ts
  export const SettingsTabPanel = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(2),
    // The `display: flex` above would otherwise beat the UA
    // `[hidden] { display: none }` rule and keep inactive panels visible.
    '&[hidden]': { display: 'none' },
  }));
  ```
  The `&[hidden]` rule is mandatory, not cosmetic.
- [ ] Add JSDoc on both exports (repo convention on every exported symbol).
- [ ] Do not use hard-coded px/rem/colors (custom lint rules).

### 4.4 New tab content components
- [ ] `src/renderer/components/settings/GeneralSettingsTab.tsx`
  - Move the theme section and the three General `SettingsSection`/`ToggleRow`
    blocks out of `Settings.tsx`.
  - Move the two analytics events (`always_on_top_toggled`,
    `launch_at_login_toggled`) unchanged.
  - Keep `SettingLabel`, switch `aria-label`s, and `data-testid`s.
- [ ] `src/renderer/components/settings/AdvancedSettingsTab.tsx`
  - Move the hardware-acceleration switch, conditional mode select, conditional
    encoder select, and the telemetry switch.
  - Move `hwaccelModeLabel`, `HWACCEL_MODES`, `ENCODER_TYPES`,
    `encoderTypeLabel`, and the `encoder_type_changed` event unchanged.
  - `telemetry` stays bound to `monitoringEnabled` / `setTelemetryEnabled`
    exactly as today (including the current test id).
- [ ] `src/renderer/components/settings/AiSettingsTab.tsx`
  ```tsx
  export default function AiSettingsTab({ autoOpen = false }: { autoOpen?: boolean }) {
    return (
      <>
        <AiProviderSettingsSection autoOpen={autoOpen} />
        <McpSettingsSection />
      </>
    );
  }
  ```
  Add a brief JSDoc explaining the ordering (provider first, then the MCP
  server external assistants use).
- [ ] Do not add local `interface`/`type` declarations in these files
  (`lint:types`); use inline prop annotations like the existing components.

### 4.5 `src/renderer/pages/Settings.tsx` (shell)
- [ ] Keep `SettingsRoot`, `SettingsHeader`, `SettingsTitle`, `pageIcons`.
- [ ] Remove all store selectors, section imports, hwaccel constants, and
  analytics imports - they now live in the tab components.
- [ ] Add:
  ```tsx
  const state = location.state as SettingsLocationState | null;
  const wantsAi = state?.openAiProvider === true;
  const [tab, setTab] = useState<SettingsTab>(wantsAi ? 'ai' : 'general');
  const [aiReveal, setAiReveal] = useState(wantsAi);

  useEffect(() => {
    if (!wantsAi) return;
    setTab('ai');
    setAiReveal(true);
  }, [location.key, wantsAi]);
  ```
- [ ] Import `recordAnalyticsEvent` and `createAnalyticsEvent`, and add a
  guarded change handler so a no-op click cannot emit a duplicate event:
  ```tsx
  const handleTabChange = (next: SettingsTab): void => {
    if (next === tab) return;
    setTab(next);
    recordAnalyticsEvent(createAnalyticsEvent('settings_tab_viewed', { tab: next }));
  };
  ```
  Do not emit for the initial render or the deep-link effect.
- [ ] Render the tab strip:
  ```tsx
  <SettingsTabs
    value={tab}
    onChange={(_event, next: SettingsTab) => handleTabChange(next)}
    aria-label={t('settings.tabs.ariaLabel')}
    variant="scrollable"
    scrollButtons="auto"
    allowScrollButtonsMobile
    data-testid="settings-tabs"
  >
    <Tab value="general" label={t('settings.tabs.general')} id="settings-tab-general"
         aria-controls="settings-tabpanel-general" data-testid="settings-tab-general" />
    <Tab value="advanced" label={t('settings.tabs.advanced')} id="settings-tab-advanced"
         aria-controls="settings-tabpanel-advanced" data-testid="settings-tab-advanced" />
    <Tab value="ai" label={t('settings.tabs.ai')} id="settings-tab-ai"
         aria-controls="settings-tabpanel-ai" data-testid="settings-tab-ai" />
  </SettingsTabs>
  ```
- [ ] Render three mounted panels (MUI canonical pattern):
  ```tsx
  <SettingsTabPanel role="tabpanel" hidden={tab !== 'general'}
    id="settings-tabpanel-general" aria-labelledby="settings-tab-general"
    data-testid="settings-tabpanel-general">
    <GeneralSettingsTab />
  </SettingsTabPanel>
  <SettingsTabPanel role="tabpanel" hidden={tab !== 'advanced'} ... >
    <AdvancedSettingsTab />
  </SettingsTabPanel>
  <SettingsTabPanel role="tabpanel" hidden={tab !== 'ai'} ... >
    <AiSettingsTab autoOpen={aiReveal} />
  </SettingsTabPanel>
  ```
- [ ] Add `tabIndex={0}` on the active panel only (or on all panels; MUI's
  example uses `tabIndex={0}` unconditionally - pick one and test). Recommended:
  `tabIndex={0}` on each panel; `hidden` removes inactive panels from the tab
  order anyway.
- [ ] Update the file-level JSDoc: the page is now a thin shell that owns the
  tab state and the AI deep link; section behavior lives in
  `components/settings/*Tab.tsx`.

**Deep-link behavior spec**

| Entry | Result |
|---|---|
| `/settings` (no state) | General tab selected. |
| `/settings` with `{ openAiProvider: true }` on first mount | AI tab selected, editor open, section scrolled into view. |
| Already on `/settings`, navigate again with `{ openAiProvider: true }` | `location.key` changes, effect selects AI tab and reveals editor. |
| Deep-linked, user switches to General, then back to AI | AI panel was kept mounted, so the editor stays open. |
| User manually clicks the AI tab (no deep link) | AI tab selected, editor stays collapsed behind its existing toggle. |

`aiReveal` deliberately never resets within the page instance; this avoids
closing the editor the user just asked to see.

### 4.6 Analytics taxonomy + schema
- [ ] `src/shared/analytics/types.ts`: add `settings_tab_viewed` to
  `AnalyticsEventName` and `{ tab: string }` to `AnalyticsEventPayloadMap`.
- [ ] `src/shared/analytics/events.ts`: add
  `settings_tab_viewed: 'settings'` to `ANALYTICS_EVENT_GROUP` and
  `settings_tab_viewed: 'v2'` to `ANALYTICS_EVENT_TIER`.
- [ ] `docs/ANALYTICS.md`: add `settings_tab_viewed` to the `settings` group row.
- [ ] Regenerate the committed schema snapshot:
  `npm run analytics:schema-check -- --write`.
- [ ] Run `npm run analytics:schema-check`.
- [ ] Keep the event name literal in `Settings.tsx`
  (`createAnalyticsEvent('settings_tab_viewed', ...)`) so the
  wiring-completeness test (`AnalyticsWiring.test.ts`) finds the call site.

### 4.7 Styles cleanup
- [ ] Confirm `SettingsSection`, `SettingsLabel`, `ModeSelect`, `McpField`,
  `McpValueRow`, `ModeSettingsSection` are still used after the move.
- [ ] Remove any import that becomes unused; `lint:unused` must stay green.
- [ ] Do not delete `SettingsLabelRow` (used by `SettingLabel`).

---

## 5. Test plan

### 5.1 Split and migrate `src/renderer/pages/__tests__/Settings.test.tsx`
Recommended structure (mechanical move first, behavior second):

- [ ] `describe('Settings - tabs')`: shell, labels, selection, keyboard,
  deep link, panel visibility.
- [ ] `describe('Settings - General')`: theme + three switches + tooltips.
- [ ] `describe('Settings - Advanced')`: hwaccel, mode, encoder, telemetry.
- [ ] `describe('Settings - AI and MCP')`: current AI + MCP tests.

Helpers:

```ts
const openTab = (tab: 'general' | 'advanced' | 'ai') =>
  fireEvent.click(screen.getByTestId(`settings-tab-${tab}`));
const renderGeneral = () => renderSettings();
const renderAdvanced = () => { const r = renderSettings(); openTab('advanced'); return r; };
const renderAi = () => { const r = renderSettings(); openTab('ai'); return r; };
```

- [ ] Replace `renderSettings()` with `renderAdvanced()` / `renderAi()` in the
  matching describes. Keep `renderSettings()` for General and the tab shell.
- [ ] Replace index-based tooltip tests with label-based queries:
  ```ts
  fireEvent.mouseEnter(screen.getByRole('button', { name: 'settings.mcpServerHint' }));
  ```
  This removes the `getAllByTestId('info-tooltip')[n]` fragility entirely.
- [ ] Replace the "8 tooltips" assertion with per-tab counts:
  General 3, Advanced 4 (hwaccel on), Advanced 1 (hwaccel off), AI 1 (MCP).
- [ ] Because panels stay mounted, add explicit visibility assertions so a
  hidden panel cannot silently satisfy a test:
  - General active: `expect(screen.getByTestId('settings-tabpanel-advanced')).not.toBeVisible()`.
  - After `openTab('advanced')`: Advanced visible, General not visible.
  - Prefer `getByRole` for controls where possible (role queries exclude hidden
    subtrees).

### 5.2 New tab tests
- [ ] Tab labels render as `settings.tabs.general` / `.advanced` / `.ai`
  (the test i18n mock returns keys).
- [ ] General is selected and its panel visible by default; the other two
  panels are hidden.
- [ ] Clicking each tab reveals only that panel and updates
  `aria-selected` / `tabindex`.
- [ ] Tablist `aria-label` is `settings.tabs.ariaLabel`.
- [ ] Panel ids match `aria-controls` / `aria-labelledby`.
- [ ] Keyboard `ArrowRight` / `ArrowLeft` / `Home` / `End` move selection
  (use `userEvent`, not `fireEvent`).
- [ ] Deep link: render with `{ openAiProvider: true }`; assert
  `settings-tab-ai` is selected, `settings-ai` exists, `scrollIntoView` was
  called, and General content is not visible.
- [ ] Second navigation with `openAiProvider` while mounted selects the AI tab
  (render a small router harness that rerenders with new location state).
- [ ] Store-backed toggle survives a tab round-trip: toggle Always on top,
  open Advanced, return to General, still checked.
- [ ] MCP draft commit on tab switch: type a port, click the General tab, and
  assert the port committed to the store (blur fires before unmount/click).
  If this is flaky in jsdom, keep the mounted-panel decision (D6) and assert
  the value survives instead.
- [ ] Analytics: partial-mock `AnalyticsService`, switch tabs, and assert
  exactly one `settings_tab_viewed` event per real change with `props.tab`;
  assert no event on initial render, none when clicking the already-selected
  tab, and none for the deep-link auto-selection.
- [ ] Axe: run `assertNoAxeViolations(container)` once per tab (3 cases), not
  just on the default tab.

### 5.3 Existing AI tests
- [ ] "keeps the AI provider editor collapsed until the toggle is clicked"
  -> open the AI tab first; the editor stays collapsed because `autoOpen` is
  false. The background `aiGetSettings` call still happens on mount because the
  panel is mounted (D6), so the existing wait stays valid.
- [ ] All AI tests that use `getByRole` / `findByRole` (combobox, textbox,
  spinbutton) must open the AI tab first; `getByTestId`-only tests still pass
  but should also open the tab for realism.
- [ ] Deep-link test: keep `scrollIntoView` stubbing; add the selected-tab
  assertion.
- [ ] `settings-ai-toggle`, `settings-ai`, `settings-ai-*` ids are unchanged.

### 5.4 Cross-suite coverage
- [ ] `src/renderer/__tests__/axe-all-pages.test.tsx`
  - Settings currently scans only the General tab. Add a Settings-specific
    helper that clicks each `settings-tab-*` and runs axe for
    Advanced and AI in light/dark at 320/768/1440. Add the same for the browser
    tier in `e2e/specs/a11y.spec.ts` (`/settings` route).
- [ ] `src/renderer/__tests__/i18n-matrix.test.tsx`
  - Add a route-tab map (`Settings: ['advanced', 'ai']`) and, after rendering
    Settings for each locale, click each extra tab and re-run the
    raw-token / leaked-key / pageerror assertions. This guarantees the new
    `settings.tabs.*` keys and the AI/MCP strings render in all 56 locales.
- [ ] `src/renderer/__tests__/longest-string.test.tsx`
  - Same route-tab extension for `de-DE` and `xx-XX` (pseudo-locale), to catch
    clipped/overflowing tab labels under 3x strings.
- [ ] `src/renderer/__tests__/keyboard-smoke.test.tsx`
  - Inactive panels are `hidden`, so only the active tab's controls are
    focusable. Keep the existing mirror logic; add an explicit probe that
    ArrowRight moves selection and the newly visible panel's first control is
    reachable.
- [ ] `src/renderer/pages/__tests__/strict-mode.test.tsx`
  - No code change expected; verify Settings still mounts clean under
    StrictMode (the tab state initializer must be pure).
- [ ] `src/renderer/__tests__/route-change-stress.test.tsx`
  - No change expected; verify the extra tab effects do not leak on remount.
- [ ] `src/renderer/__tests__/Copilot.test.tsx` / `GettingStartedCard.test.tsx`
  - They assert navigation state only; verify they still pass after the
    Settings change.

### 5.5 Setup mocks
- [ ] No new bridge mocks needed: `AiProviderSettingsSection` already tolerates
  a missing/rejecting bridge, and MCP reads from the store/mocked electron API.
- [ ] `scrollIntoView` is already stubbed in the relevant page-render harnesses.

---

## 6. Implementation order (each checkpoint must be green before moving on)

1. [ ] Add `SettingsTab` type, i18n keys (run locale sync/validation), and the
   `settings_tab_viewed` analytics taxonomy + schema snapshot.
2. [ ] Add `SettingsTabs` / `SettingsTabPanel` styles (including
   `&[hidden] { display: none }`).
3. [ ] Extract the three tab components; keep `Settings.tsx` rendering them in
   the existing order first (no tab strip yet) and run the existing test suite
   to prove the extraction is behavior-neutral.
4. [ ] Add the tab strip + `hidden` panels + deep-link effect + the guarded
   `settings_tab_viewed` emission in `Settings.tsx`; update the file JSDoc.
5. [ ] Migrate tests mechanically into the four describes; replace tooltip
   index queries; add tab tests.
6. [ ] Extend axe / i18n-matrix / longest-string / keyboard coverage.
7. [ ] Update docs:
   - [ ] `docs/FEATURES.md` Settings section: describe the three tabs.
   - [ ] `docs/ARCHITECTURE_RENDERER.md` Settings route row: tabbed layout.
   - [ ] `docs/MCP.md` "Enable it in **Settings**" -> "**Settings -> AI**".
   - [ ] `npm run doc:drift` / `doc:drift:strict` if applicable.
8. [ ] Full verification:
   - [ ] `npm run typecheck`
   - [ ] `npm run lint`
   - [ ] `npm run lint:unused`
   - [ ] `npm run lint:colors`
   - [ ] `npm run lint:rem`
   - [ ] `npm run lint:px`
   - [ ] `npm run lint:strings`
   - [ ] `npm run validate:locales`
   - [ ] `npm run validate:locale-usage`
   - [ ] `npm run analytics:schema-check`
   - [ ] `npx vitest run src/renderer/pages/__tests__/Settings.test.tsx`
   - [ ] `npm run test:a11y`
   - [ ] `npm run test:locale-matrix`
   - [ ] `npm run test:unit`
   - [ ] `npm run format:check`
   - [ ] Optional browser tier: `npm run test:e2e -- a11y focus-order`
9. [ ] Commit on `refactor/settings-tabs` with a conventional message, e.g.
   `refactor(settings): split settings into general, advanced, and ai tabs`.

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `styled(Box)` `display: flex` overrides `[hidden]`, so inactive panels stay visible | Add `'&[hidden]': { display: 'none' }` and assert `not.toBeVisible()` in tests. |
| Hidden panels remain in the DOM, so `getByTestId` can find them | Prefer `getByRole` (excludes hidden), and assert visibility; keep ids stable for existing tests. |
| i18n parity breaks across 56 locales | `sync:locales` then `validate:locales` + `validate:locale-usage`; extend the locale matrix. |
| Tooltip index tests break when sections move | Replace all index lookups with `getByRole('button', { name: '<hint key>' })`. |
| Deep link fails when the page is already mounted | Effect keyed on `location.key` and `wantsAi`; add a rerender test. |
| Draft state lost on tab switch | D6 keeps panels mounted; add the MCP draft test. |
| Selected-tab contrast fails axe | Reuse the `QueueTabs` text-colour overrides; per-tab axe tests. |
| 320px tab strip overflows | `variant="scrollable"` + `scrollButtons="auto"` + `allowScrollButtonsMobile`; axe matrix at 320. |
| Keyboard smoke/focus order changes | Inactive panels are hidden, so focus order is unchanged for the active tab; add the tab-strip keyboard probe. |
| Analytics schema drifts from the committed snapshot | Update `types.ts`, `events.ts`, and `docs/ANALYTICS.md` together, then regenerate with `analytics:schema-check -- --write`. |

---

## 8. Definition of done

- [ ] Settings shows three tabs in the requested order; General is the default.
- [ ] General contains only theme + always-on-top + launch-at-login +
  desktop notifications.
- [ ] Advanced contains only hardware acceleration (+ conditional mode/encoder)
  + usage data & error reporting.
- [ ] AI contains the AI provider editor + MCP server.
- [ ] Every existing persisted setting, bridge call, analytics event,
  translation key, and `data-testid` is unchanged.
- [ ] `settings_tab_viewed` is emitted once per user-initiated tab change with
  the correct `tab`, and the analytics schema snapshot is regenerated.
- [ ] Deep link from Copilot / Getting Started selects the AI tab, opens the
  editor, and scrolls it into view.
- [ ] All three tabs pass axe at 320/768/1440 in light and dark.
- [ ] All 56 locales validate and render the new tab labels.
- [ ] Typecheck, all lint gates, format check, and the full unit suite pass.

---

## 9. Confirmed answers (2026-11-15)

1. **MCP placement:** **AI** tab. Moving it later is one render line.
2. **Tab labels:** **plain** `General`, `Advanced`, `AI`; no numeric prefixes.
3. **Persist last tab:** **no**; General is the default. The deep link still
   selects AI.
4. **Sub-group headings inside tabs:** **none** in v1.
5. **Tab-view analytics:** **track** with `settings_tab_viewed` (`{ tab }`),
   emitted only on user-initiated changes.

No open questions remain. The plan is ready to implement.
