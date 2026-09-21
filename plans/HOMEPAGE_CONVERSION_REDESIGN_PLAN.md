# Plan: Homepage Conversion Redesign & Download Friction Fix (Sept 2026 Site Review)

## Goal

Implement the September 2026 external site review on `encodex.in`. Core verdict:

> **EncodeX has a stronger product story than the homepage currently communicates visually.**

The SEO foundation is already extensive (7 locales, topic-cluster pages, structured data,
RSS, sitemap, clean URLs). The biggest remaining opportunity is **converting visitors into
downloads** — via a visual hero, a simplified download decision, goal-oriented messaging, and
verifiable open-source trust signals.

This plan turns every review recommendation (#1–#20) into concrete, repo-grounded work items:
VitePress site in `site/`, analytics in `site/.vitepress/theme/composables/useAnalytics.ts`,
structured-data engine in `site/.vitepress/config.mts`.

**North-star positioning change (adopt everywhere):**

> From: _"Here's a powerful FFmpeg application with lots of features."_
> To: **"Tell EncodeX what you want to do with your media. It handles the technical stuff."**

## Status Legend

- `[ ]` Not started
- `[/]` In progress
- `[x]` Done
- `(manual)` Requires external action (GSC, screenshot capture, GA4 admin, etc.)
- `(verified)` Work already exists in repo — the gap is copy/visual, not a rebuild

## Current State Assessment (verified 2026-09-20)

| # | Review item | State in repo | Action needed |
|---|-------------|---------------|---------------|
| 1 | Hero redesign | `index.md` uses `layout: home`; image slot renders only `icon.webp` via `HeroLogo.vue`; `#home-hero-after` = `VersionBadge` social-proof band | Swap hero image to app screenshot; add eyebrow, trust strip, dual CTAs |
| 2 | Big product screenshot | `home_dashboard.webp`(+`_800`) shown mid-page in "See It In Action" (`index.md:90`) | Move to hero / enlarge; make it the LCP; preload it |
| 3 | Homepage hierarchy | Long flat page (pain cards → screenshot → privacy → 7 cards → MCP → why → personas → tools → CTA) | Reorder into the review's 8-block structure; demote advanced features |
| 4 | MCP dedicated page | Homepage section + `blog/releases/mcp-server-support.md` + `features.md` section. **No `/mcp` page** | Create `/mcp` landing page; add Mermaid flow |
| 5 | SEO architecture | Strong topic cluster already live | Keep; expand carefully — no doorway pages |
| 6 | SEO title strategy | Homepage title = "EncodeX — Free, Open-Source FFmpeg GUI for Windows, macOS & Linux" (`index.md:3`) | Test "video converter"-led variant; keep H1 parity |
| 7 | "Free forever" messaging | `index.md:174` "💚 Completely Free, Forever" tip | Lead with "Open source (MIT)"; free-forever secondary |
| 8 | GitHub/social-proof card | `VersionBadge` band already shows release, downloads, stars, clones; `stars.data.mts` loader exists | Add a distinct in-body "Open Source" credibility card |
| 9 | Download simplification | `download.md` lists all rows; `LatestDownloads.vue` already detects OS/arch (UA + Client Hints) with "✓ Recommended" | Add a `primary` single-decision mode to `LatestDownloads` |
| 10 | ~400 MB size | `download.md:68` mentions it briefly | Make an explicit "Why is EncodeX ~400 MB?" benefit block |
| 11 | 140+ profiles prominence | One feature card (`index.md:139-141`) | Add "Choose your goal, not a codec" visual section |
| 12 | Goal-oriented language | Plain-language copy strong; codec names still lead in "Popular Tools & Guides" | Goal-first framing; technical names secondary |
| 13 | "What format should I choose?" page | Does not exist | Create `learn/what-format-to-use` (EN + 6 locales) |
| 14 | Comparison section | `handbrake-alternative.md` exists w/ factual table + locales | Strengthen; optionally add Shutter Encoder / FFmpeg CLI |
| 15 | "Why EncodeX?" section | Exists as "Why People Love EncodeX" cards (`index.md:178-209`) | Restyle into a scan-friendly grid |
| 16 | Workflow illustration | None | Mermaid Drop→Choose→Convert→Done (plugin installed) |
| 17 | Navigation | `config.mts` nav: Home/Features/Use Cases/Download/**Tools mega-menu**/Docs/Blog/Contributing | Group into Product / Tools / Resources / Community |
| 18 | Footer | `SiteFooter.vue`: Product/Community/Support columns | Add "Project" column (GitHub · Releases · License · Contributing · Security · Contact) |
| 19 | Trust & Safety page | `privacy.md` covers privacy + website telemetry | Expand explicit telemetry statement; add Security page |
| 20 | Blog SEO | 12 posts + 8 releases already shipped (`site/blog/`) | Add cluster nav; fill missing intents; every post ends with download CTA |

---

## Phase 1 — Visual Conversion (highest impact)

### P1-1. Redesign the hero (review #1, #2, #6)

**Files:** `site/index.md`, `site/.vitepress/theme/components/HeroLogo.vue`,
`site/.vitepress/theme/CustomLayout.vue`, `site/.vitepress/config.mts`

VitePress `layout: home` natively renders text-left / image-right on desktop — no custom
hero component needed:

**Left column**
- Eyebrow via `hero.name` (VitePress renders it as the badge above the headline):
  `FREE & OPEN SOURCE · WINDOWS · macOS · LINUX`
- `hero.text`: `FFmpeg power. Without the command line.`
- `hero.tagline`: `Convert, compress, trim, and extract media with a simple desktop app powered by FFmpeg — entirely on your computer.`
- `hero.actions`:
  1. brand → `Download EncodeX` → `/download`
  2. alt → `View on GitHub →` → `https://github.com/Sandeepv68/EncodeX`

**Right column — app screenshot instead of the logo**
- `HeroLogo.vue` renders `/images/home_dashboard.webp` with the existing `home_dashboard_800.webp`
  srcset, explicit `width`/`height` (1150×619), `loading="eager"`, `fetchpriority="high"`, and an
  informative alt ("EncodeX dashboard with a video loaded and a YouTube 1080p profile selected").
- Keep the `VersionBadge` hero band (`#home-hero-after`) so release + downloads + stars stay as
  social proof under the CTAs.

**Trust strip (first content block of `index.md`)**
```
✓ Free forever   ✓ No account   ✓ No watermark   ✓ 100% local
```

**LCP hygiene (must-do with this change)**
- `config.mts:3279` preloads `icon_380.webp` with `fetchpriority="high"`. Switch the preload to
  `/images/home_dashboard_800.webp` so the hero screenshot is the LCP and loads first.
- Keep CLS at 0 by preserving `width`/`height` + `sizes` on the hero image.
- Set `ogImage: "/images/home_dashboard.webp"` in `index.md` frontmatter (currently falls back to
  `banner.webp` at `config.mts:3329`) so shared links preview the app.

**SEO title decision (review #6)**
- Today: `EncodeX — Free, Open-Source FFmpeg GUI for Windows, macOS & Linux`.
- Deploy a "video converter"-led variant and monitor GSC click-through ~4 weeks:
  `EncodeX — Free FFmpeg Video Converter for Windows, Mac & Linux`.
- Keep the in-page H1 as the product claim (`FFmpeg power. Without the command line.`).
- One title per locale (7 locales) — treat as a decision, deploy, then record impressions/CTR.

**New homepage copy (review #3, #12)** — rebuild `site/index.md` block order:

```text
1.  Hero (upgraded: screenshot, trust strip, dual CTA, version band)
2.  Core jobs — "What can I do with it?" (Convert · Compress · Trim · Extract · Batch)
3.  Product demo — big dashboard image, "Everything you need. One simple window."
4.  Choose your goal, not a codec (P2-5)
5.  "Sound Familiar?" pain cards (kept — they convert)
6.  Why EncodeX? scan-friendly grid (P1-4)
7.  Advanced capabilities (GPU · 140+ profiles · CLI · MCP) — demoted, not center stage
8.  Platforms (Windows · macOS · Linux)
9.  Open Source credibility card (P2-8)
10. Final "Ready to try EncodeX?" CTA (existing `cta-card`)
```

Directives: move "Let AI Do the Heavy Lifting" and "Built for Beginners. Powerful enough for
Developers." into the advanced block; trim repetitious wide cards to one concise section per core
job; lead every feature with the **goal**, show technical codec names only as subtle suffixes.

### P1-2. Simplify the download page (review #9, #10)

**Files:** `site/.vitepress/theme/components/LatestDownloads.vue`, `site/download.md`

The component **already** detects OS/arch (sync UA tokens + async User-Agent Client Hints,
`LatestDownloads.vue:398-432`) and marks the recommended row. The gap is that all rows render at
once = decision fatigue. Add:

1. **`primary` prop mode** on `LatestDownloads`:
   - Render one large card for the recommended row of the detected platform (fall back
     `win-x64` → `mac-arm64` → `linux-x86_64` per platform group).
   - Big button **"Download for Windows"** (localized label), with `x64 · 383 MB · Most Windows PCs`
     beneath (values pull from the already-loaded release asset data).
   - Below, a `<details>` "Other downloads" carries the remaining rows (existing markup) so
     checksums, ARM64/32-bit, macOS, Linux and previous versions stay reachable but out of the
     primary path.
   - Keep the "✓ Recommended" detection badge on the chosen row.
2. **Copy honesty guardrail:** detection is best-effort; do not literally claim "We detected
   Windows 11" (UA cannot reliably distinguish 10 vs 11). Use "We recommend" language.
3. **"Why is EncodeX ~400 MB?" block** in `download.md`, turning the objection into a benefit:

   > **Why is EncodeX about 400 MB?**
   > EncodeX bundles the FFmpeg engine and every supported component, so you never install
   > FFmpeg, codecs, or anything else separately — and you never download extras later.

   Place it inside "What Your Computer Needs" (`download.md:63`) and link to `features.md`'s
   local-processing story.
4. Mirror the copy in 6 locales (`site/locales/*/download.md`).

### P1-3. Analytics wiring for the new CTAs

**File:** `site/.vitepress/theme/composables/useAnalytics.ts` (already has `trackEvent`,
`trackDownload`, `trackDownloadConversion`)

- Reuse `trackEvent('cta_click', { cta: 'hero-download' })` on the hero brand CTA and the
  open-source card CTA (`cta: 'oss-card-download'`) so we can measure which surface converts.
- Keep `generate_lead` on every download click (already wired for `LatestDownloads`).
- No change needed for the `VersionBadge` band (already wired).

### P1-4. Restyle "Why EncodeX?" and the trust section (review #15, #7)

**Files:** `site/index.md`, `site/.vitepress/theme/custom.css`

Convert the current "Why People Love EncodeX" cards into a scan-friendly grid leading with the
differentiators:

- 🔒 **Private** — your media stays on your computer
- 🆓 **Free & open source** — MIT license, no subscription, no account (lead with open source)
- ⚡ **Hardware accelerated** — uses your GPU automatically
- 🌎 **35+ languages** — including right-to-left
- 🚫 **No watermark**
- 📴 **Works offline**

Replace the "💚 Completely Free, Forever" tip (`index.md:174`) with a "🆓 **Free & Open Source
(MIT)**" tip linking to GitHub, `LICENSE`, and the new credibility card (P2-8). Keep the
"Completely Free, Forever" phrasing as supporting copy, not the headline claim.

---

## Phase 2 — Conversion-Supporting Content & SEO

### P2-5. "Choose your goal, not a codec" — 140+ profiles visual (review #11, #12)

**Files:** `site/index.md` (+ 6 locale mirrors)

New homepage block using the existing `card-grid` markup (no new images needed):

```
## Choose your goal, not a codec

Over 140 built-in profiles do the configuring. You just say what you want.

📱 Phone          → small MP4 that plays anywhere
▶️ YouTube        → 1080p MP4
📸 Instagram      → 1080p H.264
💬 WhatsApp       → compact MP4
📧 Email          → small MP4
🎬 Video editing  → ProRes 422
```

Each card links to its relevant existing page (`/video-compressor`, `/platforms/*`,
`/codecs/prores`, etc.) and fires `trackFeatureClick`. Technical names (H.264, ProRes) appear only
as secondary labels. Close with the positioning line:

> **You don't need to understand codecs. Just choose what you're trying to do.**

### P2-6. "What video format should I choose?" page (review #13)

**New page (EN + 6 locale mirrors):** `site/learn/what-format-to-use.md` → `/learn/what-format-to-use`

- Intro: "If 'file format' sounds like jargon, start here."
- Decision table (each row links to its existing landing page):

  | I want to...           | Choose           |
  |------------------------|------------------|
  | Play almost anywhere   | MP4 / H.264      |
  | Make the file smaller  | H.265 / HEVC     |
  | Upload to the web      | WebM / VP9       |
  | Edit professionally    | ProRes           |
  | Archive without loss   | FFV1 / MKV       |
  | Send by email          | Small MP4        |
  | Extract the music      | MP3 / AAC        |
  | Keep streams untouched | Remux (MP4↔MKV)  |

- Close with "**Not sure? EncodeX can choose for you** → [Download](/download)".
- Register in `config.mts`: `seoLandingPages` + `seoLandingPagesTranslations` (Breadcrumb), one
  generic `seoHowTo`, the "Learn" nav menu, and homepage "Popular Tools & Guides" grid.
- Build verify after EN; then mirror to 6 locales.

### P2-7. Strengthen the HandBrake comparison (review #14)

**File:** `site/handbrake-alternative.md` (+ 6 locales)

The factual table exists. Improvements:
- Add a short "comparison methodology / sources" note (keeps it trustworthy and defensible).
- Add an "EncodeX vs HandBrake vs FFmpeg CLI vs Shutter Encoder" mini-table on `handbrake-alternative.md`
  or a new `site/comparison.md`, only claiming verified capabilities.
- Cross-link from `ffmpeg-gui.md`, `learn/what-is-ffmpeg.md`, the home page, and both blog
  comparison posts (`handbrake-alternative-guide`, `best-free-video-converter-2026`).

### P2-8. In-body "Open Source" credibility card (review #8)

**New component:** `site/.vitepress/theme/components/OpenSourceCard.vue`

Data already exists — reuse `releaseShared.ts` (`getReleases`, `getRepoStats`) and the
`stars.data.mts` build snapshot, same as `VersionBadge.vue`. Card shows:

```
          Open Source
          ★ GitHub · MIT License
          1,900+ downloads · 3 platforms · 35+ languages
          [ View on GitHub ]
```

Plus links: Repository · Releases · License (MIT) · Contributing · Star/Clone counts when
available (hide gracefully when API data is missing, matching `VersionBadge` behavior).
Place it as the "Open Source" block on the homepage (#9 in the ordering above) and link it from
`P1-4` and the footer `Project` column.

### P2-9. Navigation & footer cleanup (review #17, #18)

**Files:** `site/.vitepress/config.mts` (nav arrays + `toolsNav()`), `SiteFooter.vue`

- Rebalance nav to four groups while **keeping the Tools mega-menu items intact for SEO** (they
  are the topic cluster) but visually collapse them under clearly separated items:
  - **Product:** Features · Use Cases · Download
  - **Tools:** (existing mega-menu: Convert / Codecs / Compress / Extract / Platforms)
  - **Resources:** Docs · Learn (What is FFmpeg · What format should I choose) · Blog
  - **Community:** GitHub · Contributing · MCP
  - Final structure decided in code; goal is fewer visible top-level links, same URLs.
- `SiteFooter.vue`: add a **Project** column — GitHub · Releases · License (MIT) · Contributing ·
  Security · Contact. Add the one-line descriptor "EncodeX is an open-source multimedia application
  built around FFmpeg." above the columns so the footer establishes the project identity.
- Mirror any visible string changes across locale-array entries in `config.mts` / `SiteFooter.vue`.

---

## Phase 3 — Differentiation

### P3-10. Dedicated MCP page (review #4)

**New page (EN + 6 locale mirrors):** `site/mcp.md` → `/mcp`

Target keywords: FFmpeg MCP server · media MCP server · video conversion MCP · EncodeX MCP ·
AI video converter · Claude FFmpeg · Cursor FFmpeg.

Content plan:
- H1: **Your AI can control EncodeX** — "Convert media using natural language."
- Example prompts block (from the review): `Convert vacation.mp4 to a smaller MP4 suitable for WhatsApp.`
- Flow diagram via Mermaid (`MermaidMarkdown` is already configured in `config.mts:3230-3234`):

  ```mermaid
  flowchart TD
    A[Claude / Cursor / VS Code] --> B[MCP Server]
    B --> C[EncodeX]
    C --> D[FFmpeg]
    D --> E[converted.mp4]
  ```

- Feature cards: base the copy on `features.md` "Let an AI Assistant Drive" — 19 tools, stdio +
  localhost modes, access token, localhost-only binding, async jobs.
- "Get started" section: run `encodex --mcp`, or Settings → MCP Server; link `/docs/cli#mcp-server-mode`.
- Wire links: homepage advanced block, `use-cases.md`, footer, `blog/releases/mcp-server-support.md`.
- Register in `config.mts`: nav, `seoLandingPages`/translations (Breadcrumb), `seoFAQ`/translations.

### P3-11. CLI page polish + workflow steps visual (review #16)

- `site/cli.md` already exists — add the four-step workflow strip using Mermaid or a simple
  HTML/CSS step list: **1. Drop** (`vacation.mkv`) → **2. Choose** (`📱 Phone`) → **3. Convert**
  (`✓ MP4 1080p`) → **4. Done** (`vacation.mp4`). Reuse `card-grid`/CSS.
- Add a "Workflow" section to the homepage product-demo block with the same four steps so the
  "simple FFmpeg" story is shown rather than told.

### P3-12. Trust & Safety / telemetry (review #19)

**Files:** `site/privacy.md` (+ locales); optionally new `site/security.md`

- Expand `privacy.md` with an explicit **"What telemetry exists"** section:
  - Website: cookie-less GA4 page-views (already disclosed) — link GSC/privacy analytics.
  - App: consent-gated Sentry monitoring/SDK breadcrumb channel (per
    `plans/SENTRY_MONITORING_PLAN.md`) — categorical-only events, zero media/usage PII, opt-out.
  - State clearly: no uploads, no cloud processing, no account, offline-capable.
- Add `site/security.md` (EN + locales): responsible disclosure (SECURITY.md exists in repo),
  how signing/verification works (SHA-256 checksums), macOS Gatekeeper note, update integrity.
- Wire links: homepage privacy band, footer, `download.md`.

### P3-13. Blog clusters & goal-oriented guide pages (review #20)

Existing posts are already strong (12 posts + 8 releases). Do **not** duplicate existing topics.
Add only genuinely-missing intents, EN first then locales:

- **Cluster: video format choice** — `what-is-the-best-video-format.md` (link `/learn/what-format-to-use`)
- **Cluster: platform profiles** — `how-to-convert-video-for-youtube.md`,
  `how-to-convert-video-for-instagram.md`, `how-to-convert-video-for-whatsapp.md`
  (each links `/video-converter`, `/video-compressor`, the goal cards on the homepage).

Guardrails: each post 800–1500 words, unique angle vs. existing landing pages and posts, proper
frontmatter (`date` required for RSS — `scripts/generate-rss.mjs`), FAQ block, ends with the
recurring CTA: **"Do this with EncodeX → Download."** Link each cluster member to its siblings.

### P3-14. SEO title/description sweep

Audit every remaining page title so the "video converter / FFmpeg GUI for {platform}" intent leads
(in `config.mts` transformHead fallback + each page's frontmatter). See
`plans/SEO_KEYWORD_OPTIMIZATION_PLAN.md` for the established keyword map. No new infra needed —
this is a copy pass + build verify. `(manual)` re-submit sitemap in GSC afterward.

---

## New Page Inventory (all EN + 6 locale mirrors)

| Page | Slug | Type | Phase |
|------|------|------|-------|
| MCP landing | `/mcp` | SEO + differentiation | 3 |
| Format guide | `/learn/what-format-to-use` | SEO + beginner UX | 2 |
| Comparison page (optional) | `/comparison` | SEO | 2 |
| Security page | `/security` | Trust | 3 |
| Blog: best video format | `/blog/posts/…` | SEO cluster | 3 |
| Blog: platform profiles (3 posts) | `/blog/posts/…` | SEO cluster | 3 |

Every new markdown file must include: unique title/description, `ogImage`, FAQ (where applicable),
internal links (no orphans — link BOTH ways), and registration in `config.mts` maps + nav.

## Files to Modify

| File | Change | Phase |
|------|--------|-------|
| `site/index.md` | Hero upgrade, trust strip, reordered blocks, goal grid, OSS card block, rewritten copy | 1, 2 |
| `site/.vitepress/theme/components/HeroLogo.vue` | Render dashboard screenshot (eager, fetchpriority high, srcset) | 1 |
| `site/.vitepress/theme/components/LatestDownloads.vue` | Add `primary` single-decision mode | 1 |
| `site/.vitepress/theme/components/OpenSourceCard.vue` | New in-body credibility card | 2 |
| `site/.vitepress/theme/components/SiteFooter.vue` | Project column + project descriptor | 2 |
| `site/.vitepress/theme/composables/useAnalytics.ts` | `cta_click` events for hero + OSS card | 1 |
| `site/.vitepress/theme/custom.css` | Styles for trust strip, goal grid, step strip, OSS card | 1, 2 |
| `site/.vitepress/config.mts` | Hero preload swap, nav grouping, new pages in maps/locale arrays | 1, 2, 3 |
| `site/download.md` | `primary` download block + ~400 MB explainer | 1 |
| `site/handbrake-alternative.md` | Methodology note + extra comparison | 2 |
| `site/cli.md` | Workflow steps visual | 3 |
| `site/privacy.md` (+ locale mirrors) | Explicit telemetry section | 3 |
| `site/mcp.md` (new) | MCP landing page | 3 |
| `site/security.md` (new) | Security page | 3 |
| `site/learn/what-format-to-use.md` (new) | Format guide | 2 |
| `site/locales/*/…` | Mirror every copy/page change (6 locales) | all |

## Verification Checklist

After each checkpoint run `npm run docs:build` and confirm:
- [ ] Build exits 0; no dead internal links (repo pattern: zero dead links)
- [ ] Homepage LCP is the hero screenshot; preload points to `home_dashboard_800.webp`
- [ ] CLS remains 0; `ogImage` on homepage = `home_dashboard.webp`
- [ ] `/download` primary card shows exactly one recommended button + "Other downloads" collapse
- [ ] New pages render in all 7 locales with Breadcrumb/FAQ JSON-LD and noindex absent (except `docs/*` locales, unchanged)
- [ ] Sitemap + RSS regenerate; new posts appear in `feed.xml`
- [ ] Lighthouse pass recorded for `/`, `/download`, `/mcp` (extend the existing tracker in
      `PRODUCT_LAUNCH_GROWTH_PLAN.md`)
- [ ] No locale regression: run `npm run validate:locales`
- [ ] Strings-only components keep EN fallback for all locales (existing pattern)

## Decisions

| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | Hero title vs copy | Deploy the "FFmpeg Video Converter" title variant; keep H1 claim; measure CTR in GSC |
| 2 | Download page | Simplification via a `primary` mode on the existing component — do not rewrite from scratch |
| 3 | "We detected Windows 11" | Do NOT claim exact OS; use "We recommend" (UA limits) |
| 4 | New pages | Create only the 5 page types above — avoid doorway/thin pages and cannibalization |
| 5 | MCP diagram | Mermaid (already via `vitepress-plugin-mermaid`) — no new image assets |
| 6 | Media/assets | Reuse existing `home_dashboard*.webp`, `*.webp` feature shots; only new binary if a hero mockup is desired |
| 7 | A/B testing | Out of scope (no infra); use sequential decision + GSC monitoring |

## Risks

- **Locale scope creep:** every page × 7 locales balloons effort. Batch by block (hero → download →
  goal grid → new pages) and build-verify each batch. Write files directly; do not parallel-write
  locales via sub-agents (established pattern).
- **LCP regression:** swapping the hero image can hurt LCP/TBT. Mitigate with preload + sizing +
  Lighthouse check immediately after P1-1.
- **GA4 `cta_click` naming:** coordinate with existing GA4 custom dimensions (`os_arch`
  `dimension4` already defined) so event names do not collide.
- **Trust claims:** every number in the OSS card must come from live data (`releaseShared.ts`);
  hide metrics when the API is unavailable (mirror `VersionBadge` guardrails).
- **Do not commit/push unless the user explicitly asks** (standing instruction).

## Success Metrics (review against GSC/GA4 after 4 weeks)

| Metric | Baseline | Target |
|--------|----------|--------|
| Homepage CTR from GSC | record current | +50% relative |
| New pages indexed | — | 100+ pages total indexed |
| Download primary-card clicks | record current | hero + download-page CTA dominate `download_click` |
| Bounce / scroll depth on `/` | record with existing `scroll_depth` events | 90% scroll threshold up 20 pts |
| CTA mix (`cta_click`) | n/a (new event) | hero-download is the top surface |
| Lighthouse Perf on `/` | 59 | ≥ 75 |

## Notes

- Source of truth for the review: Sept 2026 site review of encodex.in (homepage, features,
  download, SEO pages) provided by the user.
- Related plans: `SEO_IMPROVEMENT_PLAN.md` (Phase 3 technical SEO — already largely shipped),
  `PRODUCT_LAUNCH_GROWTH_PLAN.md` (positioning, homepage, download first pass — extends this plan
  rather than duplicating it), `SEO_KEYWORD_OPTIMIZATION_PLAN.md` (keyword map).
- The single most important strategic shift this plan implements:
  **show the product and let the user choose goals, not codecs**.