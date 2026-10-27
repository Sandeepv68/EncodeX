# MCP Apps: React views, in-app rendering, full view coverage, host verification, ext-apps 2.x

> **Status:** **EXECUTED (2026-10-27)** — all six phases are implemented: Phase 1 (SDK/ext-apps
> 2.x) in `1ffc7f3b`, Phase 2 (design system + view kit) in `d83fa103`, Phases 3 and 5 (React
> view pipeline, the two missing views) in `c2ba52b0`, Phase 4 (in-app Copilot rendering) in
> `c3531c96`, Phase 6 (host verification) in the commit that added `scripts/mcp-host-check.mjs`
> and `docs/MCP_UI_HOSTS.md`.
>
> Deviations from the plan, and why:
>  - **D7 (one shared bundle)** was implemented as planned, but the bundle is read from disk at
>   runtime (`src/mcp/ui/bundle.ts`) instead of being embedded in a generated TypeScript module:
>   a committed 880 KB string would have been the largest file in the repository, and the
>   resource read is a runtime operation anyway.
>  - **D2 (render in-app as React, not in an iframe)** was implemented as planned. The in-app
>   host (`src/renderer/mcp-views/AppIpcHost.ts`) forwards the view's tool calls to the main
>   process, where `src/main/mcp/local-client.ts` runs them on the same server - and the same
>   job manager - the embedded HTTP server exposes.
>  - **The views keep MUI.** The measured bundle is 880 KB (React 219 KB, MUI 222 KB, the
>   `ext-apps` App class with the MCP client stack and zod 234 KB, the views themselves the
>   rest). The budget was raised to 1 MB and enforced by the build; `preact/compat` remains
>   the escape hatch if a host complains about the size.
>  - **The mutating flows were not duplicated in the transcript.** A plan attaches the
>   inspector view (for an analysis) and the live queue view (for a queue-backed operation);
>   the "Add to queue" button stays the single approval for a mutating operation.
>
> **Scope:** closes the five gaps in the MCP Apps feature (in-app rendering, missing views,
> React view pipeline, real-host verification, ext-apps 2.x migration).
> **Supersedes/extends:** `plans/MCP_APPS_SERVER_PLAN.md` (phases A–F, already shipped),
> `plans/EXT_APPS_2X_MIGRATION_PLAN.md` (folded in as Phase 1),
> `docs/MCP_UI.md` (the feature spec — rewritten in Phase 6).
> **Related:** `docs/MCP.md`, `src/shared/mcp-ui.ts`, `src/mcp/ui/**`.

---

## 1. Goal

Make EncodeX a first-class MCP Apps citizen in **both directions of the surface**:

| # | Gap today | Outcome |
| - | --------- | ------- |
| 2 | EncodeX never renders MCP UI in its **own** chat — the 11 `ui://` views only ever render inside a third-party host (Claude, VS Code, …). | The Copilot transcript renders EncodeX's MCP App views inline, using the **same React components and design tokens as the app UI**. |
| 3 | `ui://encodex/profiles` and `ui://encodex/capabilities` are declared in `src/shared/mcp-ui.ts:57-58` but never served. | Both URIs are served as real MCP App views and wired to the `list_profiles` / `list_capabilities` tools. |
| 4 | Views are hand-written HTML strings ("Pipeline A"). | All views are **React** components authored against the app's design system, bundled as a single self-contained HTML document (one bundle, all views, selected by view id) and reusable by external hosts. |
| 5 | Rendering inside a real host is an unchecked manual line in `plans/MCP_APPS_SERVER_PLAN.md:184`. | A documented, scripted host-verification procedure + a checklist covering Claude Desktop, Claude Code, VS Code, Cursor, ChatGPT, Goose and MCPJam, with recorded results. |
| 6 | `@modelcontextprotocol/sdk@1.x` monolith + `ext-apps@1.7.5`; the 2.x migration is scope-only (`plans/EXT_APPS_2X_MIGRATION_PLAN.md`). | The 2.x split-package stack is adopted, including the `ext-apps` `App` API used by the new React views. |

