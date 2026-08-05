# EncodeX

A cross-platform multimedia conversion tool built on FFmpeg, React, TypeScript, and Electron.

## Features

### Media Conversion

Convert between video/audio formats with granular controls over codec selection (51 video codecs across software and hardware encoder families, 27 audio codecs), bitrate, output resolution (with optional aspect-ratio preservation), pixel format (56 formats grouped by bit depth), quality scale (qscale), audio track inclusion, and transcoder core selection. Supports batch mode for processing multiple files sequentially.

### Lossless Copy

Stream-copy video or audio tracks without re-encoding (`-c copy`). Useful for fast container format changes, remuxing, or when quality preservation is critical.

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

Process multiple files sequentially with configurable operations (transcode, extract audio, compress image). The queue persists state across jobs with real-time progress tracking, per-job error handling, job removal, and cancel-all.

### Multiple Transcoder Cores

- **FFmpeg API** — fluent-ffmpeg Node.js bindings with programmatic progress events
- **FFmpeg CLI** — direct CLI invocation via child process, no native bindings needed
- **BMF Framework** — BMF CLI tools for advanced pipeline scenarios (requires separate installation)

### Settings

Dedicated settings page for theme, hardware acceleration (enable/disable, mode, encoder type), and window always-on-top. Preferences persist to `localStorage` and take effect on startup.

### Logs

Live log viewer that aggregates console output from both the main and renderer processes over IPC. Supports level filtering (DEBUG/INFO/WARN/ERROR), clearing, and downloading the log as a `.txt` file.

### Notifications

Toast notifications (success/info/warning/error) with configurable duration for non-blocking feedback, layered on top of the global error snackbar.

### Custom Window Frame

Frameless application window with a custom title bar providing minimize / maximize-toggle / close controls, a draggable region, and always-on-top support. A non-interactive splash screen is shown while the main window loads.

### Dark / Light Theme

System-aware theme detection with manual toggle. Theme preference persists to `localStorage` (`encodex-theme` key).

### RTL Support

Right-to-left layout support for Arabic locales (`ar-SA`, `ar-AE`). Direction toggles automatically on language switch via an Emotion RTL style plugin.

### CLI Mode

Headless command-line interface for scripting and automation. Supports all conversion options, lossless copy, cutting, audio exclusion, and media info inspection. Auto-activates when two positional arguments are provided (or with `--cli`).

### Internationalization

20 locales across 14 languages:

| Language   | Locales                            |
| ---------- | ---------------------------------- |
| English    | `en-US`, `en-GB`, `en-IN`, `en-CA` |
| Spanish    | `es-ES`, `es-MX`                   |
| French     | `fr-FR`, `fr-CA`                   |
| Hindi      | `hi-IN`                            |
| German     | `de-DE`                            |
| Italian    | `it-IT`                            |
| Dutch      | `nl-NL`                            |
| Swedish    | `sv-SE`                            |
| Portuguese | `pt-BR`                            |
| Ukrainian  | `uk-UA`                            |
| Japanese   | `ja-JP`                            |
| Korean     | `ko-KR`                            |
| Indonesian | `id-ID`                            |
| Arabic     | `ar-SA`, `ar-AE`                   |

### Error Handling

