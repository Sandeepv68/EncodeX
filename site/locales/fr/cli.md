---
title: "EncodeX CLI – Ligne de commande FFmpeg simplifiée | EncodeX"
description: "La CLI d'EncodeX vous donne le pouvoir de la ligne de commande FFmpeg avec des commandes simples et lisibles. Convertissez, compressez, extrayez l'audio et traitiez par lots depuis le terminal sur Windows, Mac et Linux."
---

# EncodeX CLI

Assez simple pour les utilisateurs quotidiens. Assez puissant pour les développeurs. **EncodeX** n'est pas seulement une interface graphique — le même moteur FFmpeg est disponible en ligne de commande via la **CLI EncodeX**.

## Ligne de commande FFmpeg, sans la syntaxe FFmpeg

La ligne de commande native de FFmpeg est puissante mais notoirement impitoyable. La **CLI EncodeX** l'enveloppe dans des commandes simples et lisibles :

```bash
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac
encodex info input.mp4 --json
encodex compress photo.png -f jpg -q 30
encodex extract-audio input.mp4
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted
```

Pas de chaînes cryptiques `-c:v libx264 -crf 23 -preset medium` — juste des drapeaux d'options clairs, les mêmes paramètres que l'interface graphique, et une sortie propre.

## Pourquoi utiliser la CLI EncodeX ?

- **Automatisez** — automatisez les conversions dans les tâches cron, les pipelines CI et les serveurs
- **Cohérente** — le même moteur et les mêmes profils que l'interface graphique
- **Compatible lots** — motifs glob et `--concurrency` pour le travail parallèle
- **Lisible** — des commandes que vous pouvez taper sans manuel
- **Multiplateforme** — fonctionne sur Windows, macOS et Linux
- **Sans interface** — aucun bureau requis, parfait pour les serveurs

## Commandes de la CLI

| Commande          | Ce qu'elle fait                                          |
| ----------------- | -------------------------------------------------------- |
| `encodex convert`  | Convertit un seul fichier entre deux formats            |
| `encodex batch`    | Convertit de nombreux fichiers avec des motifs glob, en parallèle |
| `encodex compress`  | Compresse un fichier vidéo ou image                     |
| `encodex extract-audio` | Extrait la piste audio d'une vidéo                |
| `encodex info`     | Analyse un fichier et affiche ses détails techniques     |
| `encodex capabilities` | Liste les formats et encodeurs pris en charge      |

## Obtenez la CLI

La CLI est incluse avec **chaque installation d'EncodeX** — téléchargez l'application et vous pourrez appeler `encodex` depuis votre terminal. Aucune installation séparée nécessaire.

[Téléchargez EncodeX gratuitement](/fr/download)

## FAQ

**Ai-je besoin de l'interface graphique pour utiliser la CLI ?** Non, la CLI fonctionne de manière autonome. Elle est incluse avec chaque installation d'EncodeX.

**Puis-je utiliser la CLI EncodeX sur un serveur ?** Oui — elle est sans interface, elle fonctionne donc parfaitement dans les scripts, le CI et les environnements serveur.

**La CLI EncodeX est-elle vraiment gratuite ?** Oui — EncodeX est gratuit pour toujours et open source (MIT).

## Commencez

- [Téléchargez EncodeX gratuitement](/fr/download)
- [Découvrez pourquoi EncodeX est la meilleure interface FFmpeg](/fr/ffmpeg-gui)
- [Apprenez ce qu'est réellement FFmpeg](/fr/learn/what-is-ffmpeg)
- [Voir toutes les conversions et fonctionnalités](/fr/features)
