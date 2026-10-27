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
- **Télémétrie que vous pouvez désactiver** — la remontée d'erreurs et les statistiques d'usage anonymes, de type catégoriel, sont activées par défaut, et un seul interrupteur dans les Réglages désactive les deux. Les vérifications de mise à jour et les fournisseurs IA configurés envoient aussi des requêtes réseau (voir plus bas)
- **Open source** — n'importe qui peut inspecter exactement ce que fait l'application

## Ce que nous ne collectons pas

EncodeX ne collecte, ne transmet et ne stocke aucun de vos fichiers médias, noms de dossiers ou autre élément permettant de vous identifier. La conversion se fait sur votre ordinateur. L'application envoie par défaut des rapports d'erreur et des événements d'usage anonymes, et peut aussi effectuer les requêtes sortantes listées plus bas. Vous pouvez désactiver la remontée d'erreurs et les statistiques d'usage dans les Réglages.

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

- **Remontée d'erreurs.** L'application peut envoyer des diagnostics de crash et d'erreur à Sentry. Elle est **activée par défaut, avec un interrupteur dans les Réglages** pour la désactiver à tout moment. Un seul interrupteur, _Données d'usage et remontée d'erreurs_ dans les Réglages, contrôle la remontée d'erreurs et les statistiques d'usage. Le choix est enregistré localement dans `monitoring-consent.json` et `analytics-consent.json`.
- **Statistiques d'usage uniquement catégorielles.** Une fois activée, l'application enregistre des événements anonymes et uniquement catégoriels, regroupés par domaine fonctionnel (par exemple navigation, conversion, file d'attente ou mises à jour), via un canal d'analyse d'usage. Par conception, ces données ne contiennent **aucun contenu média, aucun nom de fichier et aucun chemin de dossier.** Si vous désactivez l'interrupteur, ces événements ne sont pas envoyés.
- **Aucun téléversement, aucun traitement dans le cloud.** Même avec la télémétrie activée, vos fichiers ne sont jamais transmis. La conversion, la compression et l'extraction se font sur votre appareil.

### Autres requêtes réseau

- **Vérification des mises à jour** — lorsque vous vérifiez les mises à jour, l'application interroge GitHub Releases.
- **Fournisseurs IA** — Copilot et les fonctions IA utilisent par défaut le moteur de règles intégré, qui fonctionne hors ligne. Les requêtes ne partent vers OpenAI, Anthropic ou Gemini que si vous configurez l'un de ces fournisseurs. Le fournisseur local fonctionne sur votre machine.

### En clair

- Il n'y a **pas de compte** — rien à créer, aucun profil à maintenir
- Vos fichiers **ne quittent jamais votre ordinateur** — aucun téléversement, aucun traitement dans le cloud
- La conversion fonctionne **entièrement hors ligne**. La remontée d'erreurs, les statistiques d'usage, les vérifications de mise à jour et les fournisseurs IA configurés sont les seules activités réseau, et vous contrôlez la première et la dernière de ces activités

## Comment ça marche

Il n'y a pas de cloud où envoyer vos fichiers. EncodeX embarque le moteur FFmpeg avec l'application et exécute chaque conversion dans un **processus enfant local sur votre appareil**, de sorte que les médias sont lus et écrits sur votre ordinateur. Si vous souhaitez le vérifier, l'ensemble de l'application (y compris son pipeline de traitement multimédia) est open source et documenté dans l'[architecture technique](/fr/docs/architecture).

## Mises à jour

Si nous changeons jamais la façon dont EncodeX gère les données, nous mettrons à jour cette page et indiquerons clairement la date du changement ci-dessus. Comme l'application est open source, vous pouvez également examiner chaque changement dans le dépôt.

## Questions

Des préoccupations concernant la confidentialité ? Ouvrez un ticket sur [GitHub](https://github.com/Sandeepv68/EncodeX) ou contactez-nous via le site web.

## Commencez

- [Téléchargez EncodeX gratuitement](/fr/download)
- [Voir toutes les conversions et fonctionnalités](/fr/features)
- [Aperçu de l'interface FFmpeg](/fr/ffmpeg-gui)
