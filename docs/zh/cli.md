# CLI 用法

<!-- drift: cli-subcommands=8 -->

先构建项目，然后通过 `encodex` 命令调用编译后的 CLI（`bin/encodex.js` 启动器包装了 Electron 二进制）。CLI 模式可通过 `--cli`、`-h`/`--help` 或任意子命令/别名显式激活；提供至少两个非标志位置参数（输入 + 输出）时也会自动激活：

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

CLI 模式激活后，遗留的扁平用法（`encodex in.mp4 out.mp4`、`encodex --info in.mp4`）会自动 shim 到匹配的子命令。`encodex --info in.mp4` 单独使用时只有一个位置参数，因此除非同时传入 `--cli`，否则会打开 GUI。`remux` 和 `demux` 只能作为显式子命令使用（或其别名 `rmx`/`split`）——仅有两个位置参数的调用始终是 `convert`。

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
| `remux`            | 以流复制方式将文件转换为另一个容器，无需重新编码。别名：`rmx`          |
| `demux`            | 将文件的每个流提取为单独的文件。别名：`split`                        |

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
| `-o, --output <file>`       | 输出文件（覆盖位置输出参数）                                    |
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
| `--hwaccel`                 | 启用硬件加速                                                    |
| `--hwaccel-mode <auto\\|encode>` | 硬件加速模式（默认：`auto`）                                |
| `--filters <chain>`         | 视频滤镜链（逗号分隔）                                          |
| `--preset <preset_id>`      | 精选视频滤镜预设（可重复指定）                                   |
| `--info`                    | 打印输入的媒体信息并退出（需要 CLI 模式，例如 `--cli`）           |

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

## Remux 选项

| Option                          | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`           | 输出文件（默认为输入路径加目标扩展名）                             |
| `-f, --format <container>`      | 目标容器（如 `mkv`、`mp4`、`mov`）                                |
| `--map <spec>`                  | 以 `0:<type>:<ordinal>` 形式复制的流（可重复；默认：所有流）          |
| `--add-subtitle <file[::codec]>`| 嵌入外部字幕文件（可重复）；可选的每文件编解码器                       |
| `--add-audio <file>`            | 嵌入外部音频文件（可重复）                                          |
| `--thumbnail <image>`           | 嵌入封面图（MKV/WebM 作为附件，MP4/MOV 作为 disposition）             |
| `--chapters <file>`             | 从 FFMETADATA 文件导入章节                                         |
| `--no-chapters`                 | 丢弃源章节，而不是复制它们                                          |
| `--subtitle-codec <codec>`      | 已添加字幕的编解码器（默认：容器的首选编解码器）                        |
| `--no-subtitles`                | 丢弃源字幕流                                                      |
| `--audio-sync <seconds>`        | 偏移主文件的音频（正值 = 延后）                                      |
| `--set-sync <seconds>`          | 偏移前面已添加的字幕/音频输入（可重复）                                |
| `--filters <chain>`             | 视频滤镜链（可重复）；滤镜会强制重新编码                                |

## Demux 选项

| Option                          | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| `--output-dir <dir>`            | 提取流的输出目录（不存在时会创建）                                    |
| `--video`                       | 仅提取视频流                                                      |
| `--audio`                       | 仅提取音频流                                                      |
| `--subtitles`                   | 仅提取字幕流                                                      |
| `--all`                         | 提取所有类型的流（默认）                                             |
| `--video-container <ext>`       | 将视频重新编码到此容器（如 `mp4`、`mkv`）                             |
| `--audio-codec <codec>`         | 使用此编码器重新编码音频（如 `mp3`、`flac`、`aac`）                    |
| `--subtitle-format <format>`    | 将文本字幕转换为此格式（`srt`、`ass`、`copy`）                          |
| `--video-filters <chain>`       | 用于重新编码视频流的滤镜链（可重复）                                     |

## Batch 选项

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--concurrency <n>`         | 最大并行转换数（默认：`4`，限制在 1–4）                          |
| `--output-dir <dir>`        | 转换后文件的输出目录                                            |
| `--suffix <s>`              | 附加到派生输出名称的后缀（默认：`_encodex_converted`）           |

batch 还接受所有 convert 编码选项（`-v/--video-codec`、`-a/--audio-codec`、`--bitrate-video`、`--bitrate-audio`、`-q/--qscale`、`--pix-fmt`、`-s/--scale`、`--copy`、`--no-audio`、`--no-video`、`--filters`、`--preset`），并将它们应用到每个任务。

## 退出码

| 码   | 常量                         | 含义                                           |
| ---- | ---------------------------- | ---------------------------------------------- |
| `0`  | `EXIT_CODES.SUCCESS`         | 成功完成                                       |
| `1`  | `EXIT_CODES.ERROR`           | 一般错误                                       |
| `2`  | `EXIT_CODES.USAGE`           | 参数无效/不完整                                 |
| `3`  | `EXIT_CODES.CANCELLED`       | 用户取消操作                                   |
| `4`  | `EXIT_CODES.NOT_FOUND`       | 未找到输入文件、FFmpeg 或 FFprobe               |
| `5`  | `EXIT_CODES.TIMEOUT`         | 转换超过 `--timeout` 限制                       |
