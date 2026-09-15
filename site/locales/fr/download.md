# Télécharger EncodeX

EncodeX est **gratuit** et fonctionne sur Windows, Mac et Linux. C'est une interface graphique open source pour FFmpeg — sans compte, sans filigrane et sans limite de taille : tout se passe sur votre ordinateur.

::: tip Première fois ? Voici ce qui se passe ensuite
Installez l'application, glissez une vidéo ou une image dans la fenêtre, choisissez un profil (par exemple MP4 ou « fichier plus petit ») puis cliquez sur **Convertir** — c'est tout. Tout se déroule en local sur votre ordinateur.

- **Nouveau sur EncodeX ?** Découvrez des [exemples de ce que vous pouvez faire](/fr/use-cases) ou [parcourez les outils](/fr/features).
- **Bloqué ?** La plupart des conversions demandent un simple glisser-déposer + un clic sur un profil. La carte « Pour commencer » de votre tableau de bord vous guide dans le choix d'un objectif.
:::

## <OsIcon name="windows" /> Windows

**Windows 10/11 · 64-bit** — convient à presque tout le monde.

<LatestDownloads platform="windows" />

**Pour installer :** ouvrez le fichier téléchargé et suivez les étapes à l'écran.

Vous hésitez ? Prenez la version recommandée — si ce n'est pas la bonne, Windows vous le dira.

### Autres plateformes

[macOS](#mac) · [Linux](#linux) · [Windows ARM64](#windows) · [Windows 32 bits](#windows)

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

## Confidentialité

Nous comprenons que la confiance compte. Chaque conversion se fait sur votre ordinateur — vos fichiers ne sont jamais envoyés, suivis ni stockés sur un serveur. Consultez la [politique de confidentialité](/fr/privacy).

## Pour les développeurs : compilez-le vous-même

Vous préférez compiler depuis les sources ? Clonez le dépôt et lancez :

```bash
git clone https://github.com/Sandeepv68/EncodeX.git
cd EncodeX
npm install
npm run dist
```

L'installateur sera créé dans le dossier `release/`.
