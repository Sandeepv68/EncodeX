# Funktionen

EncodeX ist ein plattformübergreifendes Multimedia-Konvertierungstool, das die Leistung von FFmpeg in eine moderne, intuitive Desktop-Oberfläche bringt. Gebaut mit Electron, React und TypeScript ermöglicht es, Medien zwischen Formaten zu konvertieren, Audio zu extrahieren, Videos zu schneiden und Bilder zu komprimieren — alles über eine aufgeräumte, reaktionsschnelle UI mit Batch-Warteschlange, Hardwarebeschleunigung, CLI-Modus und vollständiger Internationalisierung.

## Funktionsübersicht

### Medienkonvertierung

Konvertieren Sie zwischen Video-/Audioformaten mit granularer Kontrolle über Codecauswahl (51 Video-Codecs aus Software- und Hardware-Encoder-Familien, 27 Audio-Codecs), Bitrate, Ausgabeauflösung (mit optionaler Erhaltung des Seitenverhältnisses), Pixelformat (56 Formate gruppiert nach Bittiefe), Qualitätsstufe (qscale), Einbeziehung der Audiospur und Wahl des Transcoder-Kerns. Mehrere Dateien können über die Batch-Warteschlange eingereiht werden (siehe unten).

### Konvertierungsprofile

Wenden Sie vorkonfigurierte Encoding-Voreinstellungen an, um Konvertierungseinstellungen sofort auszufüllen. Profile kapseln eine vollständige Encoding-Konfiguration — Containerformat, Video-Codec, Audio-Codec, Bitrate, CRF/Qualität, Skalierung, Pixelformat und erweiterte FFmpeg-Argumente — sodass Sie nicht jede Einstellung manuell konfigurieren müssen.

- **Über 140 eingebaute Profile** in 8 Kategorien: Web & Social (YouTube, Instagram, TikTok, Facebook, X), Geräte (Apple, Android, Spielkonsolen), Video-Codecs, Professionell (ProRes, DNxHD/HR, FFV1), Streaming (HLS, DASH), Audio, Bilder und Erweitert
- **Benutzerdefinierte Profile** — erstellen, bearbeiten und löschen Sie eigene Profile; im lokalen Speicher gespeichert
- **Zuletzt verwendet** — Schnellzugriff auf die letzten 5 angewendeten Profile
- **Kategoriefilter** — Profile nach Kategorie mit Icon-Badges durchsuchen
- **Batch-Unterstützung** — Profile auf einzelne Batch-Jobs oder die gesamte Warteschlange anwenden

Profile sind auf der Konvertieren-Seite und in der Batch-Warteschlange verfügbar. Das Auswählen eines Profils füllt automatisch alle relevanten Encoding-Felder aus, während manuelle Überschreibungen weiterhin möglich sind.

### Verlustfreies Kopieren

Stream-Kopie von Video- oder Audiospuren ohne Re-Encoding (`-c copy`). Nützlich für schnelle Containerwechsel, Remuxing oder wenn Qualitätserhaltung entscheidend ist.

### Hardwarebeschleunigung

Hardwarebeschleunigtes Encoding mit automatischer Erkennung verfügbarer Encoder-Familien. Unterstützt NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox und Microsoft Media Foundation Encoder. Beschleunigung kann ein-/ausgeschaltet werden, mit einem Modus-Wähler — `auto` fügt die passenden FFmpeg-`-hwaccel`-Flags für die gewählte Hardware-Encoder-Familie hinzu, `encode` verlässt sich auf die eigene Beschleunigung des Encoders — und einem Encoder-Typfilter (`auto` / `hardware` / `software`), der die Video-Codec-Auswahl auf alle, nur GPU- oder nur CPU-Encoder einschränkt. Verfügbare Encoder werden zur Laufzeit vom gebündelten FFmpeg-Binary erkannt und die Codec-Auswahllisten auf das gefiltert, was der Binary tatsächlich bietet.

### Medieninformationen

