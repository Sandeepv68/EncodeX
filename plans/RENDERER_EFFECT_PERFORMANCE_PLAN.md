# Renderer Effect & Render-Churn Performance Plan

> **Status:** In progress - batches 1, 2 and 3 applied; batch 4 and two follow-ups still open
> **Scope:** `src/renderer` - hooks, components, pages, zustand stores, MCP view layer. No IPC contract or main-process changes.
> **Decisions locked:** no behaviour change for users (except fixing the two data-loss bugs); no new dependencies except optionally `eslint-plugin-react-hooks`.
> **Verification:** typecheck, lint, unit suite (5362 tests), copilot/queue/settings E2E suites.

- **Branch:** `feat/copilot-composer-autogrow` (carried over from the composer work)
- **Last Updated:** 2026-11-16
- **Related plans:** `COPILOT_UI_REDESIGN_PLAN.md`, `COPILOT_RESPONSIVE_PLAN.md`, `PERFORMANCE_TESTING_PLAN.md`.

---

## 1. Objective

Remove the render churn and redundant side effects in the renderer that the effect/store audit found:

- No IPC round-trip per keystroke.
- No effect that can wipe state the user just typed.
- No background poll that outlives the thing it polls for.
- Store subscriptions scoped to the slices a component actually reads.
- No per-render full-array scans of the queue on a progress tick.

## 2. Audit summary

Scope of the audit: all 512 `.ts`/`.tsx` files outside `__tests__`; 49 of them use effects (142 hooks total). Every `useEffect`, `useLayoutEffect`, `useMemo`, `useCallback`, custom hook and zustand write was traced.

**No infinite `setState` loop exists.** The four closest candidates all converge:

| Site                                                        | Why it terminates                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `hooks/useConversion.ts:111-122`                            | `setOutputAuto` -> `outputFile` changes -> effect re-runs -> `suggested === outputFile` guard stops the write |
| `mcp-views/views/ConvertView.tsx:56-74`                     | `setProposal` -> `setForm` -> re-render -> `proposal` identity unchanged -> effect does not re-run            |
| `components/settings/AiProviderSettingsSection.tsx:414-424` | offline fallback writes `providerId='rules'`; the next run sees it equal and bails                            |
| `pages/Settings.tsx:51-55`                                  | `setTab('ai')` -> React bails out on the identical value                                                      |

The real cost is render churn, redundant IPC, and two user-visible data-loss bugs.

**Root cause of the whole class:** the repo has no `react-hooks` ESLint plugin, so `exhaustive-deps` is not enforced anywhere and most of the missing/unstable dependency issues went unnoticed.

## 3. Non-goals

- Changing the IPC contract, the main process, or the planner.
- Changing what the queue or the MCP views display.
- Introducing a new state library.
- Virtualizing the queue list (it is bounded by the batch size).

---

## 4. Findings and fixes

### Batch 1 - correctness and side effects (HIGH)

| #   | Site                                                                                             | Problem                                                                                                               | Fix                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | `components/settings/AiProviderSettingsSection.tsx:456-458`                                      | `apiKey` in the effect deps: every keystroke fires `aiListModels` with the partial key                                | Keep the draft key out of the deps; refresh the list on commit (blur) and on provider/base-url/key-presence changes |
| 2   | `components/settings/AiProviderSettingsSection.tsx:131-133`                                      | Store patched on every keystroke in the model/base-URL fields; can overwrite a fresher view                           | Debounce the cache write; let `applyView` own the `view` field                                                      |
| 3   | `mcp-views/views/ConvertView.tsx:56-74`                                                          | `payload?.confirmation` identity changes per host push -> the latch re-fires and `setForm` **wipes the user's edits** | Latch on stable content, not object identity; never overwrite fields the user edited                                |
| 4   | `mcp-views/views/BatchView.tsx:41`, `ConfirmView.tsx:40`, `ErrorView.tsx:34`                     | Same identity-keyed latch (churn only)                                                                                | Same stable-key latch                                                                                               |
| 5   | `mcp-views/McpViewProvider.tsx:55-58` + `useMcpViewPolling.ts:39-44`                             | A dropped poll sets the view's error permanently and stops the interval                                               | Polling uses a silent call path that does not write `error`                                                         |
| 6   | `mcp-views/views/JobView.tsx:40`, `BatchView.tsx:45`, `ConvertView.tsx:80`, `ConfirmView.tsx:49` | Polling never stops after the job/batch reaches a terminal state, and keeps running while hidden                      | Include the terminal state in `enabled`; skip ticks while `document.hidden`                                         |
| 7   | `mcp-views/useMcpViewPolling.ts:46-48`                                                           | Slow calls overlap: the next tick is armed on a fixed interval, so requests pile up                                   | Self-schedule the next tick only after the previous call settled                                                    |
| 7b  | `mcp-views/McpViewProvider.tsx`                                                                  | An empty tool result (`structuredContent: {}`) replaces the payload and blanks the view                               | The provider refuses to publish an empty payload                                                                    |
| 8   | `mcp-views/useMcpViewPolling.ts:38` + `McpViewProvider.tsx:43-64`                                | One poll = ~4 context-value changes (`busy` up/down, `setData` twice with different payload identities)               | Single write per poll; polls do not touch `busy`; an unchanged payload is not published                             |
| 9   | `components/ProfileEditorDialog.tsx:84-117`                                                      | `editProfile` is an **object** dep: any parent that rebuilds the object resets 14 fields                              | Depend on `editProfile?.id`                                                                                         |
| 10  | `components/QueueAddReviewDialog.tsx:70-76`                                                      | `files` is an array dep: an inline array resets the per-file selections                                               | Depend on a stable content key                                                                                      |

