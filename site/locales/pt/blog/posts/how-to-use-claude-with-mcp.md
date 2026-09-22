---
title: "Como Usar o Servidor MCP do EncodeX com Claude Desktop e Claude Code"
description: "Conecte o servidor MCP integrado do EncodeX ao Claude Desktop ou Claude Code e converta, extraia, compacte e processe mídia em lote usando linguagem natural — totalmente offline."
date: 2026-09-21
tags:
  - guide
  - mcp
  - claude
  - ai
  - automation
---

# Como Usar o Servidor MCP do EncodeX com Claude Desktop e Claude Code

O EncodeX vem com um servidor MCP integrado (Model Context Protocol), o que significa que você pode controlar todo o app pelo Claude Desktop ou Claude Code usando linguagem simples. Em vez de abrir a interface e procurar em menus, pergunte: *"converta este MKV para MP4 para o meu celular"* — e o assistente faz a conversão com o motor FFmpeg local do EncodeX.

Tudo acontece no seu computador. Os arquivos nunca saem do seu dispositivo, não há conta e tudo funciona offline.

## O Que É um Servidor MCP?

O [MCP](https://modelcontextprotocol.io) é um padrão aberto que permite a assistentes de IA usar ferramentas de aplicativos reais. O servidor do EncodeX expõe um conjunto de ferramentas de conversão — `convert_media`, `extract_audio`, `compress_image`, `cut_video`, `batch_convert`, além de ferramentas de acompanhamento de trabalhos como `get_job` e `list_jobs` — junto com recursos e modelos de prompts.

Pense nisso como um controle remoto para o FFmpeg que um assistente de IA pode operar. O assistente vê as ferramentas, decide quais chamar, e o EncodeX faz a codificação localmente.

## Primeiros Passos

Instale o EncodeX ([download](/pt/download)) — o servidor MCP já vem integrado, sem plugins — e garanta que `encodex` esteja no seu `PATH` (instalar o EncodeX adiciona).

### Opção 1: Claude Desktop

Abra **Claude Desktop → Configurações → Desenvolvedor → Editar configuração** e adicione uma entrada de servidor MCP:

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

Salve o arquivo e reinicie o Claude Desktop. O Claude agora terá acesso às ferramentas do EncodeX.

### Opção 2: Claude Code

A partir de um terminal dentro do seu projeto:

```bash
claude mcp add encodex -- encodex --mcp
```

Depois inicie o Claude Code e peça uma conversão. Você pode verificar o registro com `claude mcp list`.

## Sua Primeira Solicitação

Tente algo simples:

> Converta `~/Desktop/vacation.mp4` em um MP4 menor adequado para o WhatsApp.

O assistente chama `convert_media`, o trabalho roda em segundo plano na sua máquina e o Claude informa o resultado. Como a conversão é assíncrona, o EncodeX retorna um ID de trabalho; o assistente consulta `get_job` para acompanhar e termina quando conclui.

Você também pode extrair áudio:

> Extraia o áudio de `lecture.mov` como MP3.

Isso corresponde à ferramenta `extract_audio`. Ou compactar uma pasta de imagens:

> Compacte todas as fotos de `~/Pics` na pasta `~/Output`.

Essa é a ferramenta `compress_image`, dirigida em linguagem natural.

## Rodando o Servidor Sem Interface

`encodex --mcp` inicia o servidor stdio autônomo. Ele fala JSON-RPC pelo stdout (mantendo limpas as mensagens do protocolo) e direciona todo o status e logs para o stderr. O processo permanece vivo até o stdin fechar — exatamente o que apps de desktop assíncronos precisam para rodar um servidor MCP sob demanda.

Para a superfície HTTP incorporada — fila ao vivo, pré-visualização, timeline e ferramentas de sistema — ative **Configurações → Servidor MCP** na interface e aponte o cliente para `http://127.0.0.1:8765/mcp`.

## Dicas para Melhores Resultados

- **Dê caminhos absolutos ou explícitos** — fica mais fácil para o assistente mirar nos arquivos certos.
- **Nomeie o formato de saída** — "como MP4", "para MP3" — para que o perfil certo seja selecionado.
- **Use lotes para pastas** — o EncodeX pode converter muitos arquivos em um único trabalho (veja o [guia de automação em lote](/pt/blog/posts/mcp-batch-automation-guide)).
- **Consulte a documentação para opções avançadas** — o catálogo completo está na [referência de funções MCP](/pt/docs/features-reference#mcp-server).

## Perguntas Frequentes

### O servidor MCP do EncodeX é gratuito?

Sim — vem integrado ao app EncodeX gratuito e de código aberto (MIT). Sem assinatura, sem chave de licença.

### Preciso da interface aberta para usar `encodex --mcp`?

Não. O servidor autônomo roda sem interface. O servidor HTTP incorporado (Configurações → Servidor MCP) é a superfície opcional que roda dentro do app para ferramentas de fila e pré-visualização.

### O MCP envia meus arquivos?

Não. O EncodeX processa tudo localmente. O servidor MCP dirige o mesmo motor FFmpeg local da interface — sem uploads, sem nuvem, sem conta.

### Quais assistentes podem conectar?

Qualquer cliente compatível com MCP. Este guia cobre Claude Desktop e Claude Code; o mesmo padrão de configuração funciona em [Cursor e VS Code](/pt/blog/posts/cursor-and-vscode-mcp-workflows).

## Saiba Mais

- [Documentação do servidor MCP](/pt/docs/cli#mcp-server-mode)
- [Automação em lote com MCP](/pt/blog/posts/mcp-batch-automation-guide)
- [Privacidade e segurança do MCP](/pt/blog/posts/mcp-privacy-security)
- [A referência completa de funções](/pt/docs/features-reference#mcp-server)

---

*Baixe o EncodeX grátis em [encodex.in/download](/pt/download). O servidor MCP está incluído em cada instalação.*