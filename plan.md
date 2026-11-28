# History Page Implementation Plan

**Status:** Draft
**Scope:** New `/history` page that records and displays successful, failed, and cancelled operations across EncodeX, with search, filters, sorting, detail views, and thumbnails where applicable.
**Deliverable:** This root `plan.md` is written as requested. Repo convention normally places design docs in `plans/<NAME>_PLAN.md`; the implementation commit may copy it to `plans/HISTORY_PLAN.md` if maintainers prefer.

## 1. Objective

Add a durable, unified operation history and a renderer page at `/history`.

The page must let the user:

- see all operations, not just queue or automation runs;
- distinguish succeeded, failed, and cancelled operations;
- search by file name, output, error, or operation type;
- filter by status, operation family, and source;
- sort by newest, oldest, duration, or name;
- open per-entry details, including paths, timestamps, duration, error, and a thumbnail when the operation has visual media;
- reach the page from the nav drawer, dashboard cards, and Quick Links;
- see all copy in every shipped locale with real translations, not English placeholders.

History must survive app restarts and must never cause an operation itself to fail if persistence or thumbnail generation fails.

## 2. Current State

### 2.1 No unified history exists

History is fragmented across short-lived or domain-specific stores:

| Data | Location | Problem |
| --- | --- | --- |
| Convert/audio/image/cut page state | renderer page stores | Lost on navigation/restart |
| Batch queue jobs | `src/main/queue/job-queue.ts` | Active queue only; `clearCompleted()` removes DONE/ERROR entries at `455-462` |
| Remux/demux queue jobs | `src/main/queue/mux-queue.ts` | Active queue only; `clearCompleted()` removes DONE/ERROR entries at `439-446` |
| Automation runs | `src/renderer/stores/automationStore.ts` | In-memory and active-run trimmed |
| Errors | `src/renderer/stores/errorStore.ts` | Bounded error UI history only |
| Logs / audit | `src/main/logs/log-hub.ts`, `src/shared/audit.ts` | Diagnostic events, not operation records |
| Analytics | `src/shared/analytics/` | Consent-gated telemetry, not user-facing history |
| Toasts | renderer toast store | Transient |

Single-file conversion has no completed-operation record: `src/main/ipc/conversion.ts:141-179` (`convertFile`) resolves with `void`.

### 2.2 Existing structured job types

- `QueueJob` at `src/shared/types.ts:424-436`: `id`, `input`, `output`, `options`, `transcoder`, `status`, `progress`, `error`, `createdAt`.
- `MuxQueueJob` at `src/shared/types.ts:476-489`: `id`, `kind`, `input`, `output`, `targets`, `status`, `error`, etc.
- Automation runs have `runId`, `automationId`, per-stage status, output paths, and errors in `src/main/automations/runner.ts`.

These are useful capture sources but are not a history store.

### 2.3 Route registration is deliberately duplicated

There is no single route registry. Adding `/history` requires updating all of these:

| Registry | File |
| --- | --- |
| Nav items | `src/shared/app-constants.ts:128-143` |
| Drawer label map | `src/renderer/components/AppDrawer.tsx:73-88` |
| Lazy loaders and route table | `src/renderer/App.tsx:84-111`, `349-387` |
| Route skeleton | `src/renderer/components/PageSkeletons.ts` |
| Page icons | `src/renderer/pageIcons.tsx:78-93` |
| Dashboard routes/cards | `src/renderer/constants/dashboard.ts:26-59` |
| Quick Links | `src/renderer/constants/dashboard.ts` (`QUICK_LINKS`) |
| Test page list | `src/test-utils/page-render.tsx:78-93` |
| Hardcoded route counts | `src/test-utils/__tests__/page-render.test.tsx:58-74`, `src/renderer/__tests__/i18n-matrix.test.tsx:145-147`, `src/renderer/__tests__/missing-degradation.test.tsx:116`, `src/renderer/__tests__/hostile-bridge-matrix.test.tsx:102`, `src/renderer/__tests__/axe-all-pages.test.tsx:55` |
| E2E route arrays | `e2e/specs/a11y.spec.ts:34-49`, `e2e/specs/hostile-bridge.spec.ts:80-94`, `e2e/specs/ipc-events.spec.ts:109-123`, `e2e/specs/ipc-abuse.spec.ts` |
| Dashboard E2E cards | `e2e/specs/dashboard.spec.ts:24-38` |

