# 🤝 Contributing

## 🧑‍💻 Development

```bash
npm run dev    # hot-reload dev mode
npm run build  # full build
npm start      # run built app
```

## 📐 Project Conventions

- **TypeScript** — strict mode, no `any` where possible.
- **React** — functional components with hooks.
- **State** — Zustand stores for global state.
- **IPC** — all channels defined in `src/shared/ipc-channels.ts`.
- **Constants** — hardcoded values in `src/shared/` constants files.
- **i18n** — all user-facing strings in `src/renderer/i18n/locales/`.

## 📬 Pull Request Process

1. Ensure the build passes: `npm run build`
2. Update locale files if adding/modifying UI strings.
3. Keep PRs focused on a single concern.

## 🔒 Security

If you discover a security vulnerability, please report it through the [security advisory](https://github.com/Sandeepv68/EncodeX/security/advisories/new). **Do not** report security vulnerabilities through public GitHub issues.

We will acknowledge receipt within 48 hours and provide an estimated timeline for a fix.

## 📜 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://github.com/Sandeepv68/EncodeX/blob/main/CODE_OF_CONDUCT.md).
