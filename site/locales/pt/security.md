---
title: "Segurança no EncodeX — Código aberto, checksums e relato de problemas"
description: "Como o EncodeX mantém você seguro: código aberto, checksums SHA-256 publicados com cada versão, uma verificação do digest do GitHub nas atualizações e como reportar uma vulnerabilidade. As versões publicadas não são assinadas por código."
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# Segurança no EncodeX

O EncodeX é open source, então a segurança não precisa ser aceita por fé. Cada versão é construída a partir de código público e publica **checksums SHA-256** que você pode comparar com o seu download. As versões publicadas **não são assinadas por código**, então seu sistema operacional pode mostrar um aviso de "desenvolvedor desconhecido" ou "desenvolvedor não identificado".

## O que publicamos, você pode verificar

- **Código aberto.** Todo o app — incluindo o pipeline de processamento de mídia e os scripts de release — vive no [nosso repositório](https://github.com/Sandeepv68/EncodeX). Qualquer pessoa pode auditar exatamente o que o app faz.
- **Checksums SHA-256.** Cada versão publica um arquivo `SHA256SUMS.txt` junto aos binários. Compare o arquivo baixado com o hash publicado antes de instalar:

```bash
# Windows (PowerShell)
Get-FileHash .\EncodeX-Setup-1.0.0.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 ./EncodeX-1.0.0.dmg
```

- **Atualizações verificadas.** O atualizador consulta o GitHub Releases. Quando o GitHub publica um digest SHA-256 ou SHA-512 para o arquivo de atualização, o app verifica o download contra ele. O atualizador não verifica uma assinatura criptográfica. As atualizações nunca são instaladas automaticamente; você decide quando instalar.

## Nota sobre o Gatekeeper do macOS

Como o EncodeX é gratuito e open source, não é vendido pela Mac App Store e seus builds para macOS não são assinados por código nem notarizados, o macOS pode mostrar uma mensagem de "não pode ser aberto" na primeira vez. O build é o publicado na página de releases. Para abrir, faça Control-click no app em Aplicações e escolha **Abrir**, uma vez. Em versões recentes do macOS você pode precisar usar **Ajustes do Sistema → Privacidade e Segurança → Abrir mesmo assim**.

## O FFmpeg embutido

O EncodeX distribui binários pré-compilados do FFmpeg e do FFprobe (dos pacotes `ffmpeg-static` e `ffprobe-static`) em vez de chamar um binário do sistema. As conversões rodam como um processo filho no seu dispositivo. Veja nossa [arquitetura técnica](/pt/docs/architecture) para saber como o motor é integrado.

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