Drawer test ids are derived as `nav-item-${to === '/' ? 'dashboard' : to.slice(1)}`, so the new nav row will be `nav-item-history`.

### 2.4 IPC conventions

- Channels live in `src/shared/ipc-channels.ts`.
- Handlers are registered in `src/main/ipc/handlers.ts:53-74`.
- Preload methods must be mirrored in `src/preload/index.ts`, `src/renderer/electron-api.d.ts`, `src/test-setup.ts`, and `src/test-utils/hostile-api.ts`.
- One log constant per new IPC should be added to `src/shared/log-constants.ts`.
- `src/main/automations/store.ts:41-173` is the best existing durable-store pattern: injectable `userDataDir`, versioned JSON, `.bak` recovery, bounded `fstat` reads, and atomic temp write + rename.

## 3. Architecture

### 3.1 Recording rule

Record exactly one history entry per logical operation, in the main process, at the terminal success/failure boundary.

- Queued batch jobs are recorded by `JobQueue`, not by renderer actions.
- Queued remux/demux jobs are recorded by `MuxQueue`.
- Single-file conversions are recorded by the `CONVERT_FILE` main handler, with an optional renderer-supplied context tag.
- Automation runs are recorded once in `finishRun`.
- Renderer pages never write history directly.

This avoids duplicates when multiple UI flows share the same main executor.

### 3.2 Shared model

Add:

- `src/shared/history/types.ts`
- `src/shared/history/schema.ts`
- `src/shared/history/limits.ts`
- `src/shared/history/index.ts`

Core types:

```ts
type HistoryFamily =
  | 'convert'
  | 'audio-extract'
  | 'image-compress'
  | 'video-cut'
  | 'remux'
  | 'demux'
  | 'batch'
  | 'automation'
  | 'mcp';

type HistorySource = 'gui' | 'mcp' | 'automation';
type HistoryStatus = 'succeeded' | 'failed' | 'cancelled';

interface HistoryError {
  code?: string;
  message: string;
  detail?: string;
}

interface HistoryEntry {
  id: string;
  family: HistoryFamily;
  source: HistorySource;
  status: HistoryStatus;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  inputs: string[];
  outputs: string[];
  transcoder?: string;
  jobId?: string;
  runId?: string;
  error?: HistoryError;
  metadata: Record<string, string | number | boolean>;
  thumbnail?: {
    path: string;
    mimeType: string;
  } | null;
}
```

Validation rules:

- cap at 500 entries and 5 MB of serialized JSON;
- maximum 20 metadata keys, 200 characters per key/value, primitives only;
- maximum 20 paths per entry, 2 KB per path;
- reject unknown `family`, `source`, or `status` values on load;
- drop invalid entries rather than failing the whole store;
- `version: 1` envelope, e.g. `{ version: 1, entries: HistoryEntry[] }`.

### 3.3 Main-process store and recorder

Add:

- `src/main/history/store.ts`
- `src/main/history/recorder.ts`
- `src/main/history/__tests__/store.test.ts`
- `src/main/history/__tests__/recorder.test.ts`

`HistoryStore` responsibilities:

- `list(): HistoryEntry[]` sorted newest-first by default;
- `add(entry: HistoryEntry): void` prepends, trims to limits, persists;
- `remove(id: string): boolean`;
- `clear(): void`, including thumbnail files;
- `getThumbnail(id: string): string | null` returns a data URL from disk;
- store JSON at `path.join(app.getPath('userData'), 'history/history.json')` with `history.json.bak`;
- store thumbnails under `userData/history/thumbnails/<id>.png`;
- cleanup thumbnail files when an entry is trimmed, removed, or history is cleared;
- swallow/log persistence errors so callers are unaffected.

`HistoryRecorder` responsibilities:

- create ids with `randomUUID`;
- normalize source-specific objects into `HistoryEntry`;
- best-effort thumbnail generation;
- call `HistoryStore.add()` inside `try/catch`;
- accept an injectable store for deterministic tests.

### 3.4 Thumbnails

Thumbnails are optional and best-effort.

