---
title: "Como Comprimir Gravações do OBS e do ShadowPlay para Compartilhar"
description: "Reduza gravações grandes de gameplay do OBS ou do ShadowPlay para tamanhos fáceis de envio com o EncodeX — uma interface FFmpeg gratuita com aceleração de GPU."
date: 2026-09-14
tags:
  - guide
  - gaming
  - compression
  - obs
---

# Como Comprimir Gravações do OBS e do ShadowPlay para Compartilhar

Gravar gameplay em 1080p 60fps gera arquivos enormes. Uma sessão de dez minutos pode facilmente chegar a 5–10 GB, e sessões mais longas podem ultrapassar 50 GB. Esses arquivos são ótimos para edição — são capturados em alta qualidade com compressão mínima —, mas são grandes demais para enviar ao Discord, incorporar em um stream, mandar para amigos ou postar nas redes sociais.

A solução é uma segunda codificação: pegar o original em alta qualidade, comprimi-lo com um bitrate sensato e produzir um arquivo com uma fração do tamanho, mas que parece quase idêntico quando assistido em uma tela.

## Por Que Gravações de Gameplay São Tão Grandes?

O OBS e o ShadowPlay capturam em bitrates altos por padrão — geralmente de 20.000 a 50.000 kbps. Isso preserva cada detalhe para edição, mas a maioria dos espectadores jamais notará a diferença entre uma gravação de 50 Mbps e uma codificação de 10 Mbps na tela do celular ou do notebook. O ponto-chave: seu arquivo de origem foi feito para edição, não para visualização. Comprimi-lo para visualização produz um arquivo que parece igual para o público, mas pesa muito menos.

## O Ponto Ideal de Compressão para Gameplay

Para um gameplay que vai para o YouTube, o Discord ou as redes sociais:

- **Codec:** H.264 (o mais compatível) ou H.265 (arquivos menores)
- **Resolução:** mantenha a resolução nativa se for 1080p ou inferior; reduza o 4K para 1080p na maioria das plataformas
- **Bitrate:** 5.000–10.000 kbps para 1080p 60fps é o ponto ideal — alto o bastante para preservar a ação rápida, baixo o bastante para encolher drasticamente o arquivo
- **Modo CRF:** CRF 20–23 oferece um bom equilíbrio entre qualidade e tamanho sem precisar escolher um bitrate manualmente

Uma gravação de gameplay de dez minutos em 1080p 60fps capturada a 30 Mbps pesa cerca de 2,2 GB. Recodificada em CRF 22, ela sai com cerca de 300–500 MB — uma redução de 75–85% — com aparência praticamente idêntica no YouTube ou na tela de um celular.

## Como Comprimir Gameplay com o EncodeX

1. [Baixe o EncodeX](/pt/download) e abra-o.
2. Arraste sua gravação do OBS ou do ShadowPlay para a janela.
3. Escolha um perfil: o perfil **[MP4 Maximum Compatibility](/pt/video-compressor)** funciona bem para a maioria das situações de compartilhamento, ou opte por um perfil menor para o Discord e o chat.
4. Clique em **Comprimir**.

O EncodeX usa sua GPU (NVENC na NVIDIA, AMF na AMD, QSV na Intel) para comprimir o arquivo rapidamente. Uma gravação de dez minutos costuma ser codificada em menos de dois minutos — mais rápido que o tempo real.

## Como Comprimir Vários Clipes

Se você gravou uma sessão longa e quer extrair e comprimir clipes específicos, a ferramenta **Video Cut** permite cortar um intervalo de tempo antes de comprimir. Assim, você evita gastar espaço com as partes de que não precisa.

Para compressão em massa — processar uma pasta inteira de gravações — a [fila de lote](/pt/features) processa vários arquivos em sequência com as mesmas configurações.

## Extrair Áudio para Podcasts ou Destaques

Às vezes você quer apenas o áudio de um clipe de gameplay — para um trecho de podcast, uma narração ou uma colagem de destaques. A [ferramenta de extração de áudio](/pt/extract-audio-from-video) extrai a faixa de áudio e a gera como MP3 ou AAC em uma única etapa:

1. Arraste a gravação para a ferramenta de extração de áudio.
2. Escolha MP3 ou AAC.
3. Clique em **Extrair**.

O áudio sai no bitrate que você escolher (192k é o padrão), pronto para edição ou compartilhamento.

## Por Que Usar o EncodeX em Vez do HandBrake

O HandBrake é um transcodificador de vídeo conhecido, e ele funciona bem para compressão. Mas o EncodeX oferece algumas coisas que o HandBrake não tem:

- **A detecção de GPU é automática** — sem precisar configurar as opções do codificador
- **O fluxo de trabalho é mais rápido** — solte o arquivo, escolha o perfil, comprima. Sem navegação por abas ou configurações avançadas.
- **A prévia de compressão mostra o tamanho estimado da saída** antes de você começar
- **A fila de lote é integrada** — sem um modo de lote separado para configurar
- **É multiplataforma** — Windows, macOS e Linux com a mesma interface

Para a comparação em detalhes, veja [EncodeX vs HandBrake](/pt/handbrake-alternative).

---

*Baixe o EncodeX gratuitamente em [encodex.in/download](/pt/download) e comece a comprimir suas gravações de gameplay hoje mesmo.*