---
title: "Qu'est-ce que FFmpeg ? Une explication simple | EncodeX"
description: "Qu'est-ce que FFmpeg et comment fonctionne-t-il ? Un guide en langage simple sur les codecs, les conteneurs et comment EncodeX enveloppe FFmpeg dans une interface facile à utiliser."
---

# Qu'est-ce que FFmpeg ?

**FFmpeg** est une bibliothèque logicielle et un outil en ligne de commande gratuit et open source qui est le moteur invisible derrière presque toute la conversion vidéo et audio. Si vous avez déjà converti une vidéo, il y a de fortes chances que vous ayez utilisé un outil construit sur FFmpeg — y compris **EncodeX**.

## FFmpeg en une phrase

> FFmpeg est le couteau suisse du vidéo et de l'audio — un logiciel capable de lire presque n'importe quel fichier multimédia, et de l'écrire dans presque n'importe quel autre format.

## Que peut faire FFmpeg ?

FFmpeg peut :

- **Convertir** la vidéo et l'audio entre des centaines de formats
- **Compresser** des fichiers pour les rendre plus petits
- **Couper**, **tronquer** et **joindre** des clips
- **Extraire** l'audio d'une vidéo
- **Redimensionner**, **rééchantillonner** et ajouter des effets
- **Diffuser** des médias et bien plus

C'est incroyablement puissant — ce qui est aussi son inconvénient.

## Le problème : FFmpeg est un outil en ligne de commande

FFmpeg s'utilise en tapant des commandes. Par exemple, pour convertir une vidéo, vous taperiez quelque chose comme :

```bash
ffmpeg -i input.mkv -c:v libx264 -crf 18 -c:a aac output.mp4
```

Si cela vous semble être une langue étrangère, vous n'êtes pas seul. C'est exactement là qu'intervient **une interface pour FFmpeg**.

## EncodeX : FFmpeg sans la courbe d'apprentissage

**EncodeX** est construit **sur FFmpeg**, vous offrant toute sa puissance derrière une interface conviviale et visuelle. Au lieu de taper des commandes, vous :

1. **Glissez-déposez** vos fichiers
2. **Choisissez** ce que vous voulez (un format, un appareil, un fichier plus petit)
3. **Cliquez sur Convertir**

Le résultat est le même moteur que celui des professionnels — mais accessible à tous. C'est pourquoi EncodeX est décrit comme une **interface FFmpeg** ou un **front-end pour FFmpeg**.

## Une note rapide sur les codecs et les conteneurs

Deux termes que vous entendrez souvent :

- **Conteneur** — l'« emballage » qui contient les flux vidéo et audio. Courants : **MP4**, **MKV**, **MOV**, **AVI**.
- **Codec** — la méthode utilisée pour compresser la vidéo ou l'audio. Courants : **H.264**, **H.265/HEVC**, **AV1**.

Un seul fichier MP4 peut contenir du H.264, du H.265 ou de l'AV1. Comprendre la différence vous aide à choisir la bonne sortie — et les suggestions de préréglages d'EncodeX gèrent ce choix pour vous.

## Pourquoi on apprécie les outils basés sur FFmpeg

- **Prise en charge massive de formats** — si un format existe, FFmpeg sait généralement le lire et l'écrire
- **Contrôle de la qualité** — vous pouvez préserver la qualité ou compresser fortement
- **Gratuit et open source** — sans frais de licence, constamment amélioré par une grande communauté
- **Standard de l'industrie** — utilisé par d'innombrables entreprises et outils multimédia

## En savoir plus

- [Découvrez EncodeX en action](/fr/features)
- [Téléchargez EncodeX gratuitement](/fr/download)
- [Convertissez la vidéo entre les formats](/fr/video-converter)
- [Compressez des vidéos vers une taille plus petite](/fr/video-compressor)
