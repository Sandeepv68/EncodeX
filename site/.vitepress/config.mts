import { defineConfig } from 'vitepress';
import { MermaidMarkdown } from 'vitepress-plugin-mermaid';
import type { Plugin } from 'vite';
import packageJson from '../../package.json';

const SITE_URL = 'https://encodex.in';

const SITE_VERSION: string = (packageJson as { version?: string }).version || '1.0.0-beta.2';

const localeLangMap: Record<string, string> = {
  '': 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  pt: 'pt-BR',
  zh: 'zh-CN',
  hi: 'hi',
};

function detectLocaleFromPath(relativePath: string): string {
  for (const [prefix, lang] of Object.entries(localeLangMap)) {
    if (prefix && relativePath.startsWith(prefix + '/')) return lang;
  }
  return 'en';
}

function detectLocalePrefix(relativePath: string): string {
  for (const prefix of Object.keys(localeLangMap)) {
    if (prefix && relativePath.startsWith(prefix + '/')) return prefix;
  }
  return '';
}

function mermaidVirtualConfig(inlineOptions: Record<string, unknown> = {}): Plugin {
  const moduleId = 'virtual:mermaid-config';
  const resolved = '\0' + moduleId;
  return {
    name: 'encodex-mermaid-virtual-config',
    resolveId(id) {
      if (id === moduleId) return resolved;
    },
    load(id) {
      if (id === resolved) {
        return `export default ${JSON.stringify({
          securityLevel: 'loose',
          startOnLoad: false,
          externalDiagrams: [],
          ...inlineOptions,
        })}`;
      }
    },
  };
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
];

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
    titles: ['架构总览', '进程与启动', '转码器', '渲染进程与状态', '功能参考', 'CLI 用法', 'IPC 通道', '测试', '项目结构', '更新管理器'],
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
};

const localePrefixes: Record<string, string> = {
  en: '',
  es: '/es',
  fr: '/fr',
  de: '/de',
  pt: '/pt',
  zh: '/zh',
  hi: '/hi',
};

function docsNav(locale: string) {
  const strings = docsStrings[locale];
  return docPaths.map((path, i) => ({
    text: strings.titles[i],
    link: `${localePrefixes[locale]}/docs/${path}`,
  }));
}

function docsSidebar(locale: string) {
  const strings = docsStrings[locale];
  const items = docsNav(locale);
  return [
    { text: strings.archSection, items: items.slice(0, 4) },
    { text: strings.refSection, items: items.slice(4) },
  ];
}

const toolsStrings: Record<
  string,
  {
    label: string;
    ffmpeg: string;
    converter: string;
    compressor: string;
    audio: string;
    extractAudio: string;
    convertLabel: string;
    mkv: string;
    mov: string;
    avi: string;
    flv: string;
    wmv: string;
    m4v: string;
    webm: string;
    mp4ToMkv: string;
    mp4ToWebm: string;
    mkvToWebm: string;
    movToMkv: string;
    webmToMkv: string;
    aviToMkv: string;
    flvToMkv: string;
    wmvToMkv: string;
    mp4ToMp3: string;
    mkvToMp3: string;
    movToMp3: string;
    codecsLabel: string;
    h264: string;
    h265: string;
    av1: string;
    vp9: string;
    prores: string;
    compressLabel: string;
    compressMp4: string;
    compressMkv: string;
    extractLabel: string;
    mp3FromVideo: string;
    wavFromVideo: string;
    platformsLabel: string;
    platformsWindows: string;
    platformsMac: string;
    platformsLinux: string;
    learn: string;
    whatIsFfmpeg: string;
    handbrakeAlt: string;
    learnLink: string;
  }
> = {
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
    mkvToWebm: 'MKV to WebM',
    movToMkv: 'MOV to MKV',
    webmToMkv: 'WebM to MKV',
    aviToMkv: 'AVI to MKV',
    flvToMkv: 'FLV to MKV',
    wmvToMkv: 'WMV to MKV',
    mp4ToMp3: 'MP4 to MP3',
    mkvToMp3: 'MKV to MP3',
    movToMp3: 'MOV to MP3',
    codecsLabel: 'Codecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    compressLabel: 'Compress',
    compressMp4: 'Compress MP4',
    compressMkv: 'Compress MKV',
    extractLabel: 'Extract audio',
    mp3FromVideo: 'MP3 from Video',
    wavFromVideo: 'WAV from Video',
    platformsLabel: 'Platforms',
    platformsWindows: 'Windows',
    platformsMac: 'macOS',
    platformsLinux: 'Linux',
    learn: 'Learn',
    whatIsFfmpeg: 'What is FFmpeg',
    handbrakeAlt: 'HandBrake Alternative',
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
    mkvToWebm: 'MKV a WebM',
    movToMkv: 'MOV a MKV',
    webmToMkv: 'WebM a MKV',
    aviToMkv: 'AVI a MKV',
    flvToMkv: 'FLV a MKV',
    wmvToMkv: 'WMV a MKV',
    mp4ToMp3: 'MP4 a MP3',
    mkvToMp3: 'MKV a MP3',
    movToMp3: 'MOV a MP3',
    codecsLabel: 'Códecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    compressLabel: 'Comprimir',
    compressMp4: 'Comprimir MP4',
    compressMkv: 'Comprimir MKV',
    extractLabel: 'Extraer audio',
    mp3FromVideo: 'MP3 de vídeo',
    wavFromVideo: 'WAV de vídeo',
    platformsLabel: 'Plataformas',
    platformsWindows: 'Windows',
    platformsMac: 'macOS',
    platformsLinux: 'Linux',
    learn: 'Aprender',
    whatIsFfmpeg: '¿Qué es FFmpeg?',
    handbrakeAlt: 'Alternativa a HandBrake',
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
    mkvToWebm: 'MKV vers WebM',
    movToMkv: 'MOV vers MKV',
    webmToMkv: 'WebM vers MKV',
    aviToMkv: 'AVI vers MKV',
    flvToMkv: 'FLV vers MKV',
    wmvToMkv: 'WMV vers MKV',
    mp4ToMp3: 'MP4 vers MP3',
    mkvToMp3: 'MKV vers MP3',
    movToMp3: 'MOV vers MP3',
    codecsLabel: 'Codecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    compressLabel: 'Compresser',
    compressMp4: 'Compresser MP4',
    compressMkv: 'Compresser MKV',
    extractLabel: 'Extraire l\u2019audio',
    mp3FromVideo: 'MP3 depuis une vidéo',
    wavFromVideo: 'WAV depuis une vidéo',
    platformsLabel: 'Plateformes',
    platformsWindows: 'Windows',
    platformsMac: 'macOS',
    platformsLinux: 'Linux',
    learn: 'Apprendre',
    whatIsFfmpeg: 'Quest-ce que FFmpeg',
    handbrakeAlt: 'Alternative à HandBrake',
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
    mkvToWebm: 'MKV zu WebM',
    movToMkv: 'MOV zu MKV',
    webmToMkv: 'WebM zu MKV',
    aviToMkv: 'AVI zu MKV',
    flvToMkv: 'FLV zu MKV',
    wmvToMkv: 'WMV zu MKV',
    mp4ToMp3: 'MP4 zu MP3',
    mkvToMp3: 'MKV zu MP3',
    movToMp3: 'MOV zu MP3',
    codecsLabel: 'Codecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    compressLabel: 'Komprimieren',
    compressMp4: 'MP4 komprimieren',
    compressMkv: 'MKV komprimieren',
    extractLabel: 'Audio extrahieren',
    mp3FromVideo: 'MP3 aus Video',
    wavFromVideo: 'WAV aus Video',
    platformsLabel: 'Plattformen',
    platformsWindows: 'Windows',
    platformsMac: 'macOS',
    platformsLinux: 'Linux',
    learn: 'Lernen',
    whatIsFfmpeg: 'Was ist FFmpeg',
    handbrakeAlt: 'HandBrake-Alternative',
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
    mkvToWebm: 'MKV para WebM',
    movToMkv: 'MOV para MKV',
    webmToMkv: 'WebM para MKV',
    aviToMkv: 'AVI para MKV',
    flvToMkv: 'FLV para MKV',
    wmvToMkv: 'WMV para MKV',
    mp4ToMp3: 'MP4 para MP3',
    mkvToMp3: 'MKV para MP3',
    movToMp3: 'MOV para MP3',
    codecsLabel: 'Codecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    compressLabel: 'Comprimir',
    compressMp4: 'Comprimir MP4',
    compressMkv: 'Comprimir MKV',
    extractLabel: 'Extrair áudio',
    mp3FromVideo: 'MP3 de vídeo',
    wavFromVideo: 'WAV de vídeo',
    platformsLabel: 'Plataformas',
    platformsWindows: 'Windows',
    platformsMac: 'macOS',
    platformsLinux: 'Linux',
    learn: 'Aprenda',
    whatIsFfmpeg: 'O que é FFmpeg',
    handbrakeAlt: 'Alternativa ao HandBrake',
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
    mkvToWebm: 'MKV 转 WebM',
    movToMkv: 'MOV 转 MKV',
    webmToMkv: 'WebM 转 MKV',
    aviToMkv: 'AVI 转 MKV',
    flvToMkv: 'FLV 转 MKV',
    wmvToMkv: 'WMV 转 MKV',
    mp4ToMp3: 'MP4 转 MP3',
    mkvToMp3: 'MKV 转 MP3',
    movToMp3: 'MOV 转 MP3',
    codecsLabel: '编码器',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    compressLabel: '压缩',
    compressMp4: '压缩 MP4',
    compressMkv: '压缩 MKV',
    extractLabel: '提取音频',
    mp3FromVideo: '从视频提取 MP3',
    wavFromVideo: '从视频提取 WAV',
    platformsLabel: '平台',
    platformsWindows: 'Windows',
    platformsMac: 'macOS',
    platformsLinux: 'Linux',
    learn: '了解',
    whatIsFfmpeg: '什么是 FFmpeg',
    handbrakeAlt: 'HandBrake 替代方案',
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
    mkvToWebm: 'MKV से WebM',
    movToMkv: 'MOV से MKV',
    webmToMkv: 'WebM से MKV',
    aviToMkv: 'AVI से MKV',
    flvToMkv: 'FLV से MKV',
    wmvToMkv: 'WMV से MKV',
    mp4ToMp3: 'MP4 से MP3',
    mkvToMp3: 'MKV से MP3',
    movToMp3: 'MOV से MP3',
    codecsLabel: 'कोडेक',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    prores: 'ProRes',
    compressLabel: 'कंप्रेस करें',
    compressMp4: 'MP4 कंप्रेस करें',
    compressMkv: 'MKV कंप्रेस करें',
    extractLabel: 'ऑडियो निकालें',
    mp3FromVideo: 'वीडियो से MP3',
    wavFromVideo: 'वीडियो से WAV',
    platformsLabel: 'प्लेटफ़ॉर्म',
    platformsWindows: 'Windows',
    platformsMac: 'macOS',
    platformsLinux: 'Linux',
    learn: 'सीखें',
    whatIsFfmpeg: 'FFmpeg क्या है',
    handbrakeAlt: 'HandBrake का विकल्प',
    learnLink: '/hi/learn/what-is-ffmpeg',
  },
};

function toolsNav(locale: string) {
  const s = toolsStrings[locale];
  const p = localePrefixes[locale];
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
          { text: s.mkvToWebm, link: `${p}/convert/mkv-to-webm` },
          { text: s.movToMkv, link: `${p}/convert/mov-to-mkv` },
          { text: s.webmToMkv, link: `${p}/convert/webm-to-mkv` },
          { text: s.aviToMkv, link: `${p}/convert/avi-to-mkv` },
          { text: s.flvToMkv, link: `${p}/convert/flv-to-mkv` },
          { text: s.wmvToMkv, link: `${p}/convert/wmv-to-mkv` },
          { text: s.mp4ToMp3, link: `${p}/convert/mp4-to-mp3` },
          { text: s.mkvToMp3, link: `${p}/convert/mkv-to-mp3` },
          { text: s.movToMp3, link: `${p}/convert/mov-to-mp3` },
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
      {
        text: s.compressLabel,
        items: [
          { text: s.compressMp4, link: `${p}/compress/mp4` },
          { text: s.compressMkv, link: `${p}/compress/mkv` },
        ],
      },
      {
        text: s.extractLabel,
        items: [
          { text: s.mp3FromVideo, link: `${p}/extract/mp3-from-video` },
          { text: s.wavFromVideo, link: `${p}/extract/wav-from-video` },
        ],
      },
      {
        text: s.platformsLabel,
        items: [
          { text: s.platformsWindows, link: `${p}/platforms/windows` },
          { text: s.platformsMac, link: `${p}/platforms/mac` },
          { text: s.platformsLinux, link: `${p}/platforms/linux` },
        ],
      },
      {
        text: s.learn,
        items: [
          { text: s.whatIsFfmpeg, link: `${s.learnLink}` },
          { text: s.handbrakeAlt, link: `${p}/handbrake-alternative` },
        ],
      },
    ],
  };
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
      a: 'If you are publishing to the web, WebM usually wins on file size and quality-per-bit over MP4. For maximum compatibility with older players, keep MP4.',
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
  'convert/mkv-to-webm': [
    {
      q: 'Should I convert MKV to WebM?',
      a: 'If you are publishing to the web, WebM usually wins on file size and quality-per-bit over MKV. MKV is a great archive format, but browsers and streaming sites favor WebM.',
    },
    {
      q: 'Will I lose quality converting MKV to WebM?',
      a: "WebM's VP9 and AV1 codecs encode more efficiently, so you typically end up with a smaller file at similar visible quality.",
    },
    { q: 'Can I convert many MKV files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of MKV files to WebM.' },
  ],
  'convert/mov-to-mkv': [
    {
      q: 'Does converting MOV to MKV lose quality?',
      a: 'No. By default EncodeX remuxes the existing video and audio streams, so the quality stays exactly the same and the conversion is very fast.',
    },
    {
      q: 'Why would I want MKV instead of MOV?',
      a: "MKV is a fully open format with soft subtitles, unlimited audio tracks, chapters and attachment files - a better fit for archiving and media servers than Apple's closed MOV container.",
    },
    { q: 'Can I convert many MOV files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of MOV files to MKV.' },
  ],
  'convert/webm-to-mkv': [
    {
      q: 'Why should I convert WebM to MKV?',
      a: 'WebM is built for the web, but MKV is a more flexible container that supports soft subtitles, unlimited audio tracks, chapters and attachment files, making it great for archiving and media servers.',
    },
    {
      q: 'Will I lose quality converting WebM to MKV?',
      a: 'No. EncodeX keeps your video and audio quality intact while converting the container.',
    },
    { q: 'Can I convert many WebM files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of WebM files to MKV.' },
  ],
  'convert/avi-to-mkv': [
    {
      q: 'Why should I convert AVI to MKV?',
      a: "AVI is an old format that produces large and often incompatible files. MKV is a modern, open container with subtitles, multiple audio tracks and chapters, and it plays beautifully on today's players and media servers.",
    },
    {
      q: 'Will I lose quality converting AVI to MKV?',
      a: 'No. EncodeX keeps your video and audio quality intact while converting the container.',
    },
    { q: 'Can I convert many AVI files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of AVI files to MKV.' },
  ],
  'convert/flv-to-mkv': [
    {
      q: 'Why should I convert FLV to MKV?',
      a: 'FLV is a Flash-era format used mostly for old web videos. MKV is a modern, open container that keeps audio, subtitles and chapters together and plays on today\u2019s players and media servers.',
    },
    {
      q: 'Will I lose quality converting FLV to MKV?',
      a: 'No. EncodeX keeps your video and audio quality intact while converting the container.',
    },
    { q: 'Can I convert many FLV files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of FLV files to MKV.' },
  ],
  'convert/wmv-to-mkv': [
    {
      q: 'Why should I convert WMV to MKV?',
      a: 'WMV is a Microsoft format that is mostly tied to Windows. MKV is an open, widely supported container with subtitles, unlimited audio tracks and chapters, ideal for archiving and media servers.',
    },
    {
      q: 'Will I lose quality converting WMV to MKV?',
      a: 'No. EncodeX keeps your video and audio quality intact while converting the container.',
    },
    { q: 'Can I convert many WMV files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of WMV files to MKV.' },
  ],
  'convert/mp4-to-mp3': [
    {
      q: 'Why should I convert MP4 to MP3?',
      a: 'MP4 is a video format, but sometimes you only need the audio. MP3 plays on every phone, car stereo, smart speaker and editing tool, and the audio-only file is much smaller.',
    },
    {
      q: 'Will I lose audio quality converting MP4 to MP3?',
      a: 'MP3 is a lossy format, but EncodeX reads the original audio track and encodes it with the settings you choose. Use 320 kbps for near-lossless sound.',
    },
    { q: 'Can I convert many MP4 files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of MP4 files to MP3.' },
  ],
  'convert/mkv-to-mp3': [
    {
      q: 'Why should I convert MKV to MP3?',
      a: 'MKV is a video container, but its audio tracks are often exactly what you want. Converting MKV to MP3 extracts the sound into a small file that plays on every device.',
    },
    {
      q: 'Will I lose audio quality converting MKV to MP3?',
      a: 'MP3 is a lossy format, but EncodeX reads the original audio track and encodes it with the settings you choose. Use 320 kbps for near-lossless sound.',
    },
    { q: 'Can I convert many MKV files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of MKV files to MP3.' },
  ],
  'convert/mov-to-mp3': [
    {
      q: 'Why should I convert MOV to MP3?',
      a: "MOV is Apple's video format, but sometimes you just want the soundtrack. Converting MOV to MP3 gives you the audio in a file that works on every phone, car stereo and player.",
    },
    {
      q: 'Will I lose audio quality converting MOV to MP3?',
      a: 'MP3 is a lossy format, but EncodeX reads the original audio track and encodes it with the settings you choose. Use 320 kbps for near-lossless sound.',
    },
    { q: 'Can I convert many MOV files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of MOV files to MP3.' },
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
      a: 'Yes. EncodeX reads the original audio track and encodes it to MP3 with the settings you choose. Use 320 kbps for near-lossless sound.',
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
};

