# Gerenciador de atualizações

## Visão geral

Implementa um gerenciador de atualizações integrado personalizado (Opção C) que verifica o GitHub Releases em busca de novas versões, notifica o usuário, baixa o instalador específico da plataforma dentro do app com relatório de progresso e lança o instalador ao concluir.

## Arquitetura

```
GitHub Releases API
       |
  [main/updater.ts]   fetches /releases/latest, compares versions, downloads
       |
  [main/ipc/updater.ts]  registers IPC handlers + pushes events to renderer
       |
  [preload/index.ts]  exposes checkForUpdates / downloadUpdate / events
       |
  [renderer/stores/updateStore.ts]  Zustand state for update flow
       |
  [renderer/components/UpdateDialog.tsx]  MUI Dialog with progress bar
```

## Arquivos a criar

| Arquivo | Objetivo |
|------|---------|
| `src/main/updater.ts` | Lógica central de atualização: comparação de versões, busca de releases, seleção de assets, download com progresso, lançamento do instalador |
| `src/main/ipc/updater.ts` | Registro dos handlers IPC para os canais de atualização |
| `src/renderer/stores/updateStore.ts` | Store Zustand para o estado de atualização (checking, available, downloading, progress, downloaded, error) |
| `src/renderer/components/UpdateDialog.tsx` | Diálogo modal mostrando status da atualização, progresso do download e botão de instalação |
| `src/renderer/styles/UpdateDialog.styles.ts` | Componentes estilizados para o diálogo de atualização |

## Arquivos a modificar

| Arquivo | Mudança |
|------|--------|
| `src/shared/types.ts` | Adicionar as interfaces `UpdateInfo`, `UpdateAsset`, `UpdateProgress` |
| `src/shared/ipc-channels.ts` | Adicionar as constantes dos canais IPC de atualização |
| `src/shared/log-constants.ts` | Adicionar as constantes das mensagens de log de atualização |
| `src/main/ipc/handlers.ts` | Registrar os handlers do updater |
| `src/preload/index.ts` | Expor os métodos da ponte de atualização e as inscrições de eventos |
| `src/renderer/electron-api.d.ts` | Declarar os tipos da API de atualização no `ElectronAPI` |
| `src/renderer/pages/About.tsx` | Adicionar o botão "Verificar atualizações" |
| `src/renderer/App.tsx` | Montar o `UpdateDialog` globalmente |
| `src/test-setup.ts` | Adicionar os mocks da API de atualização ao stub global do electronAPI |
| `e2e/mocks/preload.js` | Adicionar os métodos da API de atualização ao preload mock |
| `e2e/mocks/main-store.js` | Nenhuma mudança necessária (o estado de atualização é efêmero) |

## Canais IPC

| Channel | Direção | Objetivo |
|---------|-----------|---------|
| `check-for-updates` | renderer -> main | Disparar a verificação de atualizações |
| `download-update` | renderer -> main | Iniciar o download do asset correspondente |
| `install-update` | renderer -> main | Lançar o instalador baixado |
| `cancel-download` | renderer -> main | Cancelar o download em andamento |
| `open-release-notes` | renderer -> main | Abrir a página do release no navegador |
| `update-available` | main -> renderer | Notificar que uma nova versão está disponível |
| `update-not-available` | main -> renderer | Notificar que o app está atualizado |
| `update-progress` | main -> renderer | Enviar o progresso do download |
| `update-downloaded` | main -> renderer | Notificar que o download foi concluído |
| `update-error` | main -> renderer | Enviar um erro de atualização |

## Comparação de versões

- Comparação semver simples: dividir por `.`, comparar numericamente.
- Remove sufixos pre-release (ex. `-beta.0`) para comparação.
- Retorna true se a versão remota for estritamente maior que a local.

## Lógica de seleção de assets

1. Filtrar os assets do release pela extensão da plataforma:
   - `win32` -> `.exe`
   - `darwin` -> `.dmg`
   - `linux` -> `.AppImage`
2. Dentro da plataforma, corresponder a arquitetura:
   - `x64` -> nome do arquivo contém `x64`
   - `arm64` -> nome do arquivo contém `arm64`
   - `ia32` -> nome do arquivo contém `ia32`
3. Recorrer ao primeiro asset correspondente à plataforma se nenhuma arquitetura corresponder.

## Fluxo de download

1. O renderer chama o IPC `download-update`.
2. O processo principal baixa para `app.getPath('temp')/EncodeX-updater/`.
3. O progresso é enviado via `update-progress` a cada ~300ms.
4. Ao concluir, `update-downloaded` é enviado com o caminho do instalador.
5. O renderer mostra o botão "Instalar e reiniciar".
6. Ao clicar, o processo principal lança o instalador via `shell.openPath()` + `app.quit()`.

## Estados da UI

| Estado     | O que o diálogo mostra |
|-------|-------------|
| `idle` | (diálogo oculto) |
| `checking` | Spinner + "Verificando atualizações..." |
| `available` | Informações da versão, link das notas do release, botão Baixar |
| `not-available` | Mensagem "Você está atualizado", botão Fechar |
| `downloading` | Barra de progresso com porcentagem + velocidade |
| `downloaded` | "Atualização pronta para instalar" + botão Instalar e reiniciar |
| `error` | Mensagem de erro + botões Tentar novamente / Fechar |

## Estratégia de testes

- Unitários: função de comparação de versões, função de seleção de assets.
- Manuais: publicar um tag/release de teste superior a `1.0.0-beta.0` e verificar
  o fluxo completo verificação -> download -> instalação na plataforma alvo.
