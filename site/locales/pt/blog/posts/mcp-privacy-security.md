---
title: "Privacidade e Segurança do MCP: Por Que o EncodeX Mantém Sua Mídia Local"
description: "O servidor MCP do EncodeX roda inteiramente na sua máquina — binding de loopback, validação de Origin, token de acesso opcional e design offline. Sem uploads, sem nuvem, sem conta."
date: 2026-09-24
tags:
  - guide
  - mcp
  - security
  - privacy
  - ai
---

# Privacidade e Segurança do MCP: Por Que o EncodeX Mantém Sua Mídia Local

Deixar um assistente de IA controlar seus arquivos de mídia levanta uma pergunta óbvia: o que acontece com meus arquivos? Com o servidor MCP do EncodeX, a resposta é direta — tudo roda no seu próprio computador. O assistente dá instruções; o motor FFmpeg integrado do EncodeX faz o trabalho localmente. Os arquivos nunca saem do seu dispositivo, e o servidor é endurecido com binding de loopback, validação de Origin e um token de acesso opcional.

Este post detalha o modelo de segurança para você saber exatamente o que está protegido.

## Offline por Design

A garantia principal é a mais simples: **sem uploads, sem nuvem, sem conta**. O EncodeX é um aplicativo local e o servidor MCP é um processo local. Não há nuvem do EncodeX para onde enviar arquivos — conversão, extração, compactação e corte acontecem todos no seu hardware. Se a sua máquina estiver offline, o MCP ainda funciona.

Isso torna o EncodeX uma opção de servidor MCP genuinamente *local*. Sua mídia nunca vira dado de treinamento de outra pessoa nem fatura de armazenamento.

## Servidor Autônomo: Um Processo Simples

No modo padrão (`encodex --mcp`), o EncodeX roda como um processo stdio sem interface falando JSON-RPC. Ele não se vincula a nada na rede — stdout carrega as mensagens do protocolo, stderr carrega os logs, e o processo permanece vivo até o stdin fechar. Não há nenhuma porta escutando, portanto não há superfície que um atacante remoto pudesse alcançar.

## Servidor Incorporado: Loopback + Verificação de Origin

O servidor HTTP incorporado opcional (Configurações → Servidor MCP) é a única superfície de rede, e ele é cuidadoso com quem conversa:

- **Apenas loopback** — vincula-se a `127.0.0.1`, então só o software da sua própria máquina pode alcançá-lo.
- **Validação de Origin** — as requisições recebidas devem trazer um cabeçalho `Origin` aceitável (seus clientes locais), e ele aceita apenas `GET`, `POST` e `DELETE` em `/mcp`.
- **Sessões restritas ao app** — todas as sessões são fechadas à força quando o servidor para ou o EncodeX é encerrado.

A ideia: o endpoint existe para seus apps locais de IA, não para qualquer outra coisa na rede.

## Token de Acesso Opcional

Para uma camada extra, você pode definir um **token de acesso** em Configurações → Servidor MCP. O servidor incorporado passa a exigir um token bearer, e compara tokens em **tempo constante** — evitando o clássico canal lateral de temporização usado para adivinhar segredos caractere por caractere.

Como é opcional, você controla a escolha: sem token para conveniência numa máquina confiável de um único usuário, com token quando você quer autorização explícita para clientes locais.

## O Que o Assistente Pode Realmente Fazer

MCP não é um prompt aberto para o seu sistema. O assistente só pode chamar as ferramentas que o EncodeX expõe. A superfície stdio oferece 13 ferramentas principais (`convert_media`, `batch_convert`, `extract_audio`, `compress_image`, `cut_video`, gerenciamento de trabalhos e mais); a superfície incorporada adiciona ferramentas de paridade com a interface (`get_queue_state`, `cancel_all_jobs`, `get_timeline`, `extract_preview`, `get_system_info`, `check_for_updates`). Isso é um escopo de ferramentas deliberado — o assistente pode operar o EncodeX, e nada mais.

Todas as sessões se fecham à força quando o app é encerrado, então um assistente desatualizado não consegue manter acesso depois que você fecha o EncodeX.

## Perguntas Frequentes

### O servidor MCP do EncodeX envia dados para algum lugar?

Não. O EncodeX processa tudo localmente via FFmpeg. Não há componente de nuvem, nem telemetria da sua mídia, e o padrão MCP aqui é apenas um cano local.

### O servidor incorporado fica exposto na minha rede?

Não. Ele se vincula apenas ao loopback (`127.0.0.1`), valida o cabeçalho `Origin` e aceita apenas `GET`, `POST` e `DELETE` em `/mcp`. Dispositivos remotos na sua LAN não conseguem alcançá-lo.

### Como adiciono um token?

Abra **Configurações → Servidor MCP**, ative o servidor e defina um token de acesso. Os clientes o enviam depois como token bearer, comparado em tempo constante.

### Posso usar o MCP totalmente offline?

Sim — esse é o design central. Instale o EncodeX, rode `encodex --mcp` ou ative o servidor incorporado, e tudo funciona sem conexão com a internet.

## Saiba Mais

- [Documentação do servidor MCP](/pt/docs/cli#mcp-server-mode)
- [Configuração de Claude Desktop e Claude Code](/pt/blog/posts/how-to-use-claude-with-mcp)
- [Guia de automação em lote](/pt/blog/posts/mcp-batch-automation-guide)
- [Fluxos de trabalho com Cursor e VS Code](/pt/blog/posts/cursor-and-vscode-mcp-workflows)
- [Referência de funções: MCP](/pt/docs/features-reference#mcp-server)

---

*Baixe o EncodeX grátis em [encodex.in/download](/pt/download). O servidor MCP está incluído em cada instalação.*