Analysieren Sie Mediendateien und prüfen Sie detaillierte Informationen pro Stream: Codec, Profil, Level, Auflösung, Anzeigeseitenverhältnis, Pixelformat, Bittiefe, Color Range/Space/Transfer/Primaries, Bildrate, Bitrate, Samplerate, Sampleformat, Kanalanzahl/-layout, Dauer, Startzeit, Frame-Anzahl, Sprache und Tags. Funktioniert mit Video-, Audio- und Untertitelstreams.

### Bildkomprimierung

Komprimieren Sie Bilder (JPEG, PNG, WebP, BMP, GIF, TIFF, PPM, PGM, PBM) mit konfigurierbarer Qualitätsstufe und Auflösungsskalierung über die Bildcodecs von FFmpeg. Enthält eine Live-Vorschau, eine Dateigrößenanzeige und — für JPEG/PNG/WebP-Eingaben — ein vollständiges EXIF-Metadaten-Panel mit RGB- und Luma-Histogrammen.

### Audioextraktion

Extrahieren Sie Audiospuren aus Videodateien. Ausgabe als AAC, MP3, AC3, FLAC, WAV, Vorbis, Opus, ALAC oder einen der 27 unterstützten Audio-Codecs. Der Quell-Audiostream ist wählbar, wenn mehrere Spuren vorhanden sind.

### Videoschnitt

Vorschau und Schnitt von Videosegmenten mit bildgenauer Auswahl von Start-/Endzeit oder Dauer. Enthält einen integrierten Player, der Videoframes (über eine FFmpeg-rawvideo-Pipe in ein HTML-Canvas-Element) und Audio (über eine separate S16LE-PCM-Pipe, zu Float konvertiert und in die Web Audio API eingespeist) im Gleichschritt dekodiert, mit einer zoombaren Mehrspur-Timeline: Video-Thumbnail-Montage, Audio-Wellenform, Behalten/Abdimmen-Bereichsschattierung, Drag-to-Trim-Griffe und scrub-barem Abspielkopf.

### Batch-Warteschlange

Verarbeiten Sie mehrere Dateien mit konfigurierbaren Operationen (Transkodierung, Audioextraktion, Bildkomprimierung). Jobs werden über einen Prüfdialog hinzugefügt, in dem Ausgabenamen und Optionen angepasst werden können, bevor sie in die Warteschlange gelangen.

- **Parallele Verarbeitung** — bis zu 4 Jobs gleichzeitig (`MAX_QUEUE_CONCURRENCY = 4`); das Konkurrenzlimit ist zur Laufzeit konfigurierbar und wird persistiert.
- **Warteschlangen-Lebenszyklus** — die gesamte Warteschlange starten, pausieren und fortsetzen; alles abbrechen; fertige/fehlgeschlagene Jobs löschen; einzelne Jobs entfernen.
- **Umsortierung** — Drag-and-Drop-Umsortierung wartender Jobs (mit Drop-Bereich), gestützt durch einen `QUEUE_MOVE_TO`-Kanal, der die neue Position des Jobs meldet.
- **Job-Bearbeitung** — Optionen (und optional den Ausgabepfad) eines jeden wartenden Jobs vor dem Start ersetzen (`QUEUE_UPDATE_OPTIONS`).
- **Export / Import** — Warteschlange in eine JSON-Datei speichern und später wieder importieren (`QUEUE_EXPORT` / `QUEUE_IMPORT`), validiert mit einem eigenen Fehlercode `INVALID_QUEUE_FILE`.
- **Persistenz** — der Warteschlangen-Snapshot (Jobs + Konkurrenz) wird dauerhaft in `queue-state.json` im User-Data-Verzeichnis gespeichert und beim Start wiederhergestellt.
- **Statusfilter** — Jobliste filtern nach queued / running / done / failed, plus fokussierbares Suchfeld.
- **When-done-Power-Aktionen** — optional den Rechner herunterfahren, in Standby versetzen oder in Ruhezustand schicken, wenn die Warteschlange leer ist (`shutdown`, `pmset` oder `systemctl` je Plattform; Windows respektiert ein Force-Close-Flag).
- **Live-Feedback** — Echtzeit-Fortschritt pro Job (Prozent, Zeit, Speed, ETA) via IPC gestreamt, Fehlerbehandlung pro Job und ein Nav-Zähler-Badge für offene Arbeit.