### Batch 2 - store subscriptions and render churn (HIGH)

| #   | Site                                                                                                                             | Problem                                                                                                     | Fix                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 11  | `stores/queueStore.ts:80-85`, `stores/muxQueueStore.ts:80-85`                                                                    | `updateJob` always builds a new `jobs` array, even when the id is absent or the job is unchanged            | Find the index; return `{}` (no-op) when nothing changed                                                                                                                                               |
| 12  | `stores/queueStore.ts:92-95`                                                                                                     | `updateProgress` replaces the whole progress map on every tick                                              | Keep the map, but let consumers select a single job's progress                                                                                                                                         |
| 13  | `stores/queueStore.ts:67-74`, `stores/muxQueueStore.ts:68-75`                                                                    | `removeJob` copies the progress map even when the key was absent                                            | Only replace `progress` when the key existed                                                                                                                                                           |
| 14  | `stores/conversionStore.ts`, `stores/muxQueueStore.ts`, `stores/settingsStore.ts`, `stores/profileStore.ts`                      | Primitive setters re-notify on identical values                                                             | `set((s) => (s.x === v ? {} : { x: v }))`                                                                                                                                                              |
| 15  | `pages/BatchQueue.tsx:137`                                                                                                       | Whole-store subscription: the page re-renders on every progress tick                                        | Slice selectors (`s.jobs`, `s.progress`) + stable action refs                                                                                                                                          |
| 16  | `pages/BatchQueue.tsx:443, 1218-1221, 1308, 1323-1325, 1504`                                                                     | 12+ unmemoized O(n) passes over the job list per render                                                     | One `useMemo` for the visible list, the counts and the ETA                                                                                                                                             |
| 17  | `pages/BatchQueue.tsx:592-653`                                                                                                   | Encoding-option propagation fires one IPC per queued job per change, and each echo re-renders the page      | Diff against `job.options` and skip the IPC when equal                                                                                                                                                 |
| 18  | `components/AppDrawer.tsx:137-150`                                                                                               | Subscribes to both progress maps but only reads progress inside the popover; 10 unmemoized scans per render | Drop the progress subscriptions; memoize the counts                                                                                                                                                    |
| 19  | `App.tsx:222, 224`                                                                                                               | The app root subscribes to whole stores                                                                     | Slice selectors                                                                                                                                                                                        |
| 20  | `hooks/useConversion.ts:95`, `pages/AudioExtract.tsx:92`, `pages/Demux.tsx:127`, `pages/Remux.tsx:162`, `pages/VideoCut.tsx:288` | Whole-store subscriptions                                                                                   | Slice selectors                                                                                                                                                                                        |
| 21  | `stores/videoCutStore.ts:209-281`                                                                                                | `JSON.stringify` + synchronous `localStorage.setItem` per keystroke                                         | **Not changed:** the write is ~0.1ms and the store's tests assert the draft is persisted synchronously. A debounce would need the tests to advance timers and would risk losing the last edit on close |

