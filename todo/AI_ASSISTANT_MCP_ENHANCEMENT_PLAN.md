# EncodeX AI Roadmap 2.0 — AI Control Plane, MCP Apps & Media Intelligence

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` skipped · `(manual)` needs external action

> **What changed in v2.** v1 was written as if EncodeX had no MCP Apps support and no tools.
> That is no longer true. v2 is grounded in the actual repository (verified 2026-10-10):
> the MCP server exposes **16 core tools + 6 GUI-parity tools**, MCP Apps is **already
> shipped** (`M0`–`M4` complete in `plans/MCP_APPS_SERVER_PLAN.md`), and **115 built-in
> profiles** exist. v2 therefore describes *extension and completion*, not greenfield
> invention. It also merges and de-duplicates the 20 ideas in `todo/AI_ASSISTANT_PAN.md`
> into one scored backlog.
>
> Companion documents: `plans/MCP_APPS_SERVER_PLAN.md` (server-side MCP Apps, done),
> `plans/MCP_DIFFERENTIATION_NEXT_STEPS_PLAN.md`, `docs/MCP.md`, `docs/MCP_UI.md`.

---

## 1. Fact base (verified against the repo and the MCP spec)

### 1.1 Corrections to the previous plan

| Claim in v1 / PAN | Verified reality |
| --- | --- |
| "140+ profiles" | **115** built-in profiles, `src/shared/profiles/builtin.ts:3`, 8 categories |
| No MCP Apps support; "build the Conversion Studio MCP App" | **7 `ui://` views already registered** — `queue`, `job`, `media-info`, `convert`, `confirm`, `profiles`, `capabilities` (`src/shared/mcp-ui.ts:45-53`) |
| Proposed tool names `media.inspect`, `conversion.plan`, `jobs.get`, … | Real surface is `convert_media`, `get_media_info`, `get_job`, `list_jobs`, `cancel_job`, `batch_convert`, `cut_video`, `extract_audio`, `compress_image`, `remux_media`, `demux_media`, `list_profiles`, `get_profile`, `list_capabilities`, `ping`, `commit_operation` (`src/mcp/server.ts:766-1030`) |
| "Design the MCP tools around the apps" | Tool→UI linkage via `_meta.ui.resourceUri` is **already on 10 tools** (`src/mcp/server.ts:789-1001`) |
| MCP Apps spec "marked stable January 26, 2026" | **Correct.** SEP-1865, spec `2026-01-26`, Status Stable; SDK v1.0.0 same day |
| ChatGPT is a target host | **Blocked by design today.** Both HTTP servers refuse non-loopback binds (`src/mcp/http.ts:107`, `assertLoopbackBind`) and ChatGPT is remote-only. See decision **D1** |
| In-MCP agent can "plan multi-step jobs" | MCP **sampling is deprecated** as of core spec `2026-07-28` (SEP-2577). An agent must call the LLM provider API directly — do not build on `sampling` or `roots` |

### 1.2 What already exists (do not rebuild)

| Layer | State | Evidence |
| --- | --- | --- |
| FFmpeg engine + 3 transcoder cores | done | `src/main/transcoders/{ffmpeg,fftool,bmf}-core.ts` |
| Typed errors — **22 codes** | done | `src/shared/errors.ts:34-57` |
| Job queue, 4 states, persistence, concurrency 4 | done | `src/main/queue/job-queue.ts:145`, `src/shared/media-options.ts:271` |
| MCP job manager (`queued/running/done/error`) | done | `src/mcp/jobs/manager.ts:83` |
| Batch planner with path/dir/glob expansion | done | `src/mcp/operations.ts:247` |
| Hardware encoder probe + capability cache | done | `src/main/capabilities.ts:151` |
| MCP stdio **and** Streamable HTTP (loopback, bearer auth, 10 MB body cap) | done | `src/mcp/http.ts:36`, `src/main/mcp/http-server.ts` |
| MCP Apps: capability handshake, `registerAppTool`/`registerAppResource`, views, approval bridge | done | `src/mcp/ui/*`, `M0`–`M4` `[x]` |
| Confirmation gating: `commit_operation` with `_meta.ui.visibility: ['app']` | done | `src/mcp/server.ts:1018`, `src/mcp/ui/approval.ts:32` |
| CLI, 8 subcommands, `--json`, exit codes 2/3/4/5 | done | `src/main/cli/cli.ts:150-413` |
| E2E MCP suites (`test:e2e:mcp`, `test:e2e:mcp:real`) | done | `package.json:71-72` |
| **LLM provider integration** | **none** | 0 matches for `openai|anthropic|llm|copilot` in `src/` |
| **Chat / Copilot UI in the renderer** | **none** | only a Settings link, `src/renderer/pages/Settings.tsx:241` |
| **`structuredContent` on tool results** | **partial** | views exist; results are still largely `JSON.stringify` text |
| **Tasks extension / standard long-job protocol** | **none** | custom job IDs only |
| **Remote/tunneled MCP transport** | **none** | loopback enforced by design |

