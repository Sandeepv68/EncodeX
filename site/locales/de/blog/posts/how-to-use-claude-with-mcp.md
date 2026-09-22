---
title: "So nutzen Sie den EncodeX-MCP-Server mit Claude Desktop und Claude Code"
description: "Verbinden Sie den integrierten MCP-Server von EncodeX mit Claude Desktop oder Claude Code und konvertieren, extrahieren, komprimieren und verarbeiten Sie Medien in natürlicher Sprache – komplett offline."
date: 2026-09-21
tags:
  - guide
  - mcp
  - claude
  - ai
  - automation
---

# So nutzen Sie den EncodeX-MCP-Server mit Claude Desktop und Claude Code

EncodeX bringt einen eingebauten MCP-Server (Model Context Protocol) mit. Das bedeutet: Sie steuern die gesamte App aus Claude Desktop oder Claude Code in natürlicher Sprache. Statt eine Oberfläche zu öffnen und in Menüs zu suchen, fragen Sie einfach: *„Konvertieren Sie dieses MKV zu MP4 für mein Handy“* – und der Assistent führt die Konvertierung mit der lokalen FFmpeg-Engine von EncodeX aus.

Alles läuft auf Ihrem Rechner. Dateien verlassen nie Ihr Gerät, es gibt kein Konto, und alles funktioniert offline.

## Was ist ein MCP-Server?

[MCP](https://modelcontextprotocol.io) ist ein offener Standard, der KI-Assistenten erlaubt, Werkzeuge in echten Anwendungen zu nutzen. Der Server von EncodeX stellt eine Reihe von Konvertierungswerkzeugen bereit – `convert_media`, `extract_audio`, `compress_image`, `cut_video`, `batch_convert` sowie Auftrags-Tools wie `get_job` und `list_jobs` – dazu Ressourcen und Prompt-Vorlagen.

Denken Sie daran wie an eine Fernbedienung für FFmpeg, die ein KI-Assistent bedienen kann. Der Assistent sieht die Werkzeuge, entscheidet, welche er aufruft, und EncodeX übernimmt die lokale Kodierung.

## Erste Schritte

Installieren Sie EncodeX ([Download](/de/download)) – der MCP-Server ist eingebaut, kein Plugin nötig – und stellen Sie sicher, dass `encodex` in Ihrem `PATH` liegt (die Installation von EncodeX fügt es hinzu).

### Option 1: Claude Desktop

Öffnen Sie **Claude Desktop → Einstellungen → Entwickler → Konfiguration bearbeiten** und fügen Sie einen MCP-Servereintrag hinzu:

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

Speichern Sie die Datei und starten Sie Claude Desktop neu. Claude hat nun Zugriff auf die Werkzeuge von EncodeX.

### Option 2: Claude Code

Aus einem Terminal in Ihrem Projekt:

```bash
claude mcp add encodex -- encodex --mcp
```

Starten Sie dann Claude Code und bitten Sie um eine Konvertierung. Sie können die Registrierung mit `claude mcp list` prüfen.

## Ihre erste Anfrage

Probieren Sie etwas Einfaches:

> Konvertieren Sie `~/Desktop/vacation.mp4` in ein kleineres MP4 für WhatsApp.

Der Assistent ruft `convert_media` auf, der Auftrag läuft im Hintergrund auf Ihrer Maschine und Claude meldet das Ergebnis. Da die Konvertierung asynchron ist, gibt EncodeX eine Auftrags-ID zurück; der Assistent fragt `get_job` ab und ist fertig, sobald der Auftrag abgeschlossen ist.

Sie können auch Audio extrahieren:

> Extrahieren Sie den Ton aus `lecture.mov` als MP3.

Das entspricht dem Werkzeug `extract_audio`. Oder einen Ordner mit Bildern komprimieren:

> Komprimieren Sie alle Fotos in `~/Pics` in den Ordner `~/Output`.

Das ist das Werkzeug `compress_image`, gesteuert in natürlicher Sprache.

## Den Server ohne Oberfläche ausführen

`encodex --mcp` startet den eigenständigen stdio-Server. Er spricht JSON-RPC über stdout (so bleiben Protokollmeldungen sauber) und leitet allen Status und alle Logs auf stderr. Der Prozess lebt, bis stdin geschlossen wird – genau das, was Desktop-Apps mit asynchronen Aufträgen für einen MCP-Server nach Bedarf brauchen.

Für die eingebettete HTTP-Oberfläche – Live-Warteschlange, Vorschau, Timeline und Systemwerkzeuge – aktivieren Sie **Einstellungen → MCP-Server** in der Oberfläche und zeigen Sie den Client auf `http://127.0.0.1:8765/mcp`.

## Tipps für bessere Ergebnisse

- **Geben Sie absolute oder explizite Pfade an** – so kann der Assistent die richtigen Dateien ansteuern.
- **Nennen Sie das Ausgabeformat** – „als MP4“, „zu MP3“ – damit das richtige Profil gewählt wird.
- **Nutzen Sie Stapel für Ordnern** – EncodeX kann viele Dateien in einem Auftrag konvertieren (siehe [Batch-Automatisierungsleitfaden](/de/blog/posts/mcp-batch-automation-guide)).
- **Schlagen Sie exotische Optionen in der Doku nach** – der vollständige Werkzeugkatalog steht in der [MCP-Funktionsreferenz](/de/docs/features-reference#mcp-server).

## Häufig gestellte Fragen

### Ist der EncodeX-MCP-Server kostenlos?

Ja – er ist in die kostenlose Open-Source-App (MIT) eingebaut. Kein Abo, kein Lizenzschlüssel.

### Muss die Oberfläche offen sein, um `encodex --mcp` zu nutzen?

Nein. Der eigenständige Server läuft ohne Oberfläche. Der eingebettete HTTP-Server (Einstellungen → MCP-Server) ist die optionale Oberfläche, die in der App läuft und Werkzeuge für Warteschlange und Vorschau bereitstellt.

### Lädt MCP meine Dateien hoch?

Nein. EncodeX verarbeitet alles lokal. Der MCP-Server steuert dieselbe lokale FFmpeg-Engine wie die Oberfläche – keine Uploads, keine Cloud, kein Konto.

### Welche Assistenten können sich verbinden?

Jeder MCP-kompatible Client. Dieser Leitfaden behandelt Claude Desktop und Claude Code; das gleiche Konfigurationsmuster funktioniert in [Cursor und VS Code](/de/blog/posts/cursor-and-vscode-mcp-workflows).

## Mehr erfahren

- [MCP-Server-Dokumentation](/de/docs/cli#mcp-server-mode)
- [Batch-Automatisierung mit MCP](/de/blog/posts/mcp-batch-automation-guide)
- [MCP-Datenschutz und -Sicherheit](/de/blog/posts/mcp-privacy-security)
- [Die vollständige Funktionsreferenz](/de/docs/features-reference#mcp-server)

---

*Laden Sie EncodeX kostenlos herunter auf [encodex.in/download](/de/download). Der MCP-Server ist in jeder Installation enthalten.*