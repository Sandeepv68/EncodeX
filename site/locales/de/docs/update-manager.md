# Update-Manager

## Überblick

EncodeX verwendet einen eigenen integrierten Update-Manager. Er fragt die GitHub-Releases-API nach den veröffentlichten Releases ab, filtert sie nach dem Update-Kanal, zu dem die laufende Version gehört, vergleicht deren semantische Versionen mit der laufenden App, wählt den Installer für die aktuelle Plattform und Architektur aus und lädt ihn in der App mit Fortschrittsanzeige herunter. Ist der Download abgeschlossen, kann der Benutzer sofort installieren und neu starten oder den Installer so einplanen, dass er beim nächsten App-Neustart ausgeführt wird.

Updates werden niemals stillschweigend oder automatisch installiert. Jede Installation wird durch eine Benutzeraktion ausgelöst – entweder aus dem Update-Dialog oder über die Pending-Install-Markierung, die der Benutzer ausdrücklich aktiviert hat.

## Architektur

```mermaid
flowchart TD
    GH["GitHub Releases API"] --> U["main/updater.ts<br/>fetches /releases,<br/>filters by channel, compares semver, downloads"]
    U --> I["main/ipc/updater.ts<br/>registers IPC handlers +<br/>pushes events to renderer"]
    I --> P["preload/index.ts<br/>exposes update methods +<br/>event subscriptions"]
    P --> S["renderer/stores/updateStore.ts<br/>Zustand state for update flow"]
    S --> D2["renderer/components/UpdateDialog.tsx<br/>MUI Dialog with progress bar"]
    U --> M["userData/pending-install.json<br/>install-on-restart marker"]
    M --> B["main/index.ts<br/>applies pending install<br/>before opening windows"]
```

## Implementierungsdateien

| Datei | Rolle |
|------|------|
| `src/main/updater.ts` | Release-Abruf, Semver-Vergleich, Asset-Auswahl, Download, Prüfsummen-Verifikation, Installer-Start, Pending-Install-Markierung |
| `src/main/ipc/updater.ts` | Registrierung der IPC-Handler und Weiterleitung der Update-Events |
| `src/shared/types.ts` | Interfaces `UpdateInfo`, `UpdateAsset`, `UpdateProgress` und `PendingInstall` |
| `src/shared/ipc-channels.ts` | Konstanten der Update-IPC-Kanäle |
| `src/shared/log-constants.ts` | Konstanten für Update-Log-Meldungen |
| `src/main/index.ts` | Führt `autoInstallPendingUpdate()` aus, bevor Splash- und Hauptfenster erstellt werden |
| `src/preload/index.ts` | Stellt Update-Brückenmethoden und Event-Abos bereit |
| `src/renderer/electron-api.d.ts` | Deklariert die Update-API-Typen auf `ElectronAPI` |
| `src/renderer/stores/updateStore.ts` | Zustand-Store für Update-Zustand, Fortschritt und ausstehende Installationen |
| `src/renderer/components/UpdateDialog.tsx` | Modaler Dialog für Verfügbarkeit, Download-Fortschritt und Installationsoptionen |
| `src/renderer/styles/UpdateDialog.styles.ts` | Gestylte Komponenten für den Update-Dialog |
| `src/renderer/pages/About.tsx` | Button „Nach Updates suchen" und Versionsanzeige |
| `src/renderer/App.tsx` | Mountet `UpdateDialog` global |
| `src/test-setup.ts`, `e2e/mocks/preload.js` | Update-API-Mocks für Unit- und E2E-Tests |

## IPC-Kanäle

