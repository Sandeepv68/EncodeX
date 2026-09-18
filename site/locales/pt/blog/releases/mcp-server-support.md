---
date: 2026-09-18
title: "O EncodeX adiciona um servidor MCP integrado: deixe a IA conduzir suas conversões de mídia"
description: "O EncodeX agora inclui um servidor Model Context Protocol (MCP) para que Claude, Cursor, VS Code e agentes personalizados possam converter, comprimir, cortar e processar em lote sua mídia — localmente e com segurança."
tags:
  - release
  - mcp
  - ai
  - automation
---

# O EncodeX adiciona um servidor MCP integrado: deixe a IA conduzir suas conversões de mídia

**Lançado em:** 2026-09-18
**Novidade:** Servidor MCP integrado (stdio + HTTP integrado)

## A versão resumida

O EncodeX agora pode atuar como um servidor [Model Context Protocol](https://modelcontextprotocol.io). Isso significa que assistentes de IA — Claude Desktop, Claude Code, Cursor, VS Code e qualquer outro cliente compatível com MCP — podem converter vídeos, extrair áudio, comprimir imagens, cortar clipes e gerenciar tarefas em lote pelo EncodeX, usando apenas um pedido em linguagem simples.

E tudo continua acontecendo no seu computador. Sem uploads, sem nuvem, sem conta.

---

## Por que o MCP muda o fluxo de trabalho do dia a dia

Criamos o EncodeX para tirar a linha de comando do FFmpeg da vida das pessoas comuns. O **servidor MCP** remove o último resquício de "em qual botão eu clico?" das ferramentas que você já usa.

Se você já digitou algo como:

> "Pegue o `interview.mov`, extraia o áudio como MP3 e faça uma cópia que caiba em um e-mail."

…um assistente habilitado para MCP agora consegue *de fato fazer isso* — escolhendo a ferramenta certa do EncodeX, executando a conversão localmente e reportando o resultado. Você continua no seu app de IA preferido; o EncodeX faz o trabalho pesado nos bastidores.

Algumas coisas que isso desbloqueia:

- **Trabalho em lote por conversa** — "Converta todos os MKV desta pasta para MP4 e me avise quando terminar."
- **Pipelines de agentes** — deixe um agente de código ou de mídia preparar arquivos como parte de uma tarefa maior.
- **Automação repetível** — descreva um fluxo de trabalho uma vez; seu assistente o reutiliza.
- **Sem sintaxe de comando para decorar** — perfis, codecs e contêineres são resolvidos por você.

---

## Duas formas de conectar

### 1. Servidor stdio autônomo

Execute o EncodeX como um processo MCP dedicado. É assim que os apps de IA de desktop iniciam um servidor sob demanda:

```bash
# Packaged app
encodex --mcp

# Source checkout (after npm run build:main)
node dist/mcp/index.js
```

O stdout carrega o protocolo MCP; todos os logs vão para o stderr, para que nada corrompa a conversa entre seu assistente e o EncodeX.

### 2. Servidor HTTP integrado (modo GUI)

Já tem o EncodeX aberto? Ative **Configurações → MCP Server** e aponte seu cliente para:

```
http://127.0.0.1:8765/mcp
```

Esse modo compartilha a fila de jobs do app em execução e adiciona ferramentas de fila ao vivo, prévia, linha do tempo, sistema e atualizações — para que o assistente veja no que você está trabalhando em vez de agir isoladamente.

---

## O que seu assistente pode fazer

Nas duas superfícies, o EncodeX expõe **19 ferramentas**.

| Área                   | Ferramentas                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Conversão              | `convert_media`, `batch_convert`, `cut_video`, `compress_image`, `extract_audio`                     |
| Inspeção               | `get_media_info`, `list_capabilities`, `list_profiles`, `get_profile`, `ping`                        |
| Gerenciamento de jobs | `get_job`, `list_jobs`, `cancel_job`                                                                 |
| Paridade com a GUI (HTTP) | `get_queue_state`, `cancel_all_jobs`, `get_timeline`, `extract_preview`, `get_system_info`, `check_for_updates` |

Há também **3 recursos** — `encodex://profiles`, `encodex://capabilities` e `encodex://codecs` — para que um assistente descubra exatamente o que sua compilação suporta, e **4 modelos de prompt** para as tarefas mais comuns: converter vídeo, extrair áudio, comprimir imagem e converter em lote.

As conversões são **assíncronas**. Um render longo não congela a conversa: seu assistente inicia a tarefa, recebe um ID de job e pode consultar o progresso ou cancelá-la depois.

---

## Configure em um minuto

### Claude Desktop

Adicione o EncodeX à configuração de servidores MCP:

```json
{
  "mcpServers": {
    "encodex": {
      "command": "encodex",
      "args": ["--mcp"]
    }
  }
}
```

Reinicie o Claude Desktop e peça: *"Use o EncodeX para converter ~/Videos/clip.mov para MP4."*

### Cursor / VS Code

Adicione a mesma definição de servidor à sua configuração MCP (`mcp.json` no Cursor, ou as configurações de MCP no VS Code), apontando `command` para `encodex` com o argumento `--mcp`. Para o servidor integrado, use a URL de transporte HTTP mostrada acima.

### Qualquer cliente MCP

O servidor stdio é um processo JSON-RPC padrão — sem integração especial. Se a sua ferramenta conseguir abrir um comando e falar MCP, ela conversa com o EncodeX.

---

## Privado e seguro por design

Oferecer uma superfície de automação significa levar a segurança a sério. O servidor integrado é deliberadamente conservador:

- **Somente loopback** — ele conecta-se em `127.0.0.1` e nunca é acessível a partir de outra máquina.
- **Verificação de origem** — solicitações de origem cruzada são rejeitadas, a menos que venham do app local.
- **Bearer token opcional** — ative um e toda solicitação precisa ser autenticada, com comparação em tempo constante.
- **Superfície HTTP mínima** — somente `GET`, `POST` e `DELETE` em `/mcp`.
- **Encerramento limpo** — todas as sessões são encerradas à força quando o servidor para ou o app é fechado.
- **Sem exfiltração de arquivos** — o servidor usa o mesmo motor FFmpeg local da GUI. Nada é enviado.

O modo standalone `--mcp` herda a mesma garantia de "tudo roda localmente": é simplesmente uma forma diferente de falar com o motor que já está na sua máquina.

---

## Para quem é isso?

- **Criadores e editores** que já trabalham dentro de um assistente de IA e querem preparar arquivos sem sair dele.
- **Desenvolvedores** que criam fluxos de trabalho com agentes que precisam de processamento de mídia real.
- **Fãs de automação** que querem pipelines repetíveis e descritíveis em vez de comandos avulsos.
- **Qualquer pessoa** que prefere pedir um resultado a procurar uma configuração.

Se você nunca usou um cliente MCP, nada muda — a GUI e a CLI continuam exatamente como estavam. O servidor MCP é uma porta extra para o mesmo motor.

---

## Experimente hoje

1. Atualize para a versão mais recente do EncodeX.
2. Execute `encodex --mcp` ou ative **Configurações → MCP Server** no app.
3. Conecte seu assistente de IA e peça para ele converter algo.

Leia a referência completa — cada ferramenta, recurso, prompt, configuração de cliente e o modelo de segurança — na [documentação do MCP](/docs/cli#mcp-server-mode).

---

[Baixar o EncodeX](/download) · [Ver todos os recursos](/features) · [Ler a documentação da CLI](/docs/cli)