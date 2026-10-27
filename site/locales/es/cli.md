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

## Los mismos cuatro pasos

Conversión por CLI o por interfaz: el flujo es idéntico — eliges una meta, EncodeX hace la codificación:

<div class="workflow-steps">
  <div class="wf-step">
    <span class="wf-num">1</span>
    <p class="card-head">Arrastrar</p>
    <p><code>vacation.mkv</code></p>
  </div>
  <div class="wf-step">
    <span class="wf-num">2</span>
    <p class="card-head">Elegir</p>
    <p>📱 iPhone</p>
  </div>
  <div class="wf-step">
    <span class="wf-num">3</span>
    <p class="card-head">Convertir</p>
    <p>✓ MP4 1080p</p>
  </div>
  <div class="wf-step">
    <span class="wf-num">4</span>
    <p class="card-head">Listo</p>
    <p><code>vacation.mp4</code></p>
  </div>
</div>

Desde la terminal, esa misma meta está a un comando de distancia:

```bash
encodex convert vacation.mkv vacation.mp4 --video-codec libx264 --audio-codec aac -s 1920x1080
```

## ¿Por qué usar la CLI de EncodeX?

- **Automatízala** — automatiza conversiones en scripts y pipelines CI
- **Consistente** — el mismo motor FFmpeg que la interfaz gráfica
- **Amigable con lotes** — patrones glob y `--concurrency` para trabajo en paralelo
- **Legible** — comandos que puedes escribir sin un manual
- **Multiplataforma** — funciona en Windows, macOS y Linux

## Comandos de la CLI

| Comando            | Qué hace                                             |
| ------------------ | ---------------------------------------------------- |
| `encodex convert`  | Convierte un solo archivo entre dos formatos         |
| `encodex batch`    | Convierte muchos archivos con patrones glob, en paralelo |
| `encodex compress`  | Comprime un archivo de imagen                       |
| `encodex extract-audio` | Extrae la pista de audio de un vídeo           |
| `encodex remux`    | Copia los flujos a otro contenedor sin recodificar |
| `encodex demux`    | Extrae cada flujo a un archivo separado             |
| `encodex info`     | Analiza un archivo e imprime sus detalles técnicos   |
| `encodex capabilities` | Lista los codificadores disponibles y los métodos de aceleración por hardware |

## Obtén la CLI

La CLI se incluye con **cada instalación de EncodeX** — descarga la aplicación y podrás ejecutar `encodex` desde tu terminal. No se necesita configuración adicional.

[Descarga EncodeX gratis](/es/download)

## Preguntas frecuentes

**¿Necesito la interfaz gráfica para usar la CLI?** No — la CLI se ejecuta desde tu terminal y no requiere la ventana de la interfaz gráfica. Se incluye con cada instalación de EncodeX.

**¿Puedo usar la CLI de EncodeX en scripts?** Sí — admite salida `--json` y códigos de salida estándar para la automatización.

**¿La CLI de EncodeX es realmente gratuita?** Sí — EncodeX es gratuito para siempre y de código abierto (MIT).

## Empieza

- [Descarga EncodeX gratis](/es/download)
- [Descubre por qué EncodeX es la interfaz gráfica de FFmpeg más fácil](/es/ffmpeg-gui)
- [Aprende qué es FFmpeg en realidad](/es/learn/what-is-ffmpeg)
- [Mira todas las conversiones y funciones](/es/features)
