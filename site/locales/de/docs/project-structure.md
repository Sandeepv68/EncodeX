# Projektstruktur

```
src/
â”œâ”€â”€ test-setup.ts                      # Vitest global setup: jest-dom matchers + i18n/electronAPI mocks
â”œâ”€â”€ test-setup.crash.ts                # Vitest setup that trips the crash tripwire
â”œâ”€â”€ test-utils/                        # Shared test helpers (not test files themselves)
â”‚   â”œâ”€â”€ axe.ts                         # axe-core rule configuration + page scan helper
â”‚   â”œâ”€â”€ crash-tripwire.ts              # Fails a test when the app crashes mid-run
â”‚   â”œâ”€â”€ deferred.ts                    # Deferred promise helper
â”‚   â”œâ”€â”€ hostile-api.ts                 # Hostile/malformed electronAPI payloads
â”‚   â”œâ”€â”€ listener-probe.ts              # IPC listener leak probe
â”‚   â”œâ”€â”€ media-corpus.ts                # Synthetic + corrupt media corpus helpers
â”‚   â””â”€â”€ page-render.tsx                # Shared page render helper for renderer tests
â”œâ”€â”€ main/                              # Electron main process
â”‚   â”œâ”€â”€ index.ts                       # Entry: --mcp branch, CLI detection, splash + main window, console bridging
â”‚   â”œâ”€â”€ capabilities.ts                # Encoder probing (ffmpeg -encoders / -hwaccels)
â”‚   â”œâ”€â”€ process-utils.ts               # Child-process helpers (spawn, suspend, resume, kill)
â”‚   â”œâ”€â”€ spawn-timeout.ts               # Spawn helpers with timeout/abort handling
â”‚   â”œâ”€â”€ media-binaries.ts              # Resolves ffmpeg/ffprobe binary paths (static fallback â†’ system)
â”‚   â”œâ”€â”€ media-files.ts                 # Supported media file discovery/extensions
â”‚   â”œâ”€â”€ power-actions.ts               # Shut down / sleep / hibernate helpers (shutdown, pmset, systemctl)
â”‚   â”œâ”€â”€ preview-cache.ts               # LRU cache for image/video previews
â”‚   â”œâ”€â”€ cli-logo.ts                    # ASCII art + logo theme colors for CLI output
â”‚   â”œâ”€â”€ image-info.ts                  # EXIF extraction + RGB/luma histogram via ffmpeg
â”‚   â”œâ”€â”€ image-preview.ts               # Downscaled base64 image previews
â”‚   â”œâ”€â”€ image-file-info.ts             # Image dimensions/size probing
â”‚   â”œâ”€â”€ video-preview.ts               # Single-frame video thumbnails
â”‚   â”œâ”€â”€ updater.ts                     # GitHub Releases update checker, download, install
â”‚   â”œâ”€â”€ ffprobe-static.d.ts            # Module declaration for ffprobe-static
â”‚   â”œâ”€â”€ generated/                     # Build-time generated configs (git-ignored)
â”‚   â”‚   â”œâ”€â”€ sentryBuildConfig.ts       # Sentry DSN + release metadata (npm run gen:sentry-config)
â”‚   â”‚   â””â”€â”€ aptabaseBuildConfig.ts     # Aptabase app key + host (npm run gen:aptabase-config)
â”‚   â”œâ”€â”€ cli/                           # Commander-based CLI entry (subcommands)
â”‚   â”‚   â”œâ”€â”€ cli.ts                     # Entry: legacy shim, subcommand dispatch, exit codes
â”‚   â”‚   â”œâ”€â”€ cli-options.ts             # Shared global options + CliExitError
â”‚   â”‚   â”œâ”€â”€ cli-ui.ts                  # Colors, spinners, progress bars, tables
â”‚   â”‚   â”œâ”€â”€ cli-util.ts                # Glob expansion, output derivation, formatting
â”‚   â”‚   â”œâ”€â”€ cli-convert.ts             # convert subcommand
â”‚   â”‚   â”œâ”€â”€ cli-info.ts                # info + capabilities subcommands
â”‚   â”‚   â”œâ”€â”€ cli-compress.ts            # compress + extract-audio subcommands
â”‚   â”‚   â”œâ”€â”€ cli-batch.ts               # batch subcommand (JobQueue + MultiBar)
â”‚   â”‚   â”œâ”€â”€ cli-remux.ts               # remux subcommand (stream copy + tracks/chapters/sync)
â”‚   â”‚   â””â”€â”€ cli-demux.ts               # demux subcommand (per-stream extraction)
â”‚   â”œâ”€â”€ ipc/                           # IPC handler modules (error-wrapped)
â”‚   â”‚   â”œâ”€â”€ handlers.ts                # Central registration + error wrapper
â”‚   â”‚   â”œâ”€â”€ dialogs.ts                 # select-file / select-files / select-folder-files / select-output / select-directory / expand-paths
â”‚   â”‚   â”œâ”€â”€ conversion.ts              # convert / cancel / pause / resume
â”‚   â”‚   â”œâ”€â”€ copilot.ts                 # copilot-plan handler
â”‚   â”‚   â”œâ”€â”€ queue.ts                   # queue CRUD + cancel-all + move/update/export/import
â”‚   â”‚   â”œâ”€â”€ player.ts                  # player open / seek / close / get-frame
â”‚   â”‚   â”œâ”€â”€ timeline.ts                # extract-waveform / extract-thumbnails
â”‚   â”‚   â”œâ”€â”€ image.ts                   # image info / preview / file info
â”‚   â”‚   â”œâ”€â”€ capabilities.ts            # get-capabilities / get-bmf-status
â”‚   â”‚   â”œâ”€â”€ window.ts                  # minimize / maximize / close / always-on-top / terms-reject / close-confirmation
â”‚   â”‚   â”œâ”€â”€ updater.ts                 # check / download / install / schedule-install-on-restart
â”‚   â”‚   â”œâ”€â”€ system.ts                  # queue-reveal / set-launch-at-login
â”‚   â”‚   â”œâ”€â”€ dev.ts                     # dev-capture-screenshot (dev mode only)
â”‚   â”‚   â”œâ”€â”€ send.ts                    # Event broadcast helpers
â”‚   â”‚   â””â”€â”€ types.ts                   # Type-safe main->renderer sender signature
â”‚   â”œâ”€â”€ ai/                            # Copilot AI providers and routing
â”‚   â”‚   â”œâ”€â”€ connectors.ts              # Provider connectors (OpenAI, Anthropic, Gemini, local)
â”‚   â”‚   â”œâ”€â”€ intelligence.ts            # Analysis / plan generation
â”‚   â”‚   â”œâ”€â”€ model-resolution.ts        # Model aliases and defaults
â”‚   â”‚   â”œâ”€â”€ models.ts                  # Model catalogue
â”‚   â”‚   â”œâ”€â”€ operation-router.ts        # Maps planned actions to engine operations
â”‚   â”‚   â”œâ”€â”€ provider-registry.ts       # Provider registration / selection
â”‚   â”‚   â”œâ”€â”€ settings.ts                # AI settings persistence + secret encryption
â”‚   â”‚   â””â”€â”€ settings-ipc.ts            # ai-settings-* / ai-connect-test / ai-models-list bridge
â”‚   â”œâ”€â”€ analytics/                     # Aptabase usage-analytics adapters
â”‚   â”‚   â”œâ”€â”€ aptabaseMainProvider.ts    # Aptabase provider
â”‚   â”‚   â”œâ”€â”€ consent.ts                 # userData analytics-consent.json load/save
â”‚   â”‚   â”œâ”€â”€ ipcBridge.ts               # analytics-get-state / analytics-set-enabled handlers
â”‚   â”‚   â””â”€â”€ providerFactory.ts         # Provider selection
â”‚   â”œâ”€â”€ security/
â”‚   â”‚   â””â”€â”€ csp.ts                     # Content-Security-Policy headers
â”‚   â”œâ”€â”€ mcp/                           # Embedded MCP server (GUI mode)
â”‚   â”‚   â”œâ”€â”€ http-server.ts             # Streamable HTTP transport (127.0.0.1, DNS-rebinding guard, bearer token)
â”‚   â”‚   â”œâ”€â”€ gui-tools.ts               # 6 GUI-parity tools (queue state, preview, timeline, system info, updates)
â”‚   â”‚   â”œâ”€â”€ settings.ts                # userData/mcp-settings.json persistence (BOM-tolerant, clamped)
â”‚   â”‚   â””â”€â”€ settings-ipc.ts            # mcp-settings-get / mcp-settings-set IPC bridge
â”‚   â”œâ”€â”€ monitoring/                    # Error-monitoring adapters (main process)
â”‚   â”‚   â”œâ”€â”€ types.ts                   # MonitorProvider contract for main
â”‚   â”‚   â”œâ”€â”€ sentryMainProvider.ts      # Sentry adapter (crashes, tracing, profiler, ANR, screenshots)
â”‚   â”‚   â”œâ”€â”€ providerFactory.ts         # Provider selection from env/DSN
â”‚   â”‚   â”œâ”€â”€ ipcBridge.ts               # MONITORING_GET_STATE / MONITORING_SET_ENABLED handlers + consent wiring
â”‚   â”‚   â””â”€â”€ consent.ts                 # userData/monitoring-consent.json load/save
â”‚   â”œâ”€â”€ player/
â”‚   â”‚   â”œâ”€â”€ frame-decoder.ts           # Rawvideo frame + PCM audio pipe decoder
â”‚   â”‚   â””â”€â”€ types.ts                   # Decoded frame/audio structures + config types
â”‚   â”œâ”€â”€ queue/
â”‚   â”‚   â”œâ”€â”€ job-queue.ts               # Concurrency-capped batch queue (1-4 parallel jobs) with EventEmitter
â”‚   â”‚   â”œâ”€â”€ persistence.ts             # Durable queue snapshot (queue-state.json) save/restore
â”‚   â”‚   â””â”€â”€ queue-transfer.ts          # Queue export/import (JSON) + validation
â”‚   â”œâ”€â”€ timeline/
â”‚   â”‚   â””â”€â”€ timeline-media.ts          # Waveform + thumbnail-montage extraction
â”‚   â””â”€â”€ transcoders/
â”‚       â”œâ”€â”€ types.ts                   # ITranscoder contract + raw ffprobe JSON shapes
â”‚       â”œâ”€â”€ factory.ts                 # Transcoder factory (FFMPEG | FFTOOL | BMF)
â”‚       â”œâ”€â”€ ffmpeg-core.ts             # fluent-ffmpeg API core
â”‚       â”œâ”€â”€ fftool-core.ts             # Direct CLI invocation via child_process
â”‚       â”œâ”€â”€ bmf-core.ts                # BMF framework CLI wrapper
â”‚       â”œâ”€â”€ bmf-availability.ts        # Probes PATH for bmf_ffmpeg / bmf_ffprobe
â”‚       â”œâ”€â”€ ffmpeg-utils.ts            # Shared command/flag builders
â”‚       â”œâ”€â”€ ffprobe-mapper.ts          # ffprobe JSON -> MediaInfo normalization
â”‚       â””â”€â”€ hwaccel.ts                 # Hardware-acceleration filter/flag resolution
â”œâ”€â”€ mcp/                               # Standalone MCP server (Node entry, shared with --mcp)
â”‚   â”œâ”€â”€ index.ts                       # Entry: stdio handshake, tool/resources/prompts registration
â”‚   â”œâ”€â”€ run.ts                         # Raw fd 0/1 stdio transport + server startup/shutdown
â”‚   â”œâ”€â”€ server.ts                      # Server wiring: tools, resources, prompts, protocol lifecycle
â”‚   â”œâ”€â”€ operations.ts                  # MCP tool implementations (convert, analyze, plan, batch, â€¦)
â”‚   â”œâ”€â”€ conversion-options.ts          # MCP call -> ConversionOptions mapping + arg parsing
â”‚   â”œâ”€â”€ safety.ts                      # Tool safety tiers + batch envelope limits
â”‚   â”œâ”€â”€ http.ts                        # Streamable HTTP transport primitives
â”‚   â”œâ”€â”€ http-server.ts                 # Standalone HTTP server entry (npm run mcp:http)
â”‚   â”œâ”€â”€ local-model-client.ts          # On-device model runtime client (local AI provider)
â”‚   â”œâ”€â”€ stt-engine.ts                  # Speech-to-text engine (whisper adapter)
â”‚   â”œâ”€â”€ translate-engine.ts            # Translation engine adapter
â”‚   â”œâ”€â”€ frame-sampler.ts               # Sampled frame extraction for thumbnails/highlights
â”‚   â”œâ”€â”€ ui/                            # MCP Apps approval bridge + UI resource registry
â”‚   â”‚   â”œâ”€â”€ bridge.ts                  # Renderer-side bridge for MCP Apps views
â”‚   â”‚   â”œâ”€â”€ registry.ts                # UI resource registry
â”‚   â”‚   â”œâ”€â”€ resources.ts               # UI resource payloads
â”‚   â”‚   â”œâ”€â”€ approval.ts                # User approval flow for MCP-initiated operations
â”‚   â”‚   â””â”€â”€ views/                     # 11 interactive MCP Apps views
â”‚   â”‚       â”œâ”€â”€ batch.ts               # Batch view
â”‚   â”‚       â”œâ”€â”€ confirm.ts             # Confirmation view
â”‚   â”‚       â”œâ”€â”€ convert.ts             # Conversion view
â”‚   â”‚       â”œâ”€â”€ error.ts               # Error view
â”‚   â”‚       â”œâ”€â”€ inspector.ts           # Inspector view
â”‚   â”‚       â”œâ”€â”€ job.ts                 # Job status view
â”‚   â”‚       â”œâ”€â”€ lab.ts                 # Media lab view
â”‚   â”‚       â”œâ”€â”€ media-info.ts          # Media info view
â”‚   â”‚       â”œâ”€â”€ plan.ts                # Plan review view
â”‚   â”‚       â”œâ”€â”€ queue.ts               # Queue view
â”‚   â”‚       â””â”€â”€ workflow.ts            # Workflow view
â”‚   â””â”€â”€ jobs/
â”‚       â”œâ”€â”€ manager.ts                 # In-memory async job manager (shared with GUI queue in embedded mode)
â”‚       â””â”€â”€ task-store.ts              # Durable task store for MCP tasks
â”œâ”€â”€ preload/
â”‚   â””â”€â”€ index.ts                       # contextBridge exposes electronAPI to renderer
â”œâ”€â”€ renderer/                          # React UI (served by Vite, root: src/renderer)
â”‚   â”œâ”€â”€ main.tsx                       # React entry: monitoring bootstrap + HashRouter + DirectionProvider + I18nextProvider
â”‚   â”œâ”€â”€ App.tsx                        # Root layout: TitleBar, Drawer, routes, snackbar, toasts
â”‚   â”œâ”€â”€ ColorModeContext.tsx           # Dark/light theme context
â”‚   â”œâ”€â”€ useLanguageDirection.ts        # RTL/LTR detection hook
â”‚   â”œâ”€â”€ sessionCleanup.ts              # Queue/terms/theme persistence + session cleanup
â”‚   â”œâ”€â”€ theme.ts                       # MUI light/dark theme definitions
â”‚   â”œâ”€â”€ colors.ts                      # Shared color palette
â”‚   â”œâ”€â”€ electron-api.d.ts              # Global Window.electronAPI type declaration
â”‚   â”œâ”€â”€ monitoring/
â”‚   â”‚   â”œâ”€â”€ sentryRendererProvider.ts  # Renderer Sentry adapter (events flow to main; DSN never in bundle)
â”‚   â”‚   â””â”€â”€ providerFactory.ts         # Renderer provider selection (queries consent from main)
â”‚   â”œâ”€â”€ analytics/
â”‚   â”‚   â”œâ”€â”€ aptabaseRendererProvider.ts # Renderer Aptabase adapter (events flow to main)
â”‚   â”‚   â””â”€â”€ providerFactory.ts          # Renderer provider selection
â”‚   â”œâ”€â”€ dev/
â”‚   â”‚   â””â”€â”€ useDevScreenshot.ts        # Dev-only window screenshot capture
â”‚   â”œâ”€â”€ components/                    # Shared UI components (62 modules: 48 top-level + copilot/ and settings/ subfolders) <!-- drift:renderer-components=72 --> <!-- drift:renderer-components-top=54 -->
â”‚   â”œâ”€â”€ constants/
â”‚   â”‚   â””â”€â”€ shortcuts.ts               # 71 keyboard shortcuts registry (11 sections) + tooltip hints <!-- drift:shortcuts=71 --> <!-- drift:shortcut-sections=11 -->
â”‚   â”œâ”€â”€ hooks/                         # useConversion, useErrorHandler, useFormErrors, useMediaTask, useCapabilities, useHotkeys, useFieldId
â”‚   â”œâ”€â”€ i18n/                          # i18next config, RTL provider, 56 locales (36 base language subtags) <!-- drift:locales=56 --> <!-- drift:locale-subtags=36 -->
â”‚   â”œâ”€â”€ pages/                         # 13 code-split page components (Convert, Remux, Demux, Copilot, BatchQueue, Dashboard, MediaInfo, ImageCompress, AudioExtract, VideoCut, Settings, Logs, About) <!-- drift:renderer-pages=13 -->
â”‚   â”œâ”€â”€ stores/                        # 20 Zustand stores (queue, conversion, settings, profile, terms, batchConfig, audioExtract, videoCut, logs, errors, toasts, update, task, dismissedAlerts, aiSettings, aiConnection, audit, copilotChats, remux, demux) <!-- drift:renderer-stores=21 -->
â”‚   â”œâ”€â”€ styles/                        # Extracted MUI style constants per component (72 modules + Copilot/Settings subfolders) <!-- drift:renderer-styles=76 -->
â”‚   â””â”€â”€ utils/                         # formatters, preview cache helpers, easter egg dates, batch options
â””â”€â”€ shared/                            # Code shared between processes
    â”œâ”€â”€ app-constants.ts               # App-wide constants
    â”œâ”€â”€ constants.ts                   # Numeric/string constants
    â”œâ”€â”€ errors.ts                      # ErrorCode enum, AppError, formatError()
    â”œâ”€â”€ ipc-channels.ts                # All IPC channel name constants (incl. MCP/monitoring/terms/dev)
    â”œâ”€â”€ ipc-guards.ts                  # Runtime payload validation for IPC handlers
    â”œâ”€â”€ csp.ts                         # Content-Security-Policy directives
    â”œâ”€â”€ types.ts                       # Domain interfaces (ConversionOptions, MediaInfo, ...)
    â”œâ”€â”€ terms.ts                       # Versioned Terms & Conditions (TERMS_VERSION)
    â”œâ”€â”€ logger.ts                      # Timestamped logger (main/renderer)
    â”œâ”€â”€ log-constants.ts               # Shared log message constants (581 exported) 581
    â”œâ”€â”€ validation.ts                  # Time/scale/bitrate/range validation helpers
    â”œâ”€â”€ math.ts                        # Math helpers (clamp, round, percent)
    â”œâ”€â”€ progress.ts                    # Progress/ETA computation helpers
    â”œâ”€â”€ estimate.ts                    # Output-size estimation helpers
    â”œâ”€â”€ media-options.ts               # Media option normalization helpers
    â”œâ”€â”€ codec-classification.ts        # Codec family/encoder-type classification
    â”œâ”€â”€ codec-containers.ts            # Codec <-> container compatibility mapping
    â”œâ”€â”€ file-extensions.ts             # Supported extension lists + category grouping
    â”œâ”€â”€ hwaccel-settings.ts            # Hardware-acceleration settings types/constants
    â”œâ”€â”€ transcoder-constants.ts        # Transcoder flags, defaults, labels
    â”œâ”€â”€ mcp-settings.ts                # MCP settings contract + port constants/sanitizers
    â”œâ”€â”€ mcp-ui.ts                      # MCP Apps UI resource contract
    â”œâ”€â”€ copilot.ts                     # Copilot plan request/result contracts
    â”œâ”€â”€ video-filters.ts               # Curated video filter presets + chain normalization
    â”œâ”€â”€ remux-utils.ts                 # Remux/demux argument builders and validation
    â”œâ”€â”€ audit.ts                       # Mutating-operation audit entry contract + guard
    â”œâ”€â”€ ai/                            # Copilot/AI contracts and planners (analyze, recommend, workflow, STT, translation, â€¦)
    â”‚   â”œâ”€â”€ index.ts                   # Barrel export for the AI planner modules
    â”‚   â”œâ”€â”€ types.ts                   # Shared AI contracts (provider, intent, constraints)
    â”‚   â”œâ”€â”€ settings.ts                # AiSettingsView / AiSettingsUpdate / connect-test results
    â”‚   â”œâ”€â”€ provider.ts                # Provider interface + capabilities
    â”‚   â”œâ”€â”€ connector.ts               # Connector contract
    â”‚   â”œâ”€â”€ llm.ts                     # LLM request/response helpers
    â”‚   â”œâ”€â”€ connect-error.ts           # Normalized provider connection errors
    â”‚   â”œâ”€â”€ analyze.ts                 # Media analysis (compat / quality / size)
    â”‚   â”œâ”€â”€ advisor.ts                 # Encoder/hardware-path advice
    â”‚   â”œâ”€â”€ agent.ts                   # Agent planning over a folder of media
    â”‚   â”œâ”€â”€ chapters.ts                # Chapter generation
    â”‚   â”œâ”€â”€ edit.ts                    # Edit/clip planning
    â”‚   â”œâ”€â”€ error-explain.ts           # Error explanation + fixes
    â”‚   â”œâ”€â”€ estimate.ts                # Output-size estimation
    â”‚   â”œâ”€â”€ folder.ts                  # Folder-level analysis
    â”‚   â”œâ”€â”€ highlight.ts               # Scene/highlight detection
    â”‚   â”œâ”€â”€ media-facts.ts             # Shared media fact extraction
    â”‚   â”œâ”€â”€ quality.ts                 # Output quality reports
    â”‚   â”œâ”€â”€ recommend.ts               # Setting recommendations
    â”‚   â”œâ”€â”€ similarity.ts              # Duplicate / near-duplicate detection
    â”‚   â”œâ”€â”€ social.ts                  # Social-platform packaging plans
    â”‚   â”œâ”€â”€ stt.ts                     # Speech-to-text contracts
    â”‚   â”œâ”€â”€ subtitles.ts               # Subtitle contracts
    â”‚   â”œâ”€â”€ summarize.ts               # Summarization + topics
    â”‚   â”œâ”€â”€ target-size.ts             # Compress-to-target ladder
    â”‚   â”œâ”€â”€ text.ts                    # Shared text utilities
    â”‚   â”œâ”€â”€ transcript.ts              # Transcript contracts
    â”‚   â”œâ”€â”€ transcript-search.ts       # Transcript search + spans
    â”‚   â”œâ”€â”€ translate.ts               # Translation contracts
    â”‚   â”œâ”€â”€ units.ts                   # Unit conversions
    â”‚   â”œâ”€â”€ validate.ts                # Output validation checks
    â”‚   â””â”€â”€ workflow.ts                # Multi-step workflow plans
    â”œâ”€â”€ profiles/                      # Conversion profiles
    â”‚   â”œâ”€â”€ builtin.ts                 # 115 built-in profiles across 8 categories <!-- drift:builtin-profiles=115 --> <!-- drift:profile-categories=8 -->
    â”‚   â”œâ”€â”€ categories.ts              # Profile category metadata (web-social, devices, video, professional, streaming, audio, images, advanced)
    â”‚   â””â”€â”€ index.ts                   # Profile types + helpers
    â”œâ”€â”€ monitoring/                    # Provider-agnostic monitoring facade
    â”‚   â”œâ”€â”€ types.ts                   # MonitorProvider contract ("port")
    â”‚   â”œâ”€â”€ MonitoringService.ts       # Facade singleton (initMonitoring / captureException / â€¦)
    â”‚   â””â”€â”€ noopProvider.ts            # Safe no-op fallback
    â””â”€â”€ analytics/                     # Lightweight analytics service + events
        â”œâ”€â”€ AnalyticsService.ts        # Facade singleton (initAnalytics / recordAnalyticsEvent / â€¦)
        â”œâ”€â”€ types.ts                   # AnalyticsProvider contract ("port")
        â”œâ”€â”€ events.ts                  # Authoritative event taxonomy (names, payloads, groups, tiers)
        â”œâ”€â”€ analytics-summaries.ts     # Aggregate/summary helpers for dashboards
        â””â”€â”€ noopProvider.ts            # Safe no-op fallback

e2e/                                  # Playwright-based end-to-end tests
â”œâ”€â”€ vitest.e2e.config.ts              # Vitest config for e2e (node env, 60s timeout)
â”œâ”€â”€ vitest.e2e.real.config.ts         # Vitest config for real conversion tests
â”œâ”€â”€ helpers.ts                         # E2E helper utilities
â”œâ”€â”€ cli.spec.ts                        # CLI binary e2e tests
â”œâ”€â”€ hostile-preload.d.ts               # Types for the hostile preload fixture
â”œâ”€â”€ quarantine.json                    # Quarantined (known-flaky) e2e specs
â”œâ”€â”€ fixtures/
â”‚   â””â”€â”€ app.ts                         # Electron app launch/teardown helpers
â”œâ”€â”€ mocks/
â”‚   â”œâ”€â”€ control.ts                     # Typed helpers for driving mock electronAPI
â”‚   â”œâ”€â”€ main-store.js                  # In-memory state backing the mock preload
â”‚   â””â”€â”€ preload.js                     # Mock preload (replaces real preload in test mode)
â”œâ”€â”€ mcp/                               # MCP end-to-end specs
â”‚   â”œâ”€â”€ stdio.spec.ts                  # stdio handshake + tool catalogue
â”‚   â”œâ”€â”€ http-standalone.spec.ts        # Standalone HTTP transport + auth
â”‚   â”œâ”€â”€ embedded-gui.spec.ts           # Embedded HTTP server with GUI-parity tools
â”‚   â”œâ”€â”€ mcp-apps.spec.ts               # MCP Apps UI bridge + approval flow
â”‚   â”œâ”€â”€ vscode-client.spec.ts          # VS Code MCP client configuration
â”‚   â””â”€â”€ vscode-ui.spec.ts              # VS Code UI integration
â”œâ”€â”€ quarantine/                        # Quarantined spec bodies (see quarantine.json)
â””â”€â”€ specs/                             # 31 E2E spec files (39 e2e files total) <!-- drift:e2e-specs=34 -->
    â”œâ”€â”€ shell.spec.ts
    â”œâ”€â”€ convert.spec.ts
    â”œâ”€â”€ batch.spec.ts
    â”œâ”€â”€ audio-extract.spec.ts
    â”œâ”€â”€ image-compress.spec.ts
    â”œâ”€â”€ media-info.spec.ts
    â”œâ”€â”€ settings.spec.ts
    â”œâ”€â”€ logs.spec.ts
    â”œâ”€â”€ video-cut.spec.ts
    â”œâ”€â”€ profiles.spec.ts              # Conversion profile selection + custom profiles
    â”œâ”€â”€ terms-gate.spec.ts            # Terms & Conditions gate (accept / reject)
    â””â”€â”€ real-convert.spec.ts

perf/                                 # Performance benchmarks (Vitest config perf/vitest.perf.config.ts)
â”œâ”€â”€ baseline.json                     # Committed perf baseline for npm run perf:compare
â”œâ”€â”€ cli-batch.perf.test.ts            # CLI batch throughput
â”œâ”€â”€ conversion-benchmark.perf.test.ts # End-to-end conversion benchmarks
â”œâ”€â”€ extraction.perf.test.ts           # Waveform/thumbnail extraction
â”œâ”€â”€ ipc-overhead.perf.test.ts         # IPC round-trip latency
â”œâ”€â”€ job-card-render.perf.test.tsx     # Job card render cost
â”œâ”€â”€ large-file.perf.test.ts           # Large media handling
â”œâ”€â”€ memory-leak.perf.test.ts          # Peak RSS / leak detection
â”œâ”€â”€ phase8-io.perf.test.ts            # I/O pipeline benchmarks
â”œâ”€â”€ phase8-queue.perf.test.ts         # Queue pipeline benchmarks
â”œâ”€â”€ process-lifecycle.perf.test.ts    # Main process boot/shutdown
â”œâ”€â”€ queue-concurrency.perf.test.ts    # Parallel queue scaling
â”œâ”€â”€ startup.perf.test.ts              # Cold-start timings
â”œâ”€â”€ test-utils.ts                     # Shared benchmark helpers
â””â”€â”€ fixtures/generate-media.cjs       # Synthetic media generators

bin/                                  # Packaged CLI entry points
â”œâ”€â”€ encodex.js                        # `encodex` launcher (wraps the Electron binary)

scripts/                              # Build/CI helper scripts (lint configs, gates, generators)
â”œâ”€â”€ check-doc-drift.mjs               # Documentation drift checker (wiki/docs/site vs source)
â”œâ”€â”€ validate-locales.mjs              # Locale key/value consistency gate
â”œâ”€â”€ sync-locale-keys.mjs              # Locale key backfill/sync
â”œâ”€â”€ audit-gate.mjs                    # Blocking dependency-audit gate
â”œâ”€â”€ coverage-floor-gate.mjs           # Per-file coverage ratchet
â”œâ”€â”€ coverage-baseline.mjs             # Coverage baseline generation
â”œâ”€â”€ coverage-diff.mjs                 # Coverage delta report
â”œâ”€â”€ mutation-scope.mjs                # Mutation scope computation
â”œâ”€â”€ mutation-delta.mjs                # Mutation delta vs baseline
â”œâ”€â”€ flake-detect.mjs                  # Flaky test detection
â”œâ”€â”€ mcp-smoke.mjs                     # MCP stdio smoke test
â”œâ”€â”€ mcp-full-test.mjs                 # MCP tool-catalogue regression run
â”œâ”€â”€ perf-compare.mjs                  # Perf baseline comparison
â”œâ”€â”€ generate-sentry-config.mjs        # Bakes the Sentry DSN into src/main/generated/
â”œâ”€â”€ generate-aptabase-config.mjs      # Bakes the Aptabase app key into src/main/generated/
â”œâ”€â”€ generate-blog.mjs                 # Generates the release blog index
â”œâ”€â”€ generate-rss.mjs                  # Generates the site feed
â”œâ”€â”€ normalize-build.mjs               # Normalizes the built docs site
â”œâ”€â”€ fetch-media-binaries.mjs          # Downloads platform ffmpeg/ffprobe binaries
â”œâ”€â”€ locale-backfill.mjs               # Backfills missing locale keys
â”œâ”€â”€ update-translations.mjs           # Applies translation updates
â”œâ”€â”€ generate-desktop-icons.mjs        # Generates desktop icons from the app icon
â”œâ”€â”€ capture-screens.mjs               # Captures app screenshots for the site
â”œâ”€â”€ add-ogimage.mjs                   # Generates social preview images
â””â”€â”€ eslint.*.config.mjs               # Per-rule ESLint configurations

eslint-rules/                         # Custom ESLint rule implementations (+ node:test suites)

assets/                               # Icons and other static app assets
```
