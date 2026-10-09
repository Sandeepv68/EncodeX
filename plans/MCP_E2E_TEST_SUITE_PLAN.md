# Plan: MCP E2E Test Suite (Vitest + Playwright `_electron`, VS Code client path)

## Goal

Add a black-box, end-to-end test suite for the full MCP feature surface of EncodeX
that runs inside the repo's existing e2e harness, so MCP regressions fail `npm run
test:e2e` / `test:e2e:real` exactly like GUI regressions do.

Covered surfaces (chosen: **all three**):

1. **Stdio server** — `node dist/mcp/index.js` (and the `electron . --mcp` branch).
2. **Standalone Streamable HTTP server** — `node dist/mcp/http-server.js`, including
   its hostile-input security guards.
3. **Embedded HTTP server inside the GUI** — the Phase-2 server that
   `.vscode/mcp.json` points VS Code at, including its 6 GUI-parity tools and the
   Settings UI that drives it.

Fidelity (chosen): **real ffmpeg** — tiny generated media, real conversions, ffprobe
assertions. Orchestration (chosen): **existing Vitest + Playwright `_electron` suites**.

## Current state (what already exists, so we extend, not rebuild)

| Asset                                                 | Location                                                                                                        | What it covers                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool registry (15 core tools, 3 resources, 4 prompts) | `src/mcp/server.ts`                                                                                             | `ping convert_media get_job list_jobs cancel_job get_media_info list_capabilities list_profiles get_profile compress_image extract_audio cut_video batch_convert remux_media demux_media` + `encodex://{profiles,capabilities,codecs}` + 4 prompts |
| GUI-parity tools (+6)                                 | `src/main/mcp/gui-tools.ts`                                                                                     | `get_queue_state cancel_all_jobs get_timeline extract_preview get_system_info check_for_updates`                                                                                                                                                   |
| stdio entry/runner                                    | `src/mcp/index.ts`, `src/mcp/run.ts`                                                                            | fd 0/1 transport (Windows/Electron-safe)                                                                                                                                                                                                           |
| HTTP entry/handler                                    | `src/mcp/http-server.ts`, `src/mcp/http.ts`                                                                     | Streamable-HTTP, bearer auth, loopback/DNS-rebinding guards, session caps, body caps                                                                                                                                                               |
| Settings persistence + IPC                            | `src/main/mcp/settings.ts`, `settings-ipc.ts`, `src/shared/mcp-settings.ts`                                     | `mcp-settings.json` (`enabled/port/token`), clamps 1024-65535, IPC channels                                                                                                                                                                        |
| VS Code client config                                 | `.vscode/mcp.json`                                                                                              | `encodex` → `http://127.0.0.1:8765/mcp`                                                                                                                                                                                                            |
| MCP fork tests                                        | `src/mcp/__tests__/*.test.ts`                                                                                   | In-memory, **fake transcoders**, process-free                                                                                                                                                                                                      |
| Smoke/full scripts                                    | `scripts/mcp-smoke.mjs`, `scripts/mcp-full-test.mjs`                                                            | Real media + real servers, but **custom assertion harness, not CI-gated, not in Vitest**                                                                                                                                                           |
| GUI e2e suite                                         | `e2e/specs/*.spec.ts`, `e2e/cli.spec.ts`                                                                        | Playwright `_electron` Tier A (mock preload) + Tier B (real preload)                                                                                                                                                                               |
| E2E infra                                             | `e2e/helpers.ts`, `e2e/fixtures/{app,tripwire,tripwire-setup,boot-budget}.ts`, `e2e/mocks/{preload,control}.js` | launch/teardown, crash tripwire, mock API control                                                                                                                                                                                                  |
| E2E configs                                           | `e2e/vitest.e2e.config.ts`, `e2e/vitest.e2e.real.config.ts`                                                     | Vitest orchestrator; `fileParallelism:false`; tripwire setup; retry in CI                                                                                                                                                                          |

**Gaps this plan closes**

