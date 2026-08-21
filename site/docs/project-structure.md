# Project Structure

```
src/
├── test-setup.ts                      # Vitest global setup: jest-dom matchers + i18n/electronAPI mocks
├── main/                              # Electron main process
│   ├── index.ts                       # Entry: CLI detection, splash + main window, console bridging
│   ├── cli/                           # Commander-based CLI entry (subcommands)
│   │   ├── cli.ts                     # Entry: legacy shim, subcommand dispatch, exit codes
│   │   ├── cli-options.ts             # Shared global options + CliExitError
│   │   ├── cli-ui.ts                  # Colors, spinners, progress bars, tables
│   │   ├── cli-util.ts                # Glob expansion, output derivation, formatting
│   │   ├── cli-convert.ts             # convert subcommand
│   │   ├── cli-info.ts                # info + capabilities subcommands
│   │   ├── cli-compress.ts            # compress + extract-audio subcommands
│   │   └── cli-batch.ts               # batch subcommand (JobQueue + MultiBar)
│   ├── capabilities.ts                # Encoder probing (ffmpeg -encoders / -hwaccels)
│   ├── process-utils.ts               # Child-process helpers (spawn, suspend, resume, kill)
│   ├── image-info.ts                  # EXIF extraction + RGB/luma histogram via ffmpeg
│   ├── image-preview.ts               # Downscaled base64 image previews
│   ├── image-file-info.ts             # Image dimensions/size probing
│   ├── video-preview.ts               # Single-frame video thumbnails
│   ├── updater.ts                     # GitHub Releases update checker, download, install
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
│   │   ├── updater.ts                 # check / download / install updates
│   │   ├── system.ts                  # reveal-file / set-launch-at-login
│   │   ├── send.ts                    # Event broadcast helpers
│   │   └── types.ts                   # Type-safe main->renderer sender signature
│   ├── player/
│   │   ├── frame-decoder.ts           # Rawvideo frame + PCM audio pipe decoder
│   │   └── types.ts                   # Decoded frame/audio structures + config types
│   ├── queue/
│   │   └── job-queue.ts               # Concurrency-capped batch queue (1-4 parallel jobs) with EventEmitter
│   ├── timeline/
│   │   └── timeline-media.ts          # Waveform + thumbnail-montage extraction
│   └── transcoders/
│       ├── types.ts                   # ITranscoder contract + raw ffprobe JSON shapes
│       ├── factory.ts                 # Transcoder factory (FFMPEG | FFTOOL | BMF)
│       ├── ffmpeg-core.ts             # fluent-ffmpeg API core
│       ├── fftool-core.ts             # Direct CLI invocation via child_process
│       ├── bmf-core.ts                # BMF framework CLI wrapper
│       ├── ffmpeg-utils.ts            # Shared command/flag builders
│       ├── ffprobe-mapper.ts          # ffprobe JSON -> MediaInfo normalization
│       └── hwaccel.ts                 # Hardware-acceleration filter/flag resolution
├── preload/
│   └── index.ts                       # contextBridge exposes electronAPI to renderer
├── renderer/                          # React UI (served by Vite, root: src/renderer)
│   ├── main.tsx                       # React entry: HashRouter + DirectionProvider + I18nextProvider
│   ├── App.tsx                        # Root layout: TitleBar, Drawer, routes, snackbar, toasts
│   ├── ColorModeContext.tsx            # Dark/light theme context
│   ├── theme.ts                       # MUI light/dark theme definitions
│   ├── pages/
│   │   ├── Dashboard.tsx              # Home / quick action cards
│   │   ├── Convert.tsx                # Media conversion form
│   │   ├── MediaInfo.tsx              # File probe / stream info display
│   │   ├── ImageCompress.tsx          # Image compression + EXIF/histogram
│   │   ├── AudioExtract.tsx           # Audio extraction form
│   │   ├── VideoCut.tsx               # Video cutting + player + timeline
│   │   ├── BatchQueue.tsx             # Batch job management
│   │   ├── Logs.tsx                   # Log viewer (filter / clear / download)
│   │   ├── Settings.tsx               # Theme, hwaccel, always-on-top settings
│   │   └── About.tsx                  # App info, credits, update checker
│   ├── components/                    # ~35 shared UI components
│   ├── hooks/                         # Conversion, error, form, capabilities, media-task hooks
│   ├── stores/                        # 12 Zustand stores (conversion, queue, settings, etc.)
│   ├── i18n/                          # 56 locale JSON files + config
│   └── utils/                         # Formatting helpers
└── shared/                            # Code shared between processes
    ├── errors.ts                      # ErrorCode enum, AppError interface, formatError()
    ├── ipc-channels.ts                # All IPC channel name constants
    ├── types.ts                       # Shared interfaces
    ├── constants.ts                   # Numeric/string constants
    ├── media-options.ts               # codec lists, pixel formats, bitrate/scale options
    ├── codec-containers.ts            # Codec -> container compatibility mapping
    ├── file-extensions.ts             # input/output file extensions and filters
    └── validation.ts                  # Time/scale/bitrate/range validation helpers

e2e/                                   # Playwright-based E2E tests
├── vitest.e2e.config.ts               # Vitest config for e2e
├── specs/                             # 10 spec files covering all pages
└── mocks/                             # Mock preload + in-memory state
```
