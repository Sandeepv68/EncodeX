---
title: "Cursor- und VS-Code-MCP-Workflows mit EncodeX"
description: "Verbinden Sie EncodeX mit Cursor oder VS Code über encodex --mcp und verwandeln Sie Medienaufgaben in Agent-Workflows – Konvertierungen, Extraktionen und Bildkomprimierung direkt im Editor."
date: 2026-09-23
tags:
  - guide
  - mcp
  - cursor
  - vscode
  - ai
---

# Cursor- und VS-Code-MCP-Workflows mit EncodeX

Cursor und VS Code sprechen beide MCP. Das heißt, Sie können Medienaufgaben an die KI Ihres Editors übergeben, ohne Ihren Code zu verlassen. Zeigen Sie einen der beiden auf den eingebauten Server von EncodeX und bitten Sie um eine Konvertierung, eine Audio-Extraktion oder die Komprimierung eines ganzen Bildordners, während Sie weiter am eigentlichen Projekt arbeiten.

Der Server läuft lokal (`encodex --mcp`), sodass der Agent des Editors die eigene FFmpeg-Engine Ihrer Maschine bedient – keine Uploads, keine externe API, komplett offline.

## EncodeX in VS Code einrichten

VS Code bringt integrierte MCP-Unterstützung mit. Öffnen Sie die MCP-Einstellungen und fügen Sie eine Serverdefinition hinzu:

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

VS Code startet `encodex --mcp` als Serverprozess. Nach der Verbindung kann der Assistent des Editors die Werkzeuge von EncodeX aufrufen – `convert_media`, `extract_audio`, `compress_image`, `cut_video`, `batch_convert` – und Jobs mit `get_job` / `list_jobs` verfolgen.

Für die zusätzlichen Live-Werkzeuge (Warteschlangenzustand, Timeline, Vorschau, Systeminformationen) aktivieren Sie **Einstellungen → MCP-Server** in der EncodeX-Oberfläche und zeigen Sie den Editor auf `http://127.0.0.1:8765/mcp`. Diese Oberfläche ergänzt GUI-paritäre Werkzeuge wie `get_queue_state`, `extract_preview` und `get_timeline`.

## EncodeX in Cursor einrichten

Cursor stellt MCP-Server ebenfalls in den Einstellungen bereit – entweder mit demselben JSON oder einem ähnlichen Dialog „MCP-Server hinzufügen“ mit dem Typ `command`:

- **Befehl (stdio):** `encodex --mcp`

Cursor teilt das Standard-MCP-Konfigurationsformat, sodass der JSON-Block oben auch für Cursor funktioniert. Nach dem Hinzufügen des Servers kann der Cursor-Agent Medienoperationen direkt ausführen.

## Bearbeitungs-Workflows

Das nützliche Muster ist, Medienarbeit mit dem normalen Editor-Fluss zu kombinieren:

> Konvertieren Sie `assets/tmp/video.mov` für die Doku-Seite zu MP4, und zwar in den Ordner `assets/`.

Der Agent ruft `convert_media` auf, wartet auf `get_job` und erledigt dann Folgearbeit – eine Vorschau hosten, ein README aktualisieren oder die neue Datei in einen Build einbinden.

Noch fortgeschrittener: Ein einziger Prompt kann viele Schritte orchestrieren:

> Eine neue Aufnahme ist in `~/r2d2/captures` gelandet. Konvertieren Sie sie in ein komprimiertes MP4, extrahieren Sie das Audio für die Transkription und aktualisieren Sie dann `docs/captures.md` mit den Ausgabeorten.

Das sind `convert_media` + `extract_audio`, koordiniert mit Ihrer Repository-Arbeit in einer Sitzung.

## Versionierte Ausgabe und Aufräumen

Da EncodeX echte Dateien auf der Festplatte erzeugt, können Sie es mit Ihrem Git-Flow kombinieren:

> Führen Sie den Stapel von `~/r2d2/captures` nach `~/r2d2/output` aus und sagen Sie mir, welche Ausgabedateien neu sind, damit ich weiß, was hinzugefügt werden muss.

Der Agent liest die Werkzeugergebnisse, den `list_jobs`-Verlauf und Ihren Verzeichniszustand, um zu fassen, was sich geändert hat – und macht aus einer Medienaufgabe einen dokumentierten Commit.

## Häufig gestellte Fragen

### Sendet das meinen Code oder meine Medien in die Cloud?

Nein. EncodeX MCP läuft vollständig auf Ihrer Maschine. Ihre Medien werden lokal verarbeitet, und der Agent Ihres Editors bedient diese lokalen Werkzeuge. Für die Kodierung gibt es keinen Cloud-Roundtrip.

### Muss die EncodeX-Oberfläche offen sein?

Für den stdio-Server (`encodex --mcp`): nein – er läuft ohne Oberfläche. Der eingebettete HTTP-Server ist die optionale Oberfläche, die in der App läuft und Live-Warteschlangen- und Vorschauwerkzeuge ergänzt.

### Kann ich es mit Cursor und VS Code gleichzeitig nutzen?

Ja. Jeder Client startet seine eigene stdio-Serverinstanz, oder Sie teilen denselben eingebetteten HTTP-Endpunkt für beide (eine einzige Oberflächeninstanz).

### Welche Werkzeuge sind verfügbar?

Die stdio-Oberfläche stellt 13 Kernwerkzeuge bereit, darunter `convert_media`, `batch_convert`, `extract_audio`, `compress_image`, `cut_video` und die Auftragsverwaltung. Den vollständigen Katalog finden Sie in der [Funktionsreferenz](/de/docs/features-reference#mcp-server).

## Mehr erfahren

- [Claude-Desktop- und Claude-Code-Einrichtung](/de/blog/posts/how-to-use-claude-with-mcp)
- [Batch-Automatisierungsleitfaden](/de/blog/posts/mcp-batch-automation-guide)
- [MCP-Server-Dokumentation](/de/docs/cli#mcp-server-mode)
- [MCP-Datenschutz und -Sicherheit](/de/blog/posts/mcp-privacy-security)

---

*Laden Sie EncodeX kostenlos herunter auf [encodex.in/download](/de/download). Der MCP-Server ist in jeder Installation enthalten.*