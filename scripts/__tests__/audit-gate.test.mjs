/**
 * @fileoverview Phase 10: tests for the dependency-audit gate script itself
 * (same rule the repo applies to coverage/flake/mutation tooling: a script
 * that decides whether CI merges is tested like any other code). Covers
 * transitive advisory derivation, the exception list, and the block path for
 * NEW high/critical advisories.
 */

import { describe, it, expect } from 'vitest';
import { collectHighCritical, evaluateAuditGate } from '../audit-gate.mjs';

function advisory(id, title, severity = 'high') {
  return { source: 123, name: `${id}`, dependency: id, title, severity, url: `https://github.com/advisories/${id}` };
}

function report({ highAds = [], moderateAds = [], transitive = {} } = {}) {
  const packages = {};
  const addPackage = (name, via, severity = 'moderate') => {
    packages[name] = { name, severity, isDirect: false, via, range: '', nodes: [] };
  };
  highAds.forEach((ad, i) => addPackage(ad.dependency, [ad], 'high'));
  moderateAds.forEach((ad, i) => addPackage(ad.dependency, [ad], 'moderate'));
  for (const [pkg, owner] of Object.entries(transitive)) {
    addPackage(pkg, [owner], 'high');
  }
  return { vulnerabilities: packages };
}

describe('collectHighCritical', () => {
  it('collects high/critical advisories only, deduped by URL', () => {
    const r = report({ highAds: [advisory('GHSA-aaa', 'one'), advisory('GHSA-bbb', 'two', 'critical')] });
    const found = collectHighCritical(r);
    expect(found.map((f) => f.url)).toContain('https://github.com/advisories/GHSA-aaa');
    expect(found.map((f) => f.url)).toContain('https://github.com/advisories/GHSA-bbb');
    expect(found).toHaveLength(2);
  });

  it('ignores moderate advisories', () => {
    const r = report({ moderateAds: [advisory('GHSA-moderate', 'ok', 'moderate')] });
    expect(collectHighCritical(r)).toHaveLength(0);
  });

  it('resolves transitive derivation via the owning package', () => {
    const r = report({ transitive: { vue: advisory('GHSA-vue', 'vue ssr', 'high') } });
    const found = collectHighCritical(r);
    expect(found).toHaveLength(1);
    expect(found[0].url).toContain('GHSA-vue');
    expect(found[0].severity).toBe('high');
  });

  it('tolerates a missing report', () => {
    expect(collectHighCritical(undefined)).toHaveLength(0);
  });
});

describe('evaluateAuditGate', () => {
  const allowlist = {
    advisories: [
      { url: 'https://github.com/advisories/GHSA-known', severity: 'high' },
      { url: 'https://github.com/advisories/GHSA-known2', severity: 'critical' },
    ],
  };

  it('blocks nothing when every high/critical advisory is exceptioned', () => {
    const present = [
      { url: 'https://github.com/advisories/GHSA-known', severity: 'high', package: 'vite' },
      { url: 'https://github.com/advisories/GHSA-known2', severity: 'critical', package: 'shell-quote' },
    ];
    const { blocked, allowed } = evaluateAuditGate(present, allowlist);
    expect(blocked).toHaveLength(0);
    expect(allowed).toHaveLength(2);
  });

  it('blocks a NEW advisory that is not exceptioned', () => {
    const present = [{ url: 'https://github.com/advisories/GHSA-brand-new', severity: 'critical', package: 'esbuild' }];
    const { blocked } = evaluateAuditGate(present, allowlist);
    expect(blocked).toHaveLength(1);
    expect(blocked[0].url).toContain('GHSA-brand-new');
  });

  it('refuses to allowlist when the exception list is missing', () => {
    const present = [{ url: 'https://github.com/advisories/GHSA-x', severity: 'high', package: 'a' }];
    expect(evaluateAuditGate(present, null).blocked).toHaveLength(1);
  });
});
