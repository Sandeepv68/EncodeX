# 🗂️ Project Structure

```
src/
├── test-setup.ts                      # Vitest global setup: jest-dom matchers + i18n/electronAPI mocks
├── main/                              # Electron main process
│   ├── index.ts                       # Entry: CLI detection, splash + main window, console bridging
│   ├── cli/                            # Commander-based CLI entry (subcommands)
│   │   ├── cli.ts                       # Entry: legacy shim, subcommand dispatch, exit codes
│   │   ├── cli-options.ts               # Shared global options + CliExitError
│   │   ├── cli-ui.ts                    # Colors, spinners, progress bars, tables
│   │   ├── cli-util.ts                  # Glob expansion, output derivation, formatting
│   │   ├── cli-convert.ts               # convert subcommand
│   │   ├── cli-info.ts                  # info + capabilities subcommands
│   │   ├── cli-compress.ts              # compress + extract-audio subcommands
│   │   └── cli-batch.ts                 # batch subcommand (JobQueue + MultiBar)
│   ├── capabilities.ts                # Encoder probing (ffmpeg -encoders / -hwaccels)
│   ├── process-utils.ts               # Child-process helpers (spawn, suspend, resume, kill)
│   ├── image-info.ts                  # EXIF extraction + RGB/luma histogram via ffmpeg
│   ├── image-preview.ts               # Downscaled base64 image previews
│   ├── image-file-info.ts             # Image dimensions/size probing
│   ├── video-preview.ts               # Single-frame video thumbnails
│   ├── updater.ts                      # GitHub Releases update checker, download, install
│   ├── ffprobe-static.d.ts            # Module declaration for ffprobe-static
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
│   ├── ColorModeContext.tsx           # Dark/light theme context
│   ├── useLanguageDirection.ts        # RTL/LTR detection hook
│   ├── theme.ts                       # MUI light/dark theme definitions
│   ├── colors.ts                      # Shared color palette
│   ├── electron-api.d.ts              # Global Window.electronAPI type declaration
│   ├── components/                    # Shared UI components (37 modules)
│   ├── hooks/                         # useConversion, useErrorHandler, useFormErrors, ...
│   ├── i18n/                          # i18next config, RTL provider, 56 locales
│   ├── pages/                         # 10 code-split page components
│   ├── stores/                        # Zustand stores (12 modules)
│   ├── styles/                        # Extracted MUI style constants per component (42 modules)
│   └── utils/
│       └── formatters.ts              # Duration/bitrate/stream formatting helpers
└── shared/                            # Code shared between processes
    ├── errors.ts                      # ErrorCode enum, AppError, formatError()
    ├── ipc-channels.ts                # All IPC channel name constants
    ├── types.ts                       # Domain interfaces (ConversionOptions, MediaInfo, ...)
    ├── constants.ts                   # Numeric/string constants
    ├── log-constants.ts               # Shared log message constants (406 exported)
    ├── logger.ts                      # Timestamped logger (main/renderer)
    └── validation.ts                  # Time/scale/bitrate/range validation helpers

e2e/                                  # Playwright-based end-to-end tests
├── vitest.e2e.config.ts              # Vitest config for e2e (node env, 60s timeout)
├── vitest.e2e.real.config.ts         # Vitest config for real conversion tests
├── helpers.ts                         # E2E helper utilities
├── cli.spec.ts                        # CLI binary e2e tests
├── fixtures/
│   └── app.ts                         # Electron app launch/teardown helpers
├── mocks/
│   ├── control.ts                     # Typed helpers for driving mock electronAPI
│   ├── main-store.js                  # In-memory state backing the mock preload
│   └── preload.js                     # Mock preload (replaces real preload in test mode)
└── specs/                             # 11 E2E spec files
    ├── shell.spec.ts
    ├── convert.spec.ts
    ├── batch.spec.ts
    ├── audio-extract.spec.ts
    ├── image-compress.spec.ts
    ├── media-info.spec.ts
    ├── settings.spec.ts
    ├── logs.spec.ts
    ├── video-cut.spec.ts
    └── real-convert.spec.ts
```
