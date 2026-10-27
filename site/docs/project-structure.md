---
title: "Project Structure — EncodeX Source Code Layout"
description: "EncodeX directory structure: src/main, src/renderer, src/preload, src/shared, src/mcp, src/main/cli, and how the Electron app codebase is organized."
---

# Project Structure

```
src/
├── test-setup.ts                      # Vitest global setup: jest-dom matchers + i18n/electronAPI mocks
├── test-setup.crash.ts                # Vitest setup that trips the crash tripwire
├── test-utils/                        # Shared test helpers (not test files themselves)
│   ├── axe.ts                         # axe-core rule configuration + page scan helper
│   ├── crash-tripwire.ts              # Fails a test when the app crashes mid-run
│   ├── deferred.ts                    # Deferred promise helper
│   ├── hostile-api.ts                 # Hostile/malformed electronAPI payloads
│   ├── listener-probe.ts              # IPC listener leak probe
│   ├── media-corpus.ts                # Synthetic + corrupt media corpus helpers
│   └── page-render.tsx                # Shared page render helper for renderer tests
├── main/                              # Electron main process
│   ├── index.ts                       # Entry: --mcp branch, CLI detection, splash + main window, console bridging
│   ├── capabilities.ts                # Encoder probing (ffmpeg -encoders / -hwaccels)
│   ├── process-utils.ts               # Child-process helpers (spawn, suspend, resume, kill)
│   ├── spawn-timeout.ts               # Spawn helpers with timeout/abort handling
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
│   ├── generated/                     # Build-time generated configs (git-ignored)
│   │   ├── sentryBuildConfig.ts       # Sentry DSN + release metadata (npm run gen:sentry-config)
│   │   └── aptabaseBuildConfig.ts     # Aptabase app key + host (npm run gen:aptabase-config)
│   ├── cli/                           # Commander-based CLI entry (subcommands)
│   │   ├── cli.ts                     # Entry: legacy shim, subcommand dispatch, exit codes
│   │   ├── cli-options.ts             # Shared global options + CliExitError
│   │   ├── cli-ui.ts                  # Colors, spinners, progress bars, tables
│   │   ├── cli-util.ts                # Glob expansion, output derivation, formatting
│   │   ├── cli-convert.ts             # convert subcommand
│   │   ├── cli-info.ts                # info + capabilities subcommands
│   │   ├── cli-compress.ts            # compress + extract-audio subcommands
│   │   ├── cli-batch.ts               # batch subcommand (JobQueue + MultiBar)
│   │   ├── cli-remux.ts               # remux subcommand (stream copy + tracks/chapters/sync)
│   │   └── cli-demux.ts               # demux subcommand (per-stream extraction)
│   ├── ipc/                           # IPC handler modules (error-wrapped)
│   │   ├── handlers.ts                # Central registration + error wrapper
│   │   ├── dialogs.ts                 # select-file / select-files / select-folder-files / select-output / select-directory / expand-paths
│   │   ├── conversion.ts              # convert / cancel / pause / resume
│   │   ├── copilot.ts                 # copilot-plan handler
│   │   ├── queue.ts                   # queue CRUD + cancel-all + move/update/export/import
│   │   ├── player.ts                  # player open / seek / close / get-frame
│   │   ├── timeline.ts                # extract-waveform / extract-thumbnails
│   │   ├── image.ts                   # image info / preview / file info
│   │   ├── capabilities.ts            # get-capabilities / get-bmf-status
│   │   ├── window.ts                  # minimize / maximize / close / always-on-top / terms-reject / close-confirmation
│   │   ├── updater.ts                 # check / download / install / schedule-install-on-restart
│   │   ├── system.ts                  # queue-reveal / set-launch-at-login
│   │   ├── dev.ts                     # dev-capture-screenshot (dev mode only)
│   │   ├── send.ts                    # Event broadcast helpers
│   │   └── types.ts                   # Type-safe main->renderer sender signature
│   ├── ai/                            # Copilot AI providers and routing
│   │   ├── connectors.ts              # Provider connectors (OpenAI, Anthropic, Gemini, local)
│   │   ├── intelligence.ts            # Analysis / plan generation
│   │   ├── model-resolution.ts        # Model aliases and defaults
│   │   ├── models.ts                  # Model catalogue
│   │   ├── operation-router.ts        # Maps planned actions to engine operations
│   │   ├── provider-registry.ts       # Provider registration / selection
│   │   ├── settings.ts                # AI settings persistence + secret encryption
│   │   └── settings-ipc.ts            # ai-settings-* / ai-connect-test / ai-models-list bridge
│   ├── analytics/                     # Aptabase usage-analytics adapters
│   │   ├── aptabaseMainProvider.ts    # Aptabase provider
│   │   ├── consent.ts                 # userData analytics-consent.json load/save
│   │   ├── ipcBridge.ts               # analytics-get-state / analytics-set-enabled handlers
│   │   └── providerFactory.ts         # Provider selection
│   ├── security/
│   │   └── csp.ts                     # Content-Security-Policy headers
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
│   │   ├── job-queue.ts               # Concurrency-capped batch queue (1-4 parallel jobs) with EventEmitter
│   │   ├── persistence.ts             # Durable queue snapshot (queue-state.json) save/restore
│   │   └── queue-transfer.ts          # Queue export/import (JSON) + validation
│   ├── timeline/
│   │   └── timeline-media.ts          # Waveform + thumbnail-montage extraction
│   └── transcoders/
│       ├── types.ts                   # ITranscoder contract + raw ffprobe JSON shapes
│       ├── factory.ts                 # Transcoder factory (FFMPEG | FFTOOL | BMF)
│       ├── ffmpeg-core.ts             # fluent-ffmpeg API core
│       ├── fftool-core.ts             # Direct CLI invocation via child_process
│       ├── bmf-core.ts                # BMF framework CLI wrapper
│       ├── bmf-availability.ts        # Probes PATH for bmf_ffmpeg / bmf_ffprobe
│       ├── ffmpeg-utils.ts            # Shared command/flag builders
│       ├── ffprobe-mapper.ts          # ffprobe JSON -> MediaInfo normalization
│       └── hwaccel.ts                 # Hardware-acceleration filter/flag resolution
├── mcp/                               # Standalone MCP server (Node entry, shared with --mcp)
│   ├── index.ts                       # Entry: stdio handshake, tool/resources/prompts registration
│   ├── run.ts                         # Raw fd 0/1 stdio transport + server startup/shutdown
│   ├── server.ts                      # Server wiring: tools, resources, prompts, protocol lifecycle
│   ├── operations.ts                  # MCP tool implementations (convert, analyze, plan, batch, …)
│   ├── conversion-options.ts          # MCP call -> ConversionOptions mapping + arg parsing
│   ├── safety.ts                      # Tool safety tiers + batch envelope limits
│   ├── http.ts                        # Streamable HTTP transport primitives
│   ├── http-server.ts                 # Standalone HTTP server entry (npm run mcp:http)
│   ├── local-model-client.ts          # On-device model runtime client (local AI provider)
│   ├── stt-engine.ts                  # Speech-to-text engine (whisper adapter)
│   ├── translate-engine.ts            # Translation engine adapter
│   ├── frame-sampler.ts               # Sampled frame extraction for thumbnails/highlights
│   ├── ui/                            # MCP Apps approval bridge + UI resource registry
│   │   ├── bridge.ts                  # Renderer-side bridge for MCP Apps views
│   │   ├── registry.ts                # UI resource registry
│   │   ├── resources.ts               # UI resource payloads
│   │   ├── approval.ts                # User approval flow for MCP-initiated operations
│   │   └── views/                     # 11 interactive MCP Apps views
│   │       ├── batch.ts               # Batch view
│   │       ├── confirm.ts             # Confirmation view
│   │       ├── convert.ts             # Conversion view
│   │       ├── error.ts               # Error view
│   │       ├── inspector.ts           # Inspector view
│   │       ├── job.ts                 # Job status view
│   │       ├── lab.ts                 # Media lab view
│   │       ├── media-info.ts          # Media info view
│   │       ├── plan.ts                # Plan review view
│   │       ├── queue.ts               # Queue view
│   │       └── workflow.ts            # Workflow view
│   └── jobs/
│       ├── manager.ts                 # In-memory async job manager (shared with GUI queue in embedded mode)
│       └── task-store.ts              # Durable task store for MCP tasks
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
│   ├── analytics/
│   │   ├── aptabaseRendererProvider.ts # Renderer Aptabase adapter (events flow to main)
│   │   └── providerFactory.ts          # Renderer provider selection
│   ├── dev/
│   │   └── useDevScreenshot.ts        # Dev-only window screenshot capture
│   ├── components/                    # Shared UI components (60 modules: 48 top-level + copilot/ and settings/ subfolders) <!-- drift:renderer-components=60 --> <!-- drift:renderer-components-top=48 -->
│   ├── constants/
│   │   └── shortcuts.ts               # 71 keyboard shortcuts registry (11 sections) + tooltip hints <!-- drift:shortcuts=71 --> <!-- drift:shortcut-sections=11 -->
│   ├── hooks/                         # useConversion, useErrorHandler, useFormErrors, useMediaTask, useCapabilities, useHotkeys, useFieldId
│   ├── i18n/                          # i18next config, RTL provider, 56 locales (36 base language subtags) <!-- drift:locales=56 --> <!-- drift:locale-subtags=36 -->
│   ├── pages/                         # 13 code-split page components (Convert, Remux, Demux, Copilot, BatchQueue, Dashboard, MediaInfo, ImageCompress, AudioExtract, VideoCut, Settings, Logs, About) <!-- drift:renderer-pages=13 -->
│   ├── stores/                        # 20 Zustand stores (queue, conversion, settings, profile, terms, batchConfig, audioExtract, videoCut, logs, errors, toasts, update, task, dismissedAlerts, aiSettings, aiConnection, audit, copilotChats, remux, demux) <!-- drift:renderer-stores=20 -->
│   ├── styles/                        # Extracted MUI style constants per component (57 modules + Copilot/Settings subfolders) <!-- drift:renderer-styles=57 -->
│   └── utils/                         # formatters, preview cache helpers, easter egg dates, batch options
└── shared/                            # Code shared between processes
    ├── app-constants.ts               # App-wide constants
    ├── constants.ts                   # Numeric/string constants
    ├── errors.ts                      # ErrorCode enum, AppError, formatError()
    ├── ipc-channels.ts                # All IPC channel name constants (incl. MCP/monitoring/terms/dev)
    ├── ipc-guards.ts                  # Runtime payload validation for IPC handlers
    ├── csp.ts                         # Content-Security-Policy directives
    ├── types.ts                       # Domain interfaces (ConversionOptions, MediaInfo, ...)
    ├── terms.ts                       # Versioned Terms & Conditions (TERMS_VERSION)
    ├── logger.ts                      # Timestamped logger (main/renderer)
    ├── log-constants.ts               # Shared log message constants (527 exported) <!-- drift:log-constants=527 -->
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
    ├── mcp-ui.ts                      # MCP Apps UI resource contract
    ├── copilot.ts                     # Copilot plan request/result contracts
    ├── video-filters.ts               # Curated video filter presets + chain normalization
    ├── remux-utils.ts                 # Remux/demux argument builders and validation
    ├── audit.ts                       # Mutating-operation audit entry contract + guard
    ├── ai/                            # Copilot/AI contracts and planners (analyze, recommend, workflow, STT, translation, …)
    │   ├── index.ts                   # Barrel export for the AI planner modules
    │   ├── types.ts                   # Shared AI contracts (provider, intent, constraints)
    │   ├── settings.ts                # AiSettingsView / AiSettingsUpdate / connect-test results
    │   ├── provider.ts                # Provider interface + capabilities
    │   ├── connector.ts               # Connector contract
    │   ├── llm.ts                     # LLM request/response helpers
    │   ├── connect-error.ts           # Normalized provider connection errors
    │   ├── analyze.ts                 # Media analysis (compat / quality / size)
    │   ├── advisor.ts                 # Encoder/hardware-path advice
    │   ├── agent.ts                   # Agent planning over a folder of media
    │   ├── chapters.ts                # Chapter generation
    │   ├── edit.ts                    # Edit/clip planning
    │   ├── error-explain.ts           # Error explanation + fixes
    │   ├── estimate.ts                # Output-size estimation
    │   ├── folder.ts                  # Folder-level analysis
    │   ├── highlight.ts               # Scene/highlight detection
    │   ├── media-facts.ts             # Shared media fact extraction
    │   ├── quality.ts                 # Output quality reports
    │   ├── recommend.ts               # Setting recommendations
    │   ├── similarity.ts              # Duplicate / near-duplicate detection
    │   ├── social.ts                  # Social-platform packaging plans
    │   ├── stt.ts                     # Speech-to-text contracts
    │   ├── subtitles.ts               # Subtitle contracts
    │   ├── summarize.ts               # Summarization + topics
    │   ├── target-size.ts             # Compress-to-target ladder
    │   ├── text.ts                    # Shared text utilities
    │   ├── transcript.ts              # Transcript contracts
    │   ├── transcript-search.ts       # Transcript search + spans
    │   ├── translate.ts               # Translation contracts
    │   ├── units.ts                   # Unit conversions
    │   ├── validate.ts                # Output validation checks
    │   └── workflow.ts                # Multi-step workflow plans
    ├── profiles/                      # Conversion profiles
    │   ├── builtin.ts                 # 115 built-in profiles across 8 categories <!-- drift:builtin-profiles=115 --> <!-- drift:profile-categories=8 -->
    │   ├── categories.ts              # Profile category metadata (web-social, devices, video, professional, streaming, audio, images, advanced)
    │   └── index.ts                   # Profile types + helpers
    ├── monitoring/                    # Provider-agnostic monitoring facade
    │   ├── types.ts                   # MonitorProvider contract ("port")
    │   ├── MonitoringService.ts       # Facade singleton (initMonitoring / captureException / …)
    │   └── noopProvider.ts            # Safe no-op fallback
    └── analytics/                     # Lightweight analytics service + events
        ├── AnalyticsService.ts        # Facade singleton (initAnalytics / recordAnalyticsEvent / …)
        ├── types.ts                   # AnalyticsProvider contract ("port")
        ├── events.ts                  # Authoritative event taxonomy (names, payloads, groups, tiers)
        ├── analytics-summaries.ts     # Aggregate/summary helpers for dashboards
        └── noopProvider.ts            # Safe no-op fallback

e2e/                                  # Playwright-based end-to-end tests
├── vitest.e2e.config.ts              # Vitest config for e2e (node env, 60s timeout)
├── vitest.e2e.real.config.ts         # Vitest config for real conversion tests
├── helpers.ts                         # E2E helper utilities
├── cli.spec.ts                        # CLI binary e2e tests
├── hostile-preload.d.ts               # Types for the hostile preload fixture
├── quarantine.json                    # Quarantined (known-flaky) e2e specs
├── fixtures/
│   └── app.ts                         # Electron app launch/teardown helpers
├── mocks/
│   ├── control.ts                     # Typed helpers for driving mock electronAPI
│   ├── main-store.js                  # In-memory state backing the mock preload
│   └── preload.js                     # Mock preload (replaces real preload in test mode)
├── mcp/                               # MCP end-to-end specs
│   ├── stdio.spec.ts                  # stdio handshake + tool catalogue
│   ├── http-standalone.spec.ts        # Standalone HTTP transport + auth
│   ├── embedded-gui.spec.ts           # Embedded HTTP server with GUI-parity tools
│   ├── mcp-apps.spec.ts               # MCP Apps UI bridge + approval flow
│   ├── vscode-client.spec.ts          # VS Code MCP client configuration
│   └── vscode-ui.spec.ts              # VS Code UI integration
├── quarantine/                        # Quarantined spec bodies (see quarantine.json)
└── specs/                             # 31 E2E spec files (39 e2e files total) <!-- drift:e2e-specs=31 -->
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
├── baseline.json                     # Committed perf baseline for npm run perf:compare
├── cli-batch.perf.test.ts            # CLI batch throughput
├── conversion-benchmark.perf.test.ts # End-to-end conversion benchmarks
├── extraction.perf.test.ts           # Waveform/thumbnail extraction
├── ipc-overhead.perf.test.ts         # IPC round-trip latency
├── job-card-render.perf.test.tsx     # Job card render cost
├── large-file.perf.test.ts           # Large media handling
├── memory-leak.perf.test.ts          # Peak RSS / leak detection
├── phase8-io.perf.test.ts            # I/O pipeline benchmarks
├── phase8-queue.perf.test.ts         # Queue pipeline benchmarks
├── process-lifecycle.perf.test.ts    # Main process boot/shutdown
├── queue-concurrency.perf.test.ts    # Parallel queue scaling
├── startup.perf.test.ts              # Cold-start timings
├── test-utils.ts                     # Shared benchmark helpers
└── fixtures/generate-media.cjs       # Synthetic media generators

bin/                                  # Packaged CLI entry points
├── encodex.js                        # `encodex` launcher (wraps the Electron binary)

scripts/                              # Build/CI helper scripts (lint configs, gates, generators)
├── check-doc-drift.mjs               # Documentation drift checker (wiki/docs/site vs source)
├── validate-locales.mjs              # Locale key/value consistency gate
├── sync-locale-keys.mjs              # Locale key backfill/sync
├── audit-gate.mjs                    # Blocking dependency-audit gate
├── coverage-floor-gate.mjs           # Per-file coverage ratchet
├── coverage-baseline.mjs             # Coverage baseline generation
├── coverage-diff.mjs                 # Coverage delta report
├── mutation-scope.mjs                # Mutation scope computation
├── mutation-delta.mjs                # Mutation delta vs baseline
├── flake-detect.mjs                  # Flaky test detection
├── mcp-smoke.mjs                     # MCP stdio smoke test
├── mcp-full-test.mjs                 # MCP tool-catalogue regression run
├── perf-compare.mjs                  # Perf baseline comparison
├── generate-sentry-config.mjs        # Bakes the Sentry DSN into src/main/generated/
├── generate-aptabase-config.mjs      # Bakes the Aptabase app key into src/main/generated/
├── generate-blog.mjs                 # Generates the release blog index
├── generate-rss.mjs                  # Generates the site feed
├── normalize-build.mjs               # Normalizes the built docs site
├── fetch-media-binaries.mjs          # Downloads platform ffmpeg/ffprobe binaries
├── locale-backfill.mjs               # Backfills missing locale keys
├── update-translations.mjs           # Applies translation updates
├── generate-desktop-icons.mjs        # Generates desktop icons from the app icon
├── capture-screens.mjs               # Captures app screenshots for the site
├── add-ogimage.mjs                   # Generates social preview images
└── eslint.*.config.mjs               # Per-rule ESLint configurations

eslint-rules/                         # Custom ESLint rule implementations (+ node:test suites)

assets/                               # Icons and other static app assets
```
