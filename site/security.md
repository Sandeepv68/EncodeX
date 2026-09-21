---
title: "Security at EncodeX — Verifiable, Signable, Open Source"
description: "How EncodeX keeps you safe: open-source code, SHA-256 checksums for every download, code-signing on macOS and Windows, and an update pipeline you can verify. Plus how to report a vulnerability."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# Security at EncodeX

EncodeX is open source, so security doesn't have to be taken on faith — every release is built from public code, ships with **SHA-256 checksums** you can verify, and where possible is **code-signed** so your operating system can confirm it really came from us.

## What we ship you can verify

- **Open source.** The entire app — including the media-processing pipeline and the bundled FFmpeg build — lives in [our repository](https://github.com/Sandeepv68/EncodeX). Anyone can audit exactly what the app does.
- **SHA-256 checksums.** Every release publishes checksums alongside the binaries. Compare the downloaded file against the published hash before you install:

```bash
# Windows (PowerShell)
Get-FileHash .\EncodeX-Setup-1.0.0.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 ./EncodeX-1.0.0.dmg
```

- **Code signing.** Windows and macOS releases are signed, so your OS shows "verified publisher"/"Apple" instead of an "unknown developer" warning.
- **Verifiable updates.** The app only downloads updates signed by us over HTTPS. The update signature is validated locally before anything is replaced.

## macOS Gatekeeper note

Because EncodeX is free and open source (and not sold through the Mac App Store), macOS may show a "can't be opened" message the first time — this is the **Gatekeeper** check that unsigned-by-default apps face. The build is real; to open it, Control-click the app in Applications and choose **Open**, once. After that it opens normally.

## The bundled FFmpeg

EncodeX bundles its own FFmpeg build rather than calling a system binary. The exact build (version, source, and configuration) is documented in our [technical architecture](/docs/architecture) and reproduced from source in CI — so conversions behave identically everywhere, and the binary you run is the binary we built.

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