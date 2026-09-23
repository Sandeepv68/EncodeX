---
title: "Batch-Automatisierung mit MCP: Dutzende Jobs in einem einzigen Prompt in die Warteschlange stellen"
description: "Nutzen Sie den MCP-Server von EncodeX, um einen ganzen Ordner voller Videos mit einem einzigen Prompt in die Warteschlange zu stellen – asynchrone Jobs, Fortschrittsverfolgung und strukturierte Ergebnisse über batch_convert, list_jobs und get_job."
date: 2026-09-22
tags:
  - guide
  - mcp
  - automation
  - batch
  - ai
---

# Batch-Automatisierung mit MCP: Dutzende Jobs in einem einzigen Prompt in die Warteschlange stellen

Der MCP-Server von EncodeX ist nicht nur für einzelne Konvertierungen da. Da jeder Job asynchron läuft und Auftrags-Tools bereitstellt, können Sie einem KI-Assistenten einen ganzen Medienordner übergeben und ihn einreihen, verarbeiten und berichten lassen – ohne die App zu öffnen oder auch nur einen Befehl von Hand zu tippen.

Dieser Leitfaden zeigt den Batch-Ablauf: das Werkzeug `batch_convert`, das Modell asynchroner Jobs und wie Statuswerkzeuge Sie informieren, während FFmpeg arbeitet.

## Das Modell asynchroner Jobs

Wenn EncodeX eine Konvertierung über MCP startet, wartet es nicht. Es gibt sofort eine **Auftrags-ID** zurück, und der Job läuft im Hintergrund. Sie (oder der Assistent) fragen dann ab:

- `get_job` – Status, Fortschritt und Ergebnis eines Jobs
- `list_jobs` – alle Jobs der aktuellen Sitzung
- `cancel_job` – einen laufenden Job stoppen

Genau das macht einen Stapel von einem Dutzend Dateien auf Promptebene augenblicklich: Die Arbeit wird in einem Aufruf eingereiht und EncodeX arbeitet sich hindurch.

## Einen ganzen Ordner einreihen

Der schnellste Weg ist `batch_convert`. Geben Sie dem Assistenten einen Ordner und ein Ziel, zum Beispiel:

> Konvertieren Sie alle MKV-Dateien in `~/Downloads` zu MP4 und legen Sie sie in `~/Output` ab.

Der Assistent durchläuft den Ordner, ruft `batch_convert` auf und startet die Warteschlange. Sie müssen Jobs nicht einzeln verwalten.

Wollen Sie einen gezielteren Stapel? Nennen Sie den Filter:

> Nehmen Sie alle Videos in `~/Recordings`, kodieren Sie sie als H.264 in einem MP4-Container mit CRF 23 neu und lassen Sie sie am Platz.

Der Assistent wählt mit `list_profiles` und `get_profile` das richtige Profil und reiht den Stapel ein.

## Werkzeuge in einem einzigen Prompt mischen

Da alle Werkzeuge eine Sitzung teilen, kann ein einziger Prompt mehrere Operationen verketten:

> Konvertieren Sie für jedes Video in `~/Source`: ein MP4 für mein Handy, extrahieren Sie den Ton als MP3 und komprimieren Sie den Screenshot-Ordner `~/Assets`.

Das sind `batch_convert` plus `extract_audio` plus `compress_image`, alles zusammen eingereiht und verfolgt. Der Assistent koordiniert und berichtet, was wo abgeschlossen wurde.

## Fortschritt prüfen

Während die Jobs laufen, fragen Sie:

> Wie ist der Status meines Stapels?

`list_jobs` liefert jeden Job mit Status und Fortschritt. Brauchen Sie mehr Detail?

> Wie weit ist die MKV-zu-MP4-Konvertierung?

Der Assistent fragt `get_job` für den konkreten Job ab. Wenn etwas hakt:

> Brechen Sie den Job ab, der schon länger hängt.

Das entspricht `cancel_job` – und da Jobs isoliert sind, läuft der Rest des Stapels weiter.

## Die 4 Prompt-Vorlagen

Der MCP-Server bringt auch vier Prompt-Vorlagen mit: `convert-video`, `extract-audio`, `compress-image` und `batch-convert`. Sie füllen die richtigen Werkzeugaufrufe und die Argumentstruktur vor, was besonders für Agenten nützlich ist, die eine kanonische Methode für eine übliche Operation wollen. Der Assistent ruft die Vorlage und dann die Werkzeugkette auf, mit konsistenten Ergebnissen über Sitzungen hinweg.

## Häufig gestellte Fragen

### Wie viele Dateien kann ich gleichzeitig einreihen?

Es gibt keine kleine willkürliche Grenze – EncodeX verarbeitet die Warteschlange sequenziell mit Ihrer Hardware. Starten Sie mit einem Ordner und lassen Sie ihn arbeiten; Sie können den Status jederzeit prüfen.

### Laufen Batch-Jobs im Hintergrund?

Ja. Die Oberfläche zeigt sie in der Batch-Warteschlange, und über MCP verfolgen Sie sie mit `get_job` und `list_jobs`. Sie können währenddessen andere Dinge anfragen.

### Kann ich nur einen Job abbrechen?

Ja – `cancel_job` stoppt einen einzelnen Job. Die eingebettete HTTP-Oberfläche ergänzt `cancel_all_jobs` für die ganze Warteschlange. Andere laufen unabhängig weiter.

### Arbeitet der Stapel offline?

Vollständig. Die gesamte Kodierung geschieht lokal auf Ihrer Maschine über FFmpeg – keine Uploads, keine Cloud, und es funktioniert ohne Internetverbindung.

## Mehr erfahren

- [EncodeX aus Claude Desktop steuern](/de/blog/posts/how-to-use-claude-with-mcp)
- [MCP-Server-Dokumentation](/de/docs/cli#mcp-server-mode)
- [MCP-Sicherheits- und Datenschutzmodell](/de/blog/posts/mcp-privacy-security)
- [Funktionsreferenz: MCP-Werkzeuge](/de/docs/features-reference#mcp-server)

---

*Laden Sie EncodeX kostenlos herunter auf [encodex.in/download](/de/download). Der MCP-Server und die Batch-Warteschlange sind in jeder Installation enthalten.*