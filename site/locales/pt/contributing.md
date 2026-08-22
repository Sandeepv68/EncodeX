# Ajude a melhorar o EncodeX

O EncodeX é gratuito e construído por voluntários — e você não precisa ser programador para ajudar. Veja como qualquer pessoa pode contribuir:

- **Avise quando algo quebrar.** Se o app fechar sozinho ou um arquivo não converter, [abra uma issue](https://github.com/Sandeepv68/EncodeX/issues) e descreva o que aconteceu. Relatos de usuários comuns valem ouro.
- **Sugira ideias.** Gostaria que o EncodeX fizesse algo que ainda não faz? Conte pra gente — muitas funções nasceram de sugestões de usuários.
- **Traduza.** O EncodeX fala mais de 35 idiomas, e tradutores são sempre bem-vindos. Se faltar o seu ou ele soar estranho, você pode ajudar a resolver.
- **Espalhe a palavra.** Compartilhe o EncodeX com amigos, escreva uma avaliação ou faça um tutorial.

## Fale com a gente

Perguntas, ideias ou só quer dizer oi? Mande um e-mail direto para o desenvolvedor em **[developer@encodex.in](mailto:developer@encodex.in)** — o feedback dos usuários é sempre bem-vindo.

## Para desenvolvedores

Se quiser contribuir com código, comece assim:

### Desenvolvimento

```bash
npm run dev          # modo dev com recarga automática
npm run electron:dev # ambiente completo com janela Electron
npm run build        # build completo
npm start            # rodar o app compilado
```

### Convenções do projeto

- **TypeScript** — modo estrito, sem `any` quando der para evitar.
- **React** — componentes funcionais com hooks.
- **Estado** — stores Zustand para estado global.
- **IPC** — todos os canais definidos em `src/shared/ipc-channels.ts`.
- **Constantes** — valores fixos nos arquivos de constantes em `src/shared/`.
- **i18n** — todos os textos visíveis em `src/renderer/i18n/locales/`.

### Processo de Pull Request

1. Garanta que o build passa: `npm run build`
2. Atualize os arquivos de idioma se adicionar ou modificar textos da interface.
3. Mantenha cada PR focada em um único assunto.

## Código de conduta

O projeto segue o [Contributor Covenant](https://github.com/Sandeepv68/EncodeX/blob/main/CODE_OF_CONDUCT.md). Seja gentil e respeitoso — estamos todos aqui porque gostamos do projeto.
