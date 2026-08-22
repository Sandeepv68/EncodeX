# Update-Manager

## Überblick

Implementiert einen eigenen integrierten Update-Manager (Option C), der GitHub Releases auf neue Versionen prüft, den Benutzer benachrichtigt, den plattformspezifischen Installer in der App mit Fortschrittsanzeige herunterlädt und nach Abschluss den Installer startet.

## Architektur

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

## Zu erstellende Dateien

| Datei | Zweck |
|------|---------|
| `src/main/updater.ts` | Zentrale Update-Logik: Versionsvergleich, Release-Abruf, Asset-Auswahl, Download mit Fortschritt, Installer-Start |
| `src/main/ipc/updater.ts` | Registrierung der IPC-Handler für Update-Kanäle |
| `src/renderer/stores/updateStore.ts` | Zustand-Store für den Update-Zustand (checking, available, downloading, progress, downloaded, error) |
| `src/renderer/components/UpdateDialog.tsx` | Modaler Dialog mit Update-Status, Download-Fortschritt und Installieren-Button |
| `src/renderer/styles/UpdateDialog.styles.ts` | Gestylte Komponenten für den Update-Dialog |

## Zu ändernde Dateien

| Datei | Änderung |
|------|--------|
| `src/shared/types.ts` | Interfaces `UpdateInfo`, `UpdateAsset`, `UpdateProgress` hinzufügen |
| `src/shared/ipc-channels.ts` | Konstanten für Update-IPC-Kanäle hinzufügen |
| `src/shared/log-constants.ts` | Konstanten für Update-Log-Meldungen hinzufügen |
| `src/main/ipc/handlers.ts` | Updater-Handler registrieren |
| `src/preload/index.ts` | Update-Brückenmethoden und Event-Abos bereitstellen |
| `src/renderer/electron-api.d.ts` | Update-API-Typen auf `ElectronAPI` deklarieren |
| `src/renderer/pages/About.tsx` | Button „Nach Updates suchen" hinzufügen |
| `src/renderer/App.tsx` | `UpdateDialog` global mounten |
| `src/test-setup.ts` | Update-API-Mocks zum globalen electronAPI-Stub hinzufügen |
| `e2e/mocks/preload.js` | Update-API-Methoden zum Mock-Preload hinzufügen |
| `e2e/mocks/main-store.js` | Keine Änderung nötig (der Update-Zustand ist ephemeral) |

## IPC-Kanäle

| Channel | Richtung | Zweck |
|---------|-----------|---------|
| `check-for-updates` | renderer -> main | Updatesuche auslösen |
| `download-update` | renderer -> main | Download des passenden Assets starten |
| `install-update` | renderer -> main | Heruntergeladenen Installer starten |
| `cancel-download` | renderer -> main | Laufenden Download abbrechen |
| `open-release-notes` | renderer -> main | Release-Seite im Browser öffnen |
| `update-available` | main -> renderer | Melden, dass eine neue Version verfügbar ist |
| `update-not-available` | main -> renderer | Melden, dass die App aktuell ist |
| `update-progress` | main -> renderer | Download-Fortschritt senden |
| `update-downloaded` | main -> renderer | Melden, dass der Download abgeschlossen ist |
| `update-error` | main -> renderer | Update-Fehler senden |

## Versionsvergleich

- Einfacher Semver-Vergleich: an `.` splitten, numerisch vergleichen.
- Entfernt Pre-release-Suffixe (z. B. `-beta.0`) für den Vergleich.
- Gibt true zurück, wenn die Remote-Version strikt größer als die lokale ist.

## Asset-Auswahllogik

1. Release-Assets nach Plattform-Endung filtern:
   - `win32` -> `.exe`
   - `darwin` -> `.dmg`
   - `linux` -> `.AppImage`
2. Innerhalb der Plattform die Architektur matchen:
   - `x64` -> Dateiname enthält `x64`
   - `arm64` -> Dateiname enthält `arm64`
   - `ia32` -> Dateiname enthält `ia32`
3. Fallback auf das erste zur Plattform passende Asset, wenn kein Architektur-Match gefunden wird.

## Download-Ablauf

1. Der Renderer ruft das IPC `download-update` auf.
2. Der Hauptprozess lädt nach `app.getPath('temp')/EncodeX-updater/` herunter.
3. Der Fortschritt wird alle ~300 ms via `update-progress` gesendet.
4. Nach Abschluss wird `update-downloaded` mit dem Installer-Pfad gesendet.
5. Der Renderer zeigt den Button „Installieren & neu starten".
6. Beim Klick startet der Hauptprozess den Installer via `shell.openPath()` + `app.quit()`.

## UI-Zustände

| Zustand    | Was der Dialog zeigt |
|-------|-------------|
| `idle` | (Dialog verborgen) |
| `checking` | Spinner + „Suche nach Updates..." |
| `available` | Versionsinfo, Release-Notes-Link, Download-Button |
| `not-available` | Meldung „Du bist auf dem neuesten Stand", Schließen-Button |
| `downloading` | Fortschrittsbalken mit Prozent + Geschwindigkeit |
| `downloaded` | „Update bereit zur Installation" + Installieren-&-Neustart-Button |
| `error` | Fehlermeldung + Wiederholen-/Schließen-Buttons |

## Teststrategie

- Unit: Vergleichsfunktion für Versionen, Funktion zur Asset-Auswahl.
- Manuell: ein Test-Tag/Release höher als `1.0.0-beta.0` veröffentlichen und den
  vollständigen Ablauf Suche -> Download -> Installation auf der Zielplattform prüfen.