Structured error system with typed error codes (`ErrorCode`), user-facing localized messages, a global error snackbar, inline error banners, toast notifications, nested React error boundaries, and an in-app error history (cap 50). All errors are normalized through `formatError()` and propagated across IPC.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [FFmpeg](https://ffmpeg.org/) — bundled via `ffmpeg-static`; falls back to system `ffmpeg` if the bundled binary is unavailable

## Install

```bash
npm install
```

This installs all dependencies including `ffmpeg-static` and `ffprobe-static`, which download platform-specific binaries during their postinstall scripts.

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

| Script                   | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| `npm run dev:renderer`   | Vite dev server only                                        |
| `npm run dev:main`       | `tsc -p tsconfig.main.json --watch`                         |
| `npm run build:renderer` | Vite production build — outputs to `dist/renderer/`         |
| `npm run build:main`     | `tsc -p tsconfig.main.json` — outputs to `dist/main/`       |
| `npm run build:preload`  | `tsc -p tsconfig.preload.json` — outputs to `dist/preload/` |
| `npm run build`          | All three in sequence                                       |
| `npm run start`          | Launch compiled app from `dist/` via `electron .`           |
| `npm run electron:dev`   | Vite + Electron dev environment                             |
| `npm run dev:start`      | Build then launch                                           |
| `npm run format`         | `prettier --write` on all `src` TypeScript/JSON             |
| `npm run format:check`   | `prettier --check` on all `src` TypeScript/JSON             |
| `npm run pack`           | Build + electron-builder `--dir`                            |
| `npm run dist`           | Build + electron-builder (NSIS/DMG/AppImage)                |

## CLI Usage

Build first, then invoke the compiled CLI through Electron. CLI mode auto-activates when two positional arguments (input + output) are given, or explicitly with `--cli`:

```bash
npx electron . --cli input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Show media info as JSON
npx electron . --cli input.mp4 --info

# Lossless copy to different container
npx electron . --cli input.mkv output.mp4 --copy

# Cut a segment
npx electron . --cli input.mp4 output.mp4 --start-time 00:01:00 --end-time 00:02:30

# Use a specific transcoder core
npx electron . --cli input.mp4 output.mp4 --transcoder FFTOOL
```

### CLI Options

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--transcoder <type>`       | Transcoder core: `FFMPEG`, `FFTOOL`, `BMF` (default: `FFMPEG`) |
| `-v, --video-codec <codec>` | Video codec (e.g. `libx264`, `libx265`, `copy`)                |
| `-a, --audio-codec <codec>` | Audio codec (e.g. `aac`, `libmp3lame`, `copy`)                 |
| `-q, --qscale <qscale>`     | Quality scale (0–31)                                           |
| `--bitrate-video <bitrate>` | Video bitrate (e.g. `1000k`)                                   |
| `--bitrate-audio <bitrate>` | Audio bitrate (e.g. `192k`)                                    |
| `--pix-fmt <format>`        | Pixel format (e.g. `yuv420p`, `yuv444p`)                       |
| `-s, --scale <WxH>`         | Output resolution (e.g. `1280x720` or `50%`)                   |
| `--start-time <time>`       | Start time (`HH:MM:SS` or seconds)                             |
| `--end-time <time>`         | End time                                                       |
| `--duration <time>`         | Duration                                                       |
| `--copy`                    | Lossless stream copy                                           |
| `--no-audio`                | Exclude the audio stream from the output                       |
| `--info`                    | Print media info as JSON and exit                              |

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

### Test Suite

The suite is run by Vitest 4 with jsdom (85 test files, 837 tests, all passing). Coverage uses the v8 provider.

| Area                     | Files (tests)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | What's Covered                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Shared**               | `errors.test.ts` (30), `constants.test.ts` (27), `codec-containers.test.ts` (15), `validation.test.ts` (15), `types.test.ts` (10), `logger.test.ts` (6), `ipc-channels.test.ts` (2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Error normalization, all shared constants, codec/container mapping, validation helpers, type contracts, logger, IPC channel registry |
| **Main**                 | `cli.test.ts` (11), `index.test.ts` (11), `capabilities.test.ts` (10), `job-queue.test.ts` (7), `process-utils.test.ts` (7), `image-file-info.test.ts` (14), `image-info.test.ts` (12), `image-preview.test.ts` (6), `video-preview.test.ts` (6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | CLI parsing, window lifecycle, encoder probing, queue semantics, process utilities, image/video preview generation                   |
| **Main transcoders**     | `ffmpeg-core.test.ts` (25), `hwaccel.test.ts` (14), `ffmpeg-utils.test.ts` (13), `fftool-core.test.ts` (12), `bmf-core.test.ts` (11), `ffprobe-mapper.test.ts` (7), `factory.test.ts` (3), `interface.test.ts` (1), `integration-audio.test.ts` (1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                | All three cores, hardware-acceleration flag building, ffprobe mapping, factory dispatch, transcoder interface contract               |
| **Main IPC**             | `player.test.ts` (16), `image.test.ts` (9), `dialogs.test.ts` (8), `conversion.test.ts` (7), `window.test.ts` (8), `queue.test.ts` (5), `timeline.test.ts` (4), `send.test.ts` (2), `handlers.test.ts` (1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Per-channel IPC handlers, event broadcasting, error wrapping                                                                         |
| **Main player**          | `frame-decoder.test.ts` (32)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Rawvideo frame decoding, audio pipe, buffering                                                                                       |
| **Main timeline**        | `timeline-media.test.ts` (10)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Waveform extraction, thumbnail montage generation                                                                                    |
| **Preload**              | `index.test.ts` (39)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Full `electronAPI` bridge surface, every IPC method                                                                                  |
| **Renderer components**  | `VideoTimeline.test.tsx` (28), `MediaPlayer.test.tsx` (13), `CodecSelect.test.tsx` (11), `StreamDetails.test.tsx` (11), `ErrorBanner.test.tsx` (8), `AppDrawer.test.tsx` (7), `FileSummary.test.tsx` (7), `QueueJobCard.test.tsx` (7), `FileDropZone.test.tsx` (6), `BatchControls.test.tsx` (6), `ErrorSnackbar.test.tsx` (5), `ExifSection.test.tsx` (5), `FilePathField.test.tsx` (5), `TimeField.test.tsx` (5), `TitleBar.test.tsx` (5), `ConfirmDialog.test.tsx` (4), `ErrorBoundary.test.tsx` (4), `GroupedSelect.test.tsx` (4), `ProgressBar.test.tsx` (4), `ToastContainer.test.tsx` (4), `LanguageMenu.test.tsx` (3), `PageContainer.test.tsx` (3), `EllipsisTooltip.test.tsx` (2), `Footer.test.tsx` (2) | Rendering, interactions, error states, accessibility for all shared UI components                                                    |
| **Renderer hooks**       | `useConversion.test.tsx` (19), `useErrorHandler.test.ts` (7), `useFormErrors.test.ts` (7), `useMediaTask.test.ts` (6), `useLanguageDirection.test.tsx` (4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Conversion orchestration, error handling, form validation, media task lifecycle, RTL direction                                       |
| **Renderer pages**       | `VideoCut.test.tsx` (27), `Convert.test.tsx` (22), `ImageCompress.test.tsx` (19), `AudioExtract.test.tsx` (16), `Settings.test.tsx` (15), `BatchQueue.test.tsx` (9), `Logs.test.tsx` (6), `MediaInfo.test.tsx` (6), `Dashboard.test.tsx` (5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Full page flows: form state, validation, IPC invocation, settings persistence                                                        |
| **Renderer stores**      | `conversionStore.test.ts` (20), `audioExtractStore.test.ts` (12), `settingsStore.test.ts` (10), `errorStore.test.ts` (9), `queueStore.test.ts` (6), `toastStore.test.ts` (5), `logStore.test.ts` (4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Zustand store state transitions and persistence                                                                                      |
| **Renderer utils / app** | `App.test.tsx` (8), `formatters.test.ts` (12)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | App shell routing, formatters                                                                                                        |
| **Integration**          | `error-flow.test.ts` (7)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Full pipeline: Error → `formatError` → store → display → clear                                                                       |

### Test Setup

The test environment (`src/test-setup.ts`) provides:

- Mocked `useTranslation` from `react-i18next` with English key mapping and interpolation
- Mocked `electronAPI` on `globalThis` covering all IPC methods
- Registers `@testing-library/jest-dom/vitest` matchers

### E2E Tests

Playwright-based end-to-end tests live in `e2e/` (node environment, 60s timeouts) and are gated behind the `E2E` env var or CI:

| File              | What's Covered                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `e2e/cli.spec.ts` | CLI mode: `--help`/`-h`, invalid input, `--info`, real conversion via `FFMPEG` and `FFTOOL` |
| `e2e/app.spec.ts` | Electron app launch, window creation                                                        |
| `e2e/helpers.ts`  | Test media generation and build helpers                                                     |

## Project Structure

```
src/
├── main/                              # Electron main process
│   ├── index.ts                       # Entry: CLI detection, splash + main window, console bridging
│   ├── cli.ts                         # Commander-based CLI entry point
│   ├── capabilities.ts                # Encoder probing (ffmpeg -encoders / -hwaccels)
│   ├── process-utils.ts               # Child-process helpers (spawn, suspend, resume, kill)
│   ├── image-info.ts                  # EXIF extraction + RGB/luma histogram via ffmpeg
│   ├── image-preview.ts               # Downscaled base64 image previews
│   ├── image-file-info.ts             # Image dimensions/size probing
│   ├── video-preview.ts               # Single-frame video thumbnails
│   ├── ipc/                           # IPC handler modules (error-wrapped)
│   │   ├── handlers.ts                # Central registration + error wrapper
│   │   ├── dialogs.ts                 # select-file / select-files / select-output
│   │   ├── conversion.ts              # convert / cancel / pause / resume
│   │   ├── queue.ts                   # queue CRUD + cancel-all
│   │   ├── player.ts                  # player open / seek / close / get-frame
│   │   ├── timeline.ts                # extract-waveform / extract-thumbnails
│   │   ├── image.ts                   # image info / preview / file info
│   │   ├── capabilities.ts            # get-capabilities
│   │   ├── window.ts                  # minimize / maximize / close / always-on-top
│   │   └── send.ts                    # Event broadcast helpers
│   ├── player/
│   │   └── frame-decoder.ts           # Rawvideo frame + PCM audio pipe decoder
│   ├── queue/
│   │   └── job-queue.ts               # Async serial batch queue with EventEmitter
│   ├── timeline/
│   │   └── timeline-media.ts          # Waveform + thumbnail-montage extraction
│   └── transcoders/
│       ├── interface.ts               # ITranscoder contract {getInfo, convert, cancel, getType}
│       ├── factory.ts                 # Transcoder factory (FFMPEG | FFTOOL | BMF)
│       ├── ffmpeg-core.ts             # fluent-ffmpeg API core
│       ├── fftool-core.ts             # Direct CLI invocation via child_process
│       ├── bmf-core.ts                # BMF framework CLI wrapper
│       ├── ffmpeg-utils.ts            # Shared command/flag builders
│       ├── ffprobe-mapper.ts          # ffprobe JSON → MediaInfo normalization
│       └── hwaccel.ts                 # Hardware-acceleration filter/flag resolution
├── preload/
│   └── index.ts                       # contextBridge exposes electronAPI to renderer
├── renderer/                          # React UI (served by Vite, root: src/renderer)
│   ├── main.tsx                       # React entry: HashRouter + DirectionProvider + I18nextProvider
│   ├── App.tsx                        # Root layout: TitleBar, Drawer, routes, snackbar, toasts
│   ├── ColorModeContext.tsx           # Dark/light theme context
│   ├── useLanguageDirection.ts        # RTL/LTR detection hook
│   ├── theme.ts                       # MUI light/dark theme definitions
│   ├── colors.ts                      # Shared color palette
│   ├── electron-api.d.ts              # Global Window.electronAPI type declaration
│   ├── global.css                     # Global styles
│   ├── index.html                     # Vite entry HTML
│   ├── pageIcons.tsx                  # Page → icon mapping
│   ├── components/
│   │   ├── AppDrawer.tsx              # Responsive sidebar navigation
│   │   ├── TitleBar.tsx               # Custom frameless window title bar
│   │   ├── FileDropZone.tsx           # Drag-and-drop file selector
│   │   ├── FilePathField.tsx          # Read-only path input + browse button
│   │   ├── FileSummary.tsx            # Selected file summary (size, streams)
│   │   ├── CodecSelect.tsx            # Grouped codec dropdown (video/audio)
│   │   ├── GroupedSelect.tsx          # Generic grouped-options select
│   │   ├── AudioStreamInfo.tsx        # Audio stream selector
│   │   ├── StreamDetails.tsx          # Per-stream detail table
│   │   ├── ExifSection.tsx            # EXIF + histogram viewer
│   │   ├── MediaPlayer.tsx            # Canvas + Web Audio player with A/V sync
│   │   ├── VideoTimeline.tsx          # Zoomable waveform + thumbnail timeline
│   │   ├── BatchControls.tsx          # Batch queue action buttons
│   │   ├── QueueJobCard.tsx           # Per-job queue card
│   │   ├── ProgressBar.tsx            # Conversion progress (LinearProgress)
│   │   ├── TimeField.tsx              # Time input with validation
│   │   ├── ErrorBoundary.tsx          # React class-based error boundary
│   │   ├── ErrorBanner.tsx            # Inline error banner (color-coded by severity)
│   │   ├── ErrorSnackbar.tsx          # Global error toast
│   │   ├── ToastContainer.tsx         # Non-blocking toast notifications
│   │   ├── ConfirmDialog.tsx          # Confirmation dialog
│   │   ├── InfoTooltip.tsx            # Help tooltip (info icon)
│   │   ├── EllipsisTooltip.tsx        # Truncated-text tooltip
│   │   ├── Footer.tsx                 # App footer
│   │   ├── LanguageMenu.tsx           # Locale switcher with flags
│   │   └── PageContainer.tsx          # Shared page layout shell
│   ├── hooks/
│   │   ├── useConversion.ts           # Conversion orchestration hook
│   │   ├── useErrorHandler.ts         # Error handling utilities
│   │   ├── useFormErrors.ts           # Field-level validation errors
│   │   ├── useCapabilities.ts         # Encoder capability fetching + filtering
│   │   └── useMediaTask.ts            # Shared media-task lifecycle (info → run → progress)
│   ├── i18n/
│   │   ├── config.ts                  # i18next init with 20 locale resources
│   │   ├── DirectionProvider.tsx      # Emotion RTL/LTR cache provider
│   │   ├── localeMeta.ts              # Locale metadata + flags + RTL list
│   │   └── locales/                   # 20 JSON locale files
│   ├── pages/
│   │   ├── Dashboard.tsx              # Home / quick action cards
│   │   ├── Convert.tsx                # Media conversion form
│   │   ├── MediaInfo.tsx              # File probe / stream info display
│   │   ├── ImageCompress.tsx          # Image compression + EXIF/histogram
│   │   ├── AudioExtract.tsx           # Audio extraction form
│   │   ├── VideoCut.tsx               # Video cutting + player + timeline
│   │   ├── BatchQueue.tsx             # Batch job management
│   │   ├── Logs.tsx                   # Log viewer (filter / clear / download)
│   │   └── Settings.tsx               # Theme, hwaccel, always-on-top settings
│   ├── stores/
│   │   ├── conversionStore.ts         # Conversion form state (Zustand)
│   │   ├── audioExtractStore.ts       # Audio extraction form state (Zustand)
│   │   ├── errorStore.ts              # Error state + history (cap 50)
│   │   ├── queueStore.ts              # Batch queue job state (Zustand)
│   │   ├── settingsStore.ts           # Settings state + localStorage persistence
│   │   ├── logStore.ts                # Aggregated log entries (cap 2000)
│   │   └── toastStore.ts              # Toast queue
│   ├── styles/                        # Extracted MUI style constants per component
│   └── utils/
│       └── formatters.ts              # Duration/bitrate/stream formatting helpers
└── shared/                            # Code shared between processes
    ├── errors.ts                      # ErrorCode enum, AppError interface, formatError()
    ├── ipc-channels.ts                # All IPC channel name constants
    ├── types.ts                       # Shared interfaces: ConversionOptions, QueueJob,
    │                                  #   MediaInfo, MediaStreamInfo, PlayerFrame, etc.
    ├── constants.ts                   # Numeric/string constants (timeline, waveform, window, …)
    ├── app-constants.ts               # app/window layout, nav items, storage keys
    ├── transcoder-constants.ts        # FFmpeg flags, defaults, progress patterns
    ├── hwaccel-settings.ts            # Hardware-acceleration modes and encoder types
    ├── codec-containers.ts            # Codec → container compatibility mapping
    ├── codec-classification.ts        # Codec family classification helpers
    ├── media-options.ts               # codec lists, pixel formats, bitrate/scale options
    ├── file-extensions.ts             # input/output file extensions and filters
    ├── log-constants.ts               # Shared log message constants (310 exported)
    ├── logger.ts                      # Timestamped logger (main/renderer)
    └── validation.ts                  # Time/scale/bitrate/range validation helpers

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
  <Root>                                     ← main.tsx
    <HashRouter>
      <DirectionProvider direction={...}>    ← RTL/LTR Emotion cache (rtl plugin for Arabic)
        <I18nextProvider i18n={i18n}>
          <App>
            <ColorModeProvider>
              <CssBaseline />
              <AppLayout>
                <TitleBar />                 ← frameless window controls + always-on-top
                <AppBody>
                  <AppDrawer />              ← temporary (mobile) / permanent (desktop) drawer
                  <ColumnLayout>
                    <MainContent>
                      <ErrorBoundary>        ← global safety net
                        <Suspense>           ← lazy-loaded pages
                          <Routes>
                            <Route element={<ErrorBoundary><Page /></ErrorBoundary>} />   ← per-page isolation
                          </Routes>
                        </Suspense>
                      </ErrorBoundary>
                    </MainContent>
                    <Footer />
                  </ColumnLayout>
                </AppBody>
                <ErrorSnackbar />            ← global error toast
                <ToastContainer />           ← info/success/warning toasts
              </AppLayout>
            </ColorModeProvider>
          </App>
        </I18nextProvider>
      </DirectionProvider>
    </HashRouter>
  </Root>
</React.StrictMode>
```

All nine pages (`Dashboard`, `Convert`, `MediaInfo`, `ImageCompress`, `AudioExtract`, `VideoCut`, `BatchQueue`, `Logs`, `Settings`) are code-split with `React.lazy`.

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
IPC Handler (main process, error-wrapped)
    │
    ▼
Transcoder (ffmpeg-core | fftool-core | bmf-core)
    │
    ▼
fluent-ffmpeg / child_process / BMF CLI (+ hwaccel flags)
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

| Code                   | Severity | Default Message                       |
| ---------------------- | -------- | ------------------------------------- |
| `FILE_NOT_FOUND`       | error    | The selected file could not be found  |
| `FFMPEG_NOT_FOUND`     | error    | FFmpeg binary not found               |
| `FFPROBE_NOT_FOUND`    | error    | FFprobe binary not found              |
| `CONVERSION_FAILED`    | error    | The conversion process failed         |
| `INVALID_FORMAT`       | warning  | File format not supported             |
| `PROBE_FAILED`         | warning  | Could not read media file information |
| `QUEUE_ERROR`          | error    | A batch queue job failed              |
| `PLAYER_ERROR`         | error    | Video player encountered an error     |
| `CANCELLED`            | info     | Operation cancelled by user           |
| `BMF_NOT_AVAILABLE`    | warning  | BMF framework not installed           |
| `OUTPUT_NOT_SPECIFIED` | info     | Output file not specified             |
| `INPUT_NOT_SPECIFIED`  | info     | Input file not specified              |
| `PERMISSION_DENIED`    | error    | Permission denied                     |
| `UNKNOWN`              | error    | Unexpected error                      |

`formatError()` infers error codes from error messages and system error codes (e.g. `ENOENT`, `EACCES`).

### IPC Channels

All channel names are centralized in `src/shared/ipc-channels.ts`.

#### Requests (invoke from renderer)

| Channel               | Arguments                                | Returns                       |
| --------------------- | ---------------------------------------- | ----------------------------- |
| `select-file`         | `filters?`                               | `string \| null`              |
| `select-files`        | `filters?`                               | `string[]`                    |
| `select-output`       | —                                        | `string \| null`              |
| `get-media-info`      | `filePath, transcoderType`               | `MediaInfo`                   |
| `get-image-info`      | `filePath`                               | `ImageExifData \| null`       |
| `get-image-preview`   | `filePath`                               | `string \| null` (data URL)   |
| `get-image-file-info` | `filePath`                               | `ImageFileInfo \| null`       |
| `get-video-preview`   | `filePath`                               | `string \| null` (data URL)   |
| `get-capabilities`    | —                                        | `EncoderCapabilities \| null` |
| `convert-file`        | `input, output, options, transcoderType` | `void`                        |
| `cancel-conversion`   | —                                        | `void`                        |
| `pause-conversion`    | —                                        | `void`                        |
| `resume-conversion`   | —                                        | `void`                        |
| `queue-add`           | `input, output, options, transcoder`     | `string` (job id)             |
| `queue-remove`        | `id`                                     | `void`                        |
| `queue-list`          | —                                        | `QueueJob[]`                  |
| `queue-cancel-all`    | —                                        | `void`                        |
| `player-open`         | `filePath`                               | `number` (generation token)   |
| `player-seek`         | `time`                                   | `number` (generation token)   |
| `player-close`        | —                                        | `void`                        |
| `player-get-frame`    | —                                        | `PlayerFrame \| null`         |
| `extract-waveform`    | `filePath, duration`                     | `WaveformData \| null`        |
| `extract-thumbnails`  | `filePath, duration`                     | `ThumbnailStrip \| null`      |

#### Send-only (renderer → main)

| Channel                    | Payload   |
| -------------------------- | --------- |
| `window-minimize`          | —         |
| `window-maximize-toggle`   | —         |
| `window-close`             | —         |
| `window-set-always-on-top` | `boolean` |

#### Events (main → renderer)

| Channel                    | Payload                       |
| -------------------------- | ----------------------------- |
| `window-maximized-changed` | `boolean`                     |
| `conversion-progress`      | `{ input, output, progress }` |
| `queue-added`              | `QueueJob`                    |
| `queue-removed`            | `string` (job id)             |
| `queue-status-change`      | `QueueJob`                    |
| `queue-progress`           | `{ job, progress }`           |
| `queue-cancelled`          | —                             |
| `player-frame`             | `PlayerFrame`                 |
| `player-audio`             | `PlayerAudioChunk`            |
| `player-error`             | `string`                      |
| `log-message`              | `LogEntry`                    |

### `window.electronAPI` (contextBridge API)

The preload script exposes all IPC via `window.electronAPI` (typed in `src/renderer/electron-api.d.ts`):

**Invocation methods:**

- `getPathForFile(file) → string`
- `selectFile(filters?) → Promise<string | null>`
- `selectFiles(filters?) → Promise<string[]>`
- `selectOutput() → Promise<string | null>`
- `getMediaInfo(filePath, transcoderType) → Promise<MediaInfo>`
- `getCapabilities() → Promise<EncoderCapabilities | null>`
- `convertFile(input, output, options, transcoderType) → Promise<void>`
- `pauseConversion() → Promise<void>`
- `resumeConversion() → Promise<void>`
- `cancelConversion() → Promise<void>`
- `queueAdd(input, output, options, transcoder) → Promise<string>`
- `queueRemove(id) → Promise<void>`
- `queueList() → Promise<QueueJob[]>`
- `queueCancelAll() → Promise<void>`
- `playerOpen(filePath) → Promise<number>` (generation token)
- `playerSeek(time) → Promise<number>` (generation token)
- `playerClose() → Promise<void>`
- `playerGetFrame() → Promise<PlayerFrame | null>`
- `extractWaveform(filePath, duration) → Promise<WaveformData | null>`
- `extractThumbnails(filePath, duration) → Promise<ThumbnailStrip | null>`
- `windowMinimize() → void`
- `windowMaximizeToggle() → void`
- `windowClose() → void`
- `windowSetAlwaysOnTop(flag) → void`

**Event listeners (each returns a cleanup function):**

- `onWindowMaximizedChange(cb) → () => void`
- `onConversionProgress(cb) → () => void`
- `onQueueAdded(cb) → () => void`
- `onQueueRemoved(cb) → () => void`
- `onQueueStatusChange(cb) → () => void`
- `onQueueProgress(cb) → () => void`
- `onQueueCancelled(cb) → () => void`
- `onPlayerFrame(cb) → () => void`
- `onPlayerAudio(cb) → () => void`
- `onPlayerError(cb) → () => void`
- `onLogMessage(cb) → () => void`

## Supported Media Formats

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

## Validation Utilities (`src/shared/validation.ts`)

| Function                     | Description                | Accepted Formats                                      |
| ---------------------------- | -------------------------- | ----------------------------------------------------- |
| `isValidTime(value)`         | Validates time strings     | `HH:MM:SS`, `HH:MM:SS.mmm`, seconds as number         |
| `isValidScale(value)`        | Validates resolution/scale | `WxH`, `W:H`, percentage `1%`–`999%`, positive number |
| `isValidBitrate(value)`      | Validates bitrate strings  | e.g. `128k`, `1M`, `2000K`                            |
| `isInRange(value, min, max)` | Checks numeric range       | Any finite number                                     |

## Transcoder Constants (`src/shared/transcoder-constants.ts`)

| Constant                                          | Value                                                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRANSCODER_TYPES`                                | `['FFMPEG', 'FFTOOL', 'BMF']`                                                                                                                                     |
| `TRANSCODER_LABELS`                               | `{ FFMPEG: 'FFmpeg (API)', FFTOOL: 'FFmpeg (CLI)', BMF: 'BMF Framework' }`                                                                                        |
| `FFMPEG_FLAGS`                                    | `-c`, `-vcodec`, `-acodec`, `-b:v`, `-b:a`, `-qscale:v`, `-vf`, `-pix_fmt`, `-color_range`, `-ss`, `-to`, `-t`, `-y`, `-i`, `-an`, `-sn`, `-dn`, `-re`, `-copyts` |
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

## Frame Decoder & Audio (`src/main/player/frame-decoder.ts`)

The frame decoder spawns FFmpeg as a subprocess with separate video and audio output pipes:

```
FFmpeg: input (with -re realtime and -copyts)
  → video: -map 0:v:0 -f rawvideo -pix_fmt rgb24 -s {width}x{height}
           -an -sn -dn → pipe:1 (stdout)
  → audio: -map 0:a:0 -f s16le -ac {channels} -ar {sampleRate} → pipe:3 (extra stdio fd)
  → frame timestamps parsed from the -vf showinfo log on stderr (pts_time)
```

The main process splits the rawvideo stream into `width × height × 3` byte frames and emits `DecodedFrame` events, and feeds decoded PCM audio (S16LE, in 50ms chunks at the requested sample rate, default 48 kHz / 2 channels) to the renderer via the `player-audio` channel. The renderer (`MediaPlayer.tsx`) schedules frames onto an HTML Canvas and converts the PCM chunks to floats for the Web Audio API, with clock-based A/V synchronization, seek coalescing (which respawns the decoder at the new timestamp), frame-buffer overflow protection, and stall detection.

## Timeline Media (`src/main/timeline/timeline-media.ts`)

Background extraction used by the Video Cut page:

- **Waveform** — decodes the selected audio stream at 8 kHz and computes min/max amplitude buckets (40 per second, up to 24,000 buckets) over a 30-second segment window
- **Thumbnail montage** — tiles up to 100 video thumbnails (160×90) into a grid (10 columns) as a single base64 data URL, extracted every 8 seconds in parallel segments

The renderer (`VideoTimeline.tsx`) renders these as a zoomable timeline with keep/dim region shading and trim handles.

## Job Queue (`src/main/queue/job-queue.ts`)

A serial batch processor built on `EventEmitter`:

- Processes jobs one at a time (FIFO)
- Automatically advances to the next queued job on completion
- Supports per-job cancellation and full queue cancellation
- Emits `added`, `removed`, `statusChange`, `progress`, and `cancelled` events
- Creates the appropriate transcoder instance per job based on `TranscoderType`

## Configuration

### Electron Windows

Main window (frameless, custom title bar):

```typescript
{
  width: 1280,
  height: 800,
  minWidth: 960,
  minHeight: 600,
  frame: false,
  show: false,                    // shown on ready-to-show
  webPreferences: {
    preload: '…/preload/index.js',
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
  },
}
```

Splash window (shown while the main window loads, then closed):

```typescript
{
  width: 600,
  height: 600,
  frame: false,
  resizable: false,
  skipTaskbar: true,
  alwaysOnTop: true,
  backgroundColor: '#EEF4F4',
  webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
}
```

### Electron Builder

```typescript
{
  appId: "com.openconverter.app",
  productName: "EncodeX",
  directories: { output: "release" },
  files: ["dist/**/*", "resources/**/*", "assets/**/*"],
  extraResources: [
    { from: "node_modules/ffmpeg-static", to: "ffmpeg-static" },
    { from: "node_modules/ffprobe-static", to: "ffprobe-static" },
  ],
  win: { target: "nsis" },
  mac: { target: "dmg" },
  linux: { target: "AppImage" },
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
  "bracketSpacing": true,
  "endOfLine": "lf",
  "jsxSingleQuote": false
}
```

## Tech Stack

| Layer                    | Technology                                     |
| ------------------------ | ---------------------------------------------- |
| **UI Framework**         | React 19                                       |
| **Component Library**    | MUI v9 (Material-UI)                           |
| **State Management**     | Zustand 5                                      |
| **Routing**              | react-router-dom v7                            |
| **Internationalization** | i18next 26 + react-i18next + stylis-plugin-rtl |
| **Icons**                | Font Awesome 7 + country-flag-icons            |
| **Styling**              | Emotion (MUI default engine) + px-to-rem theme |
| **Desktop Shell**        | Electron 33                                    |
| **Video Processing**     | fluent-ffmpeg + ffmpeg-static + ffprobe-static |
| **Image Metadata**       | exifr                                          |
| **CLI Framework**        | commander                                      |
| **Build Tool**           | Vite 8                                         |
| **Language**             | TypeScript 5.7                                 |
| **Packaging**            | electron-builder 25                            |
| **Linting / Formatting** | Prettier 3                                     |
| **Testing**              | Vitest + @testing-library/react + jsdom        |
| **Coverage**             | @vitest/coverage-v8                            |
| **E2E**                  | Playwright                                     |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. All contributions are welcome — please open an issue first for significant changes.

This project is governed by a [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Report security vulnerabilities to the project maintainers via the security advisory process. See [SECURITY.md](SECURITY.md).

## License

MIT
