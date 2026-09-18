# 🔌 MCP Integration

EncodeX ships a full [Model Context Protocol](https://modelcontextprotocol.io) server so MCP hosts — Claude Desktop, Claude Code, VS Code, Cursor, and custom/headless agents — can probe media, convert, compress, extract audio, cut, batch-process, and (opt-in) read live GUI state. It runs over the same media engine as the CLI, so behavior is identical across surfaces.

There are two launch modes that share one tool/resource/prompt catalogue:

| Mode | Transport | Launched by | Surface |
| ---- | --------- | ----------- | ------- |
| **Standalone** | stdio | `encodex --mcp` or `node dist/mcp/index.js` | 13 core tools |
| **Embedded** | Streamable HTTP | Toggle in **Settings → MCP Server** | 13 core + 6 GUI-parity tools = **19** |

Related docs: [`CLI.md`](CLI.md), [`IPC.md`](IPC.md), [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 🚀 Quick start

Build the app first (the MCP entry is emitted as `dist/mcp/index.js`):

```bash
npm install
npm run build:main
```

Then start the standalone server:

```bash
# Source checkout
node dist/mcp/index.js

# Packaged app / global link (see CLI.md)
encodex --mcp

# Raw Electron form
npx electron . --mcp
```

stdout is reserved exclusively for MCP JSON-RPC messages — every log line is redirected to stderr. The server stays alive until stdin closes, then exits.

> **Windows note:** Electron's main process does not relay piped stdin through `process.stdin`, so the stdio transport reads/writes raw file descriptors (fd 0 / fd 1). This is transparent to clients but is why `--mcp` uses a dedicated runner.

---

## 🧩 Client configuration

### Claude Desktop / Claude Code

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```jsonc
{
  "mcpServers": {
    "encodex": {
      "command": "node",
      "args": ["C:/path/to/EncodeX/dist/mcp/index.js"]
    }
  }
}
```

For a packaged install, point at the binary and pass `--mcp`:

```jsonc
{
  "mcpServers": {
    "encodex": {
      "command": "C:/Program Files/EncodeX/EncodeX.exe",
      "args": ["--mcp"]
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json` (or your user `mcp.json`):

```jsonc
{
  "servers": {
    "encodex": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/path/to/EncodeX/dist/mcp/index.js"]
    }
  }
}
```

The embedded HTTP server is a remote MCP server:

```jsonc
{
  "servers": {
    "encodex-gui": {
      "type": "http",
      "url": "http://127.0.0.1:8765/mcp",
      "headers": { "Authorization": "Bearer <token-if-configured>" }
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` (same shape as Claude Desktop for stdio). For the embedded server, use the HTTP `url` form shown above.

### Headless / custom agents

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

## 🛠️ Tool catalogue

All tools return a single JSON text payload. Failures set `isError` and return `{ ok: false, code, message, detail }`.

### Core tools (both modes)

| Tool | Key inputs | Returns |
| ---- | ---------- | ------- |
| `ping` | — | `{ pong: true }` |
| `convert_media` | `input`, `output?`, `videoCodec?`, `audioCodec?`, `videoBitrate?`, `audioBitrate?`, `qscale?`, `scale?`, `keepAspectRatio?`, `rotate?`, `flipH?`, `flipV?`, `pixelFormat?`, `startTime?`, `endTime?`, `duration?`, `copy?`, `audio?`, `video?`, `hardwareAcceleration?`, `hwaccelMode?`, `extraArgs?`, `transcoder?`, `concurrency?` | `{ jobId, input, output, status, transcoder }` |
| `get_job` | `jobId` | Job record (status, percent, time, speed, fps, eta, bitrate, error?) |
| `list_jobs` | — | All jobs with status/progress |
| `cancel_job` | `jobId` | `{ jobId, cancelled: true }` |
| `get_media_info` | `input` | `MediaInfo` (container + stream metadata) |
| `list_capabilities` | — | `{ videoEncoders, audioEncoders, hwaccels }` |
| `list_profiles` | — | Built-in profile summaries |
| `get_profile` | `profileId` | Full profile configuration |
| `compress_image` | `input`, `output?`, `format?`, `quality?`, `scale?`, `transcoder?` | `{ jobId, …, format }` |
| `extract_audio` | `input`, `output?`, `audioCodec?`, `bitrate?`, `transcoder?` | `{ jobId, …, audioCodec, extension }` |
| `cut_video` | `input`, `output?`, `startTime?`, `endTime?`, `duration?`, `copy?`, `audio?`, `extraArgs?`, `transcoder?` | `{ jobId, … }` |
| `batch_convert` | `inputs[]`, `outputDir?`, `suffix?`, `concurrency?` + convert options | `{ total, jobs: [{ file, output, jobId, status }] }` |

### GUI-parity tools (embedded mode only)

| Tool | Key inputs | Returns |
| ---- | ---------- | ------- |
| `get_queue_state` | — | `{ jobs, pending }` for the live GUI queue |
| `cancel_all_jobs` | — | `{ cancelled: true }` (mirrors the GUI "cancel all") |
| `get_timeline` | `input` | `{ file, format, duration, fps, width, height, codec }` |
| `extract_preview` | `input` | `{ dataUrl }` — base64 PNG frame (mirrors the player thumbnail) |
| `get_system_info` | — | `{ appVersion, platform, arch, os: { type, release, cpu, cpuCount, totalMemory, freeMemory } }` |
| `check_for_updates` | — | `{ available, current, latest?, releaseUrl? }` |

---

## 📚 Resources

| URI | Content |
| --- | ------- |
| `encodex://profiles` | Full `BUILTIN_PROFILES` catalogue as JSON |
| `encodex://capabilities` | FFmpeg encoders and hardware accelerations detected on this system |
| `encodex://codecs` | UI-ordered video/audio codecs with labels and groups |

## 💬 Prompts

| Prompt | Arguments | Purpose |
| ------ | --------- | ------- |
| `convert-video` | `input`, `output?`, `videoCodec?`, `audioCodec?`, `quality?` | Guided conversion workflow |
| `extract-audio` | `input`, `audioCodec?`, `bitrate?` | Audio extraction workflow |
| `compress-image` | `input`, `format?`, `quality?`, `scale?` | Image optimization / fit-to-size |
| `batch-convert` | `inputs`, `outputDir?`, `videoCodec?`, `audioCodec?`, `quality?` | Multi-file conversion workflow |

> Prompt arguments follow the MCP string-only constraint, so `batch-convert` takes a comma-separated `inputs` string rather than an array.

---

## ⏳ Async job model

Conversions run for seconds to minutes, so `convert_media`, `compress_image`, `extract_audio`, `cut_video`, and `batch_convert` return a `jobId` immediately rather than blocking the call. Poll with `get_job` / `list_jobs` (or `get_queue_state` in embedded mode) until the status is `done`, `error`, or `cancelled`; cancel with `cancel_job`.

Jobs are held in memory. In embedded mode the MCP job manager is **shared with the GUI queue**, so tools and the UI observe the same jobs and `cancel_all_jobs` affects the visible queue.

---

## 🌐 Embedded HTTP server (GUI mode)

Enable it in **Settings → MCP Server**, optionally set a port and bearer token, then run a conversion from the UI. The server binds `127.0.0.1` only and adds the GUI-parity tools on top of the core surface.

- **Endpoint:** `http://127.0.0.1:8765/mcp` (default)
- **Port range:** 1024–65535 (default `8765`)
- **State:** off by default; persisted in `mcp-settings.json` under the Electron `userData` directory:
  - Windows: `%APPDATA%\EncodeX\mcp-settings.json`
  - macOS: `~/Library/Application Support/EncodeX/mcp-settings.json`
  - Linux: `~/.config/EncodeX/mcp-settings.json`
- **Live updates:** changing enabled/port/token applies immediately — the server restarts without an app restart.

### Security model

- Binds `127.0.0.1` exclusively; remote hosts cannot connect.
- `Origin`, when present, must be `http://127.0.0.1:<port>` or `http://localhost:<port>` (DNS-rebinding defense); otherwise `403`.
- Optional bearer token: when set, every request must send `Authorization: Bearer <token>` (compared timing-safely); otherwise `401`.
- Only `GET` / `POST` / `DELETE` on `/mcp` are accepted.
- Sessions are force-closed when the server is stopped or the app quits.

**Deliberately excluded from the MCP surface:** destructive filesystem tools, arbitrary shell/exec, settings writes, window minimize/maximize/close, live player frame/audio streaming, `--dev` handlers, and `TERMS_REJECT`.

> The token is stored in plaintext in `mcp-settings.json`. It gates a loopback-only, single-user interface, so it is equivalent to the app's own trust boundary.

---

## 🩺 Troubleshooting

| Symptom | Fix |
| ------- | --- |
| Client lists no tools | Run `npm run build:main` so `dist/mcp/index.js` exists, then reload the MCP client. |
| Connection refused on `http://127.0.0.1:8765/mcp` | Enable the server in Settings and confirm the port; another process may already use it. |
| `401 Unauthorized` | A token is configured. Send `Authorization: Bearer <token>` or clear the token in Settings. |
| `403 Forbidden origin` | A browser client sent a foreign `Origin`; use an MCP client or a permitted loopback origin. |
| Server exits immediately | Ensure the client keeps stdin open and read logs from stderr. |

---

## ✅ Verification

Run the smoke test against the compiled stdio server:

```bash
npm run build:main
npm run mcp:smoke            # node dist/mcp/index.js
npm run mcp:smoke:electron   # electron . --mcp (requires a display / xvfb on Linux)
```

Both assert the handshake, the 13-tool stdio catalogue, and a live `ping`. (The 6 GUI-parity tools are only reachable through the embedded HTTP server.)
