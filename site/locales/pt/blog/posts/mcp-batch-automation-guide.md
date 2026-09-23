---
title: "Automação em Lote com MCP: Enfileire Dezenas de Trabalhos em um Único Prompt"
description: "Use o servidor MCP do EncodeX para enfileirar uma pasta inteira de vídeos com um único prompt — trabalhos assíncronos, acompanhamento de progresso e resultados estruturados via batch_convert, list_jobs e get_job."
date: 2026-09-22
tags:
  - guide
  - mcp
  - automation
  - batch
  - ai
---

# Automação em Lote com MCP: Enfileire Dezenas de Trabalhos em um Único Prompt

O servidor MCP do EncodeX não serve apenas para conversões individuais. Como cada trabalho roda de forma assíncrona e expõe ferramentas de acompanhamento, você pode entregar a um assistente de IA uma pasta inteira de mídia e vê-la enfileirada, processada e reportada — sem abrir o app nem escrever um único comando à mão.

Este guia mostra o fluxo em lote: a ferramenta `batch_convert`, o modelo de trabalhos assíncronos e como as ferramentas de status mantêm você informado enquanto o FFmpeg trabalha.

## O Modelo de Trabalhos Assíncronos

Quando o EncodeX inicia uma conversão via MCP, ele não fica esperando. Retorna um **ID de trabalho** imediatamente, e o trabalho roda em segundo plano. Você (ou o assistente) consulta então:

- `get_job` — status, progresso e resultado de um trabalho
- `list_jobs` — todos os trabalhos da sessão atual
- `cancel_job` — interromper um trabalho em andamento

É isso que torna um lote com uma dúzia de arquivos instantâneo no nível do prompt: o trabalho é enfileirado em uma chamada e o EncodeX vai avançando.

## Enfileire uma Pasta Inteira

O caminho mais rápido é `batch_convert`. Dê ao assistente uma pasta e um destino, por exemplo:

> Converta todos os arquivos MKV em `~/Downloads` para MP4 e coloque-os em `~/Output`.

O assistente percorre a pasta, chama `batch_convert` e inicia a fila. Você não precisa gerenciar os trabalhos um a um.

Quer um lote mais específico? Nomeie o filtro:

> Pegue todos os vídeos de `~/Recordings`, reencode-os para H.264 em um contêiner MP4 com CRF 23 e deixe-os no lugar.

O assistente escolhe o perfil certo com `list_profiles` e `get_profile`, e depois enfileira o lote.

## Misturando Ferramentas em um Único Prompt

Como todas as ferramentas compartilham uma sessão, um único prompt pode encadear várias operações:

> Para cada vídeo em `~/Source`: converta-o em um MP4 para meu celular, extraia o áudio como MP3 e compacte a pasta de capturas `~/Assets`.

Isso é `batch_convert` mais `extract_audio` mais `compress_image`, tudo enfileirado e acompanhado junto. O assistente coordena e relata o que foi concluído e onde.

## Verificando o Progresso

Enquanto os trabalhos rodam, pergunte:

> Qual é o status do meu lote?

O `list_jobs` retorna cada trabalho com status e progresso atuais. Precisa de mais detalhe?

> Quanto falta para a conversão de MKV para MP4?

O assistente consulta `get_job` para o trabalho específico e lê o progresso. Se algo travar:

> Cancele o trabalho que está preso há um tempo.

Isso corresponde ao `cancel_job` — e como os trabalhos são isolados, o resto do lote continua.

## Os 4 Modelos de Prompt

O servidor MCP também traz quatro modelos de prompt: `convert-video`, `extract-audio`, `compress-image` e `batch-convert`. Eles pré-preenchem as chamadas de ferramenta corretas e a estrutura de argumentos, o que é especialmente útil para agentes que querem uma forma canônica de executar uma operação comum. O assistente invoca o modelo e depois a cadeia de ferramentas, dando resultados consistentes entre sessões.

## Perguntas Frequentes

### Quantos arquivos posso enfileirar de uma vez?

Não há um limite pequeno e arbitrário — o EncodeX processa a fila sequencialmente usando seu hardware. Comece com uma pasta e deixe trabalhar; você pode verificar o status a qualquer momento.

### Os trabalhos em lote rodam em segundo plano?

Sim. A interface os mostra na Fila de lote, e via MCP você os acompanha com `get_job` e `list_jobs`. Você pode seguir pedindo outras coisas enquanto a codificação roda.

### Posso cancelar apenas um trabalho?

Sim — `cancel_job` interrompe um único trabalho. A superfície HTTP incorporada também adiciona `cancel_all_jobs` para a fila toda. Os demais continuam de forma independente.

### O lote funciona offline?

Completamente. Toda a codificação acontece localmente na sua máquina via FFmpeg — sem uploads, sem nuvem, e funciona sem conexão com a internet.

## Saiba Mais

- [Controle o EncodeX pelo Claude Desktop](/pt/blog/posts/how-to-use-claude-with-mcp)
- [Documentação do servidor MCP](/pt/docs/cli#mcp-server-mode)
- [Modelo de segurança e privacidade do MCP](/pt/blog/posts/mcp-privacy-security)
- [Referência de funções: ferramentas MCP](/pt/docs/features-reference#mcp-server)

---

*Baixe o EncodeX grátis em [encodex.in/download](/pt/download). O servidor MCP e a fila de lote estão incluídos em cada instalação.*