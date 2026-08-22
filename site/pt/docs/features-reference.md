# Funcionalidades

O EncodeX é uma ferramenta multimídia de conversão multiplataforma que traz o poder do FFmpeg para uma interface desktop moderna e intuitiva. Construído com Electron, React e TypeScript, permite converter mídia entre formatos, extrair áudio, cortar vídeos e comprimir imagens — tudo por meio de uma UI limpa e responsiva com fila de lotes, aceleração por hardware, modo CLI e internacionalização completa.

## Visão geral das funcionalidades

### Conversão de mídia

Converta entre formatos de vídeo/áudio com controle granular sobre a seleção de codecs (51 codecs de vídeo entre famílias de encoders por software e hardware, 27 codecs de áudio), bitrate, resolução de saída (com preservação opcional do aspect ratio), formato de pixel (56 formatos agrupados por profundidade de bits), escala de qualidade (qscale), inclusão da faixa de áudio e seleção do núcleo transcoder. Vários arquivos podem ser enfileirados pela Fila de lotes (veja abaixo).

### Cópia sem perdas

Cópia de stream de vídeo ou áudio sem re-encoding (`-c copy`). Útil para mudanças rápidas de contêiner, remuxing ou quando a preservação da qualidade é crítica.

### Aceleração por hardware

Encoding acelerado por hardware com detecção automática das famílias de encoders disponíveis. Suporta NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, Apple VideoToolbox e encoders Microsoft Media Foundation. A aceleração pode ser ativada/desativada, com um seletor de modo — `auto` adiciona as flags FFmpeg `-hwaccel` correspondentes à família de encoders de hardware selecionada, `encode` depende da própria aceleração do encoder — e um filtro de tipo de encoder (`auto` / `hardware` / `software`) que restringe o seletor de codecs de vídeo a todos, apenas GPU ou apenas CPU. Os encoders disponíveis são analisados em runtime a partir do binário FFmpeg embutido, e os seletores de codecs são filtrados conforme o que o binário realmente oferece.

### Informações de mídia

Analise arquivos de mídia e inspecione informações detalhadas por stream: codec, profile, level, resolução, aspect ratio de exibição, formato de pixel, profundidade de bits, color range/space/transfer/primaries, frame rate, bitrate, sample rate, sample format, contagem/layout de canais, duração, tempo inicial, contagem de frames, idioma e tags. Funciona com streams de vídeo, áudio e legendas.

### Compressão de imagens

Comprima imagens (JPEG, PNG, WebP, BMP, GIF, TIFF, PPM, PGM, PBM) com escala de qualidade e redimensionamento de resolução configuráveis usando os codecs de imagem do FFmpeg. Inclui preview em tempo real, leitura do tamanho do arquivo e — para entradas JPEG/PNG/WebP — um painel completo de metadados EXIF com histogramas RGB e luma.

### Extração de áudio

Extraia faixas de áudio de arquivos de vídeo. Saída em AAC, MP3, AC3, FLAC, WAV, Vorbis, Opus, ALAC ou qualquer um dos 27 codecs de áudio suportados. O stream de áudio de origem é selecionável quando há múltiplas faixas.

### Corte de vídeo

Visualize e corte segmentos de vídeo com seleção de início/fim precisa a quadro ou por duração. Inclui um player embutido que decodifica quadros de vídeo (via pipe rawvideo do FFmpeg para um elemento Canvas HTML) e áudio (via um pipe S16LE PCM separado convertido para float e alimentado à Web Audio API) em sincronia, com uma timeline multitrilha com zoom: montagem de miniaturas de vídeo, forma de onda de áudio, sombreamento manter/esmaecer da região, alças de corte arrastáveis e cabeça de reprodução com scrub.

### Fila de lotes

Processe vários arquivos com operações configuráveis (transcodificação, extração de áudio, compressão de imagem). Os jobs são adicionados por um diálogo de revisão onde nomes de saída e opções podem ser ajustados antes de entrarem na fila.

