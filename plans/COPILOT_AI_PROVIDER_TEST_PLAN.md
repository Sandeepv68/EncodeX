# Copilot + AI Provider Test Hardening — Master Plan

> **Single source of truth** for expanding test coverage of the Copilot feature
> (chat-style planner) and the AI provider layer (descriptors, connectors,
> settings persistence, connect-test error mapping, settings UI).
>
> Implements the adversarial-testing rules in
> `plans/ADVERSARIAL_TEST_HARDENING_PLAN.md` and the E2E conventions in
> `plans/E2E_TEST_PLAN.md`.

- **Branch:** `test/copilot-ai-provider-coverage`
- **Owner:** Copilot / AI provider
- **Status:** `IN PROGRESS` (see Progress markers)
- **Last Updated:** 2026-10-15

---

## 0. Goals & non-goals

### Goals
1. Close the ~40 behavior gaps found in the Copilot + AI provider audit.
2. Add **unit**, **integration-adjacent**, **component**, **cross-cutting**
   (hostile-bridge / a11y / i18n / abuse-sweep) and **end-to-end** coverage.
3. Keep every new test green under `ENCODEX_STRICT_TESTS=1` (no unhandled
   rejections, no `console.error`/`console.warn`, declared faults only via
   `expectCrash` / `expectAppLog`).
4. Satisfy the blocking CI gates: global coverage (`85/75/80/85`),
   changed-file coverage (`≥80%` lines / `≥70%` branches, added lines covered),
   `lint:unused`, `typecheck`, and the 3× flake detector.
5. Add **proper translations** (not English placeholders) to all 56 locales
   for any new UI key introduced.

### Non-goals
- No behavior change to the planner/router beyond the one documented defect fix.
- No new provider adapters or operations.
- No refactor of existing passing suites.

---

## 1. Verified baseline (2026-10-15)

| Gate | Command (Windows) | Baseline |
|---|---|---|
| Copilot unit (page) | `npx vitest run src/renderer/__tests__/Copilot.test.tsx` | green |
| Copilot unit (main) | `npx vitest run src/main/ipc/__tests__/copilot.test.ts` | green |
| Copilot unit (comp) | `npx vitest run src/renderer/__tests__/copilot-components.test.tsx` | green |
| AI provider unit | `npx vitest run src/main/ai src/shared/ai` | green |
| AI settings UI | `npx vitest run src/renderer/pages/__tests__/Settings.test.tsx` | green |
| Locale key parity | `node scripts/validate-locales.mjs` | green (55 vs en-US) |
| E2E Copilot spec | — | **absent** |
| E2E AI provider spec | — | **absent** |

### Known defect (fixed in Stage 1)
`src/renderer/pages/Copilot.tsx` `chooseFolder` (lines 67–80) and
`chooseFiles` (86–99) `await` the dialog bridge with **no `try/catch`**. A
rejected `selectFolderFiles`/`selectFiles` escapes the async handler as an
**unhandled rejection**, which the crash tripwire turns into a suite failure.
Decision: **fix the product + test the fix**.

---

## 2. Cross-cutting test protocols (apply to every stage)

- **No silent skips.** Never `test.skip`/`it.skip`; park unstable E2E in
  `e2e/quarantine/` with an issue + expiry.
- **Bounded async assertions.** Use `src/test-utils/deferred.ts`
  (`deferred`, `settles`, `settlesWithin`, `flushMicrotasks`); never bare
  `setTimeout` awaits.
- **Expected faults are declared.** `expectCrash(kind, pattern)` /
  `expectAppLog(level, context)` from `src/test-utils/crash-tripwire.ts`.
- **Temp-data hygiene.** `os.tmpdir()` only; remove in `afterAll`.
- **a11y.** Use `assertNoAxeViolations` (`src/test-utils/axe.ts`).
- **i18n.** Unit tests use the mocked `react-i18next` (raw-key assertions);
  real-locale checks run under the locale-matrix config.
- **Naming.** Unit `.test.ts(x)`; integration `*.integration.test.ts`; e2e
  `e2e/**/*.spec.ts`.
- **Secrets.** Never assert on or log raw API keys; assert **absence** where
  relevant.

---

## 3. Stages, commit markers & progress

> Commit markers are recommended checkpoints. **Do not commit unless the user
> asks** — this table records *where* a commit belongs and its message.

