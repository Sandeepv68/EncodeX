# Arquitetura

O EncodeX é uma ferramenta multimídia de conversão multiplataforma construída sobre FFmpeg, React, TypeScript e Electron. É destinada a desenvolvedores que desejam entender como as peças se encaixam antes de contribuir.

<p align="center"><img src="/images/architecture.webp" alt="EncodeX architecture" width="1024" height="1024" loading="lazy" /></p>

## Princípios de design

O renderer nunca cria processos e nunca toca no sistema de arquivos diretamente. Todas as operações privilegiadas (diálogos de arquivos, execução do FFmpeg, análise, controle da janela) vivem no processo principal e são acessadas via IPC.

- **Separação em três processos** — main, preload e renderer, seguindo o modelo de segurança do Electron (`contextIsolation: true`, `nodeIntegration: false`).
- **Uma única abstração sobre os backends de mídia** — a interface `ITranscoder` esconde se a conversão é dirigida pelo `fluent-ffmpeg`, por um processo filho do CLI FFmpeg puro ou pelo framework BMF.
- **IPC como contrato tipado** — cada canal é uma constante em `src/shared/ipc-channels.ts`, e o renderer só fala com o processo principal através da ponte `window.electronAPI` exposta pelo script preload.
- **Tipos e constantes compartilhados** — `src/shared/` é importado pelos três processos para que as interfaces permaneçam sincronizadas por construção.
- **Aprimoramento progressivo da UI** — as páginas são divididas com `React.lazy`, o estado vive em stores Zustand, e tarefas longas transmitem o progresso de volta via eventos IPC.

## Aprofundamentos

A arquitetura completa é dividida em documentos focados:

| Documento | Tópicos |
|----------|--------|
| [Processos, sistema de build & inicialização](/pt/docs/architecture-processes) | Modelo de processos (main/preload/renderer/shared), sistema de build, resolução dos binários, sequência de inicialização, modo CLI, camada de código compartilhado |
| [Abstração de transcoder & conversão](/pt/docs/architecture-transcoders) | Interface `ITranscoder`, FfmpegCore / FFToolCore / BmfCore, construção compartilhada de flags, aceleração por hardware, análise de mídia, fluxo de conversão |
| [Renderer, estado & subsistemas](/pt/docs/architecture-renderer) | Árvore de renderização, páginas, hooks, stores Zustand, fila de lotes, player de vídeo, timeline de mídia, processamento de imagens, tratamento de erros, logging, i18n, temas, referência de fluxos de dados |

## Documentação adicional

| Documento | Tópicos |
|----------|--------|
| [Referência de funcionalidades](/pt/docs/features-reference) | Funcionalidades, formatos de mídia suportados, tabelas de codecs, utilitários de validação |
| [Uso do CLI](/pt/docs/cli) | Uso do CLI, subcomandos, todas as tabelas de opções |
| [Canais IPC](/pt/docs/ipc) | Canais IPC (requisição/envio único/eventos), ponte electronAPI |
| [Testes](/pt/docs/testing) | Suite de testes (123 arquivos, 1603 testes), configuração de testes, specs E2E |
| [Estrutura do projeto](/pt/docs/project-structure) | Árvore completa de diretórios com anotações |
| [Gerenciador de atualizações](/pt/docs/update-manager) | Implementação do gerenciador de atualizações integrado |

## Repositório

A fonte completa da verdade está na [pasta `docs/`](https://github.com/Sandeepv68/EncodeX/tree/main/docs) do repositório. Para uma visão geral do projeto, passos de instalação e guia de contribuição, veja o [README no GitHub](https://github.com/Sandeepv68/EncodeX).
