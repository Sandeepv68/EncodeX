# 功能

EncodeX 是一款跨平台多媒体转换工具，将 FFmpeg 的强大能力带入现代、直观的桌面界面。基于 Electron、React 和 TypeScript 构建，它让您可以在不同格式之间转换媒体、提取音频、剪切视频和压缩图像 — 全部通过简洁、灵敏的 UI 完成，并配备批处理队列、硬件加速、CLI 模式和完整的国际化。

## 功能概览

### 媒体转换

在视频/音频格式之间转换，可精细控制编解码器选择（51 种视频编解码器，涵盖软件与硬件编码器家族；27 种音频编解码器）、比特率、输出分辨率（可选保持宽高比）、像素格式（56 种格式按位深分组）、质量等级（qscale）、音轨包含与否以及 transcoder 核心选择。多个文件可通过批处理队列排队处理（见下文）。

### 无损复制

无需重新编码即可流复制视频或音轨（`-c copy`）。适用于快速更改容器格式、remux 或对画质保持要求极高的场景。

### 硬件加速

硬件加速编码，自动检测可用的编码器家族。支持 NVIDIA NVENC、Intel QSV、AMD AMF、VAAPI、Apple VideoToolbox 和 Microsoft Media Foundation 编码器。加速可以开关，并提供模式选择 — `auto` 为所选硬件编码器家族添加匹配的 FFmpeg `-hwaccel` flag，`encode` 依赖编码器自身的加速能力 — 还有编码器类型过滤（`auto` / `hardware` / `software`），将视频编解码器选择器缩小为全部、仅 GPU 或仅 CPU 编码器。可用编码器在运行时从内置的 FFmpeg 二进制探测，编解码器选择器会根据二进制实际提供的内容进行过滤。

### 媒体信息

探测媒体文件并查看详细的每流信息：编解码器、profile、level、分辨率、显示宽高比、像素格式、位深、色彩范围/空间/传递函数/原色、帧率、比特率、采样率、采样格式、声道数/布局、时长、起始时间、帧数、语言和标签。适用于视频、音频和字幕流。

### 图像压缩

使用 FFmpeg 的图像编解码器压缩图像（JPEG、PNG、WebP、BMP、GIF、TIFF、PPM、PGM、PBM），可配置质量等级和分辨率缩放。包括实时预览、文件大小读数，以及针对 JPEG/PNG/WebP 输入的完整 EXIF 元数据面板（含 RGB 和 luma 直方图）。

### 音频提取

从视频文件中提取音轨。输出为 AAC、MP3、AC3、FLAC、WAV、Vorbis、Opus、ALAC 或 27 种受支持的音频编解码器中的任意一种。当存在多条音轨时可以选择源音频流。

### 视频剪切

预览并剪切视频片段，支持帧精确的开始/结束时间或时长选择。内置播放器同步解码视频帧（通过 FFmpeg rawvideo 管道送入 HTML Canvas 元素）和音频（通过单独的 S16LE PCM 管道转换为浮点并送入 Web Audio API），并配有可缩放的多轨时间线：视频缩略图拼图、音频波形、保留/变暗区域遮罩、拖拽修剪手柄和可拖动的播放头。

### 批处理队列

以可配置的操作（转码、提取音频、压缩图像）处理多个文件。任务通过一个审阅对话框添加，在进入队列之前可调整输出名称和选项。

