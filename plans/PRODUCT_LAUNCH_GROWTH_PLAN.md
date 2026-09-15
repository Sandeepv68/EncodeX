# Plan: EncodeX Product Launch & Growth

## Goal

Treat EncodeX as a **real product launch**, not just an open-source GitHub project. The
technical foundation is strong; the growth bottleneck is **discoverability, differentiation,
and conversion**. This plan turns the ChatGPT product/marketing analysis into concrete,
trackable work items against the actual repo (VitePress site in `site/`, app in `src/`,
docs in `site/docs/` and `docs/`).

**Core positioning statement (adopt everywhere):**

> **EncodeX — a free, open-source FFmpeg GUI for Windows, macOS and Linux.**
> *FFmpeg power. Without the command line.*

Secondary identity:

> **Simple enough for everyday users. Powerful enough for developers.**

## Status Legend

- `[ ]` Not started
- `[/]` In progress
- `[x]` Done
- `(manual)` Requires external action (GSC, Lighthouse, App Store, etc.)

## Progress Tracker (high-level)

| # | Deliverable | Status |
|---|-------------|--------|
| 0 | Positioning audit — align homepage, README, meta titles with new claim | [x] |
| 1 | Homepage "5-second sell" redesign | [x] |
| 2 | Download page single-decision CTA | [x] |
| 3 | GitHub README rewrite (marketing-first) | [x] |
| 4 | SEO hierarchy expansion (convert/codecs/compress/extract/platform) | [x] |
| 5 | Comparison page (EncodeX vs HandBrake vs Shutter Encoder vs FFmpeg) | [x] |
| 6 | Privacy + privacy-first landing page | [x] |
| 7 | Hardware acceleration re-messaging (GPU, not acronyms) | [x] |
| 8 | CLI as a developer feature (site + README) | [x] |
| 9 | Installer size reduction (378 MB → target) | [ ] |
| 10 | Anonymous, privacy-respecting usage analytics (app) | [x] |
| 11 | gtag analytics audit (site): custom dimensions, events, GSC | [ ] |
| 12 | Use-cases strategy (creators/devs/archivists/gamers/photographers) | [x] |
| 13 | Community & distribution (Discussions, Product Hunt, Reddit, HN, YouTube) | [ ] |

---

## Background / Current State

Confirmed in the repo:

- **Site:** VitePress (`site/`), English root + 7 locales (es, fr, de, pt, zh, hi), configured
  in `site/.vitepress/config.mts`. Routes regenerate via `npm run docs:build`.
- **Live SEO pages (EN):** `ffmpeg-gui`, `video-converter`, `video-compressor`,
  `audio-converter`, `extract-audio-from-video`, `ffmpeg-gui/{windows,macos,linux}`,
  `convert/{mkv,mov,avi,flv,wmv,m4v,webm}-to-mp4`, `codecs/{h264,h265,av1}`,
  `learn/what-is-ffmpeg`. All with Breadcrumb+FAQ JSON-LD, hreflang, canonical, og/twitter.
- **Homepage** (`site/index.md`): strong plain-language copy, "Sound Familiar" pain cards,
  features, "Why People Love EncodeX", personas, "Popular Tools & Guides", final CTA.
- **Download page** (`site/download.md`): `<LatestDownloads />` component surfaces all
  architectures per OS (decision load), has macOS Gatekeeper warning, build-from-source.
- **README.md:** feature-first with screenshots table, 20+ badges, links to `docs/*`.
- **App:** Electron + React + TS. 51 video codecs, 27 audio codecs, 140+ profiles, batch
  queue, trimming, image compression, 3 transcoder cores, CLI (`bin/encodex.js`),
  hardware acceleration (NVENC/QSV/AMF/VAAPI/VideoToolbox/MediaFoundation), in-app updater.
