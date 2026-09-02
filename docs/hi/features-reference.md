# फ़ीचर्स

EncodeX एक क्रॉस-प्लेटफ़ॉर्म मल्टीमीडिया रूपांतरण उपकरण है जो FFmpeg की शक्ति को एक आधुनिक, सहज desktop interface में लाता है। Electron, React, और TypeScript के साथ built, यह आपको formats के बीच media convert करने, audio extract करने, videos cut करने, और images compress करने देता है — सब कुछ एक clean, responsive UI के माध्यम से batch queue, hardware acceleration, CLI mode, और full internationalization के साथ।

## फ़ीचर overview

### Media conversion

Video/audio formats के बीच convert करें codec selection (software और hardware encoder families में 51 video codecs, 27 audio codecs), bitrate, output resolution (optional aspect-ratio preservation के साथ), pixel format (bit depth द्वारा grouped 56 formats), quality scale (qscale), audio track inclusion, और transcoder core selection पर granular controls के साथ। कई files Batch Queue के माध्यम से queue की जा सकती हैं (नीचे देखें)।

### Conversion profiles

Conversion settings को तुरंत भरने के लिए pre-configured encoding presets apply करें। Profiles एक पूर्ण encoding configuration encapsulate करते हैं — container format, video codec, audio codec, bitrate, CRF/quality, scale, pixel format, और advanced FFmpeg arguments — ताकि आपको हर setting manually configure न करनी पड़े।

- **8 categories में 140+ built-in profiles**: Web & Social (YouTube, Instagram, TikTok, Facebook, X), Devices (Apple, Android, gaming consoles), Video codecs, Professional (ProRes, DNxHD/HR, FFV1), Streaming (HLS, DASH), Audio, Images, और Advanced
- **Custom profiles** — अपने खुद के profiles create, edit और delete करें; local storage में saved रहते हैं
- **हाल ही में उपयोग किए गए** — पिछले 5 applied profiles तक quick access
- **Category filtering** — icon badges के साथ category द्वारा profiles browse करें
- **Batch support** — अलग-अलग batch jobs या पूरी queue पर profiles apply करें

Profiles Convert page और Batch Queue दोनों में available हैं। Profile select करने से सभी relevant encoding fields automatically fill हो जाते हैं, जबकि manual overrides की सुविधा बनी रहती है।

### Lossless copy

Re-encoding के बिना video या audio tracks stream-copy करें (`-c copy`)। तेज़ container format changes, remuxing, या quality preservation critical होने पर उपयोगी।

### Hardware acceleration

उपलब्ध encoder families के auto-detection के साथ hardware-accelerated encoding। NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox, और Microsoft Media Foundation encoders support करता है। Acceleration toggle किया जा सकता है, mode selector के साथ — `auto` selected hardware encoder family के लिए matching FFmpeg `-hwaccel` flags add करता है, `encode` encoder के अपने acceleration पर निर्भर करता है — और encoder-type filter (`auto` / `hardware` / `software`) जो video codec picker को all, GPU-only, या CPU-only encoders तक narrow करता है। Available encoders runtime पर bundled FFmpeg binary से probe किए जाते हैं और codec pickers binary वास्तव में क्या provide करता है उसके अनुसार filter होते हैं।

### Media information

Media files probe करें और detailed per-stream information inspect करें: codec, profile, level, resolution, display aspect ratio, pixel format, bit depth, color range/space/transfer/primaries, frame rate, bitrate, sample rate, sample format, channel count/layout, duration, start time, frame count, language, और tags। Video, audio, और subtitle streams के साथ काम करता है।

### Image compression

FFmpeg के image codecs का उपयोग करके configurable quality scale और resolution scaling के साथ images compress करें (JPEG, PNG, WebP, BMP, GIF, TIFF, PPM, PGM, PBM)। Live preview, file-size readout, और JPEG/PNG/WebP inputs के लिए RGB और luma histograms के साथ full EXIF metadata panel शामिल है।

### Audio extraction

Video files से audio tracks extract करें। Output AAC, MP3, AC3, FLAC, WAV, Vorbis, Opus, ALAC, या 27 supported audio codecs में से किसी भी format में। Multiple tracks present होने पर source audio stream selectable है।

### Video cutting

