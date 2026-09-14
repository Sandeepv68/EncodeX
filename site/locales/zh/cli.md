---
title: "EncodeX CLI – FFmpeg 命令行，化繁为简 | EncodeX"
description: "EncodeX CLI 为您带来 FFmpeg 命令行的强大功能，同时提供简洁易读的命令。在 Windows、Mac 和 Linux 上通过终端转换、压缩、提取音频和批量处理。"
---

# EncodeX CLI

对日常用户来说足够简单。对开发者来说足够强大。**EncodeX** 不仅仅是一个图形界面 — 同样的 FFmpeg 引擎可以通过 **EncodeX CLI** 从命令行访问。

## FFmpeg 命令行，无需 FFmpeg 语法

FFmpeg 原生命令行功能强大，但出了名的难以驾驭。**EncodeX CLI** 将其包装成简洁易读的命令：

```bash
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac
encodex info input.mp4 --json
encodex compress photo.png -f jpg -q 30
encodex extract-audio input.mp4
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted
```

没有晦涩的 `-c:v libx264 -crf 23 -preset medium` 链式命令 — 只有清晰的选项标志，与图形界面相同的设置，以及干净的输出。

## 为什么使用 EncodeX CLI？

- **编写脚本** — 在 cron 任务、CI 流水线和服务器中自动化转换
- **一致性** — 与图形界面相同的引擎和配置文件
- **批量友好** — 使用 glob 模式和 `--concurrency` 进行并行处理
- **易读** — 您无需手册就能输入的命令
- **跨平台** — 在 Windows、macOS 和 Linux 上运行
- **无界面** — 无需桌面环境，非常适合服务器

## CLI 命令

| 命令               | 功能                                                  |
| ------------------ | ----------------------------------------------------- |
| `encodex convert`  | 在两种格式之间转换单个文件                             |
| `encodex batch`    | 使用 glob 模式并行转换多个文件                          |
| `encodex compress`  | 压缩视频或图像文件                                     |
| `encodex extract-audio` | 从视频中提取音轨                                  |
| `encodex info`     | 探测文件并打印其技术详情                               |
| `encodex capabilities` | 列出支持的格式和编码器                             |

## 获取 CLI

CLI 随 **每个 EncodeX 安装包** 一起提供 — 下载应用即可从终端调用 `encodex`。无需单独安装。

[免费下载 EncodeX](/zh/download)

## 常见问题

**我需要图形界面来使用 CLI 吗？** 不需要，CLI 可以独立运行。它包含在每个 EncodeX 安装中。

**我可以在服务器上使用 EncodeX CLI 吗？** 可以 — 它是无界面的，非常适合在脚本、CI 和服务器环境中使用。

**EncodeX CLI 真的免费吗？** 是的 — EncodeX 永久免费，开源 (MIT)。

## 开始使用

- [免费下载 EncodeX](/zh/download)
- [了解为什么 EncodeX 是最简单的 FFmpeg 图形界面](/zh/ffmpeg-gui)
- [了解 FFmpeg 是什么](/zh/learn/what-is-ffmpeg)
- [查看所有转换和功能](/zh/features)
