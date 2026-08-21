# Help Make EncodeX Better

EncodeX is free and built by volunteers — and you don't need to be a programmer to help. Here are some ways anyone can pitch in:

- **Tell us when something breaks.** If the app crashes or a file won't convert, [open an issue](https://github.com/Sandeepv68/EncodeX/issues) and describe what happened. Bug reports from everyday users are gold.
- **Suggest ideas.** Wish EncodeX did something it doesn't? Tell us — many features start as user suggestions.
- **Translate.** EncodeX speaks 35+ languages, and translators are always welcome. If your language is missing or sounds awkward, you can help fix that.
- **Spread the word.** Share EncodeX with friends, write a review, or make a tutorial.

## Get in Touch

Questions, ideas, or just want to say hi? Email the developer directly at **[developer@encodex.in](mailto:developer@encodex.in)** — feedback from users is always welcome.


## For Developers

If you'd like to contribute code, here's how to get started:

### Development

```bash
npm run dev          # hot-reload dev mode
npm run electron:dev # full dev environment with Electron window
npm run build        # full build
npm start            # run built app
```

### Project Conventions

- **TypeScript** — strict mode, no `any` where possible.
- **React** — functional components with hooks.
- **State** — Zustand stores for global state.
- **IPC** — all channels defined in `src/shared/ipc-channels.ts`.
- **Constants** — hardcoded values in `src/shared/` constants files.
- **i18n** — all user-facing strings in `src/renderer/i18n/locales/`.

### Pull Request Process

1. Ensure the build passes: `npm run build`
2. Update locale files if adding/modifying UI strings.
3. Keep PRs focused on a single concern.

## Code of Conduct

This project follows the [Contributor Covenant](https://github.com/Sandeepv68/EncodeX/blob/main/CODE_OF_CONDUCT.md). Be kind and respectful — we're all here because we like the project.
