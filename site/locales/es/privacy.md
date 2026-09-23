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
- **Solo telemetría con consentimiento** — el único dato que sale son eventos opcionales, anónimos y solo por categorías que puedes desactivar en Ajustes
- **Código abierto** — cualquiera puede inspeccionar exactamente qué hace la aplicación

## Lo que no recopilamos

EncodeX no recopila, transmite ni almacena ningún archivo multimedia, nombre de carpeta o comportamiento de uso. Dado que la aplicación se ejecuta completamente en tu computadora, no hay nada que nosotros recopilemos.

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

- **Informes de errores y diagnósticos con consentimiento.** La aplicación puede enviar diagnósticos de fallos e información de errores anónima a Sentry — y está **activada por defecto, con un interruptor visible en Ajustes** para desactivarla cuando quieras. Todo está gobernado por un único interruptor de consentimiento (guardados localmente en tu dispositivo como `monitoring-consent.json` y `analytics-consent.json`).
- **Eventos de uso solo por categorías.** Cuando está activada, la aplicación registra eventos anónimos y solo por categorías — cosas como «conversión iniciada» o «perfil aplicado» — mediante un canal de análisis de uso propio y dedicado. Por diseño de taxonomía, estos datos **no contienen contenido multimedia, ni nombres de archivo, ni rutas de carpetas, ni tamaños de archivo.** Si desactivas la telemetría, nada sale de tu equipo.
- **Sin subidas, sin procesamiento en la nube.** Incluso con la telemetría activada, tus archivos multimedia reales nunca se transmiten. Codificar, convertir, comprimir o extraer ocurre enteramente dentro de tu dispositivo.

### En términos simples

- No hay **cuenta** — nada que crear, ningún perfil que mantener
- Tus archivos **nunca salen de tu equipo** — sin subidas, sin procesamiento en la nube
- La aplicación funciona **completamente sin conexión** — la telemetría es lo único que puede conectarse, requiere consentimiento, es solo por categorías y se puede desactivar

## Cómo funciona

No hay nube a la que enviar tus archivos. EncodeX incluye el motor FFmpeg directamente en la aplicación y ejecuta cada conversión **en el proceso de tu dispositivo** — de la misma manera que tu navegador web renderiza una página sin que se envíe a un servidor. Si quieres verificarlo, toda la aplicación (incluida su canal de procesamiento multimedia) es de código abierto y está documentada en la [arquitectura técnica](/es/docs/architecture).

## Actualizaciones

Si alguna vez cambiamos la forma en que EncodeX maneja los datos, actualizaremos esta página y anotaremos claramente la fecha del cambio arriba. Dado que la aplicación es de código abierto, también puedes revisar cada cambio en el repositorio.

## Preguntas

¿Preocupaciones sobre la privacidad? Abre un issue en [GitHub](https://github.com/Sandeepv68/EncodeX) o contacta a través del sitio web.

## Empieza

- [Descarga EncodeX gratis](/es/download)
- [Mira todas las conversiones y funciones](/es/features)
- [Resumen de la interfaz gráfica de FFmpeg](/es/ffmpeg-gui)
