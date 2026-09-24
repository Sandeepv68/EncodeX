# Plan: Google Ads Campaign for encodex.in (Sept 2026)

## Goal

Launch paid Google Search traffic to EncodeX with a measurable, conversion-tracked
funnel. The live site is already strong as a product/SEO site; the goal of Ads is
**search intent → matching EncodeX page → obvious download → tracked conversion**.

Two site-side blockers were fixed in this same commit so the spend is measurable:

1. **Download reliability** — `site/.vitepress/data/releaseShared.ts` now resolves the
   newest release via the releases list (works with all-prerelease beta repos, unlike
   `/releases/latest`), and every data loader falls back to deterministic
   `releases/latest/download/<asset>` links. **The download buttons render and work in
   static HTML even with zero GitHub API connectivity.** A latent SSR crash
   (`navigator` undefined in Node) was also fixed in `LatestDownloads.vue`.
2. **Conversion tracking** — download clicks fire `download_click` (with `platform`,
   `file_name`, `version`, `page_location`) plus the GA4 conversion event
   `generate_lead`. An optional Google Ads tag is wired in
   `site/.vitepress/config.mts` via `GOOGLE_ADS_CONVERSION_ID` / `GOOGLE_ADS_CONVERSION_LABEL`
   env vars and fires a `conversion` event with `send_to` when configured.

## Status Legend

- `[ ]` Not started
- `[/]` In progress
- `[x]` Done
- `(manual)` Requires external action in Google Ads / GA4 / console

---

## Phase 0 — Prerequisites (do first, all manual)

| # | Task | Detail |
|---|------|--------|
| 0.1 | Create Google Ads account | If none exists; link an active billing profile |
| 0.2 | Link Google Ads ↔ GA4 | Admin → Google Ads linking in GA4 for `G-SM28DL4DYR`; import the `generate_lead` (or `download_click`) event as a conversion **after** at least ~1–2 days of baseline traffic |
| 0.3 | Set up Google Ads conversion actions | Create conversion action **Download (generate_lead)** and/or **Download click (download_click)**, counted per-click, window 30 days. Value = 0 (free product) — Google optimises on count |
| 0.4 | *(Optional)* AW tag | When Ads generates its conversion ID + label, set `GOOGLE_ADS_CONVERSION_ID` + `GOOGLE_ADS_CONVERSION_LABEL` in the build env. The site then fires the Ads-native `conversion` event with `send_to` so you also see on-site conversions independently of GA4 |
| 0.5 | Set up shared intent URLs | Add UTM params at *campaign* level only (`utm_source=google&utm_medium=cpc`) so GA4/Ads reports stay clean; avoid ad-level params that fragment data |
| 0.6 | Verify tracking before launch | Click every download button (Windows/macOS/Linux + Other downloads + Previous versions) and confirm the event appears in DebugView / Ads Tag Assistant. Also test on mobile (Ads can deliver mobile traffic to this desktop product) |

---

## Phase 1 — Conversion Events (site is done; recording is the operator step)

| Event | Type | Purpose |
|-------|------|---------|
| `download_click` | GA4 analytics event (custom) | Click-level detail; params `platform`, `file_name`, `version`, `page_location` |
| `generate_lead` | GA4 conversion event | Primary conversion — "viewed clickable download" |
| `conversion` (AW-…/label) | Google Ads conversion (optional) | Only fired when `GOOGLE_ADS_*` env is set |
| `outbound_download` | GA4 analytics event | GitHub release links elsewhere on the site |

**What NOT to count as primary conversion:** homepage view, 50% scroll, email click,
GitHub repo view. Download is the unit of value.

The funnel to feed Ads:

```text
  GOOGLE SEARCH
       │
  ┌────┴────┬─────────┐
 FFmpeg GUI │ converter│ MKV→MP4
       │    │          │
  /ffmpeg-gui  /video-converter  /mkv-to-mp4
       └────┴────┬─────┘
             DOWNLOAD PAGE
              │   │    │
           Win  Mac  Linux
              └───┼────┘
            generate_lead → GA4 → Google Ads conversion
```

---

## Phase 2 — Campaign Structure

Three campaigns, separated by intent. Each campaign: **Search** type, standard
(not Performance Max), manual CPC during the test window, then a switch to
"Maximize conversions" once ≥ 15–30 conversions/month are observed.

