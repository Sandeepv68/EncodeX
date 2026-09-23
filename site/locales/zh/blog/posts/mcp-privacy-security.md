---
title: "MCP 隐私与安全：为什么 EncodeX 让媒体留在本地"
description: "EncodeX 的 MCP 服务器完全运行在你的机器上 —— 回环绑定、Origin 校验、可选访问令牌和离线优先设计。不上传、不碰云、不需要账号。"
date: 2026-09-24
tags:
  - guide
  - mcp
  - security
  - privacy
  - ai
---

# MCP 隐私与安全：为什么 EncodeX 让媒体留在本地

让 AI 助手控制你的媒体文件，会引出一个显而易见的问题：我的文件会怎样？对于 EncodeX 的 MCP 服务器，答案直截了当 —— 一切都在你自己的电脑上运行。助手下达指令；EncodeX 内置的 FFmpeg 引擎在本地干活。文件永远不会离开你的设备，服务器还通过回环绑定、Origin 校验和可选访问令牌做了加固。

本文详解安全模型，让你明确哪些得到保护。

## 离线优先设计

最核心的保证也最简单：**不上传、不碰云、不需要账号**。EncodeX 是本地应用，MCP 服务器是本地进程。没有任何 EncodeX 云可以接收你的文件 —— 转换、提取、压缩、裁剪全部发生你的硬件上。即便你的机器离线，MCP 依然可用。

这让 EncodeX 成为真正 *本地* 的 MCP 服务器选项。你的媒体永远不会变成别人的训练数据或存储账单。

## 独立服务器：一个普通的进程

在默认模式（`encodex --mcp`）下，EncodeX 作为无界面 stdio 进程运行，说 JSON-RPC。它不绑定网络上的任何东西 —— stdout 承载协议消息，stderr 承载日志，进程在 stdin 关闭前一直存活。根本没有监听端口，因此远程攻击者没有任何可接触的面。

## 嵌入式服务器：回环 + Origin 校验

可选的嵌入式 HTTP 服务器（设置 → MCP 服务器）是唯一的联网面，而且它对对话对象很谨慎：

- **仅回环** —— 绑定到 `127.0.0.1`，只有你本机的软件能访问到它。
- **Origin 校验** —— 进来的请求必须携带可接受的 `Origin` 头（你的本地客户端），且只在 `/mcp` 上接受 `GET`、`POST`、`DELETE`。
- **会话限定于应用** —— 服务器停止或 EncodeX 退出时，所有会话都被强制关闭。

思路是：这个端点只服务于你本地的 AI 应用，而不是网络里的任何其他东西。

## 可选访问令牌

再加一层，你可以在设置 → MCP 服务器里设置**访问令牌**。之后嵌入式服务器要求 bearer 令牌，并以**常数时间**比较令牌 —— 避免靠逐个猜字符来试密的经典时序旁路。

因为是可选的，由你掌控权衡：信任的单用户机器上为方便可不设令牌，想要对本地客户端做显式授权时再设令牌。

## 助手实际上能做什么

MCP 不是对你系统的开放提示。助手只能调用 EncodeX 暴露的工具。stdio 面提供 13 个核心工具（`convert_media`、`batch_convert`、`extract_audio`、`compress_image`、`cut_video`、任务管理等等）；嵌入式面加上与界面同级的工具（`get_queue_state`、`cancel_all_jobs`、`get_timeline`、`extract_preview`、`get_system_info`、`check_for_updates`）。这是刻意的工具范围限定 —— 助手能操作 EncodeX，仅此而已。

应用退出时所有会话都会强制关闭，所以过期的助手无法在你关掉 EncodeX 后还抓住句柄不放。

## 常见问题解答

### EncodeX 的 MCP 服务器会往任何地方发送数据吗？

不会。EncodeX 通过 FFmpeg 全部在本地处理。没有云端组件，没有你媒体的遥测，这里的 MCP 标准只是一个本地管道。

### 嵌入式服务器会暴露在我的网络上吗？

不会。它只绑定回环（`127.0.0.1`），校验 `Origin` 头，且只在 `/mcp` 接受 `GET`、`POST`、`DELETE`。你局域网里的远程设备无法访问到它。

### 怎么加令牌？

打开**设置 → MCP 服务器**，开启服务器，设置一个访问令牌。客户端之后会以 bearer 令牌发送，按常数时间比较。

### 能完全离线使用 MCP 吗？

能 —— 这正是核心设计。安装 EncodeX，运行 `encodex --mcp` 或启用嵌入式服务器，没有网络连接一切照常。

## 了解更多

- [MCP 服务器文档](/zh/docs/cli#mcp-server-mode)
- [Claude Desktop 和 Claude Code 配置](/zh/blog/posts/how-to-use-claude-with-mcp)
- [批量自动化指南](/zh/blog/posts/mcp-batch-automation-guide)
- [Cursor 与 VS Code 工作流](/zh/blog/posts/cursor-and-vscode-mcp-workflows)
- [功能参考：MCP](/zh/docs/features-reference#mcp-server)

---

*在 [encodex.in/download](/zh/download) 免费下载 EncodeX。每次安装都包含 MCP 服务器。*