- **并行处理** — 最多同时运行 4 个任务（`MAX_QUEUE_CONCURRENCY = 4`）；并发上限可在运行时配置并持久化。
- **队列生命周期** — 启动、暂停和恢复整个队列；全部取消；清除已完成/失败的任务；移除单个任务。
- **重新排序** — 拖放重排队列中的任务（带放置区域），底层由 `QUEUE_MOVE_TO` 通道支持，报告任务的新位置。
- **任务编辑** — 在任何排队任务开始前替换其选项（及可选的输出路径）（`QUEUE_UPDATE_OPTIONS`）。
- **导出 / 导入** — 将队列保存到 JSON 文件并在之后重新导入（`QUEUE_EXPORT` / `QUEUE_IMPORT`），使用专用的 `INVALID_QUEUE_FILE` 错误码进行校验。
- **持久化** — 队列快照（任务 + 并发数）持久保存到用户数据目录的 `queue-state.json` 中，并在启动时恢复。
- **状态过滤器** — 按 queued / running / done / failed 过滤任务列表，另有可聚焦的搜索框。
- **完成后电源操作** — 可选在队列清空后关机、睡眠或休眠机器（按平台使用 `shutdown`、`pmset` 或 `systemctl`；Windows 支持强制关闭标志）。
- **实时反馈** — 通过 IPC 流式传输每个任务的实时进度（百分比、时间、速度、ETA），每任务的错误处理，以及导航计数徽章显示待完成工作。

### 多 Transcoder 核心

- **FFmpeg API** — fluent-ffmpeg Node.js 绑定，提供程序化进度事件
- **FFmpeg CLI** — 通过子进程直接调用 CLI，无需原生绑定
- **BMF 框架** — 用于高级管道场景的 BMF CLI 工具（需要单独安装）

### 设置

专用设置页面，用于主题、硬件加速（启用/禁用、模式、编码器类型）、窗口置顶、开机自启、批处理队列并发数以及完成后电源操作。偏好设置持久化到 `localStorage` 并在启动时生效。

### 键盘快捷键

中央快捷键注册表（`src/renderer/constants/shortcuts.ts`）定义了九个分区（global、convert、media info、image compress、audio extract、video cut、batch queue、logs、dashboard）共 60 多个快捷键。亮点：

- `Ctrl+/` — 打开快捷键帮助对话框
- `Alt+1`…`Alt+9` — 直接跳转到某个页面
- `Ctrl+O` / `Ctrl+Shift+S` / `Ctrl+Enter` — 选择输入 / 选择输出 / 开始任务（各页面保持一致）
- `Ctrl+Shift+P` / `Ctrl+Shift+C` — 暂停 / 取消当前任务
- 批处理队列：`Ctrl+E` 导出、`Ctrl+I` 导入、`1`–`5` 状态过滤、`F` 聚焦搜索
- 视频剪切播放器：`空格` 播放/暂停、`M` 静音、方向键定位

组合键通过 `event.code` 匹配，因此不受键盘布局影响。工具提示的文字也来自同一注册表。

### 活动指示灯与任务弹出框

当转换、音频提取或视频剪切运行时，相应导航行上会出现闪烁指示灯；Batch Queue 行实时显示未完成任务数量。悬停（或键盘聚焦）指示灯会打开锚定于其上的弹出框，显示任务标题、本地化状态（含暂停状态和并行并发徽章）、源文件缩略图、文件名和实时进度条 — 批量推进时还会堆叠展示等待任务的缩略图。弹出框使用柔和阴影，箭头指向指示灯。

### 关闭确认

当有任务运行时关闭窗口会经过确认流程：主进程询问 renderer（`WINDOW_CLOSE_REQUESTED`），后者显示列出活跃工作的对话框，确认后才会关闭（`WINDOW_CONFIRM_CLOSE`）。启动时主窗口加载期间会显示 splash 画面。

### 仪表板

落地页为每个工具提供快速操作磁贴（数字键 `1`–`6` 直接跳转），并有季节性彩蛋品牌标识（见下文）。

### 彩蛋

在节日日期，仪表板会将默认应用 logo 换成节日主题图案 — 圣诞节、万圣节、新年、7 月 4 日、复活节、排灯节和洒红节。每个节日在其日期前后 7 天内生效；排灯节和洒红节遵循印度阴阳历的精选日期（2026–2035），其他年份采用天文回退计算。

### 日志

