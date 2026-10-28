# टेस्टिंग

<!-- drift: test-files=323 renderer-component-tests=45 -->

EncodeX एक विस्तृत टेस्ट सुइट बनाए रखता है: `src/` के भीतर 314 test/spec files, `e2e/` में 39 test/spec files, और `perf/` में 11 performance suites। Unit और integration tests Vitest से चलते हैं, जबकि end-to-end specs Playwright के Electron automation के माध्यम से पैकेज्ड ऐप चलाते हैं। CI प्रत्येक push और pull request पर full matrix (lint + typecheck + unit + E2E) चलाता है।

## Test commands

```bash
npm test              # सभी Vitest suites चलाएँ
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright E2E suite
npm run test:e2e:mcp  # MCP-केंद्रित E2E tests (build आवश्यक)
npm run perf          # Performance suites
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit across projects
```

## Unit / integration (Vitest)

Unit tests `src/` के बगल में colocated हैं (`*.test.ts` / `*.test.tsx`) और shared logic — validation utilities, codec lists, IPC channel registry, error formatting, queue job state transitions, waveform bucket math — cover करते हैं, साथ ही main-process modules (transcoder cores, binary resolution, timeline media, image info, Copilot/AI, analytics, monitoring, security और embedded MCP) के integration-style tests।

## Test setup

`src/test-setup.ts`:

- jsdom environment configure करता है
- Canvas API stubs inject करता है (`getContext('2d')` no-op methods के साथ)
- ResizeObserver, matchMedia, और `scrollIntoView` polyfill करता है
- एक complete `window.electronAPI` mock install करता है जो हर bridge method को vi.fn() के रूप में expose करता है, जिसमें event subscriptions trivial cleanup functions return करते हैं
- i18next initialize करता है ताकि components render-time translations resolve कर सकें

Tests electron APIs के खिलाफ assertions करने के लिए mocked `electronAPI` import करते हैं; कोई real process spawning test runs के दौरान नहीं होता।

## End-to-end (Playwright)

E2E specs `e2e/` में रहते हैं और Vitest के node environment (60 सेकंड timeouts) में चलते हैं। ये Playwright की Electron automation से पैकेज्ड ऐप को drive करते हैं। Write specs `e2e/specs/` में, MCP specs `e2e/mcp/` में और CLI spec `e2e/cli.spec.ts` में हैं; कुल 39 test/spec files चलती हैं। ये `E2E` env var या CI से gated हैं।

App को mocked preload (`e2e/mocks/preload.js`) और in-memory main-store shim (`e2e/mocks/main-store.js`) के साथ boot करने वाले flows deterministic और hermetic रहते हैं:

- Navigation और page rendering
- Convert form interaction और progress display
- Batch queue lifecycle (add → run → complete)
- Logs viewer filtering और clearing
- Settings persistence

## Performance suites

`perf/` में 11 `*.perf.test.ts` suites हैं (startup, queue concurrency, IPC overhead, large files, extraction, memory leaks, process lifecycle, conversion benchmark, CLI batch और phase-8 I/O/queue) तथा shared `test-utils.ts`। इन्हें `npm run perf` से चलाएँ।

## Guidelines

1. **Unit tests को उन modules के साथ colocate करें** जिन्हें वे exercise करते हैं; E2E केवल user-visible flows के लिए रखें।
2. **IPC boundaries mock करें** — renderer tests `electronAPI` mock को assert करते हैं, main-process tests transcoder interfaces को fake करते हैं।
3. **Shared constants reuse करें** (`log-constants.ts`, `app-constants.ts`) assertions में ताकि refactors के दौरान tests stable रहें।
4. **Coverage goals** — shared utilities पर focus रखें जहाँ regressions user-facing failures produce करते हैं (validation, queue state machine, error mapping)।
