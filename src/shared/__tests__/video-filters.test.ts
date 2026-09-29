import { describe, it, expect } from 'vitest';
import {
  FILTER_PRESETS,
  presetById,
  buildPresetFilter,
  buildRotationFilters,
  buildFilterChain,
  normalizeFilterChain,
  validateVideoFilters,
  expandFilterShorthand,
} from '../video-filters';

describe('FILTER_PRESETS', () => {
  it('builds each preset with zero parameters using safe defaults', () => {
    for (const preset of FILTER_PRESETS) {
      const expr = buildPresetFilter(preset);
      expect(expr).toBeTruthy();
      expect(expr).toContain(preset.ffmpegName);
    }
  });

  it('exposes every preset through presetById', () => {
    for (const preset of FILTER_PRESETS) {
      expect(presetById(preset.id)).toBe(preset);
    }
    expect(presetById('nope')).toBeUndefined();
  });

  it('builds a crop with explicit offsets and percent expressions', () => {
    expect(buildPresetFilter(presetById('crop')!)).toBe('crop=in_w:in_h');
    expect(buildPresetFilter(presetById('crop')!, { w: '640', h: '480', x: 10, y: 20 })).toBe('crop=640:480:10:20');
  });

  it('builds color eq with all parameter values', () => {
    const expr = buildPresetFilter(presetById('color')!, {
      brightness: 0.1,
      contrast: 1.1,
      saturation: 1.2,
      gamma: 0.9,
    });
    expect(expr).toBe('eq=brightness=0.1:contrast=1.1:saturation=1.2:gamma=0.9');
  });
});

describe('buildRotationFilters', () => {
  it('maps rotation angles to transpose filters', () => {
    expect(buildRotationFilters({ rotate: '90' })).toEqual(['transpose=1']);
    expect(buildRotationFilters({ rotate: '180' })).toEqual(['transpose=2', 'transpose=2']);
    expect(buildRotationFilters({ rotate: '270' })).toEqual(['transpose=2']);
  });

  it('appends mirror filters after rotation', () => {
    expect(buildRotationFilters({ rotate: '90', flipH: true, flipV: true })).toEqual(['transpose=1', 'hflip', 'vflip']);
    expect(buildRotationFilters({ flipH: true, flipV: true })).toEqual(['hflip', 'vflip']);
  });

  it('returns an empty list when no rotation/mirror is set', () => {
    expect(buildRotationFilters({})).toEqual([]);
  });
});

describe('buildFilterChain', () => {
  it('orders scale before rotation/mirror before user filters', () => {
    const chain = buildFilterChain({
      scale: '1920x1080',
      rotate: '90',
      flipH: true,
      videoFilters: ['fps=30', 'eq=brightness=0.1'],
    });
    expect(chain).toBe('scale=1920x1080,transpose=1,hflip,fps=30,eq=brightness=0.1');
  });

  it('returns null when nothing applies', () => {
    expect(buildFilterChain({})).toBeNull();
    expect(buildFilterChain({ scale: '1280x720' })).toBe('scale=1280x720');
  });

  it('keeps user filters even without scale or rotation', () => {
    expect(buildFilterChain({ videoFilters: ['hue=s=0'] })).toBe('hue=s=0');
  });
});

describe('normalizeFilterChain', () => {
  it('splits, trims, and drops empty entries', () => {
    expect(normalizeFilterChain(' fps=30, eq=brightness=0.1 , ,')).toEqual(['fps=30', 'eq=brightness=0.1']);
  });

  it('returns an empty array for blank input', () => {
    expect(normalizeFilterChain('')).toEqual([]);
    expect(normalizeFilterChain('   ')).toEqual([]);
  });

  it('expands the preset.value shorthand within a chain', () => {
    expect(normalizeFilterChain('fps=30, framerate.60 , fps.24')).toEqual(['fps=30', 'fps=60', 'fps=24']);
  });
});

