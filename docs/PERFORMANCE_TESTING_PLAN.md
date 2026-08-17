# EncodeX Performance & Load Testing Plan

## Overview

EncodeX is an Electron desktop application wrapping FFmpeg for multimedia conversion. This plan covers load and performance testing across all performance-critical subsystems. Unlike web applications, the "load" here is measured in concurrent FFmpeg processes, batch queue depth, large file handling, and UI rendering under stress.

## Architecture Context

- **Process model:** Electron 3-process architecture (main, preload, renderer)
- **Media backend:** FFmpeg via `fluent-ffmpeg`, raw CLI, or BMF framework
- **Queue:** Concurrency-capped (1–4 parallel jobs), EventEmitter-based
- **State:** Zustand stores + localStorage (no database)
- **IPC:** 55+ typed channels between main ↔ renderer

## Test Environment Requirements

- FFmpeg/FFprobe binaries available (via `ffmpeg-static` / `ffprobe-static`)
- Node.js with `process.hrtime.bigint()` support
- Vitest 4 as test runner
- No GUI required for most tests (main process + Node.js environment)
- Platform: Windows (primary), Linux/macOS (CI)

---

## Phase 1: Core Performance Benchmarks

### 1.1 Conversion Throughput Benchmark

**File:** `perf/conversion-benchmark.perf.test.ts`

Measures encoding speed across codec/resolution combinations using real FFmpeg.

| Test Case | Input | Metrics |
|---|---|---|
| Codec sweep (libx264, libx265) | 1080p/10s test clip | real-time factor, wall time, peak RSS |
| Resolution sweep (480p → 4K) | H.264, 10s clip | encode time per resolution |
| Stream copy (`-c copy`) | 1080p/10s | throughput ceiling |
| Audio-only extraction | 10s audio | extraction time |

**Pass criteria:**
- All conversions complete without error
- Real-time factor > 1.0x for 1080p on modern hardware (software encode)
- Stream copy > 10x real-time

### 1.2 Batch Queue Concurrency & Scheduling

**File:** `perf/queue-concurrency.perf.test.ts`

Validates the `JobQueue` class (from `src/main/queue/job-queue.ts`) under various concurrency scenarios.

| Test Case | Setup | Assertions |
|---|---|---|
| Concurrency 1: sequential | 4 fast jobs | Never >1 active; total ≈ sum of individual |
| Concurrency 4: parallel | 4 fast jobs | ≤4 active; total ≈ slowest job |
| Dynamic concurrency change | Start 1, switch to 4 mid-run | Remaining slots fill immediately |
| Rapid add/remove/cancel | 20 jobs, cancel 10 | No orphaned processes, queue drains |
| Priority scheduling | Jobs with priority 0, 1, 2 | Higher priority starts first |
| Pause/resume cycle | Pause mid-run, resume | Progress resumes, no duplicates |
| Drain event correctness | Run N jobs | `drained` fires exactly once after last completion |
| Stress: 50 jobs, concurrency 4 | 50 fast conversions | All complete, memory stable |

### 1.3 Startup Performance

**File:** `perf/startup.perf.test.ts`

| Metric | Target | Method |
|---|---|---|
| Capability probe time | <10s (bounded by `CAPABILITY_PROBE_TIMEOUT_MS`) | Time `getInfo()` / transcoder creation |
| CLI help output | <1s | `child_process.execSync('node bin/encodex.js --help')` |
| Queue restore from persistence | <100ms for 100 jobs | Direct `JobQueue` instantiation with mock persistence |

---

## Phase 2: Resource Safety

### 2.1 FFmpeg Process Lifecycle & Cleanup

**File:** `perf/process-lifecycle.perf.test.ts`

Ensures no zombie/orphaned FFmpeg processes under stress.

| Test Case | Method | Assertion |
|---|---|---|
| Cancel mid-conversion | Kill active encode | Process count returns to baseline |
| CancelAll with 4 active | Cancel all simultaneously | All processes terminated |
| Rapid open/seek/close | 50 rapid player cycles (mocked) | No leftover pipes |
| SIGSTOP/SIGCONT | Pause/resume active process | Process state changes correctly |

### 2.2 Memory Management & Leak Detection

**File:** `perf/memory-leak.perf.test.ts`

