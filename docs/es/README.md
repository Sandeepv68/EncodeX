<div align="center">
  <img src="../../assets/banner.png" alt="Logotipo de EncodeX" width="900" />
  <h3>Una herramienta multiplataforma de conversión multimedia construida con FFmpeg, React, TypeScript y Electron.</h3>
</div>

<div align="center">

[![Ask DeepWiki](https://img.shields.io/badge/Ask_DeepWiki-10B981?style=for-the-badge)](https://deepwiki.com/Sandeepv68/EncodeX)
![CI](https://img.shields.io/github/actions/workflow/status/Sandeepv68/EncodeX/ci.yml?style=for-the-badge)
![License](https://img.shields.io/github/license/Sandeepv68/EncodeX?style=for-the-badge)
![Release](https://img.shields.io/github/v/release/Sandeepv68/EncodeX?style=for-the-badge)
![Downloads](https://img.shields.io/github/downloads/Sandeepv68/EncodeX/total?style=for-the-badge&logo=github&logoColor=white)
![Stars](https://img.shields.io/github/stars/Sandeepv68/EncodeX?style=for-the-badge)
![Forks](https://img.shields.io/github/forks/Sandeepv68/EncodeX?style=for-the-badge)
![Watchers](https://img.shields.io/github/watchers/Sandeepv68/EncodeX?style=for-the-badge)
![Issues](https://img.shields.io/github/issues/Sandeepv68/EncodeX?style=for-the-badge)
![Pull Requests](https://img.shields.io/github/issues-pr/Sandeepv68/EncodeX?style=for-the-badge)
![Last Commit](https://img.shields.io/github/last-commit/Sandeepv68/EncodeX?style=for-the-badge)
![Contributors](https://img.shields.io/github/contributors/Sandeepv68/EncodeX?style=for-the-badge)
![Repo Size](https://img.shields.io/github/repo-size/Sandeepv68/EncodeX?style=for-the-badge)
![Languages](https://img.shields.io/github/languages/count/Sandeepv68/EncodeX?style=for-the-badge)
![Top Language](https://img.shields.io/github/languages/top/Sandeepv68/EncodeX?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![MUI](https://img.shields.io/badge/MUI-007FFF?style=for-the-badge&logo=mui&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js%2022-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)

</div>

<div align="center">

[English](../../README.md) | [Deutsch](../de/README.md) | [Español](./README.md) | [Français](../fr/README.md) | [हिन्दी](../hi/README.md) | [Português](../pt/README.md) | [简体中文](../zh/README.md)

</div>

## 👋 Introducción

EncodeX es una herramienta multiplataforma de conversión multimedia que lleva todo el poder de FFmpeg a una interfaz de escritorio moderna e intuitiva. Construida con Electron, React y TypeScript, te permite convertir medios entre formatos, extraer audio, cortar vídeos y comprimir imágenes: todo a través de una interfaz limpia y receptiva con cola por lotes, aceleración por hardware, modo CLI y una internacionalización completa.

## ✨ Características

- **🔄 Conversión multimedia** — 51 códecs de vídeo, 27 códecs de audio, 56 formatos de píxel con controles de códec/bitrate/escala/calidad
- **⚡ Aceleración por hardware** — NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox, Media Foundation
- **✂️ Corte de vídeo** — Recorte con precisión de fotograma gracias a un reproductor integrado (conductos rawvideo + PCM, Canvas + Web Audio) y una línea de tiempo ampliable (onda de forma + montaje de miniaturas)
- **📋 Cola por lotes** — Procesamiento en paralelo (hasta 4 tareas simultáneas) con progreso en tiempo real, errores por tarea, pausa/reanudación, reordenamiento por arrastrar y soltar, edición de opciones de tarea, filtros por estado, exportación/importación JSON y acciones de energía al terminar (apagado/suspensión/hibernación)
- **🖼️ Compresión de imágenes** — JPEG/PNG/WebP/BMP/GIF/TIFF con calidad/escala, visor EXIF, histogramas RGB/luma
- **🎵 Extracción de audio** — Cualquiera de los 27 códecs de audio a partir de cualquier archivo de vídeo
- **ℹ️ Información multimedia** — Sondeo completo por flujo: códec, perfil, resolución, metadatos de color, frecuencia de fotogramas, etc.
- **⌨️ Modo CLI** — Scripting sin interfaz gráfica con subcomandos (`convert`, `info`, `capabilities`, `compress`, `extract-audio`, `batch`)
- **⚙️ 3 núcleos de transcodificación** — API de FFmpeg (fluent-ffmpeg), CLI de FFmpeg (child_process), plataforma BMF
- **🌍 56 configuraciones regionales** — 35 idiomas con soporte RTL (árabe, hebreo)
- **⌨️ Atajos de teclado** — Más de 60 atajos en todas las páginas con un diálogo de ayuda integrado (`Ctrl+/`)
- **🔔 Blips de actividad** — Indicadores de navegación en vivo con ventanas emergentes al pasar el cursor que muestran el progreso de cada tarea de un vistazo
- **🛡️ Confirmación de cierre** — Advierte antes de cerrar la ventana mientras haya tareas en ejecución
- **🎉 Huevos de pascua** — Logotipos temáticos de la aplicación en fechas especiales
- **🔄 Actualizaciones integradas** — Comprueba las versiones de GitHub Releases, descarga el instalador de la plataforma, progreso en tiempo real
- **🛡️ Manejo de errores** — 16 códigos de error tipados, snackbar global, banners integrados, limites de error de React
- **🌗 Tema oscuro/claro** — Consciente del sistema con conmutador manual y preferencias persistentes

Consulta [Referencia de características](./features-reference.md) para conocer el desglose completo de las características, los formatos compatibles y las listas de códecs.

## 📸 Capturas de pantalla

<div align="center">
  <img src="../../site/public/images/home_dashboard.webp" alt="Panel principal" width="800" />
  <p><strong>🏠 Panel principal</strong></p>
</div>

<table>
  <tr>
    <td align="center" width="50%">
      <img src="../../site/public/images/convert.webp" alt="Conversión multimedia" /><br />
      <strong>🔄 Conversión multimedia</strong>
    </td>
    <td align="center" width="50%">
      <img src="../../site/public/images/extract_audio.webp" alt="Extracción de audio" /><br />
      <strong>🎵 Extracción de audio</strong>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="../../site/public/images/cut_video.webp" alt="Corte de vídeo" /><br />
      <strong>✂️ Corte de vídeo</strong>
    </td>
    <td align="center">
      <img src="../../site/public/images/image_compress.webp" alt="Compresión de imágenes" /><br />
      <strong>🖼️ Compresión de imágenes</strong>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="../../site/public/images/batch_process.webp" alt="Cola por lotes" /><br />
      <strong>📋 Cola por lotes</strong>
    </td>
    <td align="center">
      <img src="../../site/public/images/media_info.webp" alt="Información multimedia" /><br />
      <strong>ℹ️ Información multimedia</strong>
    </td>
  </tr>
</table>

## 📌 Requisitos previos

- [Node.js](https://nodejs.org/) 22+
- [FFmpeg](https://ffmpeg.org/) — incluido a través de `ffmpeg-static`; recurre al `ffmpeg` del sistema si el binario incluido no está disponible

## 📥 Descargas

Los instaladores precompilados están disponibles en la página de [Releases](https://github.com/Sandeepv68/EncodeX/releases).

### macOS

> EncodeX no está firmado con código (sin cuenta de desarrollador de Apple). Gatekeeper de macOS bloqueará la aplicación en la primera apertura.

**Opción 1 — Clic derecho para abrir:**

1. Haz clic derecho (o Control-clic) en la aplicación EncodeX y selecciona **Abrir**
2. Haz clic en **Abrir** en el diálogo de confirmación

**Opción 2 — Elimina la cuarentena mediante Terminal:**

```bash
xattr -cr /Applications/EncodeX.app
```

### Windows / Linux

Descarga el instalador `.exe` (Windows) o `.AppImage` (Linux) desde la página de [Releases](https://github.com/Sandeepv68/EncodeX/releases) y ejecútalo.

## 🚀 Instalación (desde el código fuente)

```bash
npm install
```

## 🧑‍💻 Desarrollo

```bash
# Inicia el servidor de desarrollo de Vite + observador de tsc (sin ventana de Electron)
npm run dev

# Entorno de desarrollo completo con ventana de Electron
npm run electron:dev

# Inicio rápido (compila y luego ejecuta)
npm run dev:start
```

`npm run dev` inicia dos procesos de forma concurrente:

1. **Vite** — sirve el renderizador de React en `http://localhost:5173` con HMR
2. **tsc** — observa y compila el TypeScript del proceso principal en `dist/main/`

`npm run electron:dev` espera a que Vite esté listo, compila tanto el proceso principal como el preload y luego inicia Electron con la bandera `--dev` apuntando a la URL del servidor de desarrollo de Vite. DevTools se abre automáticamente.

## 🔨 Compilación

```bash
# Compilación de producción (renderizador + principal + preload)
npm run build

# Empagueta para la plataforma actual (sin instalador)
npm run pack

# Crea el instalador distribuible
npm run dist
```

| Script                   | Descripción                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `npm run dev:renderer`   | Solo el servidor de desarrollo de Vite                       |
| `npm run dev:main`       | `tsc -p tsconfig.main.json --watch`                          |
| `npm run build:renderer` | Compilación de producción de Vite: salida en `dist/renderer/` |
| `npm run build:main`     | `tsc -p tsconfig.main.json` — salida en `dist/main/`         |
| `npm run build:preload`  | `tsc -p tsconfig.preload.json` — salida en `dist/preload/`   |
| `npm run build`          | Los tres en secuencia                                        |
| `npm run start`          | Ejecuta la aplicación compilada desde `dist/` mediante `electron .` |
| `npm run electron:dev`   | Entorno de desarrollo de Vite + Electron                     |
| `npm run dev:start`      | Compila y luego ejecuta                                      |
| `npm run format`         | `prettier --write` sobre todo el TypeScript/JSON de `src`    |
| `npm run format:check`   | `prettier --check` sobre todo el TypeScript/JSON de `src`    |
| `npm run pack`           | Compila + electron-builder `--dir`                           |
| `npm run dist`           | Compila + electron-builder (NSIS/DMG/AppImage)               |

## 💻 Uso de la CLI

Compila primero y luego invoca a través de `encodex`:

```bash
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac
encodex info input.mp4 --json
encodex compress photo.png -f jpg -q 30
encodex extract-audio input.mp4
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted
```

Consulta [Uso de la CLI](./cli.md) para conocer todos los subcomandos, opciones y ejemplos.

## 🧪 Pruebas

```bash
npm test           # Ejecuta los 123 archivos de prueba / 1603 pruebas
npm run test:watch
npm run test:coverage
npm run test:unit
npm run test:integration
npm run test:e2e   # Requiere compilación previa
```

Consulta [Pruebas](./testing.md) para conocer el desglose completo de la suite de pruebas, la configuración de las pruebas y las especificaciones E2E.

## 📚 Documentación

| Documento | Descripción |
| --------- | ----------- |
| [Referencia de características](./features-reference.md) | Características, formatos multimedia compatibles, tablas de códecs, utilidades de validación |
| [Uso de la CLI](./cli.md) | Uso de la CLI, subcomandos, tablas de todas las opciones, códigos de salida |
| [Pruebas](./testing.md) | Suite de pruebas, configuración de las pruebas, especificaciones E2E |
| [Canales IPC](./ipc.md) | Canales IPC, puente electronAPI, todos los métodos y eventos |
| [Estructura del proyecto](./project-structure.md) | Árbol de directorios completo con anotaciones |
| [Resumen de la arquitectura](./architecture.md) | Panorama de la arquitectura interna y enlaces a análisis detallados |
| [Arquitectura de procesos](./architecture-processes.md) | Modelo de procesos, sistema de compilación, secuencia de inicio, modo CLI |
| [Arquitectura de transcodificadores](./architecture-transcoders.md) | Abstracción de transcodificador, núcleos FFmpeg/BMF, aceleración por hardware |
| [Arquitectura del renderizador](./architecture-renderer.md) | Árbol de renderizado, páginas, almacenes, cola, reproductor, i18n, temas |
| [Gestor de actualizaciones](./update-manager.md) | Detalles de implementación del gestor de actualizaciones integrado |
| [Wiki](https://github.com/Sandeepv68/EncodeX/wiki) | Wiki de la comunidad (refleja los documentos en un formato navegable) |
| [Sitio de documentación](https://encodex.in/es/) | Sitio de VitePress con recorrido por las características, guías y blog de versiones |
| [Contribuir](./CONTRIBUTING.md) | Guía de contribuciones |
| [Seguridad](../../SECURITY.md) | Reporte de vulnerabilidades |
| [Código de conducta](../../CODE_OF_CONDUCT.md) | Código de conducta |

## 🧰 Pila tecnológica

<p align="center"><img src="../../assets/stack.png" alt="Pila tecnológica de EncodeX"></p>

## 🤝 Contribuir

Consulta [Contribuir](./CONTRIBUTING.md) para conocer las guías. Todas las contribuciones son bienvenidas: abre primero una incidencia para los cambios significativos.

Este proyecto se rige por un [Código de conducta](../../CODE_OF_CONDUCT.md).

## 🔒 Seguridad

Reporta las vulnerabilidades de seguridad a los mantenedores del proyecto mediante el proceso de asesorías de seguridad. Consulta [Seguridad](../../SECURITY.md).

## 📄 Licencia

MIT