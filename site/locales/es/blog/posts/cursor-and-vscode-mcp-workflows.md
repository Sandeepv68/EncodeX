---
title: "Flujos de Trabajo MCP con Cursor y VS Code y EncodeX"
description: "Conecta EncodeX a Cursor o VS Code con encodex --mcp y convierte las tareas multimedia en flujos de trabajo de agentes — conversiones, extracciones y compresión de imágenes dentro de tu editor."
date: 2026-09-23
tags:
  - guide
  - mcp
  - cursor
  - vscode
  - ai
---

# Flujos de Trabajo MCP con Cursor y VS Code y EncodeX

Cursor y VS Code hablan MCP, lo que significa que puedes entregar tareas multimedia al asistente de IA de tu editor sin salir de tu código. Apunta cualquiera de los dos al servidor integrado de EncodeX y pide una conversión, una extracción de audio o la compresión de una carpeta completa de imágenes mientras sigues trabajando en el proyecto real.

El servidor corre localmente (`encodex --mcp`), así que el agente del editor opera el propio motor FFmpeg de tu máquina — sin subidas, sin API externa, totalmente sin conexión.

## Configurar EncodeX en VS Code

VS Code incluye soporte MCP integrado. Abre los ajustes de MCP y añade una definición de servidor:

```json
{
  "mcpServers": {
    "encodex": {
      "command": "encodex",
      "args": ["--mcp"]
    }
  }
}
```

VS Code lanza `encodex --mcp` como proceso servidor. Una vez conectado, el asistente del editor puede llamar a las herramientas de EncodeX — `convert_media`, `extract_audio`, `compress_image`, `cut_video`, `batch_convert` — y seguir los trabajos con `get_job` / `list_jobs`.

Para las herramientas extra en vivo (estado de la cola, línea de tiempo, vista previa, información del sistema), activa **Configuración → Servidor MCP** en la interfaz de EncodeX y apunta el editor a `http://127.0.0.1:8765/mcp`. Esa superficie añade herramientas de paridad con la interfaz como `get_queue_state`, `extract_preview` y `get_timeline`.

## Configurar EncodeX en Cursor

Cursor también expone los servidores MCP en sus ajustes, bien con el mismo JSON o con un diálogo similar de "Añadir servidor MCP" usando el tipo `command`:

- **Command (stdio):** `encodex --mcp`

Cursor comparte el formato de configuración MCP estándar, así que el bloque JSON de arriba funciona también para Cursor. Tras añadir el servidor, el agente de Cursor puede realizar operaciones multimedia directamente.

## Flujos de Trabajo de Edición

El patrón útil es combinar el trabajo multimedia con el flujo normal de tu editor:

> Convierte `assets/tmp/video.mov` a MP4 para la página de docs, en la carpeta `assets/`.

El agente llama a `convert_media`, espera a `get_job` y luego sigue con trabajo de seguimiento — hospedar una vista previa, actualizar un README o conectar el nuevo archivo a una compilación.

Aún más avanzado, un solo prompt puede orquestar muchos pasos:

> Ha llegado una grabación nueva a `~/r2d2/captures`. Conviértela a un MP4 comprimido, extrae el audio para transcripción y luego actualiza `docs/captures.md` con las ubicaciones de salida.

Son `convert_media` + `extract_audio`, coordinadas con el trabajo de tu repositorio en una sesión.

## Salida Versionada y Limpieza

Como EncodeX crea archivos reales en disco, puedes combinarlo con tu flujo de git:

> Ejecuta el lote de `~/r2d2/captures` a `~/r2d2/output`, y dime qué archivos de salida son nuevos para saber qué añadir.

El agente lee los resultados de las herramientas, el historial de `list_jobs` y el estado de tu directorio para resumir qué cambió — convirtiendo una tarea multimedia en un commit documentado.

## Preguntas Frecuentes

### ¿Esto envía mi código o multimedia a la nube?

No. EncodeX MCP se ejecuta por completo en tu máquina. Tu multimedia se procesa localmente y el agente de tu editor opera esas herramientas locales. No hay viaje a la nube para la codificación.

### ¿Necesito la interfaz de EncodeX abierta?

Para el servidor stdio (`encodex --mcp`), no — corre sin interfaz. El servidor HTTP integrado es la superficie opcional que corre dentro de la app y añade herramientas de cola en vivo y vista previa.

### ¿Puedo usarlo con Cursor y VS Code a la vez?

Sí. Cada cliente lanza su propia instancia del servidor stdio, o puedes compartir el endpoint HTTP integrado entre ambos (una sola instancia de la interfaz).

### ¿Qué herramientas hay disponibles?

La superficie stdio expone 13 herramientas núcleo, incluidas `convert_media`, `batch_convert`, `extract_audio`, `compress_image`, `cut_video` y la gestión de trabajos. Consulta la [referencia de funciones](/es/docs/features-reference#mcp-server) para el catálogo completo.

## Aprende Más

- [Configuración de Claude Desktop y Claude Code](/es/blog/posts/how-to-use-claude-with-mcp)
- [Guía de automatización por lotes](/es/blog/posts/mcp-batch-automation-guide)
- [Documentación del servidor MCP](/es/docs/cli#mcp-server-mode)
- [Privacidad y seguridad de MCP](/es/blog/posts/mcp-privacy-security)

---

*Descarga EncodeX gratis en [encodex.in/download](/es/download). El servidor MCP se incluye con cada instalación.*