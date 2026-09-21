---
title: "Cómo convertir video para Instagram: Reels, Historias y publicaciones bien hechas"
description: "Instagram es cuestión de proporción de aspecto. Convierte Reels e Historias verticales a 1080x1920, elige el códec correcto y mantén la calidad en móvil — un flujo de trabajo práctico y sin conexión con EncodeX."
date: 2026-09-18
tags:
  - guide
  - instagram
  - how-to
---

# Cómo convertir video para Instagram: Reels, Historias y publicaciones bien hechas

A diferencia de YouTube, Instagram no es tolerante — recorta, comprime y recodifica todo lo que no reconoce como nativo móvil. La razón más común de que las subidas se vean suaves o borrosas no es una mala codificación, es una **proporción de aspecto incorrecta** comprimiéndose a la correcta.

Esta guía te da los contenedores, resoluciones y proporciones exactos para Reels, Historias y publicaciones del feed — antes de que Instagram meta sus manos en tu video.

## La respuesta breve

- **Reels e Historias:** MP4 · H.264 · **1080×1920** vertical (9:16)
- **Video del feed:** MP4 · H.264 · **1080×1350** o vertical estilo Reels
- Mantén los archivos ligeros: Instagram maneja el 4K peor de lo que ayuda, y un archivo grande fuerza su propia recodificación

Las historias de terror de recorte de video estilo pantalla (texto borroso, cabezas cortadas, fuerte banding) todas se remontan a darle a la plataforma un clip **horizontal** cuando quería **vertical** — o al revés.

## Por qué la proporción de aspecto lo es todo en Instagram

Las superficies de Instagram tienen formas fijas:

| Superficie | Forma | Resolución objetivo |
|------------|-------|---------------------|
| Reels | 9:16 vertical | 1080×1920 |
| Historias | 9:16 vertical | 1080×1920 |
| Publicación del feed (imagen de borde a borde) | 4:5 vertical | 1080×1350 |
| Video del feed | 4:5 o 1:1 | 1080×1350 o 1080×1080 |
| Publicación horizontal al estilo antiguo | 16:9 | 1920×1080 |

Si tu origen es horizontal 16:9 y lo publicas como Reel, Instagram añadirá barras negras, luego recortará y luego recodificará — tres generaciones de daño en una sola subida. **Convierte a la proporción objetivo exacta de antemano** y la plataforma dejará en paz tu video en su mayor parte.

## ¿Recortar o escalar? ¿Cuál es lo correcto?

Dos formas de hacer vertical un clip horizontal, con resultados muy diferentes:

- **Escalar (ajustar)** — encoge todo el cuadro para caber en 1080×1920, llenando el espacio de barras negras arriba/abajo. Seguro, pero estás usando la mitad de tus píxeles para negro.
- **Recortar (rellenar)** — hace zoom para llenar 1080×1920, cortando los bordes izquierdo/derecho. Genial para personas/primeros planos, arriesgado para texto o planos amplios donde cortarás contenido.

Para material de personas y momentos cotidianos grabado con el teléfono, **recortar** suele verse mejor. Para grabaciones de pantalla, tomas de producto o cualquier cosa con texto en los bordes, **escala** (o recompón en un editor). El objetivo "Instagram" de EncodeX usa por defecto un ajuste de proporción sensato; las [tarjetas de objetivos](/es/ "Visita la página de inicio de EncodeX") te permiten alternar entre rellenar y ajustar.

## Códec y bitrate: mantenlo pequeño y nítido

El reproductor de Instagram es móvil primero, así que todo se juzga en móvil. Configuraciones prácticas:

- **Códec: H.264.** Las únicas configuraciones que todo cliente de Instagram reproduce de forma fiable. Las subidas H.265 a veces se recodifican; H.264 no.
- **Límite de resolución: 1080p en el lado largo.** Instagram no es un escaparate de 4K. Un archivo 4K se recodifica a menor resolución — así que codifícalo una vez, limpiamente, a 1080p.
- **Punto óptimo de bitrate:** ~8–12 Mbps para video 1080p con mucho movimiento, y puedes bajar (5–8 Mbps) para cabezas parlantes o diapositivas. Por encima de ~15 Mbps solo estás inflando la subida.
- **Audio: AAC estéreo.** Instagram reproduce mono/estéreo; no incluyas pistas 5.1 o 7.1.

