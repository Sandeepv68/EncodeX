# 🔌 IPC Channels & electronAPI

<!-- drift:ipc-channels=129 -->

All channel names are centralized in `src/shared/ipc-channels.ts`.

## 📥 Requests (invoke from renderer)

| Channel                        | Arguments                                | Returns                                        |
| ------------------------------ | ---------------------------------------- | ---------------------------------------------- |
| `select-file`                  | `filters?`                               | `string \| null`                               |
| `select-files`                 | `filters?`                               | `string[]`                                     |
| `select-folder-files`          | —                                        | `string[]`                                     |
| `select-output`                | —                                        | `string \| null`                               |
| `select-directory`             | —                                        | `string \| null`                               |
| `expand-paths`                 | `paths`                                  | `string[]`                                     |
| `get-media-info`               | `filePath, transcoderType`               | `MediaInfo`                                    |
| `get-image-info`               | `filePath`                               | `ImageExifData \| null`                        |
| `get-image-preview`            | `filePath`                               | `string \| null` (data URL)                    |
| `get-image-file-info`          | `filePath`                               | `ImageFileInfo \| null`                        |
| `get-video-preview`            | `filePath`                               | `string \| null` (data URL)                    |
| `get-capabilities`             | —                                        | `EncoderCapabilities \| null`                  |
| `get-bmf-status`               | —                                        | `BmfStatus`                                    |
| `copilot-plan`                 | `CopilotPlanRequest`                     | `CopilotPlan`                                  |
| `convert-file`                 | `input, output, options, transcoderType` | `void`                                         |
| `cancel-conversion`            | —                                        | `void`                                         |
| `pause-conversion`             | —                                        | `void`                                         |
| `resume-conversion`            | —                                        | `void`                                         |
| `queue-add`                    | `input, output, options, transcoder`     | `string` (job id)                              |
| `queue-remove`                 | `id`                                     | `void`                                         |
| `queue-list`                   | —                                        | `QueueJob[]`                                   |
| `queue-get-state`              | —                                        | `{ paused, concurrency }`                      |
| `queue-cancel-all`             | —                                        | `void`                                         |
| `queue-clear-completed`        | —                                        | `number` (count removed)                       |
| `queue-set-concurrency`        | `concurrency`                            | `void`                                         |
| `queue-set-when-done`          | `config`                                 | `void`                                         |
| `queue-move-to`                | `id, toPosition`                         | `boolean`                                      |
| `queue-update-options`         | `id, options, output?`                   | `boolean`                                      |
| `queue-start`                  | —                                        | `void`                                         |
| `queue-pause`                  | —                                        | `void`                                         |
| `queue-resume`                 | —                                        | `void`                                         |
| `queue-export`                 | —                                        | `number` (count exported)                      |
| `queue-import`                 | —                                        | `number` (count imported)                      |
| `mux-queue-add`                | `MuxQueueAddPayload`                     | `string` (job id)                              |
| `mux-queue-remove`             | `id`                                     | `void`                                         |
| `mux-queue-list`               | —                                        | `MuxQueueJob[]`                                |
| `mux-queue-get-state`          | —                                        | `{ paused, concurrency }`                      |
| `mux-queue-start`              | —                                        | `void`                                         |
| `mux-queue-pause`              | —                                        | `void`                                         |
| `mux-queue-resume`             | —                                        | `void`                                         |
| `mux-queue-cancel-all`         | —                                        | `void`                                         |
| `mux-queue-clear-completed`    | —                                        | `number` (count removed)                       |
| `mux-queue-set-concurrency`    | `concurrency`                            | `void`                                         |
| `mux-queue-move-to`            | `id, toPosition`                         | `boolean`                                      |
| `queue-reveal`                 | `filePath`                               | `void`                                         |
| `set-launch-at-login`          | `enabled`                                | `void`                                         |
| `notifications-get-settings`   | —                                        | `DesktopNotificationsSettings`                 |
| `notifications-set-enabled`    | `enabled`                                | `DesktopNotificationsSettings`                 |
| `player-open`                  | `filePath`                               | `number` (generation token)                    |
| `player-seek`                  | `time`                                   | `number` (generation token)                    |
| `player-close`                 | —                                        | `void`                                         |
| `player-get-frame`             | —                                        | `PlayerFrame \| null`                          |
| `extract-waveform`             | `filePath, duration`                     | `WaveformData \| null`                         |
| `extract-thumbnails`           | `filePath, duration`                     | `ThumbnailStrip \| null`                       |
| `check-for-updates`            | —                                        | `void`                                         |
| `download-update`              | —                                        | `void`                                         |
| `install-update`               | `installerPath`                          | `void`                                         |
| `cancel-download`              | —                                        | `void`                                         |
| `open-release-notes`           | `url`                                    | `void`                                         |
| `schedule-install-on-restart`  | `installerPath, version`                 | `void`                                         |
| `cancel-install-on-restart`    | —                                        | `void`                                         |
| `get-pending-install`          | —                                        | `PendingInstall \| null`                       |
| `monitoring-get-state`         | —                                        | `{ enabled }`                                  |
| `monitoring-set-enabled`       | `enabled`                                | `{ enabled, backend }`                         |
| `analytics-get-state`          | —                                        | `{ enabled, backend }`                         |
| `analytics-set-enabled`        | `enabled`                                | `{ enabled, backend }`                         |
| `analytics-track-event`        | `event`                                  | `void`                                         |
| `analytics-capture-exception`  | `payload`                                | `void`                                         |
| `analytics-get-posthog-config` | —                                        | `{ projectToken?, host? }`                     |
| `mcp-settings-get`             | —                                        | `McpSettings`                                  |
| `mcp-settings-set`             | `settings`                               | `McpSettings`                                  |
| `mcp-ui-call-tool`             | `{ name?, args? }`                       | `unknown`                                      |
| `mcp-ui-list-views`            | —                                        | `Array<{ viewId, uri, title }>`                |
| `ai-settings-get`              | —                                        | `AiSettingsView`                               |
| `ai-settings-set`              | `update`                                 | `AiSettingsView`                               |
| `ai-connect-test`              | `candidate?`                             | `AiConnectTestResult`                          |
| `ai-models-list`               | `candidate?`                             | `AiModelsListResult`                           |
| `automation-list`              | —                                        | `AutomationDefinition[]`                       |
| `automation-get`               | `id`                                     | `AutomationDefinition \| null`                 |
| `automation-save`              | `definition`                             | `AutomationDefinition`                         |
| `automation-delete`            | `id`                                     | `boolean`                                      |
| `automation-duplicate`         | `{ id, name? }`                          | `AutomationDefinition \| null`                 |
| `automation-import`            | —                                        | `AutomationDefinition \| null` (native dialog) |
| `automation-export`            | `id`                                     | `string \| null` (path, native dialog)         |
| `automation-start`             | `AutomationStartRequest`                 | `string` (run id)                              |
| `automation-cancel`            | `{ runId }`                              | `boolean`                                      |
| `dev-capture-screenshot`       | —                                        | `string` (PNG path)                            |
| `logs-history`                 | —                                        | `LogEntry[]`                                   |