### Mehrere Transcoder-Kerne

- **FFmpeg-API** — fluent-ffmpeg Node.js-Bindings mit programmatischen Progress-Events
- **FFmpeg-CLI** — direkter CLI-Aufruf über Kindprozess, keine nativen Bindings nötig
- **BMF-Framework** — BMF-CLI-Tools für fortgeschrittene Pipeline-Szenarien (erfordert separate Installation)

### Einstellungen

Eigene Einstellungsseite für Thema, Hardwarebeschleunigung (an/aus, Modus, Encoder-Typ), Fenster immer im Vordergrund, Autostart, Batch-Konkurrenz und die When-done-Power-Aktion. Präferenzen persistieren im `localStorage` und greifen beim Start.

### Tastaturkürzel

Ein zentrales Shortcut-Register (`src/renderer/constants/shortcuts.ts`) definiert über 60 Kürzel in neun Bereichen (global, convert, media info, image compress, audio extract, video cut, batch queue, logs, dashboard). Highlights:

- `Ctrl+/` — Shortcut-Hilfsdialog öffnen
- `Alt+1`…`Alt+9` — direkt zu einer Seite springen
- `Ctrl+O` / `Ctrl+Shift+S` / `Ctrl+Enter` — Eingabe wählen / Ausgabe wählen / Job starten (seitenübergreifend konsistent)
- `Ctrl+Shift+P` / `Ctrl+Shift+C` — aktiven Job pausieren / abbrechen
- Batch-Warteschlange: `Ctrl+E` Export, `Ctrl+I` Import, `1`–`5` Statusfilter, `F` Suche fokussieren
- Video-Cut-Player: `Leertaste` Play/Pause, `M` stumm, Pfeiltasten zum Spulen

Chords werden über `event.code` gematcht und funktionieren daher unabhängig vom Tastaturlayout. Tooltips beziehen ihren Hinweistext aus demselben Register.

### Aktivitäts-Blips & Job-Popover

Während eine Konvertierung, Audioextraktion oder ein Videoschnitt läuft, erscheint ein blinkender Blip auf der entsprechenden Navigationszeile; die Batch-Queue-Zeile zeigt einen Live-Zähler offener Jobs. Beim Hover (oder Tastaturfokus) öffnet sich ein am Blip verankerter Popover mit Jobtitel, lokalisiertem Status (inkl. Pausenzustand und Parallelitäts-Badge), Thumbnail der Quelldatei, Dateiname und Live-Fortschrittsbalken — plus einem Stapel Thumbnails wartender Jobs, während ein Batch voranschreitet. Der Popover nutzt einen weichen Schatten und sein Pfeil zeigt auf den Blip.

### Schließen-Bestätigung

Das Schließen des Fensters bei aktiven Jobs führt durch einen Bestätigungsfluss: Der Hauptprozess fragt beim Renderer nach (`WINDOW_CLOSE_REQUESTED`), der einen Dialog mit laufender Arbeit zeigt, bevor das Schließen bestätigt wird (`WINDOW_CONFIRM_CLOSE`). Beim Boot wird ein Splash gezeigt, während das Hauptfenster lädt.

### Dashboard

Eine Landingpage mit Schnellaktions-Kacheln für jedes Werkzeug (Zifferntasten `1`–`6` springen direkt hin) und saisonalem Easter-Egg-Branding (siehe unten).

### Easter Eggs

An Festtagen tauscht das Dashboard das Standard-App-Logo gegen Feiertagsmotive — Weihnachten, Halloween, Neujahr, 4. Juli, Ostern, Diwali und Holi. Jedes Fest ist in einem 7-Tage-Fenster um sein Datum aktiv; Diwali und Holi folgen dem hind lunisolaren Kalender über kuratierte Daten (2026–2035) mit astronomischer Fallback-Berechnung für andere Jahre.

### Logs

Live-Log-Viewer, der Konsolenausgaben aus Haupt- und Renderer-Prozess über IPC aggregiert. Unterstützt Levelfilterung (DEBUG/INFO/WARN/ERROR), Leeren und Download des Logs als `.txt`.

