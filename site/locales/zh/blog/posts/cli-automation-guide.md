---
title: "如何使用 EncodeX CLI 自动化媒体工作流"
description: "从命令行使用 EncodeX 来编写批量转换脚本、提取音频、压缩图片，并构建自动化的媒体处理管道。"
date: 2026-09-12
tags:
  - guide
  - cli
  - automation
  - developer
---

# 如何使用 EncodeX CLI 自动化媒体工作流

EncodeX 是一个以图形界面为核心的应用，但它附带了完整的命令行界面，可以完成桌面应用的所有功能——还能做一些桌面应用做不到的事。如果你经常处理媒体文件，想编写脚本、自动化批量处理或将转换流程嵌入工作流中，CLI 让 EncodeX 成为一个可以从终端、CI 管道或计划任务中运行的工具。

## 为什么使用 CLI？

图形界面非常适合一次性转换——拖入文件，选择配置文件，完成。但当你有一个包含五十个视频的文件夹，或者想要一个脚本来压缩落入某个目录的每一项录制内容时，CLI 让你无需打开窗口即可进行编码。

常见使用场景：

- **批量转换脚本** — 一条命令将文件夹中所有 `.mov` 转换为 `.mp4`。
- **音频提取** — 从视频文件中剥离音频，用于播客或归档。
- **CI/CD 管道** — 作为自动化构建的一部分，验证或重新编码媒体文件。
- **计划任务** — 每晚自动压缩新的录制内容。
- **与其他工具集成** — 将媒体信息传入监控系统或日志管道。

## 快速开始

如果你已经安装了 EncodeX（GUI），CLI 就已可用。打开终端并运行：

```bash
encodex convert --help
```

你会看到完整的选项列表。CLI 镜像了 GUI 的功能：应用支持的每一种格式、编码器和配置文件，都可以通过命令行使用。

如需安装选项和所有可用命令，请参阅 [CLI 文档](/zh/docs/cli)。

## 转换视频

最常见的操作是在格式之间进行转换。一个简单的转换：

```bash
encodex convert in.mov -o out.mp4
```

这会使用 EncodeX 的默认设置（MP4 容器中的 H.264 + AAC），生成一个通用兼容的文件。

要指定特定的编码器或质量：

```bash
encodex convert in.mov -o out.mp4 --video-codec libx265 --crf 20
```

H.265 在相同质量下生成更小的文件。CRF 20 是高画质设置；数值越低意味着画质越高（文件也越大）。

## 提取音频

从视频中提取音轨，无需重新编码：

```bash
encodex extract-audio in.mp4 -o audio.mp3
```

默认输出为 192k 的 MP3。要指定其他格式：

```bash
encodex extract-audio in.mp4 -o audio.wav --codec libopus
```

这在从视频录制中提取播客音频、创建音频预览或单独归档配乐时非常有用。

## 无损转码

当你需要更改容器格式而不触动视频或音频数据时（例如从 `.mkv` 转为 `.mp4` 以兼容设备）：

```bash
encodex convert in.mkv -o out.mp4 --video-codec copy --audio-codec copy
```

这几乎是瞬间完成的，因为不需要编码——流只是被重新封装到新容器中。对于想要最大兼容性且不损失画质的归档者来说，这是最佳选择。

## 批量转换

一次性转换多个文件：

```bash
encodex batch *.mov -o output/ --video-codec libx264 --crf 23
```

所有匹配的文件会按顺序处理。每个输入文件在 `output/` 目录中生成对应的输出文件，扩展名更改为 `.mp4`。

## 获取媒体信息

在转换之前，你可能想查看文件的编码器、分辨率或比特率：

```bash
encodex info in.mp4
```

这会打印出文件各流的可读摘要。要获取机器可读的输出：

```bash
encodex info in.mp4 --json
```

JSON 输出在脚本中很有用，当你需要根据文件属性做出判断时（例如"仅在视频编码器不是 H.264 时重新编码"）。

## 退出码和错误处理

CLI 会返回有意义的退出码，让脚本能检测成功或失败：

| 代码 | 含义 |
|------|---------|
| 0 | 成功 |
| 1 | 一般错误 |
| 2 | 参数无效 |
| 3 | 找不到输入文件 |
| 4 | 输出文件已存在（使用 `--overwrite` 覆盖） |

在 Shell 脚本中使用这些退出码来优雅地处理错误：

```bash
encodex convert in.mp4 -o out.mp4
if [ $? -eq 4 ]; then
  echo "Output exists — skipping."
fi
```

## 综合运用

CLI 的设计是可组合的。一个实际的脚本可能：

1. 使用 `encodex info --json` 检查文件夹中的所有视频文件
2. 筛选出大于 500 MB 的文件
3. 将这些文件转换为使用 CRF 23 的更小 H.264 MP4 文件
4. 记录结果

[完整的 CLI 参考](/zh/docs/cli) 文档涵盖了所有选项、标志和退出码。

---

*在 [encodex.in/download](/zh/download) 免费下载 EncodeX。CLI 包含在每次安装中。*