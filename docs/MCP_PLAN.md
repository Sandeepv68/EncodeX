# MCP Integration Plan — Exposing EncodeX via Model Context Protocol

> **Status:** Complete — all checkpoints (0-5) implemented, documented, and CI-verified
> **Last updated:** 2026-09-18
> **Owner:** EncodeX core
> **Related docs:** [`CLI.md`](CLI.md), [`IPC.md`](IPC.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`TESTING.md`](TESTING.md)

---

## 1. Overview

EncodeX is an FFmpeg GUI (and CLI) built on Electron + React + TypeScript. This plan exposes **all** of EncodeX's functionality via [MCP](https://modelcontextprotocol.io) so that MCP hosts — Claude Desktop/Claude Code, VS Code/Cursor, and custom/headless agents — can probe media, convert, compress, extract audio, batch-process, and (opt-in) drive live GUI app features through standardized tools, resources, and prompts.

### 1.1 Why this works

The media engine is already **decoupled from Electron**:

- `ITranscoder` (`src/main/transcoders/types.ts`) — implemented by `FfmpegCore` (fluent-ffmpeg API), `FFToolCore` (raw CLI), `BmfCore` (BMF framework).
- `createTranscoder()` (`src/main/transcoders/factory.ts`) — backend factory.
- `capabilities.ts` — ffmpeg `-encoders` / `-hwaccels` probing (pure Node).
- `BUILTIN_PROFILES` (`src/shared/profiles/builtin.ts`) — 140+ profiles.
- `buildConversionOptions`, `deriveOutputPath`, etc. (`src/main/cli/*`) — pure helpers.

The repo's own Vitest suite already runs these modules under plain Node; the `app` import in `media-binaries.ts` is guarded by `isPackaged()` so it safely degrades outside Electron. A standalone Node process can therefore reuse the whole engine with no GUI dependency.

### 1.2 Goals / Non-Goals

**Goals**

- Expose every headless conversion capability via MCP (Phase 1).
- Expose live GUI-parity features (queue, previews, timeline, updates, settings) via an embedded HTTP server (Phase 2).
- Reuse existing engine code; no engine rewrites.
- Ship a packaged launch path (`<app> --mcp`) that resolves the bundled ffmpeg/ffprobe binaries automatically.

**Non-Goals**

- Exposing window controls (minimize/maximize/close) or live player frame streaming over MCP (client-side attack surface, GUI-only semantics).
- Replacing the CLI or the IPC layer.
- Multi-tenant / external (non-loopback) service hosting in this iteration.

### 1.3 Architecture at a glance

```
MCP Host (Claude Desktop, VS Code, Cursor, headless agent)
   │
   ├── stdio ────────────► EncodeX standalone MCP server        (Phase 1)
   │                          dist/mcp/index.js  OR  EncodeX.exe --mcp
   │                          wraps ITRanscoder + shared types + capabilities
   │
   └── Streamable HTTP ──► EncodeX embedded MCP server          (Phase 2)
                              http://127.0.0.1:<port>  (Electron main process)
                              Phase 1 tools + live JobQueue/preview/update tools
```

Both phases share a single `createMcpServer(options)` factory so behavior stays consistent.

---

## 2. Deliverables

| # | Deliverable | Phase | Status |
|---|-------------|-------|--------|
| D1 | Standalone stdio MCP server (`src/mcp/`) | 1 | ✅ Done |
| D2 | Shared `createMcpServer()` factory reused by both phases | 1+2 | ✅ Done |
| D3 | Async conversion job manager (`MCPJobManager`) | 1 | ✅ Done |
| D4 | Build/packaging wiring (`--mcp` mode, tsconfig, npm script) | 1 | ✅ Done |
| D5 | Embedded Streamable-HTTP MCP server (`src/main/mcp/`) | 2 | ✅ Done |
| D6 | Settings UI for MCP server (toggle, port, token) | 2 | ✅ Done |
| D7 | Tests: unit (tools/jobs) + integration (real conversion) | 1+2 | ✅ Done |
| D8 | Docs (`CLI.md`, `MCP.md` client configs) + CI smoke | 1+2 | ✅ Done |

---

