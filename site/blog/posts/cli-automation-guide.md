---
title: "How to Automate Media Workflows With the EncodeX CLI"
description: "Use EncodeX from the command line to script batch conversions, extract audio, compress images, and build automated media pipelines."
date: 2026-09-12
tags:
  - guide
  - cli
  - automation
  - developer
---

# How to Automate Media Workflows With the EncodeX CLI

EncodeX is a GUI-first application, but it ships with a full command-line interface that can do everything the desktop app can — and a few things it can't. If you work with media files regularly and want to build scripts, automate batches, or pipe conversions into a workflow, the CLI makes EncodeX something you can run from a terminal, a CI pipeline, or a scheduled task.

## Why Use the CLI?

The GUI is ideal for one-off conversions — drag a file, pick a profile, go. But when you have a folder of fifty videos, or you want a script to compress every recording that lands in a directory, the CLI lets you encode without opening a window.

Common use cases:

- **Batch conversion scripts** — convert every `.mov` in a folder to `.mp4` with one command.
- **Audio extraction** — strip audio from video files for podcasts or archives.
- **CI/CD pipelines** — validate or re-encode media artifacts as part of an automated build.
- **Scheduled tasks** — compress new recordings every night automatically.
- **Integration with other tools** — pipe media info into monitoring systems or logging pipelines.

## Getting Started

If you've installed EncodeX (GUI), the CLI is already available. Open a terminal and run:

```bash
encodex convert --help
```

You'll see the full list of options. The CLI mirrors the GUI's capabilities: every format, codec, and profile the app supports is available from the command line too.

For installation options and all available commands, see the [CLI documentation](/docs/cli).

## Converting a Video

The most common operation is converting between formats. A simple conversion:

```bash
encodex convert in.mov -o out.mp4
```

This uses EncodeX's default settings (H.264 + AAC in an MP4 container) and produces a file that works everywhere.

To target a specific codec or quality:

```bash
encodex convert in.mov -o out.mp4 --video-codec libx265 --crf 20
```

H.265 produces smaller files at the same quality. CRF 20 is a high-quality setting; lower numbers mean higher quality (and larger files).

## Extracting Audio

Pull the audio track out of a video without re-encoding:

```bash
encodex extract-audio in.mp4 -o audio.mp3
```

The default output is MP3 at 192k. To specify a different format:

```bash
encodex extract-audio in.mp4 -o audio.wav --codec libopus
```

This is useful for extracting podcast audio from video recordings, creating audio previews, or archiving soundtracks separately.

## Lossless Transcoding

When you need to change the container format without touching the video or audio data (for example, moving from `.mkv` to `.mp4` for device compatibility):

```bash
encodex convert in.mkv -o out.mp4 --video-codec copy --audio-codec copy
```

This is nearly instant because no encoding happens — the streams are just remuxed into the new container. Perfect for the archivist who wants maximum compatibility without quality loss.

## Batch Conversions

Convert multiple files at once:

```bash
encodex batch *.mov -o output/ --video-codec libx264 --crf 23
```

All matching files are processed sequentially. Each input file becomes a corresponding output file in the `output/` directory, with the extension changed to `.mp4`.

## Getting Media Information

Before converting, you might want to inspect a file's codec, resolution, or bitrate:

```bash
encodex info in.mp4
```

This prints a human-readable summary of the file's streams. For machine-readable output:

```bash
encodex info in.mp4 --json
```

The JSON output is useful in scripts where you need to make decisions based on the file's properties (for example, "only re-encode if the video codec is not already H.264").

## Exit Codes and Error Handling

The CLI returns meaningful exit codes so scripts can detect success or failure:

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Input file not found |
| 4 | Output file exists (use `--overwrite` to replace) |

Use these in shell scripts to handle errors gracefully:

```bash
encodex convert in.mp4 -o out.mp4
if [ $? -eq 4 ]; then
  echo "Output exists — skipping."
fi
```

## Putting It Together

The CLI is designed to be composable. A real-world script might:

1. Check all video files in a folder using `encodex info --json`
2. Filter to files larger than 500 MB
3. Convert those files to a smaller H.264 MP4 at CRF 23
4. Log the results

The [full CLI reference](/docs/cli) documents every option, flag, and exit code.

---

*Download EncodeX for free at [encodex.in/download](/download). The CLI is included with every installation.*