Frame-accurate start/end time या duration selection के साथ video segments preview और cut करें। Built-in player शामिल है जो video frames decode करता है (FFmpeg rawvideo pipe से HTML Canvas element तक) और audio (अलग S16LE PCM pipe से float में convert करके Web Audio API को feed) lockstep में, zoomable multi-track timeline के साथ: video thumbnail montage, audio waveform, keep/dim region shading, drag-to-trim handles, और scrubbing playhead।

### Batch queue

Configurable operations (transcode, audio extraction, image compression) के साथ multiple files process करें। Jobs review dialog के माध्यम से added होते हैं जहाँ output names और options queue में enter करने से पहले adjust किए जा सकते हैं।

- **Parallel processing** — 4 jobs concurrently तक run करें (`MAX_QUEUE_CONCURRENCY = 4`); concurrency cap runtime पर configurable और persisted है।
- **Queue lifecycle** — पूरी queue start, pause, और resume; cancel all; completed/failed jobs clear; individual jobs remove।
- **Reordering** — queued jobs का drag-and-drop reordering (drop area के साथ), जो job की new position report करने वाले `QUEUE_MOVE_TO` channel द्वारा backed है।
- **Job editing** — किसी भी queued job के start होने से पहले उसके options (और optionally output path) replace करें (`QUEUE_UPDATE_OPTIONS`)।
- **Export / import** — queue को JSON file में save करें और बाद में re-import करें (`QUEUE_EXPORT` / `QUEUE_IMPORT`), dedicated `INVALID_QUEUE_FILE` error code से validated।
- **Persistence** — queue snapshot (jobs + concurrency) user-data directory में `queue-state.json` में durably save होता है और startup पर restore होता है।
- **Status filters** — job list को queued / running / done / failed द्वारा filter करें, plus focusable search field।
- **When-done power actions** — optionally queue drain होने पर machine shut down, sleep, या hibernate करें (platform के अनुसार `shutdown`, `pmset`, या `systemctl`; Windows force-close flag honor करता है)।
- **Live feedback** — real-time per-job progress (percent, time, speed, ETA) IPC पर streamed, per-job error handling, और outstanding work दिखाने वाला nav count badge।

### Multiple transcoder cores

- **FFmpeg API** — programmatic progress events के साथ fluent-ffmpeg Node.js bindings
- **FFmpeg CLI** — child process के माध्यम से direct CLI invocation, native bindings की आवश्यकता नहीं
- **BMF Framework** — advanced pipeline scenarios के लिए BMF CLI tools (अलग installation आवश्यक)

### Settings

Theme, hardware acceleration (enable/disable, mode, encoder type), window always-on-top, launch-at-login, batch queue concurrency, और when-done power action के लिए dedicated settings page। Preferences `localStorage` में persist होती हैं और startup पर effective होती हैं।

### Keyboard shortcuts

एक central shortcut registry (`src/renderer/constants/shortcuts.ts`) nine sections (global, convert, media info, image compress, audio extract, video cut, batch queue, logs, dashboard) में 60+ shortcuts define करता है। Highlights:

- `Ctrl+/` — shortcuts help dialog open करें
- `Alt+1`…`Alt+9` — सीधे किसी page पर jump करें
- `Ctrl+O` / `Ctrl+Shift+S` / `Ctrl+Enter` — input pick / output pick / job start (pages में consistent)
- `Ctrl+Shift+P` / `Ctrl+Shift+C` — active job pause / cancel
- Batch queue: `Ctrl+E` export, `Ctrl+I` import, `1`–`5` status filters, `F` search focus
- Video cut player: `Space` play/pause, `M` mute, seek के लिए arrow keys

Chords `event.code` द्वारा match होते हैं, इसलिए वे keyboard layout से independent काम करते हैं। Tooltips अपना hint text same registry से derive करते हैं।

### Activity blips & job popover

Conversion, audio extraction, या video cut running होने पर corresponding nav row पर flashing blip दिखाई देता है; Batch Queue row outstanding jobs की live count दिखाती है। Blip पर hover (या keyboard-focus) उस पर anchored popover open करता है job का title, localized status (paused state और parallel-concurrency badge सहित), source-file thumbnail, file name, और live progress bar के साथ — plus batch advance होते समय pending-job thumbnails का pile। Popover soft shadow use करता है और उसका arrow blip की ओर point करता है।

