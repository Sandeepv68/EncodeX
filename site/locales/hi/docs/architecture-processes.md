# प्रोसेस, बिल्ड सिस्टम और स्टार्टअप

## प्रोसेस मॉडल

### मुख्य प्रोसेस (`src/main/`)

Node.js वातावरण। एप्लिकेशन लाइफ़साइकल और सभी विशेषाधिकार प्राप्त क्षमताओं का मालिक:

- splash और मुख्य `BrowserWindow` बनाता है और IPC हैंडलर रजिस्टर करता है (`index.ts`)।
- CLI एंट्री पॉइंट को होस्ट करता है (`cli/`)।
- FFmpeg/FFprobe बाइनरी पथ को रिज़ॉल्व करता है और एनकोडर क्षमताओं का प्रोब करता है (`capabilities.ts`, `process-utils.ts`)।
- transcoder कोर को लागू करता है (`transcoders/`)।
- कंकरेंसी-कैप्ड बैच क्यू (1-4 समानांतर जॉब) चलाता है (`queue/job-queue.ts`)।
- बिल्ट-इन प्लेयर के लिए वीडियो फ़्रेम और ऑडियो PCM डिकोड करता है (`player/frame-decoder.ts`)।
- वेवफ़ॉर्म और थंबनेल मोंटाज निकालता है (`timeline/timeline-media.ts`)।
- EXIF डेटा, हिस्टोग्राम, इमेज आयाम और पूर्वावलोकन पढ़ता है (`image-*.ts`, `video-preview.ts`)।
- renderer के `console` आउटपुट को लॉग सिस्टम में ब्रिज करता है (`index.ts` में `patchConsole`)।

### Preload स्क्रिप्ट (`src/preload/index.ts`)

एक अलग कॉन्टेक्स्ट में चलता है। renderer को एक curated, टाइप किया हुआ API उजागर करने के लिए `contextBridge.exposeInMainWorld('electronAPI', api)` का उपयोग करता है। हर विधि `ipcRenderer.invoke` (request/response) या `ipcRenderer.send` (fire-and-forget) पर एक पतला wrapper है, और हर इवेंट सदस्यता एक क्लीनअप फ़ंक्शन लौटाती है जो उसका listener हटा देती है। Electron या Node का कोई अन्य भाग renderer तक नहीं पहुँचता।

### Renderer प्रोसेस (`src/renderer/`)

ब्राउज़र वातावरण — डेवलपमेंट में Vite द्वारा serve किया जाता है और प्रोडक्शन में `dist/renderer/index.html` से लोड होता है। शुद्ध React — कोई Node APIs नहीं। मुख्य प्रोसेस से केवल `window.electronAPI` (इलेक्ट्रॉन-api.d.ts में टाइप) के माध्यम से इंटरैक्ट करता है।

### साझा लेयर (`src/shared/`)

शुद्ध TypeScript, जिसे तीनों प्रोसेस आयात करती हैं। इसमें IPC चैनल रजिस्ट्री, डोमेन प्रकार, एरर सिस्टम, logger, कॉन्स्टेंट्स, कोडेक सूचियाँ, वैलिडेशन helpers और लॉग संदेश कॉन्स्टेंट शामिल हैं। चूँकि `package.json` अलग पैकेज सीमाओं का उपयोग नहीं करता, यह निर्देशिका प्रत्येक प्रोसेस रूट से सापेक्ष imports के माध्यम से संदर्भित होती है।

## बिल्ड सिस्टम

तीन TypeScript प्रोजेक्ट plus Vite तीन आउटपुट फ़ोल्डर बनाते हैं:

| स्क्रिप्ट                | कंपाइल                      | आउटपुट            |
| ------------------------ | --------------------------- | ----------------- |
| `build:renderer`         | `vite build`                | `dist/renderer/`  |
| `build:main`             | `tsc -p tsconfig.main.json` | `dist/main/`      |
| `build:preload`          | `tsc -p tsconfig.preload.json` | `dist/preload/` |

`npm run build` तीनों को क्रम में चलाता है। मुख्य प्रोसेस preload को `dist/preload/index.js` से और renderer को `dist/renderer/index.html` (प्रोडक्शन) या Vite dev सर्वर (डेवलपमेंट, `--dev` flag या `NODE_ENV=development`) से लोड करता है।

Electron-builder ऐप को Windows (NSIS), macOS (DMG), और Linux (AppImage) के लिए पैकेज करता है, `ffmpeg-static` और `ffprobe-static` को `extraResources` के रूप में बंडल करता है ताकि बाइनरी ऐप के साथ यात्रा करें। CI रिलीज़ वर्कफ़्लो प्रत्येक लक्ष्य प्लेटफ़ॉर्म/आर्किटेक्चर के लिए पहले से बनी बाइनरी को `scripts/fetch-media-binaries.mjs` के माध्यम से डाउनलोड करता है।

### बाइनरी रेज़ोल्यूशन

सभी FFmpeg/FFprobe बाइनरी रेज़ोल्यूशन `src/main/media-binaries.ts` (`getFfmpegPath` / `getFfprobePath`) में केंद्रीकृत है, जिसका उपभोग हर transcoder, फ़्रेम डिकोडर, timeline media, इमेज/वीडियो पूर्वावलोकन और CLI द्वारा किया जाता है। फ़ॉलबैक श्रृंखला:

