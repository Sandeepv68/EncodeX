# 🖼️ Interactive MCP Apps

EncodeX's MCP server is [MCP Apps](https://modelcontextprotocol.io) (SEP-1865) compliant. In hosts that support the extension — Claude, VS Code, ChatGPT, Goose, Postman, MCPJam — EncodeX's job tools render as interactive views: a live queue dashboard, a per-job progress card, a media-info table, and a conversion setup form. In hosts that don't, every tool still returns its normal JSON text payload, so nothing breaks.

Related docs: [`MCP.md`](MCP.md) (server, tools, security), [`CLI.md`](CLI.md), [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## How it works

```
MCP host (Claude / VS Code / ChatGPT)
  │  tools/call            →  EncodeX MCP server (stdio or embedded HTTP :8765)
  │  resources/read ui://  →  registerAppResource → self-contained HTML view
  │  postMessage JSON-RPC  ↔  host-sandboxed iframe
  ▼
tool result = { text (model fallback) + structuredContent (view data) }
```

1. A tool declares `_meta.ui.resourceUri` pointing at a `ui://` resource.
2. The host fetches that resource with `resources/read`; it must be MIME `text/html;profile=mcp-app`.
3. The host renders the HTML in a sandboxed iframe and wires up a `postMessage` JSON-RPC channel.
4. The view reads live data from `structuredContent` and can call tools back through the host proxy.

EncodeX advertises the `io.modelcontextprotocol/ui` extension in its `initialize` capabilities, declaring the view MIME type (`{ mimeTypes: ["text/html;profile=mcp-app"] }`). Hosts validate that MIME type before they will render a `ui://` resource, so a bare (empty) capability object is not enough.

> **Data passing:** view data is delivered as `structuredContent` at runtime and written with `textContent`. Untrusted values (file paths, codec names, error text) are **never** interpolated into the served HTML, so they cannot inject markup or script.

---

## Views

| View URI | Rendered by | Shows |
| -------- | ----------- | ----- |
| `ui://encodex/queue` | `list_jobs` | Live job dashboard: one row per job with status, progress bar, and a confirm-gated **Cancel** button |
| `ui://encodex/job` | `get_job` | Single-job card: input/output paths, progress, error text, confirm-gated **Cancel** |
| `ui://encodex/media-info` | `get_media_info` | Container facts (format, duration, size, bitrate) plus a per-stream table (codec, resolution, sample rate, channels) |
| `ui://encodex/convert` | `convert_media` | Conversion form, pre-filled from a model proposal, that starts the job only when the user clicks **Start** and then tracks it |
| `ui://encodex/confirm` | all other mutating tools | Confirmation card for a proposed operation (details + warnings); runs it only when the user clicks **Run** |

Each view is a small, self-contained HTML document: inline CSS plus an inline bridge script, **no external scripts or stylesheets**, so it renders under a host's restrictive default CSP. The views are intentionally kept well under a ~100 KB budget.

Two extra view URIs are reserved for later work and are not yet served: `ui://encodex/profiles` and `ui://encodex/capabilities`.

### Tool → view wiring

| Tool | `_meta.ui.resourceUri` | `structuredContent` |
| ---- | ---------------------- | ------------------- |
| `list_jobs` | `ui://encodex/queue` | `{ jobs: Job[], count, generatedAt }` |
| `get_job` | `ui://encodex/job` | `{ job: Job }` |
| `get_media_info` | `ui://encodex/media-info` | `{ media: MediaInfo }` |
| `convert_media` | `ui://encodex/convert` | `{ confirmation }` while awaiting the user, else `{ job, transcoder }` |
| `compress_image`, `extract_audio`, `cut_video`, `batch_convert`, `remux_media`, `demux_media` | `ui://encodex/confirm` | `{ confirmation }` while awaiting the user, else `{ job }` / `{ total, jobs }` |
| `commit_operation` (app-only) | — | whatever the confirmed operation returns |

Non-UI hosts receive the same JSON as the tool's `text` content and ignore `structuredContent`.

### User-approval gate

When the connected client advertises MCP Apps, the server refuses to run a mutating operation straight from a model call: it answers with a confirmation (`{ operation, title, summary, args, details?, warnings? }`), the app renders it, and the operation only runs once the user approves — at which point the view replays the exact arguments into the app-only `commit_operation` tool. Clients without the extension keep the historical headless behaviour and run immediately, so agents and CLIs are unaffected.

`commit_operation` is registered with `_meta.ui.visibility: ['app']`, so the model cannot call it — only the sandboxed view can. The confirmable-operation list lives in `src/mcp/ui/approval.ts` and drives both the tool enum and the gating logic.

---

## Bidirectional actions

MCP Apps views may call tools back through the host's `tools/call` proxy. EncodeX uses this in three ways:

- **The convert form and the generic confirm view** call the app-only `commit_operation` tool with the user's settings, then track the returned job(s) with `get_job` / `list_jobs`.
- **`commit_operation`** is the single path that actually runs a mutating operation; the model-facing tools never do so under an MCP Apps host (see *User-approval gate*).
- **Destructive actions** (`cancel_job`) require an explicit in-view confirmation: the first click arms the button (**Confirm**), and only a second click issues the call. This prevents an accidental cancel from a stray click.

Views auto-refresh by polling their tool (for example, the queue view calls `list_jobs` on an interval) and stop polling when the tool starts failing.

---

## Architecture (for contributors)

| File | Responsibility |
| ---- | -------------- |
| `src/shared/mcp-ui.ts` | Extension id, MIME type, view URIs, and the `McpUiJob` / `McpUiConfirmation` payload types |
| `src/mcp/ui/approval.ts` | `hostSupportsMcpApps`, the confirmable-operation list, and the confirmation result builder |
| `src/mcp/ui/registry.ts` | `viewId → { uri, title, description, html }` registry |
| `src/mcp/ui/resources.ts` | `registerUiResources(server)` — registers every view via `registerAppResource` |
| `src/mcp/ui/bridge.ts` | `VIEW_BRIDGE_SCRIPT` — the inline `postMessage` bridge (handshake, theme, render, polling, `tools/call`) |
| `src/mcp/ui/views/*.ts` | One self-contained HTML document per view |
| `src/mcp/server.ts` | Advertises the extension; registers UI/mutating tools with `registerAppTool` + `_meta.ui`; gates them behind `commit_operation`; `okUi(text, structuredContent)` |

**Pipeline:** views are currently hand-written, self-contained HTML string modules (zero network, CSP-clean, no extra bundler). The production target is to author them as React components and bundle each to a single HTML file with `vite-plugin-singlefile`, replacing the hand-written bridge with the `ext-apps` `App` API.

**Dependency note:** EncodeX pins the legacy monolith `@modelcontextprotocol/sdk@1.x` and therefore uses `@modelcontextprotocol/ext-apps@^1.7.5`. The ext-apps `2.x` line requires the newer split packages and is a deliberate future migration, not part of this integration.

---

## Verification

```bash
npm run build:main
npm run mcp:smoke            # asserts the UI extension + every view resource
```

The smoke test and the e2e suite (`e2e/mcp/mcp-apps.spec.ts`) both assert that the extension capability is advertised, every `ui://` view is listed with MIME `text/html;profile=mcp-app`, each view reads back as self-contained HTML, and UI-enabled tools carry their `_meta.ui.resourceUri`.

Unit coverage lives in `src/mcp/__tests__/mcp-ui.test.ts` (resources, `structuredContent`, text fallback, size/CSP budget) and `src/mcp/__tests__/mcp-ui-bridge.test.ts` (runs the inline view scripts in a simulated host iframe, including hostile-metadata rendering).

> Rendering inside a real host (Claude Desktop, VS Code) is a manual smoke step — the automation covers the server contract, not a third-party client's iframe.