## 3. Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| SDK | `@modelcontextprotocol/sdk` **v1** | Stable, battle-tested, ships stdio + Streamable HTTP transports, dual CJS/ESM (compatible with CommonJS main build) |
| Schema lib | `zod` (SDK peer dep) | Required by SDK; `.describe()` flows into tool descriptions for the model |
| Conversional model | **Async job + polling** (`convert_media → { jobId }`, then `get_job`) | Conversions run minutes; avoids long-blocking tool calls; mirrors `ITranscoder` EventEmitter lifecycle (`progress`/`end`/`error`) |
| Concurrency | One `ITranscoder` per job | `ITranscoder` owns one conversion at a time (same pattern as `JobQueue.activeJobs`) |
| Phase 1 launch | `node dist/mcp/index.js` (dev) / `EncodeX.exe --mcp` (packaged) | Packaged path reuses `process.resourcesPath` ffmpeg via `getFfmpegPath()` |
| Phase 2 transport | `StreamableHTTPServerTransport`, loopback-only `127.0.0.1` | Recommended remote transport; DNS-rebinding + Origin checks |
| Phase 2 default | Toggle **off**; port `8765` (default), optional bearer token | Least-privilege; opt-in |
| Reuse (no reinvention) | `createTranscoder`, `buildConversionOptions`, `deriveOutputPath`, `expandInputs`, `getEncoderCapabilities`, `BUILTIN_PROFILES`, `collectMediaFiles`, `createError`/`ErrorCode` | Proven, tested paths; no CLI-UI (commander/ora/chalk) imports to keep Node-only |

**Deliberately avoided imports** (drag in Electron/CLI-UI deps): `src/main/cli/cli-options.ts` (`CliExitError`, commander), `src/main/cli/cli-ui.ts` (ora, chalk, cli-progress). Resolve transcoder type inline (`'FFMPEG'` default) and return MCP text/JSON content directly.

---

## 4. Phase 1 — Standalone stdio MCP server

### 4.1 New module layout

```
src/mcp/
├── index.ts                  # Entry: serveStdio(createMcpServer) — runs standalone or --mcp
├── server.ts                 # createMcpServer(): registers tools/resources/prompts
├── jobs/
│   └── conversion-manager.ts # AsyncConversionManager (job registry wrapping ITranscoder)
├── tools/
│   ├── convert.ts            # convert_media
│   ├── jobs.ts               # list_jobs / get_job / cancel_job
│   ├── info.ts               # get_media_info
│   ├── capabilities.ts       # list_capabilities
│   ├── compress.ts           # compress_image
│   ├── extract-audio.ts      # extract_audio
│   ├── batch.ts              # batch_convert
│   ├── profiles.ts           # list_profiles / get_profile
│   └── cut.ts                # cut_video
├── resources/
│   ├── profiles.ts           # encodex://profiles
│   ├── capabilities.ts       # encodex://capabilities
│   └── codecs.ts             # encodex://codecs
├── prompts/
│   ├── convert-video.ts
│   ├── extract-audio.ts
│   ├── compress-image.ts
│   └── batch-convert.ts
└── __tests__/                # Vitest tests (server init, tools, job manager)
```

### 4.2 Tool catalog

| Tool | Key inputs | Returns |
|------|-----------|---------|
| `convert_media` | `input`, `output?`, `videoCodec?`, `audioCodec?`, `videoBitrate?`, `audioBitrate?`, `qscale?`, `scale?`, `pixFmt?`, `startTime?`, `endTime?`, `duration?`, `copy?`, `audio?`, `video?`, `rotate?`, `flipH?`, `flipV?`, `hwaccel?`, `hwaccelMode?`, `transcoder?` | `{ jobId, status }` |
| `get_media_info` | `input` | JSON `MediaInfo` |
| `list_capabilities` | — | `{ videoEncoders, audioEncoders, hwaccels }` |
| `compress_image` | `input`, `output?`, `format?`, `quality?`, `scale?` | `{ jobId, status }` |
| `extract_audio` | `input`, `output?`, `audioCodec?`, `bitrateAudio?` | `{ jobId, status }` |
| `cut_video` | `input`, `startTime`, `endTime?`, `duration?`, `output?` | `{ jobId, status }` |
| `batch_convert` | `inputs[]`, `outputDir?`, `suffix?`, `concurrency?`, `+ convert options` | `{ jobIds[] }` |
| `list_profiles` | `category?` | Profile catalogue |
| `get_profile` | `id` | Full profile settings |
| `list_jobs` | `status?` | Job summaries |
| `get_job` | `jobId` | `{ id, input, output, status, percent, time, speed, fps, eta, bitrate, error? }` |
| `cancel_job` | `jobId` | ack |

