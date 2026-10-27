---
title: "Sicherheit bei EncodeX — Open Source, Prüfsummen & Meldung"
description: "So hält Sie EncodeX sicher: Open-Source-Code, mit jeder Version veröffentlichte SHA-256-Prüfsummen, ein GitHub-Digest-Check bei Updates und wie Sie eine Schwachstelle melden. Release-Builds sind nicht code-signiert und nicht notarisiert."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# Sicherheit bei EncodeX

EncodeX ist Open Source, daher muss Sicherheit nicht auf Vertrauen beruhen. Jede Version wird aus öffentlichem Code gebaut und veröffentlicht **SHA-256-Prüfsummen**, die Sie mit Ihrem Download vergleichen können. Release-Builds sind **nicht code-signiert und nicht notarisiert**, daher kann Ihr Betriebssystem unter macOS eine Warnung über einen „unbekannten Entwickler" anzeigen oder unter Windows eine „Windows protected your PC"-Warnung mit der Meldung „Unbekannter Herausgeber".

## Was wir ausliefern, können Sie verifizieren

- **Open Source.** Die gesamte App — einschließlich der Medienverarbeitungs-Pipeline und der Release-Skripte — lebt in [unserem Repository](https://github.com/Sandeepv68/EncodeX). Jede*r kann exakt prüfen, was die App tut.
- **SHA-256-Prüfsummen.** Jede Version veröffentlicht eine `SHA256SUMS.txt`-Datei neben den Binaries. Vergleichen Sie die heruntergeladene Datei mit dem veröffentlichten Hash, bevor Sie installieren:

```bash
# Windows (PowerShell)
Get-FileHash .\EncodeX-Setup-1.0.0.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 ./EncodeX-1.0.0.dmg
```

- **Verifizierte Updates.** Der Updater prüft GitHub Releases. Wenn GitHub für die Update-Datei einen SHA-256- oder SHA-512-Digest veröffentlicht, überprüft die App den Download dagegen. Der Updater überprüft keine kryptografische Signatur. Updates werden niemals automatisch installiert; Sie entscheiden, wann Sie installieren.

## Hinweis zu macOS Gatekeeper

Da EncodeX kostenlos und Open Source ist, nicht über den Mac App Store verkauft wird und seine macOS-Builds nicht von Apple code-signiert oder notarisiert sind, kann macOS beim ersten Mal eine „Kann nicht geöffnet werden"-Meldung zeigen. Der Build ist der auf der Releases-Seite veröffentlichte. Zum Öffnen Control-klicken Sie die App in Programme und wählen einmal **Öffnen**. Bei neueren macOS-Versionen müssen Sie eventuell stattdessen **Systemeinstellungen → Datenschutz & Sicherheit → Dennoch öffnen** verwenden.

## Hinweis zu Windows SmartScreen

Da EncodeX kostenlos und Open Source ist und seine Windows-Builds nicht code-signiert sind, kann Windows SmartScreen beim Start des Installers eine Warnung „Windows protected your PC" mit der Meldung „Unbekannter Herausgeber" anzeigen. Das ist erwartet und bedeutet nicht, dass der Download beschädigt ist. Klicken Sie auf **Weitere Infos** und dann auf **Trotzdem ausführen**.

Auch SmartScreen kann die Authentizität des Herausgebers nicht belegen, da der Build keine Code-Signatur trägt. Vergleichen können Sie stattdessen die mit jeder Version veröffentlichte SHA-256-Prüfsumme.

## Das gebündelte FFmpeg

EncodeX liefert vorgebaute FFmpeg- und FFprobe-Binaries aus (aus den Paketen `ffmpeg-static` und `ffprobe-static`), statt einen System-Binary aufzurufen. Die Konvertierungen laufen als Kindprozess auf Ihrem Gerät. Wie die Engine eingebunden ist, erklärt unsere [technische Architektur](/de/docs/architecture).

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