### Batch 3 - timers, listeners and cleanup (MEDIUM/LOW)

| #   | Site                                                                                                                          | Problem                                                                                                                      | Fix                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 22  | `components/MediaPlayer.tsx:762-767`                                                                                          | `setCurrentTime` + `onTimeUpdate` every 50ms of media time re-renders the player and the parent subtree                      | Publish the time at a coarser rate                      |
| 23  | `components/EllipsisTooltip.tsx:60-63`                                                                                        | Unthrottled `resize` listener: a layout read + `setState` per resize event                                                   | rAF-throttle and skip the write when unchanged          |
| 24  | `components/VideoTimeline.tsx:428-432`                                                                                        | rAF id never cancelled -> writes `scrollLeft` on a detached node                                                             | Store the id, cancel it on unmount                      |
| 25  | `components/MediaPlayer.tsx:599-601`                                                                                          | Early return skips the cleanup -> the pending-seek timer can fire after unmount                                              | Own the timer cleanup in a dedicated effect             |
| 26  | `components/GettingStartedCard.tsx:112-116`                                                                                   | `onboarding_started` re-recorded on every Dashboard remount                                                                  | Record once per session                                 |
| 27  | `pages/Settings.tsx:51-55`                                                                                                    | The AI tab is forced on every `location.key` change, discarding a manual tab choice                                          | Apply only on the first location entry                  |
| 28  | `components/copilot/Aurora.tsx:102-139`                                                                                       | 60fps canvas loop runs while the tab is hidden                                                                               | Pause on `visibilitychange`                             |
| 29  | `components/copilot/Conversation.tsx:71-76`                                                                                   | The manual `scrollTop` write fights the virtualizer's `followOnAppend`                                                       | Drop the manual write                                   |
| 30  | `App.tsx:238-245`                                                                                                             | The IPC listener is re-subscribed on every navigation                                                                        | Hold `navigate` in a ref, subscribe once                |
| 31  | `App.tsx:299-353`                                                                                                             | The route table and the hotkey bindings are rebuilt on every render                                                          | `useMemo` both                                          |
| 32  | `App.tsx:235`                                                                                                                 | `useLanguageDirection` is subscribed twice (also in `main.tsx`)                                                              | Call it once, at the composition root                   |
| 33  | `ColorModeContext.tsx:78-94`                                                                                                  | The MUI `direction` is never derived from the persisted locale (RTL boots as LTR); the context value is rebuilt every render | Derive the direction from the locale; memoize the value |
| 34  | `stores/toastStore.ts:48-52`                                                                                                  | The toast array is never capped                                                                                              | Cap the queue                                           |
| 35  | `components/QueueJobCard.tsx:348`                                                                                             | Every card subscribes to the DnD context -> a drag re-renders all of them                                                    | Read the drag state once in the parent                  |
| 36  | `pages/Dashboard.tsx:176`                                                                                                     | `buildCardRings` re-runs its PRNG on every render for all 9 cards                                                            | Memoize per route                                       |
| 37  | `components/copilot/ChatInput.tsx:68-90`                                                                                      | `onSubmit` is a new function every render -> the Lexical command is re-registered on every keystroke                         | Hold the callback in a ref inside the plugin            |
| 38  | `hooks/useCapabilities.ts:126-129`, `hooks/useConversion.ts:246`, `hooks/useMediaTask.ts:111`, `hooks/useLazyThumbnail.ts:73` | Hooks return a new object/array every call                                                                                   | Memoise the returned values                             |
| 39  | `hooks/useCapabilities.ts:113-124`                                                                                            | A cache race can leave `capabilities` undefined forever                                                                      | Re-read the cache inside the effect                     |

### Batch 4 - tooling

- Add `eslint-plugin-react-hooks` with `react-hooks/exhaustive-deps` as a warning, so the class of bug above is caught at lint time rather than by audit.

---

## 5. Verification

Per batch:

1. `npm run typecheck:renderer`
2. `npm run lint` (plus `lint:px`, `lint:rem`, `lint:inline-styles`)
3. `npm test` (unit suite)
4. E2E: `copilot.spec.ts`, `copilot-responsive.spec.ts`, `copilot-saved-chats.spec.ts`, plus the queue specs.

## 6. Risks

