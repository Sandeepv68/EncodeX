FFmpeg separates **containers/formats (muxers/demuxers)** from **codecs/encoders**, so an exhaustive "format list" is not the same thing as an exhaustive list of possible export combinations. FFmpeg also has optional external libraries, meaning the exact capabilities depend on how your FFmpeg binary was built. ([FFmpeg][1])

For **EncodeX**, I would structure the catalogue as follows.

# EncodeX — Master Export Profile Catalogue

The key idea is:

> **Profile = human-facing name + container + video codec + audio codec + constraints/settings**

For example:

**YouTube 1080p**
`MP4 + H.264 + AAC + 1920×1080 + 8 Mbps`

rather than exposing FFmpeg's raw muxer/encoder names.

---

## 1. 🌐 Web & Social

### YouTube

| Profile              | Container | Video | Audio | Resolution |
| -------------------- | --------- | ----- | ----- | ---------- |
| YouTube 4K           | MP4       | H.264 | AAC   | 3840×2160  |
| YouTube 1440p        | MP4       | H.264 | AAC   | 2560×1440  |
| **YouTube 1080p**    | MP4       | H.264 | AAC   | 1920×1080  |
| YouTube 720p         | MP4       | H.264 | AAC   | 1280×720   |
| YouTube 480p         | MP4       | H.264 | AAC   | 854×480    |
| YouTube 360p         | MP4       | H.264 | AAC   | 640×360    |
| YouTube Shorts 4K    | MP4       | H.264 | AAC   | 2160×3840  |
| YouTube Shorts 1080p | MP4       | H.264 | AAC   | 1080×1920  |

### Instagram

| Profile               | Container | Video | Audio |
| --------------------- | --------- | ----- | ----- |
| Instagram Reel 1080p  | MP4       | H.264 | AAC   |
| Instagram Reel 720p   | MP4       | H.264 | AAC   |
| Instagram Story 1080p | MP4       | H.264 | AAC   |
| Instagram Post 1080p  | MP4       | H.264 | AAC   |

### TikTok

| Profile      | Container | Video | Audio |
| ------------ | --------- | ----- | ----- |
| TikTok 1080p | MP4       | H.264 | AAC   |
| TikTok 720p  | MP4       | H.264 | AAC   |

### Facebook

| Profile        | Container | Video | Audio |
| -------------- | --------- | ----- | ----- |
| Facebook 1080p | MP4       | H.264 | AAC   |
| Facebook 720p  | MP4       | H.264 | AAC   |
| Facebook 4K    | MP4       | H.264 | AAC   |

### X / Twitter

| Profile | Container | Video | Audio |
| ------- | --------- | ----- | ----- |
| X 1080p | MP4       | H.264 | AAC   |
| X 720p  | MP4       | H.264 | AAC   |

---

# 2. 📱 Mobile & Consumer Devices

### Apple

* iPhone 4K
* iPhone 1080p
* iPhone 720p
* iPad 4K
* iPad 1080p
* Apple TV 4K
* Apple TV HD
* Apple-compatible H.264
* Apple-compatible HEVC

Typical implementation:

`MP4 / H.264 or HEVC / AAC`

---

### Android

* Android 4K
* Android 1080p
* Android 720p
* Android Compatibility
* Android High Quality
* Android HEVC

---

### Gaming

* PlayStation 4
* PlayStation 5
* Xbox One
* Xbox Series X/S
* Nintendo Switch

For broad compatibility, MP4/H.264/AAC is generally the safest profile family.

---

# 3. 📺 TV & Home Media

* Smart TV 4K
* Smart TV 1080p
* Smart TV Compatibility
* Android TV
* Apple TV
* Chromecast
* DLNA / Home Media
* Media Server
* Plex-compatible
* Kodi-compatible

Recommended generic profiles:

```text
TV 4K
MP4 + H.265 + AAC

TV 1080p
MP4 + H.264 + AAC

Universal TV
MP4 + H.264 + AAC
```

