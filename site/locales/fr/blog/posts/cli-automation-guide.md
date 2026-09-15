---
title: "Comment Automatiser les Flux de Travail Média avec la CLI d'EncodeX"
description: "Utilisez EncodeX depuis la ligne de commande pour scripter des conversions par lots, extraire l'audio, compresser des images et créer des pipelines média automatisés."
date: 2026-09-12
tags:
  - guide
  - cli
  - automation
  - developer
---

# Comment Automatiser les Flux de Travail Média avec la CLI d'EncodeX

EncodeX est une application avant tout axée sur l'interface graphique, mais elle est livrée avec une interface en ligne de commande complète qui peut faire tout ce que l'application de bureau fait — et même certaines choses qu'elle ne peut pas faire. Si vous travaillez régulièrement avec des fichiers média et souhaitez créer des scripts, automatiser des lots ou intégrer des conversions dans un flux de travail, la CLI fait d'EncodeX un outil que vous pouvez exécuter depuis un terminal, un pipeline CI ou une tâche planifiée.

## Pourquoi Utiliser la CLI ?

L'interface graphique est idéale pour les conversions ponctuelles — glissez un fichier, choisissez un profil, et c'est parti. Mais lorsque vous avez un dossier de cinquante vidéos, ou que vous voulez un script qui compresse chaque enregistrement déposé dans un répertoire, la CLI vous permet d'encoder sans ouvrir de fenêtre.

Cas d'usage courants :

- **Scripts de conversion par lots** — convertissez tous les `.mov` d'un dossier en `.mp4` avec une seule commande.
- **Extraction d'audio** — retirez l'audio des fichiers vidéo pour des podcasts ou des archives.
- **Pipelines CI/CD** — validez ou ré-encodez des artefacts média dans le cadre d'une compilation automatisée.
- **Tâches planifiées** — compressez automatiquement les nouveaux enregistrements chaque nuit.
- **Intégration avec d'autres outils** — envoyez les informations média vers des systèmes de surveillance ou des pipelines de journalisation.

## Pour Commencer

Si vous avez installé EncodeX (GUI), la CLI est déjà disponible. Ouvrez un terminal et exécutez :

```bash
encodex convert --help
```

Vous verrez la liste complète des options. La CLI reflète les capacités de l'interface graphique : chaque format, codec et profil pris en charge par l'application est également disponible depuis la ligne de commande.

Pour les options d'installation et tous les commandes disponibles, consultez la [documentation de la CLI](/fr/docs/cli).

## Convertir une Vidéo

L'opération la plus courante consiste à convertir entre formats. Une conversion simple :

```bash
encodex convert in.mov -o out.mp4
```

Cela utilise les réglages par défaut d'EncodeX (H.264 + AAC dans un conteneur MP4) et produit un fichier qui fonctionne partout.

Pour cibler un codec ou une qualité spécifique :

```bash
encodex convert in.mov -o out.mp4 --video-codec libx265 --crf 20
```

Le H.265 produit des fichiers plus petits à qualité égale. Le CRF 20 est un réglage de haute qualité ; des valeurs plus basses signifient une qualité supérieure (et des fichiers plus volumineux).

## Extraire l'Audio

Extrayez la piste audio d'une vidéo sans ré-encoder :

```bash
encodex extract-audio in.mp4 -o audio.mp3
```

La sortie par défaut est du MP3 à 192k. Pour spécifier un format différent :

```bash
encodex extract-audio in.mp4 -o audio.wav --codec libopus
```

C'est utile pour extraire l'audio de podcasts à partir d'enregistrements vidéo, créer des aperçus audio ou archiver les bandes sonores séparément.

## Transcodage Sans Perte

Lorsque vous devez changer le conteneur sans toucher aux données vidéo ou audio (par exemple, passer de `.mkv` à `.mp4` pour la compatibilité avec les appareils) :

```bash
encodex convert in.mkv -o out.mp4 --video-codec copy --audio-codec copy
```

C'est presque instantané car aucun encodage n'est effectué — les flux sont simplement remuxés dans le nouveau conteneur. Parfait pour l'archiviste qui veut une compatibilité maximale sans perte de qualité.

## Conversions par Lots

Convertissez plusieurs fichiers à la fois :

```bash
encodex batch *.mov -o output/ --video-codec libx264 --crf 23
```

Tous les fichiers correspondants sont traités séquentiellement. Chaque fichier d'entrée devient un fichier de sortie correspondant dans le répertoire `output/`, avec l'extension changée en `.mp4`.

## Obtenir des Informations sur le Média

Avant de convertir, vous pouvez inspecter le codec, la résolution ou le débit binaire d'un fichier :

```bash
encodex info in.mp4
```

Cela imprime un résumé lisible des flux du fichier. Pour une sortie lisible par machine :

```bash
encodex info in.mp4 --json
```

La sortie JSON est utile dans les scripts où vous devez prendre des décisions en fonction des propriétés du fichier (par exemple, « ne ré-encoder que si le codec vidéo n'est pas déjà du H.264 »).

## Codes de Sortie et Gestion des Erreurs

La CLI renvoie des codes de sortie significatifs afin que les scripts puissent détecter un succès ou un échec :

| Code | Signification |
|------|---------|
| 0 | Succès |
| 1 | Erreur générale |
| 2 | Arguments invalides |
| 3 | Fichier d'entrée introuvable |
| 4 | Le fichier de sortie existe (utilisez `--overwrite` pour le remplacer) |

Utilisez-les dans les scripts shell pour gérer les erreurs avec élégance :

```bash
encodex convert in.mp4 -o out.mp4
if [ $? -eq 4 ]; then
  echo "Output exists — skipping."
fi
```

## Tout Assembler

La CLI est conçue pour être composable. Un script réaliste pourrait :

1. Vérifier tous les fichiers vidéo d'un dossier avec `encodex info --json`
2. Filtrer les fichiers de plus de 500 Mo
3. Convertir ces fichiers en un MP4 H.264 plus léger à CRF 23
4. Journaliser les résultats

La [référence complète de la CLI](/fr/docs/cli) documente chaque option, chaque indicateur et chaque code de sortie.

---

*Téléchargez EncodeX gratuitement sur [encodex.in/download](/fr/download). La CLI est incluse dans toutes les installations.*