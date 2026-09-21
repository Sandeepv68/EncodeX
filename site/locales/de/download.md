# EncodeX herunterladen

EncodeX ist **kostenlos** und läuft unter Windows, Mac und Linux. Eine quelloffene FFmpeg-Oberfläche — ohne Konto, ohne Wasserzeichen und ohne Dateigrößen-Limits: alles läuft auf Ihrem Computer.

::: tip Zum ersten Mal hier? So geht es weiter
Installieren Sie die App, ziehen Sie ein Video oder ein Bild in das Fenster, wählen Sie ein Profil (z. B. MP4 oder „kleinere Datei") und klicken Sie **Konvertieren** — fertig. Alles läuft lokal auf Ihrem Computer.

- **Neu bei EncodeX?** Sehen Sie sich [Beispiele an, was Sie damit machen können](/de/use-cases), oder [entdecken Sie die Werkzeuge](/de/features).
- **Fragen?** Die meisten Umwandlungen brauchen nur einen Datei-Drop + einen Klick auf ein Profil. Die Karte „Erste Schritte" auf Ihrem Dashboard führt Sie durch die Zielwahl.
:::

## <OsIcon name="windows" /> Windows

**Windows 10/11 · 64-Bit** — passt für fast alle.

<LatestDownloads platform="windows" />

**Installation:** Öffnen Sie die heruntergeladene Datei und folgen Sie den Schritten auf dem Bildschirm.

Unsicher, welche Sie nehmen sollen? Nehmen Sie die empfohlene — passt sie nicht, sagt es Windows schon.

### Andere Plattformen

[macOS](#mac) · [Linux](#linux) · [Windows ARM64](#windows) · [Windows 32-Bit](#windows)

## <OsIcon name="apple" /> Mac

<LatestDownloads platform="macos" />

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

<LatestDownloads platform="linux" />

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

> **Warum ist EncodeX etwa 400 MB groß?**
> EncodeX bündelt die FFmpeg-Engine und alle unterstützten Komponenten, sodass Sie FFmpeg, Codecs oder sonst nichts separat installieren müssen — und später auch nie Extras herunterladen. Nichts wird hochgeladen und nichts läuft in der Cloud — jede Konvertierung passiert [lokal auf Ihrem Computer](/de/features).

## Immer auf dem neuesten Stand

Erscheint eine neue Version, meldet sich EncodeX in der App und kann das Update für Sie herunterladen und starten — Sie müssen nicht wieder hierher kommen.

## Frühere Versionen

Sie brauchen ein älteres Release? Klappen Sie unten die gewünschte Version auf — jede Datei zeigt Größe und SHA-256-Prüfsumme.

<LatestDownloads older />

## Hilfe benötigt?

Wenn etwas nicht klappt oder Sie eine Frage haben, schreiben Sie an **[developer@encodex.in](mailto:developer@encodex.in)** — ein echter Mensch antwortet.

## Datenschutz

Vertrauen ist uns wichtig. Jede Konvertierung läuft auf Ihrem Computer — Ihre Dateien werden niemals hochgeladen, verfolgt oder auf einem Server gespeichert. Lesen Sie die vollständige [Datenschutzerklärung](/de/privacy).

## Sicherheit

Jede Version enthält [verifizierbare SHA-256-Checksummen und signierte Builds](/de/security) — und wenn Sie ein Problem finden, können Sie es vertraulich melden. Details auf der [Sicherheitsseite](/de/security).

## Für Entwickler: Selbst bauen

Lieber aus dem Quellcode bauen? Repository klonen und ausführen:

```bash
git clone https://github.com/Sandeepv68/EncodeX.git
cd EncodeX
npm install
npm run dist
```

Das Installationsprogramm entsteht im Ordner `release/`.