---

# 4. 🎬 General Video

This should probably be one of EncodeX's most important sections.

### MP4

* MP4 – Maximum Compatibility
* MP4 – High Quality
* MP4 – Small File
* MP4 – 720p
* MP4 – 1080p
* MP4 – 1440p
* MP4 – 4K
* MP4 – H.264
* MP4 – H.265
* MP4 – AV1

### MKV

* MKV – Universal
* MKV – High Quality
* MKV – H.264
* MKV – H.265
* MKV – AV1
* MKV – VP9
* MKV – Lossless

### MOV

* MOV – H.264
* MOV – HEVC
* MOV – ProRes 422
* MOV – ProRes 422 HQ
* MOV – ProRes 4444
* MOV – ProRes 4444 XQ
* MOV – CineForm

### WebM

* WebM – VP8
* WebM – VP9
* WebM – AV1
* WebM – Small File
* WebM – High Quality

### AVI

* AVI – MPEG-4
* AVI – H.264
* AVI – MJPEG
* AVI – Uncompressed

### MPEG

* MPEG-1 Video
* MPEG-2 Video
* MPEG Program Stream
* MPEG Transport Stream

### Other useful containers

* M4V
* 3GP
* 3G2
* FLV
* ASF
* WMV
* OGV
* TS
* M2TS
* VOB

FFmpeg's format layer includes many more specialized muxers than these; for example, the official documentation contains dedicated muxers for AVI, APNG, AEA, AMR, ASF, DV and many game/legacy formats. ([FFmpeg][1])

---

# 5. 🎞️ Professional Video

This is where EncodeX could become considerably more powerful than a typical converter.

### Apple ProRes

* ProRes Proxy
* ProRes 422 LT
* ProRes 422
* ProRes 422 HQ
* ProRes 4444
* ProRes 4444 XQ

Containers:

`MOV / MXF`

---

### Avid DNx

* DNxHD LB
* DNxHD SQ
* DNxHD HQ
* DNxHD HQX
* DNxHD 444
* DNxHR LB
* DNxHR SQ
* DNxHR HQ
* DNxHR HQX
* DNxHR 444

---

### CineForm

* CineForm Low
* CineForm Medium
* CineForm High
* CineForm Film Scan
* CineForm Film Scan 2

---

### Lossless / Archival

* FFV1 Lossless
* FFV1 8-bit
* FFV1 10-bit
* FFV1 16-bit
* HuffYUV
* Lagarith-compatible workflows
* Uncompressed YUV
* Uncompressed RGB

FFV1 is particularly useful as an archival profile because FFmpeg provides an FFV1 encoder and supports lossless encoding. ([FFmpeg][2])

---

# 6. 🎥 Broadcast

### MPEG-2

* MPEG-2 Broadcast
* MPEG-2 HD
* MPEG-2 SD
* MPEG-2 Transport Stream

### XDCAM-style workflows

* XDCAM SD
* XDCAM HD
* XDCAM HD422

### MXF

* MXF OP1a
* MXF OP-Atom
* MXF Broadcast
* MXF MPEG-2
* MXF AVC
* MXF DNxHD
* MXF DNxHR

### JPEG 2000

* JPEG 2000
* JPEG 2000 Lossless
* JPEG 2000 2K
* JPEG 2000 4K

---

# 7. 💿 DVD / VCD / SVCD

These deserve dedicated profiles rather than simply exposing VOB/MPG.

### DVD

* DVD PAL
* DVD NTSC
* DVD Widescreen PAL
* DVD Widescreen NTSC
* DVD MPEG-2
* DVD AC-3

### VCD

* VCD PAL
* VCD NTSC

### SVCD

* SVCD PAL
* SVCD NTSC

### Blu-ray

* Blu-ray H.264
* Blu-ray MPEG-2
* Blu-ray compatible 1080p
* Blu-ray compatible 720p

