# Testing

## Commands

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage report
npm run test:coverage

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests (requires build)
npm run test:e2e
```

Coverage reports are generated in `coverage/`:

- `coverage/index.html` — browsable HTML
- `coverage/lcov.info` — LCOV for IDE integration

## Test Suite

The suite is run by Vitest 4 (123 test files, 1603 tests, all passing). Coverage uses the v8 provider.

| Area | What's Covered |
|------|----------------|
| **Shared** | Error normalization, all shared constants, codec/container mapping, validation helpers, type contracts, logger, IPC channel registry, estimation |
| **Main** | CLI entry, window lifecycle, encoder probing, queue semantics, process utilities, image/video preview generation, media binary resolution, power actions, preview cache |
| **Main CLI** | CLI subcommand parsing, option handling, conversion/compress subcommands, utility functions, integration tests |
| **Main IPC** | Per-channel IPC handlers, event broadcasting, error wrapping, system handlers |
| **Main transcoders** | All three cores, hardware-acceleration flag building, ffprobe mapping, factory dispatch, transcoder interface contract |
| **Player / Queue / Timeline** | Rawvideo frame decoding, audio pipe, buffering, queue transfer, waveform extraction, thumbnail montage generation |
| **Preload** | Full `electronAPI` bridge surface, every IPC method |
| **Renderer components** | Rendering, interactions, error states, accessibility for all shared UI components |
| **Renderer hooks** | Conversion orchestration, error handling, form validation, media task lifecycle, RTL direction, keyboard shortcuts |
| **Renderer pages** | Full page flows: form state, validation, IPC invocation, settings persistence, about/update |
| **Renderer stores** | Zustand store state transitions and persistence |
| **Renderer utils** | Formatting helpers, preview cache, easter egg dates, batch options, queue reorder logic |
| **Renderer app / misc** | App shell routing, color palette, session cleanup, keyboard shortcuts |
| **Integration** | Full pipeline: Error -> `formatError` -> store -> display -> clear |

## Test Setup

The test environment (`src/test-setup.ts`) provides:

- Mocked `useTranslation` from `react-i18next` with English key mapping and interpolation
- Mocked `electronAPI` on `globalThis` covering all IPC methods
- Registers `@testing-library/jest-dom/vitest` matchers

## E2E Tests

Playwright-based end-to-end tests live in `e2e/` (node environment, 60s timeouts) and are gated behind the `E2E` env var or CI:

| File | What's Covered |
|------|----------------|
| `e2e/cli.spec.ts` | CLI mode: `--help`/`-h`, subcommands, legacy flat syntax, global flags |
| `e2e/specs/shell.spec.ts` | App shell: window title, `electronAPI` presence, all nav routes, drawer navigation, window controls |
| `e2e/specs/convert.spec.ts` | Convert page: file selection, output auto-suggestion, codec/bitrate/scale/pixel/transcoder options, conversion with progress |
| `e2e/specs/batch.spec.ts` | Batch queue: empty state, add files, queue events, live progress, cancel all, status filter, drag reorder |
| `e2e/specs/audio-extract.spec.ts` | Audio extraction: video selection with audio streams, codec/bitrate changes, extraction with success toast |
| `e2e/specs/image-compress.spec.ts` | Image compression: dropzone, image selection, format/quality/scale changes, compression with success toast |
| `e2e/specs/media-info.spec.ts` | Media info: video analysis (streams, codec details), image analysis (EXIF data) |
| `e2e/specs/settings.spec.ts` | Settings: theme cards, theme switching, always-on-top, hwaccel mode persistence |
| `e2e/specs/logs.spec.ts` | Logs: emit entries, level filtering, clear all, download with toast |
| `e2e/specs/video-cut.spec.ts` | Video cut: timeline + waveform + thumbnails, duration/end-time toggle, cut with progress, cancel |
| `e2e/specs/real-convert.spec.ts` | Tier B (real): actual FFmpeg conversion without mocks (gated behind `E2E_REAL=1`) |
