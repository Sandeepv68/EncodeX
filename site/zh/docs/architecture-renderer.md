# Renderer、状态与子系统

## Renderer 架构

### 渲染树

全部十个页面都通过 `React.lazy` 进行代码分割，并在每页的 `ErrorBoundary` 下加载：

| 页面            | 路由           | 用途                                                           |
| --------------- | -------------- | -------------------------------------------------------------- |
| Dashboard       | `/`            | 快速操作卡片                                                    |
| Convert         | `/convert`     | 媒体转换表单（编解码器、比特率、缩放、hwaccel 等）              |
| MediaInfo       | `/media-info`  | 探测 + 每流详情表                                               |
| ImageCompress   | `/image-compress` | 图像压缩 + EXIF + 直方图                                     |
| AudioExtract    | `/audio-extract` | 将音轨提取为 27 种编解码器中的任意一种                        |
| VideoCut        | `/video-cut`   | 播放器 + 可缩放时间线 + 修剪                                    |
| BatchQueue      | `/batch`       | 队列管理（添加/移除/全部取消）                                   |
| Logs            | `/logs`        | 实时日志查看器，带级别过滤 + 下载                                |
| Settings        | `/settings`    | 主题、hwaccel、窗口置顶                                         |
| About           | `/about`       | 应用信息、致谢、"检查更新"按钮                                   |

### Hooks

- `useConversion` — 从 Convert 页面编排一次转换。
- `useMediaTask` — 共享生命周期（订阅 `onConversionProgress` -> 运行任务 -> `COMPLETED_PROGRESS` 或 `showError`）。一个 `useRef` 门控会丢弃过期运行的进度事件。
- `useErrorHandler` — 错误处理工具。
- `useFormErrors` — 字段级验证错误。
- `useCapabilities` — 获取编码器能力并对编解码器选择器应用编码器类型 / hwaccel 过滤。

## 状态管理

Zustand store 位于 `src/renderer/stores/`：

| Store             | 职责                                                                |
| ----------------- | ------------------------------------------------------------------- |
| `conversionStore` | 转换表单状态                                                        |
| `audioExtractStore` | 音频提取表单状态                                                   |
| `errorStore`      | `currentError` + `errorHistory`（上限 50）、`showError`、`showErrorMessage`、清除动作 |
| `queueStore`      | 从主进程事件镜像批处理队列任务                                       |
| `settingsStore`   | 设置 + `localStorage` 持久化（`encodex-theme` 等）                   |
| `logStore`        | 聚合日志条目（上限 2000）、过滤状态、下载                            |
| `toastStore`      | Toast 队列                                                          |
| `updateStore`     | 更新生命周期状态（check, available, downloading, downloaded, error） |

Store 是 UI 状态变更的唯一位置；组件通过 `useXStore(selector)` 订阅。

## 批处理队列

`src/main/queue/job-queue.ts` 是一个扩展了 `EventEmitter` 的并发上限 FIFO 处理器：

- `addJob` 分配一个 `randomUUID`，推入一个 `QueueJob`（状态 `QUEUED`，进度 0），发出 `added` 并触发 `processNext()`。
- `processNext()` 是唯一启动任务的位置：只要在途转换少于 `concurrency` 个（由 `activeJobs` 跟踪），它就会启动新的 `QUEUED` 任务，因此最多有 `concurrency`（1–4）个任务并行运行。每个启动的任务切换为 `RUNNING`，从工厂获取 transcoder，并接好 `progress`/`error`/`end`；进入终止状态后释放该任务的槽位，由 `processNext()` 补充。运行中更改并发上限会补充当前排队的槽位。
- `cancelJob` 取消某任务的 transcoder 并将其移除；`cancelAll` 取消所有活跃的 transcoder、清空队列并发出 `cancelled`。队列还支持暂停/恢复、move-to 重排序、排队任务的选项编辑、导出/导入、清除已完成任务、完成后电源操作，以及到 `queue-state.json` 的持久化存储（`src/main/queue/persistence.ts`）。

IPC 层（`ipc/queue.ts`）仅通过 `queue-added`、`queue-removed`、`queue-status-change`、`queue-progress` 和 `queue-cancelled` 将队列事件转发给 renderer，`queueStore` 将其镜像为 React 状态。

