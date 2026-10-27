# ✨ Features

EncodeX is a cross-platform multimedia conversion tool that brings the power of FFmpeg to a modern, intuitive desktop interface. Built with Electron, React, and TypeScript, it lets you convert media between formats, extract audio, cut videos, and compress images — all through a clean, responsive UI with a batch queue, hardware acceleration, conversion profiles, CLI mode, an MCP server for AI assistants, and full internationalization.

> **Version:** the app is currently at `1.0.0-beta.5`, in the 1.0 production-readiness phase (release hardening, blocking audit gate, per-file coverage ratchet, mutation ratchet). The embedded MCP server and the local-model/STT/translation runtimes are the newest subsystems and are still opt-in.

## 🔄 Feature Overview

### Media Conversion

Convert between video/audio formats with granular controls over codec selection (51 video codecs across software and hardware encoder families, 27 audio codecs), bitrate, output resolution (with optional aspect-ratio preservation), pixel format (56 formats grouped by bit depth), quality scale (qscale), audio track inclusion, and transcoder core selection. Multiple files can be queued through the Batch Queue (see below). <!-- drift:video-codecs=51 --> <!-- drift:audio-codecs=27 --> <!-- drift:pixel-formats=56 -->

### Media Rotation & Mirroring

Rotate videos and images by 90°, 180°, or 270° clockwise and mirror them (horizontal/vertical flip) from both the Convert page and the Batch Queue (transcode and compress-image panels, plus the per-job options dialog). Rotation uses FFmpeg's `transpose` filter (`transpose=1` / `transpose=2,transpose=2` / `transpose=2`) combined with `hflip`/`vflip` into a single `-vf` filter chain alongside `scale`; mirrors always re-encode. In stream-copy mode, rotation is stored losslessly as `-metadata:s:v rotate=N` for MP4/MOV/MKV outputs only; other containers and image outputs always take the pixel (re-encode) path.

### Conversion Profiles

Choose from 115 built-in conversion presets organized into 8 categories to instantly configure codec, bitrate, quality, resolution, and container settings — no manual tweaking required. <!-- drift:builtin-profiles=115 --> <!-- drift:profile-categories=8 --> Categories include:

- **Web & Social** — optimized presets for YouTube, Instagram, TikTok, Facebook, and X (Twitter)
- **Devices** — Apple (iPhone, iPad, Apple TV), Android, gaming consoles (PlayStation, Xbox, Nintendo Switch)
- **Video Codecs** — codec-specific presets (H.264, H.265/HEVC, VP8, VP9, AV1, ProRes, DNxHD/HR, FFV1, and more)
- **Professional** — broadcast and post-production formats (ProRes 422/4444, DNxHD/HR)
- **Streaming** — HLS and DASH adaptive streaming presets
- **Audio** — audio-only presets (MP3, AAC, FLAC, Opus, WAV) with configurable bitrate
- **Images** — image conversion presets for JPEG, PNG, WebP, and AVIF with quality controls
- **Advanced** — raw FFmpeg argument presets and custom FFmpeg passthrough for power users

Selecting a profile automatically fills in all relevant conversion fields (codec, bitrate, CRF, scale, pixel format, container). Profiles can be applied on both the Convert page and the Batch Queue.

#### Custom Profiles

Create, edit, and save your own custom conversion profiles. Custom profiles persist to `localStorage` and appear alongside the built-in catalogue. Builtin profiles are immutable — they cannot be edited or deleted.

#### Recently Used

The 5 most recently applied profiles are tracked and shown in a dedicated section for quick access.

#### Extra Arguments

Advanced and professional profiles can include raw FFmpeg `extraArgs` and `inputArgs` that are passed directly to the FFmpeg command line, enabling use cases like ProRes `-profile:v` flags, HLS `-hls_time` parameters, and null-output pipelines.

> **Note:** Conversion profiles are available in the GUI only. The CLI uses explicit flags (`--video-codec`, `--audio-codec`, etc.) for conversion settings.

### Lossless Copy

Stream-copy video or audio tracks without re-encoding (`-c copy`). Useful for fast container format changes, remuxing, or when quality preservation is critical.

