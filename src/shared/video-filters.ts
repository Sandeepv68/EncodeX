/**
 * @fileoverview Shared video-filter catalog, chain builder, and validation.
 * Defines the curated filter presets (crop, framerate, deinterlace, denoise,
 * sharpen, color, grayscale, blur) with their parameters, plus the pure
 * utilities used by the GUI, CLI, and MCP surfaces:
 *  - buildRotationFilters - maps rotate/flip flags to transpose/hflip/vflip
 *  - buildFilterChain     - merges scale + rotation + user filters into the
 *    single `-vf` argument FFmpeg requires
 *  - validateVideoFilters - entry-level filter-string validation
 *  - normalizeFilterChain - splits a comma-joined chain into ordered entries
 *    (expanding the `preset.value` shorthand, see expandFilterShorthand)
 *  - presetById/buildPresetFilter - catalog lookup and preset expansion
 *  - expandFilterShorthand - expands `framerate.60` to `fps=60`
 */

import { FFMPEG_FLAGS } from './transcoder-constants';

/**
 * Parameter descriptor for a curated filter preset.
 * @interface VideoFilterParam
 * @property {string} key - Stable key used in FilterParamValues.
 * @property {string} labelKey - i18n key for the field label.
 * @property {'number'|'text'|'select'} type - Input kind rendered by the GUI.
 * @property {number|string} [default] - Value used when the caller omits the key.
 * @property {number} [min] - Minimum value for `number` inputs.
 * @property {number} [max] - Maximum value for `number` inputs.
 * @property {number} [step] - Step for `number` inputs (defaults to 0.01).
 * @property {{value: string; labelKey: string}[]} [options] - Choices for `select` inputs.
 * @property {boolean} [optional] - Omitted from the emitted filter when unset.
 */
export interface VideoFilterParam {
  key: string;
  labelKey: string;
  type: 'number' | 'text' | 'select';
  default?: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; labelKey: string }[];
  optional?: boolean;
}

/**
 * Values supplied by a caller for a preset's parameters.
 * @typedef {Record<string, number | string | undefined>} FilterParamValues
 */
export type FilterParamValues = Record<string, number | string | undefined>;

/**
 * A curated filter preset.
 * @interface VideoFilterDef
 * @property {string} id - Stable id used by the GUI/CLI/MCP (e.g. 'crop').
 * @property {string} ffmpegName - Base FFmpeg filter name (e.g. 'crop').
 * @property {VideoFilterParam[]} params - Ordered parameters with defaults.
 * @property {(values: FilterParamValues) => string} build - Produces the full
 *   filter expression (e.g. 'crop=in_w/2:in_h/2').
 * @property {string} labelKey - i18n key for the preset display name.
 * @property {string} hintKey - i18n key for the preset tooltip/description.
 */
export interface VideoFilterDef {
  id: string;
  ffmpegName: string;
  params: VideoFilterParam[];
  build: (values: FilterParamValues) => string;
  labelKey: string;
  hintKey: string;
}

/** Maximum length of a single filter entry (characters). */
export const VIDEO_FILTER_MAX_ENTRY = 200;
/** Maximum number of filter entries allowed. */
export const VIDEO_FILTER_MAX_ENTRIES = 8;

/**
 * Resolves a parameter to its caller-supplied value or its default.
 * @param {VideoFilterParam} param - The parameter descriptor.
 * @param {FilterParamValues} [values] - Caller-supplied values, or undefined.
 * @returns {number | string | undefined} The effective value, or undefined.
 */
function resolveParam(param: VideoFilterParam, values?: FilterParamValues): number | string | undefined {
  const v = values?.[param.key];
  return v === undefined || v === '' ? param.default : v;
}

/**
 * Formats a resolved value for inclusion in a filter expression.
 * @param {number | string | undefined} v - The value to format.
 * @param {number | string} fallback - Value used when `v` is undefined.
 * @returns {string} The formatted value.
 */
function fmt(v: number | string | undefined, fallback: number | string): string {
  if (v === undefined || v === '') return String(fallback);
  return String(v);
}

