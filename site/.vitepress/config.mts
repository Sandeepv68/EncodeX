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
    whatFormatLabel: string;
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
    whatFormatLabel: 'What format should I choose?',
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
    whatFormatLabel: '¿Qué formato elegir?',
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
    whatFormatLabel: 'Quel format choisir ?',
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
    whatFormatLabel: 'Welches Format wählen?',
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
    whatFormatLabel: 'Qual formato escolher?',
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
    whatFormatLabel: '该选什么格式？',
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
    whatFormatLabel: 'कौन सा फ़ॉर्मैट चुनें?',
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
          { text: s.whatFormatLabel, link: `${p}/learn/what-format-to-use` },
          { text: s.handbrakeAlt, link: `${p}/handbrake-alternative` },
        ],
      },
    ],
  };
}

const navStrings: Record<
  string,
  {
    product: string;
    resources: string;
    community: string;
    features: string;
    useCases: string;
    download: string;
    docs: string;
    blog: string;
    contributing: string;
    github: string;
    mcp: string;
  }
> = {
  en: {
    product: 'Product',
    resources: 'Resources',
    community: 'Community',
    features: 'Features',
    useCases: 'Use Cases',
    download: 'Download',
    docs: 'Docs',
    blog: 'Blog',
    contributing: 'Contributing',
    github: 'GitHub',
    mcp: 'MCP Server',
  },
  es: {
    product: 'Producto',
    resources: 'Recursos',
    community: 'Comunidad',
    features: 'Características',
    useCases: 'Casos de uso',
    download: 'Descargar',
    docs: 'Documentación',
    blog: 'Blog',
    contributing: 'Contribuir',
    github: 'GitHub',
    mcp: 'Servidor MCP',
  },
  fr: {
    product: 'Produit',
    resources: 'Ressources',
    community: 'Communauté',
    features: 'Fonctionnalités',
    useCases: "Cas d'usage",
    download: 'Télécharger',
    docs: 'Documentation',
    blog: 'Blog',
    contributing: 'Contribuer',
    github: 'GitHub',
    mcp: 'Serveur MCP',
  },
  de: {
    product: 'Produkt',
    resources: 'Ressourcen',
    community: 'Community',
    features: 'Funktionen',
    useCases: 'Anwendungsfälle',
    download: 'Download',
    docs: 'Dokumentation',
    blog: 'Blog',
    contributing: 'Mitwirken',
    github: 'GitHub',
    mcp: 'MCP-Server',
  },
  pt: {
    product: 'Produto',
    resources: 'Recursos',
    community: 'Comunidade',
    features: 'Recursos',
    useCases: 'Casos de uso',
    download: 'Download',
    docs: 'Documentação',
    blog: 'Blog',
    contributing: 'Contribuir',
    github: 'GitHub',
    mcp: 'Servidor MCP',
  },
  zh: {
    product: '产品',
    resources: '资源',
    community: '社区',
    features: '功能特性',
    useCases: '使用场景',
    download: '下载',
    docs: '技术文档',
    blog: '博客',
    contributing: '参与贡献',
    github: 'GitHub',
    mcp: 'MCP 服务器',
  },
  hi: {
    product: 'उत्पाद',
    resources: 'संसाधन',
    community: 'समुदाय',
    features: 'फ़ीचर्स',
    useCases: 'उपयोग के मामले',
    download: 'डाउनलोड',
    docs: 'दस्तावेज़',
    blog: 'ब्लॉग',
    contributing: 'योगदान दें',
    github: 'GitHub',
    mcp: 'MCP सर्वर',
  },
};