## 视频播放器

Video Cut 页面的播放器构建于 `FrameDecoder`（`src/main/player/frame-decoder.ts`）之上，它以两条输出管道启动 FFmpeg：

```
FFmpeg: input (with -re realtime and -copyts)
  -> video: -map 0:v:0 -f rawvideo -pix_fmt rgb24 -s {w}x{h} -an -sn -dn -> pipe:1 (stdout)
  -> audio: -map 0:a:0 -f s16le -ac {channels} -ar {sampleRate} -> pipe:3 (extra stdio fd)
  -> frame timestamps parsed from the -vf showinfo log on stderr (pts_time)
```

- 视频帧从 rawvideo 流（`宽 x 高 x 3` 字节）重组，并与从 stderr 解析出的 `pts_time` 值匹配。如果时间戳停滞，紧急刷新会以单调 PTS 估计值发出帧，确保播放永不永久阻塞。
- 音频以固定大小的 S16LE 块发出（按请求采样率约 50 ms，默认 48 kHz / 2 声道）。
- `seek()` 杀死并在新时间戳处重启解码器。一个共享的 `generation` 计数器在 open/seek 时递增；携带过期 generation 的帧会被 renderer 丢弃。
- `ipc/player.ts` 运行**两个**解码器（视频 + 音频），使一个流上的背压不会阻塞另一个流，限制解码分辨率，并通过 `player-frame` / `player-audio` 转发帧/块。
- renderer（`components/MediaPlayer.tsx`）将帧绘制到 HTML Canvas，并将转换为浮点的 PCM 送入 Web Audio API，实现基于时钟的 A/V 同步、seek 合并和停滞检测。

## 时间线媒体

`timeline/timeline-media.ts` 为 Video Cut 页面的可缩放时间线提供支持：

- **波形** — 以 8 kHz 解码所选音频流，并在 30 秒窗口上计算最小/最大振幅 bucket（40/s，最多 24,000 个 bucket）。提取被拆分为并行的 FFmpeg 片段，片段之间的空隙通过插值填补（`fillWaveformGaps`），所有启动都经过全局 `MAX_CONCURRENT_FFMPEG` 槽位池限流。
- **缩略图拼图** — 将最多 100 张缩略图（160x90）解码为单个 PNG 拼图（10 列），然后 base64 编码为一个 `data:` URL。PNG 编码在进程内完成（`crc32`、`pngChunk`、`encodePng`），因此无需图像库。

renderer（`components/VideoTimeline.tsx`）将波形 + 拼图渲染为可缩放、可拖动浏览的条带，带有保留/变暗遮罩和拖拽修剪手柄。

## 图像处理

`src/main/image-*.ts` 各模块服务于 Image Compress 页面：

- `image-info.ts` — 通过 `exifr` 提取 EXIF，并将图像通过 FFmpeg 管道送入原始像素数据以计算 RGB + luma 直方图。
- `image-preview.ts` — 生成缩小的 base64 预览。
- `image-file-info.ts` — 读取尺寸和文件大小。
- `video-preview.ts` — 为视频文件生成单帧缩略图。

图像*压缩本身*只是一次转换：Image Compress 页面构建一个 `ConversionOptions`（codec、qscale、scale）并通过与视频/音频相同的 transcoder 管道运行，但限定于图像编解码器。

## 错误处理

错误系统（`src/shared/errors.ts`) 定义了 16 个类型化代码 — `FILE_NOT_FOUND`、`FFMPEG_NOT_FOUND`、`FFPROBE_NOT_FOUND`、`CONVERSION_FAILED`、`INVALID_FORMAT`、`PROBE_FAILED`、`QUEUE_ERROR`、`PLAYER_ERROR`、`CANCELLED`、`BMF_NOT_AVAILABLE`、`OUTPUT_NOT_SPECIFIED`、`INPUT_NOT_SPECIFIED`、`OUTPUT_EXISTS`、`INVALID_QUEUE_FILE`、`PERMISSION_DENIED`、`UNKNOWN` — 每个都有默认的用户可见消息。

流程始终相同：

