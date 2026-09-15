import { defineConfig } from 'vitepress'
import { MermaidMarkdown } from 'vitepress-plugin-mermaid'
import type { Plugin } from 'vite'

const SITE_URL = 'https://encodex.in'

const localeLangMap: Record<string, string> = {
  '': 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  pt: 'pt-BR',
  zh: 'zh-CN',
  hi: 'hi',
}

function detectLocaleFromPath(relativePath: string): string {
  for (const [prefix, lang] of Object.entries(localeLangMap)) {
    if (prefix && relativePath.startsWith(prefix + '/')) return lang
  }
  return 'en'
}

function detectLocalePrefix(relativePath: string): string {
  for (const prefix of Object.keys(localeLangMap)) {
    if (prefix && relativePath.startsWith(prefix + '/')) return prefix
  }
  return ''
}

function mermaidVirtualConfig(inlineOptions: Record<string, unknown> = {}): Plugin {
  const moduleId = 'virtual:mermaid-config'
  const resolved = '\0' + moduleId
  return {
    name: 'encodex-mermaid-virtual-config',
    resolveId(id) {
      if (id === moduleId) return resolved
    },
    load(id) {
      if (id === resolved) {
        return `export default ${JSON.stringify({
          securityLevel: 'loose',
          startOnLoad: false,
          externalDiagrams: [],
          ...inlineOptions,
        })}`
      }
    },
  }
}

const docPaths = [
  'architecture',
  'architecture-processes',
  'architecture-transcoders',
  'architecture-renderer',
  'features-reference',
  'cli',
  'ipc',
  'testing',
  'project-structure',
  'update-manager',
]

const docsStrings = {
  en: {
    navLabel: 'Docs',
    archSection: 'Architecture',
    refSection: 'Reference',
    titles: [
      'Architecture Overview',
      'Processes & Startup',
      'Transcoders',
      'Renderer & State',
      'Feature Reference',
      'CLI Usage',
      'IPC Channels',
      'Testing',
      'Project Structure',
      'Update Manager',
    ],
  },
  es: {
    navLabel: 'Documentación',
    archSection: 'Arquitectura',
    refSection: 'Referencia',
    titles: [
      'Resumen de la arquitectura',
      'Procesos e inicio',
      'Transcoders',
      'Renderer y estado',
      'Referencia de características',
      'Uso de la CLI',
      'Canales IPC',
      'Pruebas',
      'Estructura del proyecto',
      'Gestor de actualizaciones',
    ],
  },
  fr: {
    navLabel: 'Documentation',
    archSection: 'Architecture',
    refSection: 'Référence',
    titles: [
      "Vue d'ensemble de l'architecture",
      'Processus et démarrage',
      'Transcodeurs',
      'Renderer et état',
      'Référence des fonctionnalités',
      'Utilisation de la CLI',
      'Canaux IPC',
      'Tests',
      'Structure du projet',
      'Gestionnaire de mises à jour',
    ],
  },
  de: {
    navLabel: 'Dokumentation',
    archSection: 'Architektur',
    refSection: 'Referenz',
    titles: [
      'Architekturübersicht',
      'Prozesse & Start',
      'Transcoder',
      'Renderer & State',
      'Funktionsreferenz',
      'CLI-Verwendung',
      'IPC-Kanäle',
      'Tests',
      'Projektstruktur',
      'Update-Manager',
    ],
  },
  pt: {
    navLabel: 'Documentação',
    archSection: 'Arquitetura',
    refSection: 'Referência',
    titles: [
      'Visão geral da arquitetura',
      'Processos e inicialização',
      'Transcoders',
      'Renderer e estado',
      'Referência de recursos',
      'Uso da CLI',
      'Canais IPC',
      'Testes',
      'Estrutura do projeto',
      'Gerenciador de atualizações',
    ],
  },
  zh: {
    navLabel: '技术文档',
    archSection: '架构',
    refSection: '参考',
    titles: [
      '架构总览',
      '进程与启动',
      '转码器',
      '渲染进程与状态',
      '功能参考',
      'CLI 用法',
      'IPC 通道',
      '测试',
      '项目结构',
      '更新管理器',
    ],
  },
  hi: {
    navLabel: 'दस्तावेज़',
    archSection: 'आर्किटेक्चर',
    refSection: 'संदर्भ',
    titles: [
      'आर्किटेक्चर overview',
      'प्रोसेस और स्टार्टअप',
      'ट्रांसकोडर',
      'Renderer और state',
      'फ़ीचर संदर्भ',
      'CLI उपयोग',
      'IPC चैनल',
      'टेस्टिंग',
      'प्रोजेक्ट संरचना',
      'अपडेट मैनेजर',
    ],
  },
}

