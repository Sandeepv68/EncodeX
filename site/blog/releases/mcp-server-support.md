---
date: 2026-09-18
title: "EncodeX Adds a Built-In MCP Server: Let AI Drive Your Media Conversions"
description: "EncodeX now ships a Model Context Protocol (MCP) server, so Claude, Cursor, VS Code, and custom agents can convert, compress, trim, and batch-process your media — locally and safely."
tags:
  - release
  - mcp
  - ai
  - automation
---

# EncodeX Adds a Built-In MCP Server: Let AI Drive Your Media Conversions

**Released:** 2026-09-18
**Feature:** Built-in MCP server (stdio + embedded HTTP)

## The Short Version

EncodeX can now act as a [Model Context Protocol](https://modelcontextprotocol.io) server. That means AI assistants — Claude Desktop, Claude Code, Cursor, VS Code, and any other MCP-compatible client — can convert videos, extract audio, compress images, trim clips, and manage batch jobs through EncodeX, using nothing but a plain-language request.

And it all still happens on your computer. No uploads, no cloud, no account.

---

## Why MCP Changes the Everyday Workflow

We built EncodeX to remove the FFmpeg command line for regular people. The **MCP server** removes the last bit of "which button do I press?" friction for the tools you already use.

If you have ever typed something like:

> "Take `interview.mov`, pull the audio out as MP3, and make a copy that fits in an email."

…an MCP-enabled assistant can now *actually do it* — choosing the right EncodeX tool, running the conversion locally, and reporting back the result. You stay in your favourite AI app; EncodeX does the heavy lifting behind the scenes.

A few things this unlocks:

- **Conversational batch work** — "Convert every MKV in this folder to MP4 and tell me when it's done."
- **Agent pipelines** — let a coding or media agent prepare assets as part of a larger task.
- **Repeatable automation** — describe a workflow once; your assistant reuses it.
- **No command syntax to memorise** — profiles, codecs, and containers are handled for you.

---

## Two Ways to Connect

### 1. Standalone stdio server

Run EncodeX as a dedicated MCP process. This is what desktop AI apps use when they launch a server on demand:

```bash
# Packaged app
encodex --mcp

# Source checkout (after npm run build:main)
node dist/mcp/index.js
```

stdout carries the MCP protocol; all logs go to stderr, so nothing corrupts the conversation between your assistant and EncodeX.

### 2. Embedded HTTP server (GUI mode)

Already have EncodeX open? Flip on **Settings → MCP Server** and point your client at:

```
http://127.0.0.1:8765/mcp
```

This mode shares the running app's job queue and adds live queue, preview, timeline, system, and update tools — so an assistant can see what you're working on instead of acting in isolation.

---

## What Your Assistant Can Do

Across both surfaces, EncodeX exposes **19 tools**.

| Area              | Tools                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| Conversion        | `convert_media`, `batch_convert`, `cut_video`, `compress_image`, `extract_audio`                  |
| Inspection        | `get_media_info`, `list_capabilities`, `list_profiles`, `get_profile`, `ping`                      |
| Job management    | `get_job`, `list_jobs`, `cancel_job`                                                               |
| GUI parity (HTTP) | `get_queue_state`, `cancel_all_jobs`, `get_timeline`, `extract_preview`, `get_system_info`, `check_for_updates` |

There are also **3 resources** — `encodex://profiles`, `encodex://capabilities`, and `encodex://codecs` — so an assistant can discover exactly what your build supports, and **4 prompt templates** for the most common tasks: convert video, extract audio, compress image, and batch convert.

Conversions are **asynchronous**. A long render doesn't freeze the conversation: your assistant starts the job, gets a job ID, and can poll for progress or cancel it later.

---

## Setting It Up in a Minute

### Claude Desktop

Add EncodeX to your MCP servers configuration:

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

Restart Claude Desktop and ask: *"Use EncodeX to convert ~/Videos/clip.mov to MP4."*

### Cursor / VS Code

Add the same server definition to your MCP configuration (`mcp.json` in Cursor, or the MCP settings in VS Code), pointing `command` at `encodex` with the `--mcp` argument. For the embedded server, use the HTTP transport URL shown above instead.

### Any MCP client

The stdio server is a standard JSON-RPC process — no special integration required. If your tool can spawn a command and speak MCP, it can talk to EncodeX.

---

## Private and Safe by Design

Shipping an automation surface means taking security seriously. The embedded server is deliberately conservative:

- **Loopback only** — it binds to `127.0.0.1` and is never reachable from another machine.
- **Origin checks** — cross-origin requests are rejected unless they come from the local app.
- **Optional bearer token** — enable one and every request must be authenticated, with constant-time comparison.
- **Minimal HTTP surface** — only `GET`, `POST`, and `DELETE` on `/mcp`.
- **Clean shutdown** — all sessions are force-closed when the server stops or the app quits.
- **No file exfiltration** — the server drives the same local FFmpeg engine as the GUI. Nothing is uploaded.

The standalone `--mcp` mode inherits the same "everything runs locally" guarantee: it is simply a different way to talk to the engine already on your machine.

---

## Who Is This For?

- **Creators and editors** who already work inside an AI assistant and want assets prepared without leaving it.
- **Developers** building agent workflows that need real media processing.
- **Automation fans** who want repeatable, describable pipelines instead of one-off commands.
- **Anyone** who would rather ask for a result than hunt for a setting.

If you have never used an MCP client, nothing changes — the GUI and CLI are exactly as they were. The MCP server is an extra door into the same engine.

---

## Try It Today

1. Update to the latest EncodeX build.
2. Run `encodex --mcp`, or enable **Settings → MCP Server** in the app.
3. Connect your AI assistant and ask it to convert something.

Read the full reference — every tool, resource, prompt, client config, and the security model — in the [MCP documentation](/docs/cli#mcp-server-mode).

---

[Download EncodeX](/download) · [Explore all features](/features) · [Read the CLI docs](/docs/cli)
