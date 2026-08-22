# Utilisation CLI

Compilez d'abord, puis invoquez le CLI compilé via la commande `encodex` (le lanceur `bin/encodex.js` enveloppe le binaire Electron). Le mode CLI s'active automatiquement lorsque deux arguments positionnels (entrée + sortie) sont fournis, ou explicitement avec `--cli` :

```bash
# Convert a file (subcommand form)
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Convert a file (legacy flat form — still works)
encodex input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Show media info as a human table
encodex info input.mp4

# Show media info as JSON
encodex info input.mp4 --json

# List transcoder capabilities
encodex capabilities
encodex capabilities --json

# Lossless copy to different container
encodex convert input.mkv output.mp4 --copy

# Cut a segment
encodex convert input.mp4 output.mp4 --start-time 00:01:00 --end-time 00:02:30

# Compress an image
encodex compress photo.png -f jpg -q 30

# Extract audio (mp3 by default)
encodex extract-audio input.mp4

# Batch-convert several files / globs
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted

# Use a specific transcoder core
encodex convert input.mp4 output.mp4 --transcoder FFTOOL
```

L'usage à plat hérité (`encodex in.mp4 out.mp4`, `encodex --info in.mp4`) est automatiquement transformé en shim vers la sous-commande correspondante.

Pour rendre `encodex` disponible globalement, exécutez `npm link` depuis la racine du projet (ou `npm install -g .`). La forme brute `npx electron . --cli ...` reste une alternative fonctionnelle.

## Sous-commandes

| Sous-commande      | Description                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `convert`          | Convertir un média (défaut quand aucune sous-commande ne correspond). Alias : `c` |
| `info`             | Afficher les infos média (table lisible, ou `--json` pour la sortie machine) |
| `capabilities`     | Lister les capacités transcoder disponibles (table ou `--json`)   |
| `compress`         | Compresser une image                                              |
| `extract-audio`    | Extraire le flux audio (codec par défaut `libmp3lame`). Alias : `audio` |
| `batch`            | Convertir plusieurs entrées (fichiers, globs ou répertoires) avec une file |

## Options globales

Les options globales peuvent être placées avant ou après le nom de la sous-commande.

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--transcoder <type>`       | Cœur transcoder : `FFMPEG`, `FFTOOL`, `BMF` (défaut : `FFMPEG`) |
| `--theme <id>`              | Thème de couleur du logo : `light`, `ocean`, `sunset`, `forest`, `lavender`, `rose`, `slate`, `dark` (défaut : `light`) |
| `--verbose`                 | Logging verbeux (route le statut vers stderr)                  |
| `--quiet`                   | Supprime la sortie de statut                                   |
| `--no-color`                | Désactive les couleurs ANSI                                    |
| `--json`                    | Sortie JSON lisible par machine (statut routé vers stderr)     |
| `--timeout <seconds>`       | Timeout de conversion en secondes (défaut : `300`)             |

## Options convert

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-v, --video-codec <codec>` | Codec vidéo (ex. `libx264`, `libx265`, `copy`)                 |
| `-a, --audio-codec <codec>` | Codec audio (ex. `aac`, `libmp3lame`, `copy`)                  |
| `-q, --qscale <qscale>`     | Échelle de qualité (1–31)                                      |
| `--bitrate-video <bitrate>` | Bitrate vidéo (ex. `1000k`)                                    |
| `--bitrate-audio <bitrate>` | Bitrate audio (ex. `192k`)                                     |
| `--pix-fmt <format>`        | Format de pixels (ex. `yuv420p`, `yuv444p`)                    |
| `-s, --scale <WxH>`         | Résolution de sortie (ex. `1280x720` ou `50%`)                 |
| `--start-time <time>`       | Temps de début (`HH:MM:SS` ou secondes)                        |
| `--end-time <time>`         | Temps de fin                                                   |
| `--duration <time>`         | Durée                                                          |
| `--copy`                    | Copie de flux sans perte                                       |
| `--no-audio`                | Exclut le flux audio de la sortie                              |
| `--no-video`                | Exclut le flux vidéo de la sortie (audio seul)                 |
| `--hwaccel / --no-hwaccel`  | Bascule l'accélération matérielle                              |
| `--hwaccel-mode <auto\\|encode>` | Mode d'accélération matérielle (défaut : `auto`)          |
| `--info`                    | Affiche les infos média de l'entrée et quitte                  |

## Options compress

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`       | Fichier de sortie                                              |
| `-f, --format <format>`     | Format de sortie (déduit par défaut de l'extension de sortie)  |
| `-q, --quality <qscale>`    | Échelle de qualité 1–31                                        |
| `-s, --scale <WxH>`         | Résolution de sortie                                           |

## Options extract-audio

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`       | Fichier de sortie                                              |
| `-a, --audio-codec <codec>` | Codec audio (défaut : `libmp3lame`)                            |
| `--bitrate-audio <bitrate>` | Bitrate audio (ex. `192k`)                                     |

## Options batch

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--concurrency <n>`         | Conversions parallèles max (défaut : `4`, borné 1–4)           |
| `--output-dir <dir>`        | Répertoire de sortie des fichiers convertis                    |
| `--suffix <s>`              | Suffixe ajouté aux noms de sortie dérivés (défaut : `_encodex_converted`) |

Batch accepte aussi toutes les options d'encodage de convert (`-v/--video-codec`, `-a/--audio-codec`, `--bitrate-video`, `--bitrate-audio`, `-q/--qscale`, `--pix-fmt`, `-s/--scale`, `--copy`, `--no-audio`, `--no-video`) et les applique à chaque tâche.

## Codes de sortie

| Code | Constante                    | Signification                                  |
| ---- | ---------------------------- | ---------------------------------------------- |
| `0`  | `EXIT_CODES.SUCCESS`         | Succès propre                                  |
| `1`  | `EXIT_CODES.ERROR`           | Erreur générique                               |
| `2`  | `EXIT_CODES.USAGE`           | Arguments invalides/incomplets                 |
| `3`  | `EXIT_CODES.CANCELLED`       | Opération annulée par l'utilisateur            |
| `4`  | `EXIT_CODES.NOT_FOUND`       | Fichier d'entrée, FFmpeg ou FFprobe introuvable |
| `5`  | `EXIT_CODES.TIMEOUT`         | Conversion ayant dépassé `--timeout`           |
