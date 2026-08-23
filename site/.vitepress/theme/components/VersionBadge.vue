<template>
  <!-- Navbar pill. Rendered inside the site-title anchor, so it must stay a <span>. -->
  <span v-if="variant === 'nav' && tag" class="vb-pill vb-nav">{{ tag }}</span>

  <!-- Homepage hero line under the action buttons -->
  <p v-else-if="variant === 'hero' && tag" class="vb-hero">
    <span class="vb-label">{{ t.latest }}</span>
    <a
      class="vb-pill vb-link"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      :title="t.viewOnGitHub"
    >{{ tag }}</a>
    <span v-if="dateText" class="vb-date">· {{ dateText }}</span>
    <span v-if="downloadsText" class="vb-dl">⬇ {{ downloadsText }}</span>
    <a class="vb-ext" :href="allReleasesUrl" target="_blank" rel="noopener noreferrer">
      {{ t.viewOnGitHub }} ↗
    </a>
  </p>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useData } from 'vitepress'
import { getLatestRelease } from '../../data/releaseShared'
import { data as buildData } from '../../data/release.data'
import { data as buildTotalDownloads } from '../../data/downloads.data'

const props = defineProps({
  variant: {
    type: String,
    default: 'nav',
    validator: (value) => ['nav', 'hero'].includes(value),
  },
})

const STRINGS = {
  en: { latest: 'Latest release', viewOnGitHub: 'View on GitHub', downloadsCount: '{n} downloads' },
  es: { latest: 'Última versión', viewOnGitHub: 'Ver en GitHub', downloadsCount: '{n} descargas' },
  fr: { latest: 'Dernière version', viewOnGitHub: 'Voir sur GitHub', downloadsCount: '{n} téléchargements' },
  de: { latest: 'Neueste Version', viewOnGitHub: 'Auf GitHub ansehen', downloadsCount: '{n} Downloads' },
  pt: { latest: 'Versão mais recente', viewOnGitHub: 'Ver no GitHub', downloadsCount: '{n} downloads' },
  zh: { latest: '最新版本', viewOnGitHub: '在 GitHub 上查看', downloadsCount: '{n} 次下载' },
  hi: { latest: 'नवीनतम संस्करण', viewOnGitHub: 'GitHub पर देखें', downloadsCount: '{n} डाउनलोड' },
}

const LOCALES = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  'pt-BR': 'pt-BR',
  'zh-CN': 'zh-CN',
  hi: 'hi',
}

const { lang } = useData()

// VitePress locale codes ('pt-BR', 'zh-CN') -> string-dict keys
const CANON = { 'pt-BR': 'pt', 'zh-CN': 'zh' }

const t = computed(() => {
  const key = CANON[lang.value] || lang.value
  return STRINGS[key] || STRINGS.en
})
const localeTag = computed(() => LOCALES[lang.value] || 'en')

const allReleasesUrl = 'https://github.com/Sandeepv68/EncodeX/releases'

// Build-time snapshot first; refreshed live on mount (shared request)
const release = ref(buildData)

onMounted(async () => {
  try {
    const fresh = await getLatestRelease()
    if (fresh?.tag) {
      release.value = fresh
    }
  } catch {
    // keep build-time snapshot
  }
})

const tag = computed(() => release.value?.tag || '')
const url = computed(() => release.value?.htmlUrl || allReleasesUrl)

const dateText = computed(() => {
  const iso = release.value?.publishedAt
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(localeTag.value, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
})

// Build-time lifetime total across all releases; hidden when unavailable
const downloadsText = computed(() => {
  if (!buildTotalDownloads || buildTotalDownloads <= 0) return ''
  try {
    return t.value.downloadsCount.replace(
      '{n}',
      new Intl.NumberFormat(localeTag.value).format(buildTotalDownloads),
    )
  } catch {
    return t.value.downloadsCount.replace('{n}', String(buildTotalDownloads))
  }
})
</script>

<style scoped>
.vb-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.5;
  white-space: nowrap;
}

.vb-nav {
  margin-left: 8px;
}

@media (max-width: 479px) {
  .vb-nav {
    display: none;
  }
}

.vb-hero {
  display: block;
  margin-top: 16px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.vb-hero > * {
  vertical-align: middle;
}

.vb-hero .vb-pill {
  margin-left: 8px;
}

.vb-link:hover,
.vb-link:focus-visible {
  background: var(--vp-c-brand-1);
  color: #fff;
  text-decoration: none;
}

.vb-date {
  margin-left: 10px;
  font-size: 12.5px;
}

.vb-dl {
  margin-left: 10px;
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.vb-ext {
  margin-left: 12px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: color 0.2s;
}

.vb-ext:hover,
.vb-ext:focus-visible {
  color: var(--vp-c-brand-1);
}
</style>