- No MCP e2e spec exists in `e2e/` (only the ungateable `.mjs` scripts).
- `e2e/vitest.e2e.real.config.ts` has an **explicit `include` array** (not a glob), so
  any new real-preload spec must be registered there by name or it silently won't run.
- The mock preload (`e2e/mocks/preload.js`) has **no MCP-settings state**, so the
  Settings → MCP section is untestable in fast Tier A mode today.
- Nothing validates that the shipped `.vscode/mcp.json` still matches a server this
  repo actually starts.
- No cross-surface job-state test: "an MCP `convert_media` shows up in the GUI queue".

## Conventions (keep the suite idiomatic)

- New files live under `e2e/mcp/`; spec glob `e2e/**/*.spec.ts` picks them up in
  `vitest.e2e.config.ts` automatically.
- `describe.runIf(IS_E2E)` gate, `ensureBuildExists()`, `getBuildPaths()` from
  `e2e/helpers.ts`.
- Stdio/HTTP protocol specs run under `vitest.e2e.config.ts` (node env).
- Embedded-GUI + real Settings specs run under `vitest.e2e.real.config.ts` and are
  **added to its `include` array**.
- Real conversions everywhere in protocol specs; tiny fixtures so the run stays fast.
- Process teardown mirrors `e2e/cli.spec.ts` + `scripts/mcp-full-test.mjs`
  (`taskkill /PID <pid> /T /F` on win32) and `closeApp` for the GUI.
- Use the **MCP SDK client** (`StdioClientTransport`, `StreamableHTTPClientTransport`,
  `Client`) — no raw JSON-RPC except the deliberate HTTP security probes.
- Only add tests; no production-code changes unless a real bug surfaces.

## Workstreams

### W1 — Shared harness (`e2e/mcp/harness.ts`)

Process lifecycle + fixture management, reused by every spec.

- `startStdioServer()` → spawn `node dist/mcp/index.js`; return
  `{ child, command, args, stderrTail }`. Preflight `dist/mcp/index.js`.
- `startHttpServer({ token, port = 0 })` → spawn
  `node dist/mcp/http-server.js --token <t> --port <p>`; parse the `MCP_HTTP_TOKEN=`
  and `MCP_HTTP_READY http://127.0.0.1:<port>/mcp` lines exactly like
  `mcp-full-test.mjs`; fail fast with stderr on timeout.
- `pickFreePort()` → bind `127.0.0.1:0`, close, return port (for embedded settings,
  which require a concrete 1024-65535 port).
- `seedMcpSettings(userDataDir, { enabled, port, token })` → write
  `mcp-settings.json` (repo `sanitizeMcpSettings` shape) so the GUI starts the server
  at boot; remember the prior file for restore (single-user data dir in the OS
  locations only when using the default `--user-data-dir`; prefer an injected
  `--user-data-dir=<tmp>` like `launchApp` does so we never touch real profiles).
- `startEmbeddedServer(userDataDir, settings)` → Playwright
  `_electron.launch([mainEntry, --user-data-dir=..., ...CHROMIUM_STABILITY_ARGS])`
  (reuse the flags in `e2e/fixtures/app.ts`), attach tripwire, then poll the endpoint
  with a hand-rolled `fetch` until any HTTP response arrives.
- Fixtures: single `beforeAll` per spec — `generateTestMedia` (existing 1s 320x240),
  `generateTestImage`, `generateTestAudio`, `generateTestSubtitle`,
  `generateTestChapters`, `generateTestDemuxSource`; add `generateLongClip()` (≈30s
  640x360 ultrafast, existing `long.mp4` recipe from `mcp-full-test.mjs`) only for the
  cancel-flow tests needing a job that stays queued/running. Respect `E2E_SKIP_MEDIA`.
- `afterAll` cleanup with `stopProcess()` / `closeApp()` / temp-dir removal.

### W2 — MCP client helpers (`e2e/mcp/client.ts`)

