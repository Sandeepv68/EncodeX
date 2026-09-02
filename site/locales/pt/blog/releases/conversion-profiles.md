---
date: 2026-09-02
title: "Perfis de conversão — Mais de 140 predefinições com um clique"
description: "EncodeX agora vem com mais de 140 perfis de conversão integrados em 8 categorias. Escolha uma predefinição para YouTube, Instagram, TikTok, dispositivos Apple, ProRes, streaming HLS e mais — todas as configurações são preenchidas automaticamente."
tags:
  - feature
  - profiles
  - release
---

# Perfis de conversão

Acabamos de lançar um dos recursos mais solicitados do EncodeX: os **Perfis de conversão**. Em vez de escolher manualmente codecs, taxas de bits, configurações de qualidade e formatos de contêiner toda vez que você converte um arquivo, agora você pode escolher entre mais de 140 predefinições que fazem todo o trabalho por você.

## O que são perfis de conversão?

Um perfil de conversão é uma configuração de codificação salva. Ele diz ao EncodeX exatamente qual codec de vídeo, codec de áudio, taxa de bits, nível de qualidade, resolução, formato de pixel e contêiner usar — tudo com um único clique.

Pense nele como uma receita. Em vez de medir cada ingrediente você mesmo, escolhe uma receita e tudo fica pronto.

## O que está incluído

Os mais de 140 perfis integrados estão organizados em 8 categorias:

### Web e Redes Sociais

Predefinições otimizadas para as plataformas onde você publica:

- **YouTube** — 480p até 4K, com variantes H.264, H.265 e AV1
- **Instagram** — Reels, Stories e publicações no feed com a proporção e codec corretos
- **TikTok** — vídeo vertical ajustado para upload rápido e boa qualidade
- **Facebook** — publicações de vídeo e anúncios
- **X (Twitter)** — vídeo de formato curto com consciência do tamanho do arquivo

### Dispositivos

Predefinições ajustadas para hardware específico:

- **Apple** — iPhone, iPad, Mac, Apple TV (H.264 e HEVC)
- **Android** — predefinições para telefone e tablet
- **Consoles de games** — formatos compatíveis com PlayStation, Xbox e Nintendo Switch

### Codecs de Vídeo

Perfis específicos por codec quando você sabe qual encoder quer:

- H.264, H.265/HEVC, VP8, VP9, AV1
- MPEG-4, MPEG-2, Theora

### Profissional

Formatos de broadcast e pós-produção:

- **ProRes** — 422 LT, 422, 422 HQ, 4444, 4444 XQ
- **DNxHD / DNxHR** — múltiplos níveis de resolução e qualidade
- **FFV1** — codec sem perdas para arquivo
- **XDCAM / XAVC** — formatos de broadcast Sony

### Streaming

Predefinições de streaming adaptativo:

- **HLS** — HTTP Live Streaming com duração de segmento configurável
- **DASH** — saída MPEG-DASH

### Áudio

Predefinições somente de áudio:

- MP3 (128k, 192k, 320k)
- AAC (128k, 192k, 256k)
- FLAC (sem perdas)
- Opus, WAV e mais

### Imagens

Conversão de formatos de imagem:

- JPEG, PNG, WebP, AVIF com controles de qualidade

### Avançado

Para usuários avançados:

- Predefinições de argumentos FFmpeg brutos
- Pass-through FFmpeg personalizado
- Saída nula para testes

## Como usar os perfis

1. Abra a página **Converter** (ou a **Fila em lote**)
2. Procure o **Seletor de perfis** na parte superior da área de configurações
3. Navegue por categoria ou pesquise por nome
4. Clique em um perfil — todos os campos de codificação são preenchidos automaticamente
5. Ajuste o que quiser e clique em Converter

O seletor de perfis mostra cada perfil com um badge de ícone de categoria, para que você possa rapidamente distinguir uma predefinição YouTube de uma ProRes.

## Perfis personalizados

Se o catálogo integrado não cobre seu caso de uso exato, crie o seu próprio:

1. Configure suas configurações de codificação manualmente
2. Clique no botão de salvar no seletor de perfis
3. Dê um nome e uma categoria
4. Seu perfil personalizado aparece junto aos integrados

Os perfis personalizados são salvos localmente e persistem entre sessões. Você pode editá-los ou excluí-los a qualquer momento. (Os perfis integrados estão bloqueados — você pode usá-los, mas não modificá-los.)

## Últimos usados

O EncodeX lembra dos últimos 5 perfis que você aplicou, para que seus fluxos de trabalho mais comuns estejam sempre a um clique de distância. Não precisa navegar categorias quando você sempre usa as mesmas duas predefinições.

## Suporte à fila em lote

Os perfis também funcionam na Fila em lote. Aplique um perfil para definir as opções de codificação para novos trabalhos, ou use-o como ponto de partida antes de personalizar entradas individuais do lote.

## Nos bastidores

Cada perfil é mapeado para um objeto `ConversionProfile` que armazena:

- Formato de contêiner e extensão de saída
- Seleção de codec de vídeo e áudio
- Configurações de taxa de bits, CRF e qualidade
- Escala, formato de pixel e FPS
- Argumentos FFmpeg avançados (`extraArgs` e `inputArgs`) para formatos profissionais

Quando você aplica um perfil, o EncodeX escreve esses valores no formulário de conversão. Os perfis avançados podem passar flags FFmpeg brutos diretamente para o encoder — é assim que suportamos coisas como seleção de perfil ProRes e configuração de segmentos HLS.

Os perfis são um recurso da interface gráfica — a CLI continua usando flags explícitos (`--video-codec`, `--audio-codec`, etc.) para máxima flexibilidade em scripts e automações.

## O que vem por aí

Continuaremos expandindo o catálogo de perfis com base no feedback da comunidade. Se houver uma plataforma ou formato para o qual você queira um perfil, [abra uma issue](https://github.com/Sandeepv68/EncodeX/issues) e nos avise.

---

[Baixar EncodeX](/download) · [Ver todos os recursos](/features) · [Ler a documentação](/docs/features-reference)