**Explicitly out of scope** (agreed): connecting EncodeX to *third-party* MCP servers
(i.e. EncodeX as an MCP *client*/host for other people's apps). The in-app rendering
covers EncodeX's own views only. A reusable host for foreign `ui://` apps is a later,
separate project (see §11).

---

## 2. Current state (verified)

### What exists
- **Server side is mature.** `createMcpServer()` (`src/mcp/server.ts:904`) advertises
  `io.modelcontextprotocol/ui` (`src/mcp/server.ts:916-925`), serves 11 `ui://` resources
  via `registerAppResource` (`src/mcp/ui/resources.ts:51`), and gates every mutating tool
  behind the app-only `commit_operation` tool (`src/mcp/ui/approval.ts`, `src/mcp/server.ts:2796`).
- **Transports:** stdio (`src/mcp/run.ts:55`) and loopback Streamable-HTTP
  (`src/mcp/http.ts:370`, embedded variant `src/main/mcp/http-server.ts:65`), with a
  settings toggle/port/token UI (`src/renderer/components/settings/McpSettingsSection.tsx`).
- **Hand-written bridge:** `src/mcp/ui/bridge.ts:43` — a self-contained `postMessage`
  JSON-RPC client (handshake, theme, size reporting, polling, `tools/call`).
- **11 views** in `src/mcp/ui/views/*.ts`, each a hand-written HTML string with inline CSS
  and inline JS, ~8–13 KB each, all under the 100 KB per-resource budget.

### The gaps, precisely
1. **No in-app host.** `src/renderer` contains **zero** `iframe` / `postMessage` / `srcDoc` /
   `ui://` references. The Copilot transcript (`src/renderer/components/copilot/Conversation.tsx`)
   renders only text, plan actions and results — there is no slot for a view, and no MCP
   client exists in the app (`@modelcontextprotocol/sdk/client` is imported **only** by
   tests/e2e/scripts).
2. **Two URIs unserved.** `MCP_UI_VIEW_URIS.profiles` / `.capabilities` exist only as
   identifiers; the registry (`src/mcp/ui/registry.ts:43-110`) has 11 entries.
3. **No React pipeline.** No `vite-plugin-singlefile`, no multi-page build, no generated
   view modules. Views are strings.
4. **Host rendering unverified.** The only checks are server-contract assertions
   (`src/mcp/__tests__/mcp-ui.test.ts`, `e2e/mcp/mcp-apps.spec.ts`); `e2e/mcp/vscode-ui.spec.ts`
   drives real VS Code but is not part of the default CI gate.
5. **Legacy SDK.** `ext-apps@1.7.5` has no `App` browser API of the 2.x shape
   (`connect`, `callServerTool`, `getHostContext`, `autoResize`, `allowUnsafeEval`).

### Constraints that shape the design
- **CSP is empty on purpose.** `MCP_UI_RESOURCE_META` (`src/mcp/ui/resources.ts:31-40`) sets
  `connectDomains/resourceDomains/frameDomains/baseUriDomains` to `[]`. The view document must
  therefore be **fully self-contained** — no external script, style, font or fetch.
- **No external script/style tags.** Asserted by `src/mcp/__tests__/mcp-ui.test.ts:136-175`
  (no `<script src>`, no `<link rel=stylesheet>`, `html.length < 100_000`).
- **XSS posture.** Every untrusted value reaches the DOM via `textContent`
  (`src/mcp/ui/views/queue.ts:12-13`); the hostile-metadata test
  (`src/mcp/__tests__/mcp-ui-bridge.test.ts:289`) pins it. React's default escaping keeps
  this property for free.
- **The app's own CSP blocks inline scripts in a `srcDoc` iframe.**
  `src/shared/csp.ts:28-32` sets `script-src 'self'` with no `frame-src`; a `srcDoc` iframe
  inherits it, so an iframe-hosted view would need a CSP amendment.
- **Lint gate.** `eslint.config.mjs:42-100` applies `encodex/no-hardcoded-px|rem|colors|
  strings|no-inline-styles` to `src/renderer/**` only. `src/mcp/**` is not linted.

---

## 3. Architecture decisions

### D1 — One React source, two build targets

```
src/renderer/mcp-views/            ← single source of truth (React + TSX)
   ├── host.ts                      ← McpViewHost interface (host-agnostic)
   ├── registry.tsx                 ← viewId → React component
   ├── views/queue.tsx job.tsx …    ← one component per view
   ├── kit/                         ← shared primitives built on the app theme
   └── standalone/entry.tsx         ← standalone (external host) entry point
```

- **Target A — in-app:** the normal renderer bundle imports `registry.tsx` and renders a view
  component directly inside the Copilot transcript.
- **Target B — external hosts:** `vite.mcp-ui.config.ts` (new) builds `standalone/entry.tsx`
  into one single-file HTML document with `vite-plugin-singlefile`; a codegen step emits
  `src/mcp/ui/views/generated.ts`, and `registry.ts` keeps serving it per `ui://` URI.

Both targets import the **same** view components, the **same** UI kit and the **same** theme
module, so an external host and EncodeX itself show the same UI.

### D2 — The view is rendered as React in-app, **not** in an iframe

**Decision:** the in-app path renders the React component tree directly in the renderer.

Rationale:
- The requirement is *"the UI should use the same style definitions and components as the app UI"*.
  Only a shared React tree guarantees that; an iframe would need the app's palette duplicated
  and re-synchronised.
- It sidesteps the app CSP problem (`srcDoc` + `script-src 'self'`) and the `frame-src` gap.
- No `postMessage` plumbing, no origin validation, no iframe resize negotiation for the
  in-app case.
- The view's outbound tool calls (`commit_operation`, `cancel_job`) go straight to the main
  process over IPC — fewer moving parts than a JSON-RPC proxy.

**Trade-off accepted:** the in-app views are not sandboxed from the app renderer. That is
acceptable because they are *our own* code, in *our own* process. The sandboxed-iframe path
is retained for **external** hosts (Target B), where the host provides the sandbox.

**Consequence:** the in-app path is *not* an MCP Apps host implementation — it is a native
render of the same view. The MCP Apps **server** contract is unchanged, so external hosts
are unaffected.

### D3 — Move the design system into `src/shared`

- `src/renderer/colors.ts` → `src/shared/theme/colors.ts`
- `src/renderer/theme.ts` → `src/shared/theme/theme.ts` (`createAppTheme`)
- `src/renderer/components/SelectArrowIcon.tsx` → `src/shared/theme/SelectArrowIcon.tsx`
  (the theme imports it; keeping it in `renderer` would invert the dependency)
- `src/renderer/theme.ts` consumers updated (repo-wide import rewrite); a thin
  `src/renderer/theme.ts` re-export is **not** kept — the move is explicit so the shared
  module has no renderer dependency.
- `eslint.config.mjs`: the `no-hardcoded-colors` exemption points at the new path, and the
  custom rules are **extended to `src/shared/**`** so the shared kit is held to the same bar.

### D4 — A small, purpose-built view kit on top of the app theme

`src/renderer/mcp-views/kit/` provides the primitives the 13 views need, implemented with
MUI + emotion and the app tokens:

| Kit component | Replaces (today's hand-written CSS) |
| ------------- | ----------------------------------- |
| `ViewCard` | `.card` |
| `ViewSection` / `ViewSectionTitle` | `h2` uppercase section headings |
| `ViewDefinitionList` | `dl/dt/dd` grids |
| `ViewProgress` | `.bar > span` |
| `ViewBadge` | `.badge`, `.badge.ok`, `.badge.bad` |
| `ViewButton` (primary / cancel / confirm-arming) | `.primary`, `.cancel`, `.cancel[data-confirm=1]` |
| `ViewField` | `label > input` grid |
| `ViewTable` | `table/th/td` |
| `ViewFinding` (severity rail) | `.finding[data-severity]` |
| `ViewEmptyState` | `.empty` |
| `ViewAlert` | `.message` / `.error` |
| `ViewSteps` | `ol.steps` / `ul.rationale` / `ul.notes` |

The two-click "arming" behaviour for destructive actions (`cancel_job`) becomes a
`useArmedAction` hook so it is written once instead of four times
(`queue.ts:157`, `job.ts:164`, `convert.ts:259`, `confirm.ts:296`).

### D5 — Host abstraction: one view API, two hosts

```ts
// src/renderer/mcp-views/host.ts
export interface McpViewHost {
  /** Invoke a tool on the MCP server and return its result. */
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
  /** Current host context (theme + CSS variables + locale). */
  readonly context: McpViewHostContext;
  /** Subscribe to host-pushed tool results (host notifications). */
  subscribe(listener: (result: McpToolResult) => void): () => void;
}
```

- `AppIpcHost` (in-app) — talks to the main process over IPC.
- `AppExtAppsHost` (standalone bundle) — wraps the `ext-apps` 2.x `App` class
  (`connect`, `callServerTool`, `getHostContext`, `autoResize`).
- Views never talk to `postMessage` directly. The legacy `VIEW_BRIDGE_SCRIPT`
  (`src/mcp/ui/bridge.ts`) is retained **only** as a fallback during migration and is deleted
  once the React views are the sole implementation (Phase 3d).

### D6 — Theming: app palette in-app, host variables externally

- **In-app:** the view renders inside the app's `ThemeProvider` → identical to app UI by
  construction, and it follows live theme changes.
- **Standalone:** the view reads the host context (`theme`, `styles.variables`) via
  `ext-apps` `applyHostStyleVariables` / `getDocumentTheme`, and falls back to the EncodeX
  light/dark palette when the host supplies no variables. The existing hand-written views
  already read `--color-background-primary`, `--font-sans`, `--border-radius-md`
  (`src/mcp/ui/views/queue.ts:29-37`) — that channel is kept and formalised.

### D7 — One shared bundle, view selected by id

- The standalone build produces **one** document containing React + the kit + all 13 views.
- `resources/read` for `ui://encodex/<view>` returns that document with a tiny per-view
  bootstrap injected ahead of the bundle:
  `<script>window.__ENCODEX_VIEW__ = "<viewId>"</script>`.
- Consequence: **one** size budget instead of 13; one artefact to cache; the same file can be
  reused by the in-app fallback path and by external hosts.
- Budget: the current `< 100_000` assertion (`src/mcp/__tests__/mcp-ui.test.ts:171`) is
  replaced by a documented ceiling of **512 KB** plus a build-time gate
  (`scripts/check-mcp-ui-size.mjs`) that fails the build if the bundle grows past it.
  Expected size with React 19 + MUI subset + emotion: **≈ 250–400 KB** minified.
  *Escape hatch if that proves too heavy:* swap React for `preact/compat` (≈ 40 KB total)
  — a one-line alias change in the standalone Vite config, recorded as risk **R7**.

### D8 — i18n

- All view strings live in a new **`mcpViews`** namespace in the 56 locale files
  (`src/renderer/i18n/locales/*.json`), so the in-app views are fully localized and the
  `encodex/no-hardcoded-strings` lint rule is satisfied.
- The standalone bundle embeds **only `en-US`** (extracted at build time by the codegen
  step) — shipping 56 locales would multiply the bundle size for no benefit, and hosts
  currently do not pass a locale in `hostContext`.
- `src/renderer/i18n/config.ts` reads `localStorage` at module scope and sets `document.title`;
  the standalone entry creates its **own minimal i18next instance** instead of importing it.

### D9 — The in-app data path

```
Copilot (renderer)
  → IPC  copilotPlan(...)                      (existing)
  → main: plan built (deterministic agent / AI provider)
  → main: MCP enrichment — the plan's read-only operations are executed
          through the local MCP client; each result that carries
          _meta.ui.resourceUri becomes an McpViewAttachment
  → CopilotPlan.views: McpViewAttachment[]
  → renderer: Conversation renders <McpAppView attachment=… />
  → view calls a tool → IPC MCP_UI_CALL_TOOL → local MCP client → server
```

**Local MCP client** (`src/main/mcp/local-client.ts`): an SDK `Client` over an in-memory
linked transport to a server built by `createSessionMcpServer()`
(`src/main/index.ts:383`), so the in-app views observe **the same job manager and the same
queue** as the embedded HTTP server and the app UI. This is the piece that makes the in-app
views live rather than mocked.

---

## 4. Phase plan

Phases are ordered by dependency. Effort is a relative size (S / M / L / XL).

### Phase 1 — SDK 2.x + ext-apps 2.x migration  *(gap 6)*  — L

> Executes `plans/EXT_APPS_2X_MIGRATION_PLAN.md` (which is already scoped line by line).
> Moved to the front because the React views use the `ext-apps` 2.x `App` API.

1. **Decision gate (must be settled before coding):** the 2.x SDK removes the Tasks
   side-channel, so `MCPTaskStore` + `server.experimental.tasks.registerToolTask` for
   `convert_media` / `batch_convert` (`src/mcp/server.ts:2007`, `:2739`) die.
   The plan's recommended **Option A** is: drop the task receipt layer, keep the synchronous
   `jobId` receipt, register both tools as plain `registerTool`. *This needs an explicit
   owner sign-off — it is a small regression for hosts that use `tasks/*`.*
2. Dependency swap (`package.json`):
   remove `@modelcontextprotocol/sdk`; add `@modelcontextprotocol/server@^2.3.1`,
   `@modelcontextprotocol/node@^2.1.1`, `@modelcontextprotocol/ext-apps@^2.0.3`;
   dev-only `@modelcontextprotocol/client@^2.3.1`, `@modelcontextprotocol/core@^2.3.1`.
3. Run the official codemod (`npx @modelcontextprotocol/codemod@latest v1-to-v2 .`), then
   reconcile by file per the plan's §4.1–§4.4 tables.
4. Transport swaps: `StreamableHTTPServerTransport` → `NodeStreamableHTTPServerTransport`
   (`src/mcp/http.ts:36`, `src/main/mcp/http-server.ts:30`),
   `StdioServerTransport` ← `@modelcontextprotocol/server/stdio` (`src/mcp/run.ts:20`).
   Add `localhostHostValidation()` as DNS-rebinding defence-in-depth.
5. `tsconfig.main.json`: drop the `@modelcontextprotocol/sdk/*` path entries, keep the
   `ext-apps` ones.
6. Rewire tests/scripts/e2e (`src/mcp/__tests__/**`, `src/main/mcp/__tests__/**`,
   `scripts/mcp-smoke.mjs`, `scripts/mcp-full-test.mjs`, `e2e/mcp/client.ts`).
7. Update `scripts/audit-gate.mjs` allow-list, `docs/MCP.md`, `docs/MCP_UI.md`.

**Acceptance:** `npm run typecheck`, `npm test`, `npm run lint` green; `mcp-smoke.mjs`
still reports 37 tools; a pinned `sdk@1.x` client can still `initialize` and call a tool
against the migrated server (era negotiation, plan §8.1).

---

### Phase 2 — Design system relocation + view kit  *(enabler for gap 4)*  — M

1. Move theme files per **D3**; repo-wide import rewrite; update `eslint.config.mjs`
   exemptions and extend the custom rules to `src/shared/**`.
2. Create `src/renderer/mcp-views/kit/` per **D4** with the primitives listed there.
   Each kit component gets a co-located `styles/*.styles.ts` following the house convention
   (`src/renderer/styles/X.styles.ts`).
3. Add the `mcpViews` i18n namespace to all 56 locale files; wire the new keys through
   `scripts/sync-locale-keys.mjs` / `validate-locales.mjs`.

**Acceptance:** app builds and looks unchanged; the kit renders in a scratch route;
`npm run validate:locales` passes; lint passes with the shared rules now covering
`src/shared/**`.

---

### Phase 3 — React view pipeline  *(gap 4)*  — XL

**3a — Build plumbing**
- `npm i -D vite-plugin-singlefile`
- `vite.mcp-ui.config.ts`: `root: 'src/renderer/mcp-views/standalone'`,
  `base: './'`, `build.assetsInlineLimit: 100000000`, `cssCodeSplit: false`,
  `output.inlineDynamicImports: true`, `viteSingleFile()`.
- `src/renderer/mcp-views/standalone/entry.tsx`: mounts the selected view
  (`window.__ENCODEX_VIEW__`), wires the `ext-apps` `App` to an `AppExtAppsHost`, applies
  host theme variables, and reports size changes.
- `scripts/generate-mcp-ui-views.mjs`: reads `dist/mcp-ui/views.html`, extracts the
  `en-US` `mcpViews` slice, and emits `src/mcp/ui/views/generated.ts` exporting
  `MCP_UI_VIEW_BUNDLE_HTML` and `buildViewHtml(viewId)`.
  Escaping: emit via `JSON.stringify` (not template literals) so backticks/`${` in the
  bundle are safe — the current hand-written bridge avoided backticks for exactly this
  reason (`src/mcp/ui/bridge.ts:40-41`).
- `npm run build:mcp-ui` wired into `npm run build` **before** `build:main`
  (the MCP server imports the generated module).

**3b — Host adapter + registry**
- `src/renderer/mcp-views/host.ts` (**D5**), `registry.tsx` (view id → component),
  `AppExtAppsHost` (standalone), `AppIpcHost` (in-app, Phase 4).

**3c — Port the views**
Port all 11 existing views to React, in this order (pilot first, to shake out the kit):
`queue` → `job` → `confirm` → `convert` → `batch` → `media-info` → `inspector` → `plan` →
`lab` → `error` → `workflow`.

Per view, port the current behaviour exactly:
- payload shape and the "unwrap" heuristics (`plan.ts:257-265`, `workflow.ts:225-233`,
  `lab.ts:211`, `error.ts:191`, `job.ts:191`);
- polling config (`tool`, `arguments`, `intervalMs`, `autostart`) — moved from inline JS into
  the component, e.g. `<QueueView poll={{ tool: 'list_jobs', intervalMs: 2500 }} />`;
- the self-bootstrapping argument learning (`job.ts:222-225`, `convert.ts:240-244`);
- the two-click arming on destructive calls (now `useArmedAction`);
- every `formatSize` / `formatDuration` / `basename` helper — these are currently duplicated
  4–7 times per file and become one `src/renderer/mcp-views/format.ts`;
- empty states and error states.

**3d — Retire the hand-written path**
- `src/mcp/ui/views/*.ts` deleted; `src/mcp/ui/registry.ts` switches to
  `buildViewHtml(view.id)` from the generated module.
- `src/mcp/ui/bridge.ts` (`VIEW_BRIDGE_SCRIPT`) deleted once no view depends on it.
- `src/mcp/ui/resources.ts` keeps `registerAppResource` but reads from the generated bundle.

**Acceptance:** for every `ui://` URI, `resources/read` returns the shared React document
with the correct view bootstrap; each view renders the same content it renders today
(parity matrix below); the smoke script and `e2e/mcp/mcp-apps.spec.ts` pass; the size gate
passes.

**Parity matrix (per view, checked by hand once, then pinned by a snapshot test):**

| View | Before | After |
| ----- | ------ | ----- |
| queue | job rows, status, progress, armed cancel | identical content, kit styling |
| job | job card, progress, paths, error, armed cancel | identical |
| confirm | proposal card, details, warnings, Run → progress card | identical |
| convert | pre-filled form, Start → job tracker | identical |
| batch | confirmation → per-file dashboard | identical |
| media-info | facts + stream table | identical |
| inspector | facts, severity findings, next steps | identical |
| plan | plan card + estimate card | identical |
| lab | summary, best fit, attempts table, candidate ladder | identical |
| error | code, explanation, causes, fixes with Retry/Apply | identical |
| workflow | plan card (valid/invalid) + run card | identical |

---

### Phase 4 — Render MCP UI inside the Copilot transcript  *(gap 2)*  — L

**4a — Local MCP client (main)**
- `src/main/mcp/local-client.ts`: SDK `Client` over an in-memory linked transport to
  `createSessionMcpServer()` (`src/main/index.ts:383`), exposing
  `listTools()`, `callTool(name, args)`, `readResource(uri)`.
  Shares the `MCPJobManager` (`src/main/index.ts:372`) so `list_jobs`/`get_job` show the
  real queue.

**4b — IPC surface**
- `src/shared/ipc-channels.ts`: `MCP_UI_CALL_TOOL`, `MCP_UI_READ_RESOURCE`,
  `MCP_UI_LIST_VIEWS`.
- `src/main/mcp/ui-ipc.ts`: handlers; `src/preload/index.ts`: exposure;
  `src/renderer/electron-api.d.ts`: typings.

**4c — Enrich the Copilot plan**
- `src/shared/mcp-ui.ts`: add
  ```ts
  export interface McpViewAttachment {
    viewId: McpUiViewId;
    uri: string;
    toolName: string;
    structuredContent: unknown;
  }
  ```
- `src/shared/copilot.ts`: `CopilotPlan.views?: McpViewAttachment[]`.
- Main's copilot planner (`src/main/…/copilot plan` path) executes the read-only MCP tools
  for the plan's operations (`analyze_media` → `inspector`, `get_media_info` → `media-info`,
  `list_profiles` → `profiles`, `list_capabilities` → `capabilities`) and attaches the
  attachments.
- Mutating operations (`convert`, `remux`, `cut`, …) attach the **confirmation** view
  (`ui://encodex/confirm`, `ui://encodex/convert`) instead of running immediately, matching
  the MCP Apps approval semantics — the user still clicks to commit.

**4d — Render**
- `src/renderer/components/copilot/McpAppView.tsx`: resolves `viewId` through
  `src/renderer/mcp-views/registry.tsx`, mounts it with an `AppIpcHost`, and provides the
  attachment's `structuredContent` as the initial payload.
- `src/renderer/components/copilot/AssistantMessage.tsx`: render `plan.views` below the
  existing plan body.
- `src/renderer/components/copilot/Conversation.tsx`: extend `ConversationMessage` with
  `views?: McpViewAttachment[]`; the virtualizer's `ASSISTANT_ROW_ESTIMATE` (280 px,
  `Conversation.tsx:48`) needs a size that accounts for embedded views — the rows are measured
  (`measureElement`), so a rough estimate is acceptable, but the estimate should grow for
  view-bearing rows.
