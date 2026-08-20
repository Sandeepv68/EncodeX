# 🔄 Update Manager

Custom in-app update manager that checks GitHub Releases for new versions, downloads the platform-specific installer, and launches it on completion.

## 🏗️ Architecture

```
About page → updateStore.checkForUpdates → electronAPI.checkForUpdates
→ updater.ts fetches GitHub Releases API → compares semver versions
→ send(update-available / update-not-available) → updateStore → UpdateDialog
→ electronAPI.downloadUpdate → updater.ts downloads installer to temp dir
→ send(update-progress) → updateStore → progress bar
→ send(update-downloaded) → updateStore → "Install & Restart" button
→ electronAPI.installUpdate → shell.openPath(installer) + app.quit()
```

## 📁 Key Files

| File | Role |
| ---- | ---- |
| `src/main/updater.ts` | Core logic: version comparison, release fetching, asset selection, download, install |
| `src/main/ipc/updater.ts` | IPC handler registration |
| `src/renderer/stores/updateStore.ts` | Zustand store for update lifecycle state |
| `src/renderer/components/UpdateDialog.tsx` | UI dialog for check/download/install flow |
| `src/renderer/pages/About.tsx` | "Check for Updates" button |
| `src/shared/types.ts` | `UpdateInfo`, `UpdateAsset`, `UpdateProgress` types |
| `src/shared/ipc-channels.ts` | 10 update channel constants |

## 🔌 IPC Channels

| Channel | Direction | Purpose |
| ------- | --------- | ------- |
| `check-for-updates` | renderer -> main | Trigger update check |
| `download-update` | renderer -> main | Start downloading installer |
| `install-update` | renderer -> main | Launch installer + quit app |
| `cancel-download` | renderer -> main | Cancel in-progress download |
| `open-release-notes` | renderer -> main | Open release notes URL in browser |
| `update-available` | main -> renderer | New version available |
| `update-not-available` | main -> renderer | Already up to date |
| `update-progress` | main -> renderer | Download progress (bytes, percent) |
| `update-downloaded` | main -> renderer | Download complete, ready to install |
| `update-error` | main -> renderer | Error during check or download |

## 🔢 Version Comparison

Uses semver with pre-release suffix stripping. The updater fetches `https://api.github.com/repos/Sandeepv68/EncodeX/releases/latest`, parses the tag as semver, and compares against `app.getVersion()`.

## 🎯 Asset Selection

Automatically selects the platform-appropriate installer:

| Platform | Asset pattern |
| -------- | ------------- |
| Windows  | `*.exe` (NSIS installer) |
| macOS    | `*.dmg` |
| Linux    | `*.AppImage` |

## 🖼️ UI States

The `UpdateDialog` component handles these states:

1. **Idle** — "Check for Updates" button
2. **Checking** — Loading spinner
3. **Available** — Version info + "Download" button + release notes link
4. **Downloading** — Progress bar with percentage
5. **Downloaded** — "Install & Restart" button
6. **Error** — Error message + retry button
7. **Not Available** — "You're up to date" message

## 🧪 Testing

- Unit tests: `src/main/ipc/__tests__/handlers.test.ts` (updater mock)
- E2E: Update dialog state transitions covered via mock preload (`e2e/mocks/preload.js`)
- All updater API methods mocked in `src/test-setup.ts` for renderer tests
