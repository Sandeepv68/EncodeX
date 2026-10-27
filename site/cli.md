---
title: "EncodeX CLI – FFmpeg Command Line, Simplified | EncodeX"
description: "The EncodeX CLI gives you FFmpeg command-line power with simple, readable commands. Convert, compress, extract audio, and batch-process from the terminal on Windows, Mac, and Linux."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# EncodeX CLI

Simple enough for everyday users. Powerful enough for developers. **EncodeX** is not just a GUI — the same FFmpeg engine is available from the command line through the **EncodeX CLI**.

## FFmpeg Command Line, Without the FFmpeg Syntax

FFmpeg's native command line is powerful but famously unforgiving. The **EncodeX CLI** wraps it in simple, readable commands:

```bash
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac
encodex info input.mp4 --json
encodex compress photo.png -f jpg -q 30
encodex extract-audio input.mp4
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted
```

No cryptic `-c:v libx264 -crf 23 -preset medium` chains — just clear option flags, the same settings the GUI uses, and clean output.

## The Same Four Steps

Convert CLI or GUI, the workflow is identical — you pick a goal, EncodeX does the encoding:

<div class="workflow-steps">
  <div class="wf-step">
    <span class="wf-num">1</span>
    <p class="card-head">Drop</p>
    <p><code>vacation.mkv</code></p>
  </div>
  <div class="wf-step">
    <span class="wf-num">2</span>
    <p class="card-head">Choose</p>
    <p>📱 iPhone</p>
  </div>
  <div class="wf-step">
    <span class="wf-num">3</span>
    <p class="card-head">Convert</p>
    <p>✓ MP4 1080p</p>
  </div>
  <div class="wf-step">
    <span class="wf-num">4</span>
    <p class="card-head">Done</p>
    <p><code>vacation.mp4</code></p>
  </div>
</div>

From the terminal, the same goal is one command away:

```bash
encodex convert vacation.mkv vacation.mp4 --video-codec libx264 --audio-codec aac -s 1920x1080
```

## Why Use the EncodeX CLI?

- **Script it** — automate conversions in scripts and CI pipelines
- **Consistent** — the same FFmpeg engine as the GUI
- **Batch friendly** — glob patterns and `--concurrency` for parallel work
- **Readable** — commands you can type without a manual
- **Cross-platform** — works on Windows, macOS, and Linux

## CLI Commands

| Command            | What it does                                        |
| ------------------ | --------------------------------------------------- |
| `encodex convert`  | Convert a single file between any two formats       |
| `encodex batch`    | Convert many files with glob patterns, in parallel  |
| `encodex compress`  | Compress an image file                              |
| `encodex extract-audio` | Pull the audio track out of a video             |
| `encodex remux`    | Copy streams into another container without re-encoding |
| `encodex demux`    | Extract each stream into a separate file            |
| `encodex info`     | Probe a file and print its technical details         |
| `encodex capabilities` | List available encoders and hardware acceleration methods |

## Get the CLI

The CLI ships with **every EncodeX install** — download the app and you can call `encodex` from your terminal. No separate setup required.

[Download EncodeX for free](/download)

## FAQ

**Do I need the GUI to use the CLI?** No — the CLI runs from your terminal and does not require the GUI window. It's bundled with every install of EncodeX.

**Can I use the EncodeX CLI in scripts?** Yes — it supports `--json` output and standard exit codes for automation.

**Is the EncodeX CLI really free?** Yes — EncodeX is free forever and open source (MIT).

## Get Started

- [Download EncodeX for free](/download)
- [See why EncodeX is the easiest FFmpeg GUI](/ffmpeg-gui)
- [Learn what FFmpeg actually is](/learn/what-is-ffmpeg)
- [See all conversion and features](/features)