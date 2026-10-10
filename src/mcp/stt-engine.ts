/**
 * @fileoverview whisper.cpp STT engine adapter (roadmap 2.0, F11). Spawns a local
 * whisper.cpp CLI to transcribe an audio file into whisper's JSON, then parses
 * it into a {@link Transcript}. Lives in `src/mcp` because it spawns processes;
 * the parser and contract live in `shared/ai/stt.ts`.
 *
 * The engine is best-effort and injectable: when no binary/model is configured
 * it reports itself unavailable, and `transcribe` fails with a typed
 * `TRANSCRIPTION_UNAVAILABLE` error rather than a vague crash.
 */

import { spawn, spawnSync } from 'child_process';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createError, ErrorCode } from '../shared/errors';
import { parseWhisperJson, transcriptFromText } from '../shared/ai/stt';
import type { SttEngine, SttOptions } from '../shared/ai/stt';
import type { Transcript } from '../shared/ai/transcript';

/**
 * Binary names tried, in order, when `ENCODEX_WHISPER_BIN` is not set.
 * @const {string[]}
 */
const WHISPER_CANDIDATES = ['whisper-cli', 'whisper', 'whisper.cpp'];

/**
 * Default wall-clock budget for a transcription.
 * @const {number}
 */
const DEFAULT_TIMEOUT_MS = 600000;

/**
 * Resolves the whisper.cpp binary: an explicit override first, then the first
 * candidate on `PATH` that responds to `--help`.
 * @returns {string | undefined} The binary path/name, or `undefined`.
 */
function resolveBinary(): string | undefined {
  const explicit = (process.env.ENCODEX_WHISPER_BIN ?? '').trim();
  if (explicit) return explicit;
  for (const candidate of WHISPER_CANDIDATES) {
    const probe = spawnSync(candidate, ['--help'], { timeout: 5000, windowsHide: true });
    if (!probe.error) return candidate;
  }
  return undefined;
}

/**
 * Resolves the whisper model file from the environment.
 * @returns {string | undefined} The model path, or `undefined`.
 */
function resolveModel(): string | undefined {
  const model = (process.env.ENCODEX_WHISPER_MODEL ?? '').trim();
  return model || undefined;
}

/**
 * Runs a process to completion with a timeout, capturing stdout/stderr.
 * @param {string} command - Executable.
 * @param {string[]} args - Arguments.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @returns {Promise<{ code: number | null; stderr: string; timedOut: boolean }>} The result.
 */
function run(command: string, args: string[], timeoutMs: number): Promise<{ code: number | null; stderr: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, { windowsHide: true });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
    }, timeoutMs);
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr, timedOut });
    });
  });
}

/**
 * Creates the whisper.cpp STT engine.
 * @returns {SttEngine} The engine.
 */
export function createWhisperCliEngine(): SttEngine {
  return {
    id: 'whisper.cpp',
    label: 'whisper.cpp (local)',
    available: async (): Promise<boolean> => Boolean(resolveBinary() && resolveModel()),
    transcribe: async (audioPath: string, options: SttOptions = {}): Promise<Transcript> => {
      const binary = resolveBinary();
      if (!binary) {
        throw createError(
          ErrorCode.TRANSCRIPTION_UNAVAILABLE,
          'No whisper.cpp binary was found. Set ENCODEX_WHISPER_BIN or install whisper-cli on PATH.',
        );
      }
      const model = options.modelPath ?? resolveModel();
      if (!model) {
        throw createError(
          ErrorCode.TRANSCRIPTION_UNAVAILABLE,
          'No whisper model was provided. Set ENCODEX_WHISPER_MODEL or pass modelPath.',
        );
      }
      const outBase = path.join(os.tmpdir(), `encodex-stt-${randomBytes(6).toString('hex')}`);
      const args = ['-m', model, '-f', audioPath, '-oj', '-of', outBase, '-nt'];
      if (options.language) args.push('-l', options.language);
      const result = await run(binary, args, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      try {
        if (result.timedOut) {
          throw createError(ErrorCode.TRANSCRIPTION_UNAVAILABLE, 'Transcription timed out.');
        }
        if (fs.existsSync(`${outBase}.json`)) {
          const raw = JSON.parse(fs.readFileSync(`${outBase}.json`, 'utf8')) as unknown;
          return parseWhisperJson(raw);
        }
        if (fs.existsSync(`${outBase}.txt`)) {
          const text = fs.readFileSync(`${outBase}.txt`, 'utf8');
          return transcriptFromText(text, 0, 'whisper.cpp');
        }
        throw createError(
          ErrorCode.TRANSCRIPTION_UNAVAILABLE,
          `whisper.cpp produced no transcript (exit ${result.code}). ${result.stderr.trim()}`.trim(),
        );
      } finally {
        for (const suffix of ['.json', '.txt', '.srt', '.vtt']) {
          try {
            fs.rmSync(`${outBase}${suffix}`, { force: true });
          } catch {
            /* ignore cleanup failures */
          }
        }
      }
    },
  };
}
