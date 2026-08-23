# Descargar EncodeX

EncodeX es **gratis** y funciona en Windows, Mac y Linux. Elige tu tipo de computadora abajo, descarga, instala y listo.

::: tip Consigue siempre la versión más nueva
Las versiones nuevas se publican en la [página de releases de GitHub](https://github.com/Sandeepv68/EncodeX/releases). Los enlaces de abajo siempre te dan la más reciente — cada uno con su arquitectura, tamaño de archivo y suma SHA-256 para verificar tu descarga.
:::

<LatestDownloads />

## <OsIcon name="windows" /> Windows

**¿Solo quieres que funcione?** Pulsa el primer botón: es el adecuado para casi todo el mundo.

<LatestDownloads platform="windows" />

**Para instalar:** abre el archivo descargado y sigue los pasos en pantalla. Funciona en Windows 10 y posteriores.

¿No sabes cuál elegir? Ve con el recomendado — si no coincide, Windows te lo dirá.

## <OsIcon name="apple" /> Mac

<LatestDownloads platform="macos" />

**Para instalar:** abre el archivo `.dmg` descargado y arrastra EncodeX a tu carpeta de Aplicaciones.

**¿No sabes qué Mac tienes?** Pulsa el logo de Apple (<OsIcon name="apple" label="Logo de Apple" />) en la esquina superior izquierda, elige "Acerca de este Mac" y mira la línea "Chip". Si dice "Apple M1" (o M2/M3/M4), elige Apple Silicon. Si dice "Intel", elige Intel.

::: warning Primer inicio en Mac — un paso extra
Como EncodeX es gratuito y de código abierto (y no se vende en la Mac App Store), macOS puede mostrar un mensaje diciendo que la app "no se puede abrir" la primera vez. Es normal y seguro de superar:

1. Busca EncodeX en tu carpeta de Aplicaciones
2. Mantén pulsada la tecla **Control**, haz clic en la app y elige **Abrir**
3. En el cuadro que aparece, pulsa **Abrir** otra vez

Solo tienes que hacerlo una vez — después se abre con normalidad.
:::

## <OsIcon name="linux" /> Linux

<LatestDownloads platform="linux" />

**Para ejecutar:** una AppImage es un solo archivo — sin instalación. Hazlo ejecutable y ábrelo con doble clic:

```bash
chmod +x EncodeX-*.AppImage
./EncodeX-*.AppImage
```

(Muchos entornos de escritorio también permiten saltarse la terminal: clic derecho en el archivo → Propiedades → permitir ejecución, y doble clic.)

## Lo que necesita tu computadora

Nada especial — si tu computadora es de los últimos años, estás bien:

- **Sistema operativo:** Windows 10+, macOS 11+ o un Linux moderno
- **Espacio en disco:** unos 400 MB (la app incluye todo lo que necesita — sin descargas extra)
- **Memoria:** cualquier cantidad normal funciona

## Mantenerlo actualizado

Cuando sale una versión nueva, EncodeX te avisa dentro de la app y puede descargar e iniciar la actualización por ti — no hace falta volver a esta página.

## Versiones anteriores

¿Necesitas una versión anterior? Despliega abajo la versión que busques — cada archivo indica su tamaño y su suma SHA-256.

<LatestDownloads older />

## ¿Necesitas ayuda?

Si algo no funciona o tienes una pregunta, envía un correo a **[developer@encodex.in](mailto:developer@encodex.in)** — responderá una persona real.

## Para desarrolladores: compílelo tú mismo

¿Prefieres compilar desde el código fuente? Clona el repositorio y ejecuta:

```bash
git clone https://github.com/Sandeepv68/EncodeX.git
cd EncodeX
npm install
npm run dist
```

El instalador se creará en el directorio `release/`.
