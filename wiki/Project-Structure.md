# 🗂️ Project Structure

```
src/
├── test-setup.ts                      # Vitest global setup: jest-dom matchers + i18n/electronAPI mocks
├── main/                              # Electron main process
│   ├── index.ts                       # Entry: --mcp branch, CLI detection, splash + main window, console bridging
│   ├── capabilities.ts                # Encoder probing (ffmpeg -encoders / -hwaccels)
│   ├── process-utils.ts               # Child-process helpers (spawn, suspend, resume, kill)
│   ├── media-binaries.ts              # Resolves ffmpeg/ffprobe binary paths (static fallback → system)
│   ├── media-files.ts                 # Supported media file discovery/extensions
│   ├── power-actions.ts               # Shut down / sleep / hibernate helpers (shutdown, pmset, systemctl)
│   ├── preview-cache.ts               # LRU cache for image/video previews
│   ├── cli-logo.ts                    # ASCII art + logo theme colors for CLI output
│   ├── image-info.ts                  # EXIF extraction + RGB/luma histogram via ffmpeg
│   ├── image-preview.ts               # Downscaled base64 image previews
│   ├── image-file-info.ts             # Image dimensions/size probing
│   ├── video-preview.ts               # Single-frame video thumbnails
│   ├── updater.ts                     # GitHub Releases update checker, download, install
│   ├── ffprobe-static.d.ts            # Module declaration for ffprobe-static
│   ├── cli/                           # Commander-based CLI entry (subcommands)
│   │   ├── cli.ts                     # Entry: legacy shim, subcommand dispatch, exit codes
│   │   ├── cli-options.ts             # Shared global options + CliExitError
│   │   ├── cli-ui.ts                  # Colors, spinners, progress bars, tables
│   │   ├── cli-util.ts                # Glob expansion, output derivation, formatting
│   │   ├── cli-convert.ts             # convert subcommand
│   │   ├── cli-info.ts                # info + capabilities subcommands
│   │   ├── cli-compress.ts            # compress + extract-audio subcommands
│   │   └── cli-batch.ts               # batch subcommand (JobQueue + MultiBar)
│   ├── ipc/                           # IPC handler modules (error-wrapped)
│   │   ├── handlers.ts                # Central registration + error wrapper
│   │   ├── dialogs.ts                 # select-file / select-files / select-folder-files / select-output / select-directory / expand-paths
│   │   ├── conversion.ts              # convert / cancel / pause / resume
│   │   ├── queue.ts                   # queue CRUD + cancel-all + move/update/export/import
│   │   ├── player.ts                  # player open / seek / close / get-frame
│   │   ├── timeline.ts                # extract-waveform / extract-thumbnails
│   │   ├── image.ts                   # image info / preview / file info
│   │   ├── capabilities.ts            # get-capabilities
│   │   ├── window.ts                  # minimize / maximize / close / always-on-top / terms-reject / close-confirmation
│   │   ├── updater.ts                 # check / download / install updates
│   │   ├── system.ts                  # reveal-file / set-launch-at-login
│   │   ├── dev.ts                     # dev-capture-screenshot (dev mode only)
│   │   ├── send.ts                    # Event broadcast helpers
│   │   └── types.ts                   # Type-safe main->renderer sender signature
│   ├── mcp/                           # Embedded MCP server (GUI mode)
│   │   ├── http-server.ts             # Streamable HTTP transport (127.0.0.1, DNS-rebinding guard, bearer token)
│   │   ├── gui-tools.ts               # 6 GUI-parity tools (queue state, preview, timeline, system info, updates)
│   │   ├── settings.ts                # userData/mcp-settings.json persistence (BOM-tolerant, clamped)
│   │   └── settings-ipc.ts            # mcp-settings-get / mcp-settings-set IPC bridge
│   ├── monitoring/                    # Error-monitoring adapters (main process)
│   │   ├── types.ts                   # MonitorProvider contract for main
│   │   ├── sentryMainProvider.ts      # Sentry adapter (crashes, tracing, profiler, ANR, screenshots)
│   │   ├── providerFactory.ts         # Provider selection from env/DSN
│   │   ├── ipcBridge.ts               # MONITORING_GET_STATE / MONITORING_SET_ENABLED handlers + consent wiring
│   │   └── consent.ts                 # userData/monitoring-consent.json load/save
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
├── mcp/                               # Standalone MCP server (Node entry, shared with --mcp)
│   ├── index.ts                       # Entry: stdio handshake, tool/resources/prompts registration
│   ├── run.ts                         # Raw fd 0/1 stdio transport + server startup/shutdown
│   ├── server.ts                      # Server wiring: tools, resources, prompts, protocol lifecycle
│   ├── operations.ts                  # 13 core MCP tool implementations (convert, info, batch, …)
│   ├── conversion-options.ts          # MCP call -> ConversionOptions mapping + arg parsing
│   └── jobs/
│       └── manager.ts                 # In-memory async job manager (shared with GUI queue in embedded mode)
├── preload/
│   └── index.ts                       # contextBridge exposes electronAPI to renderer
├── renderer/                          # React UI (served by Vite, root: src/renderer)
│   ├── main.tsx                       # React entry: monitoring bootstrap + HashRouter + DirectionProvider + I18nextProvider
│   ├── App.tsx                        # Root layout: TitleBar, Drawer, routes, snackbar, toasts
│   ├── ColorModeContext.tsx           # Dark/light theme context
│   ├── useLanguageDirection.ts        # RTL/LTR detection hook
│   ├── sessionCleanup.ts              # Queue/terms/theme persistence + session cleanup
│   ├── theme.ts                       # MUI light/dark theme definitions
│   ├── colors.ts                      # Shared color palette
│   ├── electron-api.d.ts              # Global Window.electronAPI type declaration
│   ├── monitoring/
│   │   ├── sentryRendererProvider.ts  # Renderer Sentry adapter (events flow to main; DSN never in bundle)
│   │   └── providerFactory.ts         # Renderer provider selection (queries consent from main)
│   ├── components/                    # Shared UI components (39 modules incl. ErrorBoundary, UpdateDialog, ProfileSelector, TermsDialog, GettingStartedCard)
│   ├── constants/
│   │   └── shortcuts.ts               # 60+ keyboard shortcuts registry (9 sections) + tooltip hints
│   ├── hooks/                         # useConversion, useErrorHandler, useFormErrors, useMediaTask, useCapabilities, useHotkeys, useFieldId
│   ├── i18n/                          # i18next config, RTL provider, 56 locales / 35 languages
│   ├── pages/                         # 10 code-split page components (Convert, BatchQueue, Dashboard, MediaInfo, ImageCompress, AudioExtract, VideoCut, Settings, Logs, About)
│   ├── stores/                        # 14 Zustand stores (queue, conversion, settings, profile, terms, batchConfig, audioExtract, videoCut, logs, errors, toasts, update, task, dismissedAlerts)
│   ├── styles/                        # Extracted MUI style constants per component (42+ modules)
│   └── utils/                         # formatters, preview cache helpers, easter egg dates, batch options
└── shared/                            # Code shared between processes
    ├── app-constants.ts               # App-wide constants
    ├── constants.ts                   # Numeric/string constants
    ├── errors.ts                      # ErrorCode enum, AppError, formatError()
    ├── ipc-channels.ts                # All IPC channel name constants (incl. MCP/monitoring/terms/dev)
    ├── types.ts                       # Domain interfaces (ConversionOptions, MediaInfo, ...)
    ├── terms.ts                       # Versioned Terms & Conditions (TERMS_VERSION)
    ├── logger.ts                      # Timestamped logger (main/renderer)
    ├── log-constants.ts               # Shared log message constants (406 exported)
    ├── validation.ts                  # Time/scale/bitrate/range validation helpers
    ├── math.ts                        # Math helpers (clamp, round, percent)
    ├── progress.ts                    # Progress/ETA computation helpers
    ├── estimate.ts                    # Output-size estimation helpers
    ├── media-options.ts               # Media option normalization helpers
    ├── codec-classification.ts        # Codec family/encoder-type classification
    ├── codec-containers.ts            # Codec <-> container compatibility mapping
    ├── file-extensions.ts             # Supported extension lists + category grouping
    ├── hwaccel-settings.ts            # Hardware-acceleration settings types/constants
    ├── transcoder-constants.ts        # Transcoder flags, defaults, labels
    ├── mcp-settings.ts                # MCP settings contract + port constants/sanitizers
    ├── profiles/                      # Conversion profiles
    │   ├── builtin.ts                 # 115 built-in profiles across 8 categories
    │   ├── categories.ts              # Profile category metadata (web-social, devices, video, professional, streaming, audio, images, advanced)
    │   └── index.ts                   # Profile types + helpers
    ├── monitoring/                    # Provider-agnostic monitoring facade
    │   ├── types.ts                   # MonitorProvider contract ("port")
    │   ├── MonitoringService.ts       # Facade singleton (initMonitoring / captureException / …)
    │   └── noopProvider.ts            # Safe no-op fallback
    └── analytics/                     # Lightweight analytics service + events

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
└── specs/                             # 13 E2E spec files
    ├── shell.spec.ts
    ├── convert.spec.ts
    ├── batch.spec.ts
    ├── audio-extract.spec.ts
    ├── image-compress.spec.ts
    ├── media-info.spec.ts
    ├── settings.spec.ts
    ├── logs.spec.ts
    ├── video-cut.spec.ts
    ├── profiles.spec.ts              # Conversion profile selection + custom profiles
    ├── terms-gate.spec.ts            # Terms & Conditions gate (accept / reject)
    └── real-convert.spec.ts

perf/                                 # Performance benchmarks (Vitest config perf/vitest.perf.config.ts)
├── cli-batch.perf.test.ts            # CLI batch throughput
├── conversion-benchmark.perf.test.ts # End-to-end conversion benchmarks
├── extraction.perf.test.ts           # Waveform/thumbnail extraction
├── ipc-overhead.perf.test.ts         # IPC round-trip latency
├── large-file.perf.test.ts           # Large media handling
├── memory-leak.perf.test.ts          # Peak RSS / leak detection
├── process-lifecycle.perf.test.ts    # Main process boot/shutdown
├── queue-concurrency.perf.test.ts    # Parallel queue scaling
├── startup.perf.test.ts              # Cold-start timings
├── test-utils.ts                     # Shared benchmark helpers
└── fixtures/generate-media.cjs       # Synthetic media generators
```