### Remux & Demux

- **Remux** — change the container while stream-copying the selected tracks. You can add external subtitle and audio tracks, embed cover art, import or drop chapters, and apply sync offsets without re-encoding. The one exception is a video filter chain, which forces a re-encode of the video stream.
- **Demux** — split a file into per-stream outputs (video, audio, subtitles), with optional per-kind conversion: re-encode video into another container, re-encode audio with a chosen encoder, or convert text subtitles to another format. Stream-copied video targets ignore video filters and report a warning.

### Video Filters

Apply up to 8 curated filter presets or a custom FFmpeg filter chain (200 characters per entry) during conversion. <!-- drift:video-filter-presets=8 --> The presets are crop, framerate, deinterlace, denoise, sharpen, color, grayscale, and blur; custom `videoFilters` expressions run after scale and rotation. Filters require re-encoding and cannot be combined with stream copy.

### Hardware Acceleration

Hardware-accelerated encoding with auto-detection of available encoder families. Supports NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox, and Microsoft Media Foundation encoders. Acceleration can be toggled, with a mode selector — `auto` adds the matching FFmpeg `-hwaccel` flags for the selected hardware encoder family, `encode` relies on the encoder's own acceleration — and an encoder-type filter (`auto` / `hardware` / `software`) that narrows the video codec picker to all, GPU-only, or CPU-only encoders. Available encoders are probed from the bundled FFmpeg binary at runtime and the codec pickers are filtered to what the binary actually provides.

### Media Information

Probe media files and inspect detailed per-stream information: codec, profile, level, resolution, display aspect ratio, pixel format, bit depth, color range/space/transfer/primaries, frame rate, bitrate, sample rate, sample format, channel count/layout, duration, start time, frame count, language, and tags. Works with video, audio, and subtitle streams.

### Image Compression

Compress images (JPEG, PNG, WebP, BMP, GIF, TIFF, PPM, PGM, PBM) with configurable quality scale and resolution scaling using FFmpeg's image codecs. Includes a live preview, a file-size readout, and — for JPEG/PNG/WebP inputs — a full EXIF metadata panel with RGB and luma histograms.

### Audio Extraction

Extract audio tracks from video files. Output as AAC, MP3, AC3, FLAC, WAV, Vorbis, Opus, ALAC, or any of the 27 supported audio codecs. The source audio stream is selectable when multiple tracks are present.

### Video Cutting

Preview and cut video segments with frame-accurate start/end time or duration selection. Includes a built-in player that decodes video frames (via an FFmpeg rawvideo pipe to an HTML Canvas element) and audio (via a separate S16LE PCM pipe converted to float and fed to the Web Audio API) in lockstep, with a zoomable multi-track timeline: video thumbnail montage, audio waveform, keep/dim region shading, drag-to-trim handles, and a scrubbing playhead.

### Batch Queue

Process multiple files with five configurable operations (transcode, extract audio, compress image, remux, demux). Jobs are added through a review dialog where output names and options can be adjusted before they enter the queue.

- **Parallel processing** — run up to 4 jobs concurrently (`MAX_QUEUE_CONCURRENCY = 4`); the GUI default is 1, and the concurrency cap is configurable at runtime (1-4) and persisted.
- **Queue lifecycle** — start, pause, and resume the whole queue; cancel all; clear completed/failed jobs; remove individual jobs.
- **Reordering** — drag-and-drop reordering of queued jobs (with a drop area), backed by a `QUEUE_MOVE_TO` channel that reports the job's new position.
- **Job editing** — replace the options (and optionally the output path) of any queued job before it starts (`QUEUE_UPDATE_OPTIONS`).
- **Export / import** — save the queue to a JSON file and re-import it later (`QUEUE_EXPORT` / `QUEUE_IMPORT`), validated with a dedicated `INVALID_QUEUE_FILE` error code.
- **Folder / path import** — pick a source folder (`select-folder-files`) or drop a mixed list of files and directories (`expand-paths`); both are expanded recursively into supported media files.
- **Persistence** — the queue snapshot (jobs + concurrency) is durably saved to `queue-state.json` in the user-data directory and restored on startup.
- **Status filters** — filter the job list by queued / running / done / failed, plus a focusable search field.
- **When-done power actions** — optionally shut down, sleep, or hibernate the machine when the queue drains (`shutdown`, `pmset`, or `systemctl` per platform; Windows honors a force-close flag).
- **Live feedback** — real-time per-job progress (percent, time, speed, ETA) streamed over IPC, per-job error handling, and a nav count badge showing outstanding work.