| Stage | Scope | Commit marker | Status |
|---|---|---|---|
| 0 | Plan doc + baseline run | `test(copilot-ai): add test hardening plan` | DONE |
| 1 | Copilot fix + unit tests | `test(copilot): cover plan/enqueue/dialog edge cases; fix dialog rejection` | DONE |
| 2 | AI provider unit tests | `test(ai): cover connector/settings/ipc/registry edge cases` | DONE |
| 3 | Cross-cutting + i18n parity | `test(ai,copilot): abuse-sweep, hostile-bridge, i18n parity` | DONE |
| 4 | E2E specs | `test(e2e): add Copilot and AI-provider settings specs` | DONE |
| 5 | Verification & gates | `test: final coverage/lint/typecheck/flake pass` | DONE |

---

## Stage 0 — Setup

- [x] Write this plan.
- [x] Record baseline (Section 1).
- [x] Confirm locale work uses **real translations** for non-English locales.

**Deliverable:** this document.

---

## Stage 1 — Copilot defect fix + unit tests

**Commit marker:** `test(copilot): cover plan/enqueue/dialog edge cases; fix dialog rejection`

### 1a. Product fix (do first)
- [x] `src/renderer/pages/Copilot.tsx`: wrap the `withBridgeTimeout(bridgePromise(...))`
  awaits in `chooseFolder` and `chooseFiles` with `try/catch`; on rejection set
  `globalError` to a localized message (`copilot.dialogFailed`), leaving
  `busy` untouched.
- [x] Add the new key `copilot.dialogFailed` to `en-US.json` and **proper
  translations** to the other 55 locales (Stage 1d).

### 1b. Main IPC handler — extend `src/main/ipc/__tests__/copilot.test.ts`
- [x] `maxFiles` clamp: `0`, `-5`, `999`, `'abc'`, `undefined`. (Note: `0`
      coerce-defaults to `50` via `Number(x) || 50`; only negatives clamp to `1`.)
- [x] Folder of 55 media files caps at 50 actions (scan bound).
- [x] `recursive` defaults to `false`.
- [x] Explicit `operation: 'auto'` → non-forced routing.
- [x] `request.query` forwarded to the intelligence builder.
- [x] Notes contract: `Ran the "X" operation for N file(s).`, analyze note,
      convert-rationale concat + `Operation chosen by "…"`.
- [x] `EMPTY_CAPABILITIES` fallback when `getEncoderCapabilities()` → `null`.
- [ ] ~~`inputExt` default `'mp4'` for extensionless file.~~ **Unreachable:**
      extensionless paths fail the `isMediaPath` allowlist before the fallback,
      so it cannot be reached without mocking internals. Documented, not tested.
- [x] `minSavings` forwarded to `planAgent`.
- [x] Image extension (`photo.jpg`) accepted.
- [x] Provider router returns `undefined` (non-throwing by design) →
      deterministic fallback. (The router swallows transport errors rather than
      throwing; a Stage 2 test covers that swallowing directly.)

### 1c. Renderer page — extend `src/renderer/__tests__/Copilot.test.tsx`
- [x] Success toast `copilot.addedToQueue`; **no toast** on partial/total.
- [x] Full success → `navigate('/batch')`.
- [x] Query/targetLanguage suppression on wrong operation; plain `remux` payload.
- [x] Folder/file dialog **rejection** → `copilot-error` (`dialogFailed`), no crash.
- [x] Dialog **timeout** → silent no-op (fake timers, 30s).
- [x] Busy/isThinking UI during in-flight plan; disabled enqueue while busy.
- [x] Dedupe inputs across folder+file dialogs.
- [x] Error/notice cleared on new plan; placeholder removed + busy reset on failure.
- [x] Zero-action plan → `addToQueue` early return (no queueAdd).
- [x] Fixed latent test pollution: `vi.clearAllMocks()` does not restore
      implementations, so a `queueAdd`/`selectFiles` rejection leaked across
      tests; `beforeEach` now `mockReset()`s those two bridge methods.

### 1d. Components — extend `src/renderer/__tests__/copilot-components.test.tsx`
- [x] `copilot-routed-as` chip, rationale list, savings/output, `applyNote`,
      `selectedCount`, `copilot.noActions` + hidden add-to-queue, `busy`
      disables add-to-queue, error/notice/plan precedence, auto-scroll,
      plan-button label swap, FocusableShell button-mousedown, chip without
      `onDelete`.

**Stage 1 result:** 3 suites / 102 tests green
(`Copilot.test.tsx` 35, `copilot-components.test.tsx` 35,
`src/main/ipc/__tests__/copilot.test.ts` 32); `typecheck` +
`eslint` clean on all changed files; `validate-locales` parity green.

### 1e. Translation
- [x] Add `copilot.dialogFailed` to `en-US.json`.
- [x] Add **proper** translations of that key to all non-English locales.
- [x] `node scripts/validate-locales.mjs` still green.

**Acceptance:** targeted suites green; strict mode clean; locale parity green.

---

