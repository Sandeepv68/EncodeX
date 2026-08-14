import { describe, it, expect } from 'vitest';
import { THEMES } from '../colors';

function channel(value: string): number {
  return parseInt(value, 16);
}

function toRgb(color: string): [number, number, number] {
  const hex = color.replace('#', '');
  return [channel(hex.slice(0, 2)), channel(hex.slice(2, 4)), channel(hex.slice(4, 6))];
}

function luminance([r, g, b]: [number, number, number]): number {
  const linear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function blendOver(fg: [number, number, number], alpha: number, bg: [number, number, number]): [number, number, number] {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as [number, number, number];
}

describe('theme color tokens', () => {
  it('uses a visible focus ring on every light theme', () => {
    for (const theme of THEMES) {
      if (theme.mode !== 'light') continue;
      const match = theme.focusRing.match(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
      expect(match, `${theme.id} focusRing`).not.toBeNull();
      expect(parseFloat(match![1]), `${theme.id} focusRing alpha`).toBeGreaterThanOrEqual(0.35);
    }
  });

  it('keeps selected menu-item text readable over the primary tint', () => {
    for (const theme of THEMES) {
      const tint = theme.tint.primary25.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      expect(tint, `${theme.id} tint`).not.toBeNull();
      const primary = [Number(tint![1]), Number(tint![2]), Number(tint![3])] as [number, number, number];
      const alpha = parseFloat(tint![4]);
      const menuSurface = toRgb(theme.menu.surface);
      const background = blendOver(primary, alpha, menuSurface);
      expect(contrast(toRgb(theme.text.primary), background), `${theme.id} selected item`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
