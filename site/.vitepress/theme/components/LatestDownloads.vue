<template>
  <!-- Previous versions archive -->
  <div v-if="props.older" class="dl-old">
    <p v-if="olderError && !olderList.length" class="dl-unavailable">
      {{ t.olderUnavailable }}
      <a href="https://github.com/Sandeepv68/EncodeX/releases" target="_blank" rel="noopener noreferrer">
        GitHub Releases
      </a>
    </p>
    <details v-for="rel in olderList" :key="rel.tag" class="dl-rel">
      <summary class="dl-rel-summary">
        <span class="dl-ver dl-ver-sm">{{ rel.tag }}</span>
        <span v-if="formatDate(rel.publishedAt)" class="dl-date">{{ formatDate(rel.publishedAt) }}</span>
        <span v-if="rel.prerelease" class="dl-pre">{{ t.preRelease }}</span>
        <span class="dl-count">{{ t.filesCount.replace('{n}', String(assetList(rel).length)) }}</span>
        <span class="dl-chevron" aria-hidden="true">▾</span>
      </summary>
      <div class="dl-rel-body">
        <div v-for="asset in assetList(rel)" :key="asset.key" class="dl-rel-row">
          <OsIcon :name="osOf(asset.key)" :label="osLabel(asset.key)" class="dl-os" />
          <div class="dl-rel-main">
            <code class="dl-file">{{ asset.name }}</code>
            <div class="dl-meta">
              <template v-if="hasSize(asset)">
                <span>{{ formatSize(asset.size) }}</span>
                <span aria-hidden="true">·</span>
              </template>
              <template v-if="asset.downloads > 0">
                <span>{{ t.downloadsCount.replace('{n}', formatCount(asset.downloads)) }}</span>
              </template>
              <template v-if="asset.sha256">
                <span aria-hidden="true">·</span>
                <code class="dl-sha" :title="`${t.sha256}: ${asset.sha256}`">{{ shortSha(asset.sha256) }}</code>
                <button
                  type="button"
                  class="dl-mini"
                  :aria-label="`${t.copy} SHA-256`"
                  @click="copyText(`${rel.tag}/${asset.key}`, asset.sha256)"
                >{{ copiedKey === `${rel.tag}/${asset.key}` ? t.copied : t.copy }}</button>
              </template>
            </div>
          </div>
          <a class="dl-btn dl-btn-sm" :href="asset.url" @click="trackDownload(platformOf(asset.key), asset.name, rel.tag); trackDownloadConversion(platformOf(asset.key), asset.name, rel.tag)">{{ t.download }}</a>
        </div>
      </div>
    </details>
  </div>

  <!-- Primary single-decision mode -->
  <div v-else-if="props.primary" class="dl-primary">
    <template v-if="primaryRow">
      <div class="dl-primary-card">
        <div class="dl-primary-info">
          <span class="dl-badge">✓ {{ t.recommended }}</span>
          <p class="dl-primary-title">{{ primaryLabel }}</p>
          <p class="dl-primary-meta">{{ primaryRow.chip }}<template v-if="hasSize(primaryRow.asset)"><span aria-hidden="true"> · </span>{{ formatSize(primaryRow.asset.size) }}</template><span aria-hidden="true"> · </span>{{ primaryRow.description }}</p>
        </div>
        <a
          class="dl-btn dl-btn-lg"
          :href="primaryRow.asset.url"
          @click="onPrimaryDownload"
        >{{ t.download }}</a>
      </div>
      <details class="dl-others">
        <summary class="dl-others-summary">
          {{ t.otherDownloads }}
          <span class="dl-chevron" aria-hidden="true">▾</span>
        </summary>
        <div class="dl-we-recommend">{{ t.weRecommend }}</div>
        <div class="dl-list dl-list-others">
          <div v-for="row in allRows" :key="row.key" class="dl-row" :class="{ 'dl-row-recommended': row.recommended }">
            <div class="dl-main">
              <div class="dl-title">
                <span class="dl-chip">{{ row.chip }}</span>
                <template v-if="row.recommended">
                  <span class="dl-badge">✓ {{ t.recommended }}</span>
                </template>
                <template v-else>
                  <span class="dl-os-tag">{{ osLabelOfGroup(row.group) }}</span>
                </template>
              </div>
              <div class="dl-desc">{{ row.description }}</div>
              <div class="dl-meta">
                <span class="dl-file">{{ row.asset.name }}</span>
                <template v-if="hasSize(row.asset)">
                  <span aria-hidden="true">·</span>
                  <span>{{ formatSize(row.asset.size) }}</span>
                </template>
                <template v-if="row.asset.downloads > 0">
                  <span aria-hidden="true">·</span>
                  <span>{{ t.downloadsCount.replace('{n}', formatCount(row.asset.downloads)) }}</span>
                </template>
                <template v-if="row.asset.sha256">
                  <span aria-hidden="true">·</span>
                  <code
                    class="dl-sha"
                    :title="`${t.sha256}: ${row.asset.sha256}`"
                  >{{ shortSha(row.asset.sha256) }}</code>
                  <button
                    type="button"
                    class="dl-mini"
                    :aria-label="`${t.copy} SHA-256`"
                    @click="copyText(row.key, row.asset.sha256)"
                  >{{ copiedKey === row.key ? t.copied : t.copy }}</button>
                  <button
                    type="button"
                    class="dl-mini dl-mini-ghost"
                    @click="toggleFull(row.key)"
                  >{{ expandedKey === row.key ? t.hide : t.showFull }}</button>
                </template>
              </div>
              <pre
                v-if="expandedKey === row.key && row.asset.sha256"
                class="dl-full"
              >SHA-256: {{ row.asset.sha256 }}</pre>
            </div>
            <a class="dl-btn" :href="row.asset.url" @click="trackDownload(row.group, row.asset.name, release?.tag || ''); trackDownloadConversion(row.group, row.asset.name, release?.tag || '')">{{ t.download }}</a>
          </div>
        </div>
      </details>
    </template>
    <p v-else class="dl-unavailable">
      {{ t.unavailable }}
      <a href="https://github.com/Sandeepv68/EncodeX/releases" target="_blank" rel="noopener noreferrer">
        GitHub Releases
      </a>
    </p>
  </div>

  <!-- Version banner (no platform prop) -->
  <div v-else-if="!props.platform" class="dl-banner">
    <template v-if="release">
      <span class="dl-label">{{ t.latestVersion }}</span>
      <span class="dl-ver">{{ release.tag }}</span>
      <span v-if="formatDate(release.publishedAt)" class="dl-date">· {{ t.released }} {{ formatDate(release.publishedAt) }}</span>
      <span v-if="totalDownloads(release) > 0" class="dl-date">⬇ {{ t.downloadsCount.replace('{n}', formatCount(totalDownloads(release))) }}</span>
      <a :href="release.htmlUrl" target="_blank" rel="noopener noreferrer">{{ t.viewAll }}</a>
    </template>
    <a v-else href="https://github.com/Sandeepv68/EncodeX/releases" target="_blank" rel="noopener noreferrer">
      https://github.com/Sandeepv68/EncodeX/releases
    </a>
  </div>

  <!-- Platform download rows -->
  <div v-else-if="rows.length" class="dl-list">
    <div v-for="row in rows" :key="row.key" class="dl-row" :class="{ 'dl-row-recommended': row.recommended }">
      <div class="dl-main">
        <div class="dl-title">
          <span class="dl-chip">{{ row.chip }}</span>
          <span v-if="row.recommended" class="dl-badge">✓ {{ t.recommended }}</span>
        </div>
        <div class="dl-desc">{{ row.description }}</div>
        <div class="dl-meta">
          <span class="dl-file">{{ row.asset.name }}</span>
          <template v-if="hasSize(row.asset)">
            <span aria-hidden="true">·</span>
            <span>{{ formatSize(row.asset.size) }}</span>
          </template>
          <template v-if="row.asset.downloads > 0">
            <span aria-hidden="true">·</span>
            <span>{{ t.downloadsCount.replace('{n}', formatCount(row.asset.downloads)) }}</span>
          </template>
          <template v-if="row.asset.sha256">
            <span aria-hidden="true">·</span>
            <code
              class="dl-sha"
              :title="`${t.sha256}: ${row.asset.sha256}`"
            >{{ shortSha(row.asset.sha256) }}</code>
            <button
              type="button"
              class="dl-mini"
              :aria-label="`${t.copy} SHA-256`"
              @click="copyText(row.key, row.asset.sha256)"
            >{{ copiedKey === row.key ? t.copied : t.copy }}</button>
            <button
              type="button"
              class="dl-mini dl-mini-ghost"
              @click="toggleFull(row.key)"
            >{{ expandedKey === row.key ? t.hide : t.showFull }}</button>
          </template>
        </div>
        <pre
          v-if="expandedKey === row.key && row.asset.sha256"
          class="dl-full"
        >SHA-256: {{ row.asset.sha256 }}</pre>
      </div>
      <a class="dl-btn" :href="row.asset.url" @click="trackDownload(props.platform || 'unknown', row.asset.name, release?.tag || ''); trackDownloadConversion(props.platform || 'unknown', row.asset.name, release?.tag || '')">{{ t.download }}</a>
    </div>
  </div>

  <!-- Fallback: no build-time data and live fetch unavailable -->
  <p v-else class="dl-unavailable">
    {{ t.unavailable }}
    <a href="https://github.com/Sandeepv68/EncodeX/releases" target="_blank" rel="noopener noreferrer">
      GitHub Releases
    </a>
  </p>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useData } from 'vitepress'
