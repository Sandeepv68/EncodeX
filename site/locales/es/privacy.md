---
title: "Política de privacidad – EncodeX nunca sube tus archivos"
description: "Política de privacidad de EncodeX: procesamiento 100% sin conexión, sin cuentas, sin seguimiento de tu contenido multimedia, sin recopilación de datos. Tus vídeos y audio nunca salen de tu computadora."
---

# Política de privacidad

**Versión corta: tus archivos nunca salen de tu computadora.**

EncodeX es una aplicación de escritorio que procesa todo el contenido multimedia **localmente y sin conexión**. No tenemos servidores que reciban tus vídeos, no hay procesamiento en la nube y no hay razón para ver tus archivos.

*Última actualización: septiembre de 2026*

## La versión corta

- **100% sin conexión** — toda conversión, compresión y extracción ocurre en tu dispositivo
- **Sin cuenta** — nada que registrar, sin perfil que mantener
- **Sin subidas** — tu contenido multimedia nunca se transmite a nosotros ni a nadie más
- **Telemetría que puedes desactivar** — los informes de errores y los datos de uso anónimos y por categorías están activados de forma predeterminada, y un solo interruptor en Ajustes desactiva ambos. Las comprobaciones de actualización y los proveedores de IA configurados también hacen solicitudes de red (ver abajo)
- **Código abierto** — cualquiera puede inspeccionar exactamente qué hace la aplicación

## Lo que no recopilamos

EncodeX no recopila, transmite ni almacena ninguno de tus archivos multimedia, nombres de carpetas ni nada más que pueda identificarte. La conversión ocurre en tu computadora. La aplicación sí envía informes de errores y eventos de uso anónimos de forma predeterminada, y también puede hacer las solicitudes salientes que se indican abajo. Puedes desactivar los informes de errores y los datos de uso en Ajustes.

## Lo que hacemos

Lo único que vemos es lo que eliges enviarnos:

- **GitHub** — cuando reportas un problema, das estrella al repositorio o contribuyes, GitHub recopila datos según su propia [política de privacidad](https://docs.github.com/en/site-policy/privacy-policies)
- **Nuestro sitio web (encodex.in)** — un sitio que respeta la privacidad, sin cookies. Utilizamos análisis simples y respetuosos con la privacidad para ver vistas de página agregadas — nunca vinculadas a tu identidad
- **Soporte** — si nos envías un correo electrónico, leemos el mensaje que envías (obviamente)

## El sitio web

El sitio web de EncodeX en sí:

- No muestra anuncios
- No utiliza cookies de seguimiento de terceros
- Utiliza análisis respetuosos con la privacidad (sin seguimiento entre sitios, sin datos personales)

## Qué telemetría existe

Para ser completamente transparentes, aquí está cada dato que EncodeX recopila — en la web y en la aplicación:

### El sitio web (encodex.in)

- **Conteos de páginas vistas sin cookies.** Medimos las visitas agregadas con una configuración de análisis que respeta la privacidad — sin cookies, sin seguimiento entre sitios, sin repetición de sesiones y nada vinculado a tu identidad. No podemos ver quién eres.

### La aplicación de escritorio

- **Informes de errores.** La aplicación puede enviar diagnósticos de fallos y errores a Sentry. Está **activada de forma predeterminada, con un interruptor en Ajustes** para desactivarla cuando quieras. Un solo interruptor, _Datos de uso e informes de errores_, en Ajustes, controla tanto los informes de errores como los datos de uso. La elección se guarda localmente en `monitoring-consent.json` y `analytics-consent.json`.
- **Datos de uso solo por categorías.** Cuando está activada, la aplicación registra eventos anónimos y por categorías agrupados por área de función (por ejemplo, navegación, conversión, cola y actualizaciones) mediante un canal de análisis de uso. Por diseño, estos datos **no contienen contenido multimedia, ni nombres de archivo, ni rutas de carpetas.** Si desactivas el interruptor, estos eventos no se envían.
- **Sin subidas, sin procesamiento en la nube.** Incluso con la telemetría activada, tus archivos multimedia nunca se transmiten. La conversión, la compresión y la extracción ocurren en tu dispositivo.

### Otras solicitudes de red

- **Comprobaciones de actualización** — cuando buscas actualizaciones, la aplicación consulta las versiones de GitHub.
- **Proveedores de IA** — Copilot y las funciones de IA usan el enrutador de reglas integrado de forma predeterminada, que funciona sin conexión. Las solicitudes solo van a OpenAI, Anthropic o Gemini si configuras uno de esos proveedores. El proveedor local se ejecuta en tu máquina.

### En términos simples

- No hay **cuenta** — nada que crear, ningún perfil que mantener
- Tus archivos **nunca salen de tu equipo** — sin subidas, sin procesamiento en la nube
- La conversión funciona **completamente sin conexión**. Los informes de errores, los datos de uso, las comprobaciones de actualización y los proveedores de IA configurados son las únicas actividades de red, y tú controlas la primera y la última.

## Cómo funciona

No hay nube a la que enviar tus archivos. EncodeX incluye el motor FFmpeg con la aplicación y ejecuta cada conversión como un **proceso hijo local en tu dispositivo**, así que los medios se leen y escriben en tu computadora. Si quieres verificarlo, toda la aplicación (incluida su canal de procesamiento multimedia) es de código abierto y está documentada en la [arquitectura técnica](/es/docs/architecture).

## Actualizaciones

Si alguna vez cambiamos la forma en que EncodeX maneja los datos, actualizaremos esta página y anotaremos claramente la fecha del cambio arriba. Dado que la aplicación es de código abierto, también puedes revisar cada cambio en el repositorio.

## Preguntas

¿Preocupaciones sobre la privacidad? Abre un issue en [GitHub](https://github.com/Sandeepv68/EncodeX) o contacta a través del sitio web.

## Empieza

- [Descarga EncodeX gratis](/es/download)
- [Mira todas las conversiones y funciones](/es/features)
- [Resumen de la interfaz gráfica de FFmpeg](/es/ffmpeg-gui)