- **Processamento paralelo** — até 4 jobs simultâneos (`MAX_QUEUE_CONCURRENCY = 4`); o limite de concorrência é configurável em runtime e persistido.
- **Ciclo de vida da fila** — iniciar, pausar e retomar toda a fila; cancelar tudo; limpar jobs concluídos/falhos; remover jobs individuais.
- **Reordenação** — reordenação por arrastar e soltar dos jobs na fila (com área de soltar), apoiada pelo canal `QUEUE_MOVE_TO` que reporta a nova posição do job.
- **Edição de jobs** — substituir as opções (e opcionalmente o caminho de saída) de qualquer job na fila antes de iniciar (`QUEUE_UPDATE_OPTIONS`).
- **Export / import** — salvar a fila em um arquivo JSON e reimportá-la depois (`QUEUE_EXPORT` / `QUEUE_IMPORT`), validado com um código de erro dedicado `INVALID_QUEUE_FILE`.
- **Persistência** — o snapshot da fila (jobs + concorrência) é salvo de forma durável em `queue-state.json` no diretório user-data e restaurado na inicialização.
- **Filtros de status** — filtrar a lista de jobs por queued / running / done / failed, além de um campo de busca focável.
- **Ações de energia ao terminar** — opcionalmente desligar, suspender ou hibernar a máquina quando a fila esvaziar (`shutdown`, `pmset` ou `systemctl` por plataforma; Windows respeita uma flag de fechamento forçado).
- **Feedback ao vivo** — progresso por job em tempo real (percentual, tempo, velocidade, ETA) transmitido via IPC, tratamento de erros por job e um badge de contagem na navegação mostrando o trabalho pendente.

### Múltiplos núcleos transcoder

- **API FFmpeg** — bindings Node.js fluent-ffmpeg com eventos de progresso programáticos
- **CLI FFmpeg** — invocação direta do CLI via processo filho, sem bindings nativos
- **Framework BMF** — ferramentas CLI BMF para cenários avançados de pipeline (requer instalação separada)

### Configurações

Página dedicada de configurações para tema, aceleração por hardware (ativar/desativar, modo, tipo de encoder), janela sempre no topo, iniciar com o sistema, concorrência da fila de lotes e ação de energia ao terminar. As preferências persistem no `localStorage` e entram em vigor na inicialização.

### Atalhos de teclado

Um registro central de atalhos (`src/renderer/constants/shortcuts.ts`) define mais de 60 atalhos em nove seções (global, convert, media info, image compress, audio extract, video cut, batch queue, logs, dashboard). Destaques:

- `Ctrl+/` — abrir o diálogo de ajuda de atalhos
- `Alt+1`…`Alt+9` — pular diretamente para uma página
- `Ctrl+O` / `Ctrl+Shift+S` / `Ctrl+Enter` — escolher entrada / escolher saída / iniciar o job (consistente entre páginas)
- `Ctrl+Shift+P` / `Ctrl+Shift+C` — pausar / cancelar o job ativo
- Fila de lotes: `Ctrl+E` exportar, `Ctrl+I` importar, `1`–`5` filtros de status, `F` focar busca
- Player video cut: `Espaço` play/pause, `M` mudo, setas para buscar posição

As combinações são reconhecidas por `event.code`, então funcionam independentemente do layout do teclado. Os tooltips derivam seu texto de dica do mesmo registro.

### Blips de atividade & popover de job

Enquanto uma conversão, extração de áudio ou corte de vídeo está em execução, um blip piscante aparece na linha de navegação correspondente; a linha Batch Queue mostra uma contagem ao vivo dos jobs pendentes. Passar o mouse (ou focar via teclado) num blip abre um popover ancorado nele com o título do job, status localizado (incluindo estado pausado e badge de concorrência paralela), miniatura do arquivo de origem, nome do arquivo e uma barra de progresso ao vivo — além de uma pilha de miniaturas de jobs pendentes enquanto um lote avança. O popover usa sombra suave e sua seta aponta para o blip.

### Confirmação de fechamento

Fechar a janela com jobs ativos passa por um fluxo de confirmação: o processo principal consulta o renderer (`WINDOW_CLOSE_REQUESTED`), que mostra um diálogo listando o trabalho ativo antes de confirmar o fechamento (`WINDOW_CONFIRM_CLOSE`). Uma tela splash aparece na inicialização enquanto a janela principal carrega.

### Dashboard

