<script setup>
import { useData } from 'vitepress';

const props = defineProps({
  light: { type: String, required: true },
  dark: { type: String, default: '' },
  alt: { type: String, default: '' },
});

const { isDark } = useData();
</script>

<template>
  <img class="theme-image" :src="isDark && props.dark ? props.dark : props.light" :alt="props.alt" loading="lazy" decoding="async" />
</template>
