# CLI उपयोग

EncodeX एक full CLI mode ship करता है। GUI app के साथ same binary, same transcoder pipeline — कोई browser window नहीं।

## मोड detection

CLI मोड activate होता है जब:

- `--cli` flag pass किया जाता है
- `--help` / `-h` flag pass किया जाता है
- `--version` / `-v` flag pass किया जाता है
- Two or more positional arguments present होते हैं (जो command syntax indicate करते हैं)

अन्यथा GUI normal रूप से launch होता है।

## Invocation

```bash
# From the packaged app
encodex <command> [options]

# From a repo checkout
npm start -- --cli <command> [options]
```

## Commands

### convert

```bash
encodex convert input.mp4 output.mkv --codec libx265 --bitrate 3000k --scale 1920x1080
```

| Option            | Description                                        | Default    |
| ----------------- | -------------------------------------------------- | ---------- |
| `--codec`         | Output video codec                                 | `libx264`  |
| `--audio-codec`   | Output audio codec                                 | `aac`      |
| `--bitrate`       | Video bitrate (e.g. `2000k`, `1M`)                 | –          |
| `--audio-bitrate` | Audio bitrate                                      | –          |
| `--scale`         | Output resolution (`WxH`, `W:H`, `%`)              | –          |
| `--qscale`        | Quality scale (1–31)                               | –          |
| `--pix-fmt`       | Pixel format                                       | –          |
| `--hwaccel`       | Hardware acceleration (`auto`, `encode`, `off`)    | `auto`     |
| `--transcoder`    | Core: `FFMPEG`, `FFTOOL`, `BMF`                    | `FFMPEG`   |
| `--no-audio`      | Strip the audio track                              | off        |
| `--overwrite`     | Overwrite existing output                          | off        |

### compress

```bash
encodex compress input.mp4 output.mp4 --target-size-mb 50
```

`convert` के समान options, plus `--target-size-mb` (approximate output size target) और `--quality` (`low`/`medium`/`high`)।

### extract-audio

```bash
encodex extract-audio input.mp4 --format flac -o soundtrack.flac
```

| Option         | Description                                     |
| -------------- | ----------------------------------------------- |
| `--format`     | Target audio format/container                   |
| `--track`      | Source audio stream index                       |
| `-o, --output` | Output file path (default derived from input)   |

### cut

```bash
encodex cut input.mp4 --start 00:00:10 --end 00:01:30 -o clip.mp4
```

| Option           | Description                                  |
| ---------------- | -------------------------------------------- |
| `--start`        | Segment start time (`HH:MM:SS` or seconds)   |
| `--end`          | Segment end time                             |
| `--duration`     | Alternative to `--end`                       |
| `--video-codec`  | Video codec for the cut                      |
| `--audio-codec`  | Audio codec for the cut                      |
| `-o, --output`   | Output file path                             |

### info

```bash
encodex info input.mp4
encodex info input.mp4 --json
```

Human-readable table by default; `--json` prints the full probe result.

### batch

```bash
encodex batch jobs.json --concurrency 2 --continue-on-error
```

| Option               | Description                                    |
| -------------------- | ---------------------------------------------- |
| `--concurrency`      | Parallel jobs (1–4)                            |
| `--continue-on-error`| Keep processing after a failed job             |
| `--dry-run`          | Validate and list jobs without converting      |

Jobs file format:

```json
[
  { "input": "a.mp4", "output": "a.mkv", "options": { "videoCodec": "libx265" } },
  { "input": "b.wav", "output": "b.flac" }
]
```

### capabilities

```bash
encodex capabilities
encodex capabilities --json
```

Bundled FFmpeg binary से detected hardware encoders और hwaccel methods print करता है।

## Global options

| Option        | Description                                    |
| ------------- | ---------------------------------------------- |
| `--theme`     | Console theme (`dark`/`light`)                 |
| `--verbose`   | Detailed logging                               |
| `--quiet`     | Suppress status/success lines                  |
| `--no-color`  | Disable colored output                         |
| `--json`      | Machine-readable output where supported        |
| `--timeout`   | Per-command watchdog timeout in seconds        |
| `--help`      | Command help                                   |
| `--version`   | Print version                                  |

## MCP सर्वर मोड {#mcp-server-mode}

EncodeX एक हेडलेस [Model Context Protocol](https://modelcontextprotocol.io) सर्वर के रूप में चल सकता है ताकि MCP hosts (Claude Desktop, Claude Code, VS Code, Cursor, custom agents) conversions चला सकें। यह एक **mode** है, subcommand नहीं: `--mcp` pass करें और ऐप GUI और CLI branches छोड़कर stdio पर JSON-RPC बोलता है।

```bash
# Packaged app
encodex --mcp

# Source checkout (compiled Node entry point — run npm run build:main first)
node dist/mcp/index.js

# Raw Electron form
npx electron . --mcp
```

stdout MCP JSON-RPC messages के लिए reserved है; सारा status और logging output stderr पर redirect होता है, और stdin बंद होने तक process जीवित रहता है। सर्वर 19 tools, 3 resources और 4 prompts expose करता है — पूरी catalogue के लिए [फ़ीचर रेफ़रेंस](/hi/docs/features-reference#mcp-server) देखें।

| Option  | Description                                                          |
| ------- | -------------------------------------------------------------------- |
| `--mcp` | stdio MCP सर्वर के रूप में चलाएँ (कोई GUI नहीं, कोई CLI subcommand नहीं, कोई `app.exit` नहीं) |

दूसरी, opt-in surface चल रहे GUI के अंदर **embedded HTTP सर्वर** है (`http://127.0.0.1:8765/mcp`), जो मूल कोर के ऊपर live queue, preview, timeline, system और update tools जोड़ता है। इसे **Settings → MCP Server** में enable करें; security model के लिए [फ़ीचर रेफ़रेंस](/hi/docs/features-reference#mcp-server) देखें।

## Exit codes

| Code | Meaning                        |
| ---- | ------------------------------ |
| `0`  | Success                        |
| `1`  | Generic failure                |
| `2`  | Usage error (bad arguments)    |
| `3`  | Operation cancelled            |
| `4`  | Input/output not found         |
| `5`  | Watchdog timeout exceeded      |

## Legacy invocation shim

Backward compatibility के लिए flat argument forms automatically modern subcommands पर map होते हैं:

```bash
encodex in.mp4 out.mkv --codec libx264   # -> encodex convert ...
encodex --info in.mp4                    # -> encodex info ...
```

## Examples

```bash
# Hardware-encoded H.265 with NVENC family flags resolved automatically
encodex convert clip.avi clip.mp4 --codec hevc_nvenc --hwaccel auto

# Extract lossless audio from a video
encodex extract-audio movie.mkv --format flac

# Probe a file as JSON for scripting
encodex info movie.mkv --json > probe.json

# Batch convert with two parallel workers
encodex batch queue.json --concurrency 2 --continue-on-error
```
