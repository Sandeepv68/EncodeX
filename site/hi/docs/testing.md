# टेस्टिंग

EncodeX एक मजबूत टेस्ट सुइट बनाए रखता है: **123 test files, 1603 tests passing**, Vitest unit/integration tests और Playwright end-to-end specs के बीच विभाजित। CI प्रत्येक push और pull request पर full matrix (lint + typecheck + unit + E2E) run करता है।

## Test commands

```bash
npm test              # Run all Vitest suites
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright E2E suite
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit across projects
```

## Unit / integration (Vitest)

Unit tests `src/` के बगल में colocated हैं (`*.test.ts` / `*.test.tsx`) और shared logic — validation utilities, codec lists, IPC channel registry, error formatting, queue job state transitions, waveform bucket math — cover करते हैं, साथ ही main-process modules (transcoder cores, binary resolution, timeline media, image info) के integration-style tests।

## Test setup

`src/test-setup.ts`:

- jsdom environment configure करता है
- Canvas API stubs inject करता है (`getContext('2d')` no-op methods के साथ)
- ResizeObserver, matchMedia, और `scrollIntoView` polyfill करता है
- एक complete `window.electronAPI` mock install करता है जो हर bridge method को vi.fn() के रूप में expose करता है, जिसमें event subscriptions trivial cleanup functions return करते हैं
- i18next initialize करता है ताकि components render-time translations resolve कर सकें

Tests electron APIs के खिलाफ assertions करने के लिए mocked `electronAPI` import करते हैं; कोई real process spawning test runs के दौरान नहीं होता।

## End-to-end (Playwright)

E2E specs `e2e/` में रहते हैं और app को mocked preload (`e2e/mocks/preload.js`) और in-memory main-store shim (`e2e/mocks/main-store.js`) के साथ boot करते हैं, इसलिए flows deterministic औ hermetic होते हैं:

- Navigation और page rendering
- Convert form interaction और progress display
- Batch queue lifecycle (add → run → complete)
- Logs viewer filtering और clearing
- Settings persistence

## Guidelines

1. **Colocate unit tests** उन modules के साथ जिन्हें वे exercise करते हैं; E2E केवल user-visible flows के लिए reserve करें।
2. **Mock IPC boundaries** — renderer tests `electronAPI` mock को assert करते हैं, main-process tests transcoder interfaces को fake करते हैं।
3. **Shared constants reuse करें** (`log-constants.ts`, `app-constants.ts`) assertions में ताकि tests refactors के दौरान stable रहें।
4. **Coverage goals** — shared utilities पर focus रखें जहाँ regressions user-facing failures produce करते हैं (validation, queue state machine, error mapping)।
