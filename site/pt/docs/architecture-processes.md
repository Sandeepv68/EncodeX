# Processos, sistema de build & inicialização

## Modelo de processos

### Processo principal (`src/main/`)

Ambiente Node.js. Possui o ciclo de vida da aplicação e todas as capacidades privilegiadas:

- Cria as `BrowserWindow`s splash e principal e registra os handlers IPC (`index.ts`).
- Hospeda o ponto de entrada do CLI (`cli/`).
- Resolve o caminho dos binários FFmpeg/FFprobe e analisa as capacidades dos encoders (`capabilities.ts`, `process-utils.ts`).
- Implementa os núcleos transcoders (`transcoders/`).
- Executa a fila de lotes com concorrência limitada (1-4 jobs paralelos) (`queue/job-queue.ts`).
- Decodifica frames de vídeo e áudio PCM para o player embutido (`player/frame-decoder.ts`).
- Extrai formas de onda e montagens de miniaturas (`timeline/timeline-media.ts`).
- Lê dados EXIF, histogramas, dimensões de imagem e previews (`image-*.ts`, `video-preview.ts`).
- Ponteia a saída de `console` do renderer para o sistema de logs (`patchConsole` em `index.ts`).

### Script preload (`src/preload/index.ts`)

Roda em um contexto isolado. Usa `contextBridge.exposeInMainWorld('electronAPI', api)` para expor ao renderer uma API curada e tipada. Cada método é um wrapper fino sobre `ipcRenderer.invoke` (request/response) ou `ipcRenderer.send` (fire-and-forget), e cada inscrição de evento retorna uma função de limpeza que remove seu listener. Nada mais de Electron ou Node vaza para o renderer.

### Processo renderer (`src/renderer/`)

Ambiente de navegador servido pelo Vite em desenvolvimento e carregado de `dist/renderer/index.html` em produção. React puro — sem APIs Node. Interage com o processo principal apenas através de `window.electronAPI` (tipada em `electron-api.d.ts`).

### Camada compartilhada (`src/shared/`)

TypeScript puro, importado pelos três processos. Contém o registro de canais IPC, tipos de domínio, sistema de erros, logger, constantes, listas de codecs, helpers de validação e constantes de mensagens de log. Como o `package.json` não usa fronteiras de pacotes separadas, este diretório é referenciado via imports relativos da raiz de cada processo.

## Sistema de build

Três projetos TypeScript mais Vite produzem três pastas de saída:

| Script                   | Compila                     | Saída             |
| ------------------------ | --------------------------- | ----------------- |
| `build:renderer`         | `vite build`                | `dist/renderer/`  |
| `build:main`             | `tsc -p tsconfig.main.json` | `dist/main/`      |
| `build:preload`          | `tsc -p tsconfig.preload.json` | `dist/preload/` |

O `npm run build` executa os três em sequência. O processo principal carrega o preload de `dist/preload/index.js` e o renderer de `dist/renderer/index.html` (produção) ou do servidor dev do Vite (desenvolvimento, flag `--dev` ou `NODE_ENV=development`).

O Electron-builder empacota o app para Windows (NSIS), macOS (DMG) e Linux (AppImage), agrupando `ffmpeg-static` e `ffprobe-static` como `extraResources` para que os binários viajem com o app. O workflow de release no CI baixa os binários pré-compilados de cada plataforma/arquitetura alvo via `scripts/fetch-media-binaries.mjs`.

### Resolução de binários

Toda resolução de binários FFmpeg/FFprobe é centralizada em `src/main/media-binaries.ts` (`getFfmpegPath` / `getFfprobePath`), consumida por cada transcoder, o decodificador de frames, timeline media, previews de imagem/vídeo e o CLI. A cadeia de fallback é:

1. **App empacotado**: os binários agrupados como `extraResources` sob o diretório `resources` do Electron (`resources/ffmpeg-static/...` e `resources/ffprobe-static/...`, este último usando o subcaminho específico de plataforma/arquitetura).
2. **Não empacotado (dev/CLI/testes)**: os binários instalados `node_modules/ffmpeg-static` e `node_modules/ffprobe-static` (resolvidos via chave `import` no mapa `exports` de cada pacote, então também funciona a partir de ESM).
3. O comando do sistema (`ffmpeg` / `ffprobe`) do `PATH`.

