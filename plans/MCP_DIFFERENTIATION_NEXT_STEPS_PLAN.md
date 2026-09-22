# Plan: MCP Differentiation & Site Next Steps (Sep 21, 2026 Review — v2)

## Goal

Implement the second September 2026 external review of `encodex.in`. Verdict:

> **EncodeX has moved from a software-project landing page to a real product website.**
> The biggest untapped opportunity is turning the **MCP/AI capability into the distinctive
> reason people remember EncodeX**, rather than competing in the crowded "free FFmpeg GUI"
> category.

Most of the v1 review (`plans/HOMEPAGE_CONVERSION_REDESIGN_PLAN.md`) is now shipped: hero
screenshot, trust strip, goal-grid, download `primary` mode, `/mcp` page, `/security`, format
guide, and the YouTube/WhatsApp/Instagram how-to posts. This plan only touches the deltas the
v2 review calls out, **verified against the current repo on 2026-09-21**.

**North-star shift this plan implements:**

> From: _"EncodeX supports MCP."_
> To: **"An FFmpeg desktop app that AI agents can control — let Claude, Cursor, or VS Code
> operate your local media toolkit in natural language."**

## Status Legend

- `[ ]` Not started
- `[/]` In progress
- `[x]` Done
- `(verified)` Work already exists in repo — the gap is copy/visual, not a rebuild
- `(manual)` Requires external action (CDN cache check, GSC, screenshot capture, GA4)

## Current State Assessment (verified 2026-09-21)

| # | Review item | State in repo | Action needed |
|---|-------------|---------------|---------------|
| D1 | Stale beta.3/beta.4 release data | Release data fetched from GitHub API at build (`release.data.mts`, `releases.data.mts` in `site/.vitepress/data/`) + polled client-side (`VersionBadge.vue`). **No hardcoded version strings** outside the legit release blog posts (`site/blog/releases/1.0.0-beta.{3,4}.md` + locale mirrors). Both tags exist on GitHub | Verify it is crawler/CDN cache, not stale serving; add cache/normalization guardrails; re-verify after deploy |
| D2 | Visual MCP demo | Homepage explains MCP only with text cards (`site/index.md:191-218`); `/mcp` has a Mermaid flow diagram but no live-feel demo | Add a conversation + progress mockup demo block to homepage and `/mcp` |
| D3 | MCP as hero-level differentiator | Hero = `FFmpeg power. Without the command line.` (`site/index.md:9`); CTA `Download Now — It's Free` (`index.md:16`); no MCP echo line | Add MCP secondary line under the hero tagline + a claim badge; test stronger CTA copy |
| D4 | Dedicated `/mcp` landing page | **Exists** (`site/mcp.md`) with Mermaid flow, two connection modes, privacy section, FAQ. No copy-paste configs, no demo, no CTA buttons | Upgrade, not create: add demo, copy-paste configs, CTA funnel, broader keyword coverage |
| D5 | Copy-paste MCP configurations | Not present anywhere | Add Claude Desktop / Claude Code / Cursor / VS Code config blocks with *Copy* and *Open instructions* buttons to `/mcp` |
| D6 | Download-page CTA hierarchy | `LatestDownloads` `primary` mode exists (`site/download.md:20`); OS/arch + "✓ Recommended" detection already shipped (v1 P1-2) | Add "Not sure? Download x64" framing + test `Download EncodeX — Free & Open Source` CTA copy |
| D7 | FAQ sections on SEO pages | `seoFAQ` engine covers **24 slugs** (JSON-LD + visible FAQ via `config.mts:813`) | Fill remaining conversion/codec/ffmpeg-gui slugs (see D7 section) with no orphan content |
| D8 | Internal linking between conversion pages | Each `site/convert/*.md` links 2–4 siblings; no shared "Related conversions" block | Add shared related-tools navigation; wire bidirectional |
| D9 | Comparison pages | `handbrake-alternative.md` (+6 locales) exists with factual table; blog `handbrake-alternative-guide` exists | Add Shutter Encoder + FFmpeg CLI mini-comparison and a methodology note |
| D10 | Intent-driven pages (WhatsApp / Reels how-tos) | Blog posts `how-to-convert-video-for-whatsapp.md`, `...-for-instagram.md`, `...-for-youtube.md` **exist** (+ locales) | Add compression-intent variants only where genuinely missing; do not duplicate |
| D11 | MCP/AI automation blog/tutorial series | None | New tutorial cluster: MCP quickstart, batch automation, Cursor/Claude workflows |