### 1.3 Spec facts that constrain the design

- **MCP Apps (SEP-1865)** — stable `2026-01-26`. Tool links UI via `_meta.ui.resourceUri`;
  resource must be `ui://…` with MIME `text/html;profile=mcp-app`; rendering is a sandboxed
  host-owned iframe; UI↔host is JSON-RPC over `postMessage` using the `ui/*` bridge — the
  **server never touches those messages**. Security metadata (`csp`, `permissions`, `domain`)
  lives on the *resource*, in `_meta.ui`.
- **Text fallback is mandatory (SEP-2133).** Every UI-enabled tool must still return useful
  `content` text for hosts that do not render (Claude Code, Gemini CLI, Zed, Codex).
- **`_meta.ui.visibility`** — `['model']` or `['app']`. EncodeX already uses `['app']` on
  `commit_operation` so the model cannot self-authorize a write. Keep that invariant.
- **Hosts that render, as of 2026-10:** Claude (web/desktop/mobile/Cowork), ChatGPT (web,
  **not mobile**, remote-only), VS Code Copilot Chat, Goose, Postman, MCPJam. **Do not render:**
  Claude Code, Gemini CLI, Codex, Zed.
- **`structuredContent` is any JSON value**; `inputSchema`/`outputSchema` are full
  **JSON Schema 2020-12** (SEP-2106). Use it to ship typed media metadata instead of prose.
- **Long-running jobs → Tasks extension** (`io.modelcontextprotocol/tasks`, SEP-2663):
  `CreateTaskResult` with `taskId`/`ttlMs`/`pollIntervalMs`, driven by `tasks/get`,
  `tasks/update`, `tasks/cancel`. Maps 1:1 onto the existing `MCPJobManager`.
- **Elicitation / MRTR** (SEP-2260 normative, SEP-2322) is the standard way to ask
  "overwrite? choose quality?" — the network transport for what `commit_operation` does today.
- **Do not build on `sampling` or `roots`** — both deprecated in `2026-07-28`.
- **SDK pinning:** `@modelcontextprotocol/ext-apps@^1.7.5` against `@modelcontextprotocol/sdk@^1.30.0`.
  ext-apps 2.x requires the split `@modelcontextprotocol/{server,client,core}@2` packages —
  do not jump there in this roadmap (decision in `plans/MCP_APPS_SERVER_PLAN.md` §Compatibility).

---

## 2. Positioning

Move from **"AI can control EncodeX"** to **"AI understands the media and proposes what should
happen — the user approves, EncodeX executes, and the result is verified."**

Three product surfaces over **one** engine:

1. **EncodeX desktop** — full engine, files, queue, profiles, GPU.
2. **EncodeX MCP + MCP Apps** — the same engine driven from Claude / VS Code / ChatGPT, with
   interactive forms and approval cards instead of JSON dumps.
3. **EncodeX AI layer** — an LLM-provider-agnostic planner used by *both* the desktop Copilot
   and the MCP server. `AI decides what to do; FFmpeg does the work; the user approves.`

Non-goals for this roadmap: replacing the existing renderer UI; a cloud encoding service;
a custom UI protocol outside SEP-1865.

---

## 3. Architecture

```
                ┌───────────────────────────────┐
                │        AI Provider layer      │  OpenAI / Anthropic / Gemini / local
                │  (direct API calls; NOT MCP   │  — sampling is deprecated
                │   sampling)                   │
                └───────────────┬───────────────┘
                                │
                ┌───────────────▼───────────────┐
                │       EncodeX AI Layer        │  intent → inspect → plan → estimate
                │  src/main/ai/  (new)          │  → confirm → execute → validate
                │  provider-agnostic, typed     │
                └───────┬───────────────┬───────┘
                        │               │
        IPC (desktop)   │               │  MCP tools (host)
                        ▼               ▼
                ┌───────────────────────────────┐
                │   EncodeX Engine (source of   │  profiles · queue · transcoders ·
                │   truth — unchanged)          │  capabilities · errors · media info
                └───────────────┬───────────────┘
                                ▼
                             FFmpeg
```

