# Plan: Validate locale key parity in CI

## Goal

Add a new CI stage that validates locales. `en-US` is the base locale; every other
locale must have the **exact same translation key set** (recursively), so no key is
left missing/untranslated and no stray keys are added.

## Decisions

- **Key parity only.** Each locale must have exactly the same keys as `en-US`.
  Missing keys and extra keys both fail the build. Values are never compared, so
  English variant locales (en-GB, en-AU, en-CA, en-IN, en-IE, en-NZ, en-SG, en-ZA)
  pass even though their values are naturally near-identical to en-US.
- **Standalone Node script + new CI job.** A dependency-free script run via an npm
  script, wired into a new dedicated `validate-locales` job in `ci.yml`.

## Scope

- Base locale: `src/renderer/i18n/locales/en-US.json`
- Target locales: every other `*.json` file in `src/renderer/i18n/locales/` (55 files)
- All 56 locale files are loaded in `src/renderer/i18n/config.ts`, so key parity here
  guarantees i18next never falls back to en-US for a missing key.

## Steps

### 1. Create `scripts/validate-locales.mjs`

- Read all `*.json` files from `src/renderer/i18n/locales/`.
- Use `JSON.parse` to validate syntax (invalid JSON fails the job).
- Recursively flatten each file's keys into dot-paths
  (e.g. `settings.themes.dark`) to build a `Set<string>`.
- Compare each locale's key set against the base:
  - `missing = baseKeys - localeKeys` -> reported as untranslated.
  - `extra = localeKeys - baseKeys` -> reported as stray keys.
- Print a per-locale report, e.g.:
  ```
  [FAIL] es-ES: 2 missing key(s): convert.foo, toast.bar
  [FAIL] es-ES: 1 extra key(s): toast.unknownKey
  ```
- Exit `0` when everything passes, `1` when any locale fails.
- Node built-ins only; no external dependencies.

### 2. Add npm script in `package.json`

```json
"validate:locales": "node scripts/validate-locales.mjs"
```

### 3. Add a new job in `.github/workflows/ci.yml`

- Job `validate-locales` on `ubuntu-latest`:
  - `actions/checkout@v4`
  - `actions/setup-node@v4` (Node 22, npm cache)
  - `run: npm run validate:locales`
- `npm ci` is intentionally skipped (the script is dependency-free, so the job is fast).
- Sequencing: `validate-locales` has `needs: [format-check]`, and `build` has
  `needs: [format-check, validate-locales]` — so the pipeline only proceeds past
  `format-check` -> `validate-locales` -> `build` (and the downstream test jobs).

### 4. Verify

- Run `npm run validate:locales` locally -> all 55 non-base locales pass.
- Negative test: temporarily remove one key in e.g. `es-ES.json` -> script exits `1`
  with a clear report; revert the change.
- Run `npm run format:check` to confirm formatting is still clean.

## Edge cases handled

- Missing/empty base file -> clear error.
- Invalid JSON in a locale -> `JSON.parse` throws and the script fails.
- Non-`*.json` files in the locales dir -> ignored.
- Deeply nested objects -> flattened recursively.
- Missing and extra keys -> both reported together.
- Arrays and scalar values are treated as leaf values (only object keys are compared).

## Checkpoints

- [x] Plan documented in `docs/LOCALE_VALIDATION_PLAN.md`
- [x] `scripts/validate-locales.mjs` created
- [x] `validate:locales` npm script added
- [x] `validate-locales` job added to `ci.yml`
- [x] `npm run validate:locales` passes (positive + negative test)
- [x] `npm run format:check` passes
