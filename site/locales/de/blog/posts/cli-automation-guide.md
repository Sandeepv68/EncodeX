---
title: "Medien-Workflows mit der EncodeX CLI automatisieren"
description: "EncodeX über die Befehlszeile nutzen, um Batch-Konvertierungen zu scripten, Audiodateien zu extrahieren, Bilder zu komprimieren und automatisierte Medien-Pipelines aufzubauen."
date: 2026-09-12
tags:
  - guide
  - cli
  - automation
  - developer
---

# Medien-Workflows mit der EncodeX CLI automatisieren

EncodeX ist eine Anwendung, die in erster Linie auf die grafische Oberfläche ausgerichtet ist, wird aber mit einer vollwertigen Befehlszeilen-Schnittstelle geliefert, die alles kann, was die Desktop-App kann — und ein paar Dinge, die sie nicht kann. Wenn du regelmäßig mit Mediendateien arbeitest und Skripte erstellen, Stapel automatisieren oder Konvertierungen in einen Workflow einbinden möchtest, macht die CLI EncodeX zu etwas, das du von einem Terminal, einer CI-Pipeline oder einer geplanten Aufgabe aus ausführen kannst.

## Warum die CLI nutzen?

Die GUI ist ideal für einmalige Konvertierungen — Datei ziehen, Profil wählen, fertig. Aber wenn du einen Ordner mit fünfzig Videos hast oder ein Skript willst, das jede Aufnahme komprimiert, die in einem Verzeichnis landet, ermöglicht dir die CLI das Encodieren, ohne ein Fenster zu öffnen.

Häufige Anwendungsfälle:

- **Batch-Konvertierungsskripte** — konvertiere alle `.mov`-Dateien in einem Ordner mit einem einzigen Befehl in `.mp4`.
- **Audio-Extraktion** — Audio für Podcasts oder Archive aus Videodateien extrahieren.
- **CI/CD-Pipelines** — Medien-Artefakte als Teil eines automatisierten Builds validieren oder neu encodieren.
- **Geplante Aufgaben** — neue Aufnahmen jede Nacht automatisch komprimieren.
- **Integration mit anderen Tools** — Medien-Informationen in Überwachungssysteme oder Logging-Pipelines einspeisen.

## Erste Schritte

Wenn du EncodeX (GUI) installiert hast, ist die CLI bereits verfügbar. Öffne ein Terminal und führe Folgendes aus:

```bash
encodex convert --help
```

Du siehst die vollständige Liste der Optionen. Die CLI spiegelt die Fähigkeiten der GUI wider: Jedes Format, jeder Codec und jedes Profil, das die App unterstützt, ist auch über die Befehlszeile verfügbar.

Installationsoptionen und alle verfügbaren Befehle findest du in der [CLI-Dokumentation](/de/docs/cli).

## Ein Video konvertieren

Die häufigste Operation ist das Konvertieren zwischen Formaten. Eine einfache Konvertierung:

```bash
encodex convert in.mov -o out.mp4
```

Dies verwendet die Standardeinstellungen von EncodeX (H.264 + AAC in einem MP4-Container) und erzeugt eine Datei, die überall funktioniert.

Für einen bestimmten Codec oder eine bestimmte Qualität:

```bash
encodex convert in.mov -o out.mp4 --video-codec libx265 --crf 20
```

H.265 erzeugt bei gleicher Qualität kleinere Dateien. CRF 20 ist eine hochwertige Einstellung; niedrigere Werte bedeuten höhere Qualität (und größere Dateien).

## Audio extrahieren

Die Audiospur aus einem Video ziehen, ohne neu zu encodieren:

```bash
encodex extract-audio in.mp4 -o audio.mp3
```

Die Standardausgabe ist MP3 mit 192k. Für ein anderes Format:

```bash
encodex extract-audio in.mp4 -o audio.wav --codec libopus
```

Das ist nützlich, um Podcast-Audio aus Videoaufnahmen zu extrahieren, Audio-Vorschauen zu erstellen oder Soundtracks separat zu archivieren.

## Verlustfreies Transkodieren

Wenn du den Container wechseln musst, ohne die Video- oder Audiodaten anzufassen (zum Beispiel für die Gerätekompatibilität von `.mkv` zu `.mp4`):

```bash
encodex convert in.mkv -o out.mp4 --video-codec copy --audio-codec copy
```

Das ist fast augenblicklich, weil keine Codierung stattfindet — die Streams werden nur in den neuen Container remuxt. Perfekt für Archivare, die maximale Kompatibilität ohne Qualitätsverlust wollen.

## Batch-Konvertierungen

Mehrere Dateien auf einmal konvertieren:

```bash
encodex batch *.mov -o output/ --video-codec libx264 --crf 23
```

Alle passenden Dateien werden nacheinander verarbeitet. Jede Eingabedatei wird zu einer entsprechenden Ausgabedatei im Verzeichnis `output/` mit der geänderten Endung `.mp4`.

## Medien-Informationen abrufen

Vor dem Konvertieren möchtest du vielleicht Codec, Auflösung oder Bitrate einer Datei prüfen:

```bash
encodex info in.mp4
```

Dies gibt eine lesbare Zusammenfassung der Streams der Datei aus. Für maschinenlesbare Ausgabe:

```bash
encodex info in.mp4 --json
```

Die JSON-Ausgabe ist in Skripten nützlich, in denen du Entscheidungen auf Grundlage der Dateieigenschaften treffen musst (z. B. „nur neu encodieren, wenn der Videocodec nicht bereits H.264 ist").

## Exit-Codes und Fehlerbehandlung

Die CLI gibt aussagekräftige Exit-Codes zurück, damit Skripte Erfolg oder Fehler erkennen können:

| Code | Bedeutung |
|------|---------|
| 0 | Erfolg |
| 1 | Allgemeiner Fehler |
| 2 | Ungültige Argumente |
| 3 | Eingabedatei nicht gefunden |
| 4 | Ausgabedatei existiert (mit `--overwrite` ersetzen) |

Verwende sie in Shell-Skripten, um Fehler elegant zu behandeln:

```bash
encodex convert in.mp4 -o out.mp4
if [ $? -eq 4 ]; then
  echo "Output exists — skipping."
fi
```

## Alles zusammenfügen

Die CLI ist darauf ausgelegt, komponierbar zu sein. Ein realistisches Skript könnte:

1. Alle Videodateien in einem Ordner mit `encodex info --json` prüfen
2. Auf Dateien größer als 500 MB filtern
3. Diese Dateien in ein kleineres H.264-MP4 mit CRF 23 konvertieren
4. Die Ergebnisse protokollieren

Die [vollständige CLI-Referenz](/de/docs/cli) dokumentiert jede Option, jede Flagge und jeden Exit-Code.

---

*Lade EncodeX kostenlos unter [encodex.in/download](/de/download) herunter. Die CLI ist in jeder Installation enthalten.*