# EncodeX Web Edition — Technical Plan

Status: Draft v1
Owner: @Sandeepv68
Scope: End-to-end feature parity across three runtimes (Desktop / Web PWA / Self-hosted Server)

---

## 1. Goals

Deliver EncodeX as three runtimes from one codebase, with end-to-end feature parity:

| Runtime | Engine | Install friction | Files |
| --- | --- | --- | --- |
| **Desktop** (existing) | Native FFmpeg + hwaccel | Installer | Local disk |
| **Web PWA** (new) | ffmpeg.wasm (multithreaded) | None — URL | Never leave device |
| **Self-hosted Server** (new) | Host FFmpeg + hwaccel, Docker | One container on user's own hardware | User's machine/NAS |

Non-goals:

- Hosted SaaS / accounts / cloud storage
- Mobile native apps (PWA covers mobile/tablet)
- Changing the desktop app's behavior

### Decisions locked in

- **Multithreaded WASM required** (COOP/COEP headers). Feature-detect SharedArrayBuffer; block screen (not silent failure) when unavailable.
- **Hosting:** Cloudflare Pages (free tier sends COOP/COEP headers). GitHub Pages cannot send custom headers, so it cannot host the multithreaded build.
- **Server mode included** in this plan (M5), started after the PWA ships.

---

## 2. Architecture

```
+--------------------- Renderer (shared, unchanged React UI) ---------------------+
|  pages / components / stores / i18n     consume: typed bridge (ElectronAPI)     |
+--------+---------------------------+----------------------------+---------------+
         |                           |                            |
   DesktopBridge               WebBridge (wasm)              RemoteBridge (REST+WS)
         |                           |                            |
   Electron IPC                ffmpeg.wasm engine             Fastify API server
         |                           |                            |
  src/main (existing)         IndexedDB FS, canvas,         src/server wrapping existing
  (transcoders, queue)        WebAudio                      pure-Node transcoder/queue layers
```

Core feasibility insight: the renderer never imports Electron directly. All 67 channels flow
through one typed surface (`src/renderer/electron-api.d.ts`, ~68 methods, 12 event
subscriptions, channels defined in `src/shared/ipc-channels.ts`). We add two more
implementations of that same contract; we do not fork the UI.

### 2.1 The path problem (deepest change)

Everything today assumes absolute path strings (`CONVERT_FILE`, queue persistence,
drag-drop via `webUtils.getPathForFile`). Browsers have no paths.

**Decision: introduce a `MediaFileHandle` value object** consumed by all pages/components:

```ts
interface MediaFileHandle {
  id: string;      // opaque registry key
  name: string;    // display name
  size: number;
  kind: 'video' | 'audio' | 'image';
  // runtime-private accessors, never serialized into persisted job payloads
}
```

- **Desktop:** handle wraps an absolute path; bridge resolves back to paths internally
  (existing behavior preserved).
- **Web:** handle wraps a `File` + objectURL; staged into IndexedDB virtual FS when a job runs.
- **Server:** handle references an uploaded server-side temp file ID.

Mechanical refactor across selection points (`utils/fileDialog.ts`,
`components/FileDropZone.tsx`) and job payloads (`queue-transfer.ts`). This is what makes all
three runtimes share one UI.

### 2.2 Repository layout

```
src/
  renderer/      # unchanged role; platform-aware branches only where noted
  main/ preload/ # untouched (desktop)
  shared/        # grows: MediaFileHandle, platform constants, capability flags,
                 # extracted arg-builder input/output mapping
  web/
    bridge/      # WebBridge implementing the electronAPI contract
    engine/      # ffmpeg.wasm lifecycle, arg mapping, progress parsing
    fs/          # IndexedDB staging, quota management, cleanup
    entry.tsx    # alternate bootstrap (no preload, registers service worker)
  server/
    api/         # Fastify routes mirroring invoke channels
    ws/          # event push mirroring on* subscriptions
    host.ts      # boots existing src/main/transcoders + queue headlessly
```

New Vite configs: `vite.config.web.ts` (PWA, COOP/COEP headers, web entry) alongside the
untouched desktop config. New tsconfig projects for `web` and `server`; extend the root
`typecheck` script.

### 2.3 Bridge contract changes (minimal, additive)

Keep every existing method signature working. Additions only:

- `getPlatformInfo(): { platform: 'desktop' | 'web' | 'remote', ... }`
- Selection methods gain overloads accepting/returning `MediaFileHandle`
- Events keep identical names/payload shapes (queue events become local emitters in web,
  WS-forwarded in remote)

---

## 3. Workstreams & Milestones

### M1 — Platform foundation (~1 week)