import { getReleases, totalDownloads } from '../../data/releaseShared'
import { data as buildData } from '../../data/release.data'
import { data as buildOlderData } from '../../data/releases.data'
import { trackDownload, trackDownloadConversion, trackShaCopy, trackShaExpand } from '../composables/useAnalytics'

const props = defineProps({
  platform: {
    type: String,
    default: undefined,
    validator: (value) => value === undefined || ['windows', 'macos', 'linux'].includes(value),
  },
  older: {
    type: Boolean,
    default: false,
  },
  primary: {
    type: Boolean,
    default: false,
  },
})

const STRINGS = {
  en: {
    latestVersion: 'Latest version',
    released: 'Released',
    viewAll: 'All releases',
    recommended: 'Recommended',
    download: 'Download',
    downloadForWindows: 'Download for Windows',
    downloadForMacos: 'Download for macOS',
    downloadForLinux: 'Download for Linux',
    otherDownloads: 'Other downloads',
    weRecommend:
      "You don't need to know which file is right for you — if unsure, choose the one marked ✓ Recommended.",
    copy: 'Copy',
    copied: 'Copied!',
    showFull: 'Show full',
    hide: 'Hide',
    sha256: 'SHA-256',
    filesCount: '{n} files',
    downloadsCount: '{n} downloads',
    preRelease: 'Pre-release',
    unavailable:
      "Download links couldn't be loaded right now. Get the installers directly from the GitHub releases page:",
    olderUnavailable:
      'Previous versions could not be loaded right now. Browse all releases on GitHub:',
    rows: {
      'win-x64': 'Most PCs and laptops (64-bit Intel/AMD)',
      'win-ia32': 'Very old 32-bit computers',
      'win-arm64': 'Snapdragon-based Windows laptops',
      'mac-arm64': 'M1, M2, M3, M4 chips (2021 or later)',
      'mac-x64': 'Intel-based Macs (before 2021)',
      'linux-x86_64': 'Most Linux computers (64-bit Intel/AMD)',
      'linux-arm64': 'ARM boards and laptops',
      'linux-armv7l': 'Older single-board computers',
    },
  },
  es: {
    latestVersion: 'Última versión',
    released: 'Publicada',
    viewAll: 'Todas las versiones',
    recommended: 'Recomendado',
    download: 'Descargar',
    downloadForWindows: 'Descargar para Windows',
    downloadForMacos: 'Descargar para macOS',
    downloadForLinux: 'Descargar para Linux',
    otherDownloads: 'Otras descargas',
    weRecommend:
      'No necesitas saber qué archivo te corresponde. Si tienes dudas, elige el marcado con ✓ Recomendado.',
    copy: 'Copiar',
    copied: '¡Copiado!',
    showFull: 'Mostrar completo',
    hide: 'Ocultar',
    sha256: 'SHA-256',
    filesCount: '{n} archivos',
    downloadsCount: '{n} descargas',
    preRelease: 'Versión preliminar',
    unavailable:
      'No se pudieron cargar los enlaces de descarga. Obtén los instaladores directamente en la página de versiones de GitHub:',
    olderUnavailable:
      'No se pudieron cargar las versiones anteriores. Consulta todas las versiones en GitHub:',
    rows: {
      'win-x64': 'La mayoría de PCs y portátiles (64 bits Intel/AMD)',
      'win-ia32': 'Ordenadores muy antiguos de 32 bits',
      'win-arm64': 'Portátiles Windows con Snapdragon',
      'mac-arm64': 'Chips M1, M2, M3, M4 (2021 o posterior)',
      'mac-x64': 'Macs con chip Intel (anteriores a 2021)',
      'linux-x86_64': 'La mayoría de equipos Linux (64 bits Intel/AMD)',
      'linux-arm64': 'Placas y portátiles ARM',
      'linux-armv7l': 'Equipos de placa única más antiguos',
    },
  },
  fr: {
    latestVersion: 'Dernière version',
    released: 'Publiée le',
    viewAll: 'Toutes les versions',
    recommended: 'Recommandé',
    download: 'Télécharger',
    downloadForWindows: 'Télécharger pour Windows',
    downloadForMacos: 'Télécharger pour macOS',
    downloadForLinux: 'Télécharger pour Linux',
    otherDownloads: 'Autres téléchargements',
    weRecommend:
      "Pas besoin de savoir quel fichier vous convient — en cas de doute, choisissez celui marqué ✓ Recommandé.",
    copy: 'Copier',
    copied: 'Copié !',
    showFull: 'Tout afficher',
    hide: 'Masquer',
    sha256: 'SHA-256',
    filesCount: '{n} fichiers',
    downloadsCount: '{n} téléchargements',
    preRelease: 'Préversion',
    unavailable:
      "Impossible de charger les liens de téléchargement. Récupérez les installateurs directement sur la page des versions GitHub :",
    olderUnavailable:
      'Impossible de charger les versions précédentes. Parcourez toutes les versions sur GitHub :',
    rows: {
      'win-x64': 'La plupart des PC et portables (64 bits Intel/AMD)',
      'win-ia32': 'Très anciens ordinateurs 32 bits',
      'win-arm64': 'Portables Windows avec puce Snapdragon',
      'mac-arm64': 'Puces M1, M2, M3, M4 (2021 ou plus récent)',
      'mac-x64': "Mac équipés d\u2019Intel (avant 2021)",
      'linux-x86_64': 'La plupart des ordinateurs Linux (64 bits Intel/AMD)',
      'linux-arm64': 'Cartes et portables ARM',
      'linux-armv7l': 'Anciens ordinateurs monocarte',
    },
  },
  de: {
    latestVersion: 'Neueste Version',
    released: 'Veröffentlicht am',
    viewAll: 'Alle Releases',
    recommended: 'Empfohlen',
    download: 'Herunterladen',
    downloadForWindows: 'Für Windows herunterladen',
    downloadForMacos: 'Für macOS herunterladen',
    downloadForLinux: 'Für Linux herunterladen',
    otherDownloads: 'Weitere Downloads',
    weRecommend:
      'Sie müssen nicht wissen, welche Datei die richtige ist — bei Unsicherheit nehmen Sie die mit ✓ Empfohlen.',
    copy: 'Kopieren',
    copied: 'Kopiert!',
    showFull: 'Vollständig anzeigen',
    hide: 'Ausblenden',
    sha256: 'SHA-256',
    filesCount: '{n} Dateien',
    downloadsCount: '{n} Downloads',
    preRelease: 'Vorabversion',
    unavailable:
      'Download-Links konnten nicht geladen werden. Installationsprogramme gibt es direkt auf der GitHub-Releases-Seite:',
    olderUnavailable:
      'Frühere Versionen konnten nicht geladen werden. Alle Releases gibt es auf GitHub:',
    rows: {
      'win-x64': 'Die meisten PCs und Laptops (64-Bit Intel/AMD)',
      'win-ia32': 'Sehr alte 32-Bit-Computer',
      'win-arm64': 'Windows-Laptops mit Snapdragon',
      'mac-arm64': 'M1-, M2-, M3-, M4-Chips (2021 oder später)',
      'mac-x64': 'Intel-Macs (vor 2021)',
      'linux-x86_64': 'Die meisten Linux-Rechner (64-Bit Intel/AMD)',
      'linux-arm64': 'ARM-Boards und -Laptops',
      'linux-armv7l': 'Ältere Einplatinenrechner',
    },
  },
  pt: {
    latestVersion: 'Versão mais recente',
    released: 'Lançada em',
    viewAll: 'Todas as versões',
    recommended: 'Recomendado',
    download: 'Baixar',
    downloadForWindows: 'Baixar para Windows',
    downloadForMacos: 'Baixar para macOS',
    downloadForLinux: 'Baixar para Linux',
    otherDownloads: 'Outros downloads',
    weRecommend:
      'Você não precisa saber qual arquivo é o certo — na dúvida, escolha o marcado com ✓ Recomendado.',
    copy: 'Copiar',
    copied: 'Copiado!',
    showFull: 'Mostrar completo',
    hide: 'Ocultar',
    sha256: 'SHA-256',
    filesCount: '{n} arquivos',
    downloadsCount: '{n} downloads',
    preRelease: 'Pré-lançamento',
    unavailable:
      'Não foi possível carregar os links de download. Obtenha os instaladores direto na página de versões do GitHub:',
    olderUnavailable:
      'Não foi possível carregar as versões anteriores. Veja todas as versões no GitHub:',
    rows: {
      'win-x64': 'A maioria dos PCs e notebooks (64 bits Intel/AMD)',
      'win-ia32': 'Computadores muito antigos de 32 bits',
      'win-arm64': 'Notebooks Windows com Snapdragon',
      'mac-arm64': 'Chips M1, M2, M3, M4 (2021 ou mais recente)',
      'mac-x64': 'Macs com chip Intel (antes de 2021)',
      'linux-x86_64': 'A maioria dos computadores Linux (64 bits Intel/AMD)',
      'linux-arm64': 'Placas e notebooks ARM',
      'linux-armv7l': 'Computadores single-board mais antigos',
    },
  },
  zh: {
    latestVersion: '最新版本',
    released: '发布于',
    viewAll: '所有版本',
    recommended: '推荐',
    download: '下载',
    downloadForWindows: '下载 Windows 版',
    downloadForMacos: '下载 macOS 版',
    downloadForLinux: '下载 Linux 版',
    otherDownloads: '其他下载',
    weRecommend:
      '您无需了解哪个文件适合您——如果不确定，请选择标有 ✓ 推荐 的那个。',
    copy: '复制',
    copied: '已复制！',
    showFull: '显示完整',
    hide: '收起',
    sha256: 'SHA-256',
    filesCount: '{n} 个文件',
    downloadsCount: '{n} 次下载',
    preRelease: '预发布',
    unavailable: '暂时无法加载下载链接。请前往 GitHub 发布页面获取安装包：',
    olderUnavailable: '无法加载历史版本。请在 GitHub 上查看所有版本：',
    rows: {
      'win-x64': '大多数台式机和笔记本（64 位 Intel/AMD）',
      'win-ia32': '非常老旧的 32 位电脑',
      'win-arm64': '搭载骁龙（Snapdragon）的 Windows 笔记本',
      'mac-arm64': 'M1、M2、M3、M4 芯片（2021 年或更新）',
      'mac-x64': 'Intel 芯片的 Mac（2021 年之前）',
      'linux-x86_64': '大多数 Linux 电脑（64 位 Intel/AMD）',
      'linux-arm64': 'ARM 开发板和笔记本',
      'linux-armv7l': '较旧的单板计算机',
    },
  },
  hi: {
    latestVersion: 'नवीनतम संस्करण',
    released: 'रिलीज़',
    viewAll: 'सभी रिलीज़',
    recommended: 'अनुशंसित',
    download: 'डाउनलोड',
    downloadForWindows: 'Windows के लिए डाउनलोड',
    downloadForMacos: 'macOS के लिए डाउनलोड',
    downloadForLinux: 'Linux के लिए डाउनलोड',
    otherDownloads: 'अन्य डाउनलोड',
    weRecommend:
      'आपको यह जानने की ज़रूरत नहीं कि कौन-सी फ़ाइल सही है — संदेह होने पर ✓ अनुशंसित वाली चुनें।',
    copy: 'कॉपी करें',
    copied: 'कॉपी हो गया!',
    showFull: 'पूरा दिखाएँ',
    hide: 'छिपाएँ',
    sha256: 'SHA-256',
    filesCount: '{n} फ़ाइलें',
    downloadsCount: '{n} डाउनलोड',
    preRelease: 'प्री-रिलीज़',
    unavailable: 'डाउनलोड लिंक लोड नहीं हो सके। इंस्टॉलर सीधे GitHub रिलीज़ पेज से प्राप्त करें:',
    olderUnavailable: 'पुराने वर्ज़न लोड नहीं हो सके। GitHub पर सभी रिलीज़ देखें:',
    rows: {
      'win-x64': 'अधिकांश PC और लैपटॉप (64-bit Intel/AMD)',
      'win-ia32': 'बहुत पुराने 32-bit कंप्यूटर',
      'win-arm64': 'Snapdragon वाले Windows लैपटॉप',
      'mac-arm64': 'M1, M2, M3, M4 चिप्स (2021 या बाद के)',
      'mac-x64': 'Intel वाले Mac (2021 से पहले)',
      'linux-x86_64': 'अधिकांश Linux कंप्यूटर (64-bit Intel/AMD)',
      'linux-arm64': 'ARM बोर्ड और लैपटॉप',
      'linux-armv7l': 'पुराने सिंगल-बोर्ड कंप्यूटर',
    },
  },
}

