# Prozesse, Build-System & Start

## Prozessmodell

### Hauptprozess (`src/main/`)

Node.js-Umgebung. Besitzt den Anwendungs-Lebenszyklus und alle privilegierten Fähigkeiten:

- Erstellt die Splash- und Haupt-`BrowserWindow`s und registriert IPC-Handler (`index.ts`).
- Beherbergt den CLI-Einstiegspunkt (`cli/`).
- Löst den FFmpeg/FFprobe-Binärpfad auf und erkennt Encoder-Fähigkeiten (`capabilities.ts`, `process-utils.ts`).
- Implementiert die Transcoder-Kerne (`transcoders/`).
- Betreibt die konkurrenzlimitierte Batch-Warteschlange (1-4 parallele Jobs) (`queue/job-queue.ts`).
- Dekodiert Videoframes und Audio-PCM für den integrierten Player (`player/frame-decoder.ts`).
- Extrahiert Wellenformen und Thumbnail-Montagen (`timeline/timeline-media.ts`).
- Liest EXIF-Daten, Histogramme, Bildabmessungen und Vorschauen (`image-*.ts`, `video-preview.ts`).
- Brückt die Renderer-`console`-Ausgabe in das Log-System (`patchConsole` in `index.ts`).

### Preload-Skript (`src/preload/index.ts`)

Läuft in einem isolierten Kontext. Verwendet `contextBridge.exposeInMainWorld('electronAPI', api)`, um dem Renderer eine kuratierte, typisierte API bereitzustellen. Jede Methode ist ein dünner Wrapper um `ipcRenderer.invoke` (Request/Response) oder `ipcRenderer.send` (Fire-and-forget), und jedes Event-Abo gibt eine Cleanup-Funktion zurück, die seinen Listener entfernt. Nichts anderes aus Electron oder Node gelangt zum Renderer.

### Renderer-Prozess (`src/renderer/`)

Browser-Umgebung, in der Entwicklung von Vite serviert, in Produktion aus `dist/renderer/index.html` geladen. Reines React — keine Node-APIs. Interagiert nur über `window.electronAPI` (typisiert in `electron-api.d.ts`) mit dem Hauptprozess.

### Geteilte Ebene (`src/shared/`)

Reines TypeScript, von allen drei Prozessen importiert. Enthält das IPC-Kanal-Register, Domänentypen, das Fehlersystem, den Logger, Konstanten, Codec-Listen, Validierungs-Helper und Log-Meldungs-Konstanten. Da `package.json` keine separaten Paketgrenzen nutzt, wird dieses Verzeichnis über relative Imports von jeder Prozesswurzel referenziert.

## Build-System

Drei TypeScript-Projekte plus Vite erzeugen drei Ausgabeordner:

| Skript                   | Kompiliert                  | Ausgabe           |
| ------------------------ | --------------------------- | ----------------- |
| `build:renderer`         | `vite build`                | `dist/renderer/`  |
| `build:main`             | `tsc -p tsconfig.main.json` | `dist/main/`      |
| `build:preload`          | `tsc -p tsconfig.preload.json` | `dist/preload/` |

`npm run build` führt alle drei nacheinander aus. Der Hauptprozess lädt das Preload aus `dist/preload/index.js` und den Renderer aus `dist/renderer/index.html` (Produktion) oder dem Vite-Dev-Server (Entwicklung, Flag `--dev` oder `NODE_ENV=development`).

Electron-builder verpackt die App für Windows (NSIS), macOS (DMG) und Linux (AppImage) und bündelt `ffmpeg-static` und `ffprobe-static` als `extraResources`, sodass die Binaries mit der App reisen. Der CI-Release-Workflow lädt die vorgebauten Binaries für jede Zielplattform/-Architektur via `scripts/fetch-media-binaries.mjs` herunter.

### Binär-Auflösung

Die gesamte FFmpeg/FFprobe-Binärauflösung ist in `src/main/media-binaries.ts` zentralisiert (`getFfmpegPath` / `getFfprobePath`) und wird von jedem Transcoder, dem Frame-Decoder, Timeline-Media, Bild-/Video-Vorschau und der CLI genutzt. Die Fallback-Kette ist:

1. **Gepackte App**: die als `extraResources` gebündelten Binaries unter dem Electron-`resources`-Verzeichnis (`resources/ffmpeg-static/...` und `resources/ffprobe-static/...`, letzteres mit dem plattform-/architekturspezifischen Unterpfad).
2. **Ungepackt (Dev/CLI/Tests)**: die installierten Binaries `node_modules/ffmpeg-static` und `node_modules/ffprobe-static` (aufgelöst über den `import`-Schlüssel in der `exports`-Map jedes Pakets, damit es auch aus ESM funktioniert).
3. Der Systembefehl (`ffmpeg` / `ffprobe`) aus dem `PATH`.

