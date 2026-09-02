<div align="center">
  <img src="../../assets/banner.png" alt="Logotipo do EncodeX" width="900" />
  <h3>Uma ferramenta multiplataforma de conversão de mídia criada com FFmpeg, React, TypeScript e Electron.</h3>
</div>

<div align="center">

[![Ask DeepWiki](https://img.shields.io/badge/Ask_DeepWiki-10B981?style=for-the-badge)](https://deepwiki.com/Sandeepv68/EncodeX)
![CI](https://img.shields.io/github/actions/workflow/status/Sandeepv68/EncodeX/ci.yml?style=for-the-badge)
![License](https://img.shields.io/github/license/Sandeepv68/EncodeX?style=for-the-badge)
![Release](https://img.shields.io/github/v/release/Sandeepv68/EncodeX?style=for-the-badge)
![Downloads](https://img.shields.io/github/downloads/Sandeepv68/EncodeX/total?style=for-the-badge&logo=github&logoColor=white)
![Stars](https://img.shields.io/github/stars/Sandeepv68/EncodeX?style=for-the-badge)
![Forks](https://img.shields.io/github/forks/Sandeepv68/EncodeX?style=for-the-badge)
![Watchers](https://img.shields.io/github/watchers/Sandeepv68/EncodeX?style=for-the-badge)
![Issues](https://img.shields.io/github/issues/Sandeepv68/EncodeX?style=for-the-badge)
![Pull Requests](https://img.shields.io/github/issues-pr/Sandeepv68/EncodeX?style=for-the-badge)
![Last Commit](https://img.shields.io/github/last-commit/Sandeepv68/EncodeX?style=for-the-badge)
![Contributors](https://img.shields.io/github/contributors/Sandeepv68/EncodeX?style=for-the-badge)
![Repo Size](https://img.shields.io/github/repo-size/Sandeepv68/EncodeX?style=for-the-badge)
![Languages](https://img.shields.io/github/languages/count/Sandeepv68/EncodeX?style=for-the-badge)
![Top Language](https://img.shields.io/github/languages/top/Sandeepv68/EncodeX?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![MUI](https://img.shields.io/badge/MUI-007FFF?style=for-the-badge&logo=mui&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js%2022-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)

</div>

<div align="center">

[English](../../README.md) | [Deutsch](../de/README.md) | [Español](../es/README.md) | [Français](../fr/README.md) | [हिन्दी](../hi/README.md) | [Português](./README.md) | [简体中文](../zh/README.md)

</div>

## 👋 Introdução

O EncodeX é uma ferramenta multiplataforma de conversão de mídia que leva todo o poder do FFmpeg para uma interface de desktop moderna e intuitiva. Construído com Electron, React e TypeScript, ele permite converter mídia entre formatos, extrair áudio, cortar vídeos e comprimir imagens — tudo por meio de uma interface limpa e responsiva, com fila em lote, aceleração de hardware, modo CLI e internacionalização completa.

## ✨ Recursos

- **🔄 Conversão de mídia** — 51 codecs de vídeo, 27 codecs de áudio, 56 formatos de pixel com controles de codec/bitrate/escala/qualidade
- **🎛️ Perfis de conversão** — mais de 140 predefinições em 8 categorias (YouTube, Instagram, TikTok, Apple, Android, ProRes, HLS e mais) com criação de perfis personalizados e rastreamento de uso recente
- **⚡ Aceleração de hardware** — NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox, Media Foundation
- **✂️ Corte de vídeo** — Corte preciso por frame com reprodutor integrado (pipes de rawvideo + PCM, Canvas + Web Audio) e linha do tempo com zoom (forma de onda + montagem de miniaturas)
- **📋 Fila em lote** — Processamento paralelo (até 4 tarefas simultâneas) com progresso em tempo real, erros por tarefa, pausar/retomar, reordenação por arrastar e soltar, edição de opções da tarefa, filtros de status, exportação/importação JSON e ações de energia ao concluir (desligar/suspender/hibernar)
- **🖼️ Compressão de imagens** — JPEG/PNG/WebP/BMP/GIF/TIFF com qualidade/escala, visualizador de EXIF, histogramas RGB/luma
- **🎵 Extração de áudio** — Qualquer um dos 27 codecs de áudio a partir de qualquer arquivo de vídeo
- **ℹ️ Informações de mídia** — Análise completa por stream: codec, perfil, resolução, metadados de cor, taxa de quadros etc.
- **⌨️ Modo CLI** — Scripts sem interface (headless) com subcomandos (`convert`, `info`, `capabilities`, `compress`, `extract-audio`, `batch`)
- **⚙️ 3 núcleos de transcodificação** — API do FFmpeg (fluent-ffmpeg), CLI do FFmpeg (child_process), Framework BMF
- **🌍 56 localidades** — 35 idiomas com suporte a RTL (árabe, hebraico)
- **⌨️ Atalhos de teclado** — Mais de 60 atalhos em todas as páginas com diálogo de ajuda integrado (`Ctrl+/`)
- **🔔 Indicadores de atividade** — Indicadores de navegação ao vivo com popovers ao passar o mouse mostrando o progresso de cada tarefa de relance
- **🛡️ Confirmação de fechamento** — Avisa antes de fechar a janela enquanto há tarefas em execução
- **🎉 Easter eggs** — Logotipos do app com temas de feriados em datas especiais
- **🔄 Atualizações integradas** — Verifica os lançamentos no GitHub, baixa o instalador da plataforma, progresso em tempo real
- **🛡️ Tratamento de erros** — 16 códigos de erro tipados, snackbar global, banners inline, error boundaries do React
- **🌗 Tema claro/escuro** — Acompanha o sistema com alternância manual e preferências persistentes

Consulte a [Referência de recursos](./features-reference.md) para ver o detalhamento completo dos recursos, os formatos suportados e as listas de codecs.

## 📸 Capturas de tela

<div align="center">
  <img src="../../site/public/images/home_dashboard.webp" alt="Painel Inicial" width="800" />
  <p><strong>🏠 Painel Inicial</strong></p>
</div>

<table>
  <tr>
    <td align="center" width="50%">
      <img src="../../site/public/images/convert.webp" alt="Conversão de Mídia" /><br />
      <strong>🔄 Conversão de Mídia</strong>
    </td>
    <td align="center" width="50%">
      <img src="../../site/public/images/extract_audio.webp" alt="Extração de Áudio" /><br />
      <strong>🎵 Extração de Áudio</strong>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="../../site/public/images/cut_video.webp" alt="Corte de Vídeo" /><br />
      <strong>✂️ Corte de Vídeo</strong>
    </td>
    <td align="center">
      <img src="../../site/public/images/image_compress.webp" alt="Compressão de Imagens" /><br />
      <strong>🖼️ Compressão de Imagens</strong>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="../../site/public/images/batch_process.webp" alt="Fila em Lote" /><br />
      <strong>📋 Fila em Lote</strong>
    </td>
    <td align="center">
      <img src="../../site/public/images/media_info.webp" alt="Informações de Mídia" /><br />
      <strong>ℹ️ Informações de Mídia</strong>
    </td>
  </tr>
</table>

## 📌 Pré-requisitos

- [Node.js](https://nodejs.org/) 22+
- [FFmpeg](https://ffmpeg.org/) — incluído via `ffmpeg-static`; usa o `ffmpeg` do sistema caso o binário incluído não esteja disponível

## 📥 Downloads

Instaladores pré-compilados estão disponíveis na página de [Releases](https://github.com/Sandeepv68/EncodeX/releases).

### macOS

> O EncodeX não possui assinatura de código (sem conta Apple Developer). O Gatekeeper do macOS bloqueará o app na primeira abertura.

**Opção 1 — Clique com o botão direito para abrir:**

1. Clique com o botão direito (ou Control-clique) no app EncodeX e selecione **Abrir**
2. Clique em **Abrir** no diálogo de confirmação

**Opção 2 — Remova a quarentena via Terminal:**

```bash
xattr -cr /Applications/EncodeX.app
```

### Windows / Linux

Baixe o instalador `.exe` (Windows) ou `.AppImage` (Linux) na página de [Releases](https://github.com/Sandeepv68/EncodeX/releases) e execute-o.

## 🚀 Instalação (a partir do código-fonte)

```bash
npm install
```

## 🧑‍💻 Desenvolvimento

```bash
# Start Vite dev server + tsc watch (no Electron window)
npm run dev

# Full dev environment with Electron window
npm run electron:dev

# Quick start (build then launch)
npm run dev:start
```

O comando `npm run dev` inicia dois processos em paralelo:

1. **Vite** — serve o renderer React em `http://localhost:5173` com HMR
2. **tsc** — observa e compila o TypeScript do processo principal para `dist/main/`

O comando `npm run electron:dev` aguarda o Vite ficar pronto, compila o processo principal e o preload, e então inicia o Electron com a flag `--dev` apontando para a URL do servidor de desenvolvimento do Vite. As DevTools abrem automaticamente.

## 🔨 Build

```bash
# Production build (renderer + main + preload)
npm run build

# Package for current platform (no installer)
npm run pack

# Create distributable installer
npm run dist
```

| Script                   | Descrição                                                   |
| ------------------------ | ----------------------------------------------------------- |
| `npm run dev:renderer`   | Somente o servidor de desenvolvimento do Vite               |
| `npm run dev:main`       | `tsc -p tsconfig.main.json --watch`                         |
| `npm run build:renderer` | Build de produção do Vite — gera saída em `dist/renderer/`  |
| `npm run build:main`     | `tsc -p tsconfig.main.json` — gera saída em `dist/main/`    |
| `npm run build:preload`  | `tsc -p tsconfig.preload.json` — gera saída em `dist/preload/` |
| `npm run build`          | Os três em sequência                                        |
| `npm run start`          | Inicia o app compilado a partir de `dist/` via `electron .` |
| `npm run electron:dev`   | Ambiente de desenvolvimento Vite + Electron                 |
| `npm run dev:start`      | Compila e depois inicia                                     |
| `npm run format`         | `prettier --write` em todo o TypeScript/JSON de `src`       |
| `npm run format:check`   | `prettier --check` em todo o TypeScript/JSON de `src`       |
| `npm run pack`           | Build + electron-builder `--dir`                            |
| `npm run dist`           | Build + electron-builder (NSIS/DMG/AppImage)                |

## 💻 Uso do CLI

Compile primeiro e depois invoque via `encodex`:

```bash
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac
encodex info input.mp4 --json
encodex compress photo.png -f jpg -q 30
encodex extract-audio input.mp4
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted
```

Consulte o [Uso da CLI](./cli.md) para ver todos os subcomandos, opções e exemplos.

## 🧪 Testes

```bash
npm test           # Run all 123 test files / 1603 tests
npm run test:watch
npm run test:coverage
npm run test:unit
npm run test:integration
npm run test:e2e   # Requires build
```

Consulte [Testes](./testing.md) para o detalhamento completo da suíte de testes, a configuração dos testes e as especificações E2E.

## 📚 Documentação

| Documento | Descrição |
| --------- | --------- |
| [Referência de recursos](./features-reference.md) | Recursos, formatos de mídia suportados, tabelas de codecs, utilitários de validação |
| [Uso da CLI](./cli.md) | Uso do CLI, subcomandos, todas as tabelas de opções, códigos de saída |
| [Testes](./testing.md) | Suíte de testes, configuração dos testes, especificações E2E |
| [Canais IPC](./ipc.md) | Canais IPC, ponte electronAPI, todos os métodos e eventos |
| [Estrutura do projeto](./project-structure.md) | Árvore de diretórios completa com anotações |
| [Visão geral da arquitetura](./architecture.md) | Visão geral da arquitetura interna e links para análises aprofundadas |
| [Processos da arquitetura](./architecture-processes.md) | Modelo de processos, sistema de build, sequência de inicialização, modo CLI |
| [Transcoders (arquitetura)](./architecture-transcoders.md) | Abstração de transcoder, núcleos FFmpeg/BMF, aceleração de hardware |
| [Renderer (arquitetura)](./architecture-renderer.md) | Árvore de render, páginas, stores, fila, player, i18n, temas |
| [Gerenciador de atualizações](./update-manager.md) | Detalhes de implementação do gerenciador de atualizações integrado |
| [Wiki](https://github.com/Sandeepv68/EncodeX/wiki) | Wiki da comunidade (espelha a documentação em formato navegável) |
| [Site de documentação](https://encodex.in/pt/) | Site VitePress com tour de recursos, guias e blog de lançamentos |
| [Contribuir](./CONTRIBUTING.md) | Diretrizes de contribuição |
| [Segurança](../../SECURITY.md) | Relato de vulnerabilidades |
| [Código de conduta](../../CODE_OF_CONDUCT.md) | Código de conduta |

## 🧰 Stack de tecnologias

<p align="center"><img src="../../assets/stack.png" alt="Stack de tecnologias do EncodeX"></p>

## 🤝 Contribuindo

Consulte [Contribuir](./CONTRIBUTING.md) para as diretrizes. Todas as contribuições são bem-vindas — abra uma issue primeiro para mudanças significativas.

Este projeto é regido por um [Código de conduta](../../CODE_OF_CONDUCT.md).

## 🔒 Segurança

Relate vulnerabilidades de segurança aos mantenedores do projeto pelo processo de security advisory. Consulte [Segurança](../../SECURITY.md).

## 📄 Licença

MIT