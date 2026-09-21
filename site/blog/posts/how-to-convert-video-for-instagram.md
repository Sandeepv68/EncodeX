---
title: "How to Convert Video for Instagram: Reels, Stories & Posts Done Right"
description: "Instagram is all about aspect ratio. Convert vertical Reels and Stories at 1080x1920, pick the right codec, and keep quality on mobile — a practical offline workflow with EncodeX."
date: 2026-09-18
tags:
  - guide
  - instagram
  - how-to
---

# How to Convert Video for Instagram: Reels, Stories & Posts Done Right

Unlike YouTube, Instagram isn't tolerant — it crops, compresses, and re-encodes anything it doesn't recognize as mobile-native. The single most common reason uploads look soft or blurry isn't bad encoding, it's the **wrong aspect ratio** getting squeezed into the right one.

This guide gives you the exact containers, resolutions, and ratios for Reels, Stories, and feed posts — before Instagram gets its hands on your video.

## The Short Answer

- **Reels & Stories:** MP4 · H.264 · **1080×1920** vertical (9:16)
- **Feed video:** MP4 · H.264 · **1080×1350** or vertical Reels-style
- Keep files lean: Instagram handles 4K worse than helpful, and a big file forces its own re-encode

The screenshot-style video cropping horror stories (blurry text, sliced-off heads, heavy banding) all trace back to feeding the platform a **landscape** clip when it wanted **vertical** — or the reverse.

## Why Aspect Ratio Is Everything on Instagram

Instagram's surfaces have fixed shapes:

| Surface | Shape | Resolution to target |
|---------|-------|----------------------|
| Reels | 9:16 vertical | 1080×1920 |
| Stories | 9:16 vertical | 1080×1920 |
| Feed post (border-to-border image) | 4:5 vertical | 1080×1350 |
| Feed video | 4:5 or 1:1 | 1080×1350 or 1080×1080 |
| Old-style landscape post | 16:9 | 1920×1080 |

If your source is 16:9 landscape and you post it as a Reel, Instagram will letterbox, then crop, then re-encode — three generations of harm in one upload. **Convert to the exact target ratio up front** and the platform mostly leaves your video alone.

## Cropping vs. Scaling: Which Is Right?

Two ways to make a landscape clip vertical, with very different results:

- **Scale (fit)** — shrinks the whole frame to fit 1080×1920, filling the letterbox space top/bottom with black bars. Safe, but you're using half your pixels for black.
- **Crop (fill)** — zooms in to fill 1080×1920, cutting the left/right edges. Great for people/close-up footage, risky for text or wide shots where you'll cut off content.

For phone footage of people and everyday moments, **crop** is usually the better look. For screen recordings, product shots, or anything with text at the edges, **scale** (or re-compose in an editor). EncodeX's "Instagram" goal defaults to a sensible ratio fit; the [goal cards](/ "Visit the EncodeX homepage") let you flip between fill and fit.

## Codec & Bitrate: Keep It Small and Sharp

Instagram's player is mobile-first, so everything is judged on mobile. Practical settings:

- **Codec: H.264.** The only settings every Instagram client reliably plays. H.265 uploads sometimes get re-encoded; H.264 doesn't.
- **Resolution cap: 1080p on the long edge.** Instagram is not a 4K showcase. A 4K file gets re-encoded down — so encode it once, cleanly, at 1080p.
- **Bitrate sweet spot:** ~8–12 Mbps for 1080p motion-heavy video, and you can go lower (5–8 Mbps) for talking heads or slides. Above ~15 Mbps you're just inflating the upload.
- **Audio: stereo AAC.** Instagram plays mono/stereo; don't carry 5.1 or 7.1 tracks.

## The Step-by-Step Workflow With EncodeX

All offline, with the [free EncodeX](/download):

1. **Drop** your clip into the EncodeX window.
2. **Pick the "Instagram" goal card** — it maps to vertical 1080×1920 MP4, H.264, with mobile-sane bitrate. (The goal cards live on the [homepage](/); the same targets are in the [video converter](/video-converter).)
3. **Choose fill or fit** for how the crop handles your source shape.
4. **Convert and upload.** Output is ready where you left it — no upload step inside the app.

## Unique Angles for Reels vs. Stories vs. Posts

- **Reels** — up to 3 minutes (as of 2026); make the first 1.5 seconds matter, since looping starts fast. Vertical, loud but not clipped, readable captions.
- **Stories** — ephemeral, full-screen vertical. Convert a truncated 15-second clip rather than a long video; the ratio is the same 1080×1920.
- **Feed posts** — typically slower, aesthetic, 4:5. Slightly higher bitrate is worth it here because there's no time pressure on the viewer's attention.

## What Wrong Defaults Look Like

- **Landscape Reel** → Instagram compresses and crops it horizontally, then letterboxes — soft, small, forgettable. Convert vertical first.
- **10-bit or HDR uploads** → Instagram's tone-mapping mangles them. Export standard SDR (8-bit serves mobile perfectly).
- **Maxed-out bitrate from a cinematic master** → your upload hits Instagram's re-encode at a disadvantage. Re-encode at Instagram-sane settings before posting.

For the rest of the series, see [YouTube](/blog/posts/how-to-convert-video-for-youtube) and [WhatsApp](/blog/posts/how-to-convert-video-for-whatsapp) — and start from the [format framework](/blog/posts/what-is-the-best-video-format).

## FAQ

### Does Instagram need vertical video for Reels?

Yes. Reels are 9:16 vertical by design. Horizontal clips get letterboxed and effectively reduced to a thumbnail on most feeds, and Instagram aggressively compresses anything that isn't native ratio.

### Should I always upload in 4K to Instagram?

No. Instagram downsizes everything to 1080p and re-encodes; there's no longevity benefit to 4K here, only a longer upload and a harder re-encode. Convert to a clean 1080p H.264 up front — you'll look *sharper* than a 4K upload Instagram crushed.

### Why does my Instagram video look blurry when it's exactly 1080×1920?

Ratio being right is only half the battle. The other half is bitrate: if your source was already heavily compressed or your export used a very low bitrate, the detail is gone before Instagram ever sees it. Re-encode from the clean master at 8–12 Mbps.

### How do I make a vertical clip without losing the important part?

Use **crop (fill)** for people and motion, and keep your subject centered. For text-heavy or wide content, use **scale (fit)** so nothing is cut off. When in doubt, do a 2-second test render and glance at the result on your phone.

---

**Do this with EncodeX → Download.** Prepare your Instagram Reels, Stories, and posts in minutes — free, open-source, fully offline, no watermark. [Download EncodeX](/download).