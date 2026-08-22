# Transcoder 抽象与转换

## Transcoder 抽象

所有媒体后端都遵循 `ITranscoder`（`src/main/transcoders/interface.ts`）：

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

`convert()` 返回一个 `EventEmitter`，它会发出 `start`、`codecData`、`progress`、`end` 和 `error`。工厂（`transcoders/factory.ts`) 根据 `TranscoderType`（`FFMPEG | FFTOOL | BMF`）进行分发：

### 1. `FfmpegCore`（默认）— `fluent-ffmpeg` API

- 在模块加载时设置内置的 FFmpeg/FFprobe 路径。
- 通过 fluent-ffmpeg 的链式 API 构建命令（编解码器、比特率、qscale、scale（可选保持宽高比）、像素格式、MJPEG color-range 修复、`-c copy`、时间裁剪、`-an`）。
- 在适用时应用硬件加速输入选项。
- 从 fluent-ffmpeg 解析的输出中发出丰富的 `progress`，当库省略时通过 timemark 计算补齐（百分比、速度、ETA）。
- 跟踪子进程 PID，通过操作系统级 suspend/resume（`process-utils.ts`）支持暂停/恢复，并通过 `kill('SIGKILL')` 支持取消。

### 2. `FFToolCore` — 直接 CLI

- 以原始 `child_process` 方式启动 FFmpeg，参数由 `buildFfmpegArgs` 构建（`transcoders/ffmpeg-utils.ts`）。
- 从 stderr 解析 `time=` 并按固定间隔发出轻量进度事件（百分比保持为 0；只有 `time`/`speed` 有意义）。
- 退出码 0 -> `end`；否则 -> `error`。取消通过 `KILL_SIGNAL` 发出信号。

### 3. `BmfCore` — BMF 框架 CLI

- 运行 `bmf_ffmpeg` / `bmf_ffprobe`（需要单独安装 BMF）。
- 与 FFToolCore 共享相同的 `buildFfmpegArgs` flag 构建器，因此 BMF 转换保持功能一致。
- 通过带超时的 `execSync` 进行探测；失败时呈现映射到 `BMF_NOT_AVAILABLE` 错误码的 `BMF not available` 消息。

### 共享 flag 构建

`ffmpeg-utils.ts` 是将 `ConversionOptions` 翻译为原始 FFmpeg CLI 参数的唯一位置，因此 FFTool 和 BMF 核心绝不会彼此漂移。`ffprobe-mapper.ts` 将原始 ffprobe JSON 规范化为全应用使用的类型化 `MediaInfo` 结构。

## 硬件加速

`transcoders/hwaccel.ts` 为所选编解码器解析 FFmpeg `-hwaccel` flag。它将编码器后缀映射到家族：

- `_nvenc` -> NVIDIA CUDA（`-hwaccel cuda -hwaccel_output_format cuda`）
- `_qsv` -> Intel QSV
- `_amf` / `_mf` -> Direct3D 11（`d3d11va`）
- `_vaapi` -> VAAPI，使用 Linux 渲染设备 `/dev/dri/renderD128`
- `_videotoolbox` -> Apple VideoToolbox

仅当加速已启用**且**模式为 `auto` 时才生成 flag；在 `encode` 模式下使用编码器自身的硬件路径而无需额外 flag。可用编码器和 hwaccel 由 `capabilities.ts` 在运行时探测（运行 `ffmpeg -hide_banner -encoders` 和 `-hwaccels`，首次探测后缓存），renderer 会根据内置二进制实际提供的内容过滤编解码器选择器。

## 媒体探测

`getInfo()`（经由任意核心）调用 ffprobe 并返回一个 `MediaInfo` 对象。`ffprobe-mapper.ts` 将每个流的数据 — 编解码器、profile、level、分辨率、DAR、像素格式、位深、色彩元数据、帧率、比特率、采样率、采样格式、声道/布局、时长、起始时间、帧数、语言和标签 — 规范化为 Media Info 页面消费的 `MediaStreamInfo` 接口，并在内部用于播放器分辨率和队列逻辑。

## 转换流程

GUI 转换的完整端到端路径：

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

说明：

- 出错时，处理器会删除部分输出的文件（除非 input === output），并以 `formatError(err)` 拒绝。
- `pause`/`resume` 映射为操作系统进程挂起/恢复；`cancel` 杀死进程并将错误规范化为 `CANCELLED` 码。
- 部分输出清理和错误规范化发生在 IPC 层，使各核心专注于进程机制。
