---
date: 2026-09-17
title: "Gire e espelhe vídeos — corrija clipes tortos sem perder qualidade"
description: "O EncodeX agora gira vídeos e fotos em 90°, 180° ou 270° no sentido horário e espelha horizontal ou verticalmente. Mantendo MP4/MOV/MKV, a rotação é salva como metadados sem perda — sem recodificar."
tags:
  - feature
  - rotation
  - release
---

# Gire e espelhe vídeos

Gravou um vídeo com o celular na posição errada? Acontece com todo mundo. A partir de hoje, o EncodeX resolve isso: **Rotação e espelhamento** gira vídeos e fotos **90°, 180° ou 270° no sentido horário** e espelha **horizontal ou verticalmente** — direto da página Converter e da fila em lote.

## Um clique e pronto

Corrigir um clipe torto leva segundos:

1. Abra a página **Converter** (ou adicione arquivos à **fila em lote**)
2. Escolha qualquer vídeo ou imagem como origem
3. Na área de configurações, selecione um ângulo no menu **Rotação** — `90°`, `180°` ou `270°` no sentido horário — e espelhe com os interruptores **Espelhar horizontal** / **Espelhar vertical**
4. Converta

Só isso. A saída sai exatamente na orientação que você quer. Funciona com vídeos **e imagens**, tanto em conversões individuais quanto em tarefas em lote (as operações de transcodificação e compressão de imagens suportam).

## Duas formas de funcionar

A rotação é aplicada com um de dois mecanismos, dependendo da sua saída:

### Rotação por metadados sem perda (sem recodificar)

Quando a saída é **MP4, MOV ou MKV** e você usa o modo **cópia de fluxo (cópia sem perda)** com um ângulo de rotação e sem espelho, o EncodeX salva a rotação como metadados padrão de exibição (`rotate=`). O player gira o vídeo na reprodução — **a qualidade não é tocada** e a tarefa termina em segundos, porque nada é recodificado. O espelhamento não faz parte desse caminho: inverter a imagem sempre muda os pixels, então sempre recodifica.

Se o seu contêiner suportar, a página Converter mostra uma nota útil explicando que a rotação é aplicada sem perda. Se o contêiner de saída *não* suportar (WebM, FLV, GIF e saídas de imagem, por exemplo), você verá um aviso com a ação **Desativar cópia sem perda**, que troca para o caminho de recodificação com um clique.

### Rotação por pixels (recodificação)

Para qualquer outro formato — ou sempre que você espelhar o vídeo — o EncodeX recodifica os quadros com uma cadeia de filtros do FFmpeg (`transpose` + `hflip`/`vflip`) que se combina limpa com o filtro `scale` existente. Como a rotação ocorre em passos de 90°, não há interpolação, então o resultado continua nítido.

## Integrada à fila em lote

Rotação e espelhamento não se limitam a conversões individuais. Também fazem parte da **fila em lote**: configure no painel do lote para aplicar a tudo, ou edite uma tarefa individual na janela de opções dela. Tarefas em lote sempre recodificam, então rotação e espelhamento simplesmente passam a fazer parte das opções da tarefa, junto com codec, bitrate e escala.

## Por baixo do capô

- A rotação usa o filtro `transpose` do FFmpeg: `transpose=1` para 90°, `transpose=2,transpose=2` para 180° e `transpose=2` para 270° (com espelhamento quando você adiciona flips).
- Quando `scale` também está definido, tudo é combinado em um único argumento `-vf` (primeiro escala, depois rotação), mantendo a cadeia eficiente.
- No modo de cópia de fluxo com contêiner compatível, o sinalizador `-metadata:s:v rotate=<deg>` é escrito ao lado de `-c copy` — sem decodificar, sem recodificar, sem perda de qualidade.
- A fila em lote e o painel de compressão de imagens expõem os mesmos controles, e as tarefas `compress_image` giram imagens da mesma forma.

## O que vem depois

Predefinições de rotação dentro dos perfis de conversão são o próximo passo natural, junto com opções como ângulos arbitrários. Se você gostaria de ver um fluxo de rotação ou espelhamento, [abra uma issue](https://github.com/Sandeepv68/EncodeX/issues) e conte para a gente.

---

[Baixar o EncodeX](/download) · [Ver todos os recursos](/features) · [Ler a documentação](/docs/features-reference)