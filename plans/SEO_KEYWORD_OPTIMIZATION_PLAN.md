# Plan: SEO Keyword Optimization — Phase 2 (Long-Tail Expansion)

## Goal

Expand the EncodeX marketing site beyond the completed 15 core landing pages (already live
in English + 7 locales) by adding high-intent, long-tail pages and technical SEO enhancements.
Every new page is created in **English + all 7 locales** (es, fr, de, pt, zh, hi) with proper
`/{lang}/`-prefixed internal links, documented in `config.mts`, and verified with
`npm run docs:build`.

## Status Legend

- `[ ]` Not started
- `[/]` In progress
- `[x]` Done

## Progress Tracker (high-level)

| # | Deliverable | Status |
|---|-------------|--------|
| 0 | Commit/publish Phase-1 SEO pages (15 core × 8 locales) + nav fix | [x] |
| 1 | Batch A: 4 new `convert/{flv,wmv,m4v,webm}-to-mp4` pages | [x] |
| 2 | `extract-audio-from-video` page (high-volume intent) | [x] |
| 3 | FAQPage JSON-LD schema on converter pages | [x] |
| 4 | Internal-link "Related" blocks at the bottom of all SEO pages | [x] |
| 5 | 2–3 new blog posts targeting informational keywords | [x] |
| 6 | Image alt-text + per-page og:image pass | [x] |
| 7 | Performance/Core Web Vitals review | [/] |
| 8 | Cross-locale nav + sitemap regeneration + final build verify | [x] |

---

## Background / Current State

Completed in Phase 1 (all uncommitted as of this plan):

- 14 English SEO landing pages + homepage "Popular Tools & Guides" section.
- Full translations of all 14 pages + homepage section for 7 locales (es, fr, de, pt, zh, hi).
- `config.mts`:
  - `toolsNav` (now a single localized "Tools" dropdown using `text`, not `label` — fixed the "⋯" bug).
  - `toolsStrings` translation map for all 7 locales.
  - `docsNav`/`docsSidebar` for docs.
  - `BreadcrumbList` JSON-LD on the 14 EN landing pages.
  - Canonical + `og:` + `twitter:` + `hreflang` (incl. `x-default`) + `SoftwareApplication` JSON-LD.
- `npm run docs:build` passes (exit 0); sitemap + RSS generate successfully.

Existing page inventory (EN roots):
`index`, `features`, `download`, `ffmpeg-gui`, `video-converter`, `video-compressor`,
`audio-converter`, `ffmpeg-gui/{windows,macos,linux}`, `convert/{mkv,mov,avi}-to-mp4`,
`codecs/{h264,h265,av1}`, `learn/what-is-ffmpeg`.

Existing blog (EN): `blog/index`, `blog/releases/{1.0.0-beta.0, free-video-converter-guide, why-we-built-encodex}`.
Blog posts are also translated to all 7 locales.

---

## Checkpoints

### Checkpoint 0 — Publish Phase 1
- [ ] `git add` all SEO pages + `config.mts` + `feed.xml` + homepages
- [ ] Commit with a descriptive message
- [ ] Push to origin
- [ ] (Manual, user) Submit/refresh sitemap in Google Search Console; verify `encodex.in` canonical

### Checkpoint 1 — Batch A: 4 new format-conversion pages
High-intent `X → MP4` long-tails, following the proven `convert/mkv-to-mp4` template:
`convert/flv-to-mp4`, `convert/wmv-to-mp4`, `convert/m4v-to-mp4`, `convert/webm-to-mp4`.

- [x] Create EN pages `site/convert/{flv,wmv,m4v,webm}-to-mp4.md`
- [x] Create all 7 locale variants `site/locales/{es,fr,de,pt,zh,hi}/convert/{...}-to-mp4.md`
- [x] Add translations to `toolsStrings` (convertLabel group) in `config.mts`
- [x] Add the 4 pages to the `Convert` sub-group in `toolsNav` for all 8 locales
- [x] Add the 4 slugs to `seoLandingPages` (BreadcrumbList) in `transformHead`
- [x] Update homepage "Popular Tools & Guides" section (all locales) — optional favorites
- [x] Build verify: `npm run docs:build` exit 0 + routes render

