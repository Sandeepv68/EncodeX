# Changelog

All notable changes to EncodeX are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Remux and Demux** — dedicated lossless remux and stream-demux pages, surfaced in the app, CLI and MCP surfaces.
- **Standalone MCP HTTP server** (`npm run mcp:http`) — loopback-only transport with optional bearer auth, session cap, body-size cap and Host/Origin checks.
- **MCP AI tools** — `analyze_media`, `recommend_settings`, `estimate_conversion`, `validate_output`, `compress_to_target`, `analyze_folder`, `explain_error`, `advise_encoding` and `quality_report`, each returning `structuredContent` alongside the text fallback.
- **MCP Apps views** — inspector, plan, compression-lab and error views, plus a batch dashboard over `batch_convert` / `get_queue_state`.
- **MCP Tasks extension** — `convert_media` / `batch_convert` are registered as optional tasks, advertising `tasks/get`, `tasks/result`, `tasks/cancel` and `tasks/list`.
- **Copilot AI extras** — transcribe, summarize, chapters, transcript search, translate and find-similar operations, wired through the operation router.
- **Copilot redesign** — ChatGPT-style conversation UI with a Lexical composer, suggestion placeholder, advanced popover and a provider logo-grid connect flow in Settings.
- **AI provider settings** — model list sourced from the provider API with offline handling, retry with backoff on transient `429/5xx` responses, Connected/stale status states, key removal, and a session-only settings cache.
- **Copilot saved chats** — a side panel listing saved conversations, plus BMF availability detection and AI rules-connect wiring.
- **Logs page free-text search** across stored log entries.
- **Loading skeletons** for lazily loaded routes.
- **MCP E2E suites** covering the stdio, standalone HTTP and embedded GUI surfaces, plus a VS Code client-wire contract test.
- **CI gates** — sharded, diff-scoped mutation testing; a blocking dependency-audit gate with a documented allowlist; media-fuzz, IPC-abuse, locale-matrix, RTL, accessibility and perf-budget tiers.
- **`security.txt`** at `/.well-known/security.txt` pointing at the published security policy.

### Changed

- **Copilot saved-chats panel is now an overlay** — it slides in with a transform animation instead of animating its width as a layout sibling, so the conversation column is never resized, re-wrapped or re-laid out when the panel opens.
- **Saved-chat list items** now carry a 1px divider border and a theme-aware soft drop shadow (light/dark), with a stronger shadow on hover.
- Sidebar condensed by default, with the condensed/expanded state persisted to `localStorage`; page icons refreshed.
- CI/CD expanded with a nightly workflow, an OpenSSF Scorecard workflow, Codecov bundle analysis, coverage flags/components and coverage test analytics; release workflow updated with monitoring and observability.
- Website homepage redesigned with a hero section, a "latest downloads" card and an open-source card.
- Documentation synced with `1.0.0-beta.5` across all shipped locales.

### Fixed

- Trimmed cuts no longer inherit the source chapter timeline (`-map_chapters -1` for trimmed excerpts, and when chapter copying is disabled), so cut outputs report the trimmed duration instead of the source length.
- CLI batch conversions now create the output directory when it is missing.
- Runtime FFmpeg failures are classified as `CONVERSION_FAILED` instead of `FFMPEG_NOT_FOUND`, and CLI error output no longer leaks Node.js internal stack frames.
- The embedded MCP HTTP server now serves session-less clients statelessly and normalizes unsupported `MCP-Protocol-Version` headers instead of rejecting them.
- The diff-coverage gate emits one `--coverage.include` flag per file, and the E2E runner no longer swallows a trailing spec path into `--silent`.
- Linux-only unit-test failures in the index, updater, conversion-options and hostile suites are fixed.
- The 5,000-card performance render self-skips on CI instead of exhausting the vitest worker.
- Super-linear regular expressions removed from Bearer-token extraction and the `matchMedia` stub.
- Saved-chat hover shadow styling tidied to match the project's formatting rules.

### Security