```
throw new Error(...)
    |
    v
formatError(err)                    <- shared/errors.ts
    |  normalizes to AppError { code, message, detail, timestamp }
    |  infers code from message keywords / system errno (ENOENT, EACCES, ...)
    v
errorStore.showError()              <- stores in currentError + errorHistory (cap 50)
    |
    +-- ErrorSnackbar               <- global toast, auto-dismiss 6s
    +-- ErrorBanner                 <- inline per-page, closable
    +-- ErrorBoundary               <- React crash catch-all (nested per-page + per-component)
```

IPC 处理器用 `try/catch` 包裹每个操作并重新抛出 `formatError(err)`，因此错误码能够跨越进程边界，renderer 总是收到类型化的 `AppError`。

## 日志记录

带时间戳的 `Logger`（`src/shared/logger.ts`）在所有进程中使用。主进程（`index.ts` 中的 `patchConsole`）和 renderer（`main.tsx`）都会 patch `console.*`，将条目转发到共享日志系统：

- 主进程 -> renderer 经由 `log-message` IPC 通道。
- renderer -> 直接进入 `logStore`。

Logs 页面（`pages/Logs.tsx`）聚合这两个来源，支持级别过滤（DEBUG/INFO/WARN/ERROR）、清空和 `.txt` 下载。每行日志都从共享模板常量生成（`log-constants.ts`），确保字符串一致且可搜索。

## 国际化与 RTL

- i18next 在 `renderer/i18n/config.ts` 中初始化，覆盖 35 种语言的 56 个 locale。
- `DirectionProvider`（带 `stylis-plugin-rtl` 的 Emotion 缓存）为阿拉伯语和希伯来语 locale（`ar-SA`、`ar-AE`、`ar-JO`、`he-IL`）将布局切换为 RTL。
- `useLanguageDirection` 检测当前 locale 的方向；应用方向由此推导，并在语言切换时自动切换。
- `localeMeta.ts` 为 `LanguageMenu` 保存 locale 元数据和旗帜。

## 主题

- `ColorModeContext` 提供跟随系统的深色/浅色模式及手动切换；偏好持久化到 `localStorage` 的 `encodex-theme` 键下。
- `theme.ts` 定义 MUI 浅色/深色主题；`colors.ts` 保存共享调色板。
- 样式使用 Emotion（MUI 默认引擎），各组件样式常量提取到 `renderer/styles/`。

## 关键数据流参考

### 转换（GUI）

```
React page -> Zustand store -> electronAPI.convertFile -> ipcMain.handle(convert-file)
-> factory.createTranscoder(type) -> ITranscoder.convert() -> FFmpeg process
-> 'progress' events -> send(conversion-progress) -> onConversionProgress -> useMediaTask -> ProgressBar
```

### 批处理队列

```
QueueJob card -> electronAPI.queueAdd -> JobQueue.addJob -> processNext()
-> transcoder.convert() -> 'progress'/'end'/'error' -> queue events -> IPC events -> queueStore -> QueueJobCard
```

### 视频播放

```
VideoCut page -> playerOpen -> FrameDecoder.spawnFfmpeg (video pipe:1 + audio pipe:3)
-> 'frame'/'audio' events -> send(player-frame / player-audio)
-> onPlayerFrame / onPlayerAudio -> MediaPlayer (Canvas + Web Audio, A/V sync)
```

### 时间线

```
VideoCut page -> extractWaveform + extractThumbnails
-> timeline-media.ts (parallel FFmpeg segments, throttled)
-> WaveformData / ThumbnailStrip -> VideoTimeline.tsx (zoom/trim/scrub)
```

### 应用内更新

```
About page -> updateStore.checkForUpdates -> electronAPI.checkForUpdates
-> updater.ts fetches GitHub Releases API -> compares semver versions
-> send(update-available / update-not-available) -> updateStore -> UpdateDialog
-> electronAPI.downloadUpdate -> updater.ts downloads installer to temp dir
-> send(update-progress) -> updateStore -> progress bar
-> send(update-downloaded) -> updateStore -> "Install & Restart" button
-> electronAPI.installUpdate -> shell.openPath(installer) + app.quit()
```
