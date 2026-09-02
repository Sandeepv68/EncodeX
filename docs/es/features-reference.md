# Características

EncodeX es una herramienta multiplataforma de conversión multimedia que lleva la potencia de FFmpeg a una interfaz de escritorio moderna e intuitiva. Construida con Electron, React y TypeScript, permite convertir medios entre formatos, extraer audio, cortar vídeos y comprimir imágenes — todo mediante una UI limpia y receptiva con cola por lotes, aceleración por hardware, modo CLI e internacionalización completa.

## Resumen de características

### Conversión multimedia

Convierte entre formatos de vídeo/audio con control granular sobre la selección de códecs (51 códecs de vídeo entre familias de codificadores por software y hardware, 27 códecs de audio), bitrate, resolución de salida (con conservación opcional de la relación de aspecto), formato de píxel (56 formatos agrupados por profundidad de bits), escala de calidad (qscale), inclusión de pista de audio y selección del núcleo transcoder. Se pueden poner varios archivos en cola mediante la Cola por lotes (ver abajo).

### Perfiles de conversión

Aplica preconfiguraciones de codificación para rellenar al instante los ajustes de conversión. Los perfiles encapsulan una configuración de codificación completa — formato de contenedor, códec de vídeo, códec de audio, bitrate, CRF/calidad, escala, formato de píxel y argumentos FFmpeg avanzados — para que no tengas que configurar cada ajuste manualmente.

- **Más de 140 perfiles integrados** en 8 categorías: Web y Social (YouTube, Instagram, TikTok, Facebook, X), Dispositivos (Apple, Android, consolas de juego), Códecs de vídeo, Profesional (ProRes, DNxHD/HR, FFV1), Streaming (HLS, DASH), Audio, Imágenes y Avanzado
- **Perfiles personalizados** — crea, edita y elimina tus propios perfiles; guardados en el almacenamiento local
- **Uso reciente** — acceso rápido a los últimos 5 perfiles aplicados
- **Filtrado por categoría** — navega por categoría con insignias de iconos
- **Compatibilidad con lotes** — aplica perfiles a trabajos por lotes individuales o a toda la cola

Los perfiles están disponibles en la página de Conversión y en la Cola por lotes. Seleccionar un perfil rellena automáticamente todos los campos de codificación relevantes, y aun así permite sobrescribir manualmente.

### Copia sin pérdida

Copia de stream de las pistas de vídeo o audio sin recodificar (`-c copy`). Útil para cambios rápidos de contenedor, remuxing o cuando preservar la calidad es crítico.

### Aceleración por hardware

Codificación acelerada por hardware con detección automática de las familias de codificadores disponibles. Soporta codificadores NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox y Microsoft Media Foundation. La aceleración se puede activar, con un selector de modo — `auto` añade los flags `-hwaccel` correspondientes de FFmpeg para la familia de codificadores por hardware elegida, `encode` confía en la aceleración propia del codificador — y un filtro de tipo de codificador (`auto` / `hardware` / `software`) que reduce el selector de códecs de vídeo a todos, solo GPU o solo CPU. Los codificadores disponibles se sondean desde el binario FFmpeg incluido en tiempo de ejecución y los selectores de códecs se filtran a lo que el binario ofrece realmente.

### Información multimedia

Sondea archivos multimedia e inspecciona información detallada por stream: códec, perfil, nivel, resolución, relación de aspecto de visualización, formato de píxel, profundidad de bits, color range/space/transfer/primaries, tasa de fotogramas, bitrate, tasa de muestreo, formato de muestra, número/disposición de canales, duración, tiempo de inicio, número de fotogramas, idioma y tags. Funciona con streams de vídeo, audio y subtítulos.

### Compresión de imágenes

Comprime imágenes (JPEG, PNG, WebP, BMP, GIF, TIFF, PPM, PGM, PBM) con escala de calidad y escalado de resolución configurables usando los códecs de imagen de FFmpeg. Incluye una vista previa en vivo, lectura del tamaño del archivo y — para entradas JPEG/PNG/WebP — un panel completo de metadatos EXIF con histogramas RGB y luma.

### Extracción de audio

Extrae pistas de audio de archivos de vídeo. Salida como AAC, MP3, AC3, FLAC, WAV, Vorbis, Opus, ALAC o cualquiera de los 27 códecs de audio soportados. El stream de audio de origen es seleccionable cuando hay varias pistas presentes.

### Corte de vídeo

