# Fonctionnalités

EncodeX est un outil multimédia de conversion multiplateforme qui met la puissance de FFmpeg dans une interface bureau moderne et intuitive. Construit avec Electron, React et TypeScript, il permet de convertir des médias entre formats, d'extraire l'audio, de découper des vidéos et de compresser des images — le tout via une UI propre et réactive avec une file par lots, l'accélération matérielle, un mode CLI et une internationalisation complète.

## Aperçu des fonctionnalités

### Conversion média

Convertissez entre formats vidéo/audio avec un contrôle fin : sélection du codec (51 codecs vidéo couvrant les familles logicielles et matérielles, 27 codecs audio), bitrate, résolution de sortie (avec préservation facultative du ratio), format de pixels (56 formats regroupés par profondeur de bits), échelle de qualité (qscale), inclusion de la piste audio et choix du cœur transcoder. Plusieurs fichiers peuvent être mis en file via la file par lots (voir ci-dessous).

### Copie sans perte

Copie de flux vidéo ou audio sans ré-encodage (`-c copy`). Utile pour changer rapidement de conteneur, faire du remux, ou lorsque la préservation de la qualité est critique.

### Accélération matérielle

Encodage accéléré matériellement avec détection automatique des familles d'encodeurs disponibles. Prend en charge NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox et les encodeurs Microsoft Media Foundation. L'accélération peut être activée/désactivée, avec un sélecteur de mode — `auto` ajoute les flags FFmpeg `-hwaccel` correspondant à la famille d'encodeurs matériels sélectionnée, `encode` s'appuie sur l'accélération propre à l'encodeur — et un filtre de type d'encodeur (`auto` / `hardware` / `software`) qui restreint le sélecteur de codecs vidéo aux encodeurs tous, GPU uniquement ou CPU uniquement. Les encodeurs disponibles sont détectés depuis le binaire FFmpeg embarqué à l'exécution et les sélecteurs de codecs sont filtrés selon ce que le binaire fournit réellement.

### Informations média

Analysez les fichiers média et inspectez les informations détaillées par flux : codec, profil, niveau, résolution, ratio d'affichage, format de pixels, profondeur de bits, color range/space/transfer/primaries, fréquence d'images, bitrate, fréquence d'échantillonnage, format d'échantillon, nombre/disposition de canaux, durée, temps de début, nombre d'images, langue et tags. Fonctionne avec les flux vidéo, audio et sous-titres.

### Compression d'images

Compressez les images (JPEG, PNG, WebP, BMP, GIF, TIFF, PPM, PGM, PBM) avec une échelle de qualité et une mise à l'échelle de résolution configurables via les codecs d'images de FFmpeg. Inclut un aperçu en direct, un affichage de la taille du fichier et — pour les entrées JPEG/PNG/WebP — un panneau complet de métadonnées EXIF avec histogrammes RGB et luma.

### Extraction audio

Extrayez les pistes audio des fichiers vidéo. Sortie en AAC, MP3, AC3, FLAC, WAV, Vorbis, Opus, ALAC ou tout autre des 27 codecs audio pris en charge. Le flux audio source est sélectionnable lorsque plusieurs pistes sont présentes.

### Découpe vidéo

Prévisualisez et découpez des segments vidéo avec une sélection précise à l'image près du temps début/fin ou de la durée. Inclut un lecteur intégré qui décode les images vidéo (via un pipe FFmpeg rawvideo vers un élément Canvas HTML) et l'audio (via un pipe S16LE PCM séparé converti en float et alimenté au Web Audio API) en parallèle, avec une timeline multi-pistes zoomable : montage de miniatures vidéo, forme d'onde audio, ombrage garder/atténuer, poignées de découpe par glisser et tête de lecture scrubbable.

### File d'attente par lots