- `src/renderer/styles/copilot/McpAppView.styles.ts`: the card that hosts the view.

**Acceptance:** asking the Copilot to analyse a media file renders the **inspector** view
inline in the transcript, styled like the app; clicking **Cancel** in the **queue** view
cancels the real job; a mutating action shows the confirmation card and only runs after
the click. Unit tests for the IPC layer, RTL tests for `McpAppView`, and an e2e that drives
the Copilot page (`e2e/specs/`) asserting the view landmark renders.

---

### Phase 5 — Serve the missing views  *(gap 3)*  — S

1. **`ui://encodex/profiles`** — a browsable list of the built-in profiles
   (`BUILTIN_PROFILES`, `src/shared/profiles/builtin.ts`): name, id, category, container,
   video/audio codec, preset; filter by category; copy-friendly id.
   Data source: the existing `list_profiles` tool (`src/mcp/server.ts:2662-2671`) and its
   `structuredContent { profiles }`.
   Wire `_meta.ui.resourceUri = ui://encodex/profiles` on `list_profiles`.
2. **`ui://encodex/capabilities`** — encoders and hardware-acceleration methods available
   on the machine, from `getEncoderCapabilities()` (`src/mcp/server.ts`, `list_capabilities`).
   Wire `_meta.ui.resourceUri = ui://encodex/capabilities` on `list_capabilities`.
