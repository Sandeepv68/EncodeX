---
title: "Cómo Usar el Servidor MCP de EncodeX con Claude Desktop y Claude Code"
description: "Conecta el servidor MCP integrado de EncodeX a Claude Desktop o Claude Code y convierte, extrae, comprime y procesa por lotes multimedia en lenguaje natural, totalmente sin conexión."
date: 2026-09-21
tags:
  - guide
  - mcp
  - claude
  - ai
  - automation
---

# Cómo Usar el Servidor MCP de EncodeX con Claude Desktop y Claude Code

EncodeX incluye un servidor MCP integrado (Model Context Protocol), lo que significa que puedes manejar toda la aplicación desde Claude Desktop o Claude Code usando lenguaje natural. En lugar de abrir la interfaz y buscar entre menús, pregunta: *"convierte este MKV a MP4 para mi teléfono"* — y el asistente realiza la conversión con el motor FFmpeg local de EncodeX.

Todo ocurre en tu ordenador. Los archivos nunca salen de tu dispositivo, no hay cuenta y todo funciona sin conexión.

## ¿Qué Es un Servidor MCP?

[MCP](https://modelcontextprotocol.io) es un estándar abierto que permite a los asistentes de IA usar herramientas de aplicaciones reales. El servidor de EncodeX expone un conjunto de herramientas de conversión — `convert_media`, `extract_audio`, `compress_image`, `cut_video`, `batch_convert`, además de herramientas de seguimiento de trabajos como `get_job` y `list_jobs` — junto con recursos y plantillas de prompts.

Piénsalo como un mando a distancia para FFmpeg que un asistente de IA puede operar. El asistente ve las herramientas, decide cuáles llamar y EncodeX hace la codificación localmente.

## Primeros Pasos

Instala EncodeX ([descarga](/download)) — el servidor MCP viene integrado, sin complementos — y asegúrate de que `encodex` esté en tu `PATH` (instalar EncodeX lo añade).

### Opción 1: Claude Desktop

Abre **Claude Desktop → Configuración → Desarrollador → Editar configuración** y añade una entrada de servidor MCP:

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

Guarda el archivo y reinicia Claude Desktop. Claude ahora tendrá acceso a las herramientas de EncodeX.

### Opción 2: Claude Code

Desde una terminal dentro de tu proyecto:

```bash
claude mcp add encodex -- encodex --mcp
```

Luego inicia Claude Code y pide una conversión. Puedes verificar que el servidor se registró con `claude mcp list`.

## Tu Primera Petición

Prueba algo sencillo:

> Convierte `~/Desktop/vacation.mp4` a un MP4 más pequeño apto para WhatsApp.

El asistente llama a `convert_media`, el trabajo se ejecuta en segundo plano en tu máquina y Claude informa del resultado. Como la conversión es asíncrona, EncodeX devuelve un identificador de trabajo; el asistente consulta `get_job` para el progreso y termina cuando completa.

También puedes extraer audio:

> Extrae el audio de `lecture.mov` como MP3.

Eso corresponde a la herramienta `extract_audio`. O comprimir una carpeta de imágenes:

> Comprime todas las fotos de `~/Pics` en la carpeta `~/Output`.

Esa es la herramienta `compress_image`, manejada en lenguaje natural.

## Ejecutar el Servidor Sin Interfaz

`encodex --mcp` inicia el servidor stdio independiente. Habla JSON-RPC por stdout (manteniendo limpios los mensajes del protocolo) y envía todo el estado y los registros a stderr. El proceso permanece vivo hasta que se cierra stdin — exactamente lo que las apps de escritorio asíncronas necesitan para ejecutar un servidor MCP a demanda.

Para la superficie HTTP integrada — cola en vivo, vista previa, línea de tiempo y herramientas de sistema — activa **Configuración → Servidor MCP** en la interfaz y apunta el cliente a `http://127.0.0.1:8765/mcp`.

## Consejos para Mejores Resultados

- **Da rutas absolutas o explícitas** — es más fácil para el asistente apuntar a los archivos correctos.
- **Nombra el formato de salida** — "como MP4", "a MP3" — para que se seleccione el perfil correcto.
- **Usa lotes para carpetas** — EncodeX puede convertir muchos archivos en un solo trabajo (consulta la [guía de automatización por lotes](/es/blog/posts/mcp-batch-automation-guide)).
- **Consulta la documentación para opciones avanzadas** — el catálogo completo está en la [referencia de funciones MCP](/es/docs/features-reference#mcp-server).

## Preguntas Frecuentes

### ¿El servidor MCP de EncodeX es gratuito?

Sí — está integrado en la aplicación EncodeX gratuita y de código abierto (MIT). Sin suscripciones ni claves de licencia.

### ¿Necesito la interfaz abierta para usar `encodex --mcp`?

No. El servidor independiente se ejecuta sin interfaz. El servidor HTTP integrado (Configuración → Servidor MCP) es la superficie opcional que se ejecuta dentro de la app para herramientas de cola y vista previa.

### ¿MCP sube mis archivos?

No. EncodeX procesa todo localmente. El servidor MCP impulsa el mismo motor FFmpeg local que la interfaz — sin subidas, sin nube y sin cuenta.

### ¿Qué asistentes pueden conectarse?

Cualquier cliente compatible con MCP. Esta guía cubre Claude Desktop y Claude Code; el mismo patrón de configuración funciona en [Cursor y VS Code](/es/blog/posts/cursor-and-vscode-mcp-workflows).

## Aprende Más

- [Documentación del servidor MCP](/es/docs/cli#mcp-server-mode)
- [Automatización por lotes con MCP](/es/blog/posts/mcp-batch-automation-guide)
- [Privacidad y seguridad de MCP](/es/blog/posts/mcp-privacy-security)
- [La referencia de funciones completa](/es/docs/features-reference#mcp-server)

---

*Descarga EncodeX gratis en [encodex.in/download](/es/download). El servidor MCP se incluye con cada instalación.*