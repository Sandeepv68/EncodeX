# Uso do CLI

Compile primeiro e depois invoque o CLI compilado via comando `encodex` (o launcher `bin/encodex.js` envolve o binário do Electron). O modo CLI ativa-se automaticamente quando dois argumentos posicionais (entrada + saída) são fornecidos, ou explicitamente com `--cli`:

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

O uso plano legado (`encodex in.mp4 out.mp4`, `encodex --info in.mp4`) é convertido automaticamente por shim para o subcomando correspondente.

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
| `--hwaccel / --no-hwaccel`  | Alterna a aceleração por hardware                              |
| `--hwaccel-mode <auto\\|encode>` | Modo de aceleração por hardware (padrão: `auto`)          |
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

## Opções batch

| Option                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `--concurrency <n>`         | Máximo de conversões paralelas (padrão: `4`, limitado a 1–4)   |
| `--output-dir <dir>`        | Diretório de saída dos arquivos convertidos                    |
| `--suffix <s>`              | Sufixo anexado aos nomes de saída derivados (padrão: `_encodex_converted`) |

O batch também aceita todas as opções de encoding do convert (`-v/--video-codec`, `-a/--audio-codec`, `--bitrate-video`, `--bitrate-audio`, `-q/--qscale`, `--pix-fmt`, `-s/--scale`, `--copy`, `--no-audio`, `--no-video`) e as aplica a cada job.

## Códigos de saída

| Código | Constante                    | Significado                                    |
| ---- | ---------------------------- | ---------------------------------------------- |
| `0`  | `EXIT_CODES.SUCCESS`         | Sucesso limpo                                  |
| `1`  | `EXIT_CODES.ERROR`           | Erro genérico                                  |
| `2`  | `EXIT_CODES.USAGE`           | Argumentos inválidos/incompletos               |
| `3`  | `EXIT_CODES.CANCELLED`       | Operação cancelada pelo usuário                |
| `4`  | `EXIT_CODES.NOT_FOUND`       | Arquivo de entrada, FFmpeg ou FFprobe não encontrado |
| `5`  | `EXIT_CODES.TIMEOUT`         | Conversão excedeu o `--timeout`                |
