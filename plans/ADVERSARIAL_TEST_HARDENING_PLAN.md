# Adversarial Test Hardening Plan -- "Break EncodeX Before Production"

**Status:** In progress
**Branch suggestion:** `feat/adversarial-test-hardening`
**Scope:** unit (`src/**/*.test.ts(x)`), integration, e2e (Tier A + Tier B), perf, CI gating
**North star:** _No unhandled exception, unhandled rejection, renderer `pageerror`, or silent
`console.error` may reach a user in a shipped build. Every one of them must fail a build._

---

## Progress log

| Phase | Status | Verified |
|---|---|---|
| 0.1b Tripwire self-tests | **DONE**  | 19/19 in `src/test-utils/__tests__/crash-tripwire.test.ts` |
| 0.1c DOM prop-leak AST guard | **DONE**  | `src/renderer/styles/__tests__/no-dom-prop-leak.test.ts`, 47 style modules |
| 0.2 E2E renderer tripwire | **DONE**  | Tier A 154/154 (2 skipped), Tier B 9/9; `npm run lint` 0 errors; `npm run typecheck` clean; `npm run format:check` clean |
| 0.3 Typecheck the tests | **DONE**  | 191 test files in program; 54 real errors fixed, 0 remain; `npm run typecheck` clean (5 projects, 38s); 2686/2686 unit, Tier A 154/154, Tier B 9/9 |
| 0.4 Coverage: per-file floors + diff coverage | **DONE**  | Merged 2-tier report (220 files, **30 below the 80/70 candidate floor**, non-blocking); blocking diff gate with added-line coverage; 4 merge/scope bugs found and fixed |
| 0.5 Flake governance | **DONE**  | `test:flake-detect` runs e2e 3Ã— with `--retry=0` and fails on failure rate in (0,1), on partial runs, on lapsed/stale/**invalid** quarantine entries; 36 unit tests, 10 mutations caught; `test-flake` CI job. Sign-off audit closed two real holes: an undated **or typo-dated** entry exempted a test forever (`Date.parse` -> `NaN`, and `NaN <= now` is false), so the schema is now validated and malformed entries fail closed; `actionlint` 1.7.12 + shellcheck clean over all 7 workflows |
| 0.6 Housekeeping debt | **DONE**  | `perf/**` + `eslint-rules/**` in Prettier globs; `tsconfig.perf.json` wired as the 6th typecheck project; boot time recorded + asserted (median-of-3 vs `perf/baseline.json` budget +25%), 31 tests, 6 mutations caught. Typechecking `perf/` found Vitest 4 silently ignored `forks: { execArgv }`, so the memory tests had been measuring uncollected garbage |
| 1 Contract & input fuzzing | **DONE**  | 9 new property-test files, 162 tests, all 10 rows covered. **8 source bugs found and fixed** (`isValidTime` accepted `00:60:00`; `formatSize(Infinity)`/`formatDuration(NaN)`/`formatClockTime` rendered `'Infinity TB'`/`'NaNs'`/`'Infinity:NaN:NaN'`; `validateQueueExport` had no job cap; `formatError` threw on hostile objects; `isContainerCompatibleWithStream` threw on a streamless payload; the i18n test mock threw on a RegExp-metacharacter key). `deriveOutputPath` traversal and all 6 store rehydration readers proved already-safe (mutation-verified). Typecheck 6/6, lint 0 errors, format clean, unit 199/2911, integration 50/50, e2e A 155+2skipped, e2e B 9/9 |
| 2 Media / byte-level fuzzing | **DONE**  | `computeHistogram` fuzz; `FrameDecoder` fuzz (a **hang** that killed the process, fixed); subprocess watchdog `src/main/spawn-timeout.ts` (5 call sites); EXIF bombs -- parser hardened but **our** layer was not; generated real corpus behind `test:media-fuzz` (`vitest.media-fuzz.config.ts`), 6 tests against real ffmpeg; bugs fixed and mutation-verified |
| 3 IPC contract & abuse testing | **DONE** | 3.1 channel inventory **DONE** -- `src/main/ipc/__tests__/channel-contract.test.ts` (8 tests) validates every registrar + the preload declarations. 3.2 handler abuse harness **DONE** -- `e2e/specs/ipc-abuse.spec.ts` (`mock:false` real preload + real main). 3.3 event-channel abuse **DONE (2026-10-05)** -- `e2e/specs/ipc-events.spec.ts`; measured the ~650 ev/sec saturation ceiling (~150 clean). 3.4 hostile-preload E2E **DONE (2026-10-05)** -- `e2e/mocks/hostile-preload.js` + `e2e/specs/hostile-bridge.spec.ts` (14 tests; found 4 production defects, 2 of them white screens). **CI-gated (2026-10-06/07):** the Tier B sweep runs under the blocking `test-ipc-abuse` CI job on ubuntu + windows (real main, faithful surface; the cheaper unit-tier equivalent stays in `test-unit`) and is a hard `release.yml` gate. *Remaining:* none active |
| 4 State machines, lifecycle & races | **DONE**  | job-queue attacks (48 tests); ffmpeg-core cancel/race fixes; queue reordering guards; 4.4 hostile localStorage at boot and during render (11); 4.5 timer/listener/observer leaks (7); 4.6 React 19 StrictMode across all 12 pages (13); 4.7 race harness `deferred()` (20). Bugs Q1-Q10 addressed; mutations verified |
| 5 UI robustness, i18n & a11y | **DONE** | Harness in place and self-tested: `src/test-utils/page-render.tsx` (12 routes, 17 self-tests), `src/test-utils/axe.ts`, `src/test-utils/deferred.ts`. 5.1 locale matrix **LOCKED (2026-10-06)** -- `src/renderer/__tests__/i18n-matrix.test.tsx` renders all 12 routes in all 56 locales under the real i18next + a 7-locale non-English anchor + per-file integrity checks, gated by the blocking `test-locale-matrix` CI job (dedicated `vitest.locale-matrix.config.ts`, excluded from the shared unit tier). 5.1 RTL mirror **LOCKED (2026-10-06)** -- `src/renderer/__tests__/rtl-direction.test.tsx` asserts the shipped direction machinery: `useLanguageDirection` + `document.dir` round-trip, the `DirectionProvider`/`stylis-plugin-rtl` CSS mirror (physical prop flip), all 12 routes rendering under the rtl cache for the 4 shipped RTL locales (`ar-SA`, `ar-AE`, `ar-JO`, `he-IL`), and shortcuts firing identically in ltr/rtl. Timeline/drawer kept positional by design (finding F7-2, see 5.1). 5.1 longest-string stress **LOCKED (2026-10-06)** -- `src/renderer/__tests__/longest-string.test.tsx` renders all 12 routes under `de-DE` and a 3Ã— synthetic pseudo-locale (`xx-XX`, every value tripled at runtime with atomic `{{tokens}}`), asserting no page error / no raw token / no leaked key plus a >= 1.5Ã— aggregate-length anchor proving the stress reaches the DOM (visual clipping stays for the browser-tier suites). 5.3 axe matrix **LOCKED (2026-10-06)** -- `src/renderer/__tests__/axe-all-pages.test.tsx` runs axe in strict mode on all 12 routed pages in light + dark at 320 / 768 / 1440 (72 passes), each mounted inside the single `<main>` landmark the real app provides, gated by the blocking `test-a11y` CI job (dedicated `vitest.a11y.config.ts`, excluded from the shared unit tier). Findings fixed in product code: the Remux / Demux checkbox-column `<th>` violated `empty-table-header` and now carry a visually-hidden localized label (`src/renderer/utils/a11y.ts` `visuallyHidden`); the `th`'s own `aria-label` does NOT satisfy the rule, because axe's `has-text-content` reads subtree content, not the element's accessible name (verified empirically). A `heading-order` h1->h6 skip in `BatchEncodingPanel` was fixed by remapping `subtitle2` to `<h2>` via `variantMapping` (a `styled(Typography)` element drops the overridable `component` prop). The strict crash-tripwire's only fault in this suite is React's jsdom-only "not wrapped in act" warning, raised when MUI Collapse transitions settle during the async axe pass; it is declared with `expectCrash` and documented in the test. *Follow-ups (browser tier, live outside the unit tier):* the axe E2E sweep + browser focus-order probes; and the full 5,000-card job-card render (needs a ~6 GB jsdom heap; prescribed to the perf tier, see Known follow-ups). 5.3 keyboard smoke **LOCKED (2026-10-07)** -- `src/renderer/__tests__/keyboard-smoke.test.tsx` walks every routed page with `user.tab()` / `user.tab({ shift: true })`, asserting the browser focus order (computed against user-event's own selector, tabindex-sort, visibility and disabled semantics, including radio-group and `fieldset`/`legend` pruning) equals the mirror, `Shift+Tab` returns exactly reversed, and Tab on the last control exits to `<body>` (no trap). `src/renderer/__tests__/keyboard-shell.test.tsx` drives the real App shell: `Ctrl+/` opens the shortcuts dialog with focus owned inside it, `Esc` closes it and returns focus to the opener, `Space`/`Enter` activate controls, `Alt+<n>` dashboard navigation, and bare number shortcuts navigate only while the user is not typing. Conflict discipline: `src/renderer/constants/__tests__/shortcuts.test.ts` now asserts per-section chord uniqueness (a duplicate inside the live set would silently win over its sibling under first-match dispatch), global chords disjoint from every page section, distinct global/dashboard navigation targets, and section-prefixed ids. `src/renderer/hooks/__tests__/useHotkeys.test.tsx` data-drives the registry-wide typing guard: every bare-key chord stays silent inside `input`/`select`/`textarea` while every modifier chord still fires there. (Per-page `Enter`/`Space` *activation* probes were deliberately left to the shell tier -- clicking a generic page button risks mutating page state; the injected-E2E a11y spec remains for the browser tier.) 5.2 missing-degradation **LOCKED (2026-10-07)** -- `src/renderer/__tests__/missing-degradation.test.tsx` (26 tests): every routed page mounts with `window.electronAPI` undefined (preload failure), and the six file pages are driven through hostile `getMediaInfo` shapes (`{}` and valid-but-stream-less objects), asserting the picked path lands in each page's store, per-page error semantics (MediaInfo surfaces a user error, AudioExtract swallows probe failures by design), and fault-free renders under the strict crash-tripwire. Findings fixed in product code: `VideoCut.tsx` read `mediaInfo?.streams.find` on both the video and audio stream lookups (crashed on a missing `streams`); `FileSummary.tsx` read `info.streams.length` (threw on a `{}` probe even inside the boundary). Large-list render budgets live in `src/renderer/__tests__/big-list-budget.test.tsx`: 50,000 log rows render inside a 12 s budget, and 3,000 MUI job cards render inside 120 s with the collapse toggle staying responsive, gated by the blocking `test-big-lists` CI job (dedicated `vitest.big-lists.config.ts`, excluded from the shared unit tier). The full 5,000-card render needs a ~6 GB jsdom heap (over GitHub's 7 GB ubuntu runner) and is prescribed to the perf tier (row 8 pattern); the gate renders 3,000 cards at ~11-18 ms/card so a super-linear card regression still fails. |
| 6 CLI & MCP hostile input | **DONE**  | `e2e/specs/cli-hostile.spec.ts` (**17 E2E: usage errors, unknown `--preset`, bad argv, disk-full simulation, read-only output dir, input-is-a-directory, 32k-char filename, SIGINT-cancel**, 2026-10-06); `src/main/cli/__tests__/cli-argv-fuzz.test.ts` (5 fast-check parse-layer tests, 2026-10-06; `createCliProgram` extracted from `runCli`); `src/mcp/__tests__/hostile.test.ts` (29 unit, rewritten 2026-10-06 -- it had been 4 tests on literals that never imported `src/mcp/**`); `src/mcp/__tests__/hostile.integration.test.ts` (8 spawn-level stdio-frame tests, 2026-10-06). **MCP HTTP transport is DONE (2026-10-06)** -- new production module `src/mcp/http.ts`+`src/mcp/http-server.ts` (`node dist/mcp/http-server.js`, defaults to 127.0.0.1 + an auto-generated bearer token) plus `src/mcp/__tests__/http.test.ts` (23 unit, strict-clean) and `src/mcp/__tests__/http-hostile.integration.test.ts` (8 spawn-level: 401 auth, query-string token, non-loopback Host/Origin 403, 413 over-cap, 100-concurrent session cap never overflowed, EADDRINUSE exit 1, prompt SIGTERM). **CLI real-subprocess rows are DONE (2026-10-06)** -- stack-trace-free stderr contract enforced test-side, with product fixes in `logger.ts` (message-only console Errors unless `--verbose`), `errors.ts` (runtime ffmpeg failures -> `CONVERSION_FAILED`, `PERMISSION_DENIED` preserved), `cli-info.ts` (no duplicate `✖`), `cli.ts` (single-line `cliErrorMessage`). *Remaining for row 6:* CI jobs for the hostile suites. **CI jobs are DONE (2026-10-06)** -- the MCP stdio/http unit suites run in `test-unit`, the spawn-level MCP integration suites in `test-integration`, the CLI real-subprocess + hostile-input E2E rows in `test-e2e` (ubuntu + windows), and the media-corruption tier in a new blocking `test-fuzz` job (`npm run test:media-fuzz`, ci.yml) plus a nightly random-seed `nightly-chaos` run (`MEDIA_FUZZ_SEED=${{ github.run_id }}`, nightly.yml) |
| 7 Updater & network hostility | **DONE**  | `src/main/__tests__/updater-hostile.test.ts` rewritten as 62 real tests that drive `src/main/updater.ts` through mocked `electron` / `https` / `fs`. **13 defects found and fixed** (U1-U13 table below); the suite was then inverted so it now asserts the *refusing* behaviour instead of documenting the vulnerable one. Mutation-verified: `path.basename` on the download filename, `coerceOsString` in `autoInstallPendingUpdate`, and build-metadata stripping in `compareVersions` each break the matching test. Clean at `ENCODEX_STRICT_TESTS=2` |
| 8 Resource limits & denial-of-service | **DONE** | Committed Phase-8 budget suites (2026-10-06): `src/shared/__tests__/resource-budget.test.ts` (1000-filter refusal, worst-case chain under the 32k Windows argv limit, adversarial/budgeted parsing), `src/main/queue/__tests__/queue-import-budget.test.ts` (10 MB export parse, beyond-cap refusal, hostile 10 MB JSON bodies incl. 100k-deep nesting), `src/main/__tests__/media-scan-budget.test.ts` (30,000-file tree < 3 s + dedupe + 300-deep walk), `src/renderer/pages/__tests__/convert-click-budget.test.tsx` (10,000 rapid clicks -> exactly one job). All strict-clean at `ENCODEX_STRICT_TESTS=2`. **Completed (2026-10-07):** full-scale IO + scheduler budgets in `perf/phase8-io.perf.test.ts` (100,000-file scan 649 ms / +165 MB RSS under the 5 s / 200 MB rows, 20 GB sparse file scanned in 0.5 ms with no full read, 100 MB SRT remux plan 0.3 ms) and `perf/phase8-queue.perf.test.ts` (10,000 jobs at the concurrency-4 cap: add 14 ms, drain 3.5 s, +20.75 MB RSS, all jobs DONE - no starvation), joining the existing `test-perf` CI gate; plus the dedicated 1,000-rapid-route-change harness `src/renderer/__tests__/route-change-stress.test.tsx` behind its own blocking `test-route-changes` CI job (`vitest.route-change.config.ts`). The plan's concurrency-8 row exceeds `MAX_QUEUE_CONCURRENCY=4`, so the budget runs at the physical cap. **`lint-regex` CI step live (2026-10-07):** static ReDoS scan over the parsing money-path; first run caught + fixed two real super-linear regexes (`extractBearer` in `src/mcp/http.ts`, the matchMedia px stub in `src/test-utils/page-render.tsx`; see the Phase-8 status section) |
| 9 Mutation testing | **LIVE (2026-10-07)** | Stryker v10 + `@stryker-mutator/vitest-runner` installed; `stryker.config.mjs` mutates the Phase-9 targets (shared validation/math/ffmpeg helpers, `ffmpeg-utils`/`ffprobe-mapper`, `job-queue`/`queue-transfer`, renderer stores + utils) with five mutator families -- ConditionalExpression, LogicalOperator, ArithmeticOperator, BlockStatement, ArrowFunction, the babel-era mapping of the plan's list (v10 selects by exclusion); `npm run test:mutate` scores through the narrowed `vitest.mutation.config.ts`; delta gate `scripts/mutation-delta.mjs` fails when the score drops more than `MUTATION_DELTA` (default 2.0 points) below committed `mutation/baseline.json`; wired as the **advisory** `test-mutation-delta` CI job (plan: advisory 4 weeks, then blocks). ffmpeg argv contracts pinned by snapshot: `src/main/transcoders/__tests__/argv-contract.test.ts` (6 contract cases). A local attempt at the full run instrumented 6,060 mutants across the 49-file scope (confirms the ~6k-mutant scale; one runner, 6h at concurrency 4 is the plan) -- local disks are too small for the Stryker sandbox copy, so the first *completing CI run* records the baseline; the weekly `mutation-ratchet` workflow (2026-10-07) turns a green run's `--generate` output into the next committed baseline without ever lowering the floor. *Remaining:* commit the first full-run baseline + flip the job to blocking; drain survivors per "every surviving mutant on a money-path rule is a bug" |
| 10 CI wiring, budgets & nightly chaos | **LIVE (2026-10-07)** | Existing `typecheck` / coverage-diff / `test-flake` jobs were wired; `test-fuzz` + `nightly-chaos` **DONE (2026-10-06)** (blocking `test-fuzz` job, random-seed `nightly-chaos` in nightly.yml), `test-ipc-abuse` **DONE (2026-10-06)** (blocking, ubuntu + windows, real main), `test-locale-matrix` **DONE (2026-10-06)**, `test-a11y` **DONE (2026-10-06)**. **This row (2026-10-07):** perf budgets are regression-gated in `perf/baseline.json` on the win32-x64 reference (re-generated from a full local run; adds the phase-8 IO + 10k-queue budget rows, 47 tests total); the release gate is live in `release.yml` -- a tag cannot cut until `test-fuzz` + `test-strict` + `test-ipc-abuse` (built + real main, ubuntu + windows) are green, chained into `validate-version`; `npm audit` is now **blocking** via `scripts/audit-gate.mjs`, failing on any HIGH/CRITICAL advisory not in the documented exception list `scripts/audit-allowlist.json` (5 known advisories -- vite, @vue/server-renderer, source-map-js, @modelcontextprotocol/sdk, shell-quote/concurrently). *Remaining:* drain the audit exception list (each entry clears with its owning dependency's fix); nightly-chaos already runs on schedule  |

### Bugs the tripwire found (all fixed in the same change that surfaced them)

These were live in `src/renderer` and would have shipped. None had a failing test. | # | Bug  | Root cause | Fix  |
| B1 | Every page rendered an invalid `hasaside` DOM attribute  | `PageRoot` declared `$hasAside` but never filtered it; `styled(Box)` forwards all props | `shouldForwardProp` + transient prop  |
| B2 | `StreamDetails` leaked a `tone` attribute  | same, `$tone` | `shouldForwardProp` + transient prop  |
| B3 | `MediaPreview` leaked a `variant` attribute  | same, `$variant` | `shouldForwardProp` + transient prop  |
| B4 | `BatchQueue` leaked `$hidden` / `$gone` and React warned on every mount  | `AnimatedSection` used the `$` convention but omitted `shouldForwardProp` entirely | `shouldForwardProp`; same applied to `CondenseIcon`  |
| B5 | 32 tests let React state updates escape `act()`  | store mutations and async IPC probes drove updates outside the test's control | each update now driven inside `act()` / awaited via `findBy*`  |
| B6 | 4 `ProfileSelector` tests logged _"The current testing environment is not configured to support act(...)"_  | `user.type()` is already act-wrapped; the tests wrapped it in a second, outer `act()`, unbalancing React's act scope | removed the redundant outer `act()`  |
| B7 | `src/test-setup.ts` never set `IS_REACT_ACT_ENVIRONMENT`  | React's update accounting was partly disabled for the whole suite | set once in global setup  |
| B8 | Every page logged `Refused to load font ... violates Content Security Policy`  | Vite inlines the eight Roboto subsets as `data:` URIs, but the meta CSP had no `font-src`, so default-src blocked them | `font-src 'self' data:` in `src/renderer/index.html`, guarded by `src/renderer/__tests__/csp.test.ts` |
| B9 | `src/main/__tests__/index.test.ts` leaked 10+ live `uncaughtException` / `unhandledRejection` listeners into the shared test process | `src/main/index.ts` calls `registerProcessCrashHandlers()` at module scope and the spec re-imports it in nearly every test after `vi.resetModules()` | `afterEach` sweeps every process listener added since a baseline captured before the first import  |
`NODE_OPTIONS=--trace-warnings` on after a bare run printed an unexplained
`MaxListenersExceededWarning`. Both are recorded here because the _second_ one is
the more interesting failure: the warning was attributed to the wrong file for
several iterations, and the leak was not inert -- every surviving listener calls
`log.error` and `captureException`, so one genuine unhandled rejection in that
spec fanned out into a dozen monitoring reports. A warning nobody can trace back
to a cause is worse than no warning, because it trains the team to ignore the
one warning that mattered.

**Guard added so B8 cannot recur:** `src/renderer/__tests__/csp.test.ts` parses the
`content-security-policy` meta tag out of `index.html` and asserts the directives
the bundled assets actually need, including that every `@fontsource/*` import in
the renderer resolves to a source the policy permits. Verified negatively: deleting
`font-src` makes it fail.

**Guard added so B1â€“B4 cannot recur:** `no-dom-prop-leak.test.ts` walks the real TypeScript
AST of every `*.styles.ts` and fails if any `styled()` call declares a `$`-prefixed prop without
a `shouldForwardProp`. It includes a self-check that pins the shape of the data it inspects,
because an earlier regex version of this test passed _while the bug was present_ -- a guard that
cannot fail is worse than no guard.

### Bugs the Phase 7 updater suite found and fixed

The previous `updater-hostile.test.ts` asserted on literals and never imported `src/main/updater.ts`,
so Phase 7's log counted 4 tests that proved nothing about the updater. It is rewritten as 62 tests
that drive the real module. That run found 13 defects in today's code (below); each was fixed and the
test that had documented the vulnerable behaviour was inverted to assert the refusing behaviour, so
the suite is green because the guards hold, not because the defects are pinned as contracts
(2026-10-06).

| # | Defect | Source fix |
|---|---|---|
| U1 | **Arbitrary write.** A release asset named `../../../../evil.exe` is selected and written outside the update dir | `resolveInstallerTarget` now accepts only a plain installer file name (or the exact resolved path inside the update dir) and asserts containment via `path.relative` |
| U2 | A NUL byte in an asset name reaches `fs.createWriteStream`, which throws `ERR_INVALID_ARG_VALUE` **from inside the HTTPS response callback** -- uncaught, not a rejection | the same name validator rejects `\0` before any write; `selectAsset` filters it out |
| U3 | **Any file the marker names is launched at startup, with no validation.** `C:\Windows\System32\cmd.exe` in `pending-install.json` gets `shell.openPath`'d before any window exists | `readPendingInstall` runs the payload through `resolveInstallerTarget`: containment in the update dir + installer extension + `coerceOsString` length bound |
| U4 | An **empty** `version` in the marker bypasses the version guard, so the installer runs unconditionally | an empty/unparseable version is now "cannot apply"; the marker is cleared but nothing is launched |
| U5 | A **megabyte-long** marker path reaches `shell.openPath` | `readPendingInstall` applies `MAX_OS_STRING_LENGTH` to the raw payload and every string field |
| U6 | **Unbounded response body.** No size cap and no timeout, so a hostile endpoint can exhaust the main process | `MAX_RELEASE_JSON_BYTES` (4 MB) cap on the release body, `API_TIMEOUT_MS` (15 s) `AbortSignal.timeout`, and `DOWNLOAD_IDLE_TIMEOUT_MS` (60 s) idle abort on downloads |
| U7 | **Redirects are followed to any host, over any scheme, with no hop budget.** `http://evil.invalid` is fetched as the installer | `ALLOWED_DOWNLOAD_HOSTS` (github.com + three CDN hosts) and https-only, with `MAX_REDIRECTS` (5) hop budget |
| U8 | A 302 **without** a `Location` header makes the real `https.get(undefined, ...)` throw `ERR_INVALID_ARG_TYPE` synchronously inside the response callback -- uncaught, and the download promise never settles | the header is validated (string, non-empty) and the download is rejected cleanly |
| U9 | **Disk-full / locked file leaves the app hung.** The `WriteStream` has no `error` listener, so the emit throws on a listener-less emitter (uncaught) *and* nothing ever settles the promise | the stream has an `error` handler that fails the download, teardowns the stream and removes the partial file |
| U10 | **No integrity check.** A truncated body, or an HTML error page served as 200, resolves as a successful download -- and the corrupt file is what `shell.openPath` later launches | `Content-Length` is asserted (received == advertised), HTML `Content-Type` is refused, progress is capped and clamps to a 0-100 scale, and a published `sha256:`/`sha512:` digest is verified before the installer is offered |
| U11 | **`compareVersions` violates semver 2.0.0.** `1.0.0+build.7` outranks `1.0.0`, so a rebuild is offered as an update; an unparseable tag collapses to `0.0.0` | build metadata is stripped (§10), unparseable entire-version strings throw/are refused, and prerelease identifiers follow §9 (alphanumerics + hyphens, no leading zeros) |
| U12 | **No single-flight.** 200 concurrent `checkForUpdate()` calls become 200 HTTPS requests; the renderer can trigger this alone, since `CHECK_FOR_UPDATES` has no debounce | `checkForUpdate` shares one `inFlightCheck` promise across all callers |
| U13 | **A body of literal `null` is indistinguishable from "no release".** `fetchLatestRelease` resolved `null` for 404, so `runCheck` treated a JSON `null` body as "up to date" | 404 now resolves a `NO_RELEASE` symbol; every other payload (including `null`) is validated |

Smaller items the same suite pins, listed so they are not rediscovered: progress percent can exceed
100 when a server under-reports `Content-Length` (**fixed**: `Math.min(100, ...)` and a mismatch is a
hard failure); `asset.size` is copied across the IPC boundary with no type or range check (`-1`,
`2**53` and `'4 GB'` all pass) (**fixed**: requires a safe, finite, non-negative integer at most
`MAX_ASSET_SIZE_BYTES` = 4 GiB, else 0); a 429's `Retry-After` is discarded (**still true**, recorded);
and `installer.bat.exe` / `setup.sh.AppImage` are selected because the filter only looks at the
trailing extension (**kept**: they correctly carry the platform installer extension, and the download
and launch are digest- and containment-verified regardless).

**Decisions taken when these landed (2026-10-06).** U1-U4 and U7 were security-relevant and recorded
for a decision rather than a drive-by patch; the follow-up chose the two flagged options explicitly:

- **U3/U7 - containment + allowlist, fail closed.** An installer must be a plain file name
  carrying the platform extension and must resolve inside `tempdir/EncodeX-updater`; downloads may
  only be fetched from (and redirected among) github.com and the three GitHub CDN hosts, over https,
  within the hop budget. Both were the options the original "fix direction" column named.

### Known follow-ups (recorded, not fixed)

- **`Logs.tsx` now windows its list (2026-10-07).** Follow-up 4 is closed: only the ~viewport slice
  of rows is mounted (`LOG_WINDOW_OVERSCAN` above/below + fixed `LOG_ROW_HEIGHT` estimate), held open
  by transparent spacers so the scrollbar still spans every filtered row, and the window re-mounts as
  the user scrolls or new entries append. The `/logs` budget in `e2e/specs/ipc-events.spec.ts` was
  tightened from 10,000 ms to 4,000 ms (measured, pre-windowing worst was ~5.5-7 s; tighten again
  after a full sweep). The `big-list-budget` gate now asserts the slice stays <= 60 mounted rows at
  50,000 backing entries and that scrolling reaches the tail. Residual edge: rows that wrap to
  multiple lines are taller than the fixed estimate, so their extra lines can drift a few rows' worth
  against the spacer geometry; the overscan absorbs it, and line length is bounded (log lines come
  pre-split by the logger). The old cap note "raise that budget when the list is windowed, do not
  tune it upward" is now done -- the budget was tightened, not tuned.
- **The renderer now coalesces high-frequency inbound events (2026-10-07).** Follow-up 5 is closed:
  `src/preload/coalesce.ts` wraps the four channels that can legitimately exceed burn-in cadence -
  `onConversionProgress` and `onQueueProgress` (50 ms latest-wins windows, ~20 deliveries/s each),
  `onPlayerFrame` (16 ms, near video rate), `onPlayerAudio` (10 ms - the one channel where dropping
  is audible, so real chunk cadence passes untouched while floods are capped) - so a flood can no
  longer re-apply the renderer once per event. The first event of a window still applies immediately
  (quiet traffic is delayed zero) and the tail is never lost (the newest event is always delivered);
  unsubscribe cancels a pending delivery. `onLogMessage` and the queue/job lifecycle channels are
  intentionally NOT coalesced - each line or transition is additive and must not be dropped. Covered
  by `src/preload/__tests__/coalesce.test.ts` (6 tests) plus the existing single-event bridge tests,
  which the wrapper preserves by design. Re-triaging the 100 Hz sweep with `E2E_SHAPE_HZ=100` now
  exercises the ceiling with those four channels capped at ~200 deliveries/s total instead of ~650/s.
- `LanguageMenu.tsx:150` uses `autoFocus` (`jsx-a11y/no-autofocus` warning, pre-existing).
- **The CSP now ships as a response header (2026-10-07).** Follow-up 6 is closed:
  `src/main/security/csp.ts` injects `Content-Security-Policy` via
  `session.webRequest.onHeadersReceived` on the default session before any window loads, so
  Electron's security advisory sees the policy (the `<meta http-equiv>` tag, which the advisory does
  not inspect, is gone from `src/renderer/index.html`). The policy string lives once, in
  `src/shared/csp.ts`, and is covered on the main side by `src/main/security/__tests__/csp.test.ts`
  and on the renderer side by `src/renderer/__tests__/csp.test.ts`. The `aptabase-ipc:` `connect-src`
  allowance is preserved (same string, same semantics; dev, `file://`, and splash are now all
  covered by the header). The `allowed-errors.json` consoleWarn entry for the advisory has been
  deleted; the warning no longer fires.
- **The unit tier now runs the hostile-preload sweep (2026-10-07).** Follow-up 7 is closed:
  `src/test-utils/hostile-api.ts` + `src/renderer/__tests__/hostile-bridge-matrix.test.tsx` (12
  tests) mirror the E2E matrix (`e2e/mocks/hostile-preload.js`): all seven modes (healthy,
  reject-sync, reject-async, never, wrong-type, garbage, partial) stride all twelve routes under the
  per-route renderer `<ErrorBoundary>`, asserting every route mounts with no unhandled error and no
  armed boundary, on a single bridge instance retargeted per mode via `control.setMode`. Fidelity:
  the hostile half is byte-identical to the E2E preload (same `bucketOf` hash, same rejection/garbage
  shapes); the pass-through half resolves benign per-method defaults instead of real IPC (see the
  caveat on these follow-ups). Runs in the shared unit tier under strict. The sweep caught a real gap
  the E2E's page-alive bar was blind to: a wrong-shaped `queueList` result reached
  `useQueueStore.setJobs` and crashed the next render to the boundary (the E2E counted that "alive");
  `setJobs` now drops non-array payloads (`src/renderer/stores/queueStore.ts`), pinned by
  `queueStore.test.ts`, and the app's "reports the failure" warns are declared on the sweep so only
  real unhandled errors stay fatal. The drift guard also tightened the renderer-contract stub
  (`src/test-setup.ts`) to match the real preload surface (`captureDevScreenshot`).
- `aptabase-ipc://trackEvent` reports `net::ERR_ABORTED` on teardown in Tier B. Recorded as a
  non-fatal `netfail`; it is the analytics call losing its race with window close, not a defect,
  but it means Tier B output always carries a tripwire warning. Worth a look when the analytics
  bootstrap is next touched.
- **`e2e/cli.spec.ts` "should reject an unknown --preset as a usage error" is flaky under full-suite
  parallel load** (seen 2026-10-05, Phase 3.4): `runCli` returned `status: null` -- the child was killed
  rather than exiting -- while the same spec passed 61/61 in isolation and in the next full Tier A run.
  The assertion itself is sound; `status: null` is the symptom of a starved/spawn-timeout subprocess
  under 19 concurrent spec files, and `runCli` does not distinguish "killed" from "exited with a signal
  it expected". Candidate for `e2e/quarantine/` per 0.5 if the 3Ã— `test:flake-detect` run reproduces it.
- `Convert.test.tsx > hides the stream details behind the view more toggle` fails roughly once
  per full unit run under load and passes in isolation (~72 s alone vs ~92 s in-suite). The
  30 s `waitFor` budget is too tight for a 40-test file on a loaded machine. This is exactly the
  F10 flake-governance problem, deferred to Phase 0.5 rather than patched ad hoc here.
- `tsconfig.renderer.json` excludes with `**/*.{test,spec}.{ts,tsx}`, which TypeScript does not
  expand -- the pattern matches nothing. The project is saved from actually typechecking its whole
  suite only by the working `**/__tests__/**` entry beside it. One test file sits outside
  `__tests__/` and so _was_ in the renderer program by accident:
  `src/renderer/hooks/usePreviewThumbnail.test.ts`. `tsconfig.test.json` now covers it
  deliberately. Inert today (0 errors either way), so the broken pattern is folded into Phase
  0.6 housekeeping rather than fixed here; leaving it is a trap, because the next spec written
  at `src/renderer/<area>/<name>.test.tsx` will silently re-enter the renderer typecheck.

- **Row 3 follow-up: a committed unit-tier hostile-preload sweep.** The abuse sweeps all live in the
  E2E tier (`mock:false`): `channel-contract` (8 tests), `ipc-abuse.spec.ts`, `ipc-events.spec.ts`, and
  the hostile-preload matrix (`hostile-bridge.spec.ts`, 14). The hostile-preload modes are not
  exhaustively exercised in committed unit-tier tests; `test-ipc-abuse` (ubuntu + windows, real
  main, needs `test-integration`) covers the faithful surface in CI, so this is a depth/cheapness
  follow-up, not a gap.
- **Row 5 follow-ups (browser-tier, live outside the unit tier):** the axe E2E sweep and the browser
  focus-order probes; the full 5,000-card job-card render requires a ~6 GB jsdom heap (over GitHub's
  7 GB ubuntu runner) and is prescribed to the perf tier (row 8 pattern) -- the gate's 3,000-card
  render at ~11-18 ms/card still fails super-linear regressions.
- **Strict mode is now the default (2026-10-05).** `ENCODEX_STRICT_TESTS` defaults to `1` in both
  `vitest.config.ts` and `vitest.integration.config.ts`, satisfying the exit criterion at the bottom
  of this plan. Enabling it turned the suite from green to **32 failed files / 88 failing tests** (248
  `console.warn`, 211 `appWarn`), and draining it found things a red tripwire never reported:

  - **Two real Autocomplete defects.** `ProfileSelector` grouped options by `CATEGORY_ORDER` but only
  _within_ each category's own slice, so a category header could be emitted more than once once
  more than one category had entries - MUI logs a duplicate-key warning and the header renders
  twice. `ProfileEditorDialog` rendered a user-editable profile's stored `videoBitrate` (`320k`,
  added by a later version) as **blank and out of range**, because it validated against the
  hard-coded option list rather than the list plus the current value.
  - **A disabled-control Tooltip that could never be read.** A MUI `Tooltip` on a `disabled` button
  fires no events on its child, so the explanation attached to resume/pause/start/clear-completed
  was unreachable - by pointer _and_ keyboard. `TooltipIfEnabled` wraps only the disabled case in a
  focusable, string-labelled target, so keyboard users can reach it and the tip renders; the
  enabled case is left unwrapped so no phantom tab stop appears. 8 tests; swapping the
  implementation back to plain MUI `Tooltip` fails 5 of them.
  - **Two real application errors that nothing was checking.** `index.ts` starts monitoring and
  analytics with `void bootstrap...()` on purpose, so `await import('../index')` resolves before
  either finishes; their `log.error` calls landed after the test ended and the tripwire dropped
  them as unattributed - `appError(shared/monitoring)` and
  `appError(main/analytics/aptabaseMainProvider)`, one pair per test. A helper now drains to the
  next macrotask so they land inside the test that caused them, where they are declared. Both are
  expected: the SDKs have no DSN/App Key under test and both call sites swallow the failure by
  design. This is the argument for attributing late faults rather than only reporting them - without
  it, the report is the only place these errors are ever visible.
  - The remaining failures were tests deliberately provoking a logged error, now declared with narrow
  `expectAppLog(level, context)`. Every declaration is load-bearing: rewriting one context to a
  non-existent value fails the test.
  - Four test files contained raw NUL/control bytes in `HEAD`, so `git diff` rendered them as binary
  and the tripwire's own console patching could mangle them. Repaired in the working tree;
  `git diff --text` shows ordinary text.

  **Gates:** unit `205 files / 3101 tests`, integration `4 files / 50 tests`, `npm run typecheck`
  clean, `npm run lint` 0 errors (1 pre-existing `jsx-a11y/no-autofocus` warning in
  `LanguageMenu.tsx`), `npm run format:check` clean.

---

## 0. Why this plan exists (findings from the current repo)

These are facts about the repo as of `b12f386`, not hypotheticals. Each maps to a phase below. | #  | Finding | Impact  |
| F1 | **Zero** e2e specs attach `page.on('pageerror')` or `page.on('console')` (`e2e/**` grep: 0 hits). A renderer that throws on every mount still passes all 14 Tier A specs.  | Critical -- the whole GUI surface is unguarded. |
| F2 | `src/test-setup.ts` installs no `unhandledrejection` / `error` listener. jsdom swallows renderer-side async throws; they never fail the test.  | Critical -- silent green tests. |
| F3 | The `tsconfig.*.json` projects **exclude every test file**, so ~29,300 lines of test code are never typechecked.  | High -- tests compile only by luck. |
| F4 | Coverage gates are global only (85/75/80/85). No per-file floor, no diff coverage. A new 600-line file at 0% passes if the global average holds.  | High. |
| F5 | E2E "skips" real main-process IPC entirely: 13 of 14 specs use `e2e/mocks/preload.js` (a JS reimplementation of the bridge). The mock and `src/preload/index.ts` drift silently.  | High -- the real preload/main contract is untested in CI. |
| F6 | No property-based, fuzz, or mutation testing anywhere. `frame-decoder.ts` (433 lines of raw `Buffer` parsing), `ffprobe-mapper.ts`, `queue-transfer.ts`, and `image-info.ts` are hand-tested only. | High. |
| F7 | 56 locale JSON files; the i18n mock in `test-setup.ts` hardcodes ~50 English strings. No test renders a page in a non-English locale.  | High -- most users don't speak `en-US`. |
| F8 | No test asserts an IPC handler survives garbage input. `ipc-channels.ts` declares ~90 channels; there is no test that calls each registered handler with zero args, wrong arity, or `__proto__`.  | High. |
| F9 | `perf/**` and `eslint-rules/**` are outside `npm run format` and outside every `typecheck`.  | Medium. |
| F10 | E2E `retry: 2` in CI with no flake accounting. A genuinely broken test is indistinguishable from a flaky one; flakes get rerouted, not fixed.  | Medium. |
| F11 | `getMainWindow()` polls for 30 s (`e2e/fixtures/app.ts:104`). A slow-boot regression is absorbed as test latency forever.  | Medium. |
| F12 | No `test.skip` governance; no quarantine mechanism; no bug-for-bug regression protocol.  | Medium. |

---

## Phase 0 -- Tripwires (do this first; everything else is worthless until failures are visible)

Goal: convert "the app silently broke" into "the build is red."

### 0.1 Unit-level crash tripwire -- `src/test-setup.ts`

Add a global recorder that fails the _test file_ if anything async blows up:

```ts
// src/test-setup/crash-tripwire.ts
const unhandled: unknown[] = [];
export function getUnhandled(): unknown[] {
  return unhandled;
}
```

- `process.on('unhandledRejection')` and `process.on('uncaughtException')` -> record, don't throw (so the
  owning assertion reports a readable failure).
- `window.addEventListener('unhandledrejection' | 'error')` for the jsdom renderer side.
- `console.error` / `console.warn` monkey-patch -> record, with a stack.
- In a new `src/test-utils/assert-clean.ts` exporting `assertNoUnhandled()` and a shared
  `afterEach` registered from `test-setup.ts`:
  - Fail on **any** unhandled rejection or uncaught exception.
  - Fail on `console.error` **unless** the test opts in via `expectConsoleError(/pattern/)`.
  - Warn-only (first week) on `console.warn`; promote to error in week 2 after the noise is drained.
- Escape hatch that is _visible in the diff_: `allowConsoleError()` must be called explicitly.
- Roll out behind `ENCODEX_STRICT_TESTS=1` in week 1 so we can measure the blast radius, then
  flip it on permanently in `vitest.config.ts` + `vitest.integration.config.ts`.

**Exit criterion:** a deliberately-thrown async error in any store/hook makes a test fail.

### 0.2 E2E renderer tripwire -- new `e2e/fixtures/tripwire.ts`

Wired into `launchApp()` in `e2e/fixtures/app.ts` so **every** spec inherits it for free:

```ts
page.on('pageerror',  e => recorder.push({ kind: 'pageerror',  text: String(e) }));
page.on('console', m => m.type() === 'error' && recorder.push({ kind: 'console', text: m.text() }));
page.on('crash',  ()  => recorder.push({ kind: 'crash' }));
page.on('requestfailed',  r  => recorder.push({ kind: 'netfail', url: r.url() }));
app.process().stderr.on('data', b => /* main-process uncaughtException / unhandledRejection lines */);
```

- Also inject, via `app.evaluate()`, main-process listeners for
  `process.on('uncaughtException' | 'unhandledRejection')` that push onto a global array readable
  through `app.evaluate(() => globalThis.__e2eMainErrors)`.
- `afterEach` -> `expect(recorder).toBeEmpty()` with a formatted diff (first 20 entries, deduped).
- Whitelist file `e2e/fixtures/allowed-errors.json` for the handful of _legitimate_ console errors
  (e.g. Sentry "no DSN configured", favicon 404), each with a comment and a review date.
- Cap the recorder at 200 entries to avoid OOM on a crash loop.

**Exit criterion:** add a temporary `throw new Error('x')` in a `useEffect` and watch every
affected spec go red.

**Result -- DONE, exit criterion met.** Implemented as `e2e/fixtures/tripwire.ts` (recorder) plus
`e2e/fixtures/tripwire-setup.ts` (hooks), registered through `setupFiles` in both
`e2e/vitest.e2e.config.ts` and `e2e/vitest.e2e.real.config.ts` so no spec has to opt in. What the
plan sketched and what shipped differ in four places worth recording:

- **The listener side is attached in `launchApp`, not in the setup file.** The app is launched from
  a spec's `beforeAll` and may be relaunched mid-file, so `attachTripwire(app)` re-registers on
  every launch and on every `reloadSession`. The _assertion_ side has to be registered during
  collection, which is why the two halves are separate modules.
- **`app.evaluate()` is not enough on its own.** The main-process listener function is serialised
  by Electron, so it cannot close over anything; it pushes onto a global on the main side and
  `takeTripwireEntries` drains that global through `app.evaluate` at assertion time. A stderr
  scanner is kept alongside it because a fault that kills the main process before `evaluate` can
  round-trip only ever shows up on stderr.
- **Severity is three-tier, not two.** `ENCODEX_STRICT_TESTS` is `0`/unset -> `crash`
  (`pageerror`, renderer `console.error`, page crash, main uncaught/rejection, `mainStderr`),
  `1` -> adds console warnings, `2` -> adds `appWarn`. `netfail` is report-only at every level
  because a teardown race produces one reliably and failing on it would be noise.
- **Faults recorded between tests are kept, not dropped.** The first implementation marked them
  `stale` and then cleared the array anyway, which silently discarded every fault raised while the
  app was booting in `beforeAll` -- the single most valuable place for the tripwire to look. Caught
  by a probe: a `console.error` at renderer module scope made all four `logs.spec.ts` tests red with
  `(recorded between tests)`, where the previous version reported nothing at all.

Verified: a temporary `throw new Error('ADVERSARIAL-TRIPWIRE-PROBE')` in
`src/renderer/pages/Convert.tsx` turned 10/10 convert tests red; probe reverted, renderer rebuilt,
Tier A 154/154 (2 skipped) and Tier B 9/9 green with the tripwire active. B8 and B9 came out of
this phase.

### 0.3 Typecheck the tests -- new `tsconfig.test.json` -- **DONE**

- `extends: ./tsconfig.json`, `include: ['src/**/*.{test,spec}.{ts,tsx}', 'e2e/**/*.ts', 'perf/**/*.ts']`,
  `types: ['vitest/globals', 'node']`, `noEmit: true`, `paths: { '@shared/*': ['src/shared/*'] }`.
- Add `typecheck:test` to `npm run typecheck` and to the CI `typecheck` job.
- Resolve the missing `paths` for `@shared` in the base config (today only Vite/Vitest know it).
- Add a separate, non-blocking `tsconfig.e2e.json` for `e2e/` (CommonJS `require` in
  `e2e/mocks/*.js` is fine since those stay `.js`).

**As built, with the deviations that actually happened:**

| Decision | Draft said  | Built | Why  |
| `tsconfig.test.json` include | brace globs  | explicit `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` | TypeScript does not expand `{a,b}` in `include`/`exclude`. The drafted pattern matched **0 of 191** test files, so the first `tsc` run "passed" with an empty program. A file comment in the config records the trap.  |
| Ambient declarations | not mentioned  | included `electron-api`, `vite-env`, `mui`, `simple-icons`, `ffprobe-static` `.d.ts` explicitly | Without them the run reports **450** errors, nearly all ambient-type-not-found noise, which hides the 54 real ones.  |
| `@shared/*` paths | add to base config  | not added | `@shared` has zero TypeScript imports repo-wide. Adding a path mapping for an alias nothing uses is cargo-culting.  |
| `perf/**` | in `include`  | left out, routed to 0.6 | The body already assigns `perf/**` its own `tsconfig.perf.json` in 0.6; duplicating it here would create two homes for one job.  |
| `tsconfig.e2e.json` | separate, **non-blocking** | separate **and chained** into `npm run typecheck` | It surfaced 14 real e2e errors; all 14 were fixed rather than allowlisted, so there was nothing left to be non-blocking about. The whole 5-project chain runs in 38 s, well inside the `typecheck` job's 10 min budget. Revert the chain if e2e-only type rot later turns noisy. | **Result:** 191 test files enter the program, 54 real errors, 0 remaining. `npm run typecheck`
now covers renderer + main + preload + test + e2e. `tsconfig.main.json` was already correct
(explicit `**/*.test.ts` / `**/*.spec.ts`, 0 test files in its program) and was left alone.

#### What the typecheck found: tests that asserted nothing

The phase surfaced **no production defects**. What it surfaced was worse in a way -- a set of
tests that were green because they could not fail. These are the same disease as the `no-dom-prop-leak`
guard that "passed while the bug was present", so each is listed with why it was green:

- **`cli-remux.test.ts` passed a type-invalid disposition fixture.** `MediaStreamInfo.disposition`
  is `string[]`; the fixture passed the bare string `'attached_pic'`. It went green _by accident of
  JS semantics_: `'attached_pic'.includes('attached_pic')` is true, so the production
  `disposition?.includes(ATTACHED_PIC_DISPOSITION)` still fired. The test did reach the real code
  path, so this was weaker than the other entries here -- but the fixture was only ever valid
  because nobody was typechecking, and `buildPrimaryStreamMaps` (which the GUI, CLI, and MCP all
  share) had **no direct coverage at all**.
  **Hardened:** direct `describe('buildPrimaryStreamMaps')` block in
  `src/shared/__tests__/remux-utils.test.ts` pinning ordinal numbering, cover-art position
  independence, and audio-ordinal isolation -- plus the case that actually earns the test: a video
  whose disposition is `['default']` or `['forced_default', 'default']` must **survive**, which
  separates the real value check from the mutant `if (stream.disposition) continue`. ffmpeg marks
  ordinary tracks `default`/`forced_default` routinely, so that mutant would empty the default
  stream selection for real files, and the old two-video fixture could not see it.
  _Correction to an earlier draft of this note:_ I first wrote that the old spec "would have kept
  passing if the real check were deleted." That was wrong. `buildPrimaryStreamMaps` maps **every**
  stream with a per-type ordinal, so deleting the check yields `['0:v:0', '0:v:1']` and the old
  assertion did fail. The real gap was the disposition-_value_ check, not the skip's existence.
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
  proves `JSON.parse(JSON.stringify(x))` works -- `save()` stringifies the whole snapshot and
  `load()` returns it with a blind cast. Added a second spec that closes the loop the user actually
  hits: persist, construct a **fresh** `JobQueue` so it restores, `start()` it, and assert on
  `convert`'s arguments. Stubbing `save()` to strip `additionalInputs` turns it red.
- **`profileStore.test.ts` claimed to load from `localStorage` on init** but there is no `init()` to
  call -- it `setState`d the same values it had just serialized, so `loadCustomProfiles()` was never
  executed. The store builds `profiles: [...BUILTIN_PROFILES, ...loadCustomProfiles()]` at
  **module scope**, so the only way to reach the real path is to seed storage and re-import.
  **Hardened:** `importStore()` helper (`vi.resetModules()` + dynamic import) driving four specs -- a
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
  gap was narrower than it looked: nothing exercised the setting _from the batch side_.
  `buildBatchOptions`' spec now walks all four `hardwareAcceleration` Ã— `hwaccelMode` combinations
  and asserts the resulting ffmpeg flags, so a `buildBatchOptions` that dropped the user's setting
  can no longer hide behind a well-tested `getHwAccelArgs`. (The option passthrough itself was
  already pinned by 11 existing `toEqual` specs -- a mutation hardcoding
  `hardwareAcceleration: false` turns all 12 red. The new spec's value is the end-to-end tie.)
- **Dead `TripwireState.strict`** in `src/test-utils/crash-tripwire.ts` -- declared on an interface no
  producer ever set, so nothing caught it. Removed.

#### Every one of these was verified negatively

A green test that cannot go red is the whole problem, so each fix was mutation-tested: break the
production code, confirm the spec fails, restore. **8/8 caught.**

| # | Mutation  | Specs that caught it |
| 1 | `buildPrimaryStreamMaps`: `if (stream.disposition) continue`  | 2 (the ones the old suite could not see) |
| 2 | `buildPrimaryStreamMaps`: drop the `attached_pic` skip  | 3 |
| 3 | `FileQueuePersistence.save`: strip `additionalInputs`  | 2 |
| 4 | `cli-remux`: `remux_failed` stops carrying `err.code`  | 1 |
| 5 | `loadPersistedState`: _hypothetical fix_ enforcing `snapshot.version` | 1 (the gap pin -- proves it is live, not decorative) |
| 6 | `loadCustomProfiles`: stop filtering corrupt entries  | 1 |
| 7 | `loadRecentIds`: drop the `MAX_RECENT` slice  | 1 |
| 8 | `buildBatchOptions`: hardcode `hardwareAcceleration: false`  | 12 | `npm run typecheck` 0 errors Â· `npm run lint` 0 errors Â· `npm run format:check` clean Â·
2698/2698 unit tests (was 2686; +12 new).

#### B10: the queue snapshot version is written but never enforced

Found while hardening the `job-queue` round-trip, and **not fixed here** -- it is a production
behaviour change, not a typecheck fix, so it needs its own decision.

- `QUEUE_STATE_VERSION` is written by `save()` and read by nothing. `load()` validates only
  `Array.isArray(parsed.jobs)` and then returns `parsed as QueueSnapshot`; `loadPersistedState()`
  pushes every entry straight into the queue.
- Consequence: a `queue-state.json` left by an older or newer build -- or hand-edited, or truncated
  in a way that still parses as an object with a `jobs` array -- is trusted wholesale. Jobs with
  wrong-shaped `options` reach `createTranscoder` and spawn ffmpeg with garbage arguments, and there
  is no migration or rejection path.
- `ignores a snapshot written by an unknown state version` in `job-queue.test.ts` documents the
  current behaviour _on purpose_: it asserts the future job **is** restored, so the day someone adds
  enforcement that spec goes red and the change is deliberate rather than silent. Flipping it to
  `toEqual([])` alongside the fix is the whole migration.
- Fix sketch: in `loadPersistedState`, `if (snapshot.version !== QUEUE_STATE_VERSION) return;`, plus
  a per-job shape guard (string `id`/`input`/`output`, known `transcoder`, object `options`) so a
  single bad entry is dropped instead of the whole queue being trusted. Not done unilaterally.

#### Housekeeping note for 0.6: `core.autocrlf` with no `.gitattributes`

Mutating files during the negative verification and restoring them with `git checkout --` left six
sources showing as modified in `git status` with **zero** changed lines in `git diff`. Cause: the
repo has `core.autocrlf=true` and no `.gitattributes`, so git expects CRLF in the working tree while
every blob is stored LF. `git checkout` normalises CRLF->LF, decides the file is unchanged, and
leaves the CRLF bytes on disk. A `.gitattributes` with `* text=auto eol=lf` is the real fix; it
touches every file's checkout behaviour, so it belongs in 0.6 rather than mid-phase.

### 0.4 Coverage: per-file floors + diff coverage

**Status: DONE (2026-09-30).** The floor is published as a report rather than enforced by enforced by
`thresholds.perFile`, and the diff gate is stricter than the original sketch in one respect: it
checks the lines the diff _added_, not just the file's percentage.

What was built: | Piece | Where  | Behaviour |
| Shared coverage scope | `vitest.coverage-scope.ts`  | One include/exclude list imported by **both** vitest configs. A union of two reports is only meaningful if both tiers measured the same file set. |
| Raw two-tier merge | `scripts/coverage-summary.mjs`  | Unions `coverage-final.json` from `coverage/` and `coverage-integration/` via `istanbul-lib-coverage`. |
| Per-file report | `scripts/coverage-floor-report.mjs` | `npm run test:coverage:perfile`. Always exits 0. |
| Diff gate | `scripts/coverage-diff.mjs`  | `npm run test:coverage:diff [base]`. Blocking. |
| CI | `.github/workflows/ci.yml`  | `coverage-per-file` (`continue-on-error`) and `coverage-diff` jobs. | **Both tiers must be measured, or the numbers lie.** The unit config excludes
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

**The gate is per-file floor _and_ added-line coverage.** A per-file floor alone is too weak for the
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
  `--coverage.include` does not disable them, so gating a single file failed on the _global_ numbers
  before the per-file floor was ever evaluated. The gate now zeroes the global thresholds.
4. **`execFileSync('npx', ...)` cannot execute `npx.cmd`** without a shell, so the gate failed
  instantly on Windows. It now runs `node_modules/vitest/vitest.mjs` through `process.execPath`.

A first attempt at `assertMergeIsSane` asserted that a union cannot exceed its best input. That is
false for _percentages_: v8 emits a different `statementMap` per run depending on which functions
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

- `test:flake-detect` -- runs `test:e2e:ci` 3Ã— and diffs results into `reports/flake.json`.
- CI fails when a spec's failure rate across the 3 runs is in (0, 1) -- i.e. _sometimes_ fails.
- Introduce `e2e/quarantine/` (excluded from the default glob) + `quarantine.json` with
  `{ spec, issue, addedOn, expiresOn }`. Entries older than 21 days fail CI. No silent `.skip`.

**Status: DONE (2026-09-30).** The rule that decides whether a build passes is a pure, unit-tested
function; the process-spawning part is a thin wrapper around it. | Piece | Where  | Role |
| `analyzeRuns` (pure) | `scripts/flake-report.mjs`  | Failure-rate and quarantine verdicts |
| `toRunResult` (pure) | `scripts/flake-report.mjs`  | Vitest JSON report -> observed/failed sets |
| CLI runner | `scripts/flake-detect.mjs`  | Spawns N runs, aggregates, writes the summary |
| Tests | `scripts/__tests__/flake-report.test.mjs` | 19 tests over the verdict rules |
| Quarantine | `e2e/quarantine.json`, `e2e/quarantine/`  | Time-limited, issue-linked exemptions |
| CI | `.github/workflows/ci.yml` -> `test-flake` | `needs: [build]`, 3 passes under xvfb | **`--retry=0` is the load-bearing detail.** `e2e/vitest.e2e.config.ts` sets `retry: 2` in CI, which
is correct for a normal run (one retry absorbs a slow Electron boot) and precisely wrong for flake
detection: it turns a one-in-three failure into a green result. The detector disables retries and
judges the per-attempt outcomes itself.

**A non-zero exit from an individual run is expected, not an error.** A flaky spec may fail in run 1
and pass in runs 2 and 3, so the spawn failure is recorded rather than thrown; the verdict is only
formed once all runs are read. `analyzeRuns` also _refuses_ fewer than 2 runs, so a misconfigured
single-iteration invocation fails instead of reporting a clean bill of health.

**Verdicts are distinguished, not lumped together.** `flaky` (0 < failures < runs) and `stable-fail`
(fails every run) both fail the build, but they are different problems needing different triage, and
`partial` - a spec observed in only some runs - is reported separately, because a suite that
intermittently does not run a spec is as broken as one that intermittently fails it.

**Quarantine cannot become a graveyard.** An entry names either a whole spec file or an exact
`file::describe > it` identifier, and matching is exact: a substring rule would let a typo quietly
exempt a _different_ test, which is the "silent skip" this phase exists to prevent. A lapsed entry
fails the build _and_ stops exempting its flake, so a forgotten entry cannot outlive its 21 days
while still hiding a failure. An entry matching no test is a failure too, so entries cannot outlive
the fix they were written for.

Verified end-to-end against a deliberately flaky throwaway spec (1 failure in 3 runs): unquarantined
-> exit 1 naming the spec and rate; with a live entry -> exit 0; with an entry dated 2026-07-01 ->
exit 1 reporting both the flake and the lapsed entry. The analysis rules were mutation-tested - six
mutations (never call anything flaky, skip the lapse check, substring matching, skip the partial
check, never flag stale entries, allow a single run) each failed at least one test.

**One robustness fix worth recording:** the first version crashed on a `e2e/quarantine.json` written
by PowerShell's `Set-Content -Encoding utf8`, which emits a UTF-8 BOM that `JSON.parse` rejects.
That file is hand-edited, so a BOM is the _expected_ input on Windows, not an edge case. Reads now
strip a leading BOM. The bug was found by the self-test, not by inspection.

### 0.6 Housekeeping debt

- Add `perf/**` and `eslint-rules/**` to the Prettier globs and to a `tsconfig.perf.json` typecheck.
- Replace the 30 s `getMainWindow` poll with a 30 s _budgeted_ poll that records actual boot time and
  fails a perf assertion if boot exceeds the `perf/baseline.json` budget by 25%.

#### Delivered | Item | Where  | Notes |
| Prettier globs | `package.json` -> `format`, `format:check`  | `perf/**/*.{ts,tsx}` + `eslint-rules/**/*.mjs` |
| Typecheck | `tsconfig.perf.json`, `typecheck:perf`  | Chained as the 6th project in `typecheck` |
| Boot accounting | `e2e/fixtures/app.ts`, `e2e/fixtures/boot-budget.ts` | `AppSession.bootMs`; 30 s ceiling kept |
| Assertion | `e2e/specs/boot-budget.spec.ts`  | Median-of-3 vs platform budget +25% |
| Budget | `perf/baseline.json` -> `e2e.bootBudgetMs`  | `win32-x64: 2500` |
| Unit tests | `e2e/fixtures/__tests__/boot-budget.test.ts`  | 31 tests over the verdict rules | **Typechecking `perf/` immediately found a live bug, which is the whole argument for doing it.**
`perf/vitest.perf.config.ts` set `forks: { execArgv: ['--expose-gc'] }`. Vitest 4 removed that
sub-object, so `forks` was an unknown key that is _silently ignored_ - not an error - and `--expose-gc`
never reached the workers. `memory-leak.perf.test.ts` and `large-file.perf.test.ts` both call `gc()`
behind `if (global.gc)`, so nothing crashed: the memory tests were measuring uncollected garbage and
reporting a pass. Confirmed both directions with a probe spec - `typeof global.gc` was `undefined`
before the fix and `function` after. Vitest 4 accepts `execArgv` directly on `test`.

**A malformed budget throws; an absent one does not.** `perf/baseline.json` is hand-edited, so a
typo'd `bootBudgetMs` must not quietly disable the gate - `parseBootBudgetMs` rejects 0, negative,
`NaN`, `Infinity`, strings, and objects. A platform with _no_ budget returns `no-budget` and the spec
reports and skips, because `baseline.json` only ever contains data for the platform that generated it.
Enforcing a threshold lifted from a different machine class would be worse than no gate at all. Note
that `scripts/perf-compare.mjs --generate` rewrites the file; it merges into the existing
`platforms[key]`, so the hand-written `e2e` section survives regeneration.

**The measurement is a median of 3 launches, not one, and the first attempt showed why.** A single
sample on this machine spanned 1907-3434 ms for an unchanged binary - antivirus and page-cache warm-up
alone exceed the 25% tolerance, so a single-sample gate flaps red constantly and gets ignored, which is
F11 with a different symptom. `boot-budget.spec.ts` launches 3 times and compares medians, matching the
`medianMs` convention `baseline.json` already uses. Observed medians: 1639, 1725, 2115, 2452 ms.

**The budget is set from the worst observed median (2500 ms -> fails above 3125 ms), not the best.** At
the plan's first-pass value of 2100 ms the gate passed, but with only 7% headroom over the worst
observed median, which is a flake factory. The budget is per machine class and must be re-measured,
never copied across platforms.

**Boot cost fails one named spec, not 15.** Boot time is as much a property of the machine as of the
app, so a duration threshold inside every functional spec would turn a busy runner into a wall of
unrelated red. The harness records the boot once; only `boot-budget.spec.ts` asserts on it, so a red
run reads as "boot regressed" instead of "media-info failed". The failure message prints every sample
so a noisy run is diagnosable from CI output alone.

31 unit tests cover the verdict rules, mutation-tested: six mutations (tolerance 0.25->0.5, inclusive
`<=` -> `<`, dropping the `undefined` budget case, malformed-budget -> `null`, the 30 s ceiling, the
platform-key separator) each failed at least one test. `median()` is pinned separately against
empty input, even-length averaging, order independence, and caller-array mutation.

Gates after 0.6: typecheck 6/6 projects clean; lint 0 errors (1 known `no-autofocus` warning);
`format:check` clean; unit 189 files / 2748 tests; integration 4 files / 50 tests; e2e Tier A 155
passed + 2 skipped, Tier B 9/9.

#### 0.5 sign-off audit (deferred, then closed)

Two items were marked delivered while remaining unverified. Both are now checked.

**`actionlint` -- clean.** v1.7.12 over all 7 workflows (`ci.yml`, `codeql.yml`, `nightly.yml`,
`release.yml`, `scorecard.yml`, `site.yml`, `wiki-sync.yml`): **exit 0, no findings**, re-run with
`shellcheck` 0.11.0 on `PATH` so the `run:` blocks were analysed too rather than skipped. CI already
gates on this via `reviewdog/action-actionlint`, so this is a local confirmation of a gate that exists,
not a new one. The `test-flake` job's assumptions also check out: it `needs: [build]`, the build matrix
uploads `dist-ubuntu` with `if-no-files-found: error` (so the download can't silently miss), and
`xvfb-run --auto-servernum` is present. One inefficiency, not a bug: `needs: [build]` waits for the
windows and macos legs too, so `test-flake` idles until the slowest build finishes.

**Quarantine schema -- a real hole, now closed.** The analyzer documented "a tracking issue and a date"
but enforced neither. `expiryOf` returned `null` for an entry with no dates, the caller treated
`null` as "not yet lapsed", and the entry stayed in `liveEntries` and matched by `spec` -- so an
undated entry exempted a test **forever**, defeating the 21-day rule entirely.

The worse variant is the one that had no obvious smell: **`Date.parse` returns `NaN`, it does not
throw.** `expiryOf` did `Date.parse(entry.expiresOn) ?? addedOn + ...` on a value that was already
either a valid string or `undefined`, so `expiresOn: "2026-13-45"` produced `NaN`, and
`NaN <= now` is `false`. A typo'd date was silently immortal -- the same permanent pass as no date at
all, but it _looks_ like a compliant entry in review.

- `parseDate()` now treats unparseable input as absent (`Number.isFinite` guard), and
  `validateQuarantine()` is exported and wired into `analyzeRuns`' problem list.
- **Fail closed, not open.** A malformed entry is reported _and_ excluded from `liveEntries`, so it
  exempts nothing. An entry that cannot justify itself does not get the benefit of the doubt -- the
  flake is reported instead. `malformedQuarantine` is returned for diagnosis.
- Schema: `spec` and `issue` required non-empty, `addedOn` required and parseable, `expiresOn`
  optional but parseable and strictly after `addedOn`. Violations are indexed
  (`quarantine[3]: ...`) so the offending entry is findable.
- `validateQuarantine` accepts **both** shapes `flake-detect.mjs` loads -- bare array, or object with
  `entries`. The committed `quarantine.json` uses the object form so it can carry a `$comment`, and my
  first version rejected it. Worth catching: the analyzer was stricter than the file it validates.
- The detector's failure message told users to add "an issue and an `expiresOn` date", which
  contradicted the schema (`expiresOn` is optional; `addedOn` is required). Rewritten.
- The `README.md` now carries the field table and the `NaN` explanation, so the rule is discoverable
  without reading the analyzer.

19 -> **36 tests**. Four mutations, each caught: `parseDate` -> raw `Date.parse` (4 failures), drop the
`issue` check (3), drop the `addedOn` check (5), malformed entries silently exempt (2). The last one
is the mutation that matters most -- it is the "silently permanent pass" itself.

Two of my own tests were wrong before the source was: `analyzeRuns(runs)` was called with a `now` of
`2026-02-01` and an `addedOn` of `2026-01-01`, which the analyzer correctly reported as _already
lapsed_ -- the fixture, not the code, was at fault. And an unescaped apostrophe in a test title
(`typo'd`) broke the module's parse, which is why the file failed to load before any assertion ran.

