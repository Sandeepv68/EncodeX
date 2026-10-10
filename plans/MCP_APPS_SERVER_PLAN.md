# Plan: EncodeX as an MCP App (MCP Apps / SEP-1865 Server Integration)

## Goal

Make EncodeX's MCP **server** MCP Apps–compliant so external hosts (Claude, VS Code,
ChatGPT, Goose) render EncodeX tools as rich, interactive UI — job dashboards, media-info
cards, conversion forms — instead of only text JSON. EncodeX stays a **server only**; no
renderer/chat surface is added.

North-star shift:

> From: _"EncodeX exposes an MCP server."_
> To: **"Claude/VS Code can operate a local media toolkit through interactive MCP Apps."**

## Status Legend

- `[ ]` Not started
- `[/]` In progress
- `[x]` Done
- `(manual)` Requires external action (host install, screenshot capture)

## Background (verified 2026-10-09)

MCP Apps shipped 2026-01-26 as the first official MCP extension (SEP-1865), unifying
MCP-UI and OpenAI's Apps SDK. The pattern:

1. A tool declares `_meta.ui.resourceUri` -> a `ui://` resource.
2. Host fetches it via `resources/read` (MIME `text/html;profile=mcp-app`).
3. Host renders it in a host-sandboxed iframe.
4. View <-> host communicate via JSON-RPC over `postMessage`.
5. Non-UI hosts fall back to the tool's normal text result — backward compatible.

Live hosts: Claude (web/desktop), VS Code, ChatGPT, Goose, Postman, MCPJam.

**EncodeX today (verified):** MCP **server only** — 15 core tools
(`src/mcp/server.ts`) + 6 GUI tools (`src/main/mcp/gui-tools.ts`), 3 JSON resources, 4
prompts. Every result is `ok(JSON.stringify(...))` / `fail(...)` **text-only**. No
`ui://`, `resource_link`, `structuredContent`, or renderable payloads. No chat surface.

## Compatibility Decision (critical)

`@modelcontextprotocol/ext-apps@2.x` requires the new split packages
(`@modelcontextprotocol/server@2`, `/client@2`, `/core@2`). EncodeX pins the legacy
monolith `@modelcontextprotocol/sdk@^1.30.0` (resolved 1.32.1). Use
**`@modelcontextprotocol/ext-apps@^1.7.5`** (peer `@modelcontextprotocol/sdk@^1.29.0` —
satisfied). Do **not** jump to ext-apps 2.x here.

## Target Architecture

```
MCP Host (Claude / VS Code / ChatGPT)
  |  tools/call            -->  EncodeX MCP server (stdio OR embedded HTTP :8765)
  |  resources/read ui://  -->  registerAppResource --> inline HTML view string
  |  postMessage JSON-RPC  <->  sandboxed iframe (host-owned)
  v
tool result = { text (model fallback) + structuredContent (view data) }
```

Data flows to the view as `structuredContent` at runtime — never by server-side HTML
interpolation (eliminates FS-path/metadata XSS).

## Phase 0 — Foundations

| # | Task | Files |
|---|------|-------|
| 0.1 | Add `@modelcontextprotocol/ext-apps@^1.7.5` | `package.json` |
| 0.2 | Shared constants: `EXTENSION_ID`, `RESOURCE_MIME_TYPE`, view URIs, structured-content types | new `src/shared/mcp-ui.ts` |
| 0.3 | Advertise extension capability in handshake (`ServerCapabilities.extensions`) | `src/mcp/server.ts` |
| 0.4 | Verify `registerAppTool`/`registerAppResource`/`getUiCapability`/`RESOURCE_MIME_TYPE` exports + zod-4 compat | spike |

## Phase 1 — View Infrastructure

| # | Task | Files |
|---|------|-------|
| 1.1 | View registry: `viewId -> { uri, title, description, html }` | new `src/mcp/ui/registry.ts` |
| 1.2 | `registerUiResources(server)` via `registerAppResource`; called from `createMcpServer` (both stdio + HTTP) | new `src/mcp/ui/resources.ts`, `src/mcp/server.ts` |
| 1.3 | View build pipeline (decision below) | new `src/mcp/ui/views/*` |
| 1.4 | `okUi(text, structuredContent?)` helper; keep `ok()` as text-only alias | `src/mcp/server.ts` |