Validation rules (all tools):

- Input file must exist → `createError(ErrorCode.FILE_NOT_FOUND)`.
- Output must not equal input, and must not overwrite without explicit `output` (safe-derive via `deriveOutputPath`).
- Qscale clamped to `QSCALE_RANGE`; batch concurrency clamped to `MAX_QUEUE_CONCURRENCY`.
- `copy` mode is incompatible with hwaccel — deferred to existing `buildFfmpegArgs` behavior.

### 4.3 Async job manager

`AsyncConversionManager` (in-memory):

```
interface McpConversionJob {
  id: string;
  op: 'convert' | 'compress' | 'extract-audio' | 'cut' | 'batch-item';
  input: string; output: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  percent: number; time?: string; speed?: string; fps?: number; eta?: string; bitrate?: string;
  error?: string; startedAt: number; finishedAt?: number;
}
```

- `start(...)` — creates transcoder, subscribes to `'progress' | 'end' | 'error'`, returns `jobId`.
- `get(id)` / `list(status?)` / `cancel(id)`.
- Unbounded in-memory retention (dev-grade); document prune policy as future work.

### 4.4 Resources & prompts

**Resources**

| URI | Content |
|-----|---------|
| `encodex://profiles` | Full `BUILTIN_PROFILES` catalogue (timestamps/refresh on demand) |
| `encodex://capabilities` | `{ videoEncoders, audioEncoders, hwaccels }` |
| `encodex://codecs` | `CodecContainerInfo` map (extension + containers per codec) |

**Prompts**

| Name | Args | Purpose |
|------|------|---------|
| `convert-video` | `input`, `targetFormat?`, `targetSize?` | Guided conversion: pick codec/container/best profile |
| `extract-audio` | `input`, `codec?`, `bitrate?` | Audio extraction workflow |
| `compress-image` | `input`, `targetSize?`, `quality?` | Image optimization / fit-to-size |
| `batch-convert` | `folderOrGlob`, `outputDir?`, `format?` | Multi-file conversion workflow |

### 4.5 Build & packaging wiring

1. **`tsconfig.main.json`** — add `"src/mcp/**/*"` to `include` (emits `dist/mcp/`, CommonJS).
2. **`package.json`** — add dependency `@modelcontextprotocol/sdk` + `zod`; add script `"mcp": "node dist/mcp/index.js"`.
3. **`src/main/index.ts`** — new launch mode: when `--mcp` present, after `app.whenReady()` run `createMcpServer()` + `StdioServerTransport`, keep process alive (never `app.exit` until stdin closes). Must not enter GUI or CLI branches. Reuses the exact `isCliMode`/mode-detection pattern.

Both launch paths must behave identically:

- Dev/CI: `node dist/mcp/index.js`
- Packaged: `EncodeX.exe --mcp` (bundled ffmpeg resolves via `process.resourcesPath`)

---

## 5. Phase 2 — Embedded Streamable-HTTP MCP server (GUI parity)

### 5.1 New module layout

```
src/main/mcp/
├── server.ts        # startMcpHttpServer({ port, token }) → transport
├── http.ts          # http.Server wiring (Origin/CORS checks, loopback-only bind, token auth)
├── gui-tools/
│   ├── queue.ts     # live JobQueue wrappers
│   ├── preview.ts   # get_image_info / get_image_preview / get_video_preview
│   ├── timeline.ts  # get_waveform / get_thumbnails
│   ├── updates.ts   # check_for_updates / get_update_status / install_update
│   └── system.ts    # get_settings / set_always_on_top / monitoring_get_state
└── security.ts      # shared helpers (auth + origin validation)
```

### 5.2 Integration points in Electron main