### Benachrichtigungen

Toast-Benachrichtigungen (success/info/warning/error) mit konfigurierbarer Dauer für nicht-blockierendes Feedback, über der globalen Error-Snackbar geschichtet.

### Eigenes Fensterrahmen-Design

Rahmenloses Anwendungsfenster mit benutzerdefinierter Titelleiste mit Minimieren / Maximieren-Umschalter / Schließen-Steuerelementen, ziehbarer Region und Always-on-top-Unterstützung. Während das Hauptfenster lädt, wird ein nicht-interaktiver Splash gezeigt.

### Dark/Light-Theme

Systembewusste Theme-Erkennung mit manueller Umschaltung. Die Theme-Präferenz persistiert im `localStorage` (Schlüssel `encodex-theme`).

### RTL-Unterstützung

Rechts-nach-links-Layout für arabische und hebräische Locales (`ar-SA`, `ar-AE`, `ar-JO`, `he-IL`). Die Richtung wechselt beim Sprachwechsel automatisch über ein Emotion-RTL-Style-Plugin.

### Internationalisierung

56 Locales in 35 Sprachen:

| Sprache     | Locales                                    |
| ----------- | ------------------------------------------ |
| Englisch    | `en-US`, `en-GB`, `en-IN`, `en-CA`, `en-AU`, `en-SG`, `en-ZA`, `en-NZ`, `en-IE` |
| Spanisch    | `es-ES`, `es-MX`, `es-AR`, `es-CL`         |
| Französisch | `fr-FR`, `fr-CA`, `fr-BE`                  |
| Hindi       | `hi-IN`                                    |
| Deutsch     | `de-DE`, `de-BE`                           |
| Italienisch | `it-IT`                                    |
| Niederländisch | `nl-NL`, `nl-BE`                        |
| Schwedisch  | `sv-SE`                                    |
| Norwegisch  | `nb-NO`                                    |
| Portugiesisch | `pt-BR`, `pt-PT`                         |
| Ukrainisch  | `uk-UA`                                    |
| Russisch    | `ru-RU`                                    |
| Polnisch    | `pl-PL`                                    |
| Thailändisch | `th-TH`                                   |
| Sinhala     | `si-LK`                                    |
| Mongolisch  | `mn-MN`                                    |
| Malaiisch   | `ms-MY`, `ms-SG`                           |
| Chinesisch  | `zh-SG`, `zh-TW`                           |
| Japanisch   | `ja-JP`                                    |
| Koreanisch  | `ko-KR`                                    |
| Indonesisch | `id-ID`                                    |
| Filipino    | `fil-PH`, `tl-PH`                          |
| Afrikaans   | `af-ZA`                                    |
| Hebräisch   | `he-IL`                                    |
| Arabisch    | `ar-SA`, `ar-AE`, `ar-JO`                  |
| Nepalesisch | `ne-NP`                                    |
| Khmer       | `km-KH`                                    |
| Vietnamesisch | `vi-VN`                                  |
| Laotisch    | `lo-LA`                                    |
| Maori       | `mi-NZ`                                    |
| Isländisch  | `is-IS`                                    |
| Grönländisch | `kl-GL`                                   |
| Irisch      | `ga-IE`                                    |
| Finnisch    | `fi-FI`                                    |
| Dänisch     | `da-DK`                                    |

### Integrierte Updates

Eigenes Update-Management, das GitHub Releases auf neue Versionen prüft, den Nutzer über Verfügbarkeit informiert, den plattformspezifischen Installer (`.exe` / `.dmg` / `.AppImage`) in der App mit Echtzeit-Fortschritt herunterlädt und den Installer nach Abschluss startet. Der Versionsvergleich nutzt Semver mit Entfernung von Pre-release-Suffixen. Der Update-Fluss ist vollständig in die About-Seite integriert, mit „Nach Updates suchen“-Button und einem globalen Dialog.

### Fehlerbehandlung

