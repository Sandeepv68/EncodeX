---
date: 2026-09-02
title: "Profils de conversion — Plus de 140 préréglages en un clic"
description: "EncodeX embarque désormais plus de 140 profils de conversion intégrés dans 8 catégories. Choisissez un préréglage pour YouTube, Instagram, TikTok, les appareils Apple, ProRes, le streaming HLS et plus — tous les paramètres se remplissent automatiquement."
tags:
  - feature
  - profiles
  - release
---

# Profils de conversion

Nous venons de lancer l'une des fonctionnalités les plus demandées dans EncodeX : les **Profils de conversion**. Au lieu de choisir manuellement les codecs, débits, paramètres de qualité et formats de conteneur à chaque conversion, vous pouvez désormais choisir parmi plus de 140 préréglages qui font tout le travail pour vous.

## Qu'est-ce qu'un profil de conversion ?

Un profil de conversion est une configuration d'encodage enregistrée. Il indique à EncodeX exactement quel codec vidéo, codec audio, débit, niveau de qualité, résolution, format de pixel et conteneur utiliser — le tout en un clic.

Pensez-y comme une recette. Au lieu de mesurer chaque ingrédient vous-même, vous choisissez une recette et tout est prêt.

## Ce qui est inclus

Les plus de 140 profils intégrés sont organisés en 8 catégories :

### Web et Réseaux sociaux

Préréglages optimisés pour les plateformes où vous publiez :

- **YouTube** — 480p jusqu'à 4K, avec variantes H.264, H.265 et AV1
- **Instagram** — Reels, Stories et publications dans le bon ratio et codec
- **TikTok** — vidéo verticale réglée pour un téléchargement rapide et une bonne qualité
- **Facebook** — publications vidéo et publicités
- **X (Twitter)** — vidéo courte avec conscience de la taille du fichier

### Appareils

Préréglages adaptés à du matériel spécifique :

- **Apple** — iPhone, iPad, Mac, Apple TV (H.264 et HEVC)
- **Android** — préréglages téléphone et tablette
- **Consoles de jeux** — formats compatibles PlayStation, Xbox et Nintendo Switch

### Codecs vidéo

Profils spécifiques par codec quand vous savez quel encodeur vous voulez :

- H.264, H.265/HEVC, VP8, VP9, AV1
- MPEG-4, MPEG-2, Theora

### Professionnel

Formats de diffusion et de post-production :

- **ProRes** — 422 LT, 422, 422 HQ, 4444, 4444 XQ
- **DNxHD / DNxHR** — plusieurs niveaux de résolution et de qualité
- **FFV1** — codec sans perte pour l'archivage
- **XDCAM / XAVC** — formats de diffusion Sony

### Streaming

Préréglages de streaming adaptatif :

- **HLS** — HTTP Live Streaming avec durée de segment configurable
- **DASH** — sortie MPEG-DASH

### Audio

Préréglages audio uniquement :

- MP3 (128k, 192k, 320k)
- AAC (128k, 192k, 256k)
- FLAC (sans perte)
- Opus, WAV et plus

### Images

Conversion de formats d'image :

- JPEG, PNG, WebP, AVIF avec contrôles de qualité

### Avancé

Pour les utilisateurs expérimentés :

- Préréglages d'arguments FFmpeg bruts
- Pass-through FFmpeg personnalisé
- Sortie nulle pour les tests

## Comment utiliser les profils

1. Ouvrez la page **Conversion** (ou la **File d'attente par lot**)
2. Repérez le **Sélecteur de profils** en haut de la zone des paramètres
3. Parcourez par catégorie ou recherchez par nom
4. Cliquez sur un profil — tous les champs d'encodage se remplissent automatiquement
5. Ajustez ce que vous voulez puis cliquez sur Convertir

Le sélecteur de profils affiche chaque profil avec un badge d'icône de catégorie, pour distinguer rapidement un préréglage YouTube d'un préréglage ProRes.

## Profils personnalisés

Si le catalogue intégré ne couvre pas votre cas d'usage exact, créez le vôtre :

1. Configurez vos paramètres d'encodage manuellement
2. Cliquez sur le bouton d'enregistrement dans le sélecteur de profils
3. Donnez-lui un nom et une catégorie
4. Votre profil personnalisé apparaît aux côtés des intégrés

Les profils personnalisés sont enregistrés localement et persistent entre les sessions. Vous pouvez les modifier ou les supprimer à tout moment. (Les profils intégrés sont verrouillés — vous pouvez les utiliser mais pas les modifier.)

## Dernière utilisation

EncodeX se souvient des 5 derniers profils que vous avez appliqués, pour que vos flux de travail les plus courants soient toujours à un clic. Pas besoin de parcourir les catégories quand vous utilisez toujours les mêmes préréglages.

## Prise en charge de la file d'attente par lot

Les profils fonctionnent aussi dans la File d'attente par lot. Appliquez un profil pour définir les options d'encodage pour les nouveaux travaux, ou utilisez-le comme point de départ avant de personnaliser des entrées individuelles du lot.

## Sous le capot

Chaque profil est mappé à un objet `ConversionProfile` qui stocke :

- Format de conteneur et extension de sortie
- Sélection des codecs vidéo et audio
- Paramètres de débit, CRF et qualité
- Échelle, format de pixel et FPS
- Arguments FFmpeg avancés (`extraArgs` et `inputArgs`) pour les formats professionnels

Quand vous appliquez un profil, EncodeX écrit ces valeurs dans le formulaire de conversion. Les profils avancés peuvent passer des flags FFmpeg bruts directement à l'encodeur — c'est ainsi que nous prenons en charge des choses comme la sélection de profil ProRes et la configuration des segments HLS.

Les profils sont une fonctionnalité GUI — la CLI continue d'utiliser des flags explicites (`--video-codec`, `--audio-codec`, etc.) pour une flexibilité maximale dans les scripts et les automatisations.

## À suivre

Nous continuerons à étendre le catalogue de profils en fonction des retours de la communauté. S'il y a une plateforme ou un format pour lequel vous souhaitez un profil, [ouvrez un ticket](https://github.com/Sandeepv68/EncodeX/issues) et faites-le nous savoir.

---

[Télécharger EncodeX](/download) · [Voir toutes les fonctionnalités](/features) · [Lire la documentation](/docs/features-reference)
