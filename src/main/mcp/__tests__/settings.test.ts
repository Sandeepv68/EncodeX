import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  MCP_DEFAULT_PORT,
  MCP_MAX_PORT,
  MCP_MIN_PORT,
  MCP_SETTINGS_FILENAME,
  McpSettings,
  clampMcpPort,
  defaultMcpSettings,
  mcpSettingsFilePath,
  readMcpSettings,
  sanitizeMcpSettings,
  writeMcpSettings,
} from '../settings';

/** Temp userData directory per test. @type {string} */
let userDataDir: string;

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-settings-'));
});

afterEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe('MCP settings defaults', () => {
  it('defaults to disabled on the standard port with no token', () => {
    expect(defaultMcpSettings()).toEqual({ enabled: false, port: 8765, token: '' });
  });

  it('resolves the settings file under userData', () => {
    expect(mcpSettingsFilePath(userDataDir)).toBe(path.join(userDataDir, MCP_SETTINGS_FILENAME));
  });
});

describe('clampMcpPort', () => {
  it('passes through a valid in-range port', () => {
    expect(clampMcpPort(8765)).toBe(8765);
    expect(clampMcpPort(1024)).toBe(1024);
    expect(clampMcpPort(65535)).toBe(65535);
  });

  it('falls back to the default for out-of-range ports', () => {
    expect(clampMcpPort(MCP_MIN_PORT - 1)).toBe(MCP_DEFAULT_PORT);
    expect(clampMcpPort(MCP_MAX_PORT + 1)).toBe(MCP_DEFAULT_PORT);
    expect(clampMcpPort(0)).toBe(MCP_DEFAULT_PORT);
    expect(clampMcpPort(-1)).toBe(MCP_DEFAULT_PORT);
  });

  it('falls back to the default for non-numeric values', () => {
    expect(clampMcpPort('abc')).toBe(MCP_DEFAULT_PORT);
    expect(clampMcpPort(undefined)).toBe(MCP_DEFAULT_PORT);
    expect(clampMcpPort(NaN)).toBe(MCP_DEFAULT_PORT);
    expect(clampMcpPort(Infinity)).toBe(MCP_DEFAULT_PORT);
    expect(clampMcpPort(null)).toBe(MCP_DEFAULT_PORT);
  });

  it('floors fractional port values', () => {
    expect(clampMcpPort(8765.9)).toBe(8765);
  });
});

describe('sanitizeMcpSettings', () => {
  it('treats only a literal true as enabled', () => {
    expect(sanitizeMcpSettings({ enabled: true }).enabled).toBe(true);
    expect(sanitizeMcpSettings({ enabled: 'yes' }).enabled).toBe(false);
    expect(sanitizeMcpSettings({ enabled: 1 }).enabled).toBe(false);
    expect(sanitizeMcpSettings({}).enabled).toBe(false);
  });

  it('clamps invalid ports and keeps string tokens', () => {
    const s = sanitizeMcpSettings({ enabled: true, port: 8, token: 'secret' });
    expect(s).toEqual({ enabled: true, port: MCP_DEFAULT_PORT, token: 'secret' });
  });

  it('normalizes a non-string token to empty', () => {
    expect(sanitizeMcpSettings({ token: 42 }).token).toBe('');
  });
});

describe('readMcpSettings / writeMcpSettings', () => {
  it('returns defaults when no file exists', () => {
    expect(readMcpSettings(userDataDir)).toEqual(defaultMcpSettings());
  });

  it('round-trips a stored snapshot', () => {
    const snapshot: McpSettings = { enabled: true, port: 9123, token: 'abc123' };
    writeMcpSettings(userDataDir, snapshot);
    expect(readMcpSettings(userDataDir)).toEqual(snapshot);
  });

  it('creates the userData directory when missing', () => {
    const nested = path.join(userDataDir, 'missing', 'dir');
    writeMcpSettings(nested, { enabled: true, port: MCP_DEFAULT_PORT, token: '' });
    expect(fs.existsSync(path.join(nested, MCP_SETTINGS_FILENAME))).toBe(true);
    expect(readMcpSettings(nested).enabled).toBe(true);
  });

  it('sanitizes values coming back out of the file', () => {
    writeMcpSettings(userDataDir, { enabled: true as unknown as boolean, port: 90, token: undefined as unknown as string });
    expect(readMcpSettings(userDataDir)).toEqual({ enabled: true, port: MCP_DEFAULT_PORT, token: '' });
  });

  it('falls back to defaults for a corrupt file without throwing', () => {
    fs.writeFileSync(path.join(userDataDir, MCP_SETTINGS_FILENAME), 'not json {{{');
    expect(() => readMcpSettings(userDataDir)).not.toThrow();
    expect(readMcpSettings(userDataDir)).toEqual(defaultMcpSettings());
  });

  it('tolerates a UTF-8 byte-order mark', () => {
    fs.writeFileSync(path.join(userDataDir, MCP_SETTINGS_FILENAME), `\uFEFF${JSON.stringify({ enabled: true, port: 9500, token: 'bom' })}`);
    expect(readMcpSettings(userDataDir)).toEqual({ enabled: true, port: 9500, token: 'bom' });
  });
});
