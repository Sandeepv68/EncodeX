/**
 * @fileoverview Shared helpers for the documentation drift checker.
 *
 * Extracts numeric facts from the application source tree and validates
 * `<!-- drift:<key>=<value> -->` markers found in documentation files.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

/** Documentation trees scanned for drift markers. */
export const DOC_ROOTS = [
  { dir: 'wiki', label: 'wiki' },
  { dir: 'docs', label: 'docs' },
  { dir: 'site/docs', label: 'site/docs' },
  { dir: 'site/locales', label: 'site/locales' },
];

/** Files that legitimately contain no prose claims. */
export const DOC_IGNORE = new Set(['_Footer.md', '_Sidebar.md', 'README.md']);

/**
 * Marker syntax: `<!-- drift:<key>=<value> -->`, or a single comment carrying
 * several space-separated pairs: `<!-- drift: key=value key=value -->`.
 */
export const MARKER_RE = /<!--\s*drift:([^>]*?)-->/g;

export function readFile(root, relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function sourceFile(root, relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return ts.createSourceFile(full, fs.readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** Unwraps `as const`, parentheses and satisfies operators. */
function unwrap(node) {
  let current = node;
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isTypeAssertionExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

/** Returns the initializer of an exported `const <name>` declaration. */
function exportedInitializer(sf, name) {
  if (!sf) return null;
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer) {
        return unwrap(declaration.initializer);
      }
    }
  }
  return null;
}

/** Number of elements in an exported array constant. */
export function countArray(root, relPath, exportName) {
  const initializer = exportedInitializer(sourceFile(root, relPath), exportName);
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) return null;
  return initializer.elements.length;
}

/** Number of properties in an exported object constant. */
export function countObject(root, relPath, exportName) {
  const initializer = exportedInitializer(sourceFile(root, relPath), exportName);
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) return null;
  return initializer.properties.length;
}

/** Number of string-literal members of an exported union type. */
export function countUnion(root, relPath, typeName) {
  const sf = sourceFile(root, relPath);
  if (!sf) return null;
  for (const statement of sf.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== typeName) continue;
    const type = statement.type;
    if (!ts.isUnionTypeNode(type)) return null;
    return type.types.filter((t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)).length;
  }
  return null;
}

/**
 * Collects the tool-name argument of every matching call expression.
 * `registerTool(name, ...)` takes the name first, `registerAppTool(server, name, ...)` second.
 */
