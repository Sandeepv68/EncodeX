# ðŸ—‚ï¸ Project Structure

<!-- drift:renderer-components=72 renderer-components-top=54 renderer-styles=76 shortcuts=71 shortcut-sections=11 locales=56 locale-subtags=36 renderer-pages=13 renderer-stores=21 log-constants=581 builtin-profiles=115 profile-categories=8 e2e-specs=34 -->

```
src/
â”œâ”€â”€ test-setup.ts                      # Vitest global setup: jest-dom matchers + i18n/electronAPI mocks
â”œâ”€â”€ main/                              # Electron main process
â”‚   â”œâ”€â”€ index.ts                       # Entry: CLI/MCP detection, splash + main window, console bridging
â”‚   â”œâ”€â”€ cli/                            # Commander-based CLI entry (subcommands)
â”‚   â”‚   â”œâ”€â”€ cli.ts                       # Entry: legacy shim, subcommand dispatch, exit codes
â”‚   â”‚   â”œâ”€â”€ cli-options.ts               # Shared global options + CliExitError
â”‚   â”‚   â”œâ”€â”€ cli-ui.ts                    # Colors, spinners, progress bars, tables
â”‚   â”‚   â”œâ”€â”€ cli-util.ts                  # Glob expansion, output derivation, formatting
â”‚   â”‚   â”œâ”€â”€ cli-convert.ts               # convert subcommand
â”‚   â”‚   â”œâ”€â”€ cli-info.ts                  # info + capabilities subcommands
â”‚   â”‚   â”œâ”€â”€ cli-compress.ts              # compress + extract-audio subcommands
â”‚   â”‚   â”œâ”€â”€ cli-remux.ts                 # remux subcommand
â”‚   â”‚   â”œâ”€â”€ cli-demux.ts                 # demux subcommand
â”‚   â”‚   â”œâ”€â”€ cli-batch.ts                 # batch subcommand (JobQueue + MultiBar)
â”‚   â”‚   â””â”€â”€ types.ts                     # CLI flag and parameter shapes
â”‚   â”œâ”€â”€ capabilities.ts                # Encoder probing (ffmpeg -encoders / -hwaccels)
â”‚   â”œâ”€â”€ process-utils.ts               # Child-process helpers (spawn, suspend, resume, kill)
â”‚   â”œâ”€â”€ media-binaries.ts              # FFmpeg/FFprobe binary resolution
â”‚   â”œâ”€â”€ power-actions.ts               # Shutdown / sleep / hibernate when the queue drains
â”‚   â”œâ”€â”€ ai/                            # Copilot planning, provider connectors, AI settings
â”‚   â”‚   â””â”€â”€ types.ts                   # AI provider, model and operation contracts
â”‚   â”œâ”€â”€ analytics/                     # Aptabase usage-analytics provider + consent
â”‚   â”‚   â””â”€â”€ types.ts                   # Analytics consent file shape
â”‚   â”œâ”€â”€ monitoring/                    # Sentry error-monitoring provider + consent
â”‚   â”‚   â””â”€â”€ types.ts                   # Monitoring consent and provider SDK shapes
â”‚   â”œâ”€â”€ security/                      # Content-Security-Policy and security policy
â”‚   â”œâ”€â”€ mcp/                           # Embedded HTTP server, GUI tools, MCP settings
â”‚   â”‚   â””â”€â”€ types.ts                   # GUI-tool deps, HTTP server and local-client contracts
â”‚   â”œâ”€â”€ image-info.ts                  # EXIF extraction + RGB/luma histogram via ffmpeg
â”‚   â”œâ”€â”€ image-preview.ts               # Downscaled base64 image previews
â”‚   â”œâ”€â”€ image-file-info.ts             # Image dimensions/size probing
â”‚   â”œâ”€â”€ video-preview.ts               # Single-frame video thumbnails
â”‚   â”œâ”€â”€ updater.ts                      # GitHub Releases update checker, download, install
â”‚   â”œâ”€â”€ ffprobe-static.d.ts            # Module declaration for ffprobe-static
â”‚   â”œâ”€â”€ generated/                     # Build-time generated config (git-ignored)
â”‚   â”‚   â”œâ”€â”€ aptabaseBuildConfig.ts     # Analytics key/environment baked at build time
â”‚   â”‚   â””â”€â”€ sentryBuildConfig.ts       # Monitoring DSN baked at build time
â”‚   â”œâ”€â”€ ipc/                           # IPC handler modules (error-wrapped)
â”‚   â”‚   â”œâ”€â”€ handlers.ts                # Central registration + error wrapper
â”‚   â”‚   â”œâ”€â”€ dialogs.ts                 # select-file / select-files / select-folder-files / select-output / expand-paths
â”‚   â”‚   â”œâ”€â”€ conversion.ts              # convert / cancel / pause / resume
â”‚   â”‚   â”œâ”€â”€ queue.ts                   # queue CRUD + cancel-all
â”‚   â”‚   â”œâ”€â”€ player.ts                  # player open / seek / close / get-frame
â”‚   â”‚   â”œâ”€â”€ timeline.ts                # extract-waveform / extract-thumbnails
â”‚   â”‚   â”œâ”€â”€ image.ts                   # image info / preview / file info
â”‚   â”‚   â”œâ”€â”€ capabilities.ts            # get-capabilities / get-bmf-status
â”‚   â”‚   â”œâ”€â”€ copilot.ts                 # copilot-plan
â”‚   â”‚   â”œâ”€â”€ dev.ts                     # dev-capture-screenshot
â”‚   â”‚   â”œâ”€â”€ window.ts                  # minimize / maximize / close / always-on-top
â”‚   â”‚   â”œâ”€â”€ updater.ts                 # check / download / install / schedule-on-restart
â”‚   â”‚   â”œâ”€â”€ system.ts                  # queue-reveal / set-launch-at-login
â”‚   â”‚   â”œâ”€â”€ send.ts                    # Event broadcast helpers
â”‚   â”‚   â””â”€â”€ types.ts                   # Type-safe main->renderer sender signature
â”‚   â”œâ”€â”€ player/
â”‚   â”‚   â”œâ”€â”€ frame-decoder.ts           # Rawvideo frame + PCM audio pipe decoder
â”‚   â”‚   â””â”€â”€ types.ts                   # Decoded frame/audio structures + config types
â”‚   â”œâ”€â”€ queue/
â”‚   â”‚   â”œâ”€â”€ job-queue.ts               # Concurrency-capped batch queue (1-4 parallel jobs) with EventEmitter
â”‚   â”‚   â”œâ”€â”€ persistence.ts             # Queue snapshot + settings persistence
â”‚   â”‚   â”œâ”€â”€ queue-transfer.ts          # Queue import/export format
â”‚   â”‚   â””â”€â”€ types.ts                   # Queue snapshot, persistence and export shapes
â”‚   â”œâ”€â”€ timeline/
â”‚   â”‚   â””â”€â”€ timeline-media.ts          # Waveform + thumbnail-montage extraction
â”‚   â”œâ”€â”€ transcoders/
â”‚       â”œâ”€â”€ types.ts                   # ITranscoder contract + raw ffprobe JSON shapes
â”‚       â”œâ”€â”€ factory.ts                 # Transcoder factory (FFMPEG | FFTOOL | BMF)
â”‚       â”œâ”€â”€ ffmpeg-core.ts             # fluent-ffmpeg API core
â”‚       â”œâ”€â”€ fftool-core.ts             # Direct CLI invocation via child_process
â”‚       â”œâ”€â”€ bmf-core.ts                # BMF framework CLI wrapper
â”‚       â”œâ”€â”€ ffmpeg-utils.ts            # Shared command/flag builders
â”‚       â”œâ”€â”€ ffprobe-mapper.ts          # ffprobe JSON -> MediaInfo normalization
â”‚       â””â”€â”€ hwaccel.ts                 # Hardware-acceleration filter/flag resolution
â”‚   â””â”€â”€ types.ts                       # Shared main-process types (CLI flags, updater, preview cache)
â”œâ”€â”€ mcp/                               # Standalone stdio MCP server + shared server core
â”‚   â”œâ”€â”€ index.ts / run.ts              # stdio entry points (--mcp)
â”‚   â”œâ”€â”€ server.ts                      # Tool/resource/prompt registrations
â”‚   â”œâ”€â”€ http.ts / http-server.ts       # Optional Streamable HTTP transport
â”‚   â”œâ”€â”€ operations.ts                  # Shared MCP tool implementations
â”‚   â”œâ”€â”€ jobs/                          # Async job manager for long-running tools
â”‚   â”‚   â””â”€â”€ types.ts                   # Async job manager contracts
â”‚   â”œâ”€â”€ ui/                            # MCP Apps bridge, approval, registry, resources, views
â”‚   â”‚   â””â”€â”€ types.ts                   # MCP Apps view registry contracts
â”‚   â””â”€â”€ types.ts                       # MCP tool request/response contracts
â”œâ”€â”€ preload/
â”‚   â”œâ”€â”€ index.ts                       # contextBridge exposes electronAPI to renderer
â”‚   â””â”€â”€ types.ts                       # Preload drop-log payload types
â”œâ”€â”€ renderer/                          # React UI (served by Vite, root: src/renderer)
â”‚   â”œâ”€â”€ main.tsx                       # React entry: HashRouter + DirectionProvider + I18nextProvider
â”‚   â”œâ”€â”€ App.tsx                        # Root layout: TitleBar, Drawer, routes, snackbar, toasts
â”‚   â”œâ”€â”€ ColorModeContext.tsx           # Dark/light theme context
â”‚   â”œâ”€â”€ useLanguageDirection.ts        # RTL/LTR detection hook
â”‚   â”œâ”€â”€ electron-api.d.ts              # Global Window.electronAPI type declaration
â”‚   â”œâ”€â”€ mui.d.ts                       # MUI data-testid attribute augmentation
â”‚   â”œâ”€â”€ vite-env.d.ts                  # Vite client type reference
â”‚   â”œâ”€â”€ types.ts                       # Color mode / theme context types
â”‚   â”œâ”€â”€ global.css                     # Global styles
â”‚   â”œâ”€â”€ index.html                     # Vite entry HTML
â”‚   â”œâ”€â”€ pageIcons.tsx                  # Page -> icon mapping
â”‚   â”œâ”€â”€ mcp-views/                     # MCP App views (React), shared with external hosts
â”‚   â”‚   â”œâ”€â”€ host.ts                    # The McpViewHost contract every view talks to
â”‚   â”‚   â”œâ”€â”€ registry.tsx               # View id -> React component
â”‚   â”‚   â”œâ”€â”€ views/                     # One component per view (queue, job, inspector, ...)
â”‚   â”‚   â”‚   â””â”€â”€ types.ts               # Per-view payload and card prop shapes
â”‚   â”‚   â”œâ”€â”€ kit/                       # The primitives the views are built from
â”‚   â”‚   â”‚   â””â”€â”€ types.ts               # View primitive prop shapes
â”‚   â”‚   â”œâ”€â”€ standalone/                # The entry external hosts run in their iframe
â”‚   â”‚   â””â”€â”€ types.ts                   # MCP view host and polling contracts
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ AppDrawer.tsx              # Responsive sidebar navigation
â”‚   â”‚   â”œâ”€â”€ AudioStreamInfo.tsx        # Audio stream selector
â”‚   â”‚   â”œâ”€â”€ BatchControls.tsx          # Batch queue action buttons
â”‚   â”‚   â”œâ”€â”€ BatchEncodingPanel.tsx     # Batch encoding options panel
â”‚   â”‚   â”œâ”€â”€ CloseConfirmDialog.tsx     # Close confirmation dialog
â”‚   â”‚   â”œâ”€â”€ CodecSelect.tsx            # Grouped codec dropdown (video/audio)
â”‚   â”‚   â”œâ”€â”€ ConfirmDialog.tsx          # Confirmation dialog
â”‚   â”‚   â”œâ”€â”€ EllipsisTooltip.tsx        # Truncated-text tooltip
â”‚   â”‚   â”œâ”€â”€ ErrorBanner.tsx            # Inline error banner (color-coded by severity)
â”‚   â”‚   â”œâ”€â”€ ErrorBoundary.tsx          # React class-based error boundary
â”‚   â”‚   â”œâ”€â”€ ErrorSnackbar.tsx          # Global error toast
â”‚   â”‚   â”œâ”€â”€ ExifSection.tsx            # EXIF + histogram viewer
â”‚   â”‚   â”œâ”€â”€ FileDropZone.tsx           # Drag-and-drop file selector
â”‚   â”‚   â”œâ”€â”€ FilePathField.tsx          # Read-only path input + browse button
â”‚   â”‚   â”œâ”€â”€ FileSummary.tsx            # Selected file summary (size, streams)
â”‚   â”‚   â”œâ”€â”€ Footer.tsx                 # App footer
â”‚   â”‚   â”œâ”€â”€ FormField.tsx              # Reusable form field wrapper
â”‚   â”‚   â”œâ”€â”€ GroupedSelect.tsx          # Generic grouped-options select
â”‚   â”‚   â”œâ”€â”€ InfoTooltip.tsx            # Help tooltip (info icon)
â”‚   â”‚   â”œâ”€â”€ LanguageMenu.tsx           # Locale switcher with flags
â”‚   â”‚   â”œâ”€â”€ MediaPlayer.tsx            # Canvas + Web Audio player with A/V sync
â”‚   â”‚   â”œâ”€â”€ MediaPreview.tsx           # Media file preview component
â”‚   â”‚   â”œâ”€â”€ NavJobPopover.tsx          # Navigation job status popover
â”‚   â”‚   â”œâ”€â”€ PageContainer.tsx          # Shared page layout shell
â”‚   â”‚   â”œâ”€â”€ ProgressBar.tsx            # Conversion progress (LinearProgress)
â”‚   â”‚   â”œâ”€â”€ QueueAddReviewDialog.tsx   # Queue add review dialog
â”‚   â”‚   â”œâ”€â”€ QueueDropArea.tsx          # Queue drag-and-drop area
â”‚   â”‚   â”œâ”€â”€ QueueJobCard.tsx           # Per-job queue card
â”‚   â”‚   â”œâ”€â”€ QueueJobOptionsDialog.tsx  # Queue job options editor
â”‚   â”‚   â”œâ”€â”€ ShortcutsHelpDialog.tsx    # Keyboard shortcuts help dialog
â”‚   â”‚   â”œâ”€â”€ StreamDetails.tsx          # Per-stream detail table
â”‚   â”‚   â”œâ”€â”€ TimeField.tsx              # Time input with validation
â”‚   â”‚   â”œâ”€â”€ TitleBar.tsx               # Custom frameless window title bar
â”‚   â”‚   â”œâ”€â”€ ToastContainer.tsx         # Non-blocking toast notifications
â”‚   â”‚   â”œâ”€â”€ UpdateDialog.tsx           # In-app update dialog (check/download/install)
â”‚   â”‚   â”œâ”€â”€ VideoFiltersSection.tsx    # Curated video-filter presets editor
â”‚   â”‚   â”œâ”€â”€ VideoTimeline.tsx          # Zoomable waveform + thumbnail timeline
â”‚   â”‚   â”œâ”€â”€ copilot/                   # Copilot chat, plan, and saved-chat components
â”‚   â”‚   â”‚   â””â”€â”€ types.ts               # Copilot component prop shapes
â”‚   â”‚   â”œâ”€â”€ settings/                  # Theme, MCP, and AI-provider settings sections
â”‚   â”‚   â””â”€â”€ types.ts                   # Shared component prop shapes
â”‚   â”œâ”€â”€ hooks/
â”‚   â”‚   â”œâ”€â”€ useConversion.ts           # Conversion orchestration hook
â”‚   â”‚   â”œâ”€â”€ useErrorHandler.ts         # Error handling utilities
â”‚   â”‚   â”œâ”€â”€ useFormErrors.ts           # Field-level validation errors
â”‚   â”‚   â”œâ”€â”€ useCapabilities.ts         # Encoder capability fetching + filtering
â”‚   â”‚   â”œâ”€â”€ useMediaTask.ts            # Shared media-task lifecycle (info -> run -> progress)
â”‚   â”‚   â””â”€â”€ types.ts                   # Codec option + progress subset types
â”‚   â”œâ”€â”€ i18n/
â”‚   â”‚   â”œâ”€â”€ config.ts                  # i18next init with 56 locale resources
â”‚   â”‚   â”œâ”€â”€ DirectionProvider.tsx      # Emotion RTL/LTR cache provider
â”‚   â”‚   â”œâ”€â”€ localeMeta.ts              # Locale metadata + flags + RTL list
â”‚   â”‚   â”œâ”€â”€ types.ts                   # Locale metadata + flag component types
â”‚   â”‚   â””â”€â”€ locales/                   # 56 JSON locale files
â”‚   â”œâ”€â”€ pages/
â”‚   â”‚   â”œâ”€â”€ Dashboard.tsx              # Home / quick action cards
â”‚   â”‚   â”œâ”€â”€ Convert.tsx                # Media conversion form
â”‚   â”‚   â”œâ”€â”€ MediaInfo.tsx              # File probe / stream info display
â”‚   â”‚   â”œâ”€â”€ ImageCompress.tsx          # Image compression + EXIF/histogram
â”‚   â”‚   â”œâ”€â”€ AudioExtract.tsx           # Audio extraction form
â”‚   â”‚   â”œâ”€â”€ VideoCut.tsx               # Video cutting + player + timeline
â”‚   â”‚   â”œâ”€â”€ Remux.tsx                  # Container change with stream copy
â”‚   â”‚   â”œâ”€â”€ Demux.tsx                  # Per-stream extraction
â”‚   â”‚   â”œâ”€â”€ BatchQueue.tsx             # Batch job management
â”‚   â”‚   â”œâ”€â”€ Copilot.tsx                # Natural-language planning + AI providers
â”‚   â”‚   â”œâ”€â”€ Logs.tsx                   # Log viewer (filter / clear / download)
â”‚   â”‚   â”œâ”€â”€ Settings.tsx               # Theme, telemetry, MCP, AI, hwaccel settings
â”‚   â”‚   â”œâ”€â”€ About.tsx                  # App info, credits, update checker
â”‚   â”‚   â””â”€â”€ types.ts                   # Page-level prop and view-model types
â”‚   â”œâ”€â”€ stores/
â”‚   â”‚   â”œâ”€â”€ conversionStore.ts         # Conversion form state (Zustand)
â”‚   â”‚   â”œâ”€â”€ audioExtractStore.ts       # Audio extraction form state (Zustand)
â”‚   â”‚   â”œâ”€â”€ errorStore.ts              # Error state + history (cap 50)
â”‚   â”‚   â”œâ”€â”€ queueStore.ts              # Batch queue job state (Zustand)
â”‚   â”‚   â”œâ”€â”€ settingsStore.ts           # Settings state + localStorage persistence
â”‚   â”‚   â”œâ”€â”€ logStore.ts                # Aggregated log entries (cap 2000)
â”‚   â”‚   â”œâ”€â”€ toastStore.ts              # Toast queue
â”‚   â”‚   â”œâ”€â”€ updateStore.ts             # Update manager state (check/download/install)
â”‚   â”‚   â”œâ”€â”€ videoCutStore.ts           # Video cut form state (Zustand)
â”‚   â”‚   â”œâ”€â”€ remuxStore.ts              # Remux plan state
â”‚   â”‚   â”œâ”€â”€ demuxStore.ts              # Demux stream-selection state
â”‚   â”‚   â”œâ”€â”€ copilotChats.ts            # Saved Copilot conversations
â”‚   â”‚   â”œâ”€â”€ aiSettingsStore.ts         # AI provider/model settings
â”‚   â”‚   â”œâ”€â”€ aiConnectionStore.ts       # AI connectivity probe state
â”‚   â”‚   â”œâ”€â”€ profileStore.ts            # Built-in/custom profile selection
â”‚   â”‚   â”œâ”€â”€ termsStore.ts              # Terms & Conditions acceptance
â”‚   â”‚   â”œâ”€â”€ auditStore.ts              # Mutating-operation audit trail
â”‚   â”‚   â”œâ”€â”€ taskStore.ts               # Running task tracking (Zustand)
â”‚   â”‚   â”œâ”€â”€ batchConfig.ts             # Batch encoding config persistence
â”‚   â”‚   â”œâ”€â”€ dismissedAlertsStore.ts    # Dismissed alert banners (Zustand)
â”‚   â”‚   â””â”€â”€ types.ts                   # Zustand store state shapes + actions
â”‚   â”œâ”€â”€ styles/                        # Extracted MUI style constants per component (72 modules)
â”‚   â”‚   â””â”€â”€ UpdateDialog.styles.ts     # Styled components for the update dialog
â”‚   â””â”€â”€ utils/
â”‚       â”œâ”€â”€ formatters.ts              # Duration/bitrate/stream formatting helpers
â”‚       â””â”€â”€ types.ts                   # Shared renderer utility types
â””â”€â”€ shared/                            # Code shared between processes
    â”œâ”€â”€ errors.ts                      # ErrorCode enum, AppError interface, formatError()
    â”œâ”€â”€ ipc-channels.ts                # All IPC channel name constants
    â”œâ”€â”€ types.ts                       # Shared interfaces: ConversionOptions, QueueJob,
    â”‚                                  #   MediaInfo, MediaStreamInfo, PlayerFrame, etc.
    â”œâ”€â”€ constants.ts                   # Numeric/string constants (timeline, waveform, window, ...)
    â”œâ”€â”€ app-constants.ts               # app/window layout, nav items, storage keys
    â”œâ”€â”€ copilot.ts                     # Copilot plan request/result contracts
    â”œâ”€â”€ mcp-ui.ts                      # MCP Apps contract: extension id, view URIs, payload types
    â”œâ”€â”€ theme/                         # The design system, shared with the MCP App views
    â”‚   â”œâ”€â”€ colors.ts                  # The eight palettes and the semantic color constants
    â”‚   â”œâ”€â”€ theme.ts                   # createAppTheme(): the MUI theme factory
    â”‚   â”œâ”€â”€ SelectArrowIcon.tsx        # Custom select arrow icon
    â”‚   â””â”€â”€ types.ts                   # Theme id and palette contracts
    â”œâ”€â”€ ai/                            # Provider-agnostic AI layer (agent, workflow, connectors)
    â”‚   â””â”€â”€ types.ts                   # Provider-agnostic AI layer contracts
    â”œâ”€â”€ analytics/                     # Analytics events, summaries, renderer service
    â”‚   â””â”€â”€ types.ts                   # Analytics event and summary contracts
    â”œâ”€â”€ monitoring/                    # Monitoring provider contracts
    â”‚   â””â”€â”€ types.ts                   # Monitoring provider contracts
    â”œâ”€â”€ profiles/                      # Built-in profiles and category metadata
    â”‚   â””â”€â”€ types.ts                   # Profile category metadata types
    â”œâ”€â”€ transcoder-constants.ts        # FFmpeg flags, defaults, progress patterns
    â”œâ”€â”€ hwaccel-settings.ts            # Hardware-acceleration modes and encoder types
    â”œâ”€â”€ codec-containers.ts            # Codec -> container compatibility mapping
    â”œâ”€â”€ codec-classification.ts        # Codec family classification helpers
    â”œâ”€â”€ media-options.ts               # codec lists, pixel formats, bitrate/scale options
    â”œâ”€â”€ file-extensions.ts             # input/output file extensions and filters
    â”œâ”€â”€ video-filters.ts               # Curated filter presets + chain builder/validation
    â”œâ”€â”€ remux-utils.ts                 # Shared remux plan builder and stream mapping
    â”œâ”€â”€ audit.ts                       # Mutating-operation audit record contract
    â”œâ”€â”€ mcp-settings.ts                # Embedded MCP server settings + port rules
    â”œâ”€â”€ mcp-ui.ts                      # MCP Apps UI bridge contract
    â”œâ”€â”€ log-constants.ts               # Shared log message constants (581 exported)
    â”œâ”€â”€ logger.ts                      # Timestamped logger (main/renderer)
    â””â”€â”€ validation.ts                  # Time/scale/bitrate/range validation helpers

e2e/
â”œâ”€â”€ vitest.e2e.config.ts               # Vitest config for e2e (node env, 60s timeout)
â”œâ”€â”€ vitest.e2e.real.config.ts          # Vitest config for real conversion tests
â”œâ”€â”€ helpers.ts                         # E2E helper utilities
â”œâ”€â”€ hostile-preload.d.ts               # Types for the hostile-preload fixture
â”œâ”€â”€ quarantine.json                    # Quarantined-spec registry
â”œâ”€â”€ cli.spec.ts                        # CLI binary e2e tests
â”œâ”€â”€ fixtures/
â”‚   â”œâ”€â”€ allowed-errors.json            # Allowed console-error patterns
â”‚   â”œâ”€â”€ app.ts                         # Electron app launch/teardown + tripwire attachment
â”‚   â”œâ”€â”€ axe-browser.ts                 # Real-browser axe accessibility helpers
â”‚   â”œâ”€â”€ boot-budget.ts                 # Cold-boot budget accounting
â”‚   â”œâ”€â”€ tripwire.ts                    # Crash/unhandled-rejection recorder
â”‚   â”œâ”€â”€ tripwire-setup.ts              # Tripwire assertion hooks
â”‚   â””â”€â”€ __tests__/boot-budget.test.ts  # Boot-budget helper tests
â”œâ”€â”€ mocks/
â”‚   â”œâ”€â”€ control.ts                     # Typed helpers for driving mock electronAPI
â”‚   â”œâ”€â”€ main-store.js                  # In-memory state backing the mock preload
â”‚   â””â”€â”€ preload.js                     # Mock preload (replaces real preload in test mode)
â”œâ”€â”€ mcp/                               # MCP end-to-end specs (6) + harnesses
â”‚   â”œâ”€â”€ client.ts                      # MCP client harness
â”‚   â”œâ”€â”€ harness.ts                     # Standalone/embedded server harness
â”‚   â”œâ”€â”€ stdio.spec.ts                  # Standalone stdio transport
â”‚   â”œâ”€â”€ http-standalone.spec.ts        # Standalone HTTP transport
â”‚   â”œâ”€â”€ embedded-gui.spec.ts           # Embedded server + running GUI
â”‚   â”œâ”€â”€ mcp-apps.spec.ts               # MCP Apps UI bridge
â”‚   â”œâ”€â”€ vscode-client.spec.ts          # VS Code client integration
â”‚   â””â”€â”€ vscode-ui.spec.ts              # VS Code UI integration
â””â”€â”€ specs/                             # 31 page/feature E2E specs
    â”œâ”€â”€ shell.spec.ts                  # App shell, navigation, window controls
    â”œâ”€â”€ convert.spec.ts                # Media conversion page
    â”œâ”€â”€ remux-demux-filters.spec.ts    # Remux, demux, and video filters
    â”œâ”€â”€ copilot.spec.ts                # Copilot planning
    â”œâ”€â”€ copilot-saved-chats.spec.ts    # Saved Copilot conversations
    â”œâ”€â”€ batch.spec.ts                  # Batch queue page
    â”œâ”€â”€ audio-extract.spec.ts          # Audio extraction page
    â”œâ”€â”€ image-compress.spec.ts         # Image compression page
    â”œâ”€â”€ media-info.spec.ts             # Media information page
    â”œâ”€â”€ profiles.spec.ts               # Profile selection
    â”œâ”€â”€ settings.spec.ts               # Settings page
    â”œâ”€â”€ settings-ai.spec.ts            # AI provider settings
    â”œâ”€â”€ settings-mcp.spec.ts           # Embedded MCP settings
    â”œâ”€â”€ logs.spec.ts                   # Log viewer page
    â”œâ”€â”€ video-cut.spec.ts              # Video cutting page
    â”œâ”€â”€ terms-gate.spec.ts             # Terms & Conditions gate
    â”œâ”€â”€ a11y.spec.ts / focus-order.spec.ts
    â”œâ”€â”€ ipc-abuse.spec.ts / ipc-events.spec.ts
    â”œâ”€â”€ keyboard-shortcuts.spec.ts / language.spec.ts
    â”œâ”€â”€ navigation-drawer.spec.ts / error-states.spec.ts
    â””â”€â”€ real-convert.spec.ts           # Real FFmpeg conversion (Tier B)
```