Gates after the audit: typecheck 6/6 clean; lint 0 errors (1 known warning); `format:check` clean;
unit 199 files / 2928 tests.

---

## Phase 1 -- Contract & input fuzzing (property-based)

New dev-dep: **`fast-check`**. These target the pure logic where crashes are cheap to trigger and
expensive to find by hand. | Target | Property / attack  | Location |
| Queue import | `parseQueueExport`/`validateQueueExport` must never throw, never return a job with a prototype-polluted key, and cap job count  | `src/main/queue/queue-transfer.ts` (123 lines tested) |
| Error mapping | `formatError` must return a non-empty string for **any** `unknown` input (strings, `null`, `undefined`, symbols, BigInt, cyclic objects, thrown classes with/without `code`, `AggregateError`)  | `src/shared/errors.ts` |
| Validation | `validate*` never throws; always boolean; never mutates input  | `src/shared/validation.ts` |
| Math/progress/estimate | No `NaN`/`Infinity` in output for any non-negative finite input; no divide-by-zero  | `src/shared/math.ts`, `progress.ts`, `estimate.ts` |
| Formatters | Never throws; never returns `NaN`/`undefined` bytes or `Invalid Date`  | `src/renderer/utils/formatters.ts` |
| Path utils | `deriveOutputPath`, `resolveOutputPath`, `path-utils` never escape the intended dir for adversarial stems: `..`, `../..`, `CON`, `NUL`, `\\\\?\\C:\\x`, 32k-char names, `/`, `\\`, `:` , trailing dots/spaces (Windows), reserved device names, unicode RTL-override | `src/renderer/utils/path-utils.ts`, `src/main/cli/cli-util.ts` |
| i18n | Interpolation with missing/extra/malformed `{{x}}` tokens never throws and never leaves `{{}}` in the output; keys with `__proto__` don't leak  | `src/renderer/i18n/config.ts` |
| Store persist | Every one of the 18 zustand stores rehydrates from adversarial localStorage JSON without throwing: `null`, `"undefined"`, `[]`, `123`, `{"__proto__":{...}}`, 5 MB string, old schema version, missing keys  | `src/renderer/stores/*` |
| Shortcuts | `parseShortcut` never throws on any string; `shortcutMatches` never matches a bare modifier  | `src/renderer/constants/shortcuts.ts` |
| Codec/container | `canContain`, `getCodecSupport` etc. never throw on unknown container/codec pairs  | `src/shared/codec-containers.ts` (660 lines) | **Pattern:** every table row becomes a `fast-check` property test plus a fixed regression seed
(`fc.assert(prop, { seed: 12345, path: 'repro.txt' })` committed on failure).