function localeNav(locale: string) {
  const s = navStrings[locale];
  const p = localePrefixes[locale];
  return [
    {
      text: s.product,
      items: [
        { text: s.features, link: `${p}/features` },
        { text: s.useCases, link: `${p}/use-cases` },
        { text: s.download, link: `${p}/download` },
      ],
    },
    toolsNav(locale),
    {
      text: s.resources,
      items: [
        { text: s.docs, items: docsNav(locale) },
        { text: s.blog, link: `${p}/blog/` },
      ],
    },
    {
      text: s.community,
      items: [
        { text: s.github, link: 'https://github.com/Sandeepv68/EncodeX' },
        { text: s.contributing, link: `${p}/contributing` },
        { text: s.mcp, link: `${p}/mcp` },
      ],
    },
  ];
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
  'convert/avi-to-mp4': [
    {
      q: 'Why should I convert AVI to MP4?',
      a: 'AVI is an old format that produces large files and often refuses to play on phones, TVs, consoles and browsers. MP4 is the universal format that plays almost everywhere.',
    },
    {
      q: 'Will I lose quality converting AVI to MP4?',
      a: 'No. EncodeX keeps your video and audio quality intact while producing a modern, compatible MP4 file.',
    },
    { q: 'Can I convert many AVI files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of AVI files to MP4.' },
  ],
  'convert/mov-to-mp4': [
    {
      q: 'Why should I convert MOV to MP4?',
      a: "MOV is Apple's format and often won't play on Android phones, Windows players, TVs or web upload forms. MP4 is the universal format that plays everywhere.",
    },
    {
      q: 'Will I lose quality converting MOV to MP4?',
      a: 'No. By default EncodeX remuxes the existing video and audio streams, so the quality stays exactly the same and the conversion is very fast.',
    },
    { q: 'Can I convert many MOV files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of MOV files to MP4.' },
  ],
  'convert/m4v-to-mp4': [
    {
      q: 'Why should I convert M4V to MP4?',
      a: "M4V is Apple's container for iTunes and Apple TV purchases, and it often carries playback restrictions. MP4 is the open, universal format that plays on any device.",
    },
    {
      q: 'Does EncodeX remove DRM from M4V files?',
      a: 'If a file is DRM-locked and won\u2019t open in other apps, play it in your licensed library first. EncodeX converts the unlocked video you can already access into an open MP4.',
    },
    { q: 'Can I batch convert M4V files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of M4V files to MP4.' },
  ],
  'convert/flv-to-mp4': [
    {
      q: 'Why should I convert FLV to MP4?',
      a: 'FLV is a Flash-era format and most modern devices, TVs, phones, editing apps and browsers dropped support years ago. MP4 is the universal modern format.',
    },
    {
      q: 'Will I lose quality converting FLV to MP4?',
      a: 'No. EncodeX re-codes your FLV into MP4 cleanly, keeping your video quality while modernizing the format.',
    },
    { q: 'Can I convert many FLV files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of FLV files to MP4.' },
  ],
  'convert/wmv-to-mp4': [
    {
      q: 'Why should I convert WMV to MP4?',
      a: 'WMV is a Microsoft format that mostly stays on Windows and often won\u2019t play on Macs, phones, tablets, TVs or in modern browsers. MP4 works almost everywhere.',
    },
    {
      q: 'Will I lose quality converting WMV to MP4?',
      a: 'No. EncodeX converts your WMV to MP4 cleanly while keeping your video quality.',
    },
    { q: 'Can I convert many WMV files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of WMV files to MP4.' },
  ],
  'convert/webm-to-mp4': [
    {
      q: 'Why should I convert WebM to MP4?',
      a: 'WebM comes from browsers, screen recorders and Chrome extensions, but support is inconsistent in editing apps, phones, TVs and older players. MP4 plays almost everywhere.',
    },
    {
      q: 'Will I lose quality converting WebM to MP4?',
      a: 'No. EncodeX converts your WebM to a highly compatible MP4 while keeping your video quality.',
    },
    { q: 'Can I convert many WebM files at once?', a: 'Yes. EncodeX supports batch converting an entire folder of WebM files to MP4.' },
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
  'codecs/h264': [
    {
      q: 'What is H.264 and why is it everywhere?',
      a: 'H.264 (AVC) is the most widely supported video codec in the world - it plays on phones, TVs, consoles, browsers and editing software, and it is the standard for YouTube, Instagram and most platforms.',
    },
    {
      q: 'Does EncodeX use hardware acceleration for H.264 encoding?',
      a: 'Yes. EncodeX uses NVENC on NVIDIA, Quick Sync on Intel, AMF on AMD, VideoToolbox on Apple Silicon and VAAPI on Linux, so H.264 conversion is dramatically faster with no setup.',
    },
    {
      q: 'Is MP4 + H.264 the most compatible combination?',
      a: 'Yes. Pairing H.264 video with AAC audio in an MP4 container is the most compatible setup there is - and EncodeX makes it the easy default whenever you choose MP4 output.',
    },
  ],
  'codecs/h265': [
    {
      q: 'What is the advantage of H.265 over H.264?',
      a: 'H.265 (HEVC) delivers roughly half the file size of H.264 at similar quality, and it is built for 4K and HDR content.',
    },
    {
      q: 'Does EncodeX support hardware-accelerated H.265 encoding?',
      a: 'Yes. EncodeX uses the hardware HEVC encoder built into your device - NVENC, Quick Sync, AMF, VAAPI or VideoToolbox - automatically.',
    },
    {
      q: 'Will H.265 files play everywhere?',
      a: 'H.265 is widely supported on phones, TVs and consoles from the last several years. For maximum compatibility with older devices, H.264 in MP4 is still the safest bet.',
    },
  ],
  'codecs/av1': [
    {
      q: 'What is AV1 and why use it?',
      a: 'AV1 is the most efficient mainstream video codec available today, giving the smallest file size for a given quality - up to about 30% smaller than H.265. It is royalty-free and used by YouTube and Netflix.',
    },
    {
      q: 'Does EncodeX support AV1 encoding?',
      a: "Yes. EncodeX offers software AV1 encoders (libaom, SVT-AV1, rav1e) plus AV1 hardware encoders where your GPU provides them.",
    },
    {
      q: 'Is AV1 encoding slow?',
      a: "AV1 encoding is more demanding than H.264 or H.265. It's best for archiving and web delivery where size matters most, rather than everyday quick conversions.",
    },
  ],
  'codecs/vp9': [
    {
      q: 'What is VP9?',
      a: 'VP9 is Google\u2019s open, royalty-free video codec - the workhorse behind YouTube, Chrome and Android, with roughly half the file size of H.264 at similar quality.',
    },
    {
      q: 'Does EncodeX support VP9 encoding?',
      a: 'Yes. EncodeX encodes VP9 using software libvpx, plus VAAPI and VideoToolbox hardware acceleration where available.',
    },
    {
      q: 'When should I use VP9 instead of H.264?',
      a: 'Choose VP9 for open, efficient web-ready video and archiving. Choose H.264 when you need maximum compatibility with older devices. EncodeX lets you compare a test clip in seconds.',
    },
  ],
  'codecs/prores': [
    {
      q: 'What is Apple ProRes?',
      a: 'ProRes is the professional intermediate codec used across the film and broadcast industry - excellent quality that edits smoothly, with keyframe-friendly scrubbing in Final Cut Pro, Premiere Pro and DaVinci Resolve.',
    },
    {
      q: 'Does EncodeX support ProRes encoding?',
      a: 'Yes. EncodeX includes ready-made ProRes 422, 422HQ, 4444 and more profiles that work on Windows, Mac and Linux.',
    },
    {
      q: 'Why are ProRes files so large?',
      a: 'ProRes is an intermediate format for editing, not delivery. Use it to prepare a master for an editing session, then export a small delivery file such as H.264 afterwards.',
    },
  ],
  'ffmpeg-gui': [
    {
      q: 'What is an FFmpeg GUI?',
      a: 'An FFmpeg GUI is a visual frontend that wraps the FFmpeg command-line engine in menus and buttons, so you can convert, compress, trim and extract audio without typing a single command.',
    },
    {
      q: 'Does EncodeX include FFmpeg?',
      a: 'Yes. EncodeX bundles the FFmpeg engine, so you never install FFmpeg, codecs or anything else separately.',
    },
    {
      q: 'Is EncodeX a free FFmpeg GUI?',
      a: 'Yes. EncodeX is free forever and open source (MIT) with no watermarks, no accounts and no paid tier.',
    },
  ],
  'ffmpeg-gui/windows': [
    {
      q: 'Is there a free FFmpeg GUI for Windows?',
      a: 'Yes. EncodeX is a free, open-source FFmpeg GUI for Windows 10 and newer, with no watermarks and no paid tier.',
    },
    {
      q: 'Does EncodeX use hardware acceleration on Windows?',
      a: 'Yes. EncodeX automatically uses NVIDIA NVENC, Intel Quick Sync (QSV) and AMD AMF to finish conversions in a fraction of the time.',
    },
    {
      q: 'Does EncodeX upload my files on Windows?',
      a: 'No. Everything runs offline on your PC - your files never leave your computer.',
    },
  ],
  'ffmpeg-gui/macos': [
    {
      q: 'Is there a free FFmpeg GUI for Mac?',
      a: 'Yes. EncodeX is a free, open-source FFmpeg GUI for macOS 11 and newer, with a native Apple Silicon build for M-series Macs.',
    },
    {
      q: 'Does EncodeX use Apple VideoToolbox on Mac?',
      a: 'Yes. EncodeX automatically uses Apple VideoToolbox hardware acceleration on both Apple Silicon and Intel Macs.',
    },
    {
      q: 'Can EncodeX convert to ProRes on a Mac?',
      a: 'Yes - EncodeX includes ready-made ProRes 422 and 4444 profiles, perfect for Final Cut Pro and DaVinci Resolve workflows.',
    },
  ],
  'ffmpeg-gui/linux': [
    {
      q: 'Is there a free FFmpeg GUI for Linux?',
      a: 'Yes. EncodeX is free and open source, runs on most modern Linux distributions as an AppImage, and needs no package juggling.',
    },
    {
      q: 'Does EncodeX support hardware acceleration on Linux?',
      a: "Yes. EncodeX supports VAAPI on Linux - no matter the GPU brand - plus NVENC on NVIDIA GPUs.",
    },
    {
      q: 'Can I use EncodeX on a headless Linux server?',
      a: 'Yes - EncodeX includes a CLI mode for scripting conversions without a desktop, and the bundled FFmpeg engine works standalone.',
    },
  ],
  mcp: [
    {
      q: 'Is the EncodeX MCP server free?',
      a: 'Yes. The MCP server is built into the free, open-source (MIT) EncodeX app - no extra license or subscription.',
    },
    {
      q: 'Does using MCP upload my files?',
      a: 'No. EncodeX runs entirely offline. The MCP server drives the same local FFmpeg engine, so your media never leaves your computer.',
    },
    {
      q: 'Which AI assistants can connect to EncodeX?',
      a: 'Any MCP-compatible client: Claude Desktop, Claude Code, Cursor, VS Code, and custom agents. The stdio server is a standard JSON-RPC process, so anything that can spawn a command and speak MCP can connect.',
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
    'mcp': [
      {
        q: '¿El servidor MCP de EncodeX es gratuito?',
        a: 'Sí. El servidor MCP está integrado en EncodeX, que es gratuito y de código abierto (MIT); no necesita licencia ni suscripción adicional.',
      },
      {
        q: '¿Usar MCP sube mis archivos?',
        a: 'No. EncodeX funciona totalmente sin conexión. El servidor MCP dirige el mismo motor FFmpeg local, así que tus archivos nunca salen de tu computadora.',
      },
      {
        q: '¿Qué asistentes de IA pueden conectarse a EncodeX?',
        a: 'Cualquier cliente compatible con MCP: Claude Desktop, Claude Code, Cursor, VS Code y agentes personalizados. El servidor stdio es un proceso JSON-RPC estándar, así que cualquier herramienta capaz de ejecutar un comando y hablar MCP puede conectarse.',
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
    'convert/avi-to-mp4': [
      {
        q: '¿Por qué debería convertir AVI a MP4?',
        a: 'AVI es un formato antiguo que genera archivos grandes y a menudo no se reproduce en teléfonos, televisores, consolas ni navegadores. MP4 es el formato universal que se reproduce en casi cualquier lugar.',
      },
      {
        q: '¿Perderé calidad al convertir AVI a MP4?',
        a: 'No. EncodeX mantiene intacta la calidad de tu video y audio mientras produce un MP4 moderno y compatible.',
      },
      { q: '¿Puedo convertir muchos archivos AVI a la vez?', a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos AVI a MP4.' },
    ],
    'convert/mov-to-mp4': [
      {
        q: '¿Por qué debería convertir MOV a MP4?',
        a: 'MOV es el formato de Apple y a menudo no se reproduce en teléfonos Android, reproductores de Windows, televisores ni formularios de subida web. MP4 es el formato universal que se reproduce en cualquier lugar.',
      },
      {
        q: '¿Perderé calidad al convertir MOV a MP4?',
        a: 'No. Por defecto, EncodeX re-empaqueta (remux) los flujos de video y audio existentes, por lo que la calidad permanece exactamente igual y la conversión es muy rápida.',
      },
      { q: '¿Puedo convertir muchos archivos MOV a la vez?', a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos MOV a MP4.' },
    ],
    'convert/m4v-to-mp4': [
      {
        q: '¿Por qué debería convertir M4V a MP4?',
        a: 'M4V es el contenedor de Apple para compras de iTunes y Apple TV, y a menudo trae restricciones de reproducción. MP4 es el formato abierto y universal que se reproduce en cualquier dispositivo.',
      },
      {
        q: '¿EncodeX elimina el DRM de los archivos M4V?',
        a: 'Si un archivo tiene DRM y no se abre en otras apps, reprodúcelo primero en tu biblioteca con licencia. EncodeX convierte el video desbloqueado al que ya tienes acceso en un MP4 abierto.',
      },
      { q: '¿Puedo convertir en lote archivos M4V a la vez?', a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos M4V a MP4.' },
    ],
    'convert/flv-to-mp4': [
      {
        q: '¿Por qué debería convertir FLV a MP4?',
        a: 'FLV es un formato de la era Flash y la mayoría de los dispositivos, televisores, teléfonos, apps de edición y navegadores dejaron de admitirlo. MP4 es el formato moderno universal.',
      },
      {
        q: '¿Perderé calidad al convertir FLV a MP4?',
        a: 'No. EncodeX re-codifica tu FLV a MP4 de forma limpia, conservando la calidad de tu video mientras moderniza el formato.',
      },
      { q: '¿Puedo convertir muchos archivos FLV a la vez?', a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos FLV a MP4.' },
    ],
    'convert/wmv-to-mp4': [
      {
        q: '¿Por qué debería convertir WMV a MP4?',
        a: 'WMV es un formato de Microsoft que se queda casi solo en Windows y a menudo no se reproduce en Macs, teléfonos, tablets, televisores ni navegadores modernos. MP4 funciona en casi cualquier lugar.',
      },
      {
        q: '¿Perderé calidad al convertir WMV a MP4?',
        a: 'No. EncodeX convierte tu WMV a MP4 de forma limpia conservando la calidad de tu video.',
      },
      { q: '¿Puedo convertir muchos archivos WMV a la vez?', a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos WMV a MP4.' },
    ],
    'convert/webm-to-mp4': [
      {
        q: '¿Por qué debería convertir WebM a MP4?',
        a: 'WebM viene de navegadores, grabadores de pantalla y extensiones de Chrome, pero el soporte es inconsistente en apps de edición, teléfonos, televisores y reproductores antiguos. MP4 se reproduce en casi cualquier lugar.',
      },
      {
        q: '¿Perderé calidad al convertir WebM a MP4?',
        a: 'No. EncodeX convierte tu WebM a un MP4 altamente compatible conservando la calidad de tu video.',
      },
      { q: '¿Puedo convertir muchos archivos WebM a la vez?', a: 'Sí. EncodeX admite la conversión por lotes de una carpeta entera de archivos WebM a MP4.' },
    ],
    'codecs/h264': [
      {
        q: '¿Qué es H.264 y por qué está en todos lados?',
        a: 'H.264 (AVC) es el códec de video más compatible del mundo: se reproduce en teléfonos, televisores, consolas, navegadores y software de edición, y es el estándar en YouTube, Instagram y la mayoría de las plataformas.',
      },
      {
        q: '¿EncodeX usa aceleración por hardware para codificar H.264?',
        a: 'Sí. EncodeX usa NVENC en NVIDIA, Quick Sync en Intel, AMF en AMD, VideoToolbox en Apple Silicon y VAAPI en Linux, por lo que la conversión a H.264 es mucho más rápida sin configuración.',
      },
      {
        q: '¿MP4 + H.264 es la combinación más compatible?',
        a: 'Sí. Combinar video H.264 con audio AAC en un contenedor MP4 es la configuración más compatible que existe, y EncodeX la hace la opción fácil por defecto cuando eliges salida MP4.',
      },
    ],
    'codecs/h265': [
      {
        q: '¿Qué ventaja tiene H.265 frente a H.264?',
        a: 'H.265 (HEVC) ofrece aproximadamente la mitad del tamaño de archivo de H.264 con calidad similar, y está pensado para contenido 4K y HDR.',
      },
      {
        q: '¿EncodeX admite codificación H.265 por hardware?',
        a: 'Sí. EncodeX usa automáticamente el codificador HEVC por hardware de tu dispositivo: NVENC, Quick Sync, AMF, VAAPI o VideoToolbox.',
      },
      {
        q: '¿Los archivos H.265 se reproducen en todas partes?',
        a: 'H.265 es compatible de forma amplia con teléfonos, televisores y consolas de los últimos años. Para máxima compatibilidad con dispositivos antiguos, H.264 en MP4 sigue siendo la opción más segura.',
      },
    ],
    'codecs/av1': [
      {
        q: '¿Qué es AV1 y por qué usarlo?',
        a: 'AV1 es el códec de video más eficiente disponible hoy, ofreciendo el tamaño de archivo más pequeño para una calidad dada, hasta un 30 % menos que H.265. Es libre de regalías y lo usan YouTube y Netflix.',
      },
      {
        q: '¿EncodeX admite codificación AV1?',
        a: 'Sí. EncodeX ofrece codificadores AV1 por software (libaom, SVT-AV1, rav1e) además de codificadores AV1 por hardware donde tu GPU los ofrece.',
      },
      {
        q: '¿La codificación AV1 es lenta?',
        a: 'AV1 exige más cómputo que H.264 o H.265. Es ideal para archivar y entrega web donde el tamaño importa más, antes que para conversiones rápidas cotidianas.',
      },
    ],
    'codecs/vp9': [
      {
        q: '¿Qué es VP9?',
        a: 'VP9 es el códec abierto y libre de regalías de Google, el caballo de batalla detrás de YouTube, Chrome y Android, con aproximadamente la mitad del tamaño de H.264 a calidad similar.',
      },
      {
        q: '¿EncodeX admite codificación VP9?',
        a: 'Sí. EncodeX codifica VP9 con libvpx por software, además de aceleración por hardware VAAPI y VideoToolbox donde esté disponible.',
      },
      {
        q: '¿Cuándo debería usar VP9 en lugar de H.264?',
        a: 'Elige VP9 para video web abierto y eficiente, y para archivar. Elige H.264 cuando necesites máxima compatibilidad con dispositivos antiguos. Con EncodeX puedes comparar un clip de prueba en segundos.',
      },
    ],
    'codecs/prores': [
      {
        q: '¿Qué es Apple ProRes?',
        a: 'ProRes es el códec intermedio profesional usado en toda la industria del cine y la difusión: excelente calidad que se edita con fluidez, con scrubbing apto para keyframes en Final Cut Pro, Premiere Pro y DaVinci Resolve.',
      },
      {
        q: '¿EncodeX admite codificación ProRes?',
        a: 'Sí. EncodeX incluye perfiles listos de ProRes 422, 422HQ, 4444 y más, que funcionan en Windows, Mac y Linux.',
      },
      {
        q: '¿Por qué los archivos ProRes son tan grandes?',
        a: 'ProRes es un formato intermedio para editar, no para entrega. Úsalo para preparar un máster para una sesión de edición y luego exporta un archivo pequeño de entrega, como H.264.',
      },
    ],
    'ffmpeg-gui': [
      {
        q: '¿Qué es una interfaz gráfica para FFmpeg?',
        a: 'Una interfaz gráfica para FFmpeg es un frontend visual que envuelve el motor de línea de comandos de FFmpeg en menús y botones, para convertir, comprimir, recortar y extraer audio sin teclear ni un comando.',
      },
      {
        q: '¿EncodeX incluye FFmpeg?',
        a: 'Sí. EncodeX trae el motor FFmpeg integrado, por lo que nunca instalas FFmpeg, códecs ni nada más por separado.',
      },
      {
        q: '¿EncodeX es una interfaz gráfica para FFmpeg gratuita?',
        a: 'Sí. EncodeX es gratuito para siempre y de código abierto (MIT), sin marcas de agua, sin cuentas y sin nivel de pago.',
      },
    ],
    'ffmpeg-gui/windows': [
      {
        q: '¿Hay una interfaz gráfica gratuita para FFmpeg en Windows?',
        a: 'Sí. EncodeX es una interfaz gráfica gratuita y de código abierto para FFmpeg en Windows 10 y más reciente, sin marcas de agua ni nivel de pago.',
      },
      {
        q: '¿EncodeX usa aceleración por hardware en Windows?',
        a: 'Sí. EncodeX usa automáticamente NVIDIA NVENC, Intel Quick Sync (QSV) y AMD AMF para terminar las conversiones en una fracción del tiempo.',
      },
      {
        q: '¿EncodeX sube mis archivos en Windows?',
        a: 'No. Todo se ejecuta sin conexión en tu PC: tus archivos nunca salen de tu computadora.',
      },
    ],
    'ffmpeg-gui/macos': [
      {
        q: '¿Hay una interfaz gráfica gratuita para FFmpeg en Mac?',
        a: 'Sí. EncodeX es una interfaz gráfica gratuita y de código abierto para FFmpeg en macOS 11 y más reciente, con una compilación nativa para Apple Silicon en Macs con chip M.',
      },
      {
        q: '¿EncodeX usa Apple VideoToolbox en Mac?',
        a: 'Sí. EncodeX usa automáticamente la aceleración por hardware de Apple VideoToolbox en Macs Apple Silicon e Intel.',
      },
      {
        q: '¿Puedo convertir a ProRes en un Mac con EncodeX?',
        a: 'Sí. EncodeX incluye perfiles listos de ProRes 422 y 4444, perfectos para flujos de Final Cut Pro y DaVinci Resolve.',
      },
    ],
    'ffmpeg-gui/linux': [
      {
        q: '¿Hay una interfaz gráfica gratuita para FFmpeg en Linux?',
        a: 'Sí. EncodeX es gratuito y de código abierto, corre en la mayoría de las distribuciones modernas de Linux como AppImage y no requiere lidiar con paquetes.',
      },
      {
        q: '¿EncodeX admite aceleración por hardware en Linux?',
        a: 'Sí. EncodeX admite VAAPI en Linux, sin importar la marca de la GPU, además de NVENC en GPUs NVIDIA.',
      },
      {
        q: '¿Puedo usar EncodeX en un servidor Linux sin interfaz gráfica?',
        a: 'Sí. EncodeX incluye un modo CLI para automatizar conversiones con scripts sin escritorio, y el motor FFmpeg integrado funciona de forma autónoma.',
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
    'mcp': [
      {
        q: 'Le serveur MCP d\u2019EncodeX est-il gratuit ?',
        a: 'Oui. Le serveur MCP est intégré à EncodeX, qui est gratuit et open source (MIT) — aucune licence ni abonnement supplémentaire.',
      },
      {
        q: 'Est-ce que MCP téléverse mes fichiers ?',
        a: 'Non. EncodeX fonctionne entièrement hors ligne. Le serveur MCP pilote le même moteur FFmpeg local, vos médias ne quittent donc jamais votre ordinateur.',
      },
      {
        q: 'Quels assistants IA peuvent se connecter à EncodeX ?',
        a: 'Tout client compatible MCP : Claude Desktop, Claude Code, Cursor, VS Code et les agents personnalisés. Le serveur stdio est un processus JSON-RPC standard, donc tout ce qui peut lancer une commande et parler MCP peut se connecter.',
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
    'convert/avi-to-mp4': [
      {
        q: 'Pourquoi convertir AVI en MP4 ?',
        a: 'AVI est un ancien format qui produit de gros fichiers et refuse souvent de se lire sur les téléphones, téléviseurs, consoles et navigateurs. MP4 est le format universel qui se lit presque partout.',
      },
      {
        q: 'Vais-je perdre de la qualité en convertissant AVI en MP4 ?',
        a: 'Non. EncodeX conserve intacte la qualité de votre vidéo et de votre audio tout en produisant un MP4 moderne et compatible.',
      },
      { q: 'Puis-je convertir plusieurs fichiers AVI à la fois ?', a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers AVI en MP4.' },
    ],
    'convert/mov-to-mp4': [
      {
        q: 'Pourquoi convertir MOV en MP4 ?',
        a: 'MOV est le format d\u2019Apple et ne se lit souvent pas sur les téléphones Android, les lecteurs Windows, les téléviseurs ou les formulaires de téléversement web. MP4 est le format universel qui se lit partout.',
      },
      {
        q: 'Vais-je perdre de la qualité en convertissant MOV en MP4 ?',
        a: 'Non. Par défaut, EncodeX remuxe les flux vidéo et audio existants : la qualité reste exactement la même et la conversion est très rapide.',
      },
      { q: 'Puis-je convertir plusieurs fichiers MOV à la fois ?', a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers MOV en MP4.' },
    ],
    'convert/m4v-to-mp4': [
      {
        q: 'Pourquoi convertir M4V en MP4 ?',
        a: 'M4V est le conteneur d\u2019Apple pour les achats iTunes et Apple TV, et il comporte souvent des restrictions de lecture. MP4 est le format ouvert et universel qui se lit sur n\u2019importe quel appareil.',
      },
      {
        q: 'EncodeX supprime-t-il le DRM des fichiers M4V ?',
        a: 'Si un fichier est verrouillé par DRM et ne s\u2019ouvre pas dans d\u2019autres applications, lisez-le d\u2019abord dans votre bibliothèque sous licence. EncodeX convertit la vidéo déverrouillée à laquelle vous avez déjà accès en MP4 ouvert.',
      },
      { q: 'Puis-je convertir plusieurs fichiers M4V à la fois ?', a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers M4V en MP4.' },
    ],
    'convert/flv-to-mp4': [
      {
        q: 'Pourquoi convertir FLV en MP4 ?',
        a: 'FLV est un format de l\u2019ère Flash et la plupart des appareils, téléviseurs, téléphones, applications d\u2019édition et navigateurs ont abandonné sa prise en charge. MP4 est le format moderne universel.',
      },
      {
        q: 'Vais-je perdre de la qualité en convertissant FLV en MP4 ?',
        a: 'Non. EncodeX ré-encode proprement votre FLV en MP4, en conservant la qualité de votre vidéo tout en modernisant le format.',
      },
      { q: 'Puis-je convertir plusieurs fichiers FLV à la fois ?', a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers FLV en MP4.' },
    ],
    'convert/wmv-to-mp4': [
      {
        q: 'Pourquoi convertir WMV en MP4 ?',
        a: 'WMV est un format Microsoft qui reste surtout sur Windows et ne se lit souvent pas sur les Mac, téléphones, tablettes, téléviseurs ou navigateurs modernes. MP4 fonctionne presque partout.',
      },
      {
        q: 'Vais-je perdre de la qualité en convertissant WMV en MP4 ?',
        a: 'Non. EncodeX convertit proprement votre WMV en MP4 en conservant la qualité de votre vidéo.',
      },
      { q: 'Puis-je convertir plusieurs fichiers WMV à la fois ?', a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers WMV en MP4.' },
    ],
    'convert/webm-to-mp4': [
      {
        q: 'Pourquoi convertir WebM en MP4 ?',
        a: 'Le WebM vient des navigateurs, enregistreurs d\u2019écran et extensions Chrome, mais sa prise en charge est inégale dans les applications d\u2019édition, les téléphones, les téléviseurs et les lecteurs anciens. MP4 se lit presque partout.',
      },
      {
        q: 'Vais-je perdre de la qualité en convertissant WebM en MP4 ?',
        a: 'Non. EncodeX convertit votre WebM en un MP4 très compatible en conservant la qualité de votre vidéo.',
      },
      { q: 'Puis-je convertir plusieurs fichiers WebM à la fois ?', a: 'Oui. EncodeX prend en charge la conversion par lots de tout un dossier de fichiers WebM en MP4.' },
    ],
    'codecs/h264': [
      {
        q: 'Qu\u2019est-ce que le H.264 et pourquoi est-il partout ?',
        a: 'Le H.264 (AVC) est le codec vidéo le plus compatible au monde : il se lit sur les téléphones, téléviseurs, consoles, navigateurs et logiciels d\u2019édition, et c\u2019est la norme sur YouTube, Instagram et la plupart des plateformes.',
      },
      {
        q: 'EncodeX utilise-t-il l\u2019accélération matérielle pour encoder en H.264 ?',
        a: 'Oui. EncodeX utilise NVENC sur NVIDIA, Quick Sync sur Intel, AMF sur AMD, VideoToolbox sur Apple Silicon et VAAPI sur Linux, donc la conversion H.264 est beaucoup plus rapide sans configuration.',
      },
      {
        q: 'MP4 + H.264 est-il la combinaison la plus compatible ?',
        a: 'Oui. Associer la vidéo H.264 à l\u2019audio AAC dans un conteneur MP4 est la configuration la plus compatible qui soit, et EncodeX en fait le choix simple par défaut dès que vous choisissez une sortie MP4.',
      },
    ],
    'codecs/h265': [
      {
        q: 'Quel est l\u2019avantage du H.265 par rapport au H.264 ?',
        a: 'Le H.265 (HEVC) offre environ la moitié de la taille de fichier du H.264 pour une qualité similaire, et il est pensé pour la 4K et le HDR.',
      },
      {
        q: 'EncodeX prend-il en charge l\u2019encodage H.265 accéléré par le matériel ?',
        a: 'Oui. EncodeX utilise automatiquement l\u2019encodeur HEVC matériel de votre appareil : NVENC, Quick Sync, AMF, VAAPI ou VideoToolbox.',
      },
      {
        q: 'Les fichiers H.265 se lisent-ils partout ?',
        a: 'H.265 est largement pris en charge sur les téléphones, téléviseurs et consoles des dernières années. Pour une compatibilité maximale avec les appareils anciens, le H.264 en MP4 reste le plus sûr.',
      },
    ],
    'codecs/av1': [
      {
        q: 'Qu\u2019est-ce que l\u2019AV1 et pourquoi l\u2019utiliser ?',
        a: 'L\u2019AV1 est le codec vidéo le plus efficace aujourd\u2019hui, offrant la plus petite taille de fichier pour une qualité donnée, jusqu\u2019à environ 30 % de moins que le H.265. Il est exempt de redevances et utilisé par YouTube et Netflix.',
      },
      {
        q: 'EncodeX prend-il en charge l\u2019encodage AV1 ?',
        a: 'Oui. EncodeX propose les encodeurs AV1 logiciels (libaom, SVT-AV1, rav1e) ainsi que les encodeurs AV1 matériels là où votre GPU les offre.',
      },
      {
        q: 'L\u2019encodage AV1 est-il lent ?',
        a: 'L\u2019AV1 demande plus de calcul que le H.264 ou le H.265. Il convient surtout à l\u2019archivage et à la diffusion web où la taille compte le plus, plutôt qu\u2019aux conversions rapides du quotidien.',
      },
    ],
    'codecs/vp9': [
      {
        q: 'Qu\u2019est-ce que le VP9 ?',
        a: 'Le VP9 est le codec vidéo ouvert et exempt de redevances de Google, le cheval de trait de YouTube, Chrome et Android, avec environ la moitié de la taille du H.264 pour une qualité similaire.',
      },
      {
        q: 'EncodeX prend-il en charge l\u2019encodage VP9 ?',
        a: 'Oui. EncodeX encode le VP9 avec libvpx en logiciel, plus l\u2019accélération matérielle VAAPI et VideoToolbox là où elle est disponible.',
      },
      {
        q: 'Quand utiliser le VP9 plutôt que le H.264 ?',
        a: 'Choisissez VP9 pour une vidéo web ouverte, efficace et pour l\u2019archivage. Choisissez H.264 pour une compatibilité maximale avec les appareils anciens. Avec EncodeX, comparez un clip de test en quelques secondes.',
      },
    ],
    'codecs/prores': [
      {
        q: 'Qu\u2019est-ce que l\u2019Apple ProRes ?',
        a: 'Le ProRes est le codec intermédiaire professionnel de toute l\u2019industrie du cinéma et de la diffusion : une excellente qualité qui se monte en douceur, avec un défilement adapté aux images clés dans Final Cut Pro, Premiere Pro et DaVinci Resolve.',
      },
      {
        q: 'EncodeX prend-il en charge l\u2019encodage ProRes ?',
        a: 'Oui. EncodeX inclut des profils ProRes prêts à l\u2019emploi : 422, 422HQ, 4444 et plus, qui fonctionnent sous Windows, Mac et Linux.',
      },
      {
        q: 'Pourquoi les fichiers ProRes sont-ils si volumineux ?',
        a: 'Le ProRes est un format intermédiaire pour le montage, pas pour la livraison. Utilisez-le pour préparer un master pour une session de montage, puis exportez un petit fichier de livraison, par exemple en H.264.',
      },
    ],
    'ffmpeg-gui': [
      {
        q: 'Qu\u2019est-ce qu\u2019une interface graphique FFmpeg ?',
        a: 'Une interface graphique FFmpeg est un front-end visuel qui enveloppe le moteur en ligne de commande de FFmpeg dans des menus et des boutons, pour convertir, compresser, couper et extraire l\u2019audio sans taper une seule commande.',
      },
      {
        q: 'EncodeX inclut-il FFmpeg ?',
        a: 'Oui. EncodeX embarque le moteur FFmpeg, donc vous n\u2019installez jamais FFmpeg, ni codecs, ni quoi que ce soit d\u2019autre séparément.',
      },
      {
        q: 'EncodeX est-il une interface graphique FFmpeg gratuite ?',
        a: 'Oui. EncodeX est gratuit pour toujours et open source (MIT), sans filigranes, sans comptes et sans offre payante.',
      },
    ],
    'ffmpeg-gui/windows': [
      {
        q: 'Existe-t-il une interface graphique FFmpeg gratuite pour Windows ?',
        a: 'Oui. EncodeX est une interface graphique FFmpeg gratuite et open source pour Windows 10 et plus récent, sans filigranes ni offre payante.',
      },
      {
        q: 'EncodeX utilise-t-il l\u2019accélération matérielle sous Windows ?',
        a: 'Oui. EncodeX utilise automatiquement NVIDIA NVENC, Intel Quick Sync (QSV) et AMD AMF pour finir les conversions en une fraction du temps.',
      },
      {
        q: 'EncodeX téléverse-t-il mes fichiers sous Windows ?',
        a: 'Non. Tout fonctionne hors ligne sur votre PC : vos fichiers ne quittent jamais votre ordinateur.',
      },
    ],
    'ffmpeg-gui/macos': [
      {
        q: 'Existe-t-il une interface graphique FFmpeg gratuite pour Mac ?',
        a: 'Oui. EncodeX est une interface graphique FFmpeg gratuite et open source pour macOS 11 et plus récent, avec une build native Apple Silicon pour les Mac à puce M.',
      },
      {
        q: 'EncodeX utilise-t-il Apple VideoToolbox sur Mac ?',
        a: 'Oui. EncodeX utilise automatiquement l\u2019accélération matérielle Apple VideoToolbox sur les Mac Apple Silicon et Intel.',
      },
      {
        q: 'Puis-je convertir en ProRes sur un Mac avec EncodeX ?',
        a: 'Oui. EncodeX inclut des profils ProRes 422 et 4444 prêts à l\u2019emploi, parfaits pour les flux Final Cut Pro et DaVinci Resolve.',
      },
    ],
    'ffmpeg-gui/linux': [
      {
        q: 'Existe-t-il une interface graphique FFmpeg gratuite pour Linux ?',
        a: 'Oui. EncodeX est gratuit et open source, fonctionne sur la plupart des distributions Linux modernes en AppImage, et ne demande aucun casse-tête de paquets.',
      },
      {
        q: 'EncodeX prend-il en charge l\u2019accélération matérielle sous Linux ?',
        a: 'Oui. EncodeX prend en charge VAAPI sous Linux, quelle que soit la marque de GPU, plus NVENC sur les GPU NVIDIA.',
      },
      {
        q: 'Puis-je utiliser EncodeX sur un serveur Linux sans interface graphique ?',
        a: 'Oui. EncodeX inclut un mode CLI pour automatiser les conversions avec des scripts sans bureau, et le moteur FFmpeg intégré fonctionne de manière autonome.',
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
    'mcp': [
      {
        q: 'Ist der MCP-Server von EncodeX kostenlos?',
        a: 'Ja. Der MCP-Server ist in EncodeX integriert, das kostenlos und Open Source (MIT) ist — kein zusätzliches Lizenz- oder Abo-Modell.',
      },
      {
        q: 'Lädt die MCP-Nutzung meine Dateien hoch?',
        a: 'Nein. EncodeX arbeitet vollständig offline. Der MCP-Server steuert dieselbe lokale FFmpeg-Engine, Ihre Medien verlassen also nie Ihren Computer.',
      },
      {
        q: 'Welche KI-Assistenten können sich mit EncodeX verbinden?',
        a: 'Jeder MCP-kompatible Client: Claude Desktop, Claude Code, Cursor, VS Code und eigene Agenten. Der stdio-Server ist ein standardmäßiger JSON-RPC-Prozess, sodass alles, was einen Befehl starten und MCP sprechen kann, sich verbinden kann.',
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
    'convert/avi-to-mp4': [
      {
        q: 'Warum sollte ich AVI in MP4 konvertieren?',
        a: 'AVI ist ein altes Format, das große Dateien erzeugt und sich oft nicht auf Telefonen, Fernsehern, Konsolen und Browsern abspielen lässt. MP4 ist das universelle Format, das fast überall funktioniert.',
      },
      {
        q: 'Verliere ich beim Konvertieren von AVI zu MP4 an Qualität?',
        a: 'Nein. EncodeX erhält die Qualität Ihrer Video- und Audiodaten und erzeugt zugleich eine moderne, kompatible MP4-Datei.',
      },
      { q: 'Kann ich viele AVI-Dateien auf einmal konvertieren?', a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners AVI-Dateien in MP4.' },
    ],
    'convert/mov-to-mp4': [
      {
        q: 'Warum sollte ich MOV in MP4 konvertieren?',
        a: 'MOV ist Apples Format und lässt sich oft nicht auf Android-Telefonen, Windows-Playern, Fernsehern oder Web-Upload-Formularen abspielen. MP4 ist das universelle Format, das überall läuft.',
      },
      {
        q: 'Verliere ich beim Konvertieren von MOV zu MP4 an Qualität?',
        a: 'Nein. Standardmäßig remuxt EncodeX die vorhandenen Video- und Audiostreams, sodass die Qualität exakt gleich bleibt und die Konvertierung sehr schnell ist.',
      },
      { q: 'Kann ich viele MOV-Dateien auf einmal konvertieren?', a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners MOV-Dateien in MP4.' },
    ],
    'convert/m4v-to-mp4': [
      {
        q: 'Warum sollte ich M4V in MP4 konvertieren?',
        a: 'M4V ist Apples Container für iTunes- und Apple-TV-Käufe und bringt oft Wiedergabebeschränkungen mit. MP4 ist das offene, universelle Format, das auf jedem Gerät funktioniert.',
      },
      {
        q: 'Entfernt EncodeX DRM aus M4V-Dateien?',
        a: 'Wenn eine Datei DRM-gesperrt ist und in anderen Apps nicht geöffnet wird, spielen Sie sie zuerst in Ihrer lizenzierten Bibliothek ab. EncodeX konvertiert das bereits entsperrte Video, auf das Sie Zugriff haben, in ein offenes MP4.',
      },
      { q: 'Kann ich M4V-Dateien in einem Rutsch stapelweise konvertieren?', a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners M4V-Dateien in MP4.' },
    ],
    'convert/flv-to-mp4': [
      {
        q: 'Warum sollte ich FLV in MP4 konvertieren?',
        a: 'FLV ist ein Format aus der Flash-Ära, und die meisten Geräte, Fernseher, Telefone, Editier-Apps und Browser haben die Unterstützung vor Jahren eingestellt. MP4 ist das moderne Universalformat.',
      },
      {
        q: 'Verliere ich beim Konvertieren von FLV zu MP4 an Qualität?',
        a: 'Nein. EncodeX codiert Ihre FLV sauber in MP4 um, erhält die Videoqualität und modernisiert zugleich das Format.',
      },
      { q: 'Kann ich viele FLV-Dateien auf einmal konvertieren?', a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners FLV-Dateien in MP4.' },
    ],
    'convert/wmv-to-mp4': [
      {
        q: 'Warum sollte ich WMV in MP4 konvertieren?',
        a: 'WMV ist ein Microsoft-Format, das meist auf Windows beschränkt bleibt und sich oft nicht auf Macs, Telefonen, Tablets, Fernsehern oder modernen Browsern abspielen lässt. MP4 funktioniert fast überall.',
      },
      {
        q: 'Verliere ich beim Konvertieren von WMV zu MP4 an Qualität?',
        a: 'Nein. EncodeX konvertiert Ihre WMV sauber in MP4 und erhält dabei die Qualität Ihres Videos.',
      },
      { q: 'Kann ich viele WMV-Dateien auf einmal konvertieren?', a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners WMV-Dateien in MP4.' },
    ],
    'convert/webm-to-mp4': [
      {
        q: 'Warum sollte ich WebM in MP4 konvertieren?',
        a: 'WebM stammt aus Browsern, Bildschirmrecordern und Chrome-Erweiterungen, aber die Unterstützung in Editier-Apps, Telefonen, Fernsehern und älteren Playern ist uneinheitlich. MP4 läuft fast überall.',
      },
      {
        q: 'Verliere ich beim Konvertieren von WebM zu MP4 an Qualität?',
        a: 'Nein. EncodeX konvertiert Ihr WebM in ein hochkompatibles MP4 und erhält dabei die Qualität Ihres Videos.',
      },
      { q: 'Kann ich viele WebM-Dateien auf einmal konvertieren?', a: 'Ja. EncodeX unterstützt die Stapelkonvertierung eines ganzen Ordners WebM-Dateien in MP4.' },
    ],
    'codecs/h264': [
      {
        q: 'Was ist H.264 und warum gibt es ihn überall?',
        a: 'H.264 (AVC) ist der weltweit am weitesten verbreitete Videocodec: Er läuft auf Telefonen, Fernsehern, Konsolen, Browsern und Editiersoftware und ist der Standard bei YouTube, Instagram und den meisten Plattformen.',
      },
      {
        q: 'Nutzt EncodeX Hardware-Beschleunigung für die H.264-Kodierung?',
        a: 'Ja. EncodeX nutzt NVENC auf NVIDIA, Quick Sync auf Intel, AMF auf AMD, VideoToolbox auf Apple Silicon und VAAPI unter Linux – H.264-Konvertierung ist damit ohne Einrichtung deutlich schneller.',
      },
      {
        q: 'Ist MP4 + H.264 die kompatibelste Kombination?',
        a: 'Ja. H.264-Video mit AAC-Audio in einem MP4-Container ist die kompatibelste Kombination überhaupt – und EncodeX macht sie zur einfachen Standardwahl, wenn Sie MP4-Ausgabe wählen.',
      },
    ],
    'codecs/h265': [
      {
        q: 'Was ist der Vorteil von H.265 gegenüber H.264?',
        a: 'H.265 (HEVC) liefert bei ähnlicher Qualität etwa die halbe Dateigröße von H.264 und ist für 4K- und HDR-Inhalte gedacht.',
      },
      {
        q: 'Unterstützt EncodeX hardwarebeschleunigte H.265-Kodierung?',
        a: 'Ja. EncodeX verwendet automatisch den Hardware-HEVC-Encoder Ihres Geräts – NVENC, Quick Sync, AMF, VAAPI oder VideoToolbox.',
      },
      {
        q: 'Lassen sich H.265-Dateien überall abspielen?',
        a: 'H.265 wird von Telefonen, Fernsehern und Konsolen der letzten Jahre breit unterstützt. Für maximale Kompatibilität mit älteren Geräten bleibt H.264 in MP4 die sicherste Wahl.',
      },
    ],
    'codecs/av1': [
      {
        q: 'Was ist AV1 und warum sollte man ihn verwenden?',
        a: 'AV1 ist der effizienteste gängige Videocodec und liefert für eine gegebene Qualität die kleinste Datei – bis zu etwa 30 % kleiner als H.265. Er ist lizenzgebührenfrei und wird von YouTube und Netflix genutzt.',
      },
      {
        q: 'Unterstützt EncodeX die AV1-Kodierung?',
        a: 'Ja. EncodeX bietet Software-AV1-Encoder (libaom, SVT-AV1, rav1e) sowie Hardware-AV1-Encoder, sofern Ihre GPU sie bereitstellt.',
      },
      {
        q: 'Ist die AV1-Kodierung langsam?',
        a: 'AV1 ist rechenintensiver als H.264 oder H.265. Er eignet sich am besten für Archivierung und Web-Auslieferung, bei denen die Größe am wichtigsten ist – nicht für schnelle Alltagskonvertierungen.',
      },
    ],
    'codecs/vp9': [
      {
        q: 'Was ist VP9?',
        a: 'VP9 ist Googles offener, lizenzgebührenfreier Videocodec – das Arbeitstier hinter YouTube, Chrome und Android – mit etwa der halben Dateigröße von H.264 bei ähnlicher Qualität.',
      },
      {
        q: 'Unterstützt EncodeX die VP9-Kodierung?',
        a: 'Ja. EncodeX kodiert VP9 mit der Software-libvpx sowie mit VAAPI- und VideoToolbox-Hardwarebeschleunigung, wo verfügbar.',
      },
      {
        q: 'Wann sollte ich VP9 statt H.264 verwenden?',
        a: 'Wählen Sie VP9 für offenes, effizientes Web-Video und Archivierung. Wählen Sie H.264 für maximale Kompatibilität mit älteren Geräten. Mit EncodeX vergleichen Sie einen Testclip in Sekunden.',
      },
    ],
    'codecs/prores': [
      {
        q: 'Was ist Apple ProRes?',
        a: 'ProRes ist der professionelle Zwischencodec der Film- und Broadcast-Branche: hervorragende Qualität, die sich flüssig schneiden lässt, mit keyframe-freundlichem Scrubbing in Final Cut Pro, Premiere Pro und DaVinci Resolve.',
      },
      {
        q: 'Unterstützt EncodeX die ProRes-Kodierung?',
        a: 'Ja. EncodeX enthält fertige ProRes-Profile (422, 422HQ, 4444 und mehr), die unter Windows, Mac und Linux funktionieren.',
      },
      {
        q: 'Warum sind ProRes-Dateien so groß?',
        a: 'ProRes ist ein Zwischenformat für den Schnitt, nicht für die Auslieferung. Nutzen Sie es, um ein Master für eine Schnittsitzung vorzubereiten, und exportieren Sie danach eine kleine Lieferdatei, etwa H.264.',
      },
    ],
    'ffmpeg-gui': [
      {
        q: 'Was ist eine FFmpeg-GUI?',
        a: 'Eine FFmpeg-GUI ist ein visuelles Frontend, das die FFmpeg-Befehlszeilen-Engine in Menüs und Schaltflächen verpackt – konvertieren, komprimieren, schneiden und Audio extrahieren ohne einen einzigen Befehl.',
      },
      {
        q: 'Enthält EncodeX FFmpeg?',
        a: 'Ja. EncodeX bringt die FFmpeg-Engine mit, sodass Sie FFmpeg, Codecs oder sonst nichts separat installieren müssen.',
      },
      {
        q: 'Ist EncodeX eine kostenlose FFmpeg-GUI?',
        a: 'Ja. EncodeX ist für immer kostenlos und Open Source (MIT), ohne Wasserzeichen, ohne Konten und ohne kostenpflichtige Stufe.',
      },
    ],
    'ffmpeg-gui/windows': [
      {
        q: 'Gibt es eine kostenlose FFmpeg-GUI für Windows?',
        a: 'Ja. EncodeX ist eine kostenlose, Open-Source-FFmpeg-GUI für Windows 10 und neuer, ohne Wasserzeichen und ohne kostenpflichtige Stufe.',
      },
      {
        q: 'Nutzt EncodeX unter Windows Hardware-Beschleunigung?',
        a: 'Ja. EncodeX nutzt automatisch NVIDIA NVENC, Intel Quick Sync (QSV) und AMD AMF, um Konvertierungen in einem Bruchteil der Zeit abzuschließen.',
      },
      {
        q: 'Lädt EncodeX unter Windows meine Dateien hoch?',
        a: 'Nein. Alles läuft offline auf Ihrem PC – Ihre Dateien verlassen nie Ihren Computer.',
      },
    ],
    'ffmpeg-gui/macos': [
      {
        q: 'Gibt es eine kostenlose FFmpeg-GUI für Mac?',
        a: 'Ja. EncodeX ist eine kostenlose, Open-Source-FFmpeg-GUI für macOS 11 und neuer, mit einer nativen Apple-Silicon-Build für M-Serie-Macs.',
      },
      {
        q: 'Nutzt EncodeX auf dem Mac Apple VideoToolbox?',
        a: 'Ja. EncodeX nutzt automatisch die Apple-VideoToolbox-Hardwarebeschleunigung auf Apple-Silicon- und Intel-Macs.',
      },
      {
        q: 'Kann ich mit EncodeX auf einem Mac in ProRes konvertieren?',
        a: 'Ja. EncodeX enthält fertige ProRes-422- und 4444-Profile, ideal für Final-Cut-Pro- und DaVinci-Resolve-Workflows.',
      },
    ],
    'ffmpeg-gui/linux': [
      {
        q: 'Gibt es eine kostenlose FFmpeg-GUI für Linux?',
        a: 'Ja. EncodeX ist kostenlos und Open Source, läuft auf den meisten modernen Linux-Distributionen als AppImage und erfordert keine Paket-Fummelei.',
      },
      {
        q: 'Unterstützt EncodeX unter Linux Hardware-Beschleunigung?',
        a: 'Ja. EncodeX unterstützt unter Linux VAAPI – unabhängig von der GPU-Marke – sowie NVENC auf NVIDIA-GPUs.',
      },
      {
        q: 'Kann ich EncodeX auf einem headless Linux-Server verwenden?',
        a: 'Ja. EncodeX enthält einen CLI-Modus zum Skripten von Konvertierungen ohne Desktop, und die integrierte FFmpeg-Engine funktioniert eigenständig.',
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
    'mcp': [
      {
        q: 'O servidor MCP do EncodeX é gratuito?',
        a: 'Sim. O servidor MCP está integrado ao EncodeX, que é gratuito e open source (MIT) — sem licença ou assinatura extra.',
      },
      {
        q: 'Usar MCP faz upload dos meus arquivos?',
        a: 'Não. O EncodeX funciona totalmente offline. O servidor MCP usa o mesmo motor FFmpeg local, então sua mídia nunca sai do seu computador.',
      },
      {
        q: 'Quais assistentes de IA podem se conectar ao EncodeX?',
        a: 'Qualquer cliente compatível com MCP: Claude Desktop, Claude Code, Cursor, VS Code e agentes personalizados. O servidor stdio é um processo JSON-RPC padrão, então qualquer coisa que consiga rodar um comando e falar MCP pode se conectar.',
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
    'convert/avi-to-mp4': [
      {
        q: 'Por que devo converter AVI em MP4?',
        a: 'AVI é um formato antigo que gera arquivos grandes e muitas vezes não é reproduzido em celulares, TVs, consoles e navegadores. MP4 é o formato universal que funciona em quase tudo.',
      },
      {
        q: 'Vou perder qualidade convertendo AVI para MP4?',
        a: 'Não. O EncodeX mantém a qualidade do vídeo e do áudio ao produzir um MP4 moderno e compatível.',
      },
      { q: 'Posso converter muitos arquivos AVI de uma vez?', a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos AVI para MP4.' },
    ],
    'convert/mov-to-mp4': [
      {
        q: 'Por que devo converter MOV em MP4?',
        a: 'MOV é o formato da Apple e muitas vezes não é reproduzido em celulares Android, players do Windows, TVs ou formulários de upload na web. MP4 é o formato universal que funciona em qualquer lugar.',
      },
      {
        q: 'Vou perder qualidade convertendo MOV para MP4?',
        a: 'Não. Por padrão, o EncodeX remuxa os fluxos de vídeo e áudio existentes, então a qualidade permanece exatamente a mesma e a conversão é muito rápida.',
      },
      { q: 'Posso converter muitos arquivos MOV de uma vez?', a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos MOV para MP4.' },
    ],
    'convert/m4v-to-mp4': [
      {
        q: 'Por que devo converter M4V em MP4?',
        a: 'M4V é o contêiner da Apple para compras do iTunes e Apple TV, e muitas vezes traz restrições de reprodução. MP4 é o formato aberto e universal que funciona em qualquer dispositivo.',
      },
      {
        q: 'O EncodeX remove o DRM de arquivos M4V?',
        a: 'Se um arquivo estiver bloqueado por DRM e não abrir em outros apps, reproduza-o primeiro na sua biblioteca licenciada. O EncodeX converte o vídeo desbloqueado ao qual você já tem acesso em um MP4 aberto.',
      },
      { q: 'Posso converter vários arquivos M4V de uma vez?', a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos M4V para MP4.' },
    ],
    'convert/flv-to-mp4': [
      {
        q: 'Por que devo converter FLV em MP4?',
        a: 'FLV é um formato da era do Flash e a maioria dos dispositivos, TVs, celulares, apps de edição e navegadores abandonou o suporte há anos. MP4 é o formato moderno universal.',
      },
      {
        q: 'Vou perder qualidade convertendo FLV para MP4?',
        a: 'Não. O EncodeX re-codifica seu FLV em MP4 de forma limpa, mantendo a qualidade do vídeo enquanto moderniza o formato.',
      },
      { q: 'Posso converter muitos arquivos FLV de uma vez?', a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos FLV para MP4.' },
    ],
    'convert/wmv-to-mp4': [
      {
        q: 'Por que devo converter WMV em MP4?',
        a: 'WMV é um formato da Microsoft que fica quase só no Windows e muitas vezes não é reproduzido em Macs, celulares, tablets, TVs ou navegadores modernos. MP4 funciona em quase tudo.',
      },
      {
        q: 'Vou perder qualidade convertendo WMV para MP4?',
        a: 'Não. O EncodeX converte seu WMV em MP4 de forma limpa, mantendo a qualidade do vídeo.',
      },
      { q: 'Posso converter muitos arquivos WMV de uma vez?', a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos WMV para MP4.' },
    ],
    'convert/webm-to-mp4': [
      {
        q: 'Por que devo converter WebM em MP4?',
        a: 'WebM vem de navegadores, gravadores de tela e extensões do Chrome, mas o suporte é inconsistente em apps de edição, celulares, TVs e players antigos. MP4 funciona em quase tudo.',
      },
      {
        q: 'Vou perder qualidade convertendo WebM para MP4?',
        a: 'Não. O EncodeX converte seu WebM em um MP4 altamente compatível, mantendo a qualidade do vídeo.',
      },
      { q: 'Posso converter muitos arquivos WebM de uma vez?', a: 'Sim. O EncodeX suporta conversão em lote de uma pasta inteira de arquivos WebM para MP4.' },
    ],
    'codecs/h264': [
      {
        q: 'O que é H.264 e por que ele está em todo lugar?',
        a: 'H.264 (AVC) é o codec de vídeo mais compatível do mundo: funciona em celulares, TVs, consoles, navegadores e software de edição, e é o padrão no YouTube, Instagram e na maioria das plataformas.',
      },
      {
        q: 'O EncodeX usa aceleração de hardware para codificar H.264?',
        a: 'Sim. O EncodeX usa NVENC na NVIDIA, Quick Sync na Intel, AMF na AMD, VideoToolbox no Apple Silicon e VAAPI no Linux, então a conversão para H.264 é muito mais rápida sem configuração.',
      },
      {
        q: 'MP4 + H.264 é a combinação mais compatível?',
        a: 'Sim. Combinar vídeo H.264 com áudio AAC em um contêiner MP4 é a configuração mais compatível que existe, e o EncodeX a torna a opção fácil padrão quando você escolhe saída MP4.',
      },
    ],
    'codecs/h265': [
      {
        q: 'Qual é a vantagem do H.265 sobre o H.264?',
        a: 'H.265 (HEVC) entrega aproximadamente metade do tamanho de arquivo do H.264 com qualidade semelhante, e é feito para conteúdo 4K e HDR.',
      },
      {
        q: 'O EncodeX suporta codificação H.265 acelerada por hardware?',
        a: 'Sim. O EncodeX usa automaticamente o codificador HEVC por hardware do seu dispositivo: NVENC, Quick Sync, AMF, VAAPI ou VideoToolbox.',
      },
      {
        q: 'Arquivos H.265 são reproduzidos em qualquer lugar?',
        a: 'H.265 tem amplo suporte em celulares, TVs e consoles dos últimos anos. Para máxima compatibilidade com dispositivos antigos, H.264 em MP4 ainda é a opção mais segura.',
      },
    ],
    'codecs/av1': [
      {
        q: 'O que é AV1 e por que usar?',
        a: 'AV1 é o codec de vídeo mais eficiente disponível hoje, entregando o menor tamanho de arquivo para uma determinada qualidade — até cerca de 30% menor que H.265. É livre de royalties e usado pelo YouTube e Netflix.',
      },
      {
        q: 'O EncodeX suporta codificação AV1?',
        a: 'Sim. O EncodeX oferece codificadores AV1 por software (libaom, SVT-AV1, rav1e) além de codificadores AV1 por hardware onde sua GPU oferecer.',
      },
      {
        q: 'A codificação AV1 é lenta?',
        a: 'AV1 exige mais processamento que H.264 ou H.265. É melhor para arquivamento e entrega web onde o tamanho importa mais, e não para conversões rápidas do dia a dia.',
      },
    ],
    'codecs/vp9': [
      {
        q: 'O que é VP9?',
        a: 'VP9 é o codec de vídeo aberto e livre de royalties do Google — o cavalo de batalha por trás do YouTube, Chrome e Android — com cerca de metade do tamanho do H.264 em qualidade semelhante.',
      },
      {
        q: 'O EncodeX suporta codificação VP9?',
        a: 'Sim. O EncodeX codifica VP9 com libvpx por software, além de aceleração de hardware VAAPI e VideoToolbox onde disponível.',
      },
      {
        q: 'Quando devo usar VP9 em vez de H.264?',
        a: 'Escolha VP9 para vídeo web aberto, eficiente e para arquivamento. Escolha H.264 para máxima compatibilidade com dispositivos antigos. Com o EncodeX, compare um clipe de teste em segundos.',
      },
    ],
    'codecs/prores': [
      {
        q: 'O que é Apple ProRes?',
        a: 'ProRes é o codec intermediário profissional usado em toda a indústria de cinema e broadcast: excelente qualidade que edita com fluidez, com scrubbing favorável a keyframes no Final Cut Pro, Premiere Pro e DaVinci Resolve.',
      },
      {
        q: 'O EncodeX suporta codificação ProRes?',
        a: 'Sim. O EncodeX inclui perfis prontos de ProRes 422, 422HQ, 4444 e mais, que funcionam no Windows, Mac e Linux.',
      },
      {
        q: 'Por que arquivos ProRes são tão grandes?',
        a: 'ProRes é um formato intermediário para edição, não para entrega. Use-o para preparar um master para uma sessão de edição e depois exporte um arquivo pequeno de entrega, como H.264.',
      },
    ],
    'ffmpeg-gui': [
      {
        q: 'O que é uma interface gráfica para FFmpeg?',
        a: 'Uma interface gráfica para FFmpeg é um front-end visual que envolve o motor de linha de comando do FFmpeg em menus e botões, para converter, comprimir, cortar e extrair áudio sem digitar um único comando.',
      },
      {
        q: 'O EncodeX inclui o FFmpeg?',
        a: 'Sim. O EncodeX traz o motor FFmpeg embutido, então você nunca instala FFmpeg, codecs ou qualquer outra coisa separadamente.',
      },
      {
        q: 'O EncodeX é uma interface gráfica gratuita para FFmpeg?',
        a: 'Sim. O EncodeX é gratuito para sempre e open source (MIT), sem marcas d\'água, sem contas e sem plano pago.',
      },
    ],
    'ffmpeg-gui/windows': [
      {
        q: 'Existe uma interface gráfica gratuita para FFmpeg no Windows?',
        a: 'Sim. O EncodeX é uma interface gráfica gratuita e open source para FFmpeg no Windows 10 e mais recente, sem marcas d\'água e sem plano pago.',
      },
      {
        q: 'O EncodeX usa aceleração de hardware no Windows?',
        a: 'Sim. O EncodeX usa automaticamente NVIDIA NVENC, Intel Quick Sync (QSV) e AMD AMF para terminar conversões em uma fração do tempo.',
      },
      {
        q: 'O EncodeX envia meus arquivos no Windows?',
        a: 'Não. Tudo roda offline no seu PC — seus arquivos nunca saem do seu computador.',
      },
    ],
    'ffmpeg-gui/macos': [
      {
        q: 'Existe uma interface gráfica gratuita para FFmpeg no Mac?',
        a: 'Sim. O EncodeX é uma interface gráfica gratuita e open source para FFmpeg no macOS 11 e mais recente, com uma build nativa para Apple Silicon em Macs com chip M.',
      },
      {
        q: 'O EncodeX usa Apple VideoToolbox no Mac?',
        a: 'Sim. O EncodeX usa automaticamente a aceleração de hardware Apple VideoToolbox em Macs Apple Silicon e Intel.',
      },
      {
        q: 'Posso converter para ProRes em um Mac com o EncodeX?',
        a: 'Sim. O EncodeX inclui perfis prontos de ProRes 422 e 4444, perfeitos para fluxos do Final Cut Pro e DaVinci Resolve.',
      },
    ],
    'ffmpeg-gui/linux': [
      {
        q: 'Existe uma interface gráfica gratuita para FFmpeg no Linux?',
        a: 'Sim. O EncodeX é gratuito e open source, roda na maioria das distribuições Linux modernas como AppImage e não exige sofrer com pacotes.',
      },
      {
        q: 'O EncodeX suporta aceleração de hardware no Linux?',
        a: 'Sim. O EncodeX suporta VAAPI no Linux — independente da marca da GPU — além de NVENC em GPUs NVIDIA.',
      },
      {
        q: 'Posso usar o EncodeX em um servidor Linux sem interface gráfica?',
        a: 'Sim. O EncodeX inclui um modo CLI para automatizar conversões com scripts sem área de trabalho, e o motor FFmpeg embutido funciona de forma autônoma.',
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
    'mcp': [
      {
        q: 'EncodeX 的 MCP 服务器免费吗？',
        a: '免费。MCP 服务器内置在免费、开源的（MIT）EncodeX 中，无需额外许可或订阅。',
      },
      {
        q: '使用 MCP 会上传我的文件吗？',
        a: '不会。EncodeX 完全离线运行。MCP 服务器驱动的是同一套本地 FFmpeg 引擎，您的媒体文件永远不会离开您的电脑。',
      },
      {
        q: '哪些 AI 助手可以连接 EncodeX？',
        a: '任何兼容 MCP 的客户端：Claude Desktop、Claude Code、Cursor、VS Code 和自定义代理。stdio 服务器是标准 JSON-RPC 进程，所以任何能启动命令并支持 MCP 的工具都可以连接。',
      },
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
    'convert/avi-to-mp4': [
      {
        q: '为什么要把 AVI 转成 MP4？',
        a: 'AVI 是一种较老的格式，会产生很大的文件，而且经常无法在手机、电视、游戏主机和浏览器上播放。MP4 是几乎随处可用的通用格式。',
      },
      {
        q: '将 AVI 转成 MP4 会丢失质量吗？',
        a: '不会。EncodeX 在生成现代、兼容的 MP4 文件时会完整保留视频和音频质量。',
      },
      { q: '我可以一次转换多个 AVI 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 AVI 文件批量转换为 MP4。' },
    ],
    'convert/mov-to-mp4': [
      {
        q: '为什么要把 MOV 转成 MP4？',
        a: 'MOV 是苹果的格式，通常无法在安卓手机、Windows 播放器、电视或网页上传表单中播放。MP4 是随处可用的通用格式。',
      },
      {
        q: '将 MOV 转成 MP4 会丢失质量吗？',
        a: '不会。默认情况下 EncodeX 会重新封装（remux）现有的视频和音频流，因此质量完全不变，转换也很快。',
      },
      { q: '我可以一次转换多个 MOV 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 MOV 文件批量转换为 MP4。' },
    ],
    'convert/m4v-to-mp4': [
      {
        q: '为什么要把 M4V 转成 MP4？',
        a: 'M4V 是苹果用于 iTunes 和 Apple TV 购买的容器格式，通常带有播放限制。MP4 是可在任何设备上播放的开放通用格式。',
      },
      {
        q: 'EncodeX 能去除 M4V 文件的 DRM 吗？',
        a: '如果文件受 DRM 保护、无法在其他应用中打开，请先在您的授权媒体库中播放。EncodeX 将您已经可以访问的已解锁视频转换为开放的 MP4。',
      },
      { q: '我可以一次批量转换 M4V 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 M4V 文件批量转换为 MP4。' },
    ],
    'convert/flv-to-mp4': [
      {
        q: '为什么要把 FLV 转成 MP4？',
        a: 'FLV 是 Flash 时代的格式，大多数设备、电视、手机、剪辑应用和浏览器多年前就已停止支持。MP4 是现代的通用格式。',
      },
      {
        q: '将 FLV 转成 MP4 会丢失质量吗？',
        a: '不会。EncodeX 会将 FLV 干净地重新编码为 MP4，在现代化格式的同时保持视频质量。',
      },
      { q: '我可以一次转换多个 FLV 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 FLV 文件批量转换为 MP4。' },
    ],
    'convert/wmv-to-mp4': [
      {
        q: '为什么要把 WMV 转成 MP4？',
        a: 'WMV 是微软的格式，通常主要停留在 Windows，在 Mac、手机、平板、电视或现代浏览器上往往无法播放。MP4 几乎到处都能用。',
      },
      {
        q: '将 WMV 转成 MP4 会丢失质量吗？',
        a: '不会。EncodeX 会将 WMV 干净地转换为 MP4，并保持视频质量。',
      },
      { q: '我可以一次转换多个 WMV 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 WMV 文件批量转换为 MP4。' },
    ],
    'convert/webm-to-mp4': [
      {
        q: '为什么要把 WebM 转成 MP4？',
        a: 'WebM 来自浏览器、录屏工具和 Chrome 扩展，但在剪辑应用、手机、电视和老旧播放器中的支持不一致。MP4 几乎到处都能播放。',
      },
      {
        q: '将 WebM 转成 MP4 会丢失质量吗？',
        a: '不会。EncodeX 会将 WebM 转换为高度兼容的 MP4，并保持视频质量。',
      },
      { q: '我可以一次转换多个 WebM 文件吗？', a: '可以。EncodeX 支持将整个文件夹的 WebM 文件批量转换为 MP4。' },
    ],
    'codecs/h264': [
      {
        q: '什么是 H.264，为什么它无处不在？',
        a: 'H.264（AVC）是世界上最广泛支持的视频编解码器：可在手机、电视、游戏主机、浏览器和剪辑软件上播放，也是 YouTube、Instagram 和大多数平台的标准。',
      },
      {
        q: 'EncodeX 会为 H.264 编码使用硬件加速吗？',
        a: '会。EncodeX 在 NVIDIA 上使用 NVENC、Intel 上使用 Quick Sync、AMD 上使用 AMF、Apple Silicon 上使用 VideoToolbox、Linux 上使用 VAAPI，无需设置即可大幅加快 H.264 转换。',
      },
      {
        q: 'MP4 + H.264 是最兼容的组合吗？',
        a: '是的。将 H.264 视频与 AAC 音频组合在 MP4 容器中就是最兼容的配置，而 EncodeX 在您选择 MP4 输出时默认就会采用这个组合。',
      },
    ],
    'codecs/h265': [
      {
        q: 'H.265 相比 H.264 有什么优势？',
        a: 'H.265（HEVC）在相同质量下文件大小约为 H.264 的一半，并且专为 4K 和 HDR 内容而设计。',
      },
      {
        q: 'EncodeX 支持硬件加速的 H.265 编码吗？',
        a: '支持。EncodeX 会自动使用设备内置的硬件 HEVC 编码器：NVENC、Quick Sync、AMF、VAAPI 或 VideoToolbox。',
      },
      {
        q: 'H.265 文件能被随处播放吗？',
        a: 'H.265 在近几年的手机、电视和游戏主机上得到广泛支持。若追求与老设备的最大兼容性，MP4 中的 H.264 仍是最稳妥的选择。',
      },
    ],
    'codecs/av1': [
      {
        q: '什么是 AV1，为什么要用它？',
        a: 'AV1 是目前最高效的主流视频编解码器，在同等质量下文件最小——比 H.265 小约 30%。它免版税，并被 YouTube 和 Netflix 使用。',
      },
      {
        q: 'EncodeX 支持 AV1 编码吗？',
        a: '支持。EncodeX 提供软件 AV1 编码器（libaom、SVT-AV1、rav1e），并在您的 GPU 支持时提供硬件 AV1 编码器。',
      },
      {
        q: 'AV1 编码慢吗？',
        a: 'AV1 编码比 H.264 或 H.265 更耗费算力。它最适合压缩需求突出的存档和网页交付场景，而不是日常快速转换。',
      },
    ],
    'codecs/vp9': [
      {
        q: '什么是 VP9？',
        a: 'VP9 是谷歌开放、免版税的视频编解码器——YouTube、Chrome 和安卓背后的主力，在相似质量下文件大小约为 H.264 的一半。',
      },
      {
        q: 'EncodeX 支持 VP9 编码吗？',
        a: '支持。EncodeX 使用软件 libvpx 编码 VP9，并在可用时使用 VAAPI 和 VideoToolbox 硬件加速。',
      },
      {
        q: '什么时候该用 VP9 而不是 H.264？',
        a: '需要开放、高效的网页视频和存档时选择 VP9；需要与旧设备最大兼容时选择 H.264。用 EncodeX 几秒钟就能对比一个测试片段。',
      },
    ],
    'codecs/prores': [
      {
        q: '什么是 Apple ProRes？',
        a: 'ProRes 是电影和广播行业广泛使用的专业中间编解码器：画质出色、剪辑流畅，在 Final Cut Pro、Premiere Pro 和 DaVinci Resolve 中支持关键帧友好型的拖动预览。',
      },
      {
        q: 'EncodeX 支持 ProRes 编码吗？',
        a: '支持。EncodeX 内置 ProRes 422、422HQ、4444 等现成配置，可在 Windows、Mac 和 Linux 上使用。',
      },
      {
        q: '为什么 ProRes 文件那么大？',
        a: 'ProRes 是用于剪辑的中间格式，而非交付格式。用它为剪辑会话准备母版，之后再导出 H.264 这样的小型交付文件。',
      },
    ],
    'ffmpeg-gui': [
      {
        q: '什么是 FFmpeg 图形界面？',
        a: 'FFmpeg 图形界面是一种可视化前端，将 FFmpeg 命令行引擎封装在菜单和按钮中，您无需输入任何命令即可转换、压缩、裁剪和提取音频。',
      },
      {
        q: 'EncodeX 自带 FFmpeg 吗？',
        a: '是的。EncodeX 内置 FFmpeg 引擎，因此您永远不需要单独安装 FFmpeg、编解码器或任何其他内容。',
      },
      {
        q: 'EncodeX 是免费的 FFmpeg 图形界面吗？',
        a: '是的。EncodeX 永久免费且开源（MIT），无水印、无需账号、无付费版本。',
      },
    ],
    'ffmpeg-gui/windows': [
      {
        q: '有免费的 Windows FFmpeg 图形界面吗？',
        a: '有。EncodeX 是一款免费开源的 FFmpeg 图形界面，支持 Windows 10 及更高版本，无水印、无付费版本。',
      },
      {
        q: 'EncodeX 在 Windows 上使用硬件加速吗？',
        a: '是的。EncodeX 自动使用 NVIDIA NVENC、Intel Quick Sync（QSV）和 AMD AMF，以更短的时间完成转换。',
      },
      {
        q: 'EncodeX 在 Windows 上会上传我的文件吗？',
        a: '不会。一切都在您的电脑上离线进行——文件绝不会离开您的计算机。',
      },
    ],
    'ffmpeg-gui/macos': [
      {
        q: '有免费的 Mac FFmpeg 图形界面吗？',
        a: '有。EncodeX 是一款免费开源的 FFmpeg 图形界面，支持 macOS 11 及更高版本，并为 M 系列芯片的 Mac 提供原生 Apple Silicon 版本。',
      },
      {
        q: 'EncodeX 在 Mac 上使用 Apple VideoToolbox 吗？',
        a: '是的。EncodeX 在 Apple Silicon 和 Intel Mac 上自动使用 Apple VideoToolbox 硬件加速。',
      },
      {
        q: '能用 EncodeX 在 Mac 上转换 ProRes 吗？',
        a: '可以。EncodeX 内置现成的 ProRes 422 和 4444 配置，非常适合 Final Cut Pro 和 DaVinci Resolve 工作流。',
      },
    ],
    'ffmpeg-gui/linux': [
      {
        q: '有免费的 Linux FFmpeg 图形界面吗？',
        a: '有。EncodeX 免费且开源，以 AppImage 形式运行于大多数现代 Linux 发行版，无需折腾软件包。',
      },
      {
        q: 'EncodeX 在 Linux 上支持硬件加速吗？',
        a: '支持。EncodeX 在 Linux 上支持 VAAPI（与 GPU 品牌无关），以及 NVIDIA GPU 上的 NVENC。',
      },
      {
        q: '我可以在无图形界面的 Linux 服务器上使用 EncodeX 吗？',
        a: '可以。EncodeX 提供 CLI 模式，无需桌面即可通过脚本自动化转换，内置 FFmpeg 引擎也可独立运行。',
      },
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
    'mcp': [
      {
        q: 'क्या EncodeX का MCP सर्वर मुफ़्त है?',
        a: 'हाँ। MCP सर्वर मुफ़्त, ओपन-सोर्स (MIT) EncodeX ऐप में बिल्ट-इन है — कोई अतिरिक्त लाइसेंस या सब्सक्रिप्शन नहीं।',
      },
      {
        q: 'क्या MCP इस्तेमाल करने से मेरी फ़ाइलें अपलोड होती हैं?',
        a: 'नहीं। EncodeX पूरी तरह ऑफ़लाइन चलता है। MCP सर्वर वही लोकल FFmpeg इंजन चलाता है, इसलिए आपका मीडिया कभी आपके कंप्यूटर से बाहर नहीं जाता।',
      },
      {
        q: 'कौन से AI असिस्टेंट EncodeX से जुड़ सकते हैं?',
        a: 'कोई भी MCP-कंपैटिबल क्लाइंट: Claude Desktop, Claude Code, Cursor, VS Code और कस्टम एजेंट। stdio सर्वर एक मानक JSON-RPC प्रोसेस है, इसलिए जो भी कमांड चला सकता है और MCP बोल सकता है, वह जुड़ सकता है।',
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
    'convert/avi-to-mp4': [
      {
        q: 'मुझे AVI को MP4 में क्यों बदलना चाहिए?',
        a: 'AVI एक पुराना प्रारूप है जो बड़ी फ़ाइलें बनाता है और अक्सर फ़ोन, टीवी, कंसोल और ब्राउज़र पर नहीं चलता। MP4 वह सार्वभौमिक प्रारूप है जो लगभग हर जगह चलता है।',
      },
      {
        q: 'क्या AVI से MP4 बदलने में गुणवत्ता घटेगी?',
        a: 'नहीं। EncodeX आधुनिक, कंपैटिबल MP4 फ़ाइल बनाते हुए आपके वीडियो और ऑडियो की गुणवत्ता बरकरार रखता है।',
      },
      { q: 'क्या मैं एक साथ कई AVI फ़ाइलें बदल सकता हूँ?', a: 'हाँ। EncodeX AVI फ़ाइलों के पूरे फ़ोल्डर को MP4 में बैच कनवर्ट करने का समर्थन करता है।' },
    ],
    'convert/mov-to-mp4': [
      {
        q: 'मुझे MOV को MP4 में क्यों बदलना चाहिए?',
        a: 'MOV Apple का प्रारूप है और अक्सर Android फ़ोन, Windows प्लेयर, टीवी या वेब अपलोड फ़ॉर्म पर नहीं चलता। MP4 वह सार्वभौमिक प्रारूप है जो हर जगह चलता है।',
      },
      {
        q: 'क्या MOV से MP4 बदलने में गुणवत्ता घटेगी?',
        a: 'नहीं। डिफ़ॉल्ट रूप से EncodeX मौजूदा वीडियो और ऑडियो स्ट्रीम को रीमक्स करता है, इसलिए गुणवत्ता बिल्कुल समान रहती है और रूपांतरण बहुत तेज़ है।',
      },
      { q: 'क्या मैं एक साथ कई MOV फ़ाइलें बदल सकता हूँ?', a: 'हाँ। EncodeX MOV फ़ाइलों के पूरे फ़ोल्डर को MP4 में बैच कनवर्ट करने का समर्थन करता है।' },
    ],
    'convert/m4v-to-mp4': [
      {
        q: 'मुझे M4V को MP4 में क्यों बदलना चाहिए?',
        a: 'M4V iTunes और Apple TV खरीदों के लिए Apple का कंटेनर है, और इसमें अक्सर प्लेबैक प्रतिबंध होते हैं। MP4 खुला, सार्वभौमिक प्रारूप है जो किसी भी डिवाइस पर चलता है।',
      },
      {
        q: 'क्या EncodeX M4V फ़ाइलों से DRM हटाता है?',
        a: 'यदि कोई फ़ाइल DRM-लॉक है और दूसरी ऐप्स में नहीं खुलती, तो पहले उसे अपनी लाइसेंस वाली लाइब्रेरी में चलाएँ। EncodeX उस अनलॉक किए गए वीडियो को, जिसे आप पहले से एक्सेस कर सकते हैं, ओपन MP4 में बदलता है।',
      },
      { q: 'क्या मैं एक साथ कई M4V फ़ाइलें बदल सकता हूँ?', a: 'हाँ। EncodeX M4V फ़ाइलों के पूरे फ़ोल्डर को MP4 में बैच कनवर्ट करने का समर्थन करता है।' },
    ],
    'convert/flv-to-mp4': [
      {
        q: 'मुझे FLV को MP4 में क्यों बदलना चाहिए?',
        a: 'FLV Flash-युग का प्रारूप है और ज़्यादातर डिवाइस, टीवी, फ़ोन, एडिटिंग ऐप्स और ब्राउज़र ने सालों पहले इसका समर्थन छोड़ दिया। MP4 आधुनिक, सार्वभौमिक प्रारूप है।',
      },
      {
        q: 'क्या FLV से MP4 बदलने में गुणवत्ता घटेगी?',
        a: 'नहीं। EncodeX आपके FLV को साफ़-सुथरा MP4 में री-कोड करता है, प्रारूप को आधुनिक बनाते हुए वीडियो गुणवत्ता बनाए रखता है।',
      },
      { q: 'क्या मैं एक साथ कई FLV फ़ाइलें बदल सकता हूँ?', a: 'हाँ। EncodeX FLV फ़ाइलों के पूरे फ़ोल्डर को MP4 में बैच कनवर्ट करने का समर्थन करता है।' },
    ],
    'convert/wmv-to-mp4': [
      {
        q: 'मुझे WMV को MP4 में क्यों बदलना चाहिए?',
        a: 'WMV Microsoft का प्रारूप है जो ज़्यादातर Windows तक सीमित रहता है और अक्सर Mac, फ़ोन, टैबलेट, टीवी या आधुनिक ब्राउज़र पर नहीं चलता। MP4 लगभग हर जगह काम करता है।',
      },
      {
        q: 'क्या WMV से MP4 बदलने में गुणवत्ता घटेगी?',
        a: 'नहीं। EncodeX आपके WMV को साफ़-सुथरा MP4 में बदलता है और वीडियो की गुणवत्ता बनाए रखता है।',
      },
      { q: 'क्या मैं एक साथ कई WMV फ़ाइलें बदल सकता हूँ?', a: 'हाँ। EncodeX WMV फ़ाइलों के पूरे फ़ोल्डर को MP4 में बैच कनवर्ट करने का समर्थन करता है।' },
    ],
    'convert/webm-to-mp4': [
      {
        q: 'मुझे WebM को MP4 में क्यों बदलना चाहिए?',
        a: 'WebM ब्राउज़र, स्क्रीन रिकॉर्डर और Chrome एक्सटेंशन से आता है, लेकिन एडिटिंग ऐप्स, फ़ोन, टीवी और पुराने प्लेयर्स में समर्थन असमान है। MP4 लगभग हर जगह चलता है।',
      },
      {
        q: 'क्या WebM से MP4 बदलने में गुणवत्ता घटेगी?',
        a: 'नहीं। EncodeX आपके WebM को अत्यधिक कंपैटिबल MP4 में बदलता है और वीडियो की गुणवत्ता बनाए रखता है।',
      },
      { q: 'क्या मैं एक साथ कई WebM फ़ाइलें बदल सकता हूँ?', a: 'हाँ। EncodeX WebM फ़ाइलों के पूरे फ़ोल्डर को MP4 में बैच कनवर्ट करने का समर्थन करता है।' },
    ],
    'codecs/h264': [
      {
        q: 'H.264 क्या है और यह हर जगह क्यों है?',
        a: 'H.264 (AVC) दुनिया में सबसे व्यापक रूप से समर्थित वीडियो कोडेक है – यह फ़ोन, टीवी, कंसोल, ब्राउज़र और एडिटिंग सॉफ़्टवेयर पर चलता है, और YouTube, Instagram और ज़्यादातर प्लेटफ़ॉर्म का मानक है।',
      },
      {
        q: 'क्या EncodeX H.264 एन्कोडिंग के लिए हार्डवेयर एक्सेलेरेशन उपयोग करता है?',
        a: 'हाँ। EncodeX NVIDIA पर NVENC, Intel पर Quick Sync, AMD पर AMF, Apple Silicon पर VideoToolbox और Linux पर VAAPI उपयोग करता है, जिससे H.264 रूपांतरण बिना सेटअप के काफ़ी तेज़ हो जाता है।',
      },
      {
        q: 'क्या MP4 + H.264 सबसे कंपैटिबल संयोजन है?',
        a: 'हाँ। H.264 वीडियो को AAC ऑडियो के साथ MP4 कंटेनर में जोड़ना सबसे कंपैटिबल सेटअप है – और EncodeX इसे MP4 आउटपुट चुनते ही डिफ़ॉल्ट विकल्प बना देता है।',
      },
    ],
    'codecs/h265': [
      {
        q: 'H.265 की H.264 पर क्या बढ़त है?',
        a: 'H.265 (HEVC) समान गुणवत्ता पर H.264 की लगभग आधी फ़ाइल साइज़ देता है, और यह 4K व HDR कंटेंट के लिए बना है।',
      },
      {
        q: 'क्या EncodeX हार्डवेयर-एक्सेलरेटेड H.265 एन्कोडिंग का समर्थन करता है?',
        a: 'हाँ। EncodeX आपके डिवाइस में बने हार्डवेयर HEVC एन्कोडर का स्वचालित रूप से उपयोग करता है – NVENC, Quick Sync, AMF, VAAPI या VideoToolbox।',
      },
      {
        q: 'क्या H.265 फ़ाइलें हर जगह चलती हैं?',
        a: 'H.265 को हाल के सालों के फ़ोन, टीवी और कंसोल पर व्यापक रूप से समर्थन मिलता है। पुराने डिवाइसों से अधिकतम कंपैटिबिलिटी के लिए MP4 में H.264 ही सबसे सुरक्षित विकल्प है।',
      },
    ],
    'codecs/av1': [
      {
        q: 'AV1 क्या है और इसे क्यों उपयोग करें?',
        a: 'AV1 आज उपलब्ध सबसे कुशल मुख्यधारा वीडियो कोडेक है, जो किसी दी गई गुणवत्ता पर सबसे छोटी फ़ाइल देता है – H.265 से लगभग 30% छोटी। यह रॉयल्टी-मुक्त है और YouTube व Netflix उपयोग करते हैं।',
      },
      {
        q: 'क्या EncodeX AV1 एन्कोडिंग का समर्थन करता है?',
        a: 'हाँ। EncodeX सॉफ़्टवेयर AV1 एन्कोडर (libaom, SVT-AV1, rav1e) के साथ-साथ हार्डवेयर AV1 एन्कोडर भी देता है, जहाँ आपका GPU उन्हें प्रदान करता है।',
      },
      {
        q: 'क्या AV1 एन्कोडिंग धीमी है?',
        a: 'AV1 एन्कोडिंग H.264 या H.265 से ज़्यादा संसाधन मांगती है। यह आर्काइविंग और वेब डिलीवरी के लिए सबसे अच्छा है जहाँ साइज़ सबसे ज़्यादा मायने रखती है, न कि रोज़मर्रा के तेज़ रूपांतरणों के लिए।',
      },
    ],
    'codecs/vp9': [
      {
        q: 'VP9 क्या है?',
        a: 'VP9 Google का खुला, रॉयल्टी-मुक्त वीडियो कोडेक है – YouTube, Chrome और Android के पीछे का वर्कहॉर्स – जो समान गुणवत्ता पर H.264 से लगभग आधी फ़ाइल साइज़ देता है।',
      },
      {
        q: 'क्या EncodeX VP9 एन्कोडिंग का समर्थन करता है?',
        a: 'हाँ। EncodeX VP9 को सॉफ़्टवेयर libvpx से एन्कोड करता है, साथ ही VAAPI और VideoToolbox हार्डवेयर एक्सेलेरेशन जहाँ उपलब्ध हो।',
      },
      {
        q: 'H.264 के बजाय VP9 कब उपयोग करना चाहिए?',
        a: 'खुले, कुशल वेब-रेडी वीडियो और आर्काइविंग के लिए VP9 चुनें। पुराने डिवाइसों से अधिकतम कंपैटिबिलिटी के लिए H.264 चुनें। EncodeX से आप कुछ सेकंड में ही टेस्ट क्लिप की तुलना कर सकते हैं।',
      },
    ],
    'codecs/prores': [
      {
        q: 'Apple ProRes क्या है?',
        a: 'ProRes फ़िल्म और प्रसारण इंडस्ट्री में उपयोग होने वाला पेशेवर इंटरमीडिएट कोडेक है – बेहतरीन क्वालिटी जो सहजता से एडिट होती है, Final Cut Pro, Premiere Pro और DaVinci Resolve में keyframe-friendly scrubbing के साथ।',
      },
      {
        q: 'क्या EncodeX ProRes एन्कोडिंग का समर्थन करता है?',
        a: 'हाँ। EncodeX में तैयार ProRes 422, 422HQ, 4444 और अधिक प्रोफ़ाइल शामिल हैं, जो Windows, Mac और Linux पर काम करती हैं।',
      },
      {
        q: 'ProRes फ़ाइलें इतनी बड़ी क्यों होती हैं?',
        a: 'ProRes एडिटिंग के लिए इंटरमीडिएट प्रारूप है, डिलीवरी के लिए नहीं। इसे एडिटिंग सत्र के लिए मास्टर तैयार करने में उपयोग करें, फिर H.264 जैसी छोटी डिलीवरी फ़ाइल एक्सपोर्ट करें।',
      },
    ],
    'ffmpeg-gui': [
      {
        q: 'FFmpeg GUI क्या है?',
        a: 'FFmpeg GUI एक विज़ुअल फ्रंटएंड है जो FFmpeg कमांड-लाइन इंजन को मेन्यू और बटन में लपेटता है, ताकि आप बिना एक भी कमांड टाइप किए कनवर्ट, कंप्रेस, ट्रिम और ऑडियो निकाल सकें।',
      },
      {
        q: 'क्या EncodeX FFmpeg के साथ आता है?',
        a: 'हाँ। EncodeX FFmpeg इंजन अपने साथ लाता है, इसलिए आपको FFmpeg, कोडेक्स या कुछ भी अलग से इंस्टॉल करने की ज़रूरत नहीं पड़ती।',
      },
      {
        q: 'क्या EncodeX मुफ़्त FFmpeg GUI है?',
        a: 'हाँ। EncodeX हमेशा के लिए मुफ़्त और ओपन सोर्स (MIT) है, बिना वॉटरमार्क, बिना खाते और बिना पेड टियर के।',
      },
    ],
    'ffmpeg-gui/windows': [
      {
        q: 'क्या Windows के लिए मुफ़्त FFmpeg GUI है?',
        a: 'हाँ। EncodeX Windows 10 और नए के लिए मुफ़्त, ओपन-सोर्स FFmpeg GUI है, बिना वॉटरमार्क और बिना पेड टियर के।',
      },
      {
        q: 'क्या EncodeX Windows पर हार्डवेयर एक्सेलेरेशन उपयोग करता है?',
        a: 'हाँ। EncodeX स्वचालित रूप से NVIDIA NVENC, Intel Quick Sync (QSV) और AMD AMF उपयोग करता है, जिससे कनवर्ज़न बहुत कम समय में पूरे होते हैं।',
      },
      {
        q: 'क्या EncodeX Windows पर मेरी फ़ाइलें अपलोड करता है?',
        a: 'नहीं। सब कुछ आपके PC पर ऑफ़लाइन चलता है – आपकी फ़ाइलें कभी आपके कंप्यूटर से बाहर नहीं जातीं।',
      },
    ],
    'ffmpeg-gui/macos': [
      {
        q: 'क्या Mac के लिए मुफ़्त FFmpeg GUI है?',
        a: 'हाँ। EncodeX macOS 11 और नए के लिए मुफ़्त, ओपन-सोर्स FFmpeg GUI है, और M-सीरीज़ Macs के लिए नेटिव Apple Silicon बिल्ड भी।',
      },
      {
        q: 'क्या EncodeX Mac पर Apple VideoToolbox उपयोग करता है?',
        a: 'हाँ। EncodeX Apple Silicon और Intel दोनों Macs पर Apple VideoToolbox हार्डवेयर एक्सेलेरेशन का स्वचालित रूप से उपयोग करता है।',
      },
      {
        q: 'क्या मैं Mac पर EncodeX से ProRes में कनवर्ट कर सकता हूँ?',
        a: 'हाँ। EncodeX में तैयार ProRes 422 और 4444 प्रोफ़ाइल शामिल हैं, जो Final Cut Pro और DaVinci Resolve वर्कफ़्लो के लिए परफेक्ट हैं।',
      },
    ],
    'ffmpeg-gui/linux': [
      {
        q: 'क्या Linux के लिए मुफ़्त FFmpeg GUI है?',
        a: 'हाँ। EncodeX मुफ़्त और ओपन सोर्स है, ज़्यादातर आधुनिक Linux डिस्ट्रोस पर AppImage के रूप में चलता है, और इसमें पैकेज की झंझट नहीं है।',
      },
      {
        q: 'क्या EncodeX Linux पर हार्डवेयर एक्सेलेरेशन का समर्थन करता है?',
        a: 'हाँ। EncodeX Linux पर VAAPI का समर्थन करता है – GPU ब्रांड चाहे कोई भी हो – साथ ही NVIDIA GPUs पर NVENC का।',
      },
      {
        q: 'क्या मैं बिना डेस्कटॉप वाले Linux सर्वर पर EncodeX उपयोग कर सकता हूँ?',
        a: 'हाँ। EncodeX में बिना डेस्कटॉप के स्क्रिप्टिंग द्वारा कनवर्ज़न के लिए CLI मोड शामिल है, और बंडल किया गया FFmpeg इंजन अकेले भी काम करता है।',
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
    ['link', { rel: 'preload', as: 'image', href: '/images/home_dashboard_800.webp', fetchpriority: 'high' }],
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
    const fallbackTitleByLang: Record<string, string> = {
      en: 'Free FFmpeg Video Converter for Windows, Mac & Linux',
      es: 'Convertidor de video gratuito con FFmpeg para Windows, Mac y Linux',
      fr: 'Convertisseur vidéo gratuit avec FFmpeg pour Windows, Mac et Linux',
      de: 'Kostenloser Video-Konverter mit FFmpeg für Windows, Mac und Linux',
      'pt-BR': 'Conversor de vídeo gratuito com FFmpeg para Windows, Mac e Linux',
      'zh-CN': '免费 FFmpeg 视频转换器，适用于 Windows、Mac 和 Linux',
      hi: 'Windows, Mac और Linux के लिए मुफ़्त FFmpeg वीडियो कनवर्टर',
    };
    const pageTitle = frontmatter.title
      ? `${frontmatter.title} | ${siteTitle}`
      : `${siteTitle} — ${fallbackTitleByLang[pageLang] || fallbackTitleByLang.en}`;
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
      'learn/what-format-to-use': 'What Video Format Should I Use?',
      mcp: 'MCP Server for Video Conversion',
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
        'learn/what-format-to-use': '¿Qué formato de video elegir?',
        mcp: 'Servidor MCP para conversión de video',
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
        'learn/what-format-to-use': 'Quel format vidéo choisir ?',
        mcp: 'Serveur MCP pour la conversion vidéo',
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
        'learn/what-format-to-use': 'Welches Videoformat sollte ich wählen?',
        mcp: 'MCP-Server für die Videokonvertierung',
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
        'learn/what-format-to-use': 'Qual formato de vídeo escolher?',
        mcp: 'Servidor MCP para conversão de vídeo',
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
        'learn/what-format-to-use': '该选择什么视频格式？',
        mcp: '视频转换 MCP 服务器',
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
        'learn/what-format-to-use': 'कौन सा वीडियो फ़ॉर्मैट चुनें?',
        mcp: 'वीडियो कन्वर्ज़न के लिए MCP सर्वर',
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
        nav: localeNav('en'),
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
        nav: localeNav('es'),
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
        nav: localeNav('fr'),
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
        nav: localeNav('de'),
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
        nav: localeNav('pt'),
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
        nav: localeNav('zh'),
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
        nav: localeNav('hi'),
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
