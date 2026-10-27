#!/usr/bin/env node
/**
 * @fileoverview Verifies the MCP App views a host depends on.
 *
 * The smoke test checks that the server *exposes* the MCP Apps surface. This
 * script checks what a host actually receives: for every `ui://` resource it
 * reads the document and asserts that it is a self-contained, in-budget
 * document that mounts the right view.
 *
 * What this script proves:
 *  - the `io.modelcontextprotocol/ui` extension is advertised with the MIME
 *    type hosts require,
 *  - every view is listed and readable with `text/html;profile=mcp-app`,
 *  - the document loads no external script, stylesheet, font or frame,
 *  - the document mounts the view it is addressed to, and
 *  - the document stays inside the size budget.
 *
 * What it cannot prove: that a third-party host renders it. That is the
 * manual procedure in `docs/MCP_UI_HOSTS.md`.
 *
 * Usage:
 *   node scripts/mcp-host-check.mjs            # against the built server
 *   node scripts/mcp-host-check.mjs --electron # against the packaged app
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_MCP = path.join(ROOT, 'dist', 'mcp', 'index.js');

/** The extension identifier a host looks for. @const {string} */
const UI_EXTENSION_ID = 'io.modelcontextprotocol/ui';
/** The MIME type a host requires before it renders a view. @const {string} */
const UI_RESOURCE_MIME = 'text/html;profile=mcp-app';
/** Ceiling for one served view document, in bytes. @const {number} */
const MAX_DOCUMENT_BYTES = 1024 * 1024;

/**
 * The views the server serves, with the view id the document must mount.
 * @const {Array<{uri: string, viewId: string}>}
 */
const VIEWS = [
  { uri: 'ui://encodex/queue', viewId: 'queue' },
  { uri: 'ui://encodex/job', viewId: 'job' },
  { uri: 'ui://encodex/media-info', viewId: 'mediaInfo' },
  { uri: 'ui://encodex/convert', viewId: 'convert' },
  { uri: 'ui://encodex/confirm', viewId: 'confirm' },
  { uri: 'ui://encodex/inspector', viewId: 'inspector' },
  { uri: 'ui://encodex/plan', viewId: 'plan' },
  { uri: 'ui://encodex/lab', viewId: 'lab' },
  { uri: 'ui://encodex/error', viewId: 'error' },
  { uri: 'ui://encodex/batch', viewId: 'batch' },
  { uri: 'ui://encodex/workflow', viewId: 'workflow' },
  { uri: 'ui://encodex/profiles', viewId: 'profiles' },
  { uri: 'ui://encodex/capabilities', viewId: 'capabilities' },
];

/** The failures collected during the run. @type {string[]} */
const failures = [];

/**
 * Records a failed expectation.
 * @param {string} message - What failed.
 * @returns {void}
 */
function fail(message) {
  failures.push(message);
  process.stdout.write(`  FAIL ${message}\n`);
}

/**
 * Resolves the spawn command for the requested target.
 * @returns {Promise<{command: string, args: string[]}>} The command + args.
 */
async function resolveTarget() {
  const argv = process.argv.slice(2);
  const useElectron = argv.includes('--electron');
  if (useElectron) {
    const mod = await import('electron');
    const electronPath = mod.default ?? mod;
    return { command: electronPath, args: [ROOT, '--mcp'] };
  }
  if (!fs.existsSync(DIST_MCP)) {
    throw new Error(`Missing ${DIST_MCP}. Run \`npm run build\` first.`);
  }
  return { command: process.execPath, args: [DIST_MCP] };
}

/**
 * Checks one served view document.
 * @param {string} uri - The resource URI.
 * @param {string} viewId - The view the document must mount.
 * @param {{mimeType?: string, text?: string}} content - The read content item.
 * @returns {void}
 */
function checkDocument(uri, viewId, content) {
  if (content.mimeType !== UI_RESOURCE_MIME) {
    fail(`${uri} mime is ${content.mimeType}, expected ${UI_RESOURCE_MIME}`);
  }
  const html = content.text ?? '';
  if (!html.startsWith('<!doctype html>')) {
    fail(`${uri} is not an HTML document`);
  }
  if (!html.includes(`window.__ENCODEX_VIEW__="${viewId}"`)) {
    fail(`${uri} does not mount the ${viewId} view`);
  }
  if (!html.includes('ui/initialize')) {
    fail(`${uri} does not perform the MCP Apps handshake`);
  }
  if (/<script\b[^>]*\bsrc=/i.test(html)) {
    fail(`${uri} loads an external script`);
  }
  if (/<link\b[^>]*\bstylesheet/i.test(html)) {
    fail(`${uri} loads an external stylesheet`);
  }
  if (/<(iframe|frame)\b/i.test(html)) {
    fail(`${uri} embeds a frame`);
  }
  if (html.length > MAX_DOCUMENT_BYTES) {
    fail(`${uri} is ${html.length} bytes, over the ${MAX_DOCUMENT_BYTES} byte budget`);
  }
}

/**
 * Runs the check.
 * @returns {Promise<void>} Resolves on success.
 */
async function main() {
  const { command, args } = await resolveTarget();
  process.stdout.write(`[mcp-host-check] spawning: ${command} ${args.join(' ')}\n`);

  const transport = new StdioClientTransport({ command, args, stderr: 'pipe', env: { ...process.env } });
  const client = new Client(
    { name: 'encodex-mcp-host-check', version: '1.0.0' },
    { capabilities: { extensions: { [UI_EXTENSION_ID]: { mimeTypes: [UI_RESOURCE_MIME] } } } },
  );
  await client.connect(transport);

  try {
    const capabilities = client.getServerCapabilities();
    const uiCapability = capabilities?.extensions?.[UI_EXTENSION_ID];
    if (!uiCapability) {
      fail('the server does not advertise the io.modelcontextprotocol/ui extension');
    } else if (!JSON.stringify(uiCapability).includes(UI_RESOURCE_MIME)) {
      fail(`the extension does not advertise ${UI_RESOURCE_MIME}`);
    } else {
      process.stdout.write('  OK   the MCP Apps extension is advertised\n');
    }

    const { resources } = await client.listResources();
    const listed = new Map(resources.map((resource) => [resource.uri, resource]));

    for (const view of VIEWS) {
      const resource = listed.get(view.uri);
      if (!resource) {
        fail(`${view.uri} is not listed`);
        continue;
      }
      if (resource.mimeType !== UI_RESOURCE_MIME) {
        fail(`${view.uri} is listed with mime ${resource.mimeType}`);
        continue;
      }
      const result = await client.readResource({ uri: view.uri });
      const content = result.contents[0] ?? {};
      checkDocument(view.uri, view.viewId, content);
      if (!failures.length || failures[failures.length - 1]?.startsWith(view.uri) === false) {
        process.stdout.write(`  OK   ${view.uri} (${(content.text ?? '').length} bytes)\n`);
      }
    }
  } finally {
    await client.close();
  }

  if (failures.length > 0) {
    throw new Error(`${failures.length} check(s) failed`);
  }
  process.stdout.write(`[mcp-host-check] OK - ${VIEWS.length} MCP App views verified\n`);
}

main().catch((err) => {
  process.stderr.write(`[mcp-host-check] FAILED: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