- `connectStdio()` / `connectHttp(url, { token })` → `{ client, transport, close }`.
- `call(client, tool, args)` → joins text blocks, `JSON.parse`, throws unless
  `parsed.ok !== false` (mirrors `mcp-full-test.mjs`).
- `callRaw(...)` → full result including `isError` for negative-path asserts.
- `waitForJob(client, jobId, { status = 'done', timeout })`.
- `assertToolSurface(client, { tools, resources, prompts })` shared by all three
  transports so stdio/http/embedded assert the _same_ contract.

### W3 — Stdio spec (`e2e/mcp/stdio.spec.ts`)

Node-env, real preload not needed.

1. Handshake advertises `tools/resources/prompts`; `listTools` returns exactly the 15
   core tools (sorted compare) with non-empty descriptions + input schemas.
2. `ping` → `{ pong: true }`.
3. `list_capabilities` → `videoEncoders` includes `libx264`, `audioEncoders` includes
   `aac`, `hwaccels` is an array.
4. `list_profiles` / `get_profile` round-trip; unknown id → `ok:false`.
5. `get_media_info` probes the clip; missing input → `FILE_NOT_FOUND` `ok:false`.
6. `convert_media` → poll `get_job` → `done`, output exists/non-empty,
   ffprobe `codec_name` assert.
7. `list_jobs`/`get_job` expose the finished job; unknown jobId → `ok:false`.
8. `cancel_job`: with `concurrency:1` and the long clip, queue two, cancel the second
   (still queued), assert removal from `list_jobs`, then `cancel_job` on an unknown id
   → `ok:false`.
9. Full tool sweep for `extract_audio`, `compress_image`, `cut_video`, `batch_convert`,
   `remux_media`, `demux_media` (output files exist + ffprobe/magic-byte asserts using
   `readContainerMagic`), then resources (3 `encodex://` JSON docs) and prompts (4,
   non-empty message text).
10. `electron . --mcp` branch: one `describe.runIf(E2E_REAL)` group spawning the
    Electron binary with `--mcp` and the same handshake/ping — needs a display, so it
    lives in the real-config tier (see W7).

### W4 — Standalone HTTP spec (`e2e/mcp/http-standalone.spec.ts`)

Node-env.

1. Server on an ephemeral port; assert the printed `MCP_HTTP_TOKEN=` equals the fixed
   token we passed.
2. **Security probes** (raw `http.request`, ported from `runHttpSecurityProbes`):
   - no token → 401 (with `WWW-Authenticate: Bearer`)
   - wrong token → 401
   - token in query string → 400
   - non-loopback `Origin` → 403, non-loopback `Host` → 403
   - wrong path → 404, `PUT` → 405, `text/plain` body → 415
   - oversized `Content-Length` → 413, session-less `GET` → 400
3. Authenticated `StreamableHTTPClientTransport` session runs the **shared W2 core
   suite** (same 15 tools + resources + prompts).
4. **Cross-session shared queue**: session A enqueues `convert_media`; session B (a
   second HTTP session) sees it via `get_job` → verifies the single shared
   `MCPJobManager` documented in `http.ts`.
5. **DELETE teardown**: raw `DELETE /mcp` with `mcp-session-id` → 200 + session gone
   (subsequent POST with that id → 404).

### W5 — Embedded GUI + VS Code client contract (`e2e/mcp/embedded-gui.spec.ts`)

Real-preload tier (add to `vitest.e2e.real.config.ts` include).

1. Seed `mcp-settings.json` `{ enabled: true, port: <free>, token: '' }` in an isolated
   `--user-data-dir`, launch via Playwright `_electron`, wait for the endpoint.
2. Connect exactly as `.vscode/mcp.json` / the VS Code MCP extension would (HTTP
   client, no token). Assert **all 21 tools** present (15 core + 6 GUI).
