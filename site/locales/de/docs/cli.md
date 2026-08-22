# CLI-Nutzung

Zuerst bauen, dann die kompilierte CLI über den Befehl `encodex` aufrufen (der Launcher `bin/encodex.js` umhüllt die Electron-Binary). Der CLI-Modus aktiviert sich automatisch, wenn zwei positionale Argumente (Eingabe + Ausgabe) übergeben werden, oder explizit mit `--cli`:

```bash
# Convert a file (subcommand form)
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Convert a file (legacy flat form — still works)
encodex input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Show media info as a human table
encodex info input.mp4

# Show media info as JSON
encodex info input.mp4 --json

# List transcoder capabilities
encodex capabilities
encodex capabilities --json

# Lossless copy to different container
encodex convert input.mkv output.mp4 --copy

# Cut a segment
encodex convert input.mp4 output.mp4 --start-time 00:01:00 --end-time 00:02:30

# Compress an image
encodex compress photo.png -f jpg -q 30

# Extract audio (mp3 by default)
encodex extract-audio input.mp4

# Batch-convert several files / globs
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted

# Use a specific transcoder core
encodex convert input.mp4 output.mp4 --transcoder FFTOOL
```

Die veraltete flache Nutzung (`encodex in.mp4 out.mp4`, `encodex --info in.mp4`) wird automatisch per Shim auf das passende Subcommand gemappt.

Um `encodex` global verfügbar zu machen, führen Sie `npm link` im Projektstamm aus (oder `npm install -g .`). Die rohe Form `npx electron . --cli ...` funktioniert weiterhin als Alternative.

## Subcommands

| Subcommand         | Beschreibung                                                      |
| ------------------ | ----------------------------------------------------------------- |
| `convert`          | Medium konvertieren (Standard, wenn kein Subcommand passt). Alias: `c` |
| `info`             | Medieninfos anzeigen (menschenlesbare Tabelle, mit `--json` Maschinenausgabe) |
| `capabilities`     | Verfügbare Transcoder-Fähigkeiten auflisten (Tabelle oder `--json`) |
| `compress`         | Bild komprimieren                                                 |
| `extract-audio`    | Audiostream extrahieren (Standard-Codec `libmp3lame`). Alias: `audio` |
| `batch`            | Mehrere Eingaben (Dateien, Globs oder Verzeichnisse) mit Warteschlange konvertieren |

## Globale Optionen

Globale Optionen können vor oder nach dem Subcommand-Namen stehen.

| Option                      | Beschreibung                                                   |
| --------------------------- | -------------------------------------------------------------- |
| `--transcoder <type>`       | Transcoder-Kern: `FFMPEG`, `FFTOOL`, `BMF` (Standard: `FFMPEG`) |
| `--theme <id>`              | Logo-Farbthema: `light`, `ocean`, `sunset`, `forest`, `lavender`, `rose`, `slate`, `dark` (Standard: `light`) |
| `--verbose`                 | Ausführliches Logging (routet Status nach stderr)              |
| `--quiet`                   | Statusausgabe unterdrücken                                     |
| `--no-color`                | ANSI-Farben deaktivieren                                       |
| `--json`                    | Maschinenlesbare JSON-Ausgabe (Status nach stderr geroutet)    |
| `--timeout <seconds>`       | Konvertierungs-Timeout in Sekunden (Standard: `300`)           |

## Convert-Optionen

| Option                      | Beschreibung                                                   |
| --------------------------- | -------------------------------------------------------------- |
| `-v, --video-codec <codec>` | Video-Codec (z. B. `libx264`, `libx265`, `copy`)               |
| `-a, --audio-codec <codec>` | Audio-Codec (z. B. `aac`, `libmp3lame`, `copy`)                |
| `-q, --qscale <qscale>`     | Qualitätsstufe (1–31)                                          |
| `--bitrate-video <bitrate>` | Video-Bitrate (z. B. `1000k`)                                  |
| `--bitrate-audio <bitrate>` | Audio-Bitrate (z. B. `192k`)                                   |
| `--pix-fmt <format>`        | Pixelformat (z. B. `yuv420p`, `yuv444p`)                       |
| `-s, --scale <WxH>`         | Ausgabeauflösung (z. B. `1280x720` oder `50%`)                 |
| `--start-time <time>`       | Startzeit (`HH:MM:SS` oder Sekunden)                           |
| `--end-time <time>`         | Endzeit                                                        |
| `--duration <time>`         | Dauer                                                          |
| `--copy`                    | Verlustfreie Stream-Kopie                                      |
| `--no-audio`                | Schließt den Audiostream aus der Ausgabe aus                   |
| `--no-video`                | Schließt den Videostream aus der Ausgabe aus (nur Audio)       |
| `--hwaccel / --no-hwaccel`  | Hardwarebeschleunigung umschalten                              |
| `--hwaccel-mode <auto\\|encode>` | Hardwarebeschleunigungs-Modus (Standard: `auto`)          |
| `--info`                    | Medieninfos der Eingabe ausgeben und beenden                   |

## Compress-Optionen

| Option                      | Beschreibung                                                   |
| --------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`       | Ausgabedatei                                                   |
| `-f, --format <format>`     | Ausgabeformat (leitet sich standardmäßig von der Endung ab)    |
| `-q, --quality <qscale>`    | Qualitätsstufe 1–31                                            |
| `-s, --scale <WxH>`         | Ausgabeauflösung                                               |

## Extract-audio-Optionen

| Option                      | Beschreibung                                                   |
| --------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`       | Ausgabedatei                                                   |
| `-a, --audio-codec <codec>` | Audio-Codec (Standard: `libmp3lame`)                           |
| `--bitrate-audio <bitrate>` | Audio-Bitrate (z. B. `192k`)                                   |

## Batch-Optionen

| Option                      | Beschreibung                                                   |
| --------------------------- | -------------------------------------------------------------- |
| `--concurrency <n>`         | Max. parallele Konvertierungen (Standard: `4`, begrenzt auf 1–4) |
| `--output-dir <dir>`        | Ausgabeverzeichnis für konvertierte Dateien                    |
| `--suffix <s>`              | Suffix für abgeleitete Ausgabenamen (Standard: `_encodex_converted`) |

Batch akzeptiert außerdem alle Convert-Encoding-Optionen (`-v/--video-codec`, `-a/--audio-codec`, `--bitrate-video`, `--bitrate-audio`, `-q/--qscale`, `--pix-fmt`, `-s/--scale`, `--copy`, `--no-audio`, `--no-video`) und wendet sie auf jeden Job an.

## Exit-Codes

| Code | Konstante                    | Bedeutung                                      |
| ---- | ---------------------------- | ---------------------------------------------- |
| `0`  | `EXIT_CODES.SUCCESS`         | Sauberer Erfolg                                |
| `1`  | `EXIT_CODES.ERROR`           | Allgemeiner Fehler                             |
| `2`  | `EXIT_CODES.USAGE`           | Ungültige/unvollständige Argumente             |
| `3`  | `EXIT_CODES.CANCELLED`       | Vom Benutzer abgebrochene Operation            |
| `4`  | `EXIT_CODES.NOT_FOUND`       | Eingabedatei, FFmpeg oder FFprobe nicht gefunden |
| `5`  | `EXIT_CODES.TIMEOUT`         | Konvertierung hat `--timeout` überschritten    |
