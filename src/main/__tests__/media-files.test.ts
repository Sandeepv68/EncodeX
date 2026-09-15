import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { collectMediaFiles, expandMediaPaths, isDirectory } from '../media-files';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-media-'));
  tempDirs.push(dir);
  return dir;
}

function touch(dir: string, relative: string): string {
  const full = path.join(dir, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, '');
  return full;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('collectMediaFiles', () => {
  it('collects supported media files recursively and sorts the result', () => {
    const root = makeTempDir();
    const mp4 = touch(root, 'a.mp4');
    touch(root, 'sub/b.MOV');
    touch(root, 'sub/c.jpg');
    touch(root, 'note.txt');
    touch(root, 'sub/readme.md');

    const result = collectMediaFiles(root);
    expect(result).toContain(path.normalize(mp4));
    expect(result.some((p) => p.toLowerCase().endsWith(path.join('sub', 'b.MOV').toLowerCase()))).toBe(true);
    expect(result.some((p) => p.toLowerCase().endsWith(path.join('sub', 'c.jpg').toLowerCase()))).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('returns an empty array for a missing root', () => {
    expect(collectMediaFiles(path.join(os.tmpdir(), 'does-not-exist-xyz'))).toEqual([]);
  });
});

describe('expandMediaPaths', () => {
  it('expands directories recursively and passes through media files', () => {
    const root = makeTempDir();
    const top = touch(root, 'top.mp4');
    const nested = touch(root, 'deep/x.webp');
    touch(root, 'ignored.bin');

    const result = expandMediaPaths([root, top]);
    expect(result).toContain(path.normalize(top));
    expect(result).toContain(path.normalize(nested));
    expect(result).toHaveLength(2);
  });

  it('ignores missing paths and non-media files', () => {
    const root = makeTempDir();
    const txt = touch(root, 'a.txt');
    expect(expandMediaPaths([txt, path.join(root, 'missing.mp4')])).toEqual([]);
  });
});

describe('isDirectory', () => {
  it('distinguishes directories from files and missing paths', () => {
    const root = makeTempDir();
    const file = touch(root, 'x.mp4');
    expect(isDirectory(root)).toBe(true);
    expect(isDirectory(file)).toBe(false);
    expect(isDirectory(path.join(root, 'nope'))).toBe(false);
  });
});