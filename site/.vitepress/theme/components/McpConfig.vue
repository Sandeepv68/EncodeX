<template>
  <div class="mcp-config">
    <McpConfigBlock
      v-for="cfg in configs"
      :key="cfg.id"
      :label="t[cfg.labelKey]"
      :copy-label="t.copy"
      :copied-label="t.copied"
      :fallback-label="t.copyFailed"
      :command="cfg.command"
      :lang="cfg.lang"
      :docs-label="t[cfg.docsLabelKey]"
      :docs-url="cfg.docsUrl"
      @copied="onCopied(cfg.id)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';
import { trackEvent } from '../composables/useAnalytics';
import McpConfigBlock from './McpConfigBlock.vue';

const STRINGS: Record<string, { [k: string]: string }> = {
  en: {
    claudeDesktop: 'Claude Desktop',
    claudeCode: 'Claude Code',
    cursor: 'Cursor',
    vscode: 'VS Code',
    copy: 'Copy configuration',
    copied: 'Copied!',
    copyFailed: 'Press Ctrl/⌘+C to copy',
    claudeDocs: 'Open Claude instructions',
    cursorDocs: 'Open Cursor instructions',
    vscodeDocs: 'Open VS Code instructions',
  },
  es: {
    claudeDesktop: 'Claude Desktop',
    claudeCode: 'Claude Code',
    cursor: 'Cursor',
    vscode: 'VS Code',
    copy: 'Copiar configuración',
    copied: '¡Copiado!',
    copyFailed: 'Pulsa Ctrl/⌘+C para copiar',
    claudeDocs: 'Abrir instrucciones de Claude',
    cursorDocs: 'Abrir instrucciones de Cursor',
    vscodeDocs: 'Abrir instrucciones de VS Code',
  },
  fr: {
    claudeDesktop: 'Claude Desktop',
    claudeCode: 'Claude Code',
    cursor: 'Cursor',
    vscode: 'VS Code',
    copy: 'Copier la configuration',
    copied: 'Copié !',
    copyFailed: 'Appuyez sur Ctrl/⌘+C pour copier',
    claudeDocs: "Ouvrir les instructions Claude",
    cursorDocs: 'Ouvrir les instructions Cursor',
    vscodeDocs: "Ouvrir les instructions VS Code",
  },
  de: {
    claudeDesktop: 'Claude Desktop',
    claudeCode: 'Claude Code',
    cursor: 'Cursor',
    vscode: 'VS Code',
    copy: 'Konfiguration kopieren',
    copied: 'Kopiert!',
    copyFailed: 'Drücken Sie Strg/⌘+C zum Kopieren',
    claudeDocs: 'Claude-Anleitung öffnen',
    cursorDocs: 'Cursor-Anleitung öffnen',
    vscodeDocs: 'VS-Code-Anleitung öffnen',
  },
  pt: {
    claudeDesktop: 'Claude Desktop',
    claudeCode: 'Claude Code',
    cursor: 'Cursor',
    vscode: 'VS Code',
    copy: 'Copiar configuração',
    copied: 'Copiado!',
    copyFailed: 'Pressione Ctrl/⌘+C para copiar',
    claudeDocs: 'Abrir instruções do Claude',
    cursorDocs: 'Abrir instruções do Cursor',
    vscodeDocs: 'Abrir instruções do VS Code',
  },
  zh: {
    claudeDesktop: 'Claude Desktop',
    claudeCode: 'Claude Code',
    cursor: 'Cursor',
    vscode: 'VS Code',
    copy: '复制配置',
    copied: '已复制！',
    copyFailed: '按 Ctrl/⌘+C 复制',
    claudeDocs: '打开 Claude 说明',
    cursorDocs: '打开 Cursor 说明',
    vscodeDocs: '打开 VS Code 说明',
  },
  hi: {
    claudeDesktop: 'Claude Desktop',
    claudeCode: 'Claude Code',
    cursor: 'Cursor',
    vscode: 'VS Code',
    copy: 'कॉन्फ़िगरेशन कॉपी करें',
    copied: 'कॉपी हो गया!',
    copyFailed: 'कॉपी करने के लिए Ctrl/⌘+C दबाएँ',
    claudeDocs: 'Claude निर्देश खोलें',
    cursorDocs: 'Cursor निर्देश खोलें',
    vscodeDocs: 'VS Code निर्देश खोलें',
  },
};

const CANON: Record<string, string> = { 'pt-BR': 'pt', 'zh-CN': 'zh' };

const { lang } = useData();

const t = computed(() => {
  const key = CANON[lang.value] || lang.value;
  return STRINGS[key] || STRINGS.en;
});

const claudeDesktopJson = '{\n  "mcpServers": {\n    "encodex": {\n      "command": "encodex",\n      "args": ["--mcp"]\n    }\n  }\n}';

const claudeCodeCmd = 'claude mcp add encodex -- encodex --mcp';

const vscodeJson = '{\n  "servers": {\n    "encodex": {\n      "command": "encodex",\n      "args": ["--mcp"]\n    }\n  }\n}';

const configs = [
  {
    id: 'claude-desktop',
    labelKey: 'claudeDesktop',
    command: claudeDesktopJson,
    lang: 'json',
    docsLabelKey: 'claudeDocs',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/mcp',
  },
  {
    id: 'claude-code',
    labelKey: 'claudeCode',
    command: claudeCodeCmd,
    lang: 'bash',
    docsLabelKey: 'claudeDocs',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/mcp',
  },
  {
    id: 'cursor',
    labelKey: 'cursor',
    command: claudeDesktopJson,
    lang: 'json',
    docsLabelKey: 'cursorDocs',
    docsUrl: 'https://docs.cursor.com/context/model-context-protocol',
  },
  {
    id: 'vscode',
    labelKey: 'vscode',
    command: vscodeJson,
    lang: 'json',
    docsLabelKey: 'vscodeDocs',
    docsUrl: 'https://code.visualstudio.com/docs/copilot/chat/mcp',
  },
];

function onCopied(id: string) {
  trackEvent('mcp_config_copy', { client: id, page_location: window.location.href });
}
</script>

<style scoped>
.mcp-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>