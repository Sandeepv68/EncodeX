---
title: "Security at EncodeX — Open Source, Checksums & Reporting"
description: "How EncodeX keeps you safe: open-source code, SHA-256 checksums published with each release, a GitHub-digest check on updates, and how to report a vulnerability. Release builds are not code-signed or notarized."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# Security at EncodeX

EncodeX is open source, so security doesn't have to be taken on faith. Every release is built from public code and publishes **SHA-256 checksums** you can compare against your download. Release builds are **not code-signed and not notarized**, so your operating system may show an "unknown developer" or "unidentified developer" warning on macOS, or a "Windows protected your PC" warning with an "Unknown publisher" message on Windows.

## What we ship you can verify

- **Open source.** The entire app, including the media-processing pipeline and the release scripts, lives in [our repository](https://github.com/Sandeepv68/EncodeX). Anyone can audit exactly what the app does.
- **SHA-256 checksums.** Each release publishes a `SHA256SUMS.txt` file alongside the binaries. Compare the downloaded file against the published hash before you install:

```bash
# Windows (PowerShell)
Get-FileHash .\EncodeX-Setup-1.0.0.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 ./EncodeX-1.0.0.dmg
```

- **Verified updates.** The updater checks GitHub Releases. When GitHub publishes a SHA-256 or SHA-512 digest for the update file, the app verifies the download against it. The updater does not verify a cryptographic signature. Updates are never installed automatically; you choose when to install.

## macOS Gatekeeper note

Because EncodeX is free and open source, is not sold through the Mac App Store, and its macOS builds are not code-signed or notarized, macOS may show a "can't be opened" message the first time. The build is the one published on the releases page. To open it, Control-click the app in Applications and choose **Open**, once. On recent macOS versions you may need to use **System Settings → Privacy & Security → Open Anyway** instead.

## Windows SmartScreen note

Because EncodeX is free and open source and its Windows builds are not code-signed, Windows SmartScreen may show a "Windows protected your PC" warning with an "Unknown publisher" message when you start the installer. The warning is expected and does not mean the download is corrupt. To continue, click **More info**, then **Run anyway**.

SmartScreen cannot establish publisher authenticity, because the build carries no code signature. What you can compare is the SHA-256 checksum published with the release, as described above.

## The bundled FFmpeg

EncodeX ships prebuilt FFmpeg and FFprobe binaries (from the `ffmpeg-static` and `ffprobe-static` packages) rather than calling a system binary. The conversions run as a child process on your device. See our [technical architecture](/docs/architecture) for how the engine is wired in.

## Reporting a vulnerability

We take security seriously and run a straightforward disclosure process:

1. **Do not** report vulnerabilities in public GitHub issues — you'd expose the flaw before we can fix it.
2. Open a **[private security advisory](https://github.com/Sandeepv68/EncodeX/security/advisories/new)** on the repository.
3. We acknowledge receipt **within 48 hours** and provide an estimated timeline for a fix. Security fixes are prioritized and released as soon as possible.

For everything else, use the [regular issue tracker](https://github.com/Sandeepv68/EncodeX/issues).

## Get Started

- [Download EncodeX for free](/download)
- [Read the privacy policy](/privacy)
- [Technical architecture & bundled FFmpeg](/docs/architecture)