实时日志查看器，通过 IPC 聚合主进程和 renderer 进程的控制台输出。支持级别过滤（DEBUG/INFO/WARN/ERROR）、清空和下载 `.txt` 日志文件。

### 通知

Toast 通知（success/info/warning/error），持续时间可配置，提供非阻塞反馈，叠加在全局错误 snackbar 之上。

### 自定义窗口边框

无边框应用窗口，配自定义标题栏，提供最小化 / 切换最大化 / 关闭控件、可拖动区域和窗口置顶支持。主窗口加载期间显示非交互式 splash 画面。

### 深色 / 浅色主题

跟随系统的主题检测与手动切换。主题偏好持久化到 `localStorage`（`encodex-theme` 键）。

### RTL 支持

为阿拉伯语和希伯来语 locale（`ar-SA`、`ar-AE`、`ar-JO`、`he-IL`）提供从右到左布局支持。通过 Emotion RTL 样式插件，切换语言时方向自动切换。

### 国际化

覆盖 35 种语言的 56 个 locale：

| 语言        | Locales                                    |
| ----------- | ------------------------------------------ |
| 英语        | `en-US`, `en-GB`, `en-IN`, `en-CA`, `en-AU`, `en-SG`, `en-ZA`, `en-NZ`, `en-IE` |
| 西班牙语    | `es-ES`, `es-MX`, `es-AR`, `es-CL`         |
| 法语        | `fr-FR`, `fr-CA`, `fr-BE`                  |
| 印地语      | `hi-IN`                                    |
| 德语        | `de-DE`, `de-BE`                           |
| 意大利语    | `it-IT`                                    |
| 荷兰语      | `nl-NL`, `nl-BE`                           |
| 瑞典语      | `sv-SE`                                    |
| 挪威语      | `nb-NO`                                    |
| 葡萄牙语    | `pt-BR`, `pt-PT`                           |
| 乌克兰语    | `uk-UA`                                    |
| 俄语        | `ru-RU`                                    |
| 波兰语      | `pl-PL`                                    |
| 泰语        | `th-TH`                                    |
| 僧伽罗语    | `si-LK`                                    |
| 蒙古语      | `mn-MN`                                    |
| 马来语      | `ms-MY`, `ms-SG`                           |
| 中文        | `zh-SG`, `zh-TW`                           |
| 日语        | `ja-JP`                                    |
| 韩语        | `ko-KR`                                    |
| 印尼语      | `id-ID`                                    |
| 菲律宾语    | `fil-PH`, `tl-PH`                          |
| 南非荷兰语  | `af-ZA`                                    |
| 希伯来语    | `he-IL`                                    |
| 阿拉伯语    | `ar-SA`, `ar-AE`, `ar-JO`                  |
| 尼泊尔语    | `ne-NP`                                    |
| 高棉语      | `km-KH`                                    |
| 越南语      | `vi-VN`                                    |
| 老挝语      | `lo-LA`                                    |
| 毛利语      | `mi-NZ`                                    |
| 冰岛语      | `is-IS`                                    |
| 格陵兰语    | `kl-GL`                                    |
| 爱尔兰语    | `ga-IE`                                    |
| 芬兰语      | `fi-FI`                                    |
| 丹麦语      | `da-DK`                                    |

### 应用内更新

自定义更新管理器，检查 GitHub Releases 获取新版本，通知用户可用性，在应用内下载平台对应的安装程序（`.exe` / `.dmg` / `.AppImage`）并实时报告进度，完成后启动安装程序。版本比较使用 semver 并剥离 pre-release 后缀。更新流程完全集成到 About 页面，配有"检查更新"按钮和全局对话框。

### 错误处理

结构化错误系统，带有类型化错误码（`ErrorCode`）、面向用户的本地化消息、全局错误 snackbar、内联错误横幅、toast 通知、嵌套 React error boundaries 和应用内错误历史（上限 50）。所有错误都通过 `formatError()` 规范化并通过 IPC 传播。

## 支持的媒体格式