### Campaign 1 — EncodeX: FFmpeg GUI

- **Budget share:** ~40% (highest-intent, best match to the product)
- **Landing pages:** `/ffmpeg-gui/`, `/ffmpeg-gui/windows/`, secondary `/`
- **Ad groups:** one ad group for wide FFmpeg GUI terms, one for OS-qualified terms

#### Ad group AG1.1 — FFmpeg GUI core

**Keywords (phrase + exact; include broad-modified elsewhere if testing):**

```
ffmpeg gui
ffmpeg frontend
ffmpeg gui windows
ffmpeg gui mac
ffmpeg gui linux
ffmpeg gui tool
ffmpeg gui app
ffmpeg gui download
ffmpeg graphical interface
ffmpeg gui free
best ffmpeg gui
ffmpeg gui for beginners
ffmpeg gui alternative to command line
```

**RSA 1 — Direct**
- Headlines: `FFmpeg Power, Point & Click`, `Free FFmpeg GUI for Windows`, `Convert Video Without Commands`, `No Command Line Required`, `Windows · macOS · Linux`, `Download the Free App`, `Open Source & MIT Licensed`
- Description A: `EncodeX wraps FFmpeg in a clean GUI. Convert, compress, trim and extract audio in a few clicks.`
- Description B: `Free forever. No accounts, no watermarks, no uploads. Your files never leave your computer.`

**RSA 2 — Differentiation**
- Headlines: `Stop Typing FFmpeg Commands`, `A Real FFmpeg Frontend`, `Free & Open Source`, `Hardware-Accelerated`, `Works Offline`, `Batch Convert in One Click`, `Trusted by 1,900+ Downloads`
- Description A: `A visual FFmpeg GUI with profiles for MP4, MKV, ProRes and more. Install and convert in under a minute.`
- Description B: `100% local processing. No uploads, no subscriptions, no trial limits.`

#### Ad group AG1.2 — OS-qualified FFmpeg GUI

**Keywords:** `ffmpeg gui windows 11`, `ffmpeg gui for windows`, `ffmpeg gui macos`,
`ffmpeg gui for mac`, `ffmpeg gui linux`, `ffmpeg gui ubuntu`

**Landing:** `/ffmpeg-gui/` (Windows-terms add `/ffmpeg-gui/windows/`)

**RSA 1 — Windows-lean**
- Headlines: `FFmpeg GUI for Windows 11`, `Convert Video on Windows`, `No Terminal Needed`, `NVENC / QSV / AMF Support`, `Free Windows Video Tool`, `Open Source`, `Download for Windows`
- Description A: `A clean FFmpeg GUI for Windows 10/11 with hardware-accelerated H.264, HEVC and AV1 encoding.`
- Description B: `Install, drop a file, pick a profile, convert. Everything runs on your PC.`

**RSA 2 — Cross-platform**
- Headlines: `Works on Mac & Linux Too`, `One App, Three OSes`, `Free and Open Source`, `Private Local Processing`, `No Account Required`, `No Watermarks`, `Convert Privately`
- Description A: `FFmpeg GUI for Windows, macOS and Linux. Apple Silicon + Intel Mac builds included.`
- Description B: `Download once, use forever. No uploads — your media stays on your computer.`

### Campaign 2 — EncodeX: Video Converter & Compressor

- **Budget share:** ~35%
- **Ad groups:** AG2.1 Video converter, AG2.2 Video compressor

#### AG2.1 — Video converter

**Keywords:**

```
video converter
video converter software
free video converter
video converter for windows
video converter for mac
video converter for pc
video converter app
convert video to mp4
video converter free download
online video converter alternative
best free video converter
desktop video converter
video converter no watermark
video converter no upload
```

**Landing:** `/video-converter/`

**RSA 1 — Converter core**
- Headlines: `Convert Any Video to MP4`, `Free Video Converter`, `No Watermarks Ever`, `Works on Windows & Mac`, `No File Size Limits`, `Convert Privately`, `Open Source`
- Description A: `Convert MP4, MKV, MOV, AVI, WebM and more — fast, with hardware acceleration, right on your computer.`
- Description B: `Free forever and 100% offline. Your videos never leave your device.`

