---
title: "Sicherheit bei EncodeX — Verifizierbar, signiert, Open Source"
description: "So hält Sie EncodeX sicher: Open-Source-Code, SHA-256-Checksummen für jeden Download, Code-Signierung auf macOS und Windows und ein verifizierbarer Update-Prozess — plus wie Sie eine Schwachstelle melden."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# Sicherheit bei EncodeX

EncodeX ist Open Source, daher muss Sicherheit nicht auf Vertrauen beruhen — jede Version wird aus öffentlichem Code gebaut, wird mit **SHA-256-Checksummen** ausgeliefert, die Sie verifizieren können, und ist, wo möglich, **code-signiert**, damit Ihr Betriebssystem bestätigen kann, dass sie wirklich von uns stammt.

## Was wir ausliefern, können Sie verifizieren

- **Open Source.** Die gesamte App — einschließlich der Medienverarbeitungs-Pipeline und des gebündelten FFmpeg-Builds — lebt in [unserem Repository](https://github.com/Sandeepv68/EncodeX). Jede*r kann exakt prüfen, was die App tut.
- **SHA-256-Checksummen.** Jede Version veröffentlicht Checksummen neben den Binaries. Vergleichen Sie die heruntergeladene Datei mit dem veröffentlichten Hash, bevor Sie installieren:

```bash
# Windows (PowerShell)
Get-FileHash .\EncodeX-Setup-1.0.0.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 ./EncodeX-1.0.0.dmg
```

- **Code-Signierung.** Die Versionen für Windows und macOS sind signiert, sodass Ihr OS „verifizierter Herausgeber"/„Apple" statt einer „Unbekannte Entwickler"-Warnung zeigt.
- **Verifizierbare Updates.** Die App lädt nur von uns signierte Updates über HTTPS herunter. Die Update-Signatur wird lokal validiert, bevor etwas ersetzt wird.

## Hinweis zu macOS Gatekeeper

Da EncodeX kostenlos und Open Source ist (und nicht über den Mac App Store verkauft wird), kann macOS beim ersten Mal eine „Kann nicht geöffnet werden"-Meldung zeigen — das ist die **Gatekeeper**-Prüfung für standardmäßig unsignierte Apps. Der Build ist echt; zum Öffnen Control-klicken Sie die App in Programme und wählen einmal **Öffnen**. Danach öffnet sie sich normal.

## Das gebündelte FFmpeg

EncodeX bündelt seinen eigenen FFmpeg-Build, statt einen System-Binary aufzurufen. Der exakte Build (Version, Quelle und Konfiguration) ist in unserer [technischen Architektur](/de/docs/architecture) dokumentiert und wird in CI aus der Quelle reproduziert — so verhalten sich Konvertierungen überall gleich, und der Binary, den Sie ausführen, ist der, den wir gebaut haben.

## Eine Schwachstelle melden

Wir nehmen Sicherheit ernst und folgen einem unkomplizierten Offenlegungsprozess:

1. Melden Sie Schwachstellen **nicht** in öffentlichen GitHub-Issues — Sie würden den Fehler offenlegen, bevor wir ihn beheben können.
2. Öffnen Sie ein **[privates Security Advisory](https://github.com/Sandeepv68/EncodeX/security/advisories/new)** im Repository.
3. Wir bestätigen den Eingang **innerhalb von 48 Stunden** und nennen einen geschätzten Zeitrahmen für den Fix. Sicherheits-Fixes haben Priorität und erscheinen so schnell wie möglich.

Für alles andere nutzen Sie den [regulären Issue-Tracker](https://github.com/Sandeepv68/EncodeX/issues).

## Loslegen

- [EncodeX kostenlos herunterladen](/de/download)
- [Datenschutzerklärung lesen](/de/privacy)
- [Technische Architektur und gebündeltes FFmpeg](/de/docs/architecture)