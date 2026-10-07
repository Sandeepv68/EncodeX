/**
 * @fileoverview Blocking dependency-audit gate (Phase 10).
 *
 * Runs `npm audit --json` and fails when any HIGH or CRITICAL advisory is
 * present that is not on the committed exception list
 * (`scripts/audit-allowlist.json`). The repo keeps production deps clean and
 * treats the dev-toolchain set in the allowlist (vite/vue/source-map-js,
 * @modelcontextprotocol/sdk, shell-quote/concurrently) as known, tracked,
 * unresolvable-now items; a NEW advisory at high or critical severity turns
 * the build red even while those known ones remain.
 *
 * This supersedes the earlier "flip continue-on-error when `npm audit` exits
 * 0" note (plans/CI_IMPROVEMENTS.md O1, plans/CI_CD_EXPANSION_PLAN.md N4):
 * npm now reports a larger known set, so a strict exit-code gate would block
 * every run. The exception list is the "documented exception list" the plan
 * calls for.
 */

import * as cp from 'child_process';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const SEVERITIES = new Set(['high', 'critical']);

/**
 * Collects every HIGH/CRITICAL advisory in a parsed `npm audit --json` report,
 * deduplicated by advisory URL. Transitive derivations (a package flagged high
 * because one of its `via` advisories is high) are resolved naturally because
 * the owning package's `via` carries the advisory object.
 * @param {object} report - Parsed `npm audit --json` output.
 * @returns {Array<{url: string, severity: string, package: string, title: string}>}
 */
export function collectHighCritical(report) {
  const found = new Map();
  for (const [pkg, info] of Object.entries(report?.vulnerabilities ?? {})) {
    for (const via of info?.via ?? []) {
      if (typeof via !== 'object' || via === null) continue;
      if (!SEVERITIES.has(via.severity) || !via.url) continue;
      found.set(via.url, {
        url: via.url,
        severity: via.severity,
        package: via.name ?? pkg,
        title: via.title ?? '',
      });
    }
  }
  return [...found.values()];
}

/**
 * Applies the exception list: advisories whose URL is allowlisted are known;
 * anything else at high/critical is a gate failure.
 * @param {Array<{url: string}>} present - {@link collectHighCritical} result.
 * @param {object | null} allowlist - Loaded `audit-allowlist.json`.
 * @returns {{ blocked: Array<object>, allowed: Array<object> }}
 */
export function evaluateAuditGate(present, allowlist) {
  const allowed = new Set((allowlist?.advisories ?? []).map((a) => a.url));
  const blocked = present.filter((a) => !allowed.has(a.url));
  const allowedHits = present.filter((a) => allowed.has(a.url));
  return { blocked, allowed: allowedHits };
}

export function loadAllowlist(file = null) {
  const allowlistFile = file ?? fileURLToPath(new URL('./audit-allowlist.json', import.meta.url));
  if (!fs.existsSync(allowlistFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(allowlistFile, 'utf8'));
  } catch {
    return null;
  }
}

function runAudit() {
  if (process.env.npm_execpath) {
    const [npmCli] = [process.env.npm_execpath];
    try {
      return JSON.parse(cp.execFileSync(process.execPath, [npmCli, 'audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    } catch (err) {
      const stdout = err.stdout?.toString?.() ?? '';
      if (stdout) {
        try {
          return JSON.parse(stdout);
        } catch {
          /* fall through to the shared failure path */
        }
      }
    }
  } else {
    const res = cp.spawnSync('npm audit --json', { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (res.stdout && res.stdout.trim()) {
      try {
        return JSON.parse(res.stdout);
      } catch {
        /* fall through to the shared failure path */
      }
    }
  }
  console.error('`npm audit --json` produced no parseable output.');
  process.exit(2);
}

const main = () => {
  const allowlistFile = fileURLToPath(new URL('./audit-allowlist.json', import.meta.url));
  const report = runAudit();
  const allowlist = loadAllowlist();
  if (!allowlist) {
    console.error(`No exception list at ${allowlistFile}; refusing to run an unlisted audit gate.`);
    process.exit(2);
  }
  const present = collectHighCritical(report);
  const { blocked, allowed: allowedHits } = evaluateAuditGate(present, allowlist);

  console.log('='.repeat(72));
  console.log(`Dependency audit gate: ${present.length} high/critical advisory(ies) found`);
  console.log('='.repeat(72));
  for (const a of allowedHits) {
    console.log(`  [exception] ${a.severity.padEnd(8)} ${a.package}: ${a.title || a.url}`);
  }
  for (const a of blocked) {
    console.log(`  [BLOCKED]   ${a.severity.padEnd(8)} ${a.package}: ${a.title || a.url}`);
  }
  console.log('='.repeat(72));

  if (blocked.length > 0) {
    console.error(`FAIL: ${blocked.length} new HIGH/CRITICAL advisory(ies) not on the exception list.`);
    process.exit(1);
  }
  if (present.length === 0) {
    console.log('Clean: no high or critical advisories. The allowlist can be drained.');
  }
};

const isMain =
  import.meta.main ??
  (process.argv[1] !== undefined && new URL(process.argv[1], 'file://').pathname === fileURLToPath(import.meta.url).replace(/\\/g, '/'));

if (isMain) {
  main();
}