Strukturiertes Fehlersystem mit typisierten Codes (`ErrorCode`), lokalisierten Benutzermeldungen, globaler Error-Snackbar, Inline-Error-Bannern, Toast-Benachrichtigungen, verschachtelten React-Error-Boundaries und einer App-internen Fehlerhistorie (Limit 50). Alle Fehler werden über `formatError()` normalisiert und über IPC propagiert.

## Unterstützte Medienformate

### Video-Codecs (51)

| Gruppe                     | Codecs                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Software (28)**          | H.264 (libx264, libx264rgb), H.265/HEVC (libx265, Kvazaar), VP8 (libvpx), VP9 (libvpx-vp9), AV1 (libaom-av1, SVT-AV1, rav1e), MPEG-4 (libxvid, mpeg4), MPEG-1, MPEG-2, Theora, JPEG 2000 (libopenjpeg), WebP (libwebp, libwebp_anim), ProRes (prores, prores_ks), Huffyuv, FFV1, Ut Video, MJPEG, PNG, TIFF, VC-2, AVS (libxavs, libxavs2) |
| **NVIDIA NVENC (3)**       | H.264 (h264_nvenc), H.265 (hevc_nvenc), AV1 (av1_nvenc)                                                                                                                                                                                                                                                                                    |
| **Intel QSV (5)**          | H.264, H.265, MPEG-2, VP9, AV1                                                                                                                                                                                                                                                                                                             |
| **AMD AMF (3)**            | H.264, H.265, AV1                                                                                                                                                                                                                                                                                                                          |
| **VAAPI (6)**              | H.264, H.265, MJPEG, VP8, VP9, AV1                                                                                                                                                                                                                                                                                                         |
| **Apple VideoToolbox (4)** | H.264, H.265, ProRes, VP9                                                                                                                                                                                                                                                                                                                  |
| **Media Foundation (2)**   | H.264, H.265                                                                                                                                                                                                                                                                                                                               |

### Audio-Codecs (27)

| Gruppe            | Codecs                                                    |
| ----------------- | --------------------------------------------------------- |
| **AAC/MPEG**      | AAC (nativ, FDK), MP3 (LAME, libshine), MP2 (libtwolame)  |
| **Dolby**         | AC-3, E-AC-3, TrueHD, DTS, MLP                            |
| **Verlustfrei**   | FLAC, ALAC, WavPack                                       |
| **Streaming**     | Vorbis, Opus, Speex, AMR-WB                               |
| **PCM**           | s16le, s24le, f32le, s16be, u8, A-law, Mu-law             |
| **Windows Media** | WMA v1, WMA v2                                            |
| **Sonstige**      | ADPCM IMA (WAV)                                           |

### Pixelformate (56)

| Gruppe               | Formate                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| **YUV 8-bit**       | yuv420p, yuv422p, yuv444p, yuv410p, yuv411p, yuv440p, yuvj420p, yuvj422p, yuvj444p     |
| **YUV 10-bit**      | yuv420p10le, yuv422p10le, yuv444p10le                                                  |
| **YUV 12-bit**      | yuv420p12le, yuv422p12le, yuv444p12le                                                  |
| **YUV 16-bit**      | yuv420p16le, yuv444p16le                                                               |
| **YUV semi-planar** | nv12, nv21, nv16, nv20le                                                               |
| **YUV mit Alpha**   | yuva420p, yuva422p, yuva444p, yuva420p10le, yuva444p10le, yuva444p16le                 |
| **RGB gepackt**     | rgb24, bgr24, rgb0, bgr0, rgba, bgra, argb, abgr, rgb48le, bgr48le, rgba64le, bgra64le |
| **RGB planar**      | gbrp, gbrp10le, gbrp12le, gbrp16le, gbrap, gbrap10le, gbrap16le                        |
| **Monochrom**       | gray, gray10le, gray12le, gray16le, grayf32le, ya8, ya16le                             |
| **HDR**             | p010le, p016le, x2rgb10le                                                              |

### Eingabedateiendungen

