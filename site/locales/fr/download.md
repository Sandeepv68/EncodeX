# Télécharger EncodeX

EncodeX est **gratuit** et fonctionne sur Windows, Mac et Linux. Choisissez votre type d'ordinateur ci-dessous, téléchargez, installez, et c'est parti.

::: tip Prenez toujours la dernière version
Les nouvelles versions sortent sur la [page des releases GitHub](https://github.com/Sandeepv68/EncodeX/releases). Les liens ci-dessous vous donnent toujours la plus récente — chacun avec son architecture, sa taille de fichier et son empreinte SHA-256.
:::

<LatestDownloads />

## <OsIcon name="windows" /> Windows

**Vous voulez juste que ça marche ?** Cliquez sur le premier bouton — c'est le bon pour presque tout le monde.

<LatestDownloads platform="windows" />

**Pour installer :** ouvrez le fichier téléchargé et suivez les étapes à l'écran. Fonctionne sous Windows 10 et plus récent.

Vous hésitez ? Prenez la version recommandée — si ce n'est pas la bonne, Windows vous le dira.

## <OsIcon name="apple" /> Mac

<LatestDownloads platform="macos" />

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

<LatestDownloads platform="linux" />

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

## Versions précédentes

Besoin d'une version plus ancienne ? Dépliez la version souhaitée ci-dessous — chaque fichier indique sa taille et son empreinte SHA-256.

<LatestDownloads older />

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