- **Analytics (site):** Global Site Tag (GA4 `G-SM28DL4DYR`) in `config.mts` `head`.
- **App analytics:** `@sentry/electron` wired at build time (`scripts/generate-sentry-config.mjs`).
  Product/usage events implemented as consent-gated Sentry breadcrumbs (category `analytics`):
  `src/shared/analytics/events.ts` + `AnalyticsService.ts`, wired in `main/index.ts` and
  `queue/job-queue.ts`. See `plans/SENTRY_MONITORING_PLAN.md`.
- **Prior SEO work:** `plans/SEO_KEYWORD_OPTIMIZATION_PLAN.md` — 15 core pages × 8 locales done;
  4 long-tail convert pages + extract-audio page + FAQ schema + blog posts done and pushed.
- **Installer size:** unreleased/unverified locally — ChatGPT reported ~378 MB Windows x64
  NSIS. Must be measured from a real `npm run dist` artifact before optimizing.

---

## Phase 1 — Conversion & Messaging (highest ROI, do first)

### Checkpoint 0 — Positioning audit

- [x] Write the one-line claim and store it: `FFmpeg power. Without the command line.`
- [x] Audit every page title/description in `config.mts` (`transformHead` fallbacks + per-page
      frontmatter) so the site consistently leads with "FFmpeg GUI for Windows, macOS, Linux",
      NOT "cross-platform conversion tool built on Electron/React/TypeScript".
- [x] Update `site/.vitepress/config.mts` site `description` to the product claim, keep
      `SoftwareApplication` JSON-LD in sync (`name`, `applicationCategory`,
      `operatingSystem`, screenshots).
- [x] Build verify: `npm run docs:build` (exit 0), check homepage + /ffmpeg-gui titles in `dist`.

### Checkpoint 1 — Homepage: sell the product in 5 seconds

Current homepage is already good and plain-language. Reorder/strengthen per analysis:

- [x] Move "FFmpeg power. Without the command line." into the hero. Keep the friendly
      "Sound Familiar?" pain cards (they convert) but add a hero sub-line naming the OS trio
      ("Free, open-source media conversion for Windows, macOS, Linux · 100% local").
- [x] Make **Download** the only brand CTA in the hero; secondary link becomes "See what it can do".
- [x] Insert a short "Everything you need to work with media" icon strip (convert / audio /
      compress / trim / extract / GPU / batch / CLI).
- [x] New prominent **privacy band**: "Your videos never leave your computer." + checks
      (no uploads / no account / no subscription / no watermark / no file-size limits).
- [x] De-emphasize raw numbers ("51 video codecs") on the homepage; keep them in
      `docs/features-reference`.
- [x] Add **screenshot after hero** (already the pattern; verify `home_dashboard.webp` is the
      LCP and stays above fold, no CLS).
- [x] Add "Built for beginners. Powerful enough for developers." section bridging GUI + CLI,
      linking to `docs/cli`.
- [x] Regenerate all 7 locale homepages to match (English first, then mirror).
- [/] Build verify + Lighthouse baseline (record scores in tracker at bottom).
      `npm run docs:build` passes (verified); Lighthouse scores not yet captured.

### Checkpoint 2 — Download page: one decision, not five

- [x] Rework `site/download.md` so the primary experience is a single "primary" build
      (detected or default) — e.g. a big **Download EncodeX for Windows** button for x64
      Windows 10/11, followed by "Other platforms → macOS · Linux · ARM64 · 32-bit".
- [x] Explore adding a lightweight OS/arch detector. GitHub Releases API already exposes asset
      lists; the `<LatestDownloads />` component can rank the "recommended" asset first by UA
      platform + `process.arch`-style heuristics.
- [x] Keep checksums + Gatekeeper instructions (they build trust). Do NOT hide them — collapse
      into "show details".
- [x] After download, consider a "what happens next / first-run" blurb (install → drag file →
      convert) to set expectations and reduce first-run churn.
      (Both implemented in Phase 2 — see `plans/PRODUCT_LAUNCH_PHASE2_PLAN.md` P2-2.1/P2-2.2.)
- [x] Mirror in 7 locales.
- [x] Build verify.

### Checkpoint 3 — GitHub README: marketing-first

Rewrite `README.md` around the claim instead of the stack:

