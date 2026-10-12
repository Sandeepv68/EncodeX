# 💻 CLI Usage

Build first, then invoke the compiled CLI via the `encodex` command (the `bin/encodex.js` launcher wraps the Electron binary). CLI mode auto-activates when two positional arguments (input + output) are given, or explicitly with `--cli`:

```bash
# Convert a file (subcommand form)
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Convert a file (legacy flat form — still works)
encodex input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Show media info as a human table
encodex info input.mp4

# Show media info as JSON
encodex info input.mp4 --json

# List transcoder capabilities
encodex capabilities
encodex capabilities --json

# Lossless copy to different container
encodex convert input.mkv output.mp4 --copy

# Cut a segment
encodex convert input.mp4 output.mp4 --start-time 00:01:00 --end-time 00:02:30

# Apply a video filter chain (forces a re-encode)
encodex convert input.mp4 output.mp4 --filters fps=30,eq=brightness=0.1

# Combine curated presets with a custom chain
encodex convert input.mp4 output.mp4 --preset grayscale --filters eq=gamma=1.2

# Compress an image
encodex compress photo.png -f jpg -q 30

# Extract audio (mp3 by default)
encodex extract-audio input.mp4

# Remux (stream copy) into a new container
encodex remux input.mkv -f mp4
encodex rmx input.mkv -o output.mp4

# Remux with extra tracks, cover art and chapters
encodex remux input.mkv -o output.mkv \
  --add-audio commentary.m4a \
  --add-subtitle 'subs.en.srt::mov_text' \
  --thumbnail cover.jpg \
  --chapters chapters.ffmeta

# Remux with a shifted audio timeline (primary + added track)
encodex remux input.mkv -o output.mkv --audio-sync 0.5 --add-audio commentary.m4a --set-sync -0.25

# Remux a single stream selection (video only, no subtitle streams)
encodex remux input.mkv -o output.mkv --map 0:v:0 --no-subtitles

# Demux every stream kind into separate files
encodex demux input.mkv --output-dir parts

# Demux only some kinds, re-encoding as requested
encodex demux input.mkv --audio --audio-codec mp3 --output-dir parts
encodex demux input.mkv --video --video-container mp4 --output-dir parts
encodex demux input.mkv --subtitles --subtitle-format srt --output-dir parts
encodex split input.mkv --audio --output-dir parts

# Batch-convert several files / globs
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted

# Use a specific transcoder core
encodex convert input.mp4 output.mp4 --transcoder FFTOOL
```

Legacy flat usage (`encodex in.mp4 out.mp4`, `encodex --info in.mp4`) is shimmed into the matching subcommand automatically. `remux` and `demux` are only reachable as explicit subcommands (or their `rmx`/`split` aliases) - a bare two-positional invocation always stays a `convert`.

To make `encodex` available globally, run `npm link` from the project root (or `npm install -g .`). The raw `npx electron . --cli ...` form still works as an alternative.

## 📋 Subcommands

| Subcommand         | Description                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `convert`          | Convert media (default when no subcommand matches). Alias: `c`    |
| `info`             | Show media info (human table, or `--json` for machine output)     |
| `capabilities`     | List available transcoder capabilities (table or `--json`)        |
| `compress`         | Compress an image                                                 |
| `extract-audio`    | Extract the audio stream (default codec `libmp3lame`). Alias: `audio` |
| `remux`            | Remux (stream copy) into another container, with optional extra tracks. Alias: `rmx` |
| `demux`            | Extract each stream into a separate file. Alias: `split`       |
| `batch`            | Convert multiple inputs (files, globs, or directories) with a queue |

## ⚙️ Global Options