---

# 8. 📡 Streaming

These aren't conventional "file conversion" profiles but would be valuable in an advanced EncodeX mode.

### HLS

* HLS 1080p
* HLS 720p
* HLS 480p
* HLS Adaptive 1080p
* HLS Adaptive 720p
* HLS Multi-bitrate

### MPEG-DASH

* DASH 1080p
* DASH 720p
* DASH Adaptive
* DASH Multi-bitrate

### Streaming protocols

* RTMP
* RTMPS
* RTP
* RTSP
* SRT
* UDP
* TCP

FFmpeg treats these separately from file formats as **protocols**, which is why I would keep them under a Streaming category in EncodeX. ([FFmpeg][3])

---

# 9. 🎵 Audio

This deserves its own major category.

### Lossy

* MP3 – 320 kbps
* MP3 – 256 kbps
* MP3 – 192 kbps
* MP3 – 128 kbps
* AAC – 320 kbps
* AAC – 256 kbps
* AAC – 192 kbps
* AAC – 128 kbps
* Opus – 160 kbps
* Opus – 128 kbps
* Vorbis – High Quality

### Lossless

* FLAC
* FLAC 16-bit
* FLAC 24-bit
* ALAC
* WAV PCM
* AIFF PCM

### Dolby

* Dolby Digital AC-3
* Dolby Digital Plus E-AC-3

FFmpeg's current codec documentation includes native AAC, AC-3, FLAC and Opus encoders, among others, while external libraries can add additional encoders. ([FFmpeg][2])

---

# 10. 🖼️ Images

### Common

* JPEG
* PNG
* WebP
* BMP
* TIFF
* GIF

### Advanced

* APNG
* AVIF
* JPEG 2000
* JPEG XL*
* DPX
* OpenEXR
* PAM
* PBM
* PGM
* PPM
* SGI
* TGA
* XBM
* XPM

*Availability depends on the particular FFmpeg version/build and libraries.

FFmpeg's format documentation explicitly includes image-oriented muxers such as APNG and AVIF. ([FFmpeg][1])

---

# 11. 🎞️ Animated Images

This is worth exposing separately in EncodeX:

* GIF
* Animated WebP
* Animated PNG
* Animated AVIF
* Image Sequence → GIF
* Image Sequence → WebP
* Image Sequence → APNG
* Image Sequence → AVIF

---

# 12. 🧑‍💻 Developer / Technical

I'd hide these under **Advanced / Developer**.

### Raw video

* Raw YUV
* Raw RGB
* YUV4MPEG
* v210
* v410
* YUV 4:2:0
* YUV 4:2:2
* YUV 4:4:4

### Raw audio

* PCM S16LE
* PCM S24LE
* PCM S32LE
* PCM S16BE
* Float32
* Float64

### Testing / analysis

* Null output
* MD5
* SHA-256
* CRC
* Framemd5
* Hash

FFmpeg even has dedicated testing/hash muxers such as `md5`, which clearly aren't end-user media formats and therefore shouldn't appear in the normal EncodeX export list. ([FFmpeg][1])

---

# 13. 📝 Subtitle / Caption Profiles

I'd also give subtitles their own export category:

* SRT
* ASS
* SSA
* WebVTT
* TTML
* SubRip
* DVB subtitles
* DVD subtitles
* EIA-608
* CEA-708
* MCC

For example:

```text
Subtitles
 ├── SRT
 ├── WebVTT
 ├── ASS
 ├── SSA
 ├── TTML
 ├── DVB
 ├── DVD
 └── Broadcast Captions
```

FFmpeg's format documentation includes dedicated subtitle muxers such as ASS/SSA and MCC. ([FFmpeg][1])

---

# 14. 🗄️ Legacy / Specialized

This is where the **truly exhaustive FFmpeg list** becomes huge.

FFmpeg supports numerous specialized formats for:

