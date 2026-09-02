<div align="center">
  <img src="../../assets/banner.png" alt="EncodeX Logo" width="900" />
  <h3>Ein plattformübergreifendes Multimedia-Konvertierungstool auf Basis von FFmpeg, React, TypeScript und Electron.</h3>
</div>

<div align="center">

[![Ask DeepWiki](https://img.shields.io/badge/Ask_DeepWiki-10B981?style=for-the-badge)](https://deepwiki.com/Sandeepv68/EncodeX)
![CI](https://img.shields.io/github/actions/workflow/status/Sandeepv68/EncodeX/ci.yml?style=for-the-badge)
![License](https://img.shields.io/github/license/Sandeepv68/EncodeX?style=for-the-badge)
![Release](https://img.shields.io/github/v/release/Sandeepv68/EncodeX?style=for-the-badge)
![Downloads](https://img.shields.io/github/downloads/Sandeepv68/EncodeX/total?style=for-the-badge&logo=github&logoColor=white)
![Stars](https://img.shields.io/github/stars/Sandeepv68/EncodeX?style=for-the-badge)
![Forks](https://img.shields.io/github/forks/Sandeepv68/EncodeX?style=for-the-badge)
![Watchers](https://img.shields.io/github/watchers/Sandeepv68/EncodeX?style=for-the-badge)
![Issues](https://img.shields.io/github/issues/Sandeepv68/EncodeX?style=for-the-badge)
![Pull Requests](https://img.shields.io/github/issues-pr/Sandeepv68/EncodeX?style=for-the-badge)
![Last Commit](https://img.shields.io/github/last-commit/Sandeepv68/EncodeX?style=for-the-badge)
![Contributors](https://img.shields.io/github/contributors/Sandeepv68/EncodeX?style=for-the-badge)
![Repo Size](https://img.shields.io/github/repo-size/Sandeepv68/EncodeX?style=for-the-badge)
![Languages](https://img.shields.io/github/languages/count/Sandeepv68/EncodeX?style=for-the-badge)
![Top Language](https://img.shields.io/github/languages/top/Sandeepv68/EncodeX?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![MUI](https://img.shields.io/badge/MUI-007FFF?style=for-the-badge&logo=mui&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js%2022-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)

</div>

<div align="center">

[English](../../README.md) | [Deutsch](./README.md) | [Español](../es/README.md) | [Français](../fr/README.md) | [हिन्दी](../hi/README.md) | [Português](../pt/README.md) | [简体中文](../zh/README.md)

</div>

## 👋 Einführung

EncodeX ist ein plattformübergreifendes Multimedia-Konvertierungstool, das die Leistung von FFmpeg in eine moderne, intuitive Desktop-Oberfläche bringt. Gebaut mit Electron, React und TypeScript ermöglicht es dir, Medien zwischen Formaten zu konvertieren, Audio zu extrahieren, Videos zu schneiden und Bilder zu komprimieren – alles über eine aufgeräumte, reaktionsschnelle UI mit Batch-Warteschlange, Hardwarebeschleunigung, CLI-Modus und vollständiger Internationalisierung.

## ✨ Funktionen

- **🔄 Medienkonvertierung** — 51 Video-Codecs, 27 Audio-Codecs, 56 Pixelformate mit Codec-/Bitraten-/Skalierungs-/Qualitätsreglern
- **🎛️ Konvertierungsprofile** — 140+ vorkonfigurierte Voreinstellungen in 8 Kategorien (YouTube, Instagram, TikTok, Apple, Android, ProRes, HLS u. a.) mit individueller Profilestellung und Letzte-Verwendet-Verfolgung
- **⚡ Hardwarebeschleunigung** — NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox, Media Foundation
- **✂️ Videoschneiden** — Frame-genaues Trimmen mit integriertem Player (Rawvideo- + PCM-Pipes, Canvas + Web Audio) und zoombarer Timeline (Wellenform + Thumbnail-Montage)
- **📋 Batch-Warteschlange** — Parallele Verarbeitung (bis zu 4 gleichzeitige Jobs) mit Live-Fortschritt, Fehlern pro Job, Pause/Fortsetzen, Drag-and-Drop-Neuanordnung, Bearbeitung von Job-Optionen, Statusfiltern, JSON-Export/-Import und Energiemaßnahmen nach Abschluss (Herunterfahren/Standby/Ruhezustand)
- **🖼️ Bildkomprimierung** — JPEG/PNG/WebP/BMP/GIF/TIFF mit Qualität/Skalierung, EXIF-Viewer, RGB-/Luma-Histogrammen
- **🎵 Audioextraktion** — Jeder der 27 Audio-Codecs aus jeder Videodatei
- **ℹ️ Medieninfo** — Vollständige Pro-Prüfung pro Stream: Codec, Profil, Auflösung, Farbmetadaten, Bildrate usw.
- **⌨️ CLI-Modus** — Headless-Skripting mit Unterbefehlen (`convert`, `info`, `capabilities`, `compress`, `extract-audio`, `batch`)
- **⚙️ 3 Transcoder-Kerne** — FFmpeg-API (fluent-ffmpeg), FFmpeg-CLI (child_process), BMF-Framework
- **🌍 56 Gebietsschemata** — 35 Sprachen mit RTL-Unterstützung (Arabisch, Hebräisch)
- **⌨️ Tastaturkürzel** — 60+ Kürzel auf jeder Seite mit In-App-Hilfedialog (`Ctrl+/`)
- **🔔 Aktivitätsanzeigen** — Live-Navigationsindikatoren mit Hover-Popovers, die den Fortschritt pro Job auf einen Blick zeigen
- **🛡️ Schließbestätigung** — Warnt vor dem Schließen des Fensters, solange Jobs noch laufen
- **🎉 Easter Eggs** — Feiertags-Themenlogos an besonderen Daten
- **🔄 In-App-Updates** — Prüft GitHub Releases, lädt den Plattform-Installer herunter, Fortschritt in Echtzeit
- **🛡️ Fehlerbehandlung** — 16 typisierte Fehlercodes, globale Snackbar, Inline-Banner, React-Error-Boundaries
- **🌗 Dunkles/Helles Design** — Systembezogen mit manuellem Umschalter und dauerhaften Einstellungen

Eine vollständige Aufschlüsselung der Funktionen, unterstützten Formate und Codec-Listen findest du in [Funktionen](./features-reference.md).

## 📸 Screenshots

<div align="center">
  <img src="../../site/public/images/home_dashboard.webp" alt="Home-Dashboard" width="800" />
  <p><strong>🏠 Home-Dashboard</strong></p>
</div>

<table>
  <tr>
    <td align="center" width="50%">
      <img src="../../site/public/images/convert.webp" alt="Medienkonvertierung" /><br />
      <strong>🔄 Medienkonvertierung</strong>
    </td>
    <td align="center" width="50%">
      <img src="../../site/public/images/extract_audio.webp" alt="Audioextraktion" /><br />
      <strong>🎵 Audioextraktion</strong>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="../../site/public/images/cut_video.webp" alt="Videoschneiden" /><br />
      <strong>✂️ Videoschneiden</strong>
    </td>
    <td align="center">
      <img src="../../site/public/images/image_compress.webp" alt="Bildkomprimierung" /><br />
      <strong>🖼️ Bildkomprimierung</strong>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="../../site/public/images/batch_process.webp" alt="Batch-Warteschlange" /><br />
      <strong>📋 Batch-Warteschlange</strong>
    </td>
    <td align="center">
      <img src="../../site/public/images/media_info.webp" alt="Medieninfo" /><br />
      <strong>ℹ️ Medieninfo</strong>
    </td>
  </tr>
</table>

## 📌 Voraussetzungen

- [Node.js](https://nodejs.org/) 22+
- [FFmpeg](https://ffmpeg.org/) — gebündelt über `ffmpeg-static`; fällt auf das System-`ffmpeg` zurück, falls die gebündelte Binary nicht verfügbar ist

## 📥 Downloads

Vorgefertigte Installer sind auf der Seite [Releases](https://github.com/Sandeepv68/EncodeX/releases) verfügbar.

### macOS

> EncodeX ist nicht code-signiert (kein Apple-Developer-Konto). Der macOS-Gatekeeper blockiert die App beim ersten Öffnen.

**Option 1 — Per Rechtsklick öffnen:**

1. Klicke mit der rechten Maustaste (oder bei gedrückter Ctrl-Taste) auf die EncodeX-App und wähle **Öffnen**
2. Klicke im Bestätigungsdialog auf **Öffnen**

**Option 2 — Quarantäne über das Terminal entfernen:**

```bash
xattr -cr /Applications/EncodeX.app
```

### Windows / Linux

Lade den `.exe`-Installer (Windows) oder `.AppImage`-Installer (Linux) von der Seite [Releases](https://github.com/Sandeepv68/EncodeX/releases) herunter und führe ihn aus.

## 🚀 Installation (aus dem Quellcode)

```bash
npm install
```

## 🧑‍💻 Entwicklung

```bash
# Vite-Dev-Server + tsc-Watch starten (ohne Electron-Fenster)
npm run dev

# Vollständige Dev-Umgebung mit Electron-Fenster
npm run electron:dev

# Schnellstart (erst bauen, dann starten)
npm run dev:start
```

`npm run dev` startet zwei Prozesse gleichzeitig:

1. **Vite** — stellt den React-Renderer auf `http://localhost:5173` mit HMR bereit
2. **tsc** — überwacht und kompiliert das TypeScript des Hauptprozesses nach `dist/main/`

`npm run electron:dev` wartet, bis Vite bereit ist, kompiliert sowohl Main als auch Preload und startet dann Electron mit dem `--dev`-Flag, das auf die URL des Vite-Dev-Servers zeigt. DevTools öffnen sich automatisch.

## 🔨 Build

```bash
# Produktions-Build (Renderer + Main + Preload)
npm run build

# Für die aktuelle Plattform packen (ohne Installer)
npm run pack

# Verteilbaren Installer erstellen
npm run dist
```

| Skript                   | Beschreibung                                                       |
| ------------------------ | ------------------------------------------------------------------ |
| `npm run dev:renderer`   | Nur Vite-Dev-Server                                                |
| `npm run dev:main`       | `tsc -p tsconfig.main.json --watch`                                |
| `npm run build:renderer` | Vite-Produktions-Build — Ausgabe nach `dist/renderer/`             |
| `npm run build:main`     | `tsc -p tsconfig.main.json` — Ausgabe nach `dist/main/`            |
| `npm run build:preload`  | `tsc -p tsconfig.preload.json` — Ausgabe nach `dist/preload/`      |
| `npm run build`          | Alle drei nacheinander                                             |
| `npm run start`          | Kompilierte App aus `dist/` über `electron .` starten              |
| `npm run electron:dev`   | Vite- + Electron-Dev-Umgebung                                      |
| `npm run dev:start`      | Erst bauen, dann starten                                           |
| `npm run format`         | `prettier --write` für alle `src` TypeScript/JSON                  |
| `npm run format:check`   | `prettier --check` für alle `src` TypeScript/JSON                  |
| `npm run pack`           | Build + electron-builder `--dir`                                   |
| `npm run dist`           | Build + electron-builder (NSIS/DMG/AppImage)                       |

## 💻 CLI-Nutzung

Zuerst bauen und dann über `encodex` aufrufen:

```bash
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac
encodex info input.mp4 --json
encodex compress photo.png -f jpg -q 30
encodex extract-audio input.mp4
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted
```

Eine vollständige Übersicht aller Unterbefehle, Optionen und Beispiele findest du in [CLI-Nutzung](./cli.md).

## 🧪 Tests

```bash
npm test           # Führt alle 123 Testdateien / 1603 Tests aus
npm run test:watch
npm run test:coverage
npm run test:unit
npm run test:integration
npm run test:e2e   # Erfordert einen Build
```

Eine vollständige Aufschlüsselung der Testsammlung, Testeinrichtung und E2E-Spezifikationen findest du in [Tests](./testing.md).

## 📚 Dokumentation

| Dokument | Beschreibung                                                                        |
| -------- | ----------------------------------------------------------------------------------- |
| [Funktionen](./features-reference.md) | Funktionen, unterstützte Medienformate, Codec-Tabellen, Validierungshilfen |
| [CLI-Nutzung](./cli.md) | CLI-Nutzung, Unterbefehle, alle Optionstabellen, Exit-Codes                |
| [Tests](./testing.md) | Testsammlung, Testeinrichtung, E2E-Spezifikationen                          |
| [IPC-Kanäle](./ipc.md) | IPC-Kanäle, electronAPI-Brücke, alle Methoden und Ereignisse               |
| [Projektstruktur](./project-structure.md) | Vollständiger Verzeichnisbaum mit Anmerkungen                         |
| [Architektur](./architecture.md) | Überblick über die interne Architektur und Links zu Deep Dives         |
| [Prozesse, Build-System & Start](./architecture-processes.md) | Prozessmodell, Build-System, Startsequenz, CLI-Modus |
| [Transcoder-Abstraktion & Konvertierung](./architecture-transcoders.md) | Transcoder-Abstraktion, FFmpeg/BMF-Kerne, Hardwarebeschleunigung |
| [Renderer, Zustand & Subsysteme](./architecture-renderer.md) | Render-Baum, Seiten, Stores, Warteschlange, Player, i18n, Theming |
| [Update-Manager](./update-manager.md) | Implementierungsdetails des In-App-Update-Managers                   |
| [Wiki](https://github.com/Sandeepv68/EncodeX/wiki) | Community-Wiki (spiegelt die Dokumentation in durchsuchbarer Form) |
| [Dokumentations-Website](https://encodex.in/de/) | VitePress-Website mit Funktionstour, Anleitungen und Release-Blog |
| [Mitwirken](./CONTRIBUTING.md) | Mitwirkungsrichtlinien                                              |
| [Sicherheitshinweise](../../SECURITY.md) | Meldung von Sicherheitslücken                                        |
| [Verhaltenskodex](../../CODE_OF_CONDUCT.md) | Verhaltenskodex                                                     |

## 🧰 Tech-Stack

<p align="center"><img src="../../assets/stack.png" alt="EncodeX Tech-Stack"></p>

## 🤝 Mitwirken

Richtlinien findest du in [Mitwirken](./CONTRIBUTING.md). Alle Beiträge sind willkommen – bitte eröffne für größere Änderungen zuerst ein Issue.

Dieses Projekt unterliegt einem [Verhaltenskodex](../../CODE_OF_CONDUCT.md).

## 🔒 Sicherheit

Melde Sicherheitslücken den Projektbetreuern über den Prozess für Sicherheitshinweise. Siehe [Sicherheitshinweise](../../SECURITY.md).

## 📄 Lizenz

MIT
