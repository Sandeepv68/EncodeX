# Plan: EncodeX Launch Phase 2 — pending items from the Product Launch & Growth plan

> Follow-up to `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md`. Every item below is a **still-pending**
> checkbox from that plan, expanded with rationale, acceptance criteria, and verification
> steps. Items marked `(manual)` require an external action (GitHub owner, Google, App Store)
> and are queued for the repo owner, not code work.
>
> Status legend: `[ ]` not started · `[/]` in progress · `[x]` done · `(manual)` owner/external.

---

## Progress Tracker (high-level)

| # | Track | Status |
|---|-------|--------|
| P2-1 | Verification & measurement (Lighthouse, GSC, GitHub topics, installer size) | [/] |
| P2-2 | Download page upgrades (OS/arch detection, first-run blurb) | [x] |
| P2-3 | Media assets (action GIF, CLI demo GIF, lighter hero WebPs) | [ ] |
| P2-4 | Installer size reduction (measure → trim → compress → budget) | [ ] |
| P2-5 | Content — blog posts batch 2 (GPU/CLI/personas) | [x] |
| P2-6 | Analytics completion (GA4 os/arch dimension, KPI seeding) | [/] |
| P2-7 | Onboarding polish (pre-warm first-conversion defaults) | [/] (deferred) |
| P2-8 | Community & distribution launch (GH Discussions, PH, Reddit, HN, YouTube) | [ ] |

---

## P2-1 Verification & measurement

### P2-1.1 Lighthouse baseline ✅ (2026-09-14)

- **Source:** `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` CP1 + CP6.
- **Work:**
  - [x] Run Lighthouse (desktop + mobile) on `/`, `/download`, `/ffmpeg-gui`, `/convert/mkv-to-mp4`.
        Ran mobile emulation via `vitepress preview` + Lighthouse 12: Perf 59/72/75/72,
        SEO 100/100/100/100, A11y 100/96/96/100 (Best Practices 100 everywhere).
  - [x] Fix any Perf/A11y/SEO regressions surfaced (e.g. CLS from hero images, contrast
        issues on tinted surfaces). No regressions found — no Red (≤49) category on any page;
        homepage Perf is limited by TBT 910 ms / LCP 4.4 s (gtag + main-thread), CLS 0.
  - [x] Record scores in the `Lighthouse Baseline Tracker` table of
        `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md`. Done (2026-09-14).
- **Acceptance:** scores recorded; no Red (≤ 49) category on the four pages. ✅ met.
- **Follow-up (P2-1.1-perf):** optional perf pass for the homepage (Perf 59) — reduce
  render-blocking / main-thread work and trim the GA4 gtag payload before any perf push.

### P2-1.2 Google Search Console (manual)

- **Source:** `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` CP6.
- **Work:**
  - [ ] Submit the refreshed `sitemap.xml` (regenerates via `npm run docs:build`).
  - [ ] Monitor Index Coverage; feed `feed.xml` (blog) to GSC if not already.
- **Acceptance:** GSC shows the new `video-converter`/`video-compressor`/**`use-cases`**/*blog*
  cluster URLs as Indexed (or Discovered), and the `encodex.in` canonical is configured.

### P2-1.3 GitHub topic tagging (manual)

- **Source:** `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` CP3.
- **Work:**
  - [ ] Verify the repo's Topics on `github.com/Sandeepv68/encodex` include the
        full recommended set: `ffmpeg`, `ffmpeg-gui`, `ffmpeg-wrapper`, `video-converter`,
        `electron`, `typescript`, `react`.
- **Acceptance:** all seven topics are visible on the repo page.

### P2-1.4 Installer size — measure first

- **Source:** `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` CP7.
- **Work:**
  - [ ] Run `npm run dist` on a tagged release (or pull the latest GitHub Release assets)
        and record actual sizes per platform/arch.
  - [ ] Confirm/refute the ~378 MB claim for the Windows x64 NSIS; update the KPI tracker
        row in `PRODUCT_LAUNCH_GROWTH_PLAN.md`.
- **Acceptance:** a real number replaces `~378 MB (unverified)` in the KPI tracker.

---

## P2-2 Download page upgrades

### P2-2.1 Lightweight OS/arch detector

