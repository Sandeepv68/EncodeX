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

const toolsStrings: Record<string, { label: string; ffmpeg: string; converter: string; compressor: string; audio: string; convertLabel: string; mkv: string; mov: string; avi: string; codecsLabel: string; h264: string; h265: string; av1: string; learn: string; learnLink: string }> = {
  en: {
    label: 'Tools',
    ffmpeg: 'FFmpeg GUI',
    converter: 'Video Converter',
    compressor: 'Video Compressor',
    audio: 'Audio Converter',
    convertLabel: 'Convert',
    mkv: 'MKV to MP4',
    mov: 'MOV to MP4',
    avi: 'AVI to MP4',
    codecsLabel: 'Codecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    learn: 'Learn',
    learnLink: '/learn/what-is-ffmpeg',
  },
  es: {
    label: 'Herramientas',
    ffmpeg: 'GUI de FFmpeg',
    converter: 'Convertidor de vídeo',
    compressor: 'Compresor de vídeo',
    audio: 'Convertidor de audio',
    convertLabel: 'Convertir',
    mkv: 'MKV a MP4',
    mov: 'MOV a MP4',
    avi: 'AVI a MP4',
    codecsLabel: 'Códecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    learn: 'Aprender',
    learnLink: '/es/learn/what-is-ffmpeg',
  },
  fr: {
    label: 'Outils',
    ffmpeg: 'Interface FFmpeg',
    converter: 'Convertisseur vidéo',
    compressor: 'Compresseur vidéo',
    audio: 'Convertisseur audio',
    convertLabel: 'Convertir',
    mkv: 'MKV vers MP4',
    mov: 'MOV vers MP4',
    avi: 'AVI vers MP4',
    codecsLabel: 'Codecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    learn: 'Apprendre',
    learnLink: '/fr/learn/what-is-ffmpeg',
  },
  de: {
    label: 'Werkzeuge',
    ffmpeg: 'FFmpeg-GUI',
    converter: 'Videokonverter',
    compressor: 'Videokompressor',
    audio: 'Audiokonverter',
    convertLabel: 'Konvertieren',
    mkv: 'MKV zu MP4',
    mov: 'MOV zu MP4',
    avi: 'AVI zu MP4',
    codecsLabel: 'Codecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    learn: 'Lernen',
    learnLink: '/de/learn/what-is-ffmpeg',
  },
  pt: {
    label: 'Ferramentas',
    ffmpeg: 'Interface FFmpeg',
    converter: 'Conversor de vídeo',
    compressor: 'Compressor de vídeo',
    audio: 'Conversor de áudio',
    convertLabel: 'Converter',
    mkv: 'MKV para MP4',
    mov: 'MOV para MP4',
    avi: 'AVI para MP4',
    codecsLabel: 'Codecs',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    learn: 'Aprenda',
    learnLink: '/pt/learn/what-is-ffmpeg',
  },
  zh: {
    label: '工具',
    ffmpeg: 'FFmpeg GUI',
    converter: '视频转换器',
    compressor: '视频压缩器',
    audio: '音频转换器',
    convertLabel: '转换',
    mkv: 'MKV 转 MP4',
    mov: 'MOV 转 MP4',
    avi: 'AVI 转 MP4',
    codecsLabel: '编码器',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
    learn: '了解',
    learnLink: '/zh/learn/what-is-ffmpeg',
  },
  hi: {
    label: 'टूल्स',
    ffmpeg: 'FFmpeg GUI',
    converter: 'वीडियो कन्वर्टर',
    compressor: 'वीडियो कंप्रेसर',
    audio: 'ऑडियो कन्वर्टर',
    convertLabel: 'कन्वर्ट करें',
    mkv: 'MKV से MP4',
    mov: 'MOV से MP4',
    avi: 'AVI से MP4',
    codecsLabel: 'कोडेक',
    h264: 'H.264',
    h265: 'H.265 / HEVC',
    av1: 'AV1',
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
      {
        text: s.convertLabel,
        items: [
          { text: s.mkv, link: `${p}/convert/mkv-to-mp4` },
          { text: s.mov, link: `${p}/convert/mov-to-mp4` },
          { text: s.avi, link: `${p}/convert/avi-to-mp4` },
        ],
      },
      {
        text: s.codecsLabel,
        items: [
          { text: s.h264, link: `${p}/codecs/h264` },
          { text: s.h265, link: `${p}/codecs/h265` },
          { text: s.av1, link: `${p}/codecs/av1` },
        ],
      },
      { text: s.learn, link: `${s.learnLink}` },
    ],
  }
}

export default defineConfig({
  title: 'EncodeX',
  description:
    'A free, easy-to-use app to convert videos and audio, trim clips, extract music from video, and shrink photos. Works on Windows, Mac, and Linux.',
  base: '/',
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

    const pageLang = detectLocaleFromPath(pagePath)
    const localePrefix = detectLocalePrefix(pagePath)
    const cleanPath = localePrefix ? pagePath.slice(localePrefix.length) : pagePath
    const pageSlug = cleanPath.replace(/\.md$/, '').replace(/\/index$/, '') || ''
    const canonicalUrl = pageSlug ? `${SITE_URL}/${localePrefix ? localePrefix + '/' : ''}${pageSlug}` : `${SITE_URL}/${localePrefix ? localePrefix + '/' : ''}`

    head.push(['link', { rel: 'canonical', href: canonicalUrl }])

    const siteTitle = context.siteConfig?.title || 'EncodeX'
    const siteDescription = context.siteData?.description || context.siteConfig?.description || ''
    const pageTitle = frontmatter.title
      ? `${frontmatter.title} | ${siteTitle}`
      : `${siteTitle} — Free Video, Audio & Photo Converter`
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
      const href = prefix
        ? `${SITE_URL}/${prefix}/${pageSlug}`
        : `${SITE_URL}/${pageSlug}`
      head.push([
        'link',
        { rel: 'alternate', hreflang, href },
      ])
    }
    head.push([
      'link',
      { rel: 'alternate', hreflang: 'x-default', href: `${SITE_URL}/${pageSlug}` },
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
      'ffmpeg-gui/windows': 'FFmpeg GUI for Windows',
      'ffmpeg-gui/macos': 'FFmpeg GUI for Mac',
      'ffmpeg-gui/linux': 'FFmpeg GUI for Linux',
      'convert/mkv-to-mp4': 'MKV to MP4 Converter',
      'convert/mov-to-mp4': 'MOV to MP4 Converter',
      'convert/avi-to-mp4': 'AVI to MP4 Converter',
      'codecs/h264': 'H.264 Encoder & Converter',
      'codecs/h265': 'H.265 / HEVC Encoder & Converter',
      'codecs/av1': 'AV1 Encoder & Converter',
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
        { type: 'application/ld+json' },
        JSON.stringify(breadcrumbJsonLd),
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
