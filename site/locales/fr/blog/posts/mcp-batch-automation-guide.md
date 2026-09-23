---
title: "Automatisation par Lots avec MCP : Mettez en File des Dizaines de Tâches en un Seul Prompt"
description: "Utilisez le serveur MCP d'EncodeX pour mettre en file un dossier entier de vidéos en un seul prompt — tâches asynchrones, suivi de progression et résultats structurés via batch_convert, list_jobs et get_job."
date: 2026-09-22
tags:
  - guide
  - mcp
  - automation
  - batch
  - ai
---

# Automatisation par Lots avec MCP : Mettez en File des Dizaines de Tâches en un Seul Prompt

Le serveur MCP d'EncodeX ne sert pas qu'aux conversions individuelles. Comme chaque tâche s'exécute de façon asynchrone et expose des outils de suivi, vous pouvez confier tout un dossier multimédia à un assistant IA et le voir mis en file, traité et rapporté — sans ouvrir l'application ni écrire une seule commande à la main.

Ce guide présente le flux par lots : l'outil `batch_convert`, le modèle de tâches asynchrones et comment les outils d'état vous tiennent informé pendant que FFmpeg travaille.

## Le Modèle de Tâches Asynchrones

Quand EncodeX démarre une conversion via MCP, il n'attend pas. Il renvoie immédiatement un **identifiant de tâche** et celle-ci s'exécute en arrière-plan. Vous (ou l'assistant) interrogez ensuite :

- `get_job` — état, progression et résultat d'une tâche
- `list_jobs` — toutes les tâches de la session en cours
- `cancel_job` — arrêter une tâche en cours

C'est ce qui rend un lot d'une douzaine de fichiers instantané au niveau du prompt : le travail est mis en file en un appel et EncodeX progresse à travers.

## Mettre en File un Dossier Entier

Le plus rapide est `batch_convert`. Donnez à l'assistant un dossier et une destination, par exemple :

> Convertissez tous les fichiers MKV de `~/Downloads` en MP4 et mettez-les dans `~/Output`.

L'assistant parcourt le dossier, appelle `batch_convert` et démarre la file. Pas besoin de gérer les tâches une par une.

Vous voulez un lot plus précis ? Nommez le filtre :

> Prenez toutes les vidéos de `~/Recordings`, ré-encodez-les en H.264 dans un conteneur MP4 avec un CRF de 23 et laissez-les en place.

L'assistant choisit le bon profil avec les outils `list_profiles` et `get_profile`, puis met le lot en file.

## Mélanger les Outils dans un Seul Prompt

Comme tous les outils partagent une session, un seul prompt peut enchaîner plusieurs opérations :

> Pour chaque vidéo de `~/Source` : convertissez-la en MP4 pour mon téléphone, extrayez l'audio en MP3 et compressez le dossier de captures `~/Assets`.

C'est `batch_convert` plus `extract_audio` plus `compress_image`, tous mis en file et suivis ensemble. L'assistant coordonne et rapporte ce qui a été terminé et où.

## Vérifier la Progression

Pendant que les tâches tournent, demandez :

> Quel est l'état de mon lot ?

`list_jobs` renvoie chaque tâche avec son état et sa progression actuels. Besoin de plus de détails ?

> Où en est la conversion MKV vers MP4 ?

L'assistant interroge `get_job` pour la tâche précise et lit sa progression. Si quelque chose coince :

> Annulez la tâche qui est bloquée depuis un moment.

Cela correspond à `cancel_job` — et comme les tâches sont isolées, le reste du lot continue.

## Les 4 Modèles de Prompt

Le serveur MCP fournit aussi quatre modèles de prompt : `convert-video`, `extract-audio`, `compress-image` et `batch-convert`. Ils pré-remplissent les bons appels d'outils et la structure d'arguments, ce qui est particulièrement utile pour les agents qui veulent une façon canonique d'exécuter une opération courante. L'assistant peut invoquer le modèle puis la chaîne d'outils, donnant des résultats cohérents d'une session à l'autre.

## Questions Fréquentes

### Combien de fichiers puis-je mettre en file à la fois ?

Il n'y a pas de petite limite arbitraire — EncodeX traite la file séquentiellement avec votre matériel. Commencez avec un dossier et laissez-le travailler ; vous pouvez vérifier l'état à tout moment.

### Les tâches par lots tournent-elles en arrière-plan ?

Oui. L'interface les montre dans la File d'attente, et via MCP vous les suivez avec `get_job` et `list_jobs`. Vous pouvez continuer à demander d'autres choses pendant l'encodage.

### Puis-je annuler une seule tâche ?

Oui — `cancel_job` arrête une seule tâche. La surface HTTP intégrée ajoute aussi `cancel_all_jobs` pour toute la file. Les autres continuent indépendamment.

### Le lot fonctionne-t-il hors ligne ?

Totalement. Tout l'encodage se fait localement sur votre machine via FFmpeg — pas de téléversement, pas de cloud, et ça marche sans connexion internet.

## En Savoir Plus

- [Contrôlez EncodeX depuis Claude Desktop](/fr/blog/posts/how-to-use-claude-with-mcp)
- [Documentation du serveur MCP](/fr/docs/cli#mcp-server-mode)
- [Modèle de sécurité et de confidentialité de MCP](/fr/blog/posts/mcp-privacy-security)
- [Référence des fonctions : outils MCP](/fr/docs/features-reference#mcp-server)

---

*Téléchargez EncodeX gratuitement sur [encodex.in/download](/fr/download). Le serveur MCP et la file d'attente sont inclus dans chaque installation.*