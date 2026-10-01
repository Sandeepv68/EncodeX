# Adversarial Test Hardening Plan — "Break EncodeX Before Production"

**Status:** In progress
**Branch suggestion:** `feat/adversarial-test-hardening`
**Scope:** unit (`src/**/*.test.ts(x)`), integration, e2e (Tier A + Tier B), perf, CI gating
**North star:** *No unhandled exception, unhandled rejection, renderer `pageerror`, or silent
`console.error` may reach a user in a shipped build. Every one of them must fail a build.*

---

## Progress log

| Phase | Status | Verified |
|---|---|---|
| 0.1 Unit-level crash tripwire | **DONE** | 2683/2683 unit tests green; `npm run lint` 0 errors; `npm run typecheck` clean |
| 0.1b Tripwire self-tests | **DONE** | 19/19 in `src/test-utils/__tests__/crash-tripwire.test.ts` |
| 0.1c DOM prop-leak AST guard | **DONE** | `src/renderer/styles/__tests__/no-dom-prop-leak.test.ts`, 47 style modules |
| 0.2 E2E renderer tripwire | **DONE** | Tier A 154/154 (2 skipped), Tier B 9/9; `npm run lint` 0 errors; `npm run typecheck` clean; `npm run format:check` clean |
| 0.3 Typecheck the tests | **DONE** | 191 test files in program; 54 real errors fixed, 0 remain; `npm run typecheck` clean (5 projects, 38s); 2686/2686 unit, Tier A 154/154, Tier B 9/9 |
| 0.4 Coverage: per-file floors + diff coverage | **DONE** | Merged 2-tier report (220 files, **30 below the 80/70 candidate floor**, non-blocking); blocking diff gate with added-line coverage; 4 merge/scope bugs found and fixed |
| 0.5 Flake governance | **DONE** | `test:flake-detect` runs e2e 3× with `--retry=0` and fails on failure rate in (0,1), on partial runs, on lapsed/stale quarantine entries; 19 unit tests over the verdict rules, 6 mutations caught; `test-flake` CI job |
| 0.6 Housekeeping debt | **DONE** | `perf/**` + `eslint-rules/**` in Prettier globs; `tsconfig.perf.json` wired as the 6th typecheck project; boot time recorded + asserted (median-of-3 vs `perf/baseline.json` budget +25%), 31 tests, 6 mutations caught. Typechecking `perf/` found Vitest 4 silently ignored `forks: { execArgv }`, so the memory tests had been measuring uncollected garbage |
| 1 Contract & input fuzzing | TODO | — |
| 2 Media / byte-level fuzzing | TODO | — |
| 3 IPC contract & abuse | TODO | — |
| 4 State machines, lifecycle & races | TODO | — |
| 5 UI robustness, i18n & a11y | TODO | — |
| 6 CLI & MCP hostile input | TODO | — |
| 7 Updater & network hostility | TODO | — |
| 8 Resource limits & denial-of-service | TODO | — |
| 9 Mutation testing | TODO | — |
| 10 CI wiring, budgets & nightly chaos | TODO | — |

### Bugs the tripwire found (all fixed in the same change that surfaced them)

These were live in `src/renderer` and would have shipped. None had a failing test.

| # | Bug | Root cause | Fix |
|---|---|---|---|
| B1 | Every page rendered an invalid `hasaside` DOM attribute | `PageRoot` declared `$hasAside` but never filtered it; `styled(Box)` forwards all props | `shouldForwardProp` + transient prop |
| B2 | `StreamDetails` leaked a `tone` attribute | same, `$tone` | `shouldForwardProp` + transient prop |
| B3 | `MediaPreview` leaked a `variant` attribute | same, `$variant` | `shouldForwardProp` + transient prop |
| B4 | `BatchQueue` leaked `$hidden` / `$gone` and React warned on every mount | `AnimatedSection` used the `$` convention but omitted `shouldForwardProp` entirely | `shouldForwardProp`; same applied to `CondenseIcon` |
| B5 | 32 tests let React state updates escape `act()` | store mutations and async IPC probes drove updates outside the test's control | each update now driven inside `act()` / awaited via `findBy*` |
| B6 | 4 `ProfileSelector` tests logged *"The current testing environment is not configured to support act(...)"* | `user.type()` is already act-wrapped; the tests wrapped it in a second, outer `act()`, unbalancing React's act scope | removed the redundant outer `act()` |
| B7 | `src/test-setup.ts` never set `IS_REACT_ACT_ENVIRONMENT` | React's update accounting was partly disabled for the whole suite | set once in global setup |
| B8 | Every page logged `Refused to load font … violates Content Security Policy` | Vite inlines the eight Roboto subsets as `data:` URIs, but the meta CSP had no `font-src`, so default-src blocked them | `font-src 'self' data:` in `src/renderer/index.html`, guarded by `src/renderer/__tests__/csp.test.ts` |
| B9 | `src/main/__tests__/index.test.ts` leaked 10+ live `uncaughtException` / `unhandledRejection` listeners into the shared test process | `src/main/index.ts` calls `registerProcessCrashHandlers()` at module scope and the spec re-imports it in nearly every test after `vi.resetModules()` | `afterEach` sweeps every process listener added since a baseline captured before the first import |

B8 was found by the Phase 0.2 e2e tripwire on its first run, and B9 by turning
`NODE_OPTIONS=--trace-warnings` on after a bare run printed an unexplained
`MaxListenersExceededWarning`. Both are recorded here because the *second* one is
the more interesting failure: the warning was attributed to the wrong file for
several iterations, and the leak was not inert — every surviving listener calls
`log.error` and `captureException`, so one genuine unhandled rejection in that
spec fanned out into a dozen monitoring reports. A warning nobody can trace back
to a cause is worse than no warning, because it trains the team to ignore the
one warning that mattered.

**Guard added so B8 cannot recur:** `src/renderer/__tests__/csp.test.ts` parses the
`content-security-policy` meta tag out of `index.html` and asserts the directives
the bundled assets actually need, including that every `@fontsource/*` import in
the renderer resolves to a source the policy permits. Verified negatively: deleting
`font-src` makes it fail.

**Guard added so B1–B4 cannot recur:** `no-dom-prop-leak.test.ts` walks the real TypeScript
AST of every `*.styles.ts` and fails if any `styled()` call declares a `$`-prefixed prop without
a `shouldForwardProp`. It includes a self-check that pins the shape of the data it inspects,
because an earlier regex version of this test passed *while the bug was present* — a guard that
cannot fail is worse than no guard.

### Known follow-ups (recorded, not fixed)

- `ProfileSelector` passes options to MUI `Autocomplete` with `groupBy`, producing duplicated
  group headers. Cosmetic, but MUI flags it on every render.
- A `Tooltip` wraps a disabled `button` in `BatchQueue`/`AppDrawer`, so the tooltip can never
  open. Real a11y defect; fix by wrapping the disabled button in a `span`.
- `LanguageMenu.tsx:150` uses `autoFocus` (`jsx-a11y/no-autofocus` warning, pre-existing).
- The CSP lives in a `<meta>` tag, so Electron's security advisory cannot see it and warns
  about the missing policy on every launch. The warning is allowlisted
  (`e2e/fixtures/allowed-errors.json`, kind `consoleWarn`, review 2026-12-29) with the reason
  recorded. Proper fix is to move the policy to `session.webRequest.onHeadersReceived`, which
  the advisory *can* see; deferred because it changes how the preload bridge and custom
  `aptabase-ipc` scheme are allowed; deferred as an open follow-up rather than a phase item,
  because it touches the preload bridge and the custom scheme allowlist together.
- `aptabase-ipc://trackEvent` reports `net::ERR_ABORTED` on teardown in Tier B. Recorded as a
  non-fatal `netfail`; it is the analytics call losing its race with window close, not a defect,
  but it means Tier B output always carries a tripwire warning. Worth a look when the analytics
  bootstrap is next touched.