- For video inputs/outputs, reuse the existing preview path from `src/main/video-preview.ts:131` (`getVideoPreview`) and the preview cache.
- For image inputs/outputs, reuse the existing image preview IPC path (`IPC.GET_IMAGE_PREVIEW`).
- Audio-only and non-media operations get no thumbnail; the renderer shows a neutral operation icon.
- Decode the returned data URL and persist it under `userData/history/thumbnails/<id>.png`.
- Cap stored thumbnails at 100; trim oldest first with their entries.
- If preview generation fails, persist the entry with `thumbnail: null`.
- Renderer loads thumbnails lazily via `historyGetThumbnail(id)` and caches by entry id.

## 4. Capture Points

| Operation | Hook | Recorded data |
| --- | --- | --- |
| Single-file convert | `src/main/ipc/conversion.ts:145-183` terminal branches | input, output, options summary, transcoder, error, status |
| Audio extract | Same `CONVERT_FILE` hook; tag via renderer context | codec, bitrate, duration metadata |
| Image compress | Same hook; tag via renderer context | saved percent, output size metadata |
| Video cut | Same hook; tag via renderer context | start, end, duration, copy/audio flags |
| Standalone remux/demux | Same hook; tag via renderer context | target container/family |
| Batch queue | `src/main/queue/job-queue.ts:706-771` terminal branches | full `QueueJob` projection, family `batch` |
| Remux/demux queue | `src/main/queue/mux-queue.ts:541-598` terminal handlers | full `MuxQueueJob` projection, family from `kind` |
| Automations | `src/main/automations/runner.ts:164-169` `finishRun` | `runId`, `automationId`, outputs, error, stage metadata |
| MCP async operations | Existing `JobQueue` hook | family `mcp`, source `mcp` |
| Standalone MCP stdio | Deferred | See Non-goals |

Cancellation:

- `ErrorCode.CANCELLED` from conversion becomes `status: 'cancelled'`.
- `JobQueue.cancelJob()` / `cancelAll()` and `MuxQueue` cancellation paths record `cancelled` entries only if they do not already reach the terminal handlers.
- Cancelled entries are included in “all” history but do not count as failures in summary chips.

### 4.1 Conversion context

Extend the preload/IPC signature without breaking existing callers:

```ts
convertFile(
  input: string,
  output: string,
  options: ConversionOptions,
  transcoderType: string,
  context?: HistoryContext
): Promise<void>
```

`HistoryContext`:

```ts
interface HistoryContext {
  family: 'convert' | 'audio-extract' | 'image-compress' | 'video-cut' | 'remux' | 'demux' | 'mcp';
  source: 'gui' | 'mcp';
  metadata?: Record<string, string | number | boolean>;
}
```

Main handler must validate the optional fifth argument against an allowlist and sanitize metadata; invalid context falls back to `{ family: 'convert', source: 'gui' }` rather than rejecting the operation.

Renderer call sites to tag:

- `src/renderer/pages/AudioExtract.tsx:179-187`
- `src/renderer/pages/ImageCompress.tsx:282-329`
- `src/renderer/pages/VideoCut.tsx:528-584`
- `src/renderer/stores/remuxStore.ts:425`
- `src/renderer/stores/demuxStore.ts:350`

### 4.2 One-time migration

Queue persistence already writes DONE/ERROR jobs to `queue-state.json`. On first launch after this feature ships, optionally import those entries into History once, guarded by a `history-migrated-v1` marker in user data. Do not attempt broader backfill: old single-file operations were never recorded.

## 5. IPC Surface

Add to `src/shared/ipc-channels.ts`:

| Channel | Direction | Purpose |
| --- | --- | --- |
| `history-list` | invoke | Return bounded `HistoryEntry[]` |
| `history-get-thumbnail` | invoke | Return cached thumbnail data URL for an entry |
| `history-clear` | invoke | Clear all entries and thumbnails |
| `history-remove` | invoke | Remove one entry and its thumbnail |
| `history-updated` | event | Notify renderer windows after add/remove/clear |

Add `src/main/ipc/history.ts` and register it in `src/main/ipc/handlers.ts`.

Preload methods:

- `historyList(): Promise<HistoryEntry[]>`
- `historyGetThumbnail(id: string): Promise<string | null>`
- `historyClear(): Promise<void>`
- `historyRemove(id: string): Promise<boolean>`
- `onHistoryUpdated(listener: () => void): () => void`