### Close confirmation

Jobs active होने पर window close करना confirmation flow से route होता है: main process renderer से पूछता है (`WINDOW_CLOSE_REQUESTED`), जो close confirm होने से पहले active work list करने वाला dialog दिखाता है (`WINDOW_CONFIRM_CLOSE`)। Boot पर splash screen दिखाई जाती है जब main window load होता है।

### Dashboard

हर tool के लिए quick-action tiles वाला landing page (number keys `1`–`6` सीधे jump करते हैं) और seasonal easter-egg branding (नीचे देखें)।

### Easter eggs

Festival dates पर Dashboard default app logo को holiday artwork से swap करता है — Christmas, Halloween, New Year, July 4th, Easter, Diwali, और Holi। प्रत्येक festival अपनी date के around 7-day window के लिए active रहता है; Diwali और Holi curated dates (2026–2035) के माध्यम से Hindu lunisolar calendar follow करते हैं अन्य years के लिए astronomical fallback computation के साथ।

### Logs

Live log viewer जो main और renderer दोनों processes से console output IPC पर aggregate करता है। Level filtering (DEBUG/INFO/WARN/ERROR), clearing, और `.txt` file के रूप में log download support करता है।

### Notifications

Non-blocking feedback के लिए configurable duration वाले Toast notifications (success/info/warning/error), global error snackbar पर layered।

### Custom window frame

Custom title bar वाली frameless application window जो minimize / maximize-toggle / close controls, draggable region, और always-on-top support provide करती है। Main window load होते समय non-interactive splash screen दिखाई जाती है।

### Dark / Light theme

Manual toggle के साथ system-aware theme detection। Theme preference `localStorage` में persist होती है (`encodex-theme` key)।

### RTL support

Arabic और Hebrew locales (`ar-SA`, `ar-AE`, `ar-JO`, `he-IL`) के लिए right-to-left layout support। Emotion RTL style plugin के माध्यम से language switch पर direction automatically toggle होती है।

### Internationalization

35 languages में 56 locales:

| भाषा        | Locales                                    |
| ----------- | ------------------------------------------ |
| English     | `en-US`, `en-GB`, `en-IN`, `en-CA`, `en-AU`, `en-SG`, `en-ZA`, `en-NZ`, `en-IE` |
| Spanish     | `es-ES`, `es-MX`, `es-AR`, `es-CL`         |
| French      | `fr-FR`, `fr-CA`, `fr-BE`                  |
| Hindi       | `hi-IN`                                    |
| German      | `de-DE`, `de-BE`                           |
| Italian     | `it-IT`                                    |
| Dutch       | `nl-NL`, `nl-BE`                           |
| Swedish     | `sv-SE`                                    |
| Norwegian   | `nb-NO`                                    |
| Portuguese  | `pt-BR`, `pt-PT`                           |
| Ukrainian   | `uk-UA`                                    |
| Russian     | `ru-RU`                                    |
| Polish      | `pl-PL`                                    |
| Thai        | `th-TH`                                    |
| Sinhala     | `si-LK`                                    |
| Mongolian   | `mn-MN`                                    |
| Malay       | `ms-MY`, `ms-SG`                           |
| Chinese     | `zh-SG`, `zh-TW`                           |
| Japanese    | `ja-JP`                                    |
| Korean      | `ko-KR`                                    |
| Indonesian  | `id-ID`                                    |
| Filipino    | `fil-PH`, `tl-PH`                          |
| Afrikaans   | `af-ZA`                                    |
| Hebrew      | `he-IL`                                    |
| Arabic      | `ar-SA`, `ar-AE`, `ar-JO`                  |
| Nepali      | `ne-NP`                                    |
| Khmer       | `km-KH`                                    |
| Vietnamese  | `vi-VN`                                    |
| Lao         | `lo-LA`                                    |
| Maori       | `mi-NZ`                                    |
| Icelandic   | `is-IS`                                    |
| Greenlandic | `kl-GL`                                    |
| Irish       | `ga-IE`                                    |
| Finnish     | `fi-FI`                                    |
| Danish      | `da-DK`                                    |

### In-app updates

