<template>
  <section v-if="related.length" class="related-conversions">
    <h2>{{ t.title }}</h2>
    <ul class="rc-list">
      <li v-for="item in related" :key="item.slug">
        <a :href="href(item.slug)">{{ item.title }}</a>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';

const props = defineProps<{ slug: string }>();

const STRINGS: Record<string, { title: string }> = {
  en: { title: "Related conversions" },
  es: { title: "Conversiones relacionadas" },
  fr: { title: "Conversions associées" },
  de: { title: "Verwandte Konvertierungen" },
  pt: { title: "Conversões relacionadas" },
  zh: { title: "相关视频转换" },
  hi: { title: "संबंधित रूपांतरण" },
};

const CANON: Record<string, string> = { 'pt-BR': 'pt', 'zh-CN': 'zh' };

const LOCALE_PREFIX: Record<string, string> = {
  en: '', es: '/es', fr: '/fr', de: '/de', 'pt-BR': '/pt', 'zh-CN': '/zh', hi: '/hi',
};

const REL: Record<string, string[]> = {
  "compress/mkv": [
    "compress/mp4",
    "convert/mkv-to-mp4",
    "convert/mkv-to-webm",
    "convert/mov-to-mkv",
    "convert/mp4-to-mkv"
  ],
  "compress/mp4": [
    "compress/mkv",
    "convert/avi-to-mp4",
    "convert/mkv-to-mp4",
    "convert/webm-to-mp4"
  ],
  "convert/avi-to-mkv": [
    "convert/avi-to-mp4",
    "convert/flv-to-mkv",
    "convert/mov-to-mkv",
    "convert/mp4-to-mkv",
    "convert/webm-to-mkv",
    "convert/wmv-to-mkv"
  ],
  "convert/avi-to-mp4": [
    "convert/avi-to-mkv",
    "convert/flv-to-mp4",
    "convert/m4v-to-mp4",
    "convert/mov-to-mp4"
  ],
  "convert/flv-to-mkv": [
    "convert/avi-to-mkv",
    "convert/flv-to-mp4",
    "convert/webm-to-mkv",
    "convert/wmv-to-mkv"
  ],
  "convert/flv-to-mp4": [
    "convert/avi-to-mp4",
    "convert/flv-to-mkv",
    "convert/webm-to-mp4",
    "convert/wmv-to-mp4"
  ],
  "convert/m4v-to-mp4": [
    "convert/avi-to-mp4",
    "convert/mov-to-mp4",
    "convert/webm-to-mp4",
    "convert/wmv-to-mp4"
  ],
  "convert/mkv-to-mp3": [
    "convert/mkv-to-mp4",
    "convert/mkv-to-webm",
    "convert/mov-to-mp3",
    "convert/mp4-to-mp3"
  ],
  "convert/mkv-to-mp4": [
    "compress/mkv",
    "compress/mp4",
    "convert/mkv-to-mp3",
    "convert/mkv-to-webm",
    "convert/mov-to-mkv",
    "convert/mov-to-mp4"
  ],
  "convert/mkv-to-webm": [
    "compress/mkv",
    "convert/mkv-to-mp3",
    "convert/mkv-to-mp4",
    "convert/mp4-to-webm",
    "convert/webm-to-mkv"
  ],
  "convert/mov-to-mkv": [
    "compress/mkv",
    "convert/avi-to-mkv",
    "convert/mkv-to-mp4",
    "convert/mov-to-mp3",
    "convert/mov-to-mp4",
    "convert/mp4-to-mkv"
  ],
  "convert/mov-to-mp3": [
    "convert/mkv-to-mp3",
    "convert/mov-to-mkv",
    "convert/mov-to-mp4",
    "convert/mp4-to-mp3"
  ],
  "convert/mov-to-mp4": [
    "convert/avi-to-mp4",
    "convert/m4v-to-mp4",
    "convert/mkv-to-mp4",
    "convert/mov-to-mkv",
    "convert/mov-to-mp3",
    "convert/wmv-to-mp4"
  ],
  "convert/mp4-to-mkv": [
    "compress/mkv",
    "convert/avi-to-mkv",
    "convert/mov-to-mkv",
    "convert/mp4-to-mp3",
    "convert/mp4-to-webm",
    "convert/webm-to-mkv"
  ],
  "convert/mp4-to-mp3": [
    "convert/mkv-to-mp3",
    "convert/mov-to-mp3",
    "convert/mp4-to-mkv",
    "convert/mp4-to-webm"
  ],
  "convert/mp4-to-webm": [
    "convert/mkv-to-webm",
    "convert/mp4-to-mkv",
    "convert/mp4-to-mp3",
    "convert/webm-to-mp4"
  ],
  "convert/webm-to-mkv": [
    "convert/avi-to-mkv",
    "convert/flv-to-mkv",
    "convert/mkv-to-webm",
    "convert/mp4-to-mkv",
    "convert/webm-to-mp4",
    "convert/wmv-to-mkv"
  ],
  "convert/webm-to-mp4": [
    "compress/mp4",
    "convert/flv-to-mp4",
    "convert/m4v-to-mp4",
    "convert/mp4-to-webm",
    "convert/webm-to-mkv",
    "convert/wmv-to-mp4"
  ],
  "convert/wmv-to-mkv": [
    "convert/avi-to-mkv",
    "convert/flv-to-mkv",
    "convert/webm-to-mkv",
    "convert/wmv-to-mp4"
  ],
  "convert/wmv-to-mp4": [
    "convert/flv-to-mp4",
    "convert/m4v-to-mp4",
    "convert/mov-to-mp4",
    "convert/webm-to-mp4",
    "convert/wmv-to-mkv"
  ]
};