- [x] Top block: name + one-liner + 3 badges (Download / Website / Docs), like:
      `[Download] [Website encodex.in] [Documentation]`.
- [x] Keep the banner + badges row (signal quality) but move the tech-stack detail down.
- [x] Add **"Why EncodeX?"** checklist: free forever · open source · no account · 100% local
      processing · FFmpeg powered · hardware acceleration · batch conversion · CLI · cross-platform.
- [x] Move screenshots up (they already exist in `site/public/images/*.webp`) — GIF/action
      recording ideal (see Checkpoint 3a).
- [x] Tighten the intro paragraph; new Features bullets must lead with user benefits, not specs.
- [x] Add prominent "About the website" note: `encodex.in` for marketing/docs, releases for binaries.
- [x] Update `docs/de|es|fr|hi|pt|zh/README.md` mirrors (as already exist).
- [ ] (Manual) Re-verify GitHub topic tagging (`ffmpeg`, `ffmpeg-gui`, `ffmpeg-wrapper`,
      `video-converter`, `electron`, `typescript`, `react`).

### Checkpoint 3a — Product screenshots / GIFs

- [ ] Capture a short action GIF (drag file → choose profile → convert → done) and a CLI demo
      GIF; add to README + homepage. Existing WebP screenshots cover statics.
- [ ] Generate lighter-weight `home_dashboard`-style WebPs for the final hero if the hero image
      changes.

---

## Phase 2 — SEO Expansion

### Checkpoint 4 — Landing-page hierarchy

ChatGPT's tree mapped to existing pages (already live = keep, no rebuild):

```text
encodex.in
├── ffmpeg-gui/                  ✔ live + windows/macos/linux
├── video-converter/             ✔ live
├── video-compressor/            ✔ live
├── audio-converter/             ✔ live
├── extract-audio-from-video/    ✔ live
├── convert/                     ✔ mkv/mov/avi/flv/wmv/m4v/webm → mp4
│   └── NEW: mp4-to-mkv, mp4-to-webm
├── codecs/                      ✔ h264, h265, av1
│   └── NEW: vp9, prores
├── compress/                    NEW hub
│   ├── video/ + mp4/ + mkv/     (wrap the live video-compressor page)
├── extract/                     NEW hub
│   └── audio-from-video/ + mp3-from-video/ + wav-from-video/
├── platforms/                   NEW hub
│   └── windows/, mac/, linux/   (link to existing ffmpeg-gui platform pages)
└── learn/*                      ✔ what-is-ffmpeg (+ blog)
```

New pages to create (EN + 7 locales each, per the established SEO plan pattern):

- [x] `convert/mp4-to-mkv`, `convert/mp4-to-webm` (rewrap-only remux angle: keep codec, change container)
- [x] `codecs/vp9`, `codecs/prores` (archivists/professional angle)
- [x] `compress/mp4`, `compress/mkv` (long-tail compression intents; keep distinct from
      `video-compressor` per cannibalization guardrails)
- [x] `extract/mp3-from-video`, `extract/wav-from-video` (step-by-step "how to extract")
- [x] `platforms/windows`, `platforms/mac`, `platforms/linux` (general platform landing pages
      that cross-link to `ffmpeg-gui/{os}`; distinct intent = "converter for {os}")
- [x] Register all in `config.mts`: `toolsNav`, `toolsStrings`, `seoLandingPages`
      (Breadcrumb), FAQ schema where applicable.
- [x] Homepage "Popular Tools & Guides" — add new high-intent links.
- [x] Build verify after each batch. Do **not** create doorway/duplicate pages — each must
      have a distinct angle (format/codec/platform/compression/extraction).

### Checkpoint 5 — Primary SEO pillar is "FFmpeg GUI"

- [x] Add explicit keyword variants to existing `ffmpeg-gui.md` +
      `ffmpeg-gui/{windows,macos,linux}`: "ffmpeg gui", "ffmpeg gui windows", "ffmpeg gui mac",
      "ffmpeg gui linux", "ffmpeg frontend", "ffmpeg alternative for windows/mac/linux".