3. Add both to `MCP_UI_VIEW_URIS` consumers, the registry (now 13 views) and the
   `resources/list` count assertions in `src/mcp/__tests__/mcp-ui.test.ts` and
   `e2e/mcp/mcp-apps.spec.ts`.
4. Types for the two payloads move to `src/shared/mcp-ui.ts` so the React components are
   type-safe.

**Acceptance:** both URIs are listed and readable, the two tools carry the resource URI,
and the views render in a real host (Phase 6).

---

### Phase 6 — Real-host verification + documentation  *(gap 5)*  — M

1. **`docs/MCP_UI_HOSTS.md`** — a per-host verification procedure:
   - the exact client config for each host (Claude Desktop, Claude Code, VS Code, Cursor,
     ChatGPT, Goose, MCPJam) — reusing `site/.vitepress/theme/components/McpConfig.vue`
     as the source of truth;
   - what to look for per view (the landmarks listed in §7);
   - how to verify the approval gate (the model must **not** execute a mutating tool;
     the view must show the confirmation card);
   - a results table (host, version, OS, date, outcome, notes).
2. **`scripts/mcp-host-check.mjs`** — automates what *can* be automated:
   launches the server over stdio, asserts the extension capability, lists every `ui://`
   resource, reads each one, and checks: correct MIME, no external `<script src>`/
   `<link rel=stylesheet>`, the view bootstrap is present, the document parses, and — via
   jsdom — the expected landmark text for that view appears. This turns the current
   server-contract tests into a *rendering* check.