## Sequência de inicialização

1. `main/index.ts` roda. Ele inspeciona `process.argv` em `isCliMode()`.
2. **Modo CLI** (`--cli`/`--help` explícitos, ou >=2 argumentos posicionais): não registra janelas. Em `app.whenReady()`, chama `runCli()` e sai com códigos `SUCCESS` ou `ERROR`.
3. **Modo GUI**: habilita o switch `autoplay-policy`, cria uma janela splash não interativa (exibida imediatamente), depois a janela principal sem moldura (`show: false`).
4. `registerIpcHandlers(mainWindow)` conecta todos os módulos IPC; `patchConsole` substitui `console.*` para que logs do processo principal sejam repassados ao renderer pelo canal `log-message`.
5. A janela principal é exibida no `ready-to-show`, momento em que a splash é fechada.
6. Em produção, o renderer é carregado de `dist/renderer/index.html`; em desenvolvimento, de `http://localhost:5173` com DevTools abertos.

## Modo CLI

O `src/main/cli/cli.ts` usa **commander** com subcomandos. Quando `runCli()` executa:

1. Um shim legado mapeia o uso plano (`encodex in.mp4 out.mp4` -> `convert`, `encodex --info in.mp4` -> `info`) para o subcomando correspondente.
2. Cada subcomando faz o parse das próprias opções mais as globais compartilhadas (`--transcoder`, `--theme`, `--verbose`, `--quiet`, `--no-color`, `--json`, `--timeout`).
3. `info`/`capabilities` imprimem tabelas legíveis por padrão e JSON com `--json`.
4. `convert`/`compress`/`extract-audio`/`batch` constroem um objeto `ConversionOptions` e chamam `transcoder.convert(...)` (batch dirige uma `JobQueue` em memória com um `MultiBar`).
5. O progresso vai para o `stdout` (com um watchdog timeout), as linhas de status/sucesso respeitam o roteamento `--json`/`--quiet`/`--verbose`, e o processo termina via `mapCliErrorToExitCode` (usage=2, cancelado=3, não encontrado=4, timeout=5, sucesso=0).

O CLI reutiliza exatamente o mesmo pipeline de transcoder da GUI — não há caminho de codificação separado para manter.

## Camada de código compartilhado

A decisão arquitetural mais importante é que todos os contratos entre processos vivem em `src/shared/`:

- **`types.ts`** — `ConversionOptions`, `MediaInfo`, `MediaStreamInfo`, `QueueJob`, `ConversionProgress`, `PlayerFrame`, `PlayerAudioChunk`, `WaveformData`, `ThumbnailStrip`, `EncoderCapabilities`, `LogEntry`, `FileItem`, `ConversionOperation`, `UpdateInfo`, `UpdateAsset`, `UpdateProgress`.
- **`ipc-channels.ts`** — o objeto constante `IPC`, fonte única de verdade para toda string de canal. Main, preload e renderer todos importam dele, então um nome de canal nunca pode divergir entre processos.
- **`errors.ts`** — o sistema de erros tipado (veja [Tratamento de erros](/pt/docs/architecture-renderer#error-handling)).
- **`constants.ts` / `app-constants.ts`** — limites numéricos e valores de layout da UI (tamanhos de janela, buckets da forma de onda, dimensões de miniaturas, teto do histórico de erros etc.).
- **`transcoder-constants.ts` / `hwaccel-settings.ts`** — flags FFmpeg, padrões, padrões de progresso e configurações de aceleração por hardware.
- **`media-options.ts` / `codec-containers.ts` / `codec-classification.ts`** — as listas curadas de 51 codecs de vídeo, 27 codecs de áudio, 56 formatos de pixel, regras de compatibilidade de contêiner e helpers de família de codecs.
- **`validation.ts`** — funções puras para validação de tempo/escala/bitrate/faixa, usadas tanto pelos formulários do renderer quanto pelo CLI.
- **`logger.ts` / `log-constants.ts`** — um logger com timestamp e ~406 templates compartilhados de mensagens de log para que os logs sejam consistentes entre processos.
