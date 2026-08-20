# 🚀 Installation

## 📌 Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [FFmpeg](https://ffmpeg.org/) — bundled via `ffmpeg-static`; falls back to system `ffmpeg` if the bundled binary is unavailable

## 📦 Install

```bash
npm install
```

This installs all dependencies including `ffmpeg-static` and `ffprobe-static`, which download platform-specific binaries during their postinstall scripts.

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

### Build Scripts

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

## 🧰 Tech Stack

| Layer      | Technology |
| ---------- | ---------- |
| Framework  | Electron v43 |
| UI         | React 19, MUI 9 |
| State      | Zustand 5 |
| Build      | Vite, TypeScript |
| Testing    | Vitest 4, Playwright |
| Media      | FFmpeg (bundled via ffmpeg-static) |
| i18n       | i18next (56 locales) |
