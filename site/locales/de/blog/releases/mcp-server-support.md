---
date: 2026-09-18
title: "EncodeX fügt einen integrierten MCP-Server hinzu: Lassen Sie KI Ihre Medienkonvertierungen steuern"
description: "EncodeX liefert jetzt einen Model Context Protocol (MCP)-Server mit, sodass Claude, Cursor, VS Code und eigene Agenten Ihre Medien konvertieren, komprimieren, schneiden und stapelweise verarbeiten können — lokal und sicher."
tags:
  - release
  - mcp
  - ai
  - automation
---

# EncodeX fügt einen integrierten MCP-Server hinzu: Lassen Sie KI Ihre Medienkonvertierungen steuern

**Veröffentlicht:** 2026-09-18
**Feature:** Integrierter MCP-Server (stdio + eingebetteter HTTP)

## Die Kurzfassung

EncodeX kann jetzt als [Model Context Protocol](https://modelcontextprotocol.io)-Server fungieren. Das bedeutet: KI-Assistenten — Claude Desktop, Claude Code, Cursor, VS Code und jeder andere MCP-kompatible Client — können über EncodeX Videos konvertieren, Audio extrahieren, Bilder komprimieren, Clips schneiden und Stapeljobs verwalten, und zwar nur mit einer Anfrage in normaler Sprache.

Und alles passiert weiterhin auf Ihrem Computer. Kein Upload, keine Cloud, kein Konto.

---

## Warum MCP den Alltag verändert

Wir haben EncodeX gebaut, um die FFmpeg-Befehlszeile für normale Menschen überflüssig zu machen. Der **MCP-Server** entfernt das letzte Stück „Welchen Knopf drücke ich?"-Reibung bei den Werkzeugen, die Sie bereits nutzen.

Wenn Sie jemals so etwas getippt haben:

> „Nimm `interview.mov`, extrahiere den Ton als MP3 und erstelle eine Kopie, die in eine E-Mail passt."

…kann ein MCP-fähiger Assistent das jetzt *wirklich erledigen* — das richtige EncodeX-Werkzeug wählen, die Konvertierung lokal ausführen und das Ergebnis zurückmelden. Sie bleiben in Ihrer Lieblings-KI-App; EncodeX übernimmt die schwere Arbeit im Hintergrund.

Das eröffnet einige Möglichkeiten:

- **Konversationelle Stapelarbeit** — „Konvertiere jedes MKV in diesem Ordner zu MP4 und sag mir Bescheid, wenn es fertig ist."
- **Agenten-Pipelines** — lassen Sie einen Coding- oder Medien-Agenten Assets als Teil einer größeren Aufgabe vorbereiten.
- **Wiederholbare Automatisierung** — beschreiben Sie einen Workflow einmal; Ihr Assistent verwendet ihn wieder.
- **Keine Befehlsyntax zum Auswendiglernen** — Profile, Codecs und Container werden für Sie übernommen.

---

## Zwei Verbindungsmöglichkeiten

### 1. Eigenständiger stdio-Server

Führen Sie EncodeX als dedizierten MCP-Prozess aus. Das verwenden Desktop-KI-Apps, wenn sie bei Bedarf einen Server starten:

```bash
# Gepackte App
encodex --mcp

# Quellcode-Checkout (nach npm run build:main)
node dist/mcp/index.js
```

stdout trägt das MCP-Protokoll; alle Logs gehen nach stderr, sodass nichts die Konversation zwischen Ihrem Assistenten und EncodeX stört.

### 2. Eingebetteter HTTP-Server (GUI-Modus)

Haben Sie EncodeX bereits geöffnet? Aktivieren Sie **Einstellungen → MCP-Server** und richten Sie Ihren Client auf:

```
http://127.0.0.1:8765/mcp
```

Dieser Modus teilt sich die Job-Warteschlange der laufenden App und fügt Live-Warteschlangen-, Vorschau-, Timeline-, System- und Update-Werkzeuge hinzu — ein Assistent kann also sehen, woran Sie arbeiten, statt isoliert zu handeln.

---

## Was Ihr Assistent kann

Über beide Oberflächen stellt EncodeX **19 Werkzeuge** bereit.

| Bereich              | Tools                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Konvertierung        | `convert_media`, `batch_convert`, `cut_video`, `compress_image`, `extract_audio`                  |
| Analyse              | `get_media_info`, `list_capabilities`, `list_profiles`, `get_profile`, `ping`                      |
| Auftragsverwaltung   | `get_job`, `list_jobs`, `cancel_job`                                                               |
| GUI-Abdeckung (HTTP) | `get_queue_state`, `cancel_all_jobs`, `get_timeline`, `extract_preview`, `get_system_info`, `check_for_updates` |

Außerdem gibt es **3 Ressourcen** — `encodex://profiles`, `encodex://capabilities` und `encodex://codecs` — damit ein Assistent genau entdecken kann, was Ihr Build unterstützt, sowie **4 Prompt-Vorlagen** für die häufigsten Aufgaben: Video konvertieren, Audio extrahieren, Bild komprimieren und Stapelkonvertierung.

Konvertierungen sind **asynchron**. Ein langer Render friert die Konversation nicht ein: Ihr Assistent startet den Job, erhält eine Job-ID und kann den Fortschritt abfragen oder ihn später abbrechen.

---

## Einrichtung in einer Minute

### Claude Desktop

Fügen Sie EncodeX zu Ihrer MCP-Server-Konfiguration hinzu:

```json
{
  "mcpServers": {
    "encodex": {
      "command": "encodex",
      "args": ["--mcp"]
    }
  }
}
```

Starten Sie Claude Desktop neu und fragen Sie: *„Verwende EncodeX, um ~/Videos/clip.mov zu MP4 zu konvertieren."*

### Cursor / VS Code

Fügen Sie dieselbe Server-Definition zu Ihrer MCP-Konfiguration hinzu (`mcp.json` in Cursor oder den MCP-Einstellungen in VS Code) und setzen Sie `command` auf `encodex` mit dem Argument `--mcp`. Verwenden Sie für den eingebetteten Server stattdessen die oben gezeigte HTTP-Transport-URL.

### Jeder MCP-Client

Der stdio-Server ist ein standardmäßiger JSON-RPC-Prozess — keine spezielle Integration nötig. Wenn Ihr Werkzeug einen Befehl starten und MCP sprechen kann, kann es mit EncodeX kommunizieren.

---

## Privat und von Grund auf sicher

Eine Automatisierungsschnittstelle auszuliefern bedeutet, Sicherheit ernst zu nehmen. Der eingebettete Server ist bewusst konservativ:

- **Nur Loopback** — er bindet an `127.0.0.1` und ist von einer anderen Maschine niemals erreichbar.
- **Origin-Prüfungen** — Cross-Origin-Anfragen werden abgelehnt, sofern sie nicht von der lokalen App stammen.
- **Optionales Bearer-Token** — aktivieren Sie es, und jede Anfrage muss mit zeitkonstantem Vergleich authentifiziert werden.
- **Minimale HTTP-Oberfläche** — unter `/mcp` nur `GET`, `POST` und `DELETE`.
- **Sauberes Beenden** — alle Sitzungen werden zwangsweise geschlossen, wenn der Server stoppt oder die App beendet wird.
- **Keine Datei-Weitergabe** — der Server treibt dieselbe lokale FFmpeg-Engine wie die GUI. Nichts wird hochgeladen.

Der eigenständige `--mcp`-Modus erbt dieselbe „Alles läuft lokal"-Garantie: Er ist einfach eine andere Möglichkeit, mit der Engine zu sprechen, die bereits auf Ihrem Rechner ist.

---

## Für wen ist das?

- **Content-Creator und Editoren**, die bereits in einem KI-Assistenten arbeiten und Assets vorbereitet haben möchten, ohne ihn zu verlassen.
- **Entwickler**, die Agenten-Workflows mit echter Medienverarbeitung aufbauen.
- **Automatisierungsfans**, die wiederholbare, beschreibbare Pipelines statt einmaliger Befehle möchten.
- **Alle**, die lieber nach einem Ergebnis fragen, als nach einer Einstellung zu suchen.

Wenn Sie noch nie einen MCP-Client verwendet haben, ändert sich nichts — GUI und CLI sind genau wie zuvor. Der MCP-Server ist eine zusätzliche Tür zur selben Engine.

---

## Probieren Sie es noch heute aus

1. Aktualisieren Sie auf die neueste EncodeX-Version.
2. Führen Sie `encodex --mcp` aus oder aktivieren Sie in der App **Einstellungen → MCP-Server**.
3. Verbinden Sie Ihren KI-Assistenten und bitten Sie ihn, etwas zu konvertieren.

Die vollständige Referenz — jedes Werkzeug, jede Ressource, jeder Prompt, jede Client-Konfiguration und das Sicherheitsmodell — finden Sie in der [MCP-Dokumentation](/docs/cli#mcp-server-mode).

---

[EncodeX herunterladen](/download) · [Alle Funktionen ansehen](/features) · [CLI-Dokumentation lesen](/docs/cli)