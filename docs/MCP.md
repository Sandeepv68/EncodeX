# 🔌 MCP Integration

EncodeX ships a full [Model Context Protocol](https://modelcontextprotocol.io) server so MCP hosts — Claude Desktop, Claude Code, VS Code, Cursor, and custom/headless agents — can probe media, convert, compress, extract audio, cut, remux, demux, batch-process, and (opt-in) read live GUI state. It runs over the same media engine as the CLI, so behavior is identical across surfaces.

There are two launch modes that share one tool/resource/prompt catalogue:

| Mode | Transport | Launched by | Surface |
| ---- | --------- | ----------- | ------- |
| **Standalone** | stdio | `encodex --mcp` or `node dist/mcp/index.js` | 15 core tools |
| **Embedded** | Streamable HTTP | Toggle in **Settings → MCP Server** | 15 core + 6 GUI-parity tools = **21** |

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
| `convert_media` | `input`, `output?`, `videoCodec?`, `audioCodec?`, `videoBitrate?`, `audioBitrate?`, `qscale?`, `scale?`, `keepAspectRatio?`, `rotate?`, `flipH?`, `flipV?`, `pixelFormat?`, `startTime?`, `endTime?`, `duration?`, `copy?`, `audio?`, `video?`, `hardwareAcceleration?`, `hwaccelMode?`, `videoFilters?`, `filters?`, `presets?`, `extraArgs?`, `transcoder?`, `concurrency?` | `{ jobId, input, output, status, transcoder }` |
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
| `remux_media` | `input`, `container?`, `output?`, `map?`, `subtitles?`, `addSubtitle[]`, `addAudio[]`, `thumbnail?`, `chapters?`, `subtitleCodec?`, `audioSyncSeconds?`, `videoFilters?`, `transcoder?` | `{ jobId, …, container, map, warnings }` |
| `demux_media` | `input`, `outputDir?`, `video?`, `audio?`, `subtitles?`, `all?`, `videoContainer?`, `audioCodec?`, `subtitleCodec?`, `videoFilters?`, `transcoder?` | `{ total, transcoder, jobs: [{ kind, streamIndex, copy, codec, output, jobId, status }], warnings }` |

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

### Video filters (`convert_media` / `batch_convert`)

`convert_media` (and `batch_convert`, which shares its field set) applies FFmpeg
video filters via three independent inputs, merged in this order:

1. **`presets`** — curated preset ids expanded to their default expressions
   (`grayscale`, `crop`, `framerate`, `deinterlace`, `denoise`, `sharpen`,
   `color`, `blur`).
2. **`filters`** — a comma-joined free-form chain (`"fps=30,eq=brightness=0.1"`).
3. **`videoFilters`** — an explicit array of filter expressions.

Filters require **re-encoding**: combining them with `copy: true` fails with
`FILTERS_REQUIRE_RE_ENCODE`, and an invalid entry or unknown preset fails with
`INVALID_VIDEO_FILTERS` before any job is enqueued. `extraArgs` is independent —
it appends raw output arguments while `videoFilters`/`filters`/`presets` build
the single `-vf` chain.

Example call:

```json
{
  "input": "/media/clip.mp4",
  "videoCodec": "libx264",
  "presets": ["grayscale"],
  "filters": "fps=30",
  "scale": "1280x720"
}
```

### Remux & demux (`remux_media` / `demux_media`)

Both tools probe the source first (like the `remux` / `demux` CLI subcommands and
the Remux / Demux pages), so the default stream selection and the output naming
match those surfaces exactly.

**`remux_media`** stream-copies into another container. `container` defaults to
the output extension, then the input extension. `map` overrides the default
selection (every probed stream, or every stream except subtitles when
`subtitles: false`); `addSubtitle` / `addAudio` add external tracks in argument
order; `thumbnail` embeds cover art (`attachment` for MKV/WebM, `attached_pic`
for MP4/MOV — inferred from the container unless `type` says otherwise);
`chapters` takes `"source"` (keep the source chapters, the default) or
`{ "file": "meta.txt" }` to import an FFMETADATA file; `audioSyncSeconds` shifts
the input's own audio (positive = audio plays later).

`videoFilters` is the one escape from the lossless copy. A filter chain needs a
decoder, so a non-empty `videoFilters` re-encodes the selected streams instead of
stream-copying them and reports a `filters_force_reencode` warning (there is no
`copy` field on `remux_media`, so the two never conflict). Each entry accepts the
`preset.value` shorthand (`"framerate.60"` → `fps=60`); an invalid entry fails with
`INVALID_VIDEO_FILTERS` before any job is enqueued.

Example call:

```json
{
  "input": "/media/movie.mp4",
  "container": "mkv",
  "addSubtitle": [{ "file": "/media/forced.srt", "syncOffsetSeconds": 0.5 }],
  "addAudio": [{ "file": "/media/commentary.m4a" }],
  "thumbnail": { "file": "/media/cover.jpg" },
  "chapters": "source"
}
```

Example response:

```json
{
  "jobId": "6f1c…",
  "input": "/media/movie.mp4",
  "output": "/media/movie.mkv",
  "status": "queued",
  "transcoder": "FFMPEG",
  "container": "mkv",
  "map": ["0:v:0", "0:a:0", "0:s:0"],
  "warnings": []
}
```

Example call with a filter chain (re-encodes rather than copies):

```json
{
  "input": "/media/movie.mp4",
  "container": "mkv",
  "videoFilters": ["fps=24", "framerate.60"]
}
```

Example response:

```json
{
  "jobId": "9a4d…",
  "output": "/media/movie.mkv",
  "container": "mkv",
  "warnings": ["filters_force_reencode"]
}
```

**`demux_media`** writes one output per selected stream. Pass any of `video`,
`audio`, `subtitles` to select kinds (all kinds when none is given, or with
`all: true`); `videoContainer`, `audioCodec`, and `subtitleCodec` re-encode a
kind instead of copying it (`copy` or an omitted value keeps the stream as-is,
and bitmap subtitles always stay stream-copied). Outputs land in `outputDir`
(created when missing) or next to the input, named `<stem>.<kind>[_<n>].<ext>`.
Cover-art video streams are skipped — remux them instead.

`videoFilters` applies to a video target that re-encodes. A stream-copied video
target cannot consume the chain, so it is dropped there and reported as a
`filtersIgnoredCopy` warning; audio and subtitle targets never receive it. Unlike
the `demux` CLI, the tool does not reject the combination — it queues the copy and
tells you the filters were ignored. The `preset.value` shorthand is accepted
(`"framerate.60"` → `fps=60`) and an invalid entry fails with
`INVALID_VIDEO_FILTERS` before any job is enqueued.

Example call:

```json
{ "input": "/media/movie.mkv", "audio": true, "audioCodec": "mp3" }
```

Example response:

```json
{
  "total": 1,
  "transcoder": "FFMPEG",
  "jobs": [
    {
      "kind": "audio",
      "streamIndex": 1,
      "copy": false,
      "codec": "mp3",
      "output": "/media/movie.audio_0.mp3",
      "jobId": "2b90…",
      "status": "queued"
    }
  ],
  "warnings": []
}
```

Failure codes shared by both tools:

| Code | Meaning |
| ---- | ------- |
| `FILE_NOT_FOUND` | The `input` file does not exist. |
| `AUXILIARY_INPUT_NOT_FOUND` | A `remux_media` subtitle/audio/cover/chapters file does not exist. |
| `INVALID_FORMAT` | No target container could be determined. |
| `INCOMPATIBLE_CONTAINER` | A selected stream, the cover art, or an imported chapters file cannot be stored in the target container. |
| `STREAM_NOT_FOUND` | `demux_media` found no stream of the requested kind. |
| `INVALID_VIDEO_FILTERS` | A `videoFilters` entry is malformed, too long, or too numerous. |

`warnings` carries the non-blocking findings as plain code strings — for example
`filters_force_reencode` (`remux_media` re-encoding because of a filter chain),
`filtersIgnoredCopy` (`demux_media` dropping filters on a copied video target), or
a subtitle codec a container accepts only after conversion. The codes above are
hard failures that reject the request before any job is enqueued.

---

## ⏳ Async job model

Conversions run for seconds to minutes, so `convert_media`, `compress_image`, `extract_audio`, `cut_video`, `batch_convert`, `remux_media`, and `demux_media` return a `jobId` immediately rather than blocking the call. Poll with `get_job` / `list_jobs` (or `get_queue_state` in embedded mode) until the status is `done`, `error`, or `cancelled`; cancel with `cancel_job`. `demux_media` returns one job id per extracted stream.

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

Both assert the handshake, the 15-tool stdio catalogue, and a live `ping`. (The 6 GUI-parity tools are only reachable through the embedded HTTP server.)

For the complete local surface — every stdio tool with real FFmpeg conversions, the standalone HTTP transport with its auth/topology guards, and the 21-tool embedded server exactly as `.vscode/mcp.json` dials it:

```bash
npm run build
npm run mcp:full-test   # --skip-stdio / --skip-http / --skip-gui / --keep-tmp
```
