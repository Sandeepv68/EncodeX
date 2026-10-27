# Structure du projet

```
src/
├── test-setup.ts                      # Vitest global setup: jest-dom matchers + i18n/electronAPI mocks
├── main/                              # Electron main process
│   ├── index.ts                       # Entry: CLI/MCP detection, splash + main window, console bridging
│   ├── cli/                            # Commander-based CLI entry (subcommands)
│   │   ├── cli.ts                       # Entry: legacy shim, subcommand dispatch, exit codes
│   │   ├── cli-options.ts               # Shared global options + CliExitError
│   │   ├── cli-ui.ts                    # Colors, spinners, progress bars, tables
│   │   ├── cli-util.ts                  # Glob expansion, output derivation, formatting
│   │   ├── cli-convert.ts               # convert subcommand
│   │   ├── cli-info.ts                  # info + capabilities subcommands
│   │   ├── cli-compress.ts              # compress + extract-audio subcommands
│   │   ├── cli-remux.ts                 # remux subcommand
│   │   ├── cli-demux.ts                 # demux subcommand
│   │   └── cli-batch.ts                 # batch subcommand (JobQueue + MultiBar)
│   ├── capabilities.ts                # Encoder probing (ffmpeg -encoders / -hwaccels)
│   ├── process-utils.ts               # Child-process helpers (spawn, suspend, resume, kill)
│   ├── media-binaries.ts              # FFmpeg/FFprobe binary resolution
│   ├── power-actions.ts               # Shutdown / sleep / hibernate when the queue drains
│   ├── ai/                            # Copilot planning, provider connectors, AI settings
│   ├── analytics/                     # Aptabase usage-analytics provider + consent
│   ├── monitoring/                    # Sentry error-monitoring provider + consent
│   ├── security/                      # Content-Security-Policy and security policy
│   ├── mcp/                           # Embedded HTTP server, GUI tools, MCP settings
│   ├── image-info.ts                  # EXIF extraction + RGB/luma histogram via ffmpeg
│   ├── image-preview.ts               # Downscaled base64 image previews
│   ├── image-file-info.ts             # Image dimensions/size probing
│   ├── video-preview.ts               # Single-frame video thumbnails
│   ├── updater.ts                      # GitHub Releases update checker, download, install
│   ├── ffprobe-static.d.ts            # Module declaration for ffprobe-static
│   ├── generated/                     # Build-time generated config (git-ignored)
│   │   ├── aptabaseBuildConfig.ts     # Analytics key/environment baked at build time
│   │   └── sentryBuildConfig.ts       # Monitoring DSN baked at build time
│   ├── ipc/                           # IPC handler modules (error-wrapped)
│   │   ├── handlers.ts                # Central registration + error wrapper
│   │   ├── dialogs.ts                 # select-file / select-files / select-folder-files / select-output / expand-paths
│   │   ├── conversion.ts              # convert / cancel / pause / resume
│   │   ├── queue.ts                   # queue CRUD + cancel-all
│   │   ├── player.ts                  # player open / seek / close / get-frame
│   │   ├── timeline.ts                # extract-waveform / extract-thumbnails
│   │   ├── image.ts                   # image info / preview / file info
│   │   ├── capabilities.ts            # get-capabilities / get-bmf-status
│   │   ├── copilot.ts                 # copilot-plan
│   │   ├── dev.ts                     # dev-capture-screenshot
│   │   ├── window.ts                  # minimize / maximize / close / always-on-top
│   │   ├── updater.ts                 # check / download / install / schedule-on-restart
│   │   ├── system.ts                  # queue-reveal / set-launch-at-login
│   │   ├── send.ts                    # Event broadcast helpers
│   │   └── types.ts                   # Type-safe main->renderer sender signature
│   ├── player/
│   │   ├── frame-decoder.ts           # Rawvideo frame + PCM audio pipe decoder
│   │   └── types.ts                   # Decoded frame/audio structures + config types
│   ├── queue/
│   │   ├── job-queue.ts               # Concurrency-capped batch queue (1-4 parallel jobs) with EventEmitter
│   │   ├── persistence.ts             # Queue snapshot + settings persistence
│   │   └── queue-transfer.ts          # Queue import/export format
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
├── mcp/                               # Standalone stdio MCP server + shared server core
│   ├── index.ts / run.ts              # stdio entry points (--mcp)
│   ├── server.ts                      # Tool/resource/prompt registrations
│   ├── http.ts / http-server.ts       # Optional Streamable HTTP transport
│   ├── operations.ts                  # Shared MCP tool implementations
│   ├── jobs/                          # Async job manager for long-running tools
│   └── ui/                            # MCP Apps bridge, approval, registry, resources, views
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
│   ├── mui.d.ts                       # MUI data-testid attribute augmentation
│   ├── vite-env.d.ts                  # Vite client type reference
│   ├── types.ts                       # Color mode / theme context types
│   ├── global.css                     # Global styles
│   ├── index.html                     # Vite entry HTML
│   ├── pageIcons.tsx                  # Page -> icon mapping
│   ├── components/
│   │   ├── AppDrawer.tsx              # Responsive sidebar navigation
│   │   ├── AudioStreamInfo.tsx        # Audio stream selector
│   │   ├── BatchControls.tsx          # Batch queue action buttons
│   │   ├── BatchEncodingPanel.tsx     # Batch encoding options panel
│   │   ├── CloseConfirmDialog.tsx     # Close confirmation dialog
│   │   ├── CodecSelect.tsx            # Grouped codec dropdown (video/audio)
│   │   ├── ConfirmDialog.tsx          # Confirmation dialog
│   │   ├── EllipsisTooltip.tsx        # Truncated-text tooltip
│   │   ├── ErrorBanner.tsx            # Inline error banner (color-coded by severity)
│   │   ├── ErrorBoundary.tsx          # React class-based error boundary
│   │   ├── ErrorSnackbar.tsx          # Global error toast
│   │   ├── ExifSection.tsx            # EXIF + histogram viewer
│   │   ├── FileDropZone.tsx           # Drag-and-drop file selector
│   │   ├── FilePathField.tsx          # Read-only path input + browse button
│   │   ├── FileSummary.tsx            # Selected file summary (size, streams)
│   │   ├── Footer.tsx                 # App footer
│   │   ├── FormField.tsx              # Reusable form field wrapper
│   │   ├── GroupedSelect.tsx          # Generic grouped-options select
│   │   ├── InfoTooltip.tsx            # Help tooltip (info icon)
│   │   ├── LanguageMenu.tsx           # Locale switcher with flags
│   │   ├── MediaPlayer.tsx            # Canvas + Web Audio player with A/V sync
│   │   ├── MediaPreview.tsx           # Media file preview component
│   │   ├── NavJobPopover.tsx          # Navigation job status popover
│   │   ├── PageContainer.tsx          # Shared page layout shell
│   │   ├── ProgressBar.tsx            # Conversion progress (LinearProgress)
│   │   ├── QueueAddReviewDialog.tsx   # Queue add review dialog
│   │   ├── QueueDropArea.tsx          # Queue drag-and-drop area
│   │   ├── QueueJobCard.tsx           # Per-job queue card
│   │   ├── QueueJobOptionsDialog.tsx  # Queue job options editor
│   │   ├── SelectArrowIcon.tsx        # Custom select arrow icon
│   │   ├── ShortcutsHelpDialog.tsx    # Keyboard shortcuts help dialog
│   │   ├── StreamDetails.tsx          # Per-stream detail table
│   │   ├── TimeField.tsx              # Time input with validation
│   │   ├── TitleBar.tsx               # Custom frameless window title bar
│   │   ├── ToastContainer.tsx         # Non-blocking toast notifications
│   │   ├── UpdateDialog.tsx           # In-app update dialog (check/download/install)
│   │   ├── VideoFiltersSection.tsx    # Curated video-filter presets editor
│   │   ├── VideoTimeline.tsx          # Zoomable waveform + thumbnail timeline
│   │   ├── copilot/                   # Copilot chat, plan, and saved-chat components
│   │   ├── settings/                  # Theme, MCP, and AI-provider settings sections
│   │   └── types.ts                   # Shared component prop shapes
│   ├── hooks/
│   │   ├── useConversion.ts           # Conversion orchestration hook
│   │   ├── useErrorHandler.ts         # Error handling utilities
│   │   ├── useFormErrors.ts           # Field-level validation errors
│   │   ├── useCapabilities.ts         # Encoder capability fetching + filtering
│   │   ├── useMediaTask.ts            # Shared media-task lifecycle (info -> run -> progress)
│   │   └── types.ts                   # Codec option + progress subset types
│   ├── i18n/
│   │   ├── config.ts                  # i18next init with 56 locale resources
│   │   ├── DirectionProvider.tsx      # Emotion RTL/LTR cache provider
│   │   ├── localeMeta.ts              # Locale metadata + flags + RTL list
│   │   ├── types.ts                   # Locale metadata + flag component types
│   │   └── locales/                   # 56 JSON locale files
│   ├── pages/
│   │   ├── Dashboard.tsx              # Home / quick action cards
│   │   ├── Convert.tsx                # Media conversion form
│   │   ├── MediaInfo.tsx              # File probe / stream info display
│   │   ├── ImageCompress.tsx          # Image compression + EXIF/histogram
│   │   ├── AudioExtract.tsx           # Audio extraction form
│   │   ├── VideoCut.tsx               # Video cutting + player + timeline
│   │   ├── Remux.tsx                  # Container change with stream copy
│   │   ├── Demux.tsx                  # Per-stream extraction
│   │   ├── BatchQueue.tsx             # Batch job management
│   │   ├── Copilot.tsx                # Natural-language planning + AI providers
│   │   ├── Logs.tsx                   # Log viewer (filter / clear / download)
│   │   ├── Settings.tsx               # Theme, telemetry, MCP, AI, hwaccel settings
│   │   └── About.tsx                  # App info, credits, update checker
│   ├── stores/
│   │   ├── conversionStore.ts         # Conversion form state (Zustand)
│   │   ├── audioExtractStore.ts       # Audio extraction form state (Zustand)
│   │   ├── errorStore.ts              # Error state + history (cap 50)
│   │   ├── queueStore.ts              # Batch queue job state (Zustand)
│   │   ├── settingsStore.ts           # Settings state + localStorage persistence
│   │   ├── logStore.ts                # Aggregated log entries (cap 2000)
│   │   ├── toastStore.ts              # Toast queue
│   │   ├── updateStore.ts             # Update manager state (check/download/install)
│   │   ├── videoCutStore.ts           # Video cut form state (Zustand)
│   │   ├── remuxStore.ts              # Remux plan state
│   │   ├── demuxStore.ts              # Demux stream-selection state
│   │   ├── copilotChats.ts            # Saved Copilot conversations
│   │   ├── aiSettingsStore.ts         # AI provider/model settings
│   │   ├── aiConnectionStore.ts       # AI connectivity probe state
│   │   ├── profileStore.ts            # Built-in/custom profile selection
│   │   ├── termsStore.ts              # Terms & Conditions acceptance
│   │   ├── auditStore.ts              # Mutating-operation audit trail
│   │   ├── taskStore.ts               # Running task tracking (Zustand)
│   │   ├── batchConfig.ts             # Batch encoding config persistence
│   │   ├── dismissedAlertsStore.ts    # Dismissed alert banners (Zustand)
│   │   └── types.ts                   # Zustand store state shapes + actions
│   ├── styles/                        # Extracted MUI style constants per component (48 modules)
│   │   └── UpdateDialog.styles.ts     # Styled components for the update dialog
│   └── utils/
│       └── formatters.ts              # Duration/bitrate/stream formatting helpers
└── shared/                            # Code shared between processes
    ├── errors.ts                      # ErrorCode enum, AppError interface, formatError()
    ├── ipc-channels.ts                # All IPC channel name constants
    ├── types.ts                       # Shared interfaces: ConversionOptions, QueueJob,
    │                                  #   MediaInfo, MediaStreamInfo, PlayerFrame, etc.
    ├── constants.ts                   # Numeric/string constants (timeline, waveform, window, ...)
    ├── app-constants.ts               # app/window layout, nav items, storage keys
    ├── copilot.ts                     # Copilot plan request/result contracts
    ├── ai/                            # Provider-agnostic AI layer (agent, workflow, connectors)
    ├── analytics/                     # Analytics events, summaries, renderer service
    ├── monitoring/                    # Monitoring provider contracts
    ├── profiles/                      # Built-in profiles and category metadata
    ├── transcoder-constants.ts        # FFmpeg flags, defaults, progress patterns
    ├── hwaccel-settings.ts            # Hardware-acceleration modes and encoder types
    ├── codec-containers.ts            # Codec -> container compatibility mapping
    ├── codec-classification.ts        # Codec family classification helpers
    ├── media-options.ts               # codec lists, pixel formats, bitrate/scale options
    ├── file-extensions.ts             # input/output file extensions and filters
    ├── video-filters.ts               # Curated filter presets + chain builder/validation
    ├── remux-utils.ts                 # Shared remux plan builder and stream mapping
    ├── audit.ts                       # Mutating-operation audit record contract
    ├── mcp-settings.ts                # Embedded MCP server settings + port rules
    ├── mcp-ui.ts                      # MCP Apps UI bridge contract
    ├── log-constants.ts               # Shared log message constants (527 exported)
    ├── logger.ts                      # Timestamped logger (main/renderer)
    └── validation.ts                  # Time/scale/bitrate/range validation helpers

e2e/
├── vitest.e2e.config.ts               # Vitest config for e2e (node env, 60s timeout)
├── vitest.e2e.real.config.ts          # Vitest config for real conversion tests
├── helpers.ts                         # E2E helper utilities
├── hostile-preload.d.ts               # Types for the hostile-preload fixture
├── quarantine.json                    # Quarantined-spec registry
├── cli.spec.ts                        # CLI binary e2e tests
├── fixtures/
│   ├── allowed-errors.json            # Allowed console-error patterns
│   ├── app.ts                         # Electron app launch/teardown + tripwire attachment
│   ├── axe-browser.ts                 # Real-browser axe accessibility helpers
│   ├── boot-budget.ts                 # Cold-boot budget accounting
│   ├── tripwire.ts                    # Crash/unhandled-rejection recorder
│   ├── tripwire-setup.ts              # Tripwire assertion hooks
│   └── __tests__/boot-budget.test.ts  # Boot-budget helper tests
├── mocks/
│   ├── control.ts                     # Typed helpers for driving mock electronAPI
│   ├── main-store.js                  # In-memory state backing the mock preload
│   └── preload.js                     # Mock preload (replaces real preload in test mode)
├── mcp/                               # MCP end-to-end specs (6) + harnesses
│   ├── client.ts                      # MCP client harness
│   ├── harness.ts                     # Standalone/embedded server harness
│   ├── stdio.spec.ts                  # Standalone stdio transport
│   ├── http-standalone.spec.ts        # Standalone HTTP transport
│   ├── embedded-gui.spec.ts           # Embedded server + running GUI
│   ├── mcp-apps.spec.ts               # MCP Apps UI bridge
│   ├── vscode-client.spec.ts          # VS Code client integration
│   └── vscode-ui.spec.ts              # VS Code UI integration
└── specs/                             # 31 page/feature E2E specs
    ├── shell.spec.ts                  # App shell, navigation, window controls
    ├── convert.spec.ts                # Media conversion page
    ├── remux-demux-filters.spec.ts    # Remux, demux, and video filters
    ├── copilot.spec.ts                # Copilot planning
    ├── copilot-saved-chats.spec.ts    # Saved Copilot conversations
    ├── batch.spec.ts                  # Batch queue page
    ├── audio-extract.spec.ts          # Audio extraction page
    ├── image-compress.spec.ts         # Image compression page
    ├── media-info.spec.ts             # Media information page
    ├── profiles.spec.ts               # Profile selection
    ├── settings.spec.ts               # Settings page
    ├── settings-ai.spec.ts            # AI provider settings
    ├── settings-mcp.spec.ts           # Embedded MCP settings
    ├── logs.spec.ts                   # Log viewer page
    ├── video-cut.spec.ts              # Video cutting page
    ├── terms-gate.spec.ts             # Terms & Conditions gate
    ├── a11y.spec.ts / focus-order.spec.ts
    ├── ipc-abuse.spec.ts / ipc-events.spec.ts
    ├── keyboard-shortcuts.spec.ts / language.spec.ts
    ├── navigation-drawer.spec.ts / error-states.spec.ts
    └── real-convert.spec.ts           # Real FFmpeg conversion (Tier B)
```
