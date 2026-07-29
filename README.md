# EncodeX

A cross-platform multimedia conversion tool built on FFmpeg, React, TypeScript, and Electron.

## Features

- **Media Conversion** — Convert between video/audio formats with codec, bitrate, resolution, and pixel format controls.
- **Lossless Copy** — Stream copy without re-encoding for fast operations.
- **Media Information** — Probe files and view detailed stream info (codec, resolution, frame rate, etc.).
- **Image Compression** — Compress images (JPEG, PNG, WebP, BMP) with quality and scale controls.
- **Audio Extraction** — Extract audio tracks from video files in multiple codecs.
- **Video Cutting** — Cut segments with a built-in frame-accurate video player.
- **Batch Queue** — Process multiple files with configurable transcoding operations.
- **Multiple Cores** — FFmpeg API, FFmpeg CLI, and BMF framework support.
- **CLI Mode** — Headless command-line interface for scripting.
- **i18n** — Localized UI in English, Spanish, French, and Hindi.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [FFmpeg](https://ffmpeg.org/) (bundled via `ffmpeg-static`; system install used as fallback)

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start the production build
npm start
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start renderer + main in watch mode |
| `npm run build` | Build renderer, main, and preload |
| `npm start` | Launch the compiled Electron app |
| `npm run pack` | Build + package for current platform |
| `npm run dist` | Build + create distributable |

CLI mode: `npx tsx src/main/cli.ts --help`

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── ipc/        # IPC handlers
│   ├── player/     # Frame decoder for video player
│   ├── queue/      # Batch job queue
│   └── transcoders/# FFmpeg, FFtool, BMF cores
├── preload/        # Context bridge API
├── renderer/       # React UI
│   ├── components/ # Reusable UI components
│   ├── hooks/      # Custom React hooks
│   ├── i18n/       # Locale files
│   ├── pages/      # Page components
│   └── stores/     # Zustand state stores
└── shared/         # Types, constants, errors
```

## Tech Stack

- **Frontend:** React 19, MUI v7, Zustand, react-router-dom v7, i18next
- **Backend:** Electron 33, fluent-ffmpeg, ffmpeg-static
- **Build:** Vite 6, TypeScript 5.7, electron-builder

## License

MIT