1. Add `platformStore` (zustand): detect runtime once, expose `isDesktop/isWeb/isRemote`.
2. Guard the known crashers:
   - `hooks/useCapabilities.ts:45` — unguarded `getCapabilities()` throws in browser;
     return static codec lists on web until engine ready.
   - `components/FileDropZone.tsx:72` — unguarded `getPathForFile(file)` on drop; branch:
     keep the `File` object in web mode.
3. TitleBar window buttons hidden when `!isDesktop`.
4. Settings page: hide power-actions, always-on-top, launch-at-login, updater sections per flag.
5. Acceptance: `npm run dev` renders all routes in plain Chrome without errors;
   `/convert` no longer crashes via ErrorBoundary.

### M2 — Web engine core (~2 weeks)

1. `web/engine/`: lazy-load `@ffmpeg/ffmpeg` 0.12.x **multithreaded** core (~31MB, fetched
   once, service-worker-cached); single-flight loading promise; terminate/restart on failure.
2. Port arg building: extract `buildFfmpegArgs` input/output mapping into `shared/` (pure TS)
   so desktop CLI-core and web share one mapper; web writes inputs to wasm FS from IndexedDB blobs.
3. Progress: parse `-progress pipe:1` output (same stats desktop computes in
   `ffmpeg-core.ts:254-291`) -> feed identical `ConversionProgress` events into stores.
4. Cancel/pause/resume: `terminate()` for cancel; OS-level suspend does not exist in wasm —
   v1 ships cancel-only; resume-from-scratch documented honestly in UI copy.
5. Concurrency: hard cap 2 jobs (WASM memory), configurable 1-4 with warning copy.
6. Output: `showSaveFilePicker()` where available (Chromium/Android), else blob download;
   optional "auto-download when done" setting.
7. Quota guard: pre-flight `navigator.storage.estimate()` check with clear error if insufficient.
8. Acceptance: 100MB mp4 -> x264/webm conversions succeed in Chrome + Firefox; cancel works
   mid-job; progress % matches desktop semantics.

### M3 — Feature parity, local (~4 weeks)

Ordered by dependency risk (player last):

| Feature | Implementation | Notes |
| --- | --- | --- |
| Convert | M2 engine | Done in M2 |
| Audio Extract | Same pipeline, audio args | Trivial after M2 |
| Image Compress | Canvas `toBlob('image/webp'\|'jpeg'\|'png', q)` primary — instant, zero-wasm; wasm fallback for BMP/TIFF/GIF and scale-with-ratio edge cases | EXIF via existing `exifr` dep moved into renderer bundle (already browser-compatible) |
| Media Info | wasm `ffmpeg -i` stderr parsing through shared parser extracted from `ffprobe-mapper.ts` | Reuse stream-model types |
| Batch Queue | Renderer-owned queue (zustand + IndexedDB persistence replacing main-process JSON). Job CRUD, reorder, filters, JSON import/export all client-side. Power actions hidden. | Biggest state refactor; extract reducer/actions into `shared/` so main-owned and renderer-owned queues share logic; keep event names identical |
| Video Cut | See 3.1 below | Long pole |

#### 3.1 Player & cutting rework (the long pole)

- Implement MediaPlayer's exact external contract (`filePath->handle`,
  `onTimeUpdate/onDurationChange/onMediaInfo`, imperative `seekTo`) over HTML5 `<video>`:
  canvas-free playback, `currentTime` seeking replaces frame-ring-buffer machinery.
- Waveform: `decodeAudioData` (WebAudio) -> downsample to peaks array -> existing timeline
  rendering consumes peaks (replaces `extractWaveform` IPC).
- Thumbnails: offscreen `<video>` seek-and-capture loop -> sprite grid data URL matching
  current `extractThumbnails` shape (cache key stays `handle::duration`).
- Trim exec: `-ss/-to` + `-c copy` fast path; re-encode fallback when keyframe-inaccurate
  copy detected.
- Frame-accuracy caveat documented in-app: copy-mode cuts snap to keyframes; encode-mode is
  frame-accurate.
- Desktop keeps its existing IPC player untouched behind `platformStore` branch until parity
  is validated.
- Acceptance: cut a 10-min 1080p file in both modes; waveform/timeline visually match desktop.

### M4 — Mobile UX + PWA shell (~1-2 weeks)

1. Bottom navigation below `md` breakpoint at the existing branch (`App.tsx:100`); top 5 tools
   + "More" sheet; activity blips ported onto bottom-nav badges.
2. Touch audit: hit targets >= 44px on FileDropZone, queue cards, timeline scrubber
   (larger touch track for `VideoTimeline`).