Traitez plusieurs fichiers avec des opérations configurables (transcodage, extraction audio, compression d'image). Les tâches sont ajoutées via un dialogue de revue où noms de sortie et options peuvent être ajustés avant leur entrée dans la file.

- **Traitement parallèle** — jusqu'à 4 tâches simultanées (`MAX_QUEUE_CONCURRENCY = 4`) ; le plafond de concurrence est configurable à l'exécution et persisté.
- **Cycle de vie de la file** — démarrer, mettre en pause et reprendre toute la file ; tout annuler ; purger les tâches terminées/en échec ; supprimer des tâches individuelles.
- **Réordonnancement** — glisser-déposer des tâches en attente (avec zone de dépôt), adossé à un canal `QUEUE_MOVE_TO` qui signale la nouvelle position de la tâche.
- **Édition des tâches** — remplacer les options (et facultativement le chemin de sortie) de toute tâche en attente avant son démarrage (`QUEUE_UPDATE_OPTIONS`).
- **Export / import** — sauvegarder la file dans un fichier JSON et la réimporter plus tard (`QUEUE_EXPORT` / `QUEUE_IMPORT`), validé avec un code d'erreur dédié `INVALID_QUEUE_FILE`.
- **Persistance** — l'instantané de la file (tâches + concurrence) est sauvegardé durablement dans `queue-state.json` dans le répertoire user-data et restauré au démarrage.
- **Filtres de statut** — filtrer la liste des tâches par queued / running / done / failed, plus un champ de recherche focusable.
- **Actions d'alimentation après fin** — éteindre, mettre en veille ou hiberner la machine à la fin de la file (`shutdown`, `pmset` ou `systemctl` selon la plateforme ; Windows honore un flag de fermeture forcée).
- **Retour en direct** — progression par tâche en temps réel (pourcentage, temps, vitesse, ETA) diffusée via IPC, gestion d'erreur par tâche, et badge de compteur de navigation montrant le travail restant.

### Cœurs transcoder multiples

- **API FFmpeg** — bindings Node.js fluent-ffmpeg avec événements de progression programmatiques
- **CLI FFmpeg** — invocation CLI directe via processus enfant, sans bindings natifs
- **Framework BMF** — outils CLI BMF pour scénarios de pipeline avancés (nécessite une installation séparée)

### Réglages

Page de réglages dédiée pour le thème, l'accélération matérielle (activer/désactiver, mode, type d'encodeur), toujours au premier plan, lancement à la connexion, concurrence de la file par lots et action d'alimentation après fin. Les préférences persistent dans `localStorage` et prennent effet au démarrage.

### Raccourcis clavier

Un registre central de raccourcis (`src/renderer/constants/shortcuts.ts`) définit plus de 60 raccourcis répartis en neuf sections (global, convert, media info, image compress, audio extract, video cut, batch queue, logs, dashboard). Points saillants :

- `Ctrl+/` — ouvrir le dialogue d'aide des raccourcis
- `Alt+1`…`Alt+9` — sauter directement à une page
- `Ctrl+O` / `Ctrl+Shift+S` / `Ctrl+Enter` — choisir l'entrée / choisir la sortie / lancer la tâche (cohérent entre pages)
- `Ctrl+Shift+P` / `Ctrl+Shift+C` — mettre en pause / annuler la tâche active
- File par lots : `Ctrl+E` export, `Ctrl+I` import, `1`–`5` filtres de statut, `F` focus recherche
- Lecteur video cut : `Espace` lecture/pause, `M` muet, flèches pour naviguer

Les combinaisons sont reconnues via `event.code`, donc elles fonctionnent indépendamment de la disposition clavier. Les infobulles tirent leur texte d'aide du même registre.

### Blips d'activité & popover de tâche

Pendant qu'une conversion, une extraction audio ou une découpe vidéo tourne, un blip clignotant apparaît sur la ligne de navigation correspondante ; la ligne Batch Queue affiche un compteur en direct des tâches restantes. Survoler (ou focus clavier) un blip ouvre un popover ancré dessus avec le titre de la tâche, le statut localisé (y compris état en pause et badge de concurrence parallèle), la miniature du fichier source, le nom du fichier et une barre de progression en direct — plus un empilement de miniatures de tâches en attente pendant qu'un lot avance. Le popover utilise une ombre douce et sa flèche pointe vers le blip.

### Confirmation de fermeture

Fermer la fenêtre alors que des tâches sont actives passe par un flux de confirmation : le processus principal interroge le renderer (`WINDOW_CLOSE_REQUESTED`), qui affiche un dialogue listant le travail en cours avant que la fermeture ne soit confirmée (`WINDOW_CONFIRM_CLOSE`). Un écran splash est affiché au démarrage pendant le chargement de la fenêtre principale.

### Tableau de bord

