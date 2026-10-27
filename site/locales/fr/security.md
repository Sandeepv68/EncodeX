---
title: "Sécurité chez EncodeX — Open source, sommes de contrôle et signalement"
description: "Comment EncodeX vous protège : code open source, sommes de contrôle SHA-256 publiées avec chaque version, vérification des mises à jour par digest GitHub, et comment signaler une vulnérabilité. Les versions ne sont pas signées numériquement."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# Sécurité chez EncodeX

EncodeX est open source, donc la sécurité ne repose pas sur la bonne foi. Chaque version est construite à partir de code public et publie des **sommes de contrôle SHA-256** que vous pouvez comparer à votre téléchargement. Les versions ne sont **pas signées numériquement**, donc votre système d'exploitation peut afficher un avertissement « éditeur inconnu » ou « développeur non identifié ».

## Ce que nous publions, vous pouvez le vérifier

- **Open source.** Toute l'application — y compris le pipeline de traitement multimédia et la compilation FFmpeg intégrée — vit dans [notre dépôt](https://github.com/Sandeepv68/EncodeX). N'importe qui peut auditer exactement ce que fait l'application.
- **Sommes de contrôle SHA-256.** Chaque version publie un fichier `SHA256SUMS.txt` à côté des binaires. Comparez le fichier téléchargé au hash publié avant d'installer :

```bash
# Windows (PowerShell)
Get-FileHash .\EncodeX-Setup-1.0.0.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 ./EncodeX-1.0.0.dmg
```

- **Mises à jour vérifiées.** L'outil de mise à jour consulte GitHub Releases. Lorsque GitHub publie un digest SHA-256 ou SHA-512 pour le fichier de mise à jour, l'application vérifie le téléchargement par rapport à ce digest. L'outil de mise à jour ne vérifie pas de signature cryptographique. Les mises à jour ne sont jamais installées automatiquement : vous choisissez quand les installer.

## Note sur Gatekeeper (macOS)

Parce qu'EncodeX est gratuit et open source, n'est pas vendu sur le Mac App Store, et que ses versions macOS ne sont pas signées ni notariées par Apple, macOS peut afficher un message « ne peut pas être ouvert » la première fois : c'est le contrôle **Gatekeeper**. La version publiée sur la page des versions est celle que nous avons compilée. Pour l'ouvrir, faites Contrôle-clic sur l'app dans Applications puis choisissez **Ouvrir**, une fois. Sur les versions récentes de macOS, il vous faudra peut-être passer par **Réglages Système → Confidentialité et sécurité → Ouvrir quand même**.

## Le FFmpeg intégré

EncodeX embarque des binaires FFmpeg et FFprobe précompilés (issus des paquets `ffmpeg-static` et `ffprobe-static`) au lieu d'appeler un binaire système. Les conversions s'exécutent comme processus enfant sur votre appareil. Consultez notre [architecture technique](/fr/docs/architecture) pour savoir comment le moteur est intégré.

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