Global options can be placed before or after the subcommand name.

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--transcoder <type>`       | Transcoder core: `FFMPEG`, `FFTOOL`, `BMF` (default: `FFMPEG`) |
| `--theme <id>`              | Logo color theme: `light`, `ocean`, `sunset`, `forest`, `lavender`, `rose`, `slate`, `dark` (default: `light`) |
| `--verbose`                 | Verbose logging (routes status to stderr)                      |
| `--quiet`                   | Suppress status output                                         |
| `--no-color`                | Disable ANSI colors                                            |
| `--json`                    | Machine-readable JSON output (status routed to stderr)         |
| `--timeout <seconds>`       | Conversion timeout in seconds (default: `300`)                 |

## 🔄 Convert Options

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-v, --video-codec <codec>` | Video codec (e.g. `libx264`, `libx265`, `copy`)                |
| `-a, --audio-codec <codec>` | Audio codec (e.g. `aac`, `libmp3lame`, `copy`)                 |
| `-q, --qscale <qscale>`     | Quality scale (1–31)                                           |
| `--bitrate-video <bitrate>` | Video bitrate (e.g. `1000k`)                                   |
| `--bitrate-audio <bitrate>` | Audio bitrate (e.g. `192k`)                                    |
| `--pix-fmt <format>`        | Pixel format (e.g. `yuv420p`, `yuv444p`)                       |
| `-s, --scale <WxH>`         | Output resolution (e.g. `1280x720` or `50%`)                   |
| `--start-time <time>`       | Start time (`HH:MM:SS` or seconds)                             |
| `--end-time <time>`         | End time                                                       |
| `--duration <time>`         | Duration                                                       |
| `--copy`                    | Lossless stream copy                                           |
| `--no-audio`                | Exclude the audio stream from the output                       |
| `--no-video`                | Exclude the video stream from the output (audio-only)          |
| `--hwaccel / --no-hwaccel`  | Toggle hardware acceleration                                   |
| `--hwaccel-mode <auto\|encode>` | Hardware acceleration mode (default: `auto`)             |
| `--filters <chain>`        | Video filter chain, comma-separated (e.g. `fps=30,eq=brightness=0.1`) |
| `--preset <id>`            | Curated filter preset (repeatable; ids: `crop`, `framerate`, `deinterlace`, `denoise`, `sharpen`, `color`, `grayscale`, `blur`) |
| `--info`                    | Print media info for the input and exit                        |

Filters force a re-encode: combining `--filters`/`--preset` with `--copy` is
rejected. Presets are expanded before the free-form chain while resolving
`-vf` order (`--preset grayscale --filters fps=30` → `hue=s=0,fps=30`); the
resolved chain is printed with `--verbose`.

## 🖼️ Compress Options

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`       | Output file                                                    |
| `-f, --format <format>`     | Output format (defaults from output extension)                 |
| `-q, --quality <qscale>`    | Quality scale 1–31                                             |
| `-s, --scale <WxH>`         | Output resolution                                              |

## 🎵 Extract-audio Options

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`       | Output file                                                    |
| `-a, --audio-codec <codec>` | Audio codec (default: `libmp3lame`)                            |
| `--bitrate-audio <bitrate>` | Audio bitrate (e.g. `192k`)                                    |

## 🔁 Remux Options

Stream copy between containers - no re-encode unless an added track needs one.

| Option                          | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`           | Output file (default: input name with the target extension)     |
| `-f, --format <format>`         | Target container (defaults from `--output`, then the input extension) |
| `--map <spec>`                  | Stream to copy, repeatable (`0:v:0`, `0:a:1`, …); replaces the default primary video + audio (+ subtitles) |
| `--add-subtitle <file[::codec]>` | Mux an external subtitle file; `::codec` overrides the encoder (e.g. `subs.srt::mov_text`) |
| `--add-audio <file>`            | Mux an external audio file                                     |
| `--thumbnail <image>`           | Mux cover art (attachment for MKV/WebM, `attached_pic` disposition for MP4/MOV) |
| `--chapters <file>`             | Mux a chapters file (ffmetadata)                               |
| `--no-chapters`                 | Skip chapters (also copies the source chapters by default)      |
| `--subtitle-codec <codec>`      | Encoder for added subtitles (overrides the per-file `::codec` suffix) |
| `--no-subtitles`                | Skip the source's subtitle streams (ignored with explicit `--map`) |
| `--audio-sync <seconds>`        | Shift the primary audio timeline (negative values allowed)      |
| `--set-sync <seconds>`          | Shift the preceding `--add-subtitle`/`--add-audio` input        |
| `--filters <chain>`             | Video filter chain, comma-separated (repeatable)               |

Remux is copy-first: a target container that cannot hold a selected stream (e.g. a
subtitle in WebM) is rejected with a usage error (exit `2`) instead of silently
dropping it, and a missing input, subtitle, audio, cover, or chapters file exits
with `4` before FFmpeg starts. Non-blocking findings (e.g. a container that
cannot store the chapters file) are printed as warnings and the remux proceeds.
Added subtitle codecs resolve in this order: `--subtitle-codec`, then the
per-file `::codec` suffix, then the container's default (`mov_text` for MP4/MOV,
`subrip` for MKV). `--audio-sync`/`--set-sync` use FFmpeg's re-read, so the
offset applies to the output timestamps rather than re-encoding.

`--filters` is the one escape from the lossless copy. An FFmpeg filter chain
cannot run on stream-copied streams, so passing it re-encodes the selected
streams instead of copying them and prints a `filters_force_reencode` finding.
Everything else — stream compatibility, chapter copying, `--map` — behaves
exactly as it does for a pure remux. There is no `--copy` flag on `remux`, so
the two never conflict. Chains merge in the order given and accept the same
`preset.value` shorthand as `convert` (`--filters framerate.60` → `fps=60`); an
invalid chain is a usage error and an empty chain is ignored.

```bash
encodex remux input.mp4 output.mkv --filters fps=24
encodex remux input.mkv output.mp4 --filters 'fps=24,eq=brightness=0.1' --filters scale=-2:720
```

## ✂️ Demux Options

| Option                            | Description                                                |
| --------------------------------- | ---------------------------------------------------------- |
| `--output-dir <dir>`              | Directory for the extracted streams (created when missing; default: next to the input) |
| `--video` / `--audio` / `--subtitles` | Extract only the given stream kinds                     |
| `--all`                           | Extract every kind (the default)                           |
| `--video-container <ext>`         | Re-encode video into this container when it differs from the stream's native one |
| `--audio-codec <codec>`           | Re-encode audio with this encoder (e.g. `mp3`, `flac`, `aac`) |
| `--subtitle-format <srt\|ass\|copy>` | Convert text subtitles to this format                  |
| `--video-filters <chain>`         | Video filter chain applied while re-encoding (repeatable) |

Output names are derived from the input (`movie.video.mp4`, `movie.audio_0.m4a`,
`movie.subtitle_0.srt`). Cover-art streams are never extracted (use `remux` to
keep them), bitmap subtitles (PGS/DVDSUB) cannot be converted to text and are
stream-copied to `.mks` with a warning, and a kind filter that matches no stream
is a usage error (exit `2`); a missing input file exits with `4`. Each target is
converted in turn, so `--transcoder` applies to all of them.

`--video-filters` only applies to a video target that re-encodes. A filter chain
needs a decoder, so a stream-copy video target cannot consume it: passing
`--video-filters` without a `--video-container` that re-encodes the video is
rejected with a usage error rather than silently dropped. Audio and subtitle
targets never receive the chain. As with `convert`, chains merge in the order
given, accept the `preset.value` shorthand, and are printed with `--verbose`.

```bash
encodex demux input.mp4 --video --video-container mkv --video-filters fps=24
```

## 📋 Batch Options

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--concurrency <n>`         | Max parallel conversions (default: `4`, clamped 1–4)           |
| `--output-dir <dir>`        | Output directory for converted files                           |
| `--suffix <s>`              | Suffix appended to derived output names (default: `_encodex_converted`) |

