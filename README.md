# EncodeX

A cross-platform multimedia conversion tool built on FFmpeg, React, TypeScript, and Electron.

## Features

### Media Conversion
Convert between video/audio formats with granular controls over codec selection, video/audio bitrate, output resolution, pixel format, and quality scale. Supports batch mode for processing multiple files.

### Lossless Copy
Stream-copy video or audio tracks without re-encoding. Useful for fast container format changes, remuxing, or when quality preservation is critical.

### Media Information
Probe media files and inspect detailed stream information: codec, resolution, frame rate, bitrate, sample rate, channel count, duration, and pixel format. Works with video, audio, and subtitle streams.

### Image Compression
Compress images (JPEG, PNG, WebP, BMP) with configurable quality scale and resolution scaling using FFmpeg's image codecs.

### Audio Extraction
Extract audio tracks from video files. Output as AAC, MP3, AC3, FLAC, WAV, Vorbis, or Opus.

### Video Cutting
Preview and cut video segments with frame-accurate start/end time selection. Includes a built-in raw-video player that decodes frames via FFmpeg pipe to an HTML Canvas element.

### Batch Queue
Process multiple files sequentially with configurable operations (transcode, extract audio, compress image). Queue persists state across jobs with progress tracking and error handling.

### Multiple Transcoding Cores
- **FFmpeg API** — fluent-ffmpeg Node.js bindings with programmatic progress events
- **FFmpeg CLI** — direct CLI invocation via child process
- **BMF Framework** — BMF CLI tools (requires separate installation)

### CLI Mode
Headless command-line interface for scripting and automation. Supports all conversion options, lossless copy, and media info inspection.

### Internationalization
Localized UI in 7 locales: English (US/GB/IN), Spanish (ES), French (FR/CA), and Hindi. Language selection persists to localStorage.

### Error Handling
Structured error system with typed error codes (`ErrorCode`), user-facing messages, a global error snackbar, inline error banners, and a React error boundary. All errors are normalized through `formatError()` and propagated across IPC.

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
1. **Vite** — serves the React renderer on `http://localhost:5173` with HMR (hot module replacement)
2. **tsc** — watches and compiles the main process TypeScript to `dist/main/`

`npm run electron:dev` waits for Vite to be ready, compiles both main and preload, then launches Electron with the `--dev` flag pointing at the Vite dev server URL.

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
| `npm run build:renderer` | Vite production build |
| `npm run build:main` | tsc compile main process |
| `npm run build:preload` | tsc compile preload script |
| `npm run build` | All three in sequence |
| `npm run start` | Launch compiled app from `dist/` |
| `npm run pack` | Build + electron-builder `--dir` |
| `npm run dist` | Build + electron-builder (NSIS/DMG/AppImage) |

## CLI Usage

