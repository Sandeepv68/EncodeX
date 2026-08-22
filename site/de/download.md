# EncodeX herunterladen

EncodeX ist **kostenlos** und läuft unter Windows, Mac und Linux. Wählen Sie unten Ihren Computertyp, laden Sie herunter, installieren Sie — fertig.

::: tip Immer die neueste Version holen
Neue Versionen erscheinen auf der [GitHub-Releases-Seite](https://github.com/Sandeepv68/EncodeX/releases). Die Links unten liefern Ihnen immer die aktuellste.
:::

## <OsIcon name="windows" /> Windows

**Sie wollen nur, dass es funktioniert?** Klicken Sie auf die erste Schaltfläche — sie passt für fast alle.

| | Download | Für |
|---|---------|-----|
| ✅ **Empfohlen** | [Für Windows herunterladen](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x64-setup.exe) | Die meisten PCs und Laptops (64-Bit) |
| Ältere 32-Bit-PCs | [32-Bit-Version](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-ia32-setup.exe) | Sehr alte Computer |
| ARM-Laptops | [ARM-Version](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64-setup.exe) | Windows-Laptops mit Snapdragon |

**Installation:** Öffnen Sie die heruntergeladene Datei und folgen Sie den Schritten auf dem Bildschirm. Läuft unter Windows 10 und neuer.

Unsicher, welche Sie nehmen sollen? Nehmen Sie die empfohlene — passt sie nicht, sagt es Windows schon.

## <OsIcon name="apple" /> Mac

| | Download | Für |
|---|---------|-----|
| Neuere Macs (2021 oder später) | [Für Apple Silicon herunterladen](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64.dmg) | M1-, M2-, M3-, M4-Chips |
| Ältere Macs | [Für Intel herunterladen](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x64.dmg) | Macs von vor 2021 |

**Installation:** Öffnen Sie die heruntergeladene `.dmg`-Datei und ziehen Sie EncodeX in Ihren Programme-Ordner.

**Sie wissen nicht, welchen Mac Sie haben?** Klicken Sie oben links auf das Apple-Logo (<OsIcon name="apple" label="Apple Logo" />), wählen Sie „Über diesen Mac" und schauen Sie auf die Chip-Zeile. Steht dort „Apple M1" (oder M2/M3/M4), nehmen Sie Apple Silicon. Steht dort „Intel", nehmen Sie Intel.

::: warning Erster Start auf dem Mac — ein Extra-Schritt
Weil EncodeX kostenlos und quelloffen ist (und nicht über den Mac App Store verkauft wird), zeigt macOS beim ersten Start eventuell eine Meldung an, dass sich die App „nicht öffnen lässt". Das ist normal und harmlos:

1. Suchen Sie EncodeX im Programme-Ordner
2. Halten Sie die **Control**-Taste gedrückt, klicken Sie auf die App und wählen **Öffnen**
3. Klicken Sie im erscheinenden Fenster erneut auf **Öffnen**

Das müssen Sie nur einmal tun — danach öffnet sie sich normal.
:::

## <OsIcon name="linux" /> Linux

| | Download | Für |
|---|---------|-----|
| ✅ **Empfohlen** | [AppImage herunterladen](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x86_64.AppImage) | Die meisten Linux-Rechner (64-Bit) |
| ARM64 | [ARM64-AppImage](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64.AppImage) | ARM-Boards und -Laptops |
| ARMv7 | [ARMv7-AppImage](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-armv7l.AppImage) | Ältere Einplatinenrechner |

**Starten:** Eine AppImage ist eine einzige Datei — keine Installation nötig. Ausführbar machen und doppelklicken:

```bash
chmod +x EncodeX-*.AppImage
./EncodeX-*.AppImage
```

(Viele Desktop-Umgebungen erlauben auch den Weg ohne Terminal: Rechtsklick auf die Datei → Eigenschaften → Ausführen erlauben, dann Doppelklick.)

## Was Ihr Computer braucht

Nichts Besonderes — wenn Ihr Rechner einige Jahre jung ist, sind Sie fein:

- **Betriebssystem:** Windows 10+, macOS 11+ oder ein aktuelles Linux
- **Festplatte:** etwa 400 MB (die App bringt alles mit — keine zusätzlichen Downloads)
- **Arbeitsspeicher:** jede normale Menge reicht

## Immer auf dem neuesten Stand

Erscheint eine neue Version, meldet sich EncodeX in der App und kann das Update für Sie herunterladen und starten — Sie müssen nicht wieder hierher kommen.

## Hilfe benötigt?

Wenn etwas nicht klappt oder Sie eine Frage haben, schreiben Sie an **[developer@encodex.in](mailto:developer@encodex.in)** — ein echter Mensch antwortet.

## Für Entwickler: Selbst bauen

Lieber aus dem Quellcode bauen? Repository klonen und ausführen:

```bash
git clone https://github.com/Sandeepv68/EncodeX.git
cd EncodeX
npm install
npm run dist
```

Das Installationsprogramm entsteht im Ordner `release/`.
