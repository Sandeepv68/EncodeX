# 💻 CLI उपयोग

<!-- drift: cli-subcommands=8 -->

पहले build करें, फिर `encodex` command के माध्यम से compiled CLI invoke करें (`bin/encodex.js` launcher Electron binary को wrap करता है)। CLI मोड स्पष्ट रूप से `--cli`, `-h`/`--help`, या किसी भी subcommand/alias नाम से सक्रिय होता है, या स्वचालित रूप से तब जब कम से कम दो non-flag पोज़िशनल arguments (input + output) दिए जाते हैं:

```bash
# फ़ाइल convert करें (subcommand form)
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac

# फ़ाइल convert करें (legacy flat form — अब भी काम करता है)
encodex input.mp4 output.avi --video-codec libx265 --audio-codec aac

# मीडिया जानकारी मानव-पठनीय table में
encodex info input.mp4

# मीडिया जानकारी JSON में
encodex info input.mp4 --json

# Transcoder capabilities की सूची
encodex capabilities
encodex capabilities --json

# किसी अलग container में lossless copy
encodex convert input.mkv output.mp4 --copy

# एक segment cut करें
encodex convert input.mp4 output.mp4 --start-time 00:01:00 --end-time 00:02:30

# Video filter chain लागू करें (re-encode आवश्यक)
encodex convert input.mp4 output.mp4 --filters fps=30,eq=brightness=0.1

# Curated presets को custom chain के साथ मिलाएँ
encodex convert input.mp4 output.mp4 --preset grayscale --filters eq=gamma=1.2

# छवि compress करें
encodex compress photo.png -f jpg -q 30

# ऑडियो extract करें (डिफ़ॉल्ट रूप से mp3)
encodex extract-audio input.mp4

# नए container में remux (stream copy)
encodex remux input.mkv -f mp4
encodex rmx input.mkv -o output.mp4

# Extra tracks, cover art और chapters के साथ remux
encodex remux input.mkv -o output.mkv \
  --add-audio commentary.m4a \
  --add-subtitle 'subs.en.srt::mov_text' \
  --thumbnail cover.jpg \
  --chapters chapters.ffmeta

# Shifted audio timeline के साथ remux (primary + added track)
encodex remux input.mkv -o output.mkv --audio-sync 0.5 --add-audio commentary.m4a --set-sync -0.25

# एक stream selection के साथ remux (केवल video, कोई subtitle stream नहीं)
encodex remux input.mkv -o output.mkv --map 0:v:0 --no-subtitles

# हर stream kind को अलग फ़ाइलों में demux करें
encodex demux input.mkv --output-dir parts

# केवल कुछ kinds demux करें, अनुरोध अनुसार re-encode करते हुए
encodex demux input.mkv --audio --audio-codec mp3 --output-dir parts
encodex demux input.mkv --video --video-container mp4 --output-dir parts
encodex demux input.mkv --subtitles --subtitle-format srt --output-dir parts
encodex split input.mkv --audio --output-dir parts

# कई फ़ाइलें / globs batch-convert करें
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted

# एक विशिष्ट transcoder core उपयोग करें
encodex convert input.mp4 output.mp4 --transcoder FFTOOL
```

CLI मोड सक्रिय होने के बाद legacy flat usage (`encodex in.mp4 out.mp4`, `encodex --info in.mp4`) स्वचालित रूप से संगत subcommand पर map होता है। `encodex --info in.mp4` अकेले में केवल एक पोज़िशनल argument रखता है और `--cli` पास न करने पर GUI खोलता है। `remux` और `demux` केवल स्पष्ट subcommands के रूप में उपलब्ध हैं (या उनके `rmx`/`split` aliases से) — दो पोज़िशनल वाली bare invocation हमेशा `convert` ही रहती है।

`encodex` को global रूप से उपलब्ध कराने के लिए project root से `npm link` (या `npm install -g .`) चलाएँ। वैकल्पिक रूप से कच्चा `npx electron . --cli ...` form भी काम करता है।

## 📋 Subcommands

| Subcommand         | विवरण                                                                               |
| ------------------ | ----------------------------------------------------------------------------------- |
| `convert`          | मीडिया convert करें (कोई subcommand मेल न खाए तो डिफ़ॉल्ट)। Alias: `c`                  |
| `info`             | मीडिया जानकारी दिखाएँ (मानव-पठनीय table, या machine output के लिए `--json`)                |
| `capabilities`     | उपलब्ध transcoder capabilities की सूची (table या `--json`)                           |
| `compress`         | एक छवि compress करें (केवल छवियाँ)                                                    |
| `extract-audio`    | audio stream extract करें (डिफ़ॉल्ट codec `libmp3lame`)। Alias: `audio`                |
| `remux`            | stream copy द्वारा दूसरे container में remux करें, वैकल्पिक अतिरिक्त tracks के साथ। Alias: `rmx` |
| `demux`            | हर stream को अलग फ़ाइल में extract करें। Alias: `split`                                  |
| `batch`            | कई inputs (फ़ाइलें, globs, या directories) queue के साथ convert करें                    |

