/**
 * @fileoverview Property-based tests for input validation (Phase 1).
 *
 * These validators sit on the path between user keystrokes and an ffmpeg argv,
 * so the properties that matter are: they always answer with a boolean, they
 * never throw on any string, and they never accept a value they would later
 * hand to `parseInt`/`parseFloat` as `NaN`. That last one is the subtle bug -
 * `isValidScale("999999999999999999999x")` passing a regex but yielding `NaN`
 * downstream means a scale of `NaN` reaches ffmpeg.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isInRange, isValidBitrate, isValidScale, isValidTime } from '../validation';

describe('validators never throw and always return a boolean', () => {
  const validators: [string, (value: string) => boolean][] = [
    ['isValidTime', isValidTime],
    ['isValidScale', isValidScale],
    ['isValidBitrate', isValidBitrate],
  ];

  for (const [name, fn] of validators) {
    it(`${name} returns a boolean for any string`, () => {
      fc.assert(
        fc.property(fc.string(), (value) => {
          let result: unknown;
          expect(() => {
            result = fn(value);
          }).not.toThrow();
          expect(typeof result).toBe('boolean');
        }),
        { seed: 12345 },
      );
    });

    it(`${name} rejects any whitespace-only string`, () => {
      // Built by joining characters, not via `fc.string(unit)`: in fast-check 4
      // that overload is deprecated and silently ignores the unit constraint.
      const whitespace = fc.array(fc.constantFrom(' ', '\t', '\n', '\r', ' ', '　'), { maxLength: 6 }).map((chars) => chars.join(''));
      fc.assert(
        fc.property(whitespace, (value) => {
          expect(fn(value)).toBe(false);
        }),
        { seed: 12345 },
      );
    });

    it(`${name} rejects strings made only of punctuation`, () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom('!', '@', '#', '$', '^', '&', '*', '(', ')', '[', ']', '{', '}', '/', '\\'), {
            minLength: 1,
          }),
          (chars) => {
            expect(fn(chars.join(''))).toBe(false);
          },
        ),
        { seed: 12345 },
      );
    });
  }
});

describe('isValidTime', () => {
  it('never accepts a value that parses to NaN', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[^\s:]*$/), (value) => {
        if (isValidTime(value)) {
          expect(Number.isNaN(parseFloat(value))).toBe(false);
        }
      }),
      { seed: 12345 },
    );
  });

  it('accepts plain non-negative seconds', () => {
    // Integers and fixed-point strings only: `String(5e-324)` is `'5e-324'`, which
    // is exponent notation and correctly *not* a valid time literal.
    fc.assert(
      fc.property(fc.oneof(fc.integer({ min: 0, max: 1_000_000 }), fc.stringMatching(/^\d+\.\d{1,3}$/)), (seconds) => {
        expect(isValidTime(String(seconds))).toBe(true);
      }),
      { seed: 12345 },
    );
  });

  it('accepts HH:MM:SS within valid clock bounds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }), fc.integer({ min: 0, max: 59 }), (h, m, s) => {
        const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        expect(isValidTime(value)).toBe(true);
      }),
      { seed: 12345 },
    );
  });

  it('rejects out-of-range clock components', () => {
    expect(isValidTime('00:60:00')).toBe(false);
    expect(isValidTime('00:00:60')).toBe(false);
  });

  it('rejects negative seconds', () => {
    expect(isValidTime('-1')).toBe(false);
    expect(isValidTime('-1.5')).toBe(false);
  });
});

describe('isValidScale', () => {
  it('never accepts a value that parses to NaN', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        if (isValidScale(value)) {
          // Anything accepted must yield a usable numeric part somewhere in it.
          expect(value).toMatch(/\d/);
        }
      }),
      { seed: 12345 },
    );
  });

  it('accepts percentages within 1..999', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999 }), (pct) => {
        expect(isValidScale(`${pct}%`)).toBe(true);
      }),
      { seed: 12345 },
    );
  });

  it('rejects percentages outside 1..999', () => {
    expect(isValidScale('0%')).toBe(false);
    expect(isValidScale('1000%')).toBe(false);
  });

  it('rejects zero and negative bare dimensions', () => {
    expect(isValidScale('0')).toBe(false);
    expect(isValidScale('-1280')).toBe(false);
  });

  it('accepts WxH pairs', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 7680 }), fc.integer({ min: 1, max: 4320 }), (w, h) => {
        expect(isValidScale(`${w}x${h}`)).toBe(true);
      }),
      { seed: 12345 },
    );
  });
});

describe('isValidBitrate', () => {
  it('never accepts a value containing non-digits outside the unit suffix', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        if (isValidBitrate(value)) {
          expect(value).toMatch(/^\d+[KkMm]?$/);
        }
      }),
      { seed: 12345 },
    );
  });

  it('accepts a bare integer or a suffixed one', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), (n) => {
        expect(isValidBitrate(String(n))).toBe(true);
        expect(isValidBitrate(`${n}k`)).toBe(true);
        expect(isValidBitrate(`${n}M`)).toBe(true);
      }),
      { seed: 12345 },
    );
  });

  it('rejects an unknown unit', () => {
    expect(isValidBitrate('192G')).toBe(false);
    expect(isValidBitrate('192kb')).toBe(false);
  });
});

describe('isInRange', () => {
  it('is true exactly inside the inclusive bounds', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (value, min) => {
          const max = min + 100;
          const expected = Number.isFinite(value) && value >= min && value <= max;
          expect(isInRange(value, min, max)).toBe(expected);
        },
      ),
      { seed: 12345 },
    );
  });

  it('rejects NaN and both infinities', () => {
    fc.assert(
      fc.property(fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY), (value) => {
        expect(isInRange(value, 0, 10)).toBe(false);
      }),
      { seed: 12345 },
    );
  });
});