### 视频编解码器（51）

| 分组                       | 编解码器                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **软件（28）**             | H.264 (libx264, libx264rgb), H.265/HEVC (libx265, Kvazaar), VP8 (libvpx), VP9 (libvpx-vp9), AV1 (libaom-av1, SVT-AV1, rav1e), MPEG-4 (libxvid, mpeg4), MPEG-1, MPEG-2, Theora, JPEG 2000 (libopenjpeg), WebP (libwebp, libwebp_anim), ProRes (prores, prores_ks), Huffyuv, FFV1, Ut Video, MJPEG, PNG, TIFF, VC-2, AVS (libxavs, libxavs2) |
| **NVIDIA NVENC（3）**      | H.264 (h264_nvenc), H.265 (hevc_nvenc), AV1 (av1_nvenc)                                                                                                                                                                                                                                                                                    |
| **Intel QSV（5）**         | H.264, H.265, MPEG-2, VP9, AV1                                                                                                                                                                                                                                                                                                             |
| **AMD AMF（3）**           | H.264, H.265, AV1                                                                                                                                                                                                                                                                                                                          |
| **VAAPI（6）**             | H.264, H.265, MJPEG, VP8, VP9, AV1                                                                                                                                                                                                                                                                                                         |
| **Apple VideoToolbox（4）**| H.264, H.265, ProRes, VP9                                                                                                                                                                                                                                                                                                                  |
| **Media Foundation（2）**  | H.264, H.265                                                                                                                                                                                                                                                                                                                               |

### 音频编解码器（27）

| 分组              | 编解码器                                                  |
| ----------------- | --------------------------------------------------------- |
| **AAC/MPEG**      | AAC (native, FDK), MP3 (LAME, libshine), MP2 (libtwolame) |
| **Dolby**         | AC-3, E-AC-3, TrueHD, DTS, MLP                            |
| **无损**          | FLAC, ALAC, WavPack                                       |
| **流媒体**        | Vorbis, Opus, Speex, AMR-WB                               |
| **PCM**           | s16le, s24le, f32le, s16be, u8, A-law, Mu-law             |
| **Windows Media** | WMA v1, WMA v2                                            |
| **其他**          | ADPCM IMA (WAV)                                           |

### 像素格式（56）

| 分组                 | 格式                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| **YUV 8-bit**       | yuv420p, yuv422p, yuv444p, yuv410p, yuv411p, yuv440p, yuvj420p, yuvj422p, yuvj444p     |
| **YUV 10-bit**      | yuv420p10le, yuv422p10le, yuv444p10le                                                  |
| **YUV 12-bit**      | yuv420p12le, yuv422p12le, yuv444p12le                                                  |
| **YUV 16-bit**      | yuv420p16le, yuv444p16le                                                               |
| **YUV 半平面**      | nv12, nv21, nv16, nv20le                                                               |
| **带 Alpha 的 YUV** | yuva420p, yuva422p, yuva444p, yuva420p10le, yuva444p10le, yuva444p16le                 |
| **打包 RGB**        | rgb24, bgr24, rgb0, bgr0, rgba, bgra, argb, abgr, rgb48le, bgr48le, rgba64le, bgra64le |
| **平面 RGB**        | gbrp, gbrp10le, gbrp12le, gbrp16le, gbrap, gbrap10le, gbrap16le                        |
| **单色**            | gray, gray10le, gray12le, gray16le, grayf32le, ya8, ya16le                             |
| **HDR**             | p010le, p016le, x2rgb10le                                                              |

### 输入文件扩展名

