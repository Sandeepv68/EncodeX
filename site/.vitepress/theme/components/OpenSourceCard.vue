<template>
  <aside class="osc-card" :aria-label="t.title">
    <div class="osc-head">
      <svg class="osc-gh" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
        <path
          d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.13-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.35.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"
        />
      </svg>
      <h3 class="osc-title">{{ t.title }}</h3>
    </div>

    <p class="osc-tagline">★ {{ t.tagline }}</p>

    <p class="osc-stats">
      <template v-if="downloadsText">{{ downloadsText }} · </template>
      <span>{{ t.platforms }}</span>
      <span> · </span>
      <span>{{ t.languages }}</span>
    </p>

    <a class="osc-cta" :href="repoUrl" target="_blank" rel="noopener noreferrer" @click="onCta">{{ t.cta }}</a>

    <nav class="osc-links">
      <a :href="repoUrl" target="_blank" rel="noopener noreferrer">{{ t.repository }}</a>
      <span aria-hidden="true">·</span>
      <a :href="allReleasesUrl" target="_blank" rel="noopener noreferrer">{{ t.releases }}</a>
      <span aria-hidden="true">·</span>
      <a :href="licenseUrl" target="_blank" rel="noopener noreferrer">{{ t.license }}</a>
      <span aria-hidden="true">·</span>
      <a :href="contributingUrl" target="_blank" rel="noopener noreferrer">{{ t.contributing }}</a>
    </nav>

    <p v-if="starsText || clonesText" class="osc-social">
      <template v-if="starsText">
        <svg class="osc-star" viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
          <path
            d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"
          />
        </svg>
        <span>{{ starsText }}</span>
      </template>
      <template v-if="clonesText">
        <svg class="osc-clone" viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
          <path
            d="M8.75 1.5a.75.75 0 0 0-1.5 0v6.19L5.03 5.44a.75.75 0 1 0-1.06 1.06l3.53 3.53 3.53-3.53a.75.75 0 1 0-1.06-1.06L8.75 7.69V1.5ZM3 12.75a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75Z"
          />
        </svg>
        <span>{{ clonesText }}</span>
      </template>
    </p>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useData } from 'vitepress';
import {
  type ReleaseData,
  type RepoStats,
  getReleases,
  getRepoStats,
  onReleasesUpdated,
  onStatsUpdated,
} from '../../data/releaseShared';
import { data as buildData } from '../../data/release.data';
import { data as buildTotalDownloads } from '../../data/downloads.data';
import { data as buildStars } from '../../data/stars.data';
import { trackEvent } from '../composables/useAnalytics';

const STRINGS = {
  en: {
    title: 'Open Source',
    tagline: 'GitHub · MIT License',
    downloadsCount: '{n} downloads',
    platforms: '3 platforms',
    languages: '35+ languages',
    cta: 'View on GitHub',
    repository: 'Repository',
    releases: 'Releases',
    license: 'License (MIT)',
    contributing: 'Contributing',
    starsCount: '{n} stars',
    clonesCount: '{n} clones',
  },
  es: {
    title: 'Código abierto',
    tagline: 'GitHub · Licencia MIT',
    downloadsCount: '{n} descargas',
    platforms: '3 plataformas',
    languages: '35+ idiomas',
    cta: 'Ver en GitHub',
    repository: 'Repositorio',
    releases: 'Versiones',
    license: 'Licencia (MIT)',
    contributing: 'Contribuye',
    starsCount: '{n} estrellas',
    clonesCount: '{n} clonaciones',
  },
  fr: {
    title: 'Open source',
    tagline: 'GitHub · Licence MIT',
    downloadsCount: '{n} téléchargements',
    platforms: '3 plateformes',
    languages: '35+ langues',
    cta: 'Voir sur GitHub',
    repository: 'Dépôt',
    releases: 'Versions',
    license: 'Licence (MIT)',
    contributing: 'Contribuer',
    starsCount: '{n} étoiles',
    clonesCount: '{n} clones',
  },
  de: {
    title: 'Open Source',
    tagline: 'GitHub · MIT-Lizenz',
    downloadsCount: '{n} Downloads',
    platforms: '3 Plattformen',
    languages: '35+ Sprachen',
    cta: 'Auf GitHub ansehen',
    repository: 'Repository',
    releases: 'Releases',
    license: 'MIT-Lizenz',
    contributing: 'Mitwirken',
    starsCount: '{n} Sterne',
    clonesCount: '{n} Klone',
  },
  pt: {
    title: 'Código aberto',
    tagline: 'GitHub · Licença MIT',
    downloadsCount: '{n} downloads',
    platforms: '3 plataformas',
    languages: '35+ idiomas',
    cta: 'Ver no GitHub',
    repository: 'Repositório',
    releases: 'Versões',
    license: 'Licença (MIT)',
    contributing: 'Contribuir',
    starsCount: '{n} estrelas',
    clonesCount: '{n} clones',
  },
  zh: {
    title: '开源',
    tagline: 'GitHub · MIT 许可证',
    downloadsCount: '{n} 次下载',
    platforms: '3 个平台',
    languages: '35+ 种语言',
    cta: '在 GitHub 上查看',
    repository: '仓库',
    releases: '版本发布',
    license: 'MIT 许可证',
    contributing: '参与贡献',
    starsCount: '{n} 星标',
    clonesCount: '{n} 次克隆',
  },
  hi: {
    title: 'ओपन-सोर्स',
    tagline: 'GitHub · MIT लाइसेंस',
    downloadsCount: '{n} डाउनलोड',
    platforms: '3 प्लेटफ़ॉर्म',
    languages: '35+ भाषाएँ',
    cta: 'GitHub पर देखें',
    repository: 'रीपॉज़िटरी',
    releases: 'रिलीज़',
    license: 'MIT लाइसेंस',
    contributing: 'योगदान दें',
    starsCount: '{n} स्टार्स',
    clonesCount: '{n} क्लोन',
  },
};

