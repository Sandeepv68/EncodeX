# Canales IPC y electronAPI

Todos los nombres de canal están centralizados en `src/shared/ipc-channels.ts`.

## Peticiones (invoke desde el renderer)

| Canal                 | Argumentos                               | Devuelve                      |
| --------------------- | ---------------------------------------- | ----------------------------- |
| `select-file`         | `filters?`                               | `string \| null`              |
| `select-files`        | `filters?`                               | `string[]`                    |
| `select-output`       | —                                        | `string \| null`              |
| `select-directory`    | —                                        | `string \| null`              |
| `get-media-info`      | `filePath, transcoderType`               | `MediaInfo`                   |
| `get-image-info`      | `filePath`                               | `ImageExifData \| null`       |
| `get-image-preview`   | `filePath`                               | `string \| null` (data URL)   |
| `get-image-file-info` | `filePath`                               | `ImageFileInfo \| null`       |
| `get-video-preview`   | `filePath`                               | `string \| null` (data URL)   |
| `get-capabilities`    | —                                        | `EncoderCapabilities \| null` |
| `convert-file`        | `input, output, options, transcoderType` | `void`                        |
| `cancel-conversion`   | —                                        | `void`                        |
| `pause-conversion`    | —                                        | `void`                        |
| `resume-conversion`   | —                                        | `void`                        |
| `queue-add`           | `input, output, options, transcoder`     | `string` (id del trabajo)             |
| `queue-remove`        | `id`                                     | `void`                        |
| `queue-list`          | —                                        | `QueueJob[]`                  |
| `queue-get-state`     | —                                        | `{ paused, concurrency }`     |
| `queue-cancel-all`    | —                                        | `void`                        |
| `queue-clear-completed` | —                                      | `number` (cantidad eliminada)      |
| `queue-set-concurrency` | `concurrency`                           | `void`                        |
| `queue-set-when-done` | `config`                                 | `void`                        |
| `queue-move-to`       | `id, toPosition`                         | `boolean`                     |
| `queue-update-options` | `id, options, output?`                  | `boolean`                     |
| `queue-start`         | —                                        | `void`                        |
| `queue-pause`         | —                                        | `void`                        |
| `queue-resume`        | —                                        | `void`                        |
| `queue-export`        | —                                        | `number` (cantidad exportada)     |
| `queue-import`        | —                                        | `number` (cantidad importada)     |
| `reveal-file`         | `filePath`                               | `void`                        |
| `set-launch-at-login` | `enabled`                                | `void`                        |
| `player-open`         | `filePath`                               | `number` (token de generación)   |
| `player-seek`         | `time`                                   | `number` (token de generación)   |
| `player-close`        | —                                        | `void`                        |
| `player-get-frame`    | —                                        | `PlayerFrame \| null`         |
| `extract-waveform`    | `filePath, duration`                     | `WaveformData \| null`        |
| `extract-thumbnails`  | `filePath, duration`                     | `ThumbnailStrip \| null`      |
| `check-for-updates`   | —                                        | `void`                        |
| `download-update`     | —                                        | `void`                        |
| `install-update`      | `installerPath`                          | `void`                        |
| `cancel-download`     | —                                        | `void`                        |
| `open-release-notes`  | `url`                                    | `void`                        |

## Send-only (renderer a main)

| Canal                      | Carga útil   |
| -------------------------- | --------- |
| `window-minimize`          | —         |
| `window-maximize-toggle`   | —         |
| `window-close`             | —         |
| `window-confirm-close`     | —         |
| `window-set-always-on-top` | `boolean` |

## Eventos (main a renderer)

| Canal                      | Carga útil                       |
| -------------------------- | ----------------------------- |
| `window-maximized-changed` | `boolean`                     |
| `window-close-requested`   | —                             |
| `conversion-progress`      | `{ input, output, progress }` |
| `queue-added`              | `QueueJob`                    |
| `queue-removed`            | `string` (id del trabajo)             |
| `queue-status-change`      | `QueueJob`                    |
| `queue-progress`           | `{ job, progress }`           |
| `queue-cancelled`          | —                             |
| `queue-moved`              | `{ id, toPosition }`          |
| `player-frame`             | `PlayerFrame`                 |
| `player-audio`             | `PlayerAudioChunk`            |
| `player-error`             | `string`                      |
| `log-message`              | `LogEntry`                    |
| `update-available`         | `UpdateInfo`                  |
| `update-not-available`     | —                             |
| `update-progress`          | `UpdateProgress`              |
| `update-downloaded`        | `string` (ruta del instalador)     |
| `update-error`             | `string` (mensaje de error)      |