const localePrefixes: Record<string, string> = {
  en: '',
  es: '/es',
  fr: '/fr',
  de: '/de',
  pt: '/pt',
  zh: '/zh',
  hi: '/hi',
}

function docsNav(locale: string) {
  const strings = docsStrings[locale]
  return docPaths.map((path, i) => ({
    text: strings.titles[i],
    link: `${localePrefixes[locale]}/docs/${path}`,
  }))
}

function docsSidebar(locale: string) {
  const strings = docsStrings[locale]
  const items = docsNav(locale)
  return [
    { text: strings.archSection, items: items.slice(0, 4) },
    { text: strings.refSection, items: items.slice(4) },
  ]
}

const toolsStrings: Record<string, { label: string; ffmpeg: string; converter: string; compressor: string; audio: string; extractAudio: string; convertLabel: string; mkv: string; mov: string; avi: string; flv: string; wmv: string; m4v: string; webm: string; mp4ToMkv: string; mp4ToWebm: string; codecsLabel: string; h264: string; h265: string; av1: string; vp9: string; prores: string; learn: string; learnLink: string }> = {
  en: {
    label: 'Tools',
    ffmpeg: 'FFmpeg GUI',
    converter: 'Video Converter',
    compressor: 'Video Compressor',
    audio: 'Audio Converter',
    extractAudio: 'Extract Audio from Video',
    convertLabel: 'Convert',
    mkv: 'MKV to MP4',
    mov: 'MOV to MP4',
    avi: 'AVI to MP4',
    flv: 'FLV to MP4',
    wmv: 'WMV to MP4',
    m4v: 'M4V to MP4',
    webm: 'WebM to MP4',
    mp4ToMkv: 'MP4 to MKV',
    mp4ToWebm: 'MP4 to WebM',
    codecsLabel: 'Codecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    learn: 'Learn',
    learnLink: '/learn/what-is-ffmpeg',
  },
  es: {
    label: 'Herramientas',
    ffmpeg: 'GUI de FFmpeg',
    converter: 'Convertidor de vídeo',
    compressor: 'Compresor de vídeo',
    audio: 'Convertidor de audio',
    extractAudio: 'Extraer audio de vídeo',
    convertLabel: 'Convertir',
    mkv: 'MKV a MP4',
    mov: 'MOV a MP4',
    avi: 'AVI a MP4',
    flv: 'FLV a MP4',
    wmv: 'WMV a MP4',
    m4v: 'M4V a MP4',
    webm: 'WebM a MP4',
    mp4ToMkv: 'MP4 a MKV',
    mp4ToWebm: 'MP4 a WebM',
    codecsLabel: 'Códecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    learn: 'Aprender',
    learnLink: '/es/learn/what-is-ffmpeg',
  },
  fr: {
    label: 'Outils',
    ffmpeg: 'Interface FFmpeg',
    converter: 'Convertisseur vidéo',
    compressor: 'Compresseur vidéo',
    audio: 'Convertisseur audio',
    extractAudio: 'Extraire l\u2019audio d\u2019une vidéo',
    convertLabel: 'Convertir',
    mkv: 'MKV vers MP4',
    mov: 'MOV vers MP4',
    avi: 'AVI vers MP4',
    flv: 'FLV vers MP4',
    wmv: 'WMV vers MP4',
    m4v: 'M4V vers MP4',
    webm: 'WebM vers MP4',
    mp4ToMkv: 'MP4 vers MKV',
    mp4ToWebm: 'MP4 vers WebM',
    codecsLabel: 'Codecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    learn: 'Apprendre',
    learnLink: '/fr/learn/what-is-ffmpeg',
  },
  de: {
    label: 'Werkzeuge',
    ffmpeg: 'FFmpeg-GUI',
    converter: 'Videokonverter',
    compressor: 'Videokompressor',
    audio: 'Audiokonverter',
    extractAudio: 'Audio aus Video extrahieren',
    convertLabel: 'Konvertieren',
    mkv: 'MKV zu MP4',
    mov: 'MOV zu MP4',
    avi: 'AVI zu MP4',
    flv: 'FLV zu MP4',
    wmv: 'WMV zu MP4',
    m4v: 'M4V zu MP4',
    webm: 'WebM zu MP4',
    mp4ToMkv: 'MP4 zu MKV',
    mp4ToWebm: 'MP4 zu WebM',
    codecsLabel: 'Codecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    learn: 'Lernen',
    learnLink: '/de/learn/what-is-ffmpeg',
  },
  pt: {
    label: 'Ferramentas',
    ffmpeg: 'Interface FFmpeg',
    converter: 'Conversor de vídeo',
    compressor: 'Compressor de vídeo',
    audio: 'Conversor de áudio',
    extractAudio: 'Extrair áudio de vídeo',
    convertLabel: 'Converter',
    mkv: 'MKV para MP4',
    mov: 'MOV para MP4',
    avi: 'AVI para MP4',
    flv: 'FLV para MP4',
    wmv: 'WMV para MP4',
    m4v: 'M4V para MP4',
    webm: 'WebM para MP4',
    mp4ToMkv: 'MP4 para MKV',
    mp4ToWebm: 'MP4 para WebM',
    codecsLabel: 'Codecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    learn: 'Aprenda',
    learnLink: '/pt/learn/what-is-ffmpeg',
  },
  zh: {
    label: '工具',
    ffmpeg: 'FFmpeg GUI',
    converter: '视频转换器',
    compressor: '视频压缩器',
    audio: '音频转换器',
    extractAudio: '从视频中提取音频',
    convertLabel: '转换',
    mkv: 'MKV 转 MP4',
    mov: 'MOV 转 MP4',
    avi: 'AVI 转 MP4',
    flv: 'FLV 转 MP4',
    wmv: 'WMV 转 MP4',
    m4v: 'M4V 转 MP4',
    webm: 'WebM 转 MP4',
    mp4ToMkv: 'MP4 转 MKV',
    mp4ToWebm: 'MP4 转 WebM',
    codecsLabel: '编码器',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    learn: '了解',
    learnLink: '/zh/learn/what-is-ffmpeg',
  },
  hi: {
    label: 'टूल्स',
    ffmpeg: 'FFmpeg GUI',
    converter: 'वीडियो कन्वर्टर',
    compressor: 'वीडियो कंप्रेसर',
    audio: 'ऑडियो कन्वर्टर',
    extractAudio: 'वीडियो से ऑडियो निकालें',
    convertLabel: 'कन्वर्ट करें',
    mkv: 'MKV से MP4',
    mov: 'MOV से MP4',
    avi: 'AVI से MP4',
    flv: 'FLV से MP4',
    wmv: 'WMV से MP4',
    m4v: 'M4V से MP4',
    webm: 'WebM से MP4',
    mp4ToMkv: 'MP4 से MKV',
    mp4ToWebm: 'MP4 से WebM',
    codecsLabel: 'कोडेक',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    learn: 'सीखें',
    learnLink: '/hi/learn/what-is-ffmpeg',
  },
}