#### Delivered

`fast-check@4.10.2` added as a dev-dep (no new advisories). Ten new property-test files, 163 tests, all 10 rows of the table above covered: | File | Covers  | Tests |
| `src/shared/__tests__/errors.property.test.ts` | `formatError`/`isAppError` totality  | 15 |
| `src/shared/__tests__/validation.property.test.ts` | `validate*` never-throw, no-`NaN`  | 24 |
| `src/shared/__tests__/math-estimate.property.test.ts` | `clamp`/`toPercent`/`estimateRemaining`/`formatDurationCompact` | 12 |
| `src/shared/__tests__/codec-containers.property.test.ts` | codec/extension lookups  | 15 |
| `src/main/queue/__tests__/queue-transfer.property.test.ts` | import contract, prototype pollution, job cap  | 17 |
| `src/renderer/utils/__tests__/path-shortcuts.property.test.ts` | path helpers, shortcut parsing  | 30 |
| `src/main/cli/__tests__/cli-util.property.test.ts` | `deriveOutputPath` containment  | 10 |
| `src/renderer/utils/__tests__/formatters.property.test.ts` | renderer formatters  | 12 |
| `src/renderer/i18n/__tests__/i18n.property.test.ts` | interpolation + 56-locale corpus  | 13 |
| `src/renderer/stores/__tests__/store-persist.property.test.ts` | localStorage rehydration, 6 readers  | 15 |

