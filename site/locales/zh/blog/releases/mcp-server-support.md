---
date: 2026-09-18
title: "EncodeX 内置 MCP 服务器：让 AI 驱动你的媒体转换"
description: "EncodeX 现在内置了 Model Context Protocol (MCP) 服务器，Claude、Cursor、VS Code 和自定义 Agent 可以在本地安全地转换、压缩、裁剪和批量处理你的媒体。"
tags:
  - release
  - mcp
  - ai
  - automation
---

# EncodeX 内置 MCP 服务器：让 AI 驱动你的媒体转换

**发布日期：** 2026-09-18
**功能：** 内置 MCP 服务器（stdio + 嵌入式 HTTP）

## 简介

EncodeX 现在可以充当 [Model Context Protocol](https://modelcontextprotocol.io) 服务器。这意味着 AI 助手——Claude Desktop、Claude Code、Cursor、VS Code 以及任何其他兼容 MCP 的客户端——只需一句大白话请求，就能通过 EncodeX 转换视频、提取音频、压缩图片、裁剪片段和管理批量任务。

而这一切仍然发生在你的电脑上。不上传、不联网、不需要账号。

---

## MCP 如何改变日常工作流

我们打造 EncodeX，就是为了让普通人摆脱 FFmpeg 命令行。**MCP 服务器**则消除了"该按哪个按钮？"的最后一丝困扰，让你能更顺滑地使用已有的工具。

如果你曾经输入过这样的话：

> "把 `interview.mov` 的音频提取成 MP3，再做一个能塞进邮件的副本。"

……现在，支持 MCP 的助手可以*真正替你完成*它——选择合适的 EncodeX 工具、在本地运行转换，然后把结果回报给你。你留在最爱的 AI 应用里，EncodeX 在幕后干重活。

这能解锁的一些能力：

- **对话式批量处理** —— "把这个文件夹里所有 MKV 转成 MP4，完成后告诉我。"
- **Agent 流水线** —— 让编码或媒体 Agent 在更大的任务中准备素材。
- **可复用的自动化** —— 一次描述工作流，你的助手就能反复使用。
- **无需记忆任何命令语法** —— 配置文件、编解码器和容器都由它帮你处理。

---

## 两种连接方式

### 1. 独立的 stdio 服务器

将 EncodeX 作为独立的 MCP 进程运行。桌面 AI 应用按需启动服务器时使用的就是这种方式：

```bash
# Packaged app
encodex --mcp

# Source checkout (after npm run build:main)
node dist/mcp/index.js
```

stdout 承载 MCP 协议，所有日志都输出到 stderr，这样就不会有任何东西干扰你的助手与 EncodeX 之间的通信。

### 2. 嵌入式 HTTP 服务器（GUI 模式）

EncodeX 已经打开了？开启 **设置 → MCP 服务器**，然后把客户端指向：

```
http://127.0.0.1:8765/mcp
```

此模式共享运行中应用的任务队列，并新增实时队列、预览、时间轴、系统和更新工具——助手可以看到你正在忙什么，而不是孤立地干活。

---

## 你的助手能做什么

两种形式下，EncodeX 共提供 **19 个工具**。

| 区域               | 工具                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| 转换               | `convert_media`、`batch_convert`、`cut_video`、`compress_image`、`extract_audio`                  |
| 检查               | `get_media_info`、`list_capabilities`、`list_profiles`、`get_profile`、`ping`                      |
| 任务管理           | `get_job`、`list_jobs`、`cancel_job`                                                               |
| GUI 对等（HTTP）   | `get_queue_state`、`cancel_all_jobs`、`get_timeline`、`extract_preview`、`get_system_info`、`check_for_updates` |

还有 **3 个资源**——`encodex://profiles`、`encodex://capabilities` 和 `encodex://codecs`——让助手能准确发现你的构建支持什么，以及面向最常见任务的 **4 个提示模板**：转换视频、提取音频、压缩图片和批量转换。

转换是**异步**的。长时间渲染不会卡住对话：你的助手启动任务、拿到任务 ID，之后可以轮询进度，也可以随时取消。

---

## 一分钟完成配置

### Claude Desktop

将 EncodeX 添加到你的 MCP 服务器配置中：

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

重启 Claude Desktop，然后问它：*"用 EncodeX 把 ~/Videos/clip.mov 转成 MP4。"*

### Cursor / VS Code

把同样的服务器定义添加到你的 MCP 配置中（Cursor 里的 `mcp.json`，或 VS Code 的 MCP 设置），将 `command` 指向 `encodex` 并传入 `--mcp` 参数。使用嵌入式服务器时，改用上面显示的 HTTP 传输 URL。

### 任何 MCP 客户端

stdio 服务器是标准的 JSON-RPC 进程——无需任何特殊集成。只要你的工具能启动命令并说 MCP 语言，它就能和 EncodeX 对话。

---

## 设计上默认私密与安全

提供自动化接口意味着要严肃对待安全。嵌入式服务器刻意采用保守设计：

- **仅限 loopback** —— 绑定到 `127.0.0.1`，其他机器永远无法访问。
- **Origin 校验** —— 除非请求来自本地应用，否则一律拒绝跨域请求。
- **可选 bearer 令牌** —— 启用后每个请求都必须通过认证，并使用常量时间比较。
- **极小的 HTTP 暴露面** —— 仅 `/mcp` 上的 `GET`、`POST` 和 `DELETE`。
- **干净地关闭** —— 服务器停止或应用退出时，所有会话都会被强制关闭。
- **不泄露文件** —— 服务器驱动的是与 GUI 相同的本地 FFmpeg 引擎。不会上传任何内容。

独立的 `--mcp` 模式继承同样的"一切都在本地运行"保证：它只是与你电脑上已有的引擎对话的另一种方式。

---

## 适合谁用？

- **创作者和剪辑师** —— 平时在 AI 助手里工作，希望不离开它就能准备好素材。
- **开发者** —— 构建需要真实媒体处理的 Agent 工作流。
- **自动化爱好者** —— 想要可重复、可描述的工作流，而不是一次性命令。
- **任何人** —— 比起满屏找设置，更愿意开口要结果。

如果你从未用过 MCP 客户端，一切照旧——GUI 和 CLI 和以前完全一样。MCP 服务器只是通向同一个引擎的又一扇门。

---

## 今天就试试

1. 更新到最新的 EncodeX 构建版本。
2. 运行 `encodex --mcp`，或在应用里启用 **设置 → MCP 服务器**。
3. 连接你的 AI 助手，请它转换点东西。

完整参考——每个工具、资源、提示、客户端配置和安全模型——请阅读 [MCP 文档](/docs/cli#mcp-server-mode)。

---

[下载 EncodeX](/download) · [查看所有功能](/features) · [阅读 CLI 文档](/docs/cli)