const LOCALES = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  'pt-BR': 'pt-BR',
  'zh-CN': 'zh-CN',
  hi: 'hi',
};

const { lang } = useData();

const CANON = { 'pt-BR': 'pt', 'zh-CN': 'zh' };

const t = computed(() => {
  const key = CANON[lang.value] || lang.value;
  return STRINGS[key] || STRINGS.en;
});
const localeTag = computed(() => LOCALES[lang.value] || 'en');

const repoUrl = 'https://github.com/Sandeepv68/EncodeX';
const allReleasesUrl = 'https://github.com/Sandeepv68/EncodeX/releases';
const licenseUrl = 'https://github.com/Sandeepv68/EncodeX/blob/main/LICENSE';
const contributingUrl = 'https://github.com/Sandeepv68/EncodeX/blob/main/CONTRIBUTING.md';

const release = ref(buildData);
const totalDownloads = ref(buildTotalDownloads ?? 0);
const stars = ref(buildStars?.stars ?? 0);
const clones = ref(buildStars?.clones ?? 0);

function applyReleases(releases: ReleaseData[]) {
  if (releases.length > 0) {
    release.value = releases[0];
  }
  const count = releases.reduce((sum, r) => sum + Object.values(r.assets).reduce((s, a) => s + a.downloads, 0), 0);
  if (count > 0) {
    totalDownloads.value = count;
  }
}

function applyStats(stats: RepoStats) {
  if (stats.stars > 0) {
    stars.value = stats.stars;
  }
  if (stats.clones > 0) {
    clones.value = stats.clones;
  }
}

onMounted(async () => {
  try {
    applyReleases(await getReleases());
  } catch {
    // keep build-time snapshot on transient errors
  }
  try {
    applyStats(await getRepoStats());
  } catch {
    // keep build-time snapshot on transient errors
  }
});

onUnmounted(onReleasesUpdated(applyReleases));
onUnmounted(onStatsUpdated(applyStats));

const downloadsText = computed(() => {
  if (!totalDownloads.value || totalDownloads.value <= 0) return '';
  try {
    return t.value.downloadsCount.replace('{n}', new Intl.NumberFormat(localeTag.value).format(totalDownloads.value));
  } catch {
    return t.value.downloadsCount.replace('{n}', String(totalDownloads.value));
  }
});

const starsText = computed(() => {
  if (!stars.value || stars.value <= 0) return '';
  try {
    return t.value.starsCount.replace('{n}', new Intl.NumberFormat(localeTag.value).format(stars.value));
  } catch {
    return t.value.starsCount.replace('{n}', String(stars.value));
  }
});

const clonesText = computed(() => {
  if (!clones.value || clones.value <= 0) return '';
  try {
    return t.value.clonesCount.replace('{n}', new Intl.NumberFormat(localeTag.value).format(clones.value));
  } catch {
    return t.value.clonesCount.replace('{n}', String(clones.value));
  }
});

function onCta() {
  trackEvent('cta_click', { cta: 'oss-card-download', page_location: window.location.href });
}
</script>

<style scoped>
.osc-card {
  max-width: 760px;
  margin: 0 auto;
  padding: 28px 30px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--vp-c-bg-soft) 0%, var(--vp-c-bg) 100%);
  text-align: center;
}

.osc-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.osc-gh {
  color: var(--vp-c-brand-1);
}

.osc-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.osc-tagline {
  margin: 10px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.osc-stats {
  margin: 8px 0 18px;
  font-size: 13.5px;
  color: var(--vp-c-text-2);
}

.osc-cta,
.osc-cta:hover,
.osc-cta:focus,
.osc-cta:focus-visible,
.osc-cta:active {
  text-decoration: none;
}

.osc-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 11px 34px;
  border-radius: 10px;
  background: var(--vp-c-brand-1);
  color: #fff !important;
  font-size: 15px;
  font-weight: 600;
  transition:
    background-color 0.25s,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.osc-cta:hover {
  background: var(--vp-c-brand-2);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(3, 89, 173, 0.3);
}

.osc-links {
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.osc-links a {
  color: var(--vp-c-brand-1);
  font-weight: 500;
}

.osc-social {
  margin: 18px 0 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 18px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.osc-star {
  color: #e3b341;
  vertical-align: middle;
  margin-right: 5px;
}

.osc-clone {
  color: var(--vp-c-brand-1);
  vertical-align: middle;
  margin-right: 5px;
}
</style>