**Eight source bugs the property tests found.** Every one is a crash or a wrong value on input the
existing hand-written tests never produced:

1. **`isValidTime` accepted `00:60:00`.** The regex matched the _shape_ `\d{1,2}:\d{2}:\d{2}` without
  range-checking the components, so an impossible time passed validation straight into an ffmpeg seek
  argument. Now minutes and seconds are checked against 59.
2. **`formatSize(Infinity)` returned `'Infinity TB'`.** The non-finite guard existed on `formatBytes`
  but not on `formatSize`, which is what the file table actually calls. A corrupt file's `NaN` size
  rendered as the literal text `'NaN B'`.
3. **`formatDuration(NaN)` returned `'NaNs'`.** Same class: `NaN.toFixed(2)` is `'NaN'`, not `'0.00'`.
4. **`formatClockTime` rendered `'Infinity:NaN:NaN'`.** `Math.max(0, Infinity)` is `Infinity`, and
  the hour/minute/second math then produced `NaN` components. Guarding only `Number.isFinite(seconds)`
  is _not_ enough - a finite-but-enormous value still overflows on `seconds * 1000` - so the clamp is
  applied to the millisecond total.
5. **`validateQueueExport` had no job-count cap.** A crafted file declaring 200 000 records was
  validated one-by-one and then handed to the queue wholesale. Now capped at `QUEUE_EXPORT_MAX_JOBS`
  (10 000), which is wired into the real import path (`src/main/ipc/queue.ts:400`).
6. **`formatError` threw on a hostile object.** Reading `.message` off a Proxy `get`/`has` trap or a
  throwing getter propagated out of the error path - a broken error dialog instead of a worse-but-working
  one. Both the guard and the code inference are now wrapped, degrading to `UNKNOWN`.
7. **`isContainerCompatibleWithStream` threw on a stream with no `type`.** A partially-mapped ffprobe
  payload turned a defensive predicate into a caller-side crash.
8. **The i18n test mock threw on a `(` interpolation key.** The token name was interpolated into a
  `RegExp` unescaped, so a metacharacter key produced an unterminated-group `SyntaxError` or silently
  matched nothing. The mock's dictionary lookup also reached `Object.prototype` for a `__proto__` key,
  returning a non-string that then failed on `.replace`.

**One row in the table above was stated against code that does not exist, and the plan was wrong rather
than the code.** `deriveOutputPath` does exist - at `src/main/cli/cli-util.ts:271`, exactly one of the
two paths the row names - so the row was closable after all, and is now covered by
`cli-util.property.test.ts`. The result is worth recording because it is a _negative_ finding:

**`deriveOutputPath` was already traversal-safe, and the property proves it rather than assuming it.**
The `path.basename(fileName)` guard at `cli-util.ts:277` holds for every adversarial stem tried:
`../../etc/passwd`, `..\\..\\Windows\\System32`, `\\?\C:\x`, `\\server\share\x`, 32 000-character
stems, 8 000 chained `..`, RTL-override, and an empty stem. Reverting that single `path.basename` call
fails **6 of the 10** new tests, so the property has teeth rather than passing vacuously.

Two things this row does **not** establish, stated so the test is not read as stronger than it is:

- **No Windows reserved-name sanitization exists anywhere in the output-path chain.** `CON`, `NUL`,
  `AUX.mp4`, `COM1`, `LPT9` all pass through unsanitized to `deriveOutputPath`, `buildOutputPath`
  (`src/renderer/utils/batch-options.ts:223`), `buildDemuxTargets`
  (`src/shared/codec-containers.ts:652`) and `withExtension`. A stem of `CON` yields `CON.mp4`, which
  on Windows is a device, not a file. This is a real latent bug, but it is **unreachable from the GUI**
  (Windows cannot create such a file) and only reachable via the CLI/MCP argument surface. Left
  unfixed deliberately - see "Not fixed".
