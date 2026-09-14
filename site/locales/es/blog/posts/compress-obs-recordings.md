---
title: "Cómo Comprimir Grabaciones de OBS y ShadowPlay para Compartirlas"
description: "Reduce las grabaciones de gameplay de gran tamaño de OBS o ShadowPlay a tamaños fáciles de subir con EncodeX — una GUI de FFmpeg gratuita con aceleración por GPU."
date: 2026-09-14
tags:
  - guide
  - gaming
  - compression
  - obs
---

# Cómo Comprimir Grabaciones de OBS y ShadowPlay para Compartirlas

Grabar gameplay en 1080p 60fps produce archivos enormes. Una sesión de diez minutos puede alcanzar fácilmente 5–10 GB, y las sesiones más largas pueden superar los 50 GB. Estos archivos son excelentes para la edición — se capturan en alta calidad con una compresión mínima — pero son demasiado grandes para subirlos a Discord, incrustarlos en un directo, enviarlos a amigos o publicarlos en redes sociales.

La solución es una segunda codificación: tomar el original de alta calidad, comprimirlo a un bitrate razonable y producir un archivo que pesa una fracción del original pero se ve casi idéntico en pantalla.

## ¿Por Qué las Grabaciones de Gameplay Son Tan Grandes?

OBS y ShadowPlay capturan con bitrates altos por defecto — a menudo de 20 000 a 50 000 kbps. Esto conserva cada detalle para la edición, pero la mayoría de los espectadores nunca notará la diferencia entre una grabación de 50 Mbps y una codificación de 10 Mbps en la pantalla de un teléfono o un portátil. La clave: tu archivo de origen está pensado para editar, no para ver. Comprimirlo para su visualización produce un archivo que se ve igual para tu audiencia pero pesa muchísimo menos.

## El Punto Ideal de Compresión para Gameplay

Para el gameplay que tiene como destino YouTube, Discord o las redes sociales:

- **Códec:** H.264 (la mayor compatibilidad) o H.265 (archivos más pequeños)
- **Resolución:** conserva la resolución nativa si es 1080p o inferior; reduce el 4K a 1080p para la mayoría de las plataformas
- **Bitrate:** 5 000–10 000 kbps para 1080p 60fps es el punto ideal — lo suficientemente alto para conservar la acción rápida, lo suficientemente bajo para reducir drásticamente el archivo
- **Modo CRF:** CRF 20–23 ofrece un buen equilibrio entre calidad y tamaño sin tener que elegir un bitrate manualmente

Una grabación de gameplay de diez minutos en 1080p 60fps capturada a 30 Mbps pesa aproximadamente 2.2 GB. Al volver a codificarla a CRF 22, queda en unos 300–500 MB — una reducción del 75–85 % — y se ve prácticamente idéntica en YouTube o en la pantalla de un teléfono.

## Cómo Comprimir Gameplay con EncodeX

1. [Descarga EncodeX](/es/download) y ábrelo.
2. Arrastra tu grabación de OBS o ShadowPlay a la ventana.
3. Elige un perfil: el perfil **[MP4 Maximum Compatibility](/es/video-compressor)** funciona bien para la mayoría de los casos de uso de compartir, o elige un perfil más pequeño para Discord y el chat.
4. Haz clic en **Comprimir**.

EncodeX usa tu GPU (NVENC en NVIDIA, AMF en AMD, QSV en Intel) para comprimir el archivo rápidamente. Una grabación de diez minutos normalmente se codifica en menos de dos minutos — más rápido que en tiempo real.

## Cómo Comprimir Varios Clips

Si grabaste una sesión larga y quieres extraer y comprimir clips concretos, la herramienta **Video Cut** te permite recortar un intervalo de tiempo antes de comprimir. Así evitas desperdiciar espacio en las partes que no necesitas.

Para la compresión masiva — procesar una carpeta entera de grabaciones — la [cola por lotes](/es/features) procesa varios archivos en secuencia con la misma configuración.

## Extraer Audio para Podcasts o Momentos Destacados

A veces solo quieres el audio de un clip de gameplay — para un clip de podcast, una voz en off o un reel de momentos destacados. La [herramienta de extracción de audio](/es/extract-audio-from-video) extrae la pista de audio y la genera como MP3 o AAC en un solo paso:

1. Arrastra la grabación a la herramienta de extracción de audio.
2. Elige MP3 o AAC.
3. Haz clic en **Extraer**.

El audio sale con el bitrate que elijas (el predeterminado es 192k), listo para editar o compartir.

## Por Qué Elegir EncodeX en Lugar de HandBrake

HandBrake es un transcodificador de vídeo muy conocido, y funciona bien para comprimir. Pero EncodeX ofrece algunas cosas que HandBrake no tiene:

- **La detección de GPU es automática** — no hay que configurar los ajustes del codificador
- **El flujo de trabajo es más rápido** — suelta el archivo, elige el perfil, comprime. Sin navegar por pestañas ni ajustes avanzados.
- **La vista previa de compresión muestra el tamaño de salida estimado** antes de empezar
- **La cola por lotes está integrada** — sin un modo por lotes aparte que configurar
- **Es multiplataforma** — Windows, macOS y Linux con la misma interfaz

Para ver la comparación en detalle, consulta [EncodeX vs HandBrake](/es/handbrake-alternative).

---

*Descarga EncodeX gratis en [encodex.in/download](/es/download) y empieza a comprimir tus grabaciones de gameplay hoy mismo.*