const LANG_MAP = {
  en: ['en', STRINGS.en],
  es: ['es', STRINGS.es],
  fr: ['fr', STRINGS.fr],
  de: ['de', STRINGS.de],
  'pt-BR': ['pt-BR', STRINGS.pt],
  'zh-CN': ['zh-CN', STRINGS.zh],
  hi: ['hi', STRINGS.hi],
}

const { lang } = useData()

const t = computed(() => STRINGS[lang.value] || STRINGS.en)
const localeTag = computed(() => LANG_MAP[lang.value]?.[0] || 'en')

const release = ref(buildData)

onMounted(async () => {
  try {
    const releases = await getReleases()
    if (props.older) {
      olderReleases.value = releases
      if (!olderReleases.value.length) {
        olderError.value = true
      }
    } else if (releases.length > 0 && Object.keys(releases[0].assets).length > 0) {
      release.value = releases[0]
    }
  } catch {
    if (props.older && !olderReleases.value.length) {
      olderError.value = true
    }
  }
})

const ROWS = {
  windows: [
    { key: 'win-x64', chip: 'x64', recommended: true },
    { key: 'win-ia32', chip: 'x86 · 32-bit', recommended: false },
    { key: 'win-arm64', chip: 'ARM64', recommended: false },
  ],
  macos: [
    { key: 'mac-arm64', chip: 'Apple Silicon', recommended: false },
    { key: 'mac-x64', chip: 'Intel', recommended: false },
  ],
  linux: [
    { key: 'linux-x86_64', chip: 'x86_64', recommended: true },
    { key: 'linux-arm64', chip: 'ARM64', recommended: false },
    { key: 'linux-armv7l', chip: 'ARMv7', recommended: false },
  ],
}