Une page d'accueil avec tuiles d'actions rapides pour chaque outil (touches numériques `1`–`6` pour y sauter) et un branding saisonnier œuf de Pâque (voir ci-dessous).

### Œufs de Pâque

Aux dates de fêtes, le tableau de bord remplace le logo par défaut par un visuel festif — Noël, Halloween, Nouvel An, 4 juillet, Pâques, Diwali et Holi. Chaque fête est active sur une fenêtre de 7 jours autour de sa date ; Diwali et Holi suivent le calendrier hindou lunisolaire via des dates curatées (2026–2035) avec un calcul astronomique de repli pour les autres années.

### Logs

Visionneuse de logs en direct qui agrège la sortie console des processus principal et renderer via IPC. Prend en charge le filtrage par niveau (DEBUG/INFO/WARN/ERROR), la purge et le téléchargement du log en `.txt`.

### Notifications

Notifications toast (success/info/warning/error) avec durée configurable pour un retour non bloquant, superposées à la snackbar d'erreurs globale.

### Fenêtre sans cadre personnalisée

Fenêtre d'application sans cadre avec barre de titre personnalisée fournissant contrôles réduire / basculer maximiser / fermer, une zone déplaçable et la prise en charge toujours au premier plan. Un écran splash non interactif est affiché pendant le chargement de la fenêtre principale.

### Thème sombre / clair

Détection du thème consciente du système avec bascule manuelle. La préférence de thème persiste dans `localStorage` (clé `encodex-theme`).

### Prise en charge RTL

Mise en page droite-à-gauche pour les locales arabes et hébraïques (`ar-SA`, `ar-AE`, `ar-JO`, `he-IL`). La direction bascule automatiquement lors d'un changement de langue via un plugin de style RTL Emotion.

### Internationalisation

56 locales couvrant 35 langues :

| Langue      | Locales                                    |
| ----------- | ------------------------------------------ |
| Anglais     | `en-US`, `en-GB`, `en-IN`, `en-CA`, `en-AU`, `en-SG`, `en-ZA`, `en-NZ`, `en-IE` |
| Espagnol    | `es-ES`, `es-MX`, `es-AR`, `es-CL`         |
| Français    | `fr-FR`, `fr-CA`, `fr-BE`                  |
| Hindi       | `hi-IN`                                    |
| Allemand    | `de-DE`, `de-BE`                           |
| Italien     | `it-IT`                                    |
| Néerlandais | `nl-NL`, `nl-BE`                           |
| Suédois     | `sv-SE`                                    |
| Norvégien   | `nb-NO`                                    |
| Portugais   | `pt-BR`, `pt-PT`                           |
| Ukrainien   | `uk-UA`                                    |
| Russe       | `ru-RU`                                    |
| Polonais    | `pl-PL`                                    |
| Thaï        | `th-TH`                                    |
| Cingalais   | `si-LK`                                    |
| Mongol      | `mn-MN`                                    |
| Malais      | `ms-MY`, `ms-SG`                           |
| Chinois     | `zh-SG`, `zh-TW`                           |
| Japonais    | `ja-JP`                                    |
| Coréen      | `ko-KR`                                    |
| Indonésien  | `id-ID`                                    |
| Filipino    | `fil-PH`, `tl-PH`                          |
| Afrikaans   | `af-ZA`                                    |
| Hébreu      | `he-IL`                                    |
| Arabe       | `ar-SA`, `ar-AE`, `ar-JO`                  |
| Népalais    | `ne-NP`                                    |
| Khmer       | `km-KH`                                    |
| Vietnamien  | `vi-VN`                                    |
| Lao         | `lo-LA`                                    |
| Maori       | `mi-NZ`                                    |
| Islandais   | `is-IS`                                    |
| Groenlandais| `kl-GL`                                    |
| Irlandais   | `ga-IE`                                    |
| Finnois     | `fi-FI`                                    |
| Danois      | `da-DK`                                    |

### Mises à jour intégrées

Gestionnaire de mises à jour personnalisé qui consulte GitHub Releases pour de nouvelles versions, notifie l'utilisateur de leur disponibilité, télécharge l'installateur spécifique à la plateforme (`.exe` / `.dmg` / `.AppImage`) dans l'app avec report de progression en temps réel, puis lance l'installateur une fois terminé. La comparaison de versions utilise semver avec suppression des suffixes pre-release. Le flux de mise à jour est entièrement intégré à la page About avec un bouton « Rechercher des mises à jour » et un dialogue global.