| 类别   | 扩展名                                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 视频     | `mp4`, `m4v`, `avi`, `mkv`, `mov`, `qt`, `flv`, `f4v`, `wmv`, `asf`, `webm`, `3gp`, `3g2`, `mpg`, `mpeg`, `mts`, `m2ts`, `ts`, `mxf`, `ogv`, `ogg`, `vob`, `divx`, `dv`, `rm`, `rmvb`, `h264`, `h265`, `hevc` |
| 音频     | `mp3`, `aac`, `wav`, `flac`, `ogg`, `opus`, `m4a`, `wma`, `alac`, `aiff`, `aif`, `au`, `caf`, `pcm`, `mid`, `midi`                                                                                            |
| 图像     | `jpg`, `jpeg`, `png`, `webp`, `bmp`, `gif`, `tiff`, `tif`, `svg`, `ico`, `heic`, `heif`, `avif`, `ppm`, `pgm`, `pbm`, `xbm`                                                                                   |
| 字幕     | `srt`, `ass`, `ssa`, `vtt`, `sub`, `idx`, `smi`                                                                                                                                                               |

## 验证工具

| 函数                         | 描述                        | 接受的格式                                            |
| ---------------------------- | --------------------------- | ----------------------------------------------------- |
| `isValidTime(value)`         | 校验时间字符串              | `HH:MM:SS`、`HH:MM:SS.mmm`、秒（数字）                |
| `isValidScale(value)`        | 校验分辨率/缩放             | `WxH`、`W:H`、百分比 `1%`–`999%`、正数                 |
| `isValidBitrate(value)`      | 校验比特率字符串            | 如 `128k`、`1M`、`2000K`                              |
| `isInRange(value, min, max)` | 检查数值范围                | 任意有限数值                                          |

## Transcoder 常量

| 常量                                              | 值                                                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TRANSCODER_TYPES`                                | `['FFMPEG', 'FFTOOL', 'BMF']`                                                                                                                                      |
| `TRANSCODER_LABELS`                               | `{ FFMPEG: 'FFmpeg (API)', FFTOOL: 'FFmpeg (CLI)', BMF: 'BMF Framework' }`                                                                                         |
| `FFMPEG_FLAGS`                                    | `-c`, `-vcodec`, `-acodec`, `-b:v`, `-b:a`, `-qscale:v`, `-vf`, `-pix_fmt`, `-color_range`, `-ss`, `-to`, `-t`, `-y`, `-i`, `-an`, `-sn`, `-dn`, `-re`, `-copyts`  |
| `FFPROBE_FLAGS`                                   | `-v quiet -print_format json -show_format -show_streams`                                                                                                           |
| `TRANSCODER_COMMANDS`                             | `bmf_ffmpeg`, `bmf_ffprobe`, `ffmpeg`, `ffprobe`                                                                                                                   |
| `TRANSCODER_DEFAULTS.PROGRESS_INTERVAL_MS`        | `500`                                                                                                                                                              |
| `TRANSCODER_DEFAULTS.PLAYER_DEFAULT_WIDTH/HEIGHT` | `640` / `360`                                                                                                                                                      |
| `TRANSCODER_DEFAULTS.PLAYER_FPS_CAP`              | `30`                                                                                                                                                               |
| `TRANSCODER_DEFAULTS.FFPROBE_TIMEOUT_MS`          | `30000`                                                                                                                                                            |
| `CONVERSION_DEFAULTS.VIDEO_CODEC`                 | `libx264`                                                                                                                                                          |
| `CONVERSION_DEFAULTS.AUDIO_CODEC`                 | `aac`                                                                                                                                                              |
| `CONVERSION_DEFAULTS.QSCALE`                      | `23`                                                                                                                                                               |
| `CONVERSION_DEFAULTS.PIXEL_FORMAT`                | `yuv420p`                                                                                                                                                          |
| `CONVERSION_DEFAULTS.SCALE`                       | `1920x1080`                                                                                                                                                        |
| `CONVERSION_DEFAULTS.VIDEO_BITRATE`               | `2000k`                                                                                                                                                            |
| `CONVERSION_DEFAULTS.AUDIO_BITRATE`               | `192k`                                                                                                                                                             |
| `QSCALE_RANGE.MIN/MAX`                            | `1` / `31`                                                                                                                                                         |