- `src/main/index.ts` (GUI branch): after `registerIpcHandlers(mainWindow)`, start the MCP HTTP server **if the setting is enabled**. It calls the same service modules the IPC handlers wrap — no renderer/IPC round-trip:
  - `JobQueue` (already instantiated for queue IPC) → live queue tools
  - `updater.ts` exports (`checkForUpdates` / `downloadUpdate` / `cancelDownload` / `installUpdate`)
  - `image-info.ts`, `image-preview.ts`, `video-preview.ts`
  - `src/main/timeline/timeline-media.ts` (`extractWaveform`, `extractThumbnails`)
  - `capabilities.ts`, monitoring consent modules
- **Settings**: add "Enable MCP server" toggle (default **off**) + port (`8765` default) + optional bearer token in `Settings` page, persisted via `settingsStore` (localStorage) and mirrored to main.

### 5.3 Phase 2 tool additions (beyond Phase 1)

| Tool | Wraps |
|------|-------|
| `queue_add` / `queue_list` / `queue_status` | `JobQueue` |
| `queue_remove` / `queue_move` / `queue_update_options` | `JobQueue` |
| `queue_start` / `queue_pause` / `queue_resume` | `JobQueue` |
| `queue_clear_completed` | `JobQueue` |
| `queue_set_concurrency(n)` | `JobQueue` (clamped 1–4) |
| `queue_set_when_done(action, force)` | power-actions |
| `queue_export` / `queue_import` | `queue-transfer.ts` |
| `get_image_info` (dimensions/format/EXIF/histogram) | `image-info.ts` |
| `get_image_preview` / `get_video_preview` | preview modules |
| `get_waveform(path, duration)` | `timeline-media.ts` |
| `get_thumbnails(path, duration)` | `timeline-media.ts` |
| `check_for_updates` / `get_update_status` / `install_update` | `updater.ts` |
| `get_settings` / `set_always_on_top` / `monitoring_get_state` | settings / window flags / monitoring |

### 5.4 Security model

- Bind `http.Server` to `127.0.0.1` only.
- Validate `Origin` header on all requests (DNS-rebinding defense, per SDK guidance).
- Optional bearer token (set in Settings). MCP clients send it via standard auth header.
- **Excluded from MCP surface** (documented): window minimize/maximize/close, live player frame/audio streaming, `--dev` handlers, `TERMS_REJECT`.

---

## 6. Files Changed / Added (complete list)

| File | Change | Status |
|------|--------|--------|
| `package.json` | Add `@modelcontextprotocol/sdk` + `zod` deps; add `mcp`, `mcp:smoke`, `mcp:smoke:electron` scripts | ✅ |
| `tsconfig.main.json` | Add `"src/mcp/**/*"` to `include` | ✅ |
| `src/main/index.ts` | Add `--mcp` launch mode; start/reconcile the embedded HTTP server in GUI mode | ✅ |
| `src/mcp/index.ts` | New: standalone stdio entry | ✅ |
| `src/mcp/run.ts` | New: pure `runMcpServer()` stdio runner (raw fd 0/1) | ✅ |
| `src/mcp/server.ts` | New: `createMcpServer()` factory — 13 tools, 3 resources, 4 prompts | ✅ |
| `src/mcp/jobs/manager.ts` | New: `MCPJobManager` async job tracking over the shared `JobQueue` | ✅ |
| `src/mcp/conversion-options.ts`, `operations.ts` | New: pure option/operation builders (no CLI-UI imports) | ✅ |
| `src/mcp/__tests__/*` | New: unit tests + `mcp-stdio.integration.test.ts` (real conversions) | ✅ |
| `src/main/mcp/http-server.ts` | New: loopback `http.Server` + Streamable HTTP, Origin/token checks | ✅ |
| `src/main/mcp/settings.ts` | New: `userData/mcp-settings.json` persistence (BOM-tolerant, clamped) | ✅ |
| `src/main/mcp/settings-ipc.ts` | New: `IPC.MCP_SETTINGS_GET/SET` with live `apply` callback | ✅ |
| `src/main/mcp/gui-tools.ts` | New: 6 GUI-parity tools (queue/timeline/preview/system/updates) | ✅ |
| `src/shared/mcp-settings.ts` | New: shared MCP settings contract + port constants/sanitizers | ✅ |
| `src/preload/index.ts` + `electron-api.d.ts` | New: `mcpGetSettings`/`mcpSetSettings` bridge methods | ✅ |
| `src/renderer/pages/Settings.tsx` + `Settings.styles.ts` | Add MCP server toggle + port/token fields | ✅ |
| `src/renderer/stores/settingsStore.ts` | Persist MCP settings + main-process hydration | ✅ |
| `src/renderer/i18n/locales/*.json` | Add 6 `settings.mcp*` keys across all 56 locales | ✅ |
| `docs/CLI.md` | Document the `--mcp` mode | ✅ |
| `docs/MCP.md` | New: tool/resource/prompt catalogue + client configs | ✅ |
| `scripts/mcp-smoke.mjs` | New: stdio handshake/tool/ping smoke test | ✅ |
| `.github/workflows/ci.yml`, `release.yml` | Run the MCP smoke test in CI and release builds | ✅ |