**View pipeline decision:**
- **A (MVP, recommended):** self-contained HTML string modules + tiny inlined
  `postMessage` bridge. Zero network, CSP-clean, no new bundler.
- **B (production target):** Vite single-file bundle of React + `ext-apps` per view →
  generated TS string modules; add `vite-plugin-singlefile`, `build:mcp-ui`.
- **C (rejected):** CDN import from `esm.sh` — network-dependent, against local-first.

## Phase 2 — View Catalog & Tool Wiring

Swap `server.registerTool(...)` -> `registerAppTool(server, name, {...,
_meta: { ui: { resourceUri } } }, handler)` for UI-enabled tools (non-breaking).

| View URI | Tools | UX | MVP |
|----------|-------|----|-----|
| `ui://encodex/queue` | `list_jobs`, `get_queue_state` | job dashboard, progress bars, per-job cancel, auto-refresh | yes |
| `ui://encodex/job` | `get_job`, `convert_media` result | live progress + cancel + output path | yes |
| `ui://encodex/media-info` | `get_media_info`, `get_timeline` | codec/resolution table + thumbnail | yes |
| `ui://encodex/convert` | `convert_media` | structured setup form -> tool call | yes |
| `ui://encodex/profiles` | `list_profiles`, `get_profile` | profile gallery -> convert | later |
| `ui://encodex/capabilities` | `list_capabilities` | hardware/encoder explorer | later |

Add per-tool `structuredContent` shapes to `src/shared/mcp-ui.ts`.

## Phase 3 — Bidirectional Actions

- Default visibility `["model","app"]` means views can already call existing tools via
  the host proxy — **no new tools required for MVP**.
- Destructive actions (`cancel_job`, `cancel_all_jobs`) require an explicit in-view
  confirmation click.
- Later: optional app-only (`visibility:["app"]`) hidden refresh helpers.

## Phase 4 — Security Hardening

- Self-contained views => declare **no** `_meta.ui.csp` external domains.
- Never interpolate untrusted FS data into HTML; deliver via `structuredContent` and
  render with `textContent`/escaping.
- Host enforces iframe sandbox; keep view HTML small (< ~100 KB budget).
- HTTP loopback/token/origin guards unchanged (`src/mcp/http.ts`).
- New hostile tests: `<script>`/oversized/unicode metadata -> safe structuredContent +
  no injected script in served HTML.

## Phase 5 — Tests, CI, Docs, Site

- New `src/mcp/__tests__/mcp-ui.test.ts`: `resources/read` returns
  `text/html;profile=mcp-app`; tools carry `_meta.ui.resourceUri`; structuredContent
  shape; text fallback.
- Update inventories: `src/mcp/__tests__/server.test.ts`, `scripts/mcp-smoke.mjs`,
  `e2e/mcp/*`.
- New `e2e/mcp/mcp-apps.spec.ts`; optionally extend `e2e/mcp/vscode-ui.spec.ts`
  (`E2E_REAL`-gated).
- Docs: new `docs/MCP_UI.md`; update `docs/MCP.md`, `docs/MCP_PLAN.md`,
  `docs/FEATURES.md`; site `/mcp` + `McpDemo.vue`.
- Gates: `typecheck:main`, `lint`, `format:check`, `audit:gate`, `test:coverage`.

## Milestones

- **M0** `[x]` Static view fetchable via `resources/read` (proves plumbing + capability).
- **M1** `[x]` Queue view with `structuredContent` + auto-refresh (implementation; real-host render still `(manual)`).
- **M2** `[x]` Job + media-info views (implementation; real-host render still `(manual)`).
- **M3** `[x]` Convert form + confirm-gated actions (implementation; real-host render still `(manual)`).
- **M4** `[x]` Hardening, tests, docs, site (implementation; real-host render still `(manual)`).

## Files to Add / Modify

