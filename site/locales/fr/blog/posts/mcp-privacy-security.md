---
title: "Confidentialité et Sécurité de MCP : Pourquoi EncodeX Garde Votre Multimédia Local"
description: "Le serveur MCP d'EncodeX s'exécute entièrement sur votre machine — liaison loopback, validation de l'Origin, jeton d'accès optionnel et conception hors ligne. Pas de téléversement, pas de cloud, pas de compte."
date: 2026-09-24
tags:
  - guide
  - mcp
  - security
  - privacy
  - ai
---

# Confidentialité et Sécurité de MCP : Pourquoi EncodeX Garde Votre Multimédia Local

Laisser un assistant IA contrôler vos fichiers multimédia pose une question évidente : qu'advient-il de mes fichiers ? Avec le serveur MCP d'EncodeX, la réponse est simple — tout s'exécute sur votre propre ordinateur. L'assistant donne des instructions ; le moteur FFmpeg intégré d'EncodeX fait le travail localement. Les fichiers ne quittent jamais votre appareil, et le serveur est durci avec une liaison loopback, la validation de l'Origin et un jeton d'accès optionnel.

Cette publication détaille le modèle de sécurité pour que vous sachiez exactement ce qui est protégé.

## Hors Ligne par Conception

La garantie principale est la plus simple : **pas de téléversement, pas de cloud, pas de compte**. EncodeX est une application locale et le serveur MCP est un processus local. Il n'y a pas de cloud EncodeX vers lequel envoyer des fichiers — conversion, extraction, compression et découpage se font tous sur votre matériel. Si votre machine est hors ligne, MCP fonctionne quand même.

Cela fait d'EncodeX une option de serveur MCP véritablement *local*. Votre multimédia ne devient jamais des données d'entraînement de quelqu'un d'autre ni une facture de stockage.

## Serveur Autonome : Un Simple Processus

En mode par défaut (`encodex --mcp`), EncodeX s'exécute comme un processus stdio sans interface qui parle JSON-RPC. Il ne se lie à rien sur le réseau — stdout porte les messages de protocole, stderr porte les journaux, et le processus reste vivant jusqu'à la fermeture de stdin. Il n'y a aucun port à l'écoute, donc aucune surface qu'un attaquant distant pourrait atteindre.

## Serveur Intégré : Loopback + Contrôle de l'Origin

Le serveur HTTP intégré optionnel (Paramètres → Serveur MCP) est la seule surface réseau, et il est prudent sur qui il écoute :

- **Loopback uniquement** — il se lie à `127.0.0.1`, donc seul le logiciel de votre propre machine peut l'atteindre.
- **Validation de l'Origin** — les requêtes entrantes doivent porter un en-tête `Origin` acceptable (vos clients locaux), et il n'accepte que `GET`, `POST` et `DELETE` sur `/mcp`.
- **Sessions confinées à l'application** — toutes les sessions sont forcées de se fermer quand le serveur s'arrête ou quand EncodeX quitte.

L'idée : le point d'accès existe pour vos applications IA locales, pas pour quoi que ce soit d'autre sur le réseau.

## Jeton d'Accès Optionnel

Pour une couche supplémentaire, vous pouvez définir un **jeton d'accès** dans Paramètres → Serveur MCP. Le serveur intégré exige alors un jeton bearer, et il compare les jetons en **temps constant** — évitant le classique canal latéral de temporisation utilisé pour deviner les secrets caractère par caractère.

Comme c'est optionnel, vous contrôlez le compromis : pas de jeton pour la commodité sur une machine de confiance à un seul utilisateur, un jeton quand vous voulez une autorisation explicite pour les clients locaux.

## Ce Que l'Assistant Peut Vraiment Faire

MCP n'est pas un prompt ouvert sur votre système. L'assistant ne peut appeler que les outils qu'EncodeX expose. La surface stdio offre 13 outils principaux (`convert_media`, `batch_convert`, `extract_audio`, `compress_image`, `cut_video`, gestion des tâches, et plus) ; la surface intégrée ajoute des outils de parité avec l'interface (`get_queue_state`, `cancel_all_jobs`, `get_timeline`, `extract_preview`, `get_system_info`, `check_for_updates`). C'est un cadrage d'outils délibéré — l'assistant peut opérer EncodeX, et rien d'autre.

Toutes les sessions se ferment de force quand l'application quitte, donc un assistant obsolète ne peut pas garder une prise après que vous ayez fermé EncodeX.

## Questions Fréquentes

### Le serveur MCP d'EncodeX envoie-t-il des données quelque part ?

Non. EncodeX traite tout localement via FFmpeg. Il n'y a aucun composant cloud, aucune télémétrie de votre multimédia, et le standard MCP ici n'est qu'un tuyau local.

### Le serveur intégré est-il exposé sur mon réseau ?

Non. Il se lie au loopback (`127.0.0.1`) uniquement, valide l'en-tête `Origin` et n'accepte que `GET`, `POST` et `DELETE` sur `/mcp`. Les appareils distants de votre LAN ne peuvent pas l'atteindre.

### Comment ajouter un jeton ?

Ouvrez **Paramètres → Serveur MCP**, activez le serveur et définissez un jeton d'accès. Les clients l'envoient ensuite comme jeton bearer, comparé en temps constant.

### Puis-je utiliser MCP entièrement hors ligne ?

Oui — c'est la conception centrale. Installez EncodeX, exécutez `encodex --mcp` ou activez le serveur intégré, et tout fonctionne sans connexion internet.

## En Savoir Plus

- [Documentation du serveur MCP](/fr/docs/cli#mcp-server-mode)
- [Configuration de Claude Desktop et Claude Code](/fr/blog/posts/how-to-use-claude-with-mcp)
- [Guide d'automatisation par lots](/fr/blog/posts/mcp-batch-automation-guide)
- [Flux de travail avec Cursor et VS Code](/fr/blog/posts/cursor-and-vscode-mcp-workflows)
- [Référence des fonctions : MCP](/fr/docs/features-reference#mcp-server)

---

*Téléchargez EncodeX gratuitement sur [encodex.in/download](/fr/download). Le serveur MCP est inclus dans chaque installation.*