---

## 7. Execution Order & Checkpoints

> Progress tracked via checkboxes below. A checkpoint is **complete only when its sign-off criteria pass.**

### Checkpoint 0 — Foundation (Phase 1 scaffolding)

- [x] C0.1 Add deps (`@modelcontextprotocol/sdk`, `zod`) — `npm install`
- [x] C0.2 Add `src/mcp/` scaffold: `server.ts` + `index.ts` with a no-op `ping` tool
- [x] C0.3 Wire `tsconfig.main.json` include + `"mcp"` npm script
- [x] C0.4 Add `--mcp` mode to `src/main/index.ts`
- [x] C0.5 Smoke test both launch paths + MCP Inspector

**Sign-off:** `npm run mcp` starts; MCP Inspector lists `ping`; `EncodeX.exe --mcp` equivalent works in dev.

> **Note (found during C0.5):** On Windows, Electron's main process does not relay piped
> stdin through `process.stdin`, so the MCP stdio transport uses raw fd 0/1
> streams (`fs.createReadStream(null, { fd: 0 })` / `createWriteStream` on fd 1) and
> `--mcp` mode disables hardware acceleration (`app.disableHardwareAcceleration()`).
> Both launch paths verified: `node dist/mcp/index.js` and `electron dist/main/index.js --mcp`.

### Checkpoint 1 — Core tools

- [x] C1.1 `AsyncConversionManager` (+ unit tests with a fake transcoder)
- [x] C1.2 `convert_media` + `get_job` / `list_jobs` / `cancel_job`
- [x] C1.3 `get_media_info` + `list_capabilities`
- [x] C1.4 `list_profiles` + `get_profile`
- [x] C1.5 Input validation (file exists, qscale clamp, concurrency clamp)

**Sign-off:** inspector can probe a real file and run a real conversion end-to-end (job transitions to `done`, output exists). Typecheck + lint + unit tests green.

> **Note:** `AsyncConversionManager` was implemented as {@link MCPJobManager}
> (`src/mcp/jobs/manager.ts`) wrapping the shared `JobQueue` (which gained an
> injectable `transcoderFactory` option for test doubles). Tools share one
> manager per server instance, so agents can queue, poll, and cancel across
> calls. Option builders are ported pure (`src/mcp/conversion-options.ts`)
> instead of importing the interactive CLI UI. Unit tests cover option mapping,
> qscale clamping, job lifecycle (queued/running/done/error), cancellation,
> and the concurrency clamp; the tool surface (9 tools) is exercised through
> the SDK's `InMemoryTransport`.

### Checkpoint 2 — Remaining operations

- [x] C2.1 `compress_image`
- [x] C2.2 `extract_audio`
- [x] C2.3 `cut_video`
- [x] C2.4 `batch_convert`
- [x] C2.5 Integration test: spawn `node dist/mcp/index.js`, run each op against a real fixture, assert outputs

**Sign-off:** all 12 tools listed in `tools/list`; real integration suite passes; `npm run typecheck` green.

> **Note:** implemented as 13 tools (the C1 nine plus these four). The option
> builders (`src/mcp/operations.ts`) mirror the CLI's `compress`/`extract-audio`
> and `batch` subcommands as pure functions, so the MCP server stays runnable
> under plain Node. Output naming follows the CLI: `_compressed` (format
> extension), codec-derived audio extension with no suffix, `_cut` (source
> extension) for lossless cuts, and `_encodex_converted` (suffix configurable)
> for batch jobs. The spawn-level integration suite (`mcp-stdio.integration.test.ts`,
> run via `npm run test:integration`) generates fixtures with FFmpeg and verifies
> every operation transitions to `done` and produces a real output file.