---

## Phase 1 — >MCP: the primary marketing pillar (P0)

> **Status: P1-1 done · P1-2 done · P1-3 done · P1-4 done**

### P1-1. Verify release-data freshness (review D1/section "One thing I noticed") — `[x]` DONE

**Files (read-only first):** `site/.vitepress/data/release.data.mts`, `releases.data.mts`,
`releaseShared.ts`, `site/.vitepress/theme/components/VersionBadge.vue`, `LatestDownloads.vue`

1. `(manual)` Hit the live endpoints right after next deploy and confirm the homepage/`download`
   bandwidth shows **beta.4**:
   - `curl -sI https://encodex.in/download/` (check `cache-control`, `age`, `cf-cache-status`)
   - `curl -s https://encodex.in/` and grep `beta.3`/`beta.4`
   - Discrepancy that persists after full-surge purge = stale edge cache; clear via CDN.
2. Confirm GitHub `releases/latest` returns beta.4 (`curl -s https://api.github.com/repos/Sandeepv68/EncodeX/releases/latest`).
3. Guardrails (only if a real staleness path is found):
   - Ensure `LatestDownloads.vue`/`VersionBadge.vue` sort by `publishedAt`, not fetch order.
   - Add `fetchedAt` timestamping awareness so a build-time failure falls back to client fetch
     (already genuine defaults in `release.data.mts` — verify no swallowed errors).
4. `(manual)` Re-submit sitemap in GSC after deploy so crawlers drop the stale snapshot.

**Result (2026-09-21):** GitHub `releases/latest` = `v1.0.0-beta.4`; live homepage SSRs
`v1.0.0-beta.4 · sep 2026 · 1,978 downloads` (`VersionBadge`). Every `beta.3` string on the live
page is a VitePress `__VP_HASH_MAP__` build-hash entry from the legit beta.3 release blog post —
not a served release. No real staleness path exists, so **no code guardrails were added**.
Remaining items are `(manual)` and post-deploy only: live curl cache checks + GSC sitemap re-submit.

### P1-2. Visual MCP demo (review D2) — highest-value marketing improvement — `[x]` DONE

**New component:** `site/.vitepress/theme/components/McpDemo.vue`
**Registration:** `site/.vitepress/theme/index.mts`, `site/.vitepress/config.mts` (head preload-safe)

Render a CSS-only "conversation + progress" mockup (no new binary assets — CSS/HTML only):
- Chat panel, left: user message, right: assistant reply.
- Assistant: "I'll convert 12 videos using EncodeX."
- Progress panel: animated weighted bar `████████████████░░ 87%` + per-file checkmarks
  (`✓ video1.mp4`, `✓ video2.mp4`, `✓ video3.mp4`, …).
- Closing tagline under the demo: **"Your AI assistant can now operate your local media toolkit."**
- Accessibility: `aria-hidden` for the decorative animation, static fallback text, reduced-motion
  media query.

**Placement:**
- Homepage: directly after the trust strip ("Let AI Do the Heavy Lifting" moves up to #2 in
  block order below).
- `/mcp`: after the H1 lead paragraph.