- [x] Interlink: `/ffmpeg-gui` ↔ `video-converter` ↔ `codecs/*` ↔ `docs/cli` ↔ `learn/what-is-ffmpeg`
      (already partially done; audit for consistency).
- [x] Consider one page each targeting "ffmpeg alternative" and "handbrake alternative" as
      comparison/positioning pages (see Checkpoint 5a).

### Checkpoint 5a — Comparison page (anti-cannibalization wrapper)

- [x] Create `site/handbrake-alternative.md` and/or `site/comparison.md`:
      table EncodeX vs HandBrake vs Shutter Encoder vs FFmpeg CLI (raw GUI/CLI/cross-platform/
      hardware acceleration/batch/lossless remux/open source columns). Only claim what we can
      back; no misleading rows.
- [x] Target "handbrake alternative", "shutter encoder alternative", "free video converter
      alternative", "ffmpeg gui alternative".
- [x] Add JSON-LD (Breadcrumb + FAQ) + cross-links from `ffmpeg-gui` and homepage.
- [x] 7 locale mirrors.
- [x] Build verify.

### Checkpoint 5b — Privacy landing page

- [x] Create `site/privacy.md` (EN + locales): "Your videos never leave your computer."
      Bullet the six claims (no cloud uploads / no account / no subscription / no watermark /
      no file-size limits / no server processing / media stays local).
- [x] Explain how (all encoding runs in-process via bundled FFmpeg; document in
      `docs/architecture` + reference it).
- [x] Homepage privacy band links here; `download.md` links here too.
- [x] Build verify.

### Checkpoint 6 — Technical SEO hygiene

- [x] Verify sitemap + RSS regenerate automatically (`scripts/generate-rss.mjs`,
      `sitemap.hostname` in `config.mts`).
- [ ] (Manual) Submit refreshed sitemap in Google Search Console; monitor Index Coverage.
- [ ] (Manual) Lighthouse on 3–4 SEO pages; record in tracker.
- [x] Add `compress/*` and `platforms/*` slugs to `seoLandingPages` breadcrumb map.
- [x] Confirm per-page `og:image`; add a reusable default for the new pages.

---

## Phase 3 — Product Growth

### Checkpoint 7 — Installer size reduction (~378 MB target)

First measure, then optimize. Concrete items:

- [ ] Measure real artifact sizes: run `npm run dist` on a tagged release (or check latest
      GitHub Release assets) and record actual sizes per platform/arch. Confirm/refute the
      ~378 MB claim for the Windows x64 NSIS.
- [ ] Reduce bundled payload:
  - [ ] `ffmpeg-static` + `ffprobe-static` ship full FFmpeg builds (~70–100 MB each). Proof:
        only the codecs/features the app exposes are needed; consider a trimmed build
        (e.g. ffmpeg from conda/gyan with reduced compile flags) OR an optional/on-demand
        FFmpeg download on first run (with offline fallback), tracking a preference.
  - [ ] Prune unused `node_modules` from the packaged app (electron-builder `files`
        already hones to `dist/**` — audit for accidental inclusions).
  - [ ] `@sentry/electron` scope: confirm no dev-only deps leak into the asar.
  - [ ] Use `compression: "maximum"` / 7z for NSIS; configure `electron-builder` `nsis`
        options (`differentialPackage`, `oneClick`) to enable delta updates.
  - [ ] Evaluate `asar: true` with exclusion of already-external resources
        (`extraResources` ffmpeg stays external — fine, not double-packed).
- [ ] Document current vs target sizes in the tracker; gate future releases on a size budget
      if feasible.

### Checkpoint 8 — Hardware acceleration re-messaging

- [x] App: wherever the UI lists "NVENC/QSV/AMF/VAAPI/VideoToolbox/Media Foundation", lead with
      "Use your GPU to encode faster" text + auto-detect story (docs already document
      detection in `docs/architecture-transcoders`).
- [x] Site: `features.md` + `ffmpeg-gui.md` — replace acronym-heavy copy with the
      "GPU + GPU vendors (NVIDIA · Intel · AMD · Apple Silicon)" framing.
