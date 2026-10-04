import { describe, it, expect } from 'vitest';
import {
  isValidTime,
  isValidScale,
  isValidBitrate,
  isInRange,
  coerceNonEmptyString,
  coerceNonEmptyArray,
  coerceOsString,
  MAX_OS_STRING_LENGTH,
} from '../validation';

describe('isValidTime', () => {
  it('rejects empty or whitespace values', () => {
    expect(isValidTime('')).toBe(false);
    expect(isValidTime('   ')).toBe(false);
  });

  it('accepts non-negative numeric values', () => {
    expect(isValidTime('0')).toBe(true);
    expect(isValidTime('120')).toBe(true);
    expect(isValidTime('12.5')).toBe(true);
    expect(isValidTime('-1')).toBe(false);
  });

  it('accepts hh:mm:ss and hh:mm:ss.mmm formats', () => {
    expect(isValidTime('00:00:00')).toBe(true);
    expect(isValidTime('1:02:03')).toBe(true);
    expect(isValidTime('12:34:56.789')).toBe(true);
  });

  it('rejects malformed values', () => {
    expect(isValidTime('1:00')).toBe(false);
    expect(isValidTime('abc')).toBe(false);
    expect(isValidTime('1:02:03:04')).toBe(false);
  });
});

describe('isValidScale', () => {
  it('rejects empty or whitespace values', () => {
    expect(isValidScale('')).toBe(false);
    expect(isValidScale('  ')).toBe(false);
  });

  it('accepts percentages between 1 and 999', () => {
    expect(isValidScale('1%')).toBe(true);
    expect(isValidScale('50%')).toBe(true);
    expect(isValidScale('999%')).toBe(true);
    expect(isValidScale('0%')).toBe(false);
    expect(isValidScale('1000%')).toBe(false);
  });

  it('accepts width:height and widthxheight forms', () => {
    expect(isValidScale('1280:720')).toBe(true);
    expect(isValidScale('1280x720')).toBe(true);
    expect(isValidScale('-2:720')).toBe(true);
    expect(isValidScale('1280:-2')).toBe(true);
  });

  it('accepts positive numeric scales', () => {
    expect(isValidScale('2')).toBe(true);
    expect(isValidScale('2.5')).toBe(true);
  });

  it('rejects zero, negative and fractional-only numeric scales', () => {
    expect(isValidScale('0')).toBe(false);
    expect(isValidScale('0.5')).toBe(false);
    expect(isValidScale('-2')).toBe(false);
  });

  it('rejects junk values', () => {
    expect(isValidScale('abc')).toBe(false);
    expect(isValidScale('50px')).toBe(false);
  });
});

describe('isValidBitrate', () => {
  it('rejects empty or whitespace values', () => {
    expect(isValidBitrate('')).toBe(false);
    expect(isValidBitrate('  ')).toBe(false);
  });

  it('accepts digits with optional K/M suffix', () => {
    expect(isValidBitrate('1000')).toBe(true);
    expect(isValidBitrate('1000k')).toBe(true);
    expect(isValidBitrate('1000K')).toBe(true);
    expect(isValidBitrate('2M')).toBe(true);
    expect(isValidBitrate('1m')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isValidBitrate('abc')).toBe(false);
    expect(isValidBitrate('1000kbps')).toBe(false);
    expect(isValidBitrate('-1')).toBe(false);
  });
});

describe('isInRange', () => {
  it('accepts in-range values inclusive of bounds', () => {
    expect(isInRange(5, 0, 10)).toBe(true);
    expect(isInRange(0, 0, 10)).toBe(true);
    expect(isInRange(10, 0, 10)).toBe(true);
  });

  it('rejects out-of-range and non-finite values', () => {
    expect(isInRange(11, 0, 10)).toBe(false);
    expect(isInRange(-1, 0, 10)).toBe(false);
    expect(isInRange(NaN, 0, 10)).toBe(false);
    expect(isInRange(Infinity, 0, 10)).toBe(false);
  });
});

