# Télécharger EncodeX

EncodeX est **gratuit** et fonctionne sur Windows, Mac et Linux. Choisissez votre type d'ordinateur ci-dessous, téléchargez, installez, et c'est parti.

::: tip Prenez toujours la dernière version
Les nouvelles versions sortent sur la [page des releases GitHub](https://github.com/Sandeepv68/EncodeX/releases). Les liens ci-dessous vous donnent toujours la plus récente.
:::

## <OsIcon name="windows" /> Windows

**Vous voulez juste que ça marche ?** Cliquez sur le premier bouton — c'est le bon pour presque tout le monde.

| | Télécharger | Pour |
|---|---------|-----|
| ✅ **Recommandé** | [Télécharger pour Windows](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x64-setup.exe) | La plupart des PC et portables (64 bits) |
| Vieux PC 32 bits | [Version 32 bits](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-ia32-setup.exe) | Très vieux ordinateurs |
| Portables ARM | [Version ARM](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64-setup.exe) | Portables Windows à puce Snapdragon |

**Pour installer :** ouvrez le fichier téléchargé et suivez les étapes à l'écran. Fonctionne sous Windows 10 et plus récent.

Vous hésitez ? Prenez la version recommandée — si ce n'est pas la bonne, Windows vous le dira.

## <OsIcon name="apple" /> Mac

| | Télécharger | Pour |
|---|---------|-----|
| Macs récents (2021 ou plus) | [Télécharger pour Apple Silicon](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64.dmg) | Puces M1, M2, M3, M4 |
| Macs plus anciens | [Télécharger pour Intel](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x64.dmg) | Macs d'avant 2021 |

**Pour installer :** ouvrez le fichier `.dmg` téléchargé, puis glissez EncodeX dans votre dossier Applications.

**Vous ne savez pas quel Mac vous avez ?** Cliquez sur le logo Apple (<OsIcon name="apple" label="Logo Apple" />) en haut à gauche de l'écran, choisissez « À propos de ce Mac » et regardez la ligne « Puce ». S'il est écrit « Apple M1 » (ou M2/M3/M4), prenez Apple Silicon. S'il est écrit « Intel », prenez Intel.

::: warning Premier lancement sur Mac — une étape en plus
Comme EncodeX est gratuit et open source (et non vendu sur le Mac App Store), macOS peut afficher un message indiquant que l'appli « ne peut pas être ouverte » au premier lancement. C'est normal et sans danger :

1. Trouvez EncodeX dans votre dossier Applications
2. Maintenez la touche **Contrôle** et cliquez sur l'appli, puis choisissez **Ouvrir**
3. Dans la fenêtre qui apparaît, cliquez encore sur **Ouvrir**

Il n'y a qu'à le faire une fois — ensuite il s'ouvre normalement.
:::

## <OsIcon name="linux" /> Linux

| | Télécharger | Pour |
|---|---------|-----|
| ✅ **Recommandé** | [Télécharger AppImage](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x86_64.AppImage) | La plupart des ordinateurs Linux (64 bits) |
| ARM64 | [AppImage ARM64](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64.AppImage) | Cartes et portables ARM |
| ARMv7 | [AppImage ARMv7](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-armv7l.AppImage) | Vieilles cartes mono-carte |

**Pour lancer :** une AppImage est un fichier unique — pas d'installation. Rendez-le exécutable puis double-cliquez :

```bash
chmod +x EncodeX-*.AppImage
./EncodeX-*.AppImage
```

(Beaucoup d'environnements de bureau permettent aussi d'éviter le terminal : clic droit sur le fichier → Propriétés → autoriser l'exécution, puis double-clic.)

## Ce dont votre ordinateur a besoin

Rien de spécial — si votre machine a quelques années au plus, tout va bien :

- **Système :** Windows 10+, macOS 11+ ou un Linux moderne
- **Disque :** environ 400 Mo (l'appli embarque tout ce qu'il lui faut — aucun téléchargement supplémentaire)
- **Mémoire :** une quantité normale suffit

## Rester à jour

Quand une nouvelle version sort, EncodeX vous prévient dans l'appli et peut télécharger et lancer la mise à jour pour vous — inutile de revenir sur cette page.

## Besoin d'aide ?

Si quelque chose ne fonctionne pas ou si vous avez une question, écrivez à **[developer@encodex.in](mailto:developer@encodex.in)** — une vraie personne vous répondra.

## Pour les développeurs : compilez-le vous-même

Vous préférez compiler depuis les sources ? Clonez le dépôt et lancez :

```bash
git clone https://github.com/Sandeepv68/EncodeX.git
cd EncodeX
npm install
npm run dist
```

L'installateur sera créé dans le dossier `release/`.
