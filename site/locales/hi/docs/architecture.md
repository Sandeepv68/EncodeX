# आर्किटेक्चर

EncodeX FFmpeg, React, TypeScript और Electron पर बना एक क्रॉस-प्लेटफ़ॉर्म मल्टीमीडिया रूपांतरण उपकरण है। यह उन डेवलपर्स के लिए है जो योगदान देने से पहले यह समझना चाहते हैं कि विभिन्न हिस्से आपस में कैसे जुड़ते हैं।

<p align="center"><img src="https://raw.githubusercontent.com/Sandeepv68/EncodeX/main/assets/architecture.png" alt="EncodeX architecture" width="1024" height="1024" loading="lazy" /></p>

## डिज़ाइन सिद्धांत

renderer कभी प्रोसेस स्पॉन नहीं करता और न ही सीधे फ़ाइल सिस्टम को छूता है। सभी विशेषाधिकार प्राप्त ऑपरेशन (फ़ाइल डायलॉग, FFmpeg एक्ज़ीक्यूशन, प्रोबिंग, विंडो कंट्रोल) मुख्य प्रोसेस में रहते हैं और IPC के माध्यम से पहुँचे जाते हैं।

- **तीन-प्रोसेस पृथक्करण** — main, preload और renderer, Electron के सुरक्षा मॉडल के अनुसार (`contextIsolation: true`, `nodeIntegration: false`)।
- **मीडिया बैकएंड पर एक अद्वितीय एब्स्ट्रैक्शन** — `ITranscoder` इंटरफ़ेस छिपाता है कि रूपांतरण `fluent-ffmpeg` से चल रहा है, कच्चे FFmpeg CLI चाइल्ड प्रोसेस से, या BMF फ्रेमवर्क से।
- **टाइप किए गए अनुबंध के रूप में IPC** — हर चैनल `src/shared/ipc-channels.ts` में एक कॉन्स्टेंट है, और renderer केवल preload स्क्रिप्ट द्वारा उजागर किए गए `window.electronAPI` ब्रिज के माध्यम से मुख्य प्रोसेस से बात करता है।
- **साझा प्रकार और कॉन्स्टेंट** — `src/shared/` को तीनों प्रोसेस आयात करती हैं ताकि इंटरफ़ेस निर्माण द्वारा sync रहें।
- **UI का प्रगतिशील संवर्द्धन** — पेज `React.lazy` से code-split हैं, state Zustand stores में रहती है, और लंबे समय तक चलने वाले जॉब IPC इवेंट्स के माध्यम से प्रगति वापस स्ट्रीम करते हैं।

## गहन विश्लेषण

पूरा आर्किटेक्चर केंद्रित दस्तावेज़ों में विभाजित है:

| दस्तावेज़ | विषय |
|----------|--------|
| [प्रोसेस, बिल्ड सिस्टम और स्टार्टअप](/hi/docs/architecture-processes) | प्रोसेस मॉडल (main/preload/renderer/shared), बिल्ड सिस्टम, बाइनरी रेज़ोल्यूशन, स्टार्टअप अनुक्रम, CLI मोड, साझा कोड लेयर |
| [Transcoder एब्स्ट्रैक्शन और रूपांतरण](/hi/docs/architecture-transcoders) | `ITranscoder` इंटरफ़ेस, FfmpegCore / FFToolCore / BmfCore, साझा flag बिल्डिंग, हार्डवेयर एक्सेलेरेशन, मीडिया प्रोबिंग, रूपांतरण फ़्लो |
| [Renderer, state और सबसिस्टम](/hi/docs/architecture-renderer) | रेंडर ट्री, पेज, hooks, Zustand store, बैच क्यू, वीडियो प्लेयर, टाइमलाइन मीडिया, इमेज प्रोसेसिंग, एरर हैंडलिंग, लॉगिंग, i18n, थीमिंग, डेटा फ़्लो संदर्भ |

## अतिरिक्त दस्तावेज़

| दस्तावेज़ | विषय |
|----------|--------|
| [फ़ीचर संदर्भ](/hi/docs/features-reference) | फ़ीचर्स, समर्थित मीडिया फ़ॉर्मेट, कोडेक तालिकाएँ, वैलिडेशन यूटिलिटीज़ |
| [CLI उपयोग](/hi/docs/cli) | CLI उपयोग, सबकमांड्स, सभी विकल्प तालिकाएँ |
| [IPC चैनल](/hi/docs/ipc) | IPC चैनल (request/send-only/events), electronAPI ब्रिज |
| [टेस्टिंग](/hi/docs/testing) | टेस्ट सूट (123 फ़ाइलें, 1603 टेस्ट), टेस्ट सेटअप, E2E specs |
| [प्रोजेक्ट संरचना](/hi/docs/project-structure) | एनोटेशन के साथ पूर्ण निर्देशिका ट्री |
| [अपडेट मैनेजर](/hi/docs/update-manager) | इन-ऐप अपडेट मैनेजर का कार्यान्वयन |

## रिपॉज़िटरी

पूर्ण सत्य का स्रोत रिपॉज़िटरी के [`docs/` फ़ोल्डर](https://github.com/Sandeepv68/EncodeX/tree/main/docs) में है। प्रोजेक्ट ओवरव्यू, इंस्टॉलेशन चरण और योगदान गाइड के लिए, [GitHub पर README](https://github.com/Sandeepv68/EncodeX) देखें।