### Gestion des erreurs

Système d'erreurs structuré avec codes typés (`ErrorCode`), messages localisés destinés à l'utilisateur, snackbar d'erreurs globale, bannières d'erreurs inline, notifications toast, React error boundaries imbriquées et historique d'erreurs intégré (plafond 50). Toutes les erreurs sont normalisées via `formatError()` et propagées à travers IPC.

## Formats média pris en charge

### Codecs vidéo (51)

| Groupe                     | Codecs                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Logiciels (28)**         | H.264 (libx264, libx264rgb), H.265/HEVC (libx265, Kvazaar), VP8 (libvpx), VP9 (libvpx-vp9), AV1 (libaom-av1, SVT-AV1, rav1e), MPEG-4 (libxvid, mpeg4), MPEG-1, MPEG-2, Theora, JPEG 2000 (libopenjpeg), WebP (libwebp, libwebp_anim), ProRes (prores, prores_ks), Huffyuv, FFV1, Ut Video, MJPEG, PNG, TIFF, VC-2, AVS (libxavs, libxavs2) |
| **NVIDIA NVENC (3)**       | H.264 (h264_nvenc), H.265 (hevc_nvenc), AV1 (av1_nvenc)                                                                                                                                                                                                                                                                                    |
| **Intel QSV (5)**          | H.264, H.265, MPEG-2, VP9, AV1                                                                                                                                                                                                                                                                                                             |
| **AMD AMF (3)**            | H.264, H.265, AV1                                                                                                                                                                                                                                                                                                                          |
| **VAAPI (6)**              | H.264, H.265, MJPEG, VP8, VP9, AV1                                                                                                                                                                                                                                                                                                         |
| **Apple VideoToolbox (4)** | H.264, H.265, ProRes, VP9                                                                                                                                                                                                                                                                                                                  |
| **Media Foundation (2)**   | H.264, H.265                                                                                                                                                                                                                                                                                                                               |

### Codecs audio (27)

| Groupe            | Codecs                                                    |
| ----------------- | --------------------------------------------------------- |
| **AAC / MPEG**    | AAC (natif, FDK), MP3 (LAME, libshine), MP2 (libtwolame)  |
| **Dolby**         | AC-3, E-AC-3, TrueHD, DTS, MLP                            |
| **Sans perte**    | FLAC, ALAC, WavPack                                       |
| **Streaming**     | Vorbis, Opus, Speex, AMR-WB                               |
| **PCM**           | s16le, s24le, f32le, s16be, u8, A-law, Mu-law             |
| **Windows Media** | WMA v1, WMA v2                                            |
| **Autres**        | ADPCM IMA (WAV)                                           |

### Formats de pixels (56)

| Groupe               | Formats                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| **YUV 8 bits**      | yuv420p, yuv422p, yuv444p, yuv410p, yuv411p, yuv440p, yuvj420p, yuvj422p, yuvj444p     |
| **YUV 10 bits**     | yuv420p10le, yuv422p10le, yuv444p10le                                                  |
| **YUV 12 bits**     | yuv420p12le, yuv422p12le, yuv444p12le                                                  |
| **YUV 16 bits**     | yuv420p16le, yuv444p16le                                                               |
| **YUV semi-planaire** | nv12, nv21, nv16, nv20le                                                             |
| **YUV avec alpha**  | yuva420p, yuva422p, yuva444p, yuva420p10le, yuva444p10le, yuva444p16le                 |
| **RGB compact**     | rgb24, bgr24, rgb0, bgr0, rgba, bgra, argb, abgr, rgb48le, bgr48le, rgba64le, bgra64le |
| **RGB planaire**    | gbrp, gbrp10le, gbrp12le, gbrp16le, gbrap, gbrap10le, gbrap16le                        |
| **Monochrome**      | gray, gray10le, gray12le, gray16le, grayf32le, ya8, ya16le                             |
| **HDR**             | p010le, p016le, x2rgb10le                                                              |

### Extensions de fichiers d'entrée