**RSA 2 — Trust-lean**
- Headlines: `Your Videos Stay on Your PC`, `No Uploads to Servers`, `Free & No Signup`, `Batch Convert Folders`, `ProRes, H.264, HEVC, AV1`, `Download the Free App`
- Description A: `Unlike online converters, EncodeX never uploads your files. Private, offline, unlimited.`
- Description B: `A full media converter: video, audio, images, compression and extraction in one app.`

#### AG2.2 — Video compressor

**Keywords:**

```
video compressor
compress video
compress video to smaller size
free video compressor
video compressor for windows
video size reducer
reduce video file size
compress video mp4
video compressor no watermark
best free video compressor
```

**Landing:** `/video-compressor/`

**RSA 1 — Pain-point**
- Headlines: `Shrink Video Files Fast`, `Free Video Compressor`, `Smaller Files, Same Look`, `No Quality Guesswork`, `Windows · macOS · Linux`, `Open Source`, `100% Local`
- Description A: `Compress MP4 and MKV to a fraction of the size with smart codecs and bitrate control — visually similar quality.`
- Description B: `Free, offline and watermark-free. Compress an entire folder in one go.`

**RSA 2 — Solution**
- Headlines: `Reduce Video Size in Minutes`, `Compress Without the Command Line`, `Hardware-Accelerated Compression`, `Batch Compress Folders`, `Private & Offline`, `Free Forever`
- Description A: `Drag in a video, pick a size target, export. No accounts, no uploads, no watermarks.`
- Description B: `Built on FFmpeg with presets that balance quality and file size for you.`

### Campaign 3 — Format-to-Format (intent pages already exist)

- **Budget share:** ~15%
- **Landing page per ad group:** the existing dedicated `/convert/…` pages. This
  campaign exists *because* the SEO pages are already top-notch — reuse them as
  high-relevance landing pages.

| Ad group | Landing page | Keywords |
|----------|--------------|----------|
| AG3.1 MKV→MP4 | `/convert/mkv-to-mp4/` | `mkv to mp4`, `mkv to mp4 converter`, `convert mkv to mp4 free`, `mkv to mp4 without quality loss` |
| AG3.2 MOV→MP4 | `/convert/mov-to-mp4/` | `mov to mp4`, `mov to mp4 converter`, `convert mov to mp4` |
| AG3.3 AVI→MP4 | `/convert/avi-to-mp4/` | `avi to mp4`, `avi to mp4 converter`, `convert avi to mp4` |
| AG3.4 MP4→MP3 | `/convert/mp4-to-mp3/` | `mp4 to mp3`, `convert mp4 to mp3`, `mp4 to mp3 converter` |
| AG3.5 MP4→MKV | `/convert/mp4-to-mkv/` | `mp4 to mkv`, `convert mp4 to mkv`, `mp4 to mkv converter` |
| AG3.6 Audio | `/audio-converter/` | `audio converter`, `extract audio from video`, `video to mp3` |

**RSA (per ad group — one starter each, then add a second ≥ Good Ad Strength):**

MKV→MP4 example:
- Headlines: `Convert MKV to MP4 Free`, `MKV → MP4 Instantly`, `No Quality Loss`, `Works Offline`, `Free & No Watermark`, `Windows · Mac · Linux`, `Open Source`
- Description A: `Remux or re-encode your MKV to MP4 with hardware acceleration — plays on any TV, phone or console.`
- Description B: `Free, private, no uploads. Drag, drop, convert. Download EncodeX now.`

### Campaign 4 — MCP / AI automation (optional, small)

- **Budget share:** ~10% max; narrow, technical audience
- **Landing:** `/mcp/`
- **Keywords:** `ffmpeg mcp`, `mcp video processing`, `mcp media tools`, `ai video automation`,
  `claude ffmpeg`, `cursor video conversion`, `mcp video converter`
- **RSA:**
  - Headlines: `FFmpeg as an MCP Server`, `Let AI Drive EncodeX`, `Claude / Cursor / VS Code Ready`, `Local & Private`, `Free & Open Source`, `Automate Video Workflows`
  - Description A: `Give AI assistants a real media engine — a local MCP server for FFmpeg conversions, extracts and compressions.`
  - Description B: `No cloud, no uploads. AI drives the same offline EncodeX engine on your machine.`