function toolsNav(locale: string) {
  const s = toolsStrings[locale]
  const p = localePrefixes[locale]
  return {
    text: s.label,
    items: [
      { text: s.ffmpeg, link: `${p}/ffmpeg-gui` },
      { text: s.converter, link: `${p}/video-converter` },
      { text: s.compressor, link: `${p}/video-compressor` },
      { text: s.audio, link: `${p}/audio-converter` },
      { text: s.extractAudio, link: `${p}/extract-audio-from-video` },
      {
        text: s.convertLabel,
        items: [
          { text: s.mkv, link: `${p}/convert/mkv-to-mp4` },
          { text: s.mov, link: `${p}/convert/mov-to-mp4` },
          { text: s.avi, link: `${p}/convert/avi-to-mp4` },
          { text: s.flv, link: `${p}/convert/flv-to-mp4` },
          { text: s.wmv, link: `${p}/convert/wmv-to-mp4` },
          { text: s.m4v, link: `${p}/convert/m4v-to-mp4` },
          { text: s.webm, link: `${p}/convert/webm-to-mp4` },
          { text: s.mp4ToMkv, link: `${p}/convert/mp4-to-mkv` },
          { text: s.mp4ToWebm, link: `${p}/convert/mp4-to-webm` },
        ],
      },
      {
        text: s.codecsLabel,
        items: [
          { text: s.h264, link: `${p}/codecs/h264` },
          { text: s.h265, link: `${p}/codecs/h265` },
          { text: s.av1, link: `${p}/codecs/av1` },
          { text: s.vp9, link: `${p}/codecs/vp9` },
          { text: s.prores, link: `${p}/codecs/prores` },
        ],
      },
      { text: s.learn, link: `${s.learnLink}` },
    ],
  }
}

