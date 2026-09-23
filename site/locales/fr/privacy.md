---
title: "Politique de confidentialité – EncodeX ne télécharge jamais vos fichiers"
description: "Politique de confidentialité d'EncodeX : traitement 100% hors ligne, pas de comptes, pas de suivi de vos médias, pas de collecte de données. Vos vidéos et audio ne quittent jamais votre ordinateur."
---

# Politique de confidentialité

**Version courte : vos fichiers ne quittent jamais votre ordinateur.**

EncodeX est une application de bureau qui traite tous les médias **localement et hors ligne**. Nous n'avons pas de serveurs qui reçoivent vos vidéos, pas de traitement dans le cloud, et aucune raison de voir vos fichiers.

*Dernière mise à jour : septembre 2026*

## La version courte

- **100% hors ligne** — toute conversion, compression et extraction se fait sur votre appareil
- **Pas de compte** — rien à s'inscrire, pas de profil à maintenir
- **Pas de téléchargements** — vos médias ne sont jamais transmis à nous ou à quiconque
- **Télémétrie uniquement avec consentement** — les seules données sortantes sont des événements facultatifs, anonymes et uniquement catégoriels que vous pouvez désactiver dans les Réglages
- **Open source** — n'importe qui peut inspecter exactement ce que fait l'application

## Ce que nous ne collectons pas

EncodeX ne collecte, ne transmet et ne stocke aucun de vos fichiers médias, noms de dossiers ou comportements d'utilisation. Comme l'application s'exécute entièrement sur votre ordinateur, il n'y a rien pour nous à collecter.

## Ce que nous faisons

La seule chose que nous voyons est ce que vous choisissez de nous envoyer :

- **GitHub** — lorsque vous signalez un problème, mettez une étoile au dépôt ou contribuez, GitHub collecte des données selon sa propre [politique de confidentialité](https://docs.github.com/en/site-policy/privacy-policies)
- **Notre site web (encodex.in)** — un site respectueux de la vie privée, sans cookies. Nous utilisons des analyses simples et respectueuses de la vie privée pour voir les vues de pages agrégées — jamais liées à votre identité
- **Support** — si vous nous envoyez un e-mail, nous lisons le message que vous envoyez (évidemment)

## Le site web

Le site web d'EncodeX lui-même :

- N'affiche pas de publicités
- N'utilise pas de cookies de suivi tiers
- Utilise des analyses respectueuses de la vie privée (pas de suivi inter-sites, pas de données personnelles)

## Quelle télémétrie existe

Pour être entièrement transparents, voici chaque donnée qu'EncodeX collecte — sur le site et dans l'application :

### Le site web (encodex.in)

- **Compteurs de pages vus sans cookies.** Nous mesurons des vues de page agrégées avec une configuration d'analyse respectueuse de la vie privée — pas de cookies, pas de suivi inter-sites, pas de replay de session et rien lié à votre identité. Nous ne pouvons pas voir qui vous êtes.

### L'application de bureau

- **Signalement des bogues et diagnostics avec consentement.** L'application peut envoyer des diagnostics de crash et des informations d'erreur anonymes à Sentry — et c'est **activé par défaut, avec un interrupteur visible dans les Réglages** pour le désactiver à tout moment. Tout est gouverné par un seul interrupteur de consentement (stockés localement sur votre appareil sous `monitoring-consent.json` et `analytics-consent.json`).
- **Événements d'usage uniquement par catégories.** Une fois activé, l'application enregistre des événements anonymes et uniquement catégoriels — comme « conversion démarrée » ou « profil appliqué » — via un canal d'analyse d'usage dédié. Par conception de la taxonomie, ces données **ne contiennent aucun contenu média, aucun nom de fichier, aucun chemin de dossier et aucune taille de fichier.** Si vous désactivez la télémétrie, rien ne quitte votre ordinateur.
- **Aucun téléversement, aucun traitement dans le cloud.** Même avec la télémétrie activée, vos fichiers média réels ne sont jamais transmis. L'encodage, la conversion, la compression ou l'extraction se font entièrement sur votre appareil.

### En clair

- Il n'y a **pas de compte** — rien à créer, aucun profil à maintenir
- Vos fichiers **ne quittent jamais votre ordinateur** — aucun téléversement, aucun traitement dans le cloud
- L'application fonctionne **entièrement hors ligne** — la télémétrie est la seule chose qui peut se connecter, elle exige un consentement, est uniquement catégorielle et peut être désactivée

## Comment ça marche

Il n'y a pas de cloud où envoyer vos fichiers. EncodeX intègre le moteur FFmpeg directement dans l'application et exécute chaque conversion **en tant que processus sur votre appareil** — de la même manière que votre navigateur web affiche une page sans qu'elle soit « envoyée à un serveur. » Si vous souhaitez le vérifier, l'ensemble de l'application (y compris son pipeline de traitement multimédia) est open source et documenté dans l'[architecture technique](/fr/docs/architecture).

## Mises à jour

Si nous changeons jamais la façon dont EncodeX gère les données, nous mettrons à jour cette page et indiquerons clairement la date du changement ci-dessus. Comme l'application est open source, vous pouvez également examiner chaque changement dans le dépôt.

## Questions

Des préoccupations concernant la confidentialité ? Ouvrez un ticket sur [GitHub](https://github.com/Sandeepv68/EncodeX) ou contactez-nous via le site web.

## Commencez

- [Téléchargez EncodeX gratuitement](/fr/download)
- [Voir toutes les conversions et fonctionnalités](/fr/features)
- [Aperçu de l'interface FFmpeg](/fr/ffmpeg-gui)
