---
date: 2026-09-17
title: "Pivoter et retourner des vidéos — corrigez les clips de travers sans perte de qualité"
description: "EncodeX sait désormais faire pivoter vidéos et photos de 90°, 180° ou 270° dans le sens horaire et les retourner horizontalement ou verticalement. Pour MP4/MOV/MKV, la rotation est enregistrée comme métadonnées sans perte — sans ré-encodage."
tags:
  - feature
  - rotation
  - release
---

# Pivoter et retourner des vidéos

Vous avez filmé une vidéo avec le téléphone tenu de travers ? Cela nous arrive à tous. Dès aujourd'hui, EncodeX peut corriger ça : **Rotation et miroir** fait pivoter vidéos et photos de **90°, 180° ou 270° dans le sens horaire** et les retourne **horizontalement ou verticalement** — directement depuis la page Convertir et la file d'attente par lots.

## Un clic, et c'est corrigé

Corriger un clip de travers ne prend que quelques secondes :

1. Ouvrez la page **Convertir** (ou ajoutez des fichiers à la **file d'attente par lots**)
2. Choisissez n'importe quelle vidéo ou image comme source
3. Dans la zone de réglages, sélectionnez un angle dans le menu déroulant **Rotation** — `90°`, `180°` ou `270°` dans le sens horaire — et retournez avec les interrupteurs **Retourner horizontalement** / **Retourner verticalement**
4. Convertissez

C'est tout. Le résultat sort exactement dans l'orientation souhaitée. Cela fonctionne avec les vidéos **et les images**, dans les conversions individuelles comme dans les tâches groupées (les opérations de transcodage et de compression d'images le prennent en charge).

## Deux façons de procéder

La rotation s'applique selon l'un de deux mécanismes, en fonction de votre sortie :

### Rotation par métadonnées sans perte (sans ré-encodage)

Lorsque votre sortie est **MP4, MOV ou MKV** et que vous utilisez le mode **copie de flux (copie sans perte)** avec un angle de rotation et sans miroir, EncodeX enregistre la rotation comme métadonnées d'affichage standard (`rotate=`). Le lecteur pivote la vidéo à la lecture — **la qualité reste intacte** et l'opération se termine en quelques secondes, car rien n'est ré-encodé. Le retournement n'emprunte pas ce chemin : inverser l'image change toujours les pixels, donc cela ré-encode systématiquement.

Si votre conteneur le prend en charge, la page Convertir affiche une note utile expliquant que la rotation s'applique sans perte. Si votre conteneur de sortie *ne le prend pas* en charge (WebM, FLV, GIF et sorties d'images, par exemple), un avertissement apparaît avec l'action **Désactiver la copie sans perte**, qui bascule vers le ré-encodage en un clic.

### Rotation par pixels (ré-encodage)

Pour tout autre format — ou dès que vous retournez la vidéo — EncodeX ré-encode les images avec une chaîne de filtres FFmpeg (`transpose` + `hflip`/`vflip`) qui se combine proprement avec le filtre `scale` existant. La rotation ayant lieu par pas de 90°, il n'y a aucune interpolation : le résultat reste net.

## Intégrée à la file d'attente par lots

La rotation et le retournement ne se limitent pas aux conversions individuelles. Ils font aussi partie de la **file d'attente par lots** : configurez-les sur le panneau du lot pour les appliquer à tout le lot, ou modifiez une tâche individuelle dans sa boîte de dialogue d'options. Les tâches par lots ré-encodent toujours, donc rotation et retournement deviennent simplement une partie des options de la tâche, aux côtés du codec, du débit et de l'échelle.

## Sous le capot

- La rotation utilise le filtre `transpose` de FFmpeg : `transpose=1` pour 90°, `transpose=2,transpose=2` pour 180° et `transpose=2` pour 270° (avec retournement lorsque vous ajoutez des flips).
- Quand `scale` est aussi défini, tout est combiné dans un seul argument `-vf` (d'abord l'échelle, puis la rotation), pour une chaîne efficace.
- En mode copie de flux avec un conteneur compatible, l'option `-metadata:s:v rotate=<deg>` est écrite à côté de `-c copy` — sans décodage, sans ré-encodage, sans perte de qualité.
- La file d'attente et le panneau de compression d'images exposent les mêmes contrôles, et les tâches `compress_image` font pivoter les images de la même façon.

## La suite

Des présélections de rotation dans les profils de conversion constituent l'étape suivante logique, avec des options comme les angles arbitraires. Si vous aimeriez voir un flux de travail de rotation ou de retournement, [ouvrez une issue](https://github.com/Sandeepv68/EncodeX/issues) et parlez-nous-en.

---

[Télécharger EncodeX](/download) · [Voir toutes les fonctions](/features) · [Lire la documentation](/docs/features-reference)