Decisions:

- **D1 — Host reachability.** Loopback-only HTTP means **Claude Desktop, VS Code (stdio/loopback)
  work today; ChatGPT does not.** Options: (a) keep loopback and document ChatGPT as
  unsupported; (b) optional opt-in loopback tunnel (Cloudflare Quick Tunnel / `ngrok`) with a
  scary consent dialog, token auth and an explicit "expose to internet" switch; (c) a hosted
  relay. **Recommendation: (a) for R0–R3, spike (b) as R5.** Every option keeps bearer auth,
  rejects query-string tokens, and preserves the 10 MB body cap.
- **D2 — AI layer location.** `src/main/ai/` for desktop; the MCP server must stay
  Electron-free (`src/mcp/`), so the AI layer ships as a shared module the MCP process can
  import, with the provider key supplied via env/settings. No FFmpeg logic in the LLM path.
- **D3 — File access.** Hosted UI iframes have no filesystem access. Inputs are always
  referenced by absolute path validated against user-approved roots, or transferred via the
  desktop app. Never accept a raw FFmpeg command string from the model — always build argv
  from validated, typed settings.
- **D4 — Determinism.** Estimates are labeled *estimates*; only measured results (probe the
  output) are asserted as fact.

---

## 4. MCP tool surface

Keep tools small and composable. **Do not rename the existing 16** — they are already wired to
views, prompts, CLI and E2E. Extend instead.

### 4.1 Keep as-is

`ping`, `convert_media`, `get_job`, `list_jobs`, `cancel_job`, `get_media_info`,
`list_capabilities`, `list_profiles`, `get_profile`, `compress_image`, `extract_audio`,
`cut_video`, `batch_convert`, `remux_media`, `demux_media`, `commit_operation`,
plus GUI-parity `get_queue_state`, `cancel_all_jobs`, `get_timeline`, `extract_preview`,
`get_system_info`, `check_for_updates`.

### 4.2 Add