/**
 * Curated video filter catalog shown in the GUI and accepted by the CLI/MCP
 * preset shorthand. Every preset builds a single `-vf` element and works with
 * no parameters (safe defaults). Parameter values produce valid FFmpeg syntax.
 * @const {readonly VideoFilterDef[]} FILTER_PRESETS
 */
export const FILTER_PRESETS: readonly VideoFilterDef[] = [
  {
    id: 'crop',
    ffmpegName: 'crop',
    labelKey: 'filters.presets.crop',
    hintKey: 'filters.presets.cropHint',
    params: [
      { key: 'w', labelKey: 'filters.params.crop.w', type: 'text', default: 'in_w' },
      { key: 'h', labelKey: 'filters.params.crop.h', type: 'text', default: 'in_h' },
      { key: 'x', labelKey: 'filters.params.crop.x', type: 'text', default: 0, optional: true },
      { key: 'y', labelKey: 'filters.params.crop.y', type: 'text', default: 0, optional: true },
    ],
    build: (v) => {
      const x = fmt(v.x, 0);
      const y = fmt(v.y, 0);
      const base = `crop=${fmt(v.w, 'in_w')}:${fmt(v.h, 'in_h')}`;
      return x === '0' && y === '0' ? base : `${base}:${x}:${y}`;
    },
  },
  {
    id: 'framerate',
    ffmpegName: 'fps',
    labelKey: 'filters.presets.framerate',
    hintKey: 'filters.presets.framerateHint',
    params: [{ key: 'fps', labelKey: 'filters.params.framerate.fps', type: 'number', default: 30, min: 1, max: 120, step: 1 }],
    build: (v) => `fps=${fmt(v.fps, 30)}`,
  },
  {
    id: 'deinterlace',
    ffmpegName: 'yadif',
    labelKey: 'filters.presets.deinterlace',
    hintKey: 'filters.presets.deinterlaceHint',
    params: [
      {
        key: 'mode',
        labelKey: 'filters.params.deinterlace.mode',
        type: 'select',
        default: 'auto',
        options: [
          { value: 'auto', labelKey: 'filters.params.deinterlace.modes.auto' },
          { value: 'tff', labelKey: 'filters.params.deinterlace.modes.tff' },
          { value: 'bff', labelKey: 'filters.params.deinterlace.modes.bff' },
        ],
      },
    ],
    build: (v) => {
      const mode = fmt(v.mode, 'auto');
      if (mode === 'tff') return 'yadif=1';
      if (mode === 'bff') return 'yadif=0';
      return 'yadif';
    },
  },
  {
    id: 'denoise',
    ffmpegName: 'hqdn3d',
    labelKey: 'filters.presets.denoise',
    hintKey: 'filters.presets.denoiseHint',
    params: [{ key: 'strength', labelKey: 'filters.params.denoise.strength', type: 'number', default: 4, min: 1, max: 20, step: 1 }],
    build: (v) => {
      const s = fmt(v.strength, 4);
      return `hqdn3d=${s}:${s}:${s}:${s}`;
    },
  },
  {
    id: 'sharpen',
    ffmpegName: 'unsharp',
    labelKey: 'filters.presets.sharpen',
    hintKey: 'filters.presets.sharpenHint',
    params: [{ key: 'strength', labelKey: 'filters.params.sharpen.strength', type: 'number', default: 0.5, min: 0, max: 2, step: 0.05 }],
    build: (v) => `unsharp=5:5:${fmt(v.strength, 0.5)}:5:5:0`,
  },
  {
    id: 'color',
    ffmpegName: 'eq',
    labelKey: 'filters.presets.color',
    hintKey: 'filters.presets.colorHint',
    params: [
      { key: 'brightness', labelKey: 'filters.params.color.brightness', type: 'number', default: 0, min: -1, max: 1, step: 0.01 },
      { key: 'contrast', labelKey: 'filters.params.color.contrast', type: 'number', default: 1, min: -2, max: 2, step: 0.01 },
      { key: 'saturation', labelKey: 'filters.params.color.saturation', type: 'number', default: 1, min: 0, max: 3, step: 0.01 },
      { key: 'gamma', labelKey: 'filters.params.color.gamma', type: 'number', default: 1, min: 0.1, max: 3, step: 0.01 },
    ],
    build: (v) =>
      `eq=brightness=${fmt(v.brightness, 0)}:contrast=${fmt(v.contrast, 1)}:saturation=${fmt(v.saturation, 1)}:gamma=${fmt(v.gamma, 1)}`,
  },
  {
    id: 'grayscale',
    ffmpegName: 'hue',
    labelKey: 'filters.presets.grayscale',
    hintKey: 'filters.presets.grayscaleHint',
    params: [],
    build: () => 'hue=s=0',
  },
  {
    id: 'blur',
    ffmpegName: 'boxblur',
    labelKey: 'filters.presets.blur',
    hintKey: 'filters.presets.blurHint',
    params: [{ key: 'strength', labelKey: 'filters.params.blur.strength', type: 'number', default: 2, min: 0, max: 10, step: 0.5 }],
    build: (v) => `boxblur=${fmt(v.strength, 2)}:1`,
  },
];