- `Convert.test.tsx > hides the stream details behind the view more toggle` fails roughly once
  per full unit run under load and passes in isolation (~72 s alone vs ~92 s in-suite). The
  30 s `waitFor` budget is too tight for a 40-test file on a loaded machine. This is exactly the
  F10 flake-governance problem, deferred to Phase 0.5 rather than patched ad hoc here.
- `tsconfig.renderer.json` excludes with `**/*.{test,spec}.{ts,tsx}`, which TypeScript does not
  expand — the pattern matches nothing. The project is saved from actually typechecking its whole
  suite only by the working `**/__tests__/**` entry beside it. One test file sits outside
  `__tests__/` and so *was* in the renderer program by accident:
  `src/renderer/hooks/usePreviewThumbnail.test.ts`. `tsconfig.test.json` now covers it
  deliberately. Inert today (0 errors either way), so the broken pattern is folded into Phase
  0.6 housekeeping rather than fixed here; leaving it is a trap, because the next spec written
  at `src/renderer/<area>/<name>.test.tsx` will silently re-enter the renderer typecheck.

---

## 0. Why this plan exists (findings from the current repo)

These are facts about the repo as of `b12f386`, not hypotheticals. Each maps to a phase below.

| # | Finding | Impact |
|---|---|---|
| F1 | **Zero** e2e specs attach `page.on('pageerror')` or `page.on('console')` (`e2e/**` grep: 0 hits). A renderer that throws on every mount still passes all 14 Tier A specs. | Critical — the whole GUI surface is unguarded. |
| F2 | `src/test-setup.ts` installs no `unhandledrejection` / `error` listener. jsdom swallows renderer-side async throws; they never fail the test. | Critical — silent green tests. |
| F3 | The `tsconfig.*.json` projects **exclude every test file**, so ~29,300 lines of test code are never typechecked. | High — tests compile only by luck. |
| F4 | Coverage gates are global only (85/75/80/85). No per-file floor, no diff coverage. A new 600-line file at 0% passes if the global average holds. | High. |
| F5 | E2E "skips" real main-process IPC entirely: 13 of 14 specs use `e2e/mocks/preload.js` (a JS reimplementation of the bridge). The mock and `src/preload/index.ts` drift silently. | High — the real preload/main contract is untested in CI. |
| F6 | No property-based, fuzz, or mutation testing anywhere. `frame-decoder.ts` (433 lines of raw `Buffer` parsing), `ffprobe-mapper.ts`, `queue-transfer.ts`, and `image-info.ts` are hand-tested only. | High. |
| F7 | 56 locale JSON files; the i18n mock in `test-setup.ts` hardcodes ~50 English strings. No test renders a page in a non-English locale. | High — most users don't speak `en-US`. |
| F8 | No test asserts an IPC handler survives garbage input. `ipc-channels.ts` declares ~90 channels; there is no test that calls each registered handler with zero args, wrong arity, or `__proto__`. | High. |
| F9 | `perf/**` and `eslint-rules/**` are outside `npm run format` and outside every `typecheck`. | Medium. |
| F10 | E2E `retry: 2` in CI with no flake accounting. A genuinely broken test is indistinguishable from a flaky one; flakes get rerouted, not fixed. | Medium. |
| F11 | `getMainWindow()` polls for 30 s (`e2e/fixtures/app.ts:104`). A slow-boot regression is absorbed as test latency forever. | Medium. |
| F12 | No `test.skip` governance; no quarantine mechanism; no bug-for-bug regression protocol. | Medium. |

---

## Phase 0 — Tripwires (do this first; everything else is worthless until failures are visible)

Goal: convert "the app silently broke" into "the build is red."

### 0.1 Unit-level crash tripwire — `src/test-setup.ts`

Add a global recorder that fails the *test file* if anything async blows up:

```ts
// src/test-setup/crash-tripwire.ts
const unhandled: unknown[] = [];
export function getUnhandled(): unknown[] { return unhandled; }
```

- `process.on('unhandledRejection')` and `process.on('uncaughtException')` → record, don't throw (so the
  owning assertion reports a readable failure).
- `window.addEventListener('unhandledrejection' | 'error')` for the jsdom renderer side.
- `console.error` / `console.warn` monkey-patch → record, with a stack.
- In a new `src/test-utils/assert-clean.ts` exporting `assertNoUnhandled()` and a shared
  `afterEach` registered from `test-setup.ts`:
  - Fail on **any** unhandled rejection or uncaught exception.
  - Fail on `console.error` **unless** the test opts in via `expectConsoleError(/pattern/)`.
  - Warn-only (first week) on `console.warn`; promote to error in week 2 after the noise is drained.
- Escape hatch that is *visible in the diff*: `allowConsoleError()` must be called explicitly.
- Roll out behind `ENCODEX_STRICT_TESTS=1` in week 1 so we can measure the blast radius, then
  flip it on permanently in `vitest.config.ts` + `vitest.integration.config.ts`.

**Exit criterion:** a deliberately-thrown async error in any store/hook makes a test fail.

### 0.2 E2E renderer tripwire — new `e2e/fixtures/tripwire.ts`

Wired into `launchApp()` in `e2e/fixtures/app.ts` so **every** spec inherits it for free:

```ts
page.on('pageerror',        e => recorder.push({ kind: 'pageerror',   text: String(e) }));
page.on('console', m => m.type() === 'error' && recorder.push({ kind: 'console', text: m.text() }));
page.on('crash',            ()   => recorder.push({ kind: 'crash' }));
page.on('requestfailed',    r   => recorder.push({ kind: 'netfail', url: r.url() }));
app.process().stderr.on('data', b => /* main-process uncaughtException / unhandledRejection lines */);
```

- Also inject, via `app.evaluate()`, main-process listeners for
  `process.on('uncaughtException' | 'unhandledRejection')` that push onto a global array readable
  through `app.evaluate(() => globalThis.__e2eMainErrors)`.
- `afterEach` → `expect(recorder).toBeEmpty()` with a formatted diff (first 20 entries, deduped).
- Whitelist file `e2e/fixtures/allowed-errors.json` for the handful of *legitimate* console errors
  (e.g. Sentry "no DSN configured", favicon 404), each with a comment and a review date.
- Cap the recorder at 200 entries to avoid OOM on a crash loop.

**Exit criterion:** add a temporary `throw new Error('x')` in a `useEffect` and watch every
affected spec go red.

**Result — DONE, exit criterion met.** Implemented as `e2e/fixtures/tripwire.ts` (recorder) plus
`e2e/fixtures/tripwire-setup.ts` (hooks), registered through `setupFiles` in both
`e2e/vitest.e2e.config.ts` and `e2e/vitest.e2e.real.config.ts` so no spec has to opt in. What the
plan sketched and what shipped differ in four places worth recording:

- **The listener side is attached in `launchApp`, not in the setup file.** The app is launched from
  a spec's `beforeAll` and may be relaunched mid-file, so `attachTripwire(app)` re-registers on
  every launch and on every `reloadSession`. The *assertion* side has to be registered during
  collection, which is why the two halves are separate modules.
- **`app.evaluate()` is not enough on its own.** The main-process listener function is serialised
  by Electron, so it cannot close over anything; it pushes onto a global on the main side and
  `takeTripwireEntries` drains that global through `app.evaluate` at assertion time. A stderr
  scanner is kept alongside it because a fault that kills the main process before `evaluate` can
  round-trip only ever shows up on stderr.
- **Severity is three-tier, not two.** `ENCODEX_STRICT_TESTS` is `0`/unset → `crash`
  (`pageerror`, renderer `console.error`, page crash, main uncaught/rejection, `mainStderr`),
  `1` → adds console warnings, `2` → adds `appWarn`. `netfail` is report-only at every level
  because a teardown race produces one reliably and failing on it would be noise.
- **Faults recorded between tests are kept, not dropped.** The first implementation marked them
  `stale` and then cleared the array anyway, which silently discarded every fault raised while the
  app was booting in `beforeAll` — the single most valuable place for the tripwire to look. Caught
  by a probe: a `console.error` at renderer module scope made all four `logs.spec.ts` tests red with
  `(recorded between tests)`, where the previous version reported nothing at all.