- **Source:** `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` CP2.
- **File:** `site/.vitepress/theme/components/LatestDownloads.vue`.
- **Work:**
  - [x] Rank the "recommended" asset first based on `navigator.userAgentData` platform
        (`navigator.platform` fallback) + architecture heuristics (x64 vs arm64, Windows
        vs macOS vs Linux).
  - [x] Keep manual choice available ("Other platforms → macOS · Linux · ARM64 · 32-bit");
        do **not** block the download on detection.
  - [x] Keep the primary (default) build as the big CTA exactly as it is today.
- **Acceptance:** on Win-x64 the Windows x64 asset highlights first; a manual override is
  always reachable; `npm run docs:build` passes. ✅ Implemented + build verified.

### P2-2.2 "What happens next / first-run" blurb

- **Source:** `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` CP2.
- **Work:**
  - [x] Add a short post-download expectations strip on `site/download.md`
        ("install → drag a file in → pick a profile → done → 100% local") linking
        `/use-cases` + `/features` (note: `/docs/quick-start` from the original outline
        does not exist as a page — used `/features` instead).
  - [x] Mirror in the 6 locale downloads (`site/locales/{es,fr,de,pt,zh,hi}/download.md`).
- **Acceptance:** the strip is visible on every locale download page; build has zero dead links.
  ✅ Done (EN + 6 locales), `docs:build` green.

---

## P2-3 Media assets

### P2-3.1 Action GIF (GUI)

- **Source:** `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` CP3a.
- **Work:**
  - [ ] Capture a short action GIF: drag a file → choose a profile → convert → done.
  - [ ] Add to README (screenshots table) and homepage; keep inline `width`/`height` to
        avoid CLS.
- **Acceptance:** GIF ≤ ~2 MB, encodes the core promise on a 5-second watch.

### P2-3.2 CLI demo GIF

- **Work:**
  - [ ] Capture `encodex convert in.mp4 -o out.webm` style CLI demo.
  - [ ] Add to `site/cli.md` + README CLI block.
- **Acceptance:** GIF renders in both locations; file stored under `site/public/images/`.

### P2-3.3 Lighter hero images

- **Work:**
  - [ ] If the homepage hero changes, emit lighter `home_dashboard`-style WebPs (and the
        new page hero images) targeting < 150 KB each.
  - [ ] Re-run Lighthouse (P2-1.1) afterwards.
- **Acceptance:** LCP image ≤ ~150 KB; no Perf regression.

---

## P2-4 Installer size reduction

- **Source:** `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` CP7 (blocked behind P2-1.4 measurement).
- **Ground rule:** measure first, optimize second, never regress functional coverage
  (hardware acceleration + all codecs must survive).

- [ ] **Trim FFmpeg payload:** `ffmpeg-static` + `ffprobe-static` ship full builds
      (~70–100 MB each). Evaluate a trimmed build (conda/gyan with reduced compile flags)
      OR on-demand FFmpeg download on first run with offline fallback (track a user
      preference either way).
- [ ] **Prune `node_modules`:** audit electron-builder `files` for accidental inclusions
      beyond `dist/**`.
- [ ] **Sentry scope:** confirm `@sentry/electron` packs no dev-only deps into the asar.
- [ ] **NSIS compression:** `compression: "maximum"` / 7z + `differentialPackage`,
      `oneClick` delta-update options.
- [ ] **asar audit:** confirm bundled FFmpeg stays an `extraResources` external (not
      double-packed inside the asar).
- [ ] **Document the budget:** update the KPI tracker + gate future releases on a size
      budget if feasible.
- **Acceptance:** Windows x64 NSIS measurably smaller (target `< 250 MB`); app smoke test
  (encode + hardware accel) still passes; `npm run dist` green.

---

## P2-5 Content — blog posts batch 2

- **Location:** `site/blog/posts/*.md` — auto-picked up by
  `site/.vitepress/data/blog.data.mts` (scans `blog/releases` + `blog/posts`), appears in
  the RSS feed (via `scripts/generate-rss.mjs`) at build time. **Every post REQUIRES a
  `date` + `tags` frontmatter** and must be mirrored in all 6 locales
  (`site/locales/{es,fr,de,pt,zh,hi}/blog/posts/*.md`) with locale-prefixed internal links.

- [x] **P2-5.1** Blog post: "What is hardware acceleration / GPU encoding?" linking
      `download` (CP8). Angle: GPU vs CPU, NVENC/QSV/AMF/VAAPI/VideoToolbox, when it helps.
