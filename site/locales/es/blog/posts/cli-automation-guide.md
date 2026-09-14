---
title: "Cómo Automatizar Flujos de Trabajo Multimedia con la CLI de EncodeX"
description: "Usa EncodeX desde la línea de comandos para programar conversiones por lotes, extraer audio, comprimir imágenes y crear canalizaciones multimedia automatizadas."
date: 2026-09-12
tags:
  - guide
  - cli
  - automation
  - developer
---

# Cómo Automatizar Flujos de Trabajo Multimedia con la CLI de EncodeX

EncodeX es una aplicación orientada a la interfaz gráfica, pero incluye una interfaz de línea de comandos completa que puede hacer todo lo que hace la aplicación de escritorio — y algunas cosas que no puede. Si trabajas con archivos multimedia con regularidad y quieres crear scripts, automatizar lotes o encadenar conversiones dentro de un flujo de trabajo, la CLI convierte a EncodeX en algo que puedes ejecutar desde una terminal, una canalización de CI o una tarea programada.

## ¿Por Qué Usar la CLI?

La GUI es ideal para conversiones puntuales — arrastra un archivo, elige un perfil y listo. Pero cuando tienes una carpeta con cincuenta vídeos, o quieres un script que comprima cada grabación que aterrice en un directorio, la CLI te permite codificar sin abrir ninguna ventana.

Casos de uso habituales:

- **Scripts de conversión por lotes** — convierte todos los `.mov` de una carpeta a `.mp4` con un solo comando.
- **Extracción de audio** — separa el audio de los archivos de vídeo para podcasts o archivos.
- **Canalizaciones CI/CD** — valida o vuelve a codificar artefactos multimedia como parte de una compilación automatizada.
- **Tareas programadas** — comprime las nuevas grabaciones cada noche automáticamente.
- **Integración con otras herramientas** — envía la información del multimedia a sistemas de monitorización o canalizaciones de registro.

## Primeros Pasos

Si has instalado EncodeX (GUI), la CLI ya está disponible. Abre una terminal y ejecuta:

```bash
encodex convert --help
```

Verás la lista completa de opciones. La CLI replica las capacidades de la GUI: todos los formatos, códecs y perfiles que admite la aplicación también están disponibles desde la línea de comandos.

Para conocer las opciones de instalación y todos los comandos disponibles, consulta la [documentación de la CLI](/es/docs/cli).

## Convertir un Vídeo

La operación más habitual es convertir entre formatos. Una conversión sencilla:

```bash
encodex convert in.mov -o out.mp4
```

Esto usa los ajustes predeterminados de EncodeX (H.264 + AAC en un contenedor MP4) y produce un archivo que funciona en todas partes.

Para orientar el resultado a un códec o una calidad concretos:

```bash
encodex convert in.mov -o out.mp4 --video-codec libx265 --crf 20
```

H.265 produce archivos más pequeños a la misma calidad. El CRF 20 es un ajuste de alta calidad; los valores más bajos significan más calidad (y archivos más grandes).

## Extraer Audio

Extrae la pista de audio de un vídeo sin volver a codificar:

```bash
encodex extract-audio in.mp4 -o audio.mp3
```

La salida predeterminada es MP3 a 192k. Para especificar otro formato:

```bash
encodex extract-audio in.mp4 -o audio.wav --codec libopus
```

Esto resulta útil para extraer el audio de podcasts a partir de grabaciones de vídeo, crear vistas previas de audio o archivar las bandas sonoras por separado.

## Transcodificación sin Pérdida

Cuando necesitas cambiar el contenedor sin tocar los datos de vídeo o audio (por ejemplo, pasar de `.mkv` a `.mp4` para compatibilidad con dispositivos):

```bash
encodex convert in.mkv -o out.mp4 --video-codec copy --audio-codec copy
```

Esto es prácticamente instantáneo porque no se produce ninguna codificación — los flujos simplemente se remuxean al nuevo contenedor. Perfecto para el archivista que busca máxima compatibilidad sin pérdida de calidad.

## Conversiones por Lotes

Convierte varios archivos a la vez:

```bash
encodex batch *.mov -o output/ --video-codec libx264 --crf 23
```

Todos los archivos coincidentes se procesan en secuencia. Cada archivo de entrada genera su correspondiente archivo de salida en el directorio `output/`, cambiando la extensión a `.mp4`.

## Obtener Información de un Archivo Multimedia

Antes de convertir, puede que quieras inspeccionar el códec, la resolución o la tasa de bits de un archivo:

```bash
encodex info in.mp4
```

Esto imprime un resumen legible de los flujos del archivo. Para una salida legible por máquina:

```bash
encodex info in.mp4 --json
```

La salida JSON es útil en scripts donde necesitas tomar decisiones basadas en las propiedades del archivo (por ejemplo, "solo vuelve a codificar si el códec de vídeo no es ya H.264").

## Códigos de Salida y Manejo de Errores

La CLI devuelve códigos de salida con significado para que los scripts puedan detectar el éxito o el fracaso:

| Código | Significado |
|------|---------|
| 0 | Éxito |
| 1 | Error general |
| 2 | Argumentos no válidos |
| 3 | Archivo de entrada no encontrado |
| 4 | El archivo de salida ya existe (usa `--overwrite` para reemplazarlo) |

Úsalos en scripts de shell para manejar los errores con elegancia:

```bash
encodex convert in.mp4 -o out.mp4
if [ $? -eq 4 ]; then
  echo "Output exists — skipping."
fi
```

## Cómo Combinarlo Todo

La CLI está diseñada para ser componible. Un script del mundo real podría:

1. Revisar todos los archivos de vídeo de una carpeta con `encodex info --json`
2. Filtrar los archivos de más de 500 MB
3. Convertir esos archivos a un MP4 H.264 más pequeño con CRF 23
4. Registrar los resultados

La [referencia completa de la CLI](/es/docs/cli) documenta todas las opciones, los indicadores y los códigos de salida.

---

*Descarga EncodeX gratis en [encodex.in/download](/es/download). La CLI está incluida en todas las instalaciones.*