# AI Connector + AI-Powered Copilot Plan

> **Status:** PLAN ONLY — no code changed. Re-implements the desktop Copilot around a
> pluggable **AI connector architecture** so EncodeX can be driven by any hosted AI service
> (OpenAI, Anthropic Claude, Google Gemini, any OpenAI-compatible endpoint) using a
> user-supplied API key, while keeping the deterministic engine as the offline default and
> automatic fallback.

## 1. Goal

1. **Connect the Copilot to real AI providers.** The user supplies an API key (e.g. OpenAI) in
   Settings; the Copilot then plans conversions with that provider instead of only the built-in
   rules engine.
2. **Connector architecture.** A thin, testable connector interface — one implementation per
   provider — so "any AI service" can be added as one new file + a descriptor entry, with no
   changes to the planner, UI, or engine. An **OpenAI-compatible `baseUrl` override** covers
   OpenRouter, Groq, Ollama, LM Studio, vLLM, etc. for free.
3. **Safety unchanged.** The LLM proposes only structured `convert_media` args; every proposal is
   re-validated by the existing deterministic gate (`buildConversionOptions`) and the size
   estimate is still computed from real probe facts. Nothing runs without the existing approval /
   Batch Queue flow.
4. **Privacy posture preserved.** Only probe facts + the goal text ever leave the machine
   (existing `dataEgress: 'metadata'` contract); file bytes never upload; API keys are encrypted
   at rest in the main process and never reach the renderer.
5. **Offline by default, AI opt-in.** With no provider/key the Copilot works exactly as today via
   the deterministic `rules` engine (§9); a key only upgrades planning quality.
6. **Scope confinement.** The model is structurally unable to act outside EncodeX: it proposes
   only single, validated `convert_media` args through a closed prompt/shape, a deterministic
   validation gate, and the existing human approval flow (§10).

## 2. What exists today (grounding — verified)

