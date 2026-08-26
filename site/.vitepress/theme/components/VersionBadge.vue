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
    <span v-if="downloadsText" class="vb-dl">⬇ <span :key="bumpKey" class="dl-count bump">{{ downloadsText }}</span></span>
    <a class="vb-ext" :href="allReleasesUrl" target="_blank" rel="noopener noreferrer">
      <svg class="vb-gh" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
        <path
          d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.13-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.35.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"
        />
      </svg>
      {{ t.viewOnGitHub }}
    </a>
  </p>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { type ReleaseData, getReleases, onReleasesUpdated, startReleasePolling } from '../../data/releaseShared'
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

// Build-time snapshot first; refreshed live on mount (shared requests)
const release = ref(buildData)
const totalDownloads = ref(buildTotalDownloads ?? 0)

function applyReleases(releases: ReleaseData[]) {
  if (releases.length > 0) {
    release.value = releases[0]
  }
  const count = releases.reduce((sum, r) =>
    sum + Object.values(r.assets).reduce((s, a) => s + a.downloads, 0), 0)
  if (count > 0) {
    totalDownloads.value = count
  }
}

onMounted(async () => {
  try {
    applyReleases(await getReleases())
  } catch {
    // keep build-time snapshot on transient errors
  }
  startReleasePolling()
})

onUnmounted(onReleasesUpdated(applyReleases))

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

// Animated download counter
const animatedCount = ref(buildTotalDownloads ?? 0)
const bumpKey = ref(0)
let animationFrame: number | null = null

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function animateValue(from: number, to: number, duration = 600) {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
  const start = performance.now()
  bumpKey.value++

  function tick(now: number) {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
    const eased = easeOutCubic(progress)
    animatedCount.value = Math.round(from + (to - from) * eased)

    if (progress < 1) {
      animationFrame = requestAnimationFrame(tick)
    } else {
      animationFrame = null
    }
  }

  animationFrame = requestAnimationFrame(tick)
}

watch(totalDownloads, (newVal, oldVal) => {
  if (newVal != null && newVal > 0 && oldVal != null) {
    animateValue(oldVal, newVal)
  } else if (newVal != null && newVal > 0) {
    animatedCount.value = newVal
  }
})

// Lifetime total across all releases; build-time snapshot refreshed live on mount
const downloadsText = computed(() => {
  if (!animatedCount.value || animatedCount.value <= 0) return ''
  try {
    return t.value.downloadsCount.replace(
      '{n}',
      new Intl.NumberFormat(localeTag.value).format(animatedCount.value),
    )
  } catch {
    return t.value.downloadsCount.replace('{n}', String(animatedCount.value))
  }
})

onUnmounted(() => {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
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
  min-height: 24px;
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

.vb-dl :deep(.dl-count) {
  display: inline-block;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.vb-dl :deep(.dl-count.bump) {
  animation: count-bump 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes count-bump {
  0% { transform: scale(1); }
  40% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.vb-ext {
  margin-left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
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
