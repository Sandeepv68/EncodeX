<template>
  <div class="mcp-demo" :aria-label="t.ariaLabel" role="img">
    <div class="mcp-demo-window">
      <div class="mcp-demo-titlebar">
        <span class="mcp-demo-dot" aria-hidden="true"></span>
        <span class="mcp-demo-dot" aria-hidden="true"></span>
        <span class="mcp-demo-dot" aria-hidden="true"></span>
        <span class="mcp-demo-title">{{ t.assistant }}</span>
      </div>

      <div class="mcp-demo-body">
        <div class="mcp-msg mcp-msg-user">
          {{ t.userPrompt }} <code>~/Output</code>
        </div>

        <div class="mcp-msg mcp-msg-assistant">
          {{ t.assistantReply }}
        </div>

        <div class="mcp-progress" aria-hidden="true">
          <div class="mcp-progress-bar">
            <span class="mcp-progress-fill">{{ t.percent }}</span>
          </div>
        </div>

        <ul class="mcp-files" aria-hidden="true">
          <li>
            <span class="mcp-ok">✓</span>
            <code>video1.mp4</code>
          </li>
          <li>
            <span class="mcp-ok">✓</span>
            <code>video2.mp4</code>
          </li>
          <li>
            <span class="mcp-ok">✓</span>
            <code>video3.mp4</code>
          </li>
          <li class="mcp-file-active">
            <span class="mcp-spinner" aria-hidden="true"></span>
            <code>video4.mp4</code>
            <span class="mcp-file-wait">…</span>
          </li>
        </ul>
      </div>
    </div>

    <p class="mcp-demo-tagline">{{ t.tagline }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';

const STRINGS: Record<string, { [k: string]: string }> = {
  en: {
    assistant: 'Claude · EncodeX',
    ariaLabel:
      'Example of an AI assistant asked to convert all videos in a folder to YouTube 1080p and save them to an output folder, showing a conversion progress bar inside EncodeX.',
    userPrompt: 'Convert all videos in ~/Videos to YouTube 1080p and save them to',
    assistantReply: "I'll convert 12 videos using EncodeX.",
    percent: '████████████████░░ 87%',
    tagline: 'Your AI assistant can now operate your local media toolkit.',
  },
  es: {
    assistant: 'Claude · EncodeX',
    ariaLabel:
      'Ejemplo de un asistente de IA al que se le pide convertir todos los vídeos de una carpeta a 1080p para YouTube y guardarlos en una carpeta de salida, mostrando una barra de progreso de conversión en EncodeX.',
    userPrompt: 'Convierte todos los vídeos de ~/Videos a 1080p para YouTube y guárdalos en',
    assistantReply: 'Convertiré 12 vídeos con EncodeX.',
    percent: '████████████████░░ 87%',
    tagline: 'Tu asistente de IA ya puede manejar tu kit de medios local.',
  },
  fr: {
    assistant: 'Claude · EncodeX',
    ariaLabel:
      "Exemple d'un assistant IA à qui l'on demande de convertir toutes les vidéos d'un dossier en 1080p YouTube et de les enregistrer dans un dossier de sortie, avec une barre de progression de conversion dans EncodeX.",
    userPrompt: 'Convertis toutes les vidéos de ~/Videos en 1080p YouTube et enregistre-les dans',
    assistantReply: "Je vais convertir 12 vidéos avec EncodeX.",
    percent: '████████████████░░ 87%',
    tagline: 'Votre assistant IA peut maintenant piloter votre boîte à outils média locale.',
  },
  de: {
    assistant: 'Claude · EncodeX',
    ariaLabel:
      'Beispiel eines KI-Assistenten, der gebeten wird, alle Videos in einem Ordner in YouTube-1080p zu konvertieren und in einem Ausgabeordner zu speichern, mit einem Konvertierungsfortschrittsbalken in EncodeX.',
    userPrompt: 'Konvertiere alle Videos in ~/Videos in YouTube-1080p und speichere sie in',
    assistantReply: 'Ich konvertiere 12 Videos mit EncodeX.',
    percent: '████████████████░░ 87%',
    tagline: 'Ihr KI-Assistent kann jetzt Ihre lokale Medien-Werkzeugkiste bedienen.',
  },
  pt: {
    assistant: 'Claude · EncodeX',
    ariaLabel:
      'Exemplo de um assistente de IA que recebe a tarefa de converter todos os vídeos de uma pasta para 1080p do YouTube e salvá-los em uma pasta de saída, mostrando uma barra de progresso de conversão no EncodeX.',
    userPrompt: 'Converta todos os vídeos em ~/Videos para 1080p do YouTube e salve em',
    assistantReply: 'Vou converter 12 vídeos com o EncodeX.',
    percent: '████████████████░░ 87%',
    tagline: 'Seu assistente de IA agora pode operar seu kit de mídia local.',
  },
  zh: {
    assistant: 'Claude · EncodeX',
    ariaLabel:
      'AI 助手被要求将文件夹中的所有视频转换为 YouTube 1080p 并保存到输出文件夹的示例，EncodeX 中显示转换进度条。',
    userPrompt: '将 ~/Videos 中的所有视频转换为 YouTube 1080p 并保存到',
    assistantReply: '我将使用 EncodeX 转换 12 个视频。',
    percent: '████████████████░░ 87%',
    tagline: '您的 AI 助手现在可以操作您的本地媒体工具包。',
  },
  hi: {
    assistant: 'Claude · EncodeX',
    ariaLabel:
      'एक AI असिस्टेंट से किसी फ़ोल्डर के सभी वीडियो को YouTube 1080p में बदलकर आउटपुट फ़ोल्डर में सेव करने को कहने का उदाहरण, जिसमें EncodeX में कन्वर्ज़न प्रोग्रेस बार दिखाई देता है।',
    userPrompt: '~/Videos के सभी वीडियो को YouTube 1080p में बदलें और इन्हें',
    assistantReply: 'मैं EncodeX से 12 वीडियो कन्वर्ट करूँगा।',
    percent: '████████████████░░ 87%',
    tagline: 'आपका AI असिस्टेंट अब आपके लोकल मीडिया टूलकिट को चला सकता है।',
  },
};

const CANON: Record<string, string> = { 'pt-BR': 'pt', 'zh-CN': 'zh' };

const { lang } = useData();

const t = computed(() => {
  const key = CANON[lang.value] || lang.value;
  return STRINGS[key] || STRINGS.en;
});
</script>

<style scoped>
.mcp-demo {
  max-width: 720px;
  margin: 28px auto 12px;
}

.mcp-demo-window {
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg);
  box-shadow: 0 10px 30px rgba(3, 89, 173, 0.08);
  overflow: hidden;
}

