# 🤝 Contributing

## 🧑‍💻 Development

```bash
npm run dev           # Vite + tsc watch (no Electron window)
npm run electron:dev  # full dev environment with Electron window (--dev)
npm run dev:start     # build then launch
npm run build         # full production build
npm start             # run built app
```

Deeper guidance: [[Installation]] (setup + all scripts) and [[Testing]] (test, lint, and validation commands).

## ✅ Quality Gates

CI enforces the full set below — run them locally before pushing:

```bash
# Formatting
npm run format:check

# Escalating lint rules (all must pass)
npm run lint                # eslint src/renderer
npm run lint:px             # no raw px values
npm run lint:colors         # no raw hex/rgba colors
npm run lint:rem            # spacing via rem/token constants
npm run lint:inline-styles  # no inline styles
npm run lint:strings        # no hardcoded UI strings

# Types
npm run typecheck           # renderer + main + preload

# Locale integrity
npm run validate:locales    # keys/values consistent across all 56 locales

# Tests
npm test                    # unit suite (168 test files in src/)
npm run test:integration    # integration tests
npm run test:e2e:ci         # e2e suite (needs npm run build first)

# Security audit (non-blocking in CI)
npm audit
```

## 📐 Project Conventions

- **TypeScript** — strict mode, no `any` where possible.
- **React** — functional components with hooks.
- **State** — Zustand stores for global state.
- **IPC** — all channels defined in `src/shared/ipc-channels.ts`.
- **Constants** — hardcoded values in `src/shared/` constants files.
- **Strings** — every user-facing string lives in `src/renderer/i18n/locales/` (lint-enforced), and every log message is a constant from `src/shared/log-constants.ts`.
- **i18n** — add a key to every locale; `npm run validate:locales` guards consistency.
- **Styling** — MUI `sx`/style constants extracted to `src/renderer/styles/`; spacing via rem tokens, colors via the theme palette.
- **Testing** — component/hook/store tests alongside the code; wire new UI into the mock preload (`e2e/mocks/preload.js`) and extend the e2e specs rather than mocking ad-hoc.

## 📬 Pull Request Process

1. Ensure the build passes: `npm run build`
2. Update locale files if adding/modifying UI strings.
3. Run the quality gates above (format, lint `*`, typecheck, validate:locales, tests).
4. Keep PRs focused on a single concern.

## 🔒 Security

If you discover a security vulnerability, please report it through the [security advisory](https://github.com/Sandeepv68/EncodeX/security/advisories/new). **Do not** report security vulnerabilities through public GitHub issues.

We will acknowledge receipt within 48 hours and provide an estimated timeline for a fix.

## 📜 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://github.com/Sandeepv68/EncodeX/blob/main/CODE_OF_CONDUCT.md).