Previsualiza y corta segmentos de vídeo con selección de hora de inicio/fin o duración precisa al fotograma. Incluye un reproductor integrado que decodifica fotogramas de vídeo (mediante un pipe rawvideo de FFmpeg hacia un elemento Canvas HTML) y audio (mediante un pipe PCM S16LE separado convertido a float e inyectado en la Web Audio API) al mismo ritmo, con una línea de tiempo multipista ampliable: montaje de miniaturas de vídeo, forma de onda de audio, sombreado keep/dim de regiones, tiradores de arrastre para recortar y cabezal de reproducción navegable.

### Cola por lotes

Procesa múltiples archivos con operaciones configurables (transcodificar, extraer audio, comprimir imagen). Los trabajos se añaden mediante un diálogo de revisión donde los nombres de salida y las opciones se pueden ajustar antes de entrar en la cola.

- **Procesamiento en paralelo** — ejecuta hasta 4 trabajos simultáneos (`MAX_QUEUE_CONCURRENCY = 4`); el tope de concurrencia es configurable en tiempo de ejecución y persistente.
- **Ciclo de vida de la cola** — iniciar, pausar y reanudar toda la cola; cancelar todo; limpiar trabajos completados/fallidos; eliminar trabajos individuales.
- **Reordenamiento** — reordenamiento arrastrar-y-soltar de los trabajos en cola (con área de soltado), respaldado por un canal `QUEUE_MOVE_TO` que informa la nueva posición del trabajo.
- **Edición de trabajos** — reemplaza las opciones (y opcionalmente la ruta de salida) de cualquier trabajo en cola antes de que arranque (`QUEUE_UPDATE_OPTIONS`).
- **Exportar / importar** — guarda la cola en un archivo JSON y vuelve a importarla más tarde (`QUEUE_EXPORT` / `QUEUE_IMPORT`), validada con un código de error dedicado `INVALID_QUEUE_FILE`.
- **Persistencia** — la instantánea de la cola (trabajos + concurrencia) se guarda de forma duradera en `queue-state.json` en el directorio de datos del usuario y se restaura al arrancar.
- **Filtros de estado** — filtra la lista de trabajos por queued / running / done / failed, más un campo de búsqueda enfocable.
- **Acciones de energía al terminar** — opcionalmente apaga, suspende o hiberna la máquina cuando la cola se vacía (`shutdown`, `pmset` o `systemctl` según plataforma; Windows respeta un flag de cierre forzado).
- **Feedback en vivo** — progreso en tiempo real por trabajo (porcentaje, tiempo, velocidad, ETA) transmitido por IPC, manejo de errores por trabajo y una insignia de conteo en la navegación mostrando el trabajo pendiente.

### Múltiples núcleos transcoder

- **FFmpeg API** — bindings Node.js de fluent-ffmpeg con eventos de progreso programáticos
- **FFmpeg CLI** — invocación directa de la CLI vía proceso hijo, sin bindings nativos
- **Framework BMF** — herramientas CLI de BMF para escenarios avanzados de pipeline (requiere instalación separada)

### Ajustes

Página de ajustes dedicada para tema, aceleración por hardware (activar/desactivar, modo, tipo de codificador), ventana siempre visible, lanzar al inicio, concurrencia de la cola por lotes y la acción de energía al terminar. Las preferencias persisten en `localStorage` y surten efecto al arrancar.

### Atajos de teclado

Un registro central de atajos (`src/renderer/constants/shortcuts.ts`) define más de 60 atajos en nueve secciones (global, convert, media info, image compress, audio extract, video cut, batch queue, logs, dashboard). Aspectos destacados:

- `Ctrl+/` — abrir el diálogo de ayuda de atajos
- `Alt+1`…`Alt+9` — saltar directamente a una página
- `Ctrl+O` / `Ctrl+Shift+S` / `Ctrl+Enter` — elegir entrada / elegir salida / iniciar el trabajo (consistente entre páginas)
- `Ctrl+Shift+P` / `Ctrl+Shift+C` — pausar / cancelar el trabajo activo
- Cola por lotes: `Ctrl+E` exportar, `Ctrl+I` importar, `1`–`5` filtros de estado, `F` enfocar búsqueda
- Reproductor de video cut: `Space` reproducir/pausar, `M` silenciar, teclas de flecha para desplazarse

Las combinaciones se emparejan por `event.code`, así funcionan independientemente de la distribución del teclado. Los tooltips toman su texto de ayuda del mismo registro.

### Indicadores de actividad y popover de trabajos