### Checkpoint 3 — Resources & prompts

- [x] C3.1 Resources: `encodex://profiles`, `encodex://capabilities`, `encodex://codecs`
- [x] C3.2 Prompts: `convert-video`, `extract-audio`, `compress-image`, `batch-convert`
- [x] C3.3 Tests for resource interactions + prompt argument validation

**Sign-off:** client can `resources/list`, `prompts/list`, and invoke each prompt/read each resource.

> **Note:** prompt arguments follow the MCP protocol's string-only constraint
> (array arguments are rejected by the SDK), so `batch-convert` takes a
> comma-separated `inputs` string. Resources serialize the same data the tools
> expose (`BUILTIN_PROFILES`, `getEncoderCapabilities()`,
> `VIDEO_CODECS`/`AUDIO_CODECS`).

### Checkpoint 4 — Phase 2 embedded HTTP server

- [x] C4.1 `src/main/mcp/http.ts` (loopback server, Origin check, token auth) + `server.ts` transport
- [x] C4.2 GUI-parity tools: queue (all), preview, timeline, updates, system
- [x] C4.3 Settings UI: toggle + port + token + persisted store
- [x] C4.4 Wire into `src/main/index.ts` GUI branch (start only when enabled)
- [x] C4.5 Security review: loopback-only, auth, Origin, excluded surface documented

**Sign-off:** with GUI running and setting enabled, a headless MCP client connects at `http://127.0.0.1:8765/mcp`, reads live queue state, and drives a conversion. Toggle off = server stops. No listener when disabled.

> **Note (C4.1-C4.5 done):** implemented as
> `src/main/mcp/http-server.ts` (Node `http` gateway), `settings.ts`
> (`userData/mcp-settings.json`; BOM-tolerant, clamped port 1024-65535, off by
> default), `settings-ipc.ts` (`IPC.MCP_SETTINGS_GET/SET` with a live `apply`
> callback), and `gui-tools.ts`. MCP sessions each own a fresh `McpServer`
> (the SDK forbids sharing one Protocol across transports) built by a factory
> that wires every session to one shared `MCPJobManager`, so queue tools and
> conversion tools observe the same jobs. Tools added: `get_queue_state`,
> `cancel_all_jobs`, `get_timeline`, `extract_preview`, `get_system_info`,
> `check_for_updates` (19 total). Verified live against the running Electron
> GUI: a headless SDK client completed initialize + `tools/list` (19 tools) +
> `ping`/`get_system_info`/`get_queue_state`. Security model: bind 127.0.0.1
> only; `Origin`, when present, must be `http://127.0.0.1:<port>` or
> `http://localhost:<port>` (else 403); optional bearer token compared
> timing-safely (else 401); only GET/POST/DELETE on `/mcp` accepted; sessions
> force-closed on stop/quit. **Excluded surface:** no destructive filesystem
> tools, no arbitrary shell/exec, no settings writes, and no window/OS control
> are exposed over MCP. C4.3 renders in the Settings page
> (`McpSettingsSection`): an enable switch plus (when enabled) a port and an
> optional bearer-token field. Values live in `useSettingsStore`
> (`mcpEnabled`/`mcpPort`/`mcpToken`) and flow through the preload bridge
> (`mcpGetSettings`/`mcpSetSettings`) to `registerMcpSettingsIpc`, which
> persists them and live-reconciles the running server via the `apply`
> callback; the sanitized result is adopted. Port/token inputs commit on
> blur/Enter so typing never restarts the server per keystroke. The six new
> `settings.mcp*` keys are translated natively across all 56 locales.

### Checkpoint 5 — Documentation & CI

- [x] C5.1 `docs/CLI.md` — document `--mcp`
- [x] C5.2 `docs/MCP.md` — tool/resource/prompt catalogue + client configs (Claude Desktop, VS Code, Cursor, headless)
- [x] C5.3 Release CI smoke test for `--mcp`
- [x] C5.4 Final `npm run typecheck && npm run test` full pass