Uma página inicial com tiles de ações rápidas para cada ferramenta (teclas numéricas `1`–`6` pulam direto para elas) e branding sazonal de easter egg (veja abaixo).

### Easter Eggs

Em datas festivas, o Dashboard troca o logo padrão do app por arte temática — Natal, Halloween, Ano Novo, 4 de julho, Páscoa, Diwali e Holi. Cada festa fica ativa numa janela de 7 dias ao redor de sua data; Diwali e Holi seguem o calendário lunissolar hindu por meio de datas curadas (2026–2035) com cálculo astronômico de fallback para outros anos.

### Logs

Visualizador de logs em tempo real que agrega a saída do console dos processos principal e renderer via IPC. Suporta filtragem por nível (DEBUG/INFO/WARN/ERROR), limpeza e download do log como `.txt`.

### Notificações

Notificações toast (success/info/warning/error) com duração configurável para feedback não bloqueante, sobrepostas à snackbar global de erros.

### Moldura de janela personalizada

Janela do aplicativo sem moldura com barra de título personalizada fornecendo controles minimizar / alternar maximizar / fechar, área arrastável e suporte a sempre no topo. Uma tela splash não interativa é exibida enquanto a janela principal carrega.

### Tema claro / escuro

Detecção de tema consciente do sistema com alternância manual. A preferência de tema persiste no `localStorage` (chave `encodex-theme`).

### Suporte a RTL

Layout da direita para a esquerda para locales árabe e hebraica (`ar-SA`, `ar-AE`, `ar-JO`, `he-IL`). A direção alterna automaticamente na troca de idioma por um plugin de estilo RTL do Emotion.

### Internacionalização

56 locales em 35 idiomas:

| Idioma      | Locales                                    |
| ----------- | ------------------------------------------ |
| Inglês      | `en-US`, `en-GB`, `en-IN`, `en-CA`, `en-AU`, `en-SG`, `en-ZA`, `en-NZ`, `en-IE` |
| Espanhol    | `es-ES`, `es-MX`, `es-AR`, `es-CL`         |
| Francês     | `fr-FR`, `fr-CA`, `fr-BE`                  |
| Hindi       | `hi-IN`                                    |
| Alemão      | `de-DE`, `de-BE`                           |
| Italiano    | `it-IT`                                    |
| Holandês    | `nl-NL`, `nl-BE`                           |
| Sueco       | `sv-SE`                                    |
| Norueguês   | `nb-NO`                                    |
| Português   | `pt-BR`, `pt-PT`                           |
| Ucraniano   | `uk-UA`                                    |
| Russo       | `ru-RU`                                    |
| Polonês     | `pl-PL`                                    |
| Tailandês   | `th-TH`                                    |
| Cingalês    | `si-LK`                                    |
| Mongol      | `mn-MN`                                    |
| Malaio      | `ms-MY`, `ms-SG`                           |
| Chinês      | `zh-SG`, `zh-TW`                           |
| Japonês     | `ja-JP`                                    |
| Coreano     | `ko-KR`                                    |
| Indonésio   | `id-ID`                                    |
| Filipino    | `fil-PH`, `tl-PH`                          |
| Afrikaans   | `af-ZA`                                    |
| Hebraico    | `he-IL`                                    |
| Árabe       | `ar-SA`, `ar-AE`, `ar-JO`                  |
| Nepalês     | `ne-NP`                                    |
| Khmer       | `km-KH`                                    |
| Vietnamita  | `vi-VN`                                    |
| Laosiano    | `lo-LA`                                    |
| Maori       | `mi-NZ`                                    |
| Islandês    | `is-IS`                                    |
| Groenlandês | `kl-GL`                                    |
| Irlandês    | `ga-IE`                                    |
| Finlandês   | `fi-FI`                                    |
| Dinamarquês | `da-DK`                                    |

### Atualizações integradas

Gerenciador de atualizações personalizado que verifica o GitHub Releases por novas versões, notifica o usuário sobre a disponibilidade, baixa o instalador específico da plataforma (`.exe` / `.dmg` / `.AppImage`) dentro do app com relatório de progresso em tempo real e lança o instalador ao concluir. A comparação de versões usa semver com remoção de sufixos pre-release. O fluxo de atualização é totalmente integrado à página About com um botão "Verificar atualizações" e um diálogo global.