## El flujo de trabajo paso a paso con EncodeX

Todo sin conexión, con [EncodeX gratis](/es/download):

1. **Suelta** tu clip en la ventana de EncodeX.
2. **Elige la tarjeta de objetivo "Instagram"** — se corresponde con un MP4 vertical 1080×1920, H.264, con un bitrate sensato para móvil. (Las tarjetas de objetivos viven en la [página de inicio](/es/); los mismos objetivos están en el [conversor de video](/es/video-converter).)
3. **Elige rellenar o ajustar** para cómo el recorte maneja la forma de tu origen.
4. **Convierte y sube.** La salida queda lista donde la dejaste — sin paso de subida dentro de la app.

## Ángulos únicos para Reels, Historias y publicaciones

- **Reels** — hasta 3 minutos (a partir de 2026); haz que los primeros 1.5 segundos importen, ya que el bucle empieza rápido. Verticales, con sonido alto pero sin distorsión y con subtítulos legibles.
- **Historias** — efímeras, verticales a pantalla completa. Convierte un clip recortado de 15 segundos en lugar de un video largo; la proporción es la misma 1080×1920.
- **Publicaciones del feed** — normalmente más pausadas, estéticas, en 4:5. Un bitrate ligeramente mayor vale la pena aquí porque no hay presión de tiempo sobre la atención del espectador.

## Cómo se ven los valores predeterminados equivocados

- **Reel horizontal** → Instagram lo comprime y lo recorta horizontalmente, y luego añade barras negras — suave, pequeño, olvidable. Convierte a vertical primero.
- **Subidas de 10 bits o HDR** → el mapeo de tonos de Instagram las destroza. Exporta SDR estándar (8 bits sirve perfectamente para móvil).
- **Bitrate al máximo desde un máster cinematográfico** → tu subida llega a la recodificación de Instagram en desventaja. Recodifica con ajustes sensatos para Instagram antes de publicar.

Para el resto de la serie, consulta [YouTube](/es/blog/posts/how-to-convert-video-for-youtube) y [WhatsApp](/es/blog/posts/how-to-convert-video-for-whatsapp) — y empieza por el [marco de formato](/es/blog/posts/what-is-the-best-video-format).

## Preguntas frecuentes

### ¿Instagram necesita video vertical para los Reels?

Sí. Los Reels son 9:16 verticales por diseño. Los clips horizontales reciben barras negras y de hecho se reducen a una miniatura en la mayoría de los feeds, e Instagram comprime agresivamente cualquier cosa que no sea de proporción nativa.

### ¿Debería subir siempre en 4K a Instagram?

No. Instagram reduce todo a 1080p y recodifica; no hay beneficio de longevidad en el 4K aquí, solo una subida más larga y una recodificación más dura. Convierte a un 1080p H.264 limpio de antemano — te verás *más nítido* que una subida 4K que Instagram aplastó.

### ¿Por qué mi video de Instagram se ve borroso si es exactamente 1080×1920?

Que la proporción sea correcta es solo la mitad de la batalla. La otra mitad es el bitrate: si tu origen ya estaba muy comprimido o tu exportación usó un bitrate muy bajo, el detalle se perdió antes de que Instagram lo viera. Recodifica desde el máster limpio a 8–12 Mbps.

### ¿Cómo hago un clip vertical sin perder la parte importante?

Usa **recorte (rellenar)** para personas y movimiento, y mantén tu sujeto centrado. Para contenido cargado de texto o muy amplio, usa **escalado (ajustar)** para que nada se corte. En la duda, haz un render de prueba de 2 segundos y echa un vistazo al resultado en tu teléfono.

---

**Hazlo con EncodeX → Descarga.** Prepara tus Reels, Historias y publicaciones de Instagram en minutos — gratuito, de código abierto, totalmente sin conexión, sin marca de agua. [Descarga EncodeX](/es/download).