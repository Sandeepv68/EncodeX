---
title: "Cursor 和 VS Code 中的 EncodeX MCP 工作流"
description: "用 encodex --mcp 把 EncodeX 接入 Cursor 或 VS Code，把媒体杂务变成 agent 工作流 —— 在编辑器里完成转换、提取和图片压缩。"
date: 2026-09-23
tags:
  - guide
  - mcp
  - cursor
  - vscode
  - ai
---

# Cursor 和 VS Code 中的 EncodeX MCP 工作流

Cursor 和 VS Code 都支持 MCP，这意味着你不用离开代码，就能把媒体任务交给编辑器的 AI。把任意一个指向 EncodeX 的内置服务器，然后请求一次转换、一次音频提取，或压缩一整个图片文件夹，同时继续忙真正的项目。

服务器在本地运行（`encodex --mcp`），所以编辑器的 agent 操作的是你机器自己的 FFmpeg 引擎 —— 不上传、不调外部 API，完全离线。

## 在 VS Code 中配置 EncodeX

VS Code 自带 MCP 支持。打开 MCP 设置，添加一个服务器定义：

```json
{
  "mcpServers": {
    "encodex": {
      "command": "encodex",
      "args": ["--mcp"]
    }
  }
}
```

VS Code 会把 `encodex --mcp` 作为服务器进程启动。连上之后，编辑器的助手就能调用 EncodeX 的工具 —— `convert_media`、`extract_audio`、`compress_image`、`cut_video`、`batch_convert` —— 并用 `get_job` / `list_jobs` 跟踪任务。

要额外的实时工具（队列状态、时间线、预览、系统信息），在 EncodeX 界面启用**设置 → MCP 服务器**，把编辑器指向 `http://127.0.0.1:8765/mcp`。这个面会加 `get_queue_state`、`extract_preview`、`get_timeline` 等与界面同级的工具。

## 在 Cursor 中配置 EncodeX

Cursor 的设置里同样提供 MCP 服务器，可以用同样的 JSON，也可以用类似的"添加 MCP 服务器"对话框，类型选 `command`：

- **Command (stdio)：** `encodex --mcp`

Cursor 共用标准的 MCP 配置格式，所以上面的 JSON 块对 Cursor 同样有效。添加服务器后，Cursor 的 agent 就能直接执行媒体操作。

## 编辑工作流

最有用的套路是把媒体工作融入编辑器日常流程：

> 把 `assets/tmp/video.mov` 转成 MP4，供文档页面使用，放进 `assets/` 文件夹。

agent 调用 `convert_media`，等 `get_job` 出结果，然后接着做后续 —— 托管预览、更新 README，或把新文件接进构建。

更进一步，一个提示词就能编排很多步骤：

> `~/r2d2/captures` 里来了新的录制。把它转成压缩版 MP4，提取出用于转写的音频，然后用输出位置更新 `docs/captures.md`。

这就是 `convert_media` + `extract_audio`，在一个会话里和你的仓库工作协同推进。

## 版本化输出与清理

因为 EncodeX 在磁盘上生成真实文件，你可以把它和 git 工作流结合：

> 跑一遍从 `~/r2d2/captures` 到 `~/r2d2/output` 的批次，然后告诉我哪些输出文件是新的，好知道该添加什么。

agent 读取工具结果、`list_jobs` 历史和你的目录状态，总结出发生了什么变化 —— 把媒体杂务变成一次有记录可查的提交。

## 常见问题解答

### 这会把我的代码或媒体发到云端吗？

不会。EncodeX MCP 完全跑在你的机器上。你的媒体在本地处理，编辑器的 agent 操作的是这些本地工具。编码不存在云端往返。

### 需要打开 EncodeX 界面吗？

stdio 服务器（`encodex --mcp`）不需要 —— 无界面运行。嵌入式 HTTP 服务器是可选面，在应用内运行，提供实时队列和预览工具。

### 能和 Cursor、VS Code 同时用吗？

可以。每个客户端各自拉起一个 stdio 服务器实例，也可以两个共用同一个嵌入式 HTTP 端点（单个界面实例）。

### 有哪些工具可用？

stdio 面提供 13 个核心工具，包括 `convert_media`、`batch_convert`、`extract_audio`、`compress_image`、`cut_video` 和任务管理。完整目录见[功能参考](/zh/docs/features-reference#mcp-server)。

## 了解更多

- [Claude Desktop 和 Claude Code 配置](/zh/blog/posts/how-to-use-claude-with-mcp)
- [批量自动化指南](/zh/blog/posts/mcp-batch-automation-guide)
- [MCP 服务器文档](/zh/docs/cli#mcp-server-mode)
- [MCP 隐私与安全](/zh/blog/posts/mcp-privacy-security)

---

*在 [encodex.in/download](/zh/download) 免费下载 EncodeX。每次安装都包含 MCP 服务器。*