### Tratamento de erros

Sistema de erros estruturado com códigos tipados (`ErrorCode`), mensagens localizadas voltadas ao usuário, snackbar global de erros, banners de erro inline, notificações toast, React error boundaries aninhadas e histórico de erros integrado (limite 50). Todos os erros são normalizados por `formatError()` e propagados via IPC.

## Formatos de mídia suportados

### Codecs de vídeo (51)

| Grupo                      | Codecs                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Software (28)**          | H.264 (libx264, libx264rgb), H.265/HEVC (libx265, Kvazaar), VP8 (libvpx), VP9 (libvpx-vp9), AV1 (libaom-av1, SVT-AV1, rav1e), MPEG-4 (libxvid, mpeg4), MPEG-1, MPEG-2, Theora, JPEG 2000 (libopenjpeg), WebP (libwebp, libwebp_anim), ProRes (prores, prores_ks), Huffyuv, FFV1, Ut Video, MJPEG, PNG, TIFF, VC-2, AVS (libxavs, libxavs2) |
| **NVIDIA NVENC (3)**       | H.264 (h264_nvenc), H.265 (hevc_nvenc), AV1 (av1_nvenc)                                                                                                                                                                                                                                                                                    |
| **Intel QSV (5)**          | H.264, H.265, MPEG-2, VP9, AV1                                                                                                                                                                                                                                                                                                             |
| **AMD AMF (3)**            | H.264, H.265, AV1                                                                                                                                                                                                                                                                                                                          |
| **VAAPI (6)**              | H.264, H.265, MJPEG, VP8, VP9, AV1                                                                                                                                                                                                                                                                                                         |
| **Apple VideoToolbox (4)** | H.264, H.265, ProRes, VP9                                                                                                                                                                                                                                                                                                                  |
| **Media Foundation (2)**   | H.264, H.265                                                                                                                                                                                                                                                                                                                               |

### Codecs de áudio (27)

| Grupo             | Codecs                                                    |
| ----------------- | --------------------------------------------------------- |
| **AAC/MPEG**      | AAC (nativo, FDK), MP3 (LAME, libshine), MP2 (libtwolame) |
| **Dolby**         | AC-3, E-AC-3, TrueHD, DTS, MLP                            |
| **Sem perdas**    | FLAC, ALAC, WavPack                                       |
| **Streaming**     | Vorbis, Opus, Speex, AMR-WB                               |
| **PCM**           | s16le, s24le, f32le, s16be, u8, A-law, Mu-law             |
| **Windows Media** | WMA v1, WMA v2                                            |
| **Outros**        | ADPCM IMA (WAV)                                           |

### Formatos de pixel (56)

| Grupo                | Formatos                                                                               |
| ------------------- | -------------------------------------------------------------------------------------- |
| **YUV 8-bit**       | yuv420p, yuv422p, yuv444p, yuv410p, yuv411p, yuv440p, yuvj420p, yuvj422p, yuvj444p     |
| **YUV 10-bit**      | yuv420p10le, yuv422p10le, yuv444p10le                                                  |
| **YUV 12-bit**      | yuv420p12le, yuv422p12le, yuv444p12le                                                  |
| **YUV 16-bit**      | yuv420p16le, yuv444p16le                                                               |
| **YUV semi-planar** | nv12, nv21, nv16, nv20le                                                               |
| **YUV com alpha**   | yuva420p, yuva422p, yuva444p, yuva420p10le, yuva444p10le, yuva444p16le                 |
| **RGB empacotado**  | rgb24, bgr24, rgb0, bgr0, rgba, bgra, argb, abgr, rgb48le, bgr48le, rgba64le, bgra64le |
| **RGB planar**      | gbrp, gbrp10le, gbrp12le, gbrp16le, gbrap, gbrap10le, gbrap16le                        |
| **Monocromático**   | gray, gray10le, gray12le, gray16le, grayf32le, ya8, ya16le                             |
| **HDR**             | p010le, p016le, x2rgb10le                                                              |

### Extensões de arquivo de entrada

