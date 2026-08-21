# Download EncodeX

Download the latest version of EncodeX for your platform. All builds are generated from the [GitHub Releases](https://github.com/Sandeepv68/EncodeX/releases) page.

::: tip Latest Version
Check the [Releases page](https://github.com/Sandeepv68/EncodeX/releases) for the most recent download.
:::

## Windows

| File | Architecture | Size |
|------|-------------|------|
| [EncodeX-Setup-x64.exe](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x64-setup.exe) | 64-bit | ~343 MB |
| [EncodeX-Setup-ia32.exe](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-ia32-setup.exe) | 32-bit | ~333 MB |
| [EncodeX-Setup-arm64.exe](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64-setup.exe) | ARM64 | ~381 MB |

**Requirements:** Windows 10 or later

Run the installer and follow the on-screen instructions.

## macOS

| File | Architecture | Size |
|------|-------------|------|
| [EncodeX-x64.dmg](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x64.dmg) | Intel | ~411 MB |
| [EncodeX-arm64.dmg](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64.dmg) | Apple Silicon | ~388 MB |

**Requirements:** macOS 11 or later

::: warning macOS Gatekeeper Warning
EncodeX is not code-signed. macOS will show a "damaged" or "can't be opened" error on first launch. To fix this:

**Option 1 — Right-click to open:**
1. Right-click (or Control-click) the EncodeX app and select **Open**
2. Click **Open** in the confirmation dialog

**Option 2 — Remove quarantine via Terminal:**
```bash
xattr -cr /Applications/EncodeX.app
```
:::

## Linux

| File | Architecture | Size |
|------|-------------|------|
| [EncodeX-x86_64.AppImage](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x86_64.AppImage) | x64 | ~307 MB |
| [EncodeX-arm64.AppImage](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64.AppImage) | ARM64 | ~327 MB |
| [EncodeX-armv7l.AppImage](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-armv7l.AppImage) | ARMv7 | ~311 MB |

**Requirements:** A modern Linux distribution with FUSE support

```bash
# Make the AppImage executable
chmod +x EncodeX-*.AppImage

# Run the app
./EncodeX-*.AppImage
```

## Build from Source

If you prefer to build from source:

```bash
git clone https://github.com/Sandeepv68/EncodeX.git
cd EncodeX
npm install
npm run dist
```

The installer will be created in the `release/` directory.

## System Requirements

| Requirement | Minimum |
|-------------|---------|
| OS | Windows 10+, macOS 11+, or modern Linux |
| Disk Space | ~400 MB (includes bundled FFmpeg) |
| RAM | 512 MB recommended |