3. **Real-host automation** where possible:
   - extend `e2e/mcp/vscode-ui.spec.ts` (real VS Code, `MCP: List Servers` + an app panel)
     to assert the React view mounts and the tool round-trip works;
   - Claude Desktop / Claude Code / ChatGPT / Goose remain **manual** — record the results
     in `docs/MCP_UI_HOSTS.md`.
4. **CI wiring:** `mcp-host-check` runs in the normal gate; the real-host spec stays a
   `manual` job (matching the existing `(manual)` convention in
   `plans/MCP_APPS_SERVER_PLAN.md:184`).
5. **Docs rewrite:** `docs/MCP_UI.md` (pipeline, sizes, the new views, the in-app host),
   `docs/MCP.md` (tool catalogue, SDK 2.x), `wiki/MCP.md`, `site/docs/mcp*.md`.

---

## 5. File inventory

### New
| Path | Purpose | Phase |
| ---- | ------- | ----- |
| `src/renderer/mcp-views/host.ts` | `McpViewHost` interface + shared types | 3b |
| `src/renderer/mcp-views/registry.tsx` | view id → React component | 3b |
| `src/renderer/mcp-views/kit/**` | the view component kit | 2 |
| `src/renderer/mcp-views/views/*.tsx` | the 13 React views | 3c, 5 |
| `src/renderer/mcp-views/standalone/entry.tsx` | external-host entry | 3a |
| `src/renderer/mcp-views/format.ts` | shared formatters (`formatSize`, `basename`, …) | 3c |
| `src/renderer/components/copilot/McpAppView.tsx` | inline view renderer | 4d |
| `src/main/mcp/local-client.ts` | in-process MCP client | 4a |
| `src/main/mcp/ui-ipc.ts` | IPC handlers for view tool calls | 4b |
| `vite.mcp-ui.config.ts` | standalone single-file build | 3a |
| `scripts/generate-mcp-ui-views.mjs` | bundle → generated TS module | 3a |
| `scripts/check-mcp-ui-size.mjs` | size gate | 3a |
| `scripts/mcp-host-check.mjs` | host-contract + rendering check | 6 |
| `docs/MCP_UI_HOSTS.md` | real-host procedure and results | 6 |

