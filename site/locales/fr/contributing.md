# Aidez à améliorer EncodeX

EncodeX est gratuit et construit par des bénévoles — et vous n'avez pas besoin d'être programmeur pour aider. Voici comment tout le monde peut participer :

- **Signalez ce qui casse.** Si l'appli plante ou qu'un fichier refuse de se convertir, [ouvrez un ticket](https://github.com/Sandeepv68/EncodeX/issues) et décrivez ce qui s'est passé. Les rapports d'utilisateurs ordinaires sont en or.
- **Proposez des idées.** Vous rêvez qu'EncodeX fasse quelque chose qu'il ne fait pas ? Dites-le — beaucoup de fonctionnalités naissent de suggestions d'utilisateurs.
- **Traduisez.** EncodeX parle plus de 35 langues, et les traducteurs sont toujours les bienvenus. Si la vôtre manque ou sonne mal, vous pouvez aider.
- **Faites passer le mot.** Partagez EncodeX avec vos amis, écrivez un avis ou créez un tutoriel.

## Nous contacter

Des questions, des idées, ou juste envie de dire bonjour ? Écrivez directement au développeur à **[developer@encodex.in](mailto:developer@encodex.in)** — les retours d'utilisateurs sont toujours bienvenus.

## Pour les développeurs

Si vous voulez contribuer du code, voici par où commencer :

### Développement

```bash
npm run dev          # mode développement avec rechargement à chaud
npm run electron:dev # environnement complet avec fenêtre Electron
npm run build        # compilation complète
npm start            # lancer l'appli compilée
```

### Conventions du projet

- **TypeScript** — mode strict, pas de `any` quand c'est évitable.
- **React** — composants fonctionnels avec hooks.
- **État** — stores Zustand pour l'état global.
- **IPC** — tous les canaux définis dans `src/shared/ipc-channels.ts`.
- **Constantes** — valeurs fixes dans les fichiers de constantes de `src/shared/`.
- **i18n** — tous les textes visibles dans `src/renderer/i18n/locales/`.

### Processus de Pull Request

1. Vérifiez que la compilation passe : `npm run build`
2. Mettez à jour les fichiers de langue si vous ajoutez ou modifiez des textes.
3. Gardez chaque PR centrée sur un seul sujet.

## Code de conduite

Ce projet suit le [Contributor Covenant](https://github.com/Sandeepv68/EncodeX/blob/main/CODE_OF_CONDUCT.md). Soyez bienveillant et respectueux — nous sommes tous ici parce que le projet nous plaît.
