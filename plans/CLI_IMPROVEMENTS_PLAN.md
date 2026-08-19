# EncodeX CLI — Modernization & Feature-Complete Plan

> Status: **COMPLETE** — all 12 phases done, full verification green.

## 1. Goals

- Expose **every GUI capability** through the CLI: convert, media info, image compress, audio extract, batch queue, capabilities, logs/verbosity.
- Modern, colorful, TTY-aware UX: **chalk** colors, **ora** spinners, **cli-progress** bars (single + multi-bar for batch), styled tables, clean stdout for piping.
- Keep it **scriptable**: `--json` for machine-readable output, clean exit codes, stdout hygiene, `--quiet`/`--verbose`.

## 2. Gap analysis (GUI feature → CLI today)

| Feature | GUI | CLI today | Gap |
|---|---|---|---|
| Convert | ✓ | ✓ | Missing `--keep-aspect-ratio`, hwaccel flags |
| Media Info | ✓ | `--info` (raw JSON) | No human table, no `--json` toggle |
| Image Compress | ✓ | ✗ | No `compress` command |
| Audio Extract | ✓ | ✗ | No `extract-audio` command |
| Video Cut | ✓ | trim flags | Covered (start/end/duration); add `--no-video` for audio-only |
| Batch Queue | ✓ | ✗ | No multi-file/glob batch |
| Capabilities | ✓ | ✗ | `capabilities.ts` exists, never exposed |
| Logs / verbosity | ✓ | ✗ | No `--verbose`/`--quiet`; internal logs pollute stdout |
| Progress | ✓ (rich) | crude line rewrite | No bars, no multi-bar, no spinner |

## 3. Design decisions

1. **Subcommands** — `convert`, `info`, `batch`, `capabilities`, `compress`, `extract-audio`.
2. **`info`/`capabilities` → human table by default**, `--json` for machine output.
3. **`cli-progress`** added as a direct dependency (with **chalk** + **ora**).

## 4. Dependency changes (`package.json`)

Add to `dependencies` (all CJS-compatible with the CommonJS main build):

- `chalk` `^4.1.2` — colors
- `ora` `^5.4.1` — spinners
- `cli-progress` `^3.12.0` — single + `MultiBar`

## 5. New file layout (`src/main/cli/`)

| File | Responsibility |
|---|---|
| `cli.ts` | Entry. Slice runtime args, backward-compat shim, define subcommands, dispatch, map result → exit code. |
| `cli-options.ts` | Shared Commander options + `buildConversionOptions()` (flag → `ConversionOptions`). |
| `cli-convert.ts` | `convert` subcommand: probe duration (FFTOOL percent fallback), single progress bar, summary. |
| `cli-info.ts` | `info` + `capabilities` subcommands: human tables + `--json`. |
| `cli-batch.ts` | `batch` subcommand: expand inputs → in-memory `JobQueue`, `MultiBar`, concurrency, report. |
| `cli-util.ts` | Glob expansion (`*`, `?`, `**`), output-path derivation, timemark→percent math. |
| `cli-ui.ts` | Chalk theme, `spinner()`, `progressBar()`/`multiBar()`, table renderer, TTY detection. |

## 6. Subcommand specs

```
encodex convert <input> <output>        # default when no subcommand matches
encodex info <input> [--json]
encodex capabilities [--json]
encodex compress <input> <output>       # -f/--format, -q, -s, --keep-aspect-ratio, --pix-fmt
encodex extract-audio <input> <output>  # -a/--audio-codec, --bitrate-audio, trim flags
encodex batch <input...> [--out-dir <dir>] [-j/--concurrency <1-4>] [--suffix <s>]
```

- **convert** keeps every existing flag + parity: `--keep-aspect-ratio`, `--hwaccel`/`--no-hwaccel`, `--hwaccel-mode <auto|encode>`, `--no-video`.
- **compress**: `-f/--format` defaults from output extension; uses `IMAGE_CODEC_MAP` + `IMAGE_FORMATS`.
- **extract-audio**: `-a` defaults to `AUDIO_EXTRACT_DEFAULT_CODEC`; forces `video:false`.
- **batch**: inputs accept files, globs, or directories; outputs to `--out-dir` or alongside input with `--suffix`; uses `JobQueue` with `-j` clamped 1–4.

## 7. CLI-mode detection & launcher

- `isCliMode()` in `index.ts` also true when first non-option arg is a subcommand name or `help`.
- Backward-compat shim in `cli.ts`: legacy `encodex in.mp4 out.mp4` / `--cli in.mp4 out.mp4` prepends `convert`; `convert` keeps `--info` alias.
- `bin/encodex.js` pre-scans args to set `LOG_LEVEL`/`NO_COLOR` env before spawning Electron.
- CLI mode routes all shared-Logger output to **stderr** so stdout carries only data.

## 8. Shared change: `video?: boolean`

Optional `video?: boolean` on `ConversionOptions`; emit `-vn` in `ffmpeg-core.ts` and `buildFfmpegArgs()`.

## 9. Progress, colors, exit codes

- **Progress**: single bar (convert/compress/extract) with percent/time/speed/fps/eta/bitrate; `MultiBar` for batch. Disabled when non-TTY.
- **Colors**: chalk theme-aware accents, green ✓ success, red ✗ errors, cyan values, colored help.
- **Exit codes**: extend `EXIT_CODES` with `USAGE: 2`, `CANCELLED: 3`, `NOT_FOUND: 4`, `TIMEOUT: 5`.
- *(Optional)* TTY keypresses: `space` pause/resume, `c` cancel.

## 10. Documentation

- Update `README.md` CLI Usage + Options table.
- Update CLI Mode section in `ARCHITECTURE.md`.

## 11. Tests

- **Unit**: rework `cli.test.ts`; new tests for `cli-util`, `cli-ui`, `cli-batch`, `cli-info`, `-vn` threading.
- **e2e**: update help/info assertions; add `capabilities`, `compress`, `extract-audio`, `batch`.

---

## Checkpoints & Completion Status

| # | Phase | Status |
|---|---|---|
| 1 | Deps + shared constants/types (`video?`, `CLI_SUBCOMMANDS`, exit codes) | ✅ Complete |
| 2 | `cli-ui.ts` (colors, spinner, progress bars, tables, TTY) | ✅ Complete |
| 3 | `cli-util.ts` (glob, output naming, percent math) | ✅ Complete |
| 4 | `cli.ts` refactor + `index.ts` isCliMode + `bin/encodex.js` | ✅ Complete |
| 5 | `cli-convert.ts` with progress bar | ✅ Complete |
| 6 | `cli-info.ts` (info + capabilities tables + `--json`) | ✅ Complete |
| 7 | `compress` + `extract-audio` (+ `-vn` threading) | ✅ Complete |
| 8 | `cli-batch.ts` (glob, JobQueue, MultiBar) | ✅ Complete |
| 9 | Unit tests | ✅ Complete |
| 10 | e2e `cli.spec.ts` updates | ✅ Complete |
| 11 | README + ARCHITECTURE docs | ✅ Complete |
| 12 | Full verification (build, tests, typecheck) | ✅ Complete |
