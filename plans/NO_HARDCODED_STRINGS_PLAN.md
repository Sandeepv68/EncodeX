# Plan: `encodex/no-hardcoded-strings` ESLint rule

## Goal

Add a new custom ESLint rule that flags hardcoded English text intended for the UI in
the renderer, enforcing that all user-facing copy goes through i18next translations
(`useTranslation()` / `i18n.t(...)`). Brand/product names and technical labels
(codecs, containers, formats) are exempt via a central allowlist plus inline
`eslint-disable` comments.

## Decisions

- **Visible text + common label props.** The rule flags JSX text nodes and string
  values on UI-copy prop names (`label`, `placeholder`, `title`, `aria-label`,
  `aria-labelledby`, `aria-placeholder`, `alt`, `helperText`, plus configured
  extras), and any English `Literal`/`TemplateElement` that is **not** the `key`
  argument of a translation call.
- **Severity: `error`.** Enforced immediately. Existing violations are put on the
  central **allowlist** (no UI copy changes on rollout), so nothing breaks.
- **Allowlist + disable comments.** A shared `text-allowlist.mjs` centralizes the
  default exemptions; one-off cases use inline `eslint-disable`.
- **Tests.** Ships with ESLint `RuleTester` unit tests (unlike the existing px/rem/
  color/inline-style rules, this one is on by default).
- **Standalone config + CI job.** Mirrors the `lint-colors` / `lint-px` pattern:
  a dedicated `scripts/eslint.strings.config.mjs` config, an npm script, and a
  `lint-strings` job in `ci.yml`.

## Scope

- Target: `src/renderer/**/*.{ts,tsx}` (UI sources only; `main`/`preload`, `e2e`,
  and build output are not linted, matching existing rules).
- Exempt: test files, the allowlisted strings/patterns, translation-call key
  arguments, and explicitly ignored files.
- Intentionally **does not** auto-add locale keys — it only guards new hardcoded
  text.

---

## Progress marker

| Step | Status |
|------|--------|
| 1. Plan file created | :white_check_mark: Done |
| 2. `eslint-rules/text-allowlist.mjs` created | :white_check_mark: Done |
| 3. `eslint-rules/no-hardcoded-strings.mjs` created | :white_check_mark: Done |
| 4. Registered in `eslint.config.mjs` (error + test exemption) | :white_check_mark: Done |
| 5. `scripts/eslint.strings.config.mjs` created | :white_check_mark: Done |
| 6. `lint:strings` + test scripts in `package.json` | :white_check_mark: Done |
| 7. `eslint-rules/no-hardcoded-strings.test.mjs` (RuleTester) | :white_check_mark: Done |
| 8. `lint-strings` CI job + `needs` wiring | :white_check_mark: Done |
| 9. Verify: run `npm run lint:strings` and rule tests | :white_check_mark: Done |

---

## Steps

### 1. Create this plan file

This document, with the progress marker above tracking each step.

### 2. Create `eslint-rules/text-allowlist.mjs`

Shared, reviewable export of the default exemptions:
- `DEFAULT_ALLOW_TEXT` — exact strings:
  - `Histogram`, `Red`, `Green`, `Blue`, `Luma` (ExifSection histogram channel labels)
  - `Beta`, `Minimize`, `Restore`, `Maximize`, `Close` (TitleBar badge + aria-labels)
- `DEFAULT_ALLOW_PATTERNS` — regex terms (brands + technical labels):
  - `EncodeX`, `FFmpeg`
  - codecs/containers/formats: `H\.?\d+`, `mp4|mkv|webm|mov|avi|flv|ts|m4v`, `MP3`,
    `aac|ac3|flac|wav|opus|vorbis`, `png|jpe?g|gif|bmp|webp|heic|heif|tiff`, `srt|ass|vtt`
  - extensions / MIME-friendly tokens and common single-character or technical ids.

### 3. Create `eslint-rules/no-hardcoded-strings.mjs`

