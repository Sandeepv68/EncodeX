---
title: "用 MCP 做批量自动化：一个提示词把几十个任务排进队列"
description: "用 EncodeX 的 MCP 服务器，一个提示词就能把整个视频文件夹排进队列 —— 通过 batch_convert、list_jobs 和 get_job 实现异步任务、进度跟踪和结构化结果。"
date: 2026-09-22
tags:
  - guide
  - mcp
  - automation
  - batch
  - ai
---

# 用 MCP 做批量自动化：一个提示词把几十个任务排进队列

EncodeX 的 MCP 服务器不只是做单次转换。因为每个任务都是异步运行并提供任务跟踪工具，你可以把一个整个媒体文件夹交给 AI 助手，让它排队、处理并汇报 —— 无需打开应用，也无需手写一条命令。

本指南介绍批量流程：`batch_convert` 工具、异步任务模型，以及 FFmpeg 干活时状态工具如何让你心中有数。

## 异步任务模型

当 EncodeX 通过 MCP 启动一次转换时，它不会干等。它会立即返回一个**任务 ID**，任务在后台运行。然后你（或助手）轮询：

- `get_job` —— 单个任务的状态、进度和结果
- `list_jobs` —— 当前会话中的所有任务
- `cancel_job` —— 停止一个正在运行的任务

这正是让十几文件批次的提示词层面感觉瞬时完成的原因：一次调用即完成排队，然后 EncodeX 一路推进。

## 排一个整个文件夹

最快的路径是 `batch_convert`。把文件夹和目标交给助手，例如：

> 把 `~/Downloads` 里所有 MKV 文件转成 MP4，放进 `~/Output`。

助手遍历文件夹、调用 `batch_convert` 并启动队列。你不需要逐个管理任务。

想要更精准的批次？说出过滤条件：

> 把 `~/Recordings` 里所有视频用 CRF 23 重新编码成 H.264 / MP4 容器，并保留在原位置。

助手用 `list_profiles` 和 `get_profile` 选对配置文件，然后排入队列。

## 在一个提示词里混用工具

因为所有工具共享一个会话，单个提示词可以串联多种操作：

> 对 `~/Source` 里每个视频：转成适合手机的 MP4、把音频提取成 MP3，并压缩截图文件夹 `~/Assets`。

这就是 `batch_convert` 加 `extract_audio` 加 `compress_image`，一起排队、一起跟踪。助手负责协调并汇报哪些在哪里完成了。

## 查看进度

任务运行时，问一句：

> 我的批次状态如何？

`list_jobs` 会返回每个任务当前的状态和进度。想要更细：

> MKV 转 MP4 的进度到哪了？

助手针对具体任务轮询 `get_job` 读取进度。如果哪个出问题了：

> 取消那个卡了很久的任务。

对应 `cancel_job` —— 而且任务彼此隔离，批次的其余部分继续跑。

## 4 个提示模板

MCP 服务器还自带四个提示模板：`convert-video`、`extract-audio`、`compress-image` 和 `batch-convert`。它们会预填正确的工具调用和参数结构，对想要以规范方式执行常见操作的 agent 尤其有用。助手可以调用模板再走工具链，跨会话给出一致的结果。

## 常见问题解答

### 一次能排多少文件？

没有小的硬性限制 —— EncodeX 用你的硬件按顺序处理队列。从一个文件夹开始让它干活；你随时可以查看状态。

### 批量任务会在后台运行吗？

会。界面会显示在批量队列里，通过 MCP 用 `get_job` 和 `list_jobs` 跟踪。编码期间你可以继续提其他要求。

### 可以只取消一个任务吗？

可以 —— `cancel_job` 只停一个任务。嵌入式 HTTP 面还加上了 `cancel_all_jobs` 用于整个队列。其他任务独立继续。

### 批次能离线跑吗？

完全可以。所有编码都在你机器本地通过 FFmpeg 完成 —— 不上传、不碰云，没有网络也能跑。

## 了解更多

- [从 Claude Desktop 控制 EncodeX](/zh/blog/posts/how-to-use-claude-with-mcp)
- [MCP 服务器文档](/zh/docs/cli#mcp-server-mode)
- [MCP 安全与隐私模型](/zh/blog/posts/mcp-privacy-security)
- [功能参考：MCP 工具](/zh/docs/features-reference#mcp-server)

---

*在 [encodex.in/download](/zh/download) 免费下载 EncodeX。每次安装都包含 MCP 服务器和批量队列。*