const TITLES: Record<string, Record<string, string>> = {
  "convert/avi-to-mkv": {
    "en": "Convert AVI to MKV",
    "es": "Convierte AVI a MKV",
    "fr": "Convertir AVI en MKV",
    "de": "Konvertieren Sie AVI zu MKV",
    "pt": "Converter AVI para MKV",
    "zh": "将 AVI 转换为 MKV",
    "hi": "AVI को MKV में बदलें"
  },
  "convert/avi-to-mp4": {
    "en": "Convert AVI to MP4",
    "es": "Convierte AVI a MP4",
    "fr": "Convertissez AVI vers MP4",
    "de": "Konvertieren Sie AVI zu MP4",
    "pt": "Converta AVI para MP4",
    "zh": "将 AVI 转换为 MP4",
    "hi": "AVI को MP4 में कन्वर्ट करें"
  },
  "convert/flv-to-mkv": {
    "en": "Convert FLV to MKV",
    "es": "Convierte FLV a MKV",
    "fr": "Convertir FLV en MKV",
    "de": "Konvertieren Sie FLV zu MKV",
    "pt": "Converter FLV para MKV",
    "zh": "将 FLV 转换为 MKV",
    "hi": "FLV को MKV में बदलें"
  },
  "convert/flv-to-mp4": {
    "en": "Convert FLV to MP4",
    "es": "Convierte FLV a MP4",
    "fr": "Convertissez FLV vers MP4",
    "de": "Konvertieren Sie FLV zu MP4",
    "pt": "Converta FLV para MP4",
    "zh": "将 FLV 转换为 MP4",
    "hi": "FLV को MP4 में कन्वर्ट करें"
  },
  "convert/m4v-to-mp4": {
    "en": "Convert M4V to MP4",
    "es": "Convierte M4V a MP4",
    "fr": "Convertissez M4V vers MP4",
    "de": "Konvertieren Sie M4V zu MP4",
    "pt": "Converta M4V para MP4",
    "zh": "将 M4V 转换为 MP4",
    "hi": "M4V को MP4 में कन्वर्ट करें"
  },
  "convert/mkv-to-mp3": {
    "en": "Convert MKV to MP3",
    "es": "Convierte MKV a MP3",
    "fr": "Convertir MKV en MP3",
    "de": "MKV in MP3 konvertieren",
    "pt": "Converta MKV para MP3",
    "zh": "将 MKV 转换为 MP3",
    "hi": "MKV को MP3 में कन्वर्ट करें"
  },
  "convert/mkv-to-mp4": {
    "en": "Convert MKV to MP4",
    "es": "Convierte MKV a MP4",
    "fr": "Convertissez MKV vers MP4",
    "de": "Konvertieren Sie MKV zu MP4",
    "pt": "Converta MKV para MP4",
    "zh": "将 MKV 转换为 MP4",
    "hi": "MKV को MP4 में कन्वर्ट करें"
  },
  "convert/mkv-to-webm": {
    "en": "Convert MKV to WebM",
    "es": "Convierte MKV a WebM",
    "fr": "Convertissez MKV vers WebM",
    "de": "Konvertieren Sie MKV zu WebM",
    "pt": "Converta MKV para WebM",
    "zh": "将 MKV 转换为 WebM",
    "hi": "MKV को WebM में कन्वर्ट करें"
  },
  "convert/mov-to-mkv": {
    "en": "Convert MOV to MKV",
    "es": "Convierte MOV a MKV",
    "fr": "Convertissez MOV vers MKV",
    "de": "Konvertieren Sie MOV zu MKV",
    "pt": "Converta MOV para MKV",
    "zh": "将 MOV 转换为 MKV",
    "hi": "MOV को MKV में कन्वर्ट करें"
  },
  "convert/mov-to-mp3": {
    "en": "Convert MOV to MP3",
    "es": "Convierte MOV a MP3",
    "fr": "Convertir MOV en MP3",
    "de": "MOV in MP3 konvertieren",
    "pt": "Converta MOV para MP3",
    "zh": "将 MOV 转换为 MP3",
    "hi": "MOV को MP3 में कन्वर्ट करें"
  },
  "convert/mov-to-mp4": {
    "en": "Convert MOV to MP4",
    "es": "Convierte MOV a MP4",
    "fr": "Convertissez MOV vers MP4",
    "de": "Konvertieren Sie MOV zu MP4",
    "pt": "Converta MOV para MP4",
    "zh": "将 MOV 转换为 MP4",
    "hi": "MOV को MP4 में कन्वर्ट करें"
  },
  "convert/mp4-to-mkv": {
    "en": "Convert MP4 to MKV",
    "es": "Convierte MP4 a MKV",
    "fr": "Convertir MP4 en MKV",
    "de": "MP4 zu MKV konvertieren",
    "pt": "Converter MP4 para MKV",
    "zh": "将 MP4 转换为 MKV",
    "hi": "MP4 को MKV में बदलें"
  },
  "convert/mp4-to-mp3": {
    "en": "Convert MP4 to MP3",
    "es": "Convierte MP4 a MP3",
    "fr": "Convertir MP4 en MP3",
    "de": "MP4 in MP3 konvertieren",
    "pt": "Converta MP4 para MP3",
    "zh": "将 MP4 转换为 MP3",
    "hi": "MP4 को MP3 में कन्वर्ट करें"
  },
  "convert/mp4-to-webm": {
    "en": "Convert MP4 to WebM",
    "es": "Convierte MP4 a WebM",
    "fr": "Convertir MP4 en WebM",
    "de": "MP4 zu WebM konvertieren",
    "pt": "Converter MP4 para WebM",
    "zh": "将 MP4 转换为 WebM",
    "hi": "MP4 को WebM में बदलें"
  },
  "convert/webm-to-mkv": {
    "en": "Convert WebM to MKV",
    "es": "Convierte WebM a MKV",
    "fr": "Convertissez WebM vers MKV",
    "de": "Konvertieren Sie WebM zu MKV",
    "pt": "Converta WebM para MKV",
    "zh": "将 WebM 转换为 MKV",
    "hi": "WebM को MKV में कन्वर्ट करें"
  },
  "convert/webm-to-mp4": {
    "en": "Convert WebM to MP4",
    "es": "Convierte WebM a MP4",
    "fr": "Convertissez WebM vers MP4",
    "de": "Konvertieren Sie WebM zu MP4",
    "pt": "Converta WebM para MP4",
    "zh": "将 WebM 转换为 MP4",
    "hi": "WebM को MP4 में कन्वर्ट करें"
  },
  "convert/wmv-to-mkv": {
    "en": "Convert WMV to MKV",
    "es": "Convierte WMV a MKV",
    "fr": "Convertir WMV en MKV",
    "de": "Konvertieren Sie WMV zu MKV",
    "pt": "Converter WMV para MKV",
    "zh": "将 WMV 转换为 MKV",
    "hi": "WMV को MKV में बदलें"
  },
  "convert/wmv-to-mp4": {
    "en": "Convert WMV to MP4",
    "es": "Convierte WMV a MP4",
    "fr": "Convertissez WMV vers MP4",
    "de": "Konvertieren Sie WMV zu MP4",
    "pt": "Converta WMV para MP4",
    "zh": "将 WMV 转换为 MP4",
    "hi": "WMV को MP4 में कन्वर्ट करें"
  },
  "compress/mp4": {
    "en": "Compress MP4 Videos",
    "es": "Comprime vídeos MP4",
    "fr": "Compresser des vidéos MP4",
    "de": "MP4-Videos komprimieren",
    "pt": "Comprimir vídeos MP4",
    "zh": "压缩 MP4 视频",
    "hi": "MP4 वीडियो कंप्रेस करें"
  },
  "compress/mkv": {
    "en": "Compress MKV Videos",
    "es": "Comprime vídeos MKV",
    "fr": "Compresser des vidéos MKV",
    "de": "MKV-Videos komprimieren",
    "pt": "Comprimir vídeos MKV",
    "zh": "压缩 MKV 视频",
    "hi": "MKV वीडियो कंप्रेस करें"
  }
};

const { lang } = useData();

const localeKey = computed(() => CANON[lang.value] || lang.value);
const t = computed(() => STRINGS[localeKey.value] || STRINGS.en);

const related = computed(() => (REL[props.slug] || []).map((s) => ({
  slug: s,
  title: (TITLES[s] && TITLES[s][localeKey.value]) || s,
})));

function href(slug: string) {
  const prefix = LOCALE_PREFIX[lang.value] || '';
  return prefix + '/' + slug;
}
</script>

<style scoped>
.related-conversions {
  margin-top: 24px;
}
.rc-list {
  columns: 2;
  column-gap: 40px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.rc-list li {
  margin: 4px 0;
}
@media (max-width: 640px) {
  .rc-list { columns: 1; }
}
</style>