Batch also accepts all convert encoding options (`-v/--video-codec`, `-a/--audio-codec`, `--bitrate-video`, `--bitrate-audio`, `-q/--qscale`, `--pix-fmt`, `-s/--scale`, `--copy`, `--no-audio`, `--no-video`, `--filters`, `--preset`) and applies them to every job. Filters again force a re-encode, so `--copy` with filters is rejected with a usage error.

## 🤖 MCP Server Mode

EncodeX can run as a headless [Model Context Protocol](https://modelcontextprotocol.io) server so MCP hosts (Claude Desktop, Claude Code, VS Code, Cursor, custom agents) can drive conversions. This is a **mode**, not a subcommand: pass `--mcp` and the app skips the GUI and CLI branches and speaks JSON-RPC over stdio.

```bash
# Packaged app
encodex --mcp

# Source checkout (compiled Node entry point — run npm run build:main first)
node dist/mcp/index.js

# Raw Electron form
npx electron . --mcp
```

stdout is reserved for MCP JSON-RPC messages; all status and logging output is redirected to stderr, and the process stays alive until stdin closes. The server exposes 16 tools (15 operations plus the app-only `commit_operation`), 3 resources, and 4 prompts — see [`MCP.md`](MCP.md) for the full catalogue and client configuration.

| Option  | Description                                                        |
| ------- | ------------------------------------------------------------------ |
| `--mcp` | Run as a stdio MCP server (no GUI, no CLI subcommand, no `app.exit`) |

A second, opt-in surface is the **embedded HTTP server** inside the running GUI (`http://127.0.0.1:8765/mcp`), which adds live queue, preview, timeline, system, and update tools on top of the same core. Enable it in **Settings → MCP Server**; see [`MCP.md`](MCP.md#embedded-http-server-gui-mode).

## 🚪 Exit Codes

| Code | Constant                     | Meaning                                        |
| ---- | ---------------------------- | ---------------------------------------------- |
| `0`  | `EXIT_CODES.SUCCESS`         | Clean success                                  |
| `1`  | `EXIT_CODES.ERROR`           | Generic error                                  |
| `2`  | `EXIT_CODES.USAGE`           | Invalid/incomplete arguments                   |
| `3`  | `EXIT_CODES.CANCELLED`       | Operation cancelled by the user                |
| `4`  | `EXIT_CODES.NOT_FOUND`       | Input file, FFmpeg, or FFprobe not found       |
| `5`  | `EXIT_CODES.TIMEOUT`         | Conversion exceeded `--timeout`                |