| Test Case | Duration | Pass Criteria |
|---|---|---|
| Repeated conversion (50 runs) | ~5 min | RSS growth < 50MB |
| Waveform extraction x10 | 10 files | Released within 10% of baseline |
| Log store cap (2000 entries) | Flood with 5000 | Capped at `LOG_MAX_ENTRIES` |
| Error history cap (50 entries) | Trigger 100 errors | Capped at `ERROR_HISTORY_MAX` |

### 2.3 Large File Handling

**File:** `perf/large-file.perf.test.ts`

| Test Case | Input | Assertion |
|---|---|---|
| 100MB video conversion | Generated test file | Completes without OOM |
| Multi-stream probe | 4K MKV mock | Probe within 10s |
| Long video waveform (5min) | 5min test clip | `WAVEFORM_MAX_BUCKETS` cap respected |
| 100 small files in batch | 100 tiny clips | All complete, no file handle leak |

---

## Phase 3: Communication & UI

### 3.1 IPC Communication Overhead

**File:** `perf/ipc-overhead.perf.test.ts`

Measures latency of typed IPC patterns.

| Test Case | Method | Target |
|---|---|---|
| Single invoke roundtrip | Mock IPC handler | <5ms (in-process) |
| Burst of 1000 calls | Sequential mock invocations | <1ms average |
| Event storm (1000 events) | Rapid EventEmitter emissions | All received, no drops |
| Queue event fanout (100 jobs) | Add 100 jobs rapidly | All events delivered |

### 3.2 CLI Batch Mode Performance

**File:** `perf/cli-batch.perf.test.ts`

| Test Case | Method | Metric |
|---|---|---|
| Single-file convert | CLI `convert` subcommand | Total wall time |
| Batch (20 files) | CLI `batch` subcommand | Files/min throughput |
| JSON info output | 100 files info | Parse time |

### 3.3 Waveform & Thumbnail Extraction

**File:** `perf/extraction.perf.test.ts`

| Test Case | Method | Target |
|---|---|---|
| Waveform: 5min file | Extract with segment defaults | <30s, correct bucket count |
| Thumbnails: 100 max | `THUMB_MAX_COUNT` enforcement | Exactly 100 thumbnails |
| Concurrent FFmpeg cap | Waveform + thumbnails simultaneously | Never > `MAX_CONCURRENT_FFMPEG` |

---

## Execution Order

| Phase | Sections | Estimated Effort |
|---|---|---|
| **Phase 1** | 1.1, 1.2, 1.3 | Core benchmarks |
| **Phase 2** | 2.1, 2.2, 2.3 | Resource safety |
| **Phase 3** | 3.1, 3.2, 3.3 | Communication & UI |

Each phase has a checkpoint where all tests must pass before proceeding.

## Running the Tests

```bash
# Run all performance tests
npm run perf

# Run specific phase
npm run perf:phase1
npm run perf:phase2
npm run perf:phase3

# Run specific test file
npx vitest run perf/conversion-benchmark.perf.test.ts --config perf/vitest.perf.config.ts

# Generate test media fixtures
npm run perf:generate-media
```

## Results

All test results are logged as structured JSON to `perf/results/` with timestamps. Each test file outputs a summary object with:
- Test name
- Duration (ms)
- Memory delta (bytes)
- Pass/fail status
- Any threshold violations

## Key Constants Reference

| Constant | Value | Source |
|---|---|---|
| `MAX_CONCURRENT_FFMPEG` | 8 | `src/shared/constants.ts` |
| `MAX_QUEUE_CONCURRENCY` | 4 | `src/shared/constants.ts` |
| `DEFAULT_QUEUE_CONCURRENCY` | 1 | `src/shared/constants.ts` |
| `CLI_CONVERSION_TIMEOUT_MS` | 300000 | `src/shared/constants.ts` |
| `CAPABILITY_PROBE_TIMEOUT_MS` | 10000 | `src/shared/constants.ts` |
| `LOG_MAX_ENTRIES` | 2000 | `src/shared/constants.ts` |
| `ERROR_HISTORY_MAX` | 50 | `src/shared/constants.ts` |
| `WAVEFORM_MAX_BUCKETS` | 24000 | `src/shared/constants.ts` |
| `THUMB_MAX_COUNT` | 100 | `src/shared/constants.ts` |