### Multiple Transcoder Cores

- **FFmpeg API** — fluent-ffmpeg Node.js bindings with programmatic progress events
- **FFmpeg CLI** — direct CLI invocation via child process, no native bindings needed
- **BMF Framework** — BMF CLI tools for advanced pipeline scenarios (requires separate installation)

### Copilot (AI Assistant)

The Copilot page turns a goal into a reviewable plan and can run it against the same media engine. It supports 13 operations: six queue-backed actions (convert, remux, demux, extract audio, compress image, cut) and seven read-only intelligence actions (analyze, transcribe, summarize, chapters, search transcript, translate, find similar). <!-- drift:copilot-operations=13 -->

AI providers are rules (the deterministic offline router and default), OpenAI, Anthropic, Gemini, and a local model runtime. OpenAI, Anthropic, and Gemini require an API key; the local provider runs on-device. Every plan is a proposal — nothing is queued until you confirm it.

### MCP Server

EncodeX ships a full [Model Context Protocol](https://modelcontextprotocol.io) server so AI assistants and custom agents can drive the same media engine. Two launch modes share one tool catalogue:

- **Standalone (stdio)** — `encodex --mcp` or `node dist/mcp/index.js`: 36 model-visible tools (37 registrations including the app-only `commit_operation`). <!-- drift:mcp-tools=36 --> <!-- drift:mcp-registrations=37 -->
- **Embedded (Streamable HTTP)** — toggle in **Settings → MCP Server**: the 37 registrations + 6 GUI-parity tools (live queue state, preview, timeline, system info, updates) = **43** total (42 model-visible), bound to `127.0.0.1:8765/mcp` by default with optional bearer-token auth. <!-- drift:mcp-gui-tools=6 -->

See the [[MCP]] page for the full tool catalogue, client configuration, and security model.

### MCP Apps (Interactive Views)

Beyond plain JSON tool results, the MCP surface can render interactive views inside the host client via the [MCP Apps](https://modelcontextprotocol.io) extension. `src/mcp/ui/` ships a resource registry, a renderer bridge, and an approval flow, plus 11 views:

| View          | Purpose                                                     |
| ------------- | ----------------------------------------------------------- |
| `batch`       | Batch job list and per-job actions                          |
| `confirm`     | Confirmation prompt before a mutating operation             |
| `convert`     | Conversion job detail and progress                          |
| `error`       | Structured failure with suggested fixes                     |
| `inspector`   | Media inspector for the selected file                       |
| `job`         | Single job status card                                      |
| `lab`         | Media lab (analysis, recommendations, experiments)         |
| `media-info`  | Stream-level media information                             |
| `plan`        | Reviewable plan (the same plan object the Copilot uses)    |
| `queue`       | Live queue state                                            |
| `workflow`    | Multi-step workflow runner                                  |

Operations that mutate the queue go through the approval bridge, so an agent cannot silently start work without the user seeing the plan.

### Local Model Runtime

Beyond the hosted providers, EncodeX can run models on-device:

- **Local provider** — `local`, routed through `src/mcp/local-model-client.ts`; point it at a local runtime with `ENCODEX_LOCAL_MODEL_URL` and select the model with `ENCODEX_LOCAL_MODEL_MODEL`.
- **Speech-to-text** — the whisper adapter in `src/mcp/stt-engine.ts`; configured with `ENCODEX_WHISPER_BIN` and `ENCODEX_WHISPER_MODEL`. When no engine is configured, transcription calls fail with the typed `TRANSCRIPTION_UNAVAILABLE` error instead of silently returning nothing.
- **Translation** — `src/mcp/translate-engine.ts`; raises `TRANSLATION_UNAVAILABLE` when no engine is configured.

### Output Size Estimation

`src/shared/estimate.ts` provides an output-size estimate before a conversion runs. The figure is an **experimental rough upper bound**, not a guarantee, and is always labelled as an estimate wherever it is surfaced (Copilot plans, MCP `estimate_conversion`).

### Audit Trail

Mutating operations (conversions, queue edits, plan commits) emit structured audit entries via `src/shared/audit.ts`. Entries stream to the renderer over the `audit-entry` IPC channel and are stored by the `auditStore`, so a run can be reviewed after the fact. The audit contract is provider-agnostic and independent of the error-monitoring layer.

### Settings

Dedicated settings page for theme, hardware acceleration (enable/disable, mode, encoder type), window always-on-top, launch-at-login, batch queue concurrency, the when-done power action, the embedded MCP server (enable, port, token), the AI provider, and the usage data & error reporting toggle. Preferences persist and take effect on startup.

### Keyboard Shortcuts

A central shortcut registry (`src/renderer/constants/shortcuts.ts`) defines 71 shortcuts across 11 sections (global, convert, media info, image compress, audio extract, video cut, remux, demux, batch queue, logs, dashboard). <!-- drift:shortcuts=71 --> <!-- drift:shortcut-sections=11 --> Highlights:

- `Ctrl+/` — open the shortcuts help dialog
- `Alt+0`…`Alt+9` — jump directly to a page (Remux is `Alt+0`)
- `Ctrl+O` / `Ctrl+Shift+S` / `Ctrl+Enter` — pick input / pick output / start the job (consistent across pages)
- `Ctrl+Shift+P` / `Ctrl+Shift+C` — pause / cancel the active job
- `Ctrl+Alt+T` — toggle the theme
- Batch queue: `Ctrl+E` export, `Ctrl+I` import, `1`–`5` status filters, `F` focus search
- Logs: `Ctrl+L` clear, `Ctrl+Shift+D` download
- Video cut player: `Space` play/pause, `M` mute, arrow keys to seek, `U` duration toggle, `A` include audio
- Dashboard: number keys `1`–`8` jump straight to the tools

Chords are matched by `event.code`, so they work independently of keyboard layout. Tooltips derive their hint text from the same registry.

### Activity Blips & Job Popover

While a conversion, audio extraction, or video cut is running, a flashing blip appears on the corresponding nav row; the Batch Queue row shows a live count of outstanding jobs. Hovering (or keyboard-focusing) a blip opens a popover anchored to it with the job's title, localized status (including paused state and parallel-concurrency badge), source-file thumbnail, file name, and a live progress bar — plus a pile of pending-job thumbnails while a batch advances. The popover uses a soft shadow and its arrow points at the blip.

### Close Confirmation

Closing the window while jobs are active routes through a confirmation flow: the main process asks the renderer (`WINDOW_CLOSE_REQUESTED`), which shows a dialog listing active work before the close is confirmed (`WINDOW_CONFIRM_CLOSE`). A splash screen is shown on boot while the main window loads.

### Terms & Conditions Gate

On first launch (and whenever the terms version changes), a Terms & Conditions dialog gates the application. Accepting persists the version to `localStorage`; rejecting quits immediately via the `TERMS_REJECT` channel (which bypasses the close-confirmation round-trip). The full agreement is versioned in `src/shared/terms.ts` and re-viewable from the About page.

### Dashboard

A landing page with quick-action tiles for every tool (number keys `1`–`8` jump straight to them) and seasonal easter-egg branding (see below).

### Easter Eggs

On festival dates the Dashboard swaps the default app logo for holiday artwork — Christmas, Halloween, New Year, July 4th, Easter, Diwali, and Holi. Each festival is active for a 7-day window around its date; Diwali and Holi follow the Hindu lunisolar calendar via curated dates (2026–2035) with an astronomical fallback computation for other years.

### Logs

Live log viewer that aggregates console output from both the main and renderer processes over IPC. Supports level filtering (DEBUG/INFO/WARN/ERROR), clearing, and downloading the log as a `.txt` file. Every log line comes from a shared template constant (`log-constants.ts`) so strings stay consistent and searchable.

### Notifications

Toast notifications (success/info/warning/error) with configurable duration for non-blocking feedback, layered on top of the global error snackbar.

### Custom Window Frame

Frameless application window with a custom title bar providing minimize / maximize-toggle / close controls, a draggable region, and always-on-top support. A non-interactive splash screen is shown while the main window loads.

### Dark / Light Theme

System-aware theme detection with manual toggle (`Ctrl+Alt+T`). Theme preference persists to `localStorage` (`encodex-theme` key).

### RTL Support

Right-to-left layout support for Arabic and Hebrew locales (`ar-SA`, `ar-AE`, `ar-JO`, `he-IL`). Direction toggles automatically on language switch via an Emotion RTL style plugin.

### Error Monitoring

Provider-agnostic error monitoring (first adapter: Sentry) with user-controlled consent in Settings, main + renderer capture, native crash minidumps, CPU profiling, and `Logger.error()` bridging. On by default but fully toggleable; all events stream through the shared `MONITORING_*` IPC channels. See the [[Monitoring]] page for details.

### Usage Analytics

Provider-agnostic, categorical-only usage analytics (first adapter: Aptabase) driven by the same Settings consent switch as error monitoring. Events never contain media content, file names, paths, or sizes; a per-group emission gate (`ANALYTICS_GROUPS`) can silence noisy groups without a release. See the [[Analytics]] page for details.

### Internationalization

56 locales (36 distinct base language subtags): <!-- drift:locales=56 --> <!-- drift:locale-subtags=36 -->

| Language    | Locales                                    |
| ----------- | ------------------------------------------ |
| English     | `en-US`, `en-GB`, `en-IN`, `en-CA`, `en-AU`, `en-SG`, `en-ZA`, `en-NZ`, `en-IE` |
| Spanish     | `es-ES`, `es-MX`, `es-AR`, `es-CL`         |
| French      | `fr-FR`, `fr-CA`, `fr-BE`                  |
| Hindi       | `hi-IN`                                    |
| German      | `de-DE`, `de-BE`                           |
| Italian     | `it-IT`                                    |
| Dutch       | `nl-NL`, `nl-BE`                           |
| Swedish     | `sv-SE`                                    |
| Norwegian   | `nb-NO`                                    |
| Portuguese  | `pt-BR`, `pt-PT`                           |
| Ukrainian   | `uk-UA`                                    |
| Russian     | `ru-RU`                                    |
| Polish      | `pl-PL`                                    |
| Thai        | `th-TH`                                    |
| Sinhala     | `si-LK`                                    |
| Mongolian   | `mn-MN`                                    |
| Malay       | `ms-MY`, `ms-SG`                           |
| Chinese     | `zh-SG`, `zh-TW`                           |
| Japanese    | `ja-JP`                                    |
| Korean      | `ko-KR`                                    |
| Indonesian  | `id-ID`                                    |
| Filipino    | `fil-PH`, `tl-PH`                          |
| Afrikaans   | `af-ZA`                                    |
| Hebrew      | `he-IL`                                    |
| Arabic      | `ar-SA`, `ar-AE`, `ar-JO`                  |
| Nepali      | `ne-NP`                                    |
| Khmer       | `km-KH`                                    |
| Vietnamese  | `vi-VN`                                    |
| Lao         | `lo-LA`                                    |
| Maori       | `mi-NZ`                                    |
| Icelandic   | `is-IS`                                    |
| Greenlandic | `kl-GL`                                    |
| Irish       | `ga-IE`                                    |
| Finnish     | `fi-FI`                                    |
| Danish      | `da-DK`                                    |

### In-App Updates

Custom update manager that checks GitHub Releases for new versions, notifies the user of availability, downloads the platform-specific installer (`.exe` / `.dmg` / `.AppImage`) in-app with real-time progress reporting, and installs it when the user chooses (or schedules it for the next restart). When GitHub publishes an asset digest, the download is verified against its SHA-256 or SHA-512 value; there is no signature verification. Version comparison follows semver precedence: the numeric core, then pre-release identifiers (numeric lower than alphanumeric, longer set wins), with build metadata ignored. The update flow is fully integrated into the About page with a "Check for Updates" button and a global dialog.

### Error Handling

Structured error system with typed error codes (`ErrorCode`), user-facing localized messages, a global error snackbar, inline error banners, toast notifications, nested React error boundaries, and an in-app error history (cap 50). All errors are normalized through `formatError()` and propagated across IPC.

## 🎞️ Supported Media Formats

### Video Codecs (51)

| Group                      | Codecs                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Software (28)**          | H.264 (libx264, libx264rgb), H.265/HEVC (libx265, Kvazaar), VP8 (libvpx), VP9 (libvpx-vp9), AV1 (libaom-av1, SVT-AV1, rav1e), MPEG-4 (libxvid, mpeg4), MPEG-1, MPEG-2, Theora, JPEG 2000 (libopenjpeg), WebP (libwebp, libwebp_anim), ProRes (prores, prores_ks), Huffyuv, FFV1, Ut Video, MJPEG, PNG, TIFF, VC-2, AVS (libxavs, libxavs2) |
| **NVIDIA NVENC (3)**       | H.264 (h264_nvenc), H.265 (hevc_nvenc), AV1 (av1_nvenc)                                                                                                                                                                                                                                                                                    |
| **Intel QSV (5)**          | H.264, H.265, MPEG-2, VP9, AV1                                                                                                                                                                                                                                                                                                             |
| **AMD AMF (3)**            | H.264, H.265, AV1                                                                                                                                                                                                                                                                                                                          |
| **VAAPI (6)**              | H.264, H.265, MJPEG, VP8, VP9, AV1                                                                                                                                                                                                                                                                                                         |
| **Apple VideoToolbox (4)** | H.264, H.265, ProRes, VP9                                                                                                                                                                                                                                                                                                                  |
| **Media Foundation (2)**   | H.264, H.265                                                                                                                                                                                                                                                                                                                               |

### Audio Codecs (27)

| Group             | Codecs                                                    |
| ----------------- | --------------------------------------------------------- |
| **AAC / MPEG**    | AAC (native, FDK), MP3 (LAME, libshine), MP2 (libtwolame) |
| **Dolby**         | AC-3, E-AC-3, TrueHD, DTS, MLP                            |
| **Lossless**      | FLAC, ALAC, WavPack                                       |
| **Streaming**     | Vorbis, Opus, Speex, AMR-WB                               |
| **PCM**           | s16le, s24le, f32le, s16be, u8, A-law, Mu-law             |
| **Windows Media** | WMA v1, WMA v2                                            |
| **Other**         | ADPCM IMA (WAV)                                           |

### Pixel Formats (56)

| Group               | Formats                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| **YUV 8-bit**       | yuv420p, yuv422p, yuv444p, yuv410p, yuv411p, yuv440p, yuvj420p, yuvj422p, yuvj444p     |
| **YUV 10-bit**      | yuv420p10le, yuv422p10le, yuv444p10le                                                  |
| **YUV 12-bit**      | yuv420p12le, yuv422p12le, yuv444p12le                                                  |
| **YUV 16-bit**      | yuv420p16le, yuv444p16le                                                               |
| **YUV Semi-planar** | nv12, nv21, nv16, nv20le                                                               |
| **YUV with Alpha**  | yuva420p, yuva422p, yuva444p, yuva420p10le, yuva444p10le, yuva444p16le                 |
| **RGB Packed**      | rgb24, bgr24, rgb0, bgr0, rgba, bgra, argb, abgr, rgb48le, bgr48le, rgba64le, bgra64le |
| **Planar RGB**      | gbrp, gbrp10le, gbrp12le, gbrp16le, gbrap, gbrap10le, gbrap16le                        |
| **Monochrome**      | gray, gray10le, gray12le, gray16le, grayf32le, ya8, ya16le                             |
| **HDR**             | p010le, p016le, x2rgb10le                                                              |

### Input File Extensions

| Category | Extensions                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Video    | `mp4`, `m4v`, `avi`, `mkv`, `mov`, `qt`, `flv`, `f4v`, `wmv`, `asf`, `webm`, `3gp`, `3g2`, `mpg`, `mpeg`, `mts`, `m2ts`, `ts`, `mxf`, `ogv`, `ogg`, `vob`, `divx`, `dv`, `rm`, `rmvb`, `h264`, `h265`, `hevc` |
| Audio    | `mp3`, `aac`, `wav`, `flac`, `ogg`, `opus`, `m4a`, `wma`, `alac`, `aiff`, `aif`, `au`, `caf`, `pcm`, `mid`, `midi`                                                                                            |
| Image    | `jpg`, `jpeg`, `png`, `webp`, `bmp`, `gif`, `tiff`, `tif`, `svg`, `ico`, `heic`, `heif`, `avif`, `ppm`, `pgm`, `pbm`, `xbm`                                                                                   |
| Subtitle | `srt`, `ass`, `ssa`, `vtt`, `sub`, `idx`, `smi`                                                                                                                                                               |

## ✔️ Validation Utilities

| Function                     | Description                | Accepted Formats                                      |
| ---------------------------- | -------------------------- | ----------------------------------------------------- |
| `isValidTime(value)`         | Validates time strings     | `HH:MM:SS`, `HH:MM:SS.mmm`, seconds as number         |
| `isValidScale(value)`        | Validates resolution/scale | `WxH`, `W:H`, percentage `1%`–`999%`, positive number |
| `isValidBitrate(value)`      | Validates bitrate strings  | e.g. `128k`, `1M`, `2000K`                            |
| `isInRange(value, min, max)` | Checks numeric range       | Any finite number                                     |

## 🧮 Transcoder Constants

| Constant                                          | Value                                                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRANSCODER_TYPES`                                | `['FFMPEG', 'FFTOOL', 'BMF']`                                                                                                                                     |
| `TRANSCODER_LABELS`                               | `{ FFMPEG: 'FFmpeg (API)', FFTOOL: 'FFmpeg (CLI)', BMF: 'BMF Framework' }`                                                                                        |
| `FFMPEG_FLAGS`                                    | `-c`, `-vcodec`, `-acodec`, `-b:v`, `-b:a`, `-qscale:v`, `-vf`, `-pix_fmt`, `-color_range`, `-ss`, `-to`, `-t`, `-y`, `-i`, `-an`, `-vn`, `-sn`, `-dn`, `-re`, `-copyts` |
| `FFPROBE_FLAGS`                                   | `-v quiet -print_format json -show_format -show_streams`                                                                                                          |
| `TRANSCODER_COMMANDS`                             | `bmf_ffmpeg`, `bmf_ffprobe`, `ffmpeg`, `ffprobe`                                                                                                                  |
| `TRANSCODER_DEFAULTS.PROGRESS_INTERVAL_MS`        | `500`                                                                                                                                                             |
| `TRANSCODER_DEFAULTS.PLAYER_DEFAULT_WIDTH/HEIGHT` | `640` / `360`                                                                                                                                                     |
| `TRANSCODER_DEFAULTS.PLAYER_FPS_CAP`              | `30`                                                                                                                                                              |
| `TRANSCODER_DEFAULTS.FFPROBE_TIMEOUT_MS`          | `30000`                                                                                                                                                           |
| `CONVERSION_DEFAULTS.VIDEO_CODEC`                 | `libx264`                                                                                                                                                         |
| `CONVERSION_DEFAULTS.AUDIO_CODEC`                 | `aac`                                                                                                                                                             |
| `CONVERSION_DEFAULTS.QSCALE`                      | `23`                                                                                                                                                              |
| `CONVERSION_DEFAULTS.PIXEL_FORMAT`                | `yuv420p`                                                                                                                                                         |
| `CONVERSION_DEFAULTS.SCALE`                       | `1920x1080`                                                                                                                                                       |
| `CONVERSION_DEFAULTS.VIDEO_BITRATE`               | `2000k`                                                                                                                                                           |
| `CONVERSION_DEFAULTS.AUDIO_BITRATE`               | `192k`                                                                                                                                                            |
| `QSCALE_RANGE.MIN/MAX`                            | `1` / `31`                                                                                                                                                        |