1. **पैकेज किया गया ऐप**: Electron की `resources` निर्देशिका के अंतर्गत `extraResources` के रूप में बंडल की गई बाइनरी (`resources/ffmpeg-static/...` और `resources/ffprobe-static/...`, बाद वाला प्लेटफ़ॉर्म/आर्किटेक्चर-विशिष्ट subpath का उपयोग करता है)।
2. **अनपैकेज्ड (dev/CLI/tests)**: इंस्टॉल की गई `node_modules/ffmpeg-static` और `node_modules/ffprobe-static` बाइनरी (प्रत्येक पैकेज के `exports` मैप पर `import` कुंजी से रिज़ॉल्व, इसलिए ESM से भी काम करता है)।
3. `PATH` से सिस्टम कमांड (`ffmpeg` / `ffprobe`)।

## स्टार्टअप अनुक्रम

1. `main/index.ts` चलता है। यह `isCliMode()` में `process.argv` की जाँच करता है।
2. **CLI मोड** (स्पष्ट `--cli`/`--help`, या >=2 पोज़िशनल args): कोई विंडो रजिस्टर नहीं करता। `app.whenReady()` पर `runCli()` कॉल करता है और `SUCCESS` या `ERROR` कोड के साथ बाहर निकलता है।
3. **GUI मोड**: `autoplay-policy` स्विच सक्षम करता है, एक नॉन-इंटरैक्टिव splash विंडो बनाता है (तुरंत दिखाई देती है), फिर फ़्रेमलेस मुख्य विंडो (`show: false`)।
4. `registerIpcHandlers(mainWindow)` सभी IPC मॉड्यूल को वायर करता है; `patchConsole` `console.*` को बदल देता है ताकि मुख्य प्रोसेस लॉग `log-message` चैनल पर renderer को फ़ॉरवर्ड हों।
5. `ready-to-show` पर मुख्य विंडो दिखाई जाती है, उस समय splash बंद हो जाती है।
6. प्रोडक्शन में renderer `dist/renderer/index.html` से लोड होता है; डेवलपमेंट में DevTools खोलकर `http://localhost:5173` से।

## CLI मोड

`src/main/cli/cli.ts` सबकमांड्स के साथ **commander** का उपयोग करता है। जब `runCli()` निष्पादित होता है:

1. एक legacy shim फ़्लैट उपयोग (`encodex in.mp4 out.mp4` -> `convert`, `encodex --info in.mp4` -> `info`) को संगत सबकमांड पर मैप करता है।
2. प्रत्येक सबकमांड अपने विकल्प plus साझा globals (`--transcoder`, `--theme`, `--verbose`, `--quiet`, `--no-color`, `--json`, `--timeout`) parse करता है।
3. `info`/`capabilities` डिफ़ॉल्ट रूप से मानव-पठनीय तालिकाएँ और `--json` के साथ JSON प्रिंट करते हैं।
4. `convert`/`compress`/`extract-audio`/`batch` एक `ConversionOptions` ऑब्जेक्ट बनाते हैं और `transcoder.convert(...)` कॉल करते हैं (batch एक in-memory `JobQueue` को `MultiBar` के साथ चलाता है)।
5. प्रगति `stdout` पर जाती है (watchdog timeout के साथ), status/success लाइनें `--json`/`--quiet`/`--verbose` रूटिंग का सम्मान करती हैं, और प्रोसेस `mapCliErrorToExitCode` के माध्यम से समाप्त होती है (usage=2, cancelled=3, not-found=4, timeout=5, success=0)।

CLI GUI के समान transcoder pipeline का पुन: उपयोग करता है — बनाए रखने के लिए कोई अलग एनकोडिंग पथ नहीं है।

## साझा कोड लेयर

सबसे महत्वपूर्ण आर्किटेक्चरल निर्णय यह है कि सभी क्रॉस-प्रोसेस अनुबंध `src/shared/` में रहते हैं:

- **`types.ts`** — `ConversionOptions`, `MediaInfo`, `MediaStreamInfo`, `QueueJob`, `ConversionProgress`, `PlayerFrame`, `PlayerAudioChunk`, `WaveformData`, `ThumbnailStrip`, `EncoderCapabilities`, `LogEntry`, `FileItem`, `ConversionOperation`, `UpdateInfo`, `UpdateAsset`, `UpdateProgress`।
- **`ipc-channels.ts`** — `IPC` कॉन्स्टेंट ऑब्जेक्ट, प्रत्येक चैनल स्ट्रिंग का अद्वितीय सत्य स्रोत। main, preload और renderer सभी इससे import करते हैं, इसलिए चैनल नाम कभी भी प्रोसेस के बीच नहीं बदल सकता।
- **`errors.ts`** — टाइप किया हुआ एरर सिस्टम ([एरर हैंडलिंग](/hi/docs/architecture-renderer#error-handling) देखें)।
- **`constants.ts` / `app-constants.ts`** — संख्यात्मक सीमाएँ और UI लेआउट मान (विंडो आकार, waveform buckets, थंबनेल आयाम, error-history कैप आदि)।
- **`transcoder-constants.ts` / `hwaccel-settings.ts`** — FFmpeg flags, डिफ़ॉल्ट, progress पैटर्न और हार्डवेयर एक्सेलेरेशन सेटिंग्स।
- **`media-options.ts` / `codec-containers.ts` / `codec-classification.ts`** — 51 वीडियो कोडेक, 27 ऑडियो कोडेक, 56 पिक्सेल फ़ॉर्मेट, container-compatibility नियमों और codec-family helpers की curated सूचियाँ।
- **`validation.ts`** — time/scale/bitrate/range वैलिडेशन के लिए शुद्ध फ़ंक्शन, renderer फ़ॉर्म और CLI दोनों द्वारा उपयोग किए जाते हैं।
- **`logger.ts` / `log-constants.ts`** — timestamped logger plus ~406 साझा लॉग संदेश templates ताकि लॉग प्रोसेस के बीच सुसंगत रहें।