Mirror in:

- `src/preload/index.ts`
- `src/renderer/electron-api.d.ts`
- `src/test-setup.ts`
- `src/test-utils/hostile-api.ts`
- preload and IPC channel tests

Add matching `LOG_*` constants in `src/shared/log-constants.ts`.

## 6. Renderer Page

### 6.1 Files

Add:

- `src/renderer/pages/History.tsx`
- `src/renderer/styles/History.styles.ts`
- `src/renderer/components/history/HistoryToolbar.tsx`
- `src/renderer/components/history/HistoryList.tsx`
- `src/renderer/components/history/HistoryRow.tsx`
- `src/renderer/components/history/HistoryDetails.tsx`
- `src/renderer/components/history/HistoryThumbnail.tsx`
- `src/renderer/stores/historyStore.ts`
- `src/renderer/pages/__tests__/History.test.tsx`
- `src/renderer/stores/__tests__/historyStore.test.ts`
- `src/renderer/components/history/__tests__/HistoryToolbar.test.tsx`
- `src/renderer/components/history/__tests__/HistoryRow.test.tsx`
- `src/renderer/components/history/__tests__/HistoryDetails.test.tsx`

### 6.2 Store

`useHistoryStore` holds:

- `entries: HistoryEntry[]`
- `status: 'idle' | 'loading' | 'ready' | 'error'`
- `query` with `search`, `status`, `family`, `source`, `sort`
- `selectedId: string | null`
- `thumbnails: Record<string, string | null>`
- `load()`, `refresh()`, `clear()`, `remove(id)`, `setQuery()`, `select(id)`, `loadThumbnail(id)`

Behavior:

- load on page mount and on `onHistoryUpdated`;
- ignore stale requests if a newer fetch or clear has started;
- debounce search updates in the toolbar, not in the store;
- derive the filtered/sorted list in a pure helper so tests can cover it directly;
- search over input/output basenames, error message, `family`, `source`, and metadata values, not translated labels;
- keep the raw list intact so filter changes do not refetch.

### 6.3 UI

`History.tsx` uses `PageContainer` with `pageIcons['/history']` and `t('history.title')`.

`HistoryToolbar.tsx`:

- search field with `data-testid="history-search"`;
- status chips for all/succeeded/failed/cancelled;
- family select for all operation families;
- source select for all/gui/mcp/automation;
- sort select: newest, oldest, longest, shortest, name A-Z;
- Refresh and Clear History buttons with confirmation for clear.

`HistoryList.tsx` / `HistoryRow.tsx`:

- table on wide screens, cards on narrow screens;
- columns: thumbnail, operation, status, input/output, started, duration;
- status chips use accessible colors plus text, never color alone;
- show a truncated error preview for failed rows;
- `data-testid="history-row-<id>"`.

`HistoryDetails.tsx`:

- MUI dialog opened from a row;
- full input/output paths with Copy Path and Reveal buttons;
- formatted started/finished timestamps and duration;
- full error code/message/detail;
- metadata key/value table;
- Retry button only for operations with an existing safe re-run path; otherwise omit;
- close with Escape and focus return.

`HistoryThumbnail.tsx`:

- lazy-loads from the store;
- neutral icon while loading or when absent;
- `alt=""` because the row text already names the file.

Performance:

- render 50 rows initially with a “Load more” button;
- lazy-load thumbnails only for rendered rows;
- do not persist data URLs in renderer localStorage.

## 7. Navigation, Dashboard, Quick Links

### 7.1 Nav

- `src/shared/app-constants.ts`: add `{ to: '/history', label: 'History' }`.
- `src/renderer/components/AppDrawer.tsx`: add `'/history': 'history'`.
- `src/renderer/pageIcons.tsx`: add `'/history': <FontAwesomeIcon icon={faClockRotateLeft} />`.
- `src/renderer/App.tsx`: add `loadHistory`, `HistorySkeleton`, and `{ path: '/history', element: <RouteLoader ... /> }`.

### 7.2 Dashboard

Because `DEFAULT_DASHBOARD_ROUTES` derives from `NAV_ITEMS`, `/history` becomes a dashboard card automatically once the route is not excluded.

Add:

