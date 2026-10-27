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
- **Telemetry you can turn off** — error reporting and anonymous, categorical usage analytics are on by default, and one switch in Settings disables both. Update checks and configured AI providers also make network requests (see below)
- **Open source** — anyone can inspect exactly what the app does

## What We Don't Collect

EncodeX does not collect, transmit, or store any of your media files, folder names, or anything else that could identify you. Conversion runs on your computer. The app does send error reports and anonymous usage events by default, and it can also make the outbound requests listed below. You can turn error reporting and usage analytics off in Settings.

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

- **Error reporting.** The app can send crash and error diagnostics to Sentry. It is **on by default, with a toggle in Settings** to turn it off at any time. A single switch, _Usage data & error reporting_ in Settings, controls both error reporting and usage analytics. The choice is stored locally in `monitoring-consent.json` and `analytics-consent.json`.
- **Categorical-only usage analytics.** When enabled, the app records anonymous, categorical events grouped by feature area (for example navigation, conversion, queue, and updates) through a usage-analytics pipeline. By design, these payloads contain **no media content, no file names, and no folder paths.** If you turn the switch off, these events are not sent.
- **No uploads, no cloud processing.** Even with telemetry enabled, your media files are never transmitted. Conversion, compression, and extraction happen on your device.

### Other network requests

- **Update checks** — when you check for updates, the app queries GitHub Releases.
- **AI providers** — Copilot and AI features use the built-in rules router by default, which works offline. Requests go to OpenAI, Anthropic, or Gemini only if you configure one of those providers. The local provider runs on your machine.

### In plain terms

- There is **no account** — nothing to sign up for, no profile to maintain
- Your files **never leave your computer** — no uploads, no cloud processing
- Conversion works **fully offline**. Error reporting, usage analytics, update checks, and configured AI providers are the only network activity, and you control the first and last of these.

## How It Works

There's no cloud to send your files to. EncodeX bundles the FFmpeg engine with the app and runs each conversion as a **local child process on your device**, so media is read and written on your computer. If you'd like to verify that, the whole app (including its media-processing pipeline) is open source and documented in the [technical architecture](/docs/architecture).

## Updates

If we ever change how EncodeX handles data, we'll update this page and clearly note the change date above. Because the app is open source, you can also review every change in the repository.

## Questions

Concerns about privacy? Open an issue on [GitHub](https://github.com/Sandeepv68/EncodeX) or reach out through the website.

## Get Started

- [Download EncodeX for free](/download)
- [See all conversion and features](/features)
- [FFmpeg GUI overview](/ffmpeg-gui)