| File | Change | Phase |
|------|--------|-------|
| `package.json` | add `@modelcontextprotocol/ext-apps@^1.7.5` | 0 |
| `tsconfig.main.json` | `paths` map for the ESM-only ext-apps (see Progress Log) | 0 |
| `src/shared/mcp-ui.ts` (new) | constants + structured-content types | 0 |
| `src/mcp/server.ts` | capability advertisement, `registerAppTool`, `okUi`, resource registration | 0-2 |
| `src/mcp/ui/registry.ts` (new) | view registry | 1 |
| `src/mcp/ui/resources.ts` (new) | `registerUiResources` | 1 |
| `src/mcp/ui/views/*` (new) | view HTML/bridge | 1-2 |
| `src/main/mcp/gui-tools.ts` | wire `_meta.ui` for GUI tools | 2 |
| `src/mcp/__tests__/mcp-ui.test.ts` (new) | resource/tool/event assertions | 5 |
| `scripts/mcp-smoke.mjs` | resource-count expectations | 5 |
| `e2e/mcp/mcp-apps.spec.ts` (new) | end-to-end over HTTP | 5 |
| `docs/MCP_UI.md` (new) | usage + host matrix | 5 |

## Decisions

| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | ext-apps version | `^1.7.5` (stays on `sdk@1.x`) |
| 2 | `@mcp-ui/server` | Defer; ext-apps server helpers suffice |
| 3 | View pipeline | Start A (self-contained), target B (Vite single-file) |
| 4 | Data passing | `structuredContent` at runtime, never HTML interpolation |
| 5 | MVP view set | queue, job, media-info, convert form |
| 6 | App-only tools | Skip in MVP (default visibility already app-callable) |
| 7 | View i18n | EN-first; read host locale from `ui/initialize` hostContext later |

## Risks

- **SDK split migration** — ext-apps 1.x keeps `sdk@1.x`; document the future 2.x move.
- **Host variance** — Cursor/others may lack MCP Apps support; text fallback protects us.
- **View script/CSP** — mitigated by self-contained bundling (A -> B).
- **Transport size** — keep HTML lean; response sizes modest.
- **Test-inventory churn** — resource count changes (3 -> 3+N); avoid app-only tools in MVP.
- **Do not commit/push unless the user explicitly asks** (standing instruction).

## Verification Checklist

- [x] `resources/read ui://encodex/*` returns `text/html;profile=mcp-app`
- [x] UI tools expose `_meta.ui.resourceUri`; non-UI hosts still get text
- [ ] Views render interactively in Claude Desktop and VS Code (real host — `(manual)`)
- [x] Hostile-metadata tests pass (no injected script)
- [x] `npm run typecheck:main`, `npm run lint`, `npm run format:check`, `npm run test` pass
- [x] `npm run mcp:smoke` updated and green

## Progress Log

### 2026-10-09 — Phase 0 complete; Phase 1 partially started (M0 ✅)

**Done**
- `@modelcontextprotocol/ext-apps@^1.7.5` added to `package.json`.
- `src/shared/mcp-ui.ts` (new): `MCP_UI_EXTENSION_ID`, `MCP_UI_RESOURCE_MIME_TYPE`,
  `MCP_UI_URI_SCHEME`, `MCP_UI_VIEW_URIS`, `McpUiJob`, `supportsMcpUi`.
- `src/mcp/ui/registry.ts` (new): `MCP_UI_VIEWS` + `findUiView` (queue view registered).
- `src/mcp/ui/views/queue.ts` (new): self-contained HTML (host CSS-var themed, no
  external script/style/font — CSP-clean).
- `src/mcp/ui/resources.ts` (new): `registerUiResources` via `registerAppResource`.
- `src/mcp/server.ts`: advertises the extension capability and calls
  `registerUiResources`; shared by stdio + embedded HTTP.
- `src/mcp/__tests__/mcp-ui.test.ts` (new): 4 tests (capability advertised, view listed
  with the MCP-App MIME, HTML read + self-contained, standard resources intact).
- `tsconfig.main.json`: `baseUrl` + `paths` mapping for ext-apps.

**Verified**
- `npm run typecheck:main` / `:test` / `:e2e` green; `npm run build:main` emits; real
  `npm run mcp:smoke` green (15 tools, ping pong); `npx vitest run src/mcp` → 167 pass;
  `prettier --check` clean on changed files.

