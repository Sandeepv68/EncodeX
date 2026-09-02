<div align="center">
  <img src="../../assets/banner.png" alt="Logo EncodeX" width="900" />
  <h3>Un outil de conversion multimédia multiplateforme reposant sur FFmpeg, React, TypeScript et Electron.</h3>
</div>

<div align="center">

[![Ask DeepWiki](https://img.shields.io/badge/Ask_DeepWiki-10B981?style=for-the-badge)](https://deepwiki.com/Sandeepv68/EncodeX)
![CI](https://img.shields.io/github/actions/workflow/status/Sandeepv68/EncodeX/ci.yml?style=for-the-badge)
![License](https://img.shields.io/github/license/Sandeepv68/EncodeX?style=for-the-badge)
![Release](https://img.shields.io/github/v/release/Sandeepv68/EncodeX?style=for-the-badge)
![Downloads](https://img.shields.io/github/downloads/Sandeepv68/EncodeX/total?style=for-the-badge&logo=github&logoColor=white)
![Stars](https://img.shields.io/github/stars/Sandeepv68/EncodeX?style=for-the-badge)
![Forks](https://img.shields.io/github/forks/Sandeepv68/EncodeX?style=for-the-badge)
![Watchers](https://img.shields.io/github/watchers/Sandeepv68/EncodeX?style=for-the-badge)
![Issues](https://img.shields.io/github/issues/Sandeepv68/EncodeX?style=for-the-badge)
![Pull Requests](https://img.shields.io/github/issues-pr/Sandeepv68/EncodeX?style=for-the-badge)
![Last Commit](https://img.shields.io/github/last-commit/Sandeepv68/EncodeX?style=for-the-badge)
![Contributors](https://img.shields.io/github/contributors/Sandeepv68/EncodeX?style=for-the-badge)
![Repo Size](https://img.shields.io/github/repo-size/Sandeepv68/EncodeX?style=for-the-badge)
![Languages](https://img.shields.io/github/languages/count/Sandeepv68/EncodeX?style=for-the-badge)
![Top Language](https://img.shields.io/github/languages/top/Sandeepv68/EncodeX?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![MUI](https://img.shields.io/badge/MUI-007FFF?style=for-the-badge&logo=mui&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js%2022-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)

</div>

<div align="center">

[English](../../README.md) | [Deutsch](../de/README.md) | [Español](../es/README.md) | [Français](./README.md) | [हिन्दी](../hi/README.md) | [Português](../pt/README.md) | [简体中文](../zh/README.md)

</div>

## 👋 Introduction

EncodeX est un outil de conversion multimédia multiplateforme qui apporte toute la puissance de FFmpeg dans une interface de bureau moderne et intuitive. Construit avec Electron, React et TypeScript, il vous permet de convertir des médias entre différents formats, d'extraire l'audio, de couper des vidéos et de compresser des images — le tout via une interface propre et réactive offrant une file d'attente par lot, l'accélération matérielle, un mode CLI et une internationalisation complète.

## ✨ Fonctionnalités

- **🔄 Conversion de médias** — 51 codecs vidéo, 27 codecs audio, 56 formats de pixels avec contrôles du codec, du débit, de l'échelle et de la qualité
- **🎛️ Profils de conversion** — plus de 140 préréglages dans 8 catégories (YouTube, Instagram, TikTok, Apple, Android, ProRes, HLS, etc.) avec création de profils personnalisés et suivi des utilisations récentes
- **⚡ Accélération matérielle** — NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox, Media Foundation
- **✂️ Coupe vidéo** — Découpage précis à la trame avec lecteur intégré (flux rawvideo + PCM, Canvas + Web Audio) et chronologie zoomable (forme d'onde + montage de vignettes)
- **📋 File d'attente par lot** — Traitement en parallèle (jusqu'à 4 tâches simultanées) avec progression en temps réel, erreurs par tâche, pause/reprise, réorganisation par glisser-déposer, modification des options de tâche, filtres d'état, export/import JSON et actions d'alimentation à la fin (arrêt/veille/hibernation)
- **🖼️ Compression d'images** — JPEG/PNG/WebP/BMP/GIF/TIFF avec qualité/échelle, visionneuse EXIF, histogrammes RVB/luminance
- **🎵 Extraction audio** — N'importe lequel des 27 codecs audio à partir de n'importe quel fichier vidéo
- **ℹ️ Informations média** — Sonde complète par flux : codec, profil, résolution, métadonnées de couleur, débit d'images, etc.
- **⌨️ Mode CLI** — Scripting sans interface avec sous-commandes (`convert`, `info`, `capabilities`, `compress`, `extract-audio`, `batch`)
- **⚙️ 3 moteurs de transcodage** — API FFmpeg (fluent-ffmpeg), interface CLI FFmpeg (child_process), framework BMF
- **🌍 56 locales** — 35 langues avec prise en charge du RTL (arabe, hébreu)
- **⌨️ Raccourcis clavier** — Plus de 60 raccourcis sur toutes les pages avec une boîte d'aide intégrée à l'application (`Ctrl+/`)
- **🔔 Indicateurs d'activité** — Indicateurs de navigation en direct avec infobulles au survol montrant la progression de chaque tâche en un coup d'œil
- **🛡️ Confirmation de fermeture** — Avertit avant de fermer la fenêtre alors que des tâches sont encore en cours
- **🎉 Œufs de Pâques** — Logos d'application sur le thème des fêtes à des dates spéciales
- **🔄 Mises à jour intégrées** — Vérifie les versions GitHub, télécharge le programme d'installation de la plateforme, progression en temps réel
- **🛡️ Gestion des erreurs** — 16 codes d'erreur typés, snackbar global, bannières en ligne, limites d'erreur React
- **🌗 Thème sombre/clair** — Sensible au système avec bascule manuelle, préférences persistantes

Consultez la [Référence des fonctionnalités](./features-reference.md) pour la description complète des fonctionnalités, les formats pris en charge et les listes de codecs.

## 📸 Captures d'écran

<div align="center">
  <img src="../../site/public/images/home_dashboard.webp" alt="Tableau de bord" width="800" />
  <p><strong>🏠 Tableau de bord</strong></p>
</div>

<table>
  <tr>
    <td align="center" width="50%">
      <img src="../../site/public/images/convert.webp" alt="Conversion de médias" /><br />
      <strong>🔄 Conversion de médias</strong>
    </td>
    <td align="center" width="50%">
      <img src="../../site/public/images/extract_audio.webp" alt="Extraction audio" /><br />
      <strong>🎵 Extraction audio</strong>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="../../site/public/images/cut_video.webp" alt="Coupe vidéo" /><br />
      <strong>✂️ Coupe vidéo</strong>
    </td>
    <td align="center">
      <img src="../../site/public/images/image_compress.webp" alt="Compression d'images" /><br />
      <strong>🖼️ Compression d'images</strong>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="../../site/public/images/batch_process.webp" alt="File d'attente par lot" /><br />
      <strong>📋 File d'attente par lot</strong>
    </td>
    <td align="center">
      <img src="../../site/public/images/media_info.webp" alt="Informations média" /><br />
      <strong>ℹ️ Informations média</strong>
    </td>
  </tr>
</table>

## 📌 Prérequis

- [Node.js](https://nodejs.org/) 22+
- [FFmpeg](https://ffmpeg.org/) — fourni via `ffmpeg-static` ; utilise `ffmpeg` du système comme solution de repli si le binaire fourni n'est pas disponible

## 📥 Téléchargements

Des programmes d'installation pré-construits sont disponibles sur la page [Versions](https://github.com/Sandeepv68/EncodeX/releases).

### macOS

> EncodeX n'est pas signé avec un certificat de code (pas de compte développeur Apple). Gatekeeper de macOS bloquera l'application à la première ouverture.

**Option 1 — Ouvrir par clic droit :**

1. Faites un clic droit (ou un clic Contrôle) sur l'application EncodeX et sélectionnez **Ouvrir**
2. Cliquez sur **Ouvrir** dans la boîte de dialogue de confirmation

**Option 2 — Supprimer la quarantaine via Terminal :**

```bash
xattr -cr /Applications/EncodeX.app
```

### Windows / Linux

Téléchargez le programme d'installation `.exe` (Windows) ou `.AppImage` (Linux) depuis la page [Versions](https://github.com/Sandeepv68/EncodeX/releases) et exécutez-le.

## 🚀 Installation (à partir des sources)

```bash
npm install
```

## 🧑‍💻 Développement

```bash
# Start Vite dev server + tsc watch (no Electron window)
npm run dev

# Full dev environment with Electron window
npm run electron:dev

# Quick start (build then launch)
npm run dev:start
```

`npm run dev` lance deux processus simultanément :

1. **Vite** — sert le renderer React sur `http://localhost:5173` avec HMR
2. **tsc** — surveille et compile le TypeScript du processus principal vers `dist/main/`

`npm run electron:dev` attend que Vite soit prêt, compile à la fois le processus principal et le preload, puis lance Electron avec le drapeau `--dev` pointant vers l'URL du serveur de développement Vite. Les DevTools s'ouvrent automatiquement.

## 🔨 Build

```bash
# Production build (renderer + main + preload)
npm run build

# Package for current platform (no installer)
npm run pack

# Create distributable installer
npm run dist
```

| Script                   | Description                                                             |
| ------------------------ | ----------------------------------------------------------------------- |
| `npm run dev:renderer`   | Serveur de développement Vite uniquement                                |
| `npm run dev:main`       | `tsc -p tsconfig.main.json --watch`                                     |
| `npm run build:renderer` | Build de production Vite — sortie vers `dist/renderer/`                 |
| `npm run build:main`     | `tsc -p tsconfig.main.json` — sortie vers `dist/main/`                  |
| `npm run build:preload`  | `tsc -p tsconfig.preload.json` — sortie vers `dist/preload/`            |
| `npm run build`          | Les trois en séquence                                                   |
| `npm run start`          | Lance l'application compilée depuis `dist/` via `electron .`            |
| `npm run electron:dev`   | Environnement de développement Vite + Electron                          |
| `npm run dev:start`      | Build puis lancement                                                    |
| `npm run format`         | `prettier --write` sur tout le TypeScript/JSON de `src`                 |
| `npm run format:check`   | `prettier --check` sur tout le TypeScript/JSON de `src`                 |
| `npm run pack`           | Build + electron-builder `--dir`                                        |
| `npm run dist`           | Build + electron-builder (NSIS/DMG/AppImage)                            |

## 💻 Utilisation de la CLI

Construisez d'abord, puis invoquez via `encodex` :

```bash
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac
encodex info input.mp4 --json
encodex compress photo.png -f jpg -q 30
encodex extract-audio input.mp4
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted
```

Voir [Utilisation de la CLI](./cli.md) pour toutes les sous-commandes, options et exemples.

## 🧪 Tests

```bash
npm test           # Run all 123 test files / 1603 tests
npm run test:watch
npm run test:coverage
npm run test:unit
npm run test:integration
npm run test:e2e   # Requires build
```

Voir [Tests](./testing.md) pour la description complète de la suite de tests, la configuration des tests et les spécifications E2E.

## 📚 Documentation

| Document | Description |
| -------- | ----------- |
| [Référence des fonctionnalités](./features-reference.md) | Fonctionnalités, formats de médias pris en charge, tableaux des codecs, utilitaires de validation |
| [Utilisation de la CLI](./cli.md) | Utilisation de la CLI, sous-commandes, tous les tableaux d'options, codes de sortie |
| [Tests](./testing.md) | Suite de tests, configuration des tests, spécifications E2E |
| [Canaux IPC](./ipc.md) | Canaux IPC, pont electronAPI, toutes les méthodes et tous les événements |
| [Structure du projet](./project-structure.md) | Arborescence complète du répertoire avec annotations |
| [Vue d'ensemble de l'architecture](./architecture.md) | Aperçu de l'architecture interne et liens vers les analyses approfondies |
| [Processus et build](./architecture-processes.md) | Modèle de processus, système de build, séquence de démarrage, mode CLI |
| [Transcodeurs](./architecture-transcoders.md) | Abstraction des transcodeurs, moteurs FFmpeg/BMF, accélération matérielle |
| [Renderer](./architecture-renderer.md) | Arbre de rendu, pages, stores, file d'attente, lecteur, i18n, thèmes |
| [Gestionnaire de mises à jour](./update-manager.md) | Détails d'implémentation du gestionnaire de mises à jour intégré |
| [Wiki](https://github.com/Sandeepv68/EncodeX/wiki) | Wiki communautaire (miroir des docs sous une forme navigable) |
| [Site de documentation](https://encodex.in/fr/) | Site VitePress avec visite guidée des fonctionnalités, guides et blog des versions |
| [Contribuer](./CONTRIBUTING.md) | Recommandations pour contribuer |
| [Sécurité](../../SECURITY.md) | Signalement des vulnérabilités |
| [Code de conduite](../../CODE_OF_CONDUCT.md) | Code de conduite |

## 🧰 Pile technologique

<p align="center"><img src="../../assets/stack.png" alt="Pile technologique EncodeX"></p>

## 🤝 Contribuer

Consultez les recommandations dans [Contribuer](./CONTRIBUTING.md). Toutes les contributions sont bienvenues — veuillez ouvrir un problème (issue) en premier pour les changements importants.

Ce projet est régi par un [Code de conduite](../../CODE_OF_CONDUCT.md).

## 🔒 Sécurité

Signalez les vulnérabilités de sécurité aux mainteneurs du projet via le processus d'avis de sécurité. Voir [Sécurité](../../SECURITY.md).

## 📄 Licence

MIT