| Channel | Richtung | Zweck |
|---------|-----------|---------|
| `check-for-updates` | renderer -> main | Updatesuche auslösen |
| `download-update` | renderer -> main | Download des passenden Assets starten |
| `install-update` | renderer -> main | Heruntergeladenen Installer starten und die App beenden |
| `cancel-download` | renderer -> main | Laufenden Download abbrechen |
| `open-release-notes` | renderer -> main | Release-Seite im Systembrowser öffnen |
| `schedule-install-on-restart` | renderer -> main | Markierung speichern, um das heruntergeladene Update beim nächsten Neustart zu installieren |
| `cancel-install-on-restart` | renderer -> main | Markierung für die Installation beim Neustart entfernen |
| `get-pending-install` | renderer -> main | Markierung für die Installation beim Neustart lesen, falls vorhanden |
| `update-available` | main -> renderer | Melden, dass eine neue Version verfügbar ist |
| `update-not-available` | main -> renderer | Melden, dass die App auf dem neuesten Stand ist |
| `update-progress` | main -> renderer | Download-Fortschritt senden |
| `update-downloaded` | main -> renderer | Melden, dass der Download abgeschlossen ist |
| `update-error` | main -> renderer | Update-Fehler senden |

## Versionsvergleich

- Folgt der Semver-Präzedenz 2.0.0, einschließlich Pre-Release-Kennungen.
- Ein führendes `v` und `+build`-Metadaten werden ignoriert; Build-Metadaten beeinflussen die Präzedenz nicht.
- Major, Minor und Patch müssen numerisch sein; eine nicht parsebare Version löst einen Fehler aus, statt stillschweigend konvertiert zu werden.
- Eine stabile Version schlägt eine Pre-Release-Version (`1.0.0` > `1.0.0-beta.1`).
- Pre-Release-Kennungen werden Punkt für Punkt verglichen: numerische Kennungen numerisch, alphanumerische Kennungen lexikalisch, und numerische Kennungen rangieren unter den alphanumerischen.
- Ein Update wird nur angeboten, wenn die Remote-Version strikt größer als die laufende Version ist.

## Update-Kanäle

Der Kanal wird aus der laufenden Version abgeleitet und bestimmt, welche Releases infrage kommen:

| Kanal | Laufende Version | Infrage kommende Releases |
|---|---|---|
| `stable` | keine Pre-Release-Kennung, z. B. `1.0.0` | nur stabile Releases |
| `beta` | eine Pre-Release-Kennung, z. B. `1.0.0-beta.5` | Pre-Releases *und* stabile Releases |

Folgen, die man kennen sollte:

- Ein Beta-Build erhält weiterhin Betas und erhält auch das spätere stabile `1.0.0`, sobald es erscheint.
- Ein stabiler Build bekommt niemals ein Pre-Release angeboten.
- Ein **Entwurfs**-Release wird niemandem angeboten. GitHub schließt Entwürfe aus der veröffentlichten Release-Liste aus, sodass ein als Entwurf belassenes Release für den Updater unsichtbar bleibt, bis es veröffentlicht wird.
- GitHubs eigener Endpunkt „latest release" wird bewusst *nicht* verwendet: Er löst auf das neueste Release ohne Entwurfs- und ohne Pre-Release-Status auf, das ein Beta-Build nie überwinden könnte, und ein ohne Pre-Release-Flag veröffentlichtes Beta würde als stabile Release an stabile Nutzer übergeben. Der Updater liest die Release-**Liste** und wendet den Kanalfilter selbst an.
- Der Release-Workflow markiert ein Pre-Release-Tag (`v1.0.0-beta.6`) als GitHub-Pre-Release, sodass Flag und Tag übereinstimmen.

## Asset-Auswahllogik

1. Nur einfache Dateinamen mit der Installer-Endung der Plattform akzeptieren:
   - `win32` -> `.exe`
   - `darwin` -> `.dmg`
   - `linux` -> `.AppImage`
2. Namen mit Pfadtrennern, Traversal-Segmenten oder NUL-Bytes ablehnen.
3. Innerhalb der Plattformmenge bevorzugt ein Asset wählen, dessen Name das aktuelle `process.arch` (`x64`, `arm64`, `ia32`) enthält.
4. Auf das erste plattformpassende Asset zurückfallen, wenn kein Architektur-Match existiert.
5. Download-Weiterleitungen auf GitHub-eigene Hosts festnageln.

## Download- und Installationsablauf