### Modified
| Path | Change | Phase |
| ---- | ------ | ----- |
| `src/shared/theme/{colors,theme,SelectArrowIcon}.ts(x)` | moved out of `src/renderer` | 2 |
| `src/renderer/**` (theme consumers) | import rewrite | 2 |
| `eslint.config.mjs` | new exemption path; extend rules to `src/shared/**` | 2 |
| `src/renderer/i18n/locales/*.json` | new `mcpViews` namespace | 2 |
| `src/shared/mcp-ui.ts` | add `McpViewAttachment`, profiles/capabilities payload types | 4, 5 |
| `src/shared/copilot.ts` | `CopilotPlan.views` | 4 |
| `src/shared/ipc-channels.ts` | 3 new channels | 4 |
| `src/preload/index.ts`, `src/renderer/electron-api.d.ts` | IPC exposure + typings | 4 |
| `src/main/index.ts` | local MCP client wiring | 4 |
| `src/main/mcp/http-server.ts`, `src/mcp/http.ts`, `src/mcp/run.ts` | SDK 2.x transports | 1 |
| `src/mcp/server.ts` | SDK 2.x imports; task layer removal (Option A); new view URIs on `list_profiles` / `list_capabilities` | 1, 5 |
| `src/mcp/ui/registry.ts` | serve the generated bundle; 13 views | 3, 5 |
| `src/mcp/ui/resources.ts` | read from the generated bundle | 3 |
| `src/mcp/ui/bridge.ts` | **deleted** | 3d |
| `src/mcp/ui/views/*.ts` | **deleted** (replaced by generated + React source) | 3d |
| `src/renderer/components/copilot/{Conversation,AssistantMessage}.tsx` | render `plan.views` | 4 |
| `src/renderer/components/copilot/**` tests | new coverage | 4 |
| `package.json` | deps swap, `build:mcp-ui`, `mcp:host-check` scripts | 1, 3, 6 |
| `tsconfig.main.json` | SDK 2.x path entries | 1 |
| `src/mcp/__tests__/mcp-ui.test.ts` | budget + React-bundle assertions | 3, 5 |
| `src/mcp/__tests__/mcp-ui-bridge.test.ts` | rewritten against the React views | 3 |
| `e2e/mcp/mcp-apps.spec.ts`, `e2e/mcp/vscode-ui.spec.ts` | 13 views + React render | 5, 6 |

