# CLI 用法

先构建项目，然后通过 `encodex` 命令调用编译后的 CLI（`bin/encodex.js` 启动器包装了 Electron 二进制）。当提供两个位置参数（输入 + 输出）时 CLI 模式自动激活，也可用 `--cli` 显式启用：

```bash
# Convert a file (subcommand form)
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Convert a file (legacy flat form — still works)
encodex input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Show media info as a human table
encodex info input.mp4

# Show media info as JSON
encodex info input.mp4 --json

# List transcoder capabilities
encodex capabilities
encodex capabilities --json

# Lossless copy to different container
encodex convert input.mkv output.mp4 --copy

# Cut a segment
encodex convert input.mp4 output.mp4 --start-time 00:01:00 --end-time 00:02:30

# Compress an image
encodex compress photo.png -f jpg -q 30

# Extract audio (mp3 by default)
encodex extract-audio input.mp4

# Batch-convert several files / globs
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted

# Use a specific transcoder core
encodex convert input.mp4 output.mp4 --transcoder FFTOOL
```

遗留的扁平用法（`encodex in.mp4 out.mp4`、`encodex --info in.mp4`）会自动 shim 到匹配的子命令。

要让 `encodex` 全局可用，请在项目根目录运行 `npm link`（或 `npm install -g .`）。原始形式 `npx electron . --cli ...` 仍可作为替代方案使用。

## 子命令

| 子命令             | 描述                                                              |
| ------------------ | ----------------------------------------------------------------- |
| `convert`          | 转换媒体（无子命令匹配时的默认值）。别名：`c`                      |
| `info`             | 显示媒体信息（人类可读表格，或 `--json` 输出机器格式）              |
| `capabilities`     | 列出可用的 transcoder 能力（表格或 `--json`）                       |
| `compress`         | 压缩图像                                                          |
| `extract-audio`    | 提取音频流（默认编解码器 `libmp3lame`）。别名：`audio`              |
| `batch`            | 使用队列转换多个输入（文件、glob 或目录）                           |

## 全局选项

全局选项可以放在子命令名称之前或之后。

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--transcoder <type>`       | Transcoder 核心：`FFMPEG`、`FFTOOL`、`BMF`（默认：`FFMPEG`）    |
| `--theme <id>`              | Logo 配色主题：`light`、`ocean`、`sunset`、`forest`、`lavender`、`rose`、`slate`、`dark`（默认：`light`） |
| `--verbose`                 | 详细日志（将状态路由到 stderr）                                 |
| `--quiet`                   | 抑制状态输出                                                    |
| `--no-color`                | 禁用 ANSI 颜色                                                  |
| `--json`                    | 机器可读的 JSON 输出（状态路由到 stderr）                        |
| `--timeout <seconds>`       | 转换超时时间（秒）（默认：`300`）                                |

## Convert 选项

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-v, --video-codec <codec>` | 视频编解码器（如 `libx264`、`libx265`、`copy`）                  |
| `-a, --audio-codec <codec>` | 音频编解码器（如 `aac`、`libmp3lame`、`copy`）                   |
| `-q, --qscale <qscale>`     | 质量等级（1–31）                                                |
| `--bitrate-video <bitrate>` | 视频比特率（如 `1000k`）                                        |
| `--bitrate-audio <bitrate>` | 音频比特率（如 `192k`）                                         |
| `--pix-fmt <format>`        | 像素格式（如 `yuv420p`、`yuv444p`）                              |
| `-s, --scale <WxH>`         | 输出分辨率（如 `1280x720` 或 `50%`）                             |
| `--start-time <time>`       | 开始时间（`HH:MM:SS` 或秒数）                                    |
| `--end-time <time>`         | 结束时间                                                        |
| `--duration <time>`         | 时长                                                            |
| `--copy`                    | 无损流复制                                                      |
| `--no-audio`                | 从输出中排除音频流                                              |
| `--no-video`                | 从输出中排除视频流（仅音频）                                     |
| `--hwaccel / --no-hwaccel`  | 切换硬件加速                                                    |
| `--hwaccel-mode <auto\\|encode>` | 硬件加速模式（默认：`auto`）                                |
| `--info`                    | 打印输入的媒体信息并退出                                        |

## Compress 选项

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`       | 输出文件                                                        |
| `-f, --format <format>`     | 输出格式（默认由输出扩展名推导）                                 |
| `-q, --quality <qscale>`    | 质量等级 1–31                                                   |
| `-s, --scale <WxH>`         | 输出分辨率                                                      |

## Extract-audio 选项

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`       | 输出文件                                                        |
| `-a, --audio-codec <codec>` | 音频编解码器（默认：`libmp3lame`）                               |
| `--bitrate-audio <bitrate>` | 音频比特率（如 `192k`）                                         |

## Batch 选项

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--concurrency <n>`         | 最大并行转换数（默认：`4`，限制在 1–4）                          |
| `--output-dir <dir>`        | 转换后文件的输出目录                                            |
| `--suffix <s>`              | 附加到派生输出名称的后缀（默认：`_encodex_converted`）           |

batch 还接受所有 convert 编码选项（`-v/--video-codec`、`-a/--audio-codec`、`--bitrate-video`、`--bitrate-audio`、`-q/--qscale`、`--pix-fmt`、`-s/--scale`、`--copy`、`--no-audio`、`--no-video`），并将它们应用到每个任务。

## 退出码

| 码   | 常量                         | 含义                                           |
| ---- | ---------------------------- | ---------------------------------------------- |
| `0`  | `EXIT_CODES.SUCCESS`         | 成功完成                                       |
| `1`  | `EXIT_CODES.ERROR`           | 一般错误                                       |
| `2`  | `EXIT_CODES.USAGE`           | 参数无效/不完整                                 |
| `3`  | `EXIT_CODES.CANCELLED`       | 用户取消操作                                   |
| `4`  | `EXIT_CODES.NOT_FOUND`       | 未找到输入文件、FFmpeg 或 FFprobe               |
| `5`  | `EXIT_CODES.TIMEOUT`         | 转换超过 `--timeout` 限制                       |
