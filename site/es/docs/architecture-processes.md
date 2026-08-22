# Procesos, sistema de compilación y arranque

## Modelo de procesos

### Proceso principal (`src/main/`)

Entorno Node.js. Posee el ciclo de vida de la aplicación y todas las capacidades privilegiadas:

- Crea las ventanas `BrowserWindow` de splash y principal, y registra los manejadores IPC (`index.ts`).
- Aloja el punto de entrada de la CLI (`cli/`).
- Resuelve la ruta de los binarios FFmpeg/FFprobe y sondea las capacidades de los codificadores (`capabilities.ts`, `process-utils.ts`).
- Implementa los núcleos transcoder (`transcoders/`).
- Ejecuta la cola por lotes con concurrencia limitada (1-4 trabajos en paralelo) (`queue/job-queue.ts`).
- Decodifica fotogramas de vídeo y audio PCM para el reproductor integrado (`player/frame-decoder.ts`).
- Extrae formas de onda y montajes de miniaturas (`timeline/timeline-media.ts`).
- Lee datos EXIF, histogramas, dimensiones de imagen y vistas previas (`image-*.ts`, `video-preview.ts`).
- Puentea la salida `console` del renderer hacia el sistema de logs (`patchConsole` en `index.ts`).

### Script preload (`src/preload/index.ts`)

Se ejecuta en un contexto aislado. Usa `contextBridge.exposeInMainWorld('electronAPI', api)` para exponer al renderer una API reducida y tipada. Cada método es un envoltorio fino sobre `ipcRenderer.invoke` (petición/respuesta) o `ipcRenderer.send` (disparar y olvidar), y cada suscripción a eventos devuelve una función de limpieza que elimina su listener. Nada más de Electron o Node se filtra al renderer.

### Proceso renderer (`src/renderer/`)

Entorno de navegador servido por Vite en desarrollo y cargado desde `dist/renderer/index.html` en producción. React puro — sin APIs de Node. Interactúa con el proceso principal únicamente a través de `window.electronAPI` (tipado en `electron-api.d.ts`).

### Capa compartida (`src/shared/`)

TypeScript puro, importado por los tres procesos. Contiene el registro de canales IPC, tipos de dominio, sistema de errores, logger, constantes, listas de códecs, helpers de validación y plantillas de mensajes de log. Como `package.json` no usa límites de paquete separados, este directorio se referencia mediante imports relativos desde la raíz de cada proceso.

## Sistema de compilación

Tres proyectos TypeScript más Vite producen tres carpetas de salida:

| Script                   | Compila                    | Salida            |
| ------------------------ | --------------------------- | ----------------- |
| `build:renderer`         | `vite build`                | `dist/renderer/`  |
| `build:main`             | `tsc -p tsconfig.main.json` | `dist/main/`      |
| `build:preload`          | `tsc -p tsconfig.preload.json` | `dist/preload/` |

`npm run build` ejecuta los tres en secuencia. El proceso principal carga el preload desde `dist/preload/index.js` y el renderer desde `dist/renderer/index.html` (producción) o el servidor de desarrollo de Vite (desarrollo, flag `--dev` o `NODE_ENV=development`).

Electron-builder empaqueta la app para Windows (NSIS), macOS (DMG) y Linux (AppImage), incluyendo `ffmpeg-static` y `ffprobe-static` como `extraResources` para que los binarios viajen con la app. El workflow de release de CI descarga los binarios precompilados para cada plataforma/arquitectura destino mediante `scripts/fetch-media-binaries.mjs`.

### Resolución de binarios

Toda la resolución de binarios FFmpeg/FFprobe está centralizada en `src/main/media-binaries.ts` (`getFfmpegPath` / `getFfprobePath`), consumida por todos los transcoders, el decodificador de fotogramas, timeline media, la vista previa de imagen/vídeo y la CLI. La cadena de respaldo es:

1. **App empaquetada**: los binarios incluidos como `extraResources` bajo el directorio `resources` de Electron (`resources/ffmpeg-static/...` y `resources/ffprobe-static/...`, este último usando la subruta específica de plataforma/arquitectura).
2. **Sin empaquetar (dev/CLI/pruebas)**: los binarios instalados en `node_modules/ffmpeg-static` y `node_modules/ffprobe-static` (resueltos vía la clave `import` del mapa `exports` de cada paquete, así también funciona desde ESM).
3. El comando del sistema (`ffmpeg` / `ffprobe`) desde `PATH`.

