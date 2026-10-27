# 🖼️ Interactive MCP Apps

EncodeX's MCP server is [MCP Apps](https://modelcontextprotocol.io) (SEP-1865) compliant. In hosts that support the extension — Claude, VS Code, ChatGPT, Goose, Postman, MCPJam — EncodeX's job and media-intelligence tools render as interactive views: a live queue dashboard, a per-job progress card, a media-info table, a conversion setup form, an inspector, a plan/estimate card, a size-target lab, an error card, a batch dashboard, a workflow report, a profile catalogue and a capability report. In hosts that don't, every tool still returns its normal JSON text payload, so nothing breaks.

Inside EncodeX itself, the Copilot renders the very same views inline, so a plan that analyses a file shows the inspector card right in the transcript.

Related docs: [`MCP_UI_HOSTS.md`](MCP_UI_HOSTS.md) (verifying the views in a real host), [`MCP.md`](MCP.md) (server, tools, security), [`CLI.md`](CLI.md), [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## How it works

```
MCP host (Claude / VS Code / ChatGPT)
  │  tools/call            →  EncodeX MCP server (stdio or embedded HTTP :8765)
  │  resources/read ui://  →  the shared React view bundle (one self-contained document)
  │  postMessage JSON-RPC  ↔  host-sandboxed iframe
  ▼
tool result = { text (model fallback) + structuredContent (view data) }
```

1. A tool declares `_meta.ui.resourceUri` pointing at a `ui://` resource.
2. The host fetches that resource with `resources/read`; it must be MIME `text/html;profile=mcp-app`.
3. The host renders the document in a sandboxed iframe and wires up a `postMessage` JSON-RPC channel.
4. The view reads live data from `structuredContent` and can call tools back through the host proxy.

EncodeX advertises the `io.modelcontextprotocol/ui` extension in its `initialize` capabilities, declaring the view MIME type (`{ mimeTypes: ["text/html;profile=mcp-app"] }`). Hosts validate that MIME type before they will render a `ui://` resource, so a bare (empty) capability object is not enough.

> **Data passing:** view data is delivered as `structuredContent` at runtime and rendered as text by React. Untrusted values (file paths, codec names, error text) are **never** interpolated into the served document, so they cannot inject markup or script.

---

## Views

| View URI | Rendered by | Shows |
| -------- | ----------- | ----- |
| `ui://encodex/queue` | `list_jobs` | Live job dashboard: one row per job with status, progress bar, and a confirm-gated **Cancel** button |
| `ui://encodex/job` | `get_job` | Single-job card: input/output paths, progress, error text, confirm-gated **Cancel** |
| `ui://encodex/media-info` | `get_media_info` | Container facts (format, duration, size, bitrate) plus a per-stream table (codec, resolution, sample rate, channels) |
| `ui://encodex/convert` | `convert_media` | Conversion form, pre-filled from a model proposal, that starts the job only when the user clicks **Start** and then tracks it |
| `ui://encodex/confirm` | `compress_image`, `extract_audio`, `cut_video`, `remux_media`, `demux_media` | Confirmation card for a proposed operation (details + warnings); runs it only when the user clicks **Run** |
| `ui://encodex/inspector` | `analyze_media` | Plain-language media diagnosis: key facts, findings by severity, suggested next steps |
| `ui://encodex/plan` | `recommend_settings`, `estimate_conversion` | Recommended settings with rationale and confidence, plus the estimated output size/duration |
| `ui://encodex/lab` | `compress_to_target` | Candidate ladder, every measured attempt, and the winning size-target fit |
| `ui://encodex/error` | `explain_error` | Error explanation with likely causes and suggested fixes |
| `ui://encodex/batch` | `batch_convert` | Batch confirmation (file count, destination, warnings), then a per-file dashboard over the shared job queue with live status/progress |
| `ui://encodex/workflow` | `plan_workflow`, `execute_workflow` | Ordered workflow dry-run with dependencies, then the per-step execution report |
| `ui://encodex/profiles` | `list_profiles` | The built-in conversion profiles (id, category, container, codecs), filterable |
| `ui://encodex/capabilities` | `list_capabilities` | The encoders and hardware acceleration methods available on this machine |

### Tool → view wiring

| Tool | `_meta.ui.resourceUri` | `structuredContent` |
| ---- | ---------------------- | ------------------- |
| `list_jobs` | `ui://encodex/queue` | `{ jobs: Job[], count, generatedAt }` |
| `get_job` | `ui://encodex/job` | `{ job: Job }` |
| `get_media_info` | `ui://encodex/media-info` | `{ media: MediaInfo }` |
| `convert_media` | `ui://encodex/convert` | `{ confirmation }` while awaiting the user, else `{ job, transcoder }` |
| `compress_image`, `extract_audio`, `cut_video`, `remux_media`, `demux_media` | `ui://encodex/confirm` | `{ confirmation }` while awaiting the user, else `{ job }` |
| `batch_convert` | `ui://encodex/batch` | `{ confirmation }` while awaiting the user, else `{ total, jobs }` |
| `analyze_media` | `ui://encodex/inspector` | `{ analysis }` |
| `recommend_settings`, `estimate_conversion` | `ui://encodex/plan` | `{ plan }` / `{ estimate }` |
| `compress_to_target` | `ui://encodex/lab` | `{ lab }` |
| `explain_error` | `ui://encodex/error` | `{ error }` |
| `plan_workflow`, `execute_workflow` | `ui://encodex/workflow` | `{ plan }` / `{ result }` |
| `list_profiles` | `ui://encodex/profiles` | `{ profiles }` |
| `list_capabilities` | `ui://encodex/capabilities` | `{ capabilities }` |
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
| `src/shared/mcp-ui.ts` | Extension id, MIME type, view URIs, the payload types and the `McpViewAttachment` contract |
| `src/mcp/ui/approval.ts` | `hostSupportsMcpApps`, the confirmable-operation list, and the confirmation result builder |
| `src/mcp/ui/registry.ts` | The thirteen views and the `viewId → uri` mapping |
| `src/mcp/ui/resources.ts` | `registerUiResources(server)` — registers every view via `registerAppResource` |
| `src/mcp/ui/bundle.ts` | Loads the built bundle and injects the per-view bootstrap |
| `src/renderer/mcp-views/host.ts` | The `McpViewHost` contract every view talks to |
| `src/renderer/mcp-views/McpViewProvider.tsx` | The provider that owns the payload and the tool calls |
| `src/renderer/mcp-views/views/*.tsx` | One React component per view |
| `src/renderer/mcp-views/kit/*` | The primitives the views are built from |
| `src/renderer/mcp-views/standalone/*` | The standalone entry that external hosts run |
| `src/renderer/mcp-views/AppIpcHost.ts` | The in-app host: forwards the view's tool calls to the main process |
| `src/main/mcp/local-client.ts` | The in-process MCP client the in-app host calls |
| `src/mcp/server.ts` | Advertises the extension; registers UI/mutating tools with `registerAppTool` + `_meta.ui`; gates them behind `commit_operation`; `okUi(text, structuredContent)` |

### The view pipeline

The views are **React** components, authored against the app's own design system:

- The palette and theme factory live in `src/shared/theme/` (`createAppTheme`, the eight
  palettes), so a view looks exactly like the app - in the app *and* in a third-party host.
- The primitives the views need (`ViewCard`, `ViewDefinitionList`, `ViewBadge`, `ViewProgress`,
  `ViewFinding`, `ViewSteps`, `ViewTable`, `ViewField`, `ViewButton`) live in
  `src/renderer/mcp-views/kit/`; the two-click arming of destructive actions is the shared
  `useArmedAction` hook.
- Every visible string comes from the `mcpViews` translation namespace.

`npm run build:mcp-ui` bundles them into **one** self-contained document
(`dist/mcp-ui/views.html`) with `vite-plugin-singlefile`: no external script, stylesheet, font
or fetch, so the document renders under a host's restrictive default CSP. The server injects a
two-line bootstrap naming the view to render, so a single document serves every `ui://`
resource. The document carries React, MUI and the `ext-apps` App class, so it is around
880 KB - the host fetches it once per view resource, and the budget is enforced by
`scripts/generate-mcp-ui-views.mjs`.

**Dependency note:** EncodeX uses the MCP 2.x split packages - `@modelcontextprotocol/server`,
`@modelcontextprotocol/node` and `@modelcontextprotocol/ext-apps@^2` - instead of the legacy
`@modelcontextprotocol/sdk@1.x` monolith. The ext-apps 2.x line ships the browser-side `App` API
and React hooks (`useApp`, `useHostStyleVariables`, `useDocumentTheme`) that the standalone view
uses.

### The same views inside EncodeX

The Copilot renders the same components. A plan carries the views to show in
`CopilotPlan.views`: an analysis carries the inspector view, a queue-backed operation carries
the live queue dashboard. The views call tools back through `AppIpcHost`, which forwards the
call to the main process, where `src/main/mcp/local-client.ts` runs it on the same MCP server -
and therefore the same job manager - the embedded HTTP server exposes. A view that cancels a job
cancels the job the app's queue shows.

---

## Verification

```bash
npm run build              # includes build:mcp-ui
npm run mcp:smoke          # asserts the UI extension + every view resource
npm run mcp:host-check     # asserts every served document is self-contained and in budget
```

The smoke test and the e2e suite (`e2e/mcp/mcp-apps.spec.ts`) both assert that the extension capability is advertised, every `ui://` view is listed with MIME `text/html;profile=mcp-app`, each view reads back as self-contained HTML, and UI-enabled tools carry their `_meta.ui.resourceUri`.

Unit coverage lives in `src/mcp/__tests__/mcp-ui.test.ts` (resources, `structuredContent`, text fallback, size/CSP budget) and `src/renderer/mcp-views/__tests__/views.test.tsx` (every view rendered against a fake host, including hostile payloads).

> Rendering inside a real host (Claude Desktop, VS Code) is a manual step - the procedure and the results table live in [`MCP_UI_HOSTS.md`](MCP_UI_HOSTS.md).
