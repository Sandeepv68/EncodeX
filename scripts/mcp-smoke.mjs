#!/usr/bin/env node
/**
 * @fileoverview Standalone MCP smoke test.
 *
 * Spawns the EncodeX MCP server over stdio and verifies the handshake, the full
 * tool list, and a live `ping` round-trip. Two targets are supported:
 *
 *  - default (`npm run mcp:smoke`): `node dist/mcp/index.js` — the compiled
 *    standalone entry used by dev/CI and the packaged `--mcp` branch's runner.
 *  - `--electron` (`npm run mcp:smoke:electron`): `electron . --mcp` — exercises
 *    the Electron main-process `--mcp` branch (needs a display; use xvfb on
 *    Linux). Extra CLI flags (e.g. `--no-sandbox`) are forwarded.
 *
 * Exits 0 on success and 1 with a diagnostic on any failure.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_MCP = path.join(ROOT, 'dist', 'mcp', 'index.js');

// The stdio surface (standalone `node dist/mcp/index.js` and the Electron
// `--mcp` branch) exposes the 13 core tools. The 6 GUI-parity tools are only
// registered by the embedded HTTP server inside the running GUI.
const EXPECTED_TOOL_COUNT = 13;
const REQUIRED_TOOLS = [
  'ping',
  'convert_media',
  'get_job',
  'list_jobs',
  'cancel_job',
  'get_media_info',
  'list_capabilities',
  'list_profiles',
  'get_profile',
  'compress_image',
  'extract_audio',
  'cut_video',
  'batch_convert',
];

/**
 * Resolves the spawn command for the requested target.
 * @returns {Promise<{command: string, args: string[]}>} The command + args.
 */
async function resolveTarget() {
  const argv = process.argv.slice(2);
  const useElectron = argv.includes('--electron');
  const extra = argv.filter((arg) => !arg.startsWith('--electron'));

  if (useElectron) {
    const mod = await import('electron');
    const electronPath = mod.default ?? mod;
    return { command: electronPath, args: [ROOT, '--mcp', ...extra] };
  }
  if (!fs.existsSync(DIST_MCP)) {
    throw new Error(`Missing ${DIST_MCP}. Run \`npm run build:main\` first.`);
  }
  return { command: process.execPath, args: [DIST_MCP, ...extra] };
}

/**
 * Runs the smoke test.
 * @returns {Promise<void>} Resolves on success.
 */
async function main() {
  const { command, args } = await resolveTarget();
  console.log(`[mcp-smoke] spawning: ${command} ${args.join(' ')}`);

  let stderr = '';
  const transport = new StdioClientTransport({
    command,
    args,
    stderr: 'pipe',
    env: { ...process.env },
  });
  transport.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > 8192) stderr = stderr.slice(-8192);
  });

  const client = new Client({ name: 'encodex-mcp-smoke', version: '1.0.0' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();

    const missing = REQUIRED_TOOLS.filter((name) => !names.includes(name));
    if (missing.length > 0) {
      throw new Error(`Missing tools: ${missing.join(', ')}`);
    }
    if (tools.length < EXPECTED_TOOL_COUNT) {
      throw new Error(`Expected at least ${EXPECTED_TOOL_COUNT} tools, got ${tools.length}`);
    }

    const result = await client.callTool({ name: 'ping', arguments: {} });
    const text = (result.content ?? [])
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('');
    const parsed = JSON.parse(text);
    if (parsed.pong !== true) {
      throw new Error(`Unexpected ping response: ${text}`);
    }

    console.log(`[mcp-smoke] OK — ${tools.length} tools registered, ping returned pong`);
  } catch (error) {
    console.error(`[mcp-smoke] FAILED: ${error instanceof Error ? error.message : String(error)}`);
    if (stderr.trim()) console.error(`[mcp-smoke] server stderr:\n${stderr.trim()}`);
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => undefined);
  }
}

await main();
