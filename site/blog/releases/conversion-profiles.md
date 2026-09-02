---
date: 2026-09-02
title: "Introducing Conversion Profiles — 140+ Presets for One-Click Encoding"
description: "EncodeX now ships with over 140 built-in conversion profiles across 8 categories. Pick a preset for YouTube, Instagram, TikTok, Apple devices, ProRes, HLS streaming, and more — all your settings fill in automatically."
tags:
  - feature
  - profiles
  - release
---

# Introducing Conversion Profiles

We just shipped one of the most requested features in EncodeX: **Conversion Profiles**. Instead of manually picking codecs, bitrates, quality settings, and container formats every time you convert a file, you can now choose from over 140 pre-configured presets that do all the work for you.

## What Are Conversion Profiles?

A conversion profile is a saved encoding configuration. It tells EncodeX exactly which video codec, audio codec, bitrate, quality level, resolution, pixel format, and container to use — all in one click.

Think of it like a recipe. Instead of measuring each ingredient yourself, you pick a recipe and everything is ready to go.

## What's Inside

The 140+ built-in profiles are organized into 8 categories:

### Web & Social

Optimized presets for the platforms you actually post to:

- **YouTube** — 480p through 4K, with H.264, H.265, and AV1 variants
- **Instagram** — Reels, Stories, and feed posts in the right aspect ratio and codec
- **TikTok** — vertical video presets tuned for fast upload and good quality
- **Facebook** — video posts and ads
- **X (Twitter)** — short-form video with file-size awareness

### Devices

Presets matched to specific hardware:

- **Apple** — iPhone, iPad, Mac, Apple TV (H.264 and HEVC)
- **Android** — phone and tablet presets
- **Gaming Consoles** — PlayStation, Xbox, and Nintendo Switch compatible formats

### Video Codecs

Codec-specific profiles for when you know what encoder you want:

- H.264, H.265/HEVC, VP8, VP9, AV1
- MPEG-4, MPEG-2, Theora

### Professional

Broadcast and post-production formats:

- **ProRes** — 422 LT, 422, 422 HQ, 4444, 4444 XQ
- **DNxHD / DNxHR** — multiple resolution and quality tiers
- **FFV1** — lossless archival codec
- **XDCAM / XAVC** — Sony broadcast formats

### Streaming

Adaptive bitrate streaming presets:

- **HLS** — HTTP Live Streaming with configurable segment duration
- **DASH** — MPEG-DASH output

### Audio

Audio-only conversion presets:

- MP3 (128k, 192k, 320k)
- AAC (128k, 192k, 256k)
- FLAC (lossless)
- Opus, WAV, and more

### Images

Image format conversion:

- JPEG, PNG, WebP, AVIF with quality controls

### Advanced

For power users:

- Raw FFmpeg argument presets
- Custom FFmpeg passthrough
- Null output for testing

## How to Use Profiles

1. Open the **Convert** page (or the **Batch Queue**)
2. Look for the **Profile Selector** at the top of the settings area
3. Browse by category or search by name
4. Click a profile — all the encoding fields fill in automatically
5. Tweak anything you want, then hit Convert

The profile selector shows each profile with an icon badge indicating its category, so you can quickly tell a YouTube preset from a ProRes one.

## Custom Profiles

If the built-in catalogue doesn't cover your exact use case, create your own:

1. Configure your encoding settings manually
2. Click the save button in the profile selector
3. Give it a name and category
4. Your custom profile appears alongside the built-in ones

Custom profiles are saved locally and persist between sessions. You can edit or delete them anytime. (Built-in profiles are locked — you can use them but not modify them.)

## Recently Used

EncodeX tracks the last 5 profiles you applied, so your most common workflows are always one click away. No need to browse categories when you're always using the same two presets.

## Batch Queue Support

Profiles work in the Batch Queue too. Apply a profile to set the encoding options for new jobs, or use it as a starting point before customizing individual batch entries.

## Under the Hood

Each profile maps to a `ConversionProfile` object that stores:

- Container format and output extension
- Video and audio codec selection
- Bitrate, CRF, and quality settings
- Scale, pixel format, and FPS
- Advanced FFmpeg arguments (`extraArgs` and `inputArgs`) for professional formats

When you apply a profile, EncodeX writes these values into the conversion form. The advanced profiles can pass raw FFmpeg flags directly to the encoder, which is how we support things like ProRes profile selection and HLS segment configuration.

Profiles are a GUI feature — the CLI continues to use explicit flags (`--video-codec`, `--audio-codec`, etc.) for maximum flexibility in scripts and automation.

## What's Next

We'll keep expanding the profile catalogue based on community feedback. If there's a platform or format you want a profile for, [open an issue](https://github.com/Sandeepv68/EncodeX/issues) and let us know.

---

[Download EncodeX](/download) · [See All Features](/features) · [Read the Docs](/docs/features-reference)
