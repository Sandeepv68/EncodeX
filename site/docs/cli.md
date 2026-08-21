# CLI Usage

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

# Compress an image
encodex compress photo.png -f jpg -q 30

# Extract audio (mp3 by default)
encodex extract-audio input.mp4

# Batch-convert several files / globs
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted

# Use a specific transcoder core
encodex convert input.mp4 output.mp4 --transcoder FFTOOL
```

Legacy flat usage (`encodex in.mp4 out.mp4`, `encodex --info in.mp4`) is shimmed into the matching subcommand automatically.

To make `encodex` available globally, run `npm link` from the project root (or `npm install -g .`). The raw `npx electron . --cli ...` form still works as an alternative.

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `convert` | Convert media (default when no subcommand matches). Alias: `c` |
| `info` | Show media info (human table, or `--json` for machine output) |
| `capabilities` | List available transcoder capabilities (table or `--json`) |
| `compress` | Compress an image |
| `extract-audio` | Extract the audio stream (default codec `libmp3lame`). Alias: `audio` |
| `batch` | Convert multiple inputs (files, globs, or directories) with a queue |

## Global Options

Global options can be placed before or after the subcommand name.

| Option | Description |
|--------|-------------|
| `--transcoder <type>` | Transcoder core: `FFMPEG`, `FFTOOL`, `BMF` (default: `FFMPEG`) |
| `--theme <id>` | Logo color theme: `light`, `ocean`, `sunset`, `forest`, `lavender`, `rose`, `slate`, `dark` (default: `light`) |
| `--verbose` | Verbose logging (routes status to stderr) |
| `--quiet` | Suppress status output |
| `--no-color` | Disable ANSI colors |
| `--json` | Machine-readable JSON output (status routed to stderr) |
| `--timeout <seconds>` | Conversion timeout in seconds (default: `300`) |

## Convert Options

| Option | Description |
|--------|-------------|
| `-v, --video-codec <codec>` | Video codec (e.g. `libx264`, `libx265`, `copy`) |
| `-a, --audio-codec <codec>` | Audio codec (e.g. `aac`, `libmp3lame`, `copy`) |
| `-q, --qscale <qscale>` | Quality scale (1-31) |
| `--bitrate-video <bitrate>` | Video bitrate (e.g. `1000k`) |
| `--bitrate-audio <bitrate>` | Audio bitrate (e.g. `192k`) |
| `--pix-fmt <format>` | Pixel format (e.g. `yuv420p`, `yuv444p`) |
| `-s, --scale <WxH>` | Output resolution (e.g. `1280x720` or `50%`) |
| `--start-time <time>` | Start time (`HH:MM:SS` or seconds) |
| `--end-time <time>` | End time |
| `--duration <time>` | Duration |
| `--copy` | Lossless stream copy |
| `--no-audio` | Exclude the audio stream from the output |
| `--no-video` | Exclude the video stream from the output (audio-only) |
| `--hwaccel / --no-hwaccel` | Toggle hardware acceleration |
| `--hwaccel-mode <auto\|encode>` | Hardware acceleration mode (default: `auto`) |
| `--info` | Print media info for the input and exit |

## Compress Options

| Option | Description |
|--------|-------------|
| `-o, --output <file>` | Output file |
| `-f, --format <format>` | Output format (defaults from output extension) |
| `-q, --quality <qscale>` | Quality scale 1-31 |
| `-s, --scale <WxH>` | Output resolution |

## Extract-audio Options

| Option | Description |
|--------|-------------|
| `-o, --output <file>` | Output file |
| `-a, --audio-codec <codec>` | Audio codec (default: `libmp3lame`) |
| `--bitrate-audio <bitrate>` | Audio bitrate (e.g. `192k`) |

## Batch Options

| Option | Description |
|--------|-------------|
| `--concurrency <n>` | Max parallel conversions (default: `4`, clamped 1-4) |
| `--output-dir <dir>` | Output directory for converted files |
| `--suffix <s>` | Suffix appended to derived output names (default: `_encodex_converted`) |

Batch also accepts all convert encoding options (`-v/--video-codec`, `-a/--audio-codec`, `--bitrate-video`, `--bitrate-audio`, `-q/--qscale`, `--pix-fmt`, `-s/--scale`, `--copy`, `--no-audio`, `--no-video`) and applies them to every job.

## Exit Codes

| Code | Constant | Meaning |
|------|----------|---------|
| `0` | `EXIT_CODES.SUCCESS` | Clean success |
| `1` | `EXIT_CODES.ERROR` | Generic error |
| `2` | `EXIT_CODES.USAGE` | Invalid/incomplete arguments |
| `3` | `EXIT_CODES.CANCELLED` | Operation cancelled by the user |
| `4` | `EXIT_CODES.NOT_FOUND` | Input file, FFmpeg, or FFprobe not found |
| `5` | `EXIT_CODES.TIMEOUT` | Conversion exceeded `--timeout` |
