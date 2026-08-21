<script setup>
import DefaultTheme from 'vitepress/theme'
import HeroLogo from './components/HeroLogo.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #home-hero-image>
      <HeroLogo />
    </template>
    <template #nav-bar-title-before>
      <img class="custom-nav-logo" src="/images/icon.webp" alt="" width="24" height="24">
    </template>
  </Layout>
</template>
