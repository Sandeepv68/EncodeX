# D5 — ext-apps / SDK 2.x migration plan (scoped)

> **Status:** **EXECUTED (2026-10-27)** — Option A chosen (drop the Tasks receipt layer), as
> described in `plans/MCP_APPS_REACT_IN_APP_PLAN.md` Phase 1. The 2.x split packages are in
> `package.json`, the tasks layer (`src/mcp/jobs/task-store.ts` and its test) is deleted,
> `convert_media` / `batch_convert` are plain `registerAppTool` registrations, and the
> transports are `NodeStreamableHTTPServerTransport` / `@modelcontextprotocol/server/stdio`.
> Verification: `npm run typecheck`, `npm test` (306 files / 4604 tests), `npm run lint`,
> `npm run mcp:smoke` (37 tools + 11 views), `npm run mcp:full-test` (73 checks) — all green.
> The legacy-host (1.x client) negotiation check in §10 still needs a manual run.
> **Source:** `plans/AI_ASSISTANT_MCP_ENHANCEMENT_PLAN.md` decision **D5** (line 563): *"requires
> `@modelcontextprotocol/{server,client,core}@2`; revisit after R3."*
> **Upstream truth verified against** npm registry (latest published) and tarballs extracted to
> `C:\Users\sande\AppData\Local\Temp\opencode\mcp2\` for offline inspection (core/server/client 2.3.1,
> ext-apps 2.0.3, node 2.1.1). Migration guide read in full and saved at
> `C:\Users\sande\.local\share\opencode\tool-output\tool_12a83b855001GdCYiEfWVudYYt`.

## 1. What this is

Replace the monolithic `@modelcontextprotocol/sdk@1.x` with the 2.x split packages and `ext-apps@2`:

- **Remove:** `@modelcontextprotocol/sdk@^1.30.0` (installed 1.32.1)
- **Change:** `@modelcontextprotocol/ext-apps@^1.7.5` → `@^2.0.3` (installed 1.7.5)
- **Add:** `@modelcontextprotocol/server@^2.3.1`, `@modelcontextprotocol/client@^2.3.1`,
  `@modelcontextprotocol/core@^2.3.1` (matching peer floor), `@modelcontextprotocol/node@^2.1.1`
- **Keep:** `zod@^4.6.5` — satisfies ext-apps@2 `zod ^4.2.0` / `zod/v4` peer; SDK bundles its validator.

This is a **SDK-major migration**: big surface, multiple silent-behavior changes, and one
product-level regression (the R0.5 Tasks receipt layer, §5), which is exactly why D5 was deferred.

## 2. Verified upstream facts (from tarballs, not guesses)

- **Module format & resolution:** every new package is `"type": "module"` with dual builds
  (`dist/*.mjs` + `dist/*.cjs`) behind an `exports` map, plus top-level `types` **and `typesVersions`**
  (requires TypeScript ≥5 for classic `moduleResolution:"node"` consumers). CJS still resolves, so the
  emit form of `tsc` output is unaffected. **engines: `node >=20`** (Electron 43 ships Node 24 — OK; the
  dev shell must run Node ≥20).
- **`@modelcontextprotocol/server`** root export carries: `McpServer`, `Server`, `ProtocolError`
  (was `McpError`), `ProtocolErrorCode` (was `ErrorCode`), `SdkError`/`SdkErrorCode`, `SdkHttpError`,
  `VERSION`, `LATEST_PROTOCOL_VERSION`, `SUPPORTED_PROTOCOL_VERSIONS`, `InMemoryTransport`,
  `PerRequestHTTPServerTransport`, `WebStandardStreamableHTTPServerTransport`, `UriTemplate`, the
  `Transport` interface. Subpath `./stdio` → `StdioServerTransport`. `./validators/{ajv,cf-worker}`,
  `./_shims` for runtime feature shims.
- **`@modelcontextprotocol/client`** root export: `Client`, `StreamableHTTPClientTransport`,
  `InMemoryTransport`, `Transport`, auth types (`AuthOptions`, `UnauthorizedError`, …). Subpath `./stdio`
  → `StdioClientTransport`.
- **`@modelcontextprotocol/core`** root export: every zod `*Schema` constant (`CallToolResultSchema`,
  …) and core protocol types. Subpath `./internal`.
- **`@modelcontextprotocol/node`** root export: `NodeStreamableHTTPServerTransport` (thin Node-adapter
  over `WebStandardStreamableHTTPServerTransport` via `@hono/node-server`), `toNodeHandler`,
  `hostHeaderValidation` / `localhostHostValidation`, `originValidation`. `handleRequest(req, res,
  parsedBody?)` keeps the exact v1 signature.
- **Dead subpaths** (do not exist in 2.x): `server/mcp.js`, `server/streamableHttp.js`, `server/stdio.js`,
  `server/index.js`, `client/index.js`, `client/stdio.js`, `client/streamableHttp.js`, `inMemory.js`,
  `types.js`, `shared/transport.js`, `shared/uriTemplate.js`, `experimental/tasks`.
- `McpServer` constructor shape unchanged: `new McpServer(info, options?);` `McpServerOptions =
  ServerOptions & { maxToolInputElements?: number }`. `registerTool(name, config, cb)` accepts zod-v4 /
  StandardSchema input (raw `z.object` shapes still supported through a deprecated fallback overload).
- Streamable-HTTP transport **options are unchanged** (`sessionIdGenerator`, `onsessioninitialized`,
  `onsessionclosed`, `enableJsonResponse`, `eventStore`, `retryInterval`) — only the class name + import
  changed (`NodeStreamableHTTPServerTransport`).
- **Error model:** `McpError` → `ProtocolError` (with `ProtocolErrorCode`); `ErrorCode` values moved.
  New `SdkError`/`SdkErrorCode` and `SdkHttpError`. Preferred guards: `ProtocolError.isInstance(err)` etc.
- **Version negotiation:** client 2.x probes and negotiates per-era; a 2.x *server* must still answer a
  `2025-11-25` initialize correctly for existing 1.x hosts (verify in §10). EncodeX's manual
  `mcp-protocol-version` header rewrite in the loopback server (`src/main/mcp/http-server.ts:122-138`)
  predates the SDK's built-in negotiation and can be left as-is (harmless) or simplified.

## 3. Product regression to decide first: the R0.5 Tasks receipt layer (§D4)

**In v2 the entire Tasks side-channel is removed — no mechanical migration (upstream's own words):
"remove usages."** Gone: `server.experimental.tasks.registerToolTask`, `TaskStore`, `InMemoryTaskStore`,
`CreateTaskOptions`, `CreateTaskRequestHandlerExtra`, `CreateTaskResult` extra flows,
`*.experimental.tasks.*` client accessors, `callToolStream`/`getTask`/`getTaskResult`/`listTasks`, the
`new McpServer(info, { taskStore, taskMessageQueue })` options. The task *wire* types survive only as
`@deprecated` vocabulary for 2025-11-25 interop.

Consequence for D4 ("both — tasks for capable clients, `get_job` fallback"): the **`tasks/get` /
`tasks/result` / `tasks/cancel` / `tasks/list` client surface dies** on migration. The synchronous
`jobId` receipt returned by `convert_media`/`batch_convert` is unaffected (they keep working as plain
tools; `get_job`/`list_jobs`/`cancel_job` fallback unchanged). Real regression is limited to hosts that
call the tools as task requests.

**Decision gate (run before implementation):**

| Option | Cost | Notes |
| --- | --- | --- |
| **A. Migrate, drop the receipt layer (recommended)** | S | Convert `convert_media`/`batch_convert` to `registerAppTool`-style plain tools (same `z.object` schema, same result payload). Delete `MCPTaskStore`, the ttl machinery, the task-registration blocks and the client-side task tests. Update D4 wording. `mcp-smoke.mjs` tool count stays 37. |
| B. Reimplement `tasks/*` as first-class protocol methods on the low-level `Server` | XL | v1's header-triggered per-call task mode has no v2 equivalent; would require designing the lossless-vs-standalone paths ourselves against the deprecated wire schema. Do not fold into D5. |
| C. Keep `sdk@1.x` forever / vendoring | — | Defer tech debt; every future SDK feature (auth hardening, 2026-era serving) is out of reach. |

> Recommendation: **A**, gated on whoever owns D4 accepting the small task-capable-host regression.
> Fold "native tasks, if ever" into a *new* decision — do not let it block D5.

## 4. Runtime source → new imports (order-of-operations checklists)

Pre-step for each diff: run the official codemod first, then reconcile per-file:

```
npx @modelcontextprotocol/codemod@latest v1-to-v2 .
grep -rn '@mcp-codemod-error' .        # every marker = hand-edit required (non-goal: resolve all)
```

### Addendum 4.0 — `package.json`

- Remove `@modelcontextprotocol/sdk`.
- `dependencies` additions: `@modelcontextprotocol/server@^2.3.1`, `@modelcontextprotocol/node@^2.1.1`,
  `@modelcontextprotocol/ext-apps@^2.0.3`. `@modelcontextprotocol/node` drags `hono` +
  `@hono/node-server` (must land in packaged node_modules for Electron).
- `devDependencies` additions: `@modelcontextprotocol/client@^2.3.1`,
  `@modelcontextprotocol/core@^2.3.1` (tests/scripts only).
- Verify `engines.node >= 20`; confirm Electron/Node ≥20 runtime.

### Addendum 4.1 — core server factory (`src/mcp/server.ts`)

| Line | Old | New |
| --- | --- | --- |
| 20 | `McpServer` ← `@modelcontextprotocol/sdk/server/mcp.js` | `McpServer` ← `@modelcontextprotocol/server` |
| 21 | type `CallToolResult` ← `@modelcontextprotocol/sdk/types.js` | ← `@modelcontextprotocol/server` |
| 22 | `CreateTaskRequestHandlerExtra`, `CreateTaskResult` ← `sdk/experimental/tasks` | **delete** (Option A) |
| 96 | `registerAppTool` ← `@modelcontextprotocol/ext-apps/server` | unchanged package (v2 API identical for our usage) |
| 883 | comment re `registerToolTask` | **delete** |
| 916, 934 | `new MCPTaskStore(...)`, `taskStore` option | **delete** |
| 2007-2038 | `taskFromResult` / `convertCreateTask` / `batchCreateTask` | **delete** |
| 2050-2072 | `server.experimental.tasks.registerToolTask('convert_media', …)` | replace with `server.registerTool` (same `title`/`description`/`inputSchema`/`_meta`, handler = body of `convertCreateTask` minus task wrapper → `runConvert(...)` result) |
| 2784-2802 | second `registerToolTask` block (`batch_convert`) | same replacement |

- Check every other `ErrorCode.UNKNOWN`-style `createError(...)` call — EncodeX's `ErrorCode` is its own
  `src/shared/errors`, **not** the SDK's, so no rename ripples through the ~90 `createError` sites.
- `z.object` inputs + `.describe()` already satisfy zod-v4/StandardSchema; the deprecated raw-shape
  overload covers anything odd. No change expected.

### Addendum 4.2 — HTTP + stdio transports

| File | Line | Old → New |
| --- | --- | --- |
| `src/mcp/http.ts` | 36 | `StreamableHTTPServerTransport` ← `sdk/server/streamableHttp.js` → `NodeStreamableHTTPServerTransport` ← `@modelcontextprotocol/node`. Constructor options + `handleRequest(req, res, parsedBody)` signature unchanged — verified in `node@2.1.1` d.ts. |
| `src/mcp/http.ts` | 44 | type `McpServer` ← `@modelcontextprotocol/server` |
| `src/main/mcp/http-server.ts` | 30 | same transport swap |
| `src/main/mcp/http-server.ts` | 31 | type `McpServer` ← `@modelcontextprotocol/server` |
| `src/main/mcp/http-server.ts` | 32 | `SUPPORTED_PROTOCOL_VERSIONS`, `LATEST_PROTOCOL_VERSION` ← `@modelcontextprotocol/server` (both still exported there; verify they match what the v2 protocol layer actually serves) |
| `src/mcp/run.ts` | 20 | `StdioServerTransport` ← `@modelcontextprotocol/server/stdio` (2-arg `(stdin, stdout, { maxBufferSize })` call sites — EncodeX passes raw fd streams as v1; still valid, add `maxBufferSize` guard if desired) |

Optional but now effortless with `@modelcontextprotocol/node`: add `localhostHostValidation()` to both
listeners as DNS-rebinding defense-in-depth.

### Addendum 4.3 — task store (`src/mcp/jobs/task-store.ts`)

Option A deletes the file: `:19` (`CallToolResult`/`Request`/`RequestId`/`Result` types) and `:20`
(`CreateTaskOptions`/`TaskStore`) both die with it. If option B/C chosen, this is where the re-architecture
lives — keep out of D5.

### Addendum 4.4 — types-only consumers

| File | Line | Old → New |
| --- | --- | --- |
| `src/mcp/ui/approval.ts` | 12 | type `McpServer` → `@modelcontextprotocol/server` |
| `src/mcp/ui/resources.ts` | 15 | type `McpServer` → `@modelcontextprotocol/server` (`registerAppResource` :16 unchanged) |
| `src/main/index.ts` | 47 | type `McpServer` → `@modelcontextprotocol/server` |
| `src/main/mcp/gui-tools.ts` | 15 | `McpServer` → `@modelcontextprotocol/server` |

## 5. Test + script surface (dev-only deps)

| File | Old imports | New |
| --- | --- | --- |
| `src/mcp/__tests__/server.test.ts` | Client ← client/index.js; InMemoryTransport ← inMemory.js; `CallToolResultSchema` ← types.js; **:642-660 client tasks API** | Client/InMemory ← `@modelcontextprotocol/client`; schema ← `@modelcontextprotocol/core`; **delete the tasks block** |
| `src/mcp/__tests__/hostile.test.ts` | :27-29 Client, **`McpError`** ← types.js, InMemoryTransport | Client/InMemory ← client; `McpError`→`ProtocolError` ← `@modelcontextprotocol/server`; `:215` `.toThrow(McpError)`→`.toThrow(ProtocolError)` |
| `ai-tools`, `lab`, `media-intelligence`, `r2-tools`, `r6-planning`, `mcp-ui`, `text-fallback`, `workflow` tests | Client ← client/index.js; InMemoryTransport ← inMemory.js; some `CallToolResult` type ← types.js | Client/InMemory ← `@modelcontextprotocol/client`; `CallToolResult` type ← `@modelcontextprotocol/server` |
| `mcp-stdio.integration.test.ts` | `StdioClientTransport` ← client/stdio.js | ← `@modelcontextprotocol/client/stdio` |
| `main/mcp/gui-tools.test.ts` | Client/InMemory/McpServer | Client/InMemory ← client; McpServer ← server |
| `main/mcp/http-server.integration.test.ts` | Client ← client/index.js; `StreamableHTTPClientTransport` ← client/streamableHttp.js; type `Client as ClientType` ; type `Transport` ← shared/transport.js | Client, `StreamableHTTPClientTransport` ← `@modelcontextprotocol/client`; `Transport` type ← `@modelcontextprotocol/client` (same-package rule: both link halves must come from one package import) |
| `scripts/mcp-full-test.mjs` :9-11 | Client / StdioClient / StreamableHTTPClient | client + `client/stdio` |
| `scripts/mcp-smoke.mjs` :20-21 | Client / StdioClient → | client + `client/stdio`. `EXPECTED_TOOL_COUNT = 37` must still hold (tasks removal does not remove tools). |
| `e2e/mcp/client.ts` :14-17 | Client / StdioClientTransport / StreamableHTTPClientTransport / type CallToolResult | client / `client/stdio` / client / `@modelcontextprotocol/server` |

## 6. `tsconfig.main.json` (and any shared tsconfig)

Current (line 5-13): `moduleResolution: "node"`, `baseUrl: "."`, `paths` for
`@modelcontextprotocol/ext-apps`, `/server`, and `@modelcontextprotocol/sdk/experimental/tasks`.

- **Delete** the `@modelcontextprotocol/sdk/*` path entries (`experimental/tasks` no longer exists).
- **Keep** the ext-apps `paths` entries — they still point at `dist/src/app.d.ts` /
  `dist/src/server/index.d.ts`, unchanged in 2.0.3 (ext-apps@2 has no `typesVersions`).
- The **split packages resolve natively** via their `types` + `typesVersions` fields under classic node10
  resolution — **do not** add `paths` entries unless TS fails (verify, then add paths mapping only for the
  subpath that failed). Fallback if typing still breaks under node10: node16/bundler resolution — but that
  ripples through the CJS emit; avoid unless forced.
- Re-run `tsc --noEmit` per project after the diff.

## 7. Packaging / tooling / docs collateral

- `scripts/audit-gate.mjs` (line 8) references `@modelcontextprotocol/sdk` in the allowed/tracked list —
  refresh to `@modelcontextprotocol/{client,core,node,server}` + `hono`/`@hono/node-server`.
- Electron packaging: confirm `node_modules/@modelcontextprotocol/*` (+ hono) are bundled with the main
  process output; no native/`.cjs`-only surprises expected (dual builds).
- Doc references to the tasks receipt (plan renders in `AI_ASSISTANT_MCP_ENHANCEMENT_PLAN.md` D4, MCP
  server README, `mcp-full-test.mjs` headers) — update wording for Option A.

## 8. Risks

1. **Era/legacy negotiation** (high, silent): after the swap, an existing 1.x-era host (Claude Desktop on
   sdk 1.x) must still initialize against the 2.x server. Verify with a real 1.x client in §10; if a 2.x
   server refuses legacy clients, that forces a client cohort upgrade or a server-legacy path.
2. **Strict JSON-RPC framing** (low-medium): 2.x drops frames that match no schema instead of erroring
   (guide §"behavioral changes"). All EncodeX traffic goes through typed client verbs / `McpServer`
   handlers, so surface impact ≈ 0; flag the one hand-built frame path if any appears in `e2e`.
3. **`callTool()`/`request()` client signature change** (schema parameter removed) — codemod rewrites
   these; grep for `client.request(` and `callTool(` in the test surface.
4. **InMemoryTransport pairing** — both ends of a linked pair must import from the same package
   (same-package rule). Tests import `InMemoryTransport` from `@modelcontextprotocol/client`
   consistently.
5. **Module-resolution friction under node10** — mitigated by `typesVersions` presence (§6 verify step).
6. **ext-apps@2 with dual deps** — typeless package; the `paths` hack is load-bearing. Pin `@2.0.3`
   exactly until a `typesVersions` release lands.

## 9. Suggested commit order

1. **Kill tasks first (Option A), standalone:** delete `MCPTaskStore`, `taskFromResult`/
   `convertCreateTask`/`batchCreateTask`, both `registerToolTask` blocks → plain `registerTool`
   registrations; delete client-side task tests; drop `taskStore` option. Green tests (still on sdk 1.x).
2. **Dependency swap:** `package.json` pins → `npm install`; engines check.
3. **Codemod pass:** `v1-to-v2`, resolve all `@mcp-codemod-error` markers.
4. **Reconcile by file** (tables §4/§5); transport swap (three sites).
5. **tsconfig + audit-gate + docs** (§6/§7).
6. **Full verification** (§10).

## 10. Verification checklist

- `npm run typecheck` (all tsconfig projects) — zero errors, `@mcp-codemod-error` count = 0.
- `npm test` — unit + integration green; hostile `.toThrow(ProtocolError)` passing.
- `npm run lint`.
- `node scripts/mcp-smoke.mjs` → **37 tools**; initialize/listTools over stdio OK.
- `node scripts/mcp-full-test.mjs` → full suite green; asserts tasks-free behavior.
- Loopback HTTP (`npm run dev` + `e2e/mcp`) over `NodeStreamableHTTPServerTransport` — stateful session
  round-trip + SSE close/reconnect.
- **Legacy-host check:** connect with a pinned `@modelcontextprotocol/sdk@1.x` client to the migrated
  server; initialize + one tool call succeed (era negotiation).
- Electron packaged run: MCP server starts in main/CLI processes, `get_job` flow intact.

## 11. Effort (scope estimate, not commitment)

| Area | Relative size |
| --- | --- |
| Tasks removal (Option A) | S–M |
| Import rewrites (source) | S |
| Transport swap + node adapter | S |
| Tests/scripts rewire | M |
| tsconfig/resolution + packaging | M |
| Era/legacy verification | S–M (unbound debugging risk) |

Total for Option A ≈ a multi-day, well-trodden migration — the risk is negotiation/resolution, not volume.
Option B (native tasks) is an XL separate project.

## Reference material

- Migration guide (offline): `C:\Users\sande\.local\share\opencode\tool-output\tool_12a83b855001GdCYiEfWVudYYt`
  (sections: Imports & transports, Errors, Experimental tasks interception removed, Types & schemas,
  Behavioral changes, Unchanged APIs).
- Extracted 2.x packages: `C:\Users\sande\AppData\Local\Temp\opencode\mcp2\{server,client,core}-2.3.1-extracted`,
  `ext-apps-2.0.3-extracted`, `node-2.1.1-extracted` (fingerprint the constructor/option surface before coding).
- Export inventories: `mcp2\{server,client,core}-exports.txt`.