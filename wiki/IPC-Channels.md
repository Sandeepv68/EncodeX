# 🔌 IPC Channels

All channel names are centralized in `src/shared/ipc-channels.ts`. The preload script (`src/preload/index.ts`) exposes everything through `window.electronAPI`.

## 📥 Requests (invoke from renderer)

| Channel               | Arguments                                | Returns                       |
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
| `queue-add`           | `input, output, options, transcoder`     | `string` (job id)             |
| `queue-remove`        | `id`                                     | `void`                        |
| `queue-list`          | —                                        | `QueueJob[]`                  |
| `queue-get-state`     | —                                        | `{ paused, concurrency }`     |
| `queue-cancel-all`    | —                                        | `void`                        |
| `queue-clear-completed` | —                                      | `number` (count removed)      |
| `queue-set-concurrency` | `concurrency`                           | `void`                        |
| `queue-set-when-done` | `config`                                 | `void`                        |
| `queue-move-to`       | `id, toPosition`                         | `boolean`                     |
| `queue-update-options` | `id, options, output?`                  | `boolean`                     |
| `queue-start`         | —                                        | `void`                        |
| `queue-pause`         | —                                        | `void`                        |
| `queue-resume`        | —                                        | `void`                        |
| `queue-export`        | —                                        | `number` (count exported)     |
| `queue-import`        | —                                        | `number` (count imported)     |
| `reveal-file`         | `filePath`                               | `void`                        |
| `set-launch-at-login` | `enabled`                                | `void`                        |
| `player-open`         | `filePath`                               | `number` (generation token)   |
| `player-seek`         | `time`                                   | `number` (generation token)   |
| `player-close`        | —                                        | `void`                        |
| `player-get-frame`    | —                                        | `PlayerFrame \| null`         |
| `extract-waveform`    | `filePath, duration`                     | `WaveformData \| null`        |
| `extract-thumbnails`  | `filePath, duration`                     | `ThumbnailStrip \| null`      |
| `check-for-updates`   | —                                        | `void`                        |
| `download-update`     | —                                        | `void`                        |
| `install-update`      | `installerPath`                          | `void`                        |
| `cancel-download`     | —                                        | `void`                        |
| `open-release-notes`  | `url`                                    | `void`                        |

## 📤 Send-only (renderer to main)

| Channel                    | Payload   |
| -------------------------- | --------- |
| `window-minimize`          | —         |
| `window-maximize-toggle`   | —         |
| `window-close`             | —         |
| `window-confirm-close`     | —         |
| `window-set-always-on-top` | `boolean` |

## 📡 Events (main to renderer)

| Channel                    | Payload                       |
| -------------------------- | ----------------------------- |
| `window-maximized-changed` | `boolean`                     |
| `window-close-requested`   | —                             |
| `conversion-progress`      | `{ input, output, progress }` |
| `queue-added`              | `QueueJob`                    |
| `queue-removed`            | `string` (job id)             |
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
| `update-downloaded`        | `string` (installer path)     |
| `update-error`             | `string` (error message)      |

## 🧩 `window.electronAPI` (contextBridge API)

The preload script exposes all IPC via `window.electronAPI` (typed in `src/renderer/electron-api.d.ts`).

### Invocation methods

- `getPathForFile(file)` — resolve dropped `File` to absolute path
- `selectFile(filters?)` — open file dialog, return path
- `selectFiles(filters?)` — open multi-file dialog, return paths
- `selectOutput()` — open save dialog
- `selectDirectory()` — open directory picker
- `getMediaInfo(filePath, transcoderType)` — probe media file
- `getImageInfo(filePath)` — get EXIF + histograms
- `getImagePreview(filePath)` — downscale preview
- `getImageFileInfo(filePath)` — dimensions + size
- `getVideoPreview(filePath)` — single-frame thumbnail
- `getCapabilities()` — probe available encoders
- `convertFile(input, output, options, transcoderType)` — start conversion
- `pauseConversion()` / `resumeConversion()` / `cancelConversion()`
- `queueAdd(...)` / `queueRemove(id)` / `queueList()` / `queueCancelAll()`
- `queueGetState()` / `queueClearCompleted()` / `queueSetConcurrency(n)`
- `queueSetWhenDone(config)` / `queueMoveTo(id, pos)` / `queueUpdateOptions(id, opts)`
- `queueStart()` / `queuePause()` / `queueResume()`
- `queueExport()` / `queueImport()`
- `revealFile(filePath)` — open in system file manager
- `setLaunchAtLogin(enabled)` — toggle launch at login
- `playerOpen(filePath)` / `playerSeek(time)` / `playerClose()` / `playerGetFrame()`
- `extractWaveform(filePath, duration)` / `extractThumbnails(filePath, duration)`
- `windowMinimize()` / `windowMaximizeToggle()` / `windowClose()` / `windowCloseConfirmed()`
- `windowSetAlwaysOnTop(flag)`
- `checkForUpdates()` / `downloadUpdate()` / `installUpdate(path)` / `cancelDownload()` / `openReleaseNotes(url)`

### Event listeners (each returns a cleanup function)

- `onWindowCloseRequested(cb)`
- `onWindowMaximizedChange(cb)`
- `onConversionProgress(cb)`
- `onQueueAdded(cb)` / `onQueueRemoved(cb)` / `onQueueStatusChange(cb)` / `onQueueProgress(cb)` / `onQueueCancelled(cb)` / `onQueueMoved(cb)`
- `onPlayerFrame(cb)` / `onPlayerAudio(cb)` / `onPlayerError(cb)`
- `onLogMessage(cb)`
- `onUpdateAvailable(cb)` / `onUpdateNotAvailable(cb)` / `onUpdateProgress(cb)` / `onUpdateDownloaded(cb)` / `onUpdateError(cb)`