## 📤 Send-only (renderer to main)

| Channel                    | Payload      |
| -------------------------- | ------------ |
| `window-minimize`          | —            |
| `window-maximize-toggle`   | —            |
| `window-close`             | —            |
| `window-confirm-close`     | —            |
| `window-set-always-on-top` | `boolean`    |
| `terms-reject`             | —            |
| `logs-window-open`         | —            |
| `logs-publish`             | `LogEntry[]` |
| `logs-clear`               | —            |

## 📡 Events (main to renderer)

| Channel                    | Payload                               |
| -------------------------- | ------------------------------------- |
| `window-maximized-changed` | `boolean`                             |
| `window-close-requested`   | —                                     |
| `conversion-progress`      | `{ input, output, progress }`         |
| `queue-added`              | `QueueJob`                            |
| `queue-removed`            | `string` (job id)                     |
| `queue-status-change`      | `QueueJob`                            |
| `queue-progress`           | `{ job, progress }`                   |
| `queue-cancelled`          | —                                     |
| `queue-moved`              | `{ id, toPosition }`                  |
| `mux-queue-added`          | `MuxQueueJob`                         |
| `mux-queue-removed`        | `string` (job id)                     |
| `mux-queue-status-change`  | `MuxQueueJob`                         |
| `mux-queue-progress`       | `{ job, progress }`                   |
| `mux-queue-cancelled`      | —                                     |
| `mux-queue-moved`          | `{ id, toPosition }`                  |
| `player-frame`             | `PlayerFrame`                         |
| `player-audio`             | `PlayerAudioChunk`                    |
| `player-error`             | `string`                              |
| `log-message`              | `LogEntry`                            |
| `audit-entry`              | `AuditEntry`                          |
| `automation-status`        | `AutomationProgressEvent`             |
| `automation-progress`      | `AutomationProgressEvent`             |
| `automation-event`         | `AutomationProgressEvent`             |
| `logs-window-state`        | `number \| null` (detached window id) |
| `logs-cleared`             | —                                     |
| `notifications-clicked`    | `{ target }`                          |
| `update-available`         | `UpdateInfo`                          |
| `update-not-available`     | —                                     |
| `update-progress`          | `UpdateProgress`                      |
| `update-downloaded`        | `string` (installer path)             |
| `update-error`             | `string` (error message)              |

