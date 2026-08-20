# ✨ Features

EncodeX is a cross-platform multimedia conversion tool that brings the power of FFmpeg to a modern, intuitive desktop interface. Built with Electron, React, and TypeScript, it lets you convert media between formats, extract audio, cut videos, and compress images — all through a clean, responsive UI with a batch queue, hardware acceleration, CLI mode, and full internationalization.

## 🔄 Media Conversion

Convert between video/audio formats with granular controls over codec selection (51 video codecs across software and hardware encoder families, 27 audio codecs), bitrate, output resolution (with optional aspect-ratio preservation), pixel format (56 formats grouped by bit depth), quality scale (qscale), audio track inclusion, and transcoder core selection. Supports batch mode for processing multiple files sequentially.

## ⚡ Hardware Acceleration

Hardware-accelerated encoding with auto-detection of available encoder families. Supports NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox, and Microsoft Media Foundation encoders. Acceleration can be toggled, with a mode selector — `auto` adds the matching FFmpeg `-hwaccel` flags for the selected hardware encoder family, `encode` relies on the encoder's own acceleration — and an encoder-type filter (`auto` / `hardware` / `software`) that narrows the video codec picker to all, GPU-only, or CPU-only encoders.

## ✂️ Video Cutting

Preview and cut video segments with frame-accurate start/end time or duration selection. Includes a built-in player that decodes video frames (via an FFmpeg rawvideo pipe to an HTML Canvas element) and audio (via a separate S16LE PCM pipe converted to float and fed to the Web Audio API) in lockstep, with a zoomable multi-track timeline: video thumbnail montage, audio waveform, keep/dim region shading, drag-to-trim handles, and a scrubbing playhead.

## 📋 Batch Queue

Process multiple files sequentially with configurable operations (transcode, extract audio, compress image). The queue persists state across jobs with real-time progress tracking, per-job error handling, job removal, and cancel-all.

## 🖼️ Image Compression

Compress images (JPEG, PNG, WebP, BMP, GIF, TIFF, PPM, PGM, PBM) with configurable quality scale and resolution scaling using FFmpeg's image codecs. Includes a live preview, a file-size readout, and — for JPEG/PNG/WebP inputs — a full EXIF metadata panel with RGB and luma histograms.

## 🎵 Audio Extraction

Extract audio tracks from video files. Output as AAC, MP3, AC3, FLAC, WAV, Vorbis, Opus, ALAC, or any of the 27 supported audio codecs. The source audio stream is selectable when multiple tracks are present.

## ℹ️ Media Information

Probe media files and inspect detailed per-stream information: codec, profile, level, resolution, display aspect ratio, pixel format, bit depth, color range/space/transfer/primaries, frame rate, bitrate, sample rate, sample format, channel count/layout, duration, start time, frame count, language, and tags.

## ⚙️ Multiple Transcoder Cores

- **FFmpeg API** — fluent-ffmpeg Node.js bindings with programmatic progress events
- **FFmpeg CLI** — direct CLI invocation via child process, no native bindings needed
- **BMF Framework** — BMF CLI tools for advanced pipeline scenarios (requires separate installation)

## 🌍 Internationalization

56 locales across 35 languages with RTL support for Arabic and Hebrew.

## 🔄 In-App Updates

Custom update manager that checks GitHub Releases for new versions, downloads the platform-specific installer (`.exe` / `.dmg` / `.AppImage`) in-app with real-time progress reporting, and launches the installer on completion.

---

## 🎞️ Supported Media Formats

### 🎥 Video Codecs (51)