| Kategorie | Endungen                                                                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Video    | `mp4`, `m4v`, `avi`, `mkv`, `mov`, `qt`, `flv`, `f4v`, `wmv`, `asf`, `webm`, `3gp`, `3g2`, `mpg`, `mpeg`, `mts`, `m2ts`, `ts`, `mxf`, `ogv`, `ogg`, `vob`, `divx`, `dv`, `rm`, `rmvb`, `h264`, `h265`, `hevc` |
| Audio    | `mp3`, `aac`, `wav`, `flac`, `ogg`, `opus`, `m4a`, `wma`, `alac`, `aiff`, `aif`, `au`, `caf`, `pcm`, `mid`, `midi`                                                                                            |
| Bild     | `jpg`, `jpeg`, `png`, `webp`, `bmp`, `gif`, `tiff`, `tif`, `svg`, `ico`, `heic`, `heif`, `avif`, `ppm`, `pgm`, `pbm`, `xbm`                                                                                   |
| Untertitel | `srt`, `ass`, `ssa`, `vtt`, `sub`, `idx`, `smi`                                                                                                                                                             |

## Validierungs-Utilities

| Funktion                     | Beschreibung                | Akzeptierte Formate                                   |
| ---------------------------- | --------------------------- | ----------------------------------------------------- |
| `isValidTime(value)`         | Validiert Zeitzeichenketten | `HH:MM:SS`, `HH:MM:SS.mmm`, Sekunden als Zahl         |
| `isValidScale(value)`        | Validiert Auflösung/Skalierung | `WxH`, `W:H`, Prozent `1%`–`999%`, positive Zahl   |
| `isValidBitrate(value)`      | Validiert Bitrate-Zeichenketten | z. B. `128k`, `1M`, `2000K`                       |
| `isInRange(value, min, max)` | Prüft numerischen Bereich   | Jede endliche Zahl                                    |

## Transcoder-Konstanten

| Konstante                                         | Wert                                                                                                                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRANSCODER_TYPES`                                | `['FFMPEG', 'FFTOOL', 'BMF']`                                                                                                                                     |
| `TRANSCODER_LABELS`                               | `{ FFMPEG: 'FFmpeg (API)', FFTOOL: 'FFmpeg (CLI)', BMF: 'BMF Framework' }`                                                                                        |
| `FFMPEG_FLAGS`                                    | `-c`, `-vcodec`, `-acodec`, `-b:v`, `-b:a`, `-qscale:v`, `-vf`, `-pix_fmt`, `-color_range`, `-ss`, `-to`, `-t`, `-y`, `-i`, `-an`, `-sn`, `-dn`, `-re`, `-copyts` |
| `FFPROBE_FLAGS`                                   | `-v quiet -print_format json -show_format -show_streams`                                                                                                          |
| `TRANSCODER_COMMANDS`                             | `bmf_ffmpeg`, `bmf_ffprobe`, `ffmpeg`, `ffprobe`                                                                                                                  |
| `TRANSCODER_DEFAULTS.PROGRESS_INTERVAL_MS`        | `500`                                                                                                                                                             |
| `TRANSCODER_DEFAULTS.PLAYER_DEFAULT_WIDTH/HEIGHT` | `640` / `360`                                                                                                                                                     |
| `TRANSCODER_DEFAULTS.PLAYER_FPS_CAP`              | `30`                                                                                                                                                              |
| `TRANSCODER_DEFAULTS.FFPROBE_TIMEOUT_MS`          | `30000`                                                                                                                                                           |
| `CONVERSION_DEFAULTS.VIDEO_CODEC`                 | `libx264`                                                                                                                                                         |
| `CONVERSION_DEFAULTS.AUDIO_CODEC`                 | `aac`                                                                                                                                                             |
| `CONVERSION_DEFAULTS.QSCALE`                      | `23`                                                                                                                                                              |
| `CONVERSION_DEFAULTS.PIXEL_FORMAT`                | `yuv420p`                                                                                                                                                         |
| `CONVERSION_DEFAULTS.SCALE`                       | `1920x1080`                                                                                                                                                       |
| `CONVERSION_DEFAULTS.VIDEO_BITRATE`               | `2000k`                                                                                                                                                           |
| `CONVERSION_DEFAULTS.AUDIO_BITRATE`               | `192k`                                                                                                                                                            |
| `QSCALE_RANGE.MIN/MAX`                            | `1` / `31`                                                                                                                                                        |
