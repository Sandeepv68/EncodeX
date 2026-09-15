---
title: "EncodeX CLI – Linha de comando FFmpeg simplificada | EncodeX"
description: "A CLI do EncodeX dá a você o poder da linha de comando do FFmpeg com comandos simples e legíveis. Converta, comprima, extraia áudio e processe em lote pelo terminal no Windows, Mac e Linux."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# EncodeX CLI

Suficientemente simples para usuários do dia a dia. Suficientemente poderosa para desenvolvedores. **EncodeX** não é apenas uma interface gráfica — o mesmo motor do FFmpeg está disponível na linha de comando através da **CLI do EncodeX**.

## Linha de comando FFmpeg, sem a sintaxe do FFmpeg

A linha de comando nativa do FFmpeg é poderosa, mas notoriamente rigorosa. A **CLI do EncodeX** a envolve em comandos simples e legíveis:

```bash
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac
encodex info input.mp4 --json
encodex compress photo.png -f jpg -q 30
encodex extract-audio input.mp4
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted
```

Nada de cadeias crípticas como `-c:v libx264 -crf 23 -preset medium` — apenas flags de opções claras, as mesmas configurações que a interface gráfica usa, e saída limpa.

## Por que usar a CLI do EncodeX?

- **Automatize** — automatize conversões em jobs cron, pipelines CI e servidores
- **Consistente** — o mesmo motor e perfis que a interface gráfica
- **Amigável com lotes** — padrões glob e `--concurrency` para trabalho paralelo
- **Legível** — comandos que você pode digitar sem um manual
- **Multiplataforma** — funciona no Windows, macOS e Linux
- **Sem interface** — não requer desktop, perfeito para servidores

## Comandos da CLI

| Comando            | O que faz                                               |
| ------------------ | ------------------------------------------------------- |
| `encodex convert`  | Converte um único arquivo entre dois formatos            |
| `encodex batch`    | Converte muitos arquivos com padrões glob, em paralelo   |
| `encodex compress`  | Comprime um arquivo de vídeo ou imagem                   |
| `encodex extract-audio` | Extrai a faixa de áudio de um vídeo                |
| `encodex info`     | Analisa um arquivo e imprime seus detalhes técnicos      |
| `encodex capabilities` | Lista formatos e codificadores suportados           |

## Obtenha a CLI

A CLI vem com **cada instalação do EncodeX** — baixe o aplicativo e você poderá chamar `encodex` do seu terminal. Nenhuma configuração separada necessária.

[Baixe o EncodeX gratuitamente](/pt/download)

## Perguntas frequentes

**Preciso da interface gráfica para usar a CLI?** Não, a CLI funciona de forma independente. Ela está incluída em cada instalação do EncodeX.

**Posso usar a CLI do EncodeX em um servidor?** Sim — ela é sem interface, então funciona muito bem em scripts, CI e ambientes de servidor.

**A CLI do EncodeX é realmente gratuita?** Sim — o EncodeX é gratuito para sempre e de código aberto (MIT).

## Comece

- [Baixe o EncodeX gratuitamente](/pt/download)
- [Descubra por que o EncodeX é a melhor interface FFmpeg](/pt/ffmpeg-gui)
- [Aprenda o que é o FFmpeg na verdade](/pt/learn/what-is-ffmpeg)
- [Veja todas as conversões e funcionalidades](/pt/features)