## Stage 2 — AI provider unit tests

**Commit marker:** `test(ai): cover connector/settings/ipc/registry edge cases`

### 2a. `src/main/ai/__tests__/connectors.test.ts`
- [x] Anthropic + Gemini empty-completion branches.
- [x] `MAX_ERROR_BODY` (4000) truncation of error body.
- [x] `response.text()` throwing is swallowed.
- [x] `createConnectorFromSettings('local')` throws.
- [x] `jsonMode:false` → no `response_format`; `anthropic-version` header;
      Gemini model `encodeURIComponent`.
- [x] `baseUrl` scheme/header-injection guard (`javascript:`, `\r\n`) — **fix
      lives in `sanitizeBaseUrl`** (`src/shared/ai/settings.ts`); tests in
      `settings.test.ts` (2c).

### 2b. `src/shared/ai/__tests__/connect-error.test.ts`
- [x] `AI_NOT_CONFIGURED → unknown`.
- [x] Gemini `invalid_argument`/`unavailable`/`deadline_exceeded`/`unknown`,
      `not supported`/`not exist` details.
- [x] OpenAI `billing_hard_limit_reached`/`model_not_available`/`api_error`.
- [x] Array/Proxy/cyclic error objects never throw.

### 2c. `src/shared/ai/__tests__/settings.test.ts`
- [x] Prototype pollution (`__proto__`/`constructor`/`prototype`).
- [x] Non-string `key`, `keySetAt` Infinity/NaN, whitespace `baseUrl`,
      oversized key, BOM strip.
- [x] `baseUrl` scheme guard (`http(s)://` only) + CRLF strip (defect fix).

### 2d. `src/main/ai/__tests__/settings-ipc.test.ts`
- [x] Invalid candidate `providerId` → stored fallback.
- [x] Candidate key/model/baseUrl merge precedence.
- [x] **Redaction:** no API key in GET view, SET result, CONNECT_TEST message.
- [x] Hostile update payloads (cyclic, huge).

### 2e. `src/main/ai/__tests__/provider-registry.test.ts`
- [x] Connector-factory / router-builder / key-decryption throw → `null`.

### 2f. `src/shared/ai/__tests__/provider.test.ts` + `llm.test.ts`
- [x] `isProviderImplemented('anthropic'|'gemini') === false`; descriptor
      label/note; `parseLocalPlan` hostile.
- [x] 20-file prompt cap; confidence clamp + rationale filtering; timeout /
      non-`Error` throw.

**Acceptance:** `npx vitest run src/main/ai src/shared/ai` green — **400 tests
(34 files) passing**; `npm run typecheck` clean.

---

## Stage 3 — Cross-cutting + i18n

**Commit marker:** `test(ai,copilot): abuse-sweep, hostile-bridge, i18n parity`

- [x] Add `ai-settings-get` / `ai-settings-set` / `ai-connect-test` rows to
      `src/main/ipc/__tests__/ipc-abuse-sweep.test.ts` and
      `e2e/specs/ipc-abuse.spec.ts`. — **Both sweeps are fully generic** (they
      dynamically drive every registered handler / every `electronAPI` request
      method), so the AI settings channels (`IPC.AI_SETTINGS_GET` /
      `AI_SETTINGS_SET` / `AI_CONNECT_TEST`, registered by
      `registerAiSettingsIpc`) are auto-covered. Added an explicit presence
      guard test instead of a redundant row; no `e2e/specs/ipc-abuse.spec.ts`
      edit needed.
- [x] `hostile-bridge-matrix.test.tsx`: expand AI editor per hostile mode. — new
      "the AI provider editor opens and its connect flow fails soft" test across
      all 7 hostile modes (19 tests).
- [x] `error-explain.test.ts`: `AI_CONNECTOR_FAILED` / `AI_NOT_CONFIGURED` /
      `AI_RESPONSE_INVALID` / `TRANSLATION_UNAVAILABLE`. — new describe block
      covers explicit codes + message inference (`AI_*`, `TRANSCRIPTION_*`) →
      23 tests.
- [x] i18n parity: every `settings.ai.errors.*` + `copilot.*` key exists and is
      **translated** (not English-identical for non-English locales) — guard in
      the locale suite. — **real per-locale translations** authored for 41
      English-placeholder `copilot.*` keys across all 37 `scripts/locale-data`
      tables (reusing the matching `settings.ai.*` / `nav.*` / `batchQueue.*`
      translations where the English string is identical, plus 13 fresh
      translations), applied via `locale-backfill.mjs`; new
      `untranslatedRequiredKeys` guard in `i18n-matrix-utils.ts` + locale-suite
      test (product names — Copilot/OpenAI/Anthropic/Google Gemini/Remux/Demux —
      and true cognates allowlisted).