- Changing store write identity can surface components that relied on a re-render to refresh. Each batch is verified against the unit + E2E suites.
- Removing the per-keystroke model list in the AI settings changes when the model dropdown populates: the list refreshes on a 500ms debounce instead of on each character. This is intentional.
- The video cut draft stays persisted synchronously (see finding 21).

## 7. Progress

### Done (batch 1 - correctness and side effects)

- The AI settings section no longer fires `aiListModels` on every keystroke: the key change is debounced by 500ms, the provider/base-url/key-presence change is fetched straight away, and only the newest request may write the options (`components/settings/AiProviderSettingsSection.tsx`).
- The session cache of the AI settings is written in two parts: the structural fields (view, provider) straight away so a remount finds a warm cache, the free-text fields (model, base URL) debounced by 300ms.
- The MCP convert form no longer loses the user's edits: the proposal is latched on its _content_ (`contentKey` in `mcp-views/format.ts`) and the fields the user touched are never overwritten (`mcp-views/views/ConvertView.tsx`). The batch, confirm and error views latch the same way.
- A dropped background poll no longer leaves the MCP view in a permanent error state: `callTool` accepts `{ silent: true }` and the polling hook uses it (`mcp-views/McpViewProvider.tsx`, `useMcpViewPolling.ts`).
- The MCP views stop polling once the job or batch is finished, and they skip the ticks while the window is hidden.
- The polling ticks no longer overlap (the next tick is armed after the previous call settled), and an unchanged payload is not published, so a poll that returns the same thing does not re-render the view. An empty payload never replaces the current one.
- `ProfileEditorDialog` hydrates on the profile _id_ instead of the profile object, and `QueueAddReviewDialog` keys its reset on the content of the file list.

### Done (batch 2 - store subscriptions and render churn)

- `queueStore` and `muxQueueStore` no longer copy the job list for a job that is not in it, and `removeJob` only replaces the progress map when the key existed. `conversionStore` and `muxQueueStore` guard their primitive setters against equal values.
- The Batch Queue page subscribes to the two slices it renders instead of the whole store, and derives the status flags, the ETA, the filter chips and the visible list in **one** pass instead of a dozen (`pages/BatchQueue.tsx`).
- The job cards are memoized, the remove callback is stable, and the drag state is passed in as a prop: a drag no longer re-renders every card on every pointer move, and a progress tick only re-renders the card of the running job (`components/QueueJobCard.tsx`).
- The options propagation skips the jobs whose options already match, so a keystroke in the encoding panel no longer fires one IPC per queued job (`utils/batch-options.ts`).
- The app drawer no longer subscribes to the queue progress maps (they are read only while the batch popover is open) and memoizes its counts.
- The app root subscribes to the error and settings slices instead of the whole stores.

### Done (batch 3 - timers, listeners and cleanup)

- The ellipsis tooltip throttles its resize handler to one measurement per frame and only writes when the value changed.
- The timeline cancels the pending zoom-recenter frame on unmount.
- The media player owns the pending-seek timer in its own effect, so it is cleared even when the loading effect returned early.
- `onboarding_started` is recorded once per session instead of on every dashboard remount.
- The settings page applies the "open the AI tab" request only on arrival, not on every location change.
- The aurora canvas loop pauses while the window is hidden.
- The app shell subscribes to the notification IPC once, memoizes the route table, and no longer duplicates the language-direction subscription.
- The color-mode context derives its direction from the active locale (an RTL boot no longer paints an LTR theme) and memoizes its context value.
- The toast queue is capped at 20 entries.
- The dashboard caches the card ring clusters instead of rebuilding them on every render.
- `useCapabilities` memoizes its codec lists, memoizes its result, and re-reads the cache inside the effect (a cache race no longer leaves it undefined).
- `useLazyThumbnail` observes the anchor through a ref callback, so a card whose anchor is attached later still loads its thumbnail.
- The composer's Enter command holds the submit callback in a ref, so the command is no longer re-registered on every keystroke.

### Open

- Batch 4: add `eslint-plugin-react-hooks` with `exhaustive-deps` as a warning.
- Follow-up 1: `MediaPlayer` publishes the playback time every 50ms, which re-renders the player and lifts the time into the parent. Halving the rate is a UX decision, not a pure optimisation.
- Follow-up 2: the job cards still receive their job through props, so a progress tick re-renders the card of the running job. Moving the cards to their own store subscriptions would make even that free, but it is a larger refactor of the queue pages.