- `DASHBOARD_CARD_TITLES['/history'] = 'history'`
- `DASHBOARD_CARD_DESCRIPTIONS['/history'] = 'descHistory'`
- `{ route: '/history', title: 'History' }` to `e2e/specs/dashboard.spec.ts` `FEATURE_CARDS`.

Do not add `/history` to `NUMBER_KEY_ROUTES`; the first eight shortcuts are already assigned and ordering must remain stable.

### 7.3 Quick Links

Repoint the existing `review-operation-history` Quick Link from `/logs` to `/history`, keeping its id stable so saved dashboard layouts do not churn. Update its label/description keys to the new History copy.

Leave the feature-flagged `view-run-history` Quick Link pointing to `/automations`; it is specifically about automation run details and remains gated by `automations_page`.

## 8. i18n

All visible strings must use `t()`. No hardcoded English strings.

### 8.1 Source keys

Add to `src/renderer/i18n/locales/en-US.json`:

- `nav.history`
- `dashboard.descHistory`
- `quickLinks.links.reviewOperationHistory.title` / `.description` (updated meaning)
- `history.title`, `history.subtitle`
- `history.searchPlaceholder`, `history.refresh`, `history.clear`, `history.clearConfirm`
- `history.filters.*`
- `history.families.*`
- `history.sources.*`
- `history.sorts.*`
- `history.status.succeeded/failed/cancelled`
- `history.columns.*`
- `history.empty.title/description`
- `history.loading`, `history.error`
- `history.details.title/started/finished/duration/input/output/error/metadata/copyPath/reveal/retry/close`
- `history.toasts.cleared/removed/loadFailed/thumbnailFailed`

Use user-oriented labels, matching established Quick Link wording: “View Operation History”, “Review successful and failed operations.”

### 8.2 Translation workflow

1. Run `npm run sync:locales` to copy the new en-US keys into all locale files.
2. Add real translations for `history.*`, `nav.history`, `dashboard.descHistory`, and the updated Quick Link strings to all 38 group tables under `scripts/locale-data/` listed in `scripts/locale-data/manifest.json`.
3. Run `node scripts/locale-backfill.mjs` to apply only en-US-identical keys.
4. Manually check machine-translation leftovers in `fil`, `is`, `si`, and `tl`; fix any value still identical to English.
5. Add `key.startsWith('history.')` to `NON_ENGLISH_REQUIRED` in `src/renderer/__tests__/i18n-matrix-utils.ts:188-193`, plus explicit assertions for `history.title` and `history.status.failed`.
6. Add the new interpolated keys used by the page to the `react-i18next` mock map in `src/test-setup.ts`.
7. Run `npm run validate:locales`, `node scripts/validate-locale-usage.mjs --warn-unused`, `npm run lint:strings`, and `npm run test:locale-matrix` with a 600000 ms timeout.

Known pre-existing noise: five unused dashboard keys and 148 stale-table audit issues are unrelated; do not “fix” them as part of History unless explicitly requested.

## 9. Tests

### 9.1 Unit

- `src/shared/history/__tests__/schema.test.ts`: validation, trimming, limits, bad values.
- `src/main/history/__tests__/store.test.ts`: roundtrip, corrupt primary file, `.bak` recovery, bounded size, thumbnail cleanup, persistence failure does not throw.
- `src/main/history/__tests__/recorder.test.ts`: normalization for every family and status; optional context sanitization.
- Existing conversion/queue/mux/automation handler tests: assert a history entry is recorded exactly once on success, failure, and cancellation.
- `src/main/ipc/__tests__/history.test.ts`: list, clear, remove, thumbnail, invalid id, event emission.
- `src/preload/__tests__/index.test.ts`: all five new bridge methods.
- `src/shared/__tests__/ipc-channels.test.ts`: five new channels.

### 9.2 Renderer

- `History.test.tsx`: mount with bridge missing, empty state, loading/error, populated rows, search/filter/sort, details dialog, clear confirmation, thumbnail load.
- `historyStore.test.ts`: load, refresh, stale-response guard, query changes, selected entry, thumbnail cache.
- Toolbar/row/details component tests for accessibility labels and action callbacks.
- `Dashboard.test.tsx`: History card visible and navigates to `/history`.
- `QuickLinksPanel.test.tsx`: repointed History link is present and navigates correctly.
- `App.test.tsx`: `/history` renders; skeleton shown while chunk loads.

