---
date: 2026-09-02
title: "Konvertierungsprofile — Über 140 Voreinstellungen für Kodierung mit einem Klick"
description: "EncodeX liefert jetzt über 140 eingebaute Konvertierungsprofile in 8 Kategorien. Wählen Sie eine Voreinstellung für YouTube, Instagram, TikTok, Apple-Geräte, ProRes, HLS-Streaming und mehr — alle Einstellungen werden automatisch ausgefüllt."
tags:
  - feature
  - profiles
  - release
---

# Konvertierungsprofile vorgestellt

Wir haben gerade eines der meistgewünschten Features in EncodeX ausgeliefert: **Konvertierungsprofile**. Anstatt bei jeder Konvertierung manuell Codecs, Bitraten, Qualitätseinstellungen und Containerformate auszuwählen, können Sie jetzt aus über 140 vorkonfigurierten Voreinstellungen wählen, die die gesamte Arbeit für Sie erledigen.

## Was sind Konvertierungsprofile?

Ein Konvertierungsprofil ist eine gespeicherte Kodierungskonfiguration. Es sagt EncodeX genau, welchen Video-Codec, Audio-Codec, welche Bitrate, Qualität, Auflösung, Pixelformat und welchen Container verwenden werden sollen — alles mit einem Klick.

Stellen Sie es sich wie ein Rezept vor. Anstatt jedes Zutat selbst abzumessen, wählen Sie ein Rezept und alles ist fertig.

## Was enthalten ist

Die über 140 eingebauten Profile sind in 8 Kategorien organisiert:

### Web & Social

Optimierte Voreinstellungen für die Plattformen, auf denen Sie tatsächlich posten:

- **YouTube** — 480p bis 4K, mit H.264-, H.265- und AV1-Varianten
- **Instagram** — Reels, Stories und Feed-Beiträge im richtigen Seitenverhältnis und Codec
- **TikTok** — vertikale Video-Voreinstellungen, abgestimmt für schnellen Upload und gute Qualität
- **Facebook** — Videobeiträge und Werbeanzeigen
- **X (Twitter)** — Kurzform-Video mit Dateigrößen-Bewusstsein

### Geräte

Voreinstellungen, die auf spezifische Hardware abgestimmt sind:

- **Apple** — iPhone, iPad, Mac, Apple TV (H.264 und HEVC)
- **Android** — Telefon- und Tablet-Voreinstellungen
- **Spielkonsole** — PlayStation-, Xbox- und Nintendo-Switch-kompatible Formate

### Video-Codecs

Codec-spezifische Profile, wenn Sie wissen, welchen Encoder Sie möchten:

- H.264, H.265/HEVC, VP8, VP9, AV1
- MPEG-4, MPEG-2, Theora

### Professionell

Broadcast- und Post-Produktionsformate:

- **ProRes** — 422 LT, 422, 422 HQ, 4444, 4444 XQ
- **DNxHD / DNxHR** — mehrere Auflösungs- und Qualitätsschichten
- **FFV1** — verlustfreies Archiv-Codec
- **XDCAM / XAVC** — Sony-Broadcast-Formate

### Streaming

Adaptive-Bitrate-Streaming-Voreinstellungen:

- **HLS** — HTTP Live Streaming mit konfigurierbarer Segmentdauer
- **DASH** — MPEG-DASH-Ausgabe

### Audio

Audio-only-Konvertierungsvoreinstellungen:

- MP3 (128k, 192k, 320k)
- AAC (128k, 192k, 256k)
- FLAC (verlustfrei)
- Opus, WAV und mehr

### Bilder

Bildformat-Konvertierung:

- JPEG, PNG, WebP, AVIF mit Qualitätssteuerung

### Erweitert

Für fortgeschrittene Benutzer:

- Raw-FFmpeg-Argument-Voreinstellungen
- Benutzerdefinierte FFmpeg-Weiterleitung
- Null-Ausgabe zum Testen

## So verwenden Sie Profile

1. Öffnen Sie die Seite **Konvertieren** (oder die **Stapelverarbeitung**)
2. Suchen Sie den **Profilwahlschalter** oben im Einstellungsbereich
3. Nach Kategorie stöbern oder nach Name suchen
4. Auf ein Profil klicken — alle Kodierungsfelder werden automatisch ausgefüllt
5. Nach Belieben anpassen und auf Konvertieren klicken

Der Profilschalter zeigt jedes Profil mit einem Icon-Badge der Kategorie an, sodass Sie schnell zwischen YouTube- und ProRes-Voreinstellungen unterscheiden können.

## Benutzerdefinierte Profile

Wenn das eingebaute Katalogangebot Ihren genauen Anwendungsfall nicht abdeckt, erstellen Sie Ihr eigenes:

1. Konfigurieren Sie Ihre Kodierungseinstellungen manuell
2. Klicken Sie auf die Speicher-Schaltfläche im Profilschalter
3. Geben Sie einen Namen und eine Kategorie ein
4. Ihr benutzerdefiniertes Profil erscheint neben den eingebauten

Benutzerdefinierte Profile werden lokal gespeichert und bleiben zwischen Sitzungen erhalten. Sie können sie jederzeit bearbeiten oder löschen. (Eingebaute Profile sind gesperrt — Sie können sie verwenden, aber nicht ändern.)

## Zuletzt verwendet

EncodeX merkt sich die zuletzt verwendeten 5 Profile, sodass Ihre häufigsten Workflows immer nur einen Klick entfernt sind. Kein Kategorien durchstöbern nötig, wenn Sie immer dieselben zwei Voreinstellungen verwenden.

## Stapelverarbeitungs-Unterstützung

Profile funktionieren auch in der Stapelverarbeitung. Wenden Sie ein Profil an, um die Kodierungsoptionen für neue Jobs festzulegen, oder verwenden Sie es als Ausgangspunkt vor dem Anpassen individueller Stapel-Einträge.

## Unter der Haube

Jedes Profil ordnet einem `ConversionProfile`-Objekt zu, das speichert:

- Containerformat und Ausgabeerweiterung
- Video- und Audio-Codec-Auswahl
- Bitrate-, CRF- und Qualitätseinstellungen
- Skalierung, Pixelformat und FPS
- Erweiterte FFmpeg-Argumente (`extraArgs` und `inputArgs`) für professionelle Formate

Wenn Sie ein Profil anwenden, schreibt EncodeX diese Werte in das Konvertierungsformular. Die erweiterten Profile können rohe FFmpeg-Flags direkt an den Encoder übergeben — so unterstützen wir Dinge wie ProRes-Profileinstellungen und HLS-Segmentkonfiguration.

Profile sind ein GUI-Feature — die CLI verwendet weiterhin explizite Flags (`--video-codec`, `--audio-codec` usw.) für maximale Flexibilität in Skripten und Automatisierungen.

## Was kommt als Nächstes

Wir werden den Profilkatalog basierend auf Community-Feedback weiter erweitern. Wenn Sie eine Plattform oder ein Format wünschen, für das es noch kein Profil gibt, [öffnen Sie ein Issue](https://github.com/Sandeepv68/EncodeX/issues) und lassen Sie es uns wissen.

---

[EncodeX herunterladen](/download) · [Alle Funktionen ansehen](/features) · [Dokumentation lesen](/docs/features-reference)