Mientras se ejecuta una conversión, extracción de audio o corte de vídeo, aparece un indicador parpadeante en la fila de navegación correspondiente; la fila de la Cola por lotes muestra un conteo en vivo de trabajos pendientes. Al pasar el ratón (o enfocar con teclado) un indicador se abre un popover anclado a él con el título del trabajo, el estado localizado (incluido el estado pausado y la insignia de concurrencia paralela), la miniatura del archivo de origen, el nombre del archivo y una barra de progreso en vivo — además de una pila de miniaturas de trabajos pendientes mientras avanza un lote. El popover usa una sombra suave y su flecha apunta al indicador.

### Confirmación de cierre

Cerrar la ventana con trabajos activos pasa por un flujo de confirmación: el proceso principal pregunta al renderer (`WINDOW_CLOSE_REQUESTED`), que muestra un diálogo enumerando el trabajo activo antes de confirmar el cierre (`WINDOW_CONFIRM_CLOSE`). Se muestra una pantalla splash al arrancar mientras la ventana principal carga.

### Dashboard

Una página de inicio con mosaicos de acción rápida para cada herramienta (las teclas numéricas `1`–`6` saltan directo a ellas) y branding de huevos de pascua estacionales (ver abajo).

### Huevos de pascua

En fechas festivas el Dashboard cambia el logo predeterminado de la app por arte navideño — Navidad, Halloween, Año Nuevo, 4 de julio, Pascua, Diwali y Holi. Cada festival está activo durante una ventana de 7 días alrededor de su fecha; Diwali y Holi siguen el calendario lunisolar hindú mediante fechas curadas (2026–2035) con un cálculo astronómico de respaldo para otros años.

### Logs

Visor de logs en vivo que agrega la salida de consola tanto del proceso principal como del renderer por IPC. Soporta filtrado por nivel (DEBUG/INFO/WARN/ERROR), limpieza y descarga del log como archivo `.txt`.

### Notificaciones

Notificaciones toast (success/info/warning/error) con duración configurable para feedback no bloqueante, superpuestas sobre la snackbar global de errores.

### Marco de ventana personalizado

Ventana de aplicación sin marco con barra de título personalizada que proporciona controles minimizar / maximizar-restaurar / cerrar, una región arrastrable y soporte siempre visible. Se muestra una pantalla splash no interactiva mientras la ventana principal carga.

### Tema oscuro / claro

Detección de tema consciente del sistema con toggle manual. La preferencia de tema persiste en `localStorage` (clave `encodex-theme`).

### Soporte RTL

Soporte de layout de derecha a izquierda para los locales árabe y hebreo (`ar-SA`, `ar-AE`, `ar-JO`, `he-IL`). La dirección cambia automáticamente al alternar idiomas mediante un plugin RTL de Emotion.

### Internacionalización

56 locales en 35 idiomas:

| Idioma      | Locales                                    |
| ----------- | ------------------------------------------ |
| Inglés      | `en-US`, `en-GB`, `en-IN`, `en-CA`, `en-AU`, `en-SG`, `en-ZA`, `en-NZ`, `en-IE` |
| Español     | `es-ES`, `es-MX`, `es-AR`, `es-CL`         |
| Francés     | `fr-FR`, `fr-CA`, `fr-BE`                  |
| Hindi       | `hi-IN`                                    |
| Alemán      | `de-DE`, `de-BE`                           |
| Italiano    | `it-IT`                                    |
| Neerlandés | `nl-NL`, `nl-BE`                           |
| Sueco       | `sv-SE`                                    |
| Noruego     | `nb-NO`                                    |
| Portugués   | `pt-BR`, `pt-PT`                           |
| Ucraniano   | `uk-UA`                                    |
| Ruso        | `ru-RU`                                    |
| Polaco      | `pl-PL`                                    |
| Tailandés   | `th-TH`                                    |
| Cingalés    | `si-LK`                                    |
| Mongol      | `mn-MN`                                    |
| Malayo      | `ms-MY`, `ms-SG`                           |
| Chino       | `zh-SG`, `zh-TW`                           |
| Japonés     | `ja-JP`                                    |
| Coreano     | `ko-KR`                                    |
| Indonesio   | `id-ID`                                    |
| Filipino    | `fil-PH`, `tl-PH`                          |
| Afrikáans   | `af-ZA`                                    |
| Hebreo      | `he-IL`                                    |
| Árabe       | `ar-SA`, `ar-AE`, `ar-JO`                  |
| Nepalí      | `ne-NP`                                    |
| Jemer       | `km-KH`                                    |
| Vietnamita  | `vi-VN`                                    |
| Lao         | `lo-LA`                                    |
| Maorí       | `mi-NZ`                                    |
| Islandés    | `is-IS`                                    |
| Groenlandés | `kl-GL`                                    |
| Irlandés    | `ga-IE`                                    |
| Finés       | `fi-FI`                                    |
| Danés       | `da-DK`                                    |

