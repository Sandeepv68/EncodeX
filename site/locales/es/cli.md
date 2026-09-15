---
title: "EncodeX CLI – Línea de comandos FFmpeg simplificada | EncodeX"
description: "La CLI de EncodeX te brinda el poder de la línea de comandos de FFmpeg con comandos simples y legibles. Convierte, comprime, extrae audio y procesa por lotes desde la terminal en Windows, Mac y Linux."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# EncodeX CLI

Lo suficientemente simple para usuarios diarios. Lo suficientemente poderoso para desarrolladores. **EncodeX** no es solo una interfaz gráfica — el mismo motor de FFmpeg está disponible desde la línea de comandos a través de la **CLI de EncodeX**.

## Línea de comandos FFmpeg, sin la sintaxis de FFmpeg

La línea de comandos nativa de FFmpeg es poderosa pero famosamente inflexible. La **CLI de EncodeX** la envuelve en comandos simples y legibles:

```bash
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac
encodex info input.mp4 --json
encodex compress photo.png -f jpg -q 30
encodex extract-audio input.mp4
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted
```

Nada de cadenas crípticas como `-c:v libx264 -crf 23 -preset medium` — solo indicadores de opciones claros, las mismas configuraciones que usa la interfaz gráfica y una salida limpia.

## ¿Por qué usar la CLI de EncodeX?

- **Automatízala** — automatiza conversiones en tareas cron, pipelines CI y servidores
- **Consistente** — el mismo motor y perfiles que la interfaz gráfica
- **Amigable con lotes** — patrones glob y `--concurrency` para trabajo en paralelo
- **Legible** — comandos que puedes escribir sin un manual
- **Multiplataforma** — funciona en Windows, macOS y Linux
- **Sin interfaz** — no requiere escritorio, perfecto para servidores

## Comandos de la CLI

| Comando            | Qué hace                                             |
| ------------------ | ---------------------------------------------------- |
| `encodex convert`  | Convierte un solo archivo entre dos formatos         |
| `encodex batch`    | Convierte muchos archivos con patrones glob, en paralelo |
| `encodex compress`  | Comprime un archivo de vídeo o imagen               |
| `encodex extract-audio` | Extrae la pista de audio de un vídeo           |
| `encodex info`     | Analiza un archivo e imprime sus detalles técnicos   |
| `encodex capabilities` | Lista los formatos y codificadores compatibles  |

## Obtén la CLI

La CLI se incluye con **cada instalación de EncodeX** — descarga la aplicación y podrás ejecutar `encodex` desde tu terminal. No se necesita configuración adicional.

[Descarga EncodeX gratis](/es/download)

## Preguntas frecuentes

**¿Necesito la interfaz gráfica para usar la CLI?** No, la CLI funciona de forma independiente. Se incluye con cada instalación de EncodeX.

**¿Puedo usar la CLI de EncodeX en un servidor?** Sí — es sin interfaz, por lo que funciona genial en scripts, CI y entornos de servidor.

**¿La CLI de EncodeX es realmente gratuita?** Sí — EncodeX es gratuito para siempre y de código abierto (MIT).

## Empieza

- [Descarga EncodeX gratis](/es/download)
- [Descubre por qué EncodeX es la interfaz gráfica de FFmpeg más fácil](/es/ffmpeg-gui)
- [Aprende qué es FFmpeg en realidad](/es/learn/what-is-ffmpeg)
- [Mira todas las conversiones y funciones](/es/features)