3. Shared core suite (light mode) so cross-transport parity is enforced.
4. GUI-parity tools:
   - `get_queue_state` → jobs array + integer `pending`
   - `get_system_info` → `appVersion` non-empty, `platform === process.platform`,
     `os.cpuCount ≥ 1`
   - `get_timeline` → file/duration/width/height/codec from the fixture
   - `extract_preview` → `dataUrl` starts with `data:image`
   - `check_for_updates` → assert shape (`available` boolean) when reachable, treat
     offline as documented warn (repo precedent: `mcp-full-test.mjs` warns)
   - `cancel_all_jobs` → drains queue so `pending === 0`
5. **GUI-queue parity test**: `convert_media` over MCP while the renderer Queue page
   is open (real preload) → job appears in the GUI queue list, then completes; proves
   the shared job manager end to end (MCP → main → renderer).

### W6 — VS Code client config contract (`e2e/mcp/vscode-client.spec.ts`)

Node-env, cheap:

1. The canonical VS Code config (`e2e/mcp/fixtures/vscode-mcp.json` — tracked,
   because `.vscode/` is gitignored) parses; defines `servers.encodex` with
   `type: "http"`, loopback host, `/mcp` path, port in 1024-65535; any
   `Authorization` header, if present, is `Bearer <token>`.
2. Spawn the standalone HTTP server on **exactly the configured port/URL** and confirm
   a handshake succeeds against it (guards the documented default `8765`).
   Implementation detail: if port 8765 is already a live EncodeX instance (player
   expectation from `mcp-full-test.mjs`), prefer connecting to the live instance and
   only spawn when nothing is listening.
3. The token value, when the setting is non-empty, round-trips through `mcpSetSettings`
   → server requires it (Tier B, mirrors W6-B below).
4. **Full feature matrix over the VS Code wire**: run the entire real-ffmpeg core
   suite (`runCoreSuite` in `e2e/mcp/client.ts`, `mode: 'full'`) against the exact
   loopback endpoint `.vscode/mcp.json` declares — `convert_media`, `extract_audio`,
   `compress_image`, `cut_video`, `batch_convert`, `remux_media` (plain + subtitle/
   thumbnail/chapters), `demux_media`, the `AUXILIARY_INPUT_NOT_FOUND` /
   `INCOMPATIBLE_CONTAINER` / `STREAM_NOT_FOUND` error contracts, and the
   `encodex://` resources + prompts. This is the deterministic end-to-end delivery of
   "file conversions, cut, remux, demux, etc. from VS Code": VS Code 1.141 surfaces
   MCP tools only through Copilot Chat (no GUI "run tool" quick-pick — verified by
   palette + action-menu probe on 1.141), so the feature matrix is exercised over the
   identical wire VS Code uses while W9 proves the live session in the VS Code server
   picker.

### W7 — Settings UI e2e (two tiers)

**Tier A (mock preload, fast, no server) — extend `e2e/mocks`:**

- `e2e/mocks/preload.js`: add MCP-settings state + controllers to the `__test`
  surface (`mcpGetSettings` returns seeded settings, `mcpSetSettings` records the last
  snapshot as `mcpSetCalls`).
- `e2e/mocks/control.ts`: `mockApi.setMcpSettings(page, settings)`,
  `mockApi.getMcpSetCalls(page)`, extend `TestSnapshot` with `mcpSetCalls`.
- `e2e/mcp/gui-settings.spec.ts` (or fold into `e2e/specs/settings.spec.ts`) asserting
  on `settings-mcp-*` testids already present in `src/renderer/pages/Settings.tsx`:
  - MCP section renders (switch `settings-mcp-server`, `settings-mcp-port`,
    `settings-mcp-token`, `settings-mcp-endpoint`, `settings-mcp-authorization`,
    generate/clear token buttons)
  - toggle → forwards `{ enabled: true, ... }` via `mcpSetSettings`
  - port clamp: 80 → 1024; 99999 → 8765 default
  - generate token → a new non-empty token forwarded
  - endpoint line reflects `http://127.0.0.1:<port>/mcp`; authorization shows
    `Bearer <token>` when token set, cleared when cleared

**Tier B (real preload, genuinely end-to-end UI → IPC → server):**