### Actualizaciones integradas

Gestor de actualizaciones personalizado que revisa GitHub Releases en busca de versiones nuevas, notifica al usuario de su disponibilidad, descarga el instalador específico de la plataforma (`.exe` / `.dmg` / `.AppImage`) dentro de la app con reporte de progreso en tiempo real y lanza el instalador al terminar. La comparación de versiones usa semver con eliminación de sufijos pre-release. El flujo de actualización está totalmente integrado en la página About con un botón "Buscar actualizaciones" y un diálogo global.

### Manejo de errores

Sistema de errores estructurado con códigos tipados (`ErrorCode`), mensajes localizados orientados al usuario, snackbar global de errores, banners de error en línea, notificaciones toast, React error boundaries anidados y un historial de errores dentro de la app (tope 50). Todos los errores se normalizan mediante `formatError()` y se propagan a través de IPC.

## Formatos multimedia soportados

### Códecs de vídeo (51)

| Grupo                      | Códecs                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Software (28)**          | H.264 (libx264, libx264rgb), H.265/HEVC (libx265, Kvazaar), VP8 (libvpx), VP9 (libvpx-vp9), AV1 (libaom-av1, SVT-AV1, rav1e), MPEG-4 (libxvid, mpeg4), MPEG-1, MPEG-2, Theora, JPEG 2000 (libopenjpeg), WebP (libwebp, libwebp_anim), ProRes (prores, prores_ks), Huffyuv, FFV1, Ut Video, MJPEG, PNG, TIFF, VC-2, AVS (libxavs, libxavs2) |
| **NVIDIA NVENC (3)**       | H.264 (h264_nvenc), H.265 (hevc_nvenc), AV1 (av1_nvenc)                                                                                                                                                                                                                                                                                    |
| **Intel QSV (5)**          | H.264, H.265, MPEG-2, VP9, AV1                                                                                                                                                                                                                                                                                                             |
| **AMD AMF (3)**            | H.264, H.265, AV1                                                                                                                                                                                                                                                                                                                          |
| **VAAPI (6)**              | H.264, H.265, MJPEG, VP8, VP9, AV1                                                                                                                                                                                                                                                                                                         |
| **Apple VideoToolbox (4)** | H.264, H.265, ProRes, VP9                                                                                                                                                                                                                                                                                                                  |
| **Media Foundation (2)**   | H.264, H.265                                                                                                                                                                                                                                                                                                                               |

### Códecs de audio (27)

| Grupo             | Códecs                                                    |
| ----------------- | --------------------------------------------------------- |
| **AAC / MPEG**    | AAC (native, FDK), MP3 (LAME, libshine), MP2 (libtwolame) |
| **Dolby**         | AC-3, E-AC-3, TrueHD, DTS, MLP                            |
| **Sin pérdida**   | FLAC, ALAC, WavPack                                       |
| **Streaming**     | Vorbis, Opus, Speex, AMR-WB                               |
| **PCM**           | s16le, s24le, f32le, s16be, u8, A-law, Mu-law             |
| **Windows Media** | WMA v1, WMA v2                                            |
| **Otros**         | ADPCM IMA (WAV)                                           |

### Formatos de píxel (56)

| Grupo               | Formatos                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| **YUV 8-bit**       | yuv420p, yuv422p, yuv444p, yuv410p, yuv411p, yuv440p, yuvj420p, yuvj422p, yuvj444p     |
| **YUV 10-bit**      | yuv420p10le, yuv422p10le, yuv444p10le                                                  |
| **YUV 12-bit**      | yuv420p12le, yuv422p12le, yuv444p12le                                                  |
| **YUV 16-bit**      | yuv420p16le, yuv444p16le                                                               |
| **YUV Semi-planar** | nv12, nv21, nv16, nv20le                                                               |
| **YUV con Alpha**   | yuva420p, yuva422p, yuva444p, yuva420p10le, yuva444p10le, yuva444p16le                 |
| **RGB Empaquetado** | rgb24, bgr24, rgb0, bgr0, rgba, bgra, argb, abgr, rgb48le, bgr48le, rgba64le, bgra64le |
| **RGB Planar**      | gbrp, gbrp10le, gbrp12le, gbrp16le, gbrap, gbrap10le, gbrap16le                        |
| **Monocromo**       | gray, gray10le, gray12le, gray16le, grayf32le, ya8, ya16le                             |
| **HDR**             | p010le, p016le, x2rgb10le                                                              |

