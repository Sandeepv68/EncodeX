# EncodeX

A cross-platform multimedia conversion tool built on FFmpeg, React, TypeScript, and Electron.

## Features

### Media Conversion
Convert between video/audio formats with granular controls over codec selection (50+ video codecs, 30+ audio codecs), bitrate, output resolution, pixel format (60+ formats grouped by bit depth), quality scale (qscale), and transcoder core selection. Supports batch mode for processing multiple files sequentially.

### Lossless Copy
Stream-copy video or audio tracks without re-encoding. Useful for fast container format changes, remuxing, or when quality preservation is critical.

### Media Information
Probe media files and inspect detailed stream information: codec, resolution, frame rate, bitrate, sample rate, channel count, duration, pixel format, and language. Works with video, audio, and subtitle streams.

### Image Compression
Compress images (JPEG, PNG, WebP, BMP, GIF, TIFF, PPM, PGM, PBM) with configurable quality scale and resolution scaling using FFmpeg's image codecs.

### Audio Extraction
Extract audio tracks from video files. Output as AAC, MP3, AC3, FLAC, WAV, Vorbis, Opus, or ALAC.

### Video Cutting
Preview and cut video segments with frame-accurate start/end time or duration selection. Includes a built-in raw-video player that decodes frames via FFmpeg pipe to an HTML Canvas element.

### Batch Queue
Process multiple files sequentially with configurable operations (transcode, extract audio, compress image). Queue persists state across jobs with real-time progress tracking and per-job error handling.

### Multiple Transcoder Cores
- **FFmpeg API** — fluent-ffmpeg Node.js bindings with programmatic progress events
- **FFmpeg CLI** — direct CLI invocation via child process, no native bindings needed
- **BMF Framework** — BMF CLI tools for advanced pipeline scenarios (requires separate installation)

### Dark / Light Theme
System-aware theme detection with manual toggle. Theme preference persists to `localStorage` (`openconverter-theme` key).

### RTL Support
Right-to-left layout support for Arabic locales (`ar-SA`, `ar-AE`). Direction toggles automatically on language switch.

### CLI Mode
Headless command-line interface for scripting and automation. Supports all conversion options, lossless copy, cutting, and media info inspection.

### Internationalization
20 locales across 11 languages:

| Language | Locales |
|----------|---------|
| English | `en-US`, `en-GB`, `en-IN`, `en-CA` |
| Spanish | `es-ES`, `es-MX` |
| French | `fr-FR`, `fr-CA` |
| Hindi | `hi-IN` |
| German | `de-DE` |
| Italian | `it-IT` |
| Dutch | `nl-NL` |
| Swedish | `sv-SE` |
| Portuguese | `pt-BR` |
| Ukrainian | `uk-UA` |
| Japanese | `ja-JP` |
| Korean | `ko-KR` |
| Indonesian | `id-ID` |
| Arabic | `ar-SA`, `ar-AE` |

