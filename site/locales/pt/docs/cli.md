# Uso do CLI

<!-- drift: cli-subcommands=8 -->

Compile primeiro e depois invoque o CLI compilado via comando `encodex` (o launcher `bin/encodex.js` envolve o binário do Electron). O modo CLI é ativado explicitamente com `--cli`, `-h`/`--help` ou qualquer nome de subcomando/alias, ou automaticamente quando pelo menos dois argumentos posicionais que não são flags (entrada + saída) são fornecidos:

```bash
# Convert a file (subcommand form)
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Convert a file (legacy flat form — still works)
encodex input.mp4 output.avi --video-codec libx265 --audio-codec aac

# Show media info as a human table
encodex info input.mp4

# Show media info as JSON
encodex info input.mp4 --json

# List transcoder capabilities
encodex capabilities
encodex capabilities --json

# Lossless copy to different container
encodex convert input.mkv output.mp4 --copy

# Cut a segment
encodex convert input.mp4 output.mp4 --start-time 00:01:00 --end-time 00:02:30

# Compress an image
encodex compress photo.png -f jpg -q 30

# Extract audio (mp3 by default)
encodex extract-audio input.mp4

# Batch-convert several files / globs
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted

# Use a specific transcoder core
encodex convert input.mp4 output.mp4 --transcoder FFTOOL
```

Uma vez que o modo CLI está ativo, o uso plano legado (`encodex in.mp4 out.mp4`, `encodex --info in.mp4`) é convertido automaticamente por shim para o subcomando correspondente. `encodex --info in.mp4` sozinho tem um argumento posicional e abre a GUI, a menos que `--cli` também seja passado.

Para tornar o `encodex` disponível globalmente, execute `npm link` na raiz do projeto (ou `npm install -g .`). A forma bruta `npx electron . --cli ...` continua funcionando como alternativa.

## Subcomandos

| Subcomando         | Descrição                                                         |
| ------------------ | ----------------------------------------------------------------- |
| `convert`          | Converter mídia (padrão quando nenhum subcomando corresponde). Alias: `c` |
| `info`             | Mostrar informações da mídia (tabela legível, ou `--json` para saída de máquina) |
| `capabilities`     | Listar as capacidades transcoder disponíveis (tabela ou `--json`) |
| `compress`         | Comprimir uma imagem                                              |
| `extract-audio`    | Extrair o stream de áudio (codec padrão `libmp3lame`). Alias: `audio` |
| `batch`            | Converter múltiplas entradas (arquivos, globs ou diretórios) com uma fila |
| `remux`            | Copiar streams de um arquivo para outro contêiner sem re-encodar. Alias: `rmx` |
| `demux`            | Extrair cada stream de um arquivo para um arquivo separado. Alias: `split` |

## Opções globais

As opções globais podem ser colocadas antes ou depois do nome do subcomando.

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--transcoder <type>`       | Núcleo transcoder: `FFMPEG`, `FFTOOL`, `BMF` (padrão: `FFMPEG`) |
| `--theme <id>`              | Tema de cores do logo: `light`, `ocean`, `sunset`, `forest`, `lavender`, `rose`, `slate`, `dark` (padrão: `light`) |
| `--verbose`                 | Logging detalhado (roteia status para stderr)                  |
| `--quiet`                   | Suprime a saída de status                                      |
| `--no-color`                | Desativa cores ANSI                                            |
| `--json`                    | Saída JSON legível por máquina (status roteado para stderr)    |
| `--timeout <seconds>`       | Timeout da conversão em segundos (padrão: `300`)               |

## Opções convert

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`       | Arquivo de saída (substitui a saída posicional)                |
| `-v, --video-codec <codec>` | Codec de vídeo (ex. `libx264`, `libx265`, `copy`)              |
| `-a, --audio-codec <codec>` | Codec de áudio (ex. `aac`, `libmp3lame`, `copy`)               |
| `-q, --qscale <qscale>`     | Escala de qualidade (1–31)                                     |
| `--bitrate-video <bitrate>` | Bitrate de vídeo (ex. `1000k`)                                 |
| `--bitrate-audio <bitrate>` | Bitrate de áudio (ex. `192k`)                                  |
| `--pix-fmt <format>`        | Formato de pixel (ex. `yuv420p`, `yuv444p`)                    |
| `-s, --scale <WxH>`         | Resolução de saída (ex. `1280x720` ou `50%`)                   |
| `--start-time <time>`       | Tempo inicial (`HH:MM:SS` ou segundos)                         |
| `--end-time <time>`         | Tempo final                                                    |
| `--duration <time>`         | Duração                                                        |
| `--copy`                    | Cópia de stream sem perdas                                     |
| `--no-audio`                | Exclui o stream de áudio da saída                              |
| `--no-video`                | Exclui o stream de vídeo da saída (somente áudio)              |
| `--hwaccel`                 | Ativa a aceleração por hardware                                |
| `--hwaccel-mode <auto\\|encode>` | Modo de aceleração por hardware (padrão: `auto`)          |
| `--filters <chain>`         | Cadeia de filtros de vídeo (separada por vírgulas)             |
| `--preset <preset_id>`      | Preset de filtro de vídeo curado (repetível)                   |
| `--info`                    | Imprime informações da mídia da entrada e sai                  |

