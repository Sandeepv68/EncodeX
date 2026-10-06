# Partial Implementation Details

## 3. IPC contract & abuse testing (PARTIAL)
- DONE: src/main/ipc/__tests__/channel-contract.test.ts (8 tests) validates channel registry and preload declarations
- PRESENT: e2e/specs/ipc-abuse.spec.ts (mock:false real bridge) and e2e/specs/ipc-events.spec.ts (event channel abuse) exist
- MISSING: Full abuse sweep coverage in CI; hostile-preload modes not exhaustively exercised in committed unit tests

## 5. UI robustness, i18n & a11y (PARTIAL)
- DONE: src/test-utils/page-render.tsx harness, src/test-utils/axe.ts, src/test-utils/deferred.ts (20 tests), src/renderer/pages/__tests__/strict-mode.test.tsx (13 tests), src/renderer/__tests__/storage-hostility.test.tsx (11 tests), src/renderer/__tests__/listener-leaks.test.tsx (7 tests)
- PARTIAL: Locale matrix (only small subset validated, not full 56�12), a11y/keyboard full sweep not committed, missing-degradation expanded cases limited

## 6. CLI & MCP hostile input (PARTIAL)
- DONE: e2e/specs/cli-hostile.spec.ts (**17 E2E tests**, 2026-10-06), src/main/cli/__tests__/cli-argv-fuzz.test.ts (5 fast-check tests on the real parse layer via exported createCliProgram; 300 hostile-argv cases + shim totality), src/mcp/__tests__/hostile.test.ts (29 unit tests driving the real MCP server over InMemoryTransport), src/mcp/__tests__/hostile.integration.test.ts (8 spawn-level stdio-frame tests: malformed/primitive/invalid-UTF-8/wrong-framing lines dropped, truncated-frame swallow, unknown-method -32601, >10 MB cap fail-closed)
- DONE (CLI real-subprocess rows, 2026-10-06): e2e/specs/cli-hostile.spec.ts spawns the real `electron dist/main/index.js --cli` binary and asserts exit code + single-line `✖` message + stack-trace-free stderr (no `^\s+at`, no `file.ts:line`, no `node:internal/`, no TypeError-family) for: unreadable input, disk-full simulation (output under a regular file), read-only output dir, input-is-a-directory (info + convert), 32,000-char input filename, SIGINT-cancel mid-convert (Windows prompt hard-kill; POSIX graceful-cancel branch), and clean-success rows. Product fixes in the same change:
  - src/shared/logger.ts: `consoleErrorStacksIncluded` toggle (default true); console renderer prints Errors `message`-only in CLI non-verbose, while the sink keeps raw args (so `--verbose` still gets full diagnostics). cli-ui.ts `configureCliOutput` syncs it from `cliConfig.verbose`.
  - src/shared/errors.ts: `inferErrorCode` reordered -- runtime ffmpeg/ffprobe failures (`error opening output`, `exited with code`) map to `CONVERSION_FAILED` instead of a misleading `FFMPEG_NOT_FOUND`; `permission denied`/`EACCES` still classified `PERMISSION_DENIED` first.
  - src/main/cli/cli-info.ts: single `✖` print (top-level catch) instead of pre-throw duplicates in runInfo/runCapabilities.
  - src/main/cli/cli.ts: `cliErrorMessage` flattens embedded newlines so the human message stays single-line.
  - Signal cancel (registerCliSignalCancel) + convert/batch cancellation from earlier in the phase.
- DONE (MCP HTTP transport, 2026-10-06): production module src/mcp/http.ts + standalone entry src/mcp/http-server.ts (loopback-only bind, optional bearer auth with constant-time compare, query-string token refusal, per-request Host/Origin loopback checks, one McpServer per session sharing a single MCPJobManager, session cap that counts in-flight creations so a burst cannot overshoot, 10 MB body cap via Content-Length and chunked read, deterministic 404/405/415/400/413/503, clientError guard). src/mcp/__tests__/http.test.ts (23 unit, strict-clean at ENCODEX_STRICT_TESTS=2) + src/mcp/__tests__/http-hostile.integration.test.ts (8 spawn-level against `node dist/mcp/http-server.js`, incl. 100-concurrent never-overflowing cap, EADDRINUSE exit 1, prompt SIGTERM)
- DONE (CI wiring, 2026-10-06): all hostile suites are wired into CI. The MCP stdio/http unit suites (hostile.test.ts, http.test.ts) run in the `test-unit` job via the `vitest.config.ts` include; the spawn-level MCP integration suites (hostile.integration.test.ts, http-hostile.integration.test.ts) run in `test-integration`; the CLI real-subprocess + hostile-input rows (cli-hostile.spec.ts, cli-argv-fuzz.test.ts) run in `test-e2e`/`test-unit` (ubuntu + windows for the e2e tier). The `test-fuzz` media-corruption tier (corrupt-media.mediafuzz.test.ts, real ffmpeg/ffprobe) gained a blocking `test-fuzz` job in ci.yml plus a random-seed `nightly-chaos` run in nightly.yml (`MEDIA_FUZZ_SEED=${{ github.run_id }}`).

## 7. Updater & network hostility (DONE)
- DONE: src/main/__tests__/updater-hostile.test.ts (62 real tests), updated updater.test.ts (42 tests); 13 defects (U1-U13) found and fixed in updater.ts; strict-clean
- MISSING (E2E only, needs real filesystem/net): disk-full / installer-locked-file launch simulation, live-network smoke

## 8. Resource limits & denial-of-service (PARTIAL)
- DONE (2026-10-06): src/shared/__tests__/resource-budget.test.ts (1000-filter refusal, worst-case chain under 32k Windows argv limit, adversarial 100 KB/50k-entry parsing bounded < 1 s), src/main/queue/__tests__/queue-import-budget.test.ts (10 MB export parse < 3 s, 10,001-job refusal, hostile 10 MB JSON incl. 100k-deep nesting), src/main/__tests__/media-scan-budget.test.ts (30,000-file tree < 3 s, dedupe, 300-deep walk), src/renderer/pages/__tests__/convert-click-budget.test.tsx (10,000 rapid clicks -> exactly one conversion). All strict-clean at ENCODEX_STRICT_TESTS=2
- MISSING: Perf-tier rows (100k-file scan at full count, 100 MB SRT, 20 GB sparse file, 10k-job queue memory) and a 1,000-rapid-route-change harness (partially covered by strict-mode/listener-leaks suites)

## 9. Mutation testing (PARTIAL)
- DONE: Property/fuzz coverage provides strong assertions
- MISSING: Stryker config and CI mutation-delta gating

## 10. CI wiring, budgets & nightly chaos (PARTIAL)
- DONE: Existing typecheck/coverage/flake jobs present
- DONE (2026-10-06): `test-fuzz` job (blocking, media-fuzz tier) in ci.yml + `nightly-chaos` random-seed media fuzz in nightly.yml
- MISSING: test-ipc-abuse, test-locale-matrix, test-a11y jobs; perf budget baselines (boot_ms, max_rss_mb, queue_10k_ms, ipc_roundtrip_p99_ms, fuzz_seeds_per_min); release gates in release.yml