| Categoria | Extensões                                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vídeo    | `mp4`, `m4v`, `avi`, `mkv`, `mov`, `qt`, `flv`, `f4v`, `wmv`, `asf`, `webm`, `3gp`, `3g2`, `mpg`, `mpeg`, `mts`, `m2ts`, `ts`, `mxf`, `ogv`, `ogg`, `vob`, `divx`, `dv`, `rm`, `rmvb`, `h264`, `h265`, `hevc` |
| Áudio    | `mp3`, `aac`, `wav`, `flac`, `ogg`, `opus`, `m4a`, `wma`, `alac`, `aiff`, `aif`, `au`, `caf`, `pcm`, `mid`, `midi`                                                                                            |
| Imagem   | `jpg`, `jpeg`, `png`, `webp`, `bmp`, `gif`, `tiff`, `tif`, `svg`, `ico`, `heic`, `heif`, `avif`, `ppm`, `pgm`, `pbm`, `xbm`                                                                                   |
| Legendas | `srt`, `ass`, `ssa`, `vtt`, `sub`, `idx`, `smi`                                                                                                                                                               |

## Utilitários de validação

| Função                       | Descrição                   | Formatos aceitos                                      |
| ---------------------------- | --------------------------- | ----------------------------------------------------- |
| `isValidTime(value)`         | Valida strings de tempo     | `HH:MM:SS`, `HH:MM:SS.mmm`, segundos como número      |
| `isValidScale(value)`        | Valida resolução/escala     | `WxH`, `W:H`, percentual `1%`–`999%`, número positivo |
| `isValidBitrate(value)`      | Valida strings de bitrate   | ex. `128k`, `1M`, `2000K`                             |
| `isInRange(value, min, max)` | Verifica faixa numérica     | Qualquer número finito                                |

## Constantes transcoder

| Constante                                         | Valor                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TRANSCODER_TYPES`                                | `['FFMPEG', 'FFTOOL', 'BMF']`                                                                                                                                      |
| `TRANSCODER_LABELS`                               | `{ FFMPEG: 'FFmpeg (API)', FFTOOL: 'FFmpeg (CLI)', BMF: 'BMF Framework' }`                                                                                         |
| `FFMPEG_FLAGS`                                    | `-c`, `-vcodec`, `-acodec`, `-b:v`, `-b:a`, `-qscale:v`, `-vf`, `-pix_fmt`, `-color_range`, `-ss`, `-to`, `-t`, `-y`, `-i`, `-an`, `-sn`, `-dn`, `-re`, `-copyts`  |
| `FFPROBE_FLAGS`                                   | `-v quiet -print_format json -show_format -show_streams`                                                                                                           |
| `TRANSCODER_COMMANDS`                             | `bmf_ffmpeg`, `bmf_ffprobe`, `ffmpeg`, `ffprobe`                                                                                                                   |
| `TRANSCODER_DEFAULTS.PROGRESS_INTERVAL_MS`        | `500`                                                                                                                                                              |
| `TRANSCODER_DEFAULTS.PLAYER_DEFAULT_WIDTH/HEIGHT` | `640` / `360`                                                                                                                                                      |
| `TRANSCODER_DEFAULTS.PLAYER_FPS_CAP`              | `30`                                                                                                                                                               |
| `TRANSCODER_DEFAULTS.FFPROBE_TIMEOUT_MS`          | `30000`                                                                                                                                                            |
| `CONVERSION_DEFAULTS.VIDEO_CODEC`                 | `libx264`                                                                                                                                                          |
| `CONVERSION_DEFAULTS.AUDIO_CODEC`                 | `aac`                                                                                                                                                              |
| `CONVERSION_DEFAULTS.QSCALE`                      | `23`                                                                                                                                                               |
| `CONVERSION_DEFAULTS.PIXEL_FORMAT`                | `yuv420p`                                                                                                                                                          |
| `CONVERSION_DEFAULTS.SCALE`                       | `1920x1080`                                                                                                                                                        |
| `CONVERSION_DEFAULTS.VIDEO_BITRATE`               | `2000k`                                                                                                                                                            |
| `CONVERSION_DEFAULTS.AUDIO_BITRATE`               | `192k`                                                                                                                                                             |
| `QSCALE_RANGE.MIN/MAX`                            | `1` / `31`                                                                                                                                                         |
