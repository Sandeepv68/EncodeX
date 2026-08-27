# 进程、构建系统与启动

## 进程模型

### 主进程（`src/main/`）

Node.js 环境。拥有应用生命周期和所有特权能力：

- 创建 splash 窗口和主 `BrowserWindow`，并注册 IPC 处理器（`index.ts`）。
- 承载 CLI 入口点（`cli/`）。
- 解析 FFmpeg/FFprobe 二进制路径并探测编码器能力（`capabilities.ts`、`process-utils.ts`）。
- 实现 transcoder 核心（`transcoders/`）。
- 运行并发上限的批处理队列（1-4 个并行任务）（`queue/job-queue.ts`）。
- 为内置播放器解码视频帧和音频 PCM（`player/frame-decoder.ts`）。
- 提取波形和缩略图拼图（`timeline/timeline-media.ts`）。
- 读取 EXIF 数据、直方图、图像尺寸和预览（`image-*.ts`、`video-preview.ts`）。
- 将 renderer 的 `console` 输出桥接到日志系统（`index.ts` 中的 `patchConsole`）。

### Preload 脚本（`src/preload/index.ts`）

在隔离上下文中运行。使用 `contextBridge.exposeInMainWorld('electronAPI', api)` 向 renderer 暴露一个精选的类型化 API。每个方法都是对 `ipcRenderer.invoke`（请求/响应）或 `ipcRenderer.send`（即发即弃）的薄封装，并且每个事件订阅都返回一个移除其监听器的清理函数。Electron 或 Node 的其他任何内容都不会泄漏给 renderer。

### Renderer 进程（`src/renderer/`）

浏览器环境，开发时由 Vite 提供，生产时从 `dist/renderer/index.html` 加载。纯 React — 无 Node API。仅通过 `window.electronAPI`（在 `electron-api.d.ts` 中定义类型）与主进程交互。

### 共享层（`src/shared/`）

纯 TypeScript，被三个进程共同导入。包含 IPC 通道注册表、领域类型、错误系统、logger、常量、编解码器列表、验证辅助函数和日志消息常量。由于 `package.json` 未使用独立的包边界，该目录通过各进程根目录的相对导入来引用。

## 构建系统

三个 TypeScript 项目加上 Vite 产生三个输出文件夹：

| 脚本                     | 编译                        | 输出              |
| ------------------------ | --------------------------- | ----------------- |
| `build:renderer`         | `vite build`                | `dist/renderer/`  |
| `build:main`             | `tsc -p tsconfig.main.json` | `dist/main/`      |
| `build:preload`          | `tsc -p tsconfig.preload.json` | `dist/preload/` |

`npm run build` 按顺序运行全部三者。主进程从 `dist/preload/index.js` 加载 preload，并从 `dist/renderer/index.html`（生产）或 Vite 开发服务器（开发，`--dev` 标志或 `NODE_ENV=development`）加载 renderer。

Electron-builder 为 Windows（NSIS）、macOS（DMG）和 Linux（AppImage）打包应用，并将 `ffmpeg-static` 和 `ffprobe-static` 作为 `extraResources` 打包进去，使二进制随应用一起分发。CI 发布工作流通过 `scripts/fetch-media-binaries.mjs` 为每个目标平台/架构下载预构建的二进制。

### 二进制解析

所有 FFmpeg/FFprobe 二进制解析都集中在 `src/main/media-binaries.ts`（`getFfmpegPath` / `getFfprobePath`），由所有 transcoder、帧解码器、timeline media、图像/视频预览以及 CLI 使用。回退链为：

1. **打包后的应用**：作为 `extraResources` 打包在 Electron `resources` 目录下的二进制（`resources/ffmpeg-static/...` 和 `resources/ffprobe-static/...`，后者使用平台/架构特定的子路径）。
2. **未打包（开发/CLI/测试）**：已安装的 `node_modules/ffmpeg-static` 和 `node_modules/ffprobe-static` 二进制（通过每个包 `exports` 映射中的 `import` 键解析，因此也能从 ESM 使用）。
3. 来自 `PATH` 的系统命令（`ffmpeg` / `ffprobe`）。

