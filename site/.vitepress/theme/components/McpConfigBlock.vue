<template>
  <div class="mcp-cb">
    <div class="mcp-cb-header">
      <span class="mcp-cb-label">{{ label }}</span>
      <button
        type="button"
        class="mcp-cb-btn"
        :class="{ 'mcp-cb-copied': copied }"
        :aria-label="copied ? copiedLabel : copyLabel"
        @click="copy"
      >
        <svg v-if="!copied" class="mcp-cb-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <svg v-else class="mcp-cb-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {{ copied ? copiedLabel : copyLabel }}
      </button>
    </div>
    <pre class="mcp-cb-pre"><code :class="`language-${lang}`">{{ command }}</code></pre>
    <a v-if="docsLabel" class="mcp-cb-docs" :href="docsUrl" target="_blank" rel="noopener noreferrer" @click="onDocsClick">{{ docsLabel }} →</a>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { trackEvent } from '../composables/useAnalytics';

const props = defineProps<{
  label: string;
  copyLabel: string;
  copiedLabel: string;
  fallbackLabel: string;
  command: string;
  lang?: string;
  docsLabel?: string;
  docsUrl?: string;
}>();

const emit = defineEmits<{ copied: [] }>();

const copied = ref(false);
let resetTimer: ReturnType<typeof setTimeout> | null = null;

async function copy() {
  const succeeded = await copyText(props.command, props.fallbackLabel);
  if (succeeded) {
    copied.value = true;
    emit('copied');
  }
  if (resetTimer) clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    copied.value = false;
  }, 2200);
}

async function copyText(text: string, fallbackLabel: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      alert(fallbackLabel);
      return false;
    }
  }
}

function onDocsClick() {
  trackEvent('mcp_config_docs', { page_location: window.location.href });
}
</script>

<style scoped>
.mcp-cb {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}

.mcp-cb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.mcp-cb-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.mcp-cb-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, color 0.2s;
}

.mcp-cb-btn:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.mcp-cb-copied {
  border-color: #22a06b;
  color: #22a06b;
}

.mcp-cb-icon {
  flex-shrink: 0;
}

.mcp-cb-pre {
  margin: 0;
  padding: 12px 16px;
  overflow-x: auto;
  background: var(--vp-c-bg);
  font-size: 13px;
  line-height: 1.6;
}

.mcp-cb-pre code {
  background: transparent !important;
  padding: 0 !important;
}

.mcp-cb-docs {
  display: block;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  border-top: 1px solid var(--vp-c-divider);
  text-decoration: none;
}

.mcp-cb-docs:hover {
  background: var(--vp-c-bg);
}
</style>