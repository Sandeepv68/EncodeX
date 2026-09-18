---
description: "Découvrez toutes les fonctionnalités d'EncodeX : convertir des formats vidéo et audio, extraire un MP3 d'une vidéo, couper des clips, compresser des images, traiter des fichiers par lots, encoder avec accélération matérielle, et un serveur MCP intégré pour les assistants IA."
---

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

## Choisissez un profil et c'est parti

Pas envie de bricoler les paramètres ? EncodeX propose plus de 140 profils de conversion prêts à l'emploi, chacun soigneusement réglé pour un usage précis. Exporter une vidéo pour YouTube en 1080p ? Il y a un profil pour ça. Un Reel Instagram au bon format ? À un clic. Du ProRes pour un montage vidéo ? C'est fait.

Les profils sont organisés en 8 catégories : Web et Réseaux sociaux (YouTube, Instagram, TikTok, Facebook, X), Appareils (Apple, Android, consoles de jeux), Codecs vidéo, Professionnel (ProRes, DNxHD/HR), Streaming (HLS, DASH), Audio, Images et Avancé. Sélectionnez-en un et tous les bons paramètres se remplissent automatiquement — codec, débit, qualité, résolution et plus. Après application, vous pouvez toujours modifier ce que vous souhaitez.

Si vous utilisez les mêmes paramètres en boucle, enregistrez-les comme profil personnalisé. Vous pouvez créer, modifier et supprimer des profils, et EncodeX se souvient des 5 derniers utilisés pour un accès rapide.

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

## Faire pivoter les vidéos et corriger les clips de travers

<img src="/images/convert.webp" alt="Rotation et miroir" width="1600" height="1057" loading="lazy">

Vous avez filmé une vidéo avec le téléphone tenu de travers ? EncodeX fait pivoter n'importe quelle vidéo ou photo de 90°, 180° ou 270° dans le sens horaire et la retourne horizontalement ou verticalement — clips de travers, selfies inversés ou vidéo verticale à passer en paysage se règlent en un clic.

Gardez le format MP4, MOV ou MKV et la rotation est enregistrée comme métadonnées sans perte — pas de ré-encodage, pas de perte de qualité. Pour tout autre format (ou un retournement), la vidéo est ré-encodée, et tout fonctionne aussi dans la file d'attente.

## Convertir plusieurs fichiers à la fois

<img src="/images/batch_process.webp" alt="File d'attente par lots" width="1600" height="1360" loading="lazy">

Cinquante vidéos ? Ne les convertissez pas une par une. Glissez-les toutes dans la file et EncodeX s'en occupe automatiquement, avec la progression de chaque fichier visible.

- Ajoutez des fichiers pendant qu'il travaille
- Mettez en pause, reprenez ou annulez quand vous voulez
- Réorganisez la liste en glissant
- Il prévient quand c'est fini — ou éteint l'ordinateur automatiquement

## Laissez un assistant IA piloter

EncodeX inclut un **serveur MCP** intégré — la norme ouverte [Model Context Protocol](https://modelcontextprotocol.io) qui permet aux assistants IA d'utiliser vos applications. Connectez Claude Desktop, Claude Code, Cursor, VS Code ou n'importe quel client compatible MCP, puis demandez simplement en langage courant : convertir un fichier, extraire un son, compresser un dossier de photos ou vérifier une tâche de lot.

Il existe deux façons de se connecter :

- **Serveur stdio autonome** — lancez `encodex --mcp` (ou `node dist/mcp/index.js`). Idéal pour les applications IA de bureau qui démarrent un serveur à la demande.
- **Serveur localhost intégré** — activez-le dans **Réglages → Serveur MCP** pendant que l'interface graphique tourne, puis pointez vos clients vers `http://127.0.0.1:8765/mcp`. Ce mode ajoute des outils de file d'attente en direct, d'aperçu, de timeline, de système et de mises à jour, en plus du même cœur.

Sur les deux modes, le serveur expose **19 outils**, **3 ressources** (profils, capacités, codecs) et **4 modèles de prompts** (convertir une vidéo, extraire un son, compresser une image, convertir par lots). Les conversions s'exécutent de façon asynchrone, de sorte qu'un assistant peut lancer une tâche longue et en revérifier l'avancement plus tard.

### Privé et sûr par conception

- Le serveur intégré écoute uniquement sur `127.0.0.1` — il n'est jamais accessible depuis d'autres ordinateurs.
- Les requêtes cross-origin sont rejetées sauf si elles proviennent de l'application locale.
- Un jeton d'accès facultatif peut exiger que chaque requête soit authentifiée.
- Vos médias ne sont jamais téléversés nulle part ; tout s'exécute toujours sur votre propre machine.

[Lire la documentation du serveur MCP →](/fr/docs/cli#mcp-server-mode)

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