- All GitHub Actions are pinned to commit SHAs, and the release workflow is scoped to least privilege (`contents: read`, write only on the publish job).
- CodeQL security and quality alerts cleared, and the updater download sink now enforces HTTPS.
- Release-workflow secrets are no longer committed; Sentry and Aptabase configuration is generated at build time instead.
- A committed IPC-abuse sweep drives every `ipcMain.handle` channel with hostile input, and no hostile argument can reach `shell.*` or `app.setLoginItemSettings`.
- Audit gate is blocking for HIGH/CRITICAL advisories not on the documented exception list; `follow-redirects` bumped to 1.16.1 to clear two advisories.
- `SECURITY.md` rewritten with supported versions, private-reporting guidance, a response timeline, disclosure policy and scope; a matching `security.txt` is published.

### Documentation

- README and per-locale READMEs document macOS notarization status, Windows SmartScreen guidance and separate Linux install instructions.
- `SECURITY.md`, `docs/UPDATE_MANAGER.md` and the site security/download/platform pages updated in all locales.

## [1.0.0-beta.5] - 2026-09-23

### Added

- Privacy-safe Aptabase analytics provider, with a `no-direct-aptabase-import` ESLint rule and an analytics guide (`docs/ANALYTICS.md`).
- Website MCP configuration and demo components, plus MCP blog posts for Claude, Cursor/VS Code workflows, batch automation and MCP privacy.
- In-app update UX improvements.
- Performance baseline (`perf/baseline.json`) with a `perf-compare` script.
- Nightly CI workflow, OpenSSF Scorecard workflow and Codecov configuration.

### Changed

- Release workflow updated with monitoring and observability, and with git secrets removed from the repository.
- Homepage redesigned for the website, with a hero section, latest-downloads card and open-source card.
- CI/CD refreshed and e2e fixes included; code formatted and unused-code linting applied.

### Fixed

- Release workflow configuration fixed (`release.yml`).

### Security

- CodeQL cleanup in the MCP and analytics surfaces.
- Sentry and Aptabase configuration moved to build-time generation scripts so credentials stay out of the repository.

### Documentation

- Wiki installation and analytics pages updated; site content and blog refresh.

## [1.0.0-beta.4] - 2026-09-20

### Added

- Rotation and mirroring — rotate video and images by 90°, 180° or 270°, and flip horizontally or vertically, from the Convert page and the Batch Queue. In stream-copy mode for MP4/MOV/MKV the rotation is stored as display metadata, so nothing is re-encoded.
- Built-in MCP server — 19 tools, 3 resources (`encodex://profiles`, `encodex://capabilities`, `encodex://codecs`), 4 prompt templates, and two transports: a standalone `encodex --mcp` stdio server and an embedded loopback HTTP server for GUI mode. Loopback-only, optional bearer token, clean shutdown, no uploads.
- GitHub Wiki sync workflow that keeps the wiki in sync from the `wiki/` folder.

### Changed

- Shared helpers (including a new `clamp` utility) extracted across the main process for cleaner, testable code.
- Use-case pages expanded across all 7 language versions with real workflows.

### Fixed

- E2E coverage expanded and stabilized for the batch queue and conversion flows.

### Security

- Regular expression injection in CLI output parsing fixed — user input can no longer alter the compiled pattern.
- Prototype-polluting function in the translation update script fixed — object keys are now built safely.
- Insecure temporary-file handling in the job-queue tests fixed.
- File-system race condition in image metadata lookup fixed — files are verified atomically before use.
- Log injection (CWE-117) fixed — line-breaking characters are sanitized from log arguments.
- Command injection hardened in the BMF media probe — the binary is invoked via `execFileSync` with explicit arguments instead of a shell string.

### Documentation

- Rotation and MCP reference pages added to every locale.

## [1.0.0-beta.3] - 2026-09-15

### Added

