---
title: "Sécurité chez EncodeX — Vérifiable, signé, open source"
description: "Comment EncodeX vous protège : code open source, sommes de contrôle SHA-256 pour chaque téléchargement, signature de code sur macOS et Windows, et un pipeline de mises à jour vérifiable. Plus comment signaler une vulnérabilité."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# Sécurité chez EncodeX

EncodeX est open source, donc la sécurité ne repose pas sur la bonne foi — chaque version est construite à partir de code public, livrée avec des **sommes de contrôle SHA-256** que vous pouvez vérifier, et, quand c'est possible, **signée** pour que votre système d'exploitation confirme qu'elle vient bien de nous.

## Ce que nous publions, vous pouvez le vérifier

- **Open source.** Toute l'application — y compris le pipeline de traitement multimédia et la compilation FFmpeg intégrée — vit dans [notre dépôt](https://github.com/Sandeepv68/EncodeX). N'importe qui peut auditer exactement ce que fait l'application.
- **Sommes de contrôle SHA-256.** Chaque version publie des checksums à côté des binaires. Comparez le fichier téléchargé au hash publié avant d'installer :

```bash
# Windows (PowerShell)
Get-FileHash .\EncodeX-Setup-1.0.0.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 ./EncodeX-1.0.0.dmg
```

- **Signature de code.** Les versions Windows et macOS sont signées, votre OS affiche donc « éditeur vérifié »/« Apple » au lieu d'un avertissement « développeur inconnu ».
- **Mises à jour vérifiables.** L'application ne télécharge que des mises à jour signées par nos soins sur HTTPS. La signature de la mise à jour est validée localement avant que quoi que ce soit soit remplacé.

## Note sur Gatekeeper (macOS)

Parce qu'EncodeX est gratuit et open source (et non vendu sur le Mac App Store), macOS peut afficher un message « ne peut pas être ouvert » la première fois — c'est le contrôle **Gatekeeper** que doivent passer les apps non signées par défaut. La compilation est réelle ; pour l'ouvrir, faites Contrôle-clic sur l'app dans Applications puis choisissez **Ouvrir**, une fois. Ensuite elle s'ouvre normalement.

## Le FFmpeg intégré

EncodeX embarque sa propre compilation de FFmpeg au lieu d'appeler un binaire système. La compilation exacte (version, source et configuration) est documentée dans notre [architecture technique](/fr/docs/architecture) et reproduite depuis la source en CI — ainsi les conversions se comportent de façon identique partout, et le binaire que vous exécutez est celui que nous avons construit.

## Signaler une vulnérabilité

Nous prenons la sécurité au sérieux et suivons un processus de divulgation simple :

1. **Ne signalez pas** de vulnérabilités dans les issues GitHub publiques — vous exposeriez le défaut avant que nous puissions le corriger.
2. Ouvrez un **[advisory de sécurité privé](https://github.com/Sandeepv68/EncodeX/security/advisories/new)** sur le dépôt.
3. Nous accusons réception **sous 48 heures** et fournissons un délai estimé pour le correctif. Les correctifs de sécurité sont priorisés et publiés dès que possible.

Pour tout le reste, utilisez le [suivi d'issues habituel](https://github.com/Sandeepv68/EncodeX/issues).

## Commencez

- [Téléchargez EncodeX gratuitement](/fr/download)
- [Lisez la politique de confidentialité](/fr/privacy)
- [Architecture technique et FFmpeg intégré](/fr/docs/architecture)