`meta` (`type: 'suggestion'`, `messages`, `schema`), `create(context)`.
Detection logic:
- **JSXText**: report when the raw text contains A-Z/a-z letters (English-ish) and
  is not whitespace-only.
- **String `Literal`**: report when the value (a) is not the `key` argument of a
  translation call (`t(...)`, `i18n.t(...)`, `...t.bind(i18n)`), (b) contains letters,
  (c) is not allowed by `allowText`/`allowPatterns`/`allowProps`, and (d) sits on a
  flagged UI-copy prop OR is an arbitrary string in a renderer file.
- **`TemplateElement`**: same logic on the cooked+raw value.
Options schema:
- `allowText: string[]`
- `allowPatterns: string[]`
- `allowProps: string[]`
- `flagProps: string[]` (additional UI-copy prop names beyond the built-ins)

### 4. Register in `eslint.config.mjs`

- Import the rule and register under the `encodex` plugin.
- Add `'encodex/no-hardcoded-strings': 'error'`.
- Add the rule to the test-file override block (turn **off** for `*.test.*` and
  `__tests__`), matching the existing rules.

### 5. Create `scripts/eslint.strings.config.mjs`

Standalone flat config enabling only `encodex/no-hardcoded-strings` (as `error`),
with the same ignores (dist, node_modules), the renderer file set, the ts parser,
the test-file override, and the allowlist options passed to the rule.

### 6. Add npm scripts in `package.json`

```json
"lint:strings": "eslint -c scripts/eslint.strings.config.mjs src/renderer",
"lint:strings:test": "node --test eslint-rules/no-hardcoded-strings.test.mjs"
```

### 7. Create `eslint-rules/no-hardcoded-strings.test.mjs`

ESLint `RuleTester` (from `eslint`) using the TS-aware setup where needed. Valid
cases: `t('nav.convert')`, `i18n.t('app.name')`, `const x = { label: t('a.b') }`,
`<Button title={t('x.y')} />`, allowlisted text/patterns, non-latin text, empty
strings. Invalid cases: JSX text `<div>Hello world</div>`, `<Input label="Name" />`,
`placeholder="Select file"`, hardcoded `aria-label="Close"`.

### 8. Add `lint-strings` CI job

Mirror `lint-colors` in `.github/workflows/ci.yml`, and append `lint-strings` to the
`needs:` lists of the downstream jobs that currently list the other lint jobs.

### 9. Verify

Run `npm run lint:strings` (must pass against the current renderer, all existing
violations being allowlisted) and `npm run lint:strings:test`.

---

## Implementation notes (post-execution)

- **Translation-key detection is subtree-based.** The rule treats a string as a
  translation key if it lies anywhere inside the first argument of a `t`-like call
  (`t(...)`, `i18n.t(...)`, bound `t`). This covers `t('key')`, template keys
  `t(\`mediaInfo.${x}\`)`, and conditional keys `t(cond ? 'a' : 'b')` without false
  positives.
- **UI-copy detection is direct-only.** A string is flagged as UI copy only when it
  is the *direct* value of a flagged prop/attribute (`label`, `placeholder`,
  `title`, `aria-*`, `alt`, `helperText`, `hint`, `description`) — not when it is
  merely nested somewhere under such a prop (e.g. an argument to `shortcutHint(...)`
  inside a `title=` prop). This avoids flagging helper-function translation keys.
- **`localeMeta.ts` is excluded** via the `ignoreFiles` option: it holds native
  language display names (`English (India)`, `हिन्दी (India)`, ...) that are not
  localized UI copy.
- **Allowlist additions made during rollout**: `s` (second suffix in `{eta}s`) and
  `v` (version prefix `v1.2.3`).
- **Verification result**: `npm run lint:strings` exits `0` with no errors. Two
  `Unused eslint-disable directive` warnings for `encodex/no-inline-styles` in
  `ProfileSelector.tsx` / `QueueJobCard.tsx` are pre-existing and also appear in the
  existing `lint:colors` run (same parity, non-blocking). `npm run lint` still
  passes, and the RuleTester suite (`npm run lint:strings:test`) passes.