| Tool | Params | Why | Release |
| --- | --- | --- | --- |
| `analyze_media` | `{ input, focus?: 'compat'\|'quality'\|'size' }` | Structured diagnosis: streams, HDR, incompatibilities, plain-language explanation. Powers the Media Inspector and `explain failure` | R1 |
| `recommend_settings` | `{ input, intent: string, constraints?: { maxBytes?, targetDevice?, platform? } }` | Maps natural language → a concrete `convert_media` args object + profile id. Returns `{ args, profileId?, rationale, confidence }` — the model never guesses argv | R1 |
| `estimate_conversion` | `{ args, input }` | Math-based size/time estimate from duration × bitrate, plus hardware-encoder availability. Returns `isEstimated: true` | R1 |
| `validate_output` | `{ output, expect?: { maxBytes?, minResolution?, codec? } }` | Re-probes the output and returns pass/fail per constraint. This is what makes "validate before claiming success" real | R1 |
| `explain_error` | `{ jobId }` or `{ message }` | Maps `ErrorCode` (22 typed codes) + FFmpeg stderr to plain language + a suggested retry args patch | R2 |
| `find_similar_media` | `{ inputs[], method: 'hash'\|'metadata' }` | Dedupe/redundancy detection (PAN #6) — perceptual hash + duration/resolution similarity | R4 |
| `plan_workflow` / `execute_workflow` | typed DAG JSON | Multi-step automation (PAN #17) with dry-run | R5 |

### 4.3 Result contract (all tools)

Every tool returns **both**:

- `content: [{ type:'text', text }]` — human/model readable, **mandatory fallback**;
- `structuredContent` — typed JSON Schema 2020-12 payload, e.g.
  `{ job:{id,status,progress}, media:{...}, errors:[{code,message,retryable}] }`.

Adopt the shared `ErrorCode` as the machine-readable error channel so the model can branch on
`OUTPUT_EXISTS` / `PERMISSION_DENIED` / `FILTERS_REQUIRE_RE_ENCODE` instead of parsing prose.

### 4.4 Long-running jobs → Tasks extension

Add `io.modelcontextprotocol/tasks`: `convert_media` / `batch_convert` return a
`CreateTaskResult` (`taskId`, `ttlMs`, `pollIntervalMs`) backed by `MCPJobManager` job IDs;
clients that declare the extension drive `tasks/get`/`tasks/update`/`tasks/cancel`, others keep
polling `get_job`. No behavior change for existing clients.

---

## 5. MCP Apps — what exists and what to add

**Shipped (`[x]`):** `ui://encodex/{queue,job,media-info,convert,confirm,profiles,capabilities}`,
capability handshake, `_meta.ui.resourceUri` on 10 tools, confirmation bridge
(`src/mcp/ui/approval.ts`), hostile-metadata tests, `mcp:smoke` green.

**Remaining hardening for the shipped set:**

- `[ ]` `R-1` Real-host render verification in Claude Desktop + VS Code (`(manual)` — only
  open box in `plans/MCP_APPS_SERVER_PLAN.md`).
- `[ ]` `R-2` Move every view's data payload from interpolated text to `structuredContent`.
- `[ ]` `R-3` Declare `csp` (`connectDomains`, `resourceDomains`) on each resource —
  restrictive-by-default; views should need **zero** external connections.
- `[ ]` `R-4` Text-fallback audit: for each UI tool, assert a non-UI host still gets a
  meaningful message (automated in `e2e/mcp/`).

**New views:**

| View | URI | Attaches to | Release |
| --- | --- | --- | --- |
| Media Inspector | `ui://encodex/inspector` | `analyze_media`, `get_media_info` | R1 |
| Plan & Estimate card | `ui://encodex/plan` | `recommend_settings`, `estimate_conversion` | R1 |
| Approval card (upgraded `confirm`) | `ui://encodex/confirm` | `commit_operation` | R1 |
| Batch Dashboard | `ui://encodex/batch` | `batch_convert`, `get_queue_state` | R2 |
| Error explainer + retry | `ui://encodex/error` | `explain_error`, `commit_operation` | R2 |
| Compression Lab (A/B candidates) | `ui://encodex/lab` | `recommend_settings` ×N + `validate_output` | R3 |
| Workflow Builder | `ui://encodex/workflow` | `plan_workflow`, `execute_workflow` | R5 |

Views are plain HTML strings from `src/mcp/ui/views/*` — **no build step, no framework, no
bundler**, matching the existing pipeline. Data arrives as `structuredContent`, never by
server-side HTML interpolation (keeps the XSS guarantee tested in `M4`).

---

## 6. Safety model

EncodeX touches files users care about. Existing invariant: **the model can propose, only the
app can commit** (`commit_operation` is `visibility:['app']`). Extend it into four tiers:

| Tier | Operations | Gate |
| --- | --- | --- |
| **T0 Read-only** | `get_media_info`, `list_profiles`, `analyze_media`, `explain_error`, `estimate_*` | automatic |
| **T1 Plan** | `recommend_settings`, `plan_workflow` | automatic, but always rendered as a reviewable plan card |
| **T2 Write** | `convert_media`, `batch_convert`, `cut_video`, `remux_media`, `demux_media`, `compress_image`, `extract_audio` | plan shown → user approves → `commit_operation`; args re-validated server-side at commit time (never trusted from the client) |
| **T3 Destructive** | overwrite existing file, delete, move outside approved root, `cancel_all_jobs` | explicit confirmation, destination shown, originals preserved by default |

Additional rules:

- `[ ]` Validate **all** tool inputs on the server with the existing Zod schemas; reject
  `extraArgs` that contain shell metacharacters or a second command.
- `[ ]` Never build a shell string — argv array only (already true of the transcoder layer;
  add a lint/test guard so it stays true).
- `[ ]` Cap `batch_convert` fan-out and require re-approval when a plan's file count or total
  bytes grow beyond the approved envelope.
- `[ ]` Every mutating tool emits a `commit_operation` audit entry (tool, args digest, result)
  surfaced in the Logs page.
- `[ ]` Post-execution validation is mandatory: job `done` + output exists + probe readable +
  `validate_output` constraints satisfied, else report failure honestly.

---

## 7. AI layer (the genuinely new work)

No LLM code exists today. New module `src/main/ai/` (+ shared types in `src/shared/ai/`).

- **7.1 Provider abstraction** — `AIProvider` interface: `plan(intent, mediaFacts, history) →
  typed Plan`. Implementations: OpenAI, Anthropic, Gemini, local (Ollama/llama.cpp). Selected
  by settings; **no provider SDK types leak past the adapter**. Called directly over HTTPS —
  not via MCP sampling (deprecated).
- **7.2 Grounding, not guessing** — the provider receives *structured facts* from
  `get_media_info` + `list_capabilities` + `list_profiles` (all 115 with categories), and
  returns a *typed plan* that is re-validated against Zod before anything runs. The LLM
  selects/configures existing profiles rather than inventing FFmpeg flags.
- **7.3 Deterministic pre/post-processing** — parsing media info, computing bitrate for a
  target size, probing output, and retry math are **code, not model calls**. The model picks
  intent and trade-offs; arithmetic is ours.
- **7.4 Desktop Copilot (optional surface)** — a chat panel is a *later*, explicitly optional
  deliverable (R6). The MCP path delivers the same value without any new renderer UI, so it
  is sequenced after the MCP work. If built, it reuses the same AI layer and the same
  `commit_operation` gate — no second approval system.
- **7.5 Privacy posture** — every provider adapter declares `dataEgress: 'none' | 'metadata' |
  'media'`. Default: **metadata only** (probe output, no file bytes). Local provider ⇒
  `none`. Surface this in Settings next to the existing MCP toggle.
- **7.6 Cost/rate guardrails** — per-request caps, no per-frame model calls, caching of
  `mediaFacts` keyed by path+mtime+size.

---

## 8. Feature backlog (merged from `todo/AI_ASSISTANT_PAN.md`, de-duplicated)

Scoring: **V** value · **D** difficulty (1 low – 5 very high) · **Dep** what it needs first.

| # | Feature | V | D | Dep | Phase |
| --- | --- | --- | --- | --- | --- |
| F1 | Natural-language → typed conversion plan (`recommend_settings`) | 5 | 2 | AI layer 7.1-7.2 | P1 |
| F2 | Profile selection/explanation over the 115 built-ins | 5 | 1 | `list_profiles` (exists) | P1 |
| F3 | Target-size encoding with measured retry loop | 5 | 3 | `estimate`+`validate` | P1 |
| F4 | Error explanation + one-click switch & retry | 5 | 1 | 22 `ErrorCode`s (exists) | P1 |
| F5 | "Explain this media file" / compatibility diagnosis | 4 | 1 | `get_media_info` (exists) | P1 |
| F6 | AI-optimized batch ("compress >500 MB, keep originals, skip already-optimized") | 5 | 3 | `batch_convert` (exists) + F1 | P2 |
| F7 | Encoding advisor using real hardware caps | 4 | 2 | `capabilities.ts` (exists) | P2 |
| F8 | Post-encode quality report (resolution/audio/HW/stream errors) | 4 | 2 | `validate_output` | P2 |
| F9 | Folder analysis + savings estimate ("Media Librarian") | 4 | 3 | F6 | P2 |
| F10 | Duplicate/near-duplicate detection | 4 | 4 | `find_similar_media` | P3 |
| F11 | Local speech-to-text → SRT/VTT/ASS subtitles | 5 | 4 | model integration | P3 |
| F12 | Subtitle translation | 4 | 3 | F11 | P3 |
| F13 | Auto chapters + YouTube timestamps | 4 | 3 | F11 | P3 |
| F14 | Transcript search → clip cut | 5 | 4 | F11 + `cut_video` | P3 |
| F15 | Video summarization / topic list | 4 | 4 | F11 | P3 |
| F16 | Highlight & thumbnail candidates | 4 | 5 | frame analysis | P4 |
| F17 | Social repurposing pack (platform versions + shorts + subs) | 5 | 4 | F6, F11, profiles | P4 |
| F18 | Natural-language editing ("remove the intro") | 5 | 5 | F11 + scene detection | P4 |
| F19 | Workflow DAG builder with dry-run | 5 | 5 | `plan_workflow` | P4 |
| F20 | Full AI media agent (autonomous multi-folder pipeline) | 5 | 5 | F1–F19 | P5 |

Explicitly **cut from v1's list as non-differentiators**: a generic "AI quality score"
(reports dimensions, never a single number — see F8), and "AI generates a new profile file"
(profiles stay code-reviewed; the AI may *propose* a profile JSON the user saves).

---

## 9. Roadmap

Each release has a deliverable **and** a verification command. Run before any release:
`npm run lint` · `npm run typecheck` · `npm run test` · `npm run validate:locales`.

### R0 — Close the gaps in what already ships `[ ]`

| Task | Files |
| --- | --- |
| R0.1 Real-host render verification, Claude Desktop + VS Code (`(manual)`) | `e2e/mcp/mcp-apps.spec.ts` |
| R0.2 `structuredContent` on **all** tool results (not just view-linked ones) | `src/mcp/server.ts` |
| R0.3 `csp` on every `ui://` resource; assert zero external connections from views | `src/mcp/ui/resources.ts` |
| R0.4 Text-fallback audit test for every UI-enabled tool | `e2e/mcp/` |
| R0.5 Tasks extension `io.modelcontextprotocol/tasks` mapped onto `MCPJobManager` | `src/mcp/jobs/manager.ts` |

**Deliverable:** an MCP Apps server that is correct under the stable spec, not just functional.

### R1 — Intelligence core (first user-visible AI value)

`analyze_media`, `recommend_settings`, `estimate_conversion`, `validate_output` +
views `inspector`, `plan`, upgraded `confirm` + AI provider abstraction 7.1–7.3 (7.5 privacy
flags). No desktop chat yet.

**Deliverable:** "Make this work on my iPhone" → a reviewable, typed plan card → approved
execution → verified output — inside Claude or VS Code.

**Verify:** `npm run mcp:full-test`, `npm run test:e2e:mcp`.

### R2 — Reliability: errors, batch, dashboard

`explain_error` + `ui://encodex/error`; `ui://encodex/batch` over `batch_convert`;
tiered T0–T3 gating (§6) incl. audit log in the Logs page; F4, F6, F7, F8.

**Deliverable:** failures become plain language with a one-click retry; bulk work is
manageable from a conversation.

### R3 — Compression Lab (measurable differentiation)

Target-size encode loop (F3) with **measured** iteration, side-by-side A/B candidates,
`validate_output` gating every candidate, Media Librarian folder savings report (F9).

**Deliverable:** "get this under 100 MB with least visible loss" answered by real encodes,
with the numbers to prove it.

### R4 — Media intelligence (local-first)

`find_similar_media` (F10); local STT → subtitles (F11), translation (F12), chapters (F13),
transcript→clip (F14), summary (F15). Model runs locally where possible — this is the privacy
differentiator. Every cloud fallback labeled in-UI.

**Deliverable:** EncodeX understands media, not just converts it.

### R5 — Workflows + host reachability spike

Typed workflow DAG with dry-run (`plan_workflow`/`execute_workflow`, `ui://encodex/workflow`,
F19); decision **D1** spike (opt-in tunnel for ChatGPT) with a written go/no-go; OAuth 2.1 +
resource indicators if any remote path ships.

**Deliverable:** multi-step automation + a documented answer on ChatGPT.

### R6 — Agent & optional Copilot surface

Highlights/thumbnails (F16), social repurposing (F17), NL editing (F18), agent loop (F20),
and only then the optional in-app Copilot panel (7.4) reusing the same AI layer and approval gate.

**Deliverable:** the long-term vision — user asks, AI plans, EncodeX executes, app reports
verified results.

Milestones are scope boxes, not date commitments; sizing depends on how much of R0 lands quickly.

---

## 10. Open decisions

| ID | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| D1 | Reach ChatGPT (remote-only) | a) document unsupported b) opt-in tunnel c) hosted relay | **a)** through R4; spike **b)** in R5 |
| D2 | Desktop Copilot panel | ship now / ship R6 / never | **R6** — MCP delivers the value first with zero new renderer surface |
| D3 | Local model default | ship local adapter in R1 vs R4 | **R4**, alongside F11 which needs it anyway |
| D4 | Tasks extension vs custom polling | both / tasks-only | **both** — tasks for capable clients, `get_job` retained as fallback |
| D5 | ext-apps 2.x migration | now / later | **later** — requires `@modelcontextprotocol/{server,client,core}@2`; revisit after R3 |

---

## 11. Why this is defensible

1. **One engine, many hosts.** Standard SEP-1865 means one set of views serves Claude,
   VS Code and (if D1 resolves) ChatGPT — no per-host rewrites.
2. **Rich control + natural language.** The model reasons about intent; the app supplies
   precise controls, previews, comparisons and approvals. Nobody types CRF values in chat.
3. **Measured, not predicted.** Estimates are labeled; success is probe-verified. That is
   the difference between a demo and a tool.
4. **Local processing as moat.** Local encode + local STT ⇒ a privacy-first story cloud
   video services cannot copy — stated honestly, with any cloud step disclosed.
5. **Safety as a feature.** Model proposes, app commits, output is validated. Users hand
   over their library only because the gate is visible.

**Start here:** R0 (close the gaps in what already ships) → R1 (`recommend_settings` +
plan card) → R3 (Compression Lab). The workflow agent waits until those are boring.
