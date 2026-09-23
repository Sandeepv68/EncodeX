---
title: "How to Use the EncodeX MCP Server With Claude Desktop and Claude Code"
description: "Connect EncodeX's built-in MCP server to Claude Desktop or Claude Code and convert, extract, compress, and batch-process media using natural language — entirely offline."
date: 2026-09-21
tags:
  - guide
  - mcp
  - claude
  - ai
  - automation
---

# How to Use the EncodeX MCP Server With Claude Desktop and Claude Code

EncodeX ships with a built-in MCP server (Model Context Protocol), which means you can drive the whole app from Claude Desktop or Claude Code using plain language. Instead of opening a GUI and hunting through dropdowns, you ask: *"convert this MKV to MP4 for my phone"* — and the assistant performs the conversion with EncodeX's local FFmpeg engine.

Everything runs on your computer. Files never leave your device, there's no account, and the whole thing works offline.

## What Is an MCP Server?

[MCP](https://modelcontextprotocol.io) is an open standard that lets AI assistants call tools in real applications. EncodeX's server exposes a set of conversion tools — `convert_media`, `extract_audio`, `compress_image`, `cut_video`, `batch_convert`, plus job-tracking tools like `get_job` and `list_jobs` — as well as resources and prompt templates.

Think of it as a remote control for FFmpeg that an AI assistant can operate. The assistant sees the tools, decides which to call, and EncodeX does the encoding locally.

## Getting Started

Install EncodeX ([download](/download)) — the MCP server is built in, no plug-ins required — and make sure `encodex` is on your `PATH` (installing EncodeX adds it).

### Option 1: Claude Desktop

Open **Claude Desktop → Settings → Developer → Edit Config** and add an MCP server entry:

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

Save the file and restart Claude Desktop. Claude will now have access to EncodeX's tools.

### Option 2: Claude Code

From a terminal inside your project:

```bash
claude mcp add encodex -- encodex --mcp
```

Then start Claude Code and ask for a conversion. You can verify the server registered with `claude mcp list`.

## Your First Request

Try something simple:

> Convert `~/Desktop/vacation.mp4` to a smaller MP4 suitable for WhatsApp.

The assistant calls `convert_media`, the job runs in the background on your machine, and Claude reports the result. Because conversion is asynchronous, EncodeX returns a job ID; the assistant polls `get_job` for progress and finishes when it completes.

You can also extract audio:

> Pull the audio out of `lecture.mov` as an MP3.

That maps to the `extract_audio` tool. Or shrink a folder of images:

> Compress all the photos in `~/Pics` into the `~/Output` folder.

That's the `compress_image` tool, driven in plain language.

## Running the Server Headless

`encodex --mcp` starts the standalone stdio server. It speaks JSON-RPC over stdout (so protocol messages stay clean) and keeps all status and logging on stderr. The process lives until stdin closes — which is exactly how desktop async apps run an MCP server on demand.

For the embedded HTTP surface — live queue, preview, timeline, and system tools — enable **Settings → MCP Server** in the GUI and point the client at `http://127.0.0.1:8765/mcp`.

## Tips for Better Results

- **Give absolute or explicit paths** — it's easier for the assistant to target the right files.
- **Name the output format** — "as MP4", "to MP3" — so the right profile is selected.
- **Use batches for folders** — EncodeX can convert many files in one job (see the [batch automation guide](/blog/posts/mcp-batch-automation-guide)).
- **Check the docs for exotic options** — the full tool catalogue lives in the [MCP feature reference](/docs/features-reference#mcp-server).

## Frequently Asked Questions

### Is the EncodeX MCP server free?

Yes — it's built into the free, open-source (MIT) EncodeX app. No subscription, no license key.

### Do I need the GUI open to use `encodex --mcp`?

No. The standalone server runs headless with no GUI. The embedded HTTP server (Settings → MCP Server) is the opt-in surface that runs inside the app for live queue and preview tools.

### Does MCP upload my files?

No. EncodeX processes everything locally. The MCP server drives the same local FFmpeg engine as the GUI — no uploads, no cloud, no account required.

### Which assistants can connect?

Any MCP-compatible client. This guide covers Claude Desktop and Claude Code, and the same configuration pattern works in [Cursor and VS Code](/blog/posts/cursor-and-vscode-mcp-workflows).

## Learn More

- [MCP server documentation](/docs/cli#mcp-server-mode)
- [Batch automation with MCP](/blog/posts/mcp-batch-automation-guide)
- [MCP privacy and security](/blog/posts/mcp-privacy-security)
- [The full feature reference](/docs/features-reference#mcp-server)

---

*Download EncodeX for free at [encodex.in/download](/download). The MCP server is included with every installation.*