<template>
  <nav v-if="crumbs.length" class="site-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      <li v-for="(crumb, i) in crumbs" :key="i">
        <template v-if="i === crumbs.length - 1">
          <span class="bc-current" aria-current="page">{{ crumb.text }}</span>
        </template>
        <template v-else>
          <a v-if="crumb.link" :href="crumb.link">{{ crumb.text }}</a>
          <span v-else class="bc-sec">{{ crumb.text }}</span>
        </template>
        <span v-if="i < crumbs.length - 1" class="bc-sep" aria-hidden="true">/</span>
      </li>
    </ol>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useData, useRoute } from 'vitepress';

const { lang, page } = useData();
const route = useRoute();

const CANON = { 'pt-BR': 'pt', 'zh-CN': 'zh' };

const HOME_LABEL = {
  en: 'Home',
  es: 'Inicio',
  fr: 'Accueil',
  de: 'Start',
  'pt-BR': 'Início',
  'zh-CN': '首页',
  hi: 'होम',
};

const LOCALE_PREFIX = {
  en: '',
  es: '/es',
  fr: '/fr',
  de: '/de',
  'pt-BR': '/pt',
  'zh-CN': '/zh',
  hi: '/hi',
};

const SECTION_LABEL = {
  convert: {
    en: 'Convert',
    es: 'Convertir',
    fr: 'Convertir',
    de: 'Konvertieren',
    'pt-BR': 'Converter',
    'zh-CN': '转换',
    hi: 'कन्वर्ट करें',
  },
  codecs: { en: 'Codecs', es: 'Códecs', fr: 'Codecs', de: 'Codecs', 'pt-BR': 'Codecs', 'zh-CN': '编码器', hi: 'कोडेक' },
  compress: {
    en: 'Compress',
    es: 'Comprimir',
    fr: 'Compresser',
    de: 'Komprimieren',
    'pt-BR': 'Comprimir',
    'zh-CN': '压缩',
    hi: 'कंप्रेस करें',
  },
  extract: {
    en: 'Extract audio',
    es: 'Extraer audio',
    fr: "Extraire l'audio",
    de: 'Audio extrahieren',
    'pt-BR': 'Extrair áudio',
    'zh-CN': '提取音频',
    hi: 'ऑडियो निकालें',
  },
  platforms: {
    en: 'Platforms',
    es: 'Plataformas',
    fr: 'Plateformes',
    de: 'Plattformen',
    'pt-BR': 'Plataformas',
    'zh-CN': '平台',
    hi: 'प्लेटफ़ॉर्म',
  },
  learn: { en: 'Learn', es: 'Aprender', fr: 'Apprendre', de: 'Lernen', 'pt-BR': 'Aprenda', 'zh-CN': '了解', hi: 'सीखें' },
  docs: {
    en: 'Docs',
    es: 'Documentación',
    fr: 'Documentation',
    de: 'Dokumentation',
    'pt-BR': 'Documentação',
    'zh-CN': '技术文档',
    hi: 'दस्तावेज़',
  },
  'ffmpeg-gui': {
    en: 'FFmpeg GUI',
    es: 'GUI de FFmpeg',
    fr: 'Interface FFmpeg',
    de: 'FFmpeg-GUI',
    'pt-BR': 'Interface FFmpeg',
    'zh-CN': 'FFmpeg GUI',
    hi: 'FFmpeg GUI',
  },
  blog: {
    en: 'Blog',
    es: 'Blog',
    fr: 'Blog',
    de: 'Blog',
    'pt-BR': 'Blog',
    'zh-CN': '博客',
    hi: 'ब्लॉग',
  },
};

// Representative hub page per section (no section index.md exists except /blog/)
const SECTION_HUB = {
  convert: '/convert/mkv-to-mp4',
  codecs: '/codecs/h264',
  compress: '/compress/mp4',
  extract: '/extract/mp3-from-video',
  platforms: '/platforms/windows',
  learn: '/learn/what-is-ffmpeg',
  docs: '/docs/architecture',
  'ffmpeg-gui': '/ffmpeg-gui',
  blog: '/blog/',
};

const langKey = computed(() => CANON[lang.value] || lang.value || 'en');
const prefix = computed(() => LOCALE_PREFIX[lang.value] || '');

// Strip "| EncodeX" brand suffix and any "– / — / -" subtitle from SEO titles
function cleanTitle(raw) {
  let t = String(raw || '');
  t = t.replace(/\s*\|\s*EncodeX.*$/i, '');
  t = t.replace(/\s+[–—]\s+.*$/, '');
  return t.trim();
}

function hubLinkFor(section) {
  const raw = SECTION_HUB[section];
  if (!raw) return '';
  const prefixVal = prefix.value;
  return prefixVal + raw;
}

const crumbs = computed(() => {
  if (!route.path) return [];
  if (page.value.isNotFound) return [];

  const prefixVal = prefix.value;
  const homePath = prefixVal === '' ? '/' : `${prefixVal}/`;
  if (route.path === homePath || route.path === prefixVal) return [];

  let rest = route.path;
  if (prefixVal && rest.startsWith(prefixVal)) rest = rest.slice(prefixVal.length);
  rest = rest.replace(/^\/+|\/+$/g, '');
  if (!rest) return [];

  const segments = rest.split('/');
  const section = segments.length > 1 ? segments[0] : '';

  const out = [{ text: HOME_LABEL[langKey.value] || 'Home', link: homePath }];

  if (section && SECTION_LABEL[section]) {
    const hub = hubLinkFor(section);
    out.push({
      text: SECTION_LABEL[section][langKey.value] || SECTION_LABEL[section].en,
      link: hub && hub !== route.path ? hub : '',
    });
  }

  out.push({ text: cleanTitle(page.value.title) || rest });
  return out;
});
</script>

<style scoped>
.site-breadcrumbs {
  margin-bottom: 16px;
}

.site-breadcrumbs ol {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.site-breadcrumbs li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  line-height: 1.6;
}

.site-breadcrumbs a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.site-breadcrumbs a:hover,
.site-breadcrumbs a:focus-visible {
  color: var(--vp-c-brand-2);
  text-decoration: underline;
}

.bc-sec,
.bc-current {
  color: var(--vp-c-text-2);
}

.bc-sep {
  color: var(--vp-c-text-3);
  user-select: none;
}
</style>