* old game consoles
* video games
* old multimedia applications
* broadcast systems
* cameras
* surveillance
* telecommunications
* old operating systems
* proprietary media formats
* raw formats
* scientific/technical formats
* metadata
* subtitle/caption systems

For example, the current FFmpeg format documentation contains specialized muxers such as **Lego Racers ALP, Rayman APM, Nintendo AST, Argonaut CVG**, etc. ([FFmpeg][1])

These are technically supported, but putting them in EncodeX's normal UI would be a UX disaster.

---

# The important distinction for EncodeX

I would **not** make your database simply:

```text
FFmpeg format → EncodeX profile
```

Instead:

```text
                    EncodeX
                       │
             ┌─────────┴─────────┐
             │                   │
        User Profiles        Advanced
             │                   │
      "YouTube 1080p"       Container
      "Instagram Reel"      Video codec
      "4K HEVC"             Audio codec
      "ProRes HQ"           Resolution
      "MP3 320k"            Bitrate
             │              Pixel format
             │              Framerate
             └───────┬───────────────┘
                     │
                  FFmpeg
                     │
          ┌──────────┼──────────┐
          │          │          │
       Muxer      Encoder    Encoder
       MP4        libx264     AAC
```

That's because FFmpeg itself describes the pipeline as **encoders producing encoded streams which are then passed to a muxer**, rather than treating "MP4" itself as the complete encoding configuration. ([FFmpeg][4])

## ⭐ My recommended EncodeX top-level categories

I'd settle on **8 categories**:

| Category             | Examples                                    |
| -------------------- | ------------------------------------------- |
| 🌐 **Web & Social**  | YouTube, Instagram, TikTok, Facebook        |
| 📱 **Devices**       | iPhone, Android, TV, PlayStation, Xbox      |
| 🎬 **Video**         | MP4, MKV, MOV, WebM, AVI                    |
| 🎞️ **Professional** | ProRes, DNxHR, CineForm                     |
| 📡 **Streaming**     | HLS, DASH, RTMP, SRT                        |
| 🎵 **Audio**         | MP3, AAC, FLAC, WAV, Opus                   |
| 🖼️ **Images**       | JPEG, PNG, WebP, AVIF, TIFF                 |
| ⚙️ **Advanced**      | Raw, legacy, broadcast, specialized formats |

### And one particularly important feature

Make **"Advanced → Custom FFmpeg"** available.

That way EncodeX doesn't need to artificially claim that its profile catalogue represents *everything FFmpeg can do*. The official FFmpeg documentation itself notes that available encoders depend on the build configuration and external libraries, and `ffmpeg -encoders` / `ffmpeg -muxers` can be used to inspect what a particular binary actually provides. ([FFmpeg][2])

So your architecture can have:

**~100–150 carefully designed consumer/professional profiles**

* **all detected FFmpeg capabilities in Advanced mode**

rather than trying to maintain thousands of arbitrary codec/container combinations.

If you're implementing this in **EncodeX**, the next logical step is to turn this into a **proper profile schema/database** with fields such as `id`, `name`, `category`, `container`, `videoCodec`, `audioCodec`, `resolution`, `fps`, `bitrate`, `crf`, `hardwareAcceleration`, `extension`, `ffmpegArgs`, and `compatibility`. That would let the Electron/React UI generate the entire export menu dynamically.

[1]: https://ffmpeg.org/ffmpeg-formats.html?utm_source=chatgpt.com "FFmpeg Formats Documentation"
[2]: https://www.ffmpeg.org/ffmpeg-codecs.html?utm_source=chatgpt.com "FFmpeg Codecs Documentation"
[3]: https://ffmpeg.org/ffmpeg-protocols.html?utm_source=chatgpt.com "FFmpeg Protocols Documentation"
[4]: https://ffmpeg.org/ffmpeg.html?utm_source=chatgpt.com "ffmpeg Documentation"
