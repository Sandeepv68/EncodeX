---
title: "Blog — EncodeX Updates, Releases & Guides"
description: "Read the latest EncodeX blog posts: release announcements, feature guides, and updates about the free, open-source video converter."
---

<script setup>
import { data as posts } from '../.vitepress/data/blog.data'
</script>

# Blog

Welcome to the EncodeX blog. Here you'll find release announcements, changelogs, and updates about the project.

<div v-if="posts.length" class="blog-list">
  <a v-for="post in posts" :key="post.slug" :href="post.url" class="blog-card">
    <div class="blog-card-date">{{ post.date }}</div>
    <h3 class="blog-card-title">{{ post.title }}</h3>
    <p v-if="post.description" class="blog-card-desc">{{ post.description }}</p>
    <div v-if="post.tags.length" class="blog-card-tags">
      <span v-for="tag in post.tags" :key="tag" class="blog-tag">{{ tag }}</span>
    </div>
  </a>
</div>

<div v-else>
  <p>No blog posts yet. Check back soon!</p>
</div>

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
