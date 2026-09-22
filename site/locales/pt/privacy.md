---
title: "Política de privacidade – EncodeX nunca faz upload dos seus arquivos"
description: "Política de privacidade do EncodeX: processamento 100% offline, sem contas, sem rastreamento dos seus mídias, sem coleta de dados. Seus vídeos e áudios nunca saem do seu computador."
---

# Política de privacidade

**Versão curta: seus arquivos nunca saem do seu computador.**

EncodeX é um aplicativo de desktop que processa todas as mídias **localmente e offline**. Não temos servidores que recebam seus vídeos, não há processamento na nuvem e não há motivo para ver seus arquivos.

*Última atualização: setembro de 2026*

## A versão curta

- **100% offline** — toda conversão, compressão e extração acontece no seu dispositivo
- **Sem conta** — nada para se cadastrar, sem perfil para manter
- **Sem uploads** — suas mídias nunca são transmitidas para nós ou qualquer outra pessoa
- **Telemetria apenas com consentimento** — os únicos dados que saem são eventos opcionais, anônimos e apenas categóricos que você pode desativar nas Configurações
- **Código aberto** — qualquer pessoa pode inspecionar exatamente o que o aplicativo faz

## O que não coletamos

EncodeX não coleta, transmite ou armazena nenhum dos seus arquivos de mídia, nomes de pastas ou comportamentos de uso. Como o aplicativo roda inteiramente no seu computador, não há nada para nós coletarmos.

## O que fazemos

A única coisa que vemos é o que você escolhe nos enviar:

- **GitHub** — quando você relata um problema, estrela o repositório ou contribui, o GitHub coleta dados de acordo com sua própria [política de privacidade](https://docs.github.com/en/site-policy/privacy-policies)
- **Nosso site (encodex.in)** — um site respeitador da privacidade, sem cookies. Usamos análises simples e amigáveis à privacidade para ver visualizações de páginas agregadas — nunca vinculadas à sua identidade
- **Suporte** — se você nos enviar um e-mail, lemos a mensagem que você envia (obviamente)

## O site

O próprio site do EncodeX:

- Não exibe anúncios
- Não usa cookies de rastreamento de terceiros
- Usa análises amigáveis à privacidade (sem rastreamento entre sites, sem dados pessoais)

## Qual telemetria existe

Para sermos totalmente transparentes, aqui está cada dado que o EncodeX coleta — no site e no app:

### O site (encodex.in)

- **Contagens de página sem cookies.** Medimos visualizações de página agregadas com uma configuração de análise amigável à privacidade — sem cookies, sem rastreamento entre sites, sem replay de sessão e nada ligado à sua identidade. Não podemos ver quem você é.

### O app de desktop

- **Relatórios de erros e diagnóstico com consentimento.** O app pode enviar diagnósticos de falha e informações de erro anônimas ao Sentry — e fica **ativado por padrão, com uma chave visível nas Configurações** para desativar quando quiser. Tudo é controlado por uma única chave de consentimento (salvas localmente no seu dispositivo como `monitoring-consent.json` e `analytics-consent.json`).
- **Eventos de uso apenas por categorias.** Quando ativado, o app registra eventos anônimos e apenas categóricos — como "conversão iniciada" ou "perfil aplicado" — por um canal de análise de uso dedicado. Por design da taxonomia, esses dados **não contêm conteúdo de mídia, nomes de arquivo, caminhos de pasta nem tamanhos de arquivo.** Se você desativar a telemetria, nada sai do seu computador.
- **Sem uploads, sem processamento na nuvem.** Mesmo com a telemetria ativada, seus arquivos de mídia reais nunca são transmitidos. Codificar, converter, comprimir ou extrair acontece inteiramente no seu dispositivo.

### Em palavras simples

- Não há **conta** — nada para criar, nenhum perfil para manter
- Seus arquivos **nunca saem do seu computador** — sem uploads, sem processamento na nuvem
- O app funciona **totalmente offline** — a telemetria é a única coisa que pode se conectar; ela exige consentimento, é apenas categórica e pode ser desativada

## Como funciona

Não há nuvem para onde enviar seus arquivos. O EncodeX inclui o motor FFmpeg diretamente no aplicativo e executa cada conversão **como um processo no seu dispositivo** — da mesma forma que seu navegador da web renderiza uma página sem que ela seja „enviada a um servidor." Se quiser verificar, todo o aplicativo (incluindo seu pipeline de processamento de mídia) é de código aberto e está documentado na [arquitetura técnica](/pt/docs/architecture).

## Atualizações

Se alguma vez mudarmos a forma como o EncodeX lida com dados, atualizaremos esta página e indicaremos claramente a data da mudança acima. Como o aplicativo é de código aberto, você também pode revisar cada alteração no repositório.

## Perguntas

Preocupações com a privacidade? Abra uma issue no [GitHub](https://github.com/Sandeepv68/EncodeX) ou entre em contato através do site.

## Comece

- [Baixe o EncodeX gratuitamente](/pt/download)
- [Veja todas as conversões e funcionalidades](/pt/features)
- [Visão geral da interface FFmpeg](/pt/ffmpeg-gui)
