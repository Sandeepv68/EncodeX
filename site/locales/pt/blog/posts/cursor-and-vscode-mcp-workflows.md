---
title: "Fluxos de Trabalho MCP com Cursor e VS Code e EncodeX"
description: "Conecte o EncodeX ao Cursor ou VS Code com encodex --mcp e transforme tarefas de mídia em fluxos de agentes — conversões, extrações e compactação de imagens dentro do seu editor."
date: 2026-09-23
tags:
  - guide
  - mcp
  - cursor
  - vscode
  - ai
---

# Fluxos de Trabalho MCP com Cursor e VS Code e EncodeX

Cursor e VS Code falam MCP, o que significa que você pode entregar tarefas de mídia à IA do seu editor sem sair do seu código. Aponte qualquer um dos dois para o servidor integrado do EncodeX e peça uma conversão, uma extração de áudio ou a compactação de uma pasta inteira de imagens enquanto continua trabalhando no projeto real.

O servidor roda localmente (`encodex --mcp`), então o agente do editor opera o próprio motor FFmpeg da sua máquina — sem uploads, sem API externa, totalmente offline.

## Configurar o EncodeX no VS Code

O VS Code tem suporte MCP integrado. Abra as configurações de MCP e adicione uma definição de servidor:

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

O VS Code inicia `encodex --mcp` como processo servidor. Uma vez conectado, o assistente do editor pode chamar as ferramentas do EncodeX — `convert_media`, `extract_audio`, `compress_image`, `cut_video`, `batch_convert` — e acompanhar trabalhos com `get_job` / `list_jobs`.

Para as ferramentas extras ao vivo (estado da fila, timeline, pré-visualização, informações do sistema), ative **Configurações → Servidor MCP** na interface do EncodeX e aponte o editor para `http://127.0.0.1:8765/mcp`. Essa superfície adiciona ferramentas de paridade com a interface como `get_queue_state`, `extract_preview` e `get_timeline`.

## Configurar o EncodeX no Cursor

O Cursor também expõe servidores MCP nas configurações, seja com o mesmo JSON ou com um diálogo parecido de "Adicionar servidor MCP" usando o tipo `command`:

- **Comando (stdio):** `encodex --mcp`

O Cursor compartilha o formato de configuração MCP padrão, então o bloco JSON acima funciona também para ele. Depois de adicionar o servidor, o agente do Cursor pode realizar operações de mídia diretamente.

## Fluxos de Edição

O padrão útil é combinar o trabalho com mídia ao fluxo normal do seu editor:

> Converta `assets/tmp/video.mov` para MP4 para a página de docs, na pasta `assets/`.

O agente chama `convert_media`, espera pelo `get_job`, e então faz o trabalho de acompanhamento — hospedar uma pré-visualização, atualizar um README ou conectar o novo arquivo a um build.

Ainda mais avançado, um único prompt pode orquestrar muitos passos:

> Uma nova gravação chegou em `~/r2d2/captures`. Converta-a em um MP4 compactado, extraia o áudio para transcrição e depois atualize `docs/captures.md` com os locais de saída.

São `convert_media` + `extract_audio`, coordenados com o trabalho do seu repositório em uma sessão.

## Saída Versionada e Limpeza

Como o EncodeX cria arquivos reais no disco, você pode combiná-lo com o seu fluxo git:

> Rode o lote de `~/r2d2/captures` para `~/r2d2/output` e me diga quais arquivos de saída são novos para saber o que adicionar.

O agente lê os resultados das ferramentas, o histórico de `list_jobs` e o estado do diretório para resumir o que mudou — transformando uma tarefa de mídia em um commit documentado.

## Perguntas Frequentes

### Isso envia meu código ou mídia para a nuvem?

Não. O EncodeX MCP roda inteiramente na sua máquina. Sua mídia é processada localmente e o agente do seu editor opera essas ferramentas locais. Não há ida e volta à nuvem para a codificação.

### Preciso da interface do EncodeX aberta?

Para o servidor stdio (`encodex --mcp`), não — ele roda sem interface. O servidor HTTP incorporado é a superfície opcional que roda dentro do app e adiciona ferramentas de fila e pré-visualização ao vivo.

### Posso usar com Cursor e VS Code ao mesmo tempo?

Sim. Cada cliente inicia sua própria instância do servidor stdio, ou você pode compartilhar o mesmo endpoint HTTP incorporado para ambos (uma única instância da interface).

### Quais ferramentas estão disponíveis?

A superfície stdio expõe 13 ferramentas principais, incluindo `convert_media`, `batch_convert`, `extract_audio`, `compress_image`, `cut_video` e o gerenciamento de trabalhos. Veja a [referência de funções](/pt/docs/features-reference#mcp-server) para o catálogo completo.

## Saiba Mais

- [Configuração de Claude Desktop e Claude Code](/pt/blog/posts/how-to-use-claude-with-mcp)
- [Guia de automação em lote](/pt/blog/posts/mcp-batch-automation-guide)
- [Documentação do servidor MCP](/pt/docs/cli#mcp-server-mode)
- [Privacidade e segurança do MCP](/pt/blog/posts/mcp-privacy-security)

---

*Baixe o EncodeX grátis em [encodex.in/download](/pt/download). O servidor MCP está incluído em cada instalação.*