<template>
  <footer class="site-footer">
    <div class="sf-shell">
      <div class="sf-cols">
        <div class="sf-brand">
          <div class="sf-brand-row">
            <img src="/images/icon.webp" width="30" height="30" alt="" class="sf-logo">
            <span class="sf-name">EncodeX</span>
          </div>
          <p class="sf-tagline">{{ t.tagline }}</p>
        </div>

        <nav class="sf-link-cols" aria-label="Footer">
          <div class="sf-col">
            <p class="sf-col-title">{{ t.product }}</p>
            <a :href="p('/features')">{{ t.features }}</a>
            <a :href="p('/download')">{{ t.download }}</a>
            <a :href="p('/blog/')">{{ t.blog }}</a>
          </div>
          <div class="sf-col">
            <p class="sf-col-title">{{ t.community }}</p>
            <a :href="p('/contributing')">{{ t.contributing }}</a>
            <a href="https://github.com/Sandeepv68/EncodeX" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://github.com/Sandeepv68/EncodeX/releases" target="_blank" rel="noopener noreferrer">Releases</a>
          </div>
          <div class="sf-col">
            <p class="sf-col-title">{{ t.support }}</p>
            <a :href="p('/docs/architecture')">{{ t.docs }}</a>
            <a href="mailto:developer@encodex.in">{{ t.contact }}</a>
            <a :href="p('/download#need-help')">{{ t.help }}</a>
          </div>
        </nav>
      </div>

      <div class="sf-bottom">
        <p>&copy; {{ year }} EncodeX Contributors · MIT License</p>
        <p>{{ t.madeWith }} <span class="sf-heart">&#10084;&#65039;</span></p>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'

const { lang } = useData()
const year = new Date().getFullYear()

const strings = {
  en: {
    tagline: 'The free, friendly way to convert videos, extract music, trim clips, and shrink photos.',
    product: 'Product', features: 'Features', download: 'Download', blog: 'Blog',
    community: 'Community', contributing: 'Contributing',
    support: 'Support', docs: 'Technical Docs', contact: 'Contact', help: 'Get Help',
    madeWith: 'Made with',
  },
  es: {
    tagline: 'La forma gratuita y sencilla de convertir vídeos, extraer música, recortar clips y reducir fotos.',
    product: 'Producto', features: 'Características', download: 'Descargar', blog: 'Blog',
    community: 'Comunidad', contributing: 'Contribuir',
    support: 'Soporte', docs: 'Documentación técnica', contact: 'Contacto', help: 'Ayuda',
    madeWith: 'Hecho con',
  },
  fr: {
    tagline: 'La façon gratuite et simple de convertir des vidéos, extraire de la musique, couper des clips et alléger vos photos.',
    product: 'Produit', features: 'Fonctionnalités', download: 'Télécharger', blog: 'Blog',
    community: 'Communauté', contributing: 'Contribuer',
    support: 'Assistance', docs: 'Documentation technique', contact: 'Contact', help: 'Aide',
    madeWith: 'Réalisé avec',
  },
  de: {
    tagline: 'Der kostenlose und einfache Weg, Videos zu konvertieren, Musik zu extrahieren, Clips zu schneiden und Fotos zu verkleinern.',
    product: 'Produkt', features: 'Funktionen', download: 'Download', blog: 'Blog',
    community: 'Community', contributing: 'Mitwirken',
    support: 'Hilfe', docs: 'Technische Dokumentation', contact: 'Kontakt', help: 'Hilfe erhalten',
    madeWith: 'Gemacht mit',
  },
  'pt-BR': {
    tagline: 'O jeito gratuito e simples de converter vídeos, extrair música, cortar clipes e reduzir fotos.',
    product: 'Produto', features: 'Recursos', download: 'Download', blog: 'Blog',
    community: 'Comunidade', contributing: 'Contribuir',
    support: 'Suporte', docs: 'Documentação técnica', contact: 'Contato', help: 'Obter ajuda',
    madeWith: 'Feito com',
  },
  'zh-CN': {
    tagline: '免费、友好的视频转换工具：提取音乐、剪辑片段、压缩照片。',
    product: '产品', features: '功能特性', download: '下载', blog: '博客',
    community: '社区', contributing: '参与贡献',
    support: '支持', docs: '技术文档', contact: '联系我们', help: '获取帮助',
    madeWith: '由社区用心打造',
  },
  hi: {
    tagline: 'वीडियो बदलने, म्यूज़िक निकालने, क्लिप ट्रिम करने और फ़ोटो छोटी करने का मुफ़्त और आसान तरीक़ा।',
    product: 'प्रोडक्ट', features: 'फ़ीचर्स', download: 'डाउनलोड', blog: 'ब्लॉग',
    community: 'कम्युनिटी', contributing: 'योगदान दें',
    support: 'सहायता', docs: 'टेक्निकल दस्तावेज़', contact: 'संपर्क करें', help: 'मदद पाएँ',
    madeWith: 'इश्क़ के साथ बनाया गया',
  },
}

const t = computed(() => strings[lang.value] || strings.en)

// prefix internal links with the current locale path when not English
const localePrefix = computed(() => {
  const l = lang.value
  if (l === 'es') return '/es'
  if (l === 'fr') return '/fr'
  if (l === 'de') return '/de'
  if (l === 'pt-BR') return '/pt'
  if (l === 'zh-CN') return '/zh'
  if (l === 'hi') return '/hi'
  return ''
})
const p = (path) => localePrefix.value + path
</script>