- [x] **P2-5.2** Blog post: "Automate your media workflow with the EncodeX CLI" (CP9).
      Angle: `encodex convert|info|capabilities|batch|compress|extract-audio`, exit codes,
      sky-for scripts, link `cli.md` + README.
- [x] **P2-5.3** Archivists post (CP12): lossless remux, FFV1, HuffYUV, ProRes — link
      `codecs/prores` + `convert/mp4-to-mkv`.
- [x] **P2-5.4** Gamers post (CP12): compress OBS/ShadowPlay recordings, extract clips,
      convert for sharing — link `compress/mp4` + `extract/*`.
- [x] **P2-5.5** Photographers post (CP12): image compression, batch processing, format
      conversion — link image-compress tooling + `convert/*`.

- Each post: `date` + `tags`, Breadcrumb-less (blog layout), internal links to the
  relevant tools pages (per the cannibalization guardrails in the growth plan), EN + 6
  locales, then `npm run docs:build` → zero dead links.
- **Acceptance:** 5 new posts × 7 locales, RSS feed grows, `docs:build` green.
  ✅ All 5 posts written (EN + 6 locales each); `scripts/generate-rss.mjs` updated to also
  feed `blog/posts` → RSS now 15 posts; `docs:build` green (0 dead links).

---

## P2-6 Analytics completion

### P2-6.1 GA4 `os/arch` custom dimension (site)

- **Source:** `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` CP10 (site funnel, `/]`).
- **Files:** `site/.vitepress/theme/composables/useAnalytics.ts` + GA4 admin (create the
  custom dimension in Properties → Custom definitions → Custom dimensions).
- **Work:**
  - [x] Emit it alongside the existing `download_click` / `outbound_download` events
        (`gtag('set', 'user_properties', { ... })` pattern already used in the composable).
        ✅ Implemented: `detectOsArch()` + `os_arch` user property + `dimension4` custom_map
        in `useAnalytics.ts`.
  - [ ] **Manual (GA4 admin):** create the `os_arch` custom dimension in
        Properties → Custom definitions → Custom dimensions (dimension 4).
- **Acceptance:** download events carry OS + arch in GA4; `gtag` calls are centralized in
  `useAnalytics.ts` (no inline dashboard GA4 usage in `.vue` files). ✅ code side done;
  GA4 admin step queued (owner).

### P2-6.2 Seed the KPI table (after first release + Sentry data)

- **Source:** `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` Definition of Done.
- **Work:**
  - [ ] After the first tagged release with the breadcrumb analytics
        (`src/shared/analytics/events.ts` schema v1), pull counts for
        `app_launched`, `conversion_completed`, `conversion_failed`,
        `onboarding_goal_selected`, `cli_invoked`, `hw_accel_detected`.
  - [ ] Fill the `KPI Tracker` table in the growth plan: first-conversion success rate,
        funnel, goal-selection %, CLI adoption, hard-accel adoption.
- **Acceptance:** every KPI row has a real number + observed date; no placeholders.

---

## P2-7 Onboarding polish — pre-warm first-conversion defaults [deferred]

> **Status (verified):** research complete, implementation deferred by owner decision.
> Findings: `CONVERSION_DEFAULTS` (`src/shared/transcoder-constants.ts`) already give the
> Convert flow H.264/AAC/2000k/192k/CRF 23/1080p/yuv420p — equal to the
> `mp4-max-compat` builtin profile (`src/shared/profiles/builtin.ts:610`) — so a fresh
> single drop → Convert already encodes without any picker. The 3 remaining pages
> (ImageCompress/AudioExtract/VideoCut) block on an explicit output selection; auto-suggest
> there changes behavior for ALL users (not assistive-only) and the pre-selected
> ProfileSelector badge would flip the renderer tests' expectation of a blank first-run
> combobox. Both held for a dedicated UX pass rather than a silent behavior change.

- **Source:** `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` CP11.
- **App files:** `src/renderer/components/GettingStartedCard.tsx` (existing, works),
  the convert/compress/extract/trim default profiles, and the queue defaults
  (`src/main/queue/job-queue.ts`).
- **Work (deferred):**
  - [ ] Ensure every flow defaults to a working encode as soon as the first file is
        dropped (no required picker/blank state blocking the first run).
  - [ ] Default profile per goal = the one that "just works" (e.g. H.264 MP4 for convert,
        CRF 23 for compress, MP3 192k for extract) so a single drop → convert → done.
  - [ ] Add a renderer test asserting the default pre-selected profile on
        first-run-with-no-settings.
