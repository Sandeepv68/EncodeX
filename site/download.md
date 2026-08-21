# Download EncodeX

EncodeX is **free** and works on Windows, Mac, and Linux. Pick your computer type below, download, install, and you're ready to go.

::: tip Always get the newest version
New versions are released on the [GitHub Releases page](https://github.com/Sandeepv68/EncodeX/releases). The links below always give you the latest one.
:::

## 🪟 Windows

**Just want it to work?** Click the first button — it's right for almost everyone.

| | Download | For |
|---|---------|-----|
| ✅ **Recommended** | [Download for Windows](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x64-setup.exe) | Most PCs and laptops (64-bit) |
| Older 32-bit PC | [32-bit version](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-ia32-setup.exe) | Very old computers |
| ARM laptops | [ARM version](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64-setup.exe) | Snapdragon-based Windows laptops |

**To install:** open the file you downloaded and follow the steps on screen. Works on Windows 10 and newer.

Not sure which one to pick? Go with the recommended one — if it doesn't match, Windows will tell you.

## 🍎 Mac

| | Download | For |
|---|---------|-----|
| Newer Macs (2021 or later) | [Download for Apple Silicon](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64.dmg) | M1, M2, M3, M4 chips |
| Older Macs | [Download for Intel](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x64.dmg) | Macs from before 2021 |

**To install:** open the `.dmg` file you downloaded, then drag EncodeX into your Applications folder.

**Not sure which Mac you have?** Click the Apple logo (🍎) in the top-left corner of your screen, choose "About This Mac", and look at the Chip line. If it says "Apple M1" (or M2/M3/M4), pick Apple Silicon. If it says "Intel", pick Intel.

::: warning First launch on Mac — one extra step
Because EncodeX is free and open-source (and not sold through the Mac App Store), macOS may show a message saying the app "can't be opened" the first time. This is normal and safe to get past:

1. Find EncodeX in your Applications folder
2. Hold the **Control** key and click the app, then choose **Open**
3. In the box that appears, click **Open** again

You only need to do this once — after that it opens normally.
:::

## 🐧 Linux

| | Download | For |
|---|---------|-----|
| ✅ **Recommended** | [Download AppImage](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x86_64.AppImage) | Most Linux computers (64-bit) |
| ARM64 | [ARM64 AppImage](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64.AppImage) | ARM boards and laptops |
| ARMv7 | [ARMv7 AppImage](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-armv7l.AppImage) | Older single-board computers |

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

## Keeping It Up to Date

When a new version comes out, EncodeX lets you know inside the app and can download and start the update for you — no need to revisit this page.

## For Developers: Build It Yourself

Prefer to build from source? Clone the repo and run:

```bash
git clone https://github.com/Sandeepv68/EncodeX.git
cd EncodeX
npm install
npm run dist
```

The installer will be created in the `release/` directory.
