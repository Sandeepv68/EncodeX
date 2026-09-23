---
title: "MCP Batch Automation: Queue Dozens of Media Jobs in One Prompt"
description: "Use EncodeX's MCP server to queue an entire folder of videos with a single prompt — async jobs, progress tracking, and structured results via batch_convert, list_jobs, and get_job."
date: 2026-09-22
tags:
  - guide
  - mcp
  - automation
  - batch
  - ai
---

# MCP Batch Automation: Queue Dozens of Media Jobs in One Prompt

The EncodeX MCP server isn't just for single conversions. Because every job runs asynchronously and exposes job-tracking tools, you can hand an AI assistant a whole folder of media and have it queued, processed, and reported back — without opening the app or writing a single command by hand.

This guide shows the batch workflow: the `batch_convert` tool, the async job model, and how status tools keep you informed while FFmpeg works.

## The Async Job Model

When EncodeX starts a conversion through MCP, it doesn't wait around. It returns a **job ID** immediately, and the job runs in the background. You (or the assistant) then poll:

- `get_job` — status, progress, and result for one job
- `list_jobs` — every job in the current session
- `cancel_job` — stop a running job

That's what makes a dozen-file batch feel instant at the prompt level: the work is queued in one call, and EncodeX streams through it.

## Queue an Entire Folder

The fastest path is `batch_convert`. Give the assistant a folder and a target, for example:

> Convert every MKV file in `~/Downloads` to MP4, and put them in `~/Output`.

The assistant walks the folder, calls `batch_convert`, and starts the queue. You don't need to manage jobs one by one.

Want a more specific batch? Name the filter:

> Take all videos in `~/Recordings`, re-encode them to H.264 in an MP4 container at CRF 23, and keep them in place.

The assistant picks the right profile from the `list_profiles` and `get_profile` tools, then queues the batch.

## Mixing Tools in One Prompt

Because all tools share one session, a single prompt can chain several operations:

> For every video in `~/Source`: convert it to an MP4 for my phone, extract the audio as MP3, and compress the screenshot folder `~/Assets`.

That's `batch_convert` plus `extract_audio` plus `compress_image`, all queued and tracked together. The assistant coordinates them and reports what completed where.

## Checking Progress

While jobs run, ask:

> What's the status of my batch?

`list_jobs` returns every job with its current status and progress. Need finer detail?

> How far along is the MKV to MP4 conversion?

The assistant polls `get_job` for the specific job and reads its progress. If something misbehaves:

> Cancel the job that's been stuck for a while.

That maps to `cancel_job` — and because jobs are isolated, the rest of the batch keeps going.

## The 4 Prompt Templates

The MCP server also ships four prompt templates — `convert-video`, `extract-audio`, `compress-image`, and `batch-convert`. These pre-fill the right tool calls and argument structure, which is especially useful for agents that want a canonical way to run a common operation. The assistant can invoke the template and then the tool chain, giving consistent results across sessions.

## Frequently Asked Questions

### How many files can I queue at once?

There's no small arbitrary cap — EncodeX processes the queue sequentially using your hardware. Start with a folder and let it work; you can check status at any time.

### Do batch jobs run in the background?

Yes. The GUI shows them in the Batch Queue, and through MCP you track them with `get_job` and `list_jobs`. You can keep prompting for other things while encoding runs.

### Can I cancel just one job?

Yes — `cancel_job` stops a single job. The embedded HTTP surface also adds `cancel_all_jobs` for the whole queue. Others continue independently.

### Is the batch offline?

Entirely. All encoding happens locally on your machine via FFmpeg — no uploads, no cloud, works with no internet connection.

## Learn More

- [Control EncodeX from Claude Desktop](/blog/posts/how-to-use-claude-with-mcp)
- [MCP server documentation](/docs/cli#mcp-server-mode)
- [MCP security and privacy model](/blog/posts/mcp-privacy-security)
- [Feature reference: MCP tools](/docs/features-reference#mcp-server)

---

*Download EncodeX for free at [encodex.in/download](/download). The MCP server and batch queue are included with every installation.*