| Catégorie | Extensions                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vidéo    | `mp4`, `m4v`, `avi`, `mkv`, `mov`, `qt`, `flv`, `f4v`, `wmv`, `asf`, `webm`, `3gp`, `3g2`, `mpg`, `mpeg`, `mts`, `m2ts`, `ts`, `mxf`, `ogv`, `ogg`, `vob`, `divx`, `dv`, `rm`, `rmvb`, `h264`, `h265`, `hevc` |
| Audio    | `mp3`, `aac`, `wav`, `flac`, `ogg`, `opus`, `m4a`, `wma`, `alac`, `aiff`, `aif`, `au`, `caf`, `pcm`, `mid`, `midi`                                                                                            |
| Image    | `jpg`, `jpeg`, `png`, `webp`, `bmp`, `gif`, `tiff`, `tif`, `svg`, `ico`, `heic`, `heif`, `avif`, `ppm`, `pgm`, `pbm`, `xbm`                                                                                   |
| Sous-titres | `srt`, `ass`, `ssa`, `vtt`, `sub`, `idx`, `smi`                                                                                                                                                            |

## Utilitaires de validation

| Fonction                     | Description                | Formats acceptés                                      |
| ---------------------------- | -------------------------- | ----------------------------------------------------- |
| `isValidTime(value)`         | Valide les chaînes de temps | `HH:MM:SS`, `HH:MM:SS.mmm`, secondes sous forme de nombre |
| `isValidScale(value)`        | Valide résolution/échelle  | `WxH`, `W:H`, pourcentage `1%`–`999%`, nombre positif |
| `isValidBitrate(value)`      | Valide les chaînes de bitrate | ex. `128k`, `1M`, `2000K`                           |
| `isInRange(value, min, max)` | Vérifie une plage numérique | Tout nombre fini                                     |

## Constantes transcoder

| Constante                                         | Valeur                                                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRANSCODER_TYPES`                                | `['FFMPEG', 'FFTOOL', 'BMF']`                                                                                                                                     |
| `TRANSCODER_LABELS`                               | `{ FFMPEG: 'FFmpeg (API)', FFTOOL: 'FFmpeg (CLI)', BMF: 'BMF Framework' }`                                                                                        |
| `FFMPEG_FLAGS`                                    | `-c`, `-vcodec`, `-acodec`, `-b:v`, `-b:a`, `-qscale:v`, `-vf`, `-pix_fmt`, `-color_range`, `-ss`, `-to`, `-t`, `-y`, `-i`, `-an`, `-sn`, `-dn`, `-re`, `-copyts` |
| `FFPROBE_FLAGS`                                   | `-v quiet -print_format json -show_format -show_streams`                                                                                                          |
| `TRANSCODER_COMMANDS`                             | `bmf_ffmpeg`, `bmf_ffprobe`, `ffmpeg`, `ffprobe`                                                                                                                  |
| `TRANSCODER_DEFAULTS.PROGRESS_INTERVAL_MS`        | `500`                                                                                                                                                             |
| `TRANSCODER_DEFAULTS.PLAYER_DEFAULT_WIDTH/HEIGHT` | `640` / `360`                                                                                                                                                     |
| `TRANSCODER_DEFAULTS.PLAYER_FPS_CAP`              | `30`                                                                                                                                                              |
| `TRANSCODER_DEFAULTS.FFPROBE_TIMEOUT_MS`          | `30000`                                                                                                                                                           |
| `CONVERSION_DEFAULTS.VIDEO_CODEC`                 | `libx264`                                                                                                                                                         |
| `CONVERSION_DEFAULTS.AUDIO_CODEC`                 | `aac`                                                                                                                                                             |
| `CONVERSION_DEFAULTS.QSCALE`                      | `23`                                                                                                                                                              |
| `CONVERSION_DEFAULTS.PIXEL_FORMAT`                | `yuv420p`                                                                                                                                                         |
| `CONVERSION_DEFAULTS.SCALE`                       | `1920x1080`                                                                                                                                                       |
| `CONVERSION_DEFAULTS.VIDEO_BITRATE`               | `2000k`                                                                                                                                                           |
| `CONVERSION_DEFAULTS.AUDIO_BITRATE`               | `192k`                                                                                                                                                            |
| `QSCALE_RANGE.MIN/MAX`                            | `1` / `31`                                                                                                                                                        |