3. `vite-plugin-pwa`: manifest (standalone, theme icons from existing assets), app-shell
   precache, runtime cache excluding media; install-prompt UI component.
4. Android Share Target (`share_target` manifest): receive video/audio/image shares straight
   into Convert.
5. CSP rewrite (`src/renderer/index.html:6`): allow `worker-src blob:`,
   `wasm-unsafe-eval`, connect-src for Sentry; COOP/COEP headers via plugin + host config;
   document Netlify/Vercel/Cloudflare header setups.
6. iOS guidance screen: detect non-isolated context / Safari limits -> explain ~100-150MB
   practical ceiling before enqueue, suggest smaller files.
7. i18n: new strings added to all 35 locales; gate via existing `validate-locales` script.
8. Monitoring: `@sentry/react` init behind the same consent gate as desktop.
9. Acceptance: Lighthouse PWA pass + >= 90 perf on mid-tier Android profile;
   install-to-homescreen E2E on Android Chrome.

### M5 — Self-hosted server (~3-4 weeks)

1. `server/host.ts`: boot existing `FfmpegCore/FFToolCore` factory + `job-queue.ts`
   headlessly (verified zero Electron deps; strip `app.getPath` shims behind a
   `PathProvider` interface defaulting to `os.tmpdir()` / XDG dirs).
2. REST API mirroring the 47 handlers:
   - `POST /files` — streaming multipart upload to temp dir
   - `POST /jobs`, `GET /jobs/:id`, `POST /jobs/:id/{pause,resume,cancel}`
   - `GET /probe/:fileId`
   - `GET /download/:jobId` — streamed response
   - thumbnails/waveform endpoints reusing existing extraction modules
3. WebSocket push of the 12 event families with identical payload schemas.
4. **RemoteBridge** in renderer: fetch + WS implementing the same contract; file selection
   uploads with progress; player streams via HTTP Range requests (HTML5 `<video>` handles it)
   — same component as M3.
5. Auth: bearer token generated at first boot, printed in terminal + QR code; LAN-first
   posture; reverse-proxy TLS docs for exposure beyond LAN.
6. Docker: multi-stage image bundling system ffmpeg; NVENC-capable base variant;
   docker-compose example; port/config env vars.
7. Discovery nicety: server prints QR code -> scan from phone -> full-power EncodeX in the
   mobile browser.
8. Acceptance: phone on LAN converts a 4GB file with hwaccel, progress streams live,
   download completes; container runs on NAS-style hosts with limited privileges.

### M6 — Hardening & release (~1 week)

- Test matrix: unit (shared arg mapper under jsdom), integration (engine against
  `perf/fixtures` corpus), Playwright web-e2e alongside existing Electron e2e (extend the
  mock-bridge pattern to a wasm mock), server contract tests.
- Perf budgets:
  - TTI < 3s on mid-range Android
  - engine load lazy; nothing > 1MB blocks navigation
  - conversion overhead <= 2.5x native software-encode baseline (measured against existing
    `perf/conversion-benchmark.perf.test.ts` fixtures)
- Docs: deployment guide, self-host quickstart, browser support matrix; `site/` gets a
  "Try in browser" CTA linking the PWA.
- Release: separate deploy workflow (Cloudflare Pages), versioned container tags, changelog.

---

## 4. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| iOS Safari memory caps kill large files | Pre-flight size warnings; explicit limits surfaced before enqueue, not after OOM |
| COEP breaks third-party assets | All fonts/icons already bundled (@fontsource, fontawesome) — verified; Sentry loader configured CORP-safe |
| SharedArrayBuffer unavailable (older browsers) | Feature-detect -> informative block screen naming minimum versions, not silent failure |
| Player rework regresses frame-accuracy UX | Old IPC player untouched for desktop; new player ships behind `platformStore` branch until parity validated |
| Queue state fork (main-owned vs renderer-owned) | Extract queue reducer/actions into `shared/` used by both owners; identical event contracts |
| Scope creep across 3 runtimes | Parity matrix reviewed per PR; server mode (M5) starts only after M4 ships |

---

## 5. Sequence & Sizing

Recommended order:

**M1 -> M2 -> M4-lite (nav/PWA shell early for dogfooding) -> M3 (image/info -> batch ->
player) -> M4-full -> M5 -> M6**

Roughly 11-14 weeks solo. M5 can start in parallel with late M3 if a second contributor joins.

---

## 6. Open Questions

- [ ] Confirm Cloudflare Pages as hosting target (or prefer Netlify/Vercel).
- [ ] Custom domain for the PWA (e.g., `app.encodex.in`)?
- [ ] Minimum browser support line (proposal: last 2 versions of Chrome/Edge/Firefox/Safari,
      Safari iOS 16.4+)?
