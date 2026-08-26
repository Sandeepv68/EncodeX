---
title: "Architecture Overview — How EncodeX Is Built"
description: "Technical architecture of EncodeX: Electron, React, TypeScript, FFmpeg integration, three-process model, IPC channels, and design principles."
---

# Architecture

EncodeX is a cross-platform multimedia conversion tool built on FFmpeg, React, TypeScript, and Electron. It is intended for developers who want to understand how the pieces fit together before contributing.

<p align="center"><img src="/images/architecture.webp" alt="EncodeX architecture" width="1024" height="1024" loading="lazy" /></p>

## Design Principles

The renderer never spawns processes and never touches the filesystem directly. All privileged operations (file dialogs, FFmpeg execution, probing, window control) live in the main process and are reached through IPC.

- **Three-process separation** — main, preload, and renderer, following Electron's security model (`contextIsolation: true`, `nodeIntegration: false`).
- **A single abstraction over media backends** — the `ITranscoder` interface hides whether conversion is driven through `fluent-ffmpeg`, a raw FFmpeg CLI child process, or the BMF framework.
- **IPC as a typed contract** — every channel is a constant in `src/shared/ipc-channels.ts`, and the renderer only ever talks to the main process through the `window.electronAPI` bridge exposed by the preload script.
- **Shared types and constants** — `src/shared/` is imported by all three processes so interfaces stay in sync by construction.
- **Progressive enhancement of the UI** — pages are code-split with `React.lazy`, state lives in Zustand stores, and long-running jobs stream progress back over IPC events.

## Deep Dives

The full architecture is split into focused documents:

| Document | Topics |
|----------|--------|
| [Processes, Build System & Startup](/docs/architecture-processes) | Process model (main/preload/renderer/shared), build system, binary resolution, startup sequence, CLI mode, shared code layer |
| [Transcoder Abstraction & Conversion](/docs/architecture-transcoders) | `ITranscoder` interface, FfmpegCore / FFToolCore / BmfCore, shared flag building, hardware acceleration, media probing, conversion flow |
| [Renderer, State & Subsystems](/docs/architecture-renderer) | Render tree, pages, hooks, Zustand stores, batch queue, video player, timeline media, image processing, error handling, logging, i18n, theming, data flow reference |

## Additional Documentation

| Document | Topics |
|----------|--------|
| [Feature Reference](/docs/features-reference) | Features, supported media formats, codec tables, validation utilities |
| [CLI Usage](/docs/cli) | CLI usage, subcommands, all option tables |
| [IPC Channels](/docs/ipc) | IPC channels (request/send-only/events), electronAPI bridge |
| [Testing](/docs/testing) | Test suite (123 files, 1603 tests), test setup, E2E specs |
| [Project Structure](/docs/project-structure) | Full directory tree with annotations |
| [Update Manager](/docs/update-manager) | In-app update manager implementation |

## Repository

The complete source of truth lives in the repo's [`docs/` folder](https://github.com/Sandeepv68/EncodeX/tree/main/docs). For a project overview, install steps, and contributing guide, see the [README on GitHub](https://github.com/Sandeepv68/EncodeX).