const seoFAQ: Record<string, { q: string; a: string }[]> = {
  'video-converter': [
    {
      q: 'What file formats can EncodeX convert?',
      a: 'EncodeX converts between dozens of formats - MP4, MKV, MOV, AVI, WebM, FLV, WMV, M4V and more for video, plus MP3, FLAC, WAV, M4A, AAC and OGG for audio - right on your computer.',
    },
    {
      q: 'Is EncodeX really free?',
      a: 'Yes. EncodeX is free forever, open source, with no watermarks, no trial limits and no hidden paywalls.',
    },
    {
      q: 'Does converting upload my videos to a server?',
      a: 'No. Everything runs offline on your own computer, so your files never leave your device.',
    },
  ],
  'video-compressor': [
    {
      q: 'How much smaller will compressed videos be?',
      a: 'It depends on the source and settings, but EncodeX can often cut a file to a fraction of its size while keeping visually similar quality by choosing smart codecs and bitrates.',
    },
    {
      q: 'Will compressing reduce my video quality?',
      a: 'EncodeX balances size and quality automatically. You can choose how aggressive to be, and hardware acceleration keeps previews and output fast.',
    },
    {
      q: 'Does EncodeX compress videos offline?',
      a: 'Yes. Compression happens entirely on your computer with no uploads, so it is private and works even without internet.',
    },
  ],
  'audio-converter': [
    {
      q: 'What audio formats can I convert?',
      a: 'MP3, FLAC, WAV, M4A, AAC, OGG, Opus and more - so you can switch between formats one-click, from WAV to MP3 or FLAC to MP3.',
    },
    {
      q: 'Can EncodeX extract audio from video?',
      a: 'Yes. Drop in a video and pull out the sound as an MP3 or another format - see our guide on extracting audio from video.',
    },
    {
      q: 'Can I convert a whole folder of audio files?',
      a: 'Yes. EncodeX is a batch audio converter, so you can drag in many files and it works through them automatically.',
    },
  ],
  'extract-audio-from-video': [
    {
      q: 'What video formats can I extract audio from?',
      a: 'EncodeX extracts sound from MP4, MKV, MOV, AVI, WebM, FLV, WMV, M4V and more.',
    },
    {
      q: 'What audio formats can I extract to?',
      a: 'You can save extracted audio as MP3, M4A/AAC, FLAC or WAV.',
    },
    {
      q: 'Is extracting audio from video free?',
      a: 'Yes. Extraction is free, offline and watermark-free, and you can also batch extract a whole folder of videos at once.',
    },
  ],
  'convert/mkv-to-mp4': [
    {
      q: 'Why should I convert MKV to MP4?',
      a: 'MKV is a flexible format but not every device or player supports it. MP4 plays on almost everything - phones, TVs, consoles, editing software and browsers.',
    },
    {
      q: 'Will I lose quality converting MKV to MP4?',
      a: 'No. EncodeX keeps your video and audio quality intact while converting the container.',
    },
    {
      q: 'Can I convert many MKV files at once?',
      a: 'Yes. EncodeX supports batch converting an entire folder of MKV files to MP4.',
    },
  ],
  'convert/mp4-to-mkv': [
    {
      q: 'Does converting MP4 to MKV lose quality?',
      a: 'No. By default EncodeX remuxes the existing video and audio streams, so the quality stays exactly the same and the conversion is very fast.',
    },
    {
      q: 'Why would I want MKV instead of MP4?',
      a: 'MKV supports soft subtitles, unlimited audio tracks, chapters and attachment files, which makes it a favorite for archiving and media servers.',
    },
    {
      q: 'Can I convert many MP4 files at once?',
      a: 'Yes. EncodeX supports batch converting an entire folder of MP4 files to MKV.',
    },
  ],
  'convert/mp4-to-webm': [
    {
      q: 'Should I convert MP4 to WebM?',
      a: "If you are publishing to the web, WebM usually wins on file size and quality-per-bit over MP4. For maximum compatibility with older players, keep MP4.",
    },
    {
      q: 'Will I lose quality converting MP4 to WebM?',
      a: "WebM's VP9 and AV1 codecs encode more efficiently, so you typically end up with a smaller file at similar visible quality.",
    },
    {
      q: 'Can I convert many MP4 files at once?',
      a: 'Yes. EncodeX supports batch converting an entire folder of MP4 files to WebM.',
    },
  ],
  'compress/mp4': [
    {
      q: 'How small can compressed MP4 files get?',
      a: 'It depends on the source and settings, but EncodeX often shrinks files to a fraction of their size while keeping visually similar quality.',
    },
    {
      q: 'Will compressing reduce my video quality?',
      a: 'EncodeX balances size and quality automatically. You choose how aggressive to be, and you can preview the result before saving.',
    },
    {
      q: 'Does EncodeX compress files offline?',
      a: 'Yes. Compression happens entirely on your computer with no uploads, so it is private and works even without internet.',
    },
  ],
  'compress/mkv': [
    {
      q: 'Does compressing MKV lose quality?',
      a: 'EncodeX balances size and quality automatically. You choose how aggressive to be and can preview the result before saving.',
    },
    {
      q: 'Will my subtitles survive compression?',
      a: 'Yes. EncodeX keeps the MKV container structure, so subtitles and audio tracks are carried over.',
    },
    {
      q: 'Can I compress many MKV files at once?',
      a: 'Yes. EncodeX supports batch compressing an entire folder of MKV files.',
    },
  ],
  'extract/mp3-from-video': [
    {
      q: 'Does extracting MP3 from a video keep the quality?',
      a: "Yes. EncodeX reads the original audio track and encodes it to MP3 with the settings you choose. Use 320 kbps for near-lossless sound.",
    },
    {
      q: 'Can I extract MP3 from MKV files?',
      a: 'Yes - any video container works, including MKV, MP4, MOV, AVI and WebM.',
    },
    {
      q: 'Can I batch-extract MP3 from many videos?',
      a: 'Yes. EncodeX can extract audio from an entire folder of videos in one go.',
    },
  ],
  'extract/wav-from-video': [
    {
      q: 'Is WAV sound better than MP3?',
      a: 'WAV is uncompressed, so it is the true original audio - MP3 discards some data to save space. For editing and archiving, WAV is the safe choice.',
    },
    {
      q: 'Does extracting WAV make huge files?',
      a: "Roughly 10 MB per minute of stereo 16-bit/48 kHz audio. That's the price of lossless quality.",
    },
    {
      q: 'Can I batch-extract WAV from many videos?',
      a: 'Yes. EncodeX can extract audio from an entire folder of videos in one go.',
    },
  ],
  'platforms/windows': [
    {
      q: 'Does EncodeX work on Windows 11?',
      a: 'Yes, EncodeX fully supports Windows 11 and Windows 10 (64-bit and ARM64).',
    },
    {
      q: 'Is EncodeX for Windows really free?',
      a: 'Yes - 100% free, open source (MIT), no ads, no watermarks and no paid tiers.',
    },
    {
      q: 'Does EncodeX upload my videos?',
      a: 'No. All conversion happens locally on your PC.',
    },
  ],
  'platforms/mac': [
    {
      q: 'Does EncodeX work on Apple Silicon Macs?',
      a: 'Yes, there is a dedicated Apple Silicon build that runs natively and uses the VideoToolbox hardware encoder.',
    },
    {
      q: 'Can I convert video to ProRes on a Mac with EncodeX?',
      a: 'Yes - EncodeX includes ready-made ProRes 422 and 4444 profiles, perfect for Final Cut and DaVinci Resolve workflows.',
    },
    {
      q: 'Does EncodeX upload my videos?',
      a: 'No. All conversion happens locally on your Mac.',
    },
  ],
  'platforms/linux': [
    {
      q: 'Does EncodeX support Wayland?',
      a: 'Yes, the app runs on both X11 and Wayland sessions.',
    },
    {
      q: 'Can I use EncodeX on a headless Linux server?',
      a: 'Yes - EncodeX includes a CLI mode for scripting conversions without a desktop.',
    },
    {
      q: 'Is EncodeX for Linux really free?',
      a: 'Yes - 100% free, open source (MIT), no ads and no accounts.',
    },
  ],
  cli: [
    {
      q: 'Do I need the GUI to use the CLI?',
      a: "No, the CLI works standalone. It's bundled with every install of EncodeX.",
    },
    {
      q: 'Can I use the EncodeX CLI on a server?',
      a: "Yes - it's headless, so it works great in scripts, CI, and server environments.",
    },
    {
      q: 'Is the EncodeX CLI really free?',
      a: 'Yes - EncodeX is free forever and open source (MIT).',
    },
  ],
  'handbrake-alternative': [
    {
      q: 'Is EncodeX really a HandBrake alternative?',
      a: 'Yes - EncodeX is a free, open-source FFmpeg GUI for Windows, Mac, and Linux with a friendlier UI, more formats, hardware acceleration, batch queue and CLI mode.',
    },
    {
      q: 'Should I switch from HandBrake to EncodeX?',
      a: 'HandBrake is excellent for disk ripping. EncodeX is a better fit if you want a simpler UI, richer batch features, more formats, or one app that also compresses images and extracts audio.',
    },
    {
      q: 'Does EncodeX work offline?',
      a: 'Yes - all conversion happens locally on your computer, so your files never leave your device.',
    },
  ],
}