- **Acceptance:** fresh-install → dashboard → drop file → convert gives a completed
  conversion with zero extra clicks (assistive only: goal chips still shortcut flows).

---

## P2-8 Community & distribution (manual, owner)

- **Source:** `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` CP13.
- **Work:**
  - [ ] Enable **GitHub Discussions** (`Settings → Features`), seed "Show your workflow"
        + "Help / support" posts. (Links in `.github/ISSUE_TEMPLATE/config.yml` already
        point at `Sandeepv68/encodex/discussions`.)
  - [ ] **Product Hunt** launch page + list — reuse the positioning claim + GIF from P2-3.
  - [ ] **Reddit:** rules-compliant posts on r/selfhosted, r/privacy, r/ffmpeg.
  - [ ] **Hacker News** "Show HN" once README + site are polished (P2-1 earned links).
  - [ ] **YouTube** demo video (2–3 min GUI + batch + CLI) from the P2-3 assets.
- **Acceptance (owner):** Discussions live with ≥ 2 seeds; PH/Reddit/HN/YouTube links
  filed in this plan as done with URLs.

---

## Acceptance gate for Phase 2

- [x] `npm run docs:build` green (site changes; zero dead links, RSS updated to 15 posts).
- [ ] `npm run typecheck` + `npm run lint` green (app changes) — pending P2-7 app changes.
- [ ] `npm test` (vitest) green (app changes) — pending P2-7 app changes.
- [ ] All `(manual)` items replaced with done-markers + URLs/evidence.
- [ ] KPI tracker rows filled with real, dated numbers.

---

## Handoff — pending items & resume notes (snapshot 2026-09-14)

> Everything *not* listed here is `[x]` (done) and is verified by the markers above. This
> section is the single entry point for the next session — start anywhere in **1–3**; items
> **4–8** are owner/external and only need evidence filed once performed.
>
> Legend: `OWNER` = external account holder · `BLOCKED` = waiting on a prerequisite.

### 1. Homepage performance pass (code — optional, low priority)

- **Why open:** Lighthouse baseline at P2-1.1 shows `/` Perf 59 (mobile): TBT 910 ms, LCP 4.4 s,
  CLS 0. All other pages are ≥ 72. No Red category anywhere, so this is polish.
- **Where:** `site/.vitepress/config.mts` `head` (GA4 `G-SM28DL4DYR` gtag) + theme entry
  (`site/.vitepress/theme/index.ts`) + hero image handling on `site/index.md`.
- **Levers:** defer/reduce gtag JS, trim render-blocking resources, preload the LCP
  (`home_dashboard.webp`-style hero) image.
- **Resume steps:** `npm run docs:preview` (port 4173) → Lighthouse on `/`:
  `npx -y lighthouse@12 http://localhost:4173/ --output=json --output-path=...\lh.json
  --chrome-path="C:\Program Files\Google\Chrome\Application\chrome.exe"
  --chrome-flags="--headless --no-sandbox --disable-gpu"` (expect exit=1 from a harmless
  chrome-launcher temp-dir cleanup EPERM; the JSON is still written). Re-record score in
  `PRODUCT_LAUNCH_GROWTH_PLAN.md` tracker.
- **Acceptance:** Perf ≥ 75 on `/` with SEO/A11y unchanged (100/100).

### 2. Onboarding pre-warm defaults (code — deferred pending UX decision)

- **Why deferred:** Convert already yields a zero-picker first conversion
  (`CONVERSION_DEFAULTS` in `src/shared/transcoder-constants.ts:210` equals the
  `mp4-max-compat` builtin at `src/shared/profiles/builtin.ts:610`). The actual gap is output
  auto-suggest on **ImageCompress / AudioExtract / VideoCut** (they require explicit output
  selection) — but that changes behavior for ALL users and a pre-selected profile breaks the
  ProfileSelector tests' blank-first-run expectation.
- **Files to touch when approved:** `src/renderer/pages/{ImageCompress,AudioExtract,VideoCut}.tsx`,
  `src/renderer/stores/{conversionStore,profileStore}.ts`, plus renderer tests asserting
  default pre-selection on first-run-with-no-settings.
- **Resume steps:** get a UX decision → implement assistive output auto-suggest + new tests →
  `npm run typecheck`, `npm run lint`, `npm test`, then flip the P2-7 `[ ]` boxes above to `[x]`.