// ── OS / architecture detection (best-effort, client-only) ───
// Rank the "recommended" asset per platform group based on the visitor's
// UA. Detection is progressive: cheap sync UA-token checks first, then an
// async User-Agent Client Hints refinight when the browser supports it.
// Everything stays a *default* — every row is always shown so manual choice
// is never blocked.

const detected = ref({ windows: null, macos: null, linux: null })

function uaArchSync() {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  if (/ARM64|aarch64/i.test(ua)) return 'arm64'
  if (/WOW64|x86_64/.test(ua)) return 'x64'
  return null
}

function uaOsSync() {
  if (typeof navigator === 'undefined') return 'windows'
  const ua = navigator.userAgent || ''
  if (/Windows/i.test(ua)) return 'windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos'
  if (/Linux/i.test(ua)) return 'linux'
  return 'windows'
}

async function refineDetection() {
  if (typeof navigator === 'undefined') return
  const hints = navigator.userAgentData
  if (!hints?.getHighEntropyValues) return
  try {
    const values = await hints.getHighEntropyValues(['architecture'])
    const arch = values.architecture === 'arm' ? 'arm64' : values.architecture === 'x86' ? 'x64' : uaArchSync()
    const platform = hints.platform || ''
    if (/mac/i.test(platform)) detected.value.macos = arch === 'arm64' ? 'mac-arm64' : 'mac-x64'
    else if (/win/i.test(platform)) detected.value.windows = arch === 'arm64' ? 'win-arm64' : 'win-x64'
    else if (/lin/i.test(platform)) detected.value.linux = arch === 'arm64' ? 'linux-arm64' : 'linux-x86_64'
  } catch {
    // High-entropy hints unavailable — keep static defaults
  }
}

