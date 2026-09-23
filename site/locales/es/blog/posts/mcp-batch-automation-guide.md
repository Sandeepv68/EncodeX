---
title: "Automatización por Lotes con MCP: Pon la Cola a Docenas de Trabajos en un Solo Prompt"
description: "Usa el servidor MCP de EncodeX para poner en cola una carpeta entera de vídeos con un solo prompt — trabajos asíncronos, seguimiento de progreso y resultados estructurados con batch_convert, list_jobs y get_job."
date: 2026-09-22
tags:
  - guide
  - mcp
  - automation
  - batch
  - ai
---

# Automatización por Lotes con MCP: Pon la Cola a Docenas de Trabajos en un Solo Prompt

El servidor MCP de EncodeX no sirve solo para conversiones individuales. Como cada trabajo se ejecuta de forma asíncrona y expone herramientas de seguimiento, puedes entregarle a un asistente de IA una carpeta entera de multimedia y lograr que se ponga en cola, se procese y se informe — sin abrir la app ni escribir un solo comando a mano.

Esta guía muestra el flujo por lotes: la herramienta `batch_convert`, el modelo de trabajos asíncronos y cómo las herramientas de estado te mantienen informado mientras FFmpeg trabaja.

## El Modelo de Trabajos Asíncronos

Cuando EncodeX inicia una conversión a través de MCP, no se queda esperando. Devuelve un **identificador de trabajo** de inmediato y el trabajo se ejecuta en segundo plano. Tú (o el asistente) consultas entonces:

- `get_job` — estado, progreso y resultado de un trabajo
- `list_jobs` — todos los trabajos de la sesión actual
- `cancel_job` — detener un trabajo en curso

Eso es lo que hace que un lote de una docena de archivos se sienta instantáneo a nivel de prompt: el trabajo se encola en una llamada y EncodeX avanza a través de él.

## Pon en Cola una Carpeta Entera

El camino más rápido es `batch_convert`. Dale al asistente una carpeta y un destino, por ejemplo:

> Convierte todos los archivos MKV de `~/Downloads` a MP4 y ponlos en `~/Output`.

El asistente recorre la carpeta, llama a `batch_convert` e inicia la cola. No necesitas gestionar los trabajos uno a uno.

¿Quieres un lote más específico? Nombra el filtro:

> Toma todos los vídeos de `~/Recordings`, recodifícalos a H.264 en un contenedor MP4 con CRF 23 y déjalos en su sitio.

El asistente elige el perfil correcto con las herramientas `list_profiles` y `get_profile`, y luego encola el lote.

## Mezclar Herramientas en un Solo Prompt

Como todas las herramientas comparten una sesión, un solo prompt puede encadenar varias operaciones:

> Para cada vídeo de `~/Source`: conviértelo a MP4 para mi teléfono, extrae el audio como MP3 y comprime la carpeta de capturas `~/Assets`.

Son `batch_convert` más `extract_audio` más `compress_image`, todo encolado y seguido a la vez. El asistente coordina las operaciones e informa de qué se completó y dónde.

## Comprobar el Progreso

Mientras corren los trabajos, pregunta:

> ¿Cuál es el estado de mi lote?

`list_jobs` devuelve todos los trabajos con su estado y progreso actuales. ¿Necesitas más detalle?

> ¿Cuánto lleva la conversión de MKV a MP4?

El asistente consulta `get_job` para el trabajo específico y lee su progreso. Si algo se porta mal:

> Cancela el trabajo que lleva rato atascado.

Eso corresponde a `cancel_job` — y como los trabajos están aislados, el resto del lote continúa.

## Las 4 Plantillas de Prompt

El servidor MCP también incluye cuatro plantillas de prompt: `convert-video`, `extract-audio`, `compress-image` y `batch-convert`. Rellenan por adelantado las llamadas y la estructura de argumentos correctas, lo que resulta útil para agentes que quieren una forma canónica de ejecutar una operación habitual. El asistente puede invocar la plantilla y luego la cadena de herramientas, dando resultados coherentes entre sesiones.

## Preguntas Frecuentes

### ¿Cuántos archivos puedo poner en cola a la vez?

No hay un límite arbitrario pequeño — EncodeX procesa la cola secuencialmente con tu hardware. Empieza con una carpeta y déjala trabajar; puedes comprobar el estado cuando quieras.

### ¿Los trabajos por lotes corren en segundo plano?

Sí. La interfaz los muestra en la Cola de trabajos, y por MCP los sigues con `get_job` y `list_jobs`. Puedes seguir pidiendo otras cosas mientras la codificación corre.

### ¿Puedo cancelar solo un trabajo?

Sí — `cancel_job` detiene un solo trabajo. La superficie HTTP integrada añade además `cancel_all_jobs` para toda la cola. Los demás continúan de forma independiente.

### ¿El lote funciona sin conexión?

Por completo. Toda la codificación ocurre localmente en tu máquina vía FFmpeg — sin subidas, sin nube, y funciona sin conexión a internet.

## Aprende Más

- [Controla EncodeX desde Claude Desktop](/es/blog/posts/how-to-use-claude-with-mcp)
- [Documentación del servidor MCP](/es/docs/cli#mcp-server-mode)
- [Modelo de seguridad y privacidad de MCP](/es/blog/posts/mcp-privacy-security)
- [Referencia de funciones: herramientas MCP](/es/docs/features-reference#mcp-server)

---

*Descarga EncodeX gratis en [encodex.in/download](/es/download). El servidor MCP y la cola de trabajos se incluyen con cada instalación.*