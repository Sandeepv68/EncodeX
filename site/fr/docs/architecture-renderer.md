# Renderer, état & sous-systèmes

## Architecture du renderer

### Arbre de rendu

Les dix pages sont découpées avec `React.lazy` et chargées sous une `ErrorBoundary` par page :

| Page            | Route          | Objectif                                                       |
| --------------- | -------------- | -------------------------------------------------------------- |
| Dashboard       | `/`            | Cartes d'actions rapides                                       |
| Convert         | `/convert`     | Formulaire de conversion média (codec, bitrate, échelle, hwaccel, ...) |
| MediaInfo       | `/media-info`  | Analyse + table de détails par flux                            |
| ImageCompress   | `/image-compress` | Compression d'images + EXIF + histogrammes                  |
| AudioExtract    | `/audio-extract` | Extraction des pistes audio vers l'un des 27 codecs          |
| VideoCut        | `/video-cut`   | Lecteur + timeline zoomable + découpe                          |
| BatchQueue      | `/batch`       | Gestion de la file (ajout/suppression/annulation totale)       |
| Logs            | `/logs`        | Visionneuse de logs en direct avec filtre par niveau + téléchargement |
| Settings        | `/settings`    | Thème, hwaccel, toujours au premier plan                       |
| About           | `/about`       | Infos sur l'app, crédits, bouton « Rechercher des mises à jour » |

### Hooks