### Checkpoint 2 — `extract-audio-from-video` page
Directly supports the "extract audio" intent already in the homepage copy; very high volume.

- [x] Create `site/extract-audio-from-video.md` (EN)
- [x] Create `site/locales/{es,fr,de,pt,zh,hi}/extract-audio-from-video.md`
- [x] Register in `toolsNav` + `toolsStrings` + `seoLandingPages`
- [x] Cross-link from `audio-converter` and homepage section
- [x] Build verify

### Checkpoint 3 — FAQPage JSON-LD on converter pages
- [x] Add FAQPage schema generation in `transformHead` keyed off the existing
      `seoLandingPages` map (or a new map) for converter pages
- [x] Ensure FAQ content matches on-page questions to avoid rich-result policy issues
- [x] Build verify

### Checkpoint 4 — Internal-link "Related" blocks
- [x] Add a "Related" block (3–4 keyword-rich internal links) to the bottom of the 14 EN SEO pages
      (already present as bottom "Get Started" link blocks; verified all 14 pages cross-link sibling
      convert/codec pages)
- [x] Mirror in all 7 locales
- [x] Ensure blog posts link back to the new long-tail pages (supports Checkpoint 5)
- [x] Build verify

### Checkpoint 5 — Blog posts (informational top-funnel)
- [x] EN: "How to Compress a Video for Email in 2026" (links to `video-compressor`)
- [x] EN: "Best Video Format for YouTube / Social Media 2026" (links to `convert/*`, `codecs/*`)
- [x] EN: "How to Extract Audio from Video for Free" (links to `extract-audio-from-video`)
- [x] Translate each to all 7 locales
- [x] Add to RSS (script picks up automatically) + verify feed
- [x] Build verify

### Checkpoint 6 — Image optimization
- [x] Audit all SEO pages for `<img>`/markdown images; add descriptive alt text
- [x] Set per-page `og:image` where it makes sense (frontmatter already supports `ogImage`)
- [x] Confirm `width`/`height` present to avoid CLS
- [x] Build verify

### Checkpoint 7 — Performance / Core Web Vitals
- [x] Confirm lazy-loading of below-fold images
- [x] Re-check the preload of `icon_380.webp` (only on pages where it's the LCP)
- [x] Confirm page-level JS chunk sizes stay under the 700 KB warning budget
- [ ] (Manual) Run Lighthouse on 3–4 SEO pages and record scores in the tracker below

### Checkpoint 8 — Final cross-locale + sitemap verify
- [x] Regenerate/verify `feed.xml` and `sitemap.xml` include all new routes (all 8 locales)
- [x] `npm run docs:build` passes with exit 0
- [x] Spot-check nav in a built page for every locale (no `label` "⋯" regression)
- [ ] Final `git status` review; ask user before committing

---

## Lighthouse Baseline Tracker

| Page | Perf | SEO | A11y | Date |
|------|------|-----|------|------|
| (fill after Checkpoint 7) | - | - | - | - |

---

## Keyword Cannibalization Guardrails

- `ffmpeg-gui` vs `ffmpeg-gui/{windows,macos,linux}`: kept distinct by targeting platform intent;
  each is internally linked, not duplicated.
- New `convert/*-to-mp4` pages must be distinct by source format (flv/wmv/m4v/webm), never duplicate
  the generic `video-converter` page's copy.
- `extract-audio-from-video` should not compete with `audio-converter`; give it the
  step-by-step "how to extract" angle and link it to the tool page.

## Risks / Notes

- Scope is large (each page × 8 locales). Implement Checkpoint-by-Checkpoint and verify the build
  after every checkpoint, per the established working pattern. Do **not** delegate to parallel
  sub-agents for file writes (endpoint unavailable) — write files directly.
- Do not commit until the user explicitly asks (per standing instruction).