/**
 * Looks up a preset by its stable id.
 * @param {string} id - The preset id (e.g. 'crop').
 * @returns {VideoFilterDef | undefined} The preset, or undefined when unknown.
 */
export function presetById(id: string): VideoFilterDef | undefined {
  return FILTER_PRESETS.find((p) => p.id === id);
}

/**
 * Builds the filter expression for a preset, resolving missing parameters to
 * their defaults.
 * @param {VideoFilterDef} def - The preset to expand.
 * @param {FilterParamValues} [values] - Parameter values to apply.
 * @returns {string} The full filter expression.
 */
export function buildPresetFilter(def: VideoFilterDef, values?: FilterParamValues): string {
  const resolved: FilterParamValues = {};
  for (const param of def.params) {
    const effective = resolveParam(param, values);
    if (effective !== undefined) resolved[param.key] = effective;
  }
  return def.build(resolved);
}

/**
 * Maps rotate/flip conversion flags to their FFmpeg pixel-filter expressions.
 * 90° clockwise → `transpose=1`, 90° counter-clockwise → `transpose=2`, 180° →
 * a double transpose (interpolation-free). Mirrors append `hflip`/`vflip`.
 * Filters are ordered rotation-before-mirror.
 * @param {{rotate?: string; flipH?: boolean; flipV?: boolean}} options -
 *   Rotation/mirror flags matching ConversionOptions.
 * @returns {string[]} Ordered rotation filter strings (empty when none requested).
 */
export function buildRotationFilters(options: { rotate?: string; flipH?: boolean; flipV?: boolean }): string[] {
  const filters: string[] = [];
  if (options.rotate === '90') {
    filters.push('transpose=1');
  } else if (options.rotate === '180') {
    filters.push('transpose=2', 'transpose=2');
  } else if (options.rotate === '270') {
    filters.push('transpose=2');
  }
  if (options.flipH) {
    filters.push('hflip');
  }
  if (options.flipV) {
    filters.push('vflip');
  }
  return filters;
}

/**
 * Builds a complete video filter chain from conversion inputs: the `scale`
 * filter (geometry first), then rotation/mirror filters, then any user
 * `videoFilters` in array order. The result is a single comma-joined chain for
 * one `-vf` argument (FFmpeg forbids emitting multiple `-vf` flags). Returns
 * null when no filters apply.
 * @param {{scale?: string; rotate?: string; flipH?: boolean; flipV?: boolean; videoFilters?: string[]}} options -
 *   Scale/rotation/user-filter inputs matching ConversionOptions.
 * @returns {string | null} The filter chain, or null when no filter is needed.
 */
export function buildFilterChain(options: {
  scale?: string;
  rotate?: string;
  flipH?: boolean;
  flipV?: boolean;
  videoFilters?: string[];
}): string | null {
  const filters: string[] = [];
  if (options.scale) {
    filters.push(`${FFMPEG_FLAGS.SCALE}${options.scale}`);
  }
  filters.push(...buildRotationFilters(options));
  if (options.videoFilters?.length) {
    filters.push(...options.videoFilters);
  }
  return filters.length > 0 ? filters.join(',') : null;
}

