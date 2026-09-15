---
title: "Como Automatizar Fluxos de Trabalho de Mídia com a CLI do EncodeX"
description: "Use o EncodeX pela linha de comando para criar scripts de conversões em lote, extrair áudio, comprimir imagens e construir pipelines de mídia automatizados."
date: 2026-09-12
tags:
  - guide
  - cli
  - automation
  - developer
---

# Como Automatizar Fluxos de Trabalho de Mídia com a CLI do EncodeX

O EncodeX é um aplicativo voltado para a interface gráfica, mas vem com uma interface de linha de comando completa que faz tudo o que o aplicativo de desktop faz — e algumas coisas que ele não faz. Se você trabalha com arquivos de mídia regularmente e quer criar scripts, automatizar lotes ou encaixar conversões em um fluxo de trabalho, a CLI transforma o EncodeX em algo que você pode executar de um terminal, de um pipeline de CI ou de uma tarefa agendada.

## Por Que Usar a CLI?

A GUI é ideal para conversões pontuais — arraste um arquivo, escolha um perfil, pronto. Mas quando você tem uma pasta com cinquenta vídeos, ou quer um script que comprima toda gravação que cair em um diretório, a CLI permite codificar sem abrir uma janela.

Casos de uso comuns:

- **Scripts de conversão em lote** — converta todos os `.mov` de uma pasta em `.mp4` com um único comando.
- **Extração de áudio** — separe o áudio de arquivos de vídeo para podcasts ou arquivos.
- **Pipelines de CI/CD** — valide ou reencodifique artefatos de mídia como parte de um build automatizado.
- **Tarefas agendadas** — comprima novas gravações toda noite automaticamente.
- **Integração com outras ferramentas** — envie informações da mídia para sistemas de monitoramento ou pipelines de logs.

## Começando

Se você instalou o EncodeX (GUI), a CLI já está disponível. Abra um terminal e execute:

```bash
encodex convert --help
```

Você verá a lista completa de opções. A CLI espelha as capacidades da GUI: todos os formatos, codecs e perfis suportados pelo aplicativo também estão disponíveis na linha de comando.

Para as opções de instalação e todos os comandos disponíveis, consulte a [documentação da CLI](/pt/docs/cli).

## Convertendo um Vídeo

A operação mais comum é converter entre formatos. Uma conversão simples:

```bash
encodex convert in.mov -o out.mp4
```

Isso usa as configurações padrão do EncodeX (H.264 + AAC em um contêiner MP4) e gera um arquivo que funciona em qualquer lugar.

Para escolher um codec ou uma qualidade específica:

```bash
encodex convert in.mov -o out.mp4 --video-codec libx265 --crf 20
```

O H.265 produz arquivos menores com a mesma qualidade. O CRF 20 é uma configuração de alta qualidade; números menores significam mais qualidade (e arquivos maiores).

## Extraindo Áudio

Extraia a faixa de áudio de um vídeo sem reencodificar:

```bash
encodex extract-audio in.mp4 -o audio.mp3
```

A saída padrão é MP3 a 192k. Para especificar um formato diferente:

```bash
encodex extract-audio in.mp4 -o audio.wav --codec libopus
```

Isso é útil para extrair o áudio de podcasts a partir de gravações em vídeo, criar prévias de áudio ou arquivar as trilhas sonoras separadamente.

## Transcodificação Sem Perdas

Quando você precisa mudar o contêiner sem tocar nos dados de vídeo ou áudio (por exemplo, passando de `.mkv` para `.mp4` por compatibilidade com dispositivos):

```bash
encodex convert in.mkv -o out.mp4 --video-codec copy --audio-codec copy
```

Isso é quase instantâneo porque nenhuma codificação acontece — os fluxos são apenas remuxados para o novo contêiner. Perfeito para o arquivista que quer máxima compatibilidade sem perda de qualidade.

## Conversões em Lote

Converta vários arquivos de uma vez:

```bash
encodex batch *.mov -o output/ --video-codec libx264 --crf 23
```

Todos os arquivos correspondentes são processados em sequência. Cada arquivo de entrada vira um arquivo de saída correspondente no diretório `output/`, com a extensão alterada para `.mp4`.

## Obtendo Informações da Mídia

Antes de converter, você pode querer inspecionar o codec, a resolução ou a taxa de bits de um arquivo:

```bash
encodex info in.mp4
```

Isso imprime um resumo legível dos fluxos do arquivo. Para uma saída legível por máquina:

```bash
encodex info in.mp4 --json
```

A saída JSON é útil em scripts nos quais você precisa tomar decisões com base nas propriedades do arquivo (por exemplo, "só reencodifique se o codec de vídeo não for já H.264").

## Códigos de Saída e Tratamento de Erros

A CLI retorna códigos de saída significativos para que os scripts possam detectar sucesso ou falha:

| Código | Significado |
|------|---------|
| 0 | Sucesso |
| 1 | Erro geral |
| 2 | Argumentos inválidos |
| 3 | Arquivo de entrada não encontrado |
| 4 | O arquivo de saída já existe (use `--overwrite` para substituir) |

Use-os em scripts de shell para tratar erros com elegância:

```bash
encodex convert in.mp4 -o out.mp4
if [ $? -eq 4 ]; then
  echo "Output exists — skipping."
fi
```

## Juntando Tudo

A CLI é projetada para ser componível. Um script do mundo real poderia:

1. Verificar todos os arquivos de vídeo de uma pasta com `encodex info --json`
2. Filtrar os arquivos maiores que 500 MB
3. Converter esses arquivos em um MP4 H.264 menor com CRF 23
4. Registrar os resultados

A [referência completa da CLI](/pt/docs/cli) documenta todas as opções, flags e códigos de saída.

---

*Baixe o EncodeX gratuitamente em [encodex.in/download](/pt/download). A CLI está incluída em todas as instalações.*