---

## Phase 3 — Negative Keywords (add to all campaigns)

Block traffic that can never convert or violates intent:

```
handbrake
shutter encoder
obs studio
vegas pro
premiere
adobe
download youtube
youtube downloader
instagram
tiktok
tik tok
windows movie maker
free download windows movie maker
online
web
browser
chrome extension
android
iphone
ios
apk
torrent
crack
edition
keygen
serial
full download (unqualified)
audacity
winrar
utorrent
how to quote online
guesser
```

Add phrase negatives (`online`, `web`, `apk`, `crack`, `youtube downloader`,
platform names, competitor names) account-level so format-terms don't waste spend.

---

## Phase 4 — Landing Page Mapping (single source of truth)

| Search intent | Ad landing page |
|---------------|-----------------|
| FFmpeg GUI / frontend | `/ffmpeg-gui/` |
| FFmpeg GUI + Windows | `/ffmpeg-gui/windows/` |
| Video converter | `/video-converter/` |
| Video compressor | `/video-compressor/` |
| MKV to MP4 | `/convert/mkv-to-mp4/` |
| MOV to MP4 | `/convert/mov-to-mp4/` |
| AVI to MP4 | `/convert/avi-to-mp4/` |
| MP4 to MKV | `/convert/mp4-to-mkv/` |
| MP4 to MP3 | `/convert/mp4-to-mp3/` |
| Audio converter / extract | `/audio-converter/`, `/extract-audio-from-video/` |
| MCP / AI | `/mcp/` |
| ProRes | `/codecs/prores/` |

Every landing page must have a **visible download CTA above the fold** pointing to
`/download/` (currently true for the main pages; verify `/codecs/*` and `/mcp/`).

---

## Phase 5 — Launch Checklist

**Pre-launch (manual):**
- [ ] Ads ↔ GA4 linked; `generate_lead` imported as conversion
- [ ] GOOGLE_ADS env vars set (optional Direct-tag path) and re-deployed
- [ ] Landing pages rendered server-side with working download buttons (verified via this commit's fallback)
- [ ] All download buttons clicked and confirmed in DebugView / Tag Assistant / Ads Conversions
- [ ] Mobile + desktop SMOKE test via Google Ads Preview & Diagnosis tool
- [ ] Negative keywords applied at account level
- [ ] Sitelinks: Features · FFmpeg GUI · Video Converter · Download; Callouts: `Free` `Open Source` `No Uploads` `No Watermark`

**Launch week:**
- [ ] Start at manual CPC, low daily caps (see budget below)
- [ ] Pull search-term report daily; add negatives; move winning exact/phrase terms to their own ad group
- [ ] Discard any keyword with zero impressions after 3–5 days
- [ ] Check landing-page relevance (Ad Quality Score) and swap to closest page

---

## Phase 6 — Budget & Measurement

Suggested **test budget**: start each campaign at a small daily cap
(≈ $5–10 / ₹400–800) for 3–4 weeks. Scale only when:

- ≥ 30 conversions in a 30d window (statistical floor)
- Cost per conversion stable or falling
	
Primary north-star metric: **downloads (generate_lead)**. Secondary: CTR, CPC,
conversion rate by campaign/ad group, device split (mobile for a desktop product),
top search terms.

Optimization loop:
1. Pause non-converting keywords / low CTR headlines.
2. Cascade budgets to the ad group at/below target CPA.
3. Re-run search-term analysis weekly; refresh negatives.
4. Keep ≥ 2 RSA per ad group with Good/Excellent Ad Strength.
5. Split landing pages by intent as soon as data supports it (don't split pre-data).

---

## Done / relates to

- `site/.vitepress/data/releaseShared.ts` — robust latest fetch + deterministic fallback
- `site/.vitepress/data/release.data.mts`, `releases.data.mts` — never-null build data
- `site/.vitepress/theme/components/LatestDownloads.vue` — SSR guard, platform events, size hiding
- `site/.vitepress/theme/composables/useAnalytics.ts` — Ads conversion event support
- `site/.vitepress/config.mts` — optional `GOOGLE_ADS_*` head tags
- External (manual): Google Ads account, linking, conversion actions, budgets