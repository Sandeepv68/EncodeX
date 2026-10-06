# Partial Implementation Details

## 3. IPC contract & abuse testing (PARTIAL)
- DONE: src/main/ipc/__tests__/channel-contract.test.ts (8 tests) validates channel registry and preload declarations
- PRESENT: e2e/specs/ipc-abuse.spec.ts (mock:false real bridge) and e2e/specs/ipc-events.spec.ts (event channel abuse) exist
- MISSING: Full abuse sweep coverage in CI; hostile-preload modes not exhaustively exercised in committed unit tests

## 5. UI robustness, i18n & a11y (PARTIAL)
- DONE: src/test-utils/page-render.tsx harness, src/test-utils/axe.ts, src/test-utils/deferred.ts (20 tests), src/renderer/pages/__tests__/strict-mode.test.tsx (13 tests), src/renderer/__tests__/storage-hostility.test.tsx (11 tests), src/renderer/__tests__/listener-leaks.test.tsx (7 tests)
- PARTIAL: Locale matrix (only small subset validated, not full 56�12), a11y/keyboard full sweep not committed, missing-degradation expanded cases limited

## 6. CLI & MCP hostile input (PARTIAL)
- DONE: e2e/specs/cli-hostile.spec.ts (5 E2E tests), src/main/cli/__tests__/cli-argv-fuzz.test.ts (5 fast-check tests on the real parse layer via exported createCliProgram; 300 hostile-argv cases + shim totality), src/mcp/__tests__/hostile.test.ts (29 unit tests driving the real MCP server over InMemoryTransport), src/mcp/__tests__/hostile.integration.test.ts (8 spawn-level stdio-frame tests: malformed/primitive/invalid-UTF-8/wrong-framing lines dropped, truncated-frame swallow, unknown-method -32601, >10 MB cap fail-closed)
- MISSING: real-subprocess CLI rows (signal handling, disk-full, 32k-char filenames, stderr stack-trace shape), MCP HTTP transport hostile (no production HTTP server exists yet; SDK StreamableHTTPServerTransport is available)

## 7. Updater & network hostility (DONE)
- DONE: src/main/__tests__/updater-hostile.test.ts (62 real tests), updated updater.test.ts (42 tests); 13 defects (U1-U13) found and fixed in updater.ts; strict-clean
- MISSING (E2E only, needs real filesystem/net): disk-full / installer-locked-file launch simulation, live-network smoke

## 8. Resource limits & denial-of-service (PARTIAL)
- DONE: Guards exist in codebase; resource-related unit tests (video-filters 30 tests, queue operations)
- MISSING: Explicit DoS/load tests (100k files, 10k jobs, regex backtrack) as committed tests

## 9. Mutation testing (PARTIAL)
- DONE: Property/fuzz coverage provides strong assertions
- MISSING: Stryker config and CI mutation-delta gating

## 10. CI wiring, budgets & nightly chaos (PARTIAL)
- DONE: Existing typecheck/coverage/flake jobs present
- MISSING: New adversarial jobs (test-fuzz, test-ipc-abuse, test-locale-matrix, nightly-chaos) and release gates