## Secuencia de arranque

1. Se ejecuta `main/index.ts`. Inspecciona `process.argv` en `isCliMode()`.
2. **Modo CLI** (`--cli`/`--help` explícitos, o >=2 argumentos posicionales): no registra ventanas. En `app.whenReady()`, llama a `runCli()` y sale con códigos `SUCCESS` o `ERROR`.
3. **Modo GUI**: habilita el switch `autoplay-policy`, crea una ventana splash no interactiva (mostrada de inmediato) y luego la ventana principal sin marco (`show: false`).
4. `registerIpcHandlers(mainWindow)` conecta todos los módulos IPC; `patchConsole` reemplaza `console.*` para reenviar los logs del proceso principal al renderer por el canal `log-message`.
5. La ventana principal se muestra en `ready-to-show`, momento en el que se cierra el splash.
6. En producción el renderer se carga desde `dist/renderer/index.html`; en desarrollo desde `http://localhost:5173` con DevTools abiertas.

## Modo CLI

`src/main/cli/cli.ts` usa **commander** con subcomandos. Cuando se ejecuta `runCli()`:

1. Un shim heredado mapea el uso plano (`encodex in.mp4 out.mp4` -> `convert`, `encodex --info in.mp4` -> `info`) al subcomando correspondiente.
2. Cada subcomando analiza sus propias opciones más las globales compartidas (`--transcoder`, `--theme`, `--verbose`, `--quiet`, `--no-color`, `--json`, `--timeout`).
3. `info`/`capabilities` imprimen tablas legibles por defecto y JSON con `--json`.
4. `convert`/`compress`/`extract-audio`/`batch` construyen un objeto `ConversionOptions` y llaman a `transcoder.convert(...)` (batch maneja un `JobQueue` en memoria con un `MultiBar`).
5. El progreso va a `stdout` (con un timeout watchdog), las líneas de estado/éxito respetan el enrutamiento `--json`/`--quiet`/`--verbose`, y el proceso sale vía `mapCliErrorToExitCode` (usage=2, cancelled=3, not-found=4, timeout=5, success=0).

La CLI reutiliza exactamente el mismo pipeline de transcoders que la GUI — no hay una ruta de codificación separada que mantener.

## Capa de código compartido

La decisión arquitectónica más importante es que todos los contratos entre procesos viven en `src/shared/`:

- **`types.ts`** — `ConversionOptions`, `MediaInfo`, `MediaStreamInfo`, `QueueJob`, `ConversionProgress`, `PlayerFrame`, `PlayerAudioChunk`, `WaveformData`, `ThumbnailStrip`, `EncoderCapabilities`, `LogEntry`, `FileItem`, `ConversionOperation`, `UpdateInfo`, `UpdateAsset`, `UpdateProgress`.
- **`ipc-channels.ts`** — el objeto constante `IPC`, única fuente de verdad para cada string de canal. Main, preload y renderer importan todos de él, así el nombre de un canal nunca puede divergir entre procesos.
- **`errors.ts`** — el sistema de errores tipado (ver [Manejo de errores](/es/docs/architecture-renderer#error-handling)).
- **`constants.ts` / `app-constants.ts`** — límites numéricos y valores de layout de la UI (tamaños de ventana, buckets de forma de onda, dimensiones de miniaturas, tope del historial de errores, etc.).
- **`transcoder-constants.ts` / `hwaccel-settings.ts`** — flags de FFmpeg, valores por defecto, patrones de progreso y ajustes de aceleración por hardware.
- **`media-options.ts` / `codec-containers.ts` / `codec-classification.ts`** — las listas curadas de 51 códecs de vídeo, 27 códecs de audio, 56 formatos de píxel, reglas de compatibilidad de contenedores y helpers de familias de códecs.
- **`validation.ts`** — funciones puras para validación de tiempo/escala/bitrate/rango, usadas tanto por los formularios del renderer como por la CLI.
- **`logger.ts` / `log-constants.ts`** — un logger con marcas de tiempo más ~406 plantillas compartidas de mensajes de log para que los logs sean consistentes entre procesos.