- `useConversion` — orchestre une conversion depuis la page Convert.
- `useMediaTask` — cycle de vie partagé (s'abonner à `onConversionProgress` -> exécuter la tâche -> `COMPLETED_PROGRESS` ou `showError`). Un garde `useRef` écarte les événements de progression des exécutions périmées.
- `useErrorHandler` — utilitaires de gestion des erreurs.
- `useFormErrors` — erreurs de validation au niveau des champs.
- `useCapabilities` — récupère les capacités des encodeurs et applique les filtres type d'encodeur / hwaccel aux sélecteurs de codecs.

## Gestion de l'état

Stores Zustand dans `src/renderer/stores/` :

| Store             | Responsabilité                                                      |
| ----------------- | ------------------------------------------------------------------- |
| `conversionStore` | État du formulaire de conversion                                    |
| `audioExtractStore` | État du formulaire d'extraction audio                             |
| `errorStore`      | `currentError` + `errorHistory` (plafond 50), `showError`, `showErrorMessage`, actions de nettoyage |
| `queueStore`      | Reflète les tâches de la file par lots depuis les événements du processus principal |
| `settingsStore`   | Réglages + persistance `localStorage` (`encodex-theme`, etc.)       |
| `logStore`        | Entrées de log agrégées (plafond 2000), état du filtre, téléchargement |
| `toastStore`      | File de toasts                                                      |
| `updateStore`     | État du cycle de vie des mises à jour (check, available, downloading, downloaded, error) |

Les stores sont l'unique endroit où l'état UI change ; les composants s'y abonnent avec `useXStore(selector)`.

## File d'attente par lots

`src/main/queue/job-queue.ts` est un processeur FIFO à concurrence limitée qui étend `EventEmitter` :

- `addJob` assigne un `randomUUID`, pousse un `QueueJob` (statut `QUEUED`, progression 0), émet `added`, et lance `processNext()`.
- `processNext()` est le seul endroit où les tâches démarrent : il lance de nouvelles tâches `QUEUED` tant que moins de `concurrency` conversions sont en vol (suivies par `activeJobs`), donc au plus `concurrency` (1–4) tâches tournent en parallèle. Chaque tâche démarrée passe à `RUNNING`, reçoit un transcoder de la fabrique et voit ses `progress`/`error`/`end` câblés ; aux états terminaux, le créneau de la tâche est libéré et `processNext()` le re-remplit. Modifier le plafond de concurrence en cours d'exécution re-remplit les créneaux en attente.
- `cancelJob` annule le transcoder d'une tâche et la retire ; `cancelAll` annule chaque transcoder actif, vide la file et émet `cancelled`. La file prend aussi en charge pause/reprise, réordonnancement move-to, édition des options des tâches en attente, export/import, purge des terminées, actions d'alimentation après fin, et persistance durable vers `queue-state.json` (`src/main/queue/persistence.ts`).

La couche IPC (`ipc/queue.ts`) se contente de relayer les événements de file au renderer via `queue-added`, `queue-removed`, `queue-status-change`, `queue-progress` et `queue-cancelled`, et le `queueStore` les reflète dans l'état React.

## Lecteur vidéo

Le lecteur de la page Video Cut repose sur `FrameDecoder` (`src/main/player/frame-decoder.ts`), qui lance FFmpeg avec deux pipes de sortie :

```
FFmpeg: input (with -re realtime and -copyts)
  -> video: -map 0:v:0 -f rawvideo -pix_fmt rgb24 -s {w}x{h} -an -sn -dn -> pipe:1 (stdout)
  -> audio: -map 0:a:0 -f s16le -ac {channels} -ar {sampleRate} -> pipe:3 (extra stdio fd)
  -> frame timestamps parsed from the -vf showinfo log on stderr (pts_time)
```

- Les images vidéo sont réassemblées depuis le flux rawvideo (`largeur x hauteur x 3` octets) et associées aux valeurs `pts_time` analysées depuis stderr. Si les horodatages se bloquent, un flush d'urgence émet des images avec une estimation monotone de PTS pour que la lecture ne reste jamais bloquée définitivement.
- L'audio est émis en tronçons S16LE de taille fixe (~50 ms au taux demandé, 48 kHz / 2 canaux par défaut).
- `seek()` tue et relance le décodeur au nouvel horodatage. Un compteur `generation` partagé est incrémenté à chaque open/seek ; les images portant une génération périmée sont écartées par le renderer.
- `ipc/player.ts` fait tourner **deux** décodeurs (vidéo + audio) pour que la contre-pression sur un flux ne puisse pas bloquer l'autre, plafonne la résolution de décodage, et relaie images/tronçons via `player-frame` / `player-audio`.
- Le renderer (`components/MediaPlayer.tsx`) blitte les images sur un Canvas HTML et alimente le Web Audio API avec le PCM converti en float, synchronisation A/V basée sur l'horloge, fusion des seeks et détection de blocage.

## Timeline média

`timeline/timeline-media.ts` alimente la timeline zoomable de la page Video Cut :

- **Forme d'onde** — décode le flux audio sélectionné à 8 kHz et calcule des buckets d'amplitude min/max (40/s, jusqu'à 24 000 buckets) sur une fenêtre de 30 s. L'extraction est divisée en segments FFmpeg parallèles, les trous entre segments sont interpolés (`fillWaveformGaps`), et tous les lancements passent par un pool global de créneaux `MAX_CONCURRENT_FFMPEG`.
- **Montage de miniatures** — décode jusqu'à 100 miniatures (160x90) en un unique montage PNG (10 colonnes), puis l'encode en base64 dans une seule URL `data:`. L'encodage PNG se fait en process (`crc32`, `pngChunk`, `encodePng`), sans bibliothèque d'images.

Le renderer (`components/VideoTimeline.tsx`) affiche forme d'onde + montage comme une bande zoomable et scrubbable avec ombrage garder/atténuer et poignées de découpe par glisser.

## Traitement d'images

Les modules `src/main/image-*.ts` gèrent la page Image Compress :

- `image-info.ts` — extrait l'EXIF via `exifr` et calcule les histogrammes RGB + luma en passant l'image par FFmpeg vers des données de pixels brutes.
- `image-preview.ts` — produit des aperçus base64 réduits.
- `image-file-info.ts` — lit les dimensions et la taille du fichier.
- `video-preview.ts` — produit une miniature d'une seule image pour les fichiers vidéo.

La *compression d'image elle-même* n'est qu'une conversion : la page Image Compress construit un `ConversionOptions` (codec, qscale, scale) et l'exécute via le même pipeline transcoder que vidéo/audio, restreint aux codecs d'images.

## Gestion des erreurs

Le système d'erreurs (`src/shared/errors.ts`) définit 16 codes typés — `FILE_NOT_FOUND`, `FFMPEG_NOT_FOUND`, `FFPROBE_NOT_FOUND`, `CONVERSION_FAILED`, `INVALID_FORMAT`, `PROBE_FAILED`, `QUEUE_ERROR`, `PLAYER_ERROR`, `CANCELLED`, `BMF_NOT_AVAILABLE`, `OUTPUT_NOT_SPECIFIED`, `INPUT_NOT_SPECIFIED`, `OUTPUT_EXISTS`, `INVALID_QUEUE_FILE`, `PERMISSION_DENIED`, `UNKNOWN` — chacun avec un message utilisateur par défaut.

Le flux est toujours le même :

```
throw new Error(...)
    |
    v
formatError(err)                    <- shared/errors.ts
    |  normalizes to AppError { code, message, detail, timestamp }
    |  infers code from message keywords / system errno (ENOENT, EACCES, ...)
    v
errorStore.showError()              <- stores in currentError + errorHistory (cap 50)
    |
    +-- ErrorSnackbar               <- global toast, auto-dismiss 6s
    +-- ErrorBanner                 <- inline per-page, closable
    +-- ErrorBoundary               <- React crash catch-all (nested per-page + per-component)
```

Les gestionnaires IPC enveloppent chaque opération dans `try/catch` et re-lancent `formatError(err)`, si bien que les codes d'erreur survivent à la frontière de processus et que le renderer reçoit toujours une `AppError` typée.

## Logging

Un `Logger` horodaté (`src/shared/logger.ts`) est utilisé dans tous les processus. Le processus principal (`patchConsole` dans `index.ts`) comme le renderer (`main.tsx`) patchent `console.*` pour transmettre les entrées vers le système de logs partagé :

- Principal -> renderer via le canal IPC `log-message`.
- Renderer -> directement vers `logStore`.

La page Logs (`pages/Logs.tsx`) agrège les deux sources avec filtrage par niveau (DEBUG/INFO/WARN/ERROR), purge et téléchargement `.txt`. Chaque ligne de log est générée depuis une constante de modèle partagée (`log-constants.ts`) afin que les chaînes restent cohérentes et recherchables.

## Internationalisation & RTL

- i18next est initialisé dans `renderer/i18n/config.ts` avec 56 locales couvrant 35 langues.
- `DirectionProvider` (cache Emotion avec `stylis-plugin-rtl`) bascule la mise en page en RTL pour les locales arabes et hébraïques (`ar-SA`, `ar-AE`, `ar-JO`, `he-IL`).
- `useLanguageDirection` détecte la direction de la locale courante ; la direction de l'app en est dérivée et bascule automatiquement lors d'un changement de langue.
- `localeMeta.ts` conserve les métadonnées de locales et les drapeaux pour le `LanguageMenu`.

## Thèmes

- `ColorModeContext` fournit un mode sombre/clair conscient du système avec bascule manuelle ; la préférence persiste dans `localStorage` sous la clé `encodex-theme`.
- `theme.ts` définit les thèmes clair/sombre MUI ; `colors.ts` contient la palette partagée.
- Le style utilise Emotion (moteur par défaut de MUI) avec des constantes de style par composant extraites dans `renderer/styles/`.

## Référence des flux de données clés

### Conversion (GUI)

```
React page -> Zustand store -> electronAPI.convertFile -> ipcMain.handle(convert-file)
-> factory.createTranscoder(type) -> ITranscoder.convert() -> FFmpeg process
-> 'progress' events -> send(conversion-progress) -> onConversionProgress -> useMediaTask -> ProgressBar
```

### File par lots

```
QueueJob card -> electronAPI.queueAdd -> JobQueue.addJob -> processNext()
-> transcoder.convert() -> 'progress'/'end'/'error' -> queue events -> IPC events -> queueStore -> QueueJobCard
```

### Lecture vidéo

```
VideoCut page -> playerOpen -> FrameDecoder.spawnFfmpeg (video pipe:1 + audio pipe:3)
-> 'frame'/'audio' events -> send(player-frame / player-audio)
-> onPlayerFrame / onPlayerAudio -> MediaPlayer (Canvas + Web Audio, A/V sync)
```

### Timeline

```
VideoCut page -> extractWaveform + extractThumbnails
-> timeline-media.ts (parallel FFmpeg segments, throttled)
-> WaveformData / ThumbnailStrip -> VideoTimeline.tsx (zoom/trim/scrub)
```

### Mises à jour intégrées

```
About page -> updateStore.checkForUpdates -> electronAPI.checkForUpdates
-> updater.ts fetches GitHub Releases API -> compares semver versions
-> send(update-available / update-not-available) -> updateStore -> UpdateDialog
-> electronAPI.downloadUpdate -> updater.ts downloads installer to temp dir
-> send(update-progress) -> updateStore -> progress bar
-> send(update-downloaded) -> updateStore -> "Install & Restart" button
-> electronAPI.installUpdate -> shell.openPath(installer) + app.quit()
```