Custom update manager जो GitHub Releases check करता है new versions के लिए, availability की notify करता है, platform-specific installer (`.exe` / `.dmg` / `.AppImage`) in-app real-time progress reporting के साथ download करता है, और completion पर installer launch करता है। Version comparison semver pre-release suffix stripping के साथ use करता है। Update flow fully About page में integrated है "Check for Updates" button और global dialog के साथ।

### Error handling

Typed error codes (`ErrorCode`), user-facing localized messages, global error snackbar, inline error banners, toast notifications, nested React error boundaries, और in-app error history (cap 50) के साथ structured error system। सभी errors `formatError()` के माध्यम से normalize होते हैं और IPC across propagate होते हैं।

## Supported media formats

### Video codecs (51)

| Group                      | Codecs                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Software (28)**          | H.264 (libx264, libx264rgb), H.265/HEVC (libx265, Kvazaar), VP8 (libvpx), VP9 (libvpx-vp9), AV1 (libaom-av1, SVT-AV1, rav1e), MPEG-4 (libxvid, mpeg4), MPEG-1, MPEG-2, Theora, JPEG 2000 (libopenjpeg), WebP (libwebp, libwebp_anim), ProRes (prores, prores_ks), Huffyuv, FFV1, Ut Video, MJPEG, PNG, TIFF, VC-2, AVS (libxavs, libxavs2) |
| **NVIDIA NVENC (3)**       | H.264 (h264_nvenc), H.265 (hevc_nvenc), AV1 (av1_nvenc)                                                                                                                                                                                                                                                                                    |
| **Intel QSV (5)**          | H.264, H.265, MPEG-2, VP9, AV1                                                                                                                                                                                                                                                                                                             |
| **AMD AMF (3)**            | H.264, H.265, AV1                                                                                                                                                                                                                                                                                                                          |
| **VAAPI (6)**              | H.264, H.265, MJPEG, VP8, VP9, AV1                                                                                                                                                                                                                                                                                                         |
| **Apple VideoToolbox (4)** | H.264, H.265, ProRes, VP9                                                                                                                                                                                                                                                                                                                  |
| **Media Foundation (2)**   | H.264, H.265                                                                                                                                                                                                                                                                                                                               |

### Audio codecs (27)

| Group             | Codecs                                                    |
| ----------------- | --------------------------------------------------------- |
| **AAC / MPEG**    | AAC (native, FDK), MP3 (LAME, libshine), MP2 (libtwolame) |
| **Dolby**         | AC-3, E-AC-3, TrueHD, DTS, MLP                            |
| **Lossless**      | FLAC, ALAC, WavPack                                       |
| **Streaming**     | Vorbis, Opus, Speex, AMR-WB                               |
| **PCM**           | s16le, s24le, f32le, s16be, u8, A-law, Mu-law             |
| **Windows Media** | WMA v1, WMA v2                                            |
| **Other**         | ADPCM IMA (WAV)                                           |

### Pixel formats (56)

| Group               | Formats                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| **YUV 8-bit**       | yuv420p, yuv422p, yuv444p, yuv410p, yuv411p, yuv440p, yuvj420p, yuvj422p, yuvj444p     |
| **YUV 10-bit**      | yuv420p10le, yuv422p10le, yuv444p10le                                                  |
| **YUV 12-bit**      | yuv420p12le, yuv422p12le, yuv444p12le                                                  |
| **YUV 16-bit**      | yuv420p16le, yuv444p16le                                                               |
| **YUV Semi-planar** | nv12, nv21, nv16, nv20le                                                               |
| **YUV with Alpha**  | yuva420p, yuva422p, yuva444p, yuva420p10le, yuva444p10le, yuva444p16le                 |
| **RGB Packed**      | rgb24, bgr24, rgb0, bgr0, rgba, bgra, argb, abgr, rgb48le, bgr48le, rgba64le, bgra64le |
| **Planar RGB**      | gbrp, gbrp10le, gbrp12le, gbrp16le, gbrap, gbrap10le, gbrap16le                        |
| **Monochrome**      | gray, gray10le, gray12le, gray16le, grayf32le, ya8, ya16le                             |
| **HDR**             | p010le, p016le, x2rgb10le                                                              |

### Input file extensions