Verified: a temporary `throw new Error('ADVERSARIAL-TRIPWIRE-PROBE')` in
`src/renderer/pages/Convert.tsx` turned 10/10 convert tests red; probe reverted, renderer rebuilt,
Tier A 154/154 (2 skipped) and Tier B 9/9 green with the tripwire active. B8 and B9 came out of
this phase.

### 0.3 Typecheck the tests — new `tsconfig.test.json` — **DONE**

- `extends: ./tsconfig.json`, `include: ['src/**/*.{test,spec}.{ts,tsx}', 'e2e/**/*.ts', 'perf/**/*.ts']`,
  `types: ['vitest/globals', 'node']`, `noEmit: true`, `paths: { '@shared/*': ['src/shared/*'] }`.
- Add `typecheck:test` to `npm run typecheck` and to the CI `typecheck` job.
- Resolve the missing `paths` for `@shared` in the base config (today only Vite/Vitest know it).
- Add a separate, non-blocking `tsconfig.e2e.json` for `e2e/` (CommonJS `require` in
  `e2e/mocks/*.js` is fine since those stay `.js`).

**As built, with the deviations that actually happened:**

| Decision | Draft said | Built | Why |
|---|---|---|---|
| `tsconfig.test.json` include | brace globs | explicit `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` | TypeScript does not expand `{a,b}` in `include`/`exclude`. The drafted pattern matched **0 of 191** test files, so the first `tsc` run "passed" with an empty program. A file comment in the config records the trap. |
| Ambient declarations | not mentioned | included `electron-api`, `vite-env`, `mui`, `simple-icons`, `ffprobe-static` `.d.ts` explicitly | Without them the run reports **450** errors, nearly all ambient-type-not-found noise, which hides the 54 real ones. |
| `@shared/*` paths | add to base config | not added | `@shared` has zero TypeScript imports repo-wide. Adding a path mapping for an alias nothing uses is cargo-culting. |
| `perf/**` | in `include` | left out, routed to 0.6 | The body already assigns `perf/**` its own `tsconfig.perf.json` in 0.6; duplicating it here would create two homes for one job. |
| `tsconfig.e2e.json` | separate, **non-blocking** | separate **and chained** into `npm run typecheck` | It surfaced 14 real e2e errors; all 14 were fixed rather than allowlisted, so there was nothing left to be non-blocking about. The whole 5-project chain runs in 38 s, well inside the `typecheck` job's 10 min budget. Revert the chain if e2e-only type rot later turns noisy. |

**Result:** 191 test files enter the program, 54 real errors, 0 remaining. `npm run typecheck`
now covers renderer + main + preload + test + e2e. `tsconfig.main.json` was already correct
(explicit `**/*.test.ts` / `**/*.spec.ts`, 0 test files in its program) and was left alone.

#### What the typecheck found: tests that asserted nothing

The phase surfaced **no production defects**. What it surfaced was worse in a way — a set of
tests that were green because they could not fail. These are the same disease as the `no-dom-prop-leak`
guard that "passed while the bug was present", so each is listed with why it was green:

- **`cli-remux.test.ts` passed a type-invalid disposition fixture.** `MediaStreamInfo.disposition`
  is `string[]`; the fixture passed the bare string `'attached_pic'`. It went green *by accident of
  JS semantics*: `'attached_pic'.includes('attached_pic')` is true, so the production
  `disposition?.includes(ATTACHED_PIC_DISPOSITION)` still fired. The test did reach the real code
  path, so this was weaker than the other entries here — but the fixture was only ever valid
  because nobody was typechecking, and `buildPrimaryStreamMaps` (which the GUI, CLI, and MCP all
  share) had **no direct coverage at all**.
  **Hardened:** direct `describe('buildPrimaryStreamMaps')` block in
  `src/shared/__tests__/remux-utils.test.ts` pinning ordinal numbering, cover-art position
  independence, and audio-ordinal isolation — plus the case that actually earns the test: a video
  whose disposition is `['default']` or `['forced_default', 'default']` must **survive**, which
  separates the real value check from the mutant `if (stream.disposition) continue`. ffmpeg marks
  ordinary tracks `default`/`forced_default` routinely, so that mutant would empty the default
  stream selection for real files, and the old two-video fixture could not see it.
  *Correction to an earlier draft of this note:* I first wrote that the old spec "would have kept
  passing if the real check were deleted." That was wrong. `buildPrimaryStreamMaps` maps **every**
  stream with a per-type ordinal, so deleting the check yields `['0:v:0', '0:v:1']` and the old
  assertion did fail. The real gap was the disposition-*value* check, not the skip's existence.
- **`cli-analytics.test.ts` compared against a nonexistent enum member.** Three specs asserted
  `ErrorCode.TRANSCODE_FAILED`, which does not exist, so both sides were `undefined`:
  `expect(undefined).toBe(undefined)`. Now `ErrorCode.CONVERSION_FAILED`, and the emitted
  `remux_failed` / `demux_failed` event carries `isAppError(err) ? err.code : undefined`, so the
  assertion has real content on both sides. Verified: stubbing that expression to `code: undefined`
  turns the remux spec red.
- **`job-queue.test.ts` round-tripped a fixture through fields that do not exist.** The "preserves
  options" spec used `chapters` and typed `additionalInputs` as a string. Because the round trip is
  a `JSON.parse`/`stringify` of a bag, the unknown keys came back out anyway, so dropping the fields
  the production code actually reads changed nothing the test could see.
  **Hardened:** even with real field names, `expect(restored.jobs[0].options).toEqual(options)` only
  proves `JSON.parse(JSON.stringify(x))` works — `save()` stringifies the whole snapshot and
  `load()` returns it with a blind cast. Added a second spec that closes the loop the user actually
  hits: persist, construct a **fresh** `JobQueue` so it restores, `start()` it, and assert on
  `convert`'s arguments. Stubbing `save()` to strip `additionalInputs` turns it red.
- **`profileStore.test.ts` claimed to load from `localStorage` on init** but there is no `init()` to
  call — it `setState`d the same values it had just serialized, so `loadCustomProfiles()` was never
  executed. The store builds `profiles: [...BUILTIN_PROFILES, ...loadCustomProfiles()]` at
  **module scope**, so the only way to reach the real path is to seed storage and re-import.
  **Hardened:** `importStore()` helper (`vi.resetModules()` + dynamic import) driving four specs — a
  genuine load, the `builtin === false` + string `id`/`name` filter that keeps a corrupt
  `encodex-custom-profiles` key from injecting junk profiles, corrupt-JSON fallback, and the
  `MAX_RECENT` cap on `encodex-recent-profiles`. Verified: removing the filter, and removing the
  `.slice(0, MAX_RECENT)`, each turn exactly one spec red.
- **`terms-gate.integration.test.ts` cast `Window` to a bridge stub** without the `unknown` hop. Against
  the real preload bridge that assignment throws at runtime; the cast was only "fine" because the test
  supplies its own partial stub.
- **`video-cut.spec.ts` did arithmetic on nullable `boundingBox()`.** Three unchecked calls; a timeline
  handle that failed to render produced `TypeError: Cannot read properties of null` rather than a
  sentence naming the handle. Replaced with a `boxOf(locator, label)` helper that throws a message.
- **`buildEnv` in `e2e/fixtures/app.ts` returned `NodeJS.ProcessEnv`** where Playwright wants
  `{ [key: string]: string }`. Now filters `undefined` entries instead of risking them reaching
  Electron as the string `"undefined"`.
