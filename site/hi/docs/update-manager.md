# अपडेट मैनेजर

## Overview

कस्टम इन-ऐप अपडेट मैनेजर (विकल्प C) का implementation जो new releases के लिए GitHub Releases check करता है, user को notify करता है, platform-specific installer in-app real-time progress reporting के साथ download करता है, और completion पर installer launch करता है।

## Architecture

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

## Files to create

| File | Purpose |
|------|---------|
| `src/main/updater.ts` | Core update logic: version comparison, release fetching, asset selection, download with progress, launching installer |
| `src/main/ipc/updater.ts` | IPC handler registration for update channels |
| `src/renderer/stores/updateStore.ts` | Zustand store for update state (checking, available, downloading, progress, downloaded, error) |
| `src/renderer/components/UpdateDialog.tsx` | Modal dialog showing update status, download progress, and install button |
| `src/renderer/styles/UpdateDialog.styles.ts` | Styled components for the update dialog |

## Files to modify

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `UpdateInfo`, `UpdateAsset`, `UpdateProgress` interfaces |
| `src/shared/ipc-channels.ts` | Add update IPC channel constants |
| `src/shared/log-constants.ts` | Add updater log message constants |
| `src/main/ipc/handlers.ts` | Register updater handlers |
| `src/preload/index.ts` | Expose update bridge methods and event subscriptions |
| `src/renderer/electron-api.d.ts` | Declare update API types on `ElectronAPI` |
| `src/renderer/pages/About.tsx` | Add "Check for Updates" button |
| `src/renderer/App.tsx` | Mount `UpdateDialog` globally |
| `src/test-setup.ts` | Add update API mocks to the global electronAPI stub |
| `e2e/mocks/preload.js` | Add update API methods to the mocked preload |
| `e2e/mocks/main-store.js` | No changes needed (update state is transient) |

## IPC channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `check-for-updates` | renderer -> main | Trigger an update check |
| `download-update` | renderer -> main | Start downloading the matched asset |
| `install-update` | renderer -> main | Launch the downloaded installer |
| `cancel-download` | renderer -> main | Abort an in-progress download |
| `open-release-notes` | renderer -> main | Open the release page in a browser |
| `update-available` | main -> renderer | Notify that a newer version exists |
| `update-not-available` | main -> renderer | Notify that the app is current |
| `update-progress` | main -> renderer | Push download progress |
| `update-downloaded` | main -> renderer | Notify that the download completed |
| `update-error` | main -> renderer | Push an update failure |

## Version comparison

- Simple semver comparison: split on `.`, numeric compare.
- Pre-release suffixes (e.g. `-beta.0`) stripped before comparing.
- Returns true only when the remote version is strictly greater.

## Asset selection logic

1. Filter release assets by platform extension:
   - `win32` -> `.exe`
   - `darwin` -> `.dmg`
   - `linux` -> `.AppImage`
2. Within the platform, match architecture:
   - `x64` -> filename contains `x64`
   - `arm64` -> filename contains `arm64`
   - `ia32` -> filename contains `ia32`
3. If no architecture match, fall back to the first platform-matching asset.

## Download flow

1. Renderer calls the `download-update` IPC.
2. Main process downloads to `app.getPath('temp')/EncodeX-updater/`.
3. Progress is pushed via `update-progress` every ~300ms.
4. On completion, `update-downloaded` is emitted with the installer path.
5. Renderer shows an "Install & Restart" button.
6. On click, the main process launches the installer via `shell.openPath()` then calls `app.quit()`.

## UI states

| State        | Dialog shows |
|--------------|--------------|
| `idle` | (dialog hidden) |
| `checking` | Spinner + "Checking for updates..." |
| `available` | Version info, release notes link, Download button |
| `not-available` | "You're up to date" message, Close button |
| `downloading` | Progress bar with percentage and speed |
| `downloaded` | "Update ready to install" + Install & Restart button |
| `error` | Error message + Retry / Close buttons |

## Testing strategy

- Unit tests: version comparison function, asset selection function.
- Manual testing: publish a test tag/release above `1.0.0-beta.0` and verify the full check -> download -> install flow on each target platform.
