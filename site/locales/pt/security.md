---
title: "Segurança no EncodeX — Verificável, assinado, open source"
description: "Como o EncodeX mantém você seguro: código aberto, checksums SHA-256 para cada download, assinatura de código no macOS e Windows e um pipeline de atualizações verificável. Além de como reportar uma vulnerabilidade."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# Segurança no EncodeX

O EncodeX é open source, então a segurança não precisa ser aceita por fé — cada versão é construída a partir de código público, acompanha **checksums SHA-256** que você pode verificar e, quando possível, é **assinada por código** para que seu sistema operacional confirme que realmente veio de nós.

## O que publicamos, você pode verificar

- **Código aberto.** Todo o app — incluindo o pipeline de processamento de mídia e o build do FFmpeg embutido — vive no [nosso repositório](https://github.com/Sandeepv68/EncodeX). Qualquer pessoa pode auditar exatamente o que o app faz.
- **Checksums SHA-256.** Cada versão publica checksums junto aos binários. Compare o arquivo baixado com o hash publicado antes de instalar:

```bash
# Windows (PowerShell)
Get-FileHash .\EncodeX-Setup-1.0.0.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 ./EncodeX-1.0.0.dmg
```

- **Assinatura de código.** As versões para Windows e macOS são assinadas, então seu sistema mostra "editor verificado"/"Apple" em vez de um aviso de "desenvolvedor desconhecido".
- **Atualizações verificáveis.** O app só baixa atualizações assinadas por nós via HTTPS. A assinatura da atualização é validada localmente antes de qualquer substituição.

## Nota sobre o Gatekeeper do macOS

Como o EncodeX é gratuito e open source (e não é vendido pela Mac App Store), o macOS pode mostrar uma mensagem de "não pode ser aberto" na primeira vez — é a verificação do **Gatekeeper** para apps não assinadas por padrão. O build é real; para abrir, faça Control-click no app em Aplicações e escolha **Abrir**, uma vez. Depois ele abre normalmente.

## O FFmpeg embutido

O EncodeX embute seu próprio build do FFmpeg em vez de chamar um binário do sistema. O build exato (versão, fonte e configuração) está documentado na nossa [arquitetura técnica](/pt/docs/architecture) e é reproduzido a partir do código-fonte no CI — assim as conversões se comportam igual em qualquer lugar, e o binário que você executa é o que nós construímos.

## Reportando uma vulnerabilidade

Levamos segurança a sério e seguimos um processo direto de divulgação:

1. **Não** reporte vulnerabilidades em issues públicas do GitHub — você exporia a falha antes de podermos corrigir.
2. Abra um **[advisory de segurança privado](https://github.com/Sandeepv68/EncodeX/security/advisories/new)** no repositório.
3. Confirmamos o recebimento **em até 48 horas** e fornecemos um prazo estimado para a correção. Correções de segurança são priorizadas e lançadas o quanto antes.

Para o resto, use o [rastreador de issues regular](https://github.com/Sandeepv68/EncodeX/issues).

## Comece

- [Baixe o EncodeX gratuitamente](/pt/download)
- [Leia a política de privacidade](/pt/privacy)
- [Arquitetura técnica e FFmpeg embutido](/pt/docs/architecture)