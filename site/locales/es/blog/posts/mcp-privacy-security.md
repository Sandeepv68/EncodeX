---
title: "Privacidad y Seguridad de MCP: Por Qué EncodeX Mantiene Tu Multimedia Local"
description: "El servidor MCP de EncodeX se ejecuta por completo en tu máquina — vinculación solo de bucle local, validación de Origin, token de acceso opcional y diseño sin conexión. Sin subidas, sin nube, sin cuenta."
date: 2026-09-24
tags:
  - guide
  - mcp
  - security
  - privacy
  - ai
---

# Privacidad y Seguridad de MCP: Por Qué EncodeX Mantiene Tu Multimedia Local

Dejar que un asistente de IA controle tus archivos multimedia plantea una pregunta evidente: ¿qué pasa con mis archivos? Con el servidor MCP de EncodeX, la respuesta es directa — todo corre en tu propio ordenador. El asistente da instrucciones; el motor FFmpeg integrado de EncodeX hace el trabajo localmente. Los archivos nunca salen de tu dispositivo, y el servidor está reforzado con vinculación de bucle local, validación de Origin y un token de acceso opcional.

Esta publicación explica el modelo de seguridad para que sepas exactamente qué está protegido.

## Sin Conexión por Diseño

La garantía principal es la más simple: **sin subidas, sin nube, sin cuenta**. EncodeX es una aplicación local y el servidor MCP es un proceso local. No hay una nube de EncodeX a la que enviar archivos — la conversión, extracción, compresión y corte ocurren en tu hardware. Si tu máquina está sin conexión, MCP sigue funcionando.

Eso convierte a EncodeX en una opción de servidor MCP genuinamente *local*. Tu multimedia nunca se convierte en datos de entrenamiento ajenos ni en una factura de almacenamiento.

## Servidor Independiente: Un Proceso Simple

En el modo por defecto (`encodex --mcp`), EncodeX corre como un proceso stdio sin interfaz que habla JSON-RPC. No se vincula a nada en la red — stdout lleva los mensajes del protocolo, stderr lleva los registros y el proceso permanece vivo hasta que se cierra stdin. No hay ningún puerto escuchando, así que no existe una superficie a la que un atacante remoto pudiera llegar.

## Servidor Integrado: Bucle Local + Comprobación de Origin

El servidor HTTP integrado opcional (Configuración → Servidor MCP) es la única superficie de red, y es cuidadoso con quién habla:

- **Solo bucle local** — se vincula a `127.0.0.1`, así que solo el software de tu propia máquina puede alcanzarlo.
- **Validación de Origin** — las peticiones entrantes deben llevar una cabecera `Origin` aceptable (tus clientes locales), y acepta solo `GET`, `POST` y `DELETE` en `/mcp`.
- **Sesiones confinadas a la app** — todas las sesiones se cierran a la fuerza cuando el servidor se detiene o EncodeX se cierra.

La idea: el endpoint existe para tus apps locales de IA, no para cualquier otra cosa en la red.

## Token de Acceso Opcional

Para una capa extra, puedes fijar un **token de acceso** en Configuración → Servidor MCP. El servidor integrado exige entonces un token bearer, y compara los tokens en **tiempo constante** — evitando el clásico canal lateral de temporización usado para adivinar secretos carácter a carácter.

Como es opcional, tú controlas el equilibrio: sin token para comodidad en una máquina de confianza de un solo usuario, con token cuando quieres autorización explícita para clientes locales.

## Qué Puede Hacer Realmente el Asistente

MCP no es un prompt abierto a tu sistema. El asistente solo puede llamar a las herramientas que EncodeX expone. La superficie stdio ofrece 13 herramientas núcleo (`convert_media`, `batch_convert`, `extract_audio`, `compress_image`, `cut_video`, gestión de trabajos y más); la superficie integrada añade herramientas de paridad con la interfaz (`get_queue_state`, `cancel_all_jobs`, `get_timeline`, `extract_preview`, `get_system_info`, `check_for_updates`). Eso es un ámbito de herramientas deliberado: el asistente puede operar EncodeX, y nada más.

Todas las sesiones se cierran a la fuerza cuando la app termina, así que un asistente obsoleto no puede mantener un acceso después de que cierres EncodeX.

## Preguntas Frecuentes

### ¿El servidor MCP de EncodeX envía datos a algún lugar?

No. EncodeX procesa todo localmente con FFmpeg. No hay componente en la nube, ni telemetría de tu multimedia, y el estándar MCP aquí es solo una tubería local.

### ¿El servidor integrado queda expuesto en mi red?

No. Se vincula solo al bucle local (`127.0.0.1`), valida la cabecera `Origin` y acepta solo `GET`, `POST` y `DELETE` en `/mcp`. Los dispositivos remotos de tu LAN no pueden alcanzarlo.

### ¿Cómo añado un token?

Abre **Configuración → Servidor MCP**, activa el servidor y fija un token de acceso. Los clientes lo envían después como token bearer, comparado en tiempo constante.

### ¿Puedo usar MCP totalmente sin conexión?

Sí — ese es el diseño central. Instala EncodeX, ejecuta `encodex --mcp` o activa el servidor integrado, y todo funciona sin conexión a internet.

## Aprende Más

- [Documentación del servidor MCP](/es/docs/cli#mcp-server-mode)
- [Configuración de Claude Desktop y Claude Code](/es/blog/posts/how-to-use-claude-with-mcp)
- [Guía de automatización por lotes](/es/blog/posts/mcp-batch-automation-guide)
- [Flujos de trabajo con Cursor y VS Code](/es/blog/posts/cursor-and-vscode-mcp-workflows)
- [Referencia de funciones: MCP](/es/docs/features-reference#mcp-server)

---

*Descarga EncodeX gratis en [encodex.in/download](/es/download). El servidor MCP se incluye con cada instalación.*