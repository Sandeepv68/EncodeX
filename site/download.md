---
title: "Download EncodeX — Free FFmpeg GUI for Windows, Mac & Linux"
description: "Download EncodeX for free — a free, open-source FFmpeg GUI for Windows, macOS and Linux. Convert videos, extract audio, trim clips, and compress photos. No signup, no watermarks."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# Download EncodeX

EncodeX is **free** and works on Windows, Mac, and Linux. It's an open-source FFmpeg GUI with no accounts, no watermarks, and no file-size limits — everything runs on your computer.

::: tip First time here? Here's what happens next
Install the app, drag a video or image into the window, pick a profile (like MP4 or "smaller file"), and hit Convert — you're done. Everything runs locally on your computer.

- **New to EncodeX?** See [examples of what you can do](/use-cases) or [browse the tools](/features).
- **Stuck?** Most conversions need just one file drop + one profile click. The in-app "Getting Started" card on your Dashboard walks you through picking a goal.
:::

## Recommended Download

<LatestDownloads primary />

## <OsIcon name="windows" /> Windows

The download button above is right for almost everyone — **Windows 10/11 · 64-bit**.

**To install:** open the file you downloaded and follow the steps on screen.

Not sure which one to pick? Go with the recommended one — if it doesn't match, Windows will tell you. Under **Other downloads** you'll also find an **Windows ARM64** build (Snapdragon laptops) and a 32-bit build (very old computers).

### Other platforms

[macOS](#mac) · [Linux](#linux)

## <OsIcon name="apple" /> Mac

The download button above shows **Apple Silicon** first on M-series Macs (M1/M2/M3/M4). Under **Other downloads**, pick the **Intel** build if your Mac is older.

**To install:** open the `.dmg` file you downloaded, then drag EncodeX into your Applications folder.

**Not sure which Mac you have?** Click the Apple logo (<OsIcon name="apple" label="Apple logo" />) in the top-left corner of your screen, choose "About This Mac", and look at the Chip line. If it says "Apple M1" (or M2/M3/M4), pick Apple Silicon. If it says "Intel", pick Intel.

::: warning First launch on Mac — one extra step
Because EncodeX is free and open-source (and not sold through the Mac App Store), macOS may show a message saying the app "can't be opened" the first time. This is normal and safe to get past:

1. Find EncodeX in your Applications folder
2. Hold the **Control** key and click the app, then choose **Open**
3. In the box that appears, click **Open** again

You only need to do this once — after that it opens normally.
:::

## <OsIcon name="linux" /> Linux

The download button above is right for most Linux computers — **x86_64**. Under **Other downloads** you'll also find **ARM64** and **ARMv7** builds.

**To run:** an AppImage is a single file — no installation needed. Just make it runnable and double-click it:

```bash
chmod +x EncodeX-*.AppImage
./EncodeX-*.AppImage
```

(Many desktop environments also let you skip the terminal: right-click the file → Properties → allow executing, then double-click.)

## What Your Computer Needs

Nothing special — if your computer is from the last several years, you're fine:

- **Operating system:** Windows 10+, macOS 11+, or a modern Linux
- **Disk space:** about 400 MB (the app includes everything it needs — no extra downloads)
- **Memory:** any normal amount works

> **Why is EncodeX about 400 MB?**
> EncodeX bundles the FFmpeg engine and every supported component, so you never install FFmpeg, codecs, or anything else separately — and you never download extras later. Nothing is uploaded and nothing runs in the cloud — every conversion happens [locally on your computer](/features#private-by-design).

## Keeping It Up to Date

When a new version comes out, EncodeX lets you know inside the app and can download and start the update for you — no need to revisit this page.

## Previous Versions

Need an older release? Expand a version below to grab its files — each file lists its size and SHA-256 checksum.

<LatestDownloads older />

## Need Help?

If something isn't working or you have a question, send an email to **[developer@encodex.in](mailto:developer@encodex.in)** — you'll hear back from a real person.

## Privacy

We understand trust matters. Every conversion happens on your computer — your files are never uploaded, tracked, or stored on a server. Read the [full privacy policy](/privacy).

## Security

Every release ships with verifiable [SHA-256 checksums and signed builds](/security) — and if you find a problem, you can report it privately. See the [security page](/security) for details.

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
