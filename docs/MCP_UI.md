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

EncodeX advertises the `io.modelcontextprotocol/ui` extension in its `initialize` capabilities, so a compliant host knows views are available.

> **Data passing:** view data is delivered as `structuredContent` at runtime and written with `textContent`. Untrusted values (file paths, codec names, error text) are **never** interpolated into the served HTML, so they cannot inject markup or script.

---

## Views

| View URI | Rendered by | Shows |
| -------- | ----------- | ----- |
| `ui://encodex/queue` | `list_jobs` | Live job dashboard: one row per job with status, progress bar, and a confirm-gated **Cancel** button |
| `ui://encodex/job` | `get_job` | Single-job card: input/output paths, progress, error text, confirm-gated **Cancel** |
| `ui://encodex/media-info` | `get_media_info` | Container facts (format, duration, size, bitrate) plus a per-stream table (codec, resolution, sample rate, channels) |
| `ui://encodex/convert` | `convert_media` | Conversion setup form (input, output, codecs, bitrates, quality, scale, stream-copy) that starts a job and tracks it |

Each view is a small, self-contained HTML document: inline CSS plus an inline bridge script, **no external scripts or stylesheets**, so it renders under a host's restrictive default CSP. The views are intentionally kept well under a ~100 KB budget.

Two extra view URIs are reserved for later work and are not yet served: `ui://encodex/profiles` and `ui://encodex/capabilities`.

### Tool → view wiring

| Tool | `_meta.ui.resourceUri` | `structuredContent` |
| ---- | ---------------------- | ------------------- |
| `list_jobs` | `ui://encodex/queue` | `{ jobs: Job[], count, generatedAt }` |
| `get_job` | `ui://encodex/job` | `{ job: Job }` |
| `convert_media` | `ui://encodex/convert` | `{ job: Job, transcoder }` |
| `get_media_info` | `ui://encodex/media-info` | `{ media: MediaInfo }` |

Non-UI hosts receive the same JSON as the tool's `text` content and ignore `structuredContent`.

---

## Bidirectional actions

MCP Apps views may call tools back through the host's `tools/call` proxy (EncodeX tools default to `visibility: ["model", "app"]`, so no extra tools are needed). EncodeX uses this in two ways:

- **The convert form** calls `convert_media` with the fields the user filled in, then tracks the returned job with `get_job`.
- **Destructive actions** (`cancel_job`) require an explicit in-view confirmation: the first click arms the button (**Confirm**), and only a second click issues the call. This prevents an accidental cancel from a stray click.

Views auto-refresh by polling their tool (for example, the queue view calls `list_jobs` on an interval) and stop polling when the tool starts failing.

---

## Architecture (for contributors)

| File | Responsibility |
| ---- | -------------- |
| `src/shared/mcp-ui.ts` | Extension id, MIME type, view URIs, and the `McpUiJob` / view payload types |
| `src/mcp/ui/registry.ts` | `viewId → { uri, title, description, html }` registry |
| `src/mcp/ui/resources.ts` | `registerUiResources(server)` — registers every view via `registerAppResource` |
| `src/mcp/ui/bridge.ts` | `VIEW_BRIDGE_SCRIPT` — the inline `postMessage` bridge (handshake, theme, render, polling, `tools/call`) |
| `src/mcp/ui/views/*.ts` | One self-contained HTML document per view |
| `src/mcp/server.ts` | Advertises the extension; registers UI-enabled tools with `registerAppTool` + `_meta.ui`; `okUi(text, structuredContent)` |

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
