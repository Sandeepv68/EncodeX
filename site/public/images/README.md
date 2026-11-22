# Screenshots

Screenshot assets for the marketing site. All files are WebP. Light variants use the base filename; dark variants append `_dark`. Source captures live in `screenshots/dev/` and are named `<page>_<theme>.png`.

## Available screenshots

| Filename                        | Description                                   |
| ------------------------------- | --------------------------------------------- |
| `home_dashboard.webp`           | Main dashboard / home page (light)            |
| `home_dashboard_dark.webp`      | Main dashboard / home page (dark)             |
| `home_dashboard_800.webp`       | Narrow-width dashboard variant (light)        |
| `home_dashboard_dark_800.webp`  | Narrow-width dashboard variant (dark)         |
| `convert.webp`                  | Media conversion page with options            |
| `extract_audio.webp`            | Audio extraction page                         |
| `cut_video.webp`                | Video cutting page with timeline              |
| `image_compress.webp`           | Image compression with preview                |
| `batch_process.webp`            | Batch queue with jobs in progress             |
| `batch_queue_mux.webp`          | Mux queue with remux/demux jobs               |
| `media_info.webp`               | Media info / probe results                    |
| `copilot.webp`                  | Copilot chat page                             |
| `copilot_progress.webp`         | Copilot job progress                          |
| `remux.webp`                    | Remux page                                    |
| `demux.webp`                    | Demux page                                    |
| `logs.webp`                     | Detachable logs window                        |
| `settings_general.webp`         | General settings                              |
| `settings_ai.webp`              | AI settings                                   |
| `settings_ai_provider.webp`     | AI provider settings                          |
| `settings_advanced.webp`        | Advanced settings                             |
| `architecture.webp`             | Architecture diagram                          |
| `banner.webp`                   | Site banner                                   |
| `icon.webp`                     | Full-size app icon                            |
| `icon_380.webp`                 | Medium app icon                               |
| `favicon-64.webp`               | Favicon                                       |

Every screenshot above has a matching `_dark.webp` variant.

## Usage in Markdown

For a theme-aware screenshot on the site:

```vue
<ThemeImage light="/images/convert.webp" dark="/images/convert_dark.webp" alt="Media Conversion" />
```

For static Markdown (README, wiki) use the light variant:

```markdown
![Dashboard](/images/home_dashboard.webp)
```

## Tips

- Prefer the `*_800.webp` variant where a narrow layout needs it.
- Keep replacements under 500 KB where possible.