## 启动序列

1. `main/index.ts` 运行。它在 `isCliMode()` 中检查 `process.argv`。
2. **CLI 模式**（显式 `--cli`/`--help`，或 >=2 个位置参数）：不注册任何窗口。在 `app.whenReady()` 时调用 `runCli()` 并以 `SUCCESS` 或 `ERROR` 码退出。
3. **GUI 模式**：启用 `autoplay-policy` 开关，创建非交互式 splash 窗口（立即显示），然后是无边框主窗口（`show: false`）。
4. `registerIpcHandlers(mainWindow)` 接线所有 IPC 模块；`patchConsole` 替换 `console.*`，使主进程日志通过 `log-message` 通道转发到 renderer。
5. 主窗口在 `ready-to-show` 时显示，此时 splash 被关闭。
6. 生产环境中 renderer 从 `dist/renderer/index.html` 加载；开发环境从 `http://localhost:5173` 加载并打开 DevTools。

## CLI 模式

`src/main/cli/cli.ts` 使用带子命令的 **commander**。当 `runCli()` 执行时：

1. 遗留 shim 将扁平用法（`encodex in.mp4 out.mp4` -> `convert`，`encodex --info in.mp4` -> `info`）映射到匹配的子命令。
2. 每个子命令解析自己的选项加上共享全局选项（`--transcoder`、`--theme`、`--verbose`、`--quiet`、`--no-color`、`--json`、`--timeout`）。
3. `info`/`capabilities` 默认打印人类可读表格，加 `--json` 则输出 JSON。
4. `convert`/`compress`/`extract-audio`/`batch` 构建 `ConversionOptions` 对象并调用 `transcoder.convert(...)`（batch 用内存中的 `JobQueue` 配合 `MultiBar` 驱动）。
5. 进度输出到 `stdout`（带看门狗超时），状态/成功行遵循 `--json`/`--quiet`/`--verbose` 路由，进程通过 `mapCliErrorToExitCode` 退出（usage=2，取消=3，未找到=4，超时=5，成功=0）。

CLI 复用与 GUI 完全相同的 transcoder 管道 — 无需维护单独的编码路径。

## 共享代码层

最重要的架构决策是所有跨进程契约都位于 `src/shared/`：

- **`types.ts`** — `ConversionOptions`、`MediaInfo`、`MediaStreamInfo`、`QueueJob`、`ConversionProgress`、`PlayerFrame`、`PlayerAudioChunk`、`WaveformData`、`ThumbnailStrip`、`EncoderCapabilities`、`LogEntry`、`FileItem`、`ConversionOperation`、`UpdateInfo`、`UpdateAsset`、`UpdateProgress`。
- **`ipc-channels.ts`** — `IPC` 常量对象，是所有通道字符串的唯一事实来源。main、preload 和 renderer 都从中导入，因此通道名称绝不会在进程间漂移。
- **`errors.ts`** — 类型化错误系统（参见[错误处理](/zh/docs/architecture-renderer#error-handling)）。
- **`constants.ts` / `app-constants.ts`** — 数值上限和 UI 布局值（窗口尺寸、波形 bucket、缩略图尺寸、错误历史上限等）。
- **`transcoder-constants.ts` / `hwaccel-settings.ts`** — FFmpeg flag、默认值、进度模式和硬件加速设置。
- **`media-options.ts` / `codec-containers.ts` / `codec-classification.ts`** — 经过整理的 51 种视频编解码器、27 种音频编解码器、56 种像素格式列表、容器兼容性规则和编解码器族辅助函数。
- **`validation.ts`** — 用于时间/比例/比特率/范围验证的纯函数，renderer 表单和 CLI 都会用到。
- **`logger.ts` / `log-constants.ts`** — 带时间戳的 logger 加上约 406 个共享日志消息模板，确保日志在各进程间保持一致。
