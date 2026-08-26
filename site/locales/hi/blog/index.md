---
title: "ब्लॉग — EncodeX अपडेट, रिलीज़ और गाइड"
description: "EncodeX ब्लॉग की नवीनतम पोस्ट पढ़ें: रिलीज़ घोषणाएँ, फ़ीचर गाइड और मुफ़्त, ओपन-सोर्स वीडियो कनवर्टर के बारे में अपडेट।"
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

# ब्लॉग

EncodeX ब्लॉग में आपका स्वागत है। यहाँ आपको रिलीज़ घोषणाएँ, चेंजलॉग और प्रोजेक्ट के अपडेट मिलेंगे।

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
  <p>अभी कोई पोस्ट नहीं है। जल्द ही वापस आएँ!</p>
</div>

## EncodeX जानें

- [EncodeX डाउनलोड करें](/hi/download) — Windows, Mac और Linux के लिए मुफ़्त
- [सभी फ़ीचर्स देखें](/hi/features) — स्क्रीनशॉट और गाइड
- [तकनीकी दस्तावेज़](/hi/docs/architecture) — EncodeX कैसे बना है
- [योगदान दें](/hi/contributing) — बग रिपोर्ट करें, फ़ीचर सुझाएँ या कोड सबमिट करें

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