- The guard is `path.basename`, which is **platform-dependent**: win32 splits on both `/` and `\`,
  posix only `/`. The tests run on win32, so a `\`-only traversal stem is exercised through the
  win32 code path and would not be caught by this suite on Linux.

`parseShortcut` "never throws on any string" was the other mis-stated row: it throws by design on a
modifier-only chord, and that throw is a load-bearing guard on the `SHORTCUTS` table
(`shortcuts.test.ts:91`). The property was rewritten to the invariant that actually matters: _every
chord declared in `SHORTCUTS` parses without throwing_, and a modifier-only chord cannot become a
matchable predicate at all.

**Three of this phase's "failures" were my test generators being wrong, not the source.** Worth
separating out, because the instinct on a red property test is to go patch the validator:

1. `fc.string(unit)` is **deprecated in fast-check 4 and silently ignores the unit constraint** - it
  emitted `"0"`, which is a genuinely valid time, so the `isValidTime` property failed on a
  _correct_ implementation. The fix was `fc.integer`/`.map`, not a source change.
2. A containment check written as `rel.startsWith('..')` **rejects the legal filename
  `.._converted.mp4`**, which is precisely what a `..` stem produces. The property has to compare
  whole path segments. This is a false positive that would have been easy to "fix" by weakening the
  guard it was meant to protect.
3. `deriveOutputPath(input, {...})` with `outputDir` omitted returns `path.dirname(input)` - and
  `path.join` has already normalized any traversal out of `input` by then, so asserting the output
  stays in `C:/in` was asserting something false about the input, not a bug in the function.
4. `suggestedExtensionForAudioCodec('opus')` returning `''` is the documented "no suggestion"
  contract, not a defect.

**The store-persist row is the same shape of result: a negative finding, correctly pinned.** All six
rehydration readers (`readStoredBatchConfig`, `readStoredHwAccel`, `readStoredQueueConcurrency`,
`readStoredWhenDone`, `readStoredDrawerCondensed`, `readStoredVideoCutDraft`) already survive all 38
adversarial stored values - wrong-type JSON that parses cleanly, `{"__proto__":...}`, `constructor`/
`prototype` chains, 200 KB strings, unbalanced braces, `1e400`. They are not naive, because
`src/renderer/utils/storage.ts` centralizes the try/catch and each reader validates field-by-field.

The one thing that _was_ wrong is my first version of the property, which is the more useful record:

- I asserted only `Number.isFinite(readStoredQueueConcurrency())`. Deleting the reader's `clamp()` call
  still returns a finite `-99999`, so **the mutation survived**. The reader's documented contract is
  "clamped to 1..MAX_QUEUE_CONCURRENCY", and the property now asserts the range, not just finiteness.
  After tightening, the same mutation fails 2 tests. A property that passes is not evidence it is
  correct.
- I had also written `expect(out === undefined || out !== null || true).toBe(true)` - a tautology that
  asserts nothing and would have survived any mutation of `loadJson`. Replaced with a real
  totality-plus-`onError` assertion; dropping `parsed ?? fallback` from `loadJson` then fails 6 tests.

**Mutation-tested.** The `errors.ts` fixes were checked by reverting each guard: removing the
`message`-read catch fails 2 tests, removing the `String(err)` catch fails 1. Two earlier mutations
_survived_ - `isAppError`'s try/catch and the `String(err)` guard both needed a test that specifically
reached them, which is what the throwing-`Symbol.toPrimitive` function case was added for. The
`deriveOutputPath` containment property is mutation-tested too: reverting the one `path.basename` call
fails 6/10.

#### Not fixed (deliberate, with reasons) | Finding  | Why left |
| No Windows reserved-name sanitization in any output-path builder (`CON`, `NUL`, `COM1`, trailing dot/space) | Real bug, but unreachable from the GUI (Windows cannot create those files) and only reachable from the CLI/MCP argument surface. Fixing it changes output filenames, so it needs a decision on back-compat with existing users' naming, not a drive-by test fix. |
| `isValidTime` still accepts hours > 99 / no hour upper bound | The plan named only "no `NaN`/`Infinity`". ffmpeg is the authority on out-of-range `HH:MM:SS`; inventing a bound here risks rejecting valid long-form timestamps.  |
| Quarantine schema is not validated (`scripts/flake-report.mjs` accepts an undated entry indefinitely) | **Closed in the Phase 0.5 audit** -- see the schema section below  | **Gates after Phase 1:** typecheck 6/6 clean; lint 0 errors (1 known `no-autofocus` warning);
`format:check` clean; unit 199 files / 2911 tests; integration 4 files / 50 tests; e2e Tier A 155
passed + 2 skipped, Tier B 9/9.

**Two honest flake notes**, because a passing suite that needed a re-run should not be reported as
simply "green":

- The first full Tier A run had 2 `cli.spec.ts` help-text failures. Both `e2e/cli.spec.ts` and
  `src/main/cli/cli-util.ts` were untouched by this phase, `cli.spec.ts` then passed 61/61 in
  isolation, and the full suite passed 155/157 on the next run.
- The first full unit run had `src/main/__tests__/index.test.ts > runs the CLI and exits with success
in CLI mode` fail after 32s. It passed 13/13 in isolation and the full suite then passed 2911/2911.
  These are both the known loaded-suite flake class, and exactly what Phase 0.5's `test-flake` job
  exists to attribute - the local single-pass numbers above should be read as "1 flake in ~3 full
  runs", not as a clean sweep.

---

## Phase 2 -- Media / byte-level fuzzing (real FFmpeg, real files)

Runs in a new suite `test:media-fuzz` against the _real_ ffmpeg-static binary. Corrupt-file handling is
the #1 real-world crash source for a media tool and is currently untested.

> **Status: DONE (2026-10-01).** All five Phase 2 items are delivered: `computeHistogram` fuzz, the
> subprocess watchdog (`withTimeout`, 5 bounded sites), the `FrameDecoder` fuzz (which found an OOM
> process-killing hang), the EXIF bombs (which found an `errors`-leak and unbounded work in
> `flattenExif`), and the real corpus -> `test:media-fuzz`. The plan's file paths for three targets were
> wrong; the corrected locations are in the progress section. The real corpus found **no** new production
> bug, which is a legitimate result: a clean tier that has been shown to fail on injected defects is worth
> more than a silent one.

**Corpus generator** (`e2e/fixtures/corpus/generate-corpus.ts`):

- Truncation sweep: each of `mp4 / mkv / webm / mov / avi / jpg / png / gif / flac / mp3 / srt / ffmeta`
  cut at 0, 1, 2, 8, 64, 512 bytes and at 1%/5%/25%/50%/99% of length -> **~100 files**.
- Extension/content mismatch: MKV bytes named `.mp4`, JPEG bytes named `.mkv`, 8 KB of zeros named
  `.mp4`, valid MP4 header + 1 MB of random bytes.
- Header-aware corruption: flip 1 random bit per byte in the first 512 bytes (50 variants each).

**Test matrix** (each must degrade gracefully, never hang, never crash the process): | Path under test  | Assertion |
| `getMediaInfo` (`ffprobe-mapper.ts`) | Resolves to an error or `null`; never throws; never returns `duration: NaN` |
| `getVideoPreview` / `getImagePreview` / `getImageFileInfo` | Same  |
| `getImageInfo` (`image-info.ts`, EXIF via `exifr`) | No OOM, no `computeHistogram` NaN, no crash on a 60kÃ—60k PNG  |
| `extractWaveform` / `extractThumbnails` (`timeline-media.ts`) | Terminates within 10 s; returns `null`, not garbage  |
| `getCapabilities`, `convertFile`, `queueAdd` | Reject with a `formatError`-shaped error  | **Hangs are bugs:** every spawn in `src/main/**` that must terminate on its own is now wrapped by
`src/main/spawn-timeout.ts`'s `withTimeout` -- 5 sites, delivered. Conversions and the persistent
frame decoder are deliberately excluded (see "Subprocess watchdog"). Add `it('does not hang on <file>',
{ timeout: 15_000 })` and a global `execArgv`-free kill on teardown.

**EXIF bombs** (hand-built TIFFs, no ffmpeg needed):

- IFD offset pointing outside the buffer; `IFDNext` cycle (A->B->A); 65k entries; negative
  `IFDCount`; `x`/`y` = 0xFFFFFFFF; strip byte-length 0xFFFFFFFF (forces a huge alloc);
  `Photoshop` IRB with a 4 GB declared length.

**`frame-decoder.ts` decoder fuzz** (pure, fast, no process): feed 10,000 random `Buffer`s plus
structured bad cases (odd byte length, length % bpp != 0, length 0, length 1, 64 MB buffer) into
`rawvideo` and PCM decode paths. Assert: no throw, no out-of-bounds read, output length never exceeds
input-derived bounds, no `NaN` samples, and **memory does not grow** (measure with `process.memoryUsage()`
across the run in a `perf`-style test).

### Phase 2 progress (resume here)

**Done and verified, in order:**

1. `computeHistogram` (`src/main/image-info.ts`) fuzzed; one real bug class found and fixed. New file
  `src/main/__tests__/image-histogram.fuzz.test.ts`, 8 tests, 1.74 s.
2. `FrameDecoder` fuzzed; a **process-killing** bug found and fixed. New file
  `src/main/player/__tests__/frame-decoder.fuzz.test.ts`, 46 tests. Detailed below.
3. The subprocess watchdog (`src/main/spawn-timeout.ts`); 5 bounded sites, 43 wrapper tests + 12 error-code
  tests + 6 per-site hang tests, 7 mutations caught. Detailed below.
4. EXIF bombs; two real bugs found and fixed. New file
  `src/main/__tests__/image-exif.fuzz.test.ts`, 19 tests. Detailed below.

5. Real media corpus -> `test:media-fuzz`. New files `src/test-utils/media-corpus.ts` and
  `src/main/__tests__/corrupt-media.mediafuzz.test.ts`, 6 tests. Detailed below.

### Real corpus -> `test:media-fuzz` -- clean, and the value was in proving it _could_ fail (DELIVERED)

Against the real `ffmpeg-static`/`ffprobe-static` binaries. **No new production bug was found** -- unlike
every previous item in this phase. That is the honest result, and the useful part is the evidence that
the suite is capable of reporting a defect rather than passing vacuously.

**Corpus** (`src/test-utils/media-corpus.ts`, deterministic, mulberry32 seeded from `0x5eed`, override with
`MEDIA_FUZZ_SEED`). 11 seeds synthesised by real ffmpeg -- MP4, MKV, WebM, MOV, AVI, JPEG, PNG, GIF, MP3,
FLAC, SRT -- expanded to **173 files** via truncation (byte offsets 0/1/2/8/64/512 and 1/5/25/50/99 %),
single-bit flips in the header, all-zero and all-noise rewrites, and extension/content mismatches
(`mkv-as.mp4`, `jpg-as.mkv`, `mp4-as.jpg`, header-plus-noise). Nothing is checked in; the corpus is
regenerated per run, so it adds no repo weight and cannot rot.

**Targets exercised** (all real, no mocks): `FFToolCore.getInfo()` over all 173 files; `getImagePreview()`,
`getImageFileInfo()`, `getImageInfo()` over the image family; `getVideoPreview()`; `extractWaveform()` and
`extractThumbnails()`. Each call is raced against a 20 s budget, and results are checked for non-finite
numbers and for own-code rejections. `isPackaged()` returns `false` outside Electron, so the suite needs no
Electron mock.

**Four ways the suite was proven non-vacuous.** Each of these was a real defect _in the test_, found by
inspecting what the sweep actually did:

1. **A vacuous waveform test.** `extractWaveform()` returned `null` for all 16 sampled files, which looked
  like a pass. It was not: the control group never asserted timeline output on _good_ input, and the seed
  it was using (`seed.mp4`) is **video-only**. Waveform extraction cannot ever succeed on a file with no
  audio stream, so the whole waveform sweep was unfalsifiable. Fixed by adding `seed-av.mp4` (3 s, video +
  AAC audio) and by extending the control group to require non-`null` waveform _and_ thumbnail output from
  it. The control now fails if either extractor is broken, which is what makes the all-`null` corrupt-file
  result meaningful.
2. **A sampling bias that hid every interesting case.** `.slice(0, N)` on the video corpus returned the
  _prefix_, which is entirely the 0- and 1-byte truncations of one seed. Bit-flipped and mismatched files --
  the ones most likely to slip past a decoder's header check -- were never reached. Replaced with
  round-robin bucketing over (seed, corruption kind).
3. **A vacuity guard for the fix above.** Stratification is only correct if it keeps reaching the audio seed,
  so the timeline test now asserts the sample contains a `seed-av.mp4` variant. Verified this guard can
  fail: with `MEDIA_FUZZ_TIMELINE_LIMIT=1` the sample collapses to `seed.mp4` and the assertion fires.
4. **A swallowed outcome counter.** `console.info` is stubbed by the suite's crash tripwire, so the first
  tally implementation printed nothing at all. Moved to `process.stderr.write`, gated on
  `MEDIA_FUZZ_VERBOSE`, because a sweep reporting "everything returned `null`" is indistinguishable from a
  sweep that never reached the decoder.

**Mutation verification** (2 production mutations, both caught, both restored): | Mutation  | Result |
| `ffprobe-mapper.ts`: `duration` fallback `0` -> `NaN` | **Caught** -- 27 files flagged, and the control group failed too |
| `video-preview.ts`: `extractPreviewFrame` never settles | **Caught** -- all 30 files reported as hung past the 20 s budget | A third mutation (inverting the `BudgetExceeded` assertion) correctly did _not_ fail, which was itself
informative: it showed the hang assertion is only reached for calls that reject or hang, so a weak mutation
proves nothing. The real hang mutation above was needed to cover it.

**Outcome distribution** (`MEDIA_FUZZ_VERBOSE=1`): `getInfo` 70 values / 103 rejected -- real ffprobe work on
more than half the corpus; `getImageFileInfo` and `getImagePreview` 43 values / 1 `null`; `getImageInfo` 13 /
31; `getVideoPreview` 2â€“3 / 27; waveform and thumbnails 0 / 16. The waveform and thumbnail zeros are
_correct_ -- a corrupted file has no decodable audio or frame to extract -- but they are only trustworthy
because item 1 proves those paths work on pristine input.

**Known upstream issue, deliberately not worked around.** The suite emits Node `DEP0137`
("Closing a FileHandle object on garbage collection"). Root cause is in `exifr`, not here: its chunked
reader calls `this.file.close && this.file.close()` in `parse()` **without awaiting it**, so the
`fs.promises.FileHandle` from `readChunked()` can be collected mid-close. Confirmed pre-existing and
scale-dependent -- the 19-test EXIF suite builds tiny hand-written TIFFs that never enter chunked mode, so
only the 44 real image files in this suite trigger it. Not worked around because the only clean fix is to
pass `exifr` an in-memory buffer, which trades a deprecation warning for a whole-file read on large images.
Tracked as upstream debt.

**Tier separation.** The suite is excluded from `vitest.config.ts` and runs only via
`npm run test:media-fuzz` (`vitest.media-fuzz.config.ts`), with `setupFiles: [src/test-setup.crash.ts]`,
`maxWorkers: 2`, and a 900 s per-test ceiling. The unit suite is unaffected.

**Final state:** `test:media-fuzz` 6/6 in ~14 s; unit 3060/3060 across 203 files; typecheck, format, and lint
clean (lint keeps its one pre-existing `jsx-a11y/no-autofocus` warning). `git status` shows no leftover
scratch files and no modified production sources.

### EXIF bombs -- the parser is hardened, _our_ layer was not (DELIVERED)

`exifr` 7.1.3 survived every hand-built TIFF bomb (IFD offset outside the buffer, 65535 entries, an
`IFDCount` that reads as a negative int16, a self-referential `IFDNext`, a `Photoshop` IRB declaring
4 GB, truncated entry tables, 64 KB of zeros) in 2â€“6 ms with no throw, hang, or oversized allocation.
The bugs were both in `src/main/image-info.ts`:

1. **A garbage file was reported as having metadata.** `exifr` does not throw on a malformed block; it
  _recovers_ and reports the problem in an `errors` array on its result. `flattenExif` flattened that
  array like any tag, so a file with no readable EXIF at all produced
  `{ errors: 'RangeError: Offset is outside the bounds of the DataView' }` -- internal parser text
  surfaced as user-visible metadata, and `getImageInfo` returned non-`null` for a garbage file. Fixed by
  logging and dropping the top-level `errors` key before flattening; genuine tags parsed alongside a
  failure still surface, so partial recovery is preserved. Mutation-verified (stripping removed ->
  7 tests fail).
2. **Unbounded work in `flattenExif`.** Bounding recursion _depth_ is not sufficient. A node holding
  several keys that point back at the same ancestor reaches the depth cap along an **exponential
  number of distinct paths**, so a handful of bytes kept the walk running indefinitely (measured:
  > 2,000,000 node visits at depth 31, still climbing, against a depth cap of 32). Fixed with a second,
  > independent guard -- a budget of 1,024 nodes visited per call -- which bounds traversal time, result
  > size, and stack depth together. 3 mutations caught: dropping the depth cap, dropping the node budget,
  > dropping the `errors` strip.

Two notes for whoever extends this, both learned the hard way here:

- **A guard that another guard already covers is untestable, and therefore unverified.** A
  `WeakSet` cycle guard was written first and then removed: the depth cap already bounds recursion, so
  no return-value test could ever observe the cycle guard missing, and _worse_, because the guard
  deleted each node on backtrack it did not even stop the exponential case. The same masking happened
  in reverse when a 50,000-node chain was used to test the depth cap -- the node budget cut the walk
  short first and the mutation survived. Each guard now has a test built to isolate it: the chain is
  1,000 nodes (above the depth cap, _below_ the node budget) and the branching tree is 14 levels deep
  (below the depth cap, far above the budget).
- **A test that hangs is worse than no test.** Mutation runs kept stalling the suite, because an
  unbounded synchronous walk blocks the event loop and no `testTimeout` can interrupt it. The
  adversarial structures are now sized to terminate either way, so a regression fails an assertion
  instead of wedging a worker.

A negative result worth recording: `x`/`y` and `StripByteCounts` of `0xFFFFFFFF` are **well-formed**
LONG tags, not corruption. exifr parses them and the values are surfaced; an early draft wrongly
grouped them with the unparseable bombs, and the test failed until it was corrected.

### `FrameDecoder` fuzz -- a hang that kills the process (DELIVERED)

**The bug: `frameSize === 0` was an uncatchable OOM, not a hang that reports itself.** The stdout
assembler drains with `while (framePartsLen >= frameSize) { ...; framePartsLen -= frameSize; }`, which only
makes progress when `frameSize` is a **positive integer**. `open()` computed
`frameSize = width * height * 3` from caller-supplied dimensions with no validation, so: | Input  | Old behaviour |
| `width = 0` or `height = 0` | Condition permanently true, subtraction a no-op. **One byte of stdout** spins forever pushing zero-length buffers onto `pendingFrames` until V8 dies: `FATAL ERROR: ... JavaScript heap out of memory`, worker gone, _nothing catchable_ |
| negative dimension | `Buffer.alloc(-12)` throws a `RangeError` **inside an EventEmitter `data` handler**, where no caller can catch it  |
| `NaN` / `Infinity` dimension | `framePartsLen >= NaN` is false forever -> **silent permanent stall**. No error anywhere; playback just never starts  | In production this is the **Electron main process**, not a test worker -- the player would freeze and then
die rather than surface a failure.

**Reachability, stated honestly.** The one production caller,
`src/main/ipc/player.ts:132`, guards with `if (videoStream?.width && videoStream?.height)`, and `0` is
falsy, so `frameSize === 0` is _not_ reachable through it today. That is a distant caller's truthiness
check standing between a public method and a process-killing loop, with the invariant unenforced at the
layer that actually owns the loop. `Math.max(PLAYER_MIN_DIMENSION, ...)` guards the _scaled_ branch of
`capResolution` but not its early-return branch. The fix therefore validates at the derivation rather
than relying on the caller.

**Fix.** `resolveFrameSize()` / `safeDimension()` / `resolveAudioTarget()` in
`src/main/player/frame-decoder.ts` coerce dimensions to positive integers and non-finite audio configs
to `AUDIO_TARGET_MIN_BYTES`. It returns the clamped **width and height alongside** the size, because
passing the raw request to ffmpeg's `-s WxH` while assembling a different byte count would desynchronise
the decoder from its own output. Clamping warns (`LOG_FFMPEG_DECODER_RESOLUTION_CLAMPED`) so a silent
resolution change is still visible.

**Deliberately _not_ clamped: an upper bound.** A `100000 Ã— 100000` request is a legitimate 30 GB frame,
not a hostile one, and `capResolution` already caps to 640Ã—360 upstream. Clamping to a maximum here would
reject valid 4K decodes, so that case is asserted to be _honored_ instead.

**Dead branch removed, found by a mutation that nothing caught.** Reverting `spawnFfmpeg`'s dimension
handling was caught by **zero** tests. The cause: that branch is **unreachable**. `open()` and `seek()`
both call `spawnFfmpeg` with `undefined` for width and height, having already set the fields -- so it was
dead code carrying an unvalidated `frameSize` derivation and a landmine for the next caller. Removed, and
its parameters dropped from the signature. This is the plan's own Phase 2 precedent ("dead guard removed
rather than kept as decoration that no test can distinguish") applied to a method instead of a guard.

**Mutation-verified -- 5 mutations, all caught.** N1 and N4 kill the worker with an OOM, which _is_ the
signal here: a "passing" suite cannot contain an unbounded loop. | #  | Mutation | Caught by  |
| N1 | revert `open()` to `frameSize = width * height * 3`  | OOM, worker exits (`Tests 43 passed` of 78, file dies) |
| N2 | drop the `Number.isFinite` guard in `safeDimension`  | 4 tests (the `NaN`/`Infinity` stalls) |
| N3 | revert the audio target to `Math.max(512, Math.round(...))` | 4 tests (`Math.max(512, NaN)` is `NaN`) |
| N4 | `MIN_DECODE_DIMENSION = 0`  | OOM, worker exits |
| N5 | bytes-per-pixel 3 -> 4  | 18 tests (every frame-length and ledger assertion) | **Two test bugs recorded, both of which first looked like source bugs:**

- I asserted `residual % frameSize === 0` for a 1-byte feed against a 96-byte frame. The residual is
  _supposed_ to be a partial frame. Corrected to pin the emitted count to
  `floor(total / frameSize)` directly.
- The emitted frame **count** is not a pure function of the byte stream: `emitAvailable` has a deliberate
  200 ms emergency flush that emits a frame with an **estimated** PTS when showinfo lags, so a GC pause
  alone makes the count nondeterministic. Feeding a PTS _surplus before_ each data chunk removes the time
  dependence and makes the ledger assertion exact.

**A vacuous assertion I had to strengthen.** The hostile-dimension tests originally asserted only "does not
throw" -- which a decoder that _stalls_ passes trivially, since a stall raises nothing. That is why N2's
`NaN`/`Infinity` stalls initially went uncaught: 0 frames emitted, no error, green. The tests now require
frames to actually be assembled. That tightening is what caught `huge dimensions` mis-classified as
hostile when it is merely large.

**Verified:** unit **3041/3041**, `npm run typecheck` 6/6, `npm run lint` 0 errors, `npm run
format:check` clean.

**The histogram bug: an unbounded loop plus an invisible `NaN`.** The original loop was
`const total = width * height`, trusted outright. Those dimensions come from the ffmpeg _scale filter_,
while the byte count comes from whatever ffmpeg managed to emit before it died -- two independent
sources that can disagree on a truncated decode. Two consequences:

- **A hang, and it is a DoS, not a slow test.** The plan's own "60kÃ—60k PNG" case is
  `60_000 * 60_000 = 3.6 Ã— 10^9` iterations. My first run of this fuzz _never returned_ -- it had to be
  killed, twice. That is the plan's "hangs are bugs" rule firing on production code, not on a test.
- **A `NaN` written to a string key.** `buffer[idx]` past the end is `undefined`, so `r[undefined] += 1`
  writes to the property `"undefined"` and stores `NaN` there. This is the nasty part: the array still
  reports `length === 256`, `.some(Number.isNaN)` returns **false** (it only walks indices), and
  `reduce` ignores it -- so the corruption is invisible to every ordinary array check while a renderer
  iterates and draws it.

Fix: clamp to the pixels the buffer actually holds, `Math.max(0, Math.min(Math.floor(buffer.length / 3),
width * height))`.

**Mutation-verified (M1 already run -- do not re-run blindly).** Reverting the clamp to
`const total = width * height` fails **4 of 8** tests. This was confirmed. **Note for the next
session: re-applying this mutation re-creates the hang, so wrap any future mutation attempt in
`try { ... } finally { restore }` and never leave it pending across a commit** -- an interrupt mid-command
left the DoS version committed to the working tree twice.

**A guard I wrote, then deleted.** My first fix added an explicit
`Number.isFinite(width) && Number.isFinite(height)` check. Mutation M2 removed it and **all 8 tests
still passed** -- the clamp already subsumes it, because `Math.min(NaN, n)` is `NaN` and `i < NaN` never
iterates. Dead guard removed rather than kept as decoration that no test can distinguish.

**Two test bugs, recorded because both initially looked like source bugs:**

- I asserted `sumOf(hist) === w*h*3*4`. The correct figure is `w*h*4` -- four channels, one count per
  pixel; I had confused bytes with pixels.
- The soundness helper called `expect()` once per bin: 1024 bins Ã— 2000 runs â‰ˆ 2 M assertion frames,
  which turned a sub-second pure fuzz into a 30 s timeout. It now collects violations and throws once.

#### Remaining Phase 2 work, in suggested order

1. ~~**`withTimeout`**~~ -- **DELIVERED**, see "Subprocess watchdog" above.
2. ~~**`frame-decoder.ts` fuzz**~~ -- **DELIVERED**, see "`FrameDecoder` fuzz" above.
3. **EXIF bombs** -- hand-built TIFFs, no ffmpeg. Targets `getImageInfo` (`src/main/image-info.ts:191`,
  uses `exifr`) and the pure `flattenExif` (`:56`).
4. **Real corpus + `test:media-fuzz`** -- the most expensive item. Needs a genuine source file to corrupt;
  `ffmpeg-static` resolves to a real `node_modules/ffmpeg-static/ffmpeg.exe`, so the corpus can be
  _generated_ rather than checked in.

### Subprocess watchdog -- `src/main/spawn-timeout.ts` (DELIVERED)

**The survey that decided the scope.** All 10 ffmpeg/ffprobe spawn sites, re-checked: | Site | Bounded?  |
| `src/main/transcoders/fftool-core.ts` (`getInfo`, raw ffprobe) | **yes** -- `TRANSCODER_DEFAULTS.FFPROBE_TIMEOUT_MS` |
| `src/main/transcoders/ffmpeg-core.ts` (`getInfo`, fluent-ffprobe `.ffprobe`) | **yes** -- same constant  |
| `src/main/image-info.ts` (`decodeImageHistogram`) | **yes** -- `IMAGE_HISTOGRAM_TIMEOUT_MS` (15 s)  |
| `src/main/video-preview.ts` (`extractPreviewFrame`) | **yes** -- `VIDEO_PREVIEW_TIMEOUT_MS` (15 s)  |
| `src/main/timeline/timeline-media.ts` (`spawnBuffer`) | **yes** -- `TIMELINE_EXTRACT_TIMEOUT_MS` (30 s)  |
| `src/main/transcoders/fftool-core.ts` (convert) | no -- user-initiated, unbounded by design  |
| `src/main/transcoders/ffmpeg-core.ts` (convert) | no -- same  |
| `src/main/transcoders/bmf-core.ts:99` | already bounded (`BMF_TIMEOUT_MS`)  |
| `src/main/transcoders/bmf-core.ts:143` (convert) | no -- same as the other converts  |
| `src/main/capabilities.ts:116` | already bounded (`CAPABILITY_PROBE_TIMEOUT_MS`)  |
| `src/main/player/frame-decoder.ts` | no -- **deliberately**, see below  | **Five wired, not six.** The wrapper only bounds work that must terminate on its own. A user-initiated
conversion is _supposed_ to run for as long as the input needs; a wall-clock kill there would abort
legitimate jobs. `frame-decoder.ts` is a long-lived stream whose IPC front end already applies
`TRANSCODER_DEFAULTS.PLAYER_FRAME_TIMEOUT_MS`, so a second inner timer would be redundant and would
risk killing the decoder between frames. Both exclusions are documented in
`src/main/spawn-timeout.ts` and `src/main/player/frame-decoder.ts` so the next session does not
"fix" them.

`TRANSCODER_DEFAULTS.FFPROBE_TIMEOUT_MS` was already declared and documented but **never used in
production** -- the gap was a declared-but-dead constant. It is now wired at both probe sites.

**Design decisions worth keeping:**

- **Structural `Killable`, not `ChildProcess`.** `ffmpeg-core.ts` hands the watchdog a fluent-ffmpeg
  _command_, not a child process; typing the parameter `ChildProcess` would have forced a cast there.
  `{ kill(signal): unknown }` covers both.
- **The starter registers the target synchronously.** `onSpawn(child)` is called inside the promise
  executor, so the watchdog never races a child that has not spawned yet.
- **Never throws synchronously.** A synchronous throw from `start()` is converted to a rejection, so
  every caller can rely on `.catch()` alone.
- **The timer is not `unref`'d.** An unref'd timer could let the event loop drain between a child's
  `close` and the settlement of the promise built from it, losing the result.
- **The error detail says "timed out", not "exceeded".** Readable in a log, and if the error is ever
  rethrown raw rather than as this `AppError`, `inferErrorCode` still classifies it as a timeout
  instead of as whatever the label happens to mention. This is mutation M6 below.
- **`spawnBuffer` keeps its never-reject contract** by degrading a timeout to
  `{ code: -1, data: Buffer.alloc(0), stderr }` rather than propagating.

**Three findings the tests produced, which the code did not:**

- A timed-out preview attempt **rejects**, so it never reaches the fallback retry. My first draft of the
  `video-preview.ts` docblock claimed the worst case was "twice the budget"; it is one budget. Corrected.
- Timeline extractors run under a `MAX_CONCURRENT_FFMPEG` semaphore, so a hostile file is drained in
  **waves** of `TIMELINE_EXTRACT_TIMEOUT_MS`. Total wall time is
  `ceil(spawns / MAX_CONCURRENT_FFMPEG) * budget` -- bounded, but not the constant. Corrected.
- Timeline's semaphore state is module-level, so when a mutation removes the watchdog the leaked
  `activeSpawns` count cascades into unrelated timeline specs. Confined to the broken-code case.

**Mutation-verified -- 7 mutations, all caught.** Per this phase's earlier lesson, each ran inside
`try { ... } finally { restore }`: | #  | Mutation | Caught by  |
| M1 | drop `killQuietly(target, label)`  | 2 tests |
| M2 | drop the invalid-budget guard (runs unbounded)  | 5 tests |
| M3 | never `clearTimeout` the watchdog  | 3 tests |
| M4 | reject with a plain `Error` instead of the `AppError`  | 5 tests |
| M5 | let a synchronous `start()` throw escape  | 2 tests |
| M6 | move the timeout rule _below_ the `failed`/`conversion` rules in `inferErrorCode`  | 5 tests |
| M7 | reduce `withTimeout` to `start(() => undefined)` -- every site stays wired, nothing fires | **all 6 new per-site hang tests** | M7 is the important one. Wiring tests alone do not prove a budget is _enforced_: every pre-existing spec
drove `close`/`ffprobe` explicitly, so a completely absent watchdog passed all of them. Each of the five
sites now has a test that drives a child which **never settles**, advances fake timers to the boundary
(`budget - 1` asserts no kill, `+1` asserts the kill), and pins the resulting error. The preview test also
pins that a hang does **not** consume the second attempt's budget.

**Bug found while writing the tests:** `FFPROBE_TIMEOUT_MS` is a member of `TRANSCODER_DEFAULTS`, not a
top-level export. Importing it as a named export silently yielded `undefined`, making
`advanceTimersByTimeAsync(undefined - 1)` a `NaN` that hangs the test. `npm run typecheck` catches it --
but only via `tsconfig.test.json`; `typecheck:main` alone does not cover spec files.

**Verified:** unit **2995/2995**, `npm run typecheck` 6/6, `npm run lint` 0 errors (1 pre-existing
renderer warning), `npm run format:check` clean.

#### Path corrections (three of this phase's targets were filed under paths that do not exist) | Plan says | Actually is  |
| `src/main/ffprobe-mapper.ts` | `src/main/transcoders/ffprobe-mapper.ts`  |
| `src/main/timeline-media.ts` | `src/main/timeline/timeline-media.ts`  |
| `process-utils.ts:128` (`withTimeout`) | does not exist; the file is 133 lines and exports only suspend/resume | Also: `getMediaInfo` and `convertFile` are **not** exported functions -- they are IPC handlers at
`src/main/ipc/conversion.ts:79` and `:92`, delegating to `createTranscoder(type)`. Fuzz them through
the transcoder layer or the IPC layer, not by importing a function that isn't there.

---

## Phase 3 -- IPC contract & abuse testing (the real main process)

This is the largest coverage hole: 13 of 14 Tier A specs replace the entire main process with a mock.

### 3.1 Channel inventory test - **DONE**

New `src/main/ipc/__tests__/channel-contract.test.ts`, 8 tests:

- Import `registerIpcHandlers` with a fake `ipcMain` that records every channel -> build the
  authoritative set.
- Diff it against the union of channels in `src/shared/ipc-channels.ts` **and** every `on*` method in
  `src/preload/index.ts` and `src/renderer/electron-api.d.ts`.
- **Fail on any drift in either direction.** This alone kills the F5 class of bug permanently.
- Add a `data-testid`-style lint that every channel constant has a matching `ipcMain.handle`.

**Result - DONE (2026-10-01), and the plan's own prescription had to be corrected.** The 8 tests pass
(`3068/3068` unit across 204 files; typecheck, format, lint clean - lint has only the pre-existing
`LanguageMenu.tsx` `no-autofocus` warning). Recorded counts: **46 handlers + 7 listeners** in
`registerIpcHandlers` under non-dev, **+6 handlers** from the three separately-wired bridges, **79**
runtime preload members.

**The channel set is discovered by executing code, not by grepping source.** Each test calls the
_real_ `registerIpcHandlers` / `registerMonitoringIpcBridge` / `registerAnalyticsIpcBridge` /
`registerMcpSettingsIpc` and the _real_ preload against a recording `electron` mock, then invokes
every API member. A source-grep version would have been weaker in the one place it matters most: the
registrars are composed from a dozen modules and two of them are wired _outside_ `registerIpcHandlers`.

**Three registrars are wired directly by `src/main/index.ts`, not by `registerIpcHandlers`.**
`registerMonitoringIpcBridge`, `registerAnalyticsIpcBridge`, and `registerMcpSettingsIpc` each
contribute 2 handlers. A test that only called `registerIpcHandlers` would have classified 6 live
channels as dead.

**`DEV_CAPTURE_SCREENSHOT` is conditional, and this is a live footgun.** `registerDevHandlers` only
registers it when `isDevMode()`. Because `NODE_ENV` is `test` under Vitest, the dev registrar
contributes **zero** channels to the main surface in the unit tier - the single largest source of a
passing-but-vacuous inventory. It is now covered by its own explicit test that flips `NODE_ENV` and
`process.argv` to prove registration in dev and _absence_ in production.

**The first version passed 8/8 while 5 of those tests could not fail. This is the load-bearing
finding.** An orphan handler added to `image.ts` (`get-image-info-orphan`) was detected; the same
mutation re-run after a refactor that memoized `collectSurfaces()` **passed**. Cause: the dev-mode
test cleared the shared `rec.handle` array and never restored it, so with a memoized surface every
later test observed an empty handler list - `every(...)` over `[]` is `true`, so reachability,
overlap, and classification all passed on nothing. Fixed by giving the recorder a dedicated
`handleLog` the dev test owns, and by memoizing the surface collection so a second run cannot
silently re-register. **A shared recorder plus a memoized collection is exactly the combination that
makes a contract test lie**, and no amount of reading the test would have shown it; only re-running a
known-caught mutation did.

**Mutation evidence (3/3 caught, each with a backup and `try/finally` restore):** | Mutation  | Caught by |
| Preload `invoke`s unregistered `capabilities-v2` | 3 tests - unregistered invoke, handler reachability, classification  |
| Preload gains an undeclared `getCapabilitiesBrandNew` | runtime-vs-`electron-api.d.ts` member drift  |
| Orphan `ipcMain.handle` in `image.ts` | handler reachability (caught again after the memoization fix - see above) | **Known limitation, recorded rather than hidden:** the two `getPathForFile` paths (preload
`webUtils`, renderer `File.path`) cannot be exercised under a mock, so they are skipped by explicit
name. And `src/shared/__tests__/ipc-channels.test.ts` only asserts hardcoded string literals - it
provides no wiring coverage and does not overlap with this test.

### 3.2 Handler abuse harness -- **DONE**

New `e2e/specs/ipc-abuse.spec.ts`, launched with `mock: false` (real preload + real main), driving
handlers through the public `window.electronAPI` rather than the drafted
`app.evaluate(() => require('electron').ipcMain)`. `ipcMain.handle` exposes no way to _invoke_ a
registered handler, and `require` does not exist in the main realm Playwright evaluates in, so the
drafted approach could not work as written; going through the real preload also means structured
clone is genuinely exercised instead of bypassed. 20 tests, all passing, ~8.5 min.

**Deviation from the draft, and why.** The draft shares one app across every input. That turned a
single hostile payload into a cascading failure: `big-array` leaves the main process walking ten
thousand filesystem paths, and that work was still draining when the next input ran, so the app
closed and the remaining nine tests reported "Target page, context or browser has been closed" --
reporting a harness artefact as ten separate handler defects. **Each hostile input now gets its own
Electron instance**, which also makes the boundary audit attributable to one input.

**Five production bugs found and fixed** (all mutation-verified, 8/8): | #  | Site | Bug  | Fix |
| 1 | `src/main/ipc/dialogs.ts` | `expandPaths` iterated a bare string, so `expandPaths('../../../../etc/passwd')` walked the filesystem **once per character**; the `.` expanded the whole working directory. Main process stalled >2 min. | `coerceNonEmptyArray` shape guard, returns `[]`  |
| 2 | `src/main/ipc/system.ts`  | `revealFile` forwarded unvalidated args to `shell.showItemInFolder` -> raw `TypeError: Argument must be a string`. | `coerceOsString` guard  |
| 3 | `src/main/updater.ts`  | `openReleaseNotes` / `installUpdate` forwarded to `shell.openExternal` / `shell.openPath`; `installUpdate` then called `app.quit()` **regardless** of whether the installer started. | `coerceOsString` guards  |
| 4 | `src/main/ipc/queue.ts`  | `JSON.stringify(config)` in the log line threw `Converting circular structure to JSON`. **Structured clone preserves cycles**, so a cyclic object genuinely reaches the handler. | Log the object; `sanitizeLogArg` already handles cycles |
| 5 | `src/preload/index.ts`  | Same `JSON.stringify` bug, but on a Promise-returning method, so it threw **synchronously** -- a renderer's `.catch()` never sees it and the error escapes as an unhandled renderer exception before main is involved. | Log the object  | Bug 4 is the interesting one: fixing bug 5 alone left the channel still broken. Two identical
`JSON.stringify` calls on the same payload, in two processes.

Also added `MAX_OS_STRING_LENGTH` (4096, under Windows' 32,767 extended-length limit): a type check
alone does not stop a 1 MB string, because it _is_ a string -- it simply is not a path. All three
`shell.*` sites forwarded one verbatim before this.

**Three harness defects the suite found in itself**, all of which had been reporting production
defects that did not exist:

- A 5 s per-call budget raced `playerGetFrame`'s own 5 s `PLAYER_FRAME_TIMEOUT_MS` and failed 16 of
  17 sweeps. Fixed by raising the budget to 15 s and allow-listing the two methods that block by
  design (`playerGetFrame`, `checkForUpdates`) -- with a separate assertion that they still _settle_,
  so an unbounded wait is still caught.
- An "oversized payload" check asserted on `preview.length`, but `preview` is deliberately truncated
  to 400 chars, so it measured the truncation, not the payload, and flagged the app's own ~1 KB
  file-filter list. Replaced with `maxArgLength`, measured on the untouched argument.
- The boundary audit asserted that each sweep must _reach_ a contract-checked boundary. That is
  backwards: once the handlers correctly reject hostile input before the OS, nothing reaches
  `shell.*`, and sixteen tests failed **demanding the regression back**. Liveness is now proved once,
  separately, with a valid argument; the per-input audit passes vacuously when nothing bad happened.

**Input catalogue extended** to 17: added `BigInt`, `Symbol`, and a function -- values structured
clone _can_ carry, so they reach the main process and exercise the guards that a clone rejection
would otherwise hide. The `expandPaths` element-level gap (a valid array of invalid entries) remains
open and is not yet fixed; the `big-array` case currently survives because `expandMediaPaths`
resolves each element.

### 3.3 Event-channel abuse -- **DONE (2026-10-05)**

New `e2e/specs/ipc-events.spec.ts` -- main emits **every** `on*` channel with: garbage payload, `null`,
wrong-shaped object, 10k-element arrays, and 5 MB blobs, at 100 Hz for 2 s, while the renderer is on
each of the 12 routes. Assert: no `pageerror`, no crash, and the app stays interactive.

Delivered as specified, plus `cyclic` and `deep`, which the original five shapes did not cover and
which turned out to matter (Â§ below). 12 tests, all green; whole Tier B suite 4 files / 41 tests.

#### What the sweep found, in the order it found it

**1. Two unguarded payload dereferences crashed the renderer.** `onConversionProgress` and
`onQueueProgress` read `data.input` / `data.progress.percent` before validating anything, so a `null`
event threw inside the preload listener:

```
TypeError: Cannot read properties of null (reading 'input')
TypeError: Cannot read properties of undefined (reading 'percent')
```

Fixed centrally rather than per handler: `src/shared/ipc-guards.ts` exports type-predicate
validators, and all **15** payload-bearing push channels now validate before dereferencing, log, or
forwarding. The other 13 had the same latent shape even though this sweep only tripped two.

**2. The guard I added then became the bug.** Logging every drop is an amplification vector, because
the drop rate is controlled by the sender: 15 channels Ã— 100 Hz = 1500 log lines/second. Worse,
`onWindowMaximizedChange` logged the raw payload _before_ its guard, so `big-blob` wrote 5 MB strings
straight into the log store (`sanitizeLogArg` serialises them happily). The store filled with
multi-megabyte entries and **every subsequent route got slower** -- `/logs` took 7.7 s to answer a
round-trip while `/about` took 0.6 s, so one unguarded `log.debug` degraded the whole session. Two
fixes:

- the guard now runs _before_ the log line in that handler (and the comment says why);
- drops are rate-limited by `src/preload/event-drop-log.ts`: first 3 per channel are reported
  individually, then counted and summarised -- bounded by _both_ time (5 s) and count (every 50), so
  a flood delivered inside one millisecond still reports and a flood that stops still gets its count
  flushed. A 1000-payload flood now produces â‰¤ 25 lines. Suite-wide `appWarn` volume fell from
  thousands to 30.

Logging a value you have not checked is how untrusted data gets into your diagnostics.

**3. The renderer has no event-throughput ceiling.** `cyclic` is the only shape that _passes_
validation, so it is the only one that reaches the handlers at rate. With an attribution control in
the harness (a main-side sample on the same cadence -- `getCapabilities` resolves in main, so a slow
sample there indicts the generator rather than the app): | Rate  | Worst renderer | Worst main | Result |
| 100 Hz requested (~650 ev/s, ~43/ch) | 1483â€“2823 ms  | 1â€“20 ms | 10 of 12 routes stall |
| 10 Hz (~150 ev/s) | all under 2 s  | 1â€“4 ms | 12 of 12 pass  | Main is idle throughout, so the renderer is genuinely saturated: **it applies every incoming event
with no coalescing or back-pressure.** Real and worth fixing, but 100 Hz on 15 channels at once is
a load the app cannot produce by itself, so the gate sits at 10 Hz and the ceiling is recorded here
  and at the call site rather than deleted. Re-triage any rate with `E2E_SHAPE_HZ=<n>`.

  **Closed (2026-10-07).** The preload now coalesces the four high-frequency channels
  (`player-frame`, `player-audio`, `queue-progress`, `conversion-progress`) with latest-wins windows -
  see the Known follow-ups bullet for the closure write-up. The 10 Hz gate is unchanged: at 10 Hz the
  events are 100 ms apart, wider than every window, so nothing coalesces. What changed is the ceiling
  shape: a 100 Hz re-run still sends the same raw volume, but those four channels now deliver at most
  ~200 events/s combined to the renderer, so "the renderer applies every incoming event" no longer holds.

**4. Follow-up closed: `/logs` now windows its list (2026-10-07).** `logStore` is capped at
`LOG_MAX_ENTRIES` (2000) and `Logs.tsx` used to render every entry, re-rendering the whole list on each
append. Measured `rows=2001` on `/logs` against `-1` on every other route, worst renderer 5.5â€“7 s
under `big-blob` with main at 1â€“2 ms. **A real defect but not event abuse** -- it reproduced
in any busy session with no hostile sender, and the fix was windowing the list, not anything in the IPC
path. Delivered in stages: first the autoscroll stopped starting a smooth animation per entry and only
follows when already pinned to the bottom (which also stops yanking the view away while reading
history); then (2026-10-07) the list itself became windowed -- only the ~viewport slice of rows is
mounted, held open by transparent spacers, and the `/logs` budget in the suite was tightened from
10,000 ms to 4,000 ms (see the Known follow-ups bullet) so the regression ceiling reflects the
windowed list.

#### Harness bugs this phase found (all would have been reported as production faults)

Worth recording, because each one produced a confident, wrong failure:

- **Wrong window.** `BrowserWindow.getAllWindows()[0]` selected the splash, which main destroys after
  loading. Eight cells reported `TypeError: Object has been destroyed`. Now resolved via
  `app.browserWindow(page)`.
- **`window-close-requested` is a command, not a data channel.** `CloseConfirmDialog`'s handler calls
  `windowCloseConfirmed()`, and main closes the window -- so firing it at 100 Hz closed the app _by
  design_ and the sweep reported correct behaviour as a dozen failures. It and the two other no-payload
  channels are now classified from the `(cb: () => void)` annotation and tested for their actual
  effect.
- **Case mismatch that silently disabled the fix above.** The classifier returned `QueueCancelled`;
  the constants are `QUEUE_CANCELLED`. The exclusion matched nothing, so the command channel stayed in
  the sweep and the bug survived a full green-looking run.
- **`getSettings` does not exist** (it is `mcpGetSettings`). Found mid-run as
  `api[method] is not a function`. `SANITY_CALLS` is now typed against `ElectronAPI`, so `tsc` checks it.
- **Shared-session cascade.** One dead renderer left every later cell reporting "Target page closed",
  and cells that never ran looked like passes. Liveness is now re-checked before every cell.
- **`log.warn` detached.** The new throttle took `log.warn` as a value; `Logger.warn` reads instance
  state, so the _first_ dropped payload in production threw
  `Cannot read properties of undefined (reading 'context')`. Caught by an existing preload test.

### 3.4 The "hostile preload" E2E suite -- **DONE (2026-10-05)**

`e2e/mocks/hostile-preload.js` + `e2e/specs/hostile-bridge.spec.ts` (14 tests). Launch with
`ENCODEX_HOSTILE_MODE=<mode>`, and the mock preload makes **every** `electronAPI` method: | Mode  | Behaviour |
| `reject-sync` | throws synchronously  |
| `reject-async` | returns a rejected promise with a random `Error` shape  |
| `never` | returns a promise that never settles (tests loading/timeout UX)  |
| `wrong-type` | resolves the right _kind_ of value with a wrong shape (`null` where an object is expected, array where object, string where number) |
| `garbage` | resolves 1 MB of random bytes / deeply nested cyclic object  |
| `partial` | 30% of methods work, 70% fail -- the realistic partial-failure case  | Then walk all 12 routes and, for each, run the primary user journey. **Assertion for every case:**
no `pageerror`, navigation still works, and a recovery action succeeds once the mode flips to
`partial`-healthy. This is the suite that will find most of the real "unhandled exception" reports.

**Delivered as specified, with three deliberate departures**, all recorded because each one replaced a
weaker test with a stronger one:

- **`ErrorBanner`/`ErrorSnackbar` is observed, not asserted.** Requiring a banner is wrong (most routes
  have nothing to report when a passive `getCapabilities` fails); requiring _none_ would forbid the error
  surfacing this phase exists to encourage. The tripwire already fails the suite on an unhandled
  exception, so the assertion that matters is enforced centrally and the banner count is recorded for
  human review.
- **The load-bearing assertion is recovery, not liveness.** "Still alive" passes for a renderer with
  fifty rejected promises and spinners that never resolve. Each mode therefore flips the live bridge to
  `healthy` and requires a **real round-trip** (`getCapabilities`) to succeed, then walks a route again.
- **The preload proxies the real IPC channels** instead of answering locally, so `main` stays real and
  recovery is a genuine round-trip. A stub that answered everything would make recovery untestable.

#### What it found: 4 production defects, 2 of them white screens

Every one of these is invisible to a suite that only supplies well-formed or fast-failing bridges.

1. **The first paint was gated on an IPC call with no timeout -- a permanent white screen.**
  `main.tsx` mounted React from `bootstrapRendererMonitoring().finally(...)`, and that function
  `await`ed `monitoringGetState()`. The `try/catch` handled a _rejection_ but nothing could handle a
  promise that never settles, so a wedged main process meant no app, no error, no spinner, and nothing
  in the log. Confirmed by one-failure-per-launch attribution: `never` mode failing **only**
  `monitoringGetState` reproduced it; failing any of the other seven boot calls did not. (The
  corroborating detail: `analyticsGetState` hangs are harmless precisely because that bootstrap is not
  awaited.) Fixed with `withBridgeTimeout` (2 s), which keeps the intent -- monitoring live before first
  render -- while making the worst case late coverage instead of a blank window.
2. **A synchronous throw from the bridge crashed the renderer, and `?.` does not prevent it.**
  `contextBridge` propagates a synchronous throw straight into the caller, so `window.electronAPI
?.method(x)` covers a _missing_ API and nothing else. Unguarded: two fire-and-forget `send`s in
  `App.tsx`'s mount effect and in two store actions, four module-scope `on*` subscriptions, three
  module-scope hydration chains, `useCapabilities.loadCapabilities`, and seven `updateStore` actions.
  Three distinct consequences, all found:
  - In `App.tsx`'s mount effect the throw propagated out of the effect and took the tree down.
  - **At module scope it aborted the bundle.** `updateStore` subscribes _inside_ its Zustand
  initializer, so a throwing subscription meant `create()` never returned a state object and every
  later `get()` was `undefined` -- surfacing as `Cannot read properties of undefined (reading
'checkForUpdates')` from the 3-second update check and from `About`/`UpdateDialog` destructuring.
  That indirectness cost several debugging rounds: the stack pointed at a scheduled timer, not at the
  subscription 3 s earlier that had actually broken the store.
  - In `useCapabilities` it became a `console.error` during render, from the lazy `CodecSelect` chunk.
3. **Fire-and-forget `async` calls left unhandled rejections.** Containing the synchronous throw was
  necessary but not sufficient: `callBridgeVoid` catches only a sync throw by design, so an `async`
  bridge call used fire-and-forget still produced a rejection with no handler -- three of them, traced
  to `windowSetAlwaysOnTop` / `setLaunchAtLogin`. A 16-site sweep found the rest (`playerClose`,
  `queueSetConcurrency`, `queueSetWhenDone`, `queueUpdateOptions`, `queueRemove`, `queueMoveTo`,
  `rejectTerms`, `windowCloseConfirmed`) plus two `.then()` chains with no `.catch` at all
  (`BatchQueue`'s `queueList` and `queueGetState`). Fixed with a separate `fireAndForgetBridge`
  primitive, because the two cases need genuinely different handling and conflating them is how the
  unhandled rejections survived the first fix.
4. **The store adopted unvalidated bridge fields, so a wrong-typed result crashed a route.**
  `mcpGetSettings` hydration copied `settings.token` straight into the store; under `garbage` mode that
  is a 1 MB `ArrayBuffer`, whose `.token` is `undefined`, and `Settings.tsx` then read `token.length`.
  The same hydration is where `clampMcpPort` already existed and was not being used. Fixed by coercing
  at the boundary (`enabled === true`, `clampMcpPort(port)`, `typeof token === 'string'`).

All four are the same root cause with different blast radii: **the renderer assumed a bridge it does not
own would answer, in the right shape, on the first try.** `src/renderer/utils/bridge-call.ts` now carries
the four primitives that express the actual contract (`callBridgeVoid`, `fireAndForgetBridge`,
`bridgePromise`, `withBridgeTimeout`), with 18 unit tests written so that reverting a fix fails them.

#### Harness defects found and fixed (2, both would have produced false confidence)

- **A bisection that proved nothing.** The first attribution attempt set the failure set through
  `__hostile.setFailures(...)` and then called `page.reload()`. A reload **re-runs the preload**, so the
  injected state was discarded and every row silently re-measured the launch mode -- all six
  single-method failures reported "mounted". It looked like a clean negative result. The fix was to seed
  the set from `ENCODEX_HOSTILE_FAILURES` at load time so one failure per launch is possible; that is
  what turned "the app does not boot" into the specific `monitoringGetState` attribution above.
- **Recovery leaked into later tests.** `__hostile` state is per-window and long-lived, so the recovery
  test's deliberate flip to `healthy` left `partial` healed for every subsequent test -- which reported
  "no call ever rejected" and would have turned a real mode into a no-op. Each test now restores its mode
  first (`restoreMode`).

Two harness-faithfulness issues were also corrected, both of which had manufactured fake findings:
`reject-sync` originally threw non-`Error` values, which `contextBridge` cannot carry (it substitutes a
generic "An unknown exception occurred in the isolated context", testing Electron rather than the app);
and the `send` methods originally returned rejected promises in `reject-async`, changing the API's shape
-- a `void` method has no reply, so its entire space of real failures is a synchronous throw or silence.

---

## Phase 4 -- State machines, lifecycle & races | Area  | Attacks |
| **Queue** (`job-queue.ts`, 638 lines) | Illegal transitions: `done->running`, `error->running`, cancel-during-completion, `queueMoveTo` out-of-range index, `queueUpdateOptions` on a `done` job, 200 concurrent `queueAdd`s writing the **same** output path, `queueImport` while running, `concurrency: 0` / `99`  |
| **Conversion lifecycle** | `convertFile` -> `cancelConversion` before spawn resolves; `pause` mid-progress; `resume` after `done`; `cancel` twice; close window mid-conversion then relaunch and assert recovery  |
| **Reload/quit** | Reload the renderer 50Ã— mid-conversion; quit the app mid-update-download; kill the main process mid-queue and relaunch against the same userDataDir -- assert the persisted queue is valid and the app starts  |
| **Zustand persist** | 18 stores Ã— adversarial localStorage (Phase 1) + `localStorage.setItem` throwing (quota) + `migrate()` throwing -> app must not white-screen  |
| **Timers/listeners** | `vi.useFakeTimers()` + `vi.getTimerCount()` after unmount must be 0; mount/unmount `MediaPlayer`, `VideoTimeline`, `BatchQueue` 100Ã— and assert listener counts (`window`, `document`, `BroadcastChannel`, `ResizeObserver`) return to baseline -- the classic Electron memory leak |
| **React 19 StrictMode** | Every page test double-renders under `<StrictMode>`; the app already runs StrictMode in dev and this is untested  |
| **Race harness** | A reusable `deferred()` util + `Promise.race` timeouts so every "eventually" is a bounded assertion, not a `waitFor` that silently passes  | ### 4.1 Queue state machine & hostile numeric input -- **DONE**

New suite `src/main/queue/__tests__/job-queue-attacks.test.ts` (48 tests, four groups: hostile
numeric input, illegal transitions, cancel/complete races, bulk & reentrancy), plus 6 cases added to
`src/renderer/utils/__tests__/queue-reorder.test.ts`. Every argument under test arrives over IPC from
the renderer or out of a JSON snapshot, and `structuredClone` carries `NaN` across the boundary while
`1e999` parses to `Infinity` -- so the input space is genuinely hostile, not hypothetical.

**7 production bugs found and fixed** in `src/main/queue/job-queue.ts` (638 -> 795 lines),
`src/main/transcoders/ffmpeg-core.ts` and `src/renderer/utils/queue-reorder.ts`: | #  | Attack | What actually happened  | Fix |
| Q1 | `setConcurrency(NaN)` (also from the constructor and from `loadPersistedState`)  | **The queue bricked permanently and silently.** `this.concurrency` became `NaN`, so `while (activeJobs.size < NaN)` was false forever: `start()` returned normally, no job ever ran, and nothing logged an error. Worse than throwing, because nothing reports it. `2.5` also behaved as `3` (`size < 2.5` admits three jobs). | `clampConcurrency(value, fallback)`: non-finite is **rejected** (an unrecognisable request must not change state the queue already has), everything else is truncated and clamped to `1..MAX_QUEUE_CONCURRENCY`. Used by the constructor, `setConcurrency` and `loadPersistedState`.  |
| Q2 | `moveJobTo(id, NaN)` / `undefined` / `'4'`  | `Math.floor(NaN)` survives `Math.max(0, Math.min(NaN, n))` as `NaN`, and `Array.splice(NaN, 0, x)` is `splice(0, ...)`. So the job **relocated to the front** while the emitted event advertised `toPosition: NaN` -- which `isQueueMovedEvent` then dropped. The renderer kept its old order and the main process had already moved: a divergence neither side reports and that never self-corrects. | `moveJobTo` refuses a non-finite target outright (plus a dedicated log constant); `reorderJob` mirrors the guard so the local optimistic reorder cannot disagree with the refusal.  |
| Q3 | A backend emitting `percent: NaN`  | `?? 0` only catches `null`/`undefined`. The `NaN` reached `job.progress`, `JSON.stringify` wrote `null` into the snapshot, and -- the real damage -- `isQueueJob` requires a finite `progress`, so **every subsequent `statusChange` for that job was dropped at the preload** and its row froze for the rest of the run. The single-file `conversion-progress` channel had the same hole via `isConversionProgress`, and `bitrate` rendered as `'NaNkbps'`. | `FfmpegCore` normalises `percent`/`fps`/`bitrate` before emitting (with a narrowing `isFiniteNumber`, since `Number.isFinite` does not narrow `number \| undefined`) and clamps to `0..100`/`â‰¥0`; `JobQueue` re-normalises and range-clamps on receipt, and re-emits the clamped value so the two cannot disagree. |
| Q4 | A job that completes while the queue is paused  | It stayed flagged `paused: true` **on a DONE job**, persisted that way -- and `resume()`, which selects on `job.paused`, re-emitted a `statusChange` for an already-terminal job. | `paused = false` on every terminal transition (`end`, `error`, and the `startJob` catch).  |
| Q5 | `removeJob` on a RUNNING job, then its late `end`; `cancelAll`, then a late `error` | The queue emitted `statusChange` for jobs it no longer held: an IPC round trip the renderer discards, and a log line claiming a change for a job that is not in the list. | `holdsJob(id)` guard on every terminal/`progress` emission. Job ids are UUIDs and are never reused, so the check cannot be fooled by a later job.  |
| Q6 | `pause()` called from a `statusChange` listener mid-drain  | The drain loop had no `paused` check, so with a concurrency cap of 4 the remaining three jobs were started **in the same synchronous pass**, before `pause()` could ever return. | `!this.paused` in the drain loop condition.  |
| Q7 | `cancelJob` on a running job whose transcoder never reports back  | `cancelJob` removed the job from the queue but left the `activeJobs` entry keyed by an id that no longer exists. If cancellation never landed, the slot was lost for the rest of the session and the queue **silently ran one conversion short** -- the same class of unreported capacity leak as Q1. | Release the slot when the job leaves, then `processNext()` to refill it (only when a transcoder was actually cancelled, so cancelling a QUEUED job still cannot auto-start the queue).  | ### 4.2 Conversion lifecycle -- cancel/pause/relaunch -- **PARTIAL (cancel & pause done)**

`src/main/transcoders/__tests__/ffmpeg-core.test.ts` grew from 39 to 43 tests.

**The bug (Q8):** `fluent-ffmpeg`'s `run()` performs capability checks and argument building inside
an asynchronous `_prepare` before it spawns, and `proto.kill` is a **silent no-op** whenever
`this.ffmpegProc` is unset -- it only logs _"No running ffmpeg process, cannot send signal"_. So a
`cancel()` issued between `convert()` returning and `'start'` was **lost completely**: the process
spawned anyway, ran to completion, and wrote the output file the user had already abandoned. Nothing
reported it, because `cmd.on('end')` had no `cancelled` check at all and would have marked the job
DONE.

Fixed three ways, in the order they matter:

1. the `'start'` hook kills the freshly spawned child when `cancelled` was already requested --
  honouring the cancellation that could not be delivered earlier;
2. `cmd.on('end')` now maps to `cancelledError()` when `cancelled` is set, so a run that finishes in
  the same tick as its kill can never report success;
3. a `settled` latch guarantees **exactly one** terminal event per run, so a consumer cannot see
  `error` _and_ `end`.

Four new tests cover: cancel-before-spawn honoured on spawn, `end` racing a cancel, one terminal
event per run, and non-finite/out-of-range progress normalisation.

**Test-vs-bug discipline.** Six of the first 47 tests in the new suite were wrong, and the plan's
rule -- separate real reachable bugs from wrong test expectations -- was applied to each rather than
"fixing the code until the test passed":

- `moveJobTo is refused for RUNNING, DONE and ERROR` -- the setup left **no** QUEUED job at a
  non-zero index, so the `toBe(true)` branch was unreachable; rewritten around five jobs with the
  successful move last, where it cannot perturb scheduling.
- `a statusChange listener that cancels the next job` -- with `concurrency: 1` the next job never
  starts, so the scenario was vacuous. Replaced by Q6, which is both reachable and a real contract.
- `a throwing analytics/log listener inside one job does not strand the queue` -- **unreachable**:
  `recordAnalyticsEvent` is documented never to throw and `createSender` drops destroyed windows.
  Removed rather than "fixed"; testing a speculative failure manufactures a finding.
- `removing a RUNNING job then completing it` -- asserted against the id set captured _after_
  removal, so the legitimate pre-removal event failed it. Now asserts on the count after removal.
- `200 jobs sharing one output path` -- drove completions by firing `end` on every fake each round
  and then reading a snapshot taken _before_ those completions. Rewritten to finish the jobs the
  machine actually started, so the loop asserts on state that is current by construction.
- The harness itself: `transcoders[created++] ?? new FakeTranscoder()` silently produced **untracked**
  transcoders once the pre-seeded ones ran out, turning later `transcoders[i].emitter` into an
  undefined dereference. The factory now indexes by creation order and records what it creates.

### 4.2b Reentrancy: a crafted import could blow the stack (Q9)

`validateQueueExport` accepts any string as a `transcoder` type and any object as `options`, and
`IPC.QUEUE_ADD` passes the renderer's `transcoderType` unchecked -- so an imported file can make every
job throw inside `startJob`. That path was `startJob`'s `catch` -> `processNext` -> `drainToCap` ->
`startJob`'s `catch`, i.e. **one stack frame per job**, and the factory call sat _outside_ the `try`.
At the documented `QUEUE_EXPORT_MAX_JOBS = 10_000` cap this throws `RangeError: Maximum call stack
size exceeded` out of `start()`, stranding the remainder of the queue in QUEUED with no error
anywhere.

Fixed by moving `transcoderFactory(...)` inside the `try` and letting `startJob`'s catch consult a
`draining` flag instead of recursing: after a job fails to start it is gone from `activeJobs`, so
`drainToCap`'s own `while` condition re-evaluates and picks up the next job **without a new frame**.
Reentrancy itself was deliberately _preserved_ -- an early attempt to defer all re-entry broke the
`drained`-listener contract (a listener that adds a job and calls `start()` must see it RUNNING before
`start()` returns), and that regression was caught by an existing test, not by reasoning.

Mutation-verified: deleting the `draining` guard makes the test fail with exactly
`RangeError: Maximum call stack size exceeded`. The test uses 10 000 jobs so the claim is literally
"at the import cap"; it costs ~10 s, of which ~6.4 s is the 10 000 legitimate `log.error` lines (the
`log.error` call alone accounts for two thirds of the runtime -- removing it drops the test to 3.75 s).

### 4.4 Hostile localStorage at boot and during render -- **DONE**

New suite `src/renderer/__tests__/storage-hostility.test.tsx` (11 tests).

The row said "18 stores Ã— adversarial localStorage + `migrate()` throwing". Two corrections came out
of actually reading the code, both of which narrowed the target to where the bug was:

- this app **does not use Zustand `persist()`** -- no `persist(` appears in `src/renderer/stores/*.ts`.
  Rehydration goes through the `loadJson`/`loadString` helpers, which Phase 1 already hammered with
  arbitrary `getItem` payloads and swallowed `setItem` failures.
- the remaining hole was not a _value_ failing to parse but **access itself** failing --
  `localStorage.getItem` throwing, or the `localStorage` property getter throwing -- because that
  happens before any helper runs, and because three call sites bypassed the helpers entirely.

**3 production bugs found and fixed**, two of them on paths with no error boundary to catch them: | #  | Attack | What actually happened  | Fix |
| S1 | `localStorage.getItem` throws (storage disabled for the origin, partitioned/ephemeral session, locked userData directory) | **White screen.** `i18n/config.ts` read the persisted language at **module scope** (`const savedLang = localStorage.getItem(...)`), so the throw fired while the module was still importing -- React never mounts, and no error boundary exists yet because none has been rendered. The module's own doc comment promised to fall back "when storage is unavailable"; the code did not. | Route the read through `loadString` (and keep the `\|\| DEFAULT_LANGUAGE`, which still covers an empty stored value). |
| S2 | Same, during render  | `ColorModeContext` read inside a `useState` **lazy initializer** -- a throw fails the very first render, before any boundary is mounted -- and wrote inside a `useEffect`, where a throw is an uncaught React error. | `loadString` / `saveString`.  |
| S3 | `localStorage.setItem` throws during a language switch  | `LanguageMenu.switchLanguage` is `async`, so the throw became an **unhandled rejection** rather than anything the user could see, and it skipped `closeMenu()` -- the menu stayed open over an app whose language had already changed. | `saveString`, which degrades to "the preference does not survive a restart".  | `BatchQueue`, `GettingStartedCard`, `videoCutStore` and `sessionCleanup` were already guarded and were
left alone; two further gaps in the _helpers_ were closed by tests rather than by code: `saveJson` must
swallow a value that cannot be serialized at all (a cyclic object or a `BigInt` throws inside
`JSON.stringify`, a different path through the same `try` than `setItem` does), and `loadJson` must
report a throwing read exactly once.

Each fix is mutation-verified: reverting any one of S1, S2 or S3 individually fails exactly one test in
the new suite.

### 4.5 Timer, listener & observer leaks -- **DONE**

New suite `src/renderer/__tests__/listener-leaks.test.tsx` (7 tests): 100 mount/unmount cycles each for
`VideoTimeline`, `useHotkeys`, `BatchQueue` and `AppDrawer`, 20 for `MediaPlayer`, plus two timer cases
that assert _behaviour_ rather than a count.

**1 production bug found and fixed (Q10):** | #  | Attack | What actually happened  | Fix |
| Q10 | Unmount `VideoTimeline` while a scrub/drag is in flight | The component registers `window` `pointermove`/`pointerup` from `handlePointerDown`, i.e. with the closures of **whichever render is current at pointerdown**, while its cleanup effect has `[]` deps and therefore removes the closures from the **first** render. The timeline re-renders on scroll, zoom, trim and playhead -- essentially always -- so on any drag that begins after the first commit the two identities differ and unmount removes a pair nobody registered. The real pair stayed on `window` forever, keeping the detached component and its props reachable: a leak that grows one tree per abandoned drag. | Track the _registered_ pair in `windowDragHandlersRef`; `releaseWindowDragListeners()` removes exactly what was registered and is called from both `pointerup` and the unmount effect. | **Two harness bugs had to be fixed before any of this was true**, and both are recorded because they
produced confident green runs:

- `window.addEventListener` is an **own property of the jsdom window**, so patching
  `EventTarget.prototype` -- the obvious way to count listeners -- silently missed every `window`
  registration while still counting `document` ones. The first harness reported `7 passed` and failed
  to catch a mutation that removed each component's `window` cleanup outright. Both the prototype and
  the window's own methods are now patched.
- The first version of the `VideoTimeline` test only exercised the **idle** path: its `pointerdown`
  was never asserted to have armed anything, so removing the `pointermove` cleanup changed nothing.
  The cycle now asserts `window:pointermove === 1` while mounted -- a non-vacuity guard that immediately
  exposed Q10 as a growing count from cycle 1 onward.

`vi.getTimerCount()` needed the same treatment as Q1: an absolute `=== 0` after unmount is measuring
the harness (vitest's own bookkeeping timer, and `requestAnimationFrame`, which fake timers also count),
not the component. The timer assertions therefore compare against the count **while mounted**, with a
control that arms the timer and proves the count moves.

Mutation-verified, all five cleanups caught individually: `VideoTimeline`'s release, `useHotkeys`'
keydown, `BatchQueue`'s three drag listeners, `MediaPlayer`'s coalesced-seek timer and `AppDrawer`'s
popover close timer.

### 4.6 React 19 StrictMode page renders -- **DONE**

New suite `src/renderer/pages/__tests__/strict-mode.test.tsx` (13 tests): all 12 pages rendered inside
`<StrictMode>` (the mode `main.tsx` actually runs in development), which mounts, unmounts and remounts
every component and double-invokes every render and effect body -- a path no existing page test covered.
Each case asserts the render throws nothing, produced DOM (so "rendered an empty container" cannot
pass), and unmounts cleanly; the crash tripwire converts any `console.error` or render throw into a
failure.

One `AggregateError` came back on the first run and was **a harness gap, not a bug**: `Logs`'s
follow-tail effect calls `Element.prototype.scrollIntoView`, which jsdom does not implement.
`Logs.test.tsx` already stubs it at module scope, so the same stub was applied and documented rather
than "fixing" a call that is correct in every shipped browser.

The 13th test is the non-vacuous one: it asserts that after a StrictMode remount **every** IPC
subscription `BatchQueue` registers has been disposed -- StrictMode runs each effect twice, so an effect
that subscribes without unsubscribing leaves two live listeners and fails with
`left 2 of 2 subscriptions live after unmount`. Mutation-verified: turning the `onQueueProgress`
cleanup into a bare `void` call fails exactly that test.

### 4.7 Race harness (`deferred()`) -- **DONE**

New `src/test-utils/deferred.ts` + 20 self-tests in `src/test-utils/__tests__/deferred.test.ts`:
`deferred()`, `deadline(ms, label)`, `settles(promise, opts)`, `settlesWithin(fn, opts)`,
`flushMicrotasks(n)` and `nextMacrotask()`.

The design point is that **a losing deadline must be inert**. `deadline` attaches its rejection handler
at creation rather than at race time, and cancels its timer in a `finally`, so a bound that loses
leaves neither a pending timer nor an unhandled rejection for the crash tripwire to blame on an
unrelated test. The self-test covers the case a `Promise.race`-based implementation cannot: a deadline
created, never awaited, and dropped -- `race` would attach handlers and hide the defect, so the test
deliberately does _not_ race it, and listens on `process.on('unhandledRejection')` for the four
flush points Node needs.

Mutation-verified: removing the eager handler fails 1/20, removing `clearTimeout` fails 4/20.

The harness is deliberately not yet retrofitted onto existing `waitFor` calls -- that belongs with the
tests that need it, not as a mass rewrite whose only observable effect is churn.

---

## Phase 5 -- UI robustness, i18n & accessibility

### 5.1 Locale matrix (F7)

- New `src/renderer/__tests__/i18n-matrix.test.tsx`: for **each of the 56 locales**, render all 12
  routes and assert (a) no `pageerror`, (b) no raw `{{token}}` in `document.body.textContent`,
  (c) no raw translation key (`foo.bar.baz`) rendered as literal user-visible text.
- RTL suite (DONE, 2026-10-06): `src/renderer/__tests__/rtl-direction.test.tsx` on the 4 shipped RTL
  locales (`ar-SA`, `ar-AE`, `ar-JO`, `he-IL`; no `fa-*` ships) -- asserts `dir="rtl"` + round-trip via
  `useLanguageDirection`, the `DirectionProvider`/`stylis-plugin-rtl` CSS mirror (a physical prop in a
  styled rule flips under the rtl cache and not under the ltr cache), all 12 routes rendering cleanly
  under the rtl cache, and that keyboard shortcuts fire identically in ltr/rtl sessions.
- RTL timeline/drawer finding (F7-2, 2026-10-06): the timeline and drawer do NOT reverse in RTL, by
  design -- the timeline is a positional scroller (physical `left` + `timeFromEvent` rect math) and the
  drawer keeps a fixed nav anchor; scrubbing/trimming is direction-independent. The RTL story the app
  ships is `document.dir` + emotion RTL cache mirroring generated MUI CSS only, which is exactly what
  the suite pins. If RTL mirroring of the timeline is ever desired it is a product change (timeline-utils
  math + styles), not a test gap.
- Longest-string stress (DONE, 2026-10-06): `src/renderer/__tests__/longest-string.test.tsx` registers
  a 3x synthetic pseudo-locale (`xx-XX`) built at runtime from the en-US reference -- every value
  tripled via `pseudoize()` with atomic `{{tokens}}` -- and renders all 12 routes under `de-DE` and
  `xx-XX`, asserting no page error (tripwire), no raw token, no leaked key, plus an aggregate-length
  anchor (pseudo-locale body text >= 1.5x the en-US baseline) so a render that ignores the active
  language cannot pass. Overflow/clipping is not measurable in jsdom; the route-level ellipsis contract
  is exercised visually by the Phase 5.3 browser-tier suites.
- Longest-string stress: load `de-DE` + a 3Ã— synthetic pseudo-locale to force overflow/clipping.
- Keep the existing `scripts/validate-locales.mjs` and add a **test-time** variant so CI catches a
  broken locale JSON without a separate job.

### 5.2 Missing-degradation render tests

- **LOCKED (2026-10-07)** -- `src/renderer/__tests__/missing-degradation.test.tsx` (26 tests, strict
  tripwire):
  - Every page mounts with `window.electronAPI` **undefined** (preload failure -- a real crash class in
    Electron when `contextIsolation` misconfigures). The harness models it as
    `Object.defineProperty(window, 'electronAPI', { value: undefined, writable: true })` because
    `delete` cannot (test-setup defines it non-configurable), then restores the captured bridge.
  - The six file pages are driven through `getMediaInfo` resolving `{}` and a valid-but-stream-less
    object, asserting the picked path lands in each page's store, per-page error semantics (MediaInfo
    surfaces a user error; AudioExtract swallows probe failures by design), and fault-free renders.
    Findings fixed in product code: `VideoCut.tsx` `mediaInfo?.streams.find` on the video and audio
    stream lookups; `FileSummary.tsx` `info.streams.length`.
- Large-list render budgets **LOCKED (2026-10-07)** -- `src/renderer/__tests__/big-list-budget.test.tsx`
  renders `BatchQueue` with 3,000 jobs and `Logs` with 50,000 log lines, asserting `performance.now()`
  budgets (3k cards < 120 s; 50k rows < 12 s) and that the UI stays responsive (collapse toggle).
  Gated by the blocking `test-big-lists` CI job (`vitest.big-lists.config.ts`, excluded from the shared
  unit tier; `maxWorkers: 1`, default heap so it fits GitHub's 7 GB ubuntu runners). The full 5,000-card
  render needs a ~6 GB jsdom heap (it OOM'd at the default ~4 GB and at a 5 GB cap on this machine) and
  is prescribed to the perf tier (row 8 pattern); the gate renders 3,000 cards at ~11-18 ms/card so a
  super-linear card render regression still fails.

### 5.3 Accessibility & keyboard

- Run `assertNoAxeViolations` on **all 12 pages**, in light + dark, at `320 / 768 / 1440` widths
  (today it is applied ad hoc in some tests only). Enable the currently-disabled rules in
  `src/test-utils/axe.ts` (`color-contrast`, `region`, `landmark-one-main`, `scrollable-region-focusable`)
  for the pages that pass.
- Keyboard-only smoke per page **DONE (2026-10-07)** -- `src/renderer/__tests__/keyboard-smoke.test.tsx`
  walks all 12 routes with `user.tab()` / `user.tab({ shift: true })`: browser focus order (mirrored
  to user-event's selector / tabindex-sort / visibility / disabled semantics incl. radio-group and
  `fieldset`/`legend` pruning) must match, `Shift+Tab` must return exactly reversed, and the route
  must exit to `<body>` on the last control (no focus-trap leak). The `Esc`-closes-every-dialog and
  focus-return-to-trigger contract is owned by `src/renderer/__tests__/keyboard-shell.test.tsx`
  (`Ctrl+/` -> dialog open with focus owned, `Esc` close + focus returns to the opener, `Space`/`Enter`
  activation).
- `axe-core` injected into the **E2E** renderer via `addInitScript` for a Tier A a11y spec.
- Hotkey conflicts **DONE (2026-10-07)** -- `src/renderer/constants/__tests__/shortcuts.test.ts`:
  no repeated chord inside any section (all live bindings of one page simultaneously, first-match
  dispatch), global chords disjoint from every page section, distinct global/dashboard navigation
  targets, section-prefixed ids. `src/renderer/hooks/__tests__/useHotkeys.test.tsx` data-drives the
  guard across the whole registry: every bare-key chord is suppressed inside `input`/`select`/`textarea`
  and every modifier chord still fires there.

---

## Phase 6 -- CLI & MCP hostile input

### 6.1 CLI (`e2e/cli.spec.ts` currently 61 happy-path assertions)

New `e2e/specs/cli-hostile.spec.ts`, asserting **exit codes, stderr shape, and no stack traces**:

- argv fuzzing: 10,000 args, `--` injection, `-` prefixes as values, `=`-less flags, repeated flags,
  unicode/NUL/emoji/ANSI-escape filenames, RTL-override filenames, filenames of 32,000 chars,
  `--format=../../etc/passwd`, `--output=/`, `--output=C:\`, `--overwrite` on a directory.
- Missing/empty values: `--input ""`, `--output`, `--format` (no value) -> must be a usage error (exit 2),
  never a crash.
- Invalid values: `--quality 999`, `--scale -1`, `--bitrate abc`, `--time -5:xx`,
  `--concurrency 0`, `--timeout -1`, `--concurrency 1e9`.
- Non-existent input, input that is a directory, input with no read permission, output dir that is
  read-only, **disk-full simulation** (output to a 1 KB tmpfs / a full loop device where available).
- Signals: `SIGINT` / `SIGTERM` mid-convert -> clean exit code, no orphaned ffmpeg process
  (assert with `ps` / `tasklist`).
- Every error path must print a single-line human message, never a Node stack trace.
- Exit-code map test: assert the full `--help` output parses and every documented exit code is
  reachable (this catches help-text drift, which is a real support burden).

**Status (2026-10-06).** The unit-level argv fuzz is done: `src/main/cli/__tests__/cli-argv-fuzz.test.ts`
(5 tests, fast-check). The parse layer was extracted from `runCli` into an exported
`createCliProgram()` so hostile argv can be driven without side effects (the `run*` handlers are
mocked, so a syntactically-valid draw cannot reach ffmpeg). Two properties: (1) parsing any hostile
argv -- raw or legacy-shimmed -- resolves or throws only a `CommanderError`/`CliExitError`/`AppError`
(never an arbitrary crash), 300 generated cases against a vocabulary of subcommands, aliases,
options, values, traversal/metachar/control-byte junk, each under a 5 s fast-check run timeout
(so a hang fails the fuzz); (2) `applyLegacyShim` is total, idempotent, and rewrites only by
prepending a single `convert`/`info` and dropping `--info` tokens. Non-vacuity is pinned: one test
asserts every subcommand, alias, and legacy-positional form reaches its handler, and the generator
is sampled to prove it exercises every shim branch.

**Real-subprocess CLI rows are DONE (2026-10-06).** `e2e/specs/cli-hostile.spec.ts` grew from 5 to
**17 real-subprocess E2E tests** (spawn `electron dist/main/index.js --cli ...`, assert exit code +
single-line `✖` human message + a stack-trace-free stderr contract -- no `^\s+at`, no
`file.ts:line`, no `node:internal/`, no `TypeError/ReferenceError/RangeError/SyntaxError`).
Rows covered: usage-error exits (2/3/4) and `--verbose` disagreement; unreadable input;
**disk-full simulation** (output under a regular file); **read-only output directory**;
**input-is-a-directory** (info + convert); **32,000-char input filename**; a 30 s
`SIGINT`-then-prompt-hard-kill convert (Windows; platform-split with a POSIX graceful-cancel branch);
and clean-success rows. Fixes landed in the same change:
- `src/shared/logger.ts` -- new `consoleErrorStacksIncluded` toggle (default `true`). In CLI
  non-verbose mode the console renderer prints Errors with `message` only, never `err.stack`, so an
  internal `[ERROR] [transcoders/ffmpeg-core]` diagnostic line cannot leak a `node:internal/...`
  frame into user stderr; the sink still receives the raw arg, so `--verbose` (which enables the
  toggle back on) keeps full diagnostics. `src/main/cli/cli-ui.ts` `configureCliOutput` now syncs
  the toggle from `cliConfig.verbose` (`cli.ts:89-96` + `runCli` apply it before handlers run).
- `src/shared/errors.ts` `inferErrorCode` -- reordered so runtime ffmpeg/ffprobe failures
  (`error opening output`, `exited with code`) map to `CONVERSION_FAILED` instead of being
  misdiagnosed as `FFMPEG_NOT_FOUND` (the disk-full row previously printed the "binary not found"
  message); `EACCES`/`permission denied` still wins first so a read-only output keeps
  `PERMISSION_DENIED`.
- `src/main/cli/cli-info.ts` -- `runInfo`/`runCapabilities` no longer print the `✖` before throwing;
  the top-level CLI catch is the single print (previously the message appeared twice on stderr).
- `src/main/cli/cli.ts` `cliErrorMessage` -- flattens embedded newlines so an ffprobe/ffmpeg banner
  embedded in an error message cannot expand the human `✖` line across multiple lines.
- Signal handling from earlier in this phase already ships `cli-util.ts:registerCliSignalCancel` +
  `cli-convert.ts`/`cli-batch.ts` cancellation (replacing a `process.once('SIGINT')`).

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
- `MCPJobManager` under 1,000 rapid start/cancel cycles -> no unbounded array growth, no double-free.

**Status (2026-10-06).** The unit half is done: `src/mcp/__tests__/hostile.test.ts` was rewritten
from 4 literal assertions to 29 tests that drive a real `McpServer`/`Client` over
`InMemoryTransport`. Covered: the zod boundary on every class of wrong-typed/missing/oversized
argument, unknown tools, non-record `arguments`, unknown-extra-key stripping, `__proto__`
pollution through arguments and job ids, path/traversal inputs, shell metacharacters and unknown
presets refused as `INVALID_VIDEO_FILTERS`, container/stream/auxiliary/glob refusals, job-id
hostility, and `MCPJobManager` concurrency clamping + 1,000 enqueue/cancel cycles.
**Stdio frame hostility is done too:** `src/mcp/__tests__/hostile.integration.test.ts` (8 tests)
spawns the real `dist/mcp/index.js` and asserts the server fails closed and survives -- garbage /
non-message / primitive / invalid-UTF-8 / legacy-`Content-Length`-framing lines are all dropped
with no stdout pollution, a truncated frame swallows only up to the next newline, unknown methods
answer `-32601` with the echoed id, and a > 10 MB unterminated line makes the transport's
`ReadBuffer` refuse and shut down instead of allocating without bound. Note the SDK's stdio
transport is newline-framed (no `Content-Length` headers); the plan row is expressed as
"wrong framing" + "over-cap line" accordingly.

Two hostile-but-not-refused behaviours were deliberately not pinned as contracts, and are recorded
here instead: error envelopes echo attacker input without a truncation bound, and
`fs.existsSync` accepts a directory so a directory reaches the queue. Both need fixes, and pinning
the vulnerable behaviour as "expected" is exactly what made the previous updater suite useless.

**MCP HTTP transport is DONE (2026-10-06).** A production module exists now:
`src/mcp/http.ts` (`createMcpHttpHandler` / `createMcpHttpServer` / `runMcpHttpServer`)
and the standalone entry `src/mcp/http-server.ts`. The SDK ships
`StreamableHTTPServerTransport` but EncodeX had no HTTP server code, so this closes
that gap as a feature + hostile-spec row. Design decisions (all hostile-input driven):

- **One McpServer per session, shared `MCPJobManager`.** `Protocol.connect`
  rejects a second `connect`, so every session gets its own `McpServer` but they
  all share one job manager (job state crosses sessions -- pinned by a two-session
  test). The session is registered in the Map only after `handleRequest` returns,
  because the SDK assigns `transport.sessionId` during *initialization*, not in
  the constructor; orphan transports (sessionless first POST) are closed.
- **Loopback-only by default.** `runMcpHttpServer` refuses any non-loopback bind
  host outright, and each request's `Host`/`Origin` header must resolve to a
  loopback hostname (403 otherwise), which is our own deterministic replacement
  for the SDK's opt-in exact-string `allowedHosts`/`allowedOrigins` list check.
- **Bearer auth on by default** in the standalone entry: `--token <v>` /
  `ENCODEX_MCP_TOKEN` / `--no-auth`, else a random token is generated and printed
  (`MCP_HTTP_TOKEN=...`). Compared in constant time; a token in the query string
  (`access_token`/`token`/`auth`/`authorization`) is refused.
- **Bounded sessions and bodies.** Session cap (`--max-sessions`, default 64;
  refusal 503) counts in-flight creations (`sessions.size + reserving`) so a
  concurrent burst can never overshoot the cap -- pinned by the 100-concurrent
  spawn test (exactly 8/8 with `--max-sessions 8`). Body cap 10 MB (413),
  enforced via both the declared `Content-Length` and a streaming read for
  chunked uploads.
- **Deterministic status codes.** Unknown paths 404; unsupported methods 405
  with `Allow: GET, POST, DELETE`; non-JSON `Content-Type` 415; unparseable
  JSON 400; sessionless/sessionless-after-DELETE traffic 400/404; `clientError`
  on the socket answers 400 and keeps serving. The transport's own rules are
  delegated: POST `Accept` must carry both `application/json` and
  `text/event-stream` (406), and JSON (`enableJsonResponse: true`) is the only
  response-mode toggle -- SSE is always on for GET.
- Ready line is `console.log` (not Logger), so spawn harnesses can parse the
  actual port even when `LOG_LEVEL` suppresses info.

Tests: `src/mcp/__tests__/http.test.ts` (23 unit: session lifecycle incl. a
full `convert_media` round-trip and cross-session job visibility, DELETE, routing
guards 404/405/415/406/400, orphan-session rejection, session cap with slot
freed by DELETE, body cap with declared and chunked lengths, Host/Origin guard
matrix, bearer/auth matrix, query-token refusal, server-name identity; all
strict-clean at `ENCODEX_STRICT_TESTS=2`) and
`src/mcp/__tests__/http-hostile.integration.test.ts` (8 spawn-level against
`node dist/mcp/http-server.js`: 401 auth matrix, `--no-auth`, query-string
token, non-loopback Host/Origin 403, 413 over-cap then serving, 100 concurrent
connections with a never-overflowed cap, bind-to-used-port exits 1 with stderr,
and prompt SIGTERM termination with a session hanging open).

*Still remaining in Phase 6:* none -- the CI wiring is done (2026-10-06): MCP stdio/http unit suites run in `test-unit`, spawn-level MCP integration suites in `test-integration`, CLI real-subprocess/hostile-input E2E rows in `test-e2e` (ubuntu + windows), and a new blocking `test-fuzz` job in ci.yml covers the media-corruption tier (`npm run test:media-fuzz`), with a random-seed `nightly-chaos` run in nightly.yml (`MEDIA_FUZZ_SEED=${{ github.run_id }}`). Two hostile-but-not-refused MCP behaviours remain recorded (not
pinned) as above.

---

## Phase 7 -- Updater & network hostility

`src/main/updater.ts` is 481 lines with GitHub-Releases parsing, download, and install. New
`src/main/__tests__/updater-hostile.test.ts`:

- Malformed `releases/latest` JSON: not an object, missing `assets`, `assets: null`, asset with no
  `name`, asset name with `..` / `../..` / absolute path / NUL, duplicate names, 5,000 assets,
  `size: -1`, `size: 2^53`.
- Redirect to a different host (must refuse), non-HTTPS URL, `http://` scheme, 3xx loop.
- Content-Length mismatch, truncated download, download that is an HTML error page served as 200.
- Disk full mid-write, output path not writable, `.exe`/`.dmg` file locked by another process.
- Offline mid-check, DNS failure, 500/403/404/429 with `Retry-After`.
- Timer storm: `checkForUpdates` called 1,000Ã— concurrently -> exactly one in-flight check.
- Assert the update flow never writes outside the app's update dir (a real arbitrary-write risk).

**Status (2026-10-06, later pass).** All of the above is covered by
`src/main/__tests__/updater-hostile.test.ts` (62 tests) except two rows, and the two gaps are
recorded rather than silently dropped:

- *Timer storm* is asserted at 200 concurrent calls rather than 1,000 -- 200 already proves the
  guard, and 1,000 mocked requests buys no extra signal for ~5 s of suite time.
- *Output path not writable / installer locked by another process* needs a real filesystem, so it
  belongs in an E2E spec rather than behind an `fs` mock; it is folded into the same gap as U9,
  whose unit-level half (the missing `error` listener) is covered.

The suite found 13 defects; see the **U1-U13** table above. They are fixed and the corresponding
test rows were inverted to assert the refusing behaviour. Guard rows that came back clean are kept
as regression guards: the marker cannot pollute `Object.prototype`, and `progress.percent` never
leaks `NaN` for a missing/negative/duplicated `Content-Length`.

---

## Phase 8 -- Resource limits & denial-of-service | Scenario  | Budget / assertion |
| 100,000 files dropped on a folder (`expandPaths`/`collectMediaFiles`) | completes < 5 s, no OOM, UI stays responsive  |
| 10,000 jobs in the queue, concurrency 8 | scheduler doesn't starve, memory < 500 MB delta  |
| 1,000-filter video filter chain | parsed, validated, previewed < 200 ms; ffmpeg argv stays under the OS limit |
| Catastrophic-backtracking regex in `ffmpeg-utils` / `video-filters` / `formatters` | a 100 KB adversarial input must not hang > 1 s (add a regex-scan CI step)  |
| 100 MB SRT / 10 MB JSON queue export | parse time and memory bounded  |
| 20 GB sparse file (truncated seek) | no full read into memory  |
| 1,000 rapid route changes during a conversion | no leaked listeners, no state corruption  |
| 10,000 rapid clicks on Convert | exactly one job created (double-submit guard)  | ---

### Phase 8 status (2026-10-06)

Committed budget suites cover the in-process rows as real, bounded assertions:

| Row | Committed test | Assertion |
| --- | --- | --- |
| 1,000-filter chain | `src/shared/__tests__/resource-budget.test.ts` | A 1,000-entry chain is **refused** (`Too many filters (max 8)`); worst-case accepted chain (8 x 200 chars) validates and stays under the 32k-char Windows `CreateProcess` limit; both within 1 s |
| Catastrophic-backtracking regex | `src/shared/__tests__/resource-budget.test.ts` | `timeToSeconds`, `formatBitrate`, `formatSize`, `formatDuration`, `formatClockTime`, `normalizeFilterChain`, `validateVideoFilters` all finish < 1 s on 100 KB / 50k-entry / 1 MB-string / pathological-number inputs (the actual regexes are linear; this pins that property against regression) |
| 10 MB JSON queue export | `src/main/queue/__tests__/queue-import-budget.test.ts` | A ~10 MB export at the 10,000-job cap parses+validates < 3 s; a 10,001-job file is refused; 10 MB whitespace / unterminated / 100k-deep-nested bodies return null < 3 s |
| Folder scan | `src/main/__tests__/media-scan-budget.test.ts` | 30,000 real files across 30 dirs: `collectMediaFiles` < 3 s, unique+sorted, `expandMediaPaths` dedupes overlapping roots; 300-deep chain walks without stack overflow. Setup bounded at 30 s (beforeAll/afterAll explicit timeouts) |
| 10,000 rapid Convert clicks | `src/renderer/pages/__tests__/convert-click-budget.test.tsx` | Button disabled synchronously via `setIsConverting(true)` (useConversion.ts:148) before the bridge await; 10,000 clicks -> `convertFile` called exactly once |
| 100,000-file scan | `perf/phase8-io.perf.test.ts` | 100,000 real files across 100 dirs (setup < 30 s): `collectMediaFiles` < 5 s with RSS delta < 200 MB. Measured 648.9 ms / +165 MB |
| 20 GB sparse file | `perf/phase8-io.perf.test.ts` | 20 GB file created sparse (fsutil `sparse setflag` + `ftruncateSync` on Windows, plain `truncate` elsewhere); the scan must never read it: < 1 s and < 1 MB RSS. Measured 0.5 ms / +4 KB; tree scan sees it via stat only, no allocation |
| 100 MB SRT | `perf/phase8-io.perf.test.ts` | remux plan on an unread 100 MB path stays path-bounded: < 1 s and < 1 MB RSS. Measured 0.3 ms / +24 KB |
| 10,000-job queue | `perf/phase8-queue.perf.test.ts` | 10,000 jobs queued at the `MAX_QUEUE_CONCURRENCY=4` cap (the plan's concurrency-8 row exceeds the physical cap, so the budget runs at 4): add < 1 s, drain < 8 s, all 10,000 jobs reach DONE (no starvation), RSS delta < 500 MB / heap delta < 200 MB. Measured add 14 ms, drain 3,544 ms, +20.75 MB RSS |
| 1,000 rapid route changes | `src/renderer/__tests__/route-change-stress.test.tsx` | Dedicated harness behind its own blocking `test-route-changes` CI job (`vitest.route-change.config.ts`, serialized fork): mounts the real App shell once, seeds a RUNNING job, warm-ups all 12 routes, then drives 1,000 PRNG navigations with a live router probe; per-route listeners are transient by design (each page arms its own `useHotkeys`), so growth is compared on the same route at both ends; asserts zero listener growth, error store null, running job untouched, and the router still live at the end |

The regex row's in-process guarantee (no pathological input hangs > 1 s) is pinned by
`resource-budget.test.ts`; the separate regex-scan CI step is now **live (2026-10-07)** as
`lint-regex` (`npm run lint:regex`, `scripts/eslint.regex.config.mjs` + `eslint-plugin-regexp`'s
`regexp/no-super-linear-backtracking` over the parsing money-path: main/shared/mcp/preload/test-utils).
The static scan's first run caught and fixed two real super-linear regexes that the in-process
budget tests never reached: `extractBearer`'s `/^Bearer\s+(.+)$/i` in `src/mcp/http.ts` (`\s+`
exchanges characters with `.`; rewritten as `\s+(\S.*)` -- linear, same language) and the
matchMedia stub's `/(-?\d*\.?\d+)px/` in `src/test-utils/page-render.tsx` (`\d*` vs `\d+` overlap;
rewritten as `(-?\d*\.\d+|-?\d+)` -- linear, same language). All other
Phase-8 rows are now committed with real, bounded assertions.

### Phase 9 status (2026-10-07)

Infrastructure is live; the gate is advisory until a full-run baseline is committed:

| Piece | Location | State |
| --- | --- | --- |
| Stryker config | `stryker.config.mjs` | Five mutator families active (ConditionalExpression, LogicalOperator, ArithmeticOperator, BlockStatement, ArrowFunction; v10 selects by `excludedMutations`), `break: null` (delta-gated, never floor-gated), type checking disabled per mutant (repo `typecheck` owns types), incremental reuse on |
| Mutation test scope | `vitest.mutation.config.ts` | Narrowed to the 54 direct unit-test files covering the targets (963 tests), so a single mutant run costs seconds, not minutes |
| Scoring run | `npm run test:mutate` | Full scope across all Phase-9 targets; e.g. `src/shared/math.ts` = 13 mutants, 0 survived (100%) |
| Delta gate | `scripts/mutation-delta.mjs` (modes: compare / `--generate`) | Computes mutation-testing-metrics score from `reports/mutation/mutation.json`; fails when the score falls more than `MUTATION_DELTA` (default 2.0 pts) below `mutation/baseline.json`; records the baseline when none exists |
| CI job | `test-mutation-delta` (ci.yml) | **Advisory** (`continue-on-error`) until the first completing full run records the baseline, then flip to blocking. Concurrency 4, 6h budget, uploads `reports/mutation/` as an artifact. A local run instrumented 6,060 mutants across the 49-file scope, which is the CI scale the 6h budget is sized for |
| Weekly ratchet | `mutation-ratchet.yml` | **Live (2026-10-07)**: weekly cron + dispatch. Full Stryker suite, then `test:mutation-delta` against the committed baseline (a drop fails the job and never lowers the floor), then `test:mutation-baseline` produces the ratchet candidate; uploads the candidate + report for a "chore: ratchet mutation baseline" PR |
| ffmpeg argv contract | `src/main/transcoders/__tests__/argv-contract.test.ts` | `toMatchSnapshot` for the copy/remux, full re-encode, HW-accel, added-track sync, audio-disabled+map, and filter-chain argv; a snapshot change is a behaviour change and must be reviewed |

Baseline policy: the first full CI run records `mutation/baseline.json`; a weekly job (or a
"chore: ratchet mutation baseline" PR) regenerates it with `npm run test:mutation-baseline` so the
backlog drains against a moving, never-lowering floor.

## Phase 9 -- Mutation testing (the actual "offensive" instrument)

Without this, all of Phases 1â€“8 can be theatre: assertions that pass regardless of the code.

- New dev-dep **`@stryker-mutator/core`** + `vitest` runner.
- `npm run test:mutate` scoped to the logic that decides _what ffmpeg runs_ and _what is stored_:
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
  transcoder produces -- a snapshot change is a behaviour change and must be reviewed.

---

## Phase 10 -- CI wiring, budgets & nightly chaos

### New CI jobs | Job  | Gate |
| `typecheck:test` | Blocks. Phase 0.3. **Live** -- chained into `npm run typecheck`, so CI's `typecheck` job gates it  |
| `typecheck:e2e` | Blocks. Phase 0.3. **Live** -- chained into `npm run typecheck`; was drafted as non-blocking, but all 14 e2e errors were fixed rather than allowlisted |
| `test-strict` | Blocks. Unit+integration with `ENCODEX_STRICT_TESTS=1`. **Live (2026-10-07)** -- strict is the config default across tiers, and the blocking `test-strict` gate (unit + integration) is wired into `release.yml` before packaging  |
| `test-fuzz` | Blocks. Phases 1 + 2, seeded corpus, 5 min budget. **Live (2026-10-06)** |
| `test-ipc-abuse` | Blocks. Phase 3, ubuntu + windows. **Live (2026-10-06)** |
| `test-mutation-delta` | Advisory until the first full-run baseline is committed, then blocks. **Live (2026-10-07)** -- advisory (`continue-on-error`); weekly `mutation-ratchet` workflow records the candidate baseline |
| `test-locale-matrix` | Blocks. Phase 5.1 (ubuntu, 56 locales Ã— 12 routes + RTL mirror + longest-string). **Live (2026-10-06)** |
| `test-a11y` | Blocks. Phase 5.3 (ubuntu, 12 routes x light/dark x 320/768/1440, strict axe). **Live (2026-10-06)** |
| `flake-detect` | Run 3x and fail on intermittent results. **Implemented (2026-10-06)** as the blocking `test-flake` job (fail-on-flake instead of the draft advisory PR comment; a flaky test is a bug either way)  |
| `nightly-chaos` | Nightly: full corpus fuzz with a random seed, 3Ã— e2e, 30-min soak, long-file, memory-leak re-run. **Live (2026-10-06)**  | ### Budgets to add to `perf/baseline.json` (regression-gated)

`boot_ms`, `max_rss_mb`, `queue_10k_ms`, `ipc_roundtrip_p99_ms`, `fuzz_seeds_per_min`.

### Release gate (`release.yml`)

Add a required `test-fuzz` + `test-ipc-abuse` + `test-strict` pass to the `validate-version` job so a
tag cannot be cut with a red adversarial suite. Also flip `npm audit` from
`continue-on-error: true` to blocking with a documented exception list.

### Phase 10 status (2026-10-07)

| Piece | Location | State |
| --- | --- | --- |
| perf budgets | `perf/baseline.json` (win32-x64 reference) | Re-generated from a full local run (11 files / 51 tests, all green). 47 tests recorded; adds the phase-8 IO budgets (100k-line scan 648.9 ms, 20 GB sparse 0.7 ms, 100 MB SRT 0.3 ms) and the phase-8 queue budget (10k jobs, drain 3,638.3 ms, bounded ~RSS). `perf:compare` returns x1.00 vs baseline. Maps to the plan's budget list: `boot_ms` -> `e2e.bootBudgetMs` (already committed), `queue_10k_ms` -> `phase8-queue`, `ipc_roundtrip_p99_ms` -> `phase1-ipc-overhead` suite, `max_rss_mb` -> `phase2-memory` suite, `fuzz_seeds_per_min` -> the media-fuzz tier's CI time budget (seeds/min is corpus throughput, not a machine-runnable median) |
| release gate | `release.yml` | `validate-version` now needs `test-fuzz` + `test-strict` + `test-ipc-abuse` (blocking; ipc-abuse runs against real main on ubuntu + windows from a `build` job), so a tag cannot be cut with a red adversarial suite |
| audit gate | `scripts/audit-gate.mjs` + `scripts/audit-allowlist.json`, `audit` job in ci.yml | **Blocking.** Fails on any HIGH/CRITICAL advisory not on the documented exception list (currently 5 known: vite, @vue/server-renderer, source-map-js, @modelcontextprotocol/sdk, shell-quote/concurrently). Supersedes CI_IMPROVEMENTS.md O1 + CI_CD_EXPANSION_PLAN.md N4 ("flip only when `npm audit` exits 0" -- npm now reports a larger known set than that note assumed). Gate script is tested (7 tests) |
| `test-strict` | blocking gate in `release.yml` + config default | `ENCODEX_STRICT_TESTS=1` is the default in the vitest configs, so the shared unit + integration tiers have run strict all along; the release gate makes it explicit |
| `flake-detect` | `test-flake` in ci.yml | Implemented as blocking (fail on intermittent), stronger than the draft advisory PR-comment design |

Removed from the plan's "remaining": the `perf/baseline.json` budgets and the release gate are done.
Outstanding poll items the plan left open: the audit exception list drains as each owning dependency
fixes forward; the phase-8 `regex-scan` CI step is now live (`lint-regex`, and it caught two real
super-linear regexes -- see the Phase-8 status section); the mutation-delta job flips from advisory
to blocking once the first full-run baseline is committed.

---

## Cross-cutting protocols

**Bug-for-bug.** Every production crash report becomes: (1) a failing test at the lowest layer that
can express it, (2) a `// @regression <issue-url>` comment, (3) merged before the fix. Enforce with a
PR checklist item and a `regression-tests` label check in the PR template.

**No silent skips.** `test.skip` / `it.skip` / `describe.skip` / `page.route('**/*', abort)` in
specs require an inline `// eslint-disable-next-line no-restricted-syntax -- <issue-url>` and are
counted by a CI step that fails if the count grows.