/**
 * Expands the `preset.value` filter shorthand used by the CLI/MCP preset forms:
 * a dot-separated catalog name plus a single value, e.g. `framerate.60` becomes
 * `fps=60` and `deinterlace.tff` becomes `yadif=1`. The name matches a preset id
 * or its FFmpeg name (case-insensitive) and the value is applied to the preset's
 * FIRST parameter; every other parameter keeps its default.
 *
 * Entries that are not shorthand are returned untouched, which keeps ordinary
 * filter expressions intact: a value containing `=`, `:` or `,` (`eq.brightness=0.1`),
 * a name outside the catalog (`geq.lum`), a parameterless preset (`hue.s=0`), or
 * an entry without a dot at all (`fps=30`) all pass through verbatim.
 *
 * @param {string} entry - A single filter entry from a chain.
 * @returns {string} The expanded filter expression, or `entry` when it is not shorthand.
 */
export function expandFilterShorthand(entry: string): string {
  const dot = entry.indexOf('.');
  if (dot <= 0) return entry;

  const name = entry.slice(0, dot).toLowerCase();
  const value = entry.slice(dot + 1);
  if (!value || /[=:,]/.test(value)) return entry;

  const def = FILTER_PRESETS.find((p) => p.id.toLowerCase() === name || p.ffmpegName.toLowerCase() === name);
  const first = def?.params[0];
  if (!def || !first) return entry;

  const numeric = Number(value);
  return buildPresetFilter(def, { [first.key]: Number.isFinite(numeric) && value.trim() !== '' ? numeric : value });
}

/**
 * Splits a comma-joined filter chain into ordered, trimmed, non-empty entries,
 * expanding the `preset.value` shorthand of each entry (see
 * {@link expandFilterShorthand}). Commas separate filters in a `-vf` chain;
 * quoted commas inside a single filter's arguments are not handled (unknown
 * filters/args surface at runtime).
 * @param {string} chain - Comma-joined filter chain text (may be empty/whitespace).
 * @returns {string[]} Normalized entries.
 */
export function normalizeFilterChain(chain: string): string[] {
  return chain
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(expandFilterShorthand);
}

/**
 * Validates a list of filter entries. Each entry must be non-empty, at most
 * VIDEO_FILTER_MAX_ENTRY characters, contain balanced `()`/`[]`, matched single
 * quotes, and no shell metacharacters (`;`, `&`, `|`, backtick, `$`). The list
 * is capped at VIDEO_FILTER_MAX_ENTRIES.
 * @param {string[]} filters - The entries to validate.
 * @returns {string[]} Per-entry error messages ('Invalid filter filter chain:'-style),
 *   one per offending index; an empty array means the list is valid.
 */
export function validateVideoFilters(filters: string[]): string[] {
  const errors: string[] = [];
  if (filters.length > VIDEO_FILTER_MAX_ENTRIES) {
    errors.push(`Too many filters (max ${VIDEO_FILTER_MAX_ENTRIES}).`);
  }
  filters.forEach((entry, index) => {
    const reason = validateFilterEntry(entry);
    if (reason) errors.push(`Filter #${index + 1}: ${reason}`);
  });
  return errors;
}

/**
 * Validates a single filter entry.
 * @private
 * @param {string} entry - The filter expression to validate.
 * @returns {string | null} A description of the problem, or null when valid.
 */
function validateFilterEntry(entry: string): string | null {
  if (!entry || entry.trim().length === 0) return 'Filter cannot be empty.';
  if (entry.length > VIDEO_FILTER_MAX_ENTRY) return 'Filter is too long.';
  if (/[;&|`$]/.test(entry)) return 'Filter contains unsupported characters.';
  if (!isBalanced('(', ')', entry)) return 'Filter has unbalanced parentheses.';
  if (!isBalanced('[', ']', entry)) return 'Filter has unbalanced square brackets.';
  if ((entry.match(/'/g)?.length ?? 0) % 2 !== 0) return 'Filter has an unmatched quote.';
  return null;
}

/**
 * Checks whether a bracket/group type is balanced in a string.
 * @private
 * @param {string} open - Opening character.
 * @param {string} close - Closing character.
 * @param {string} input - The string to inspect.
 * @returns {boolean} True when balanced.
 */
function isBalanced(open: string, close: string, input: string): boolean {
  let depth = 0;
  for (const ch of input) {
    if (ch === open) depth += 1;
    else if (ch === close) depth = Math.max(0, depth - 1);
  }
  return depth === 0;
}