**Resolution notes (two non-obvious blockers)**
1. **Capability advertisement:** `McpServer` takes server info as arg 1 and
   `McpServerOptions` (= `ServerOptions`) as arg 2, so `capabilities.extensions` must be
   the **second** constructor argument. The SDK merges capabilities additively
   (`mergeCapabilities`, generic per-key merge), so the extension survives the later
   `tools`/`resources`/`prompts` registrations.
2. **ESM-only ext-apps under classic resolution:** ext-apps is `"type":"module"` with an
   `exports` map but **no `typesVersions`**, while `tsconfig.main.json` uses
   `moduleResolution: "node"` (ignores `exports`). The SDK gets away with it because it
   ships `typesVersions`. Fix: mirror it with a `paths` map pointing at the ext-apps
   `.d.ts` files. Runtime is fine — Electron 43 bundles Node 24.21, whose `require(esm)`
   loads the ESM entry (verified). `tsc` leaves the specifier untouched, so Node resolves
   it via the exports map at runtime.

**Next:** Phase 1.3 bridge + 1.4 `okUi` helper, then Phase 2 wire `ui://encodex/queue`
into `list_jobs`/`get_queue_state` with `structuredContent` (M1).

### 2026-10-09 — Phase 1.3/1.4 + queue wiring (M1 ✅ code-complete)

**Done**
- `src/mcp/ui/bridge.ts` (new): `VIEW_BRIDGE_SCRIPT`, the self-contained inline
  MCP Apps client bridge — `ui/initialize` → `ui/notifications/initialized`,
  host-theme CSS variables, `tool-result` rendering, and capability-gated
  `tools/call` polling for auto-refresh. No backticks (safe to inline).
- `src/mcp/ui/views/queue.ts`: injects the bridge; renders job name/status/progress
  bar with `textContent` only.
- `src/mcp/server.ts`: `okUi(text, structuredContent)` helper; `list_jobs` now
  registered via `registerAppTool` with `_meta.ui.resourceUri = ui://encodex/queue`
  and returns `structuredContent = { jobs, count, generatedAt }`. Text fallback is
  unchanged (`JSON.stringify(jobs)`), so non-UI hosts and existing tests are intact.
- Tests: `mcp-ui.test.ts` +2 cases (tool `_meta`, `structuredContent` + text
  fallback); new `mcp-ui-bridge.test.ts` runs the inline bridge against a fake
  host in jsdom (handshake, theme, render).

**Verified**
- `npx vitest run src/mcp` → 169 pass; `typecheck:test` green; `prettier --check`
  clean; `build:main` + `mcp:smoke` green (15 tools).

**Remaining for M1:** real-host render in Claude Desktop / VS Code is `(manual)`.
**Next:** Phase 2 remaining views (job, media-info, convert), then Phase 5
(smoke/e2e inventories, docs).

### 2026-10-09 — Phase 2 job + media-info views (M2 ✅ code-complete)

**Done**
- `src/mcp/ui/bridge.ts` refactored to be view-agnostic: the bridge reads a
  `window.__encodexView = { appName, tool?, arguments?, intervalMs?, autostart?,
  render }` config (defined by an inline script before it), and exposes
  `window.__encodexStartPolling()` so a view can (re)start polling once it learns
  its arguments (e.g. the job id). Listener registration is now idempotent.
- `src/mcp/ui/views/job.ts` (new): single-job card; polls `get_job` with the id
  from the first tool-result (`autostart:false`, starts polling from `render`).
- `src/mcp/ui/views/media-info.ts` (new): container facts + per-stream table.
- `src/mcp/ui/registry.ts`: registers queue + job + media-info.
- `src/mcp/server.ts`: `get_job` and `convert_media` → `ui://encodex/job`
  (`structuredContent { job }` / `{ job, transcoder }`); `get_media_info` →
  `ui://encodex/media-info` (`structuredContent { media }`). Text fallbacks
  unchanged.
- Tests: `mcp-ui.test.ts` (all three views listed, tool `_meta` for
  get_job/convert_media/get_media_info); `mcp-ui-bridge.test.ts` now runs the
  queue, job, and media-info views against a fake host.