## `window.electronAPI` (API contextBridge)

El script preload expone todo el IPC vía `window.electronAPI` (tipado en `src/renderer/electron-api.d.ts`):

### Métodos de invocación

- `getPathForFile(file) -> string`
- `selectFile(filters?) -> Promise<string | null>`
- `selectFiles(filters?) -> Promise<string[]>`
- `selectOutput() -> Promise<string | null>`
- `selectDirectory() -> Promise<string | null>`
- `getMediaInfo(filePath, transcoderType) -> Promise<MediaInfo>`
- `getImageInfo(filePath) -> Promise<ImageExifData | null>`
- `getImagePreview(filePath) -> Promise<string | null>`
- `getImageFileInfo(filePath) -> Promise<ImageFileInfo | null>`
- `getVideoPreview(filePath) -> Promise<string | null>`
- `getCapabilities() -> Promise<EncoderCapabilities | null>`
- `convertFile(input, output, options, transcoderType) -> Promise<void>`
- `pauseConversion() -> Promise<void>`
- `resumeConversion() -> Promise<void>`
- `cancelConversion() -> Promise<void>`
- `queueAdd(input, output, options, transcoder) -> Promise<string>`
- `queueRemove(id) -> Promise<void>`
- `queueList() -> Promise<QueueJob[]>`
- `queueGetState() -> Promise<{ paused, concurrency }>`
- `queueCancelAll() -> Promise<void>`
- `queueClearCompleted() -> Promise<number>`
- `queueSetConcurrency(concurrency) -> Promise<void>`
- `queueSetWhenDone(config) -> Promise<void>`
- `queueMoveTo(id, toPosition) -> Promise<boolean>`
- `queueUpdateOptions(id, options, output?) -> Promise<boolean>`
- `queueStart() -> Promise<void>`
- `queuePause() -> Promise<void>`
- `queueResume() -> Promise<void>`
- `queueExport() -> Promise<number>`
- `queueImport() -> Promise<number>`
- `revealFile(filePath) -> Promise<void>`
- `setLaunchAtLogin(enabled) -> void`
- `playerOpen(filePath) -> Promise<number>` (token de generación)
- `playerSeek(time) -> Promise<number>` (token de generación)
- `playerClose() -> Promise<void>`
- `playerGetFrame() -> Promise<PlayerFrame | null>`
- `extractWaveform(filePath, duration) -> Promise<WaveformData | null>`
- `extractThumbnails(filePath, duration) -> Promise<ThumbnailStrip | null>`
- `windowMinimize() -> void`
- `windowMaximizeToggle() -> void`
- `windowClose() -> void`
- `windowCloseConfirmed() -> void`
- `windowSetAlwaysOnTop(flag) -> void`
- `checkForUpdates() -> Promise<void>`
- `downloadUpdate() -> Promise<void>`
- `installUpdate(installerPath) -> Promise<void>`
- `cancelDownload() -> Promise<void>`
- `openReleaseNotes(url) -> Promise<void>`

### Listeners de eventos (cada uno devuelve una función de limpieza)

- `onWindowCloseRequested(cb) -> () => void`
- `onWindowMaximizedChange(cb) -> () => void`
- `onConversionProgress(cb) -> () => void`
- `onQueueAdded(cb) -> () => void`
- `onQueueRemoved(cb) -> () => void`
- `onQueueStatusChange(cb) -> () => void`
- `onQueueProgress(cb) -> () => void`
- `onQueueCancelled(cb) -> () => void`
- `onQueueMoved(cb) -> () => void`
- `onPlayerFrame(cb) -> () => void`
- `onPlayerAudio(cb) -> () => void`
- `onPlayerError(cb) -> () => void`
- `onLogMessage(cb) -> () => void`
- `onUpdateAvailable(cb) -> () => void`
- `onUpdateNotAvailable(cb) -> () => void`
- `onUpdateProgress(cb) -> () => void`
- `onUpdateDownloaded(cb) -> () => void`
- `onUpdateError(cb) -> () => void`