.dark .mcp-demo-window {
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

.mcp-demo-titlebar {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 14px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
}

.mcp-demo-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--vp-c-text-3);
  opacity: 0.4;
}

.mcp-demo-title {
  margin-left: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.mcp-demo-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 20px 20px;
  font-size: 14px;
}

.mcp-msg {
  max-width: 88%;
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.55;
  word-break: break-word;
}

.mcp-msg code {
  font-size: 12px;
  background: transparent;
  padding: 0;
}

.mcp-msg-user {
  align-self: flex-end;
  background: var(--vp-c-brand-1);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.mcp-msg-user code {
  color: rgba(255, 255, 255, 0.9);
}

.mcp-msg-assistant {
  align-self: flex-start;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border-bottom-left-radius: 4px;
}

.mcp-progress {
  margin-top: 4px;
  padding: 12px 14px;
  background: var(--vp-c-bg-soft);
  border-radius: 10px;
}

.mcp-progress-bar {
  display: flex;
  align-items: center;
  height: 22px;
  border-radius: 11px;
  background: var(--vp-c-divider);
  overflow: hidden;
}

.mcp-progress-fill {
  display: block;
  width: 87%;
  height: 100%;
  padding-left: 12px;
  line-height: 22px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
  color: #fff;
  background: linear-gradient(
    90deg,
    var(--vp-c-brand-2),
    var(--vp-c-brand-1)
  );
  animation: mcp-fill-pulse 2.4s ease-in-out infinite;
  transform-origin: left center;
}

@keyframes mcp-fill-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.78;
  }
}

.mcp-files {
  list-style: none;
  margin: 2px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mcp-files li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--vp-c-text-2);
}

.mcp-ok {
  color: #22a06b;
  font-weight: 700;
}

.mcp-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--vp-c-divider);
  border-top-color: var(--vp-c-brand-1);
  border-radius: 50%;
  animation: mcp-spin 0.9s linear infinite;
}

@keyframes mcp-spin {
  to {
    transform: rotate(360deg);
  }
}

.mcp-file-wait {
  margin-left: auto;
  color: var(--vp-c-text-3);
}

.mcp-demo-tagline {
  margin: 14px 0 0;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

@media (prefers-reduced-motion: reduce) {
  .mcp-progress-fill,
  .mcp-spinner {
    animation: none;
  }
}
</style>