- **Provider scaffold already present** (`src/shared/ai/provider.ts`, types in
  `src/shared/ai/types.ts`): `AIProviderId = 'rules' | 'openai' | 'anthropic' | 'gemini' | 'local'`,
  `AIProvider.descriptor` + `plan(PlanRequest): Promise<RecommendedSettings>`,
  `PROVIDER_DESCRIPTORS` (label + `dataEgress` + `requiresApiKey`), `createProvider(id, opts)`.
  - Implemented: `rules` (deterministic) and `local` (D3/R4, via injected `LocalModelClient`).
  - `openai`/`anthropic`/`gemini` throw `AIProviderUnavailableError` ("remote provider adapters are
    not part of the first AI release (R1)"). This plan implements them.
- **Local-adapter precedent** (`src/mcp/local-model-client.ts`, injected by `server.ts:940`): the
  shared layer defines a minimal transport interface (`LocalModelClient.generate`), and a host
  adapter implements the HTTP/Ollama call. **The remote connectors follow this exact pattern** —
  interface in the Electron-free layer, HTTP implementation in the Electron main process.
- **The Copilot does NOT use the provider layer today.** `src/main/ipc/copilot.ts:183` calls
  `planAgent` directly, which hard-calls `recommendSettings` inside `planFile`
  (`src/shared/ai/agent.ts:143`). So "re-implement the Copilot" = make that single call pluggable
  (§7.1) and hand the active provider's `planner` into `planAgent`.
- **Settings persistence pattern:** JSON file in `userData/` with an IPC bridge and a sanitize gate
  (`src/main/mcp/settings.ts`, `settings-ipc.ts`; consent stores in `src/main/{analytics,monitoring}/`).
  `ai-settings.json` will mirror `mcp-settings.json`. **No `safeStorage`/keytar exists yet** — must be
  added.
- **IPC contract is pinned:** channel names in `src/shared/ipc-channels.ts`, handlers registered in
  `src/main/ipc/handlers.ts`, bridge in `src/preload/index.ts`, renderer typing in
  `src/renderer/electron-api.d.ts`, and `src/main/ipc/__tests__/channel-contract.test.ts` asserts the
  declared surface matches preload keys — every new channel must land in all five.
- **Stack:** Electron 43 / Node 24 (global `fetch`, `AbortSignal.timeout`, `crypto`), zod 4.6.5,
  no HTTP client dependency needed. All UI strings go through i18n (see `settings.*` keys).

## 3. Target architecture

```
┌─────────────────────────── RENDERER (no secrets) ───────────────────────────┐
│  Settings.tsx: AI section  ── Copilot.tsx (provider chip, providerId per     │
│   provider select, model,  │  action, fallback hint)                         │
│   baseUrl, key field,     ─┘                                                 │
│   "Test connection"                                                          │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │ IPC: COPILOT_PLAN · AI_SETTINGS_GET · AI_SETTINGS_SET · AI_CONNECT_TEST
┌───────────────▼─────────────────── MAIN (only process that holds key) ──────┐
│ src/main/ai/settings.ts      src/main/ai/settings-ipc.ts                     │
│   ai-settings.json (safeStorage  sanitized surface: hasKey, hint, model…    │
│   encrypted key)              src/main/ipc/copilot.ts (rewrite)             │
│ src/main/ai/connector-factory.ts ─────────────────────────────────────────   │
│   └─ OPENAI ─ ANTHROPIC ─ GEMINI ─ (any OpenAI-compatible baseUrl)          │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │ implements: AIConnector (shared contract, one interface)
┌───────────────▼──────────────   SHARED AI LAYER (Electron-free) ────────────┐
│ src/shared/ai/llm.ts            src/shared/ai/agent.ts                        │
│   buildLLMPrompt / parseLLM    planFile(): planner = request.planner ??       │
│   Plan → RecommendedSettings      recommendSettings   (async seam)            │
│   (fallback → rules)            estimateConversion → buildConversionOptions  │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Two new abstractions, both deliberately tiny:**

- **`AIConnector`** (`src/shared/ai/connector.ts`): *transport* — "send this conversation, give me
  text (or text + structured-JSON hint)". One per provider, stateless, injectable `fetch`.
- **`LLMProvider`** (in shared `llm.ts`): *planner* — builds the prompt from
  `PlanRequest` (facts strictly limited to `MediaFacts` fields, file path reduced to basename for
  remote calls), calls the connector, parses with the existing `extractJsonObject`, re-validates
  against `convert_media` via `buildConversionOptions`, returns `RecommendedSettings`.
  Implements `AIProvider` so it drops straight into `createProvider()`.

## 4. Connector contract

```ts
// src/shared/ai/connector.ts (Electron-free; type-only imports)
export interface ConnectorMessage { role: 'system' | 'user'; content: string }

export interface ConnectorRequest {
  messages: ConnectorMessage[];
  // Optional structured-output hint; each provider maps it to its native mechanism
  // (OpenAI response_format, Gemini responseSchema, Anthropic prefill/tool-force).
  jsonMode?: boolean;
  temperature?: number;
  signal?: AbortSignal;
}

export interface ConnectorResponse {
  text: string;
  model: string;
}

export interface AIConnector {
  readonly id: AIProviderId | 'openai-compatible';
  readonly defaultModel: string;
  complete(request: ConnectorRequest): Promise<ConnectorResponse>;
}
```

**Adding a fifth provider = 3 small changes** (this is the "any AI service" claim, made concrete):
1. New `src/main/ai/connectors/<name>.ts` implementing `AIConnector` (template: `openai.ts`).
2. `PROVIDER_DESCRIPTORS` + `AIProviderId` entry in `src/shared/ai/types.ts` / `provider.ts`.
3. One factory branch in `src/main/ai/connector-factory.ts`.

No planner, engine, UI, or test-harness change. Connectors must be **fetch-injectable** for tests.

## 5. Connector implementations

All use Node's global `fetch` + `AbortSignal.timeout(ms)`, JSON only, `dataEgress: 'metadata'`.

| Provider | Endpoint / auth | Call style | JSON mechanism | Default model (configurable) |
| --- | --- | --- | --- | --- |
| **OpenAI** | `POST https://api.openai.com/v1/chat/completions`, `Authorization: Bearer <key>` | 2 messages (system+user) | `response_format: { type: 'json_object' }` | `gpt-4o-mini` |
| **Anthropic** | `POST https://api.anthropic.com/v1/messages`, `x-api-key`, `anthropic-version: 2023-06-01` | `system` + user | ask for strict JSON; `prefill: '{'` + `extractJsonObject` | `claude-3-5-haiku-latest` |
| **Gemini** | `POST https://generativelanguage.googleapis.com/v1beta/models/<m>:generateContent`, `x-goog-api-key` header | systemInstruction + user | `generationConfig.responseMimeType = 'application/json'` (+ optional `responseSchema`) | `gemini-2.0-flash` |
| **OpenAI-compatible** | custom `baseUrl` (OpenRouter/Groq/Ollama/LM Studio/vLLM…) | same as OpenAI | `response_format.json_object` when supported, else `extractJsonObject` fallback | provider's own default |

- **Model names are user-overridable** and centralized in one constants module; any default can be
  bumped without code changes.
- **`baseUrl` override** (+ required model) applies to the OpenAI connector; HTTPS enforced except
  `http://127.0.0.1` / `http://localhost` (local-compatible gateways only).

## 6. Settings & API-key storage (main process only)

Mirrors the proven `src/main/mcp/settings{,-ipc}.ts` pattern:

- **`src/main/ai/settings.ts`** — file `userData/ai-settings.json`:
  ```ts
  interface AiServerSettings {
    providerId: AIProviderId | 'openai-compatible';
    model: string;
    baseUrl?: string;          // OpenAI-compatible overrides
    key: string | null;        // safeStorage.encryptString(key) → base64, or null
    keySetAt?: number;
    storedInsecurely?: boolean; // true only when safeStorage unavailable + user consented
  }
  ```
  - `readAISettings(userDataDir)` (lenient), `writeAISettings(...)`, `sanitizeAISettings(...)`
    (drops `key`; returns `{ provider, model, hasKey, keyHint }`), `constant-timeStable` key-hint
    helper (mirrors the MCP token treatment).
  - **Encryption:** Electron `safeStorage` (DPAPI on Windows). If
    `safeStorage.isEncryptionAvailable()` is false: refuse to store unless the user explicitly
    accepts a `storedInsecurely` warning shown in Settings (recommended default: refuse).
- **`src/main/ai/settings-ipc.ts`** — `registerAiSettingsIpc({ userDataDir })`:
  - `AI_SETTINGS_GET` → sanitized view (key never crosses IPC).
  - `AI_SETTINGS_SET` → accepts `{ providerId, model, baseUrl, apiKey | clearKey }`; encrypt+persist.
  - `AI_CONNECT_TEST` → builds the connector, sends a 1-token completion, returns
    `{ ok, model, latencyMs, error? }`. Cost-bounded and aborted after timeout.
- Wired up in `src/main/index.ts` (near the analytics/MCP bridges, cf. `:538-539, :612-615`) and
  `src/main/ipc/handlers.ts`.

## 7. Integration seams

### 7.1 Pluggable planner in `planAgent` (the one engine change)

`src/shared/ai/agent.ts`:
- `AgentRequest` gains `planner?: (req: PlanRequest) => Promise<RecommendedSettings>`.
- `planFile` uses `request.planner ?? recommendSettings` — but `recommendSettings` is sync, so
  **`planFile` and `planAgent` become `async`**; `AgentPlan` otherwise unchanged. Existing callers
  add one `await`:
  - `src/main/ipc/copilot.ts:183` and `src/mcp/server.ts:2639` (MCP `plan_agent`), plus the
    `planAgent` unit tests. Deterministic behavior (default) is bit-for-bit identical.
- Everything downstream (`estimateConversion`, the `minSavings` gate, `buildConversionOptions` zod
  gate, workflow shaping, skips) is unchanged and now applies equally to LLM output; an LLM that
  proposes garbage yields a skip with a reason, never a bad job.

### 7.2 Copilot IPC rewrite (`src/main/ipc/copilot.ts`)

- `registerCopilotHandlers({ userDataDir })` reads AI settings; builds the active provider:
  - no key / provider `rules` → deterministic `planAgent` (today's behavior, unchanged);
  - remote configured → `llmProvider = createLLMProvider(createConnectorFromSettings(settings))`,
    passed as `planner` into `planAgent`, then the existing `buildConversionOptions`/workflow path.
- Actions already flow through `CopilotAction`; added per-action `providerId` surfaced in the UI.
- Provider-level failure → per-file fallback to `rules` recorded in `skips`/`notes`
  (mirrors `parseLocalPlan`'s graceful degradation); whole-plan failure only if nothing planned.

### 7.3 MCP phase (optional, after Copilot ships)

Embedded MCP (`src/main/mcp/`) runs inside main and could reuse the same provider for
`recommend_settings` / `plan_agent`. Standalone MCP (`src/mcp/run.ts`, `http.ts`) has no settings
access and keeps the env-based local model (existing). **Deferred to a follow-up decision** — the
Copilot is the deliverable here.

## 8. UI changes

- **`src/renderer/pages/Settings.tsx`** — new "AI & Copilot" section mirroring the MCP-server card
  (`SettingLabel` + testids + i18n):
  - provider select (rules / local / openai / anthropic / gemini / openai-compatible),
  - model text field + optional base URL (shown when compatible),
  - password field for the key (empty = no key; shows `keyHint` + clear/change buttons),
  - "Test connection" button + result line,
  - privacy posture line from `PROVIDER_DESCRIPTORS[id].dataEgress`.
  - Store read into `src/renderer/stores/settingsStore.ts` (mirror the MCP token state fields).
- **`src/renderer/pages/Copilot.tsx`** — plan header gains the active provider chip +
  `settings.ai.*` i18n keys; each action shows its `providerId`; when no remote provider is
  configured a subtle banner offers "Add an AI provider in Settings". **Commit flow unchanged**
  (Batch Queue, no second approval).

## 9. Using the Copilot without an AI provider

Fully supported — the AI provider is **opt-in**, never a requirement. The built-in `rules`
provider (`src/shared/ai/provider.ts`) is deterministic, offline, key-free (`dataEgress: 'none'`),
and is what the Copilot uses today (`planAgent` → `recommendSettings`). It stays the default when
no key is configured (decision A4) and the automatic per-file fallback when a configured provider
fails or returns unusable JSON (decision A2). A user with no key gets the exact behavior shipped
today; a key only upgrades planning quality.

Planner selection at run time:

| Runtime state | Planner used | Outcome |
| --- | --- | --- |
| No key / provider = `rules` | deterministic `recommendSettings` | identical to today, fully offline |
| Remote provider configured + key | LLM via connector, per file | validated proposals; ~1 API call/file |
| Remote configured but call fails / unparseable | fall back to `recommendSettings` | skip note: "AI unavailable; used the deterministic plan" |
| No media matched / probe failed | (pre-planner) | existing `FILE_NOT_FOUND` / `PROBE_FAILED` errors, unchanged |

## 10. How user asks are kept inside EncodeX's scope

When a provider is used, the user's goal string travels to the AI service — but the model is
structurally unable to act outside EncodeX. Gating is layered, all reusing existing machinery:

1. **L1 — Closed prompt and closed vocabulary.** Only these reach the provider: the goal string +
   `MediaFacts` + the specific `BUILTIN_PROFILES` ids + detected encoder capabilities
   (`buildLocalPlanPrompt`, `src/shared/ai/provider.ts:158`). The prompt scopes the model as a
   video-encoding assistant, lists only available profiles/encoders, and demands strictly-JSON of
   one shape. It never receives app internals, IPC channels, file trees, or any
   function/tool-calling surface — there is no tool list to call.
2. **L2 — Closed output shape.** The only accepted response is
   `{ args, profileId, rationale, confidence }` (`RecommendedSettings`, `src/shared/ai/types.ts`)
   where `args` are `convert_media` fields. The model cannot emit shell commands, paths, or
   "actions"; it can only *suggest encoding parameters*.
3. **L3 — Deterministic validation gate.** Every proposal goes through the same zod/normalization
   as MCP tool calls (`buildConversionOptions`, `src/mcp/conversion-options.ts`), plus the
   deterministic size estimate (`estimateConversion`) and the `minSavings` gate
   (`planFile`, `src/shared/ai/agent.ts:137`). Garbage args → the file is skipped with a reason
   (and per A2 falls back to `rules`) — **never a bad job**. The safety hardening in
   `src/mcp/safety.ts` (unsafe arguments, path checks) applies to these args identically to
   attacker-supplied input.
4. **L4 — No ambient authority + human approval.** The provider has no filesystem, shell, or
   scheduler; the result is a *proposal* rendered for review. Nothing runs until the human pushes
   it into the Batch Queue (Copilot) or confirms the MCP Apps proposal (`shouldConfirm()` /
   `confirmationViewUri` in `src/mcp/server.ts`).
5. **L5 — One-shot, no loop.** The provider is called once per file, its output parsed with the
   existing `extractJsonObject`, then discarded. There is no chain-of-thought fed back into further
   calls, so there is no route for an ask to "drift" into out-of-scope behavior mid-conversation.

Honest caveat: this is **structural scope enforcement** — the model literally cannot do anything
but propose valid conversion settings. It is not a semantic guard: a bad model could still propose
a valid-but-worse encode. That residual risk is exactly what the deterministic estimate (which
re-anchors savings claims in real probe facts) and the human approval gate exist for.

## 11. Security & privacy

- Keys: `safeStorage`-encrypted at rest; loaded only in main; **never logged, never sent to the
  renderer** (sanitized surface only; add a `redactString` helper to the logger if a key ever
  reaches a log path during dev).
- Egress: strict `MediaFacts` → prompt; **absolute paths stripped** to basenames for remote
  providers; no file bytes.
- Transport: HTTPS-only (loopback-localhost exception), `fetch` with `AbortSignal.timeout`, per-connector
  `maxRetries = 0` + explicit surfacing of HTTP/4xx/5xx as `ErrorCode`-mapped errors (no silent retry).
- Budget: `maxFiles` cap already enforced (50); note per-file ≈ 1 API call → cost hint in Settings
  ("~1 request per file planned").

## 12. Files touched

| Area | Files |
| --- | --- |
| Shared contract | `src/shared/ai/connector.ts` (new), `src/shared/ai/types.ts`, `src/shared/ai/provider.ts` (descriptors, `createProvider` remote branch), `src/shared/ai/agent.ts` (async planner seam), `src/main/ai/llm.ts` (new; or place under shared) |
| Connectors (main) | `src/main/ai/connectors/{openai,anthropic,gemini,openai-compatible}.ts` (new), `src/main/ai/connectors/factory.ts` (new) |
| Settings (main) | `src/main/ai/settings.ts`, `src/main/ai/settings-ipc.ts` (new), `src/main/index.ts`, `src/main/ipc/handlers.ts` |
| IPC surface | `src/shared/ipc-channels.ts`, `src/preload/index.ts`, `src/renderer/electron-api.d.ts`, `src/main/ipc/__tests__/channel-contract.test.ts` |
| Copilot | `src/main/ipc/copilot.ts`, `src/renderer/pages/Copilot.tsx`, `src/renderer/stores/settingsStore.ts`, i18n files (`settings.*`, `copilot.*` keys across all locales) |
| Errors | `src/shared/errors.ts` (`AI_NOT_CONFIGURED`, `AI_CONNECTOR_FAILED`, `AI_RESPONSE_INVALID` + `ERROR_MESSAGES`) |
| Tests | new `connector.test.ts`, `llm.test.ts`, `ai-settings.test.ts`, `copilot (provider path)`, Settings section; update `provider.test.ts` (no longer throws) and `agent.test.ts` (**async**) |

## 13. Phase / commit order

1. **Engine seam:** async `planAgent` + optional `planner` (+ deterministic tests still green). No
   behavior change.
2. **Connector contract + harness:** `AIConnector`, fake-connector test helper.
3. **Settings + safeStorage store + IPC bridge** (sanitized surface; contract tests).
4. **Connectors:** OpenAI first (JSON mode), then Gemini, Anthropic; `llm.ts` planner with
   `extractJsonObject` parse + fallback. All fetch-mocked unit tests.
5. **Copilot wiring:** factory + planner param + provider chip + Settings section + i18n.
6. **Docs:** plan-status update, README/site AI config page, privacy post.

## 14. Decision table

| ID | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| A1 | Who plans each file | LLM per file (validated) vs LLM plans whole batch (free-form) | **per file** — reuse `planFile`, one validated `RecommendedSettings` each; batch orchestration stays deterministic |
| A2 | LLM failure behavior | hard-fail vs deterministic fallback | **fallback to `rules`** per file, reason in `skips` (matches `parseLocalPlan`) |
| A3 | Key storage | `safeStorage` vs keytar vs plaintext | **safeStorage**; store only when `isEncryptionAvailable()`, else refuse with a Settings warning |
| A4 | Default when unconfigured | disabled Copilot vs rules provider | **rules provider remains default & offline**; banner nudges to Settings |
| A5 | OpenAI-compatible baseUrl | allow (covers Ollama/Groq/OpenRouter…) vs OpenAI-only | **allow**, HTTPS-only + loopback exception |
| A6 | MCP reuse in this change | yes vs later | **later** (Copilot is the deliverable; §7.3) |
| A7 | Cost guardrails | docs-only vs hard cap | **docs + existing `maxFiles` cap**; call-count hint in Settings (no new quota machinery) |

## 15. Risks

- **Async `planAgent` ripple** — mechanical but touches `copilot.ts`, `plan_agent`, and agent tests;
  mitigate by landing as a standalone behavior-neutral commit (Phase 1).
- **Per-provider divergence** (non-JSON replies, rate limits, model-name drift) — mitigated by
  strict-JSON mechanisms, `extractJsonObject` parsing, per-file fallback, configurable models.
- **Key handling hygiene** — sqlite/log paths must never see the key; pin the sanitizer with tests.
- **safeStorage unavailability** (Linux w/o keyring) — surfaced, refused-by-default.
- **Cost surprise for large folders** — `maxFiles` cap + explicit "~1 call/file" hint.

## 16. Reference

- Existing scaffold: `src/shared/ai/provider.ts` (`AIProviderUnavailableError`,
  `buildLocalPlanPrompt`, `parseLocalPlan`), `src/shared/ai/types.ts`, `src/shared/ai/agent.ts`,
  `src/mcp/local-model-client.ts` (adapter precedent), `src/main/mcp/settings.ts` /
  `settings-ipc.ts` (store precedent), `src/main/ipc/__tests__/channel-contract.test.ts` (IPC gate).
- Prior art: `plans/AI_ASSISTANT_MCP_ENHANCEMENT_PLAN.md` (§7.1-7.5 provider/privacy story; D3 local
  model shipped R4; D2 desktop copilot shipped R6).