const seoHowTo: Record<string, { name: string; steps: { name: string; text: string }[] }> = {
  'convert/mkv-to-mp4': {
    name: 'How to Convert MKV to MP4',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add MKV files', text: 'Drag and drop your MKV files into EncodeX.' },
      { name: 'Select MP4 format', text: 'Choose MP4 as the output format.' },
      { name: 'Convert', text: 'Click Convert and wait for the process to complete.' },
    ],
  },
  'convert/mov-to-mp4': {
    name: 'How to Convert MOV to MP4',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add MOV files', text: 'Drag and drop your MOV files into EncodeX.' },
      { name: 'Select MP4 format', text: 'Choose MP4 as the output format.' },
      { name: 'Convert', text: 'Click Convert and wait for the process to complete.' },
    ],
  },
  'convert/avi-to-mp4': {
    name: 'How to Convert AVI to MP4',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add AVI files', text: 'Drag and drop your AVI files into EncodeX.' },
      { name: 'Select MP4 format', text: 'Choose MP4 as the output format.' },
      { name: 'Convert', text: 'Click Convert and wait for the process to complete.' },
    ],
  },
  'extract-audio-from-video': {
    name: 'How to Extract Audio from Video',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add video files', text: 'Drag and drop your video files into EncodeX.' },
      { name: 'Select audio format', text: 'Choose MP3, FLAC, WAV, or M4A as the output format.' },
      { name: 'Extract', text: 'Click Extract and wait for the process to complete.' },
    ],
  },
  'video-compressor': {
    name: 'How to Compress Video Files',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add video files', text: 'Drag and drop your video files into EncodeX.' },
      { name: 'Select compression settings', text: 'Choose quality and compression level.' },
      { name: 'Compress', text: 'Click Compress and wait for the process to complete.' },
    ],
  },
  'convert/mkv-to-webm': {
    name: 'How to Convert MKV to WebM',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add MKV files', text: 'Drag and drop your MKV files into EncodeX.' },
      { name: 'Select WebM format', text: 'Choose WebM as the output format.' },
      { name: 'Convert', text: 'Click Convert and wait for the process to complete.' },
    ],
  },
  'convert/mov-to-mkv': {
    name: 'How to Convert MOV to MKV',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add MOV files', text: 'Drag and drop your MOV files into EncodeX.' },
      { name: 'Select MKV format', text: 'Choose MKV as the output format.' },
      { name: 'Convert', text: 'Click Convert and wait for the process to complete.' },
    ],
  },
  'convert/webm-to-mkv': {
    name: 'How to Convert WebM to MKV',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add WebM files', text: 'Drag and drop your WebM files into EncodeX.' },
      { name: 'Select MKV format', text: 'Choose MKV as the output format.' },
      { name: 'Convert', text: 'Click Convert and wait for the process to complete.' },
    ],
  },
  'convert/avi-to-mkv': {
    name: 'How to Convert AVI to MKV',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add AVI files', text: 'Drag and drop your AVI files into EncodeX.' },
      { name: 'Select MKV format', text: 'Choose MKV as the output format.' },
      { name: 'Convert', text: 'Click Convert and wait for the process to complete.' },
    ],
  },
  'convert/flv-to-mkv': {
    name: 'How to Convert FLV to MKV',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add FLV files', text: 'Drag and drop your FLV files into EncodeX.' },
      { name: 'Select MKV format', text: 'Choose MKV as the output format.' },
      { name: 'Convert', text: 'Click Convert and wait for the process to complete.' },
    ],
  },
  'convert/wmv-to-mkv': {
    name: 'How to Convert WMV to MKV',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add WMV files', text: 'Drag and drop your WMV files into EncodeX.' },
      { name: 'Select MKV format', text: 'Choose MKV as the output format.' },
      { name: 'Convert', text: 'Click Convert and wait for the process to complete.' },
    ],
  },
  'convert/mp4-to-mp3': {
    name: 'How to Convert MP4 to MP3',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add MP4 files', text: 'Drag and drop your MP4 files into EncodeX.' },
      { name: 'Select MP3 format', text: 'Choose MP3 as the output format.' },
      { name: 'Convert', text: 'Click Convert and wait for the process to complete.' },
    ],
  },
  'convert/mkv-to-mp3': {
    name: 'How to Convert MKV to MP3',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add MKV files', text: 'Drag and drop your MKV files into EncodeX.' },
      { name: 'Select MP3 format', text: 'Choose MP3 as the output format.' },
      { name: 'Convert', text: 'Click Convert and wait for the process to complete.' },
    ],
  },
  'convert/mov-to-mp3': {
    name: 'How to Convert MOV to MP3',
    steps: [
      { name: 'Download EncodeX', text: 'Download and install EncodeX for your platform.' },
      { name: 'Add MOV files', text: 'Drag and drop your MOV files into EncodeX.' },
      { name: 'Select MP3 format', text: 'Choose MP3 as the output format.' },
      { name: 'Convert', text: 'Click Convert and wait for the process to complete.' },
    ],
  },
};

