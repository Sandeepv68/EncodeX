---
title: "Comment Compresser les Enregistrements OBS et ShadowPlay pour les Partager"
description: "Réduisez les grandes vidéos de gameplay enregistrées avec OBS ou ShadowPlay à des tailles faciles à mettre en ligne grâce à EncodeX — une interface FFmpeg gratuite avec accélération GPU."
date: 2026-09-14
tags:
  - guide
  - gaming
  - compression
  - obs
---

# Comment Compresser les Enregistrements OBS et ShadowPlay pour les Partager

L'enregistrement de gameplay en 1080p 60fps produit des fichiers énormes. Une session de dix minutes peut facilement atteindre 5–10 Go, et les sessions plus longues peuvent dépasser 50 Go. Ces fichiers sont parfaits pour le montage — ils sont capturés en haute qualité avec une compression minimale — mais ils sont beaucoup trop lourds pour être mis en ligne sur Discord, intégrés dans un stream, envoyés à des amis ou publiés sur les réseaux sociaux.

La solution est un second encodage : reprendre l'original en haute qualité, le compresser à un débit binaire raisonnable et produire un fichier qui ne pèse qu'une fraction du poids initial tout en paraissant presque identique à l'écran.

## Pourquoi les Enregistrements de Gameplay Sont-Ils Si Lourds ?

OBS et ShadowPlay capturent à des débits binaires élevés par défaut — souvent de 20 000 à 50 000 kbps. Cela préserve chaque détail pour le montage, mais la plupart des spectateurs ne verront jamais la différence entre un enregistrement à 50 Mbps et un encodage à 10 Mbps sur un écran de téléphone ou d'ordinateur portable. Le point clé : votre fichier source est conçu pour le montage, pas pour la visualisation. Le comprimer pour la visualisation produit un fichier qui semble identique pour votre public, mais pèse nettement moins lourd.

## Le Point Idéal de Compression pour le Gameplay

Pour du gameplay destiné à YouTube, Discord ou aux réseaux sociaux :

- **Codec :** H.264 (le plus compatible) ou H.265 (fichiers plus petits)
- **Résolution :** conservez la résolution native si elle est en 1080p ou moins ; réduisez la 4K en 1080p pour la plupart des plateformes
- **Débit binaire :** 5 000–10 000 kbps en 1080p 60fps est le point idéal — assez élevé pour préserver l'action rapide, assez bas pour réduire considérablement le fichier
- **Mode CRF :** CRF 20–23 offre un bon équilibre entre qualité et taille, sans avoir à choisir un débit binaire manuellement

Un enregistrement de gameplay de dix minutes en 1080p 60fps capturé à 30 Mbps pèse environ 2,2 Go. Réencodé à CRF 22, il ressort à environ 300–500 Mo — une réduction de 75 à 85 % — tout en paraissant quasiment identique sur YouTube ou sur un écran de téléphone.

## Comment Compresser du Gameplay avec EncodeX

1. [Téléchargez EncodeX](/fr/download) et ouvrez-le.
2. Glissez votre enregistrement OBS ou ShadowPlay dans la fenêtre.
3. Choisissez un profil : le profil **[MP4 Maximum Compatibility](/fr/video-compressor)** convient bien à la plupart des situations de partage, ou optez pour un profil plus petit pour Discord et le chat.
4. Cliquez sur **Compresser**.

EncodeX utilise votre GPU (NVENC sur NVIDIA, AMF sur AMD, QSV sur Intel) pour compresser le fichier rapidement. Un enregistrement de dix minutes se code typiquement en moins de deux minutes — plus vite qu'en temps réel.

## Compresser Plusieurs Clips

Si vous avez enregistré une longue session et souhaitez extraire et compresser des clips précis, l'outil **Video Cut** vous permet de rogner sur une période donnée avant de compresser. Cela évite de gaspiller de l'espace sur les parties dont vous n'avez pas besoin.

Pour la compression en masse — traiter tout un dossier d'enregistrements — la [file d'attente par lots](/fr/features) traite plusieurs fichiers à la suite avec les mêmes réglages.

## Extraire l'Audio pour les Podcasts ou les Moments Forts

Parfois, vous voulez uniquement l'audio d'un clip de gameplay — pour un extrait de podcast, une voix off ou une bande de moments forts. L'[outil d'extraction audio](/fr/extract-audio-from-video) extrait la piste audio et la produit en MP3 ou AAC en une seule étape :

1. Glissez l'enregistrement dans l'outil d'extraction audio.
2. Choisissez MP3 ou AAC.
3. Cliquez sur **Extraire**.

L'audio ressort au débit binaire de votre choix (192k par défaut), prêt à être monté ou partagé.

## Pourquoi Choisir EncodeX Plutôt que HandBrake

HandBrake est un transcodeur vidéo bien connu, et il fait parfaitement le travail pour la compression. Mais EncodeX offre quelques atouts que HandBrake n'a pas :

- **La détection du GPU est automatique** — aucun réglage d'encodeur à configurer
- **Le flux de travail est plus rapide** — glissez le fichier, choisissez le profil, compressez. Pas de navigation par onglets ni de réglages avancés.
- **L'aperçu de compression affiche la taille de sortie estimée** avant de commencer
- **La file d'attente par lots est intégrée** — pas de mode par lots séparé à configurer
- **C'est multiplateforme** — Windows, macOS et Linux avec la même interface

Pour la comparaison détaillée, voir [EncodeX vs HandBrake](/fr/handbrake-alternative).

---

*Téléchargez EncodeX gratuitement sur [encodex.in/download](/fr/download) et commencez à compresser vos enregistrements de gameplay dès aujourd'hui.*