### 9.3 Matrix and E2E

Update every hardcoded 14 to 15 in the route inventories listed in section 2.3.

Add `{ path: '/history', testId: 'nav-item-history' }` to E2E route arrays.

Add a focused E2E spec that:

- navigates via drawer, dashboard card, and Quick Link;
- seeds history through the preload bridge in test mode;
- searches, filters, sorts, opens details, clears history;
- confirms keyboard focus and Escape behavior.

Run `npm run test:route-changes` after route registration.

## 10. Docs

Update:

- `docs/ARCHITECTURE_RENDERER.md`: add `/history` to the page table and the new IPC channels to the IPC table.
- `docs/TESTING.md`: note the History unit/matrix/E2E suites if new config files are added.
- This plan’s checkpoint table as work progresses.

Do not create `docs/ARCHITECTURE.md`; it does not exist in this repo.

## 11. Execution Order

1. Phase A — shared model, schema, store, recorder, unit tests.
2. Phase B — main capture hooks for queues and automations.
3. Phase C — conversion context and single-file capture hooks.
4. Phase D — IPC, preload, d.ts, test stubs, hostile API map.
5. Phase E — renderer store and History page UI.
6. Phase F — nav, dashboard, Quick Links, skeleton, page icons.
7. Phase G — i18n source keys, translations, locale matrix guard.
8. Phase H — route inventories, docs, E2E, full verification.

## 12. Checkpoints

| Item | State | Notes |
| --- | --- | --- |
| A. Shared History model/schema | Not started | `src/shared/history/*` |
| B. Durable main store + recorder | Not started | Mirror `AutomationStore` atomic write pattern |
| C. Queue capture | Not started | `JobQueue`, `MuxQueue` terminal handlers |
| D. Single-file capture | Not started | Optional `HistoryContext` on `convertFile` |
| E. Automation capture | Not started | `finishRun` |
| F. IPC/preload surface | Not started | Five channels/events |
| G. History page UI | Not started | Search/filter/sort/details/thumbnail |
| H. Nav/dashboard/Quick Links | Not started | Repoint `review-operation-history` |
| I. Locale translations | Not started | 38 group tables + matrix guard |
| J. Route inventories/docs/E2E | Not started | 14 routes becomes 15 |
| K. Full verification | Not started | Commands below |

## 13. Verification Commands

Run after the implementation, not after the plan:

```powershell
npx vitest run src/shared/history src/main/history src/main/ipc/__tests__/history.test.ts src/preload/__tests__/index.test.ts src/shared/__tests__/ipc-channels.test.ts src/renderer/pages/__tests__/History.test.tsx src/renderer/stores/__tests__/historyStore.test.ts src/renderer/components/history src/renderer/pages/__tests__/Dashboard.test.tsx src/renderer/components/__tests__/QuickLinksPanel.test.tsx
npm run lint
npm run typecheck
npm run validate:locales
node scripts/validate-locale-usage.mjs --warn-unused
npm run lint:strings
npm run test:route-changes
npm run test:locale-matrix
npm run doc:drift
npm run build
npm run test:e2e:ci
```

`npm run test:locale-matrix` must be run with a 600000 ms timeout in this environment.

## 14. Acceptance Criteria

- `/history` is reachable from the drawer, dashboard card, and Quick Links.
- All 15 routes pass unit matrix, locale matrix, RTL, axe, hostile-bridge, and route-change checks.
- A successful and a failed operation appear with the correct status after an app restart.
- Search, status filter, family filter, source filter, and sort all change the visible list as expected.
- Details show paths, timestamps, duration, metadata, and error; a visual operation shows a cached thumbnail when generation succeeds.
- Clearing history removes entries and thumbnail files.
- A corrupted or oversized history file never prevents app startup.
- A history persistence failure never rejects the underlying operation.
- No new English-placeholder translations remain in any non-English locale.

## 15. Non-goals / Deferred

- Standalone Node MCP stdio process history: it does not share the Electron main process store. In-app embedded MCP uses `JobQueue` and is covered.
- Full frame-by-frame preview strips in History: only one cached thumbnail per entry.
- Re-running arbitrary historical operations: only safe, explicitly implemented retry actions are shown.
- Editing historical records.
- Sending history data to analytics.
