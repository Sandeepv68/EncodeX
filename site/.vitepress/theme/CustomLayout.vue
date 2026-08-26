<script setup>
import { onMounted } from 'vue'
import DefaultTheme from 'vitepress/theme'
import HeroLogo from './components/HeroLogo.vue'
import SiteFooter from './components/SiteFooter.vue'
import VersionBadge from './components/VersionBadge.vue'
import { trackExternalLink, trackLocaleSwitch } from './composables/useAnalytics'

const { Layout } = DefaultTheme

onMounted(() => {
  if (document.querySelector('main, [role="main"]')) return
  const home = document.querySelector('.VPHome')
  if (home) home.setAttribute('role', 'main')

  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href]')
    if (!anchor) return
    const href = anchor.getAttribute('href') || ''
    if (href.startsWith('http') && !href.includes('encodex.in')) {
      trackExternalLink(href, anchor.textContent?.trim() || '')
    }
  })

  document.addEventListener('click', (e) => {
    const langItem = e.target.closest('[class*="VPLanguage"] [role="radio"], [class*="VPLocale"] a, .VPMenu .item')
    if (!langItem) return
    const text = langItem.textContent?.trim()
    if (text) {
      trackLocaleSwitch(text)
    }
  })
})
</script>

<template>
  <Layout>
    <template #home-hero-image>
      <HeroLogo />
    </template>
    <template #nav-bar-title-before>
      <img class="custom-nav-logo" src="/images/icon.webp" alt="" width="24" height="24">
    </template>
    <template #nav-bar-title-after>
      <VersionBadge variant="nav" />
    </template>
    <template #home-hero-actions-after>
      <VersionBadge variant="hero" />
    </template>
    <template #layout-bottom>
      <SiteFooter />
    </template>
  </Layout>
</template>
