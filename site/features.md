# Features

EncodeX is a cross-platform multimedia conversion tool that brings the power of FFmpeg to a modern, intuitive desktop interface. Built with Electron, React, and TypeScript, it lets you convert media between formats, extract audio, cut videos, and compress images — all through a clean, responsive UI with a batch queue, hardware acceleration, CLI mode, and full internationalization.

## Media Conversion

![Media Conversion](/images/convert.png)

Convert between video/audio formats with granular controls over codec selection (51 video codecs across software and hardware encoder families, 27 audio codecs), bitrate, output resolution (with optional aspect-ratio preservation), pixel format (56 formats grouped by bit depth), quality scale (qscale), audio track inclusion, and transcoder core selection. Supports batch mode for processing multiple files sequentially.

## Lossless Copy

Stream-copy video or audio tracks without re-encoding (`-c copy`). Useful for fast container format changes, remuxing, or when quality preservation is critical.

## Hardware Acceleration

Hardware-accelerated encoding with auto-detection of available encoder families. Supports NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox, and Microsoft Media Foundation encoders. Acceleration can be toggled, with a mode selector — `auto` adds the matching FFmpeg `-hwaccel` flags for the selected hardware encoder family, `encode` relies on the encoder's own acceleration — and an encoder-type filter (`auto` / `hardware` / `software`) that narrows the video codec picker to all, GPU-only, or CPU-only encoders.

## Media Information

![Media Information](/images/media_info.png)

Probe media files and inspect detailed per-stream information: codec, profile, level, resolution, display aspect ratio, pixel format, bit depth, color range/space/transfer/primaries, frame rate, bitrate, sample rate, sample format, channel count/layout, duration, start time, frame count, language, and tags.

## Image Compression

![Image Compression](/images/image_compress.png)

Compress images (JPEG, PNG, WebP, BMP, GIF, TIFF, PPM, PGM, PBM) with configurable quality scale and resolution scaling using FFmpeg's image codecs. Includes a live preview, a file-size readout, and — for JPEG/PNG/WebP inputs — a full EXIF metadata panel with RGB and luma histograms.

## Audio Extraction

![Audio Extraction](/images/extract_audio.png)

Extract audio tracks from video files. Output as AAC, MP3, AC3, FLAC, WAV, Vorbis, Opus, ALAC, or any of the 27 supported audio codecs. The source audio stream is selectable when multiple tracks are present.

## Video Cutting

![Video Cutting](/images/cut_video.png)

Preview and cut video segments with frame-accurate start/end time or duration selection. Includes a built-in player that decodes video frames (via an FFmpeg rawvideo pipe to an HTML Canvas element) and audio (via a separate S16LE PCM pipe converted to float and fed to the Web Audio API) in lockstep, with a zoomable multi-track timeline.

## Batch Queue

![Batch Queue](/images/batch_process.png)

Process multiple files sequentially with configurable operations (transcode, extract audio, compress image). The queue persists state across jobs with real-time progress tracking, per-job error handling, job removal, and cancel-all.

## Multiple Transcoder Cores

- **FFmpeg API** — fluent-ffmpeg Node.js bindings with programmatic progress events
- **FFmpeg CLI** — direct CLI invocation via child process, no native bindings needed
- **BMF Framework** — BMF CLI tools for advanced pipeline scenarios (requires separate installation)

## Settings

![Settings](/images/settings.png)

Dedicated settings page for theme, hardware acceleration (enable/disable, mode, encoder type), and window always-on-top. Preferences persist to `localStorage` and take effect on startup.

## Logs

![Log Viewer](/images/logger.png)

Live log viewer that aggregates console output from both the main and renderer processes over IPC. Supports level filtering (DEBUG/INFO/WARN/ERROR), clearing, and downloading the log as a `.txt` file.

## Dark / Light Theme

System-aware theme detection with manual toggle. Theme preference persists to `localStorage`.

## RTL Support

Right-to-left layout support for Arabic and Hebrew locales. Direction toggles automatically on language switch via an Emotion RTL style plugin.

## Internationalization

56 locales across 35 languages including English, Spanish, French, Hindi, German, Italian, Dutch, Swedish, Norwegian, Portuguese, Ukrainian, Russian, Polish, Thai, Chinese, Japanese, Korean, Indonesian, Filipino, Afrikaans, Hebrew, Arabic, Nepali, Vietnamese, Finnish, Danish, and more.

## In-App Updates

Custom update manager that checks GitHub Releases for new versions, notifies the user of availability, downloads the platform-specific installer (`.exe` / `.dmg` / `.AppImage`) in-app with real-time progress reporting, and launches the installer on completion.

## Error Handling

Structured error system with typed error codes, user-facing localized messages, a global error snackbar, inline error banners, toast notifications, nested React error boundaries, and an in-app error history (cap 50).

---

## Supported Media Formats

### Video Codecs (51)

| Group | Codecs |
|-------|--------|
| **Software (28)** | H.264, H.265/HEVC, VP8, VP9, AV1, MPEG-4, MPEG-1, MPEG-2, Theora, JPEG 2000, WebP, ProRes, Huffyuv, FFV1, Ut Video, MJPEG, PNG, TIFF, VC-2, AVS |
| **NVIDIA NVENC (3)** | H.264, H.265, AV1 |
| **Intel QSV (5)** | H.264, H.265, MPEG-2, VP9, AV1 |
| **AMD AMF (3)** | H.264, H.265, AV1 |
| **VAAPI (6)** | H.264, H.265, MJPEG, VP8, VP9, AV1 |
| **Apple VideoToolbox (4)** | H.264, H.265, ProRes, VP9 |
| **Media Foundation (2)** | H.264, H.265 |

### Audio Codecs (27)

| Group | Codecs |
|-------|--------|
| **AAC / MPEG** | AAC (native, FDK), MP3 (LAME, libshine), MP2 (libtwolame) |
| **Dolby** | AC-3, E-AC-3, TrueHD, DTS, MLP |
| **Lossless** | FLAC, ALAC, WavPack |
| **Streaming** | Vorbis, Opus, Speex, AMR-WB |
| **PCM** | s16le, s24le, f32le, s16be, u8, A-law, Mu-law |
| **Windows Media** | WMA v1, WMA v2 |

### Input File Extensions

| Category | Extensions |
|----------|-----------|
| Video | `mp4`, `m4v`, `avi`, `mkv`, `mov`, `qt`, `flv`, `f4v`, `wmv`, `asf`, `webm`, `3gp`, `3g2`, `mpg`, `mpeg`, `mts`, `m2ts`, `ts`, `mxf`, `ogv`, `ogg`, `vob`, `divx`, `dv`, `rm`, `rmvb`, `h264`, `h265`, `hevc` |
| Audio | `mp3`, `aac`, `wav`, `flac`, `ogg`, `opus`, `m4a`, `wma`, `alac`, `aiff`, `aif`, `au`, `caf`, `pcm`, `mid`, `midi` |
| Image | `jpg`, `jpeg`, `png`, `webp`, `bmp`, `gif`, `tiff`, `tif`, `svg`, `ico`, `heic`, `heif`, `avif`, `ppm`, `pgm`, `pbm`, `xbm` |
| Subtitle | `srt`, `ass`, `ssa`, `vtt`, `sub`, `idx`, `smi` |
