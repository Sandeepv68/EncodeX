# Que peut faire EncodeX ?

EncodeX est une application gratuite pour votre ordinateur qui résout les problèmes de fichiers courants en quelques clics :

- **Changer le format d'une vidéo** pour qu'elle se lise sur n'importe quel appareil
- **Extraire le son d'une vidéo** et l'enregistrer en MP3
- **Couper une vidéo** pour ne garder que l'essentiel
- **Alléger vos photos** pour les envoyer et les téléverser facilement

Il fonctionne sur Windows, Mac et Linux, est entièrement gratuit et parle plus de 35 langues.

---

## Changer le format des vidéos et des audios

<img src="/images/convert.webp" alt="Conversion multimédia" width="1600" height="1057" loading="lazy">

**Le problème :** on vous a envoyé une vidéo, mais votre téléphone, TV ou logiciel de montage refuse de l'ouvrir.

**La solution :** glissez le fichier dans EncodeX, choisissez où vous voulez le lire (ou choisissez simplement MP4, la valeur sûre) et cliquez sur Convertir. C'est tout.

Vous pouvez convertir entre pratiquement tous les formats vidéo et audio existants : MP4, MKV, AVI, MOV, WebM, MP3, WAV, FLAC et des dizaines d'autres. Si vous ne savez pas quoi choisir, les réglages par défaut sont un excellent point de départ.

## Extraire uniquement le son d'une vidéo

<img src="/images/extract_audio.webp" alt="Extraction audio" width="1600" height="1054" loading="lazy">

Un cours, un podcast, une interview ou un concert filmé — et vous ne voulez que le son ? Glissez la vidéo, choisissez MP3 (ou un autre format audio) et récupérez un fichier musical à écouter partout.

Si une vidéo contient plusieurs pistes audio (plusieurs langues, par exemple), vous pouvez choisir laquelle garder.

## Couper des vidéos

<img src="/images/cut_video.webp" alt="Découpe vidéo" width="1600" height="1267" loading="lazy">

Supprimez les passages ennuyeux. EncodeX affiche la vidéo avec une timeline dessous : déplacez deux curseurs pour marquer début et fin du passage voulu, vérifiez l'aperçu et enregistrez.

Vous pouvez zoomer sur la timeline pour être précis à la fraction de seconde près, avec miniatures et ondes sonores pour trouver le moment exact.

## Alléger vos photos

<img src="/images/image_compress.webp" alt="Compression d'images" width="1600" height="1060" loading="lazy">

Les photos en haute qualité sont formidables... jusqu'à ce qu'il faille les envoyer. EncodeX les réduit pour qu'elles pèsent moins et se téléversent plus vite, avec un aperçu en direct avant d'enregistrer.

Formats courants pris en charge : JPG, PNG, WebP, GIF, BMP, TIFF et plus. Vous pouvez aussi consulter les informations cachées de chaque photo (réglages appareil, date, etc.).

## Convertir plusieurs fichiers à la fois

<img src="/images/batch_process.webp" alt="File d'attente par lots" width="1600" height="1360" loading="lazy">

Cinquante vidéos ? Ne les convertissez pas une par une. Glissez-les toutes dans la file et EncodeX s'en occupe automatiquement, avec la progression de chaque fichier visible.

- Ajoutez des fichiers pendant qu'il travaille
- Mettez en pause, reprenez ou annulez quand vous voulez
- Réorganisez la liste en glissant
- Il prévient quand c'est fini — ou éteint l'ordinateur automatiquement

## Espionner l'intérieur d'un fichier

<img src="/images/media_info.webp" alt="Infos média" width="1600" height="1058" loading="lazy">

Curieux de savoir ce que contient un fichier ? EncodeX vous le dit en termes clairs : durée, résolution (1080p, par exemple), taille, images par seconde, canaux audio et plus. Pratique quand un fichier refuse de se lire et que vous cherchez pourquoi.

## De la vitesse sans effort

Sur la plupart des ordinateurs récents, EncodeX utilise automatiquement la puce graphique (celle des jeux vidéo) pour convertir bien plus vite. Aucun réglage : il détecte ce que votre machine possède et en profite.

## À votre image

- **Mode clair ou sombre** — il suit votre système ou se change manuellement
- **Plus de 35 langues** — français, espagnol, hindi, chinois, japonais, arabe et hébreu (avec interface de droite à gauche)
- **Raccourcis clavier** — pour ceux qui préfèrent éviter la souris
- **Toujours à jour** — EncodeX signale les nouvelles versions et les installe pour vous

## Privé dès la conception

Tout se passe sur votre propre ordinateur : vos fichiers n'en sortent jamais. Pas de compte, pas de téléversement, pas de traçage.

---

## Pour les curieux : sous le capot

EncodeX fonctionne grâce à [FFmpeg](https://ffmpeg.org), le moteur éprouvé derrière de nombreuses applis connues, habillé d'une interface conviviale. Pour les détails techniques :

- Accélération matérielle via NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox et Media Foundation
- Interface en ligne de commande pour l'automatisation
- Copie de flux sans perte pour changer de conteneur sans réencoder

Les développeurs trouveront la [documentation technique](/fr/docs/architecture) et le code source sur [GitHub](https://github.com/Sandeepv68/EncodeX).
