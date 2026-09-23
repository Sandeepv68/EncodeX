---
title: "如何将 EncodeX MCP 服务器用于 Claude Desktop 和 Claude Code"
description: "将 EncodeX 内置的 MCP 服务器连接到 Claude Desktop 或 Claude Code，用自然语言转换、提取、压缩和批量处理媒体 —— 完全离线。"
date: 2026-09-21
tags:
  - guide
  - mcp
  - claude
  - ai
  - automation
---

# 如何将 EncodeX MCP 服务器用于 Claude Desktop 和 Claude Code

EncodeX 自带内置的 MCP 服务器（Model Context Protocol），这意味着你可以用大白话从 Claude Desktop 或 Claude Code 操控整个应用。不用打开界面翻菜单，直接问：*"把这段 MKV 转成 MP4 给我的手机"* —— 助手就会用 EncodeX 的本地 FFmpeg 引擎完成转换。

一切都在你的电脑上运行。文件永远不会离开你的设备，不需要账号，而且完全离线可用。

## 什么是 MCP 服务器？

[MCP](https://modelcontextprotocol.io) 是一个开放标准，让 AI 助手可以使用真实应用里的工具。EncodeX 的服务器提供一组转换工具 —— `convert_media`、`extract_audio`、`compress_image`、`cut_video`、`batch_convert`，以及 `get_job` 和 `list_jobs` 这类任务跟踪工具 —— 外加资源和提示模板。

可以把它想成一个 AI 助手能操作 FFmpeg 的遥控器。助手看到工具、决定调用哪些，然后 EncodeX 在本地完成编码。

## 快速上手

安装 EncodeX（[下载](/zh/download)）—— MCP 服务器已内置，无需插件 —— 并确保 `encodex` 在 `PATH` 中（安装 EncodeX 会自动加入）。

### 方式一：Claude Desktop

打开 **Claude Desktop → 设置 → 开发者 → 编辑配置**，添加一个 MCP 服务器条目：

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

保存文件并重启 Claude Desktop。Claude 现在就能访问 EncodeX 的工具。

### 方式二：Claude Code

在项目目录的终端里：

```bash
claude mcp add encodex -- encodex --mcp
```

然后启动 Claude Code 并请求一次转换。可以用 `claude mcp list` 确认服务器已注册。

## 你的第一次请求

试着说一句简单的：

> 把 `~/Desktop/vacation.mp4` 转成一个适合 WhatsApp 的较小 MP4。

助手调用 `convert_media`，任务在你的机器后台运行，Claude 报告结果。由于转换是异步的，EncodeX 会返回任务 ID；助手轮询 `get_job` 跟踪进度，完成时结束。

你还可以提取音频：

> 把 `lecture.mov` 的音频提取成 MP3。

这对应 `extract_audio` 工具。或者压缩一整个图片文件夹：

> 把 `~/Pics` 里所有照片压缩到 `~/Output`。

这就是 `compress_image` 工具，用大白话就能操控。

## 无界面运行服务器

`encodex --mcp` 启动独立的 stdio 服务器。它通过 stdout 说 JSON-RPC（保持协议消息干净），把所有状态和日志送到 stderr。进程在 stdin 关闭前一直存活 —— 正是桌面应用按需运行 MCP 服务器所需要的方式。

要使用嵌入式 HTTP 面 —— 实时队列、预览、时间线、系统工具 —— 在界面里启用**设置 → MCP 服务器**，并把客户端指向 `http://127.0.0.1:8765/mcp`。

## 获得更好结果的技巧

- **给出绝对或明确路径** —— 助手更容易定位正确的文件。
- **说清输出格式** —— "转成 MP4"、"转成 MP3" —— 这样才会选中正确的配置文件。
- **文件夹用批量** —— EncodeX 用一个任务就能转换多个文件（见[批量自动化指南](/zh/blog/posts/mcp-batch-automation-guide)）。
- **高级选项查文档** —— 完整工具目录在 [MCP 功能参考](/zh/docs/features-reference#mcp-server)。

## 常见问题解答

### EncodeX MCP 服务器免费吗？

是的 —— 已内置在免费、开源的（MIT）EncodeX 应用中。没有订阅，没有许可证密钥。

### 用 `encodex --mcp` 需要打开界面吗？

不需要。独立服务器无界面运行。嵌入式 HTTP 服务器（设置 → MCP 服务器）是可选面，在应用内运行，提供队列和预览工具。

### MCP 会上传我的文件吗？

不会。EncodeX 全部在本地处理。MCP 服务器驱动的是与界面相同的本地 FFmpeg 引擎 —— 不上传、不碰云、不需要账号。

### 哪些助手可以连接？

任何兼容 MCP 的客户端。本指南覆盖 Claude Desktop 和 Claude Code；同样的配置方式也适用于 [Cursor 和 VS Code](/zh/blog/posts/cursor-and-vscode-mcp-workflows)。

## 了解更多

- [MCP 服务器文档](/zh/docs/cli#mcp-server-mode)
- [用 MCP 做批量自动化](/zh/blog/posts/mcp-batch-automation-guide)
- [MCP 隐私与安全](/zh/blog/posts/mcp-privacy-security)
- [完整功能参考](/zh/docs/features-reference#mcp-server)

---

*在 [encodex.in/download](/zh/download) 免费下载 EncodeX。每次安装都包含 MCP 服务器。*