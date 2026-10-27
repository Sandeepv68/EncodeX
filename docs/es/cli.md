# Uso de la CLI

Compila primero y luego invoca la CLI compilada mediante el comando `encodex` (el lanzador `bin/encodex.js` envuelve el binario de Electron). El modo CLI se activa explícitamente con `--cli`, `-h`/`--help` o cualquier nombre de subcomando o alias, o automáticamente cuando se pasan al menos dos argumentos posicionales que no sean flags (entrada + salida):

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

Una vez activo el modo CLI, el uso plano heredado (`encodex in.mp4 out.mp4`, `encodex --info in.mp4`) se redirige automáticamente al subcomando correspondiente. `encodex --info in.mp4` por sí solo tiene un argumento posicional y abre la GUI, a menos que también se pase `--cli`. `remux` y `demux` solo se alcanzan como subcomandos explícitos (o con sus alias `rmx`/`split`); una invocación con dos posicionales siempre es un `convert`.

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
| `remux`            | Copia los flujos a otro contenedor sin recodificar. Alias: `rmx` |
| `demux`            | Extrae cada flujo de un archivo a un archivo separado. Alias: `split` |

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
| `--hwaccel`                 | Activa la aceleración por hardware                                   |
| `--hwaccel-mode <auto\|encode>` | Modo de aceleración por hardware (predeterminado: `auto`)             |
| `--filters <chain>`         | Cadena de filtros de vídeo (separada por comas)                           |
| `--preset <preset_id>`      | Preajuste de filtro de vídeo curado (repetible)                       |
| `--info`                    | Imprime la información multimedia de la entrada y sale (requiere modo CLI, p. ej. `--cli`) |

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

## Opciones de remux

| Opción                          | Descripción                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`           | Archivo de salida (por defecto, la ruta de entrada con la extensión de destino) |
| `-f, --format <container>`      | Contenedor de destino (p. ej. `mkv`, `mp4`, `mov`)                    |
| `--map <spec>`                  | Flujo a copiar como `0:<type>:<ordinal>` (repetible; por defecto: todos los flujos) |
| `--add-subtitle <file[::codec]>`| Incrusta un archivo de subtítulos externo (repetible); códec opcional por archivo |
| `--add-audio <file>`            | Incrusta un archivo de audio externo (repetible)                      |
| `--thumbnail <image>`           | Incrusta una carátula (adjunto en MKV/WebM, disposición en MP4/MOV)         |
| `--chapters <file>`             | Importa capítulos desde un archivo FFMETADATA                        |
| `--no-chapters`                 | Descarta los capítulos de origen en lugar de copiarlos               |
| `--subtitle-codec <codec>`      | Códec de subtítulos para los añadidos (por defecto: la primera opción del contenedor) |
| `--no-subtitles`                | Descarta los flujos de subtítulos de origen                          |
| `--audio-sync <seconds>`        | Desplaza el audio del archivo principal (positivo = más tarde)              |
| `--set-sync <seconds>`          | Desplaza la entrada de subtítulos/audio añadida anterior (repetible)    |
| `--filters <chain>`             | Cadena de filtros de vídeo (repetible); los filtros fuerzan una recodificación |

## Opciones de demux

| Opción                          | Descripción                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| `--output-dir <dir>`            | Directorio para los flujos extraídos (se crea si no existe)            |
| `--video`                       | Extrae solo los flujos de vídeo                                      |
| `--audio`                       | Extrae solo los flujos de audio                                      |
| `--subtitles`                   | Extrae solo los flujos de subtítulos                                 |
| `--all`                         | Extrae todos los tipos de flujo (predeterminado)                            |
| `--video-container <ext>`       | Recodifica el vídeo en este contenedor (p. ej. `mp4`, `mkv`)        |
| `--audio-codec <codec>`         | Recodifica el audio con este codificador (p. ej. `mp3`, `flac`, `aac`)  |
| `--subtitle-format <format>`    | Convierte subtítulos de texto a este formato (`srt`, `ass`, `copy`)   |
| `--video-filters <chain>`       | Cadena de filtros para el flujo de vídeo recodificado (repetible)      |

## Opciones de batch

| Opción                      | Descripción                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--concurrency <n>`         | Máximo de conversiones en paralelo (predeterminado: `4`, limitado 1–4)           |
| `--output-dir <dir>`        | Directorio de salida para los archivos convertidos                           |
| `--suffix <s>`              | Sufijo añadido a los nombres de salida derivados (predeterminado: `_encodex_converted`) |

Batch también acepta todas las opciones de codificación de convert (`-v/--video-codec`, `-a/--audio-codec`, `--bitrate-video`, `--bitrate-audio`, `-q/--qscale`, `--pix-fmt`, `-s/--scale`, `--copy`, `--no-audio`, `--no-video`, `--filters`, `--preset`) y las aplica a cada trabajo.

## Modo servidor MCP {#mcp-server-mode}

EncodeX puede ejecutarse como un servidor [Model Context Protocol](https://modelcontextprotocol.io) sin interfaz gráfica para que los hosts MCP (Claude Desktop, Claude Code, VS Code, Cursor, agentes personalizados) puedan manejar conversiones. Es un **modo**, no un subcomando: pasa `--mcp` y la app omite las rutas de la GUI y la CLI y habla JSON-RPC mediante stdio.

```bash
# Packaged app
encodex --mcp

# Source checkout (compiled Node entry point — run npm run build:main first)
node dist/mcp/index.js

# Raw Electron form
npx electron . --mcp
```

stdout está reservado para los mensajes MCP JSON-RPC; toda la salida de estado y logs se redirige a stderr, y el proceso sigue vivo hasta que stdin se cierra. El servidor stdio expone 36 herramientas visibles para el modelo (37 registros, incluida la herramienta `commit_operation`, solo para la app) con 3 recursos y 4 prompts; la superficie HTTP integrada añade 6 herramientas de GUI para un total de 42 herramientas visibles para el modelo (43 registros). Consulta la [referencia de funciones](./features-reference.md#mcp-server) para ver el catálogo completo.

| Opción   | Descripción                                                           |
| -------- | --------------------------------------------------------------------- |
| `--mcp`  | Ejecutar como servidor MCP por stdio (sin GUI, sin subcomando CLI, sin `app.exit`) |

Una segunda superficie opcional es el **servidor HTTP integrado** dentro de la GUI en ejecución (`http://127.0.0.1:8765/mcp`), que añade herramientas de cola en vivo, vista previa, línea de tiempo, sistema y actualizaciones sobre el mismo núcleo. Actívalo en **Ajustes → Servidor MCP**; consulta la [referencia de funciones](./features-reference.md#mcp-server) para conocer el modelo de seguridad.

## Códigos de salida

| Código | Constante                     | Significado                                        |
| ---- | ---------------------------- | ---------------------------------------------- |
| `0`  | `EXIT_CODES.SUCCESS`         | Éxito limpio                                  |
| `1`  | `EXIT_CODES.ERROR`           | Error genérico                                  |
| `2`  | `EXIT_CODES.USAGE`           | Argumentos inválidos/incompletos                   |
| `3`  | `EXIT_CODES.CANCELLED`       | Operación cancelada por el usuario                |
| `4`  | `EXIT_CODES.NOT_FOUND`       | No se encontró el archivo de entrada, FFmpeg o FFprobe       |
| `5`  | `EXIT_CODES.TIMEOUT`         | La conversión excedió `--timeout`                |
