---
date: 2026-08-22
title: "Por Que Criamos o EncodeX — Um Conversor de Vídeo Gratuito e de Código Aberto"
description: "A história por trás do EncodeX: por que criamos um conversor de vídeo e áudio gratuito e de código aberto que funciona no Windows, Mac e Linux sem marca d'água ou assinaturas."
tags:
  - bastidores
  - código aberto
---

# Por Que Criamos o EncodeX

Se você já tentou converter um arquivo de vídeo, conhece o ritual. Você pesquisa por um "conversor de vídeo gratuito", baixa algo, e em poucos minutos é recebido com uma marca d'água na sua saída, um muro de pagamento bloqueando o recurso de que você precisa, ou pior — softwares indesejados que você nunca pediu.

Criamos o EncodeX porque estávamos fartos dessa experiência.

## O Problema

Arquivos de vídeo e áudio vêm em dezenas de formatos. Seu telefone grava em um formato, seu software de edição quer outro, e sua TV suporta outro ainda. Adicione extração de áudio, corte e compressão de imagens à mistura, e você tem uma mão cheia de ferramentas de que precisa — a maioria exige uma assinatura mensal.

Para uma tarefa que deveria levar dois minutos, as pessoas passam vinte minutos evitando armadilhas.

## O Que Queríamos

Um único aplicativo que:

- Converta entre todos os formatos populares de vídeo e áudio
- Extraia áudio de arquivos de vídeo
- Corte clips com uma linha do tempo visual
- Comprima imagens
- Processe lotes de arquivos de uma vez
- Funcione no Windows, Mac e Linux
- Seja genuinamente gratuito — sem contas, sem marca d'água, sem assinaturas

Olhamos ao redor. A maioria das opções falhava em pelo menos dois desses pontos. As opções de código aberto existiam, mas pareciam ferramentas para desenvolvedores — linhas de comando, interfaces crípticas ou projetos abandonados.

Então criamos a ferramenta que queríamos usar.

## Sob o Capô

O EncodeX é alimentado pelo [FFmpeg](https://ffmpeg.org), o mesmo motor por trás da maioria das ferramentas multimídia profissionais. Envolvemos ele em uma interface limpa construída com Electron, React e TypeScript. O resultado é um aplicativo de desktop que se parece moderno, funciona de forma confiável e não atrapalha seu trabalho.

Alguns dos quais nos orgulhamos:

- **Aceleração por hardware** — usa automaticamente sua GPU (NVIDIA, Intel, AMD, Apple Silicon) para conversões mais rápidas
- **Mais de 35 idiomas** — porque "gratuito" deveria significar gratuito para todos
- **Privacidade por design** — tudo roda localmente, seus arquivos nunca saem do seu computador
- **Modo CLI** — para usuários avançados e scripts de automação

## Código Aberto, de Verdade

O EncodeX é licenciado sob MIT. O código fonte está no [GitHub](https://github.com/Sandeepv68/EncodeX). Você pode ler cada linha, fazer fork, contribuir ou simplesmente verificar que não fazemos nada suspeito com seus arquivos.

Acreditamos que ferramentas multimídia não deveriam custar uma assinatura, e privacidade não deveria ser um recurso premium.

## O Que Vem Pela Frente

Estamos trabalhando em direção a uma versão estável 1.0 com mais suporte a formatos, melhor processamento em lote e traduções para mais idiomas. Se você quiser ajudar — seja reportando um bug, sugerindo um recurso ou traduzindo um idioma — confira nosso [guia de contribuição](/pt/contributing).

---

*Baixe o EncodeX gratuitamente em [encodex.in/download](/pt/download).*