export function collectCallNames(root, relPath, calleeNames) {
  const sf = sourceFile(root, relPath);
  if (!sf) return null;
  const names = new Set();
  let calls = 0;
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const calleeName = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : '';
      if (calleeNames.includes(calleeName)) {
        calls++;
        const index = calleeName === 'registerAppTool' ? 1 : 0;
        const arg = node.arguments[index];
        if (arg && ts.isStringLiteral(unwrap(arg))) names.add(unwrap(arg).text);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return { names, calls };
}

export function listFiles(root, relDir, filter) {
  const full = path.join(root, relDir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full, { withFileTypes: true })
    .filter((e) => e.isFile() && filter(e.name))
    .map((e) => path.join(relDir, e.name));
}

export function countFilesRecursive(root, relDir, filter) {
  const full = path.join(root, relDir);
  if (!fs.existsSync(full)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const rel = path.join(relDir, entry.name);
    if (entry.isDirectory()) total += countFilesRecursive(root, rel, filter);
    else if (filter(entry.name)) total++;
  }
  return total;
}

/** Recomputes every drift-tracked fact from the source tree. */
export function computeFacts(root) {
  const localeFiles = listFiles(root, 'src/renderer/i18n/locales', (n) => n.endsWith('.json'));
  const subtags = new Set(localeFiles.map((f) => path.basename(f, '.json').split('-')[0]));

  const serverTools = collectCallNames(root, 'src/mcp/server.ts', ['registerTool', 'registerToolTask', 'registerAppTool']);
  const guiTools = collectCallNames(root, 'src/main/mcp/gui-tools.ts', ['registerTool', 'registerAppTool']);
  const hasCommitOperation = /COMMIT_OPERATION_TOOL/.test(readFile(root, 'src/mcp/server.ts'));

  return {
    'video-codecs': countArray(root, 'src/shared/media-options.ts', 'VIDEO_CODECS'),
    'audio-codecs': countArray(root, 'src/shared/media-options.ts', 'AUDIO_CODECS'),
    'pixel-formats': countArray(root, 'src/shared/media-options.ts', 'PIXEL_FORMATS'),
    'builtin-profiles': countArray(root, 'src/shared/profiles/builtin.ts', 'BUILTIN_PROFILES'),
    'profile-categories': countObject(root, 'src/shared/profiles/categories.ts', 'PROFILE_CATEGORIES'),
    shortcuts: countArray(root, 'src/renderer/constants/shortcuts.ts', 'SHORTCUTS'),
    'shortcut-sections': countArray(root, 'src/renderer/constants/shortcuts.ts', 'SHORTCUT_SECTIONS'),
    locales: localeFiles.length,
    'locale-subtags': subtags.size,
    'error-codes': countObject(root, 'src/shared/errors.ts', 'ErrorCode'),
    'ipc-channels': countObject(root, 'src/shared/ipc-channels.ts', 'IPC'),
    'renderer-pages': listFiles(root, 'src/renderer/pages', (n) => n.endsWith('.tsx')).length,
    'renderer-stores': listFiles(root, 'src/renderer/stores', (n) => n.endsWith('.ts') && n !== 'types.ts').length,
    'renderer-components': countFilesRecursive(root, 'src/renderer/components', (n) => n.endsWith('.tsx') && !n.endsWith('.test.tsx')),
    'renderer-components-top': listFiles(root, 'src/renderer/components', (n) => n.endsWith('.tsx')).length,
    'renderer-component-tests': countFilesRecursive(root, 'src/renderer/components', (n) => n.endsWith('.test.tsx')),
    'renderer-styles': countFilesRecursive(root, 'src/renderer/styles', (n) => n.endsWith('.ts')),
    'test-files': countFilesRecursive(root, 'src', (n) => /\.test\.(ts|tsx)$/.test(n) || /\.spec\.(ts|tsx)$/.test(n)),
    'log-constants': (readFile(root, 'src/shared/log-constants.ts').match(/^export const [A-Z0-9_]+/gm) || []).length,
    'mcp-tools': serverTools ? serverTools.names.size : null,
    'mcp-registrations': serverTools ? serverTools.names.size + (hasCommitOperation ? 1 : 0) : null,
    'mcp-gui-tools': guiTools ? guiTools.names.size : null,
    'cli-subcommands': countArray(root, 'src/shared/constants.ts', 'CLI_SUBCOMMANDS'),
    'e2e-specs': listFiles(root, 'e2e/specs', (n) => n.endsWith('.spec.ts')).length,
    'video-filter-presets': countArray(root, 'src/shared/video-filters.ts', 'FILTER_PRESETS'),
    'copilot-operations': countUnion(root, 'src/shared/types.ts', 'CopilotOperation'),
  };
}

/** Collects every documentation file that may carry drift markers. */
export function collectDocFiles(root) {
  const files = [];
  for (const docRoot of DOC_ROOTS) {
    const walk = (dir) => {
      const full = path.join(root, dir);
      if (!fs.existsSync(full)) return;
      for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(rel);
        else if (entry.name.endsWith('.md')) {
          if (DOC_IGNORE.has(entry.name)) continue;
          if (docRoot.label === 'site/locales' && !rel.includes(`${path.sep}docs${path.sep}`)) continue;
          files.push({ file: rel, label: docRoot.label });
        }
      }
    };
    walk(docRoot.dir);
  }
  return files;
}

/** Parses all drift markers out of a markdown source. */
export function parseMarkers(source) {
  const markers = [];
  const re = new RegExp(MARKER_RE.source, 'g');
  let match;
  while ((match = re.exec(source)) !== null) {
    const tokens = match[1].trim().split(/\s+/).filter(Boolean);
    const pairs = [];
    let valid = tokens.length > 0;
    for (const token of tokens) {
      const sep = token.indexOf('=');
      const key = sep === -1 ? '' : token.slice(0, sep);
      const value = sep === -1 ? '' : token.slice(sep + 1);
      if (!/^[a-z0-9-]+$/.test(key) || !/^-?\d+$/.test(value)) {
        valid = false;
        break;
      }
      pairs.push({ key, value });
    }
    // A malformed marker is ignored entirely rather than partially applied.
    if (valid) markers.push(...pairs);
  }
  return markers;
}

/**
 * Validates the markers of one file against the computed facts.
 * @returns {{failures: Array, markerCount: number}}
 */
export function checkFile(file, source, facts) {
  const failures = [];
  const markers = parseMarkers(source);
  for (const marker of markers) {
    if (!(marker.key in facts)) {
      failures.push({ ...marker, reason: 'unknown fact key' });
      continue;
    }
    if (facts[marker.key] === null) {
      failures.push({ ...marker, reason: 'fact could not be computed' });
      continue;
    }
    if (String(facts[marker.key]) !== marker.value) {
      failures.push({ ...marker, expected: facts[marker.key], reason: 'value mismatch' });
    }
  }
  return { failures, markerCount: markers.length };
}
