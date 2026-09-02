---
date: 2026-09-02
title: "Perfiles de conversión — Más de 140 preconfiguraciones con un solo clic"
description: "EncodeX ahora incluye más de 140 perfiles de conversión integrados en 8 categorías. Elige una preconfiguración para YouTube, Instagram, TikTok, dispositivos Apple, ProRes, HLS y más — todos los ajustes se completan automáticamente."
tags:
  - feature
  - profiles
  - release
---

# Perfiles de conversión

Acabamos de lanzar una de las funciones más solicitadas en EncodeX: los **Perfiles de conversión**. En lugar de elegir manualmente códecs, tasas de bits, ajustes de calidad y formatos de contenedor cada vez que conviertes un archivo, ahora puedes elegir entre más de 140 preconfiguraciones que hacen todo el trabajo por ti.

## ¿Qué son los perfiles de conversión?

Un perfil de conversión es una configuración de codificación guardada. Le dice a EncodeX exactamente qué códec de vídeo, códec de audio, tasa de bits, nivel de calidad, resolución, formato de píxel y contenedor usar — todo con un solo clic.

Piensa en ello como una receta. En lugar de medir cada ingrediente tú mismo, eliges una receta y todo está listo.

## Qué incluye

Los más de 140 perfiles integrados están organizados en 8 categorías:

### Web y Social

Preconfiguraciones optimizadas para las plataformas donde publicas:

- **YouTube** — 480p hasta 4K, con variantes H.264, H.265 y AV1
- **Instagram** — Reels, Stories y publicaciones en el ratio y códec correctos
- **TikTok** — preconfiguraciones de vídeo vertical ajustadas para carga rápida y buena calidad
- **Facebook** — publicaciones de vídeo y anuncios
- **X (Twitter)** — vídeo de formato corto con conciencia del tamaño de archivo

### Dispositivos

Preconfiguraciones ajustadas a hardware específico:

- **Apple** — iPhone, iPad, Mac, Apple TV (H.264 y HEVC)
- **Android** — preconfiguraciones para teléfono y tablet
- **Consolas de juegos** — formatos compatibles con PlayStation, Xbox y Nintendo Switch

### Códecs de vídeo

Perfiles específicos por códec cuando sabes qué encoder quieres:

- H.264, H.265/HEVC, VP8, VP9, AV1
- MPEG-4, MPEG-2, Theora

### Profesional

Formatos de broadcast y postproducción:

- **ProRes** — 422 LT, 422, 422 HQ, 4444, 4444 XQ
- **DNxHD / DNxHR** — múltiples niveles de resolución y calidad
- **FFV1** — códec sin pérdidas para archivo
- **XDCAM / XAVC** — formatos de broadcast Sony

### Streaming

Preconfiguraciones de streaming adaptativo:

- **HLS** — HTTP Live Streaming con duración de segmento configurable
- **DASH** — salida MPEG-DASH

### Audio

Preconfiguraciones solo de audio:

- MP3 (128k, 192k, 320k)
- AAC (128k, 192k, 256k)
- FLAC (sin pérdidas)
- Opus, WAV y más

### Imágenes

Conversión de formatos de imagen:

- JPEG, PNG, WebP, AVIF con controles de calidad

### Avanzado

Para usuarios experimentados:

- Preconfiguraciones de argumentos FFmpeg crudos
- Passthrough FFmpeg personalizado
- Salida nula para pruebas

## Cómo usar los perfiles

1. Abre la página de **Conversión** (o la **Cola por lotes**)
2. Busca el **Selector de perfiles** en la parte superior del área de ajustes
3. Navega por categoría o busca por nombre
4. Haz clic en un perfil — todos los campos de codificación se completan automáticamente
5. Ajusta lo que quieras y pulsa Convertir

El selector de perfiles muestra cada perfil con un icono de categoría, para que puedas distinguir rápidamente una preconfiguración de YouTube de una de ProRes.

## Perfiles personalizados

Si el catálogo integrado no cubre tu caso de uso exacto, crea el tuyo propio:

1. Configura tus ajustes de codificación manualmente
2. Haz clic en el botón de guardar en el selector de perfiles
3. Dale un nombre y una categoría
4. Tu perfil personalizado aparece junto a los integrados

Los perfiles personalizados se guardan localmente y persisten entre sesiones. Puedes editarlos o eliminarlos en cualquier momento. (Los perfiles integrados están bloqueados — puedes usarlos pero no modificarlos.)

## Últimos usados

EncodeX recuerda los últimos 5 perfiles que aplicaste, para que tus flujos de trabajo más comunes estén siempre a un clic de distancia. No necesitas navegar categorías cuando siempre usas las mismas dos preconfiguraciones.

## Compatible con la cola por lotes

Los perfiles también funcionan en la Cola por lotes. Aplica un perfil para establecer las opciones de codificación para nuevos trabajos, o úsalo como punto de partida antes de personalizar entradas individuales del lote.

## Bajo el capó

Cada perfil se asigna a un objeto `ConversionProfile` que almacena:

- Formato de contenedor y extensión de salida
- Selección de códec de vídeo y audio
- Ajustes de tasa de bits, CRF y calidad
- Escala, formato de píxel y FPS
- Argumentos FFmpeg avanzados (`extraArgs` e `inputArgs`) para formatos profesionales

Cuando aplicas un perfil, EncodeX escribe estos valores en el formulario de conversión. Los perfiles avanzados pueden pasar flags FFmpeg crudos directamente al encoder — así es como soportamos cosas como la selección de perfil ProRes y la configuración de segmentos HLS.

Los perfiles son una función de la GUI — la CLI continúa usando flags explícitos (`--video-codec`, `--audio-codec`, etc.) para máxima flexibilidad en scripts y automatizaciones.

## Qué viene seguiremos

Seguiremos expandiendo el catálogo de perfiles según las sugerencias de la comunidad. Si hay una plataforma o formato para el que quieras un perfil, [abre un issue](https://github.com/Sandeepv68/EncodeX/issues) y háznos saber.

---

[Descargar EncodeX](/download) · [Ver todas las funciones](/features) · [Leer la documentación](/docs/features-reference)