```bash
npx tsx src/main/cli.ts input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Show media info
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
| `-q, --qscale <qscale>` | Quality scale (0–51 for libx264) |
| `--pix-fmt <format>` | Pixel format (e.g. `yuv420p`, `yuv444p`) |
| `-s, --scale <WxH>` | Output resolution (e.g. `1280x720`) |
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

## Project Structure

```
src/
├── main/                          # Electron main process
│   ├── ipc/
│   │   └── handlers.ts            # IPC handler registrations (error-wrapped)
│   ├── player/
│   │   └── frame-decoder.ts       # Rawvideo pipe -> Canvas frame decoder
│   ├── queue/
│   │   └── job-queue.ts           # Async batch queue with EventEmitter
│   └── transcoders/
│       ├── interface.ts           # ITranscoder contract
│       ├── ffmpeg-core.ts         # fluent-ffmpeg API core
│       ├── fftool-core.ts         # Direct CLI invocation core
│       └── bmf-core.ts            # BMF framework core
├── preload/
│   └── index.ts                   # contextBridge electronAPI
├── renderer/                      # React UI (served by Vite)
│   ├── components/
│   │   ├── CodecSelect.tsx         # Dropdown for video/audio codecs
│   │   ├── ErrorBanner.tsx         # Inline error banner (color-coded)
│   │   ├── ErrorBoundary.tsx       # React class-based error boundary
│   │   ├── ErrorSnackbar.tsx       # Global toast notification
│   │   ├── FileDropZone.tsx        # Drag-and-drop file selector
│   │   ├── MediaPlayer.tsx         # Canvas-based video player
│   │   └── ProgressBar.tsx         # Conversion progress (LinearProgress)
│   ├── hooks/
│   │   ├── useConversion.ts        # Conversion orchestration
│   │   └── useErrorHandler.ts      # Error handling utilities
│   ├── i18n/
│   │   ├── config.ts               # i18next initialization
│   │   └── locales/                # 7 locale JSON files
│   ├── pages/
│   │   ├── Dashboard.tsx            # Home / quick actions
│   │   ├── Convert.tsx              # Media conversion page
│   │   ├── MediaInfo.tsx            # File probe / stream info
│   │   ├── ImageCompress.tsx        # Image compression
│   │   ├── AudioExtract.tsx         # Audio extraction
│   │   ├── VideoCut.tsx             # Video cutting + player
│   │   └── BatchQueue.tsx           # Batch job management
│   ├── stores/
│   │   ├── conversionStore.ts       # Conversion form state
│   │   ├── errorStore.ts            # Error state + history (cap 50)
│   │   ├── queueStore.ts            # Batch queue job state
│   │   └── settingsStore.ts         # User settings
│   ├── App.tsx                      # Root layout + router + drawer
│   ├── ColorModeContext.tsx          # Dark/light theme context
│   ├── theme.ts                     # MUI theme (dark + light)
│   ├── electron-api.d.ts            # Global type declaration
│   ├── main.tsx                     # React entry point
│   └── global.css                   # Global styles
└── shared/
    ├── errors.ts                    # ErrorCode, AppError, formatError
    ├── ipc-channels.ts              # All IPC channel name constants
    ├── transcoder-constants.ts      # FFmpeg flags, defaults, patterns
    ├── types.ts                     # Shared interfaces (QueueJob, MediaInfo, etc.)
    └── ui-constants.ts              # UI layout, filters, codec lists, nav
```

## Architecture

### Data Flow

```
User Action (React page)
    │
    ▼
Zustand Store (renderer state)
    │
    ▼
electronAPI.invoke(channel, args)  ← IPC via contextBridge
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
formatError(err)        ← shared/errors.ts
    │  normalizes to AppError { code, message, detail, timestamp }
    ▼
errorStore.showError()  ← stores in currentError + errorHistory (cap 50)
    │
    ├── ErrorSnackbar   (global toast, auto-dismiss)
    ├── ErrorBanner     (inline per-page)
    └── ErrorBoundary   (React crash catch-all)
```

### IPC Channels

| Request (invoke) | Response (on) |
|---|---|
| `select-file` | `conversion-progress` |
| `select-files` | `queue-added` |
| `select-output` | `queue-removed` |
| `get-media-info` | `queue-status-change` |
| `convert-file` | `queue-progress` |
| `cancel-conversion` | `queue-cancelled` |
| `queue-add` | `player-frame` |
| `queue-remove` | |
| `queue-list` | |
| `queue-cancel-all` | |
| `player-open` | |
| `player-seek` | |
| `player-close` | |
| `player-get-frame` | |

## Tech Stack

| Layer | Technology |
|---|---|
| **UI Framework** | React 19 |
| **Component Library** | MUI v7 (Material-UI) |
| **State Management** | Zustand 5 |
| **Routing** | react-router-dom v7 |
| **Internationalization** | i18next + react-i18next |
| **Icons** | MUI Icons |
| **Styling** | Emotion (MUI default engine) |
| **Desktop Shell** | Electron 33 |
| **Video Processing** | fluent-ffmpeg + ffmpeg-static |
| **CLI Framework** | commander |
| **Build Tool** | Vite 6 |
| **Language** | TypeScript 5.7 |
| **Packaging** | electron-builder |
| **Linting** | Prettier |
| **Testing** | Vitest + @testing-library/react + jsdom |
| **Coverage** | c8 / v8 |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. All contributions are welcome — please open an issue first for significant changes.

This project is governed by a [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Report security vulnerabilities to the project maintainers via the security advisory process. See [SECURITY.md](SECURITY.md).

## License

MIT