**Every async assertion is bounded.** Introduce `withTimeout()` and forbid bare
`await new Promise(r => setTimeout(r, N))` in specs (there are many today) -- those are where
hangs hide.

**Test data hygiene.** `e2e/helpers.ts` writes to `os.tmpdir()` but the repo has two orphaned
`e2e-media-*` dirs, so temp cleanup is leaky. Move all e2e artifacts under
`os.tmpdir()/encodex-e2e/<runId>` with a global `afterAll` sweep and a CI check for leftover dirs.

---

## Execution order & effort | Sprint | Phase | Effort | Ships |
| **1** | 0.1â€“0.3 (tripwires + typecheck) + 0.6  | 3â€“4 d | CI suddenly catches real crashes. Expect a noisy first run -- that is the point. Drain the noise before moving on. |
| **2** | 0.4â€“0.5 + Phase 1 (fuzz)  | 4 d | `fast-check` suite, per-file coverage floor set from the week-1 report, flake detector  |
| **3** | Phase 3 (IPC contract + abuse + hostile preload) | 5 d | The highest-yield suite. Expect a top-10 bug list.  |
| **4** | Phase 2 (media fuzz) + 8 (resource limits)  | 4 d | Corruption + DoS  |
| **5** | Phase 4 (state/race/leaks) + Phase 6 (CLI/MCP)  | 5 d |  |
| **6** | Phase 5 (i18n/a11y/keyboard) + Phase 7 (updater) | 4 d |  |
| **7** | Phase 9 (mutation) + Phase 10 (CI/nightly)  | 4 d | Last, because it needs the assertions from 1â€“6 to be real.  |

**Total â‰ˆ 6â€“7 weeks** for one engineer, or ~3 weeks for two.

## Definition of Done

- [ ] `ENCODEX_STRICT_TESTS=1` is the default in CI; zero unhandled rejections across the suite.
- [ ] Every e2e spec fails on `pageerror` / `console.error` / renderer crash / main-process uncaught.
- [ ] Every file in `src/` has >= 80% statements and â‰¥>= 70% branches; changed files are diff-gated.
- [ ] Zero `tsc` errors in test code.
- [ ] Every `ipc-channels.ts` constant is exercised by a real-handler test; drift fails the build.
- [ ] All 12 routes render in all 56 locales with no `pageerror` and no untranslated key.
- [ ] Corruption corpus: 100% of files produce a clean error, zero hangs, zero crashes.
- [ ] Mutation score >= 80% on the money-path modules, enforced as a non-decreasing delta.
- [ ] Flake rate <2% and no quarantined spec older than 21 days.
- [ ] `release.yml` cannot proceed on a red adversarial job.
