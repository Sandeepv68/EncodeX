---
title: "Seguridad en EncodeX — Verificable, Firmado, Open Source"
description: "Cómo EncodeX te mantiene a salvo: código abierto, sumas de verificación SHA-256 en cada descarga, firma de código en macOS y Windows, y un pipeline de actualizaciones verificable. Además, cómo reportar una vulnerabilidad."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# Seguridad en EncodeX

EncodeX es open source, así que la seguridad no tiene que tomarse por fe — cada versión se construye desde código público, incluye **sumas de verificación SHA-256** que puedes comprobar y, donde es posible, está **firmada con código** para que tu sistema operativo confirme que realmente viene de nosotros.

## Lo que publicamos, puedes verificarlo

- **Código abierto.** Toda la aplicación — incluido el pipeline de procesamiento de medios y la compilación de FFmpeg incluida — vive en [nuestro repositorio](https://github.com/Sandeepv68/EncodeX). Cualquiera puede auditar exactamente lo que hace la aplicación.
- **Sumas de verificación SHA-256.** Cada versión publica checksums junto a los binarios. Compara el archivo descargado con el hash publicado antes de instalar:

```bash
# Windows (PowerShell)
Get-FileHash .\EncodeX-Setup-1.0.0.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 ./EncodeX-1.0.0.dmg
```

- **Firma de código.** Las versiones de Windows y macOS están firmadas, así tu sistema operativo muestra "editor verificado"/"Apple" en lugar de un aviso de "desarrollador desconocido".
- **Actualizaciones verificables.** La aplicación solo descarga actualizaciones firmadas por nosotros a través de HTTPS. La firma de la actualización se valida localmente antes de reemplazar nada.

## Nota sobre Gatekeeper en macOS

Como EncodeX es gratis y open source (y no se vende en la App Store de Mac), macOS puede mostrar un mensaje de "no se puede abrir" la primera vez — es la comprobación de **Gatekeeper** que enfrentan las apps sin firmar por defecto. La compilación es real; para abrirla, haz Control-clic sobre la app en Aplicaciones y elige **Abrir**, una vez. Después se abre con normalidad.

## El FFmpeg incluido

EncodeX incluye su propia compilación de FFmpeg en lugar de usar un binario del sistema. La compilación exacta (versión, fuente y configuración) está documentada en nuestra [arquitectura técnica](/docs/architecture) y se reproduce desde el código fuente en CI — así las conversiones se comportan igual en todas partes, y el binario que ejecutas es el que nosotros compilamos.

## Reportar una vulnerabilidad

Nos tomamos la seguridad en serio y seguimos un proceso de divulgación directo:

1. **No** reportes vulnerabilidades en issues públicos de GitHub — expondrías el fallo antes de que podamos arreglarlo.
2. Abre un **[advisory de seguridad privado](https://github.com/Sandeepv68/EncodeX/security/advisories/new)** en el repositorio.
3. Acusamos recibo **en 48 horas** y damos un plazo estimado para el arreglo. Los arreglos de seguridad se priorizan y se publican lo antes posible.

Para todo lo demás, usa el [seguimiento de issues habitual](https://github.com/Sandeepv68/EncodeX/issues).

## Empieza

- [Descarga EncodeX gratis](/es/download)
- [Lee la política de privacidad](/es/privacy)
- [Arquitectura técnica y FFmpeg incluido](/es/docs/architecture)