# Arquitectura

EncodeX es una herramienta multiplataforma de conversión multimedia construida sobre FFmpeg, React, TypeScript y Electron. Está pensada para desarrolladores que quieran entender cómo encajan las piezas antes de contribuir.

<p align="center"><img src="/images/architecture.png" alt="EncodeX architecture" width="1024" height="1024" loading="lazy" /></p>

## Principios de diseño

El renderer nunca lanza procesos ni toca el sistema de archivos directamente. Todas las operaciones privilegiadas (diálogos de archivos, ejecución de FFmpeg, sondeo, control de ventanas) viven en el proceso principal y se alcanzan a través de IPC.

- **Separación en tres procesos** — principal (main), preload y renderer, siguiendo el modelo de seguridad de Electron (`contextIsolation: true`, `nodeIntegration: false`).
- **Una única abstracción sobre los backends de medios** — la interfaz `ITranscoder` oculta si la conversión se realiza mediante `fluent-ffmpeg`, un proceso hijo con la CLI de FFmpeg o el framework BMF.
- **IPC como contrato tipado** — cada canal es una constante en `src/shared/ipc-channels.ts`, y el renderer solo habla con el proceso principal a través del puente `window.electronAPI` expuesto por el script preload.
- **Tipos y constantes compartidos** — `src/shared/` lo importan los tres procesos, así las interfaces quedan sincronizadas por construcción.
- **Mejora progresiva de la UI** — las páginas se dividen con `React.lazy`, el estado vive en stores de Zustand y los trabajos largos transmiten su progreso mediante eventos IPC.

## Análisis detallados

La arquitectura completa está dividida en documentos enfocados:

| Documento | Temas |
|----------|--------|
| [Procesos, sistema de compilación y arranque](/es/docs/architecture-processes) | Modelo de procesos (main/preload/renderer/shared), sistema de compilación, resolución de binarios, secuencia de arranque, modo CLI, capa de código compartido |
| [Abstracción de transcoders y conversión](/es/docs/architecture-transcoders) | Interfaz `ITranscoder`, FfmpegCore / FFToolCore / BmfCore, construcción compartida de flags, aceleración por hardware, sondeo de medios, flujo de conversión |
| [Renderer, estado y subsistemas](/es/docs/architecture-renderer) | Árbol de renderizado, páginas, hooks, stores de Zustand, cola por lotes, reproductor de vídeo, medios de la línea de tiempo, procesamiento de imágenes, manejo de errores, logging, i18n, temas, referencia de flujo de datos |

## Documentación adicional

| Documento | Temas |
|----------|--------|
| [Referencia de características](/es/docs/features-reference) | Características, formatos multimedia soportados, tablas de códecs, utilidades de validación |
| [Uso de la CLI](/es/docs/cli) | Uso de la CLI, subcomandos, todas las tablas de opciones |
| [Canales IPC](/es/docs/ipc) | Canales IPC (request/send-only/events), puente electronAPI |
| [Pruebas](/es/docs/testing) | Suite de pruebas (123 archivos, 1603 pruebas), configuración de pruebas, especificaciones E2E |
| [Estructura del proyecto](/es/docs/project-structure) | Árbol completo de directorios con anotaciones |
| [Gestor de actualizaciones](/es/docs/update-manager) | Implementación del gestor de actualizaciones integrado |

## Repositorio

La fuente completa de verdad vive en la [carpeta `docs/` del repositorio](https://github.com/Sandeepv68/EncodeX/tree/main/docs). Para una visión general del proyecto, pasos de instalación y guía de contribución, consulta el [README en GitHub](https://github.com/Sandeepv68/EncodeX).