### Extensiones de archivo de entrada

| Categoría | Extensiones                                                                                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------                                                                             |
| Vídeo    | `mp4`, `m4v`, `avi`, `mkv`, `mov`, `qt`, `flv`, `f4v`, `wmv`, `asf`, `webm`, `3gp`, `3g2`, `mpg`, `mpeg`, `mts`, `m2ts`, `ts`, `mxf`, `ogv`, `ogg`, `vob`, `divx`, `dv`, `rm`, `rmvb`, `h264`, `h265`, `hevc` |
| Audio    | `mp3`, `aac`, `wav`, `flac`, `ogg`, `opus`, `m4a`, `wma`, `alac`, `aiff`, `aif`, `au`, `caf`, `pcm`, `mid`, `midi`                                                                                            |
| Imagen   | `jpg`, `jpeg`, `png`, `webp`, `bmp`, `gif`, `tiff`, `tif`, `svg`, `ico`, `heic`, `heif`, `avif`, `ppm`, `pgm`, `pbm`, `xbm`                                                                                   |
| Subtítulos | `srt`, `ass`, `ssa`, `vtt`, `sub`, `idx`, `smi`                                                                                                                                                               |

## Utilidades de validación

| Función                      | Descripción                 | Formatos aceptados                                      |
| ---------------------------- | -------------------------- | ----------------------------------------------------- |
| `isValidTime(value)`         | Valida strings de tiempo     | `HH:MM:SS`, `HH:MM:SS.mmm`, segundos como número         |
| `isValidScale(value)`        | Valida resolución/escala | `WxH`, `W:H`, porcentaje `1%`–`999%`, número positivo |
| `isValidBitrate(value)`      | Valida strings de bitrate  | p. ej. `128k`, `1M`, `2000K`                            |
| `isInRange(value, min, max)` | Comprueba rango numérico       | Cualquier número finito                                     |

## Constantes de transcoder

| Constante                                         | Valor                                                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRANSCODER_TYPES`                                | `['FFMPEG', 'FFTOOL', 'BMF']`                                                                                                                                     |
| `TRANSCODER_LABELS`                               | `{ FFMPEG: 'FFmpeg (API)', FFTOOL: 'FFmpeg (CLI)', BMF: 'BMF Framework' }`                                                                                        |
| `FFMPEG_FLAGS`                                    | `-c`, `-vcodec`, `-acodec`, `-b:v`, `-b:a`, `-qscale:v`, `-vf`, `-pix_fmt`, `-color_range`, `-ss`, `-to`, `-t`, `-y`, `-i`, `-an`, `-sn`, `-dn`, `-re`, `-copyts` |
| `FFPROBE_FLAGS`                                   | `-v quiet -print_format json -show_format -show_streams`                                                                                                          |
| `TRANSCODER_COMMANDS`                             | `bmf_ffmpeg`, `bmf_ffprobe`, `ffmpeg`, `ffprobe`                                                                                                                  |
| `TRANSCODER_DEFAULTS.PROGRESS_INTERVAL_MS`        | `500`                                                                                                                                                             |
| `TRANSCODER_DEFAULTS.PLAYER_DEFAULT_WIDTH/HEIGHT` | `640` / `360`                                                                                                                                                     |
| `TRANSCODER_DEFAULTS.PLAYER_FPS_CAP`              | `30`                                                                                                                                                              |
| `TRANSCODER_DEFAULTS.FFPROBE_TIMEOUT_MS`          | `30000`                                                                                                                                                           |
| `CONVERSION_DEFAULTS.VIDEO_CODEC`                 | `libx264`                                                                                                                                                         |
| `CONVERSION_DEFAULTS.AUDIO_CODEC`                 | `aac`                                                                                                                                                             |
| `CONVERSION_DEFAULTS.QSCALE`                      | `23`                                                                                                                                                              |
| `CONVERSION_DEFAULTS.PIXEL_FORMAT`                | `yuv420p`                                                                                                                                                         |
| `CONVERSION_DEFAULTS.SCALE`                       | `1920x1080`                                                                                                                                                       |
| `CONVERSION_DEFAULTS.VIDEO_BITRATE`               | `2000k`                                                                                                                                                           |
| `CONVERSION_DEFAULTS.AUDIO_BITRATE`               | `192k`                                                                                                                                                            |
| `QSCALE_RANGE.MIN/MAX`                            | `1` / `31`                                                                                                                                                        |
