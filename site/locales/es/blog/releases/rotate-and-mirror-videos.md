---
date: 2026-09-17
title: "Rota y refleja vídeos: corrige clips laterales sin perder calidad"
description: "EncodeX ahora rota vídeos y fotos 90°, 180° o 270° en el sentido de las agujas del reloj y los refleja horizontal o verticalmente. Si mantienes MP4/MOV/MKV, la rotación se guarda como metadatos sin pérdida, sin recodificar."
tags:
  - feature
  - rotation
  - release
---

# Rota y refleja vídeos

¿Grabaste un vídeo con el móvil en la posición equivocada? A todos nos ha pasado. Desde hoy EncodeX puede arreglarlo: **Rotación y espejo** rota vídeos y fotos **90°, 180° o 270° en el sentido de las agujas del reloj** y los refleja **horizontal o verticalmente** — directamente desde la página Convertir y la cola por lotes.

## Un clic y listo

Corregir un clip lateral lleva segundos:

1. Abre la página **Convertir** (o añade archivos a la **cola por lotes**)
2. Elige cualquier vídeo o imagen como origen
3. En el área de ajustes, selecciona un ángulo en el menú desplegable **Rotación** — `90°`, `180°` o `270°` en el sentido de las agujas del reloj — y refleja con los interruptores **Reflejar horizontal** / **Reflejar vertical**
4. Convierte

Eso es todo. La salida queda orientada exactamente como quieres. Funciona con vídeos **e imágenes**, tanto en conversiones individuales como en trabajos por lotes (las operaciones de transcodificación y compresión de imágenes lo admiten).

## Dos formas de funcionar

La rotación se aplica con uno de dos mecanismos, según tu salida:

### Rotación por metadatos sin pérdida (sin recodificar)

Cuando la salida es **MP4, MOV o MKV** y usas el modo **copia de flujo (copia sin pérdida)** con un ángulo de rotación y sin reflejo, EncodeX guarda la rotación como metadatos estándar de visualización (`rotate=`). El reproductor rota el vídeo al reproducirlo — **la calidad no se toca** y el trabajo termina en segundos porque nada se recodifica. El reflejo no forma parte de este camino: invertir la imagen siempre cambia los píxeles, así que siempre recodifica.

Si tu contenedor lo admite, la página Convertir muestra una nota útil que explica que la rotación se aplica sin pérdida. Si tu contenedor de salida *no* lo admite (WebM, FLV, GIF y salidas de imagen, por ejemplo), verás una advertencia con la acción **Desactivar copia sin pérdida**, que te cambia al camino de recodificación con un clic.

### Rotación por píxeles (recodificación)

Para cualquier otro formato — o siempre que reflejes el vídeo — EncodeX recodifica los fotogramas con una cadena de filtros de FFmpeg (`transpose` + `hflip`/`vflip`) que se combina limpiamente con el filtro `scale` existente. Como la rotación se realiza en pasos de 90°, no hay interpolación, así que el resultado sigue siendo nítido.

## Integrada en la cola por lotes

La rotación y el reflejo no se limitan a conversiones individuales. También forman parte de la **cola por lotes**: configúralos en el panel de lote para aplicarlos a todo el lote, o edita un trabajo individual en su diálogo de opciones. Los trabajos por lote siempre recodifican, así que rotación y reflejo pasan a formar parte de las opciones del trabajo junto con códec, bitrate y escala.

## Bajo el capó

- La rotación usa el filtro `transpose` de FFmpeg: `transpose=1` para 90°, `transpose=2,transpose=2` para 180° y `transpose=2` para 270° (con reflejo cuando añades inversiones).
- Cuando también hay `scale`, todo se combina en un único argumento `-vf` (primero escala, luego rotación), para que la cadena siga siendo eficiente.
- En el modo de copia de flujo con contenedor compatible, se escribe `-metadata:s:v rotate=<deg>` junto a `-c copy` — sin decodificar, sin recodificar, sin pérdida de calidad.
- La cola por lotes y el panel de compresión de imágenes exponen los mismos controles, y los trabajos `compress_image` rotan imágenes de la misma manera.

## ¿Qué sigue?

Los ajustes de rotación dentro de los perfiles de conversión son el siguiente paso natural, junto con opciones como ángulos arbitrarios. Si tienes un flujo de trabajo de rotación o reflejo que te gustaría ver, [abre un issue](https://github.com/Sandeepv68/EncodeX/issues) y cuéntanoslo.

---

[Descargar EncodeX](/download) · [Ver todas las funciones](/features) · [Leer la documentación](/docs/features-reference)