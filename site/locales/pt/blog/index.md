---
title: "Blog — EncodeX Atualizações, Lançamentos & Guias"
description: "Leia as últimas publicações do blog do EncodeX: anúncios de lançamentos, guias de recursos e novidades sobre o conversor de vídeo gratuito e de código aberto."
---

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vitepress'
import { data as allPosts } from '../../../.vitepress/data/blog.data'

const route = useRoute()
const locale = computed(() => {
  const p = route.path
  if (p.startsWith('/es/')) return 'es'
  if (p.startsWith('/fr/')) return 'fr'
  if (p.startsWith('/de/')) return 'de'
  if (p.startsWith('/pt/')) return 'pt'
  if (p.startsWith('/zh/')) return 'zh'
  if (p.startsWith('/hi/')) return 'hi'
  return 'en'
})
const posts = computed(() => allPosts.filter(p => p.locale === locale.value))
</script>

# Blog

Bem-vindo ao blog do EncodeX. Aqui você encontra anúncios de versões, changelogs e novidades sobre o projeto.

<div v-if="posts.length" class="blog-list">
  <a v-for="post in posts" :key="post.slug" :href="post.url" class="blog-card" @click="typeof gtag === 'function' && gtag('event', 'blog_post_click', { post_title: post.title, page_location: location.href })">
    <div class="blog-card-date">{{ post.date }}</div>
    <h3 class="blog-card-title">{{ post.title }}</h3>
    <p v-if="post.description" class="blog-card-desc">{{ post.description }}</p>
    <div v-if="post.tags.length" class="blog-card-tags">
      <span v-for="tag in post.tags" :key="tag" class="blog-tag">{{ tag }}</span>
    </div>
  </a>
</div>

<div v-else>
  <p>Nenhuma publicação ainda. Volte em breve!</p>
</div>

## Conheça o EncodeX

- [Baixar EncodeX](/pt/download) — gratuito para Windows, Mac e Linux
- [Ver todos os recursos](/pt/features) — capturas de tela e guias
- [Documentação técnica](/pt/docs/architecture) — como o EncodeX é construído
- [Contribuir](/pt/contributing) — reportar bugs, sugerir recursos ou enviar código

<style>
.blog-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.5rem;
}
.blog-card {
  display: block;
  padding: 1.25rem 1.5rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.25s, box-shadow 0.25s;
}
.blog-card:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
.blog-card-date {
  font-size: 0.85rem;
  color: var(--vp-c-text-3);
  margin-bottom: 0.3rem;
}
.blog-card-title {
  margin: 0 0 0.4rem;
  font-size: 1.2rem;
}
.blog-card-desc {
  margin: 0 0 0.5rem;
  color: var(--vp-c-text-2);
  font-size: 0.95rem;
}
.blog-card-tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.blog-tag {
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
}
</style>