| Category | Extensions                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Video    | `mp4`, `m4v`, `avi`, `mkv`, `mov`, `qt`, `flv`, `f4v`, `wmv`, `asf`, `webm`, `3gp`, `3g2`, `mpg`, `mpeg`, `mts`, `m2ts`, `ts`, `mxf`, `ogv`, `ogg`, `vob`, `divx`, `dv`, `rm`, `rmvb`, `h264`, `h265`, `hevc` |
| Audio    | `mp3`, `aac`, `wav`, `flac`, `ogg`, `opus`, `m4a`, `wma`, `alac`, `aiff`, `aif`, `au`, `caf`, `pcm`, `mid`, `midi`                                                                                            |
| Image    | `jpg`, `jpeg`, `png`, `webp`, `bmp`, `gif`, `tiff`, `tif`, `svg`, `ico`, `heic`, `heif`, `avif`, `ppm`, `pgm`, `pbm`, `xbm`                                                                                   |
| Subtitle | `srt`, `ass`, `ssa`, `vtt`, `sub`, `idx`, `smi`                                                                                                                                                               |

## Validation utilities

| Function                     | Description                | Accepted Formats                                      |
| ---------------------------- | -------------------------- | ----------------------------------------------------- |
| `isValidTime(value)`         | Validates time strings     | `HH:MM:SS`, `HH:MM:SS.mmm`, seconds as number         |
| `isValidScale(value)`        | Validates resolution/scale | `WxH`, `W:H`, percentage `1%`–`999%`, positive number |
| `isValidBitrate(value)`      | Validates bitrate strings  | e.g. `128k`, `1M`, `2000K`                            |
| `isInRange(value, min, max)` | Checks numeric range       | Any finite number                                     |

## Transcoder constants

| Constant                                          | Value                                                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRANSCODER_TYPES`                                | `['FFMPEG', 'FFTOOL', 'BMF']`                                                                                                                                     |
| `TRANSCODER_LABELS`                               | `{ FFMPEG: 'FFmpeg (API)', FFTOOL: 'FFmpeg (CLI)', BMF: 'BMF Framework' }`                                                                                        |
| `FFMPEG_FLAGS`                                    | `-c`, `-vcodec`, `-acodec`, `-b:v`, `-b:a`, `-qscale:v`, `-vf`, `-pix_fmt`, `-color_range`, `-ss`, `-to`, `-t`, `-y`, `-i`, `-an`, `-sn`, `-dn`, `-re`, `-copyts` |
| `FFPROBE_FLAGS`                                   | `-v quiet -print_format json -show_format -show_streams`                                                                                                          |
| `TRANSCODER_COMMANDS`                             | `bmf_ffmpeg`, `bmf_ffprobe`, `ffmpeg`, `ffprobe`                                                                                                                  |
| `TRANSCODER_DEFAULTS.PROGRESS_INTERVAL_MS`        | `500`                                                                                                                                                             |
| `TRANSCODER_DEFAULTS.PLAYER_DEFAULT_WIDTH/HEIGHT` | `640` / `360`                                                                                                                                                     |
| `TRANSCODER_DEFAULTS.PLAYER_FPS_CAP`              | `30`                                                                                                                                                              |
| `TRANSCODER_DEFAULTS.FFPROBE_TIMEOUT_MS`          | `30000`                                                                                                                                                           |
| `CONVERSION_DEFAULTS.VIDEO_CODEC`                 | `libx264`                                                                                                                                                         |
| `CONVERSION_DEFAULTS.AUDIO_CODEC`                 | `aac`                                                                                                                                                             |
| `CONVERSION_DEFAULTS.QSCALE`                      | `23`                                                                                                                                                              |
| `CONVERSION_DEFAULTS.PIXEL_FORMAT`                | `yuv420p`                                                                                                                                                         |
| `CONVERSION_DEFAULTS.SCALE`                       | `1920x1080`                                                                                                                                                       |
| `CONVERSION_DEFAULTS.VIDEO_BITRATE`               | `2000k`                                                                                                                                                           |
| `CONVERSION_DEFAULTS.AUDIO_BITRATE`               | `192k`                                                                                                                                                            |
| `QSCALE_RANGE.MIN/MAX`                            | `1` / `31`                                                                                                                                                        |