## ⚙️ Global Options

Global options subcommand नाम से पहले या बाद में रखे जा सकते हैं।

| Option                      | विवरण                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `--transcoder <type>`       | Transcoder core: `FFMPEG`, `FFTOOL`, `BMF` (डिफ़ॉल्ट: `FFMPEG`)                                                                          |
| `--theme <id>`              | Logo color theme: `light`, `ocean`, `sunset`, `forest`, `lavender`, `rose`, `slate`, `dark` (डिफ़ॉल्ट: `light`)                          |
| `--verbose`                 | Verbose logging (status stderr पर जाता है)                                                                                              |
| `--quiet`                   | Status output दबाएँ                                                                                                                     |
| `--no-color`                | ANSI colors बंद करें                                                                                                                    |
| `--json`                    | Machine-readable JSON output (status stderr पर जाता है)                                                                                 |
| `--timeout <seconds>`       | Conversion timeout सेकंड में (डिफ़ॉल्ट: `300`)                                                                                          |

## 🔄 Convert Options

| Option                      | विवरण                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `-v, --video-codec <codec>` | Video codec (जैसे `libx264`, `libx265`, `copy`)                                       |
| `-a, --audio-codec <codec>` | Audio codec (जैसे `aac`, `libmp3lame`, `copy`)                                        |
| `-q, --qscale <qscale>`     | Quality scale (1–31)                                                                  |
| `--bitrate-video <bitrate>` | Video bitrate (जैसे `1000k`)                                                          |
| `--bitrate-audio <bitrate>` | Audio bitrate (जैसे `192k`)                                                           |
| `--pix-fmt <format>`        | Pixel format (जैसे `yuv420p`, `yuv444p`)                                              |
| `-s, --scale <WxH>`         | Output resolution (जैसे `1280x720` या `50%`)                                          |
| `--start-time <time>`       | Start time (`HH:MM:SS` या seconds)                                                    |
| `--end-time <time>`         | End time                                                                              |
| `--duration <time>`         | Duration                                                                              |
| `--copy`                    | Lossless stream copy                                                                  |
| `--no-audio`                | Output से audio stream हटाएँ                                                           |
| `--no-video`                | Output से video stream हटाएँ (केवल audio)                                             |
| `--hwaccel / --no-hwaccel`  | Hardware acceleration toggle करें                                                      |
| `--hwaccel-mode <auto\|encode>` | Hardware acceleration mode (डिफ़ॉल्ट: `auto`)                                     |
| `--filters <chain>`         | Video filter chain, comma-separated (जैसे `fps=30,eq=brightness=0.1`)                 |
| `--preset <id>`             | Curated filter preset (repeatable; ids: `crop`, `framerate`, `deinterlace`, `denoise`, `sharpen`, `color`, `grayscale`, `blur`) |
| `--info`                    | इनपुट की media info प्रिंट करें और बाहर निकलें (CLI मोड आवश्यक, जैसे `--cli`)            |

Filters के लिए re-encode आवश्यक है: `--filters`/`--preset` को `--copy` के साथ जोड़ना अस्वीकार किया जाता है। Presets free-form chain से पहले expand होते हैं, `-vf` क्रम तय करते हुए (`--preset grayscale --filters fps=30` → `hue=s=0,fps=30`); resolved chain `--verbose` के साथ प्रिंट होती है।

## 🖼️ Compress Options

`compress` केवल छवियों के लिए है; video/audio के लिए `convert` या `extract-audio` उपयोग करें।

| Option                      | विवरण                                                  |
| --------------------------- | ------------------------------------------------------ |
| `-o, --output <file>`       | Output फ़ाइल                                           |
| `-f, --format <format>`     | Output format (output extension से डिफ़ॉल्ट)            |
| `-q, --quality <qscale>`    | Quality scale 1–31                                     |
| `-s, --scale <WxH>`         | Output resolution                                      |

## 🎵 Extract-audio Options

| Option                      | विवरण                                                  |
| --------------------------- | ------------------------------------------------------ |
| `-o, --output <file>`       | Output फ़ाइल                                           |
| `-a, --audio-codec <codec>` | Audio codec (डिफ़ॉल्ट: `libmp3lame`)                   |
| `--bitrate-audio <bitrate>` | Audio bitrate (जैसे `192k`)                            |

## 🔁 Remux Options

Containers के बीच stream copy — जोड़ा गया track re-encode माँगे तो छोड़कर कोई re-encode नहीं।

