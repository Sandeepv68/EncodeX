---
title: "Comment convertir une vidéo pour WhatsApp : envoyez une image nette, pas écrasée"
description: "WhatsApp compresse tout ce que vous envoyez — sauf si vous prenez les devants. Comment choisir une taille et un codec qui restent nets sur les téléphones, avec un workflow simple et hors ligne via EncodeX."
date: 2026-09-19
tags:
  - guide
  - whatsapp
  - how-to
---

# Comment convertir une vidéo pour WhatsApp : envoyez une image nette, pas écrasée

Si un ami vous envoie une vidéo dans un chat de groupe et qu'elle ressemble à une patate, deux choses se sont produites : elle était trop grosse, donc WhatsApp l'a compressée durement — et personne ne l'avait préparée pour l'écran d'un téléphone au départ. La solution n'est pas l'inverse (envoyer un fichier géant non compressé ; WhatsApp gagne de toute façon cette bataille). C'est de convertir le fichier *vers* les attentes de WhatsApp avant d'appuyer sur envoyer.

## La réponse courte

**Envoyez un MP4 (H.264) déjà à la taille d'un téléphone** — 720p ou 1080p, environ 2 à 8 Mbps, de quelques dizaines à quelques centaines de Mo selon la durée. WhatsApp n'aura alors presque rien à écraser, et les destinataires verront la qualité réelle que vous aviez en tête.

## Comment WhatsApp gère les vidéos

WhatsApp est un *messenger qui passe les fichiers au tamis en chemin* :

- L'application **réencode** tout ce qu'elle juge trop gros ou non standard.
- C'est une application mobile, donc elle optimise pour les **écrans et connexions mobiles** — des écrans et connexions mobiles qui sont souvent médiocres.
- Le réencodage favorise fortement le H.264/MP4, et il réduit agressivement la taille quand la source est surdimensionnée ou à haut débit.

Règle empirique : **si votre fichier est « trop beau » pour un téléphone, WhatsApp décide de la qualité pour vous.** Si votre fichier a déjà la forme d'un téléphone, WhatsApp le laisse pour la plupart tranquille.

## Des cibles de taille qui fonctionnent vraiment

Par minute, visez ces tailles approximatives (ce sont des repères, pas des règles) :

| Vidéo | Taille cible | Ce que voit le destinataire |
|-------|--------------|-----------------------------|
| Clip de 1 min, 1080p | ~30-80 Mo | Net, précis, instantané |
| Clip de 1 min, 720p | ~15-40 Mo | Parfaitement bon sur un téléphone |
| Vidéo de 15 min (école/concert) | ~150-400 Mo (1080p) | Envoyable sans détruire la qualité |
| Diaporama/talking-head | Descendez à 360-720p | Totalement suffisant, minuscule |

Le format est la constante : **MP4, H.264, AAC stéréo.** C'est la seule chose à laquelle WhatsApp fait confiance pour passer proprement.

## Le workflow pas à pas avec EncodeX

Entièrement hors ligne, avec le [EncodeX gratuit](/fr/download) :

1. **Glissez** votre vidéo dans la fenêtre EncodeX.
2. **Choisissez la carte d'objectif « WhatsApp »** dans les [cartes d'objectifs](/fr/ "Visitez la page d'accueil EncodeX") — elle correspond à un MP4/H.264 à la taille d'un téléphone — ou choisissez **« fichier plus petit »** pour viser une taille finale précise. Les deux se trouvent dans le [compresseur vidéo](/fr/video-compressor).
3. **Convertissez.** Passez à 720p si la source est en 4K ou à très haut débit — l'écran du téléphone ne peut pas afficher plus, et le fichier plus petit voyage mieux.
4. **Envoyez le MP4 obtenu.** Et voilà — un seul fichier, pas de boue générée par la compression.

### Choisir entre « WhatsApp » et « fichier plus petit »

