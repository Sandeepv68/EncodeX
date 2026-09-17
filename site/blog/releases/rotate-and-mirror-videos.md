---
date: 2026-09-17
title: "Rotate & Mirror Videos — Fix Sideways Clips Without Losing Quality"
description: "EncodeX now lets you rotate videos and photos 90°, 180°, or 270° clockwise and mirror them horizontally or vertically. Keep MP4/MOV/MKV and the rotation is saved as lossless metadata — no re-encoding needed."
tags:
  - feature
  - rotation
  - release
---

# Rotate & Mirror Videos

Shot a video with your phone held the wrong way? We've all been there. As of today, EncodeX can fix it: **Rotation & Mirror** lets you rotate videos and photos **90°, 180°, or 270° clockwise** and flip them **horizontally or vertically** — right from the Convert page and the Batch Queue.

## One Click, Fixed

Fixing a sideways clip takes seconds:

1. Open the **Convert** page (or add files to the **Batch Queue**)
2. Pick any video or image as your source
3. In the settings area, choose a rotation angle from the **Rotation** dropdown — `90°`, `180°`, or `270°` clockwise — and flip it with the **Flip horizontal** / **Flip vertical** switches
4. Convert

That's it. The output comes out oriented exactly the way you want it. This works with videos *and* images, in single conversions and in batch jobs (transcode and compress-image operations both support it).

## Two Ways It Works

Rotation can be applied with one of two mechanisms, depending on your output:

### Lossless metadata rotation (no re-encode)

When your output is **MP4, MOV, or MKV** and you're using **stream-copy (lossless copy)** mode with a rotation angle and no mirror, EncodeX stores the rotation as standard display metadata (`rotate=`). The player rotates the video on playback — **quality is untouched** and the job finishes in seconds because nothing is re-encoded. Mirrors aren't part of this path: flipping the image always changes the pixels, so it always re-encodes.

If your container supports it, the Convert page shows a helpful note explaining that rotation is applied losslessly. If your output container *doesn't* support it (WebM, FLV, GIF, and image outputs, for example), you'll see a warning with a one-click **Turn off lossless copy** action that switches to the re-encode path for you.

### Pixel rotation (re-encode)

For every other format — or whenever you mirror the video — EncodeX re-encodes the frames with an FFmpeg filter chain (`transpose` + `hflip`/`vflip`) that merges cleanly with the existing `scale` filter. Since the rotation happens at 90° steps, there's no interpolation, so the result stays crisp regardless.

## Built Into the Batch Queue

Rotation and mirror aren't limited to single conversions. They're part of the **Batch Queue** too — set them on the batch panel to apply to the whole batch, or edit an individual job in its options dialog. Batch jobs always re-encode, so rotation and mirroring simply become part of the job options along with codec, bitrate, and scale.

## Under the Hood

- Rotation maps to FFmpeg's `transpose` filter: `transpose=1` for 90°, `transpose=2,transpose=2` for 180°, and `transpose=2` for 270° (mirrored when you add flips).
- When `scale` is also set, everything is combined into a single `-vf` argument (scale first, then rotation), so the filter chain stays efficient.
- In stream-copy mode with a supported container, the flag `-metadata:s:v rotate=<deg>` is written next to `-c copy` — no decode, no re-encode, no quality loss.
- The batch queue and compress-image panels expose the same controls, and `compress_image` jobs rotate images the same way.

## What's Next

Rotation presets inside conversion profiles is a natural next step, along with options like arbitrary angle support. If there's a rotation or mirroring workflow you'd like to see, [open an issue](https://github.com/Sandeepv68/EncodeX/issues) and tell us about it.

---

[Download EncodeX](/download) · [See All Features](/features) · [Read the Docs](/docs/features-reference)