**Result:** `McpDemo.vue` created (chat mockup + animated progress bar
`████████████████░░ 87%` + per-file checkmarks + closing tagline, `aria-hidden` decorative
animation, static fallback label, reduced-motion media query), registered in `theme/index.mts`,
styled via `.mcp-demo*` blocks in `custom.css`. Placed on homepage (new MCP section at #2) and
`/mcp` (after intro) — EN + all 6 locales.

### P1-3. MCP as a hero-level differentiator (review D3) — `[x]` DONE

**Files:** `site/index.md` (+ 6 locale mirrors), `site/.vitepress/theme/custom.css`

1. Add a secondary line under `hero.tagline` (VitePress `hero` frontmatter block or an
   `#home-hero-after` element):
   > **Now with MCP — let Claude, Cursor, or VS Code control EncodeX using natural language.**
   - Static label is fine; write it into `index.md` after the hero frontmatter so `HeroCustom`
     renders it in all locales. Keep it subtle — the GPU/CLI claims stay demoted.
2. Add an `🤖 MCP` pill/badge to the existing trust strip (alongside Free forever · No account ·
   No watermark · 100% local).
3. **CTA copy test (sequential, no A/B infra needed):** change primary CTA text from
   `Download Now — It's Free` to `Download EncodeX — Free & Open Source`, and add a microline
   beneath: `Windows · macOS · Linux · No account required`. Record GA4 `cta_click` before/after
   (`useAnalytics.ts` already tracks `hero-download`).

**New homepage block order (revised from v1):**
```text
1.  Hero (screenshot, trust strip w/ MCP pill, dual CTA)
2.  MCP demo (P1-2) — "the hook"
3.  Core jobs — "What can I do with it?"
4.  In one simple window (4-step workflow)
5.  Privacy band
6.  Choose your goal, not a codec
7.  Why EncodeX? grid
8.  GUI / CLI / MCP trio (kept — gives MCP a home)
9.  SEO links grid ("Popular Tools & Guides")
10. Final CTA
```
Move "Sound Familiar?" pain-cards below the goal grid; keep but de-emphasize to reduce length.

**Result:** Hero `hero-subline` line added beneath tagline ("🤖 Now with MCP — let Claude, Cursor
or VS Code control EncodeX using natural language."), `🤖 Built-in MCP` pill added to the trust
strip, hero CTA text changed to localized `Download EncodeX — Free & Open Source`, and the old
text-card MCP block replaced by a new MCP section at **#2** with `<McpDemo />` + 4 capability
cards linking `/mcp` and `/docs/cli#mcp-server-mode`. Done EN + all 6 locales.

### P1-4. Upgrade the `/mcp` page into a conversion funnel (review D4) — `[x]` DONE

**File:** `site/mcp.md` (+ 6 locale mirrors)

Already present (keep): Mermaid flow, 19 tools / 3 resources / 4 prompts, stdio + embedded modes,
private-by-design, FAQ. Add:

1. **Demo block** (`<McpDemo />`) right after the intro paragraph.
2. **Example prompts** near the top (copy moves up from the homepage):
   - "Convert `vacation.mp4` to a smaller MP4 suitable for WhatsApp."
   - "Pull the audio out of `lecture.mov` as an MP3."
   - "Shrink the photos in `~/Pics` and put them in `~/Output`."
3. **MCP specific FAQ rows** in `config.mts` `seoFAQ` + `seoFAQTranslations` for `'mcp'`
   (already visibly on the page — now also JSON-LD structured data).
4. **Keyword scope** — title/heading already target "MCP Server for Video Conversion". Add the
   target terms the review lists to body copy where natural: *FFmpeg MCP server*, *MCP video
   converter*, *AI media automation*, *Claude FFmpeg*, *Cursor FFmpeg*, *local MCP server*.
5. Place P1-5 config section below "Two Ways to Connect".

**Result:** `/mcp` page upgraded EN + all 6 locale mirrors: title/description retargeted
("EncodeX MCP Server…" EN / localized equivalents), `<McpDemo />` after intro, 4 example prompts,
"FFmpeg MCP server / local MCP server / AI media automation" keyword phrasing, `## Connect in One
Paste` → `<McpConfig />` below "Two Ways to Connect", and end-of-page CTA card
(`cta-link-primary` → download). The FAQ/JSON-LD rows for the `mcp` slug are part of **P2-7**
(pending).

---

## Phase 2 — Developer conversion & internal SEO (P1)

> **Status: P2-5 done · P2-6 done · P2-7 done · P2-8 done**

### P2-5. Copy-paste MCP configurations (review D5) — `[x]` DONE

**New component:** `site/.vitepress/theme/components/McpConfig.vue`
**Files:** `site/mcp.md`, `site/.vitepress/theme/index.mts`, `custom.css`

Interactive config blocks with **Copy configuration** button (`navigator.clipboard`, fallback
`document.execCommand('copy')`), plus link buttons **Open Claude instructions** / **Open Cursor
instructions** / **Open VS Code instructions** (point to the respective vendor docs or
`/docs/cli#mcp-server-mode` if in-repo).

- **Claude Desktop**
  ```json
  {
    "mcpServers": {
      "encodex": {
        "command": "encodex",
        "args": ["--mcp"]
      }
    }
  }
  ```
- **Claude Code**: `claude mcp add encodex -- encodex --mcp`
- **Cursor**: Cursor Settings → MCP → Add server (command: `encodex --mcp`)
- **VS Code**: `.vscode/mcp.json` with the same JSON; or the VS Code MCP extension.
- **Embedded mode variant**: a second tab/section for `http://127.0.0.1:8765/mcp` (Settings →
  MCP Server) for clients that prefer HTTP.
- Localized string-only labels via existing locale slots in `config.mts` (EN default fallback).

**Result:** `McpConfig.vue` + `McpConfigBlock.vue` created and registered in `theme/index.mts`,
styled in `custom.css`; copy button uses `navigator.clipboard` with `document.execCommand('copy')`
fallback, plus vendor-doc links (Anthropic / Cursor / VS Code). All 4 clients covered
(Claude Desktop JSON, Claude Code `claude mcp add encodex -- encodex --mcp`, Cursor JSON,
VS Code `.vscode/mcp.json`) + embedded-HTTP variant block. **Deviation from plan:** localization
was implemented with in-component `STRINGS`/`CANON` maps (7 langs) rather than `config.mts` slots
— EN fallback preserved either way. `trackEvent('mcp_config_copy')` fires on copy.

### P2-6. Download page conversion hierarchy (review D6) — `[x]` DONE

**Files:** `site/download.md` (+ 6 locale mirrors), `LatestDownloads.vue` (only if copy, not
logic, changes)

1. Reinforce the recommended row: keep the big primary card, add the explicit reassurance line
   **"Not sure? Download x64 — Recommended for most Windows PCs."** under the Windows section
   (already conveys this; make it visually prominent, one line under the primary card).
2. CTA phrasing is decided in P1-3 (homepage); mirror the "Free & Open Source" phrase on the
   download page's H1/lead.
3. Add a single `cta_click` event for the primary card if not already covered by the existing
   `generate_lead` (verify in `LatestDownloads.vue`; reuse `trackDownloadConversion`).

**Result:** 
- Step 1 — **done all 7 locales**: bold "Not sure? Download x64 — Recommended for most Windows
  PCs." line added under the Windows section in EN + es + fr + de + pt + zh + hi (incl. fixed
  `an Windows ARM64` → `a Windows ARM64`).
- Step 2 — **done all 7 locales**: H1 → `Download EncodeX — Free & Open Source` (localized);
  lead line updated to "free & open source".
- Step 3 — **verified, no change needed**: `LatestDownloads.vue` primary card already fires
  `onPrimaryDownload()` → `trackDownload` + `trackDownloadConversion` (`LatestDownloads.vue:632-638`);
  no new `cta_click` event required.

### P2-7. Fill FAQ gaps on major SEO pages (review D7) — `[x]` DONE

**Files:** `site/.vitepress/config.mts` (`seoFAQ` + `seoFAQTranslations`, ~line 813 / 2053)

`seoFAQ` covers 24 slugs today; add rows (3 Q/A each, mirror to 6 locales) for the remaining
long-tail pages:

| Slug | Pages affected |
|------|----------------|
| `convert/avi-to-mp4` | `site/convert/avi-to-mp4.md` |
| `convert/mov-to-mp4` | `site/convert/mov-to-mp4.md` |
| `convert/m4v-to-mp4` | `site/convert/m4v-to-mp4.md` |
| `convert/flv-to-mp4` | `site/convert/flv-to-mp4.md` |
| `convert/wmv-to-mp4` | `site/convert/wmv-to-mp4.md` |
| `convert/webm-to-mp4` | `site/convert/webm-to-mp4.md` |
| `convert/mov-to-mkv` | `site/convert/mov-to-mkv.md` |
| `codecs/h264` · `codecs/h265` · `codecs/av1` · `codecs/vp9` · `codecs/prores` | codec pages |
| `ffmpeg-gui` · `ffmpeg-gui/windows` · `ffmpeg-gui/macos` · `ffmpeg-gui/linux` | `site/ffmpeg-gui*.md` |
| `mcp` | `site/mcp.md` (P1-4) |

Guardrail: every FAQ answer must be factually verifiable in-repo (`docs/features-reference.md`,
`docs/cli.md`, `releaseShared.ts`); no answers invented for pages we cannot support.

**Result:** `seoFAQ` new rows added for 15 slugs — `convert/avi-to-mp4`, `convert/mov-to-mp4`,
`convert/m4v-to-mp4`, `convert/flv-to-mp4`, `convert/wmv-to-mp4`, `convert/webm-to-mp4`,
`convert/mov-to-mkv`, the 5 codec pages (`h264`/`h265`/`av1`/`vp9`/`prores`),
`ffmpeg-gui` + `ffmpeg-gui/{windows,macos,linux}`, plus the `mcp` row from P1-4 — each
3 Q/A, mirrored to all 6 locales via `seoFAQTranslations` (`config.mts`). Verified in-repo;
`npm run validate:locales` passes (55 locales, key parity).

### P2-8. Stronger internal linking between conversion pages (review D8) — `[x]` DONE

**Approach:** shared "Related conversions" block into each `site/convert/*.md` + `compress/*`
(in EN + 6 locales):

1. Add a short reusable include/snippet with 4–6 sibling links, e.g. MKV page links
   `MP4 → MKV · MKV → WebM · MKV → MP3 · Extract MP3 · Compress MP4`.
2. Ensure **bidirectional** links (if A links B, B links A) — first pass is the FAQ-adjacent
   homepage "Popular Tools & Guides" grid (`index.md:330-345`) so the hub connects every convert
   page.
3. Two-or-fewer-clicks rule: every conversion page reachable from the homepage hub and from at
   least one sibling.

**Result:** New `RelatedConversions.vue` component (slug prop; per-locale heading; embedded
validated bidirectional REL graph — 20 nodes, every node 4–6 neighbors, A↔B symmetry; titles
from `h1s.json` keyed by canonical locale keys `pt`/`zh`; `href = LOCALE_PREFIX[lang] + '/' +
slug`), registered in `site/.vitepress/theme/index.mts`. **All 140 pages** (EN `convert/*` +
`compress/*` + 6 locale mirrors) got `<RelatedConversions slug="..." />` inserted before the last
`## ` heading — clean 2-line insertions, no line-ending churn. Homepage hub extended:** `site/
index.md` + all 6 locale index pages gained 16 new tool cards (every convert/compress page incl.
`compress/mkv`). Verified: `docs:build` passed; rendered HTML shows 4–6 locale-prefixed related
links per page (en/es/zh/hi spot-checked).

---

## Phase 3 — Growth content (P2)

> **Status: P3-9 done · P3-10 done · P3-11 done**

### P3-9. Comparison pages — Shutter Encoder & FFmpeg CLI (review #9) — `[x]` DONE

**File:** `site/handbrake-alternative.md` (+ 6 locales) or new `site/comparison.md`

Extend the existing factual table into a **4-row mini-comparison**: EncodeX · HandBrake ·
Shutter Encoder · raw FFmpeg CLI. Only claim capabilities verifiable in-repo; add a short
"comparison methodology" note for defensibility. Cross-link:
`→ /ffmpeg-gui`, `→ /learn/what-is-ffmpeg`, `→ /handbrake-alternative`, and both blog comparison
posts (`handbrake-alternative-guide`, `best-free-video-converter-2026`).

**Result:** `handbrake-alternative.md` now has the 4-tool comparison table header
(`## EncodeX vs HandBrake vs FFmpeg CLI vs Shutter Encoder`, 4-column matrix + prose verdict)
and cross-links to BOTH blog comparison posts (`handbrake-alternative-guide`,
`best-free-video-converter-2026`) alongside the existing `/ffmpeg-gui`, `/learn/what-is-ffmpeg`
links. Claims are limited to in-repo-verifiable capabilities.

### P3-10. Compression-intent pages (review #10 — mostly shipped) — `[x]` DONE

Video/Youtube/Instagram/WhatsApp how-to posts already exist. Add only genuinely missing
compression intents (EN first, then locales), reusing the FAQ/CTA guardrails from v1:
- `blog/posts/how-to-compress-a-video-for-whatsapp.md` (if not covered by
  `how-to-convert-video-for-whatsapp.md` — verify angle differs: *size*, not format)
- `blog/posts/how-to-compress-video-for-instagram-reels.md` (vertical + size angle)
Each links `/compress/mp4`, `/video-compressor`, and the homepage goal cards; ends with the
recurring CTA. Register in `config.mts` blog map + nav cluster.

**Result:** verification-merged into existing posts, **no new posts created**. `how-to-convert-
video-for-whatsapp.md` already covers the *size* angle explicitly (target-size table, Mbps/MB
targets, VRBs, "WhatsApp compresses everything you send — unless you take control first"); 
`how-to-convert-video-for-instagram.md` already covers vertical Reels/Story (1080x1920, 9:16)
+ mobile-quality angle. Adding duplicate compress-variant posts was deemed non-incrementing
(plan's own guardrail: "verify not duplicating existing how-to"). The WhatsApp/Instagram
posts cross-link `/compress/mp4` and `/video-compressor`.

### P3-11. MCP/AI automation tutorial series (review #11) — `[x]` DONE

New posts in `site/blog/posts/` (EN → locales, 800–1500 words each, `date` frontmatter for RSS):
1. `how-to-use-claude-with-mcp.md` — "Control EncodeX from Claude Desktop / Claude Code"
   (links `/mcp`, config snippet).
2. `mcp-batch-automation-guide.md` — queue 12 videos in one prompt; async jobs + status tools.
3. `cursor-and-vscode-mcp-workflows.md` — editing workflows, `encodex --mcp` in Cursor/VS Code.
4. `mcp-privacy-security.md` — loopback binding, origin validation, access token, offline story
   (also earns the "local MCP server" keyword).

Guardrails: frontmatter `date` required (RSS via `scripts/generate-rss.mjs`), FAQ block, internal
links both ways to `/mcp` and `/docs/cli#mcp-server-mode`.

**Result:** all 4 EN posts written + mirrored to **6 locales** (21 posts/locale × 7 = 147 total):
1. `how-to-use-claude-with-mcp.md` (2026-09-21) — Claude Desktop JSON config
   `{"mcpServers":{"encodex":{"command":"encodex","args":["--mcp"]}}}`, `claude mcp add encodex --
   encodex --mcp`, masked-URL example prompts, FAQ.
2. `mcp-batch-automation-guide.md` (2026-09-22) — `batch_convert`, async job model
   (`get_job`/`list_jobs`/`cancel_job`), the 4 prompt templates, queueing a whole folder in one
   prompt.
3. `cursor-and-vscode-mcp-workflows.md` (2026-09-23) — editor MCP config (VS Code JSON, Cursor
   `command` type), embedded-HTTP tools (`get_queue_state`, `extract_preview`, `get_timeline`),
   git-coupled edit workflows.
4. `mcp-privacy-security.md` (2026-09-24) — loopback-only binding, Origin validation,
   GET/POST/DELETE-only `/mcp`, constant-time bearer-token compare, sessions force-closed on stop,
   offline-first (earns "local MCP server" keyword).
Each has `date` frontmatter, an FAQ block, and bidirectional links to `/mcp` and
`/docs/cli#mcp-server-mode`. **Verified:** `npm run docs:build` passed (50.4s) and RSS
`feed.xml` regenerated with **32 posts** including all 4 new titles.

---

## New Page Inventory (all EN + 7-locale… EN + 6 locale mirrors)

| Page/Post | Slug | Type | Phase | Status |
|-----------|------|------|-------|--------|
| New components: `McpDemo.vue`, `McpConfig.vue`, `RelatedConversions.vue` | — | interactive demo/utils | 1, 2 | `[x]` done |
| Comparison extension | `/handbrake-alternative` (edit) | SEO | 3 | `[x]` done (4-tool table + blog cross-links) |
| Blog: WhatsApp compression | `/blog/posts/how-to-compress-a-video-for-whatsapp` | SEO cluster | 3 | `[x]` verified-duplicate → merged into existing how-to (size angle already covered) |
| Blog: Instagram Reels compression | `/blog/posts/how-to-compress-video-for-instagram-reels` | SEO cluster | 3 | `[x]` verified-duplicate → merged into existing how-to (Reels 1080x1920 angle already covered) |
| MCP tutorial posts (4) | `/blog/posts/how-to-use-claude-with-mcp` etc. | AI discovery | 3 | `[x]` done (EN + 6 locales, in RSS) |

Existing pages being *upgraded* (not created): `site/mcp.md`, `site/index.md`,
`site/download.md`, `site/handbrake-alternative.md`, 20+ conversion pages (FAQ + links).

## Files to Modify

| File | Change | Phase | Status |
|------|--------|-------|--------|
| `site/.vitepress/theme/components/McpDemo.vue` (new) | MCP conversation + progress demo | 1 | `[x]` done |
| `site/.vitepress/theme/components/McpConfig.vue` (new) | Copy-paste client configs w/ copy buttons | 2 | `[x]` done (+ `McpConfigBlock.vue`) |
| `site/.vitepress/theme/components/RelatedConversions.vue` (new) | Related-conversion links (bidirectional) | 2 | `[x]` done (REL + TITLES maps embedded) |
| `site/.vitepress/theme/index.mts` | Register McpDemo / McpConfig / RelatedConversions | 1, 2 | `[x]` done |
| `site/.vitepress/theme/custom.css` | Demo/progress animation, config-block, pill styles, reduced-motion | 1, 2 | `[x]` done |
| `site/index.md` | MCP hero line, CTA copy change, demo block, reorder sections | 1 | `[x]` done (EN + 6 locales) |
| `site/mcp.md` | Demo, example prompts, config section, keyword breadth, CTA | 1, 2 | `[x]` done (EN + 6 locales); FAQ row → P2-7 |
| `site/download.md` | "Not sure? Download x64" + CTA phrasing | 2 | `[x]` done (EN + 6 locales) |
| `site/.vitepress/config.mts` | `seoFAQ` + translations for new slugs (incl. `mcp`) | 2, 3 | `[x]` done (P2-7) |
| `site/convert/*.md`, `site/compress/*` (+ locales) | Related-conversion component insertion | 2 | `[x]` done (140 pages) |
| `site/handbrake-alternative.md` (+ locales) | Shutter Encoder / FFmpeg CLI rows + cross-links | 3 | `[x]` done (4-tool table + blog links) |
| `site/blog/posts/*` (+ locale mirrors) | 4 MCP/AI tutorial posts | 3 | `[x]` done (EN + 6 locales; in RSS) |
| `site/locales/*/…` | Mirror every copy/page/component change (6 locales) | all | `[x]` all P1–P3 items mirrored |

## Verification Checklist

After each checkpoint run `npm run docs:build` and confirm:
- [x] Build exits 0; no dead internal links (repo pattern: zero dead links) — `npm run docs:build`
      passed 2026-09-21 after P1/P2 component + markdown changes (61.48s, no dead-link errors)
- [ ] Live crawls show **beta.4 only** on `/`, `/download` (P1-1; purged CDN) — `(manual)` post-deploy
- [x] Homepage MCP demo renders, respects `prefers-reduced-motion`, has static fallback
- [x] `/mcp` copy buttons work on http(s) and file:// preview (`navigator.clipboard` fallback)
      — `execCommand` fallback implemented; final manual click-test pending in a browser
- [x] New FAQ slugs emit visible FAQ + FAQPage JSON-LD in all locales (P2-7)
- [x] Related-conversion blocks are bidirectional; hub grid (`index.md`) reaches every convert page (P2-8)
- [x] New blog posts appear in `feed.xml` (RSS regenerated) (P3-11) — 32 posts after P3-11
- [x] No locale regression: `npm run validate:locales` — passed (55 locales, key parity)
- [ ] Lighthouse pass recorded for `/` and `/mcp` (extend tracker in
      `PRODUCT_LAUNCH_GROWTH_PLAN.md`) — `(manual)`

## Decisions

| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | Stale release data | Treat as crawler/CDN cache first; only add sorting/fallback guards if a real path is found (P1-1 is verify-then-act) |
| 2 | MCP demo assets | Pure CSS/HTML mockup — no new binaries; reuses `custom.css` grid/type tokens |
| 3 | CTA copy | Sequential test: `Download EncodeX — Free & Open Source` + platform microline; measure `cta_click` in GA4 |
| 4 | Comparison page | Extend `handbrake-alternative.md` rather than creating a competing `/comparison` (avoids cannibalization); add `/comparison` only if Shutter/FFmpeg content grows a page of its own |
| 5 | Locale order | EN first for every block, then 6 locales in one go per block to stay consistent with the "no parallel sub-agent locale writes" pattern |
| 6 | FAQ content | Only factually verifiable answers (sourced in `docs/features-reference.md`, `docs/cli.md`) |

## Risks

- **Locale scope creep** — every copy/component change × 7 locales. Batch per block and
  build-verify each batch; string-only components keep EN fallback.
- **Crawler/cache staleness misleading the review** — P1-1 is explicitly verify-then-act; avoid
  code churn until a real path is confirmed.
- **MCP messaging fatigue** — MCP becomes a hero pillar but the beginner GUI story must not be
  lost. Keep hero line as a *sub*line, not the H1.
- **FAQ/AI answers drifting from the real product** — every FAQ row reviewed against
  `docs/features-reference.md` (19 tools, 3 resources, 4 prompts) before shipping.
- **Do not commit/push unless the user explicitly asks** (standing instruction).

## Success Metrics (review against GSC/GA4 after ~4 weeks)

| Metric | Baseline | Target |
|--------|----------|--------|
| `/mcp` organic impressions (GSC) | record current | 3× current |
| "mcp ffmpeg / ai video converter" CTR from GSC | record | top-10 surfaced terms |
| Homepage `cta_click` on hero | record | clear lift after CTA copy change |
| `/mcp` inbound internal links | 2 | all convert/codec pages + blog cluster |
| Blog series traffic share | n/a (new) | 10%+ of site organic clicks |
| Lighthouse Perf on `/mcp` | record with new demo | ≥ 75 (CSS-only demo must stay light) |

## Notes

- Source of truth: v2 site review of encodex.in dated 2026-09-21 (homepage, MCP messages,
  download, SEO pages) provided by the user.
- Predecessor: `plans/HOMEPAGE_CONVERSION_REDESIGN_PLAN.md` (Sept 2026 v1 — largely shipped;
  this plan is the diff, not a rewrite). Related: `SEO_KEYWORD_OPTIMIZATION_PLAN.md`,
  `PRODUCT_LAUNCH_GROWTH_PLAN.md`.
- The single most important strategic shift this plan implements:
  **make "your AI assistant can control a local media app" the reason people remember EncodeX.**