- Conservez le **1080p** si la vidéo est courte et que vous voulez un maximum de netteté.
- Utilisez **l'objectif « fichier plus petit »** (qui peut viser une taille de votre choix) pour les vidéos longues, les connexions lentes, ou quand le clip n'est vraiment que pour un coup d'œil rapide.
- Quand la source est en **4K**, descendez d'abord en **1080p** — vous économisez énormément de taille sans perte visible sur les écrans de téléphone.

## Rendre les chats de groupe moins pénibles

Quelques gains supplémentaires au niveau des habitudes :

- **Réduisez le débit, pas la résolution.** Du 1080p à un débit modeste bat du 480p à n'importe quel débit pour la plupart des contenus. Gardez la résolution, domptez le débit.
- **Coupez les passages ennuyeux** avant d'envoyer. Les vidéos plus longues forcent plus de compression ; un clip bien recadré et ajusté est le gain de qualité le plus facile.
- **Oubliez le filigrane des autres outils.** Les applications de conversion apposent généralement une marque sur la sortie ; pas EncodeX.
- **Une seule piste audio.** Personne n'a besoin de cinq pistes audio sur une vidéo de concert envoyée à un groupe familial.

## Pourquoi « je vais juste envoyer le fichier énorme » se retourne contre vous

Un réflexe courant consiste à contourner la compression en envoyant un original massif — « ils pourront le convertir eux-mêmes. » Cela échoue pour trois raisons :

1. **WhatsApp le réencodera de toute façon** — une taille au-dessus de son seuil signifie simplement un écrasement plus agressif, et beaucoup de destinataires reçoivent un envoi dégradé.
2. Cela **engorge le chat et les forfaits data** pour tout le monde.
3. Cela **peut échouer complètement à l'envoi** sur des connexions lentes.

Envoyer un MP4 pré-dimensionné et prêt pour le téléphone est la seule manœuvre qui respecte à la fois votre contenu et les personnes qui le reçoivent.

## Guides connexes

Ceci fait partie d'une série aux côtés des guides [cadre des formats](/fr/blog/posts/what-is-the-best-video-format), [YouTube](/fr/blog/posts/how-to-convert-video-for-youtube) et [Instagram](/fr/blog/posts/how-to-convert-video-for-instagram). Si ce que vous envoyez existe sous plusieurs formes (message, story, publication), cette série vous permet de tout régler en une seule séance.

## FAQ

### Quel est le meilleur format vidéo à envoyer sur WhatsApp ?

MP4 avec H.264 — c'est le format que WhatsApp préfère et vers lequel il réencode, donc une source déjà en MP4/H.264 survit au voyage avec un minimum de manipulations. Les fichiers MKV, AVI ou MOV passent par plus de traitements avant la livraison.

### WhatsApp dit que ma vidéo ne peut pas être envoyée. Pourquoi ?

C'est généralement une question de limites de taille ou de durée, ou d'un conteneur non pris en charge. Mettez-la sous environ 700 Mo, gardez le MP4 et divisez les longs enregistrements en clips séparés — elle partira.

### WhatsApp réduit-il la qualité tout seul ?

Oui — WhatsApp réencode les vidéos qui dépassent ses seuils, et le réglage par défaut de la qualité photo/vidéo de nombreux appareils est orienté vers la compression. Un fichier pré-converti et à la taille d'un téléphone laisse peu de place à ces dégâts.

### Devrais-je réduire les vidéos familiales même si elles sont courtes ?

Oui. Un clip de 60 secondes de 200 Mo est signalé pour compression dès l'envoi ; un clip de 60 secondes de 40 Mo déjà optimisé pour le téléphone atterrit dans le chat exactement comme ce que vous avez filmé.

---

**Faites-le avec EncodeX → Téléchargez.** Envoyez des vidéos nettes et bien dimensionnées sur WhatsApp — gratuit, open source, entièrement hors ligne, sans filigrane. [Téléchargez EncodeX](/fr/download).