describe('coerceNonEmptyString', () => {
  it('passes a real string through unchanged', () => {
    expect(coerceNonEmptyString('/out/video.mp4')).toBe('/out/video.mp4');
    expect(coerceNonEmptyString('https://example.invalid/notes')).toBe('https://example.invalid/notes');
    // Not trimmed on the way through: a path with meaningful leading space is the caller's problem,
    // and silently rewriting it would hide the bug this guard exists to surface.
    expect(coerceNonEmptyString(' spaced ')).toBe(' spaced ');
  });

  it('rejects every non-string, including the types structured clone can carry', () => {
    // These are the payloads that actually reached a `shell.*` call before the guard existed.
    expect(coerceNonEmptyString(10n ** 30n)).toBeNull();
    expect(coerceNonEmptyString(0)).toBeNull();
    expect(coerceNonEmptyString(NaN)).toBeNull();
    expect(coerceNonEmptyString(null)).toBeNull();
    expect(coerceNonEmptyString(undefined)).toBeNull();
    expect(coerceNonEmptyString(true)).toBeNull();
    expect(coerceNonEmptyString(['/out/video.mp4'])).toBeNull();
    expect(coerceNonEmptyString({ path: '/out/video.mp4' })).toBeNull();
    expect(coerceNonEmptyString(Symbol('s'))).toBeNull();
  });

  it('rejects a string with no content', () => {
    expect(coerceNonEmptyString('')).toBeNull();
    expect(coerceNonEmptyString('   ')).toBeNull();
    expect(coerceNonEmptyString('\t\n')).toBeNull();
  });

  it('never coerces by stringifying, so a non-string cannot become a plausible path', () => {
    // The distinction that matters: `String(1n)` is a valid-looking value and `String({})` is
    // "[object Object]". Coercing would let a malformed payload reach the filesystem.
    expect(coerceNonEmptyString(123)).toBeNull();
    expect(coerceNonEmptyString({ toString: () => '/etc/passwd' })).toBeNull();
    // A throwing toString is the nastier version of the same trick.
    expect(
      coerceNonEmptyString({
        toString() {
          throw new Error('boom');
        },
      }),
    ).toBeNull();
  });
});

describe('coerceOsString', () => {
  it('passes a real path through unchanged', () => {
    expect(coerceOsString('C:\\Users\\me\\out.mp4')).toBe('C:\\Users\\me\\out.mp4');
    expect(coerceOsString('https://github.com/releases')).toBe('https://github.com/releases');
  });

  it('applies every rejection coerceNonEmptyString applies', () => {
    for (const hostile of [10n ** 30n, 0, NaN, null, undefined, true, { path: 'a' }, ['a'], '', '   ']) {
      expect(coerceOsString(hostile)).toBeNull();
    }
  });

  it('rejects a string that is a megabyte long', () => {
    // Found by `e2e/specs/ipc-abuse.spec.ts`: a 1 MB string is a perfectly valid string, so the
    // type-only guard let it through to `shell.showItemInFolder`, `shell.openExternal` and
    // `shell.openPath` verbatim. Length, not type, is what makes a string unusable as a path.
    expect(coerceOsString('x'.repeat(1024 * 1024))).toBeNull();
  });

  it('still accepts a path at the length bound, and rejects one past it', () => {
    expect(coerceOsString('x'.repeat(MAX_OS_STRING_LENGTH))).toBe('x'.repeat(MAX_OS_STRING_LENGTH));
    expect(coerceOsString('x'.repeat(MAX_OS_STRING_LENGTH + 1))).toBeNull();
  });

  it('leaves room for the longest path Windows can represent', () => {
    // Windows extended-length paths reach 32,767 characters; the bound must not cut real paths off.
    expect(MAX_OS_STRING_LENGTH).toBeLessThan(32_767);
  });
});

describe('coerceNonEmptyArray', () => {
  it('passes a real array through unchanged', () => {
    const input = ['/in/a.mp4', '/in/b.mp4'];
    expect(coerceNonEmptyArray(input)).toBe(input);
    expect(coerceNonEmptyArray([])).toEqual([]);
  });

  it('rejects a bare string, which is iterable and silently walks the filesystem per character', () => {
    // The regression this guard was added for: `expandPaths('../../etc/passwd')` treated each
    // character as a path, and the '.' in it expanded the whole working directory.
    expect(coerceNonEmptyArray('/some/dir')).toBeNull();
    expect(coerceNonEmptyArray('../../../../etc/passwd')).toBeNull();
  });

  it('rejects array-like and non-iterable objects', () => {
    expect(coerceNonEmptyArray({ length: 1, 0: '/in/a.mp4' })).toBeNull();
    expect(coerceNonEmptyArray({})).toBeNull();
    expect(coerceNonEmptyArray(null)).toBeNull();
    expect(coerceNonEmptyArray(undefined)).toBeNull();
    expect(coerceNonEmptyArray(10n ** 30n)).toBeNull();
    expect(coerceNonEmptyArray(new Set(['/in/a.mp4']))).toBeNull();
    expect(
      coerceNonEmptyArray(
        new Proxy(
          {},
          {
            getPrototypeOf() {
              throw new Error('boom');
            },
          },
        ),
      ),
    ).toBeNull();
  });
});