export default defineConfig({
  title: 'EncodeX',
  description:
    'EncodeX is a free, open-source FFmpeg GUI for Windows, macOS, and Linux. Convert video and audio, compress files, trim clips, and extract music — entirely on your computer, with no command line.',
  base: '/',
  cleanUrls: true,
  srcExclude: ['**/README.md'],
  rewrites: (path) => (path.startsWith('locales/') ? path.slice('locales/'.length) : path),
  markdown: {
    config: (md) => {
      MermaidMarkdown(md)
    },
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 700,
    },
    plugins: [mermaidVirtualConfig()],
    optimizeDeps: {
      include: [
        'mermaid',
        'fastdom',
        'fastdom/extensions/fastdom-promised',
        '@braintree/sanitize-url',
        'dayjs',
        'debug',
        'cytoscape-cose-bilkent',
        'cytoscape',
      ],
    },
    resolve: {
      alias: {
        'dayjs/plugin/advancedFormat.js': 'dayjs/esm/plugin/advancedFormat',
        'dayjs/plugin/customParseFormat.js': 'dayjs/esm/plugin/customParseFormat',
        'cytoscape/dist/cytoscape.umd.js': 'cytoscape/dist/cytoscape.esm.js',
      },
    },
  },
  sitemap: { hostname: 'https://encodex.in' },
  head: [
    ['link', { rel: 'icon', href: '/images/favicon-64.webp' }],
    ['link', { rel: 'preload', as: 'image', href: '/images/icon_380.webp', fetchpriority: 'high' }],
    ['meta', { name: 'theme-color', content: '#0359AD' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['link', { rel: 'dns-prefetch', href: 'https://www.googletagmanager.com' }],
    ['link', { rel: 'alternate', type: 'application/rss+xml', title: 'EncodeX Blog', href: 'https://encodex.in/feed.xml' }],
    ['script', { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=G-SM28DL4DYR' }],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-SM28DL4DYR');`,
    ],
  ],
  transformHead: (context) => {
    const head: [string, Record<string, string | boolean>][] = []
    const pagePath = context.pageData?.relativePath || ''
    const frontmatter = context.pageData?.frontmatter || {}

    if (context.pageData?.isNotFound) {
      head.push(['meta', { name: 'robots', content: 'noindex' }])
      return head
    }

    const pageLang = detectLocaleFromPath(pagePath)
    const localePrefix = detectLocalePrefix(pagePath)
    const cleanPath = localePrefix ? pagePath.slice(localePrefix.length) : pagePath

    let pageSlug = cleanPath.replace(/^\/+/, '').replace(/\.md$/, '')
    const isHome = pageSlug === 'index'
    const isDirIndex = !isHome && pageSlug.endsWith('/index')
    if (isHome) pageSlug = ''
    if (isDirIndex) pageSlug = pageSlug.slice(0, -'/index'.length)

    const localeBase = localePrefix ? `${localePrefix}/` : ''
    const canonicalUrl = pageSlug
      ? `${SITE_URL}/${localeBase}${pageSlug}${isDirIndex ? '/' : ''}`
      : `${SITE_URL}/${localeBase}`

    if (localePrefix && pageSlug.startsWith('docs/')) {
      head.push(['meta', { name: 'robots', content: 'noindex' }])
    }

    head.push(['link', { rel: 'canonical', href: canonicalUrl }])

    const siteTitle = context.siteConfig?.title || 'EncodeX'
    const siteDescription = context.siteData?.description || context.siteConfig?.description || ''
    const pageTitle = frontmatter.title
      ? `${frontmatter.title} | ${siteTitle}`
      : `${siteTitle} — Free, Open-Source FFmpeg GUI for Windows, macOS & Linux`
    const pageDescription = frontmatter.description || siteDescription
    const pageOgImage = frontmatter.ogImage || `${SITE_URL}/images/banner.webp`

    head.push(['meta', { property: 'og:title', content: pageTitle }])
    head.push(['meta', { property: 'og:description', content: pageDescription }])
    head.push(['meta', { property: 'og:url', content: canonicalUrl }])
    head.push(['meta', { property: 'og:image', content: pageOgImage }])
    head.push(['meta', { property: 'og:locale', content: pageLang.replace('-', '_') }])

    head.push(['meta', { name: 'twitter:card', content: 'summary_large_image' }])
    head.push(['meta', { name: 'twitter:title', content: pageTitle }])
    head.push(['meta', { name: 'twitter:description', content: pageDescription }])
    head.push(['meta', { name: 'twitter:image', content: pageOgImage }])

    const localeEntries = Object.entries(localeLangMap)
    for (const [prefix, hreflang] of localeEntries) {
      const base = prefix ? `${prefix}/` : ''
      const href = pageSlug
        ? `${SITE_URL}/${base}${pageSlug}${isDirIndex ? '/' : ''}`
        : `${SITE_URL}/${base}`
      head.push(['link', { rel: 'alternate', hreflang, href }])
    }
    head.push([
      'link',
      { rel: 'alternate', hreflang: 'x-default', href: pageSlug ? `${SITE_URL}/${pageSlug}${isDirIndex ? '/' : ''}` : `${SITE_URL}/` },
    ])

    if ((pageSlug === '' || pageSlug === 'index') && !localePrefix) {
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'EncodeX',
        description: siteDescription,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Windows 10+, macOS 11+, Linux',
        url: SITE_URL,
        downloadUrl: `${SITE_URL}/download`,
        screenshot: `${SITE_URL}/images/home_dashboard.webp`,
        icon: `${SITE_URL}/images/icon.webp`,
        license: 'https://opensource.org/licenses/MIT',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        author: {
          '@type': 'Person',
          name: 'Sandeepv68',
          url: 'https://github.com/Sandeepv68',
        },
        softwareVersion: '1.0.0-beta.2',
        fileFormat: ['MP4', 'MKV', 'AVI', 'MOV', 'WebM', 'MP3', 'FLAC', 'WAV', 'PNG', 'JPG', 'WebP'],
      }
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify(jsonLd),
      ])
    }

    if (pageSlug.startsWith('blog/releases/') && frontmatter.date) {
      const articleJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: frontmatter.title || pageTitle,
        description: pageDescription,
        datePublished: frontmatter.date,
        author: {
          '@type': 'Person',
          name: 'Sandeepv68',
          url: 'https://github.com/Sandeepv68',
        },
        publisher: {
          '@type': 'Organization',
          name: 'EncodeX',
          url: SITE_URL,
          logo: {
            '@type': 'ImageObject',
            url: `${SITE_URL}/images/icon.webp`,
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalUrl,
        },
        image: frontmatter.ogImage || `${SITE_URL}/images/banner.webp`,
      }
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify(articleJsonLd),
      ])
    }

    const seoLandingPages: Record<string, string> = {
      'ffmpeg-gui': 'FFmpeg GUI',
      'video-converter': 'Video Converter',
      'video-compressor': 'Video Compressor',
      'audio-converter': 'Audio Converter',
      'extract-audio-from-video': 'Extract Audio from Video',
      'ffmpeg-gui/windows': 'FFmpeg GUI for Windows',
      'ffmpeg-gui/macos': 'FFmpeg GUI for Mac',
      'ffmpeg-gui/linux': 'FFmpeg GUI for Linux',
      'convert/mkv-to-mp4': 'MKV to MP4 Converter',
      'convert/mov-to-mp4': 'MOV to MP4 Converter',
      'convert/avi-to-mp4': 'AVI to MP4 Converter',
      'convert/flv-to-mp4': 'FLV to MP4 Converter',
      'convert/wmv-to-mp4': 'WMV to MP4 Converter',
      'convert/m4v-to-mp4': 'M4V to MP4 Converter',
      'convert/webm-to-mp4': 'WebM to MP4 Converter',
      'convert/mp4-to-mkv': 'MP4 to MKV Converter',
      'convert/mp4-to-webm': 'MP4 to WebM Converter',
      'codecs/h264': 'H.264 Encoder & Converter',
      'codecs/h265': 'H.265 / HEVC Encoder & Converter',
      'codecs/av1': 'AV1 Encoder & Converter',
      'codecs/vp9': 'VP9 Encoder & Converter',
      'codecs/prores': 'ProRes Converter',
      'compress/mp4': 'Compress MP4 Videos',
      'compress/mkv': 'Compress MKV Videos',
      'extract/mp3-from-video': 'Extract MP3 from Video',
      'extract/wav-from-video': 'Extract WAV from Video',
      'platforms/windows': 'EncodeX for Windows',
      'platforms/mac': 'EncodeX for Mac',
      'platforms/linux': 'EncodeX for Linux',
      cli: 'EncodeX CLI',
      'handbrake-alternative': 'HandBrake Alternative',
      privacy: 'Privacy Policy',
      'use-cases': 'Use Cases',
      'learn/what-is-ffmpeg': 'What is FFmpeg',
    }

    if (seoLandingPages[pageSlug] && !localePrefix) {
      const crumbs = [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: seoLandingPages[pageSlug], item: canonicalUrl },
      ]
      const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs,
      }
      head.push([
        'script',
        {
          type: 'application/ld+json',
        },
        JSON.stringify(breadcrumbJsonLd),
      ])
    }

    if (seoFAQ[pageSlug] && !localePrefix) {
      const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: seoFAQ[pageSlug].map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      }
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify(faqJsonLd),
      ])
    }

    return head
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/' },
          { text: 'Features', link: '/features' },
          { text: 'Use Cases', link: '/use-cases' },
          { text: 'Download', link: '/download' },
          toolsNav('en'),
          { text: 'Docs', items: docsNav('en') },
          { text: 'Blog', link: '/blog/' },
          { text: 'Contributing', link: '/contributing' },
        ],
        sidebar: { '/docs/': docsSidebar('en') },
      },
    },
    es: {
      label: 'Español',
      lang: 'es',
      link: '/es/',
      title: 'EncodeX',
      description:
        'Una app gratuita y fácil de usar para convertir vídeos y audio, recortar clips, extraer música de vídeos y reducir el tamaño de tus fotos.',
      themeConfig: {
        nav: [
          { text: 'Inicio', link: '/es/' },
          { text: 'Características', link: '/es/features' },
          { text: 'Casos de uso', link: '/es/use-cases' },
          { text: 'Descargar', link: '/es/download' },
          toolsNav('es'),
          { text: 'Documentación', items: docsNav('es') },
          { text: 'Blog', link: '/es/blog/' },
          { text: 'Contribuir', link: '/es/contributing' },
        ],
        sidebar: { '/es/docs/': docsSidebar('es') },
      },
    },
    fr: {
      label: 'Français',
      lang: 'fr',
      link: '/fr/',
      title: 'EncodeX',
      description:
        'Une application gratuite et simple pour convertir vidéos et audio, couper des clips, extraire la musique d\u2019une vidéo et alléger vos photos.',
      themeConfig: {
        nav: [
          { text: 'Accueil', link: '/fr/' },
          { text: 'Fonctionnalités', link: '/fr/features' },
          { text: "Cas d'usage", link: '/fr/use-cases' },
          { text: 'Télécharger', link: '/fr/download' },
          toolsNav('fr'),
          { text: 'Documentation', items: docsNav('fr') },
          { text: 'Blog', link: '/fr/blog/' },
          { text: 'Contribuer', link: '/fr/contributing' },
        ],
        sidebar: { '/fr/docs/': docsSidebar('fr') },
      },
    },
    de: {
      label: 'Deutsch',
      lang: 'de',
      link: '/de/',
      title: 'EncodeX',
      description:
        'Eine kostenlose, einfach zu bedienende App zum Konvertieren von Videos und Audio, Trimmen von Clips, Extrahieren von Musik aus Videos und Verkleinern von Fotos.',
      themeConfig: {
        nav: [
          { text: 'Start', link: '/de/' },
          { text: 'Funktionen', link: '/de/features' },
          { text: 'Anwendungsfälle', link: '/de/use-cases' },
          { text: 'Download', link: '/de/download' },
          toolsNav('de'),
          { text: 'Dokumentation', items: docsNav('de') },
          { text: 'Blog', link: '/de/blog/' },
          { text: 'Mitwirken', link: '/de/contributing' },
        ],
        sidebar: { '/de/docs/': docsSidebar('de') },
      },
    },
    pt: {
      label: 'Português (BR)',
      lang: 'pt-BR',
      link: '/pt/',
      title: 'EncodeX',
      description:
        'Um aplicativo gratuito e fácil de usar para converter vídeos e áudio, cortar clipes, extrair música de vídeos e reduzir o tamanho das fotos.',
      themeConfig: {
        nav: [
          { text: 'Início', link: '/pt/' },
          { text: 'Recursos', link: '/pt/features' },
          { text: 'Casos de uso', link: '/pt/use-cases' },
          { text: 'Download', link: '/pt/download' },
          toolsNav('pt'),
          { text: 'Documentação', items: docsNav('pt') },
          { text: 'Blog', link: '/pt/blog/' },
          { text: 'Contribuir', link: '/pt/contributing' },
        ],
        sidebar: { '/pt/docs/': docsSidebar('pt') },
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      title: 'EncodeX',
      description:
        '一款免费易用的应用：转换视频和音频、剪辑片段、从视频中提取音乐、压缩照片。支持 Windows、Mac 和 Linux。',
      themeConfig: {
        nav: [
          { text: '首页', link: '/zh/' },
          { text: '功能特性', link: '/zh/features' },
          { text: '使用场景', link: '/zh/use-cases' },
          { text: '下载', link: '/zh/download' },
          toolsNav('zh'),
          { text: '技术文档', items: docsNav('zh') },
          { text: '博客', link: '/zh/blog/' },
          { text: '参与贡献', link: '/zh/contributing' },
        ],
        sidebar: { '/zh/docs/': docsSidebar('zh') },
      },
    },
    hi: {
      label: 'हिन्दी',
      lang: 'hi',
      link: '/hi/',
      title: 'EncodeX',
      description:
        'वीडियो और ऑडियो बदलने, क्लिप ट्रिम करने, वीडियो से म्यूज़िक निकालने और फ़ोटो छोटी करने के लिए एक मुफ़्त, आसान ऐप। Windows, Mac और Linux पर उपलब्ध।',
      themeConfig: {
        nav: [
          { text: 'होम', link: '/hi/' },
          { text: 'फ़ीचर्स', link: '/hi/features' },
          { text: 'उपयोग के मामले', link: '/hi/use-cases' },
          { text: 'डाउनलोड', link: '/hi/download' },
          toolsNav('hi'),
          { text: 'दस्तावेज़', items: docsNav('hi') },
          { text: 'ब्लॉग', link: '/hi/blog/' },
          { text: 'योगदान दें', link: '/hi/contributing' },
        ],
        sidebar: { '/hi/docs/': docsSidebar('hi') },
      },
    },
  },
  themeConfig: {
    logo: undefined,
    siteTitle: 'EncodeX',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Sandeepv68/EncodeX' },
    ],
    search: {
      provider: 'local',
    },
  },
})