- 140+ built-in conversion profiles in 8 categories (Web & Social, Devices, Video, Professional, Streaming, Audio, Images, Advanced), applied from both the Convert page and the Batch Queue.
- Custom profile editor — create, edit and delete custom profiles, saved locally and persisted across sessions.
- First-run onboarding: a dismissible "Getting Started" card that routes to convert, compress, extract audio or trim, tracked via a local flag and respecting reduced-motion preferences.
- Batch Queue folder import — add a whole directory, with unsupported formats filtered out and a clear empty-state message.
- Privacy-safe product analytics riding the existing Sentry breadcrumb channel: categorical payloads only, no PII, consent-gated, and never throws.
- Vertical (2160x3840, 1080x1920, 720x1280) and square (1080x1080) resolutions in the resolution picker.
- Translation coverage expanded to 55 locales.
- Dev tooling: screenshot capture (`Ctrl+Alt+S`, `Cmd+Alt+S` on macOS) and custom ESLint rules (`no-hardcoded-strings`, `no-hardcoded-rem`, `no-inline-styles`, `text-allowlist`).

### Changed

- Website expanded with 100+ new pages across 7 language versions (en, es, fr, de, pt, zh, hi), plus RSS feed generation and updated sitemaps.
- `batchQueue` locale strings expanded for folder import and empty states.

### Documentation

- Codec guides for H.264, H.265, AV1, VP9 and ProRes.
- Format conversion guides for 20+ workflows (MKV to MP4, MOV to MKV, and more).
- Compression guides for MP4 and MKV, and platform landing pages for Windows, Mac and Linux.

## [1.0.0-beta.2] - 2026-08-23

### Added

- Website release data source (`release.data.mts` / `releaseShared.ts`) feeding the download pages, with a "Latest downloads" component and a version badge.
- Dedicated Windows and Linux download instructions in the download page and its six locale variants.
- Updater unit tests covering the release channel and install flow.

### Fixed

- Update manager fixes for release-channel detection and the download/install path.

## [1.0.0-beta.1] - 2026-08-23

### Added

- VitePress marketing website with themed landing pages, per-locale content and a Google Analytics tag.
- Sentry integration for crash and error reporting.

### Changed

- UI/UX polish across the app, including typography and dark-mode updates.
- Website performance improved via chunk-size updates and a VitePress upgrade.

## [1.0.0-beta.0] - 2026-08-20

### Added

- Core conversion workflow: video format conversion with granular codec, bitrate, resolution, pixel-format and quality controls, plus lossless stream copy.
- Audio extraction from video into AAC, MP3, AC3, FLAC, WAV, Vorbis, Opus, ALAC and other supported codecs.
- Video cutting with frame-accurate start/end and duration selection.
- Image compression with quality and resolution scaling, live preview and file-size readout.
- Batch queue for multi-file conversion, including batch job phases.
- Command-line interface (`encodex`) with startup options and batch support.
- Hardware-accelerated encoding with auto-detection of available encoder families.
- Media information probing with detailed per-stream inspection.
- Internationalisation across 35+ locales.
- Test infrastructure, end-to-end suites and CI pipelines; `any` types eliminated.
- Application update manager and release variants for Windows, macOS and Linux, with bundled FFmpeg/ffprobe media binaries.

### Changed

- Dark mode, toasts, log viewer and design-token styling updated.
- Documentation restructured and the README expanded.

### Security

- Dependency audit findings addressed.

### Documentation

- Architecture and feature documentation restructured; community files (code of conduct, contributing) added.

[Unreleased]: https://github.com/Sandeepv68/EncodeX/compare/v1.0.0-beta.5...HEAD
[1.0.0-beta.5]: https://github.com/Sandeepv68/EncodeX/compare/v1.0.0-beta.4...v1.0.0-beta.5
[1.0.0-beta.4]: https://github.com/Sandeepv68/EncodeX/compare/v1.0.0-beta.3...v1.0.0-beta.4
[1.0.0-beta.3]: https://github.com/Sandeepv68/EncodeX/compare/v1.0.0-beta.2...v1.0.0-beta.3
[1.0.0-beta.2]: https://github.com/Sandeepv68/EncodeX/compare/v1.0.0-beta.1...v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/Sandeepv68/EncodeX/compare/v1.0.0-beta.0...v1.0.0-beta.1
[1.0.0-beta.0]: https://github.com/Sandeepv68/EncodeX/releases/tag/v1.0.0-beta.0
