# Transcoder Abstraction & Conversion

## Transcoder Abstraction

All media backends conform to `ITranscoder` (`src/main/transcoders/interface.ts`):

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

`convert()` returns an `EventEmitter` that emits `start`, `codecData`, `progress`, `end`, and `error`. The factory (`transcoders/factory.ts`) dispatches on the `TranscoderType` (`FFMPEG | FFTOOL | BMF`):

### 1. `FfmpegCore` (default) — `fluent-ffmpeg` API

- Sets bundled FFmpeg/FFprobe paths at module load.
- Builds the command via the fluent-ffmpeg chainable API (codecs, bitrates, qscale, scale with optional aspect-ratio preservation, pixel format, MJPEG color-range fix, `-c copy`, time cut, `-an`).
- Applies hardware-acceleration input options when applicable.
- Emits rich `progress` from `fluent-ffmpeg`'s parsed output, filling gaps (percent, speed, ETA) from timemark math when the library omits them.
- Tracks the child PID and supports pause/resume via OS-level suspend/resume (`process-utils.ts`), and cancellation via `kill('SIGKILL')`.

### 2. `FFToolCore` — direct CLI

- Spawns FFmpeg as a raw `child_process` with arguments built by `buildFfmpegArgs` (`transcoders/ffmpeg-utils.ts`).
- Parses `time=` from stderr and emits a light progress event on a fixed interval (percent stays 0; only `time`/`speed` are meaningful).
- Exit code 0 -> `end`; otherwise -> `error`. Cancellation is signalled with the `KILL_SIGNAL`.

### 3. `BmfCore` — BMF Framework CLI

- Runs `bmf_ffmpeg` / `bmf_ffprobe` (requires separate BMF installation).
- Same `buildFfmpegArgs` shared flag builder as FFToolCore, so BMF conversions stay feature-consistent.
- Probes via `execSync` with a timeout; on failure surfaces the `BMF not available` message that maps to the `BMF_NOT_AVAILABLE` error code.

### Shared flag building

`ffmpeg-utils.ts` is the single place that translates `ConversionOptions` into raw FFmpeg CLI arguments, so FFTool and BMF cores can never drift from each other. `ffprobe-mapper.ts` normalizes raw ffprobe JSON into the typed `MediaInfo` shape used across the app.

## Hardware Acceleration

`transcoders/hwaccel.ts` resolves FFmpeg `-hwaccel` flags for a chosen codec. It maps encoder suffixes to families:

- `_nvenc` -> NVIDIA CUDA (`-hwaccel cuda -hwaccel_output_format cuda`)
- `_qsv` -> Intel QSV
- `_amf` / `_mf` -> Direct3D 11 (`d3d11va`)
- `_vaapi` -> VAAPI with the Linux render device `/dev/dri/renderD128`
- `_videotoolbox` -> Apple VideoToolbox

Flags are only produced when acceleration is enabled **and** the mode is `auto`; in `encode` mode the encoder's own hardware path is used without extra flags. Available encoders and hwaccels are discovered at runtime by `capabilities.ts` (spawning `ffmpeg -hide_banner -encoders` and `-hwaccels`, cached after first probe), and the renderer filters the codec pickers to what the bundled binary actually provides.

## Media Probing

`getInfo()` (through any core) shells out to ffprobe and returns a `MediaInfo` object. `ffprobe-mapper.ts` normalizes per-stream data — codec, profile, level, resolution, DAR, pixel format, bit depth, color metadata, frame rate, bitrate, sample rate, sample format, channels/layout, duration, start time, frame count, language, and tags — into the `MediaStreamInfo` interface consumed by the Media Info page and used internally for player resolution and queue logic.

## Conversion Flow

The complete end-to-end path for a GUI conversion:

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

Notes:

- On error, the handler deletes the partial output file (unless input === output) and rejects with `formatError(err)`.
- `pause`/`resume` map to OS process suspend/resume; `cancel` kills the process and normalizes the error to the `CANCELLED` code.
- Partial-output cleanup and error normalization happen in the IPC layer, keeping the cores focused on process mechanics.
