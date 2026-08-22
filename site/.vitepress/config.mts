import { defineConfig } from 'vitepress'
import { MermaidMarkdown } from 'vitepress-plugin-mermaid'
import type { Plugin } from 'vite'

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
    ['link', { rel: 'icon', href: '/images/favicon-64.png' }],
    ['link', { rel: 'preload', as: 'image', href: '/images/icon.webp', fetchpriority: 'high' }],
    ['meta', { name: 'theme-color', content: '#0359AD' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'EncodeX' }],
    ['meta', { property: 'og:description', content: 'A free, easy-to-use app to convert videos and audio, trim clips, extract music from video, and shrink photos. Works on Windows, Mac, and Linux.' }],
    ['meta', { property: 'og:image', content: 'https://encodex.in/images/banner.jpg' }],
    ['meta', { property: 'og:url', content: 'https://encodex.in/' }],
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
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/' },
          { text: 'Features', link: '/features' },
          { text: 'Download', link: '/download' },
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