- Seed settings off in an isolated userDataDir, launch, navigate to Settings, flip the
  switch to enable with a free port → **poll the actual endpoint** until the server
  responds; then disable → poll until it stops. Uses the real preload, real IPC, real
  server — no mocks. 1-2 tests only (kept small because each launches the GUI).

### W8 — Plumbing

- `package.json` scripts:
  - `test:e2e:mcp` → `npm run build && vitest run --config e2e/vitest.e2e.config.ts -- e2e/mcp/`
  - `test:e2e:mcp:gui` → build + `vitest run --config e2e/vitest.e2e.real.config.ts -- e2e/mcp/embedded-gui.spec.ts e2e/mcp/gui-settings.spec.ts`
  - The main `test:e2e` / `test:e2e:real` targets pick the new specs up automatically
    (glob for Tier A, `include` additions for Tier B).
- Register new specs in `e2e/quarantine.json` until green on CI, then flip to active
  (repo pattern: parked spec must not run by default).
- Add `e2e/mcp/` to Prettier scope (package.json `format`/`format:check` already glob
  `e2e/**/*.{ts,tsx}` — verify).

### W9 — Visible VS Code UI drive (`e2e/mcp/vscode-ui.spec.ts`)

Tier B (real tier only), complements the tier-A W6 contract with the user-visible
client:

1. Resolve a real VS Code `Code.exe` (env `VSCODE_EXE` override, then standard
   install paths); skip the whole describe when absent (no VS Code on Linux CI).
2. Boot the standalone HTTP server with _no token_ on **exactly** the shipped
   `http://127.0.0.1:8765/mcp` (the `.vscode/mcp.json` URL has no `Authorization`).
3. Launch that binary via Playwright `_electron` against a scratch workspace whose
   `.vscode/mcp.json` is a verbatim copy of the tracked fixture
   (`e2e/mcp/fixtures/vscode-mcp.json`), with a throwaway `--user-data-dir`
   pre-seeded with trust/update/telemetry off.
4. Dismiss the onboarding overlay, drive the command palette to `MCP: List Servers`,
   and assert the `encodex` entry appears _sourced from `.vscode/mcp.json`_
   (previously `Stopped`; after `Start Server`, poll until it reads `Running`).
5. Interact through raw mouse coordinates on the Monaco list rows: Playwright's
   actionability gate flakes on those rows (box-less / "not visible"), so the spec
   reads bounding boxes from the DOM and clicks their centres.
6. **1.141 tool-invocation probe finding**: the running-server action menu exposes
   `Stop Server` / `Restart Server` / `Show Configuration` / `Show Output` /
   `Configure Model Access` / `Browse Resources` and no "Run Tool"; the palette has
   `MCP: Add Server…`, `MCP: Browse Resources…`, `MCP: List Servers`, etc. Tools are
   surfaced to Copilot Chat only. There is no deterministic GUI tool-run path, so the
   real tool matrix stays in W6 (same wire) and W9 just proves the live session.

## Files to create / modify

| File                                           | Change                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `e2e/mcp/harness.ts` (new)                     | spawn/parse/seed/wait helpers + fixture assembly                                       |
| `e2e/mcp/client.ts` (new)                      | MCP SDK client wrappers + `assertToolSurface` + `waitForJob`                           |
| `e2e/mcp/stdio.spec.ts` (new)                  | W3                                                                                     |
| `e2e/mcp/http-standalone.spec.ts` (new)        | W4 incl. security probes + cross-session queue                                         |
| `e2e/mcp/embedded-gui.spec.ts` (new)           | W5                                                                                     |
| `e2e/mcp/vscode-client.spec.ts` (new)          | W6                                                                                     |
| `e2e/mcp/vscode-ui.spec.ts` (new)              | W9 (visible VS Code UI drive)                                                          |
| `e2e/mcp/fixtures/vscode-mcp.json` (new)       | canonical VS Code config (`.vscode/` is gitignored, so the contract is tracked here)   |
| `e2e/mcp/gui-settings.spec.ts` (new)           | W7 Tier A                                                                              |
| `e2e/mocks/preload.js` (edit)                  | MCP-settings seed/record controllers                                                   |
| `e2e/mocks/control.ts` (edit)                  | `setMcpSettings` / `getMcpSetCalls` + snapshot field                                   |
| `e2e/vitest.e2e.real.config.ts` (edit)         | add `e2e/mcp/embedded-gui.spec.ts` + `e2e/mcp/vscode-ui.spec.ts` (Tier B) to `include` |
| `e2e/quarantine.json` (edit)                   | park new specs until green                                                             |
| `package.json` (edit)                          | `test:e2e:mcp*` scripts                                                                |
| `plans/MCP_E2E_TEST_SUITE_PLAN.md` (this file) | —                                                                                      |

