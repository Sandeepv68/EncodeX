---
title: "Flux de Travail MCP avec Cursor et VS Code et EncodeX"
description: "Branchez EncodeX sur Cursor ou VS Code avec encodex --mcp et transformez les corvées multimédia en flux de travail d'agents — conversions, extractions et compression d'images dans votre éditeur."
date: 2026-09-23
tags:
  - guide
  - mcp
  - cursor
  - vscode
  - ai
---

# Flux de Travail MCP avec Cursor et VS Code et EncodeX

Cursor et VS Code parlent tous deux MCP, ce qui signifie que vous pouvez confier des tâches multimédia à l'IA de votre éditeur sans quitter votre code. Pointez l'un ou l'autre vers le serveur intégré d'EncodeX et demandez une conversion, une extraction audio ou la compression d'un dossier entier d'images pendant que vous continuez à travailler sur le vrai projet.

Le serveur s'exécute localement (`encodex --mcp`), donc l'agent de l'éditeur opère le propre moteur FFmpeg de votre machine — pas de téléversement, pas d'API externe, entièrement hors ligne.

## Configurer EncodeX dans VS Code

VS Code dispose d'un support MCP intégré. Ouvrez les paramètres MCP et ajoutez une définition de serveur :

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

VS Code lance `encodex --mcp` comme processus serveur. Une fois connecté, l'assistant de l'éditeur peut appeler les outils d'EncodeX — `convert_media`, `extract_audio`, `compress_image`, `cut_video`, `batch_convert` — et suivre les tâches avec `get_job` / `list_jobs`.

Pour les outils en direct supplémentaires (état de la file, timeline, aperçu, informations système), activez **Paramètres → Serveur MCP** dans l'interface d'EncodeX et pointez l'éditeur vers `http://127.0.0.1:8765/mcp`. Cette surface ajoute des outils de parité avec l'interface comme `get_queue_state`, `extract_preview` et `get_timeline`.

## Configurer EncodeX dans Cursor

Cursor expose aussi les serveurs MCP dans ses paramètres, soit avec le même JSON, soit avec un dialogue similaire « Ajouter un serveur MCP » utilisant le type `command` :

- **Command (stdio) :** `encodex --mcp`

Cursor partage le format de configuration MCP standard, donc le bloc JSON ci-dessus fonctionne aussi pour Cursor. Après avoir ajouté le serveur, l'agent de Cursor peut effectuer des opérations multimédia directement.

## Flux de Travail de Modification

Le modèle utile consiste à combiner le travail multimédia avec le flux normal de votre éditeur :

> Convertissez `assets/tmp/video.mov` en MP4 pour la page de documentation, dans le dossier `assets/`.

L'agent appelle `convert_media`, attend `get_job`, puis enchaîne — héberger un aperçu, mettre à jour un README ou connecter le nouveau fichier à une compilation.

Plus avancé, un seul prompt peut orchestrer de nombreuses étapes :

> Un nouvel enregistrement est arrivé dans `~/r2d2/captures`. Convertissez-le en MP4 compressé, extrayez l'audio pour la transcription, puis mettez à jour `docs/captures.md` avec les emplacements de sortie.

C'est `convert_media` + `extract_audio`, coordonnés avec votre travail de dépôt en une seule session.

## Sortie Versionnée et Nettoyage

Comme EncodeX crée de vrais fichiers sur le disque, vous pouvez le combiner avec votre flux git :

> Exécutez le lot de `~/r2d2/captures` vers `~/r2d2/output`, puis dites-moi quels fichiers de sortie sont nouveaux pour savoir quoi ajouter.

L'agent lit les résultats des outils, l'historique de `list_jobs` et l'état de votre répertoire pour résumer ce qui a changé — transformant une corvée multimédia en commit documenté.

## Questions Fréquentes

### Est-ce que cela envoie mon code ou mon multimédia vers un cloud ?

Non. EncodeX MCP s'exécute entièrement sur votre machine. Votre multimédia est traité localement et l'agent de votre éditeur opère ces outils locaux. Il n'y a pas d'aller-retour vers le cloud pour l'encodage.

### Ai-je besoin de l'interface EncodeX ouverte ?

Pour le serveur stdio (`encodex --mcp`), non — il s'exécute sans interface. Le serveur HTTP intégré est la surface optionnelle qui tourne dans l'application et ajoute des outils de file en direct et d'aperçu.

### Puis-je l'utiliser avec Cursor et VS Code en même temps ?

Oui. Chaque client lance sa propre instance de serveur stdio, ou vous pouvez partager le même endpoint HTTP intégré pour les deux (une seule instance de l'interface).

### Quels outils sont disponibles ?

La surface stdio expose 13 outils principaux dont `convert_media`, `batch_convert`, `extract_audio`, `compress_image`, `cut_video` et la gestion des tâches. Consultez la [référence des fonctions](/fr/docs/features-reference#mcp-server) pour le catalogue complet.

## En Savoir Plus

- [Configuration de Claude Desktop et Claude Code](/fr/blog/posts/how-to-use-claude-with-mcp)
- [Guide d'automatisation par lots](/fr/blog/posts/mcp-batch-automation-guide)
- [Documentation du serveur MCP](/fr/docs/cli#mcp-server-mode)
- [Confidentialité et sécurité de MCP](/fr/blog/posts/mcp-privacy-security)

---

*Téléchargez EncodeX gratuitement sur [encodex.in/download](/fr/download). Le serveur MCP est inclus dans chaque installation.*