describe('expandFilterShorthand', () => {
  it('expands a known preset id and value to the catalog expression', () => {
    expect(expandFilterShorthand('framerate.60')).toBe('fps=60');
    expect(expandFilterShorthand('framerate.240')).toBe('fps=240');
  });

  it('applies the value to the first parameter and keeps the rest at defaults', () => {
    expect(expandFilterShorthand('deinterlace.tff')).toBe('yadif=1');
  });

  it('matches the FFmpeg name as well as the preset id, case-insensitively', () => {
    expect(expandFilterShorthand('fps.60')).toBe('fps=60');
    expect(expandFilterShorthand('FrameRate.60')).toBe('fps=60');
  });

  it('leaves full filter expressions untouched', () => {
    expect(expandFilterShorthand('fps=30')).toBe('fps=30');
    expect(expandFilterShorthand('eq=brightness=0.1:contrast=1.1')).toBe('eq=brightness=0.1:contrast=1.1');
    expect(expandFilterShorthand('crop=640:480:10:20')).toBe('crop=640:480:10:20');
  });

  it('leaves unknown filter names untouched', () => {
    expect(expandFilterShorthand('notafilter.60')).toBe('notafilter.60');
  });

  it('leaves a value containing a filter separator untouched', () => {
    expect(expandFilterShorthand('eq.brightness=0.1')).toBe('eq.brightness=0.1');
  });

  it('leaves parameterless presets untouched', () => {
    for (const preset of FILTER_PRESETS) {
      if (preset.params.length === 0) {
        expect(expandFilterShorthand(`${preset.id}.s=0`)).toBe(`${preset.id}.s=0`);
        expect(expandFilterShorthand(`${preset.id}.x`)).toBe(`${preset.id}.x`);
      }
    }
  });

  it('leaves an entry without a dot untouched', () => {
    expect(expandFilterShorthand('fps=30')).toBe('fps=30');
    expect(expandFilterShorthand('deblock')).toBe('deblock');
  });

  it('leaves a trailing dot or leading dot untouched', () => {
    expect(expandFilterShorthand('framerate.')).toBe('framerate.');
    expect(expandFilterShorthand('.60')).toBe('.60');
  });

  it('handles decimal values without truncating them', () => {
    expect(expandFilterShorthand('framerate.29.97')).toBe('fps=29.97');
    expect(expandFilterShorthand('framerate.59.94')).toBe('fps=59.94');
  });

  it('passes a non-numeric value through to the first parameter verbatim', () => {
    expect(expandFilterShorthand('crop.640')).toContain('crop=');
  });

  it('preserves surrounding whitespace for non-shorthand entries', () => {
    expect(expandFilterShorthand(' fps=30 ')).toBe(' fps=30 ');
  });
});

describe('validateVideoFilters', () => {
  it('accepts valid filter lists', () => {
    expect(validateVideoFilters(['fps=30', 'crop=in_w/2:in_h/2'])).toEqual([]);
  });

  it('rejects empty and over-long entries', () => {
    expect(validateVideoFilters(['']).length).toBeGreaterThan(0);
    expect(validateVideoFilters(['x'.repeat(201)]).length).toBeGreaterThan(0);
  });

  it('rejects shell metacharacters', () => {
    expect(validateVideoFilters(['fps=30;rm -rf /']).length).toBeGreaterThan(0);
    expect(validateVideoFilters(['drawtext=$(id)']).length).toBeGreaterThan(0);
    expect(validateVideoFilters(['plain|pipe']).length).toBeGreaterThan(0);
  });

  it('rejects unbalanced brackets and unmatched quotes', () => {
    expect(validateVideoFilters(['pad=w=iw(x']).length).toBeGreaterThan(0);
    expect(validateVideoFilters(["drawtext=text='oops"]).length).toBeGreaterThan(0);
  });

  it('rejects more than the max number of entries', () => {
    const many = Array.from({ length: 9 }, (_, i) => `filter${i}`);
    expect(validateVideoFilters(many).length).toBeGreaterThan(0);
  });
});
