# Gestor de actualizaciones

## Resumen

Implementa un gestor de actualizaciones integrado personalizado (Opción C) que revisa GitHub Releases en busca de versiones nuevas, notifica al usuario, descarga el instalador específico de la plataforma dentro de la app con reporte de progreso y lanza el instalador al terminar.

## Arquitectura

```
GitHub Releases API
       |
  [main/updater.ts]   fetches /releases/latest, compares versions, downloads
       |
  [main/ipc/updater.ts]  registers IPC handlers + pushes events to renderer
       |
  [preload/index.ts]  exposes checkForUpdates / downloadUpdate / events
       |
  [renderer/stores/updateStore.ts]  Zustand state for update flow
       |
  [renderer/components/UpdateDialog.tsx]  MUI Dialog with progress bar
```

## Archivos a crear

| Archivo | Propósito |
|------|---------|
| `src/main/updater.ts` | Lógica central de actualización: comparación de versiones, obtención de releases, selección de assets, descarga con progreso, lanzamiento del instalador |
| `src/main/ipc/updater.ts` | Registro de manejadores IPC para los canales de actualización |
| `src/renderer/stores/updateStore.ts` | Store Zustand para el estado de actualización (checking, available, downloading, progress, downloaded, error) |
| `src/renderer/components/UpdateDialog.tsx` | Diálogo modal que muestra el estado de actualización, el progreso de descarga y el botón de instalación |
| `src/renderer/styles/UpdateDialog.styles.ts` | Componentes con estilo para el diálogo de actualización |

## Archivos a modificar

| Archivo | Cambio |
|------|--------|
| `src/shared/types.ts` | Añadir las interfaces `UpdateInfo`, `UpdateAsset`, `UpdateProgress` |
| `src/shared/ipc-channels.ts` | Añadir constantes de los canales IPC de actualización |
| `src/shared/log-constants.ts` | Añadir constantes de mensajes de log de actualización |
| `src/main/ipc/handlers.ts` | Registrar los manejadores del updater |
| `src/preload/index.ts` | Exponer los métodos del puente de actualización y suscripciones a eventos |
| `src/renderer/electron-api.d.ts` | Declarar los tipos de la API de actualización en `ElectronAPI` |
| `src/renderer/pages/About.tsx` | Añadir el botón "Buscar actualizaciones" |
| `src/renderer/App.tsx` | Montar `UpdateDialog` globalmente |
| `src/test-setup.ts` | Añadir mocks de la API de actualización al stub global de electronAPI |
| `e2e/mocks/preload.js` | Añadir métodos de la API de actualización al preload mock |
| `e2e/mocks/main-store.js` | Sin cambios necesarios (el estado de actualización es efímero) |

## Canales IPC

| Canal | Dirección | Propósito |
|---------|-----------|---------|
| `check-for-updates` | renderer -> main | Disparar la búsqueda de actualizaciones |
| `download-update` | renderer -> main | Iniciar la descarga del asset coincidente |
| `install-update` | renderer -> main | Lanzar el instalador descargado |
| `cancel-download` | renderer -> main | Cancelar la descarga en curso |
| `open-release-notes` | renderer -> main | Abrir la página del release en el navegador |
| `update-available` | main -> renderer | Notificar que hay una versión nueva disponible |
| `update-not-available` | main -> renderer | Notificar que la app está al día |
| `update-progress` | main -> renderer | Enviar el progreso de descarga |
| `update-downloaded` | main -> renderer | Notificar que la descarga terminó |
| `update-error` | main -> renderer | Enviar un error de actualización |

## Comparación de versiones

- Comparación semver simple: dividir por `.`, comparar numéricamente.
- Elimina sufijos pre-release (p. ej. `-beta.0`) para comparar.
- Devuelve true si la versión remota es estrictamente mayor que la local.

## Lógica de selección de assets

1. Filtrar los assets del release por extensión de plataforma:
   - `win32` -> `.exe`
   - `darwin` -> `.dmg`
   - `linux` -> `.AppImage`
2. Dentro de la plataforma, emparejar arquitectura:
   - `x64` -> el nombre de archivo contiene `x64`
   - `arm64` -> el nombre de archivo contiene `arm64`
   - `ia32` -> el nombre de archivo contiene `ia32`
3. Recurrir al primer asset que coincida con la plataforma si no hay coincidencia de arquitectura.

## Flujo de descarga

1. El renderer invoca el IPC `download-update`.
2. El proceso principal descarga a `app.getPath('temp')/EncodeX-updater/`.
3. El progreso se envía vía `update-progress` cada ~300ms.
4. Al completarse, se envía `update-downloaded` con la ruta del instalador.
5. El renderer muestra el botón "Instalar y reiniciar".
6. Al pulsarlo, el proceso principal lanza el instalador mediante `shell.openPath()` + `app.quit()`.

## Estados de la UI

| Estado      | Qué muestra el diálogo |
|-------|-------------|
| `idle` | (diálogo oculto) |
| `checking` | Spinner + "Buscando actualizaciones..." |
| `available` | Información de versión, enlace a notas del release, botón Descargar |
| `not-available` | Mensaje "Ya estás al día", botón Cerrar |
| `downloading` | Barra de progreso con porcentaje + velocidad |
| `downloaded` | "Actualización lista para instalar" + botón Instalar y reiniciar |
| `error` | Mensaje de error + botones Reintentar / Cerrar |

## Estrategia de pruebas

- Unitarias: función de comparación de versiones, función de selección de assets.
- Manual: publicar un tag/release de prueba superior a `1.0.0-beta.0` y verificar
  el flujo completo búsqueda -> descarga -> instalación en la plataforma objetivo.