### Deleted
- `src/mcp/ui/bridge.ts`, `src/mcp/ui/views/{queue,job,media-info,convert,confirm,inspector,plan,lab,error,batch,workflow}.ts`
- (Phase 1, Option A) `src/mcp/jobs/task-store.ts` and the task registration blocks.

---

## 6. Testing strategy

| Layer | Tool | What it covers |
| ----- | ---- | -------------- |
| View units | Vitest + RTL (`src/renderer/mcp-views/__tests__/`) | each view renders the right content for a fixture payload; arming behaviour; error/empty states; hostile payloads stay inert text |
| Kit units | Vitest + RTL | kit primitives, theme integration, dark mode |
| Host adapter | Vitest | `AppIpcHost` / `AppExtAppsHost` against a fake transport; tool-call plumbing; polling lifecycle |
| MCP contract | `src/mcp/__tests__/mcp-ui.test.ts` | extension capability, MIME, 13 URIs listed/read, `_meta.ui.resourceUri` on the UI tools, no external script/style, size ceiling |
| Rendering contract | `scripts/mcp-host-check.mjs` (jsdom) | each `ui://` document actually renders its view's landmarks |
| In-app | Vitest (renderer) + e2e (`e2e/specs/`) | Copilot transcript renders the view; the view's tool call reaches the server; approval gate honoured in-app |
| External host | `e2e/mcp/vscode-ui.spec.ts` (real VS Code) + manual checklist | real third-party host renders the React bundle |
| Regression | existing suites | `npm test`, `npm run lint`, `npm run typecheck`, `npm run mcp:smoke` (37 tools), `npm run mcp:full-test` |

**Note on `src/test-setup.ts`:** it globally mocks `react-i18next`
(`src/test-setup.ts:58-140`). The view tests need the real hook (or a view-local i18n
instance) — `vi.unmock('react-i18next')` in the view test suites, as
`src/test-utils/page-render.tsx:23-27` already documents.

---

## 7. Landmarks for manual host verification

Each view exposes a stable `data-testid` / landmark so a human (or the jsdom check) can
confirm the right view rendered:

