# 🏗️ Architecture

This document describes the internal architecture of **EncodeX**. It is intended for developers who want to understand how the pieces fit together before contributing.

## 🧩 Design Principles

The renderer never spawns processes and never touches the filesystem directly. All privileged operations (file dialogs, FFmpeg execution, probing, window control) live in the main process and are reached through IPC.

- **Three-process separation** — main, preload, and renderer, following Electron's security model (`contextIsolation: true`, `nodeIntegration: false`).
- **A single abstraction over media backends** — the `ITranscoder` interface hides whether conversion is driven through `fluent-ffmpeg`, a raw FFmpeg CLI child process, or the BMF framework.
- **IPC as a typed contract** — every channel is a constant in `src/shared/ipc-channels.ts`, and the renderer only ever talks to the main process through the `window.electronAPI` bridge exposed by the preload script.
- **Shared types and constants** — `src/shared/` is imported by all three processes so interfaces stay in sync by construction.
- **Progressive enhancement of the UI** — pages are code-split with `React.lazy`, state lives in Zustand stores, and long-running jobs stream progress back over IPC events.

## 🏗️ Process Model

### Main Process (`src/main/`)

Node.js environment. Owns the application lifecycle and all privileged capabilities:

- Creates the splash and main `BrowserWindow`s and registers IPC handlers (`index.ts`).
- Hosts the CLI entry point (`cli/`).
- Resolves the FFmpeg/FFprobe binary path and probes encoder capabilities (`capabilities.ts`, `process-utils.ts`).
- Implements the transcoder cores (`transcoders/`).
- Runs the serial batch queue (`queue/job-queue.ts`).
- Decodes video frames and audio PCM for the built-in player (`player/frame-decoder.ts`).
- Extracts waveforms and thumbnail montages (`timeline/timeline-media.ts`).
- Reads EXIF data, histograms, image dimensions, and previews (`image-*.ts`, `video-preview.ts`).
- Bridges renderer `console` output into the log system (`patchConsole` in `index.ts`).

### Preload Script (`src/preload/index.ts`)

Runs in an isolated context. Uses `contextBridge.exposeInMainWorld('electronAPI', api)` to expose a curated, typed API to the renderer. Every method is a thin wrapper over `ipcRenderer.invoke` (request/response) or `ipcRenderer.send` (fire-and-forget), and every event subscription returns a cleanup function that removes its listener.

### Renderer Process (`src/renderer/`)

Browser environment served by Vite in development and loaded from `dist/renderer/index.html` in production. Pure React — no Node APIs. Interacts with the main process only through `window.electronAPI` (typed in `electron-api.d.ts`).

### Shared Layer (`src/shared/`)

Pure TypeScript, imported by all three processes. Contains the IPC channel registry, domain types, error system, logger, constants, codec lists, validation helpers, and log message constants.

## 🔄 Transcoder Abstraction

All media backends conform to `ITranscoder`:

```ts
export interface ITranscoder {
  getInfo(input: string): Promise<MediaInfo>;
  convert(input: string, output: string, options: ConversionOptions): EventEmitter;
  cancel(): void;
  pause(): void;
  resume(): void;
  getType(): string;
}
```

### Three Cores

| Core | Description |
| ---- | ----------- |
| **FfmpegCore** (default) | `fluent-ffmpeg` API — rich progress, pause/resume via OS signals, cancellation via SIGKILL |
| **FFToolCore** | Direct `child_process` CLI invocation — lighter, no native bindings needed |
| **BmfCore** | BMF Framework CLI wrapper — requires separate BMF installation |

## 🔄 Conversion Flow

```
User action (Convert page)
    |
    v
electronAPI.convertFile(input, output, options, transcoderType)   <- preload
    |  ipcRenderer.invoke('convert-file', ...)
    v
ipc/conversion.ts: ipcMain.handle(CONVERT_FILE)
    |  creates ITranscoder via factory, calls convert()
    v
Transcoder core (ffmpeg-core | fftool-core | bmf-core)
    |  fluent-ffmpeg / child_process / BMF CLI (+ hwaccel flags)
    |  emits 'progress' / 'error' / 'end'
    v
ipc/conversion.ts forwards progress via send(CONVERSION_PROGRESS, ...)
    |  win.webContents.send
    v
preload onConversionProgress -> renderer hook (useMediaTask)
    |
    v
useConversion / page state -> ProgressBar UI
```

## 🛡️ Error Handling

16 typed error codes (`FILE_NOT_FOUND`, `FFMPEG_NOT_FOUND`, `CONVERSION_FAILED`, `CANCELLED`, etc.) with user-facing localized messages. All errors flow through `formatError()` which normalizes to `AppError { code, message, detail, timestamp }` and are displayed via `ErrorSnackbar`, `ErrorBanner`, and `ErrorBoundary`.

## 🌍 Additional Topics

For more detail on specific subsystems, see the source code in `src/`. Key files:

| Subsystem | Key Files |
| --------- | --------- |
| Player | `src/main/player/frame-decoder.ts`, `src/renderer/components/MediaPlayer.tsx` |
| Timeline | `src/main/timeline/timeline-media.ts`, `src/renderer/components/VideoTimeline.tsx` |
| Batch Queue | `src/main/queue/job-queue.ts`, `src/renderer/stores/queueStore.ts` |
| Image Processing | `src/main/image-info.ts`, `src/main/image-preview.ts`, `src/main/image-file-info.ts` |
| i18n | `src/renderer/i18n/config.ts`, `src/renderer/i18n/localeMeta.ts` |
| Theming | `src/renderer/ColorModeContext.tsx`, `src/renderer/theme.ts`, `src/renderer/colors.ts` |
| Updates | `src/main/updater.ts`, `src/renderer/stores/updateStore.ts`, `src/renderer/components/UpdateDialog.tsx` |
