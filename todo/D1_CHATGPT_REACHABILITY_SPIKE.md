# D1 — ChatGPT reachability spike (go / no-go)

Status: **decided** (R5). Recommendation: **no-go for a hosted relay; conditional go for a
documented, user-supplied tunnel.** Default behaviour stays "loopback only, ChatGPT
unsupported."

## Context

ChatGPT is the one target host that is **remote-only**: its MCP connectors run on OpenAI's
servers and dial an HTTPS endpoint they can reach. Every other supported host (Claude Desktop,
VS Code, Codex, Gemini CLI, Zed) talks to EncodeX either over stdio or over a loopback HTTP
listener on the same machine.

EncodeX's HTTP transport is deliberately loopback-only:

- `assertLoopbackBind` refuses any host outside `{127.0.0.1, ::1, localhost}`
  (`src/mcp/http.ts:107`, `MCP_HTTP_LOOPBACK_HOSTNAMES` at `src/mcp/http.ts:68`).
- `Host`/`Origin` headers are checked against the same loopback set (`isLoopbackHeader`).
- Bearer auth is optional and constant-time; tokens may never ride in the query string
  (`FORBIDDEN_QUERY_PARAMS`).
- Request bodies are capped at 10 MB and the session table at 64 (`src/mcp/http.ts:58,65`).

So today ChatGPT cannot reach a default EncodeX install, **by design**.

## Question

Should R5 add anything to change that, and if so what is the smallest safe change?

## Options

| # | Option | What ships | Trust impact |
| - | ------ | ---------- | ------------ |
| a | Document unsupported | Nothing; state the limitation | None |
| b | Opt-in tunnel | User runs their own tunnel (cloudflared/ngrok) to the loopback port; EncodeX keeps loopback-only | User-chosen exposure |
| c | Hosted relay | EncodeX-operated internet endpoint that brokers to the client | Third party in the path |

## Findings

1. **A tunnel needs no code from us.** The loopback listener already speaks standard
   Streamable HTTP with a bearer token; pointing a user-run tunnel at
   `http://127.0.0.1:<port>/mcp` is sufficient for a personal ChatGPT developer-mode connector.
   Anything that auto-starts a tunnel would mean EncodeX punching a hole in the user's NAT
   without a per-session, explicit action — unacceptable for the product's privacy posture.
2. **OAuth 2.1 is what a remote path actually requires.** ChatGPT connectors expect OAuth 2.1
   with Resource Indicators (RFC 8707) and dynamic client registration for anything beyond a
   throwaway developer connector; a bare bearer token is a developer-mode shortcut, not a
   directory-ready story. Shipping OAuth means an authorization server, token endpoints, and a
   consent surface — none of which EncodeX has today.
3. **A hosted relay breaks the moat.** EncodeX's stated differentiator (§9.4 of the roadmap) is
   local processing: media and metadata never leave the machine. A relay operated by the project
   would sit in the trust path for at least the MCP control channel and the streamed
   `structuredContent` (paths, codecs, transcripts). That is a different company, not a feature.
4. **The control channel alone is not harmless.** Even with tunnelled transport, MCP exposes
   file paths and lets the model propose file writes. Exposing that to OpenAI's servers is a
   deliberate, informed choice a user may make — but it must be their choice, per session.

## Recommendation (go / no-go)

- **No-go on (c) hosted relay.** It changes the trust model and the project's identity for a
  host that is not a stated priority. Revisit only if a first-party EncodeX cloud product exists.
- **Conditional go on (b), documentation only.** Keep the code loopback-only. Document the
  user-run-tunnel path (with a strong bearer token, an explicit warning, and a note that
  ChatGPT will see paths and proposed operations) as an advanced, off-by-default recipe. Ship
  **no** auto-tunnel and **no** OAuth in R5.
- **Default stays (a).** "ChatGPT unsupported without a user-provided tunnel" is the honest,
  shippable answer for R5.

## Follow-ups (not R5)

- If a remote path is ever productised, the minimum bar is **OAuth 2.1 + resource indicators**,
  an explicit per-session consent screen, and a disclosed list of what leaves the machine — only
  then would the roadmap's "OAuth 2.1 if any remote path ships" clause be actionable.
- Re-evaluate D1 after R6; the F20 agent loop is far more valuable to local hosts than a
  relay to ChatGPT.
