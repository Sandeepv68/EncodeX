---
date: 2026-09-18
title: "EncodeX añade un servidor MCP integrado: deja que la IA maneje tus conversiones multimedia"
description: "EncodeX ahora incluye un servidor Model Context Protocol (MCP), para que Claude, Cursor, VS Code y agentes personalizados puedan convertir, comprimir, recortar y procesar por lotes tus archivos multimedia — de forma local y segura."
tags:
  - release
  - mcp
  - ai
  - automation
---

# EncodeX añade un servidor MCP integrado: deja que la IA maneje tus conversiones multimedia

**Publicado:** 2026-09-18
**Función:** Servidor MCP integrado (stdio + HTTP integrado)

## En resumen

EncodeX ahora puede actuar como un servidor [Model Context Protocol](https://modelcontextprotocol.io). Eso significa que los asistentes de IA — Claude Desktop, Claude Code, Cursor, VS Code y cualquier otro cliente compatible con MCP — pueden convertir vídeos, extraer audio, comprimir imágenes, recortar clips y gestionar trabajos por lotes a través de EncodeX, con una simple petición en lenguaje natural.

Y todo sigue ocurriendo en tu computadora. Sin subidas, sin nube, sin cuenta.

---

## Por qué MCP cambia el flujo de trabajo diario

Creamos EncodeX para eliminar la línea de comandos de FFmpeg para la gente normal. El **servidor MCP** elimina el último atisbo de fricción del «¿qué botón pulso?» en las herramientas que ya usas.

Si alguna vez has escrito algo como:

> "Toma `interview.mov`, extrae el audio como MP3 y haz una copia que quepa en un correo."

…un asistente con MCP ahora puede *hacerlo de verdad* — eligiendo la herramienta correcta de EncodeX, ejecutando la conversión en local e informándote del resultado. Tú te quedas en tu app de IA favorita; EncodeX hace el trabajo pesado entre bastidores.

Algunas cosas que esto hace posibles:

- **Trabajo por lotes conversacional** — "Convierte cada MKV de esta carpeta a MP4 y avísame cuando termine."
- **Pipelines de agentes** — permite que un agente de código o de medios prepare recursos como parte de una tarea mayor.
- **Automatización repetible** — describe un flujo de trabajo una vez; tu asistente lo reutiliza.
- **Sin sintaxis de comandos que memorizar** — los perfiles, códecs y contenedores se gestionan por ti.

---

## Dos formas de conectarte

### 1. Servidor stdio independiente

Ejecuta EncodeX como un proceso MCP dedicado. Así es como las apps de IA de escritorio inician un servidor bajo demanda:

```bash
# Packaged app
encodex --mcp

# Source checkout (after npm run build:main)
node dist/mcp/index.js
```

stdout transporta el protocolo MCP; todos los logs van a stderr, así que nada corrompe la conversación entre tu asistente y EncodeX.

### 2. Servidor HTTP integrado (modo GUI)

¿Ya tienes EncodeX abierto? Activa **Ajustes → Servidor MCP** y apunta tu cliente a:

```
http://127.0.0.1:8765/mcp
```

Este modo comparte la cola de trabajos de la app en ejecución y añade herramientas de cola en vivo, vista previa, línea de tiempo, sistema y actualizaciones — para que un asistente pueda ver en qué estás trabajando en lugar de actuar de forma aislada.

---

## Qué puede hacer tu asistente

En ambas superficies, EncodeX expone **19 herramientas**.

| Área                   | Herramientas                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Conversión             | `convert_media`, `batch_convert`, `cut_video`, `compress_image`, `extract_audio`                    |
| Inspección             | `get_media_info`, `list_capabilities`, `list_profiles`, `get_profile`, `ping`                       |
| Gestión de trabajos    | `get_job`, `list_jobs`, `cancel_job`                                                                |
| Paridad con la GUI (HTTP) | `get_queue_state`, `cancel_all_jobs`, `get_timeline`, `extract_preview`, `get_system_info`, `check_for_updates` |

También hay **3 recursos** — `encodex://profiles`, `encodex://capabilities` y `encodex://codecs` — para que un asistente pueda descubrir exactamente qué soporta tu instalación, y **4 plantillas de prompt** para las tareas más comunes: convertir vídeo, extraer audio, comprimir imagen y convertir por lotes.

Las conversiones son **asíncronas**. Un renderizado largo no congela la conversación: tu asistente inicia el trabajo, recibe un ID de trabajo y puede consultar el progreso o cancelarlo más tarde.

---

## Configurarlo en un minuto

### Claude Desktop

Añade EncodeX a la configuración de tus servidores MCP:

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

Reinicia Claude Desktop y pídele: *"Usa EncodeX para convertir ~/Videos/clip.mov a MP4."*

### Cursor / VS Code

Añade la misma definición de servidor a tu configuración de MCP (`mcp.json` en Cursor, o los ajustes de MCP en VS Code), apuntando `command` a `encodex` con el argumento `--mcp`. Para el servidor integrado, usa en su lugar la URL de transporte HTTP mostrada arriba.

### Cualquier cliente MCP

El servidor stdio es un proceso JSON-RPC estándar — no requiere integración especial. Si tu herramienta puede lanzar un comando y hablar MCP, puede hablar con EncodeX.

---

## Privado y seguro por diseño

Ofrecer una superficie de automatización implica tomarse la seguridad en serio. El servidor integrado es deliberadamente conservador:

- **Solo loopback** — se vincula a `127.0.0.1` y nunca es accesible desde otra máquina.
- **Comprobaciones de origen** — las peticiones de origen cruzado se rechazan salvo que vengan de la app local.
- **Token bearer opcional** — actívalo y cada petición debe estar autenticada, con comparación en tiempo constante.
- **Superficie HTTP mínima** — solo `GET`, `POST` y `DELETE` en `/mcp`.
- **Cierre limpio** — todas las sesiones se cierran a la fuerza cuando el servidor se detiene o la app se cierra.
- **Sin extracción de archivos** — el servidor usa el mismo motor FFmpeg local que la GUI. Nada se sube.

El modo independiente `--mcp` hereda la misma garantía de «todo se ejecuta en local»: es simplemente otra forma de hablar con el motor que ya está en tu máquina.

---

## ¿Para quién es esto?

- **Creadores y editores** que ya trabajan dentro de un asistente de IA y quieren preparar recursos sin salir de él.
- **Desarrolladores** que construyen flujos de trabajo con agentes que necesitan procesamiento multimedia real.
- **Fans de la automatización** que quieren pipelines repetibles y describibles en lugar de comandos puntuales.
- **Cualquier persona** que prefiera pedir un resultado antes que buscar un ajuste.

Si nunca has usado un cliente MCP, nada cambia — la GUI y la CLI son exactamente igual que antes. El servidor MCP es una puerta adicional al mismo motor.

---

## Pruébalo hoy

1. Actualiza a la última compilación de EncodeX.
2. Ejecuta `encodex --mcp`, o activa **Ajustes → Servidor MCP** en la app.
3. Conecta tu asistente de IA y pídele que convierta algo.

Lee la referencia completa — cada herramienta, recurso, prompt, configuración de cliente y el modelo de seguridad — en la [documentación de MCP](/docs/cli#mcp-server-mode).

---

[Descargar EncodeX](/download) · [Ver todas las funciones](/features) · [Leer la documentación de la CLI](/docs/cli)