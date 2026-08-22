# Uso de la CLI

Compila primero y luego invoca la CLI compilada mediante el comando `encodex` (el lanzador `bin/encodex.js` envuelve el binario de Electron). El modo CLI se activa automáticamente cuando se dan dos argumentos posicionales (entrada + salida), o explícitamente con `--cli`:

```bash
# Convert a file (subcommand form)
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Convert a file (legacy flat form — still works)
encodex input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Show media info as a human table
encodex info input.mp4

# Show media info as JSON
encodex info input.mp4 --json

# List transcoder capabilities
encodex capabilities
encodex capabilities --json

# Lossless copy to different container
encodex convert input.mkv output.mp4 --copy

# Cut a segment
encodex convert input.mp4 output.mp4 --start-time 00:01:00 --end-time 00:02:30

# Compress an image
encodex compress photo.png -f jpg -q 30

# Extract audio (mp3 by default)
encodex extract-audio input.mp4

# Batch-convert several files / globs
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted

# Use a specific transcoder core
encodex convert input.mp4 output.mp4 --transcoder FFTOOL
```

El uso plano heredado (`encodex in.mp4 out.mp4`, `encodex --info in.mp4`) se redirige al subcomando correspondiente automáticamente.

Para que `encodex` esté disponible globalmente, ejecuta `npm link` desde la raíz del proyecto (o `npm install -g .`). La forma cruda `npx electron . --cli ...` sigue funcionando como alternativa.

## Subcomandos

| Subcomando         | Descripción                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `convert`          | Convierte medios (predeterminado cuando ningún subcomando coincide). Alias: `c`    |
| `info`             | Muestra información del medio (tabla legible, o `--json` para salida de máquina)     |
| `capabilities`     | Lista las capacidades de transcoder disponibles (tabla o `--json`)        |
| `compress`         | Comprime una imagen                                                 |
| `extract-audio`    | Extrae el stream de audio (códec predeterminado `libmp3lame`). Alias: `audio` |
| `batch`            | Convierte múltiples entradas (archivos, globs o directorios) con una cola |

## Opciones globales

Las opciones globales pueden ir antes o después del nombre del subcomando.

| Opción                      | Descripción                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--transcoder <type>`       | Núcleo transcoder: `FFMPEG`, `FFTOOL`, `BMF` (predeterminado: `FFMPEG`) |
| `--theme <id>`              | Tema de color del logo: `light`, `ocean`, `sunset`, `forest`, `lavender`, `rose`, `slate`, `dark` (predeterminado: `light`) |
| `--verbose`                 | Logging detallado (enruta el estado a stderr)                      |
| `--quiet`                   | Suprime la salida de estado                                         |
| `--no-color`                | Desactiva los colores ANSI                                            |
| `--json`                    | Salida JSON legible por máquina (estado enrutado a stderr)         |
| `--timeout <seconds>`       | Timeout de conversión en segundos (predeterminado: `300`)                 |

## Opciones de convert

| Opción                      | Descripción                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-v, --video-codec <codec>` | Códec de vídeo (p. ej. `libx264`, `libx265`, `copy`)                |
| `-a, --audio-codec <codec>` | Códec de audio (p. ej. `aac`, `libmp3lame`, `copy`)                 |
| `-q, --qscale <qscale>`     | Escala de calidad (1–31)                                           |
| `--bitrate-video <bitrate>` | Bitrate de vídeo (p. ej. `1000k`)                                   |
| `--bitrate-audio <bitrate>` | Bitrate de audio (p. ej. `192k`)                                    |
| `--pix-fmt <format>`        | Formato de píxel (p. ej. `yuv420p`, `yuv444p`)                       |
| `-s, --scale <WxH>`         | Resolución de salida (p. ej. `1280x720` o `50%`)                   |
| `--start-time <time>`       | Hora de inicio (`HH:MM:SS` o segundos)                             |
| `--end-time <time>`         | Hora de fin                                                       |
| `--duration <time>`         | Duración                                                       |
| `--copy`                    | Copia de stream sin pérdida                                           |
| `--no-audio`                | Excluye el stream de audio de la salida                       |
| `--no-video`                | Excluye el stream de vídeo de la salida (solo audio)          |
| `--hwaccel / --no-hwaccel`  | Alterna la aceleración por hardware                                   |
| `--hwaccel-mode <auto\|encode>` | Modo de aceleración por hardware (predeterminado: `auto`)             |
| `--info`                    | Imprime la información multimedia de la entrada y sale                        |

## Opciones de compress

| Opción                      | Descripción                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`       | Archivo de salida                                                    |
| `-f, --format <format>`     | Formato de salida (por defecto según la extensión de salida)                 |
| `-q, --quality <qscale>`    | Escala de calidad 1–31                                             |
| `-s, --scale <WxH>`         | Resolución de salida                                              |

## Opciones de extract-audio

| Opción                      | Descripción                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`       | Archivo de salida                                                    |
| `-a, --audio-codec <codec>` | Códec de audio (predeterminado: `libmp3lame`)                            |
| `--bitrate-audio <bitrate>` | Bitrate de audio (p. ej. `192k`)                                    |

## Opciones de batch

| Opción                      | Descripción                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--concurrency <n>`         | Máximo de conversiones en paralelo (predeterminado: `4`, limitado 1–4)           |
| `--output-dir <dir>`        | Directorio de salida para los archivos convertidos                           |
| `--suffix <s>`              | Sufijo añadido a los nombres de salida derivados (predeterminado: `_encodex_converted`) |

Batch también acepta todas las opciones de codificación de convert (`-v/--video-codec`, `-a/--audio-codec`, `--bitrate-video`, `--bitrate-audio`, `-q/--qscale`, `--pix-fmt`, `-s/--scale`, `--copy`, `--no-audio`, `--no-video`) y las aplica a cada trabajo.

## Códigos de salida

| Código | Constante                     | Significado                                        |
| ---- | ---------------------------- | ---------------------------------------------- |
| `0`  | `EXIT_CODES.SUCCESS`         | Éxito limpio                                  |
| `1`  | `EXIT_CODES.ERROR`           | Error genérico                                  |
| `2`  | `EXIT_CODES.USAGE`           | Argumentos inválidos/incompletos                   |
| `3`  | `EXIT_CODES.CANCELLED`       | Operación cancelada por el usuario                |
| `4`  | `EXIT_CODES.NOT_FOUND`       | No se encontró el archivo de entrada, FFmpeg o FFprobe       |
| `5`  | `EXIT_CODES.TIMEOUT`         | La conversión excedió `--timeout`                |
