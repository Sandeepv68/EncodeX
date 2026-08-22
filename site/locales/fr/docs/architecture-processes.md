# Processus, système de build & démarrage

## Modèle de processus

### Processus principal (`src/main/`)

Environnement Node.js. Possède le cycle de vie de l'application et toutes les capacités privilégiées :

- Crée les `BrowserWindow` splash et principale et enregistre les gestionnaires IPC (`index.ts`).
- Héberge le point d'entrée CLI (`cli/`).
- Résout le chemin des binaires FFmpeg/FFprobe et détecte les capacités des encodeurs (`capabilities.ts`, `process-utils.ts`).
- Implémente les cœurs transcoders (`transcoders/`).
- Fait tourner la file d'attente par lots à concurrence limitée (1-4 tâches parallèles) (`queue/job-queue.ts`).
- Décode les images vidéo et l'audio PCM pour le lecteur intégré (`player/frame-decoder.ts`).
- Extrait les formes d'onde et les montages de miniatures (`timeline/timeline-media.ts`).
- Lit les données EXIF, les histogrammes, les dimensions d'image et les aperçus (`image-*.ts`, `video-preview.ts`).
- Ponte la sortie `console` du renderer vers le système de logs (`patchConsole` dans `index.ts`).

### Script preload (`src/preload/index.ts`)

S'exécute dans un contexte isolé. Utilise `contextBridge.exposeInMainWorld('electronAPI', api)` pour exposer au renderer une API typée et restreinte. Chaque méthode est un fin wrapper sur `ipcRenderer.invoke` (requête/réponse) ou `ipcRenderer.send` (fire-and-forget), et chaque abonnement à un événement renvoie une fonction de nettoyage qui supprime son listener. Rien d'autre d'Electron ou de Node ne fuit vers le renderer.

### Processus renderer (`src/renderer/`)

Environnement navigateur servi par Vite en développement et chargé depuis `dist/renderer/index.html` en production. React pur — aucune API Node. N'interagit avec le processus principal qu'à travers `window.electronAPI` (typé dans `electron-api.d.ts`).

### Couche partagée (`src/shared/`)

TypeScript pur, importé par les trois processus. Contient le registre des canaux IPC, les types du domaine, le système d'erreurs, le logger, les constantes, les listes de codecs, les helpers de validation et les constantes de messages de log. Comme `package.json` n'utilise pas de frontières de paquets séparées, ce répertoire est référencé via des imports relatifs depuis chaque racine de processus.

## Système de build

Trois projets TypeScript plus Vite produisent trois dossiers de sortie :

| Script                   | Compile                     | Sortie            |
| ------------------------ | --------------------------- | ----------------- |
| `build:renderer`         | `vite build`                | `dist/renderer/`  |
| `build:main`             | `tsc -p tsconfig.main.json` | `dist/main/`      |
| `build:preload`          | `tsc -p tsconfig.preload.json` | `dist/preload/` |

`npm run build` exécute les trois en séquence. Le processus principal charge le preload depuis `dist/preload/index.js` et le renderer depuis `dist/renderer/index.html` (production) ou le serveur de dev Vite (développement, flag `--dev` ou `NODE_ENV=development`).

Electron-builder empaquette l'application pour Windows (NSIS), macOS (DMG) et Linux (AppImage), en embarquant `ffmpeg-static` et `ffprobe-static` comme `extraResources` afin que les binaires voyagent avec l'app. Le workflow de release CI télécharge les binaires préconstruits pour chaque plateforme/architecture cible via `scripts/fetch-media-binaries.mjs`.

### Résolution des binaires

Toute la résolution des binaires FFmpeg/FFprobe est centralisée dans `src/main/media-binaries.ts` (`getFfmpegPath` / `getFfprobePath`), consommée par chaque transcoder, le décodeur d'images, timeline media, les aperçus image/vidéo et le CLI. La chaîne de repli est :

1. **Application empaquetée** : les binaires embarqués comme `extraResources` sous le répertoire `resources` d'Electron (`resources/ffmpeg-static/...` et `resources/ffprobe-static/...`, ce dernier utilisant le sous-chemin spécifique à la plateforme/l'architecture).
2. **Non empaquetée (dev/CLI/tests)** : les binaires installés `node_modules/ffmpeg-static` et `node_modules/ffprobe-static` (résolus via la clé `import` de la carte `exports` de chaque paquet, donc cela fonctionne aussi depuis ESM).
3. La commande système (`ffmpeg` / `ffprobe`) du `PATH`.