1. Der Renderer ruft `check-for-updates` auf. Der Hauptprozess holt `/releases?per_page=100` mit einem Timeout von 15 Sekunden, einem Antwort-Limit von 4 MB und höchstens 5 Weiterleitungen und filtert die Liste anschließend nach dem Update-Kanal.
2. Das passende Asset wird über `update-available` zurückgegeben.
3. `download-update` streamt den Installer nach `app.getPath('temp')/EncodeX-updater/`. Downloads werden nach 60 Sekunden ohne Chunk abgebrochen; Asset-Größen über 4 GB in den Release-Daten gelten als unbekannt.
4. Der Fortschritt wird über `update-progress` höchstens etwa alle 300 ms als `percent`, `transferred` und `total` gesendet.
5. Beim Abschluss muss die Datei der angegebenen `Content-Length` entsprechen und – sofern das Release einen Digest veröffentlicht – ihrem SHA-256- oder SHA-512-Digest. Eine Abweichung lässt den Download fehlschlagen.
6. `update-downloaded` meldet den Pfad des Installers. Der Benutzer kann installieren und neu starten, die Installation für den nächsten Neustart einplanen oder den Dialog schließen.
7. `install-update` validiert erneut, dass der Pfad ein Installer innerhalb des Update-Verzeichnisses ist, startet ihn mit `shell.openPath()` und beendet die App.
8. `schedule-install-on-restart` schreibt `userData/pending-install.json`. Beim nächsten Start löscht `autoInstallPendingUpdate()` die Markierung, validiert Pfad und Version erneut, startet den Installer und beendet die App, bevor ein Fenster geöffnet wird.

EncodeX-Releases sind nicht code-signiert und nicht notarisiert. Die Digest-Prüfung verifiziert die Integrität, wenn GitHub einen Digest veröffentlicht; sie belegt nicht die Authentizität des Herausgebers.

Unter Windows kann das Starten des heruntergeladenen Installers die SmartScreen-Warnung „Windows protected your PC" mit der Meldung „Unbekannter Herausgeber" auslösen. Das ist bei einem unsignierten Build erwartet und bedeutet nicht, dass der Download beschädigt ist; der Benutzer klickt auf **Weitere Infos** und dann auf **Trotzdem ausführen**. Auch SmartScreen kann die Authentizität des Herausgebers nicht belegen, da der Build keine Code-Signatur trägt. Unter macOS entspricht dem der Gatekeeper-Block beim ersten Start: Rechtsklick auf die App wählen und **Öffnen** (oder die Quarantäne mit `xattr -cr /Applications/EncodeX.app` entfernen).

## UI-Zustände

| Zustand | Was der Dialog zeigt |
|-------|-------------|
| `idle` | Dialog verborgen |
| `checking` | Spinner + „Suche nach Updates..." |
| `available` | Versionsinfo, Release-Notes-Link, Download-Button |
| `not-available` | Meldung „Du bist auf dem neuesten Stand", Schließen-Button |
| `downloading` | Bestimmter Fortschrittsbalken mit Prozent und übertragenen/gesamten Bytes |
| `downloaded` | „Update bereit zur Installation" mit den Optionen „Installieren & neu starten" und „Beim Neustart installieren" |
| `restart-scheduled` | Hinweis, dass das Update beim nächsten Neustart installiert wird, sowie Abbrechen und „Installieren & neu starten" |
| `error` | Fehlermeldung + Wiederholen-/Schließen-Buttons |

## Teststrategie

- Unit: Semver-Vergleich, Update-Kanal-Auswahl, Asset-Auswahl, Download-Validierung, Prüfsummen-Behandlung und die Pending-Install-Markierung.
- Tests mit feindlichen Eingaben: `src/main/__tests__/updater-hostile.test.ts` fixiert das Verhalten bei Path-Traversal, Weiterleitungen, abgebrochenen Downloads und Digest-Abweichungen.
- IPC-Tests: Handler-Registrierung und Event-Weiterleitung in `src/main/ipc/__tests__/updater.test.ts`.
- Manuell: ein Test-Tag veröffentlichen, der neuer als `1.0.0-beta.5` ist, ihn als **Pre-Release** markieren, den Entwurf veröffentlichen, damit er den Entwurfsstatus verlässt, und Suche -> Download -> Installation sowie den Ablauf „Installation beim Neustart" prüfen. Anschließend von einem stabilen Build aus verifizieren, dass dasselbe Pre-Release *nicht* angeboten wird.
