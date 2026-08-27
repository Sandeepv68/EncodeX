<div align="center">
  <img src="assets/banner.png" alt="EncodeX Logo" width="900" />
  <h3>A cross-platform multimedia conversion tool built on FFmpeg, React, TypeScript, and Electron.</h3>
</div>

<div align="center">

[![Ask DeepWiki](https://img.shields.io/badge/Ask_DeepWiki-10B981?style=for-the-badge)](https://deepwiki.com/Sandeepv68/EncodeX)
![CI](https://img.shields.io/github/actions/workflow/status/Sandeepv68/EncodeX/ci.yml?style=for-the-badge)
![License](https://img.shields.io/github/license/Sandeepv68/EncodeX?style=for-the-badge)
![Release](https://img.shields.io/github/v/release/Sandeepv68/EncodeX?style=for-the-badge)
![Downloads](https://img.shields.io/github/downloads/Sandeepv68/EncodeX/total?style=for-the-badge&logo=github&logoColor=white)
![Stars](https://img.shields.io/github/stars/Sandeepv68/EncodeX?style=for-the-badge)
![Forks](https://img.shields.io/github/forks/Sandeepv68/EncodeX?style=for-the-badge)
![Watchers](https://img.shields.io/github/watchers/Sandeepv68/EncodeX?style=for-the-badge)
![Issues](https://img.shields.io/github/issues/Sandeepv68/EncodeX?style=for-the-badge)
![Pull Requests](https://img.shields.io/github/issues-pr/Sandeepv68/EncodeX?style=for-the-badge)
![Last Commit](https://img.shields.io/github/last-commit/Sandeepv68/EncodeX?style=for-the-badge)
![Contributors](https://img.shields.io/github/contributors/Sandeepv68/EncodeX?style=for-the-badge)
![Repo Size](https://img.shields.io/github/repo-size/Sandeepv68/EncodeX?style=for-the-badge)
![Languages](https://img.shields.io/github/languages/count/Sandeepv68/EncodeX?style=for-the-badge)
![Top Language](https://img.shields.io/github/languages/top/Sandeepv68/EncodeX?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![MUI](https://img.shields.io/badge/MUI-007FFF?style=for-the-badge&logo=mui&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js%2022-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)

</div>

<div align="center">

[English](./README.md) | [Deutsch](./docs/de/README.md) | [Español](./docs/es/README.md) | [Français](./docs/fr/README.md) | [हिन्दी](./docs/hi/README.md) | [Português](./docs/pt/README.md) | [简体中文](./docs/zh/README.md)

</div>

## 👋 Introduction

EncodeX is a cross-platform multimedia conversion tool that brings the power of FFmpeg to a modern, intuitive desktop interface. Built with Electron, React, and TypeScript, it lets you convert media between formats, extract audio, cut videos, and compress images — all through a clean, responsive UI with a batch queue, hardware acceleration, CLI mode, and full internationalization.

## ✨ Features

- **🔄 Media Conversion** — 51 video codecs, 27 audio codecs, 56 pixel formats with codec/bitrate/scale/quality controls
- **⚡ Hardware Acceleration** — NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox, Media Foundation
- **✂️ Video Cutting** — Frame-accurate trimming with a built-in player (rawvideo + PCM pipes, Canvas + Web Audio) and zoomable timeline (waveform + thumbnail montage)
- **📋 Batch Queue** — Parallel processing (up to 4 concurrent jobs) with real-time progress, per-job errors, pause/resume, drag-and-drop reordering, job option editing, status filters, JSON export/import, and when-done power actions (shutdown/sleep/hibernate)
- **🖼️ Image Compression** — JPEG/PNG/WebP/BMP/GIF/TIFF with quality/scale, EXIF viewer, RGB/luma histograms
- **🎵 Audio Extraction** — Any of 27 audio codecs from any video file
- **ℹ️ Media Info** — Full per-stream probe: codec, profile, resolution, color metadata, frame rate, etc.
- **⌨️ CLI Mode** — Headless scripting with subcommands (`convert`, `info`, `capabilities`, `compress`, `extract-audio`, `batch`)
- **⚙️ 3 Transcoder Cores** — FFmpeg API (fluent-ffmpeg), FFmpeg CLI (child_process), BMF Framework
- **🌍 56 Locales** — 35 languages with RTL support (Arabic, Hebrew)
- **⌨️ Keyboard Shortcuts** — 60+ shortcuts across every page with an in-app help dialog (`Ctrl+/`)
- **🔔 Activity Blips** — Live nav indicators with hover popovers showing per-job progress at a glance
- **🛡️ Close Confirmation** — Warns before closing the window while jobs are still running
- **🎉 Easter Eggs** — Holiday-themed app logos on special dates
- **🔄 In-App Updates** — Checks GitHub Releases, downloads platform installer, real-time progress
- **🛡️ Error Handling** — 16 typed error codes, global snackbar, inline banners, React error boundaries
- **🌗 Dark/Light Theme** — System-aware with manual toggle, persistent preferences

See [docs/FEATURES.md](docs/FEATURES.md) for the full feature breakdown, supported formats, and codec lists.

## 📸 Screenshots

<div align="center">
  <img src="site/public/images/home_dashboard.webp" alt="Home Dashboard" width="800" />
  <p><strong>🏠 Home Dashboard</strong></p>
</div>

<table>
  <tr>
    <td align="center" width="50%">
      <img src="site/public/images/convert.webp" alt="Media Conversion" /><br />
      <strong>🔄 Media Conversion</strong>
    </td>
    <td align="center" width="50%">
      <img src="site/public/images/extract_audio.webp" alt="Audio Extraction" /><br />
      <strong>🎵 Audio Extraction</strong>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="site/public/images/cut_video.webp" alt="Video Cutting" /><br />
      <strong>✂️ Video Cutting</strong>
    </td>
    <td align="center">
      <img src="site/public/images/image_compress.webp" alt="Image Compression" /><br />
      <strong>🖼️ Image Compression</strong>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="site/public/images/batch_process.webp" alt="Batch Queue" /><br />
      <strong>📋 Batch Queue</strong>
    </td>
    <td align="center">
      <img src="site/public/images/media_info.webp" alt="Media Info" /><br />
      <strong>ℹ️ Media Info</strong>
    </td>
  </tr>
</table>

## 📌 Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [FFmpeg](https://ffmpeg.org/) — bundled via `ffmpeg-static`; falls back to system `ffmpeg` if the bundled binary is unavailable

## 📥 Downloads

Pre-built installers are available on the [Releases](https://github.com/Sandeepv68/EncodeX/releases) page.

### macOS

> EncodeX is not code-signed (no Apple Developer account). macOS Gatekeeper will block the app on first open.

**Option 1 — Right-click to open:**

1. Right-click (or Control-click) the EncodeX app and select **Open**
2. Click **Open** in the confirmation dialog

**Option 2 — Remove quarantine via Terminal:**

```bash
xattr -cr /Applications/EncodeX.app
```

### Windows / Linux

Download the `.exe` (Windows) or `.AppImage` (Linux) installer from the [Releases](https://github.com/Sandeepv68/EncodeX/releases) page and run it.

## 🚀 Install (from source)

```bash
npm install
```

## 🧑‍💻 Development

```bash
# Start Vite dev server + tsc watch (no Electron window)
npm run dev

# Full dev environment with Electron window
npm run electron:dev

# Quick start (build then launch)
npm run dev:start
```

`npm run dev` starts two processes concurrently:

1. **Vite** — serves the React renderer on `http://localhost:5173` with HMR
2. **tsc** — watches and compiles the main process TypeScript to `dist/main/`

`npm run electron:dev` waits for Vite to be ready, compiles both main and preload, then launches Electron with the `--dev` flag pointing at the Vite dev server URL. DevTools open automatically.

## 🔨 Build

```bash
# Production build (renderer + main + preload)
npm run build

# Package for current platform (no installer)
npm run pack

# Create distributable installer
npm run dist
```

| Script                   | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| `npm run dev:renderer`   | Vite dev server only                                        |
| `npm run dev:main`       | `tsc -p tsconfig.main.json --watch`                         |
| `npm run build:renderer` | Vite production build — outputs to `dist/renderer/`         |
| `npm run build:main`     | `tsc -p tsconfig.main.json` — outputs to `dist/main/`       |
| `npm run build:preload`  | `tsc -p tsconfig.preload.json` — outputs to `dist/preload/` |
| `npm run build`          | All three in sequence                                       |
| `npm run start`          | Launch compiled app from `dist/` via `electron .`           |
| `npm run electron:dev`   | Vite + Electron dev environment                             |
| `npm run dev:start`      | Build then launch                                           |
| `npm run format`         | `prettier --write` on all `src` TypeScript/JSON             |
| `npm run format:check`   | `prettier --check` on all `src` TypeScript/JSON             |
| `npm run pack`           | Build + electron-builder `--dir`                            |
| `npm run dist`           | Build + electron-builder (NSIS/DMG/AppImage)                |

## 💻 CLI Usage

Build first, then invoke via `encodex`:

```bash
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac
encodex info input.mp4 --json
encodex compress photo.png -f jpg -q 30
encodex extract-audio input.mp4
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted
```

See [docs/CLI.md](docs/CLI.md) for all subcommands, options, and examples.

## 🧪 Testing

```bash
npm test           # Run all 123 test files / 1603 tests
npm run test:watch
npm run test:coverage
npm run test:unit
npm run test:integration
npm run test:e2e   # Requires build
```

See [docs/TESTING.md](docs/TESTING.md) for the full test suite breakdown, test setup, and E2E specs.

## 📚 Documentation

| Document | Description |
| -------- | ----------- |
| [docs/FEATURES.md](docs/FEATURES.md) | Features, supported media formats, codec tables, validation utilities |
| [docs/CLI.md](docs/CLI.md) | CLI usage, subcommands, all option tables, exit codes |
| [docs/TESTING.md](docs/TESTING.md) | Test suite, test setup, E2E specs |
| [docs/IPC.md](docs/IPC.md) | IPC channels, electronAPI bridge, all methods and events |
| [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) | Full directory tree with annotations |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Internal architecture overview and links to deep dives |
| [docs/ARCHITECTURE_PROCESSES.md](docs/ARCHITECTURE_PROCESSES.md) | Process model, build system, startup sequence, CLI mode |
| [docs/ARCHITECTURE_TRANSCODERS.md](docs/ARCHITECTURE_TRANSCODERS.md) | Transcoder abstraction, FFmpeg/BMF cores, hardware acceleration |
| [docs/ARCHITECTURE_RENDERER.md](docs/ARCHITECTURE_RENDERER.md) | Render tree, pages, stores, queue, player, i18n, theming |
| [docs/UPDATE_MANAGER.md](docs/UPDATE_MANAGER.md) | In-app update manager implementation details |
| [Wiki](https://github.com/Sandeepv68/EncodeX/wiki) | Community wiki (mirrors the docs in a browsable form) |
| [Documentation Site](https://encodex.in/) | VitePress site with features tour, guides, and release blog |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Code of conduct |

## 🧰 Tech Stack

<p align="center"><img src="assets/stack.png" alt="EncodeX tech stack"></p>

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. All contributions are welcome — please open an issue first for significant changes.

This project is governed by a [Code of Conduct](CODE_OF_CONDUCT.md).

## 🔒 Security

Report security vulnerabilities to the project maintainers via the security advisory process. See [SECURITY.md](SECURITY.md).

## 📄 License

MIT