- [x] Add one blog post: "What is hardware acceleration / GPU encoding?" linking `download`.
      Shipped as `site/blog/posts/gpu-hardware-acceleration-guide.md` (EN + 6 locales).
- [x] Locales mirrors where copy changes.

### Checkpoint 9 — CLI as a developer feature

- [x] Site: new `site/cli.md` (landing, not just docs) — "Script, automate, batch" —
      with `encodex convert|info|capabilities|batch|compress|extract-audio` examples, exit
      codes, install-from-source. Link from homepage "developers" card, README, and
      `docs/cli`.
- [x] README: elevate CLI block above the generic dev workflow (partial already — polish).
- [x] Blog post: "Automate your media workflow with the EncodeX CLI".
      Shipped as `site/blog/posts/cli-automation-guide.md` (EN + 6 locales).
- [x] 7 locale mirrors.
- [x] Build verify.

### Checkpoint 10 — Anonymous usage analytics (privacy-respecting funnel)

Goal: measure **download → install → first launch → first conversion → success → repeat**,
with zero PII. Respect the "your files never leave you" promise — analytics must be
explicitly anonymous/opt-out and clearly communicated.

- [x] Define event taxonomy (typed, versioned): implemented in
      `src/shared/analytics/events.ts` (schema v1, 14 typed events: `app_installed`,
      `app_launched`, `onboarding_started`, `onboarding_goal_selected`,
      `conversion_started`, `conversion_completed`, `conversion_failed`,
      `batch_completed`, `profile_applied`, `hw_accel_detected`, `cli_invoked`,
      `update_available`, `telemetry_opt_in`, `telemetry_opt_out`). All payloads are
      categorical-only (zero PII by taxonomy design).
- [x] Site funnel: `site/.vitepress/theme/composables/useAnalytics.ts` already wires
      `download_click`, `outbound_download` (GitHub release links), and `generate_lead`
      via `gtag('event', ...)`. Blog index also fires `blog_post_click`. Remaining:
      add a GA4 custom dimension for `os/arch` on the download page (the download URLs
      themselves are captured; the dimension is optional/polish).
      ✅ Implemented in Phase 2 (P2-6.1): `detectOsArch()` + `os_arch` user property +
      `dimension4` custom_map. GA4 admin still needs the custom dimension created (owner).
- [x] App: decided — product analytics ride the **existing Sentry breadcrumb channel**
      (category `analytics`) via `src/shared/analytics/AnalyticsService.ts`
      (`recordAnalyticsEvent`). No new network endpoints; consent + privacy inherited from
      the monitoring toggle (see `plans/SENTRY_MONITORING_PLAN.md` §Analytics). Wired to
      `app_launched`, `cli_invoked`, `conversion_started/completed/failed`,
      `onboarding_started`, `onboarding_goal_selected`.
- [x] Decide the metrics priority and write them down: #1 = "successful first conversion".
      KPI table filled in below (see tracker).
- [x] Consent + privacy: tracking is absent when monitoring/tracking is "telemetry off"
      (breadcrumb channel is consent-gated; nothing leaves the device otherwise). Linked
      `site/privacy.md` copy already discloses the optional telemetry stance.
- [x] Networking: NO new request added — analytics reuse the already-consented Sentry
      breadcrumb transport; they do not double as session tracking.

### Checkpoint 11 — First-run onboarding (product)

- [x] Add a lightweight first-run screen: pick your goal (convert / compress / extract /
      trim) → jump straight into that flow. Do not gate the app on it.
      Implemented as `src/renderer/components/GettingStartedCard.tsx` shown on the
      Dashboard until dismissed (localStorage `encodex-onboarding-completed`); goal chips
      navigate to `/convert`, `/image-compress`, `/audio-extract`, `/video-cut`.
      Emits `onboarding_started` + `onboarding_goal_selected`. Localized (en-US keys,
      fallback covers all locales).
