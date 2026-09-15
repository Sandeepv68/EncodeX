---
title: "OBS- und ShadowPlay-Aufnahmen zum Teilen komprimieren"
description: "Große Gameplay-Aufnahmen von OBS oder ShadowPlay mit EncodeX auf upload-freundliche Größen verkleinern — eine kostenlose FFmpeg-GUI mit GPU-Beschleunigung."
date: 2026-09-14
tags:
  - guide
  - gaming
  - compression
  - obs
---

# OBS- und ShadowPlay-Aufnahmen zum Teilen komprimieren

Das Aufnehmen von Gameplay in 1080p 60fps erzeugt riesige Dateien. Eine zehnminütige Session kann leicht 5–10 GB erreichen, längere Sessions können über 50 GB liegen. Diese Dateien sind ideal zum Bearbeiten — sie werden in hoher Qualität mit minimaler Komprimierung erfasst —, aber sie sind viel zu groß, um sie auf Discord hochzuladen, in einen Stream einzubetten, an Freunde zu schicken oder in sozialen Netzwerken zu posten.

Die Lösung ist ein zweiter Encodierungsschritt: das qualitativ hochwertige Original nehmen, auf eine sinnvolle Bitrate komprimieren und eine Datei erzeugen, die nur einen Bruchteil der Größe hat, aber auf dem Bildschirm fast identisch aussieht.

## Warum Gameplay-Aufnahmen So Groß Sind

OBS und ShadowPlay zeichnen standardmäßig mit hohen Bitraten auf — oft 20 000 bis 50 000 kbps. Das bewahrt jedes Detail für die Bearbeitung, aber die meisten Zuschauer werden den Unterschied zwischen einer 50-Mbps-Aufnahme und einem 10-Mbps-Encoding auf einem Handy- oder Laptop-Display nie bemerken. Der entscheidende Punkt: Ihre Quelldatei ist zum Bearbeiten gedacht, nicht zum Ansehen. Wenn Sie sie für die Wiedergabe komprimieren, entsteht eine Datei, die für das Publikum gleich aussieht, aber deutlich weniger wiegt.

## Der Ideale Kompromiss bei der Komprimierung für Gameplay

Für Gameplay-Material, das zu YouTube, Discord oder sozialen Netzwerken soll:

- **Codec:** H.264 (am kompatibelsten) oder H.265 (kleinere Dateien)
- **Auflösung:** Die native Auflösung behalten, wenn sie 1080p oder darunter liegt; für die meisten Plattformen 4K auf 1080p herunterskalieren
- **Bitrate:** 5 000–10 000 kbps für 1080p 60fps ist der optimale Bereich — hoch genug, um schnelle Action zu erhalten, niedrig genug, um die Datei drastisch zu verkleinern
- **CRF-Modus:** CRF 20–23 bietet eine gute Balance zwischen Qualität und Größe, ohne die Bitrate manuell wählen zu müssen

Eine zehnminütige Gameplay-Aufnahme in 1080p 60fps, die mit 30 Mbps aufgenommen wurde, wiegt rund 2,2 GB. Bei einer Neuencodierung mit CRF 22 kommt sie auf etwa 300–500 MB — eine Reduzierung von 75–85 % — und sieht auf YouTube oder einem Handy-Display praktisch identisch aus.

## So Komprimieren Sie Gameplay mit EncodeX

1. [EncodeX herunterladen](/de/download) und öffnen.
2. Ihre OBS- oder ShadowPlay-Aufnahme in das Fenster ziehen.
3. Ein Profil wählen: das Profil **[MP4 Maximum Compatibility](/de/video-compressor)** eignet sich für die meisten Teilen-Szenarien, oder wählen Sie ein kleineres Profil für Discord und Chat.
4. Auf **Komprimieren** klicken.

EncodeX nutzt Ihre GPU (NVENC bei NVIDIA, AMF bei AMD, QSV bei Intel), um die Datei schnell zu komprimieren. Eine zehnminütige Aufnahme wird normalerweise in weniger als zwei Minuten encodiert — schneller als in Echtzeit.

## Mehrere Clips Komprimieren

Wenn Sie eine lange Session aufgenommen haben und bestimmte Clips extrahieren und komprimieren möchten, können Sie mit dem **Video Cut**-Tool vor dem Komprimieren einen Zeitbereich zuschneiden. So verschwenden Sie keinen Speicherplatz für die Teile, die Sie nicht brauchen.

Für die Stapelverarbeitung — die Komprimierung eines ganzen Ordners mit Aufnahmen — verarbeitet die [Stapel-Warteschlange](/de/features) mehrere Dateien nacheinander mit denselben Einstellungen.

## Audio für Podcasts oder Highlights Extrahieren

Manchmal möchten Sie nur den Ton eines Gameplay-Clips — für einen Podcast-Ausschnitt, einen Voiceover oder eine Highlights-Zusammenstellung. Das [Audio-Extraktions-Tool](/de/extract-audio-from-video) extrahiert die Tonspur und gibt sie in einem Schritt als MP3 oder AAC aus:

1. Die Aufnahme in das Audio-Extraktions-Tool ziehen.
2. MP3 oder AAC wählen.
3. Auf **Extrahieren** klicken.

Der Ton wird mit der von Ihnen gewählten Bitrate ausgegeben (standardmäßig 192k), bereit zum Bearbeiten oder Teilen.

## Warum EncodeX Statt HandBrake für Diesen Zweck

HandBrake ist ein bekanntes Video-Transcoding-Programm, und es funktioniert gut für die Komprimierung. Aber EncodeX bietet einige Dinge, die HandBrake nicht hat:

- **Die GPU-Erkennung ist automatisch** — keine Konfiguration von Encoder-Einstellungen nötig
- **Der Workflow ist schneller** — Datei ablegen, Profil wählen, komprimieren. Keine Tab-Navigation oder erweiterte Einstellungen erforderlich.
- **Die Komprimierungsvorschau zeigt die geschätzte Ausgabegröße**, bevor Sie beginnen
- **Die Stapel-Warteschlange ist integriert** — kein separater Batch-Modus zum Konfigurieren
- **Es ist plattformübergreifend** — Windows, macOS und Linux mit derselben Oberfläche

Für den detaillierten Vergleich siehe [EncodeX vs. HandBrake](/de/handbrake-alternative).

---

*Laden Sie EncodeX kostenlos auf [encodex.in/download](/de/download) herunter und komprimieren Sie noch heute Ihre Gameplay-Aufnahmen.*