## Opções compress

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`       | Arquivo de saída                                               |
| `-f, --format <format>`     | Formato de saída (por padrão, derivado da extensão de saída)   |
| `-q, --quality <qscale>`    | Escala de qualidade 1–31                                       |
| `-s, --scale <WxH>`         | Resolução de saída                                             |

## Opções extract-audio

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `-o, --output <file>`       | Arquivo de saída                                               |
| `-a, --audio-codec <codec>` | Codec de áudio (padrão: `libmp3lame`)                          |
| `--bitrate-audio <bitrate>` | Bitrate de áudio (ex. `192k`)                                  |

## Opções remux

| Opção | Descrição |
| --- | --- |
| `-o, --output <file>` | Arquivo de saída (padrão: caminho de entrada com a extensão de destino) |
| `-f, --format <container>` | Contêiner de destino (ex. `mkv`, `mp4`, `mov`) |
| `--map <spec>` | Stream a copiar como `0:<tipo>:<ordinal>` (repetível; padrão: todos os streams) |
| `--add-subtitle <file[::codec]>` | Incorporar um arquivo de legenda externo (repetível); codec opcional por arquivo |
| `--add-audio <file>` | Incorporar um arquivo de áudio externo (repetível) |
| `--thumbnail <image>` | Incorporar capa (MKV/WebM como anexo, MP4/MOV via disposition) |
| `--chapters <file>` | Importar capítulos de um arquivo FFMETADATA |
| `--no-chapters` | Descartar os capítulos da origem em vez de copiá-los |
| `--subtitle-codec <codec>` | Codec de legenda para as legendas adicionadas (padrão: a primeira escolha do contêiner) |
| `--no-subtitles` | Descartar streams de legenda da origem |
| `--audio-sync <seconds>` | Deslocar o áudio do arquivo principal (positivo = mais tarde) |
| `--set-sync <seconds>` | Deslocar a entrada de legenda/áudio adicionada anterior (repetível) |
| `--filters <chain>` | Cadeia de filtros de vídeo (repetível); filtros forçam re-encode |

## Opções demux

| Opção | Descrição |
| --- | --- |
| `--output-dir <dir>` | Diretório para os streams extraídos (criado se não existir) |
| `--video` | Extrair somente streams de vídeo |
| `--audio` | Extrair somente streams de áudio |
| `--subtitles` | Extrair somente streams de legenda |
| `--all` | Extrair todos os tipos de stream (padrão) |
| `--video-container <ext>` | Re-encodar o vídeo para este contêiner (ex. `mp4`, `mkv`) |
| `--audio-codec <codec>` | Re-encodar o áudio com este encoder (ex. `mp3`, `flac`, `aac`) |
| `--subtitle-format <format>` | Converter legendas de texto para este formato (`srt`, `ass`, `copy`) |
| `--video-filters <chain>` | Cadeia de filtros para o stream de vídeo re-encodado (repetível) |

## Opções batch

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--concurrency <n>`         | Máximo de conversões paralelas (padrão: `4`, limitado a 1–4)   |
| `--output-dir <dir>`        | Diretório de saída dos arquivos convertidos                    |
| `--suffix <s>`              | Sufixo anexado aos nomes de saída derivados (padrão: `_encodex_converted`) |

O batch também aceita todas as opções de encoding do convert (`-v/--video-codec`, `-a/--audio-codec`, `--bitrate-video`, `--bitrate-audio`, `-q/--qscale`, `--pix-fmt`, `-s/--scale`, `--copy`, `--no-audio`, `--no-video`, `--filters`, `--preset`) e as aplica a cada job.

## Modo de servidor MCP {#mcp-server-mode}

O EncodeX pode rodar como um servidor [Model Context Protocol](https://modelcontextprotocol.io) headless para que hosts MCP (Claude Desktop, Claude Code, VS Code, Cursor, agentes personalizados) possam conduzir conversões. Trata-se de um **modo**, não de um subcomando: passe `--mcp` e o app ignora os ramos GUI e CLI para falar JSON-RPC via stdio.

```bash
# Packaged app
encodex --mcp

# Source checkout (compiled Node entry point — run npm run build:main first)
node dist/mcp/index.js

# Raw Electron form
npx electron . --mcp
```

O stdout fica reservado para mensagens JSON-RPC do MCP; toda a saída de status e logs é redirecionada para o stderr, e o processo permanece ativo até o stdin ser fechado. O servidor stdio expõe 36 ferramentas visíveis ao modelo (37 registros, incluindo a `commit_operation`, somente para o app), com 3 recursos e 4 prompts. A superfície HTTP integrada adiciona 6 ferramentas de GUI, totalizando 42 ferramentas visíveis ao modelo (43 registros) — veja a [referência de funcionalidades](/pt/docs/features-reference#mcp-server) para o catálogo completo.

| Opção    | Descrição                                                           |
| -------- | ------------------------------------------------------------------- |
| `--mcp`  | Executa como um servidor MCP stdio (sem GUI, sem subcomando CLI, sem `app.exit`) |

Uma segunda superfície, opcional, é o **servidor HTTP integrado** dentro da GUI em execução (`http://127.0.0.1:8765/mcp`), que adiciona ferramentas de fila ao vivo, prévia, linha do tempo, sistema e atualizações sobre o mesmo núcleo. Ative-o em **Configurações → MCP Server**; veja a [referência de funcionalidades](/pt/docs/features-reference#mcp-server) para o modelo de segurança.

## Códigos de saída

| Código | Constante                    | Significado                                    |
| ---- | ---------------------------- | ---------------------------------------------- |
| `0`  | `EXIT_CODES.SUCCESS`         | Sucesso limpo                                  |
| `1`  | `EXIT_CODES.ERROR`           | Erro genérico                                  |
| `2`  | `EXIT_CODES.USAGE`           | Argumentos inválidos/incompletos               |
| `3`  | `EXIT_CODES.CANCELLED`       | Operação cancelada pelo usuário                |
| `4`  | `EXIT_CODES.NOT_FOUND`       | Arquivo de entrada, FFmpeg ou FFprobe não encontrado |
| `5`  | `EXIT_CODES.TIMEOUT`         | Conversão excedeu o `--timeout`                |
