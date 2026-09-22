---
title: "MCP Privacy and Security: Why EncodeX Keeps Your Media Local"
description: "The EncodeX MCP server runs entirely on your machine — loopback binding, Origin validation, optional bearer token, and an offline-first design. No uploads, no cloud, no account."
date: 2026-09-24
tags:
  - guide
  - mcp
  - security
  - privacy
  - ai
---

# MCP Privacy and Security: Why EncodeX Keeps Your Media Local

Letting an AI assistant control your media files raises an obvious question: what happens to my files? With EncodeX's MCP server, the answer is straightforward — everything runs on your own computer. The assistant issues instructions; EncodeX's built-in FFmpeg engine does the work locally. Files never leave your device, and the server is hardened with loopback binding, Origin validation, and an optional access token.

This post walks through the security model so you know exactly what's protected.

## Offline by Design

The headline guarantee is the simplest one: **no uploads, no cloud, no account**. EncodeX is a local application, and the MCP server is a local process. There is no EncodeX cloud to send files to — conversion, extraction, compression, and cutting all happen on your hardware. If your machine is offline, MCP still works.

That makes EncodeX a genuinely *local* MCP server option. Your media never becomes someone else's training data or storage bill.

## Standalone Server: A Plain Process

In default mode (`encodex --mcp`), EncodeX runs as a headless stdio process speaking JSON-RPC. It binds to nothing on the network — stdout carries protocol messages, stderr carries logs, and the process stays alive until stdin closes. There is no listening port at all, so there's no surface a remote attacker could reach.

## Embedded Server: Loopback + Origin Check

The opt-in embedded HTTP server (Settings → MCP Server) is the only networked surface, and it's careful about who it talks to:

- **Loopback only** — it binds to `127.0.0.1`, so only software on your own machine can reach it.
- **Origin validation** — incoming requests must carry an acceptable `Origin` header (your local clients), and it accepts only `GET`, `POST`, and `DELETE` on `/mcp`.
- **Sessions are scoped to the app** — all sessions are force-closed when the server stops or EncodeX quits.

The idea: the endpoint exists for your local AI apps, not for anything else on the network.

## Optional Access Token

For an extra layer, you can set an **access token** in Settings → MCP Server. The embedded server then requires a bearer token, and it compares tokens in **constant time** — avoiding the classic timing side-channel used to guess secrets character by character.

Because it's opt-in, you control the trade-off: no token for convenience on a trusted single-user machine, a token when you want explicit authorization for local clients.

## What the Assistant Can Actually Do

MCP isn't an open prompt to your system. The assistant can only call the tools EncodeX exposes. The stdio surface offers 13 core tools (`convert_media`, `batch_convert`, `extract_audio`, `compress_image`, `cut_video`, job management, and more); the embedded surface adds live GUI-parity tools (`get_queue_state`, `cancel_all_jobs`, `get_timeline`, `extract_preview`, `get_system_info`, `check_for_updates`). That's deliberate tool-scoping — the assistant can operate EncodeX, and nothing else.

All sessions force-close when the app quits, so a stale assistant can't keep a handle after you've closed EncodeX.

## Frequently Asked Questions

### Does the EncodeX MCP server ever send data anywhere?

No. EncodeX processes everything locally through FFmpeg. There's no cloud component, no telemetry of your media, and the MCP standard here is just a local pipe.

### Is the embedded server exposed on my network?

No. It binds to loopback (`127.0.0.1`) only, validates the `Origin` header, and accepts only `GET`, `POST`, and `DELETE` on `/mcp`. Remote devices on your LAN cannot reach it.

### How do I add a token?

Open **Settings → MCP Server**, enable the server, and set an access token. Clients then send it as a bearer token, matched in constant time.

### Can I use MCP fully offline?

Yes — that's the core design. Install EncodeX, run `encodex --mcp` or enable the embedded server, and everything works with no internet connection.

## Learn More

- [MCP server documentation](/docs/cli#mcp-server-mode)
- [Claude Desktop and Claude Code setup](/blog/posts/how-to-use-claude-with-mcp)
- [Batch automation guide](/blog/posts/mcp-batch-automation-guide)
- [Cursor and VS Code workflows](/blog/posts/cursor-and-vscode-mcp-workflows)
- [Feature reference: MCP](/docs/features-reference#mcp-server)

---

*Download EncodeX for free at [encodex.in/download](/download). The MCP server is included with every installation.*