### 3. Installer size reduction (P2-4 — BLOCKED on measurement)

- **Why blocked:** the `~378 MB` figure is unverified. Must run `npm run dist` for a real
  Windows x64 NSIS (and record arch asset sizes) before any optimization (P2-1.4).
- **Work queue (already scoped in P2-4):** trim/swap `ffmpeg-static`+`ffprobe-static` payload
  (or on-demand download w/ offline fallback) · audit electron-builder `files` · confirm
  `@sentry/electron` packs no dev deps · NSIS `compression: "maximum"`/`differentialPackage` ·
  keep FFmpeg an `extraResources` external · document a size budget (< 250 MB target).
  Guardrail: hardware acceleration + all codecs must survive.
- **Resume steps:** on the next tagged release → run `npm run dist` → record sizes in the KPI
  tracker → start trimming. Update `PRODUCT_LAUNCH_GROWTH_PLAN.md` CP7 + P2-4 boxes.

### 4. GA4 `os_arch` custom dimension (OWNER — GA admin)

- **Why:** code side is shipped (P2-6.1: `detectOsArch()` + `os_arch` user property +
  `dimension4` custom_map in `site/.vitepress/theme/composables/useAnalytics.ts`). Without the
  admin dimension, the os/arch data is dropped by GA4.
- **Resume steps:** GA4 property → Configure → Custom definitions → Custom dimensions →
  create `/os_arch` (scope user) → then mark P2-6.1 manual box `[x]`.

### 5. GitHub topic tagging (OWNER — repo settings)

- **Resume steps:** `github.com/Sandeepv68/encodex` → About → Topics → add
  `ffmpeg`, `ffmpeg-gui`, `ffmpeg-wrapper`, `video-converter`, `electron`, `typescript`,
  `react`. Then mark growth-plan CP3 `(manual)` box done.

### 6. Google Search Console (OWNER — GSC)

- **Resume steps:** resubmit the regenerated `sitemap.xml` (from `npm run docs:build`;
  hostname `https://encodex.in`), optionally push `site/public/feed.xml` as a blog feed, and
  monitor Index Coverage for the Phase-2 clusters (`video-converter`, `video-compressor`,
  `compress/*`, `convert/*`, `codecs/*`, `platforms/*`, `use-cases`, blog). Mark CP6 + P2-1.2.

### 7. Phase-2 KPI seeding (BLOCKED on first release + telemetry data)

- **Why blocked:** `conversion_completed`, `app_launched`, `onboarding_goal_selected`,
  `cli_invoked`, `hw_accel_detected`, `conversion_failed` are captured as consent-gated Sentry
  breadcrumbs; counts only exist after a tagged release with telemetry on.
- **Resume steps:** once Sentry has data → pull counts → fill the KPI Tracker in
  `PRODUCT_LAUNCH_GROWTH_PLAN.md` (priority metric: first-conversion success rate ≥ 10%),
  mark P2-6.2 + the DoD "KPI table seeded" box.

### 8. Community & distribution launch (OWNER — public accounts)

- **Queue:** enable GitHub Discussions + 2 seeds → Product Hunt launch (reuse claim + P2-3
  GIF) → Reddit (r/selfhosted, r/privacy, r/ffmpeg) → HN "Show HN" → YouTube demo. Links for
  issue-template bones already exist in `.github/ISSUE_TEMPLATE/config.yml`.
- **Resume steps:** file done-markers with URLs under P2-8 + growth-plan CP13.

### 9. Media assets for P2-3 (code-lite, needs screen capture)

- **Why open:** action GIF (drag → profile → convert → done), CLI demo GIF
  (`encodex convert in.mp4 -o out.webm`), and < 150 KB hero WebPs. Needs the packaged app
  running on this machine + a screen recorder; then inline `width`/`height` on the homepage to
  avoid CLS, and a Lighthouse re-run (ties into item 1).

---

### Fast-forward verification when resuming

```text
npm run docs:build   # site: zero dead links, RSS 15 posts
npm run typecheck    # app: 3 projects
npm run lint         # app: 0 errors (1 pre-existing LanguageMenu autofocus warning)
npm test             # app: vitest (was 1857/1857)
```

### Remaining acceptance-gate debt after the code items

- App gate rows (typecheck/lint/test green) — automatic once item 2 ships.
- All `(manual)` items behind owner actions → item 5, 6, 8.
- KPI table → item 7.