## Startsequenz

1. `main/index.ts` läuft. Es prüft `process.argv` in `isCliMode()`.
2. **CLI-Modus** (explizit `--cli`/`--help`, oder >=2 positionale Argumente): registriert keine Fenster. Bei `app.whenReady()` ruft es `runCli()` auf und beendet sich mit `SUCCESS`- oder `ERROR`-Code.
3. **GUI-Modus**: aktiviert den Switch `autoplay-policy`, erstellt ein nicht-interaktives Splash-Fenster (sofort sichtbar), dann das rahmenlose Hauptfenster (`show: false`).
4. `registerIpcHandlers(mainWindow)` verdrahtet alle IPC-Module; `patchConsole` ersetzt `console.*`, damit Hauptprozess-Logs über den Kanal `log-message` an den Renderer weitergeleitet werden.
5. Das Hauptfenster wird bei `ready-to-show` gezeigt, woraufhin die Splash geschlossen wird.
6. In Produktion wird der Renderer aus `dist/renderer/index.html` geladen; in Entwicklung von `http://localhost:5173` mit offenen DevTools.

## CLI-Modus

`src/main/cli/cli.ts` nutzt **commander** mit Subcommands. Wenn `runCli()` ausgeführt wird:

1. Ein Legacy-Shim mappt flache Nutzung (`encodex in.mp4 out.mp4` -> `convert`, `encodex --info in.mp4` -> `info`) auf das passende Subcommand.
2. Jedes Subcommand parst seine eigenen Optionen plus geteilte Globals (`--transcoder`, `--theme`, `--verbose`, `--quiet`, `--no-color`, `--json`, `--timeout`).
3. `info`/`capabilities` geben standardmäßig menschenlesbare Tabellen aus, mit `--json` JSON.
4. `convert`/`compress`/`extract-audio`/`batch` bauen ein `ConversionOptions`-Objekt und rufen `transcoder.convert(...)` auf (batch treibt eine In-Memory-`JobQueue` mit einem `MultiBar` an).
5. Der Fortschritt geht nach `stdout` (mit Watchdog-Timeout), Status-/Erfolgszeilen respektieren das Routing von `--json`/`--quiet`/`--verbose`, und der Prozess endet über `mapCliErrorToExitCode` (usage=2, abgebrochen=3, nicht gefunden=4, timeout=5, Erfolg=0).

Die CLI nutzt exakt dieselbe Transcoder-Pipeline wie die GUI — es gibt keinen separaten Encoding-Pfad zu pflegen.

## Geteilte Code-Ebene

Die wichtigste Architekturentscheidung ist, dass alle prozessübergreifenden Verträge in `src/shared/` leben:

- **`types.ts`** — `ConversionOptions`, `MediaInfo`, `MediaStreamInfo`, `QueueJob`, `ConversionProgress`, `PlayerFrame`, `PlayerAudioChunk`, `WaveformData`, `ThumbnailStrip`, `EncoderCapabilities`, `LogEntry`, `FileItem`, `ConversionOperation`, `UpdateInfo`, `UpdateAsset`, `UpdateProgress`.
- **`ipc-channels.ts`** — das Konstantenobjekt `IPC`, die einzige Quelle der Wahrheit für jede Kanal-Zeichenkette. Main, preload und renderer importieren alle daraus, sodass ein Kanalname nie zwischen Prozessen driften kann.
- **`errors.ts`** — das typisierte Fehlersystem (siehe [Fehlerbehandlung](/de/docs/architecture-renderer#error-handling)).
- **`constants.ts` / `app-constants.ts`** — numerische Limits und UI-Layoutwerte (Fenstergrößen, Waveform-Buckets, Thumbnail-Abmessungen, Fehlerhistorien-Limit usw.).
- **`transcoder-constants.ts` / `hwaccel-settings.ts`** — FFmpeg-Flags, Defaults, Progress-Muster und Hardwarebeschleunigungs-Einstellungen.
- **`media-options.ts` / `codec-containers.ts` / `codec-classification.ts`** — die kuratierten Listen von 51 Video-Codecs, 27 Audio-Codecs, 56 Pixelformaten, Container-Kompatibilitätsregeln und Codec-Familien-Helfern.
- **`validation.ts`** — reine Funktionen zur Validierung von Zeit/Skalierung/Bitrate/Bereich, genutzt sowohl von den Renderer-Formularen als auch der CLI.
- **`logger.ts` / `log-constants.ts`** — ein zeitgestempelter Logger plus ~406 geteilte Log-Meldungsvorlagen, damit Logs prozessübergreifend konsistent bleiben.