## Verification

- `npm run typecheck:e2e` — must pass.
- `npm run format:check` — Prettier on `e2e/**`.
- `npm run test:e2e:mcp` (stdio + HTTP + VS Code contract + Tier A settings) locally.
- `npm run test:e2e:mcp:real` (embedded + visible VS Code UI) locally; on Linux CI run
  under xvfb like the existing Playwright specs (the VS Code UI spec self-skips when
  no `Code.exe` is installed).
- `npm run test:flake-detect` before de-quarantining.
- No production `src/` changes expected; if a bug is found, fix in the same PR and
  record it in the plan's Result notes.

## Risks / mitigations

- **Windows GPU/utility process crashes** on burst spawns → adopt existing
  `CHROMIUM_STABILITY_ARGS` + `taskkill /T` teardown; MCP stdio/HTTP Node spawns keep
  `--disable-gpu`-free normal args (they never open windows; `--mcp` already disables
  GPU in `src/main/index.ts`).
- **Skill-level body caps / auth drift** → security probes assert status _codes only_,
  tolerant of message wording.
- **`check_for_updates` offline** → assert response shape when reachable, documented
  warning otherwise (existing repo precedent).
- **616-fixture churn** → reuse `e2e/helpers.ts` generators; single per-spec
  `beforeAll`; `E2E_SKIP_MEDIA` respected for CI cache reuse.
- **Real-conversion runtime** → tiny clips (≤2s), `ultrafast` presets, one long clip
  only for cancel tests; conversions bounded with per-test timeouts (120s in real
  config already).
- **Port collisions** → ephemeral `--port 0` everywhere except the explicit 8765
  VS Code-contract test, which prefers the live instance before spawning.
- **`.vscode/` gitignored** → the VS Code contract lives in a tracked fixture
  (`e2e/mcp/fixtures/vscode-mcp.json`); specs read/copy that, never the repo's own
  `.vscode/mcp.json`, so a fresh CI checkout stays green.
- **Tier B cost** → each Tier B spec launches the GUI once per file (existing pattern);
  keep the Settings Tier B group to 1-2 tests.

## Order of work

1. `harness.ts` + `client.ts` (foundations).
2. `stdio.spec.ts` — fastest feedback, exercises the harness.
3. `http-standalone.spec.ts` + security probes.
4. `embedded-gui.spec.ts` + VS Code contract (`vscode-client.spec.ts`).
5. Settings Tier A (mock preload extension) then Tier B.
6. Quarantine, CI wiring, flake-detect, de-quarantine.

## Decisions

| #   | Decision                                                  | Rationale                                                      |
| --- | --------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | MCP SDK client over raw JSON-RPC                          | Same client VS Code uses; one contract, less drift             |
| 2   | Embedded spec in real-preload tier                        | Requires the real `--mcp` settings/IPC path                    |
| 3   | Share one `assertToolSurface` across all three transports | Parity is a feature: stdio/http/gui must advertise identically |
| 4   | Only status codes asserted on security probes             | Guards wording drift while pinning policy                      |
| 5   | No production code changes unless a bug is found          | Suite is regression net, not refactor vehicle                  |