onMounted(() => {
  // Sync fallback: ARM64-capable Chromium on Windows/ARM64 can expose the
  // token directly; anything else keeps the static recommended default.
  const arch = uaArchSync()
  if (arch === 'arm64') {
    const ua = navigator.userAgent || ''
    if (/Windows/i.test(ua)) detected.value.windows = 'win-arm64'
    if (/Macintosh|Mac OS X/i.test(ua)) detected.value.macos = 'mac-arm64'
    if (/Linux/i.test(ua)) detected.value.linux = 'linux-arm64'
  }
  void refineDetection()
})

function isRecommended(key) {
  const group = props.platform
  return Boolean(group && detected.value[group] === key)
}

const rows = computed(() => {
  if (!props.platform || !release.value) return []
  return ROWS[props.platform]
    .map((config) => ({ ...config, asset: release.value.assets[config.key] }))
    .filter((row) => Boolean(row.asset))
    .map((row) => ({
      ...row,
      recommended: isRecommended(row.key) || row.recommended,
      description: t.value.rows[row.key] || t.value.rows['win-x64'],
    }))
})

// ---- Primary single-decision mode ----

const primaryRow = computed(() => {
  if (!props.primary || !release.value) return null
  const d = detected.value
  const group = d.windows ? 'windows' : d.macos ? 'macos' : d.linux ? 'linux' : uaOsSync()
  const preferred = d[group] || {
    windows: 'win-x64',
    macos: 'mac-arm64',
    linux: 'linux-x86_64',
  }[group]
  const config = ROWS[group].find((row) => row.key === preferred)
  if (!config) return null
  const asset = release.value.assets[config.key]
  if (!asset) return null
  return {
    ...config,
    group,
    asset,
    description: t.value.rows[config.key] || t.value.rows['win-x64'],
  }
})

