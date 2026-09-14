---
title: "Die besten Formate für Video-Archive: Deine Medien jahrzehntelang erhalten"
description: "Ein praktischer Leitfaden zu Archiv-Videocodecs – FFV1, ProRes, HuffYUV, verlustfreies Kopieren – und wie EncodeX dir hilft, deine Medien zukunftssicher zu machen."
date: 2026-09-13
tags:
  - guide
  - archival
  - codecs
  - prores
  - ffv1
---

# Die besten Formate für Video-Archive: Deine Medien jahrzehntelang erhalten

Videodateien veralten – nicht so, wie ein Foto verblasst, sondern so, wie sich Technologie weiterentwickelt. Ein Codec, der heute funktioniert, wird von deinem Player in zehn Jahren vielleicht nicht mehr unterstützt. Ein Format, das dauerhaft schien, könnte hinter einem proprietären Encoder eingeschlossen sein, auf den du keinen Zugriff mehr hast. Archiv-Video bedeutet, Entscheidungen zu treffen, die deine Medien so lange wie möglich abspielbar und originalgetreu halten.

## Warum die Wahl des Archivformats wichtig ist

Jedes Mal, wenn du ein Video transcodierst – es von einem Codec in einen anderen neu encodierst –, verlierst du ein wenig Information. Bei verlustbehafteten Codecs wie H.264 oder H.265 führt jede Transcoding-Generation zu subtiler Verschlechterung. Bei verlustfreien Codecs geht keine Information verloren, aber die Dateien sind viel größer.

Das Ziel der Archivierung ist es, die Originaldaten so zu speichern, dass sie über Jahrzehnte hinweg akkurat bleiben. Das bedeutet, Formate zu wählen, die offen, gut dokumentiert und kaum Gefahr laufen, veraltet zu sein.

## Die Archiv-Codecs

### FFV1

FFV1 (FF Video Codec 1) ist der Goldstandard für Archiv-Video. Er ist Open Source, verlustfrei (oder bei niedrigeren Einstellungen fast verlustfrei) und speziell für die Langzeitbewahrung entwickelt. Große Archive – darunter Internet Archive und die Library of Congress – verwenden FFV1 für ihre Videosammlungen.

FFV1 unterstützt Multithreading, Fehlerresilienz und eine breite Palette an Pixelformaten. Er wird typischerweise in einem Matroska-Container (`.mkv`) gespeichert, der selbst offen und gut dokumentiert ist.

**Wann verwenden:** Archiv-Originale, Filmbewahrung, jede Situation, in der die Datei über Jahre hinweg exakt so bleiben muss, wie sie ist.

### ProRes

Die ProRes-Familie von Apple wird in der professionellen Videoproduktion häufig eingesetzt. Es ist ein verlustbehafteter Codec, aber die Qualitätsstufen sind so hoch, dass der Verlust bei normaler Wiedergabe unsichtbar ist. ProRes ist das Standard-Austauschformat vieler Videoeditoren – wenn du jemandem eine ProRes-Datei gibst, kann er mit fast jeder Schnittsoftware damit arbeiten.

EncodeX unterstützt ProRes über FFmpeg, mit Profilen von Proxy (Bearbeitung mit niedriger Bandbreite) bis 4444 XQ (visuell verlustfrei).

**Wann verwenden:** Arbeitskopien für die Bearbeitung, Zwischendateien in einer Produktions-Pipeline, Austausch mit Editoren, die Final Cut Pro oder DaVinci Resolve verwenden.

### HuffYUV

HuffYUV ist ein verlustfreier Codec, der einfacher und schneller als FFV1 ist. Er erzeugt große Dateien, encodiert und decodiert aber schnell, was ihn als Zwischenformat in Bearbeitungsworkflows nützlich macht, in denen du verlustfreie Qualität brauchst, ohne den Rechenaufwand von FFV1.

**Wann verwenden:** Schnelle Zwischen-Encodierung während der Bearbeitung, Bildschirmaufnahme-Archive, Situationen, in denen Encode-/Decode-Geschwindigkeit genauso zählt wie Qualität.

### Unkomprimiertes YUV

Das unkomplizierteste Archivformat: gar keine Komprimierung. Jedes Pixel wird so gespeichert, wie es ist. Die Dateien sind enorm – ein einminütiger Clip in 1080p kann mehrere Gigabyte groß sein –, aber die Daten sind vollständig unverändert.

**Wann verwenden:** Die absolut höchste Wiedergabetreue, wissenschaftliche oder medizinische Bildgebung oder als Referenz für Qualitätsvergleiche.

## Verlustfreies Kopieren: Kein Archivieren, aber Bewahren

Wenn deine Quelldatei bereits in einem guten Codec vorliegt (etwa H.264 in einem MP4-Container) und du nur den Container für Kompatibilität ändern musst, kannst du eine verlustfreie Kopie erstellen – keine Neu-Encodierung, kein Qualitätsverlust, nahezu sofortige Konvertierung:

```bash
encodex convert in.mkv -o out.mp4 --video-codec copy --audio-codec copy
```

Das bewahrt die ursprünglichen Streams exakt. Das ist keine Archivierung im Sinne von „Langzeitbewahrung“, aber perfekt, um Kompatibilität ohne Verschlechterung zu erhalten.

## Wie EncodeX Archiv-Workflows unterstützt

EncodeX enthält integrierte Profile für Archiv-Codecs:

- **[ProRes-Profile](/de/codecs/prores)** – von Proxy bis 4444 XQ, nach Anwendungsfall organisiert
- **FFV1 in Matroska** – verlustfreie Archivierung mit maximaler Wiedergabetreue
- **HuffYUV** – schnelles verlustfreies Encodieren
- **Verlustfreies Kopieren** – Container-Konvertierung ohne Neu-Encodierung

Die vollständige Liste findest du in der [Funktionsübersicht](/de/features) oder in der [Codec-Dokumentation](/de/codecs/prores).

## Eine praktische Archivstrategie

1. **Behalte deine Originaldateien.** Lösche Quelldateien nicht, nachdem du sie konvertiert hast.
2. **Erstelle eine verlustfreie Archivkopie** in FFV1/MKV oder ProRes für alles, was du langfristig erhalten möchtest.
3. **Erstelle eine verlustbehaftete Weitergabekopie** in H.264/H.265 zum Teilen, Hochladen oder beiläufigen Ansehen.
4. **Dokumentiere deinen Workflow.** Notiere Codec, Einstellungen und verwendete Werkzeuge – das hilft zukünftigen Archivaren zu verstehen, womit sie arbeiten.

---

*Lade EncodeX kostenlos auf [encodex.in/download](/de/download) herunter und beginne, deine Medien mit Codecs in Archivqualität zu erhalten.*