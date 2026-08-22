# Helfen Sie, EncodeX besser zu machen

EncodeX ist kostenlos und wird von Freiwilligen gebaut — und Sie müssen kein Programmierer sein, um zu helfen. So kann jeder mithelfen:

- **Sagen Sie uns, wenn etwas kaputtgeht.** Stürzt die App ab oder lässt sich eine Datei nicht konvertieren, [eröffnen Sie ein Issue](https://github.com/Sandeepv68/EncodeX/issues) und beschreiben Sie, was passiert ist. Fehlerberichte von normalen Nutzern sind Gold wert.
- **Bringen Sie Ideen ein.** Sie wünschen sich, EncodeX könnte etwas, das es noch nicht kann? Sagen Sie es — viele Funktionen entstanden aus Nutzervorschlägen.
- **Übersetzen Sie.** EncodeX spricht über 35 Sprachen, und Übersetzer sind immer willkommen. Fehlt Ihre Sprache oder klingt sie holprig, können Sie nachhelfen.
- **Erzählen Sie weiter.** Teilen Sie EncodeX mit Freunden, schreiben Sie eine Rezension oder erstellen Sie ein Tutorial.

## Kontakt

Fragen, Ideen oder einfach nur Hallo sagen? Schreiben Sie direkt an den Entwickler: **[developer@encodex.in](mailto:developer@encodex.in)** — Rückmeldungen von Nutzern sind immer willkommen.

## Für Entwickler

Wer Code beitragen möchte, startet so:

### Entwicklung

```bash
npm run dev          # Dev-Modus mit Hot-Reload
npm run electron:dev # komplette Dev-Umgebung mit Electron-Fenster
npm run build        # vollständiger Build
npm start            # gebaute App starten
```

### Projektkonventionen

- **TypeScript** — Strict Mode, möglichst ohne `any`.
- **React** — funktionale Komponenten mit Hooks.
- **State** — Zustand-Stores für den globalen Zustand.
- **IPC** — alle Kanäle in `src/shared/ipc-channels.ts`.
- **Konstanten** — feste Werte in den Konstantendateien unter `src/shared/`.
- **i18n** — alle sichtbaren Texte in `src/renderer/i18n/locales/`.

### Pull-Request-Prozess

1. Sicherstellen, dass der Build durchläuft: `npm run build`
2. Sprachdateien aktualisieren, wenn UI-Texte ergänzt oder geändert werden.
3. Jeden PR auf ein einzelnes Thema beschränken.

## Verhaltenskodex

Dieses Projekt folgt dem [Contributor Covenant](https://github.com/Sandeepv68/EncodeX/blob/main/CODE_OF_CONDUCT.md). Seien Sie freundlich und respektvoll — wir sind alle hier, weil uns das Projekt gefällt.
