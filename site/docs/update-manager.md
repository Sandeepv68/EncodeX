# Update Manager

EncodeX includes a custom in-app update manager that checks GitHub Releases for new versions, notifies the user, downloads the platform-specific installer with progress reporting, and launches the installer on completion.

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

## IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `check-for-updates` | renderer -> main | Trigger update check |
| `download-update` | renderer -> main | Start downloading the matched asset |
| `install-update` | renderer -> main | Launch the downloaded installer |
| `cancel-download` | renderer -> main | Cancel in-progress download |
| `open-release-notes` | renderer -> main | Open release page in browser |
| `update-available` | main -> renderer | Notify that a new version is available |
| `update-not-available` | main -> renderer | Notify that app is up to date |
| `update-progress` | main -> renderer | Push download progress |
| `update-downloaded` | main -> renderer | Notify download completed |
| `update-error` | main -> renderer | Push update error |

## Version Comparison

- Simple semver comparison: split on `.`, compare numerically
- Strips pre-release suffixes (e.g. `-beta.0`) for comparison
- Returns true if remote version is strictly greater than local

## Asset Selection Logic

1. Filter release assets by platform extension:
   - `win32` -> `.exe`
   - `darwin` -> `.dmg`
   - `linux` -> `.AppImage`
2. Within platform, match architecture:
   - `x64` -> filename contains `x64`
   - `arm64` -> filename contains `arm64`
   - `ia32` -> filename contains `ia32`
3. Fall back to first platform-matched asset if arch match fails

## Download Flow

1. Renderer calls `download-update` IPC
2. Main process downloads to `app.getPath('temp')/EncodeX-updater/`
3. Progress pushed via `update-progress` every ~300ms
4. On completion, `update-downloaded` sent with installer path
5. Renderer shows "Install & Restart" button
6. On click, main process launches installer via `shell.openPath()` + `app.quit()`

## UI States

| State | Dialog Shows |
|-------|-------------|
| `idle` | (dialog hidden) |
| `checking` | Spinner + "Checking for updates..." |
| `available` | Version info, release notes link, Download button |
| `not-available` | "You're up to date" message, Close button |
| `downloading` | Progress bar with percentage + speed |
| `downloaded` | "Update ready to install" + Install & Restart button |
| `error` | Error message + Retry / Close buttons |
