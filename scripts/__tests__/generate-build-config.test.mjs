/**
 * @fileoverview Tests for the build-config generators.
 *
 * The generators bake release-build credentials into `src/main/generated/`.
 * They must resolve `.env` exactly like the running app does (dotenv, where a
 * duplicated key resolves to its *last* occurrence). A generator that picked
 * the first occurrence shipped a different host than the app used at runtime,
 * which silently disabled analytics.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Runs a generator script in an isolated working directory and returns the
 * generated TypeScript module.
 * @param {string} script - Generator script name inside `scripts/`.
 * @param {string} outputName - File the generator writes.
 * @param {string} cwd - Directory the generator writes into.
 * @param {Record<string, string>} env - Environment overrides.
 * @returns {string} The generated file contents.
 */
function runGenerator(script, outputName, cwd, env) {
  execFileSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script)], {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
  return fs.readFileSync(path.join(cwd, 'src', 'main', 'generated', outputName), 'utf8');
}

/**
 * Creates a temp workspace with a `.env` and an output directory.
 * @param {string} dotEnv - Contents of the `.env` file.
 * @returns {string} The workspace directory.
 */
function makeWorkspace(dotEnv) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-gen-config-'));
  fs.writeFileSync(path.join(dir, '.env'), dotEnv, 'utf8');
  return dir;
}

describe('generate build config', () => {
  it('resolves a duplicated .env key to its last value (PostHog)', () => {
    const dir = makeWorkspace(
      [
        'POSTHOG_HOST=https://first.example',
        'POSTHOG_PROJECT_TOKEN=phc_first',
        'POSTHOG_HOST=https://second.example',
        'POSTHOG_PROJECT_TOKEN=phc_second',
        '',
      ].join('\n'),
    );
    const out = runGenerator('generate-posthog-config.mjs', 'posthogBuildConfig.ts', dir, {
      POSTHOG_HOST: '',
      POSTHOG_PROJECT_TOKEN: '',
    });
    expect(out).toContain('"https://second.example"');
    expect(out).toContain('"phc_second"');
    expect(out).not.toContain('https://first.example');
    expect(out).not.toContain('phc_first');
  });

  it('resolves a duplicated .env key to its last value (Aptabase)', () => {
    const dir = makeWorkspace(
      ['APTABASE_APP_KEY=A-US-first', 'APTABASE_APP_KEY=A-US-second', ''].join('\n'),
    );
    const out = runGenerator('generate-aptabase-config.mjs', 'aptabaseBuildConfig.ts', dir, {
      APTABASE_APP_KEY: '',
      APTABASE_HOST: '',
      APTABASE_ENVIRONMENT: '',
    });
    expect(out).toContain('"A-US-second"');
    expect(out).not.toContain('A-US-first');
  });

  it('lets real environment variables win over .env', () => {
    const dir = makeWorkspace('POSTHOG_PROJECT_TOKEN=phc_from_file\nPOSTHOG_HOST=https://file.example\n');
    const out = runGenerator('generate-posthog-config.mjs', 'posthogBuildConfig.ts', dir, {
      POSTHOG_PROJECT_TOKEN: 'phc_from_env',
      POSTHOG_HOST: 'https://env.example',
    });
    expect(out).toContain('"phc_from_env"');
    expect(out).toContain('"https://env.example"');
    expect(out).not.toContain('phc_from_file');
  });
});