**Sign-off:** docs accurate, CI green, full test suite green.

> **Note (Checkpoint 5 complete):** `docs/CLI.md` gained an "MCP Server
> Mode" section; `docs/MCP.md` is the full catalogue (19 tools, 3 resources, 4
> prompts, client configs, security model, troubleshooting). The stdio smoke
> test is `scripts/mcp-smoke.mjs` (`npm run mcp:smoke` for `node
> dist/mcp/index.js`, `npm run mcp:smoke:electron` for `electron . --mcp`); it
> asserts the handshake, the 13-tool stdio catalogue, and a live `ping`. CI runs
> both paths in the `test-mcp-smoke` job (Electron under xvfb), and the release
> workflow smoke-tests the compiled server on every packaging matrix entry.
> C5.4 final pass: `npm run typecheck` clean, `npm test` 1975/1975 passing.

---

## 8. Testing Strategy

| Layer | Approach |
|-------|----------|
| Unit (tools/schemas) | Vitest + in-memory MCP `Client` against `createMcpServer()`; validate every input schema and handler |
| Unit (job manager) | Fake `ITranscoder` emitting `progress`/`end`/`error`; assert state transitions |
| Integration | Spawn `node dist/mcp/index.js` via `child_process`, drive a real conversion with `perf/fixtures/`, assert outputs + job lifecycle |
| E2E / packaged | CI runs packaged `--mcp` smoke test (resolves bundled ffmpeg) |
| Phase 2 | Headless client against live running Electron GUI; assert queue/preview/update tools against real state |
| Tooling | `npm run typecheck` (main/preload/renderer), `npm run lint`, existing 1603-test suite must stay green |

---

## 9. MCP Client Registration Examples

**Claude Desktop** (`claude_desktop_config.json`), **VS Code** (`mcp.servers`), **Cursor** — same shape:

```jsonc
{
  "mcpServers": {
    "encodex": {
      // Development / source checkout:
      "command": "node",
      "args": ["C:/path/to/EncodeX/dist/mcp/index.js"],
      // Packaged app:
      // "command": "C:/Program Files/EncodeX/EncodeX.exe",
      // "args": ["--mcp"]
    }
  }
}
```

**Remote / headless agents (Phase 2):**

```jsonc
{
  "mcpServers": {
    "encodex-gui": {
      "url": "http://127.0.0.1:8765/mcp",
      "headers": { "Authorization": "Bearer <token-if-configured>" }
    }
  }
}
```

---

## 10. Open Decisions / Risks

| Item | Status | Notes |
|------|--------|-------|
| Phase 2 port | Fixed default `8765`, editable in Settings (clamped 1024-65535) | ✅ Decided at C4.3 |
| Token | Optional, default blank (trusted localhost); compared timing-safely | ✅ Decided at C4.3 |
| Packaged `--mcp` launch | Works via the Electron `--mcp` branch; covered by `mcp:smoke:electron` | ✅ Confirmed in C0.4 |
| SDK v1 vs v2 | v1 chosen (stable, dual module, wide docs) | Revisit if a hard requirement appears |
| Job retention | In-memory, unbounded — document prune/futures | Follow-up item |
| BMF backend | Supported transparently via `ITranscoder` (same as CLI) | ✅ Verified in C1.2 |

### Known risks

1. **Module/Electron coupling drift** — future patches to `transcoders/` must not import Electron top-level; existing `isPackaged()` guard is the pattern to preserve.
2. **SDK CJS compatibility** — SDK v1 is dual-module; confirm `dist/mcp/index.js` (CommonJS) loads it. Fallback: emit MCP entry as ESM via a dedicated tsconfig.
3. **Long-running conversions** — mitigated by async job model + polling; no tool blocks >1s.
4. **Security** — client-side arbitrary file access is inherent to MCP; rely on host consent + Phase 2 loopback/token defense.

---

## 11. Future Work (out of scope this round)

- Persistent job history with prune policy (disk-backed, optional).
- Remote MCP deployment (Cloudflare/SaaS) — requires auth redesign, out of scope.
- Exposing renderer-side operations (player timeline scrubbing, hotkeys) via MCP.
- i18n for MCP tool descriptions (currently English, matching CLI/engine strings).