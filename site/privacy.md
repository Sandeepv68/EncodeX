---
title: "Privacy Policy – EncodeX Never Uploads Your Files"
description: "EncodeX privacy policy: 100% offline processing, no accounts, no tracking of your media, no data collection. Your videos and audio never leave your computer."
---

# Privacy Policy

**Short version: your files never leave your computer.**

EncodeX is a desktop application that processes all media **locally and offline**. We have no servers that receive your videos, no cloud processing, and no reason to see your files.

*Last updated: September 2026*

## The Short Version

- **100% offline** — all conversion, compression, and extraction happens on your device
- **No account** — nothing to sign up for, no profile to maintain
- **No uploads** — your media is never transmitted to us or anyone else
- **No telemetry in the app** — the app sends no analytics about your files or usage
- **Open source** — anyone can inspect exactly what the app does

## What We Don't Collect

EncodeX does not collect, transmit, or store any of your media files, folder names, or usage behavior. Because the app runs entirely on your computer, there is nothing for us to gather.

## What We Do

The only things we ever see are what you choose to send us:

- **GitHub** — when you report an issue, star the repo, or contribute, GitHub collects data per its own [privacy policy](https://docs.github.com/en/site-policy/privacy-policies)
- **Our website (encodex.in)** — a privacy-respecting, cookieless site. We use simple, privacy-friendly analytics to see aggregate page views — never tied to your identity
- **Support** — if you email us, we read the message you send (obviously)

## The Website

The EncodeX website itself:

- Does not display ads
- Uses no third-party tracking cookies
- Uses privacy-friendly analytics (no cross-site tracking, no personal data)

## What Telemetry Exists

To be completely transparent, here is every piece of data EncodeX collects — on the website and in the app:

### The website (encodex.in)

- **Cookie-less page-view counts.** We measure aggregate page views with a privacy-first analytics setup — no cookies, no cross-site tracking, no session replay, and nothing tied to your identity. We cannot see who you are.

### The desktop app

- **Consent-gated crash & diagnostics reporting.** The app can report crash diagnostics and anonymous error information to Sentry — and it is **on by default, with a visible toggle in Settings** to turn it off at any time. Everything is governed by a single consent switch (stored locally on your device as `monitoring-consent.json`).
- **Categorical-only usage events.** When enabled, the app records anonymous, categorical-only events — things like "conversion started" or "profile applied" — through the same breadcrumb channel. By taxonomy design, these payloads contain **no media content, no file names, no folder paths, and no file sizes.** If you disable telemetry, nothing leaves your computer.
- **No uploads, no cloud processing.** Even with telemetry enabled, your actual media files are never transmitted. Encoding, converting, compressing, or extracting happens entirely in-process on your device.

### In plain terms

- There is **no account** — nothing to sign up for, no profile to maintain
- Your files **never leave your computer** — no uploads, no cloud processing
- The app works **fully offline** — telemetry is the only thing that can connect out, it's consent-gated, categorical-only, and can be switched off

## How It Works

There's no cloud to send your files to. EncodeX bundles the FFmpeg engine directly into the app and runs every conversion **in-process on your device** — the same way your web browser renders a page without it being "sent to a server." If you'd like to verify that, the whole app (including its media-processing pipeline) is open source and documented in the [technical architecture](/docs/architecture).

## Updates

If we ever change how EncodeX handles data, we'll update this page and clearly note the change date above. Because the app is open source, you can also review every change in the repository.

## Questions

Concerns about privacy? Open an issue on [GitHub](https://github.com/Sandeepv68/EncodeX) or reach out through the website.

## Get Started

- [Download EncodeX for free](/download)
- [See all conversion and features](/features)
- [FFmpeg GUI overview](/ffmpeg-gui)