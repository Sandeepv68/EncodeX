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
npm run lint:unused         # no unused declarations
npm run lint:aptabase       # no direct @aptabase imports
npm run lint:regex          # no super-linear backtracking regexes

# Types
npm run typecheck           # renderer + main + preload + test + e2e + perf (6 tsconfigs)

# Locale integrity
npm run validate:locales    # keys/values consistent across all 56 locales <!-- drift:locales=56 -->

# Documentation drift (numbers in wiki/, docs/ and site/ vs the source tree)
npm run doc:drift           # verify <!-- drift:key=value --> markers
npm run doc:drift:strict    # also fail on documents without markers
npm run doc:drift:test      # unit tests for the checker

# Tests
npm test                    # unit suite (314 test files in src/) <!-- drift:test-files=314 -->
npm run test:integration    # integration tests
npm run test:e2e:ci         # e2e suite (needs npm run build first)

# Security audit (blocking in CI)
npm run audit:gate          # fails on any new high/critical advisory not on the allowlist
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
- **Documentation** — the same prose lives in `wiki/`, `docs/`, `site/docs/` and `site/locales/*/docs/`; edit all copies. Any numeric claim that the drift checker tracks (`scripts/check-doc-drift.mjs`) must carry a `<!-- drift:key=value -->` marker so `npm run doc:drift` can verify it.

## 📬 Pull Request Process

1. Ensure the build passes: `npm run build`
2. Update locale files if adding/modifying UI strings.
3. Run the quality gates above (format, lint `*`, typecheck, validate:locales, doc:drift, tests).
4. Keep PRs focused on a single concern.

## 🔒 Security

If you discover a security vulnerability, please report it through the [security advisory](https://github.com/Sandeepv68/EncodeX/security/advisories/new). **Do not** report security vulnerabilities through public GitHub issues.

We will acknowledge receipt within 48 hours and provide an estimated timeline for a fix.

## 📜 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://github.com/Sandeepv68/EncodeX/blob/main/CODE_OF_CONDUCT.md).