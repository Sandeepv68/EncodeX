---
title: "MCP-Datenschutz und -Sicherheit: Warum EncodeX Ihre Medien lokal hält"
description: "Der EncodeX-MCP-Server läuft vollständig auf Ihrer Maschine – Loopback-Bindung, Origin-Prüfung, optionales Zugriffs-Token und ein Offline-Design. Keine Uploads, keine Cloud, kein Konto."
date: 2026-09-24
tags:
  - guide
  - mcp
  - security
  - privacy
  - ai
---

# MCP-Datenschutz und -Sicherheit: Warum EncodeX Ihre Medien lokal hält

Einen KI-Assistenten Ihre Mediendateien steuern zu lassen, wirft eine naheliegende Frage auf: Was passiert mit meinen Dateien? Beim MCP-Server von EncodeX ist die Antwort klar – alles läuft auf Ihrem eigenen Rechner. Der Assistent gibt Anweisungen; die eingebaute FFmpeg-Engine von EncodeX erledigt die Arbeit lokal. Dateien verlassen nie Ihr Gerät, und der Server ist gehärtet mit Loopback-Bindung, Origin-Prüfung und einem optionalen Zugriffs-Token.

Dieser Beitrag erläutert das Sicherheitsmodell, damit Sie genau wissen, was geschützt ist.

## Offline by Design

Die wichtigste Garantie ist die einfachste: **keine Uploads, keine Cloud, kein Konto**. EncodeX ist eine lokale Anwendung und der MCP-Server ein lokaler Prozess. Es gibt keine EncodeX-Cloud, an die Dateien gesendet würden – Konvertierung, Extraktion, Komprimierung und Zuschnitt geschehen alle auf Ihrer Hardware. Wenn Ihre Maschine offline ist, funktioniert MCP trotzdem.

Das macht EncodeX zu einer echten *lokalen* MCP-Server-Option. Ihre Medien werden nie zu Trainingsdaten von jemand anderem oder zu einer Speicher-Rechnung.

## Eigenständiger Server: Ein schlichter Prozess

Im Standardmodus (`encodex --mcp`) läuft EncodeX als kopfloser stdio-Prozess, der JSON-RPC spricht. Er bindet sich an nichts im Netzwerk – stdout trägt Protokollmeldungen, stderr trägt Logs, und der Prozess bleibt lebendig, bis stdin geschlossen wird. Es gibt keinen lauschenden Port, also keine Angriffsfläche für einen entfernten Angreifer.

## Eingebetteter Server: Loopback + Origin-Prüfung

Der optionale eingebettete HTTP-Server (Einstellungen → MCP-Server) ist die einzige Netzwerkoberfläche, und er ist vorsichtig, mit wem er spricht:

- **Nur Loopback** – er bindet an `127.0.0.1`, sodass nur Software auf Ihrer eigenen Maschine ihn erreichen kann.
- **Origin-Prüfung** – eingehende Anfragen müssen einen akzeptablen `Origin`-Header tragen (Ihre lokalen Clients), und er akzeptiert nur `GET`, `POST` und `DELETE` auf `/mcp`.
- **Sitzungen an die App gebunden** – alle Sitzungen werden zwangsweise geschlossen, wenn der Server stoppt oder EncodeX beendet wird.

Die Idee: Der Endpunkt existiert für Ihre lokalen KI-Apps, nicht für irgendetwas anderes im Netzwerk.

## Optionales Zugriffs-Token

Für eine zusätzliche Schicht können Sie in Einstellungen → MCP-Server ein **Zugriffs-Token** festlegen. Der eingebettete Server verlangt dann ein Bearer-Token und vergleicht Tokens in **konstanter Zeit** – das vermeidet den klassischen Timing-Seitenkanal, mit dem Geheimnisse Zeichen für Zeichen erraten werden.

Da es optional ist, kontrollieren Sie den Kompromiss: kein Token für Komfort auf einem vertrauenswürdigen Einbenutzer-Rechner, ein Token, wenn Sie explizite Autorisierung für lokale Clients möchten.

## Was der Assistent wirklich tun kann

MCP ist kein offener Prompt für Ihr System. Der Assistent kann nur die Werkzeuge aufrufen, die EncodeX bereitstellt. Die stdio-Oberfläche bietet 13 Kernwerkzeuge (`convert_media`, `batch_convert`, `extract_audio`, `compress_image`, `cut_video`, Auftragsverwaltung und mehr); die eingebettete Oberfläche ergänzt GUI-paritäre Werkzeuge (`get_queue_state`, `cancel_all_jobs`, `get_timeline`, `extract_preview`, `get_system_info`, `check_for_updates`). Das ist bewusstes Werkzeug-Scoping – der Assistent kann EncodeX bedienen, und sonst nichts.

Alle Sitzungen werden zwangsweise geschlossen, wenn die App endet, sodass ein veralteter Assistent keinen Griff behalten kann, nachdem Sie EncodeX geschlossen haben.

## Häufig gestellte Fragen

### Sendet der EncodeX-MCP-Server Daten irgendwohin?

Nein. EncodeX verarbeitet alles lokal über FFmpeg. Es gibt keine Cloud-Komponente, keine Telemetrie Ihrer Medien, und der MCP-Standard ist hier nur ein lokales Rohr.

### Ist der eingebettete Server in meinem Netzwerk exponiert?

Nein. Er bindet nur an Loopback (`127.0.0.1`), prüft den `Origin`-Header und akzeptiert nur `GET`, `POST` und `DELETE` auf `/mcp`. Entfernte Geräte in Ihrem LAN können ihn nicht erreichen.

### Wie füge ich ein Token hinzu?

Öffnen Sie **Einstellungen → MCP-Server**, aktivieren Sie den Server und legen Sie ein Zugriffs-Token fest. Clients senden es dann als Bearer-Token, verglichen in konstanter Zeit.

### Kann ich MCP vollständig offline nutzen?

Ja – das ist das Kerndesign. Installieren Sie EncodeX, führen Sie `encodex --mcp` aus oder aktivieren Sie den eingebetteten Server, und alles funktioniert ohne Internetverbindung.

## Mehr erfahren

- [MCP-Server-Dokumentation](/de/docs/cli#mcp-server-mode)
- [Claude-Desktop- und Claude-Code-Einrichtung](/de/blog/posts/how-to-use-claude-with-mcp)
- [Batch-Automatisierungsleitfaden](/de/blog/posts/mcp-batch-automation-guide)
- [Cursor- und VS-Code-Workflows](/de/blog/posts/cursor-and-vscode-mcp-workflows)
- [Funktionsreferenz: MCP](/de/docs/features-reference#mcp-server)

---

*Laden Sie EncodeX kostenlos herunter auf [encodex.in/download](/de/download). Der MCP-Server ist in jeder Installation enthalten.*