- [ ] Pre-warm defaults so a first conversion happens with one file drop (no empty states
      that block action).
      (Deferred in Phase 2 — research complete, held for UX decision; see
      `plans/PRODUCT_LAUNCH_PHASE2_PLAN.md` P2-7.)
- [x] Track first conversion completed (Checkpoint 10) as the primary funnel success.
      Wired as `conversion_completed` in the job queue.

---

## Phase 4 — Content, Use Cases & Community

### Checkpoint 12 — Use-case strategy

Turn personas into both marketing sections and SEO pages ("EncodeX for X"):

- [x] **Creators** — shipped `/use-cases` hub page + blog post
      `handbrake-alternative-guide` (compress for upload, MOV→MP4, extract audio).
- [x] **Developers** — covered by `ffmpeg-gui`, `cli.md`, and the new hub; CLI docs exist.
- [x] **Archivists** — lossless remux, FFV1, HuffYUV, ProRes, archival formats.
      ✅ Blog post `best-formats-for-archival` (EN + 6 locales); links `/codecs/prores`,
      `/convert/mp4-to-mkv`.
- [x] **Gamers** — compress OBS/ShadowPlay recordings, extract clips, convert for sharing.
      ✅ Blog post `compress-obs-recordings` (EN + 6 locales); links `/video-compressor`,
      `/extract-audio-from-video`.
- [x] **Photographers** — image compression, format conversion, batch processing.
      ✅ Blog post `image-compression-guide` (EN + 6 locales); links `/features`, `/download`.
- [x] Ship as: one `/use-cases` hub page (all 8 locales) + 3 blog posts in the first batch,
      each internally linking to the tools pages: `extract-mp3-video-guide`,
      `video-compression-guide`, `handbrake-alternative-guide`. Standalone landing pages
      reuse the existing high-volume clusters (`video-converter`, `video-compressor`,
      `extract-audio-from-video`, `ffmpeg-gui`).

### Checkpoint 13 — Community & distribution

- [ ] GitHub Discussions enabled (`Settings → Features`); seeds: "Show your workflow",
      "Help / support". (Manual, owner)
- [x] GitHub issue templates: `.github/ISSUE_TEMPLATE/config.yml` link fixed to
      `github.com/Sandeepv68/encodex/discussions`; `feature_request.md` now links to
      Discussions + the site's use-cases/blog content instead of a dead placeholder.
- [x] Release announcement blog template (`site/blog/releases/`) — present; new `blog/posts`
      dir added to the loader (`site/.vitepress/data/blog.data.mts` scans both).
- [ ] Product Hunt launch page + list (manual).
- [ ] Reddit: r/selfhosted, r/privacy, r/ffmpeg — share with rules-compliant posts (manual).
- [ ] Hacker News "Show HN" once README + site are polished (manual).
- [ ] YouTube demo video (2–3 min: GUI + batch + CLI) from Checkpoint 3a assets (manual).

---

## Cross-cutting: every page × 8 locales

This project convention (from `plans/SEO_KEYWORD_OPTIMIZATION_PLAN.md` and the
`site/locales/` tree) is: **any new EN page gets mirrored in es, fr, de, pt, zh, hi**.

- [x] After each checkpoint, translate the affected pages.
- [x] Keep `config.mts` strings (nav labels, tooltips) in sync for all 8 locales.
- [x] Never localize with placeholders in code; use `i18next` keys (app) and markdown
      frontmatter (site) as today. Verified: `GettingStartedCard.tsx` uses en-US i18n
      keys (fallback), all locale strings are in `en-US.json` locale map, no hardcoded
      UI strings in new components.
- [x] Run `npm run docs:build` after each batch and fix route warnings. Build has been
      run and all dead links fixed (21 corrected, `/convert`→`/video-converter`,
      `/compress`→`/video-compressor`). Zero dead links confirmed.

## Keyword Cannibalization Guardrails (carried over + extended)

- `ffmpeg-gui` vs `ffmpeg-gui/{os}`: platform intent keeps them distinct — do not merge.
- `convert/mp4-to-mkv` (remux) ≠ `video-converter` (transcode + remux) — lead with the
  codec-preserving/mux-only angle.
