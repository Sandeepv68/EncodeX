# IPC चैनल

सभी IPC चैनल नाम `src/shared/ipc-channels.ts` में `IPC` कॉन्स्टेंट ऑब्जेक्ट पर सेंट्रली डिफ़ाइन होते हैं। मुख्य प्रोसेस `src/main/ipc/handlers.ts` के माध्यम से हैंडलर्स रजिस्टर करती है, और preload स्क्रिप्ट (`src/preload/index.ts`) renderer के लिए एक curated `window.electronAPI` API expose करती है।

## Request/response channels

Renderer -> main, `ipcRenderer.invoke` के माध्यम से; handler promise return करता है।

| Channel | Arguments | Returns |
| ------- | --------- | ------- |
| `select-file` | `{ title?, filters? }` | Path or `null` |
| `select-save-file` | `{ defaultName?, filters? }` | Path or `null` |
| `convert-file` | `(input, output, ConversionOptions, TranscoderType?)` | `{ success, error? }` |
| `get-media-info` | `(path)` | `MediaInfo` |
| `probe-media` | `(path)` | `MediaInfo` (CLI parity) |
| `compress-image` | `(input, output, ImageOptions)` | `{ success }` |
| `extract-audio` | `(input, output, options)` | `{ success }` |
| `queue-add` / `queue-remove` / `queue-clear-completed` / `queue-cancel-all` | job id(s) / – | Updated queue state |
| `queue-start` / `queue-pause` / `queue-resume` | – | Updated queue state |
| `queue-move-to` | `(id, index)` | Updated order |
| `queue-update-options` | `(id, options)` | Updated job |
| `queue-export` | `(defaultName)` | Saved path or `null` |
| `queue-import` | – | Imported jobs or `null` |
| `set-concurrency` | `(n)` | Acknowledgement |
| `set-when-done` | `(action)` | Acknowledgement |
| `check-for-updates` / `download-update` / `install-update` / `cancel-download` | – | Update state transition |
| `open-release-notes` | `(url?)` | Opens browser |

## Send-only channels

Renderer -> main, fire-and-forget `ipcRenderer.send` के माध्यम से।

| Channel | Purpose |
| ------- | ------- |
| `window-minimize` / `window-maximize-toggle` / `window-close` | Custom title bar controls |
| `window-always-on-top` | Toggle pin state |
| `cancel-conversion` | Kill the active transcoder for the window |

## Event channels

Main -> renderer, `webContents.send` के माध्यम से; renderer preload wrapper के माध्यम से subscribe करता है जो unsubscribe function return करता है।

| Channel | Payload | Emitted when |
| ------- | ------- | ------------ |
| `conversion-progress` | `ConversionProgress` | Progress ticks during a conversion |
| `log-message` | `LogEntry` | Any process logs through the shared logger |
| `queue-added` / `queue-removed` / `queue-status-change` / `queue-progress` / `queue-cancelled` | Job snapshots | Batch queue lifecycle events |
| `player-frame` | Raw video frame + timestamp | Player decoder produces frames |
| `player-audio` | PCM audio chunk | Player decoder produces audio |
| `waveform-progress` / `thumbnail-progress` | Percent | Timeline media extraction advances |
| `update-available` / `update-not-available` / `update-progress` / `update-downloaded` / `update-error` | Update payloads | Updater lifecycle |
| `window-close-requested` / `window-confirm-close` | – | Close confirmation flow |

## electronAPI bridge

Preload script केवल निम्नलिखित surface area expose करता है:

- File pickers: `selectFile`, `selectSaveFile`
- Media ops: `convertFile`, `getMediaInfo`, `compressImage`, `extractAudio`, `cutVideo`
- Queue management: `queueAdd`, `queueRemove`, `queueStart`, `queuePause`, `queueResume`, `queueCancelAll`, `queueClearCompleted`, `queueMoveTo`, `queueUpdateOptions`, `queueExport`, `queueImport`, `setConcurrency`, `setWhenDone`
- Window controls: `minimizeWindow`, `maximizeWindow`, `closeWindow`, `setAlwaysOnTop`
- Event subscriptions: `onConversionProgress`, `onLogMessage`, `onQueueEvent*`, `onPlayerFrame`, `onPlayerAudio`, `onWaveformProgress`, `onThumbnailProgress`, `onUpdate*`, `onCloseRequest`
- Updates: `checkForUpdates`, `downloadUpdate`, `installUpdate`, `cancelDownload`

हर event subscription cleanup function return करती है जो listener को remove करती है, इसलिए React effects leak-free unsubscribe हो सकते हैं। Renderer types `src/renderer/electron-api.d.ts` में declared हैं और test setup में mirrored stubs के साथ backed हैं।