| View | Landmark |
| ---- | -------- |
| queue | `EncodeX queue` + job rows |
| job | job title + `Cancel` button |
| media-info | stream table header row |
| convert | `New conversion` form with `Start conversion` |
| confirm | `Confirm operation` + `Run` |
| inspector | `Findings` list |
| plan | `Conversion plan` / `Size estimate` |
| lab | `Compression lab` + attempts table |
| error | error code chip |
| batch | `Confirm batch` / `Batch` dashboard |
| workflow | `Workflow plan` / `Workflow run` |
| profiles | profile list |
| capabilities | encoder/hardware list |

---

## 8. Risks

| # | Risk | Impact | Mitigation |
| - | ---- | ------ | ---------- |
| R1 | **SDK 2.x era negotiation** — a 2.x server must still answer a 1.x host's `initialize` (`EXT_APPS_2X_MIGRATION_PLAN.md:196`) | high, silent | verify with a pinned 1.x client before shipping; keep the migration behind its own commit |
| R2 | **Tasks layer removal** (Option A) regresses hosts that call `tasks/*` | medium | explicit sign-off at the Phase 1 gate; the synchronous `jobId` receipt is unchanged |
| R3 | **Bundle size** — React 19 + MUI ≈ 250–400 KB per resource read over stdio | medium | shared bundle (D7), 512 KB gate, `preact/compat` escape hatch, gzip at the transport layer where possible |
| R4 | **Host CSP** — a host that forbids inline styles/emotion runtime injection breaks the views | high for external hosts | verify in Phase 6 across hosts early; keep the `style` fallback path (pre-rendered CSS) available |
| R5 | **Theme relocation churn** — `colors.ts`/`theme.ts` are imported widely | medium | mechanical rewrite + a dedicated commit; no behaviour change |
| R6 | **View parity drift** — 11 React rewrites will not match the old HTML pixel for pixel | medium | parity matrix in §3c, snapshot tests, side-by-side manual review |
| R7 | **React→Preact swap** may be needed for size | low | alias-only change, isolated to the standalone Vite config |
| R8 | **In-app views are not sandboxed** | low (accepted) | they are first-party code in the app process; D2 records the decision |
| R9 | **i18n payload growth** — `mcpViews` namespace × 56 locales | low | codegen/sync tooling handles it; the standalone bundle ships `en-US` only |
| R10 | **Virtualizer sizing** — inline views change assistant-row heights | low | rows are measured; adjust the estimate for view-bearing rows |

---

## 9. Sequencing summary

```
Phase 1  SDK/ext-apps 2.x        (gap 6)      ── prerequisite for the App API
   │
Phase 2  theme relocation + kit   (enabler)    ── prerequisite for the views
   │
Phase 3  React view pipeline      (gap 4)  ┐
Phase 5  profiles + capabilities  (gap 3)  ├─ new React views, same pipeline
Phase 6  host verification        (gap 5)  ┘   (Phase 6 partly parallel with 3c/5)
   │
Phase 4  in-app Copilot rendering (gap 2)      ── needs 3b host adapter + local client
```

Phases 1–3 and 5 are server/pipeline work and can be merged independently of the UI work.
Phase 4 is the only phase that touches the renderer chat, so it can land last and behind a
feature flag (`copilot.mcpViews`, default off) if the team wants a staged rollout.

---

## 10. Effort estimate

| Phase | Relative | Notes |
| ----- | -------- | ----- |
| 1 — SDK 2.x | L | well-scoped already; the risk is negotiation, not volume |
| 2 — theme + kit | M | mostly mechanical, plus the kit itself |
| 3 — React pipeline | XL | 11 views × ~2 h + build plumbing; the bulk of the work |
| 4 — in-app rendering | L | local client + IPC + Copilot wiring + tests |
| 5 — missing views | S | data already exists |
| 6 — host verification | M | mostly documentation and scripting |

---

## 11. Deliberately deferred

- **EncodeX as an MCP client/host for third-party servers** (the other half of "MCP Apps"):
  connecting to external servers, calling their tools and rendering their `ui://` views.
  This needs a real iframe-based host (CSP `frame-src` + nonce for `srcDoc`), an MCP client
  in the app, per-server configuration UI, and origin validation on the `postMessage`
  channel. It is a separate project — see `docs/MCP_UI.md` and §3 D2.
- **React views localized beyond `en-US` for external hosts** (hosts send no locale today).
- **The `ext-apps` `App` API's `requestDisplayMode` / task-driven updates** (the views keep
  polling until then).
- **Streaming tool results** in the views.

---

## 12. Open questions for the owner

1. **Phase 1 gate:** confirm **Option A** (drop the MCP Tasks receipt layer) or pick
   Option B/C from `plans/EXT_APPS_2X_MIGRATION_PLAN.md:81-83`.
2. **Size budget:** accept 512 KB per resource read, or mandate the `preact/compat` swap?
3. **Standalone bundle per host:** one shared document for all views (D7, chosen) — confirm
   that a single bootstrap-injected document per `ui://` read is acceptable to the target
   hosts (Claude, VS Code) rather than one document per view.
4. **In-app feature flag:** ship Phase 4 behind a flag or straight on?
5. **Host verification coverage:** which hosts must pass before release (Claude Desktop,
   VS Code, Cursor, ChatGPT, Goose, MCPJam)?
