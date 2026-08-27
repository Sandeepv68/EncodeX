# Architektur

EncodeX ist ein plattformübergreifendes Multimedia-Konvertierungstool auf Basis von FFmpeg, React, TypeScript und Electron. Es richtet sich an Entwickler, die verstehen möchten, wie die Bausteine zusammenspielen, bevor sie beitragen.

<p align="center"><img src="/images/architecture.webp" alt="EncodeX architecture" width="1024" height="1024" loading="lazy" /></p>

## Designprinzipien

Der Renderer startet nie Prozesse und greift nie direkt auf das Dateisystem zu. Alle privilegierten Operationen (Dateidialoge, FFmpeg-Ausführung, Analyse, Fenstersteuerung) leben im Hauptprozess und werden über IPC erreicht.

- **Drei-Prozess-Trennung** — main, preload und renderer nach Electron-Sicherheitsmodell (`contextIsolation: true`, `nodeIntegration: false`).
- **Eine einzige Abstraktion über Medien-Backends** — das Interface `ITranscoder` verbirgt, ob die Konvertierung über `fluent-ffmpeg`, einen rohen FFmpeg-CLI-Kindprozess oder das BMF-Framework gesteuert wird.
- **IPC als typisierter Vertrag** — jeder Kanal ist eine Konstante in `src/shared/ipc-channels.ts`, und der Renderer kommuniziert nur über die vom Preload-Skript bereitgestellte Brücke `window.electronAPI` mit dem Hauptprozess.
- **Geteilte Typen und Konstanten** — `src/shared/` wird von allen drei Prozessen importiert, damit Interfaces per Konstruktion synchron bleiben.
- **Progressive Erweiterung der UI** — Seiten sind mit `React.lazy` code-gesplittet, der Zustand lebt in Zustand-Stores, und langlaufende Jobs streamen ihren Fortschritt über IPC-Ereignisse zurück.

## Deep Dives

Die vollständige Architektur ist in fokussierte Dokumente aufgeteilt:

| Dokument | Themen |
|----------|--------|
| [Prozesse, Build-System & Start](/de/docs/architecture-processes) | Prozessmodell (main/preload/renderer/shared), Build-System, Binär-Auflösung, Startsequenz, CLI-Modus, geteilte Code-Ebene |
| [Transcoder-Abstraktion & Konvertierung](/de/docs/architecture-transcoders) | Interface `ITranscoder`, FfmpegCore / FFToolCore / BmfCore, gemeinsamer Flag-Aufbau, Hardwarebeschleunigung, Medien-Analyse, Konvertierungsfluss |
| [Renderer, Zustand & Subsysteme](/de/docs/architecture-renderer) | Render-Baum, Seiten, Hooks, Zustand-Stores, Batch-Warteschlange, Video-Player, Timeline-Media, Bildverarbeitung, Fehlerbehandlung, Logging, i18n, Theming, Datenfluss-Referenz |

## Weitere Dokumentation

| Dokument | Themen |
|----------|--------|
| [Funktionsreferenz](/de/docs/features-reference) | Funktionen, unterstützte Medienformate, Codec-Tabellen, Validierungs-Utilities |
| [CLI-Nutzung](/de/docs/cli) | CLI-Nutzung, Subcommands, alle Optionstabellen |
| [IPC-Kanäle](/de/docs/ipc) | IPC-Kanäle (Request/Send-only/Events), electronAPI-Brücke |
| [Tests](/de/docs/testing) | Testsuite (123 Dateien, 1603 Tests), Test-Setup, E2E-Specs |
| [Projektstruktur](/de/docs/project-structure) | Vollständiger Verzeichnisbaum mit Annotationen |
| [Update-Manager](/de/docs/update-manager) | Implementierung des integrierten Update-Managers |

## Repository

Die vollständige Source of Truth liegt im [`docs/`-Ordner](https://github.com/Sandeepv68/EncodeX/tree/main/docs) des Repos. Für einen Projektüberblick, Installationsschritte und den Contribution-Guide siehe das [README auf GitHub](https://github.com/Sandeepv68/EncodeX).
