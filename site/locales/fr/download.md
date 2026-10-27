# Télécharger EncodeX — Gratuit et open source

EncodeX est **gratuit et open source** et fonctionne sur Windows, Mac et Linux. C'est une interface graphique pour FFmpeg — sans compte, sans filigrane et sans limite de taille : tout se passe sur votre ordinateur.

::: tip Première fois ? Voici ce qui se passe ensuite
Installez l'application, glissez une vidéo ou une image dans la fenêtre, choisissez un profil (par exemple MP4 ou « fichier plus petit ») puis cliquez sur **Convertir** — c'est tout. Tout se déroule en local sur votre ordinateur.

- **Nouveau sur EncodeX ?** Découvrez des [exemples de ce que vous pouvez faire](/fr/use-cases) ou [parcourez les outils](/fr/features).
- **Bloqué ?** La plupart des conversions demandent un simple glisser-déposer + un clic sur un profil. La carte « Pour commencer » de votre tableau de bord vous guide dans le choix d'un objectif.
:::

## <OsIcon name="windows" /> Windows

**Windows 10/11 · 64-bit** — convient à presque tout le monde.

<LatestDownloads platform="windows" />

**Vous hésitez ? Téléchargez la version x64 — recommandée pour la plupart des PC Windows.**

**Pour installer :** ouvrez le fichier téléchargé et suivez les étapes à l'écran.

::: warning Premier lancement sous Windows — un clic de plus
Les releases EncodeX ne sont pas signées avec un certificat de code, donc Windows SmartScreen peut afficher un avertissement « Windows protected your PC » avec le message « éditeur inconnu ». C'est attendu et ne signifie pas que le téléchargement est corrompu. Pour continuer :

1. Cliquez sur **Informations complémentaires** dans l'avertissement
2. Cliquez sur **Exécuter quand même**

Vous n'avez à le faire qu'une seule fois — ensuite l'installation se fait normalement.
:::

Vous hésitez ? Prenez la version recommandée — si ce n'est pas la bonne, Windows vous le dira.

### Autres plateformes

[macOS](#mac) · [Linux](#linux) · [Windows ARM64](#windows)

## <OsIcon name="apple" /> Mac

<LatestDownloads platform="macos" />

**Pour installer :** ouvrez le fichier `.dmg` téléchargé, puis glissez EncodeX dans votre dossier Applications.

**Vous ne savez pas quel Mac vous avez ?** Cliquez sur le logo Apple (<OsIcon name="apple" label="Logo Apple" />) en haut à gauche de l'écran, choisissez « À propos de ce Mac » et regardez la ligne « Puce ». S'il est écrit « Apple M1 » (ou M2/M3/M4), prenez Apple Silicon. S'il est écrit « Intel », prenez Intel.

::: warning Premier lancement sur Mac — une étape en plus
EncodeX est gratuit et open source, n'est pas vendu sur le Mac App Store, et ses versions macOS ne sont ni signées ni notariées par Apple. macOS peut donc afficher un message indiquant que l'appli « ne peut pas être ouverte » au premier lancement. Pour l'ouvrir :

1. Trouvez EncodeX dans votre dossier Applications
2. Maintenez la touche **Contrôle** et cliquez sur l'appli, puis choisissez **Ouvrir**
3. Dans la fenêtre qui apparaît, cliquez encore sur **Ouvrir**

Sur les versions récentes de macOS, l'option Contrôle-clic peut ne pas être proposée. Dans ce cas, ouvrez **Réglages Système → Confidentialité et sécurité** et choisissez **Ouvrir quand même** pour EncodeX.

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
- **Disque :** assez de place pour l'appli et vos fichiers convertis
- **Mémoire :** une quantité normale suffit

EncodeX embarque le moteur FFmpeg : vous n'installez donc ni FFmpeg ni de codecs séparément. Chaque conversion se fait [localement sur votre ordinateur](/fr/features).

## Rester à jour

Quand une nouvelle version sort, EncodeX consulte GitHub Releases et vous prévient dans l'appli. Vous choisissez de télécharger et d'installer la mise à jour, ou de l'installer au prochain redémarrage. Les mises à jour ne sont jamais installées automatiquement : inutile de revenir sur cette page.

## Versions précédentes

Besoin d'une version plus ancienne ? Dépliez la version souhaitée ci-dessous — chaque fichier indique sa taille et son empreinte SHA-256.

<LatestDownloads older />

## Besoin d'aide ?

Si quelque chose ne fonctionne pas ou si vous avez une question, écrivez à **[developer@encodex.in](mailto:developer@encodex.in)** — une vraie personne vous répondra.

## Confidentialité

Nous comprenons que la confiance compte. Chaque conversion se fait sur votre ordinateur, et vos fichiers ne sont jamais envoyés ni stockés sur un serveur. La remontée d'erreurs et les statistiques d'usage sont activées par défaut, et vous pouvez les désactiver dans les Réglages. Consultez la [politique de confidentialité](/fr/privacy).

## Sécurité

Chaque version publie des [sommes de contrôle SHA-256](/fr/security) à côté des installateurs, et si vous trouvez un problème, vous pouvez le signaler de manière privée. Les versions ne sont pas signées numériquement ni notariées. Consultez la [page sécurité](/fr/security) pour plus de détails.

## Pour les développeurs : compilez-le vous-même

Vous préférez compiler depuis les sources ? Clonez le dépôt et lancez :

```bash
git clone https://github.com/Sandeepv68/EncodeX.git
cd EncodeX
npm install
npm run dist
```

L'installateur sera créé dans le dossier `release/`.