- **`hwaccelMode: 'none'`** appeared in both a unit fixture and `batch.spec.ts`. `'none'` is not a
  member of `HwAccelMode` (`'auto' | 'encode'`). It never reached production because it is a
  test-only literal that the types correctly rejected and nobody was running the typecheck.
  **Hardened:** `getHwAccelArgs` already had thorough unit coverage in
  `src/main/transcoders/__tests__/hwaccel.test.ts`, including the auto-vs-encode-only split, so the
  gap was narrower than it looked: nothing exercised the setting *from the batch side*.
  `buildBatchOptions`' spec now walks all four `hardwareAcceleration` × `hwaccelMode` combinations
  and asserts the resulting ffmpeg flags, so a `buildBatchOptions` that dropped the user's setting
  can no longer hide behind a well-tested `getHwAccelArgs`. (The option passthrough itself was
  already pinned by 11 existing `toEqual` specs — a mutation hardcoding
  `hardwareAcceleration: false` turns all 12 red. The new spec's value is the end-to-end tie.)
- **Dead `TripwireState.strict`** in `src/test-utils/crash-tripwire.ts` — declared on an interface no
  producer ever set, so nothing caught it. Removed.

#### Every one of these was verified negatively

A green test that cannot go red is the whole problem, so each fix was mutation-tested: break the
production code, confirm the spec fails, restore. **8/8 caught.**

| # | Mutation | Specs that caught it |
|---|---|---|
| 1 | `buildPrimaryStreamMaps`: `if (stream.disposition) continue` | 2 (the ones the old suite could not see) |
| 2 | `buildPrimaryStreamMaps`: drop the `attached_pic` skip | 3 |
| 3 | `FileQueuePersistence.save`: strip `additionalInputs` | 2 |
| 4 | `cli-remux`: `remux_failed` stops carrying `err.code` | 1 |
| 5 | `loadPersistedState`: *hypothetical fix* enforcing `snapshot.version` | 1 (the gap pin — proves it is live, not decorative) |
| 6 | `loadCustomProfiles`: stop filtering corrupt entries | 1 |
| 7 | `loadRecentIds`: drop the `MAX_RECENT` slice | 1 |
| 8 | `buildBatchOptions`: hardcode `hardwareAcceleration: false` | 12 |

`npm run typecheck` 0 errors · `npm run lint` 0 errors · `npm run format:check` clean ·
2698/2698 unit tests (was 2686; +12 new).

#### B10: the queue snapshot version is written but never enforced

Found while hardening the `job-queue` round-trip, and **not fixed here** — it is a production
behaviour change, not a typecheck fix, so it needs its own decision.

- `QUEUE_STATE_VERSION` is written by `save()` and read by nothing. `load()` validates only
  `Array.isArray(parsed.jobs)` and then returns `parsed as QueueSnapshot`; `loadPersistedState()`
  pushes every entry straight into the queue.
- Consequence: a `queue-state.json` left by an older or newer build — or hand-edited, or truncated
  in a way that still parses as an object with a `jobs` array — is trusted wholesale. Jobs with
  wrong-shaped `options` reach `createTranscoder` and spawn ffmpeg with garbage arguments, and there
  is no migration or rejection path.
- `ignores a snapshot written by an unknown state version` in `job-queue.test.ts` documents the
  current behaviour *on purpose*: it asserts the future job **is** restored, so the day someone adds
  enforcement that spec goes red and the change is deliberate rather than silent. Flipping it to
  `toEqual([])` alongside the fix is the whole migration.
- Fix sketch: in `loadPersistedState`, `if (snapshot.version !== QUEUE_STATE_VERSION) return;`, plus
  a per-job shape guard (string `id`/`input`/`output`, known `transcoder`, object `options`) so a
  single bad entry is dropped instead of the whole queue being trusted. Not done unilaterally.

#### Housekeeping note for 0.6: `core.autocrlf` with no `.gitattributes`

Mutating files during the negative verification and restoring them with `git checkout --` left six
sources showing as modified in `git status` with **zero** changed lines in `git diff`. Cause: the
repo has `core.autocrlf=true` and no `.gitattributes`, so git expects CRLF in the working tree while
every blob is stored LF. `git checkout` normalises CRLF→LF, decides the file is unchanged, and
leaves the CRLF bytes on disk. A `.gitattributes` with `* text=auto eol=lf` is the real fix; it
touches every file's checkout behaviour, so it belongs in 0.6 rather than mid-phase.


### 0.4 Coverage: per-file floors + diff coverage

**Status: DONE (2026-09-30).** The floor is published as a report rather than enforced by enforced by
`thresholds.perFile`, and the diff gate is stricter than the original sketch in one respect: it
checks the lines the diff *added*, not just the file's percentage.

What was built:

| Piece | Where | Behaviour |
| --- | --- | --- |
| Shared coverage scope | `vitest.coverage-scope.ts` | One include/exclude list imported by **both** vitest configs. A union of two reports is only meaningful if both tiers measured the same file set. |
| Raw two-tier merge | `scripts/coverage-summary.mjs` | Unions `coverage-final.json` from `coverage/` and `coverage-integration/` via `istanbul-lib-coverage`. |
| Per-file report | `scripts/coverage-floor-report.mjs` | `npm run test:coverage:perfile`. Always exits 0. |
| Diff gate | `scripts/coverage-diff.mjs` | `npm run test:coverage:diff [base]`. Blocking. |
| CI | `.github/workflows/ci.yml` | `coverage-per-file` (`continue-on-error`) and `coverage-diff` jobs. |

**Both tiers must be measured, or the numbers lie.** The unit config excludes
`**/*.integration.{test,spec}.ts`, so a unit-only report shows the CLI and MCP sources this tier
exists to exercise as untested: `cli-batch.ts` 0.0%, `cli-info.ts` 0.0%, `mcp/http-server.ts` 3.2%.
Merged, those are 83.1%, 80.9%, and 83.9% - the difference between inventing work and not. Nine
files gain real coverage from the merge.

**Baseline (merged, both tiers):** 220 files measured, **30 below the candidate 80 lines / 70
branches floor**. The worst offenders are `src/mcp/index.ts` (0.0%), `src/mcp/run.ts` (11.1%), and
`src/main/mcp/settings-ipc.ts` (36.8%). The first two are entry points that only execute inside a
real MCP host, so 0% is expected rather than a gap. This is why the floor is a report and not
`thresholds.perFile`: 30 files fail it today, so enforcing it would block every PR until all are
addressed.

**The gate is per-file floor *and* added-line coverage.** A per-file floor alone is too weak for the
case that motivates it: adding eight untested lines to a 100%-covered file leaves it at ~86%, still
above an 80% floor. The gate therefore also requires that every added line the provider recorded as
a statement start was executed. Restricting to statement starts is what keeps it honest - braces,
comments, and multi-line statement interiors are not statements and must not be reported as
uncovered. Both directions were verified against `src/shared/remux-utils.ts`: an uncovered addition
was rejected (lines 209, 210, 212, 213, 215 flagged; braces 211, 214, 216 correctly not), and a
covered addition passed.

Four bugs were found and fixed while building this, each of which would have shipped a gate that
passed while reporting nonsense:

1. **A percentage-only merge reported 0 violators.** The first implementation rebuilt an istanbul
   map from `json-summary`'s covered/total pairs, inventing one statement per file. Every file came
   out 100% and the gate reported "0 violators". Fixed by merging the raw `coverage-final.json`, and
   `assertMergeIsSane` now asserts the merged file set equals the union of the input file sets and
   that per-file covered-statement counts never fall below an input's.
2. **`istanbul-lib-coverage` 3.2.2 mangles Windows keys.** It splits keys on `\` and `:`, so
   `C:\src\a.ts` parses as a nested tree; `files()` then returns 222 garbage single-character
   entries ('C', 's') instead of 220 files. Fixed by normalizing keys to repo-relative POSIX. The
   per-file `path` field must be rewritten too, because `toJSON()` rebuilds keys from it.
3. **The scoped run still enforced the global thresholds.** `vitest.config.ts` sets 85/75/80/85, and
   `--coverage.include` does not disable them, so gating a single file failed on the *global* numbers
   before the per-file floor was ever evaluated. The gate now zeroes the global thresholds.
4. **`execFileSync('npx', ...)` cannot execute `npx.cmd`** without a shell, so the gate failed
   instantly on Windows. It now runs `node_modules/vitest/vitest.mjs` through `process.execPath`.

A first attempt at `assertMergeIsSane` asserted that a union cannot exceed its best input. That is
false for *percentages*: v8 emits a different `statementMap` per run depending on which functions
were loaded, so a file's line set is not stable across tiers and the union can legitimately land
above both. The invariant now runs on absolute statement counts, which are stable.

**Two config files must stay in step.** `vitest.integration.config.ts` had no `exclude` list, so the
integration tier was measuring `src/mcp/__tests__/test-helpers.ts` and naming it an uncovered
"source file". `test:coverage:diff` mirrors `COVERAGE_EXCLUDE` in an `UNCOVERABLE` list so it never
gates a file that structurally cannot have a coverage number.

**Housekeeping pulled forward from Phase 0.6.** Added `.gitattributes` with `* text=auto eol=lf`.
`core.autocrlf=true` with no `.gitattributes` checked files out as CRLF while the index and Prettier
(`endOfLine: lf`) both expect LF, which made the blocking `format-check` CI job fail on six files
nobody had edited and showed phantom ` M` entries with an empty `git diff`. After this, those six
files are `i/lf w/lf` and clean.

Also un-excluded nothing: `src/main/**` and `src/preload/**` were already in scope, so that item
needed no change.

### 0.5 Flake governance

- `test:flake-detect` — runs `test:e2e:ci` 3× and diffs results into `reports/flake.json`.
- CI fails when a spec's failure rate across the 3 runs is in (0, 1) — i.e. *sometimes* fails.
- Introduce `e2e/quarantine/` (excluded from the default glob) + `quarantine.json` with
  `{ spec, issue, addedOn, expiresOn }`. Entries older than 21 days fail CI. No silent `.skip`.

**Status: DONE (2026-09-30).** The rule that decides whether a build passes is a pure, unit-tested
function; the process-spawning part is a thin wrapper around it.

| Piece | Where | Role |
| --- | --- | --- |
| `analyzeRuns` (pure) | `scripts/flake-report.mjs` | Failure-rate and quarantine verdicts |
| `toRunResult` (pure) | `scripts/flake-report.mjs` | Vitest JSON report → observed/failed sets |
| CLI runner | `scripts/flake-detect.mjs` | Spawns N runs, aggregates, writes the summary |
| Tests | `scripts/__tests__/flake-report.test.mjs` | 19 tests over the verdict rules |
| Quarantine | `e2e/quarantine.json`, `e2e/quarantine/` | Time-limited, issue-linked exemptions |
| CI | `.github/workflows/ci.yml` → `test-flake` | `needs: [build]`, 3 passes under xvfb |

**`--retry=0` is the load-bearing detail.** `e2e/vitest.e2e.config.ts` sets `retry: 2` in CI, which
is correct for a normal run (one retry absorbs a slow Electron boot) and precisely wrong for flake
detection: it turns a one-in-three failure into a green result. The detector disables retries and
judges the per-attempt outcomes itself.

**A non-zero exit from an individual run is expected, not an error.** A flaky spec may fail in run 1
and pass in runs 2 and 3, so the spawn failure is recorded rather than thrown; the verdict is only
formed once all runs are read. `analyzeRuns` also *refuses* fewer than 2 runs, so a misconfigured
single-iteration invocation fails instead of reporting a clean bill of health.

**Verdicts are distinguished, not lumped together.** `flaky` (0 < failures < runs) and `stable-fail`
(fails every run) both fail the build, but they are different problems needing different triage, and
`partial` - a spec observed in only some runs - is reported separately, because a suite that
intermittently does not run a spec is as broken as one that intermittently fails it.

**Quarantine cannot become a graveyard.** An entry names either a whole spec file or an exact
`file::describe > it` identifier, and matching is exact: a substring rule would let a typo quietly
exempt a *different* test, which is the "silent skip" this phase exists to prevent. A lapsed entry
fails the build *and* stops exempting its flake, so a forgotten entry cannot outlive its 21 days
while still hiding a failure. An entry matching no test is a failure too, so entries cannot outlive
the fix they were written for.

Verified end-to-end against a deliberately flaky throwaway spec (1 failure in 3 runs): unquarantined
→ exit 1 naming the spec and rate; with a live entry → exit 0; with an entry dated 2026-07-01 →
exit 1 reporting both the flake and the lapsed entry. The analysis rules were mutation-tested - six
mutations (never call anything flaky, skip the lapse check, substring matching, skip the partial
check, never flag stale entries, allow a single run) each failed at least one test.

**One robustness fix worth recording:** the first version crashed on a `e2e/quarantine.json` written
by PowerShell's `Set-Content -Encoding utf8`, which emits a UTF-8 BOM that `JSON.parse` rejects.
That file is hand-edited, so a BOM is the *expected* input on Windows, not an edge case. Reads now
strip a leading BOM. The bug was found by the self-test, not by inspection.

### 0.6 Housekeeping debt

- Add `perf/**` and `eslint-rules/**` to the Prettier globs and to a `tsconfig.perf.json` typecheck.
- Replace the 30 s `getMainWindow` poll with a 30 s *budgeted* poll that records actual boot time and
  fails a perf assertion if boot exceeds the `perf/baseline.json` budget by 25%.

#### Delivered

| Item | Where | Notes |
|---|---|---|
| Prettier globs | `package.json` → `format`, `format:check` | `perf/**/*.{ts,tsx}` + `eslint-rules/**/*.mjs` |
| Typecheck | `tsconfig.perf.json`, `typecheck:perf` | Chained as the 6th project in `typecheck` |
| Boot accounting | `e2e/fixtures/app.ts`, `e2e/fixtures/boot-budget.ts` | `AppSession.bootMs`; 30 s ceiling kept |
| Assertion | `e2e/specs/boot-budget.spec.ts` | Median-of-3 vs platform budget +25% |
| Budget | `perf/baseline.json` → `e2e.bootBudgetMs` | `win32-x64: 2500` |
| Unit tests | `e2e/fixtures/__tests__/boot-budget.test.ts` | 31 tests over the verdict rules |

**Typechecking `perf/` immediately found a live bug, which is the whole argument for doing it.**
`perf/vitest.perf.config.ts` set `forks: { execArgv: ['--expose-gc'] }`. Vitest 4 removed that
sub-object, so `forks` was an unknown key that is *silently ignored* - not an error - and `--expose-gc`
never reached the workers. `memory-leak.perf.test.ts` and `large-file.perf.test.ts` both call `gc()`
behind `if (global.gc)`, so nothing crashed: the memory tests were measuring uncollected garbage and
reporting a pass. Confirmed both directions with a probe spec - `typeof global.gc` was `undefined`
before the fix and `function` after. Vitest 4 accepts `execArgv` directly on `test`.

**A malformed budget throws; an absent one does not.** `perf/baseline.json` is hand-edited, so a
typo'd `bootBudgetMs` must not quietly disable the gate - `parseBootBudgetMs` rejects 0, negative,
`NaN`, `Infinity`, strings, and objects. A platform with *no* budget returns `no-budget` and the spec
reports and skips, because `baseline.json` only ever contains data for the platform that generated it.
Enforcing a threshold lifted from a different machine class would be worse than no gate at all. Note
that `scripts/perf-compare.mjs --generate` rewrites the file; it merges into the existing
`platforms[key]`, so the hand-written `e2e` section survives regeneration.

**The measurement is a median of 3 launches, not one, and the first attempt showed why.** A single
sample on this machine spanned 1907-3434 ms for an unchanged binary - antivirus and page-cache warm-up
alone exceed the 25% tolerance, so a single-sample gate flaps red constantly and gets ignored, which is
F11 with a different symptom. `boot-budget.spec.ts` launches 3 times and compares medians, matching the
`medianMs` convention `baseline.json` already uses. Observed medians: 1639, 1725, 2115, 2452 ms.

**The budget is set from the worst observed median (2500 ms → fails above 3125 ms), not the best.** At
the plan's first-pass value of 2100 ms the gate passed, but with only 7% headroom over the worst
observed median, which is a flake factory. The budget is per machine class and must be re-measured,
never copied across platforms.

**Boot cost fails one named spec, not 15.** Boot time is as much a property of the machine as of the
app, so a duration threshold inside every functional spec would turn a busy runner into a wall of
unrelated red. The harness records the boot once; only `boot-budget.spec.ts` asserts on it, so a red
run reads as "boot regressed" instead of "media-info failed". The failure message prints every sample
so a noisy run is diagnosable from CI output alone.

31 unit tests cover the verdict rules, mutation-tested: six mutations (tolerance 0.25→0.5, inclusive
`<=` → `<`, dropping the `undefined` budget case, malformed-budget → `null`, the 30 s ceiling, the
platform-key separator) each failed at least one test. `median()` is pinned separately against
empty input, even-length averaging, order independence, and caller-array mutation.

Gates after 0.6: typecheck 6/6 projects clean; lint 0 errors (1 known `no-autofocus` warning);
`format:check` clean; unit 189 files / 2748 tests; integration 4 files / 50 tests; e2e Tier A 155
passed + 2 skipped, Tier B 9/9.

---

## Phase 1 — Contract & input fuzzing (property-based)

New dev-dep: **`fast-check`**. These target the pure logic where crashes are cheap to trigger and
expensive to find by hand.

| Target | Property / attack | Location |
|---|---|---|
| Queue import | `parseQueueExport`/`validateQueueExport` must never throw, never return a job with a prototype-polluted key, and cap job count | `src/main/queue/queue-transfer.ts` (123 lines tested) |
| Error mapping | `formatError` must return a non-empty string for **any** `unknown` input (strings, `null`, `undefined`, symbols, BigInt, cyclic objects, thrown classes with/without `code`, `AggregateError`) | `src/shared/errors.ts` |
| Validation | `validate*` never throws; always boolean; never mutates input | `src/shared/validation.ts` |
| Math/progress/estimate | No `NaN`/`Infinity` in output for any non-negative finite input; no divide-by-zero | `src/shared/math.ts`, `progress.ts`, `estimate.ts` |
| Formatters | Never throws; never returns `NaN`/`undefined` bytes or `Invalid Date` | `src/renderer/utils/formatters.ts` |
| Path utils | `deriveOutputPath`, `resolveOutputPath`, `path-utils` never escape the intended dir for adversarial stems: `..`, `../..`, `CON`, `NUL`, `\\\\?\\C:\\x`, 32k-char names, `/`, `\\`, `:` , trailing dots/spaces (Windows), reserved device names, unicode RTL-override | `src/renderer/utils/path-utils.ts`, `src/main/cli/cli-util.ts` |
| i18n | Interpolation with missing/extra/malformed `{{x}}` tokens never throws and never leaves `{{}}` in the output; keys with `__proto__` don't leak | `src/renderer/i18n/config.ts` |
| Store persist | Every one of the 18 zustand stores rehydrates from adversarial localStorage JSON without throwing: `null`, `"undefined"`, `[]`, `123`, `{"__proto__":{...}}`, 5 MB string, old schema version, missing keys | `src/renderer/stores/*` |
| Shortcuts | `parseShortcut` never throws on any string; `shortcutMatches` never matches a bare modifier | `src/renderer/constants/shortcuts.ts` |
| Codec/container | `canContain`, `getCodecSupport` etc. never throw on unknown container/codec pairs | `src/shared/codec-containers.ts` (660 lines) |

**Pattern:** every table row becomes a `fast-check` property test plus a fixed regression seed
(`fc.assert(prop, { seed: 12345, path: 'repro.txt' })` committed on failure).

---

## Phase 2 — Media / byte-level fuzzing (real FFmpeg, real files)

Runs in a new suite `test:media-fuzz` against the *real* ffmpeg-static binary. Corrupt-file handling is
the #1 real-world crash source for a media tool and is currently untested.

**Corpus generator** (`e2e/fixtures/corpus/generate-corpus.ts`):
- Truncation sweep: each of `mp4 / mkv / webm / mov / avi / jpg / png / gif / flac / mp3 / srt / ffmeta`
  cut at 0, 1, 2, 8, 64, 512 bytes and at 1%/5%/25%/50%/99% of length → **~100 files**.
- Extension/content mismatch: MKV bytes named `.mp4`, JPEG bytes named `.mkv`, 8 KB of zeros named
  `.mp4`, valid MP4 header + 1 MB of random bytes.
- Header-aware corruption: flip 1 random bit per byte in the first 512 bytes (50 variants each).

**Test matrix** (each must degrade gracefully, never hang, never crash the process):

| Path under test | Assertion |
|---|---|
| `getMediaInfo` (`ffprobe-mapper.ts`) | Resolves to an error or `null`; never throws; never returns `duration: NaN` |
| `getVideoPreview` / `getImagePreview` / `getImageFileInfo` | Same |
| `getImageInfo` (`image-info.ts`, EXIF via `exifr`) | No OOM, no `computeHistogram` NaN, no crash on a 60k×60k PNG |
| `extractWaveform` / `extractThumbnails` (`timeline-media.ts`) | Terminates within 10 s; returns `null`, not garbage |
| `getCapabilities`, `convertFile`, `queueAdd` | Reject with a `formatError`-shaped error |

**Hangs are bugs:** every spawn in `src/main/**` is wrapped by a new `withTimeout` helper
(`process-utils.ts:128` currently has suspend/resume/kill helpers but no spawn watchdog). Add
`it('does not hang on <file>', { timeout: 15_000 })` and a global `execArgv`-free kill on teardown.

**EXIF bombs** (hand-built TIFFs, no ffmpeg needed):
- IFD offset pointing outside the buffer; `IFDNext` cycle (A→B→A); 65k entries; negative
  `IFDCount`; `x`/`y` = 0xFFFFFFFF; strip byte-length 0xFFFFFFFF (forces a huge alloc);
  `Photoshop` IRB with a 4 GB declared length.

**`frame-decoder.ts` decoder fuzz** (pure, fast, no process): feed 10,000 random `Buffer`s plus
structured bad cases (odd byte length, length % bpp != 0, length 0, length 1, 64 MB buffer) into
`rawvideo` and PCM decode paths. Assert: no throw, no out-of-bounds read, output length never exceeds
input-derived bounds, no `NaN` samples, and **memory does not grow** (measure with `process.memoryUsage()`
across the run in a `perf`-style test).

---

## Phase 3 — IPC contract & abuse testing (the real main process)

This is the largest coverage hole: 13 of 14 Tier A specs replace the entire main process with a mock.

### 3.1 Channel inventory test

New `src/main/ipc/__tests__/channel-contract.test.ts`:
- Import `registerIpcHandlers` with a fake `ipcMain` that records every channel → build the
  authoritative set.
- Diff it against the union of channels in `src/shared/ipc-channels.ts` **and** every `on*` method in
  `src/preload/index.ts` and `src/renderer/electron-api.d.ts`.
- **Fail on any drift in either direction.** This alone kills the F5 class of bug permanently.
- Add a `data-testid`-style lint that every channel constant has a matching `ipcMain.handle`.

### 3.2 Handler abuse harness

New `e2e/specs/ipc-abuse.spec.ts`, launched with `mock: false` (real preload + real main), driving
handlers through `app.evaluate(() => require('electron').ipcMain)`:

- Call **every** registered handler with: no args, `undefined`, `null`, `0`, `''`, `NaN`,
  `'../../../../etc/passwd'`, a 1 MB string, a 10k-element array, a 200-key object, an object with
  `__proto__` / `constructor` / `prototype` keys, a frozen object, a Proxy that throws on every get.
- **Assertion:** the process does not emit `uncaughtException` (via the Phase 0 main-process
  recorder), the window stays alive (`isPageAlive`), and any rejection is an `Error` with a
  `formatError`-producible message — never a raw `TypeError: Cannot read properties of undefined`.

### 3.3 Event-channel abuse

New `e2e/specs/ipc-events.spec.ts` — main emits **every** `on*` channel with: garbage payload, `null`,
wrong-shaped object, 10k-element arrays, and 5 MB blobs, at 100 Hz for 2 s, while the renderer is on
each of the 12 routes. Assert: no `pageerror`, no crash, and the app stays interactive.

### 3.4 The "hostile preload" E2E suite (highest value-per-hour in this plan)

New `e2e/mocks/hostile-preload.js` + `e2e/specs/hostile-bridge.spec.ts`. Launch with
`ENCODEX_HOSTILE_MODE=<mode>`, and the mock preload makes **every** `electronAPI` method:

| Mode | Behaviour |
|---|---|
| `reject-sync` | throws synchronously |
| `reject-async` | returns a rejected promise with a random `Error` shape |
| `never` | returns a promise that never settles (tests loading/timeout UX) |
| `wrong-type` | resolves the right *kind* of value with a wrong shape (`null` where an object is expected, array where object, string where number) |
| `garbage` | resolves 1 MB of random bytes / deeply nested cyclic object |
| `partial` | 30% of methods work, 70% fail — the realistic partial-failure case |

Then walk all 12 routes and, for each, run the primary user journey. **Assertion for every case:**
no `pageerror`, an `ErrorBanner`/`ErrorSnackbar` is shown, navigation still works, and a recovery
action (retry / reselect file) succeeds once the mode flips to `partial`-healthy. This is the suite
that will find most of the real "unhandled exception" reports.

---

## Phase 4 — State machines, lifecycle & races

| Area | Attacks |
|---|---|
| **Queue** (`job-queue.ts`, 638 lines) | Illegal transitions: `done→running`, `error→running`, cancel-during-completion, `queueMoveTo` out-of-range index, `queueUpdateOptions` on a `done` job, 200 concurrent `queueAdd`s writing the **same** output path, `queueImport` while running, `concurrency: 0` / `99` |
| **Conversion lifecycle** | `convertFile` → `cancelConversion` before spawn resolves; `pause` mid-progress; `resume` after `done`; `cancel` twice; close window mid-conversion then relaunch and assert recovery |
| **Reload/quit** | Reload the renderer 50× mid-conversion; quit the app mid-update-download; kill the main process mid-queue and relaunch against the same userDataDir — assert the persisted queue is valid and the app starts |
| **Zustand persist** | 18 stores × adversarial localStorage (Phase 1) + `localStorage.setItem` throwing (quota) + `migrate()` throwing → app must not white-screen |
| **Timers/listeners** | `vi.useFakeTimers()` + `vi.getTimerCount()` after unmount must be 0; mount/unmount `MediaPlayer`, `VideoTimeline`, `BatchQueue` 100× and assert listener counts (`window`, `document`, `BroadcastChannel`, `ResizeObserver`) return to baseline — the classic Electron memory leak |
| **React 19 StrictMode** | Every page test double-renders under `<StrictMode>`; the app already runs StrictMode in dev and this is untested |
| **Race harness** | A reusable `deferred()` util + `Promise.race` timeouts so every "eventually" is a bounded assertion, not a `waitFor` that silently passes |

---

## Phase 5 — UI robustness, i18n & accessibility

### 5.1 Locale matrix (F7)
- New `src/renderer/__tests__/i18n-matrix.test.tsx`: for **each of the 56 locales**, render all 12
  routes and assert (a) no `pageerror`, (b) no raw `{{token}}` in `document.body.textContent`,
  (c) no raw translation key (`foo.bar.baz`) rendered as literal user-visible text.
- RTL suite: `ar-AE`, `he-IL`, `fa-*` — assert `dir="rtl"`, drawer/player/timeline mirror, and that
  keyboard shortcuts still fire.
- Longest-string stress: load `de-DE` + a 3× synthetic pseudo-locale to force overflow/clipping.
- Keep the existing `scripts/validate-locales.mjs` and add a **test-time** variant so CI catches a
  broken locale JSON without a separate job.

### 5.2 Missing-degradation render tests
- Render every page with `window.electronAPI` **deleted** (simulates a preload failure — a real
  crash class in Electron when `contextIsolation` misconfigures).
- Render every page with `getMediaInfo` resolving `{}` (empty object) and with `streams: []`.
- Render `BatchQueue` with 5,000 jobs and `Logs` with 50,000 log lines — assert render time and that
  the UI stays responsive (`performance.now()` budget).

### 5.3 Accessibility & keyboard
- Run `assertNoAxeViolations` on **all 12 pages**, in light + dark, at `320 / 768 / 1440` widths
  (today it is applied ad hoc in some tests only). Enable the currently-disabled rules in
  `src/test-utils/axe.ts` (`color-contrast`, `region`, `landmark-one-main`, `scrollable-region-focusable`)
  for the pages that pass.
- Keyboard-only smoke per page: `Tab` through the whole route, `Shift+Tab` back, `Enter`/`Space`
  activates, `Esc` closes every dialog, focus returns to the trigger on close (assert on
  `document.activeElement`), and no focus trap leaks.
- `axe-core` injected into the **E2E** renderer via `addInitScript` for a Tier A a11y spec.
- Hotkey conflicts: assert no two entries in `SHORTCUTS` bind the same chord, and that the 60+
  shortcuts don't fire while typing in a text field or a `<select>`.

---

## Phase 6 — CLI & MCP hostile input

### 6.1 CLI (`e2e/cli.spec.ts` currently 61 happy-path assertions)
New `e2e/specs/cli-hostile.spec.ts`, asserting **exit codes, stderr shape, and no stack traces**:
- argv fuzzing: 10,000 args, `--` injection, `-` prefixes as values, `=`-less flags, repeated flags,
  unicode/NUL/emoji/ANSI-escape filenames, RTL-override filenames, filenames of 32,000 chars,
  `--format=../../etc/passwd`, `--output=/`, `--output=C:\`, `--overwrite` on a directory.
- Missing/empty values: `--input ""`, `--output`, `--format` (no value) → must be a usage error (exit 2),
  never a crash.
- Invalid values: `--quality 999`, `--scale -1`, `--bitrate abc`, `--time -5:xx`,
  `--concurrency 0`, `--timeout -1`, `--concurrency 1e9`.
- Non-existent input, input that is a directory, input with no read permission, output dir that is
  read-only, **disk-full simulation** (output to a 1 KB tmpfs / a full loop device where available).
- Signals: `SIGINT` / `SIGTERM` mid-convert → clean exit code, no orphaned ffmpeg process
  (assert with `ps` / `tasklist`).
- Every error path must print a single-line human message, never a Node stack trace.
- Exit-code map test: assert the full `--help` output parses and every documented exit code is
  reachable (this catches help-text drift, which is a real support burden).

### 6.2 MCP (21 tools, 2 transports)
New `src/mcp/__tests__/hostile.integration.test.ts` + `e2e/specs/mcp-http-hostile.spec.ts`:
- stdio: malformed JSON-RPC (truncated, wrong `Content-Length`, invalid UTF-8, 10 MB body), unknown
  method, wrong param types against every zod schema, missing required fields, extra fields,
  prototype-polluting keys.
- Tool args that try path traversal (`../../`, absolute `C:\`, symlink escape, UNC `\\server\share`)
  and shell metacharacters; assert the transcoder spawns with argv (never `shell:true`) and that
  writes stay inside the intended directory.
- Concurrency: 20 simultaneous `start_conversion` jobs; cancel mid-flight; `get_job_status` on an
  unknown id; job-id path traversal.
- HTTP server: missing/incorrect bearer token, token in the query string, `Origin` not localhost,
  bind attempt on an already-used port, request body over the limit, 100 concurrent connections,
  server shutdown with in-flight jobs. **Assert nothing is exposed on a non-loopback bind.**
- `MCPJobManager` under 1,000 rapid start/cancel cycles → no unbounded array growth, no double-free.

---

## Phase 7 — Updater & network hostility

`src/main/updater.ts` is 481 lines with GitHub-Releases parsing, download, and install. New
`src/main/__tests__/updater-hostile.test.ts`:
- Malformed `releases/latest` JSON: not an object, missing `assets`, `assets: null`, asset with no
  `name`, asset name with `..` / `../..` / absolute path / NUL, duplicate names, 5,000 assets,
  `size: -1`, `size: 2^53`.
- Redirect to a different host (must refuse), non-HTTPS URL, `http://` scheme, 3xx loop.
- Content-Length mismatch, truncated download, download that is an HTML error page served as 200.
- Disk full mid-write, output path not writable, `.exe`/`.dmg` file locked by another process.
- Offline mid-check, DNS failure, 500/403/404/429 with `Retry-After`.
- Timer storm: `checkForUpdates` called 1,000× concurrently → exactly one in-flight check.
- Assert the update flow never writes outside the app's update dir (a real arbitrary-write risk).

---

## Phase 8 — Resource limits & denial-of-service

| Scenario | Budget / assertion |
|---|---|
| 100,000 files dropped on a folder (`expandPaths`/`collectMediaFiles`) | completes < 5 s, no OOM, UI stays responsive |
| 10,000 jobs in the queue, concurrency 8 | scheduler doesn't starve, memory < 500 MB delta |
| 1,000-filter video filter chain | parsed, validated, previewed < 200 ms; ffmpeg argv stays under the OS limit |
| Catastrophic-backtracking regex in `ffmpeg-utils` / `video-filters` / `formatters` | a 100 KB adversarial input must not hang > 1 s (add a regex-scan CI step) |
| 100 MB SRT / 10 MB JSON queue export | parse time and memory bounded |
| 20 GB sparse file (truncated seek) | no full read into memory |
| 1,000 rapid route changes during a conversion | no leaked listeners, no state corruption |
| 10,000 rapid clicks on Convert | exactly one job created (double-submit guard) |

---

## Phase 9 — Mutation testing (the actual "offensive" instrument)

Without this, all of Phases 1–8 can be theatre: assertions that pass regardless of the code.

- New dev-dep **`@stryker-mutator/core`** + `vitest` runner.
- `npm run test:mutate` scoped to the logic that decides *what ffmpeg runs* and *what is stored*:
  `src/shared/{errors,validation,math,progress,estimate,codec-containers,video-filters,remux-utils}.ts`,
  `src/main/transcoders/{ffmpeg-utils,ffprobe-mapper}.ts`,
  `src/main/queue/{job-queue,queue-transfer}.ts`,
  `src/renderer/stores/*.ts`, `src/renderer/utils/*.ts`.
- Config: `mutate: ['ConditionalExpression','LogicalExpression','ArithmeticOperator','ReturnValue','BlockStatement']`,
  thresholds `score: 80`, `break: null` initially.
- **Every surviving mutant on a money-path rule is a bug** and gets either a new test or an
  `// Stryker disable-next-line` with a comment explaining why.
- Gate in CI on a **score delta**, not an absolute number (so a PR can't regress mutation resistance
  while the backlog drains). Weekly job reduces the backlog.
- Same rationale applies to a smaller `msw`-free "contract snapshot" of the ffmpeg argv each
  transcoder produces — a snapshot change is a behaviour change and must be reviewed.

---

## Phase 10 — CI wiring, budgets & nightly chaos

### New CI jobs
| Job | Gate |
|---|---|
| `typecheck:test` | Blocks. Phase 0.3. **Live** — chained into `npm run typecheck`, so CI's `typecheck` job gates it |
| `typecheck:e2e` | Blocks. Phase 0.3. **Live** — chained into `npm run typecheck`; was drafted as non-blocking, but all 14 e2e errors were fixed rather than allowlisted |
| `test-strict` | Blocks. Unit+integration with `ENCODEX_STRICT_TESTS=1` |
| `test-fuzz` | Blocks. Phases 1 + 2, seeded corpus, 5 min budget |
| `test-ipc-abuse` | Blocks. Phase 3, ubuntu + windows |
| `test-mutation-delta` | Advisory for 4 weeks, then blocks |
| `test-locale-matrix` | Blocks. Phase 5.1 (ubuntu, 56 locales × 12 routes) |
| `flake-detect` | Advisory, posts a PR comment |
| `nightly-chaos` | Nightly: full corpus fuzz with a random seed, 3× e2e, 30-min soak, long-file, memory-leak re-run |

### Budgets to add to `perf/baseline.json` (regression-gated)
`boot_ms`, `max_rss_mb`, `queue_10k_ms`, `ipc_roundtrip_p99_ms`, `fuzz_seeds_per_min`.

### Release gate (`release.yml`)
Add a required `test-fuzz` + `test-ipc-abuse` + `test-strict` pass to the `validate-version` job so a
tag cannot be cut with a red adversarial suite. Also flip `npm audit` from
`continue-on-error: true` to blocking with a documented exception list.

---

## Cross-cutting protocols

**Bug-for-bug.** Every production crash report becomes: (1) a failing test at the lowest layer that
can express it, (2) a `// @regression <issue-url>` comment, (3) merged before the fix. Enforce with a
PR checklist item and a `regression-tests` label check in the PR template.

**No silent skips.** `test.skip` / `it.skip` / `describe.skip` / `page.route('**/*', abort)` in
specs require an inline `// eslint-disable-next-line no-restricted-syntax -- <issue-url>` and are
counted by a CI step that fails if the count grows.

**Every async assertion is bounded.** Introduce `withTimeout()` and forbid bare
`await new Promise(r => setTimeout(r, N))` in specs (there are many today) — those are where
hangs hide.

**Test data hygiene.** `e2e/helpers.ts` writes to `os.tmpdir()` but the repo has two orphaned
`e2e-media-*` dirs, so temp cleanup is leaky. Move all e2e artifacts under
`os.tmpdir()/encodex-e2e/<runId>` with a global `afterAll` sweep and a CI check for leftover dirs.

---

## Execution order & effort

| Sprint | Phase | Effort | Ships |
|---|---|---|---|
| **1** | 0.1–0.3 (tripwires + typecheck) + 0.6 | 3–4 d | CI suddenly catches real crashes. Expect a noisy first run — that is the point. Drain the noise before moving on. |
| **2** | 0.4–0.5 + Phase 1 (fuzz) | 4 d | `fast-check` suite, per-file coverage floor set from the week-1 report, flake detector |
| **3** | Phase 3 (IPC contract + abuse + hostile preload) | 5 d | The highest-yield suite. Expect a top-10 bug list. |
| **4** | Phase 2 (media fuzz) + 8 (resource limits) | 4 d | Corruption + DoS |
| **5** | Phase 4 (state/race/leaks) + Phase 6 (CLI/MCP) | 5 d | |
| **6** | Phase 5 (i18n/a11y/keyboard) + Phase 7 (updater) | 4 d | |
| **7** | Phase 9 (mutation) + Phase 10 (CI/nightly) | 4 d | Last, because it needs the assertions from 1–6 to be real. |

**Total ≈ 6–7 weeks** for one engineer, or ~3 weeks for two.

## Definition of Done

- [ ] `ENCODEX_STRICT_TESTS=1` is the default in CI; zero unhandled rejections across the suite.
- [ ] Every e2e spec fails on `pageerror` / `console.error` / renderer crash / main-process uncaught.
- [ ] Every file in `src/` has ≥80% statements and ≥70% branches; changed files are diff-gated.
- [ ] Zero `tsc` errors in test code.
- [ ] Every `ipc-channels.ts` constant is exercised by a real-handler test; drift fails the build.
- [ ] All 12 routes render in all 56 locales with no `pageerror` and no untranslated key.
- [ ] Corruption corpus: 100% of files produce a clean error, zero hangs, zero crashes.
- [ ] Mutation score ≥80% on the money-path modules, enforced as a non-decreasing delta.
- [ ] Flake rate <2% and no quarantined spec older than 21 days.
- [ ] `release.yml` cannot proceed on a red adversarial job.