- `compress/mp4` ≠ `video-compressor`: page source-format intent + steps, never copy/paste.
- `extract/{mp3,wav}-from-video` vs `extract-audio-from-video`: the hub keeps the general
  steps; sub-pages answer the specific container intent.
- Comparison page must claim only verifiable capabilities to avoid trust and rich-result issues.
- FAQ JSON-LD content must match on-page text exactly (Google rich-result policy).

## Risks / Notes

- **Locale scope creep**: every page × 8 locales makes Phase 2 large. Batch by cluster
  (convert → codecs → compress/extract → platforms) and build-verify each batch. Write files
  directly; do not delegate parallel sub-agents for file writes (established pattern).
- **Installer size reduction is a real engineering task** — time-box it; measure first, only
  then optimize. Do not regress functional coverage (hardware accel must survive).
- **Analytics must not break the privacy promise.** If we cannot make telemetry clearly
  anonymous + optional, ship without it — the privacy positioning is worth more than the data.
- **Do not commit or push unless the user explicitly asks** (standing instruction).
- **Do not create doorway pages** — every new page needs a distinct, non-duplicated intent.

## Lighthouse Baseline Tracker

Mobile emulation, simulated throttling, served locally via `vitepress preview` (2026-09-14).

| Page | Perf | SEO | A11y | Date |
|------|------|-----|------|------|
| / | 59 | 100 | 100 | 2026-09-14 |
| /download | 72 | 100 | 96 | 2026-09-14 |
| /ffmpeg-gui | 75 | 100 | 96 | 2026-09-14 |
| /convert/mkv-to-mp4 | 72 | 100 | 100 | 2026-09-14 |

Note: Best Practices is 100 on all four pages. No category is Red (≤ 49). Homepage Perf (59)
is driven by TBT 910 ms + LCP 4.4 s (main-thread contention incl. the GA4 `gtag` script);
CLS is 0. Perf follow-up is tracked in P2-1.1 (Phase 2 plan).

## KPI Tracker (filled once Checkpoint 10 ships)

Priority: **#1 = successful first conversion** (a `conversion_completed` following the
first `app_launched` → `conversion_started` in the same session). Events are captured as
Sentry breadcrumbs; targets below are reviewed against real numbers after the first tagged
release + Sentry data flow. No PII is collected.

| Metric | Target | How we measure | Current |
|--------|--------|----------------|---------|
| Downloads / mo | TBD | (GitHub release assets) | - |
| First conversion success rate | ≥ 10% of first-run sessions | `conversion_completed` after first drop | - |
| Download→install→convert funnel | TBD | `app_launched` (new install) → `conversion_completed` | - |
| Onboarding goal selection | ≥ 25% of first-run sessions pick a goal chip | `onboarding_goal_selected` frequency | - |
| CLI adoption | TBD | `cli_invoked` count + subcommand split | - |
| Hard-accel adoption | TBD | `hw_accel_detected` frequency | - |
| Installer size (Win x64 NSIS) | < 250 MB? | Measure in Phase 3 | ~378 MB (unverified) |

## Definition of "Done" for this plan

- [x] Homepage + download page + README live the new positioning (Checkpoints 0–3).
- [/] New SEO page clusters shipped EN + 7 locales; sitemap regenerated; GSC re-submitted.
      Clusters + sitemap done (CP4); GSC re-submission is manual/owner (CP6).
- [x] Comparison, privacy, and CLI landing pages published
      (`handbrake-alternative.md`, `privacy.md`, `cli.md` — EN + locales, build-verified).
- [ ] Installer size measured and (if feasible) reduced.
- [x] Anonymous funnel events designed + implemented (Consent-gated Sentry breadcrumbs;
      taxonomy in `src/shared/analytics/events.ts`).
- [ ] KPI table seeded with real numbers once Sentry data flows.
- [ ] Community channels started (Discussions, PH/HN/Reddit posts queued).
- [x] `npm run docs:build`, `npm run typecheck`, `npm run lint`, `npm test` all green.