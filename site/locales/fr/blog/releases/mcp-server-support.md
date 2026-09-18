---
date: 2026-09-18
title: "EncodeX ajoute un serveur MCP intégré : laissez l'IA piloter vos conversions"
description: "EncodeX embarque désormais un serveur Model Context Protocol (MCP), pour que Claude, Cursor, VS Code et des agents personnalisés puissent convertir, compresser, découper et traiter par lots vos médias — en local et en toute sécurité."
tags:
  - release
  - mcp
  - ai
  - automation
---

# EncodeX ajoute un serveur MCP intégré : laissez l'IA piloter vos conversions

**Publié :** 2026-09-18
**Fonctionnalité :** Serveur MCP intégré (stdio + HTTP intégré)

## En résumé

EncodeX peut désormais servir de serveur [Model Context Protocol](https://modelcontextprotocol.io). Autrement dit, les assistants IA — Claude Desktop, Claude Code, Cursor, VS Code et tout autre client compatible MCP — peuvent convertir des vidéos, extraire le son, compresser des images, découper des clips et gérer des files par lots via EncodeX, avec une simple demande en langage courant.

Et tout se passe toujours sur votre ordinateur. Pas de téléversement, pas de cloud, pas de compte.

---

## Pourquoi MCP change votre quotidien

Nous avons construit EncodeX pour épargner la ligne de commande FFmpeg aux gens. Le **serveur MCP** supprime le dernier « sur quel bouton dois-je cliquer ? » dans les outils que vous utilisez déjà.

Si vous avez déjà tapé ce genre de demande :

> « Prends `interview.mov`, extrais l'audio en MP3 et fais-en une copie qui passe dans un e-mail. »

…un assistant compatible MCP peut désormais *réellement le faire* — choisir le bon outil EncodeX, lancer la conversion en local et vous rapporter le résultat. Vous restez dans votre application IA préférée ; EncodeX fait le gros du travail en coulisses.

Voici ce que cela débloque :

- **Le travail par lots en conversation** — « Convertis chaque MKV de ce dossier en MP4 et préviens-moi quand c'est fini. »
- **Des pipelines d'agents** — laissez un agent de code ou de médias préparer des fichiers dans le cadre d'une tâche plus vaste.
- **Une automatisation réutilisable** — décrivez un flux de travail une fois ; votre assistant le réutilise.
- **Aucune syntaxe de commande à mémoriser** — profils, codecs et conteneurs sont gérés pour vous.

---

## Deux façons de se connecter

### 1. Serveur stdio autonome

Lancez EncodeX comme processus MCP dédié. C'est ce que font les applications IA de bureau quand elles démarrent un serveur à la demande :

```bash
# Packaged app
encodex --mcp

# Source checkout (after npm run build:main)
node dist/mcp/index.js
```

stdout porte le protocole MCP ; tous les logs vont vers stderr, donc rien ne corrompt la conversation entre votre assistant et EncodeX.

### 2. Serveur HTTP intégré (mode GUI)

EncodeX déjà ouvert ? Activez **Réglages → Serveur MCP** et pointez votre client vers :

```
http://127.0.0.1:8765/mcp
```

Ce mode partage la file de tâches de l'application en cours d'exécution et ajoute des outils de file d'attente en direct, d'aperçu, de timeline, de système et de mises à jour — pour qu'un assistant voie ce sur quoi vous travaillez au lieu d'agir dans son coin.

---

## Ce que votre assistant peut faire

Sur les deux surfaces, EncodeX expose **19 outils**.

| Domaine            | Outils                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Conversion         | `convert_media`, `batch_convert`, `cut_video`, `compress_image`, `extract_audio`                   |
| Inspection         | `get_media_info`, `list_capabilities`, `list_profiles`, `get_profile`, `ping`                       |
| Gestion des tâches | `get_job`, `list_jobs`, `cancel_job`                                                                |
| Parité GUI (HTTP)  | `get_queue_state`, `cancel_all_jobs`, `get_timeline`, `extract_preview`, `get_system_info`, `check_for_updates` |

Il y a aussi **3 ressources** — `encodex://profiles`, `encodex://capabilities` et `encodex://codecs` — pour qu'un assistant découvre exactement ce que votre build prend en charge, et **4 modèles de prompts** pour les tâches les plus courantes : convertir une vidéo, extraire un son, compresser une image et convertir par lots.

Les conversions sont **asynchrones**. Un rendu long ne fige pas la conversation : votre assistant lance la tâche, obtient un identifiant de tâche et peut interroger la progression ou l'annuler plus tard.

---

## Configuration en moins d'une minute

### Claude Desktop

Ajoutez EncodeX à la configuration de vos serveurs MCP :

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

Redémarrez Claude Desktop et demandez : *« Utilise EncodeX pour convertir ~/Videos/clip.mov en MP4. »*

### Cursor / VS Code

Ajoutez la même définition de serveur à votre configuration MCP (`mcp.json` dans Cursor, ou les réglages MCP dans VS Code), en pointant `command` vers `encodex` avec l'argument `--mcp`. Pour le serveur intégré, utilisez plutôt l'URL de transport HTTP indiquée ci-dessus.

### Tout client MCP

Le serveur stdio est un processus JSON-RPC standard — aucune intégration spéciale requise. Si votre outil sait lancer une commande et parler MCP, il peut discuter avec EncodeX.

---

## Privé et sûr par conception

Offrir une surface d'automatisation impose de prendre la sécurité au sérieux. Le serveur intégré est volontairement prudent :

- **Boucle locale uniquement** — il écoute sur `127.0.0.1` et n'est jamais accessible depuis une autre machine.
- **Contrôles d'origine** — les requêtes cross-origin sont rejetées sauf si elles proviennent de l'application locale.
- **Jeton bearer facultatif** — activez-en un et chaque requête doit être authentifiée, avec comparaison en temps constant.
- **Surface HTTP minimale** — uniquement `GET`, `POST` et `DELETE` sur `/mcp`.
- **Arrêt propre** — toutes les sessions sont fermées de force quand le serveur s'arrête ou que l'application quitte.
- **Pas d'exfiltration de fichiers** — le serveur pilote le même moteur FFmpeg local que l'interface graphique. Rien n'est téléversé.

Le mode autonome `--mcp` hérite de la même garantie « tout s'exécute en local » : ce n'est qu'une autre façon de parler au moteur déjà présent sur votre machine.

---

## Pour qui est-ce ?

- **Créateurs et monteurs** qui travaillent déjà dans un assistant IA et veulent préparer des fichiers sans le quitter.
- **Développeurs** qui construisent des flux d'agents ayant besoin d'un vrai traitement médias.
- **Fans d'automatisation** qui préfèrent des pipelines reproductibles et descriptibles à des commandes jetables.
- **Tout le monde** qui préfère obtenir un résultat plutôt que chercher un réglage.

Si vous n'avez jamais utilisé de client MCP, rien ne change : l'interface graphique et la CLI sont exactement comme avant. Le serveur MCP est une porte supplémentaire vers le même moteur.

---

## Essayez dès aujourd'hui

1. Mettez à jour vers la dernière version d'EncodeX.
2. Lancez `encodex --mcp`, ou activez **Réglages → Serveur MCP** dans l'application.
3. Connectez votre assistant IA et demandez-lui de convertir quelque chose.

Lisez la référence complète — chaque outil, ressource, prompt, configuration client et le modèle de sécurité — dans la [documentation MCP](/docs/cli#mcp-server-mode).

---

[Télécharger EncodeX](/download) · [Explorer toutes les fonctionnalités](/features) · [Lire la documentation CLI](/docs/cli)