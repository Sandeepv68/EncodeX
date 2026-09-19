# 🧪 Testing

## 📋 Commands

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage report
npm run test:coverage

# Unit tests only (default Vitest run)
npm run test:unit

# Integration tests (builds main, then vitest.integration.config.ts)
npm run test:integration

# E2E tests (requires build; node env, 60s timeouts)
npm run test:e2e

# E2E with real FFmpeg conversion (no mocks)
npm run test:e2e:real

# E2E sub-suite used by CI (silent)
npm run test:e2e:ci

# Performance benchmarks (perf/vitest.perf.config.ts)
npm run perf
npm run perf:phase1   # conversion-benchmark + queue-concurrency + startup
npm run perf:phase2   # process-lifecycle + memory-leak + large-file
npm run perf:phase3   # ipc-overhead + cli-batch + extraction

# Generate synthetic media for perf/tests
npm run perf:generate-media
```

Coverage reports are generated in `coverage/`:

- `coverage/index.html` — browsable HTML
- `coverage/lcov.info` — LCOV for IDE integration

## ✅ Test Suite

The suite is run by Vitest 4 across **168 test/spec files** in `src/`. Coverage uses the v8 provider.

| Area | What's Covered |
| ---- | -------------- |
| **Shared (14 files)** | Error normalization, constants, codec/container mapping, validation, types, logger, IPC channel registry, estimation, progress, math |
| **Main (53 files)** | CLI entry, window lifecycle, encoder probing, queue semantics, process utilities, media binary resolution, power actions, preview cache, image/video preview generation, cli-logo |
| **Main CLI** | CLI subcommand parsing, option handling, conversion/compress subcommands, utility functions, integration tests |
| **Main IPC (13 files)** | Per-channel IPC handlers, event broadcasting, error wrapping, system handlers, dev screenshot |
| **Main transcoders** | All three cores, hardware-acceleration flag building, ffprobe mapping, factory dispatch, transcoder interface contract |
| **Main player / queue / timeline** | Rawvideo frame decoding, audio pipe, buffering, queue transfer, waveform extraction, thumbnail montage generation |
| **Main MCP (3 files)** | HTTP server (integration), GUI-parity tools, settings persistence |
| **Monitoring (9 files)** | MonitoringService facade, noop provider, logger bridge, Sentry providers (main + renderer), provider factories, consent + IPC bridge |
| **Standalone MCP (5 files)** | Server wiring, all 13 operations, conversion-options mapping, job manager, stdio integration test |
| **Preload** | Full `electronAPI` bridge surface, every IPC method |
| **Renderer components (39 files)** | Rendering, interactions, error states, accessibility for all shared UI components |
| **Renderer hooks (6 files)** | Conversion orchestration, error handling, form validation, media task lifecycle, RTL direction, keyboard shortcuts |
| **Renderer pages (10 files)** | Full page flows: form state, validation, IPC invocation, settings persistence, about/update |
| **Renderer stores (15 files)** | Zustand store state transitions and persistence, terms gate, batch config, profiles, dismissed alerts |
| **Renderer constants / utils (15 files)** | Formatting helpers, preview cache, easter egg dates, queue reorder logic, string/security/storage utils, shortcuts registry |
| **Renderer monitoring** | Renderer Sentry provider + factory selection |
| **Renderer app / misc** | App shell routing, color palette, session cleanup, terms debug spec |
| **Integration** | Full pipeline: Error → `formatError` → store → display → clear; terms gate bootstrap; MCP stdio round-trip |

## 🛠️ Test Setup

The test environment (`src/test-setup.ts`) provides:

- Mocked `useTranslation` from `react-i18next` with English key mapping and interpolation
- Mocked `electronAPI` on `globalThis` covering all IPC methods (including monitoring, MCP settings, and terms)
- Registers `@testing-library/jest-dom/vitest` matchers

## 🌐 E2E Tests

Playwright-based end-to-end tests live in `e2e/` (node environment, 60s timeouts) and are gated behind the `E2E` env var or CI:

| Spec File | What's Covered |
| --------- | -------------- |
| `e2e/cli.spec.ts` | CLI mode: `--help`/`-h`, subcommands, legacy flat syntax, global flags |
| `e2e/specs/shell.spec.ts` | App shell: window title, `electronAPI` presence, all nav routes, drawer navigation, window controls, language menu |
| `e2e/specs/convert.spec.ts` | Convert page: file selection, output auto-suggestion, codec/bitrate/scale/pixel/transcoder options, lossless copy, conversion with progress, pause/resume, cancel |
| `e2e/specs/batch.spec.ts` | Batch queue: empty state, add files via review dialog, queue events, live progress, cancel all, status filter, remove job, drag reorder, window close confirmation |
| `e2e/specs/audio-extract.spec.ts` | Audio extraction: disabled button, video selection with audio streams, codec/bitrate changes, extraction with success toast |
| `e2e/specs/image-compress.spec.ts` | Image compression: dropzone, image selection with preview, format/quality/scale changes, compression with success toast |
| `e2e/specs/media-info.spec.ts` | Media info: video analysis (streams, codec details), image analysis (EXIF data) |
| `e2e/specs/settings.spec.ts` | Settings: theme cards, theme switching, always-on-top, launch-at-login, hwaccel mode persistence |
| `e2e/specs/logs.spec.ts` | Logs: emit entries, level filtering, clear all, download with toast |
| `e2e/specs/video-cut.spec.ts` | Video cut: disabled button, timeline + waveform + thumbnails, duration/end-time toggle, playhead scrubbing, cut with progress, cancel, clear form |
| `e2e/specs/profiles.spec.ts` | Conversion profiles: built-in catalogue, category navigation, profile application, custom profile create/edit/persist |
| `e2e/specs/terms-gate.spec.ts` | Terms & Conditions gate: first-run dialog, accept persists, reject quits |
| `e2e/specs/real-convert.spec.ts` | Tier B (real): actual FFmpeg conversion without mocks (gated behind `E2E_REAL=1`) |

## 🚀 Performance Benchmarks

`perf/` holds nine benchmark suites run with their own Vitest config (`npm run perf`, split into three phases):

| Suite | What's Measured |
| ----- | --------------- |
| `conversion-benchmark` | End-to-end FFmpeg conversion throughput/latency |
| `queue-concurrency` | Parallel queue scaling (1–4 jobs) |
| `startup` | Cold-start to ready timings |
| `process-lifecycle` | Main process boot + shutdown |
| `memory-leak` | Peak RSS / leak detection over repeated conversions |
| `large-file` | Large media handling and memory bounds |
| `ipc-overhead` | IPC round-trip latency |
| `cli-batch` | CLI batch command throughput |
| `extraction` | Waveform/thumbnail extraction cost |

Fixtures are generated with `npm run perf:generate-media` (`perf/fixtures/generate-media.cjs`).

## 🧪 MCP Smoke Tests

The MCP server has two headless smoke scripts that verify the stdio handshake, the 13-tool catalogue, and a live `ping`:

```bash
npm run build:main
npm run mcp:smoke            # node dist/mcp/index.js
npm run mcp:smoke:electron   # electron . --mcp  (requires a display / xvfb on Linux)
```

## ✅ Lint & Validation

```bash
npm run lint                # eslint src/renderer
npm run lint:px             # no raw px values
npm run lint:colors         # no raw hex/rgba colors
npm run lint:rem            # rem units via spacing constants
npm run lint:inline-styles  # no inline styles
npm run lint:strings        # no hardcoded UI strings
npm run lint:strings:test   # unit test for the above rule
npm run validate:locales    # locale keys/values consistency
npm run typecheck           # renderer + main + preload
npm run format:check        # prettier --check
```