# Architecture

EncodeX est un outil multimédia de conversion multiplateforme construit sur FFmpeg, React, TypeScript et Electron. Il s'adresse aux développeurs qui veulent comprendre comment les pièces s'emboîtent avant de contribuer.

<p align="center"><img src="/images/architecture.webp" alt="EncodeX architecture" width="1024" height="1024" loading="lazy" /></p>

## Principes de conception

Le renderer ne lance jamais de processus et ne touche jamais directement au système de fichiers. Toutes les opérations privilégiées (dialogues de fichiers, exécution de FFmpeg, analyse, contrôle de fenêtre) vivent dans le processus principal et sont atteintes via IPC.

- **Séparation en trois processus** — main, preload et renderer, selon le modèle de sécurité d'Electron (`contextIsolation: true`, `nodeIntegration: false`).
- **Une abstraction unique sur les backends média** — l'interface `ITranscoder` masque le fait que la conversion est pilotée par `fluent-ffmpeg`, un processus enfant FFmpeg CLI brut ou le framework BMF.
- **IPC comme contrat typé** — chaque canal est une constante dans `src/shared/ipc-channels.ts`, et le renderer ne parle au processus principal qu'à travers le pont `window.electronAPI` exposé par le script preload.
- **Types et constantes partagés** — `src/shared/` est importé par les trois processus afin que les interfaces restent synchronisées par construction.
- **Amélioration progressive de l'UI** — les pages sont découpées avec `React.lazy`, l'état vit dans des stores Zustand, et les tâches longues renvoient leur progression via des événements IPC.

## Approfondissements

L'architecture complète est divisée en documents ciblés :

| Document | Sujets |
|----------|--------|
| [Processus, système de build & démarrage](/fr/docs/architecture-processes) | Modèle de processus (main/preload/renderer/shared), système de build, résolution des binaires, séquence de démarrage, mode CLI, couche de code partagé |
| [Abstraction transcoder & conversion](/fr/docs/architecture-transcoders) | Interface `ITranscoder`, FfmpegCore / FFToolCore / BmfCore, construction partagée des flags, accélération matérielle, analyse média, flux de conversion |
| [Renderer, état & sous-systèmes](/fr/docs/architecture-renderer) | Arbre de rendu, pages, hooks, stores Zustand, file d'attente par lots, lecteur vidéo, timeline média, traitement d'images, gestion des erreurs, logging, i18n, thèmes, référence des flux de données |

## Documentation additionnelle

| Document | Sujets |
|----------|--------|
| [Référence des fonctionnalités](/fr/docs/features-reference) | Fonctionnalités, formats média pris en charge, tables de codecs, utilitaires de validation |
| [Utilisation CLI](/fr/docs/cli) | Utilisation CLI, sous-commandes, toutes les tables d'options |
| [Canaux IPC](/fr/docs/ipc) | Canaux IPC (requête/envoi seul/événements), pont electronAPI |
| [Tests](/fr/docs/testing) | Suite de tests (123 fichiers, 1603 tests), configuration des tests, specs E2E |
| [Structure du projet](/fr/docs/project-structure) | Arborescence complète annotée |
| [Gestionnaire de mises à jour](/fr/docs/update-manager) | Implémentation du gestionnaire de mises à jour intégré |

## Dépôt

La source de vérité complète se trouve dans le [dossier `docs/`](https://github.com/Sandeepv68/EncodeX/tree/main/docs) du dépôt. Pour un aperçu du projet, les étapes d'installation et le guide de contribution, voir le [README sur GitHub](https://github.com/Sandeepv68/EncodeX).