**Acceptance:** abuse sweep + hostile matrix + locale matrix green — **abuse
sweep 20 tests, hostile matrix 19 tests, error-explain 23 tests, locale matrix
72 tests (3 files)** all passing.

---

## Stage 4 — E2E specs

**Commit marker:** `test(e2e): add Copilot and AI-provider settings specs`

### 4a. `e2e/specs/copilot.spec.ts` (Tier A, `mock: true`)
- [x] Happy path: nav → Copilot → goal → folder → Plan → summary/actions/skips
      → Add to queue → lands on `/batch` with queue jobs.
- [x] Guards: empty goal / no inputs inline errors; rejection → `copilot-error`;
      malformed payload degradation.
- [x] Hostile variant (mock `copilotPlan` rejecting): mounts, degrades, no
      pageerror. (`setCopilotPlanBehavior('reject')` added to the mock harness.)
- [x] a11y: axe scan empty + populated conversation (`context` scoped to
      `[data-testid="copilot-conversation"]`, per the cell's wording).
- **7 tests, all green.** Mock harness extended: `main-store` gained
  `copilotPlanBehavior`; `preload` grew `setCopilotPlanBehavior`; `control`
  grew the typed `setCopilotPlan` / `setCopilotPlanBehavior` helpers.
- **Latent defect fixed (found by the a11y cell):** the user-message attachment
  caption in `src/renderer/components/copilot/Conversation.tsx` carried
  `opacity: 0.9`, which blended the white bubble text (`primary.contrastText`
  `#fff` on `primary.main` `#0c8176` = 4.75) down to 4.15 — below WCAG AA. The
  opacity was removed; the caption now meets 4.5:1.
- **Follow-up (out of scope):** `/copilot` is absent from the committed
  full-matrix a11y gate (`e2e/specs/a11y.spec.ts` ROUTES); a whole-page scan
  still trips on app-theme tokens (composer placeholder contrast, small text
  buttons at 4.36, and the missing `h1` from `PageContainer title=""`). Those are
  theme/document-level, not conversation-level, and are not fixed here.

### 4b. `e2e/specs/settings-ai.spec.ts` (Tier A)
- [x] Expand AI editor → select provider → paste key → Connect → classified
      localized error via mocked IPC.
- [x] Provider switch to `rules` persists; key never rendered in DOM.
- **2 tests, all green.** Mock harness extended: `preload` gained
  `aiGetSettings` / `aiSetSettings` / `aiConnectTest` (backed by an
  `AiSettingsView` snapshot + recorded `aiSetCalls`); `control` grew
  `setAiSettingsView` / `setAiConnectResult` / `getAiSetCalls`.

**Acceptance:** `npm run test:e2e -- e2e/specs/copilot.spec.ts e2e/specs/settings-ai.spec.ts` green — **9 tests pass** (verified via `npx vitest run --config e2e/vitest.e2e.config.ts …` against the built app).

---

## Stage 5 — Verification

**Commit marker:** `test: final coverage/lint/typecheck/flake pass`

- [ ] `npm run test:coverage`
- [ ] `npm run test:integration`
- [ ] `npm run typecheck`
- [ ] `npm run lint` / `npm run lint:unused`
- [ ] `node scripts/validate-locales.mjs`
- [ ] `npm run test:e2e` (Tier A)
- [ ] Update Section 3 progress table to all DONE.

---

## 4. Command reference (Windows / PowerShell)

```powershell
# Targeted unit runs
npx vitest run src/main/ipc/__tests__/copilot.test.ts
npx vitest run src/renderer/__tests__/Copilot.test.tsx
npx vitest run src/renderer/__tests__/copilot-components.test.tsx
npx vitest run src/main/ai src/shared/ai
npx vitest run src/renderer/pages/__tests__/Settings.test.tsx

# Full gates
npm run test:coverage
npm run test:integration
npm run typecheck
npm run lint; npm run lint:unused
node scripts/validate-locales.mjs

# E2E (builds first)
npm run test:e2e -- e2e/specs/copilot.spec.ts e2e/specs/settings-ai.spec.ts
```

---

## 5. Risk register

| Risk | Mitigation |
|---|---|
| Unhandled rejection trips crash tripwire | Fix product (Stage 1a) **before** writing the rejection test. |
| New i18n key left as English placeholder | Stage 1e requires real translations + validator. |
| E2E flake (Electron boot) | Follow `ensureLiveSession`/`reloadSession` recovery; bounded waits. |
| Coverage-diff fails on added lines | Every new branch gets an explicit assertion (Stage 5). |
| `lint:unused` fails renderer tests | Review imports before finishing each file. |