### Error Handling
Structured error system with typed error codes (`ErrorCode`), user-facing localized messages, a global error snackbar, inline error banners, and nested React error boundaries. All errors are normalized through `formatError()` and propagated across IPC.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [FFmpeg](https://ffmpeg.org/) — bundled via `ffmpeg-static`; falls back to system `ffmpeg` if the bundled binary is unavailable

## Install

```bash
npm install
```

This installs all dependencies including `ffmpeg-static` which downloads a platform-specific FFmpeg binary during its postinstall script.

## Development

```bash
# Start Vite dev server + tsc watch (no Electron window)
npm run dev

# Full dev environment with Electron window
npm run electron:dev

# Quick start (build then launch)
npm run dev:start
```

`npm run dev` starts two processes concurrently:
1. **Vite** — serves the React renderer on `http://localhost:5173` with HMR
2. **tsc** — watches and compiles the main process TypeScript to `dist/main/`

`npm run electron:dev` waits for Vite to be ready, compiles both main and preload, then launches Electron with the `--dev` flag pointing at the Vite dev server URL. DevTools open automatically.

## Build

```bash
# Production build (renderer + main + preload)
npm run build

# Package for current platform (no installer)
npm run pack

# Create distributable installer
npm run dist
```

| Script | Description |
|---|---|
| `npm run build:renderer` | Vite production build — outputs to `dist/renderer/` |
| `npm run build:main` | `tsc -p tsconfig.main.json` — outputs to `dist/main/` |
| `npm run build:preload` | `tsc -p tsconfig.preload.json` — outputs to `dist/preload/` |
| `npm run build` | All three in sequence |
| `npm run start` | Launch compiled app from `dist/` |
| `npm run pack` | Build + electron-builder `--dir` |
| `npm run dist` | Build + electron-builder (NSIS/DMG/AppImage) |

## CLI Usage

```bash
npx tsx src/main/cli.ts input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Show media info as JSON
npx tsx src/main/cli.ts input.mp4 --info

# Lossless copy to different container
npx tsx src/main/cli.ts input.mkv output.mp4 --copy

# Cut a segment
npx tsx src/main/cli.ts input.mp4 output.mp4 -ss 00:01:00 -to 00:02:30

# Use a specific transcoder core
npx tsx src/main/cli.ts input.mp4 output.mp4 --transcoder FFTOOL
```

### CLI Options

| Option | Description |
|---|---|
| `--transcoder <type>` | Transcoder core: `FFMPEG`, `FFTOOL`, `BMF` (default: `FFMPEG`) |
| `-v, --video-codec <codec>` | Video codec (e.g. `libx264`, `libx265`, `copy`) |
| `-a, --audio-codec <codec>` | Audio codec (e.g. `aac`, `libmp3lame`, `copy`) |
| `-b:v, --bitrate-video <bitrate>` | Video bitrate (e.g. `1000k`) |
| `-b:a, --bitrate-audio <bitrate>` | Audio bitrate (e.g. `192k`) |
| `-q, --qscale <qscale>` | Quality scale (0–51) |
| `--pix-fmt <format>` | Pixel format (e.g. `yuv420p`, `yuv444p`) |
| `-s, --scale <WxH>` | Output resolution (e.g. `1280x720` or `50%`) |
| `-ss, --start-time <time>` | Start time (`HH:MM:SS` or seconds) |
| `-to, --end-time <time>` | End time |
| `-t, --duration <duration>` | Duration |
| `--copy` | Lossless stream copy |
| `--info` | Print media info as JSON and exit |

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage report
npm run test:coverage

# Unit tests only
npm run test:unit

# Integration tests (matches src/**/*.integration.{test,spec}.{ts,tsx})
npm run test:integration

# E2E tests (requires build)
npm run test:e2e
```

Coverage reports are generated in `coverage/`:
- `coverage/index.html` — browsable HTML
- `coverage/lcov.info` — LCOV for IDE integration

### Test Structure

| Area | File | Tests | What's Covered |
|---|---|---|---|
| **Shared** | `errors.test.ts` | 30 | `createError`, `formatError`, `isAppError`, all error codes, edge cases |
| | `constants.test.ts` | 22 | IPC channels, transcoder types, FFMPEG flags, UI constants, codec lists |
| | `types.test.ts` | 8 | All interfaces and enums |
| **Main** | `job-queue.test.ts` | 7 | Add, remove, cancel, cancelAll, events, status flow |
| | `interface.test.ts` | 1 | Transcoder interface contract |
| **Stores** | `errorStore.test.ts` | 10 | showError, showErrorMessage, clearError, history cap |
| | `queueStore.test.ts` | 6 | CRUD operations on job queue |
| | `conversionStore.test.ts` | 15 | All state setters, defaults |
| **Hooks** | `useErrorHandler.test.ts` | 7 | handleError, handleErrorMessage, wrapAsync, clearError |
| **Components** | `ErrorBanner.test.tsx` | 7 | Rendering null/error/detail, close button, severity icons |
| | `ErrorBoundary.test.tsx` | 4 | Error UI, custom fallback, Try Again reset |
| | `ProgressBar.test.tsx` | 4 | Percentage formatting, 0-100 clamping |
| **Integration** | `error-flow.test.ts` | 8 | Full pipeline: Error -> formatError -> store -> display -> clear |

### Test Setup

The test environment (`src/test-setup.ts`) provides:
- Mocked `useTranslation` from `react-i18next` with English key mapping
- Mocked `electronAPI` on `globalThis` covering all IPC methods
- Registers `@testing-library/jest-dom/vitest` matchers

## Project Structure

```
src/
├── main/                              # Electron main process
│   ├── index.ts                       # Entry: CLI detection, window creation
│   ├── cli.ts                         # Commander-based CLI entry point
│   ├── ipc/
│   │   └── handlers.ts                # IPC handler registrations (error-wrapped)
│   ├── player/
│   │   └── frame-decoder.ts           # Rawvideo pipe -> Canvas frame decoder
│   ├── queue/
│   │   └── job-queue.ts               # Async serial batch queue with EventEmitter
│   └── transcoders/
│       ├── interface.ts               # ITranscoder contract {getInfo, convert, cancel, getType}
│       ├── ffmpeg-core.ts             # fluent-ffmpeg API core
│       ├── fftool-core.ts             # Direct CLI invocation via child_process
│       └── bmf-core.ts                # BMF framework CLI wrapper
├── preload/
│   └── index.ts                       # contextBridge exposes electronAPI to renderer
├── renderer/                          # React UI (served by Vite)
│   ├── main.tsx                       # React entry: HashRouter + DirectionProvider + I18nextProvider
│   ├── App.tsx                        # Root layout: Drawer, routes, theme toggle, lang selector
│   ├── ColorModeContext.tsx            # Dark/light theme context + RTL direction
│   ├── theme.ts                       # MUI light/dark theme definitions
│   ├── electron-api.d.ts              # Global Window.electronAPI type declaration
│   ├── global.css                     # Global styles
│   ├── test-setup.ts                  # Vitest setup: mocks for i18n + electronAPI
│   ├── components/
│   │   ├── CodecSelect.tsx            # Grouped codec dropdown (video/audio)
│   │   ├── ErrorBanner.tsx            # Inline error banner (color-coded by severity)
│   │   ├── ErrorBoundary.tsx          # React class-based error boundary
│   │   ├── ErrorSnackbar.tsx          # Global toast notification
│   │   ├── FileDropZone.tsx           # Drag-and-drop file selector
│   │   ├── MediaPlayer.tsx            # Canvas-based video player
│   │   └── ProgressBar.tsx            # Conversion progress (LinearProgress)
│   ├── hooks/
│   │   ├── useConversion.ts           # Conversion orchestration hook
│   │   └── useErrorHandler.ts         # Error handling utilities
│   ├── i18n/
│   │   ├── config.ts                  # i18next init with 20 locale resources
│   │   ├── DirectionProvider.tsx       # RTL/LTR direction provider
│   │   ├── useLanguageDirection.ts     # Hook for detecting language direction
│   │   └── locales/                    # 20 JSON locale files
│   ├── pages/
│   │   ├── Dashboard.tsx              # Home / quick action cards
│   │   ├── Convert.tsx                # Media conversion form
│   │   ├── MediaInfo.tsx              # File probe / stream info display
│   │   ├── ImageCompress.tsx          # Image compression form
│   │   ├── AudioExtract.tsx           # Audio extraction form
│   │   ├── VideoCut.tsx               # Video cutting + media player
│   │   └── BatchQueue.tsx             # Batch job management
│   └── stores/
│       ├── conversionStore.ts         # Conversion form state (Zustand)
│       ├── errorStore.ts              # Error state + history (cap 50)
│       ├── queueStore.ts              # Batch queue job state (Zustand)
│       └── settingsStore.ts           # User settings (Zustand)
└── shared/
    ├── errors.ts                      # ErrorCode enum, AppError interface, formatError()
    ├── ipc-channels.ts                # All IPC channel name constants
    ├── transcoder-constants.ts        # FFmpeg flags, defaults, progress patterns
    ├── types.ts                       # Shared interfaces: ConversionOptions, QueueJob,
    │                                  #   MediaInfo, MediaStreamInfo, PlayerFrame, etc.
    └── ui-constants.ts                # UI layout, file extensions, codec lists, nav items

e2e/
├── vitest.e2e.config.ts               # Vitest config for e2e (node env, 60s timeout)
├── helpers.ts                         # E2E helper utilities
├── cli.spec.ts                        # CLI binary e2e tests
└── app.spec.ts                        # Electron app e2e tests
```

## Architecture

### Render Tree

```
<React.StrictMode>
  <HashRouter>
    <DirectionProvider direction={...}>
      <I18nextProvider i18n={i18n}>
        <ColorModeProvider>
          <CssBaseline />
          <AppLayout>
            <Drawer />                   ← Persistent sidebar navigation
            <ErrorBoundary>              ← Global safety net
              <Routes>
                <ErrorBoundary>          ← Per-page isolation
                  <Dashboard | Convert | MediaInfo | ImageCompress | AudioExtract | VideoCut | BatchQueue />
                    ├── ErrorBoundary    ← Sub-component isolation (FileDropZone, CodecSelect, etc.)
                    ├── ErrorBanner      ← Inline per-page error
                    ├── FileDropZone
                    ├── CodecSelect
                    ├── MediaPlayer
                    └── ProgressBar
                </ErrorBoundary>
              </Routes>
            </ErrorBoundary>
            <ErrorSnackbar />            ← Global toast (outside ErrorBoundary)
          </AppLayout>
        </ColorModeProvider>
      </I18nextProvider>
    </DirectionProvider>
  </HashRouter>
</React.StrictMode>
```

### Data Flow

```
User Action (React page)
    │
    ▼
Zustand Store (renderer state)
    │
    ▼
electronAPI.invoke(channel, args)   ← IPC via contextBridge
    │
    ▼
IPC Handler (main process)
    │
    ▼
Transcoder (ffmpeg-core | fftool-core | bmf-core)
    │
    ▼
fluent-ffmpeg / child_process / BMF CLI
    │
    ▼
Progress events flow back via IPC callback → renderer store → UI
```

### Error Flow

```
throw new Error(...)
    │
    ▼
formatError(err)                    ← shared/errors.ts
    │  normalizes to AppError { code, message, detail, timestamp }
    ▼
errorStore.showError()              ← stores in currentError + errorHistory (cap 50)
    │
    ├── ErrorSnackbar               ← global toast, auto-dismiss 6s
    ├── ErrorBanner                 ← inline per-page, closable
    └── ErrorBoundary               ← React crash catch-all (nested per-page + per-component)
```

### Error Codes

The error system (`src/shared/errors.ts`) defines 14 typed error codes:

| Code | Severity | Default Message |
|---|---|---|
| `FILE_NOT_FOUND` | error | The selected file could not be found |
| `FFMPEG_NOT_FOUND` | error | FFmpeg binary not found |
| `FFPROBE_NOT_FOUND` | error | FFprobe binary not found |
| `CONVERSION_FAILED` | error | The conversion process failed |
| `INVALID_FORMAT` | warning | File format not supported |
| `PROBE_FAILED` | warning | Could not read media file information |
| `QUEUE_ERROR` | error | A batch queue job failed |
| `PLAYER_ERROR` | error | Video player encountered an error |
| `CANCELLED` | info | Operation cancelled by user |
| `BMF_NOT_AVAILABLE` | warning | BMF framework not installed |
| `OUTPUT_NOT_SPECIFIED` | info | Output file not specified |
| `INPUT_NOT_SPECIFIED` | info | Input file not specified |
| `PERMISSION_DENIED` | error | Permission denied |
| `UNKNOWN` | error | Unexpected error |

`formatError()` infers error codes from error messages and system error codes (e.g. `ENOENT`, `EACCES`).

### IPC Channels

#### Requests (invoke from renderer)

| Channel | Arguments | Returns |
|---|---|---|
| `select-file` | `filters?` | `string \| null` |
| `select-files` | `filters?` | `string[]` |
| `select-output` | — | `string \| null` |
| `get-media-info` | `filePath, transcoderType` | `MediaInfo` |
| `convert-file` | `input, output, options, transcoderType` | `void` |
| `cancel-conversion` | — | `void` |
| `queue-add` | `input, output, options, transcoder` | `string` (job id) |
| `queue-remove` | `id` | `void` |
| `queue-list` | — | `QueueJob[]` |
| `queue-cancel-all` | — | `void` |
| `player-open` | `filePath` | `void` |
| `player-seek` | `time` | `void` |
| `player-close` | — | `void` |
| `player-get-frame` | — | `PlayerFrame \| null` |

#### Events (send to renderer)

| Channel | Payload |
|---|---|
| `conversion-progress` | `{ input, output, progress }` |
| `queue-added` | `QueueJob` |
| `queue-removed` | `string` (job id) |
| `queue-status-change` | `QueueJob` |
| `queue-progress` | `{ job, progress }` |
| `queue-cancelled` | — |
| `player-frame` | `{ data, width, height, pts }` |

### `window.electronAPI` (contextBridge API)

The preload script exposes all IPC via `window.electronAPI`:

**Invocation methods:**
- `selectFile(filters?) → Promise<string | null>`
- `selectFiles(filters?) → Promise<string[]>`
- `selectOutput() → Promise<string | null>`
- `getMediaInfo(filePath, transcoderType) → Promise<MediaInfo>`
- `convertFile(input, output, options, transcoderType) → Promise<void>`
- `cancelConversion() → Promise<void>`
- `queueAdd(input, output, options, transcoder) → Promise<string>`
- `queueRemove(id) → Promise<void>`
- `queueList() → Promise<QueueJob[]>`
- `queueCancelAll() → Promise<void>`
- `playerOpen(filePath) → Promise<void>`
- `playerSeek(time) → Promise<void>`
- `playerClose() → Promise<void>`
- `playerGetFrame() → Promise<PlayerFrame | null>`

**Event listeners (each returns a cleanup function):**
- `onConversionProgress(cb) → () => void`
- `onQueueAdded(cb) → () => void`
- `onQueueRemoved(cb) → () => void`
- `onQueueStatusChange(cb) → () => void`
- `onQueueProgress(cb) → () => void`
- `onQueueCancelled(cb) → () => void`
- `onPlayerFrame(cb) → () => void`

## Supported Media Formats

### Video Codecs (50+)

| Group | Codecs |
|---|---|
| **Software** | H.264 (libx264, libx264rgb), H.265/HEVC (libx265), VP8 (libvpx), VP9 (libvpx-vp9), AV1 (libaom-av1, SVT-AV1, rav1e), MPEG-4 (libxvid, mpeg4), MPEG-1/2, Theora, JPEG 2000, WebP, ProRes, Huffyuv, FFV1, Ut Video, MJPEG, PNG, TIFF |
| **NVIDIA NVENC** | H.264 (NVENC), H.265 (NVENC), AV1 (NVENC) |
| **Intel QSV** | H.264 (QSV), H.265 (QSV), MPEG-2 (QSV), VP9 (QSV), AV1 (QSV) |
| **AMD AMF** | H.264 (AMF), H.265 (AMF), AV1 (AMF) |
| **VAAPI** | H.264, H.265, MJPEG, VP8, VP9, AV1 |
| **Apple VideoToolbox** | H.264, H.265, ProRes, VP9 |
| **Media Foundation** | H.264, H.265 |

### Audio Codecs (30+)

| Group | Codecs |
|---|---|
| **AAC / MPEG** | AAC (native, FDK), MP3 (LAME, libshine), MP2 |
| **Dolby** | AC-3, E-AC-3, TrueHD, DTS, MLP |
| **Lossless** | FLAC, ALAC, WavPack |
| **Streaming** | Vorbis, Opus, Speex, AMR-WB |
| **PCM** | s16le, s24le, f32le, s16be, u8, A-law, Mu-law |
| **Windows Media** | WMA v1, WMA v2 |
| **Other** | ADPCM IMA |

### Pixel Formats (60+)

| Group | Formats |
|---|---|
| **YUV 8-bit** | yuv420p, yuv422p, yuv444p, yuv410p, yuv411p, yuv440p, yuvj420p, yuvj422p, yuvj444p |
| **YUV 10-bit** | yuv420p10le, yuv422p10le, yuv444p10le |
| **YUV 12-bit** | yuv420p12le, yuv422p12le, yuv444p12le |
| **YUV 16-bit** | yuv420p16le, yuv444p16le |
| **YUV Semi-planar** | nv12, nv21, nv16, nv20le |
| **YUV with Alpha** | yuva420p, yuva422p, yuva444p, yuva420p10le, yuva444p10le, yuva444p16le |
| **RGB Packed** | rgb24, bgr24, rgba, bgra, argb, abgr, rgb48le, bgr48le, rgba64le, bgra64le |
| **Planar RGB** | gbrp, gbrp10le, gbrp12le, gbrp16le, gbrap, gbrap10le, gbrap16le |
| **Monochrome** | gray, gray10le, gray12le, gray16le, grayf32le, ya8, ya16le |
| **HDR** | p010le, p016le, x2rgb10le |

### Input File Extensions

| Category | Extensions |
|---|---|
| Video | `mp4`, `mkv`, `avi`, `mov`, `webm`, `flv`, `wmv`, `mts`, `m2ts`, `ts`, `mxf`, `ogv`, `vob`, `3gp`, `mpg`, `mpeg`, `h264`, `hevc`, `rm`, `dv` |
| Audio | `mp3`, `aac`, `wav`, `flac`, `ogg`, `opus`, `m4a`, `wma`, `alac`, `aiff`, `pcm`, `mid` |
| Image | `jpg`, `jpeg`, `png`, `webp`, `bmp`, `gif`, `tiff`, `svg`, `ico`, `heic`, `avif` |
| Subtitle | `srt`, `ass`, `ssa`, `vtt`, `sub`, `idx`, `smi` |

## Shared Types

```typescript
interface ConversionOptions {
  videoCodec?: string;
  audioCodec?: string;
  videoBitrate?: string;
  audioBitrate?: string;
  qscale?: number;
  scale?: string;
  pixelFormat?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  copy?: boolean;
}

interface MediaInfo {
  file: string;
  format: string;
  size: number;
  duration: number;
  bitrate: string;
  streams: MediaStreamInfo[];
}

interface MediaStreamInfo {
  index: number;
  type: 'video' | 'audio' | 'subtitle';
  codec: string;
  codecLong?: string;
  width?: number;
  height?: number;
  pixelFormat?: string;
  frameRate?: string;
  bitrate?: string;
  sampleRate?: number;
  channels?: number;
  duration?: number;
  language?: string;
}

interface QueueJob {
  id: string;
  input: string;
  output: string;
  options: ConversionOptions;
  transcoder: TranscoderType;
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  error?: string;
  createdAt: number;
}

interface ConversionProgress {
  percent: number;
  time: string;
  fps: number;
  speed: string;
  eta: string;
  bitrate: string;
}

interface PlayerFrame {
  data: ArrayBuffer;
  width: number;
  height: number;
  pts: number;
}
```

## Validation Utilities (`src/shared/validation.ts`)

| Function | Description | Accepted Formats |
|---|---|---|
| `isValidTime(value)` | Validates time strings | `HH:MM:SS`, `HH:MM:SS.mmm`, seconds as number |
| `isValidScale(value)` | Validates resolution/scale | `WxH`, `W:H`, percentage `50%`–`999%` |
| `isValidBitrate(value)` | Validates bitrate strings | e.g. `128k`, `1M`, `2000K` |
| `isInRange(value, min, max)` | Checks numeric range | Any finite number |

## Transcoder Constants (`src/shared/transcoder-constants.ts`)

| Constant | Value |
|---|---|
| `TRANSCODER_TYPES` | `['FFMPEG', 'FFTOOL', 'BMF']` |
| `TRANSCODER_DEFAULTS.PROGRESS_INTERVAL_MS` | `500` |
| `TRANSCODER_DEFAULTS.PLAYER_DEFAULT_WIDTH` | `640` |
| `TRANSCODER_DEFAULTS.PLAYER_DEFAULT_HEIGHT` | `360` |
| `TRANSCODER_DEFAULTS.FFPROBE_TIMEOUT_MS` | `30000` |
| `CONVERSION_DEFAULTS.VIDEO_CODEC` | `libx264` |
| `CONVERSION_DEFAULTS.AUDIO_CODEC` | `aac` |
| `CONVERSION_DEFAULTS.QSCALE` | `23` |
| `CONVERSION_DEFAULTS.PIXEL_FORMAT` | `yuv420p` |

## Frame Decoder (`src/main/player/frame-decoder.ts`)

The frame decoder spawns FFmpeg as a subprocess with rawvideo output piped to stdout:

```
FFmpeg: input
  → -f rawvideo -pix_fmt rgb24 -s {width}x{height}
  → -an -sn -dn (strip audio/subtitles/data)
  → pipe:1 (stdout)
```

The main process reads the binary stream, splits it into `width × height × 3` byte frames, and emits `DecodedFrame` events. The renderer receives frames via IPC `player-frame` channel and renders them onto an HTML Canvas element.

## Job Queue (`src/main/queue/job-queue.ts`)

A serial batch processor built on `EventEmitter`:

- Processes jobs one at a time (FIFO)
- Automatically advances to the next queued job on completion
- Supports per-job cancellation and full queue cancellation
- Emits `added`, `removed`, `statusChange`, `progress`, and `cancelled` events
- Creates the appropriate transcoder instance per job based on `TranscoderType`

## Configuration

### Electron Window

```typescript
{
  width: 1280,
  height: 800,
  minWidth: 960,
  minHeight: 600,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
}
```

### Electron Builder

```typescript
{
  appId: "com.openconverter.app",
  productName: "EncodeX",
  directories: { output: "release" },
  win: { target: "nsis" },
  mac: { target: "dmg" },
  linux: { target: "AppImage" },
  extraResources: ["ffmpeg-static", "ffprobe-static"],
}
```

### Prettier

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 140,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

## Tech Stack

| Layer | Technology |
|---|---|
| **UI Framework** | React 19 |
| **Component Library** | MUI v9 (Material-UI) |
| **State Management** | Zustand 5 |
| **Routing** | react-router-dom v7 |
| **Internationalization** | i18next 26 + react-i18next |
| **Icons** | MUI Icons + country-flag-icons |
| **Styling** | Emotion (MUI default engine) |
| **Desktop Shell** | Electron 33 |
| **Video Processing** | fluent-ffmpeg + ffmpeg-static |
| **CLI Framework** | commander |
| **Build Tool** | Vite 8 |
| **Language** | TypeScript 5.7 |
| **Packaging** | electron-builder 25 |
| **Linting** | Prettier 3 |
| **Testing** | Vitest + @testing-library/react + jsdom |
| **Coverage** | c8 / v8 |
| **E2E** | Playwright |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. All contributions are welcome — please open an issue first for significant changes.

This project is governed by a [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Report security vulnerabilities to the project maintainers via the security advisory process. See [SECURITY.md](SECURITY.md).

## License

MIT
