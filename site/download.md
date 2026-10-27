---
title: "Download EncodeX — Free FFmpeg GUI for Windows, Mac & Linux"
description: "Download EncodeX for free — a free, open-source FFmpeg GUI for Windows, macOS and Linux. Convert videos, extract audio, trim clips, and compress photos. No signup, no watermarks."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# Download EncodeX — Free & Open Source

EncodeX is **free & open source** and works on Windows, Mac, and Linux. It's an FFmpeg GUI with no accounts, no watermarks, and no file-size limits — everything runs on your computer.

::: tip First time here? Here's what happens next
Install the app, drag a video or image into the window, pick a profile (like MP4 or "smaller file"), and hit Convert — you're done. Everything runs locally on your computer.

- **New to EncodeX?** See [examples of what you can do](/use-cases) or [browse the tools](/features).
- **Stuck?** Most conversions need just one file drop + one profile click. The in-app "Getting Started" card on your Dashboard walks you through picking a goal.
:::

## Recommended Download

<LatestDownloads primary />

## <OsIcon name="windows" /> Windows

The download button above is right for almost everyone — **Windows 10/11 · 64-bit**.

**Not sure? Download x64 — Recommended for most Windows PCs.**

**To install:** open the file you downloaded and follow the steps on screen.

Not sure which one to pick? Go with the recommended one — if it doesn't match, Windows will tell you. Under **Other downloads** you'll also find a **Windows ARM64** build (Snapdragon laptops).

### Other platforms

[macOS](#mac) · [Linux](#linux)

## <OsIcon name="apple" /> Mac

The download button above shows **Apple Silicon** first on M-series Macs (M1/M2/M3/M4). Under **Other downloads**, pick the **Intel** build if your Mac is older.

**To install:** open the `.dmg` file you downloaded, then drag EncodeX into your Applications folder.

**Not sure which Mac you have?** Click the Apple logo (<OsIcon name="apple" label="Apple logo" />) in the top-left corner of your screen, choose "About This Mac", and look at the Chip line. If it says "Apple M1" (or M2/M3/M4), pick Apple Silicon. If it says "Intel", pick Intel.

::: warning First launch on Mac — one extra step
EncodeX is free and open-source, is not sold through the Mac App Store, and its macOS builds are not code-signed or notarized by Apple. macOS may show a message saying the app "can't be opened" the first time. To open it:

1. Find EncodeX in your Applications folder
2. Hold the **Control** key and click the app, then choose **Open**
3. In the box that appears, click **Open** again

On recent macOS versions this Control-click step may not be offered. If so, open **System Settings → Privacy & Security** and choose **Open Anyway** for EncodeX.

You only need to do this once — after that it opens normally.
:::

## <OsIcon name="linux" /> Linux

The download button above is right for most Linux computers — **x86_64**. Under **Other downloads** you'll also find an **ARM64** build.

**To run:** an AppImage is a single file — no installation needed. Just make it runnable and double-click it:

```bash
chmod +x EncodeX-*.AppImage
./EncodeX-*.AppImage
```

(Many desktop environments also let you skip the terminal: right-click the file → Properties → allow executing, then double-click.)

## What Your Computer Needs

Nothing special — if your computer is from the last several years, you're fine:

- **Operating system:** Windows 10+, macOS 11+, or a modern Linux
- **Disk space:** enough room for the app and your converted files
- **Memory:** any normal amount works

EncodeX bundles the FFmpeg engine, so you don't install FFmpeg or codecs separately. Every conversion happens [locally on your computer](/features#private-by-design).

## Keeping It Up to Date

When a new version comes out, EncodeX checks GitHub Releases and lets you know inside the app. You choose whether to download and install it, or install it on the next restart. Updates are not installed automatically, so there's no need to revisit this page.

## Previous Versions

Need an older release? Expand a version below to grab its files — each file lists its size and SHA-256 checksum.

<LatestDownloads older />

## Need Help?

If something isn't working or you have a question, send an email to **[developer@encodex.in](mailto:developer@encodex.in)** — you'll hear back from a real person.

## Privacy

We understand trust matters. Every conversion happens on your computer, and your files are never uploaded or stored on a server. Error reporting and usage analytics are on by default, and you can turn them off in Settings. Read the [full privacy policy](/privacy).

## Security

Each release publishes [SHA-256 checksums](/security) alongside the installers, and if you find a problem, you can report it privately. Release builds are not code-signed. See the [security page](/security) for details.

## Learn More

- [See all features](/features) — screenshots and guides for every tool
- [Read the blog](/blog/) — release announcements and tips
- [Technical documentation](/docs/architecture) — how EncodeX is built
- [Contribute](/contributing) — help improve EncodeX

## For Developers: Build It Yourself

Prefer to build from source? Clone the repo and run:

```bash
git clone https://github.com/Sandeepv68/EncodeX.git
cd EncodeX
npm install
npm run dist
```

The installer will be created in the `release/` directory.