**Verified**
- `npx vitest run src/mcp` → 172 pass; `typecheck:test` green; `prettier --check`
  clean; `build:main` + `mcp:smoke` green (15 tools).

**Remaining for M2:** real-host render is `(manual)`.
**Next:** M3 — the `ui://encodex/convert` form (bidirectional `tools/call` from the
view, confirm-gated `cancel_job`), then Phase 5 (smoke/e2e inventories, docs).

### 2026-10-09 — Phase 3 convert form + confirm-gated actions (M3 ✅ code-complete)

**Done**
- `src/mcp/ui/bridge.ts`: `window.__encodexCallTool(name, args)` exposed so views
  can drive the host's `tools/call` proxy (submit conversions, cancel jobs).
- `src/mcp/ui/views/convert.ts` (new): a setup form (input, output, video/audio
  codec + bitrate, quality, scale, stream-copy) that calls `convert_media` from
  inside the view, then renders the returned job and tracks it via `get_job`
  polling; also renders a job delivered by the host when the model invoked the
  tool. Same confirm-gated cancel as the other views.
- `src/mcp/ui/views/queue.ts` + `job.ts`: confirm-gated Cancel (first click arms
  `Confirm`, second click calls `cancel_job`, refresh/hide on success). The queue
  row grid widened to `1fr auto auto`.
- `src/mcp/ui/registry.ts`: registers the convert view.
- `src/mcp/server.ts`: `convert_media` `_meta.ui.resourceUri` repointed from
  `ui://encodex/job` → `ui://encodex/convert`.
- Tests: `mcp-ui.test.ts` (convert view listed; `convert_media` → convert URI);
  `mcp-ui-bridge.test.ts` now also submits the convert form and asserts the
  two-click cancel flow.

**Verified**
- `npx vitest run src/mcp` → 174 pass; `typecheck:main`/`typecheck:test` green;
  `prettier --check` clean; `build:main` + `mcp:smoke` green (15 tools).

**Remaining for M3:** real-host render is `(manual)`.
**Next:** Phase 5 — smoke/e2e inventories + `docs/MCP_UI.md` (M4).

### 2026-10-09 — Phase 5 tests, CI, docs, site + Phase 4 hardening (M4 ✅ code-complete)

**Done**
- `scripts/mcp-smoke.mjs`: asserts the `io.modelcontextprotocol/ui` capability and
  that every `ui://` view is listed with MIME `text/html;profile=mcp-app`, plus a
  self-contained `resources/read` of the queue view.
- e2e inventories updated: `e2e/mcp/client.ts` (new `UI_EXTENSION_ID`,
  `UI_RESOURCE_MIME`, `UI_VIEW_URIS`, `ALL_RESOURCE_URIS`, `assertMcpAppsSurface`)
  and the exact-resource assertions in `assertToolSurface`, `stdio.spec.ts`, and
  `vscode-client.spec.ts`; `harness.ts` `RESOURCE_URIS` widened to include views.
- New `e2e/mcp/mcp-apps.spec.ts`: dials the standalone HTTP server and asserts the
  extension capability, view resources/MIME/self-containment, tool `_meta.ui`,
  and the text fallback.
- Phase 4 hardening: `mcp-ui-bridge.test.ts` now renders a hostile `<img onerror>`
  job as inert text (no element injection); `mcp-ui.test.ts` asserts a <100 KB
  size budget and no external `<script src>` / `<link stylesheet>` on every view.
- Docs: new `docs/MCP_UI.md`; `docs/MCP.md` (intro + Resources + Verification),
  `docs/FEATURES.md` (new MCP Server section), `docs/MCP_PLAN.md` (§12 follow-on).
- Site: `site/mcp.md` interactive-views paragraph; `McpDemo.vue` gains a localized
  `appsNote` across all seven locales.

**Verified**
- `npx vitest run src/mcp` → 176 pass; `typecheck:main`/`:test`/`:e2e` green;
  `prettier --check` clean; `build:main` + `mcp:smoke` green (15 tools + 4 views).

**Remaining for M4:** real-host render in Claude Desktop / VS Code is `(manual)`;
packaged Electron smoke + site `docs:build` are release-time checks.