const seoHowToTranslations: Record<string, Record<string, { name: string; steps: { name: string; text: string }[] }>> = {
  es: {
    'convert/mkv-to-mp4': {
      name: 'Cómo Convertir MKV a MP4',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos MKV', text: 'Arrastra y suelta tus archivos MKV en EncodeX.' },
        { name: 'Seleccionar formato MP4', text: 'Elige MP4 como formato de salida.' },
        { name: 'Convertir', text: 'Haz clic en Convertir y espera a que se complete el proceso.' },
      ],
    },
    'convert/mov-to-mp4': {
      name: 'Cómo Convertir MOV a MP4',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos MOV', text: 'Arrastra y suelta tus archivos MOV en EncodeX.' },
        { name: 'Seleccionar formato MP4', text: 'Elige MP4 como formato de salida.' },
        { name: 'Convertir', text: 'Haz clic en Convertir y espera a que se complete el proceso.' },
      ],
    },
    'convert/avi-to-mp4': {
      name: 'Cómo Convertir AVI a MP4',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos AVI', text: 'Arrastra y suelta tus archivos AVI en EncodeX.' },
        { name: 'Seleccionar formato MP4', text: 'Elige MP4 como formato de salida.' },
        { name: 'Convertir', text: 'Haz clic en Convertir y espera a que se complete el proceso.' },
      ],
    },
    'extract-audio-from-video': {
      name: 'Cómo Extraer Audio de un Video',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos de video', text: 'Arrastra y suelta tus archivos de video en EncodeX.' },
        { name: 'Seleccionar formato de audio', text: 'Elige MP3, FLAC, WAV o M4A como formato de salida.' },
        { name: 'Extraer', text: 'Haz clic en Extraer y espera a que se complete el proceso.' },
      ],
    },
    'video-compressor': {
      name: 'Cómo Comprimir Archivos de Video',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos de video', text: 'Arrastra y suelta tus archivos de video en EncodeX.' },
        { name: 'Seleccionar ajustes de compresión', text: 'Elige calidad y nivel de compresión.' },
        { name: 'Comprimir', text: 'Haz clic en Comprimir y espera a que se complete el proceso.' },
      ],
    },
    'convert/mkv-to-webm': {
      name: 'Cómo Convertir MKV a WebM',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos MKV', text: 'Arrastra y suelta tus archivos MKV en EncodeX.' },
        { name: 'Seleccionar formato WebM', text: 'Elige WebM como formato de salida.' },
        { name: 'Convertir', text: 'Haz clic en Convertir y espera a que se complete el proceso.' },
      ],
    },
    'convert/mov-to-mkv': {
      name: 'Cómo Convertir MOV a MKV',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos MOV', text: 'Arrastra y suelta tus archivos MOV en EncodeX.' },
        { name: 'Seleccionar formato MKV', text: 'Elige MKV como formato de salida.' },
        { name: 'Convertir', text: 'Haz clic en Convertir y espera a que se complete el proceso.' },
      ],
    },
    'convert/webm-to-mkv': {
      name: 'Cómo Convertir WebM a MKV',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos WebM', text: 'Arrastra y suelta tus archivos WebM en EncodeX.' },
        { name: 'Seleccionar formato MKV', text: 'Elige MKV como formato de salida.' },
        { name: 'Convertir', text: 'Haz clic en Convertir y espera a que se complete el proceso.' },
      ],
    },
    'convert/avi-to-mkv': {
      name: 'Cómo Convertir AVI a MKV',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos AVI', text: 'Arrastra y suelta tus archivos AVI en EncodeX.' },
        { name: 'Seleccionar formato MKV', text: 'Elige MKV como formato de salida.' },
        { name: 'Convertir', text: 'Haz clic en Convertir y espera a que se complete el proceso.' },
      ],
    },
    'convert/flv-to-mkv': {
      name: 'Cómo Convertir FLV a MKV',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos FLV', text: 'Arrastra y suelta tus archivos FLV en EncodeX.' },
        { name: 'Seleccionar formato MKV', text: 'Elige MKV como formato de salida.' },
        { name: 'Convertir', text: 'Haz clic en Convertir y espera a que se complete el proceso.' },
      ],
    },
    'convert/wmv-to-mkv': {
      name: 'Cómo Convertir WMV a MKV',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos WMV', text: 'Arrastra y suelta tus archivos WMV en EncodeX.' },
        { name: 'Seleccionar formato MKV', text: 'Elige MKV como formato de salida.' },
        { name: 'Convertir', text: 'Haz clic en Convertir y espera a que se complete el proceso.' },
      ],
    },
    'convert/mp4-to-mp3': {
      name: 'Cómo Convertir MP4 a MP3',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos MP4', text: 'Arrastra y suelta tus archivos MP4 en EncodeX.' },
        { name: 'Seleccionar formato MP3', text: 'Elige MP3 como formato de salida.' },
        { name: 'Convertir', text: 'Haz clic en Convertir y espera a que se complete el proceso.' },
      ],
    },
    'convert/mkv-to-mp3': {
      name: 'Cómo Convertir MKV a MP3',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos MKV', text: 'Arrastra y suelta tus archivos MKV en EncodeX.' },
        { name: 'Seleccionar formato MP3', text: 'Elige MP3 como formato de salida.' },
        { name: 'Convertir', text: 'Haz clic en Convertir y espera a que se complete el proceso.' },
      ],
    },
    'convert/mov-to-mp3': {
      name: 'Cómo Convertir MOV a MP3',
      steps: [
        { name: 'Descargar EncodeX', text: 'Descarga e instala EncodeX para tu plataforma.' },
        { name: 'Agregar archivos MOV', text: 'Arrastra y suelta tus archivos MOV en EncodeX.' },
        { name: 'Seleccionar formato MP3', text: 'Elige MP3 como formato de salida.' },
        { name: 'Convertir', text: 'Haz clic en Convertir y espera a que se complete el proceso.' },
      ],
    },
  },
  fr: {
    'convert/mkv-to-mp4': {
      name: 'Comment Convertir MKV en MP4',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers MKV', text: 'Glissez-déposez vos fichiers MKV dans EncodeX.' },
        { name: 'Sélectionner le format MP4', text: 'Choisissez MP4 comme format de sortie.' },
        { name: 'Convertir', text: 'Cliquez sur Convertir et attendez la fin du processus.' },
      ],
    },
    'convert/mov-to-mp4': {
      name: 'Comment Convertir MOV en MP4',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers MOV', text: 'Glissez-déposez vos fichiers MOV dans EncodeX.' },
        { name: 'Sélectionner le format MP4', text: 'Choisissez MP4 comme format de sortie.' },
        { name: 'Convertir', text: 'Cliquez sur Convertir et attendez la fin du processus.' },
      ],
    },
    'convert/avi-to-mp4': {
      name: 'Comment Convertir AVI en MP4',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers AVI', text: 'Glissez-déposez vos fichiers AVI dans EncodeX.' },
        { name: 'Sélectionner le format MP4', text: 'Choisissez MP4 comme format de sortie.' },
        { name: 'Convertir', text: 'Cliquez sur Convertir et attendez la fin du processus.' },
      ],
    },
    'extract-audio-from-video': {
      name: 'Comment Extraire l\u2019Audio d\u2019une Vidéo',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers vidéo', text: 'Glissez-déposez vos fichiers vidéo dans EncodeX.' },
        { name: 'Sélectionner le format audio', text: 'Choisissez MP3, FLAC, WAV ou M4A comme format de sortie.' },
        { name: 'Extraire', text: 'Cliquez sur Extraire et attendez la fin du processus.' },
      ],
    },
    'video-compressor': {
      name: 'Comment Compresser des Fichiers Vidéo',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers vidéo', text: 'Glissez-déposez vos fichiers vidéo dans EncodeX.' },
        { name: 'Choisir les paramètres de compression', text: 'Choisissez la qualité et le niveau de compression.' },
        { name: 'Compresser', text: 'Cliquez sur Compresser et attendez la fin du processus.' },
      ],
    },
    'convert/mkv-to-webm': {
      name: 'Comment Convertir MKV en WebM',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers MKV', text: 'Glissez-déposez vos fichiers MKV dans EncodeX.' },
        { name: 'Sélectionner le format WebM', text: 'Choisissez WebM comme format de sortie.' },
        { name: 'Convertir', text: 'Cliquez sur Convertir et attendez la fin du processus.' },
      ],
    },
    'convert/mov-to-mkv': {
      name: 'Comment Convertir MOV en MKV',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers MOV', text: 'Glissez-déposez vos fichiers MOV dans EncodeX.' },
        { name: 'Sélectionner le format MKV', text: 'Choisissez MKV comme format de sortie.' },
        { name: 'Convertir', text: 'Cliquez sur Convertir et attendez la fin du processus.' },
      ],
    },
    'convert/webm-to-mkv': {
      name: 'Comment Convertir WebM en MKV',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers WebM', text: 'Glissez-déposez vos fichiers WebM dans EncodeX.' },
        { name: 'Sélectionner le format MKV', text: 'Choisissez MKV comme format de sortie.' },
        { name: 'Convertir', text: 'Cliquez sur Convertir et attendez la fin du processus.' },
      ],
    },
    'convert/avi-to-mkv': {
      name: 'Comment Convertir AVI en MKV',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers AVI', text: 'Glissez-déposez vos fichiers AVI dans EncodeX.' },
        { name: 'Sélectionner le format MKV', text: 'Choisissez MKV comme format de sortie.' },
        { name: 'Convertir', text: 'Cliquez sur Convertir et attendez la fin du processus.' },
      ],
    },
    'convert/flv-to-mkv': {
      name: 'Comment Convertir FLV en MKV',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers FLV', text: 'Glissez-déposez vos fichiers FLV dans EncodeX.' },
        { name: 'Sélectionner le format MKV', text: 'Choisissez MKV comme format de sortie.' },
        { name: 'Convertir', text: 'Cliquez sur Convertir et attendez la fin du processus.' },
      ],
    },
    'convert/wmv-to-mkv': {
      name: 'Comment Convertir WMV en MKV',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers WMV', text: 'Glissez-déposez vos fichiers WMV dans EncodeX.' },
        { name: 'Sélectionner le format MKV', text: 'Choisissez MKV comme format de sortie.' },
        { name: 'Convertir', text: 'Cliquez sur Convertir et attendez la fin du processus.' },
      ],
    },
    'convert/mp4-to-mp3': {
      name: 'Comment Convertir MP4 en MP3',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers MP4', text: 'Glissez-déposez vos fichiers MP4 dans EncodeX.' },
        { name: 'Sélectionner le format MP3', text: 'Choisissez MP3 comme format de sortie.' },
        { name: 'Convertir', text: 'Cliquez sur Convertir et attendez la fin du processus.' },
      ],
    },
    'convert/mkv-to-mp3': {
      name: 'Comment Convertir MKV en MP3',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers MKV', text: 'Glissez-déposez vos fichiers MKV dans EncodeX.' },
        { name: 'Sélectionner le format MP3', text: 'Choisissez MP3 comme format de sortie.' },
        { name: 'Convertir', text: 'Cliquez sur Convertir et attendez la fin du processus.' },
      ],
    },
    'convert/mov-to-mp3': {
      name: 'Comment Convertir MOV en MP3',
      steps: [
        { name: 'Télécharger EncodeX', text: 'Téléchargez et installez EncodeX pour votre plateforme.' },
        { name: 'Ajouter les fichiers MOV', text: 'Glissez-déposez vos fichiers MOV dans EncodeX.' },
        { name: 'Sélectionner le format MP3', text: 'Choisissez MP3 comme format de sortie.' },
        { name: 'Convertir', text: 'Cliquez sur Convertir et attendez la fin du processus.' },
      ],
    },
  },
  de: {
    'convert/mkv-to-mp4': {
      name: 'MKV in MP4 Konvertieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'MKV-Dateien hinzufügen', text: 'Ziehen Sie Ihre MKV-Dateien per Drag & Drop in EncodeX.' },
        { name: 'MP4-Format auswählen', text: 'Wählen Sie MP4 als Ausgabeformat.' },
        { name: 'Konvertieren', text: 'Klicken Sie auf Konvertieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
    'convert/mov-to-mp4': {
      name: 'MOV in MP4 Konvertieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'MOV-Dateien hinzufügen', text: 'Ziehen Sie Ihre MOV-Dateien per Drag & Drop in EncodeX.' },
        { name: 'MP4-Format auswählen', text: 'Wählen Sie MP4 als Ausgabeformat.' },
        { name: 'Konvertieren', text: 'Klicken Sie auf Konvertieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
    'convert/avi-to-mp4': {
      name: 'AVI in MP4 Konvertieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'AVI-Dateien hinzufügen', text: 'Ziehen Sie Ihre AVI-Dateien per Drag & Drop in EncodeX.' },
        { name: 'MP4-Format auswählen', text: 'Wählen Sie MP4 als Ausgabeformat.' },
        { name: 'Konvertieren', text: 'Klicken Sie auf Konvertieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
    'extract-audio-from-video': {
      name: 'Audio aus Video Extrahieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'Video-Dateien hinzufügen', text: 'Ziehen Sie Ihre Video-Dateien per Drag & Drop in EncodeX.' },
        { name: 'Audioformat auswählen', text: 'Wählen Sie MP3, FLAC, WAV oder M4A als Ausgabeformat.' },
        { name: 'Extrahieren', text: 'Klicken Sie auf Extrahieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
    'video-compressor': {
      name: 'Video-Dateien Komprimieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'Video-Dateien hinzufügen', text: 'Ziehen Sie Ihre Video-Dateien per Drag & Drop in EncodeX.' },
        { name: 'Komprimierungseinstellungen auswählen', text: 'Wählen Sie Qualität und Komprimierungsstufe.' },
        { name: 'Komprimieren', text: 'Klicken Sie auf Komprimieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
    'convert/mkv-to-webm': {
      name: 'MKV in WebM Konvertieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'MKV-Dateien hinzufügen', text: 'Ziehen Sie Ihre MKV-Dateien per Drag & Drop in EncodeX.' },
        { name: 'WebM-Format auswählen', text: 'Wählen Sie WebM als Ausgabeformat.' },
        { name: 'Konvertieren', text: 'Klicken Sie auf Konvertieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
    'convert/mov-to-mkv': {
      name: 'MOV in MKV Konvertieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'MOV-Dateien hinzufügen', text: 'Ziehen Sie Ihre MOV-Dateien per Drag & Drop in EncodeX.' },
        { name: 'MKV-Format auswählen', text: 'Wählen Sie MKV als Ausgabeformat.' },
        { name: 'Konvertieren', text: 'Klicken Sie auf Konvertieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
    'convert/webm-to-mkv': {
      name: 'WebM in MKV Konvertieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'WebM-Dateien hinzufügen', text: 'Ziehen Sie Ihre WebM-Dateien per Drag & Drop in EncodeX.' },
        { name: 'MKV-Format auswählen', text: 'Wählen Sie MKV als Ausgabeformat.' },
        { name: 'Konvertieren', text: 'Klicken Sie auf Konvertieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
    'convert/avi-to-mkv': {
      name: 'AVI in MKV Konvertieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'AVI-Dateien hinzufügen', text: 'Ziehen Sie Ihre AVI-Dateien per Drag & Drop in EncodeX.' },
        { name: 'MKV-Format auswählen', text: 'Wählen Sie MKV als Ausgabeformat.' },
        { name: 'Konvertieren', text: 'Klicken Sie auf Konvertieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
    'convert/flv-to-mkv': {
      name: 'FLV in MKV Konvertieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'FLV-Dateien hinzufügen', text: 'Ziehen Sie Ihre FLV-Dateien per Drag & Drop in EncodeX.' },
        { name: 'MKV-Format auswählen', text: 'Wählen Sie MKV als Ausgabeformat.' },
        { name: 'Konvertieren', text: 'Klicken Sie auf Konvertieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
    'convert/wmv-to-mkv': {
      name: 'WMV in MKV Konvertieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'WMV-Dateien hinzufügen', text: 'Ziehen Sie Ihre WMV-Dateien per Drag & Drop in EncodeX.' },
        { name: 'MKV-Format auswählen', text: 'Wählen Sie MKV als Ausgabeformat.' },
        { name: 'Konvertieren', text: 'Klicken Sie auf Konvertieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
    'convert/mp4-to-mp3': {
      name: 'MP4 in MP3 Konvertieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'MP4-Dateien hinzufügen', text: 'Ziehen Sie Ihre MP4-Dateien per Drag & Drop in EncodeX.' },
        { name: 'MP3-Format auswählen', text: 'Wählen Sie MP3 als Ausgabeformat.' },
        { name: 'Konvertieren', text: 'Klicken Sie auf Konvertieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
    'convert/mkv-to-mp3': {
      name: 'MKV in MP3 Konvertieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'MKV-Dateien hinzufügen', text: 'Ziehen Sie Ihre MKV-Dateien per Drag & Drop in EncodeX.' },
        { name: 'MP3-Format auswählen', text: 'Wählen Sie MP3 als Ausgabeformat.' },
        { name: 'Konvertieren', text: 'Klicken Sie auf Konvertieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
    'convert/mov-to-mp3': {
      name: 'MOV in MP3 Konvertieren',
      steps: [
        { name: 'EncodeX herunterladen', text: 'Laden Sie EncodeX herunter und installieren Sie es für Ihre Plattform.' },
        { name: 'MOV-Dateien hinzufügen', text: 'Ziehen Sie Ihre MOV-Dateien per Drag & Drop in EncodeX.' },
        { name: 'MP3-Format auswählen', text: 'Wählen Sie MP3 als Ausgabeformat.' },
        { name: 'Konvertieren', text: 'Klicken Sie auf Konvertieren und warten Sie, bis der Vorgang abgeschlossen ist.' },
      ],
    },
  },
  pt: {
    'convert/mkv-to-mp4': {
      name: 'Como Converter MKV para MP4',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos MKV', text: 'Arraste e solte seus arquivos MKV no EncodeX.' },
        { name: 'Selecionar o formato MP4', text: 'Escolha MP4 como formato de saída.' },
        { name: 'Converter', text: 'Clique em Converter e aguarde a conclusão do processo.' },
      ],
    },
    'convert/mov-to-mp4': {
      name: 'Como Converter MOV para MP4',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos MOV', text: 'Arraste e solte seus arquivos MOV no EncodeX.' },
        { name: 'Selecionar o formato MP4', text: 'Escolha MP4 como formato de saída.' },
        { name: 'Converter', text: 'Clique em Converter e aguarde a conclusão do processo.' },
      ],
    },
    'convert/avi-to-mp4': {
      name: 'Como Converter AVI para MP4',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos AVI', text: 'Arraste e solte seus arquivos AVI no EncodeX.' },
        { name: 'Selecionar o formato MP4', text: 'Escolha MP4 como formato de saída.' },
        { name: 'Converter', text: 'Clique em Converter e aguarde a conclusão do processo.' },
      ],
    },
    'extract-audio-from-video': {
      name: 'Como Extrair Áudio de Vídeo',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos de vídeo', text: 'Arraste e solte seus arquivos de vídeo no EncodeX.' },
        { name: 'Selecionar o formato de áudio', text: 'Escolha MP3, FLAC, WAV ou M4A como formato de saída.' },
        { name: 'Extrair', text: 'Clique em Extrair e aguarde a conclusão do processo.' },
      ],
    },
    'video-compressor': {
      name: 'Como Comprimir Arquivos de Vídeo',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos de vídeo', text: 'Arraste e solte seus arquivos de vídeo no EncodeX.' },
        { name: 'Selecionar as configurações de compressão', text: 'Escolha a qualidade e o nível de compressão.' },
        { name: 'Comprimir', text: 'Clique em Comprimir e aguarde a conclusão do processo.' },
      ],
    },
    'convert/mkv-to-webm': {
      name: 'Como Converter MKV para WebM',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos MKV', text: 'Arraste e solte seus arquivos MKV no EncodeX.' },
        { name: 'Selecionar o formato WebM', text: 'Escolha WebM como formato de saída.' },
        { name: 'Converter', text: 'Clique em Converter e aguarde a conclusão do processo.' },
      ],
    },
    'convert/mov-to-mkv': {
      name: 'Como Converter MOV para MKV',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos MOV', text: 'Arraste e solte seus arquivos MOV no EncodeX.' },
        { name: 'Selecionar o formato MKV', text: 'Escolha MKV como formato de saída.' },
        { name: 'Converter', text: 'Clique em Converter e aguarde a conclusão do processo.' },
      ],
    },
    'convert/webm-to-mkv': {
      name: 'Como Converter WebM para MKV',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos WebM', text: 'Arraste e solte seus arquivos WebM no EncodeX.' },
        { name: 'Selecionar o formato MKV', text: 'Escolha MKV como formato de saída.' },
        { name: 'Converter', text: 'Clique em Converter e aguarde a conclusão do processo.' },
      ],
    },
    'convert/avi-to-mkv': {
      name: 'Como Converter AVI para MKV',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos AVI', text: 'Arraste e solte seus arquivos AVI no EncodeX.' },
        { name: 'Selecionar o formato MKV', text: 'Escolha MKV como formato de saída.' },
        { name: 'Converter', text: 'Clique em Converter e aguarde a conclusão do processo.' },
      ],
    },
    'convert/flv-to-mkv': {
      name: 'Como Converter FLV para MKV',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos FLV', text: 'Arraste e solte seus arquivos FLV no EncodeX.' },
        { name: 'Selecionar o formato MKV', text: 'Escolha MKV como formato de saída.' },
        { name: 'Converter', text: 'Clique em Converter e aguarde a conclusão do processo.' },
      ],
    },
    'convert/wmv-to-mkv': {
      name: 'Como Converter WMV para MKV',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos WMV', text: 'Arraste e solte seus arquivos WMV no EncodeX.' },
        { name: 'Selecionar o formato MKV', text: 'Escolha MKV como formato de saída.' },
        { name: 'Converter', text: 'Clique em Converter e aguarde a conclusão do processo.' },
      ],
    },
    'convert/mp4-to-mp3': {
      name: 'Como Converter MP4 para MP3',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos MP4', text: 'Arraste e solte seus arquivos MP4 no EncodeX.' },
        { name: 'Selecionar o formato MP3', text: 'Escolha MP3 como formato de saída.' },
        { name: 'Converter', text: 'Clique em Converter e aguarde a conclusão do processo.' },
      ],
    },
    'convert/mkv-to-mp3': {
      name: 'Como Converter MKV para MP3',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos MKV', text: 'Arraste e solte seus arquivos MKV no EncodeX.' },
        { name: 'Selecionar o formato MP3', text: 'Escolha MP3 como formato de saída.' },
        { name: 'Converter', text: 'Clique em Converter e aguarde a conclusão do processo.' },
      ],
    },
    'convert/mov-to-mp3': {
      name: 'Como Converter MOV para MP3',
      steps: [
        { name: 'Baixar EncodeX', text: 'Baixe e instale o EncodeX para sua plataforma.' },
        { name: 'Adicionar arquivos MOV', text: 'Arraste e solte seus arquivos MOV no EncodeX.' },
        { name: 'Selecionar o formato MP3', text: 'Escolha MP3 como formato de saída.' },
        { name: 'Converter', text: 'Clique em Converter e aguarde a conclusão do processo.' },
      ],
    },
  },
  zh: {
    'convert/mkv-to-mp4': {
      name: '如何将 MKV 转换为 MP4',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加 MKV 文件', text: '将您的 MKV 文件拖放到 EncodeX 中。' },
        { name: '选择 MP4 格式', text: '选择 MP4 作为输出格式。' },
        { name: '转换', text: '点击转换并等待过程完成。' },
      ],
    },
    'convert/mov-to-mp4': {
      name: '如何将 MOV 转换为 MP4',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加 MOV 文件', text: '将您的 MOV 文件拖放到 EncodeX 中。' },
        { name: '选择 MP4 格式', text: '选择 MP4 作为输出格式。' },
        { name: '转换', text: '点击转换并等待过程完成。' },
      ],
    },
    'convert/avi-to-mp4': {
      name: '如何将 AVI 转换为 MP4',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加 AVI 文件', text: '将您的 AVI 文件拖放到 EncodeX 中。' },
        { name: '选择 MP4 格式', text: '选择 MP4 作为输出格式。' },
        { name: '转换', text: '点击转换并等待过程完成。' },
      ],
    },
    'extract-audio-from-video': {
      name: '如何从视频中提取音频',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加视频文件', text: '将您的视频文件拖放到 EncodeX 中。' },
        { name: '选择音频格式', text: '选择 MP3、FLAC、WAV 或 M4A 作为输出格式。' },
        { name: '提取', text: '点击提取并等待过程完成。' },
      ],
    },
    'video-compressor': {
      name: '如何压缩视频文件',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加视频文件', text: '将您的视频文件拖放到 EncodeX 中。' },
        { name: '选择压缩设置', text: '选择质量和压缩级别。' },
        { name: '压缩', text: '点击压缩并等待过程完成。' },
      ],
    },
    'convert/mkv-to-webm': {
      name: '如何将 MKV 转换为 WebM',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加 MKV 文件', text: '将您的 MKV 文件拖放到 EncodeX 中。' },
        { name: '选择 WebM 格式', text: '选择 WebM 作为输出格式。' },
        { name: '转换', text: '点击转换并等待过程完成。' },
      ],
    },
    'convert/mov-to-mkv': {
      name: '如何将 MOV 转换为 MKV',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加 MOV 文件', text: '将您的 MOV 文件拖放到 EncodeX 中。' },
        { name: '选择 MKV 格式', text: '选择 MKV 作为输出格式。' },
        { name: '转换', text: '点击转换并等待过程完成。' },
      ],
    },
    'convert/webm-to-mkv': {
      name: '如何将 WebM 转换为 MKV',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加 WebM 文件', text: '将您的 WebM 文件拖放到 EncodeX 中。' },
        { name: '选择 MKV 格式', text: '选择 MKV 作为输出格式。' },
        { name: '转换', text: '点击转换并等待过程完成。' },
      ],
    },
    'convert/avi-to-mkv': {
      name: '如何将 AVI 转换为 MKV',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加 AVI 文件', text: '将您的 AVI 文件拖放到 EncodeX 中。' },
        { name: '选择 MKV 格式', text: '选择 MKV 作为输出格式。' },
        { name: '转换', text: '点击转换并等待过程完成。' },
      ],
    },
    'convert/flv-to-mkv': {
      name: '如何将 FLV 转换为 MKV',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加 FLV 文件', text: '将您的 FLV 文件拖放到 EncodeX 中。' },
        { name: '选择 MKV 格式', text: '选择 MKV 作为输出格式。' },
        { name: '转换', text: '点击转换并等待过程完成。' },
      ],
    },
    'convert/wmv-to-mkv': {
      name: '如何将 WMV 转换为 MKV',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加 WMV 文件', text: '将您的 WMV 文件拖放到 EncodeX 中。' },
        { name: '选择 MKV 格式', text: '选择 MKV 作为输出格式。' },
        { name: '转换', text: '点击转换并等待过程完成。' },
      ],
    },
    'convert/mp4-to-mp3': {
      name: '如何将 MP4 转换为 MP3',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加 MP4 文件', text: '将您的 MP4 文件拖放到 EncodeX 中。' },
        { name: '选择 MP3 格式', text: '选择 MP3 作为输出格式。' },
        { name: '转换', text: '点击转换并等待过程完成。' },
      ],
    },
    'convert/mkv-to-mp3': {
      name: '如何将 MKV 转换为 MP3',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加 MKV 文件', text: '将您的 MKV 文件拖放到 EncodeX 中。' },
        { name: '选择 MP3 格式', text: '选择 MP3 作为输出格式。' },
        { name: '转换', text: '点击转换并等待过程完成。' },
      ],
    },
    'convert/mov-to-mp3': {
      name: '如何将 MOV 转换为 MP3',
      steps: [
        { name: '下载 EncodeX', text: '下载并安装适用于您平台的 EncodeX。' },
        { name: '添加 MOV 文件', text: '将您的 MOV 文件拖放到 EncodeX 中。' },
        { name: '选择 MP3 格式', text: '选择 MP3 作为输出格式。' },
        { name: '转换', text: '点击转换并等待过程完成。' },
      ],
    },
  },
  hi: {
    'convert/mkv-to-mp4': {
      name: 'MKV को MP4 में कैसे बदलें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'MKV फ़ाइलें जोड़ें', text: 'अपनी MKV फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'MP4 प्रारूप चुनें', text: 'आउटपुट प्रारूप के रूप में MP4 चुनें।' },
        { name: 'कनवर्ट करें', text: 'कनवर्ट पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
    'convert/mov-to-mp4': {
      name: 'MOV को MP4 में कैसे बदलें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'MOV फ़ाइलें जोड़ें', text: 'अपनी MOV फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'MP4 प्रारूप चुनें', text: 'आउटपुट प्रारूप के रूप में MP4 चुनें।' },
        { name: 'कनवर्ट करें', text: 'कनवर्ट पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
    'convert/avi-to-mp4': {
      name: 'AVI को MP4 में कैसे बदलें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'AVI फ़ाइलें जोड़ें', text: 'अपनी AVI फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'MP4 प्रारूप चुनें', text: 'आउटपुट प्रारूप के रूप में MP4 चुनें।' },
        { name: 'कनवर्ट करें', text: 'कनवर्ट पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
    'extract-audio-from-video': {
      name: 'वीडियो से ऑडियो कैसे निकालें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'वीडियो फ़ाइलें जोड़ें', text: 'अपनी वीडियो फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'ऑडियो प्रारूप चुनें', text: 'आउटपुट प्रारूप के रूप में MP3, FLAC, WAV या M4A चुनें।' },
        { name: 'निकालें', text: 'निकालें पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
    'video-compressor': {
      name: 'वीडियो फ़ाइलों को कैसे कंप्रेस करें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'वीडियो फ़ाइलें जोड़ें', text: 'अपनी वीडियो फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'कंप्रेशन सेटिंग चुनें', text: 'गुणवत्ता और कंप्रेशन स्तर चुनें।' },
        { name: 'कंप्रेस करें', text: 'कंप्रेस पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
    'convert/mkv-to-webm': {
      name: 'MKV को WebM में कैसे बदलें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'MKV फ़ाइलें जोड़ें', text: 'अपनी MKV फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'WebM प्रारूप चुनें', text: 'आउटपुट प्रारूप के रूप में WebM चुनें।' },
        { name: 'कनवर्ट करें', text: 'कनवर्ट पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
    'convert/mov-to-mkv': {
      name: 'MOV को MKV में कैसे बदलें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'MOV फ़ाइलें जोड़ें', text: 'अपनी MOV फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'MKV प्रारूप चुनें', text: 'आउटपुट प्रारूप के रूप में MKV चुनें।' },
        { name: 'कनवर्ट करें', text: 'कनवर्ट पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
    'convert/webm-to-mkv': {
      name: 'WebM को MKV में कैसे बदलें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'WebM फ़ाइलें जोड़ें', text: 'अपनी WebM फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'MKV प्रारूप चुनें', text: 'आउटपुट प्रारूप के रूप में MKV चुनें।' },
        { name: 'कनवर्ट करें', text: 'कनवर्ट पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
    'convert/avi-to-mkv': {
      name: 'AVI को MKV में कैसे बदलें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'AVI फ़ाइलें जोड़ें', text: 'अपनी AVI फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'MKV प्रारूप चुनें', text: 'आउटपुट प्रारूप के रूप में MKV चुनें।' },
        { name: 'कनवर्ट करें', text: 'कनवर्ट पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
    'convert/flv-to-mkv': {
      name: 'FLV को MKV में कैसे बदलें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'FLV फ़ाइलें जोड़ें', text: 'अपनी FLV फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'MKV प्रारूप चुनें', text: 'आउटपुट प्रारूप के रूप में MKV चुनें।' },
        { name: 'कनवर्ट करें', text: 'कनवर्ट पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
    'convert/wmv-to-mkv': {
      name: 'WMV को MKV में कैसे बदलें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'WMV फ़ाइलें जोड़ें', text: 'अपनी WMV फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'MKV प्रारूप चुनें', text: 'आउटपुट प्रारूप के रूप में MKV चुनें।' },
        { name: 'कनवर्ट करें', text: 'कनवर्ट पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
    'convert/mp4-to-mp3': {
      name: 'MP4 को MP3 में कैसे बदलें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'MP4 फ़ाइलें जोड़ें', text: 'अपनी MP4 फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'MP3 प्रारूप चुनें', text: 'आउटपुट प्रारूप के रूप में MP3 चुनें।' },
        { name: 'कनवर्ट करें', text: 'कनवर्ट पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
    'convert/mkv-to-mp3': {
      name: 'MKV को MP3 में कैसे बदलें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'MKV फ़ाइलें जोड़ें', text: 'अपनी MKV फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'MP3 प्रारूप चुनें', text: 'आउटपुट प्रारूप के रूप में MP3 चुनें।' },
        { name: 'कनवर्ट करें', text: 'कनवर्ट पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
    'convert/mov-to-mp3': {
      name: 'MOV को MP3 में कैसे बदलें',
      steps: [
        { name: 'EncodeX डाउनलोड करें', text: 'अपने प्लेटफ़ॉर्म के लिए EncodeX डाउनलोड और इंस्टॉल करें।' },
        { name: 'MOV फ़ाइलें जोड़ें', text: 'अपनी MOV फ़ाइलों को EncodeX में खींचें और छोड़ें।' },
        { name: 'MP3 प्रारूप चुनें', text: 'आउटपुट प्रारूप के रूप में MP3 चुनें।' },
        { name: 'कनवर्ट करें', text: 'कनवर्ट पर क्लिक करें और प्रक्रिया पूरी होने तक प्रतीक्षा करें।' },
      ],
    },
  },
};

const seoFAQTranslations: Record<string, Record<string, { q: string; a: string }[]>> = {
  es: {
    'handbrake-alternative': [
      {
        q: '¿Es EncodeX realmente una alternativa a HandBrake?',
        a: 'Sí. EncodeX es una GUI gratuita y de código abierto para FFmpeg en Windows, Mac y Linux, con una interfaz más amigable, más formatos, aceleración por hardware, cola por lotes y modo CLI.',
      },
      {
        q: '¿Debería cambiar de HandBrake a EncodeX?',
        a: 'HandBrake es excelente para rippear discos. EncodeX encaja mejor si quieres una interfaz más simple, funciones de lote más ricas, más formatos o una sola app que también comprima imágenes y extraiga audio.',
      },
      {
        q: '¿EncodeX funciona sin conexión?',
        a: 'Sí. Toda la conversión ocurre localmente en tu computadora, así que tus archivos nunca salen de tu dispositivo.',
      },
    ],
    'video-converter': [
      {
        q: '¿Qué formatos de archivo puede convertir EncodeX?',
        a: 'EncodeX convierte entre docenas de formatos: MP4, MKV, MOV, AVI, WebM, FLV, WMV, M4V y más para video, además de MP3, FLAC, WAV, M4A, AAC y OGG para audio, directamente en tu computadora.',
      },
      {
        q: '¿EncodeX es realmente gratuito?',
        a: 'Sí. EncodeX es gratuito para siempre, de código abierto, sin marcas de agua, sin límites de prueba y sin muros de pago ocultos.',
      },
      {
        q: '¿La conversión sube mis videos a un servidor?',
        a: 'No. Todo se ejecuta sin conexión en tu propia computadora, así que tus archivos nunca salen de tu dispositivo.',
      },
    ],
    'video-compressor': [
      {
        q: '¿Cuánto más pequeños serán los videos comprimidos?',
        a: 'Depende de la fuente y la configuración, pero EncodeX puede reducir un archivo a una fracción de su tamaño manteniendo una calidad visual similar al elegir códecs y tasas de bits inteligentes.',
      },
      {
        q: '¿Comprimir reducirá la calidad de mi video?',
        a: 'EncodeX equilibra tamaño y calidad automáticamente. Puedes elegir qué tan agresivo ser y la aceleración por hardware mantiene rápidas las previsualizaciones y la salida.',
      },
      {
        q: '¿EncodeX comprime videos sin conexión?',
        a: 'Sí. La compresión ocurre enteramente en tu computadora, sin subidas, por lo que es privada y funciona incluso sin internet.',
      },
    ],
    'audio-converter': [
      {
        q: '¿Qué formatos de audio puedo convertir?',
        a: 'MP3, FLAC, WAV, M4A, AAC, OGG, Opus y más, para que puedas cambiar entre formatos con un clic, de WAV a MP3 o de FLAC a MP3.',
      },
      {
        q: '¿Puede EncodeX extraer audio de un video?',
        a: 'Sí. Arrastra un video y extrae el sonido como MP3 u otro formato; consulta nuestra guía sobre extraer audio de video.',
      },
      {
        q: '¿Puedo convertir una carpeta entera de archivos de audio?',
        a: 'Sí. EncodeX es un convertidor de audio por lotes: puedes arrastrar muchos archivos y los procesa automáticamente.',
      },
    ],
    'extract-audio-from-video': [
      { q: '¿De qué formatos de video puedo extraer audio?', a: 'EncodeX extrae sonido de MP4, MKV, MOV, AVI, WebM, FLV, WMV, M4V y más.' },
      { q: '¿A qué formatos de audio puedo extraer?', a: 'Puedes guardar el audio extraído como MP3, M4A/AAC, FLAC o WAV.' },
      {
        q: '¿Extraer audio de video es gratuito?',
        a: 'Sí. La extracción es gratuita, sin conexión y sin marcas de agua, y también puedes extraer en lote una carpeta entera de videos a la vez.',
      },
    ],
    'convert/mkv-to-mp4': [
      {
        q: '¿Por qué debería convertir MKV a MP4?',
        a: 'MKV es un formato flexible, pero no todos los dispositivos o reproductores lo admiten. MP4 se reproduce en casi todo: teléfonos, televisores, consolas, software de edición y navegadores.',
      },
      {
        q: '¿Perderé calidad al convertir MKV a MP4?',
        a: 'No. EncodeX mantiene intacta la calidad de tu video y audio al convertir el contenedor.',
      },
      {
        q: '¿Puedo convertir muchos archivos MKV a la vez?',
        a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos MKV a MP4.',
      },
    ],
    'convert/mp4-to-mkv': [
      {
        q: '¿Convertir MP4 a MKV pierde calidad?',
        a: 'No. Por defecto, EncodeX re-empaqueta (remux) los flujos de video y audio existentes, por lo que la calidad permanece exactamente igual y la conversión es muy rápida.',
      },
      {
        q: '¿Por qué querría MKV en lugar de MP4?',
        a: 'MKV admite subtítulos integrados, pistas de audio ilimitadas, capítulos y archivos adjuntos, lo que lo hace ideal para archivar y servidores multimedia.',
      },
      {
        q: '¿Puedo convertir muchos archivos MP4 a la vez?',
        a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos MP4 a MKV.',
      },
    ],
    'convert/mp4-to-webm': [
      {
        q: '¿Debería convertir MP4 a WebM?',
        a: 'Si publicas en la web, WebM suele ganar en tamaño de archivo y calidad por bit frente a MP4. Para máxima compatibilidad con reproductores antiguos, mantén MP4.',
      },
      {
        q: '¿Perderé calidad al convertir MP4 a WebM?',
        a: 'Los códecs VP9 y AV1 de WebM codifican de forma más eficiente, por lo que normalmente obtienes un archivo más pequeño con calidad visual similar.',
      },
      {
        q: '¿Puedo convertir muchos archivos MP4 a la vez?',
        a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos MP4 a WebM.',
      },
    ],
    'convert/mkv-to-webm': [
      {
        q: '¿Debería convertir MKV a WebM?',
        a: 'Si publicas en la web, WebM suele ganar en tamaño de archivo y calidad por bit frente a MKV. MKV es un gran formato de archivo, pero los navegadores y sitios de streaming prefieren WebM.',
      },
      {
        q: '¿Perderé calidad al convertir MKV a WebM?',
        a: 'Los códecs VP9 y AV1 de WebM codifican de forma más eficiente, por lo que normalmente obtienes un archivo más pequeño con calidad visual similar.',
      },
      {
        q: '¿Puedo convertir muchos archivos MKV a la vez?',
        a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos MKV a WebM.',
      },
    ],
    'convert/mov-to-mkv': [
      {
        q: '¿Convertir MOV a MKV pierde calidad?',
        a: 'No. Por defecto, EncodeX re-empaqueta (remux) los flujos de video y audio existentes, por lo que la calidad permanece exactamente igual y la conversión es muy rápida.',
      },
      {
        q: '¿Por qué querría MKV en lugar de MOV?',
        a: 'MKV es un formato totalmente abierto con subtítulos integrados, pistas de audio ilimitadas, capítulos y archivos adjuntos: una mejor opción para archivar y servidores multimedia que el contenedor cerrado de Apple (MOV).',
      },
      {
        q: '¿Puedo convertir muchos archivos MOV a la vez?',
        a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos MOV a MKV.',
      },
    ],
    'convert/webm-to-mkv': [
      {
        q: '¿Por qué debería convertir WebM a MKV?',
        a: 'WebM está pensado para la web, pero MKV es un contenedor más flexible que admite subtítulos integrados, pistas de audio ilimitadas, capítulos y archivos adjuntos, lo que lo hace excelente para archivar y servidores multimedia.',
      },
      {
        q: '¿Perderé calidad al convertir WebM a MKV?',
        a: 'No. EncodeX mantiene intacta la calidad de tu video y audio al convertir el contenedor.',
      },
      {
        q: '¿Puedo convertir muchos archivos WebM a la vez?',
        a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos WebM a MKV.',
      },
    ],
    'convert/avi-to-mkv': [
      {
        q: '¿Por qué debería convertir AVI a MKV?',
        a: 'AVI es un formato antiguo que genera archivos grandes y a menudo incompatibles. MKV es un contenedor moderno y abierto con subtítulos, múltiples pistas de audio y capítulos, y se reproduce perfectamente en los reproductores y servidores multimedia actuales.',
      },
      {
        q: '¿Perderé calidad al convertir AVI a MKV?',
        a: 'No. EncodeX mantiene intacta la calidad de tu video y audio al convertir el contenedor.',
      },
      {
        q: '¿Puedo convertir muchos archivos AVI a la vez?',
        a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos AVI a MKV.',
      },
    ],
    'convert/flv-to-mkv': [
      {
        q: '¿Por qué debería convertir FLV a MKV?',
        a: 'FLV es un formato de la era de Flash usado sobre todo en videos web antiguos. MKV es un contenedor moderno y abierto que mantiene juntos audio, subtítulos y capítulos y se reproduce en los reproductores y servidores multimedia actuales.',
      },
      {
        q: '¿Perderé calidad al convertir FLV a MKV?',
        a: 'No. EncodeX mantiene intacta la calidad de tu video y audio al convertir el contenedor.',
      },
      {
        q: '¿Puedo convertir muchos archivos FLV a la vez?',
        a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos FLV a MKV.',
      },
    ],
    'convert/wmv-to-mkv': [
      {
        q: '¿Por qué debería convertir WMV a MKV?',
        a: 'WMV es un formato de Microsoft ligado sobre todo a Windows. MKV es un contenedor abierto y ampliamente compatible con subtítulos, pistas de audio ilimitadas y capítulos, ideal para archivar y servidores multimedia.',
      },
      {
        q: '¿Perderé calidad al convertir WMV a MKV?',
        a: 'No. EncodeX mantiene intacta la calidad de tu video y audio al convertir el contenedor.',
      },
      {
        q: '¿Puedo convertir muchos archivos WMV a la vez?',
        a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos WMV a MKV.',
      },
    ],
    'convert/mp4-to-mp3': [
      {
        q: '¿Por qué debería convertir MP4 a MP3?',
        a: 'MP4 es un formato de video, pero a veces solo necesitas el audio. MP3 se reproduce en todos los teléfonos, estéreos de auto, altavoces inteligentes y herramientas de edición, y el archivo solo de audio es mucho más pequeño.',
      },
      {
        q: '¿Perderé calidad de audio al convertir MP4 a MP3?',
        a: 'MP3 es un formato con pérdida, pero EncodeX lee la pista de audio original y la codifica con la configuración que elijas. Usa 320 kbps para un sonido casi sin pérdidas.',
      },
      {
        q: '¿Puedo convertir muchos archivos MP4 a la vez?',
        a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos MP4 a MP3.',
      },
    ],
    'convert/mkv-to-mp3': [
      {
        q: '¿Por qué debería convertir MKV a MP3?',
        a: 'MKV es un contenedor de video, pero sus pistas de audio suelen ser justo lo que quieres. Convertir MKV a MP3 extrae el sonido a un archivo pequeño que se reproduce en todos los dispositivos.',
      },
      {
        q: '¿Perderé calidad de audio al convertir MKV a MP3?',
        a: 'MP3 es un formato con pérdida, pero EncodeX lee la pista de audio original y la codifica con la configuración que elijas. Usa 320 kbps para un sonido casi sin pérdidas.',
      },
      {
        q: '¿Puedo convertir muchos archivos MKV a la vez?',
        a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos MKV a MP3.',
      },
    ],
    'convert/mov-to-mp3': [
      {
        q: '¿Por qué debería convertir MOV a MP3?',
        a: 'MOV es el formato de video de Apple, pero a veces solo quieres la banda sonora. Convertir MOV a MP3 te da el audio en un archivo que funciona en todos los teléfonos, estéreos de auto y reproductores.',
      },
      {
        q: '¿Perderé calidad de audio al convertir MOV a MP3?',
        a: 'MP3 es un formato con pérdida, pero EncodeX lee la pista de audio original y la codifica con la configuración que elijas. Usa 320 kbps para un sonido casi sin pérdidas.',
      },
      {
        q: '¿Puedo convertir muchos archivos MOV a la vez?',
        a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos MOV a MP3.',
      },
    ],
  },
  fr: {
    'handbrake-alternative': [
      {
        q: 'EncodeX est-il vraiment une alternative à HandBrake ?',
        a: 'Oui. EncodeX est une interface FFmpeg gratuite et open source pour Windows, Mac et Linux, avec une interface plus conviviale, plus de formats, l\u2019accélération matérielle, une file de traitement par lots et un mode CLI.',
      },
      {
        q: 'Dois-je passer de HandBrake à EncodeX ?',
        a: 'HandBrake est excellent pour le rip de disques. EncodeX convient mieux si vous voulez une interface plus simple, des fonctions de lot plus riches, plus de formats, ou une seule app qui compresse aussi les images et extrait l\u2019audio.',
      },
      {
        q: 'EncodeX fonctionne-t-il hors ligne ?',
        a: 'Oui. Toute la conversion se fait localement sur votre ordinateur, vos fichiers ne quittent donc jamais votre appareil.',
      },
    ],
    'video-converter': [
      {
        q: 'Quels formats de fichiers EncodeX peut-il convertir ?',
        a: 'EncodeX convertit entre des dizaines de formats : MP4, MKV, MOV, AVI, WebM, FLV, WMV, M4V et plus pour la vidéo, ainsi que MP3, FLAC, WAV, M4A, AAC et OGG pour l\u2019audio, directement sur votre ordinateur.',
      },
      {
        q: 'EncodeX est-il vraiment gratuit ?',
        a: 'Oui. EncodeX est gratuit pour toujours, open source, sans filigrane, sans limite d\u2019essai et sans paywall caché.',
      },
      {
        q: 'La conversion envoie-t-elle mes vidéos sur un serveur ?',
        a: 'Non. Tout s\u2019exécute hors ligne sur votre ordinateur, vos fichiers ne quittent donc jamais votre appareil.',
      },
    ],
    'video-compressor': [
      {
        q: 'De combien les vidéos compressées seront-elles plus petites ?',
        a: 'Cela dépend de la source et des réglages, mais EncodeX peut souvent réduire un fichier à une fraction de sa taille tout en gardant une qualité visuelle semblable en choisissant des codecs et des débits intelligents.',
      },
      {
        q: 'La compression va-t-elle réduire la qualité de ma vidéo ?',
        a: 'EncodeX équilibre taille et qualité automatiquement. Vous choisissez à quel point être agressif, et l\u2019accélération matérielle garde les aperçus et la sortie rapides.',
      },
      {
        q: 'EncodeX compresse-t-il les vidéos hors ligne ?',
        a: 'Oui. La compression se fait entièrement sur votre ordinateur, sans envoi, donc c\u2019est privé et cela fonctionne même sans internet.',
      },
    ],
    'audio-converter': [
      {
        q: 'Quels formats audio puis-je convertir ?',
        a: 'MP3, FLAC, WAV, M4A, AAC, OGG, Opus et plus, pour passer d\u2019un format à l\u2019autre en un clic, de WAV à MP3 ou de FLAC à MP3.',
      },
      {
        q: 'EncodeX peut-il extraire l\u2019audio d\u2019une vidéo ?',
        a: 'Oui. Déposez une vidéo et récupérez le son en MP3 ou autre format : voir notre guide pour extraire l\u2019audio d\u2019une vidéo.',
      },
      {
        q: 'Puis-je convertir tout un dossier de fichiers audio ?',
        a: 'Oui. EncodeX est un convertisseur audio par lots : déposez de nombreux fichiers et il les traite automatiquement.',
      },
    ],
    'extract-audio-from-video': [
      {
        q: 'De quels formats vidéo puis-je extraire l\u2019audio ?',
        a: 'EncodeX extrait le son de MP4, MKV, MOV, AVI, WebM, FLV, WMV, M4V et plus.',
      },
      { q: 'Vers quels formats audio puis-je extraire ?', a: 'Vous pouvez enregistrer l\u2019audio extrait en MP3, M4A/AAC, FLAC ou WAV.' },
      {
        q: 'Extraire l\u2019audio d\u2019une vidéo est-il gratuit ?',
        a: 'Oui. L\u2019extraction est gratuite, hors ligne et sans filigrane, et vous pouvez aussi extraire tout un dossier de vidéos en une fois.',
      },
    ],
    'convert/mkv-to-mp4': [
      {
        q: 'Pourquoi convertir MKV en MP4 ?',
        a: 'MKV est un format flexible mais tous les appareils ou lecteurs ne le prennent pas en charge. MP4 se lit presque partout : téléphones, TV, consoles, logiciels de montage et navigateurs.',
      },
      {
        q: 'Vais-je perdre de la qualité en convertissant MKV en MP4 ?',
        a: 'Non. EncodeX préserve la qualité de votre vidéo et de votre audio lors de la conversion du conteneur.',
      },
      {
        q: 'Puis-je convertir plusieurs fichiers MKV à la fois ?',
        a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers MKV en MP4.',
      },
    ],
    'convert/mp4-to-mkv': [
      {
        q: 'Convertir MP4 en MKV fait-il perdre de la qualité ?',
        a: 'Non. Par défaut, EncodeX remux les flux vidéo et audio existants, donc la qualité reste exactement la même et la conversion est très rapide.',
      },
      {
        q: 'Pourquoi voudrais-je MKV plutôt que MP4 ?',
        a: 'MKV prend en charge les sous-titres intégrés, des pistes audio illimitées, les chapitres et les fichiers joints, ce qui en fait un favori pour l\u2019archivage et les serveurs multimédia.',
      },
      {
        q: 'Puis-je convertir plusieurs fichiers MP4 à la fois ?',
        a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers MP4 en MKV.',
      },
    ],
    'convert/mp4-to-webm': [
      {
        q: 'Dois-je convertir MP4 en WebM ?',
        a: 'Si vous publiez sur le web, WebM gagne généralement en taille et en qualité par bit par rapport à MP4. Pour une compatibilité maximale avec les anciens lecteurs, gardez MP4.',
      },
      {
        q: 'Vais-je perdre de la qualité en convertissant MP4 en WebM ?',
        a: 'Les codecs VP9 et AV1 de WebM encodent plus efficacement, vous obtenez donc un fichier plus petit avec une qualité visuelle semblable.',
      },
      {
        q: 'Puis-je convertir plusieurs fichiers MP4 à la fois ?',
        a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers MP4 en WebM.',
      },
    ],
    'convert/mkv-to-webm': [
      {
        q: 'Dois-je convertir MKV en WebM ?',
        a: 'Si vous publiez sur le web, WebM gagne généralement en taille et en qualité par bit par rapport à MKV. MKV est un excellent format d\u2019archivage, mais les navigateurs et les sites de streaming préfèrent WebM.',
      },
      {
        q: 'Vais-je perdre de la qualité en convertissant MKV en WebM ?',
        a: 'Les codecs VP9 et AV1 de WebM encodent plus efficacement, vous obtenez donc un fichier plus petit avec une qualité visuelle semblable.',
      },
      {
        q: 'Puis-je convertir plusieurs fichiers MKV à la fois ?',
        a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers MKV en WebM.',
      },
    ],
    'convert/mov-to-mkv': [
      {
        q: 'Convertir MOV en MKV fait-il perdre de la qualité ?',
        a: 'Non. Par défaut, EncodeX remux les flux vidéo et audio existants, donc la qualité reste exactement la même et la conversion est très rapide.',
      },
      {
        q: 'Pourquoi voudrais-je MKV plutôt que MOV ?',
        a: 'MKV est un format entièrement ouvert avec des sous-titres intégrés, des pistes audio illimitées, des chapitres et des fichiers joints - mieux adapté à l\u2019archivage et aux serveurs multimédia que le conteneur fermé d\u2019Apple (MOV).',
      },
      {
        q: 'Puis-je convertir plusieurs fichiers MOV à la fois ?',
        a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers MOV en MKV.',
      },
    ],
    'convert/webm-to-mkv': [
      {
        q: 'Pourquoi devrais-je convertir WebM en MKV ?',
        a: 'WebM est conçu pour le web, mais MKV est un conteneur plus flexible qui prend en charge les sous-titres intégrés, des pistes audio illimitées, les chapitres et les fichiers joints, ce qui le rend parfait pour l\u2019archivage et les serveurs multimédia.',
      },
      {
        q: 'Vais-je perdre de la qualité en convertissant WebM en MKV ?',
        a: 'Non. EncodeX préserve la qualité de votre vidéo et de votre audio lors de la conversion du conteneur.',
      },
      {
        q: 'Puis-je convertir plusieurs fichiers WebM à la fois ?',
        a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers WebM en MKV.',
      },
    ],
    'convert/avi-to-mkv': [
      {
        q: 'Pourquoi devrais-je convertir AVI en MKV ?',
        a: 'AVI est un ancien format qui produit des fichiers volumineux et souvent incompatibles. MKV est un conteneur moderne et ouvert avec sous-titres, plusieurs pistes audio et chapitres, et il se lit parfaitement sur les lecteurs et serveurs multimédia actuels.',
      },
      {
        q: 'Vais-je perdre de la qualité en convertissant AVI en MKV ?',
        a: 'Non. EncodeX préserve la qualité de votre vidéo et de votre audio lors de la conversion du conteneur.',
      },
      {
        q: 'Puis-je convertir plusieurs fichiers AVI à la fois ?',
        a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers AVI en MKV.',
      },
    ],
    'convert/flv-to-mkv': [
      {
        q: 'Pourquoi devrais-je convertir FLV en MKV ?',
        a: 'FLV est un format de l\u2019ère Flash surtout utilisé pour les anciennes vidéos web. MKV est un conteneur moderne et ouvert qui garde ensemble audio, sous-titres et chapitres et se lit sur les lecteurs et serveurs multimédia actuels.',
      },
      {
        q: 'Vais-je perdre de la qualité en convertissant FLV en MKV ?',
        a: 'Non. EncodeX préserve la qualité de votre vidéo et de votre audio lors de la conversion du conteneur.',
      },
      {
        q: 'Puis-je convertir plusieurs fichiers FLV à la fois ?',
        a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers FLV en MKV.',
      },
    ],
    'convert/wmv-to-mkv': [
      {
        q: 'Pourquoi devrais-je convertir WMV en MKV ?',
        a: 'WMV est un format Microsoft surtout lié à Windows. MKV est un conteneur ouvert et largement pris en charge, avec sous-titres, pistes audio illimitées et chapitres, idéal pour l\u2019archivage et les serveurs multimédia.',
      },
      {
        q: 'Vais-je perdre de la qualité en convertissant WMV en MKV ?',
        a: 'Non. EncodeX préserve la qualité de votre vidéo et de votre audio lors de la conversion du conteneur.',
      },
      {
        q: 'Puis-je convertir plusieurs fichiers WMV à la fois ?',
        a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers WMV en MKV.',
      },
    ],
    'convert/mp4-to-mp3': [
      {
        q: 'Pourquoi convertir MP4 en MP3 ?',
        a: 'MP4 est un format vidéo, mais parfois vous n\u2019avez besoin que de l\u2019audio. MP3 se lit sur tous les téléphones, chaînes stéréo de voiture, enceintes connectées et outils de montage, et le fichier audio seul est beaucoup plus léger.',
      },
      {
        q: 'Vais-je perdre de la qualité audio en convertissant MP4 en MP3 ?',
        a: 'MP3 est un format avec perte, mais EncodeX lit la piste audio d\u2019origine et l\u2019encode avec les réglages de votre choix. Utilisez 320 kbps pour un son quasi sans perte.',
      },
      {
        q: 'Puis-je convertir plusieurs fichiers MP4 à la fois ?',
        a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers MP4 en MP3.',
      },
    ],
    'convert/mkv-to-mp3': [
      {
        q: 'Pourquoi convertir MKV en MP3 ?',
        a: 'MKV est un conteneur vidéo, mais ses pistes audio sont souvent exactement ce que vous voulez. Convertir MKV en MP3 extrait le son dans un petit fichier qui se lit sur tous les appareils.',
      },
      {
        q: 'Vais-je perdre de la qualité audio en convertissant MKV en MP3 ?',
        a: 'MP3 est un format avec perte, mais EncodeX lit la piste audio d\u2019origine et l\u2019encode avec les réglages de votre choix. Utilisez 320 kbps pour un son quasi sans perte.',
      },
      {
        q: 'Puis-je convertir plusieurs fichiers MKV à la fois ?',
        a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers MKV en MP3.',
      },
    ],
    'convert/mov-to-mp3': [
      {
        q: 'Pourquoi convertir MOV en MP3 ?',
        a: 'MOV est le format vidéo d\u2019Apple, mais parfois vous voulez juste la bande-son. Convertir MOV en MP3 vous donne l\u2019audio dans un fichier qui fonctionne sur tous les téléphones, chaînes stéréo de voiture et lecteurs.',
      },
      {
        q: 'Vais-je perdre de la qualité audio en convertissant MOV en MP3 ?',
        a: 'MP3 est un format avec perte, mais EncodeX lit la piste audio d\u2019origine et l\u2019encode avec les réglages de votre choix. Utilisez 320 kbps pour un son quasi sans perte.',
      },
      {
        q: 'Puis-je convertir plusieurs fichiers MOV à la fois ?',
        a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers MOV en MP3.',
      },
    ],
  },
  de: {
    'handbrake-alternative': [
      {
        q: 'Ist EncodeX wirklich eine HandBrake-Alternative?',
        a: 'Ja. EncodeX ist eine kostenlose Open-Source-FFmpeg-GUI für Windows, Mac und Linux mit einer freundlicheren Oberfläche, mehr Formaten, Hardware-Beschleunigung, Stapelwarteschlange und CLI-Modus.',
      },
      {
        q: 'Sollte ich von HandBrake zu EncodeX wechseln?',
        a: 'HandBrake ist hervorragend zum Rippen von Discs. EncodeX passt besser, wenn Sie eine einfachere Oberfläche, umfangreichere Stapelfunktionen, mehr Formate oder eine App möchten, die auch Bilder komprimiert und Audio extrahiert.',
      },
      {
        q: 'Funktioniert EncodeX offline?',
        a: 'Ja. Die gesamte Konvertierung findet lokal auf Ihrem Computer statt, Ihre Dateien verlassen also nie Ihr Gerät.',
      },
    ],
    'video-converter': [
      {
        q: 'Welche Dateiformate kann EncodeX konvertieren?',
        a: 'EncodeX konvertiert zwischen Dutzenden Formaten – MP4, MKV, MOV, AVI, WebM, FLV, WMV, M4V und mehr für Video, plus MP3, FLAC, WAV, M4A, AAC und OGG für Audio – direkt auf Ihrem Computer.',
      },
      {
        q: 'Ist EncodeX wirklich kostenlos?',
        a: 'Ja. EncodeX ist für immer kostenlos, Open Source, ohne Wasserzeichen, ohne Testlimits und ohne versteckte Bezahlschranken.',
      },
      {
        q: 'Werden meine Videos beim Konvertieren auf einen Server hochgeladen?',
        a: 'Nein. Alles läuft offline auf Ihrem eigenen Computer, Ihre Dateien verlassen also nie Ihr Gerät.',
      },
    ],
    'video-compressor': [
      {
        q: 'Wie viel kleiner werden komprimierte Videos?',
        a: 'Das hängt von Quelle und Einstellungen ab, aber EncodeX kann eine Datei oft auf einen Bruchteil ihrer Größe reduzieren und dabei eine visuell ähnliche Qualität durch intelligente Codecs und Bitraten erhalten.',
      },
      {
        q: 'Wird die Komprimierung meine Videoqualität reduzieren?',
        a: 'EncodeX balanciert Größe und Qualität automatisch. Sie entscheiden, wie aggressiv Sie sein möchten, und die Hardware-Beschleunigung hält Vorschau und Ausgabe schnell.',
      },
      {
        q: 'Komprimiert EncodeX Videos offline?',
        a: 'Ja. Die Komprimierung findet vollständig auf Ihrem Computer statt, ohne Uploads, ist also privat und funktioniert auch ohne Internet.',
      },
    ],
    'audio-converter': [
      {
        q: 'Welche Audioformate kann ich konvertieren?',
        a: 'MP3, FLAC, WAV, M4A, AAC, OGG, Opus und mehr – so können Sie mit einem Klick zwischen Formaten wechseln, von WAV zu MP3 oder FLAC zu MP3.',
      },
      {
        q: 'Kann EncodeX Audio aus einem Video extrahieren?',
        a: 'Ja. Legen Sie ein Video ab und ziehen Sie den Ton als MP3 oder ein anderes Format heraus – siehe unseren Leitfaden zum Extrahieren von Audio aus Video.',
      },
      {
        q: 'Kann ich einen ganzen Ordner mit Audiodateien konvertieren?',
        a: 'Ja. EncodeX ist ein Stapel-Audiokonverter: Sie können viele Dateien hineinziehen und es verarbeitet sie automatisch.',
      },
    ],
    'extract-audio-from-video': [
      {
        q: 'Aus welchen Videoformaten kann ich Audio extrahieren?',
        a: 'EncodeX extrahiert Ton aus MP4, MKV, MOV, AVI, WebM, FLV, WMV, M4V und mehr.',
      },
      { q: 'In welche Audioformate kann ich extrahieren?', a: 'Sie können extrahiertes Audio als MP3, M4A/AAC, FLAC oder WAV speichern.' },
      {
        q: 'Ist das Extrahieren von Audio aus Video kostenlos?',
        a: 'Ja. Die Extraktion ist kostenlos, offline und ohne Wasserzeichen, und Sie können auch einen ganzen Ordner Videos auf einmal extrahieren.',
      },
    ],
    'convert/mkv-to-mp4': [
      {
        q: 'Warum sollte ich MKV in MP4 konvertieren?',
        a: 'MKV ist ein flexibles Format, aber nicht jedes Gerät oder jeder Player unterstützt es. MP4 spielt fast überall: Telefone, Fernseher, Konsolen, Bearbeitungssoftware und Browser.',
      },
      {
        q: 'Verliere ich beim Konvertieren von MKV zu MP4 an Qualität?',
        a: 'Nein. EncodeX erhält Ihre Video- und Audioqualität beim Umwandeln des Containers.',
      },
      {
        q: 'Kann ich viele MKV-Dateien auf einmal konvertieren?',
        a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners MKV-Dateien in MP4.',
      },
    ],
    'convert/mp4-to-mkv': [
      {
        q: 'Verliert das Konvertieren von MP4 in MKV Qualität?',
        a: 'Nein. Standardmäßig remuxt EncodeX die vorhandenen Video- und Audiostreams, sodass die Qualität exakt gleich bleibt und die Konvertierung sehr schnell ist.',
      },
      {
        q: 'Warum sollte ich MKV statt MP4 wollen?',
        a: 'MKV unterstützt eingebettete Untertitel, unbegrenzte Audiospuren, Kapitel und Anhänge, was es zu einem Favoriten für Archivierung und Medienserver macht.',
      },
      {
        q: 'Kann ich viele MP4-Dateien auf einmal konvertieren?',
        a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners MP4-Dateien in MKV.',
      },
    ],
    'convert/mp4-to-webm': [
      {
        q: 'Sollte ich MP4 in WebM konvertieren?',
        a: 'Für die Veröffentlichung im Web gewinnt WebM meist bei Dateigröße und Qualität pro Bit gegenüber MP4. Für maximale Kompatibilität mit älteren Playern behalten Sie MP4.',
      },
      {
        q: 'Verliere ich beim Konvertieren von MP4 in WebM an Qualität?',
        a: 'Die VP9- und AV1-Codecs von WebM kodieren effizienter, sodass Sie typischerweise eine kleinere Datei bei ähnlich sichtbarer Qualität erhalten.',
      },
      {
        q: 'Kann ich viele MP4-Dateien auf einmal konvertieren?',
        a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners MP4-Dateien in WebM.',
      },
    ],
    'convert/mkv-to-webm': [
      {
        q: 'Sollte ich MKV in WebM konvertieren?',
        a: 'Für die Veröffentlichung im Web gewinnt WebM meist bei Dateigröße und Qualität pro Bit gegenüber MKV. MKV ist ein großartiges Archivformat, aber Browser und Streaming-Seiten bevorzugen WebM.',
      },
      {
        q: 'Verliere ich beim Konvertieren von MKV zu WebM an Qualität?',
        a: 'Die VP9- und AV1-Codecs von WebM kodieren effizienter, sodass Sie typischerweise eine kleinere Datei bei ähnlich sichtbarer Qualität erhalten.',
      },
      {
        q: 'Kann ich viele MKV-Dateien auf einmal konvertieren?',
        a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners MKV-Dateien in WebM.',
      },
    ],
    'convert/mov-to-mkv': [
      {
        q: 'Verliert das Konvertieren von MOV in MKV Qualität?',
        a: 'Nein. Standardmäßig remuxt EncodeX die vorhandenen Video- und Audiostreams, sodass die Qualität exakt gleich bleibt und die Konvertierung sehr schnell ist.',
      },
      {
        q: 'Warum sollte ich MKV statt MOV wollen?',
        a: 'MKV ist ein vollständig offenes Format mit eingebetteten Untertiteln, unbegrenzten Audiospuren, Kapiteln und Anhängen – besser für Archivierung und Medienserver geeignet als der geschlossene MOV-Container von Apple.',
      },
      {
        q: 'Kann ich viele MOV-Dateien auf einmal konvertieren?',
        a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners MOV-Dateien in MKV.',
      },
    ],
    'convert/webm-to-mkv': [
      {
        q: 'Warum sollte ich WebM in MKV konvertieren?',
        a: 'WebM ist für das Web gebaut, aber MKV ist ein flexiblerer Container, der eingebettete Untertitel, unbegrenzte Audiospuren, Kapitel und Anhänge unterstützt – ideal für Archivierung und Medienserver.',
      },
      {
        q: 'Verliere ich beim Konvertieren von WebM zu MKV an Qualität?',
        a: 'Nein. EncodeX erhält Ihre Video- und Audioqualität beim Umwandeln des Containers.',
      },
      {
        q: 'Kann ich viele WebM-Dateien auf einmal konvertieren?',
        a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners WebM-Dateien in MKV.',
      },
    ],
    'convert/avi-to-mkv': [
      {
        q: 'Warum sollte ich AVI in MKV konvertieren?',
        a: 'AVI ist ein altes Format, das große und oft inkompatible Dateien erzeugt. MKV ist ein moderner, offener Container mit Untertiteln, mehreren Audiospuren und Kapiteln, und er spielt auf heutigen Playern und Medienservern hervorragend ab.',
      },
      {
        q: 'Verliere ich beim Konvertieren von AVI zu MKV an Qualität?',
        a: 'Nein. EncodeX erhält Ihre Video- und Audioqualität beim Umwandeln des Containers.',
      },
      {
        q: 'Kann ich viele AVI-Dateien auf einmal konvertieren?',
        a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners AVI-Dateien in MKV.',
      },
    ],
    'convert/flv-to-mkv': [
      {
        q: 'Warum sollte ich FLV in MKV konvertieren?',
        a: 'FLV ist ein Format aus der Flash-Ära, das hauptsächlich für alte Webvideos verwendet wird. MKV ist ein moderner, offener Container, der Audio, Untertitel und Kapitel zusammen hält und auf heutigen Playern und Medienservern spielt.',
      },
      {
        q: 'Verliere ich beim Konvertieren von FLV zu MKV an Qualität?',
        a: 'Nein. EncodeX erhält Ihre Video- und Audioqualität beim Umwandeln des Containers.',
      },
      {
        q: 'Kann ich viele FLV-Dateien auf einmal konvertieren?',
        a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners FLV-Dateien in MKV.',
      },
    ],
    'convert/wmv-to-mkv': [
      {
        q: 'Warum sollte ich WMV in MKV konvertieren?',
        a: 'WMV ist ein Microsoft-Format, das meist an Windows gebunden ist. MKV ist ein offener, weitgehend unterstützter Container mit Untertiteln, unbegrenzten Audiospuren und Kapiteln – ideal für Archivierung und Medienserver.',
      },
      {
        q: 'Verliere ich beim Konvertieren von WMV zu MKV an Qualität?',
        a: 'Nein. EncodeX erhält Ihre Video- und Audioqualität beim Umwandeln des Containers.',
      },
      {
        q: 'Kann ich viele WMV-Dateien auf einmal konvertieren?',
        a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners WMV-Dateien in MKV.',
      },
    ],
    'convert/mp4-to-mp3': [
      {
        q: 'Warum sollte ich MP4 in MP3 konvertieren?',
        a: 'MP4 ist ein Videoformat, aber manchmal brauchen Sie nur das Audio. MP3 spielt auf jedem Telefon, jeder Auto-Stereoanlage, jedem Smart Speaker und jedem Bearbeitungstool, und die Audio-Datei ist viel kleiner.',
      },
      {
        q: 'Verliere ich beim Konvertieren von MP4 zu MP3 an Audioqualität?',
        a: 'MP3 ist ein verlustbehaftetes Format, aber EncodeX liest die ursprüngliche Audiospur und codiert sie mit den Einstellungen Ihrer Wahl. Verwenden Sie 320 kbps für einen nahezu verlustfreien Klang.',
      },
      {
        q: 'Kann ich viele MP4-Dateien auf einmal konvertieren?',
        a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners MP4-Dateien in MP3.',
      },
    ],
    'convert/mkv-to-mp3': [
      {
        q: 'Warum sollte ich MKV in MP3 konvertieren?',
        a: 'MKV ist ein Videocontainer, aber seine Audiospuren sind oft genau das, was Sie wollen. Das Konvertieren von MKV in MP3 extrahiert den Ton in eine kleine Datei, die auf jedem Gerät spielt.',
      },
      {
        q: 'Verliere ich beim Konvertieren von MKV zu MP3 an Audioqualität?',
        a: 'MP3 ist ein verlustbehaftetes Format, aber EncodeX liest die ursprüngliche Audiospur und codiert sie mit den Einstellungen Ihrer Wahl. Verwenden Sie 320 kbps für einen nahezu verlustfreien Klang.',
      },
      {
        q: 'Kann ich viele MKV-Dateien auf einmal konvertieren?',
        a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners MKV-Dateien in MP3.',
      },
    ],
    'convert/mov-to-mp3': [
      {
        q: 'Warum sollte ich MOV in MP3 konvertieren?',
        a: 'MOV ist Apples Videoformat, aber manchmal wollen Sie einfach nur den Soundtrack. Das Konvertieren von MOV in MP3 liefert Ihnen das Audio in einer Datei, die auf jedem Telefon, jeder Auto-Stereoanlage und jedem Player funktioniert.',
      },
      {
        q: 'Verliere ich beim Konvertieren von MOV zu MP3 an Audioqualität?',
        a: 'MP3 ist ein verlustbehaftetes Format, aber EncodeX liest die ursprüngliche Audiospur und codiert sie mit den Einstellungen Ihrer Wahl. Verwenden Sie 320 kbps für einen nahezu verlustfreien Klang.',
      },
      {
        q: 'Kann ich viele MOV-Dateien auf einmal konvertieren?',
        a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners MOV-Dateien in MP3.',
      },
    ],
  },
  pt: {
    'handbrake-alternative': [
      {
        q: 'O EncodeX é realmente uma alternativa ao HandBrake?',
        a: 'Sim. O EncodeX é uma interface gratuita e open source para FFmpeg no Windows, Mac e Linux, com uma interface mais amigável, mais formatos, aceleração por hardware, fila em lote e modo CLI.',
      },
      {
        q: 'Devo migrar do HandBrake para o EncodeX?',
        a: 'O HandBrake é excelente para extrair discos. O EncodeX é melhor se você quer uma interface mais simples, recursos de lote mais ricos, mais formatos ou um único app que também comprima imagens e extraia áudio.',
      },
      {
        q: 'O EncodeX funciona offline?',
        a: 'Sim. Toda a conversão acontece localmente no seu computador, então seus arquivos nunca saem do seu dispositivo.',
      },
    ],
    'video-converter': [
      {
        q: 'Quais formatos de arquivo o EncodeX converte?',
        a: 'O EncodeX converte entre dezenas de formatos – MP4, MKV, MOV, AVI, WebM, FLV, WMV, M4V e mais para vídeo, além de MP3, FLAC, WAV, M4A, AAC e OGG para áudio – direto no seu computador.',
      },
      {
        q: 'O EncodeX é realmente gratuito?',
        a: 'Sim. O EncodeX é gratuito para sempre, open source, sem marcas d\u2019água, sem limites de teste e sem paywalls ocultos.',
      },
      {
        q: 'A conversão envia meus vídeos para um servidor?',
        a: 'Não. Tudo roda offline no seu próprio computador, então seus arquivos nunca saem do seu dispositivo.',
      },
    ],
    'video-compressor': [
      {
        q: 'Quanto menores ficarão os vídeos comprimidos?',
        a: 'Depende da fonte e das configurações, mas o EncodeX geralmente reduz um arquivo a uma fração do tamanho mantendo qualidade visual semelhante ao escolher codecs e bitrates inteligentes.',
      },
      {
        q: 'A compressão vai reduzir a qualidade do meu vídeo?',
        a: 'O EncodeX equilibra tamanho e qualidade automaticamente. Você escolhe o quão agressivo ser, e a aceleração por hardware mantém prévias e saída rápidas.',
      },
      {
        q: 'O EncodeX comprime vídeos offline?',
        a: 'Sim. A compressão acontece inteiramente no seu computador, sem uploads, é privada e funciona mesmo sem internet.',
      },
    ],
    'audio-converter': [
      {
        q: 'Quais formatos de áudio posso converter?',
        a: 'MP3, FLAC, WAV, M4A, AAC, OGG, Opus e mais – para alternar entre formatos com um clique, de WAV para MP3 ou de FLAC para MP3.',
      },
      {
        q: 'O EncodeX pode extrair áudio de vídeo?',
        a: 'Sim. Solte um vídeo e extraia o som como MP3 ou outro formato – veja nosso guia de extração de áudio de vídeo.',
      },
      {
        q: 'Posso converter uma pasta inteira de arquivos de áudio?',
        a: 'Sim. O EncodeX é um conversor de áudio em lote: arraste muitos arquivos e ele os processa automaticamente.',
      },
    ],
    'extract-audio-from-video': [
      {
        q: 'De quais formatos de vídeo posso extrair áudio?',
        a: 'O EncodeX extrai som de MP4, MKV, MOV, AVI, WebM, FLV, WMV, M4V e mais.',
      },
      { q: 'Para quais formatos de áudio posso extrair?', a: 'Você pode salvar o áudio extraído como MP3, M4A/AAC, FLAC ou WAV.' },
      {
        q: 'Extrair áudio de vídeo é gratuito?',
        a: 'Sim. A extração é gratuita, offline e sem marcas d\u2019água, e você também pode extrair em lote uma pasta inteira de vídeos.',
      },
    ],
    'convert/mkv-to-mp4': [
      {
        q: 'Por que devo converter MKV em MP4?',
        a: 'MKV é um formato flexível, mas nem todo dispositivo ou player suporta. MP4 roda em quase tudo: celulares, TVs, consoles, softwares de edição e navegadores.',
      },
      {
        q: 'Vou perder qualidade convertendo MKV para MP4?',
        a: 'Não. O EncodeX mantém a qualidade do seu vídeo e áudio ao converter o contêiner.',
      },
      {
        q: 'Posso converter muitos arquivos MKV de uma vez?',
        a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos MKV para MP4.',
      },
    ],
    'convert/mp4-to-mkv': [
      {
        q: 'Converter MP4 em MKV perde qualidade?',
        a: 'Não. Por padrão, o EncodeX remuxa os streams de vídeo e áudio existentes, então a qualidade permanece exatamente a mesma e a conversão é muito rápida.',
      },
      {
        q: 'Por que eu preferiria MKV em vez de MP4?',
        a: 'MKV suporta legendas integradas, trilhas de áudio ilimitadas, capítulos e arquivos anexos, o que o torna favorito para arquivamento e servidores de mídia.',
      },
      {
        q: 'Posso converter muitos arquivos MP4 de uma vez?',
        a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos MP4 para MKV.',
      },
    ],
    'convert/mp4-to-webm': [
      {
        q: 'Devo converter MP4 em WebM?',
        a: 'Para publicação na web, o WebM geralmente vence em tamanho de arquivo e qualidade por bit sobre MP4. Para máxima compatibilidade com players antigos, mantenha MP4.',
      },
      {
        q: 'Vou perder qualidade convertendo MP4 para WebM?',
        a: 'Os codecs VP9 e AV1 do WebM codificam de forma mais eficiente, então você normalmente obtém um arquivo menor com qualidade visual semelhante.',
      },
      {
        q: 'Posso converter muitos arquivos MP4 de uma vez?',
        a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos MP4 para WebM.',
      },
    ],
    'convert/mkv-to-webm': [
      {
        q: 'Devo converter MKV em WebM?',
        a: 'Para publicação na web, o WebM geralmente vence em tamanho de arquivo e qualidade por bit sobre MKV. MKV é ótimo para arquivar, mas navegadores e sites de streaming preferem WebM.',
      },
      {
        q: 'Vou perder qualidade convertendo MKV para WebM?',
        a: 'Os codecs VP9 e AV1 do WebM codificam de forma mais eficiente, então você normalmente obtém um arquivo menor com qualidade visual semelhante.',
      },
      {
        q: 'Posso converter muitos arquivos MKV de uma vez?',
        a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos MKV para WebM.',
      },
    ],
    'convert/mov-to-mkv': [
      {
        q: 'Converter MOV em MKV perde qualidade?',
        a: 'Não. Por padrão, o EncodeX remuxa os streams de vídeo e áudio existentes, então a qualidade permanece exatamente a mesma e a conversão é muito rápida.',
      },
      {
        q: 'Por que eu preferiria MKV em vez de MOV?',
        a: 'MKV é um formato totalmente aberto com legendas integradas, trilhas de áudio ilimitadas, capítulos e arquivos anexos – melhor para arquivamento e servidores de mídia do que o contêiner MOV fechado da Apple.',
      },
      {
        q: 'Posso converter muitos arquivos MOV de uma vez?',
        a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos MOV para MKV.',
      },
    ],
    'convert/webm-to-mkv': [
      {
        q: 'Por que devo converter WebM em MKV?',
        a: 'WebM é feito para a web, mas MKV é um contêiner mais flexível que suporta legendas integradas, trilhas de áudio ilimitadas, capítulos e arquivos anexos, sendo ótimo para arquivamento e servidores de mídia.',
      },
      {
        q: 'Vou perder qualidade convertendo WebM para MKV?',
        a: 'Não. O EncodeX mantém a qualidade do seu vídeo e áudio ao converter o contêiner.',
      },
      {
        q: 'Posso converter muitos arquivos WebM de uma vez?',
        a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos WebM para MKV.',
      },
    ],
    'convert/avi-to-mkv': [
      {
        q: 'Por que devo converter AVI em MKV?',
        a: 'AVI é um formato antigo que produz arquivos grandes e muitas vezes incompatíveis. MKV é um contêiner moderno e aberto com legendas, múltiplas trilhas de áudio e capítulos, e é reproduzido perfeitamente nos players e servidores de mídia atuais.',
      },
      {
        q: 'Vou perder qualidade convertendo AVI para MKV?',
        a: 'Não. O EncodeX mantém a qualidade do seu vídeo e áudio ao converter o contêiner.',
      },
      {
        q: 'Posso converter muitos arquivos AVI de uma vez?',
        a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos AVI para MKV.',
      },
    ],
    'convert/flv-to-mkv': [
      {
        q: 'Por que devo converter FLV em MKV?',
        a: 'FLV é um formato da era do Flash usado principalmente em vídeos web antigos. MKV é um contêiner moderno e aberto que mantém juntos áudio, legendas e capítulos e é reproduzido nos players e servidores de mídia atuais.',
      },
      {
        q: 'Vou perder qualidade convertendo FLV para MKV?',
        a: 'Não. O EncodeX mantém a qualidade do seu vídeo e áudio ao converter o contêiner.',
      },
      {
        q: 'Posso converter muitos arquivos FLV de uma vez?',
        a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos FLV para MKV.',
      },
    ],
    'convert/wmv-to-mkv': [
      {
        q: 'Por que devo converter WMV em MKV?',
        a: 'WMV é um formato da Microsoft principalmente ligado ao Windows. MKV é um contêiner aberto e amplamente compatível com legendas, trilhas de áudio ilimitadas e capítulos, ideal para arquivamento e servidores de mídia.',
      },
      {
        q: 'Vou perder qualidade convertendo WMV para MKV?',
        a: 'Não. O EncodeX mantém a qualidade do seu vídeo e áudio ao converter o contêiner.',
      },
      {
        q: 'Posso converter muitos arquivos WMV de uma vez?',
        a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos WMV para MKV.',
      },
    ],
    'convert/mp4-to-mp3': [
      {
        q: 'Por que devo converter MP4 em MP3?',
        a: 'MP4 é um formato de vídeo, mas às vezes você só precisa do áudio. MP3 roda em todos os celulares, rádios de carro, alto-falantes inteligentes e ferramentas de edição, e o arquivo só de áudio é muito menor.',
      },
      {
        q: 'Vou perder qualidade de áudio convertendo MP4 para MP3?',
        a: 'MP3 é um formato com perdas, mas o EncodeX lê a trilha de áudio original e a codifica com as configurações que você escolher. Use 320 kbps para um som quase sem perdas.',
      },
      {
        q: 'Posso converter muitos arquivos MP4 de uma vez?',
        a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos MP4 para MP3.',
      },
    ],
    'convert/mkv-to-mp3': [
      {
        q: 'Por que devo converter MKV em MP3?',
        a: 'MKV é um contêiner de vídeo, mas suas trilhas de áudio costumam ser exatamente o que você quer. Converter MKV em MP3 extrai o som em um arquivo pequeno que roda em todos os dispositivos.',
      },
      {
        q: 'Vou perder qualidade de áudio convertendo MKV para MP3?',
        a: 'MP3 é um formato com perdas, mas o EncodeX lê a trilha de áudio original e a codifica com as configurações que você escolher. Use 320 kbps para um som quase sem perdas.',
      },
      {
        q: 'Posso converter muitos arquivos MKV de uma vez?',
        a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos MKV para MP3.',
      },
    ],
    'convert/mov-to-mp3': [
      {
        q: 'Por que devo converter MOV em MP3?',
        a: 'MOV é o formato de vídeo da Apple, mas às vezes você só quer a trilha sonora. Converter MOV em MP3 entrega o áudio em um arquivo que funciona em todos os celulares, rádios de carro e players.',
      },
      {
        q: 'Vou perder qualidade de áudio convertendo MOV para MP3?',
        a: 'MP3 é um formato com perdas, mas o EncodeX lê a trilha de áudio original e a codifica com as configurações que você escolher. Use 320 kbps para um som quase sem perdas.',
      },
      {
        q: 'Posso converter muitos arquivos MOV de uma vez?',
        a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos MOV para MP3.',
      },
    ],
  },
  zh: {
    'handbrake-alternative': [
      {
        q: 'EncodeX 真的是 HandBrake 的替代品吗？',
        a: '是的。EncodeX 是一款免费开源的 FFmpeg 图形界面，支持 Windows、Mac 和 Linux，具有更友好的界面、更多格式、硬件加速、批量队列和 CLI 模式。',
      },
      {
        q: '我应该从 HandBrake 换成 EncodeX 吗？',
        a: 'HandBrake 非常适合光盘抓取。如果您想要更简单的界面、更丰富的批处理功能、更多格式，或者一个还能压缩图片和提取音频的应用，EncodeX 更合适。',
      },
      { q: 'EncodeX 可以离线工作吗？', a: '是的。所有转换都在您的计算机本地进行，因此您的文件绝不会离开您的设备。' },
    ],
    'video-converter': [
      {
        q: 'EncodeX 可以转换哪些文件格式？',
        a: 'EncodeX 可以在几十种格式之间转换：视频支持 MP4、MKV、MOV、AVI、WebM、FLV、WMV、M4V 等，音频支持 MP3、FLAC、WAV、M4A、AAC 和 OGG——全部在您的电脑上完成。',
      },
      { q: 'EncodeX 真的免费吗？', a: '是的。EncodeX 永久免费、开源，无水印、无试用限制、无隐藏付费墙。' },
      { q: '转换会把我的视频上传到服务器吗？', a: '不会。一切都在您自己的电脑上离线运行，您的文件绝不会离开您的设备。' },
    ],
    'video-compressor': [
      {
        q: '压缩后的视频能减少多少？',
        a: '这取决于源文件和设置，但 EncodeX 通过选择智能的编码器和码率，通常可以将文件压缩到很小并保持视觉上相似的画质。',
      },
      { q: '压缩会降低我的视频质量吗？', a: 'EncodeX 会自动平衡大小和质量。您可以选择压缩强度，硬件加速可让预览和输出保持快速。' },
      { q: 'EncodeX 可以离线压缩视频吗？', a: '可以。压缩完全在您的电脑上进行，无需上传，因此是私密的，即使没有网络也能工作。' },
    ],
    'audio-converter': [
      { q: '我可以转换哪些音频格式？', a: 'MP3、FLAC、WAV、M4A、AAC、OGG、Opus 等——一键在格式之间切换，从 WAV 到 MP3，或从 FLAC 到 MP3。' },
      { q: 'EncodeX 可以从视频中提取音频吗？', a: '可以。放入一个视频，将声音提取为 MP3 或其他格式——请参阅我们的从视频中提取音频指南。' },
      { q: '我可以转换整个文件夹的音频文件吗？', a: '可以。EncodeX 是批量音频转换器，您可以拖入许多文件，它会自动处理。' },
    ],
    'extract-audio-from-video': [
      { q: '我可以从哪些视频格式提取音频？', a: 'EncodeX 可以从 MP4、MKV、MOV、AVI、WebM、FLV、WMV、M4V 等格式提取声音。' },
      { q: '我可以提取成哪些音频格式？', a: '您可以将提取的音频保存为 MP3、M4A/AAC、FLAC 或 WAV。' },
      { q: '从视频中提取音频免费吗？', a: '是的。提取免费、离线且无水印，您还可以一次批量提取整个文件夹的视频。' },
    ],
    'convert/mkv-to-mp4': [
      {
        q: '为什么要把 MKV 转成 MP4？',
        a: 'MKV 是灵活的格式，但并非所有设备或播放器都支持它。MP4 几乎可以在所有设备上播放：手机、电视、游戏机、编辑软件和浏览器。',
      },
      { q: '将 MKV 转成 MP4 会丢失质量吗？', a: '不会。EncodeX 在转换封装格式时会保持视频和音频质量不变。' },
      { q: '我可以一次转换多个 MKV 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 MKV 文件批量转换为 MP4。' },
    ],
    'convert/mp4-to-mkv': [
      {
        q: '将 MP4 转成 MKV 会丢失质量吗？',
        a: '不会。默认情况下 EncodeX 会重新封装现有的视频和音频流，因此质量完全相同，转换速度非常快。',
      },
      { q: '为什么我想要 MKV 而不是 MP4？', a: 'MKV 支持软字幕、无限音轨、章节和附件文件，是归档和媒体服务器的理想选择。' },
      { q: '我可以一次转换多个 MP4 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 MP4 文件批量转换为 MKV。' },
    ],
    'convert/mp4-to-webm': [
      {
        q: '我应该将 MP4 转成 WebM 吗？',
        a: '如果发布到网络，WebM 在文件大小和每比特质量上通常优于 MP4。为了与旧播放器最大兼容，请保留 MP4。',
      },
      { q: '将 MP4 转成 WebM 会丢失质量吗？', a: 'WebM 的 VP9 和 AV1 编码器效率更高，因此通常在相近的视觉质量下获得更小的文件。' },
      { q: '我可以一次转换多个 MP4 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 MP4 文件批量转换为 WebM。' },
    ],
    'convert/mkv-to-webm': [
      {
        q: '我应该将 MKV 转成 WebM 吗？',
        a: '如果发布到网络，WebM 在文件大小和每比特质量上通常优于 MKV。MKV 是很棒的存档格式，但浏览器和流媒体网站更青睐 WebM。',
      },
      { q: '将 MKV 转成 WebM 会丢失质量吗？', a: 'WebM 的 VP9 和 AV1 编码器效率更高，因此通常在相近的视觉质量下获得更小的文件。' },
      { q: '我可以一次转换多个 MKV 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 MKV 文件批量转换为 WebM。' },
    ],
    'convert/mov-to-mkv': [
      {
        q: '将 MOV 转成 MKV 会丢失质量吗？',
        a: '不会。默认情况下 EncodeX 会重新封装现有的视频和音频流，因此质量完全相同，转换速度非常快。',
      },
      {
        q: '为什么我想要 MKV 而不是 MOV？',
        a: 'MKV 是完全开放的格式，支持软字幕、无限音轨、章节和附件文件——比苹果封闭的 MOV 容器更适合归档和媒体服务器。',
      },
      { q: '我可以一次转换多个 MOV 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 MOV 文件批量转换为 MKV。' },
    ],
    'convert/webm-to-mkv': [
      {
        q: '为什么要把 WebM 转成 MKV？',
        a: 'WebM 专为网络而生，但 MKV 是更灵活的封装格式，支持软字幕、无限音轨、章节和附件文件，非常适合归档和媒体服务器。',
      },
      { q: '将 WebM 转成 MKV 会丢失质量吗？', a: '不会。EncodeX 在转换封装格式时会保持视频和音频质量不变。' },
      { q: '我可以一次转换多个 WebM 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 WebM 文件批量转换为 MKV。' },
    ],
    'convert/avi-to-mkv': [
      {
        q: '为什么要把 AVI 转成 MKV？',
        a: 'AVI 是旧格式，生成的文件很大且经常不兼容。MKV 是现代开放的封装格式，支持字幕、多音轨和章节，能完美适应当今的播放器和媒体服务器。',
      },
      { q: '将 AVI 转成 MKV 会丢失质量吗？', a: '不会。EncodeX 在转换封装格式时会保持视频和音频质量不变。' },
      { q: '我可以一次转换多个 AVI 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 AVI 文件批量转换为 MKV。' },
    ],
    'convert/flv-to-mkv': [
      {
        q: '为什么要把 FLV 转成 MKV？',
        a: 'FLV 是 Flash 时代的格式，主要用于旧的网络视频。MKV 是现代开放的封装格式，能将音频、字幕和章节组合在一起，适用于当今的播放器和媒体服务器。',
      },
      { q: '将 FLV 转成 MKV 会丢失质量吗？', a: '不会。EncodeX 在转换封装格式时会保持视频和音频质量不变。' },
      { q: '我可以一次转换多个 FLV 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 FLV 文件批量转换为 MKV。' },
    ],
    'convert/wmv-to-mkv': [
      {
        q: '为什么要把 WMV 转成 MKV？',
        a: 'WMV 是微软的格式，主要与 Windows 绑定。MKV 是开放且被广泛支持的封装格式，支持字幕、无限音轨和章节，是归档和媒体服务器的理想选择。',
      },
      { q: '将 WMV 转成 MKV 会丢失质量吗？', a: '不会。EncodeX 在转换封装格式时会保持视频和音频质量不变。' },
      { q: '我可以一次转换多个 WMV 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 WMV 文件批量转换为 MKV。' },
    ],
    'convert/mp4-to-mp3': [
      {
        q: '为什么要把 MP4 转成 MP3？',
        a: 'MP4 是视频格式，但有时您只需要音频。MP3 能在每部手机、车载音响、智能音箱和编辑工具上播放，而且纯音频文件小得多。',
      },
      {
        q: '将 MP4 转成 MP3 会丢失音频质量吗？',
        a: 'MP3 是有损格式，但 EncodeX 会读取原始音轨并按您选择的设置进行编码。使用 320 kbps 可获得接近无损的音质。',
      },
      { q: '我可以一次转换多个 MP4 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 MP4 文件批量转换为 MP3。' },
    ],
    'convert/mkv-to-mp3': [
      {
        q: '为什么要把 MKV 转成 MP3？',
        a: 'MKV 是视频封装格式，但它的音轨往往正是您想要的。将 MKV 转成 MP3 可把声音提取到一个能在所有设备上播放的小文件中。',
      },
      {
        q: '将 MKV 转成 MP3 会丢失音频质量吗？',
        a: 'MP3 是有损格式，但 EncodeX 会读取原始音轨并按您选择的设置进行编码。使用 320 kbps 可获得接近无损的音质。',
      },
      { q: '我可以一次转换多个 MKV 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 MKV 文件批量转换为 MP3。' },
    ],
    'convert/mov-to-mp3': [
      {
        q: '为什么要把 MOV 转成 MP3？',
        a: 'MOV 是苹果的视频格式，但有时您只想要原声带。将 MOV 转成 MP3 可让您得到能在每部手机、车载音响和播放器上播放的音频文件。',
      },
      {
        q: '将 MOV 转成 MP3 会丢失音频质量吗？',
        a: 'MP3 是有损格式，但 EncodeX 会读取原始音轨并按您选择的设置进行编码。使用 320 kbps 可获得接近无损的音质。',
      },
      { q: '我可以一次转换多个 MOV 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 MOV 文件批量转换为 MP3。' },
    ],
  },
  hi: {
    'handbrake-alternative': [
      {
        q: 'क्या EncodeX वास्तव में HandBrake का विकल्प है?',
        a: 'हाँ। EncodeX Windows, Mac और Linux के लिए एक निःशुल्क, ओपन-सोर्स FFmpeg GUI है, जिसमें अधिक अनुकूल इंटरफ़ेस, अधिक प्रारूप, हार्डवेयर एक्सेलेरेशन, बैच कतार और CLI मोड है।',
      },
      {
        q: 'क्या मुझे HandBrake से EncodeX पर स्विच करना चाहिए?',
        a: 'HandBrake डिस्क रिपिंग के लिए उत्कृष्ट है। EncodeX बेहतर है यदि आप सरल इंटरफ़ेस, समृद्ध बैच सुविधाएँ, अधिक प्रारूप, या एक ऐप चाहते हैं जो चित्र भी कंप्रेस करे और ऑडियो निकाले।',
      },
      {
        q: 'क्या EncodeX ऑफ़लाइन काम करता है?',
        a: 'हाँ। सभी रूपांतरण आपके कंप्यूटर पर स्थानीय रूप से होते हैं, इसलिए आपकी फ़ाइलें कभी आपके डिवाइस से बाहर नहीं जातीं।',
      },
    ],
    'video-converter': [
      {
        q: 'EncodeX कौन-कौन से फ़ाइल प्रारूप बदल सकता है?',
        a: 'EncodeX दर्जनों प्रारूपों के बीच बदलता है – वीडियो के लिए MP4, MKV, MOV, AVI, WebM, FLV, WMV, M4V और अधिक, साथ ही ऑडियो के लिए MP3, FLAC, WAV, M4A, AAC और OGG – सीधे आपके कंप्यूटर पर।',
      },
      {
        q: 'क्या EncodeX वास्तव में मुफ़्त है?',
        a: 'हाँ। EncodeX हमेशा के लिए मुफ़्त है, ओपन सोर्स है, बिना वॉटरमार्क, बिना ट्रायल सीमा और बिना छिपे पेमेंट के।',
      },
      {
        q: 'क्या कनवर्ट करने से मेरे वीडियो सर्वर पर अपलोड होते हैं?',
        a: 'नहीं। सब कुछ आपके अपने कंप्यूटर पर ऑफ़लाइन चलता है, इसलिए आपकी फ़ाइलें कभी आपके डिवाइस से बाहर नहीं जातीं।',
      },
    ],
    'video-compressor': [
      {
        q: 'कंप्रेस किए गए वीडियो कितने छोटे होंगे?',
        a: 'यह स्रोत और सेटिंग्स पर निर्भर करता है, लेकिन EncodeX स्मार्ट कोडेक्स और बिटरेट चुनकर दृश्य गुणवत्ता को बनाए रखते हुए अक्सर फ़ाइल को उसके आकार के एक अंश में कम कर देता है।',
      },
      {
        q: 'क्या कंप्रेस करने से मेरे वीडियो की गुणवत्ता घटेगी?',
        a: 'EncodeX आकार और गुणवत्ता को स्वचालित रूप से संतुलित करता है। आप चुनते हैं कि कितना आक्रामक होना है, और हार्डवेयर एक्सेलेरेशन प्रीव्यू और आउटपुट को तेज़ रखता है।',
      },
      {
        q: 'क्या EncodeX वीडियो ऑफ़लाइन कंप्रेस करता है?',
        a: 'हाँ। कंप्रेशन पूरी तरह आपके कंप्यूटर पर होता है, बिना अपलोड के, इसलिए यह निजी है और बिना इंटरनेट के भी काम करता है।',
      },
    ],
    'audio-converter': [
      {
        q: 'मैं कौन-से ऑडियो प्रारूप बदल सकता हूँ?',
        a: 'MP3, FLAC, WAV, M4A, AAC, OGG, Opus और अधिक – एक क्लिक में प्रारूप बदलें, WAV से MP3 या FLAC से MP3।',
      },
      {
        q: 'क्या EncodeX वीडियो से ऑडियो निकाल सकता है?',
        a: 'हाँ। एक वीडियो डालें और ध्वनि को MP3 या किसी अन्य प्रारूप में निकालें – वीडियो से ऑडियो निकालने की हमारी गाइड देखें।',
      },
      {
        q: 'क्या मैं ऑडियो फ़ाइलों का पूरा फ़ोल्डर बदल सकता हूँ?',
        a: 'हाँ। EncodeX एक बैच ऑडियो कनवर्टर है – आप कई फ़ाइलें डाल सकते हैं और यह स्वचालित रूप से उन्हें प्रोसेस करता है।',
      },
    ],
    'extract-audio-from-video': [
      {
        q: 'मैं किन वीडियो प्रारूपों से ऑडियो निकाल सकता हूँ?',
        a: 'EncodeX MP4, MKV, MOV, AVI, WebM, FLV, WMV, M4V और अधिक से ध्वनि निकालता है।',
      },
      { q: 'मैं किन ऑडियो प्रारूपों में निकाल सकता हूँ?', a: 'आप निकाले गए ऑडियो को MP3, M4A/AAC, FLAC या WAV के रूप में सहेज सकते हैं।' },
      {
        q: 'क्या वीडियो से ऑडियो निकालना मुफ़्त है?',
        a: 'हाँ। निकालना मुफ़्त, ऑफ़लाइन और वॉटरमार्क-मुक्त है, और आप एक साथ पूरे फ़ोल्डर के वीडियो भी निकाल सकते हैं।',
      },
    ],
    'convert/mkv-to-mp4': [
      {
        q: 'मुझे MKV को MP4 में क्यों बदलना चाहिए?',
        a: 'MKV एक लचीला प्रारूप है लेकिन हर डिवाइस या प्लेयर इसे सपोर्ट नहीं करता। MP4 लगभग हर जगह चलता है – फ़ोन, टीवी, कंसोल, एडिटिंग सॉफ़्टवेयर और ब्राउज़र।',
      },
      {
        q: 'क्या MKV से MP4 बदलने में गुणवत्ता घटेगी?',
        a: 'नहीं। EncodeX कंटेनर बदलते समय आपके वीडियो और ऑडियो की गुणवत्ता बरकरार रखता है।',
      },
      {
        q: 'क्या मैं एक साथ कई MKV फ़ाइलें बदल सकता हूँ?',
        a: 'हाँ। EncodeX MKV फ़ाइलों के पूरे फ़ोल्डर को MP4 में बैच कनवर्ट करने का समर्थन करता है।',
      },
    ],
    'convert/mp4-to-mkv': [
      {
        q: 'क्या MP4 से MKV बदलने पर गुणवत्ता घटती है?',
        a: 'नहीं। डिफ़ॉल्ट रूप से EncodeX मौजूदा वीडियो और ऑडियो स्ट्रीम को रीमक्स करता है, इसलिए गुणवत्ता बिल्कुल समान रहती है और रूपांतरण बहुत तेज़ है।',
      },
      {
        q: 'मैं MP4 के बजाय MKV क्यों चाहूँ?',
        a: 'MKV सॉफ्ट सबटाइटल्स, असीमित ऑडियो ट्रैक, अध्याय और अटैचमेंट फ़ाइलों का समर्थन करता है, जो इसे आर्काइविंग और मीडिया सर्वर के लिए पसंदीदा बनाता है।',
      },
      {
        q: 'क्या मैं एक साथ कई MP4 फ़ाइलें बदल सकता हूँ?',
        a: 'हाँ। EncodeX MP4 फ़ाइलों के पूरे फ़ोल्डर को MKV में बैच कनवर्ट करने का समर्थन करता है।',
      },
    ],
    'convert/mp4-to-webm': [
      {
        q: 'क्या मुझे MP4 को WebM में बदलना चाहिए?',
        a: 'यदि आप वेब पर पब्लिश कर रहे हैं, तो WebM आमतौर पर MP4 की तुलना में फ़ाइल आकार और प्रति-बिट गुणवत्ता में बेहतर होता है। पुराने प्लेयर्स के साथ अधिकतम संगतता के लिए MP4 रखें।',
      },
      {
        q: 'क्या MP4 से WebM बदलने में गुणवत्ता घटेगी?',
        a: 'WebM के VP9 और AV1 कोडेक अधिक कुशलता से एन्कोड करते हैं, इसलिए आपको आमतौर पर समान दृश्य गुणवत्ता पर एक छोटी फ़ाइल मिलती है।',
      },
      {
        q: 'क्या मैं एक साथ कई MP4 फ़ाइलें बदल सकता हूँ?',
        a: 'हाँ। EncodeX MP4 फ़ाइलों के पूरे फ़ोल्डर को WebM में बैच कनवर्ट करने का समर्थन करता है।',
      },
    ],
    'convert/mkv-to-webm': [
      {
        q: 'क्या मुझे MKV को WebM में बदलना चाहिए?',
        a: 'यदि आप वेब पर पब्लिश कर रहे हैं, तो WebM आमतौर पर MKV की तुलना में फ़ाइल आकार और प्रति-बिट गुणवत्ता में बेहतर होता है। MKV आर्काइव का बेहतरीन प्रारूप है, लेकिन ब्राउज़र और स्ट्रीमिंग साइटें WebM पसंद करती हैं।',
      },
      {
        q: 'क्या MKV से WebM बदलने में गुणवत्ता घटेगी?',
        a: 'WebM के VP9 और AV1 कोडेक अधिक कुशलता से एन्कोड करते हैं, इसलिए आपको आमतौर पर समान दृश्य गुणवत्ता पर एक छोटी फ़ाइल मिलती है।',
      },
      {
        q: 'क्या मैं एक साथ कई MKV फ़ाइलें बदल सकता हूँ?',
        a: 'हाँ। EncodeX MKV फ़ाइलों के पूरे फ़ोल्डर को WebM में बैच कनवर्ट करने का समर्थन करता है।',
      },
    ],
    'convert/mov-to-mkv': [
      {
        q: 'क्या MOV से MKV बदलने पर गुणवत्ता घटती है?',
        a: 'नहीं। डिफ़ॉल्ट रूप से EncodeX मौजूदा वीडियो और ऑडियो स्ट्रीम को रीमक्स करता है, इसलिए गुणवत्ता बिल्कुल समान रहती है और रूपांतरण बहुत तेज़ है।',
      },
      {
        q: 'मैं MOV के बजाय MKV क्यों चाहूँ?',
        a: 'MKV सॉफ्ट सबटाइटल्स, असीमित ऑडियो ट्रैक, अध्याय और अटैचमेंट फ़ाइलों वाला पूरी तरह से खुला प्रारूप है – Apple के बंद MOV कंटेनर की तुलना में आर्काइविंग और मीडिया सर्वर के लिए बेहतर।',
      },
      {
        q: 'क्या मैं एक साथ कई MOV फ़ाइलें बदल सकता हूँ?',
        a: 'हाँ। EncodeX MOV फ़ाइलों के पूरे फ़ोल्डर को MKV में बैच कनवर्ट करने का समर्थन करता है।',
      },
    ],
    'convert/webm-to-mkv': [
      {
        q: 'मुझे WebM को MKV में क्यों बदलना चाहिए?',
        a: 'WebM वेब के लिए बनाया गया है, लेकिन MKV एक अधिक लचीला कंटेनर है जो सॉफ्ट सबटाइटल्स, असीमित ऑडियो ट्रैक, अध्याय और अटैचमेंट फ़ाइलों का समर्थन करता है, जिससे यह आर्काइविंग और मीडिया सर्वर के लिए बेहतरीन बनता है।',
      },
      {
        q: 'क्या WebM से MKV बदलने में गुणवत्ता घटेगी?',
        a: 'नहीं। EncodeX कंटेनर बदलते समय आपके वीडियो और ऑडियो की गुणवत्ता बरकरार रखता है।',
      },
      {
        q: 'क्या मैं एक साथ कई WebM फ़ाइलें बदल सकता हूँ?',
        a: 'हाँ। EncodeX WebM फ़ाइलों के पूरे फ़ोल्डर को MKV में बैच कनवर्ट करने का समर्थन करता है।',
      },
    ],
    'convert/avi-to-mkv': [
      {
        q: 'मुझे AVI को MKV में क्यों बदलना चाहिए?',
        a: 'AVI एक पुराना प्रारूप है जो बड़ी और अक्सर असंगत फ़ाइलें बनाता है। MKV सबटाइटल्स, कई ऑडियो ट्रैक और अध्यायों वाला आधुनिक, खुला कंटेनर है, और यह आज के प्लेयर्स और मीडिया सर्वर पर शानदार चलता है।',
      },
      {
        q: 'क्या AVI से MKV बदलने में गुणवत्ता घटेगी?',
        a: 'नहीं। EncodeX कंटेनर बदलते समय आपके वीडियो और ऑडियो की गुणवत्ता बरकरार रखता है।',
      },
      {
        q: 'क्या मैं एक साथ कई AVI फ़ाइलें बदल सकता हूँ?',
        a: 'हाँ। EncodeX AVI फ़ाइलों के पूरे फ़ोल्डर को MKV में बैच कनवर्ट करने का समर्थन करता है।',
      },
    ],
    'convert/flv-to-mkv': [
      {
        q: 'मुझे FLV को MKV में क्यों बदलना चाहिए?',
        a: 'FLV Flash-युग का प्रारूप है जो ज़्यादातर पुराने वेब वीडियो में उपयोग होता है। MKV एक आधुनिक, खुला कंटेनर है जो ऑडियो, सबटाइटल्स और अध्यायों को एक साथ रखता है और आज के प्लेयर्स और मीडिया सर्वर पर चलता है।',
      },
      {
        q: 'क्या FLV से MKV बदलने में गुणवत्ता घटेगी?',
        a: 'नहीं। EncodeX कंटेनर बदलते समय आपके वीडियो और ऑडियो की गुणवत्ता बरकरार रखता है।',
      },
      {
        q: 'क्या मैं एक साथ कई FLV फ़ाइलें बदल सकता हूँ?',
        a: 'हाँ। EncodeX FLV फ़ाइलों के पूरे फ़ोल्डर को MKV में बैच कनवर्ट करने का समर्थन करता है।',
      },
    ],
    'convert/wmv-to-mkv': [
      {
        q: 'मुझे WMV को MKV में क्यों बदलना चाहिए?',
        a: 'WMV Microsoft का प्रारूप है जो ज़्यादातर Windows से जुड़ा है। MKV सबटाइटल्स, असीमित ऑडियो ट्रैक और अध्यायों वाला खुला, व्यापक रूप से समर्थित कंटेनर है, जो आर्काइविंग और मीडिया सर्वर के लिए आदर्श है।',
      },
      {
        q: 'क्या WMV से MKV बदलने में गुणवत्ता घटेगी?',
        a: 'नहीं। EncodeX कंटेनर बदलते समय आपके वीडियो और ऑडियो की गुणवत्ता बरकरार रखता है।',
      },
      {
        q: 'क्या मैं एक साथ कई WMV फ़ाइलें बदल सकता हूँ?',
        a: 'हाँ। EncodeX WMV फ़ाइलों के पूरे फ़ोल्डर को MKV में बैच कनवर्ट करने का समर्थन करता है।',
      },
    ],
    'convert/mp4-to-mp3': [
      {
        q: 'मुझे MP4 को MP3 में क्यों बदलना चाहिए?',
        a: 'MP4 एक वीडियो प्रारूप है, लेकिन कभी-कभी आपको सिर्फ़ ऑडियो चाहिए होता है। MP3 हर फ़ोन, कार स्टीरियो, स्मार्ट स्पीकर और एडिटिंग टूल पर चलता है, और केवल-ऑडियो फ़ाइल बहुत छोटी होती है।',
      },
      {
        q: 'क्या MP4 से MP3 बदलने में ऑडियो गुणवत्ता घटेगी?',
        a: 'MP3 एक लॉसी प्रारूप है, लेकिन EncodeX मूल ऑडियो ट्रैक पढ़ता है और आपके चुने गए सेटिंग्स के साथ एन्कोड करता है। लगभग लॉसलेस ध्वनि के लिए 320 kbps उपयोग करें।',
      },
      {
        q: 'क्या मैं एक साथ कई MP4 फ़ाइलें बदल सकता हूँ?',
        a: 'हाँ। EncodeX MP4 फ़ाइलों के पूरे फ़ोल्डर को MP3 में बैच कनवर्ट करने का समर्थन करता है।',
      },
    ],
    'convert/mkv-to-mp3': [
      {
        q: 'मुझे MKV को MP3 में क्यों बदलना चाहिए?',
        a: 'MKV एक वीडियो कंटेनर है, लेकिन इसके ऑडियो ट्रैक अक्सर वही होते हैं जो आप चाहते हैं। MKV को MP3 में बदलने से ध्वनि एक छोटी फ़ाइल में निकलती है जो हर डिवाइस पर चलती है।',
      },
      {
        q: 'क्या MKV से MP3 बदलने में ऑडियो गुणवत्ता घटेगी?',
        a: 'MP3 एक लॉसी प्रारूप है, लेकिन EncodeX मूल ऑडियो ट्रैक पढ़ता है और आपके चुने गए सेटिंग्स के साथ एन्कोड करता है। लगभग लॉसलेस ध्वनि के लिए 320 kbps उपयोग करें।',
      },
      {
        q: 'क्या मैं एक साथ कई MKV फ़ाइलें बदल सकता हूँ?',
        a: 'हाँ। EncodeX MKV फ़ाइलों के पूरे फ़ोल्डर को MP3 में बैच कनवर्ट करने का समर्थन करता है।',
      },
    ],
    'convert/mov-to-mp3': [
      {
        q: 'मुझे MOV को MP3 में क्यों बदलना चाहिए?',
        a: 'MOV Apple का वीडियो प्रारूप है, लेकिन कभी-कभी आपको सिर्फ़ साउंडट्रैक चाहिए। MOV को MP3 में बदलने से आपको ऑडियो ऐसी फ़ाइल में मिलता है जो हर फ़ोन, कार स्टीरियो और प्लेयर पर काम करती है।',
      },
      {
        q: 'क्या MOV से MP3 बदलने में ऑडियो गुणवत्ता घटेगी?',
        a: 'MP3 एक लॉसी प्रारूप है, लेकिन EncodeX मूल ऑडियो ट्रैक पढ़ता है और आपके चुने गए सेटिंग्स के साथ एन्कोड करता है। लगभग लॉसलेस ध्वनि के लिए 320 kbps उपयोग करें।',
      },
      {
        q: 'क्या मैं एक साथ कई MOV फ़ाइलें बदल सकता हूँ?',
        a: 'हाँ। EncodeX MOV फ़ाइलों के पूरे फ़ोल्डर को MP3 में बैच कनवर्ट करने का समर्थन करता है।',
      },
    ],
  },
};

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
      MermaidMarkdown(md);
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
  sitemap: {
    hostname: 'https://encodex.in',
    transformItems(items) {
      const noIndexLocaleDocs = /^(?:de|es|fr|hi|pt|zh)\/docs\//;
      const withTrailingSlash = (url: string) => {
        if (!url || url.endsWith('/')) return url;
        return `${url}/`;
      };
      return items
        .filter((item) => item.url !== '404' && !noIndexLocaleDocs.test(item.url))
        .map((item) => ({
          ...item,
          url: withTrailingSlash(item.url),
          links: item.links?.map((link) => ({ ...link, url: withTrailingSlash(link.url) })),
        }));
    },
  },
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
    const head: [string, Record<string, string | boolean>][] = [];
    const pagePath = context.pageData?.relativePath || '';
    const frontmatter = context.pageData?.frontmatter || {};

    if (context.pageData?.isNotFound || context.pageData?.relativePath === '404.md') {
      head.push(['meta', { name: 'robots', content: 'noindex' }]);
      return head;
    }

    const pageLang = detectLocaleFromPath(pagePath);
    const localePrefix = detectLocalePrefix(pagePath);
    const cleanPath = localePrefix ? pagePath.slice(localePrefix.length) : pagePath;

    let pageSlug = cleanPath.replace(/^\/+/, '').replace(/\.md$/, '');
    const isHome = pageSlug === 'index';
    const isDirIndex = !isHome && pageSlug.endsWith('/index');
    if (isHome) pageSlug = '';
    if (isDirIndex) pageSlug = pageSlug.slice(0, -'/index'.length);

    const localeBase = localePrefix ? `${localePrefix}/` : '';
    const canonicalUrl = pageSlug ? `${SITE_URL}/${localeBase}${pageSlug}/` : `${SITE_URL}/${localeBase}`;

    if (localePrefix && pageSlug.startsWith('docs/')) {
      head.push(['meta', { name: 'robots', content: 'noindex' }]);
    }

    head.push(['link', { rel: 'canonical', href: canonicalUrl }]);

    const siteTitle = context.siteConfig?.title || 'EncodeX';
    const siteDescription = context.siteData?.description || context.siteConfig?.description || '';
    const pageTitle = frontmatter.title
      ? `${frontmatter.title} | ${siteTitle}`
      : `${siteTitle} — Free, Open-Source FFmpeg GUI for Windows, macOS & Linux`;
    const pageDescription = frontmatter.description || siteDescription;
    const pageOgImage = frontmatter.ogImage || `${SITE_URL}/images/banner.webp`;

    head.push(['meta', { property: 'og:title', content: pageTitle }]);
    head.push(['meta', { property: 'og:description', content: pageDescription }]);
    head.push(['meta', { property: 'og:url', content: canonicalUrl }]);
    head.push(['meta', { property: 'og:image', content: pageOgImage }]);
    head.push(['meta', { property: 'og:locale', content: pageLang.replace('-', '_') }]);
    head.push(['meta', { property: 'og:site_name', content: 'EncodeX' }]);

    head.push(['meta', { name: 'twitter:card', content: 'summary_large_image' }]);
    head.push(['meta', { name: 'twitter:title', content: pageTitle }]);
    head.push(['meta', { name: 'twitter:description', content: pageDescription }]);
    head.push(['meta', { name: 'twitter:image', content: pageOgImage }]);

    const localeEntries = Object.entries(localeLangMap);
    for (const [prefix, hreflang] of localeEntries) {
      const base = prefix ? `${prefix}/` : '';
      const href = pageSlug ? `${SITE_URL}/${base}${pageSlug}/` : `${SITE_URL}/${base}`;
      head.push(['link', { rel: 'alternate', hreflang, href }]);
    }
    head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: pageSlug ? `${SITE_URL}/${pageSlug}/` : `${SITE_URL}/` }]);

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
        softwareVersion: SITE_VERSION,
        fileFormat: ['MP4', 'MKV', 'AVI', 'MOV', 'WebM', 'MP3', 'FLAC', 'WAV', 'PNG', 'JPG', 'WebP'],
      };
      head.push(['script', { type: 'application/ld+json' }, JSON.stringify(jsonLd)]);
    }

    if (pageSlug.startsWith('blog/releases/') && frontmatter.date) {
      const articleJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: frontmatter.title || pageTitle,
        description: pageDescription,
        datePublished: frontmatter.date,
        dateModified: frontmatter.updated || frontmatter.date,
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
      };
      head.push(['script', { type: 'application/ld+json' }, JSON.stringify(articleJsonLd)]);
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
      'convert/mkv-to-webm': 'MKV to WebM Converter',
      'convert/mov-to-mkv': 'MOV to MKV Converter',
      'convert/webm-to-mkv': 'WebM to MKV Converter',
      'convert/avi-to-mkv': 'AVI to MKV Converter',
      'convert/flv-to-mkv': 'FLV to MKV Converter',
      'convert/wmv-to-mkv': 'WMV to MKV Converter',
      'convert/mp4-to-mp3': 'MP4 to MP3 Converter',
      'convert/mkv-to-mp3': 'MKV to MP3 Converter',
      'convert/mov-to-mp3': 'MOV to MP3 Converter',
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
    };

    const seoLandingPagesTranslations: Record<string, Record<string, string>> = {
      es: {
        'ffmpeg-gui': 'FFmpeg GUI',
        'video-converter': 'Convertidor de Video',
        'video-compressor': 'Compresor de Video',
        'audio-converter': 'Convertidor de Audio',
        'extract-audio-from-video': 'Extraer Audio de Video',
        'ffmpeg-gui/windows': 'FFmpeg GUI para Windows',
        'ffmpeg-gui/macos': 'FFmpeg GUI para Mac',
        'ffmpeg-gui/linux': 'FFmpeg GUI para Linux',
        'convert/mkv-to-mp4': 'Convertidor MKV a MP4',
        'convert/mov-to-mp4': 'Convertidor MOV a MP4',
        'convert/avi-to-mp4': 'Convertidor AVI a MP4',
        'convert/flv-to-mp4': 'Convertidor FLV a MP4',
        'convert/wmv-to-mp4': 'Convertidor WMV a MP4',
        'convert/m4v-to-mp4': 'Convertidor M4V a MP4',
        'convert/webm-to-mp4': 'Convertidor WebM a MP4',
        'convert/mp4-to-mkv': 'Convertidor MP4 a MKV',
        'convert/mp4-to-webm': 'Convertidor MP4 a WebM',
        'convert/mkv-to-webm': 'Convertidor MKV a WebM',
        'convert/mov-to-mkv': 'Convertidor MOV a MKV',
        'convert/webm-to-mkv': 'Convertidor WebM a MKV',
        'convert/avi-to-mkv': 'Convertidor AVI a MKV',
        'convert/flv-to-mkv': 'Convertidor FLV a MKV',
        'convert/wmv-to-mkv': 'Convertidor WMV a MKV',
        'convert/mp4-to-mp3': 'Convertidor MP4 a MP3',
        'convert/mkv-to-mp3': 'Convertidor MKV a MP3',
        'convert/mov-to-mp3': 'Convertidor MOV a MP3',
        'codecs/h264': 'Codificador H.264',
        'codecs/h265': 'Codificador H.265 / HEVC',
        'codecs/av1': 'Codificador AV1',
        'codecs/vp9': 'Codificador VP9',
        'codecs/prores': 'Convertidor ProRes',
        'compress/mp4': 'Comprimir Videos MP4',
        'compress/mkv': 'Comprimir Videos MKV',
        'extract/mp3-from-video': 'Extraer MP3 de Video',
        'extract/wav-from-video': 'Extraer WAV de Video',
        'platforms/windows': 'EncodeX para Windows',
        'platforms/mac': 'EncodeX para Mac',
        'platforms/linux': 'EncodeX para Linux',
        cli: 'EncodeX CLI',
        'handbrake-alternative': 'Alternativa a HandBrake',
        privacy: 'Política de Privacidad',
        'use-cases': 'Casos de Uso',
        'learn/what-is-ffmpeg': 'Qué es FFmpeg',
      },
      fr: {
        'ffmpeg-gui': 'FFmpeg GUI',
        'video-converter': 'Convertisseur Vidéo',
        'video-compressor': 'Compresseur Vidéo',
        'audio-converter': 'Convertisseur Audio',
        'extract-audio-from-video': 'Extraire l\u2019Audio d\u2019une Vidéo',
        'ffmpeg-gui/windows': 'FFmpeg GUI pour Windows',
        'ffmpeg-gui/macos': 'FFmpeg GUI pour Mac',
        'ffmpeg-gui/linux': 'FFmpeg GUI pour Linux',
        'convert/mkv-to-mp4': 'Convertisseur MKV en MP4',
        'convert/mov-to-mp4': 'Convertisseur MOV en MP4',
        'convert/avi-to-mp4': 'Convertisseur AVI en MP4',
        'convert/flv-to-mp4': 'Convertisseur FLV en MP4',
        'convert/wmv-to-mp4': 'Convertisseur WMV en MP4',
        'convert/m4v-to-mp4': 'Convertisseur M4V en MP4',
        'convert/webm-to-mp4': 'Convertisseur WebM en MP4',
        'convert/mp4-to-mkv': 'Convertisseur MP4 en MKV',
        'convert/mp4-to-webm': 'Convertisseur MP4 en WebM',
        'convert/mkv-to-webm': 'Convertisseur MKV en WebM',
        'convert/mov-to-mkv': 'Convertisseur MOV en MKV',
        'convert/webm-to-mkv': 'Convertisseur WebM en MKV',
        'convert/avi-to-mkv': 'Convertisseur AVI en MKV',
        'convert/flv-to-mkv': 'Convertisseur FLV en MKV',
        'convert/wmv-to-mkv': 'Convertisseur WMV en MKV',
        'convert/mp4-to-mp3': 'Convertisseur MP4 en MP3',
        'convert/mkv-to-mp3': 'Convertisseur MKV en MP3',
        'convert/mov-to-mp3': 'Convertisseur MOV en MP3',
        'codecs/h264': 'Codec H.264',
        'codecs/h265': 'Codec H.265 / HEVC',
        'codecs/av1': 'Codec AV1',
        'codecs/vp9': 'Codec VP9',
        'codecs/prores': 'Convertisseur ProRes',
        'compress/mp4': 'Compresser les Vidéos MP4',
        'compress/mkv': 'Compresser les Vidéos MKV',
        'extract/mp3-from-video': 'Extraire du MP3 d\u2019une Vidéo',
        'extract/wav-from-video': 'Extraire du WAV d\u2019une Vidéo',
        'platforms/windows': 'EncodeX pour Windows',
        'platforms/mac': 'EncodeX pour Mac',
        'platforms/linux': 'EncodeX pour Linux',
        cli: 'EncodeX CLI',
        'handbrake-alternative': 'Alternative à HandBrake',
        privacy: 'Politique de Confidentialité',
        'use-cases': 'Cas d\u2019Usage',
        'learn/what-is-ffmpeg': 'Qu\u2019est-ce que FFmpeg',
      },
      de: {
        'ffmpeg-gui': 'FFmpeg GUI',
        'video-converter': 'Video-Konverter',
        'video-compressor': 'Video-Kompressor',
        'audio-converter': 'Audio-Konverter',
        'extract-audio-from-video': 'Audio aus Video Extrahieren',
        'ffmpeg-gui/windows': 'FFmpeg GUI für Windows',
        'ffmpeg-gui/macos': 'FFmpeg GUI für Mac',
        'ffmpeg-gui/linux': 'FFmpeg GUI für Linux',
        'convert/mkv-to-mp4': 'MKV-zu-MP4-Konverter',
        'convert/mov-to-mp4': 'MOV-zu-MP4-Konverter',
        'convert/avi-to-mp4': 'AVI-zu-MP4-Konverter',
        'convert/flv-to-mp4': 'FLV-zu-MP4-Konverter',
        'convert/wmv-to-mp4': 'WMV-zu-MP4-Konverter',
        'convert/m4v-to-mp4': 'M4V-zu-MP4-Konverter',
        'convert/webm-to-mp4': 'WebM-zu-MP4-Konverter',
        'convert/mp4-to-mkv': 'MP4-zu-MKV-Konverter',
        'convert/mp4-to-webm': 'MP4-zu-WebM-Konverter',
        'convert/mkv-to-webm': 'MKV-zu-WebM-Konverter',
        'convert/mov-to-mkv': 'MOV-zu-MKV-Konverter',
        'convert/webm-to-mkv': 'WebM-zu-MKV-Konverter',
        'convert/avi-to-mkv': 'AVI-zu-MKV-Konverter',
        'convert/flv-to-mkv': 'FLV-zu-MKV-Konverter',
        'convert/wmv-to-mkv': 'WMV-zu-MKV-Konverter',
        'convert/mp4-to-mp3': 'MP4-zu-MP3-Konverter',
        'convert/mkv-to-mp3': 'MKV-zu-MP3-Konverter',
        'convert/mov-to-mp3': 'MOV-zu-MP3-Konverter',
        'codecs/h264': 'H.264-Encoder & Konverter',
        'codecs/h265': 'H.265-/HEVC-Encoder & Konverter',
        'codecs/av1': 'AV1-Encoder & Konverter',
        'codecs/vp9': 'VP9-Encoder & Konverter',
        'codecs/prores': 'ProRes-Konverter',
        'compress/mp4': 'MP4-Videos Komprimieren',
        'compress/mkv': 'MKV-Videos Komprimieren',
        'extract/mp3-from-video': 'MP3 aus Video Extrahieren',
        'extract/wav-from-video': 'WAV aus Video Extrahieren',
        'platforms/windows': 'EncodeX für Windows',
        'platforms/mac': 'EncodeX für Mac',
        'platforms/linux': 'EncodeX für Linux',
        cli: 'EncodeX CLI',
        'handbrake-alternative': 'HandBrake-Alternative',
        privacy: 'Datenschutzerklärung',
        'use-cases': 'Anwendungsfälle',
        'learn/what-is-ffmpeg': 'Was ist FFmpeg',
      },
      pt: {
        'ffmpeg-gui': 'FFmpeg GUI',
        'video-converter': 'Conversor de Vídeo',
        'video-compressor': 'Compressor de Vídeo',
        'audio-converter': 'Conversor de Áudio',
        'extract-audio-from-video': 'Extrair Áudio de Vídeo',
        'ffmpeg-gui/windows': 'FFmpeg GUI para Windows',
        'ffmpeg-gui/macos': 'FFmpeg GUI para Mac',
        'ffmpeg-gui/linux': 'FFmpeg GUI para Linux',
        'convert/mkv-to-mp4': 'Conversor MKV para MP4',
        'convert/mov-to-mp4': 'Conversor MOV para MP4',
        'convert/avi-to-mp4': 'Conversor AVI para MP4',
        'convert/flv-to-mp4': 'Conversor FLV para MP4',
        'convert/wmv-to-mp4': 'Conversor WMV para MP4',
        'convert/m4v-to-mp4': 'Conversor M4V para MP4',
        'convert/webm-to-mp4': 'Conversor WebM para MP4',
        'convert/mp4-to-mkv': 'Conversor MP4 para MKV',
        'convert/mp4-to-webm': 'Conversor MP4 para WebM',
        'convert/mkv-to-webm': 'Conversor MKV para WebM',
        'convert/mov-to-mkv': 'Conversor MOV para MKV',
        'convert/webm-to-mkv': 'Conversor WebM para MKV',
        'convert/avi-to-mkv': 'Conversor AVI para MKV',
        'convert/flv-to-mkv': 'Conversor FLV para MKV',
        'convert/wmv-to-mkv': 'Conversor WMV para MKV',
        'convert/mp4-to-mp3': 'Conversor MP4 para MP3',
        'convert/mkv-to-mp3': 'Conversor MKV para MP3',
        'convert/mov-to-mp3': 'Conversor MOV para MP3',
        'codecs/h264': 'Codificador H.264',
        'codecs/h265': 'Codificador H.265 / HEVC',
        'codecs/av1': 'Codificador AV1',
        'codecs/vp9': 'Codificador VP9',
        'codecs/prores': 'Conversor ProRes',
        'compress/mp4': 'Comprimir Vídeos MP4',
        'compress/mkv': 'Comprimir Vídeos MKV',
        'extract/mp3-from-video': 'Extrair MP3 de Vídeo',
        'extract/wav-from-video': 'Extrair WAV de Vídeo',
        'platforms/windows': 'EncodeX para Windows',
        'platforms/mac': 'EncodeX para Mac',
        'platforms/linux': 'EncodeX para Linux',
        cli: 'EncodeX CLI',
        'handbrake-alternative': 'Alternativa ao HandBrake',
        privacy: 'Política de Privacidade',
        'use-cases': 'Casos de Uso',
        'learn/what-is-ffmpeg': 'O que é FFmpeg',
      },
      zh: {
        'ffmpeg-gui': 'FFmpeg GUI',
        'video-converter': '视频转换器',
        'video-compressor': '视频压缩器',
        'audio-converter': '音频转换器',
        'extract-audio-from-video': '从视频中提取音频',
        'ffmpeg-gui/windows': '适用于 Windows 的 FFmpeg GUI',
        'ffmpeg-gui/macos': '适用于 Mac 的 FFmpeg GUI',
        'ffmpeg-gui/linux': '适用于 Linux 的 FFmpeg GUI',
        'convert/mkv-to-mp4': 'MKV 转 MP4 转换器',
        'convert/mov-to-mp4': 'MOV 转 MP4 转换器',
        'convert/avi-to-mp4': 'AVI 转 MP4 转换器',
        'convert/flv-to-mp4': 'FLV 转 MP4 转换器',
        'convert/wmv-to-mp4': 'WMV 转 MP4 转换器',
        'convert/m4v-to-mp4': 'M4V 转 MP4 转换器',
        'convert/webm-to-mp4': 'WebM 转 MP4 转换器',
        'convert/mp4-to-mkv': 'MP4 转 MKV 转换器',
        'convert/mp4-to-webm': 'MP4 转 WebM 转换器',
        'convert/mkv-to-webm': 'MKV 转 WebM 转换器',
        'convert/mov-to-mkv': 'MOV 转 MKV 转换器',
        'convert/webm-to-mkv': 'WebM 转 MKV 转换器',
        'convert/avi-to-mkv': 'AVI 转 MKV 转换器',
        'convert/flv-to-mkv': 'FLV 转 MKV 转换器',
        'convert/wmv-to-mkv': 'WMV 转 MKV 转换器',
        'convert/mp4-to-mp3': 'MP4 转 MP3 转换器',
        'convert/mkv-to-mp3': 'MKV 转 MP3 转换器',
        'convert/mov-to-mp3': 'MOV 转 MP3 转换器',
        'codecs/h264': 'H.264 编码器与转换器',
        'codecs/h265': 'H.265/HEVC 编码器与转换器',
        'codecs/av1': 'AV1 编码器与转换器',
        'codecs/vp9': 'VP9 编码器与转换器',
        'codecs/prores': 'ProRes 转换器',
        'compress/mp4': '压缩 MP4 视频',
        'compress/mkv': '压缩 MKV 视频',
        'extract/mp3-from-video': '从视频中提取 MP3',
        'extract/wav-from-video': '从视频中提取 WAV',
        'platforms/windows': '适用于 Windows 的 EncodeX',
        'platforms/mac': '适用于 Mac 的 EncodeX',
        'platforms/linux': '适用于 Linux 的 EncodeX',
        cli: 'EncodeX CLI',
        'handbrake-alternative': 'HandBrake 替代品',
        privacy: '隐私政策',
        'use-cases': '使用场景',
        'learn/what-is-ffmpeg': '什么是 FFmpeg',
      },
      hi: {
        'ffmpeg-gui': 'FFmpeg GUI',
        'video-converter': 'वीडियो कनवर्टर',
        'video-compressor': 'वीडियो कंप्रेसर',
        'audio-converter': 'ऑडियो कनवर्टर',
        'extract-audio-from-video': 'वीडियो से ऑडियो निकालें',
        'ffmpeg-gui/windows': 'Windows के लिए FFmpeg GUI',
        'ffmpeg-gui/macos': 'Mac के लिए FFmpeg GUI',
        'ffmpeg-gui/linux': 'Linux के लिए FFmpeg GUI',
        'convert/mkv-to-mp4': 'MKV से MP4 कनवर्टर',
        'convert/mov-to-mp4': 'MOV से MP4 कनवर्टर',
        'convert/avi-to-mp4': 'AVI से MP4 कनवर्टर',
        'convert/flv-to-mp4': 'FLV से MP4 कनवर्टर',
        'convert/wmv-to-mp4': 'WMV से MP4 कनवर्टर',
        'convert/m4v-to-mp4': 'M4V से MP4 कनवर्टर',
        'convert/webm-to-mp4': 'WebM से MP4 कनवर्टर',
        'convert/mp4-to-mkv': 'MP4 से MKV कनवर्टर',
        'convert/mp4-to-webm': 'MP4 से WebM कनवर्टर',
        'convert/mkv-to-webm': 'MKV से WebM कनवर्टर',
        'convert/mov-to-mkv': 'MOV से MKV कनवर्टर',
        'convert/webm-to-mkv': 'WebM से MKV कनवर्टर',
        'convert/avi-to-mkv': 'AVI से MKV कनवर्टर',
        'convert/flv-to-mkv': 'FLV से MKV कनवर्टर',
        'convert/wmv-to-mkv': 'WMV से MKV कनवर्टर',
        'convert/mp4-to-mp3': 'MP4 से MP3 कनवर्टर',
        'convert/mkv-to-mp3': 'MKV से MP3 कनवर्टर',
        'convert/mov-to-mp3': 'MOV से MP3 कनवर्टर',
        'codecs/h264': 'H.264 एन्कोडर और कनवर्टर',
        'codecs/h265': 'H.265/HEVC एन्कोडर और कनवर्टर',
        'codecs/av1': 'AV1 एन्कोडर और कनवर्टर',
        'codecs/vp9': 'VP9 एन्कोडर और कनवर्टर',
        'codecs/prores': 'ProRes कनवर्टर',
        'compress/mp4': 'MP4 वीडियो कंप्रेस करें',
        'compress/mkv': 'MKV वीडियो कंप्रेस करें',
        'extract/mp3-from-video': 'वीडियो से MP3 निकालें',
        'extract/wav-from-video': 'वीडियो से WAV निकालें',
        'platforms/windows': 'Windows के लिए EncodeX',
        'platforms/mac': 'Mac के लिए EncodeX',
        'platforms/linux': 'Linux के लिए EncodeX',
        cli: 'EncodeX CLI',
        'handbrake-alternative': 'HandBrake विकल्प',
        privacy: 'गोपनीयता नीति',
        'use-cases': 'उपयोग के मामले',
        'learn/what-is-ffmpeg': 'FFmpeg क्या है',
      },
    };

    const homeNames: Record<string, string> = {
      en: 'Home',
      es: 'Inicio',
      fr: 'Accueil',
      de: 'Startseite',
      pt: 'Início',
      zh: '首页',
      hi: 'होम',
    };

    const landingPagesSource = localePrefix ? seoLandingPagesTranslations[localePrefix] || seoLandingPages : seoLandingPages;

    if (landingPagesSource[pageSlug]) {
      const homeName = localePrefix ? homeNames[localePrefix] || 'Home' : 'Home';
      const crumbs = [
        { '@type': 'ListItem', position: 1, name: homeName, item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: landingPagesSource[pageSlug], item: canonicalUrl },
      ];
      const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs,
      };
      head.push([
        'script',
        {
          type: 'application/ld+json',
        },
        JSON.stringify(breadcrumbJsonLd),
      ]);
    }

    const faqSource = localePrefix ? seoFAQTranslations[localePrefix]?.[pageSlug] || seoFAQ[pageSlug] : seoFAQ[pageSlug] || null;

    if (faqSource && faqSource.length) {
      const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqSource.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      };
      head.push(['script', { type: 'application/ld+json' }, JSON.stringify(faqJsonLd)]);
    }

    const howToSource = localePrefix ? seoHowToTranslations[localePrefix]?.[pageSlug] || seoHowTo[pageSlug] : seoHowTo[pageSlug];

    if (howToSource) {
      const howToJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: howToSource.name,
        step: howToSource.steps.map((step, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: step.name,
          text: step.text,
        })),
      };
      head.push(['script', { type: 'application/ld+json' }, JSON.stringify(howToJsonLd)]);
    }

    return head;
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
        'Una app gratuita y fácil de usar para convertir vídeos y audio, recortar clips, extraer música de vídeos y reducir el tamaño de tus fotos. Incluye un servidor MCP integrado para asistentes de IA.',
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
        'Une application gratuite et simple pour convertir vidéos et audio, couper des clips, extraire la musique d\u2019une vidéo et alléger vos photos. Inclut un serveur MCP intégré pour les assistants IA.',
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
        'Eine kostenlose, einfach zu bedienende App zum Konvertieren von Videos und Audio, Trimmen von Clips, Extrahieren von Musik aus Videos und Verkleinern von Fotos. Enthält einen integrierten MCP-Server für KI-Assistenten.',
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
        'Um aplicativo gratuito e fácil de usar para converter vídeos e áudio, cortar clipes, extrair música de vídeos e reduzir o tamanho das fotos. Inclui um servidor MCP integrado para assistentes de IA.',
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
        '一款免费易用的应用：转换视频和音频、剪辑片段、从视频中提取音乐、压缩照片。支持 Windows、Mac 和 Linux。内置 MCP 服务器，可供 AI 助手调用。',
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
        'वीडियो और ऑडियो बदलने, क्लिप ट्रिम करने, वीडियो से म्यूज़िक निकालने और फ़ोटो छोटी करने के लिए एक मुफ़्त, आसान ऐप। Windows, Mac और Linux पर उपलब्ध। AI सहायकों के लिए अंतर्निहित MCP सर्वर शामिल है।',
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
    socialLinks: [{ icon: 'github', link: 'https://github.com/Sandeepv68/EncodeX' }],
    search: {
      provider: 'local',
    },
  },
});
