---
title: "Comment Utiliser le Serveur MCP d'EncodeX avec Claude Desktop et Claude Code"
description: "Connectez le serveur MCP intégré d'EncodeX à Claude Desktop ou Claude Code et convertissez, extrayez, compressez et traitez par lots des fichiers multimédia en langage naturel — entièrement hors ligne."
date: 2026-09-21
tags:
  - guide
  - mcp
  - claude
  - ai
  - automation
---

# Comment Utiliser le Serveur MCP d'EncodeX avec Claude Desktop et Claude Code

EncodeX est livré avec un serveur MCP intégré (Model Context Protocol), ce qui signifie que vous pouvez piloter toute l'application depuis Claude Desktop ou Claude Code en langage courant. Au lieu d'ouvrir une interface et de chercher dans les menus, demandez : *« convertissez ce MKV en MP4 pour mon téléphone »* — et l'assistant effectue la conversion avec le moteur FFmpeg local d'EncodeX.

Tout s'exécute sur votre ordinateur. Les fichiers ne quittent jamais votre appareil, il n'y a pas de compte et tout fonctionne hors ligne.

## Qu'est-ce qu'un Serveur MCP ?

[MCP](https://modelcontextprotocol.io) est un standard ouvert qui permet aux assistants IA d'utiliser les outils d'applications réelles. Le serveur d'EncodeX expose un ensemble d'outils de conversion — `convert_media`, `extract_audio`, `compress_image`, `cut_video`, `batch_convert`, plus des outils de suivi de tâches comme `get_job` et `list_jobs` — ainsi que des ressources et des modèles de prompts.

Considérez-le comme une télécommande pour FFmpeg qu'un assistant IA peut manipuler. L'assistant voit les outils, décide lesquels appeler et EncodeX fait l'encodage localement.

## Premiers Pas

Installez EncodeX ([téléchargement](/fr/download)) — le serveur MCP est intégré, aucun plugin requis — et assurez-vous que `encodex` est dans votre `PATH` (installer EncodeX l'ajoute).

### Option 1 : Claude Desktop

Ouvrez **Claude Desktop → Paramètres → Développeur → Modifier la configuration** et ajoutez une entrée de serveur MCP :

```json
{
  "mcpServers": {
    "encodex": {
      "command": "encodex",
      "args": ["--mcp"]
    }
  }
}
```

Enregistrez le fichier et redémarrez Claude Desktop. Claude aura maintenant accès aux outils d'EncodeX.

### Option 2 : Claude Code

Depuis un terminal dans votre projet :

```bash
claude mcp add encodex -- encodex --mcp
```

Puis lancez Claude Code et demandez une conversion. Vous pouvez vérifier que le serveur est enregistré avec `claude mcp list`.

## Votre Première Demande

Essayez quelque chose de simple :

> Convertissez `~/Desktop/vacation.mp4` en un MP4 plus petit adapté à WhatsApp.

L'assistant appelle `convert_media`, la tâche s'exécute en arrière-plan sur votre machine et Claude rapporte le résultat. Comme la conversion est asynchrone, EncodeX renvoie un identifiant de tâche ; l'assistant interroge `get_job` pour la progression et termine quand c'est fini.

Vous pouvez aussi extraire l'audio :

> Extrayez l'audio de `lecture.mov` en MP3.

Cela correspond à l'outil `extract_audio`. Ou compresser un dossier d'images :

> Compressez toutes les photos de `~/Pics` dans le dossier `~/Output`.

C'est l'outil `compress_image`, piloté en langage naturel.

## Lancer le Serveur Sans Interface

`encodex --mcp` démarre le serveur stdio autonome. Il parle JSON-RPC sur stdout (gardant ainsi propres les messages du protocole) et envoie tout l'état et les journaux sur stderr. Le processus reste vivant jusqu'à la fermeture de stdin — exactement ce dont les applications de bureau asynchrones ont besoin pour lancer un serveur MCP à la demande.

Pour la surface HTTP intégrée — file d'attente en direct, aperçu, timeline et outils système — activez **Paramètres → Serveur MCP** dans l'interface et pointez le client vers `http://127.0.0.1:8765/mcp`.

## Conseils pour de Meilleurs Résultats

- **Donnez des chemins absolus ou explicites** — c'est plus facile pour l'assistant de viser les bons fichiers.
- **Nommez le format de sortie** — « en MP4 », « en MP3 » — pour que le bon profil soit choisi.
- **Utilisez des lots pour les dossiers** — EncodeX peut convertir de nombreux fichiers en une seule tâche (voir le [guide d'automatisation par lots](/fr/blog/posts/mcp-batch-automation-guide)).
- **Consultez la documentation pour les options avancées** — le catalogue complet se trouve dans la [référence des fonctions MCP](/fr/docs/features-reference#mcp-server).

## Questions Fréquentes

### Le serveur MCP d'EncodeX est-il gratuit ?

Oui — il est intégré à l'application EncodeX gratuite et open source (MIT). Pas d'abonnement, pas de clé de licence.

### Ai-je besoin de l'interface ouverte pour utiliser `encodex --mcp` ?

Non. Le serveur autonome s'exécute sans interface. Le serveur HTTP intégré (Paramètres → Serveur MCP) est la surface optionnelle qui tourne dans l'application pour les outils de file d'attente et d'aperçu.

### MCP téléverse-t-il mes fichiers ?

Non. EncodeX traite tout localement. Le serveur MCP pilote le même moteur FFmpeg local que l'interface — pas de téléversement, pas de cloud, pas de compte.

### Quels assistants peuvent se connecter ?

Tout client compatible MCP. Ce guide couvre Claude Desktop et Claude Code ; le même modèle de configuration fonctionne dans [Cursor et VS Code](/fr/blog/posts/cursor-and-vscode-mcp-workflows).

## En Savoir Plus

- [Documentation du serveur MCP](/fr/docs/cli#mcp-server-mode)
- [Automatisation par lots avec MCP](/fr/blog/posts/mcp-batch-automation-guide)
- [Confidentialité et sécurité de MCP](/fr/blog/posts/mcp-privacy-security)
- [La référence complète des fonctions](/fr/docs/features-reference#mcp-server)

---

*Téléchargez EncodeX gratuitement sur [encodex.in/download](/fr/download). Le serveur MCP est inclus dans chaque installation.*