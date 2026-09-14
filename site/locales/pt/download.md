# Baixar o EncodeX

O EncodeX é **grátis** e funciona no Windows, Mac e Linux. Uma interface gráfica de código aberto para FFmpeg — sem conta, sem marca d'água e sem limite de tamanho: tudo roda no seu computador.

::: tip É a primeira vez aqui? Veja o que vem a seguir
Instale o aplicativo, arraste um vídeo ou uma imagem para a janela, escolha um perfil (como MP4 ou "arquivo menor") e clique em **Converter** — pronto. Tudo roda localmente no seu computador.

- **Novo no EncodeX?** Veja [exemplos do que você pode fazer](/pt/use-cases) ou [explore as ferramentas](/pt/features).
- **Travou?** A maioria das conversões exige apenas soltar um arquivo + um clique no perfil. O cartão "Primeiros passos" do seu painel orienta você na escolha de um objetivo.
:::

## <OsIcon name="windows" /> Windows

**Windows 10/11 · 64 bits** — serve para quase todo mundo.

<LatestDownloads platform="windows" />

**Para instalar:** abra o arquivo baixado e siga os passos na tela.

Não sabe qual escolher? Vá no recomendado — se não for compatível, o Windows avisa.

### Outras plataformas

[macOS](#mac) · [Linux](#linux) · [Windows ARM64](#windows) · [Windows 32 bits](#windows)

## <OsIcon name="apple" /> Mac

<LatestDownloads platform="macos" />

**Para instalar:** abra o arquivo `.dmg` baixado e arraste o EncodeX para a pasta Aplicativos.

**Não sabe qual é o seu Mac?** Clique no logo da Apple (<OsIcon name="apple" label="Logo da Apple" />) no canto superior esquerdo, escolha "Sobre este Mac" e veja a linha "Chip". Se aparecer "Apple M1" (ou M2/M3/M4), escolha Apple Silicon. Se aparecer "Intel", escolha Intel.

::: warning Primeira abertura no Mac — um passo extra
Como o EncodeX é gratuito e de código aberto (e não é vendido na Mac App Store), o macOS pode mostrar uma mensagem dizendo que o app "não pode ser aberto" na primeira vez. É normal e seguro de resolver:

1. Encontre o EncodeX na pasta Aplicativos
2. Segure a tecla **Control**, clique no app e escolha **Abrir**
3. Na janela que aparecer, clique em **Abrir** de novo

Só precisa fazer isso uma vez — depois abre normalmente.
:::

## <OsIcon name="linux" /> Linux

<LatestDownloads platform="linux" />

**Para rodar:** um AppImage é um arquivo único — sem instalação. Deixe executável e dê dois cliques:

```bash
chmod +x EncodeX-*.AppImage
./EncodeX-*.AppImage
```

(Muitos ambientes gráficos também permitem pular o terminal: clique com o botão direito no arquivo → Propriedades → permitir executar, e dê dois cliques.)

## O que seu computador precisa

Nada de especial — se o computador tiver alguns anos no máximo, está tudo bem:

- **Sistema:** Windows 10+, macOS 11+ ou um Linux moderno
- **Disco:** cerca de 400 MB (o app já vem completo — nada extra para baixar)
- **Memória:** qualquer quantidade normal serve

## Mantendo tudo atualizado

Quando sai uma versão nova, o EncodeX avisa dentro do app e pode baixar e iniciar a atualização por você — sem precisar voltar a esta página.

## Versões anteriores

Precisa de uma versão mais antiga? Abra a versão desejada abaixo — cada arquivo mostra o tamanho e o checksum SHA-256.

<LatestDownloads older />

## Precisa de ajuda?

Se algo não funcionar ou surgir alguma dúvida, mande um e-mail para **[developer@encodex.in](mailto:developer@encodex.in)** — uma pessoa de verdade responde.

## Privacidade

Sabemos que a confiança importa. Cada conversão acontece no seu computador — seus arquivos nunca são enviados, rastreados ou armazenados em um servidor. Leia a [política de privacidade completa](/pt/privacy).

## Para desenvolvedores: compile você mesmo

Prefere compilar do código-fonte? Clone o repositório e rode:

```bash
git clone https://github.com/Sandeepv68/EncodeX.git
cd EncodeX
npm install
npm run dist
```

O instalador será criado na pasta `release/`.