| Group                      | Codecs |
| -------------------------- | ------ |
| **Software (28)**          | H.264 (libx264, libx264rgb), H.265/HEVC (libx265, Kvazaar), VP8 (libvpx), VP9 (libvpx-vp9), AV1 (libaom-av1, SVT-AV1, rav1e), MPEG-4 (libxvid, mpeg4), MPEG-1, MPEG-2, Theora, JPEG 2000 (libopenjpeg), WebP (libwebp, libwebp_anim), ProRes (prores, prores_ks), Huffyuv, FFV1, Ut Video, MJPEG, PNG, TIFF, VC-2, AVS (libxavs, libxavs2) |
| **NVIDIA NVENC (3)**       | H.264 (h264_nvenc), H.265 (hevc_nvenc), AV1 (av1_nvenc) |
| **Intel QSV (5)**          | H.264, H.265, MPEG-2, VP9, AV1 |
| **AMD AMF (3)**            | H.264, H.265, AV1 |
| **VAAPI (6)**              | H.264, H.265, MJPEG, VP8, VP9, AV1 |
| **Apple VideoToolbox (4)** | H.264, H.265, ProRes, VP9 |
| **Media Foundation (2)**   | H.264, H.265 |

### 🎧 Audio Codecs (27)

| Group             | Codecs |
| ----------------- | ------ |
| **AAC / MPEG**    | AAC (native, FDK), MP3 (LAME, libshine), MP2 (libtwolame) |
| **Dolby**         | AC-3, E-AC-3, TrueHD, DTS, MLP |
| **Lossless**      | FLAC, ALAC, WavPack |
| **Streaming**     | Vorbis, Opus, Speex, AMR-WB |
| **PCM**           | s16le, s24le, f32le, s16be, u8, A-law, Mu-law |
| **Windows Media** | WMA v1, WMA v2 |
| **Other**         | ADPCM IMA (WAV) |

### 🎨 Pixel Formats (56)

| Group               | Formats |
| ------------------- | ------- |
| **YUV 8-bit**       | yuv420p, yuv422p, yuv444p, yuv410p, yuv411p, yuv440p, yuvj420p, yuvj422p, yuvj444p |
| **YUV 10-bit**      | yuv420p10le, yuv422p10le, yuv444p10le |
| **YUV 12-bit**      | yuv420p12le, yuv422p12le, yuv444p12le |
| **YUV 16-bit**      | yuv420p16le, yuv444p16le |
| **YUV Semi-planar** | nv12, nv21, nv16, nv20le |
| **YUV with Alpha**  | yuva420p, yuva422p, yuva444p, yuva420p10le, yuva444p10le, yuva444p16le |
| **RGB Packed**      | rgb24, bgr24, rgb0, bgr0, rgba, bgra, argb, abgr, rgb48le, bgr48le, rgba64le, bgra64le |
| **Planar RGB**      | gbrp, gbrp10le, gbrp12le, gbrp16le, gbrap, gbrap10le, gbrap16le |
| **Monochrome**      | gray, gray10le, gray12le, gray16le, grayf32le, ya8, ya16le |
| **HDR**             | p010le, p016le, x2rgb10le |

### 📁 Input File Extensions

| Category | Extensions |
| -------- | ---------- |
| Video    | `mp4`, `m4v`, `avi`, `mkv`, `mov`, `qt`, `flv`, `f4v`, `wmv`, `asf`, `webm`, `3gp`, `3g2`, `mpg`, `mpeg`, `mts`, `m2ts`, `ts`, `mxf`, `ogv`, `ogg`, `vob`, `divx`, `dv`, `rm`, `rmvb`, `h264`, `h265`, `hevc` |
| Audio    | `mp3`, `aac`, `wav`, `flac`, `ogg`, `opus`, `m4a`, `wma`, `alac`, `aiff`, `aif`, `au`, `caf`, `pcm`, `mid`, `midi` |
| Image    | `jpg`, `jpeg`, `png`, `webp`, `bmp`, `gif`, `tiff`, `tif`, `svg`, `ico`, `heic`, `heif`, `avif`, `ppm`, `pgm`, `pbm`, `xbm` |
| Subtitle | `srt`, `ass`, `ssa`, `vtt`, `sub`, `idx`, `smi` |
