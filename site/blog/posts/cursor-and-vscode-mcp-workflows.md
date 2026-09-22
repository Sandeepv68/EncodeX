---
title: "Cursor and VS Code MCP Workflows With EncodeX"
description: "Wire EncodeX into Cursor or VS Code with encodex --mcp and turn media chores into agent workflows — conversions, extracts, and image compression inside your editor."
date: 2026-09-23
tags:
  - guide
  - mcp
  - cursor
  - vscode
  - ai
---

# Cursor and VS Code MCP Workflows With EncodeX

Cursor and VS Code both speak MCP, which means you can hand media tasks to your editor's AI without leaving your code. Point either one at EncodeX's built-in server and ask for a conversion, an audio extraction, or a whole folder of image compression while you keep working on the actual project.

The server runs locally (`encodex --mcp`), so the editor's agent operates your machine's own FFmpeg engine — no uploads, no external API, fully offline.

## Set Up EncodeX in VS Code

VS Code ships built-in MCP support. Open the MCP settings and add a server definition:

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

VS Code launches `encodex --mcp` as the server process. Once connected, the editor's assistant can call EncodeX's tools — `convert_media`, `extract_audio`, `compress_image`, `cut_video`, `batch_convert` — and track jobs with `get_job` / `list_jobs`.

For the live extra tools (queue state, timeline, preview, system info), enable **Settings → MCP Server** in the EncodeX GUI and point the editor at `http://127.0.0.1:8765/mcp`. That surface adds GUI-parity tools like `get_queue_state`, `extract_preview`, and `get_timeline`.

## Set Up EncodeX in Cursor

Cursor exposes MCP servers in its settings too, with either the same JSON config or a similar "Add MCP Server" dialog using the `command` type:

- **Command (stdio):** `encodex --mcp`

Cursor shares the standard MCP configuration format, so the JSON block above works for Cursor as well. After adding the server, the Cursor agent can perform media operations directly.

## Editing Workflows

The useful pattern is combining media work with your editor's normal flow:

> Convert `assets/tmp/video.mov` to MP4 for the docs page, in `assets/` folder.

The agent calls `convert_media`, waits on `get_job`, and then can do follow-up work — hosting a preview, updating a README, or wiring the new file into a build.

More advanced, a single prompt can orchestrate many steps:

> New recording dropped in `~/r2d2/captures`. Convert it to a compressed MP4, extract the transcript audio, and then update `docs/captures.md` with the output locations.

That's `convert_media` + `extract_audio`, coordinated with your repo work in one session.

## Versioned Output and Cleanup

Because EncodeX creates real files on disk, you can combine it with your git workflow:

> Run the batch from `~/r2d2/captures` to `~/r2d2/output`, then tell me which output files are new so I know what to add.

The agent reads the tool results, `list_jobs` history, and your directory state to summarize what changed — turning a media chore into a documented commit.

## Frequently Asked Questions

### Does this send my code or media to a cloud?

No. EncodeX MCP runs entirely on your machine. Your media is processed locally and your editor's agent operates those local tools. There is no cloud round-trip for the encoding.

### Do I need the EncodeX GUI open?

For the stdio server (`encodex --mcp`), no — it runs headless. The embedded HTTP server is the opt-in surface that runs inside the app and adds live queue and preview tools.

### Can I use it with Cursor and VS Code at the same time?

Yes. Each client spawns its own stdio server instance, or you can share the one embedded HTTP endpoint for both (single GUI instance).

### Which tools are available?

The stdio surface exposes 13 core tools including `convert_media`, `batch_convert`, `extract_audio`, `compress_image`, `cut_video`, and job management. Read the [feature reference](/docs/features-reference#mcp-server) for the full catalogue.

## Learn More

- [Claude Desktop and Claude Code setup](/blog/posts/how-to-use-claude-with-mcp)
- [Batch automation guide](/blog/posts/mcp-batch-automation-guide)
- [MCP server documentation](/docs/cli#mcp-server-mode)
- [MCP privacy and security](/blog/posts/mcp-privacy-security)

---

*Download EncodeX for free at [encodex.in/download](/download). The MCP server is included with every installation.*