---
title: "How to Compress OBS and ShadowPlay Recordings for Sharing"
description: "Shrink large gameplay recordings from OBS or ShadowPlay to upload-friendly sizes using EncodeX — a free FFmpeg GUI with GPU acceleration."
date: 2026-09-14
tags:
  - guide
  - gaming
  - compression
  - obs
---

# How to Compress OBS and ShadowPlay Recordings for Sharing

Recording gameplay at 1080p 60fps produces huge files. A ten-minute session can easily hit 5–10 GB, and longer sessions can exceed 50 GB. These files are great for editing — they're captured at high quality with minimal compression — but they're far too large to upload to Discord, embed in a stream, send to friends, or post to social media.

The fix is a second encode: take the high-quality original, compress it to a sensible bitrate, and produce a file that's a fraction of the size but looks nearly identical when watched on a screen.

## Why Gameplay Recordings Are So Large

OBS and ShadowPlay capture at high bitrates by default — often 20,000 to 50,000 kbps. This preserves every detail for editing, but most viewers will never see the difference between a 50 Mbps recording and a 10 Mbps encode on a phone or laptop screen. The key insight: your source file is designed for editing, not for viewing. Compressing it for viewing produces a file that looks the same to your audience but weighs dramatically less.

## The Compression Sweet Spot for Gameplay

For gameplay footage destined for YouTube, Discord, or social media:

- **Codec:** H.264 (most compatible) or H.265 (smaller files)
- **Resolution:** Keep the native resolution if it's 1080p or lower; downscale 4K to 1080p for most platforms
- **Bitrate:** 5,000–10,000 kbps for 1080p 60fps is the sweet spot — high enough to preserve fast action, low enough to shrink the file dramatically
- **CRF mode:** CRF 20–23 offers a good balance of quality and size without manually choosing a bitrate

A ten-minute 1080p 60fps gameplay recording captured at 30 Mbps is roughly 2.2 GB. Re-encoded at CRF 22, it comes out around 300–500 MB — a 75–85% reduction — while looking virtually identical on YouTube or a phone screen.

## How to Compress Gameplay With EncodeX

1. [Download EncodeX](/download) and open it.
2. Drop your OBS or ShadowPlay recording into the window.
3. Choose a profile — the **[MP4 Maximum Compatibility](/video-compressor)** profile works well for most sharing scenarios, or pick a smaller profile for Discord and chat.
4. Click **Compress**.

EncodeX uses your GPU (NVENC on NVIDIA, AMF on AMD, QSV on Intel) to compress the file fast. A ten-minute recording typically encodes in under two minutes — faster than real-time.

## Compressing Multiple Clips

If you recorded a long session and want to extract and compress specific clips, the **Video Cut** tool lets you trim to a time range before compressing. This avoids wasting space on the parts you don't need.

For bulk compression — processing an entire folder of recordings — the [batch queue](/features) handles multiple files in sequence with the same settings.

## Extracting Audio for Podcasts or Highlights

Sometimes you want just the audio from a gameplay clip — for a podcast clip, a voice-over, or a highlight reel. The [audio extract tool](/extract-audio-from-video) pulls the audio track and outputs it as MP3 or AAC in one step:

1. Drop the recording into the audio extract tool.
2. Choose MP3 or AAC.
3. Click **Extract**.

The audio comes out at the bitrate you choose (192k is the default), ready for editing or sharing.

## Why EncodeX Over HandBrake for This

HandBrake is a well-known video transcoder, and it works fine for compression. But EncodeX offers a few things HandBrake doesn't:

- **GPU detection is automatic** — no need to configure encoder settings
- **The workflow is faster** — drop file, pick profile, compress. No tab navigation or advanced settings required.
- **The compression preview shows estimated output size** before you start
- **The batch queue is integrated** — no separate batch mode to configure
- **It's cross-platform** — Windows, macOS, and Linux with the same interface

For the comparison in detail, see [EncodeX vs HandBrake](/handbrake-alternative).

---

*Download EncodeX for free at [encodex.in/download](/download) and start compressing your gameplay recordings today.*
