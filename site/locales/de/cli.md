---
title: "EncodeX CLI – FFmpeg-Kommandozeile, vereinfacht | EncodeX"
description: "Die EncodeX CLI gibt Ihnen die Leistung der FFmpeg-Kommandozeile mit einfachen, lesbaren Befehlen. Konvertieren, komprimieren, Audio extrahieren und Stapelverarbeitung vom Terminal aus auf Windows, Mac und Linux."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# EncodeX CLI

Einfach genug für Alltagsbenutzer. Leistungsstark genug für Entwickler. **EncodeX** ist nicht nur eine grafische Oberfläche — derselbe FFmpeg-Engine ist über die **EncodeX CLI** auf der Kommandozeile verfügbar.

## FFmpeg-Kommandozeile, ohne die FFmpeg-Syntax

FFmpegs native Kommandozeile ist mächtig, aber berüchtigt unnachgiebig. Die **EncodeX CLI** verpackt sie in einfache, lesbare Befehle:

```bash
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac
encodex info input.mp4 --json
encodex compress photo.png -f jpg -q 30
encodex extract-audio input.mp4
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted
```

Keine kryptischen `-c:v libx264 -crf 23 -preset medium`-Ketten — nur klare Optionsschalter, dieselben Einstellungen wie die grafische Oberfläche und saubere Ausgabe.

## Warum die EncodeX CLI verwenden?

- **Skripten Sie es** — automatisieren Sie Konvertierungen in Cron-Jobs, CI-Pipelines und Servern
- **Konsistent** — derselbe Engine und dieselben Profile wie die grafische Oberfläche
- **Stapelfreundlich** — Glob-Muster und `--concurrency` für parallele Arbeit
- **Lesbar** — Befehle, die Sie ohne Handbuch eingeben können
- **Plattformübergreifend** — funktioniert auf Windows, macOS und Linux
- **Kopflos** — kein Desktop erforderlich, perfekt für Server

## CLI-Befehle

| Befehl             | Was er tut                                              |
| ------------------ | ------------------------------------------------------- |
| `encodex convert`  | Konvertiert eine einzelne Datei zwischen zwei Formaten   |
| `encodex batch`    | Konvertiert viele Dateien mit Glob-Mustern parallel      |
| `encodex compress`  | Komprimiert eine Video- oder Bilddatei                  |
| `encodex extract-audio` | Extrahiert die Audiospur aus einem Video           |
| `encodex info`     | Untersucht eine Datei und gibt deren technische Details aus |
| `encodex capabilities` | Listet unterstützte Formate und Encoder auf          |

## CLI erhalten

Die CLI wird mit **jeder EncodeX-Installation** ausgeliefert — laden Sie die App herunter und können `encodex` direkt aus Ihrem Terminal aufrufen. Kein separates Setup erforderlich.

[Laden Sie EncodeX kostenlos herunter](/de/download)

## FAQ

**Brauche ich die grafische Oberfläche, um die CLI zu verwenden?** Nein, die CLI arbeitet eigenständig. Sie ist in jeder Installation von EncodeX enthalten.

**Kann ich die EncodeX CLI auf einem Server verwenden?** Ja — sie ist kopflos und funktioniert daher hervorragend in Skripts, CI und Serverumgebungen.

**Ist die EncodeX CLI wirklich kostenlos?** Ja — EncodeX ist für immer kostenlos und Open Source (MIT).

## Loslegen

- [Laden Sie EncodeX kostenlos herunter](/de/download)
- [Erfahren Sie, warum EncodeX die einfachste FFmpeg-GUI ist](/de/ffmpeg-gui)
- [Erfahren Sie, was FFmpeg eigentlich ist](/de/learn/what-is-ffmpeg)
- [Alle Konvertierungen und Funktionen ansehen](/de/features)
