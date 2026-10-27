---
title: "Seguridad en EncodeX — Código abierto, sumas de verificación y reporte"
description: "Cómo EncodeX te mantiene a salvo: código abierto, sumas de verificación SHA-256 publicadas en cada versión, una comprobación del digest de GitHub en las actualizaciones y cómo reportar una vulnerabilidad. Las compilaciones de versión no están firmadas."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# Seguridad en EncodeX

EncodeX es de código abierto, así que la seguridad no tiene que tomarse por fe. Cada versión se construye desde código público y publica **sumas de verificación SHA-256** que puedes comparar con tu descarga. Las compilaciones de versión **no están firmadas**, por lo que tu sistema operativo puede mostrar un aviso de "desarrollador desconocido" o "desarrollador no identificado".

## Lo que publicamos, puedes verificarlo

- **Código abierto.** Toda la aplicación, incluidos el canal de procesamiento de medios y los scripts de versión, vive en [nuestro repositorio](https://github.com/Sandeepv68/EncodeX). Cualquiera puede auditar exactamente lo que hace la aplicación.
- **Sumas de verificación SHA-256.** Cada versión publica un archivo `SHA256SUMS.txt` junto a los binarios. Compara el archivo descargado con el hash publicado antes de instalar:

```bash
# Windows (PowerShell)
Get-FileHash .\EncodeX-Setup-1.0.0.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 ./EncodeX-1.0.0.dmg
```

- **Actualizaciones verificadas.** El actualizador comprueba las versiones de GitHub. Cuando GitHub publica un digest SHA-256 o SHA-512 para el archivo de actualización, la aplicación verifica la descarga con él. El actualizador no verifica una firma criptográfica. Las actualizaciones nunca se instalan automáticamente; tú eliges cuándo instalarlas.

## Nota sobre Gatekeeper en macOS

Como EncodeX es gratis y de código abierto, no se vende en la App Store de Mac y sus compilaciones para macOS no están firmadas ni notarizadas, macOS puede mostrar un mensaje de "no se puede abrir" la primera vez. La compilación es la publicada en la página de versiones. Para abrirla, haz Control-clic sobre la app en Aplicaciones y elige **Abrir**, una vez. En versiones recientes de macOS puede que necesites usar **Ajustes del Sistema → Privacidad y seguridad → Abrir de todos modos**.

## El FFmpeg incluido

EncodeX incluye binarios precompilados de FFmpeg y FFprobe (de los paquetes `ffmpeg-static` y `ffprobe-static`) en lugar de usar un binario del sistema. Las conversiones se ejecutan como un proceso hijo en tu dispositivo. Consulta nuestra [arquitectura técnica](/docs/architecture) para saber cómo se integra el motor.

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