## 🧩 `window.electronAPI` (contextBridge API)

The preload script exposes all IPC via `window.electronAPI` (typed in `src/renderer/electron-api.d.ts`):

### Invocation methods

- `getPathForFile(file) -> string`
- `selectFile(filters?) -> Promise<string | null>`
- `selectFiles(filters?) -> Promise<string[]>`
- `selectFolderFiles() -> Promise<FolderSelection>`
- `selectOutput() -> Promise<string | null>`
- `selectDirectory() -> Promise<string | null>`
- `expandPaths(paths) -> Promise<string[]>`
- `copilotPlan(request) -> Promise<CopilotPlan>`
- `getMediaInfo(filePath, transcoderType) -> Promise<MediaInfo>`
- `getImageInfo(filePath) -> Promise<ImageExifData | null>`
- `getImagePreview(filePath) -> Promise<string | null>`
- `getImageFileInfo(filePath) -> Promise<ImageFileInfo | null>`
- `getVideoPreview(filePath) -> Promise<string | null>`
- `getCapabilities() -> Promise<EncoderCapabilities | null>`
- `getBmfStatus() -> Promise<BmfStatus>`
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
- `muxQueueAdd(payload) -> Promise<string>`
- `muxQueueRemove(id) -> Promise<void>`
- `muxQueueList() -> Promise<MuxQueueJob[]>`
- `muxQueueGetState() -> Promise<{ paused, concurrency }>`
- `muxQueueCancelAll() -> Promise<void>`
- `muxQueueClearCompleted() -> Promise<number>`
- `muxQueueSetConcurrency(concurrency) -> Promise<void>`
- `muxQueueStart() -> Promise<void>`
- `muxQueuePause() -> Promise<void>`
- `muxQueueResume() -> Promise<void>`
- `muxQueueMoveTo(id, toPosition) -> Promise<boolean>`
- `revealFile(filePath) -> Promise<void>`
- `setLaunchAtLogin(enabled) -> void`
- `notificationsGetSettings() -> Promise<DesktopNotificationsSettings>`
- `notificationsSetEnabled(enabled) -> Promise<DesktopNotificationsSettings>`
- `playerOpen(filePath) -> Promise<number>` (generation token)
- `playerSeek(time) -> Promise<number>` (generation token)
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
- `scheduleInstallOnRestart(installerPath, version) -> Promise<void>`
- `cancelRestartInstall() -> Promise<void>`
- `getPendingInstall() -> Promise<PendingInstall | null>`
- `rejectTerms() -> void`
- `monitoringGetState() -> Promise<{ enabled }>`
- `monitoringSetEnabled(enabled) -> Promise<{ enabled, backend }>`
- `analyticsGetState() -> Promise<{ enabled, backend }>`
- `analyticsSetEnabled(enabled) -> Promise<{ enabled, backend }>`
- `analyticsTrackEvent(event) -> Promise<void>`
- `analyticsCaptureException(payload) -> Promise<void>`
- `analyticsGetPosthogConfig() -> Promise<{ projectToken?, host? }>`
- `mcpGetSettings() -> Promise<McpSettings>`
- `mcpSetSettings(settings) -> Promise<McpSettings>`
- `mcpUiCallTool({ name?, args? }) -> Promise<unknown>`
- `mcpUiListViews() -> Promise<Array<{ viewId, uri, title }>>`
- `aiGetSettings() -> Promise<AiSettingsView>`
- `aiSetSettings(update) -> Promise<AiSettingsView>`
- `aiConnectTest(candidate?) -> Promise<AiConnectTestResult>`
- `aiListModels(candidate?) -> Promise<AiModelsListResult>`
- `automationList() -> Promise<AutomationDefinition[]>`
- `automationGet(id) -> Promise<AutomationDefinition | null>`
- `automationSave(definition) -> Promise<AutomationDefinition>`
- `automationDelete(id) -> Promise<boolean>`
- `automationDuplicate({ id, name? }) -> Promise<AutomationDefinition | null>`
- `automationImport() -> Promise<AutomationDefinition | null>`
- `automationExport(id) -> Promise<string | null>`
- `automationStart(request) -> Promise<string>`
- `automationCancel(runId) -> Promise<boolean>`
- `captureDevScreenshot() -> Promise<string>`
- `openLogsWindow() -> void`
- `logsGetHistory() -> Promise<LogEntry[]>`
- `logsPublishEntries(entries) -> void`
- `logsClear() -> void`

