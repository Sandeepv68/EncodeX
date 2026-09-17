---
date: 2026-09-17
title: "Videos drehen und spiegeln — seitliche Clips ohne Qualitätsverlust korrigieren"
description: "EncodeX kann Videos und Fotos jetzt um 90°, 180° oder 270° im Uhrzeigersinn drehen und horizontal oder vertikal spiegeln. Bei MP4/MOV/MKV wird die Drehung als verlustfreie Metadaten gespeichert — ganz ohne Neukodierung."
tags:
  - feature
  - rotation
  - release
---

# Videos drehen und spiegeln

Ein Video mit dem Handy falsch herum aufgenommen? Das kennen wir alle. Ab heute kann EncodeX das beheben: **Drehen & Spiegeln** dreht Videos und Fotos um **90°, 180° oder 270° im Uhrzeigersinn** und kippt sie **horizontal oder vertikal** — direkt auf der Konvertieren-Seite und in der Batch-Warteschlange.

## Ein Klick, und es passt

Ein seitliches Video ist in Sekunden korrigiert:

1. Öffnen Sie die **Konvertieren**-Seite (oder fügen Sie Dateien zur **Batch-Warteschlange** hinzu)
2. Wählen Sie ein beliebiges Video oder Bild als Quelle
3. Wählen Sie im Einstellungsbereich im Dropdown **Drehung** einen Winkel — `90°`, `180°` oder `270°` im Uhrzeigersinn — und kippen Sie das Bild über die Schalter **Horizontal spiegeln** / **Vertikal spiegeln**
4. Konvertieren

Das war's. Die Ausgabe ist exakt so ausgerichtet, wie Sie es wünschen. Das funktioniert mit Videos **und** Bildern, sowohl bei einzelnen Konvertierungen als auch bei Batch-Jobs (Transcodieren und Bildkomprimierung unterstützen es beide).

## So funktioniert es (zwei Wege)

Die Drehung kann je nach Ausgabeformat auf zwei Arten angewendet werden:

### Verlustfreie Metadaten-Drehung (ohne Neukodierung)

Wenn Ihre Ausgabe **MP4, MOV oder MKV** ist und Sie den Modus **Stream-Copy (verlustfreies Kopieren)** mit einem Drehwinkel und ohne Spiegelung verwenden, speichert EncodeX die Drehung als normale Anzeige-Metadaten (`rotate=`). Der Player dreht das Video beim Abspielen — **die Qualität bleibt unberührt** und der Vorgang dauert Sekunden, weil nichts neu kodiert wird. Spiegelung gehört nicht zu diesem Weg: Beim Kippen ändern sich immer die Pixel, daher wird hier immer neu kodiert.

Unterstützt der Container das Format, zeigt die Konvertieren-Seite einen hilfreichen Hinweis, dass die Drehung verlustfrei angewendet wird. Unterstützt der Ausgabe-Container es *nicht* (z. B. WebM, FLV, GIF und Bildausgaben), erscheint eine Warnung mit der Aktion **Verlustfreies Kopieren deaktivieren**, die per Klick zum Neukodieren wechselt.

### Pixel-Drehung (Neukodierung)

Für jedes andere Format — oder immer wenn Sie das Video spiegeln — kodiert EncodeX die Frames mit einer FFmpeg-Filterkette (`transpose` + `hflip`/`vflip`) neu, die sauber mit dem vorhandenen `scale`-Filter kombiniert wird. Da die Drehung in 90°-Schritten erfolgt, gibt es keine Interpolation — das Ergebnis bleibt gestochen scharf.

## Teil der Batch-Warteschlange

Drehung und Spiegelung sind nicht auf einzelne Konvertierungen beschränkt. Sie gehören auch zur **Batch-Warteschlange**: Stellen Sie sie im Batch-Panel ein, um sie auf das gesamte Batch anzuwenden, oder bearbeiten Sie einen einzelnen Job in dessen Optionen-Dialog. Batch-Jobs kodieren immer neu, daher werden Drehung und Spiegelung einfach Teil der Job-Optionen — zusammen mit Codec, Bitrate und Skalierung.

## Unter der Haube

- Die Drehung nutzt FFmpegs `transpose`-Filter: `transpose=1` für 90°, `transpose=2,transpose=2` für 180° und `transpose=2` für 270° (mit Spiegelfiltern je nach Bedarf).
- Ist auch `scale` gesetzt, wird beides in einem einzigen `-vf`-Argument kombiniert (erst skalieren, dann drehen), damit die Filterkette effizient bleibt.
- Im Stream-Copy-Modus mit unterstütztem Container wird neben `-c copy` die Option `-metadata:s:v rotate=<deg>` geschrieben — kein Decodieren, kein Neukodieren, kein Qualitätsverlust.
- Die Batch-Warteschlange und das Bildkomprimierungs-Panel bieten dieselben Steuerelemente; `compress_image`-Jobs drehen Bilder auf dieselbe Weise.

## Was kommt als Nächstes?

Drehungs-Presets in den Konvertierungsprofilen sind der naheliegende nächste Schritt, zusammen mit Optionen wie beliebigen Winkeln. Wenn Sie einen Dreh- oder Spiegelungs-Workflow vermissen, [eröffnen Sie ein Issue](https://github.com/Sandeepv68/EncodeX/issues) und erzählen Sie uns davon.

---

[EncodeX herunterladen](/download) · [Alle Funktionen ansehen](/features) · [Dokumentation lesen](/docs/features-reference)