| Option                          | विवरण                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `-o, --output <file>`           | Output फ़ाइल (डिफ़ॉल्ट: इनपुट नाम target extension के साथ)                                               |
| `-f, --format <format>`         | Target container (डिफ़ॉल्ट `--output` से, फिर इनपुट extension से)                                      |
| `--map <spec>`                  | Copy करने वाला stream, repeatable (`0:v:0`, `0:a:1`, …); डिफ़ॉल्ट primary video + audio (+ subtitles) की जगह लेता है |
| `--add-subtitle <file[::codec]>` | बाहरी subtitle फ़ाइल mux करें; `::codec` encoder बदलता है (जैसे `subs.srt::mov_text`)                    |
| `--add-audio <file>`            | बाहरी audio फ़ाइल mux करें                                                                              |
| `--thumbnail <image>`           | Cover art mux करें (MKV/WebM के लिए attachment, MP4/MOV के लिए `attached_pic` disposition)               |
| `--chapters <file>`             | Chapters फ़ाइल (ffmetadata) mux करें                                                                    |
| `--no-chapters`                 | Chapters छोड़ें (डिफ़ॉल्ट रूप से source chapters भी copy होते हैं)                                       |
| `--subtitle-codec <codec>`      | Added subtitles का encoder (प्रति-फ़ाइल `::codec` suffix को override करता है)                            |
| `--no-subtitles`                | Source के subtitle streams छोड़ें (explicit `--map` के साथ अनदेखा)                                       |
| `--audio-sync <seconds>`        | Primary audio timeline shift करें (ऋणात्मक मान अनुमत)                                                     |
| `--set-sync <seconds>`          | पिछले `--add-subtitle`/`--add-audio` input को shift करें                                                  |
| `--filters <chain>`             | Video filter chain, comma-separated (repeatable)                                                       |

Remux copy-first है: ऐसा target container जो चुने गए stream को नहीं रख सकता (जैसे WebM में subtitle) usage error (exit `2`) से अस्वीकार होता है, चुपचाप drop नहीं होता; और लापता input, subtitle, audio, cover या chapters फ़ाइल FFmpeg शुरू होने से पहले `4` के साथ बाहर निकलती है। गैर-अवरोधक findings (जैसे ऐसा container जो chapters फ़ाइल स्टोर नहीं कर सकता) warnings के रूप में प्रिंट होते हैं और remux आगे बढ़ता है। Added subtitle codecs इस क्रम में resolve होते हैं: `--subtitle-codec`, फिर प्रति-फ़ाइल `::codec` suffix, फिर container का डिफ़ॉल्ट (MP4/MOV के लिए `mov_text`, MKV के लिए `subrip`)। `--audio-sync`/`--set-sync` FFmpeg का re-read उपयोग करते हैं, इसलिए offset output timestamps पर लागू होता है, re-encoding नहीं होती।

`--filters` lossless copy से एकमात्र बाहर निकलने का रास्ता है। FFmpeg filter chain stream-copied streams पर नहीं चल सकती, इसलिए इसे पास करने पर चुने गए streams copy के बजाय re-encode होते हैं और `filters_force_reencode` finding प्रिंट होता है। बाकी सब — stream compatibility, chapter copying, `--map` — शुद्ध remux की तरह ही व्यवहार करता है। `remux` पर `--copy` flag नहीं है, इसलिए दोनों कभी टकराते नहीं। Chains दिए गए क्रम में merge होते हैं और `convert` जैसा ही `preset.value` shorthand स्वीकार करते हैं (`--filters framerate.60` → `fps=60`); अमान्य chain usage error है और खाली chain अनदेखी होती है।

```bash
encodex remux input.mp4 output.mkv --filters fps=24
encodex remux input.mkv output.mp4 --filters 'fps=24,eq=brightness=0.1' --filters scale=-2:720
```

## ✂️ Demux Options

| Option                            | विवरण                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `--output-dir <dir>`              | Extracted streams की directory (लापता होने पर बनती है; डिफ़ॉल्ट: इनपुट के बगल में)              |
| `--video` / `--audio` / `--subtitles` | केवल दिए गए stream kinds extract करें                                                  |
| `--all`                           | हर kind extract करें (डिफ़ॉल्ट)                                                              |
| `--video-container <ext>`         | Video को इस container में re-encode करें, जब वह stream के मूल container से अलग हो               |
| `--audio-codec <codec>`           | Audio को इस encoder से re-encode करें (जैसे `mp3`, `flac`, `aac`)                             |
| `--subtitle-format <srt\|ass\|copy>` | Text subtitles को इस format में बदलें                                                    |
| `--video-filters <chain>`         | Re-encode होते समय लागू video filter chain (repeatable)                                      |

