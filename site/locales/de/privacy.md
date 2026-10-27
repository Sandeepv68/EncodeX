---
title: "Datenschutzrichtlinie – EncodeX lädt Ihre Dateien niemals hoch"
description: "Datenschutzrichtlinie von EncodeX: 100% Offline-Verarbeitung, keine Konten, kein Tracking Ihrer Medien, keine Datenerfassung. Ihre Videos und Audios verlassen niemals Ihren Computer."
---

# Datenschutzrichtlinie

**Kurzversion: Ihre Dateien verlassen niemals Ihren Computer.**

EncodeX ist eine Desktop-Anwendung, die alle Medien **lokal und offline** verarbeitet. Wir haben keine Server, die Ihre Videos empfangen, keine Cloud-Verarbeitung und keinen Grund, Ihre Dateien zu sehen.

*Letzte Aktualisierung: September 2026*

## Die Kurzversion

- **100% offline** — alle Konvertierung, Kompression und Extraktion erfolgt auf Ihrem Gerät
- **Kein Konto** — nichts zum Anmelden, kein Profil zu pflegen
- **Keine Uploads** — Ihre Medien werden nie an uns oder jemand anderen übertragen
- **Telemetrie zum Abschalten** — Fehlerberichte und anonyme, kategoriale Nutzungsanalysen sind standardmäßig aktiv, und ein Schalter in den Einstellungen deaktiviert beides. Update-Prüfungen und konfigurierte KI-Anbieter lösen ebenfalls Netzwerkanfragen aus (siehe unten)
- **Open Source** — jeder kann genau prüfen, was die App tut

## Was wir nicht erfassen

EncodeX erfasst, übermittelt oder speichert keine Ihrer Mediendateien, Ordnernamen oder sonstigen Angaben, die Sie identifizieren könnten. Die Konvertierung läuft auf Ihrem Computer. Die App sendet standardmäßig Fehlerberichte und anonyme Nutzungsereignisse und kann außerdem die unten aufgeführten ausgehenden Anfragen stellen. Fehlerberichte und Nutzungsanalysen können Sie in den Einstellungen abschalten.

## Was wir tun

Das Einzige, was wir jemals sehen, ist, was Sie uns freiwillig senden:

- **GitHub** — wenn Sie ein Problem melden, dem Repository einen Stern geben oder beitragen, erfasst GitHub Daten gemäß seiner eigenen [Datenschutzrichtlinie](https://docs.github.com/en/site-policy/privacy-policies)
- **Unsere Website (encodex.in)** — eine datenschutzfreundliche Website ohne Cookies. Wir verwenden einfache, datenschutzfreundliche Analysen, um aggregierte Seitenaufrufe zu sehen — nie mit Ihrer Identität verknüpft
- **Support** — wenn Sie uns eine E-Mail schreiben, lesen wir die Nachricht, die Sie senden (selbstverständlich)

## Die Website

Die EncodeX-Website selbst:

- Keine Werbung
- Keine Third-Party-Tracking-Cookies
- Datenschutzfreundliche Analysen (kein Cross-Site-Tracking, keine persönlichen Daten)

## Welche Telemetrie existiert

Zur völligen Transparenz — hier sind alle Daten, die EncodeX erhebt, auf der Website und in der App:

### Die Website (encodex.in)

- **Cookie-lose Seitenaufrufe.** Wir messen aggregierte Seitenaufrufe mit einer datenschutzfreundlichen Analyse-Einrichtung — keine Cookies, kein Cross-Site-Tracking, kein Session-Replay und nichts, das mit Ihrer Identität verknüpft wäre. Wir können nicht sehen, wer Sie sind.

### Die Desktop-App

- **Fehlerberichte.** Die App kann Crash- und Fehlerdiagnosen an Sentry senden. Das ist **standardmäßig aktiviert, mit einem Schalter in den Einstellungen**, um es jederzeit zu deaktivieren. Ein einziger Schalter, _Nutzungsdaten & Fehlerberichterstattung_ in den Einstellungen, steuert sowohl Fehlerberichte als auch Nutzungsanalysen. Die Auswahl wird lokal in `monitoring-consent.json` und `analytics-consent.json` gespeichert.
- **Nur kategoriale Nutzungsanalysen.** Wenn aktiviert, zeichnet die App anonyme, kategoriale Ereignisse gruppiert nach Funktionsbereich auf (zum Beispiel Navigation, Konvertierung, Warteschlange und Updates) über einen Nutzungsanalyse-Kanal. Bauartbedingt enthalten diese Daten **keine Medieninhalte, keine Dateinamen und keine Ordnerpfade.** Wenn Sie den Schalter ausschalten, werden diese Ereignisse nicht gesendet.
- **Keine Uploads, keine Cloud-Verarbeitung.** Selbst mit aktivierter Telemetrie werden Ihre Mediendateien nie übertragen. Konvertierung, Komprimierung und Extraktion finden auf Ihrem Gerät statt.

### Weitere Netzwerkanfragen

- **Update-Prüfungen** — wenn Sie nach Updates suchen, fragt die App GitHub Releases ab.
- **KI-Anbieter** — Copilot und KI-Funktionen nutzen standardmäßig den eingebauten Regel-Router, der offline funktioniert. Anfragen gehen nur dann an OpenAI, Anthropic oder Gemini, wenn Sie einen dieser Anbieter konfigurieren. Der lokale Anbieter läuft auf Ihrem Rechner.

### In klaren Worten

- Es gibt **kein Konto** — nichts anzulegen, kein Profil zu pflegen
- Ihre Dateien **verlassen nie Ihren Computer** — keine Uploads, keine Cloud-Verarbeitung
- Die Konvertierung funktioniert **vollständig offline**. Fehlerberichte, Nutzungsanalysen, Update-Prüfungen und konfigurierte KI-Anbieter sind die einzige Netzwerkaktivität — Fehlerberichte und KI-Anbieter steuern Sie selbst.

## So funktioniert

Es gibt keine Cloud, an die Ihre Dateien gesendet werden könnten. EncodeX bündelt die FFmpeg-Engine mit der App und führt jede Konvertierung als **lokalen Kindprozess auf Ihrem Gerät aus**, sodass Medien auf Ihrem Computer gelesen und geschrieben werden. Wenn Sie das überprüfen möchten, ist die gesamte App (einschließlich ihrer Medienverarbeitungs-Pipeline) Open Source und in der [technischen Architektur](/de/docs/architecture) dokumentiert.

## Updates

Sollten wir jemals ändern, wie EncodeX Daten verarbeitet, aktualisieren wir diese Seite und vermerken das Änderungsdatum oben klar. Da die App Open Source ist, können Sie jede Änderung im Repository überprüfen.

## Fragen

Bedenken bezüglich des Datenschutzes? Öffnen Sie ein Issue auf [GitHub](https://github.com/Sandeepv68/EncodeX) oder kontaktieren Sie uns über die Website.

## Loslegen

- [Laden Sie EncodeX kostenlos herunter](/de/download)
- [Alle Konvertierungen und Funktionen ansehen](/de/features)
- [FFmpeg-GUI-Überblick](/de/ffmpeg-gui)
