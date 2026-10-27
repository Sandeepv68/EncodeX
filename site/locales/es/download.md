# Descargar EncodeX — Gratis y de código abierto

EncodeX es **gratis y de código abierto** y funciona en Windows, Mac y Linux. Es una interfaz gráfica de FFmpeg sin cuentas, sin marcas de agua y sin límites de tamaño: todo funciona en tu computadora.

::: tip ¿Primera vez aquí? Esto es lo que sigue
Instala la aplicación, arrastra un video o una imagen a la ventana, elige un perfil (como MP4 o "archivo más pequeño") y pulsa **Convertir** — ya está. Todo se ejecuta localmente en tu computadora.

- **¿Nuevo en EncodeX?** Mira [ejemplos de lo que puedes hacer](/es/use-cases) o [explora las herramientas](/es/features).
- **¿Atascado?** La mayoría de las conversiones solo necesitan soltar un archivo + un clic en un perfil. La tarjeta "Cómo empezar" de tu panel te guía al elegir un objetivo.
:::

## <OsIcon name="windows" /> Windows

**Windows 10/11 · 64-bit** — lo adecuado para casi todos.

<LatestDownloads platform="windows" />

**¿No sabes? Descarga x64 — Recomendado para la mayoría de las PCs con Windows.**

**Para instalar:** abre el archivo descargado y sigue los pasos en pantalla.

¿No sabes cuál elegir? Ve con el recomendado — si no coincide, Windows te lo dirá. En **Otras descargas** también encontrarás una compilación **Windows ARM64** (portátiles Snapdragon).

### Otras plataformas

[macOS](#mac) · [Linux](#linux) · [Windows ARM64](#windows)

## <OsIcon name="apple" /> Mac

<LatestDownloads platform="macos" />

**Para instalar:** abre el archivo `.dmg` descargado y arrastra EncodeX a tu carpeta de Aplicaciones.

**¿No sabes qué Mac tienes?** Pulsa el logo de Apple (<OsIcon name="apple" label="Logo de Apple" />) en la esquina superior izquierda, elige "Acerca de este Mac" y mira la línea "Chip". Si dice "Apple M1" (o M2/M3/M4), elige Apple Silicon. Si dice "Intel", elige Intel.

::: warning Primer inicio en Mac — un paso extra
EncodeX es gratuito y de código abierto, no se vende en la Mac App Store, y sus compilaciones para macOS no están firmadas ni notarizadas por Apple. macOS puede mostrar un mensaje diciendo que la app "no se puede abrir" la primera vez. Para abrirla:

1. Busca EncodeX en tu carpeta de Aplicaciones
2. Mantén pulsada la tecla **Control**, haz clic en la app y elige **Abrir**
3. En el cuadro que aparece, pulsa **Abrir** otra vez

En versiones recientes de macOS puede que no se ofrezca este paso de Control-clic. En ese caso, abre **Ajustes del Sistema → Privacidad y seguridad** y elige **Abrir de todos modos** para EncodeX.

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
- **Espacio en disco:** suficiente para la app y tus archivos convertidos
- **Memoria:** cualquier cantidad normal funciona

EncodeX incluye el motor FFmpeg, así que no instalas FFmpeg ni códecs por separado. Cada conversión ocurre [localmente en tu ordenador](/es/features).

## Mantenerlo actualizado

Cuando sale una versión nueva, EncodeX consulta las versiones de GitHub y te avisa dentro de la app. Tú eliges si descargarla e instalarla, o instalarla en el próximo reinicio. Las actualizaciones no se instalan automáticamente, así que no hace falta volver a esta página.

## Versiones anteriores

¿Necesitas una versión anterior? Despliega abajo la versión que busques — cada archivo indica su tamaño y su suma SHA-256.

<LatestDownloads older />

## ¿Necesitas ayuda?

Si algo no funciona o tienes una pregunta, envía un correo a **[developer@encodex.in](mailto:developer@encodex.in)** — responderá una persona real.

## Privacidad

Entendemos que la confianza importa. Cada conversión ocurre en tu computadora y tus archivos nunca se suben ni se almacenan en un servidor. Los informes de errores y los datos de uso están activados de forma predeterminada, y puedes desactivarlos en Ajustes. Lee la [política de privacidad completa](/es/privacy).

## Seguridad

Cada versión publica [sumas de verificación SHA-256](/es/security) junto a los instaladores, y si encuentras un problema, puedes reportarlo de forma privada. Las compilaciones de versión no están firmadas. Consulta la [página de seguridad](/es/security) para más detalles.

## Para desarrolladores: compílelo tú mismo

¿Prefieres compilar desde el código fuente? Clona el repositorio y ejecuta:

```bash
git clone https://github.com/Sandeepv68/EncodeX.git
cd EncodeX
npm install
npm run dist
```

El instalador se creará en el directorio `release/`.