const primaryLabel = computed(() => {
  const group = primaryRow.value?.group || 'windows'
  if (group === 'windows') return t.value.downloadForWindows
  if (group === 'macos') return t.value.downloadForMacos
  return t.value.downloadForLinux
})

const allRows = computed(() => {
  if (!release.value) return []
  const primaryKey = primaryRow.value?.key
  return ['windows', 'macos', 'linux']
    .flatMap((group) => ROWS[group].map((config) => ({ ...config, group, asset: release.value.assets[config.key] })))
    .filter((row) => Boolean(row.asset))
    .map((row) => ({
      ...row,
      recommended: row.key === primaryKey,
      description: t.value.rows[row.key] || t.value.rows['win-x64'],
    }))
})

function osLabelOfGroup(group) {
  if (group === 'macos') return 'macOS'
  return group.charAt(0).toUpperCase() + group.slice(1)
}

function onPrimaryDownload() {
  const row = primaryRow.value
  if (!row || !release.value) return
  const tag = release.value.tag || ''
  trackDownload(row.group, row.asset.name, tag)
  trackDownloadConversion(row.group, row.asset.name, tag)
}

function formatDate(iso) {
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
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return ''
  const mb = bytes / (1024 * 1024)
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`
}

function hasSize(asset) {
  return Boolean(asset && asset.size > 0)
}

function formatCount(n) {
  try {
    return new Intl.NumberFormat(localeTag.value).format(n)
  } catch {
    return String(n)
  }
}

function shortSha(sha) {
  return `${sha.slice(0, 10)}…${sha.slice(-8)}`
}

function assetList(rel) {
  return Object.values(rel.assets).sort((a, b) => a.key.localeCompare(b.key))
}

function osOf(key) {
  if (key.startsWith('win')) return 'windows'
  if (key.startsWith('mac')) return 'apple'
  return 'linux'
}

// Canonical platform for the download-conversion event (windows | macos | linux)
function platformOf(key) {
  if (key.startsWith('win')) return 'windows'
  if (key.startsWith('mac')) return 'macos'
  return 'linux'
}

function osLabel(key) {
  const os = osOf(key)
  return os === 'apple' ? 'macOS' : os.charAt(0).toUpperCase() + os.slice(1)
}

// ---- Previous versions ----

const olderReleases = ref(buildOlderData || [])
const olderError = ref(false)

const olderList = computed(() => {
  const currentTag = release.value?.tag
  return olderReleases.value.filter(
    (rel) => rel.tag !== currentTag && Object.keys(rel.assets).length > 0,
  )
})

// ---- Copy & expand helpers ----

const copiedKey = ref(null)
let copiedTimer

async function copyText(key, text) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    const version = key.split('/')[0] || ''
    trackShaCopy(version)
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copiedKey.value = null
    }, 1600)
  } catch {
    // clipboard unavailable; user can still expand and select manually
  }
}

const expandedKey = ref(null)

function toggleFull(key) {
  const wasExpanded = expandedKey.value === key
  expandedKey.value = wasExpanded ? null : key
  if (!wasExpanded) {
    const version = key.split('/')[0] || ''
    trackShaExpand(version)
  }
}
</script>

<style scoped>
.dl-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin-bottom: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  font-size: 14px;
  min-height: 42px;
}

.dl-label {
  color: var(--vp-c-text-2);
}

.dl-ver {
  font-family: var(--vp-font-family-mono);
  font-weight: 700;
  color: var(--vp-c-brand-1);
}

.dl-ver-sm {
  font-size: 13px;
}

.dl-date {
  color: var(--vp-c-text-3);
}

.dl-banner a,
.dl-unavailable a {
  color: var(--vp-c-brand-1);
  font-weight: 500;
}

.dl-list {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  min-height: 60px;
}

.dl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 20px;
}

.dl-row + .dl-row {
  border-top: 1px solid var(--vp-c-divider);
}

.dl-row:hover {
  background: var(--vp-c-bg-soft);
}

.dl-main {
  min-width: 0;
}

.dl-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dl-chip {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 600;
  padding: 2px 9px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.dl-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.dl-desc {
  margin-top: 6px;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.dl-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12.5px;
  color: var(--vp-c-text-3);
}

.dl-file {
  font-family: var(--vp-font-family-mono);
  word-break: break-all;
}

.dl-sha {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-2);
  background: transparent;
  padding: 0;
}

.dl-mini {
  font-size: 12px;
  line-height: 1;
  padding: 4px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}

.dl-mini:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.dl-full {
  margin: 10px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
  user-select: all;
}

/* ---------- Download buttons ---------- */
/* Explicit overrides so .vp-doc link styles (underline + hover color)
   can never bleed into the filled buttons. */
.dl-btn,
.dl-btn:hover,
.dl-btn:focus,
.dl-btn:focus-visible,
.dl-btn:active {
  text-decoration: none;
}

.dl-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 22px;
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: #fff !important;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.25s,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.dl-btn:hover {
  background: var(--vp-c-brand-2);
  transform: translateY(-1px);
}

.dl-btn:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}

.dl-btn:active {
  transform: translateY(0);
}

.dl-btn-sm {
  padding: 5px 14px;
  font-size: 13px;
}

.dl-row-recommended .dl-btn {
  box-shadow: 0 2px 10px rgba(3, 89, 173, 0.28);
}

/* ---------- Primary single-decision card ---------- */

.dl-primary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dl-primary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 24px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 12px;
  background: linear-gradient(180deg, var(--vp-c-brand-soft) 0%, var(--vp-c-bg-soft) 100%);
}

.dl-primary-info {
  min-width: 0;
}

.dl-primary-title {
  margin-top: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.dl-primary-meta {
  margin-top: 6px;
  font-size: 13.5px;
  color: var(--vp-c-text-2);
}

.dl-btn-lg {
  padding: 13px 30px;
  font-size: 15px;
}

.dl-btn-lg:hover {
  box-shadow: 0 4px 16px rgba(3, 89, 173, 0.32);
}

.dl-others {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
}

.dl-others-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  list-style: none;
  font-weight: 600;
  color: var(--vp-c-text-1);
  transition: background-color 0.15s;
}

.dl-others-summary::-webkit-details-marker,
.dl-others-summary::marker {
  display: none;
  content: '';
}

.dl-others-summary:hover {
  background: var(--vp-c-bg-soft);
}

.dl-others[open] .dl-chevron {
  transform: rotate(180deg);
}

.dl-we-recommend {
  padding: 10px 20px 0;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.dl-list-others {
  margin: 10px;
  min-height: 0;
}

.dl-os-tag {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 9px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  color: var(--vp-c-text-2);
}

/* ---------- Previous versions ---------- */

.dl-old {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dl-rel {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.25s;
}

.dl-rel[open] {
  border-color: var(--vp-c-brand-1);
}

.dl-rel-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  cursor: pointer;
  user-select: none;
  list-style: none;
  transition: background-color 0.15s;
}

.dl-rel-summary::-webkit-details-marker,
.dl-rel-summary::marker {
  display: none;
  content: '';
}

.dl-rel-summary:hover {
  background: var(--vp-c-bg-soft);
}

.dl-pre {
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  padding: 4px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  color: var(--vp-c-text-2);
}

.dl-count {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.dl-chevron {
  margin-left: auto;
  font-size: 11px;
  color: var(--vp-c-text-3);
  transition: transform 0.2s ease;
}

.dl-rel[open] .dl-chevron {
  transform: rotate(180deg);
}

.dl-rel-body {
  border-top: 1px solid var(--vp-c-divider);
}

.dl-rel-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
}

.dl-rel-row + .dl-rel-row {
  border-top: 1px dashed var(--vp-c-divider);
}

.dl-os {
  width: 18px !important;
  height: 18px !important;
  margin-right: 0 !important;
  vertical-align: middle;
  color: var(--vp-c-text-2);
  flex-shrink: 0;
}

.dl-rel-main {
  flex: 1;
  min-width: 180px;
}

.dl-unavailable {
  font-size: 14px;
}

@media (max-width: 760px) {
  .dl-count {
    display: none;
  }

  .dl-rel-row {
    flex-wrap: wrap;
  }

  .dl-rel-main {
    flex-basis: calc(100% - 34px);
  }
}

@media (max-width: 640px) {
  .dl-row {
    flex-direction: column;
    align-items: stretch;
  }

  .dl-btn {
    text-align: center;
  }

  .dl-primary-card {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .dl-btn-lg {
    width: 100%;
  }
}
</style>