## Séquence de démarrage

1. `main/index.ts` s'exécute. Il inspecte `process.argv` dans `isCliMode()`.
2. **Mode CLI** (`--cli`/`--help` explicites, ou >=2 arguments positionnels) : n'enregistre aucune fenêtre. Sur `app.whenReady()`, il appelle `runCli()` et sort avec les codes `SUCCESS` ou `ERROR`.
3. **Mode GUI** : active le switch `autoplay-policy`, crée une fenêtre splash non interactive (affichée immédiatement), puis la fenêtre principale sans cadre (`show: false`).
4. `registerIpcHandlers(mainWindow)` câble tous les modules IPC ; `patchConsole` remplace `console.*` afin que les logs du processus principal soient transmis au renderer via le canal `log-message`.
5. La fenêtre principale est affichée sur `ready-to-show`, moment où la splash est fermée.
6. En production, le renderer est chargé depuis `dist/renderer/index.html` ; en développement, depuis `http://localhost:5173` avec les DevTools ouverts.

## Mode CLI

`src/main/cli/cli.ts` utilise **commander** avec des sous-commandes. Quand `runCli()` s'exécute :

1. Un shim hérité mappe l'usage à plat (`encodex in.mp4 out.mp4` -> `convert`, `encodex --info in.mp4` -> `info`) sur la sous-commande correspondante.
2. Chaque sous-commande analyse ses propres options plus les globales partagées (`--transcoder`, `--theme`, `--verbose`, `--quiet`, `--no-color`, `--json`, `--timeout`).
3. `info`/`capabilities` affichent des tables lisibles par défaut, et du JSON avec `--json`.
4. `convert`/`compress`/`extract-audio`/`batch` construisent un objet `ConversionOptions` et appellent `transcoder.convert(...)` (batch pilote une `JobQueue` en mémoire avec un `MultiBar`).
5. La progression va sur `stdout` (avec un watchdog timeout), les lignes de statut/succès respectent le routage `--json`/`--quiet`/`--verbose`, et le processus se termine via `mapCliErrorToExitCode` (usage=2, annulé=3, introuvable=4, timeout=5, succès=0).

Le CLI réutilise exactement le même pipeline transcoder que la GUI — il n'y a aucun chemin d'encodage séparé à maintenir.

## Couche de code partagé

La décision architecturale la plus importante est que tous les contrats inter-processus vivent dans `src/shared/` :

- **`types.ts`** — `ConversionOptions`, `MediaInfo`, `MediaStreamInfo`, `QueueJob`, `ConversionProgress`, `PlayerFrame`, `PlayerAudioChunk`, `WaveformData`, `ThumbnailStrip`, `EncoderCapabilities`, `LogEntry`, `FileItem`, `ConversionOperation`, `UpdateInfo`, `UpdateAsset`, `UpdateProgress`.
- **`ipc-channels.ts`** — l'objet constant `IPC`, source unique de vérité pour chaque chaîne de canal. Main, preload et renderer l'importent tous, donc un nom de canal ne peut jamais diverger entre les processus.
- **`errors.ts`** — le système d'erreurs typé (voir [Gestion des erreurs](/fr/docs/architecture-renderer#error-handling)).
- **`constants.ts` / `app-constants.ts`** — limites numériques et valeurs de mise en page UI (tailles de fenêtre, buckets de forme d'onde, dimensions de miniatures, plafond de l'historique d'erreurs, etc.).
- **`transcoder-constants.ts` / `hwaccel-settings.ts`** — flags FFmpeg, valeurs par défaut, motifs de progression et réglages d'accélération matérielle.
- **`media-options.ts` / `codec-containers.ts` / `codec-classification.ts`** — les listes organisées de 51 codecs vidéo, 27 codecs audio, 56 formats de pixels, règles de compatibilité conteneur et helpers de famille de codecs.
- **`validation.ts`** — fonctions pures de validation temps/échelle/bitrate/plage, utilisées à la fois par les formulaires du renderer et le CLI.
- **`logger.ts` / `log-constants.ts`** — un logger horodaté plus ~406 modèles de messages de log partagés pour que les logs restent cohérents entre les processus.