Output नाम इनपुट से बनते हैं (`movie.video.mp4`, `movie.audio_0.m4a`, `movie.subtitle_0.srt`)। Cover-art streams कभी extract नहीं होते (उन्हें रखने के लिए `remux` उपयोग करें), bitmap subtitles (PGS/DVDSUB) text में नहीं बदले जा सकते और चेतावनी के साथ `.mks` में stream-copy होते हैं, और जो kind filter किसी stream से मेल न खाए वह usage error (exit `2`) है; लापता input फ़ाइल `4` से बाहर निकलती है। हर target क्रम से convert होता है, इसलिए `--transcoder` सभी पर लागू होता है।

`--video-filters` केवल re-encode होने वाले video target पर लागू होता है। Filter chain को decoder चाहिए, इसलिए stream-copy वाला video target उसे उपयोग नहीं कर सकता: बिना ऐसे `--video-container` के जो video को re-encode करे, `--video-filters` पास करना usage error से अस्वीकार होता है, चुपचाप drop नहीं होता। Audio और subtitle targets को chain कभी नहीं मिलती। `convert` की तरह, chains दिए गए क्रम में merge होते हैं, `preset.value` shorthand स्वीकार करते हैं, और `--verbose` के साथ प्रिंट होते हैं।

```bash
encodex demux input.mp4 --video --video-container mkv --video-filters fps=24
```

## 📋 Batch Options

| Option                      | विवरण                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `--concurrency <n>`         | अधिकतम समानांतर conversions (डिफ़ॉल्ट: `4`, 1–4 तक सीमित)                                  |
| `--output-dir <dir>`        | Converted फ़ाइलों की output directory                                                    |
| `--suffix <s>`              | व्युत्पन्न output नामों में जोड़ा जाने वाला suffix (डिफ़ॉल्ट: `_encodex_converted`)          |

Batch सभी convert encoding options भी स्वीकार करता है (`-v/--video-codec`, `-a/--audio-codec`, `--bitrate-video`, `--bitrate-audio`, `-q/--qscale`, `--pix-fmt`, `-s/--scale`, `--copy`, `--no-audio`, `--no-video`, `--filters`, `--preset`) और उन्हें हर job पर लागू करता है। Filters फिर से re-encode माँगते हैं, इसलिए filters के साथ `--copy` usage error से अस्वीकार होता है।

## 🤖 MCP Server Mode

EncodeX एक headless [Model Context Protocol](https://modelcontextprotocol.io) server के रूप में चल सकता है, ताकि MCP hosts (Claude Desktop, Claude Code, VS Code, Cursor, custom agents) conversions चला सकें। यह एक **mode** है, subcommand नहीं: `--mcp` पास करें और ऐप GUI और CLI शाखाएँ छोड़ देता है और stdio पर JSON-RPC बोलता है।

```bash
# Packaged app
encodex --mcp

# Source checkout (compiled Node entry point — पहले npm run build:main चलाएँ)
node dist/mcp/index.js

# कच्चा Electron form
npx electron . --mcp
```

stdout केवल MCP JSON-RPC messages के लिए आरक्षित है; सभी status और logging output stderr पर redirect होता है, और stdin बंद होने तक process चलती रहती है। Stdio server 36 model-visible tools (37 registrations, app-only `commit_operation` सहित), 3 resources और 4 prompts expose करता है; embedded HTTP surface 6 GUI-parity tools जोड़ता है, जिससे कुल 42 model-visible tools (43 registrations) होते हैं — पूरी catalogue और client configuration के लिए [`MCP.md`](../MCP.md) देखें।

| Option  | विवरण                                                                         |
| ------- | ----------------------------------------------------------------------------- |
| `--mcp` | stdio MCP server के रूप में चलाएँ (कोई GUI नहीं, कोई CLI subcommand नहीं, कोई `app.exit` नहीं) |

एक दूसरा, opt-in surface चल रहे GUI के अंदर **embedded HTTP server** है (`http://127.0.0.1:8765/mcp`), जो उसी core के ऊपर live queue, preview, timeline, system और update tools जोड़ता है। इसे **Settings → MCP Server** में सक्षम करें; देखें [`MCP.md`](../MCP.md#embedded-http-server-gui-mode)।

## 🚪 Exit Codes

| Code | Constant                     | अर्थ                                            |
| ---- | ---------------------------- | ----------------------------------------------- |
| `0`  | `EXIT_CODES.SUCCESS`         | सफल समापन                                       |
| `1`  | `EXIT_CODES.ERROR`           | सामान्य त्रुटि                                   |
| `2`  | `EXIT_CODES.USAGE`           | अमान्य/अपूर्ण arguments                          |
| `3`  | `EXIT_CODES.CANCELLED`       | उपयोगकर्ता द्वारा operation रद्द                  |
| `4`  | `EXIT_CODES.NOT_FOUND`       | Input फ़ाइल, FFmpeg, या FFprobe नहीं मिला         |
| `5`  | `EXIT_CODES.TIMEOUT`         | Conversion `--timeout` से अधिक समय तक चला        |