### Event listeners (each returns a cleanup function)

- `onWindowCloseRequested(cb) -> () => void`
- `onWindowMaximizedChange(cb) -> () => void`
- `onConversionProgress(cb) -> () => void`
- `onQueueAdded(cb) -> () => void`
- `onQueueRemoved(cb) -> () => void`
- `onQueueStatusChange(cb) -> () => void`
- `onQueueProgress(cb) -> () => void`
- `onQueueCancelled(cb) -> () => void`
- `onQueueMoved(cb) -> () => void`
- `onAutomationStatus(cb) -> () => void`
- `onAutomationProgress(cb) -> () => void`
- `onAutomationEvent(cb) -> () => void`
- `onMuxQueueAdded(cb) -> () => void`
- `onMuxQueueRemoved(cb) -> () => void`
- `onMuxQueueStatusChange(cb) -> () => void`
- `onMuxQueueProgress(cb) -> () => void`
- `onMuxQueueCancelled(cb) -> () => void`
- `onMuxQueueMoved(cb) -> () => void`
- `onPlayerFrame(cb) -> () => void`
- `onPlayerAudio(cb) -> () => void`
- `onPlayerError(cb) -> () => void`
- `onLogMessage(cb) -> () => void`
- `onAuditEntry(cb) -> () => void`
- `onLogsWindowState(cb) -> () => void`
- `onLogsCleared(cb) -> () => void`
- `onNotificationClicked(cb) -> () => void`
- `onUpdateAvailable(cb) -> () => void`
- `onUpdateNotAvailable(cb) -> () => void`
- `onUpdateProgress(cb) -> () => void`
- `onUpdateDownloaded(cb) -> () => void`
- `onUpdateError(cb) -> () => void`

## 📦 Remux & Demux IPC

Single-shot remux and demux jobs still use `convert-file` (`CONVERT_FILE`) with the existing `options: ConversionOptions` payload, and ordinary batched work can use `queue-add` (`QUEUE_ADD`).

Queued remux/demux work now has its own mux queue (`mux-queue-*` invokes and events) with `MuxQueueAddPayload` jobs. It reuses the same FFmpeg planning layer and `ConversionProgress` shape as the conversion queue, but keeps its own store, concurrency, and lifecycle. Copilot plans route remux/demux actions to `muxQueueAdd`, and the Batch Queue page hosts a dedicated `MuxQueuePanel`.

### New `ConversionOptions` fields

| Field              | Type           | Notes                                                                                                                                                                                                        |
| ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `map`              | `string[]`     | Explicit `-map` specs for the primary input (index `0`), e.g. `['0:v:0', '0:a:1']`. Replaces FFmpeg's implicit best-stream selection.                                                                        |
| `additionalInputs` | `RemuxInput[]` | Extra inputs appended after the primary, each with its own `map` specs, optional `codec` (`-c:<kind>`), optional `disposition`, optional `syncOffsetSeconds` (`-itsoffset`), and `attachment` for cover art. |
| `chaptersFile`     | `string`       | FFMETADATA chapters file; added as the last input and selected with `-map_chapters <index>`.                                                                                                                 |
| `copyChapters`     | `boolean`      | `true`/absent copies the source chapters (`-map_chapters 0`); `false` drops them (`-map_chapters -1`). Defaults to copy for remux-style jobs. Trimmed copies always drop the source chapters.                |
| `audioSyncSeconds` | `number`       | Signed shift of the primary file's audio relative to its video, applied losslessly by re-reading the primary input and mapping only the shifted audio with `-itsoffset`. Positive = audio plays later.       |

`RemuxInput` input-index contract: primary is `0`, `additionalInputs` occupy `1..N` in array order, and `chaptersFile` takes `N+1`. Remux always appends the audio re-read entry last so its index is deterministic.

Demux adds no option fields either — each extracted stream becomes a normal job whose `output` and codec options are derived from the demux target (copy or convert). See `docs/ARCHITECTURE_TRANSCODERS.md` for the full flag-building rules and `docs/FEATURES.md` for the user-facing behavior.
