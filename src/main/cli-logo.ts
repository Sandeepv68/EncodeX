/**
 * @fileoverview ASCII logo banner for the EncodeX CLI.
 *
 * Renders the app logo as a dithered ASCII art block colored with the app's
 * theme palette: the densest `@` shading uses each theme's primary accent and
 * the lightest `-` detail its secondary accent, with the intermediate texture
 * characters blended between the two. The theme is selectable via the CLI
 * `--theme` option and defaults to the brand 'light' palette. The banner is a
 * pure function of no state so it is trivial to test and print to any stream.
 */

/**
 * ANSI escape codes used to colorize the banner.
 * @enum {string} ANSI
 */
const ANSI = {
  /** 24-bit foreground color introducer: `\x1b[38;2;<r>;<g>;<b>m` */
  FG: '\x1b[38;2;',
  /** Reset all styling back to the terminal default. */
  RESET: '\x1b[0m',
} as const;

/**
 * The theme ids the CLI logo supports, mirroring `THEMES` in
 * src/renderer/colors.ts.
 * @const {readonly string[]} CLI_THEME_IDS
 */
export const CLI_THEME_IDS = ['light', 'ocean', 'sunset', 'forest', 'lavender', 'rose', 'slate', 'dark'] as const;

/**
 * A theme id usable for the CLI logo.
 * @typedef {(typeof CLI_THEME_IDS)[number]} CliThemeId
 */
export type CliThemeId = (typeof CLI_THEME_IDS)[number];

/**
 * The theme used for the logo when no `--theme` is supplied: the default
 * 'light' brand palette.
 * @const {CliThemeId} DEFAULT_CLI_THEME
 */
export const DEFAULT_CLI_THEME: CliThemeId = 'light';

/**
 * An RGB triple.
 * @typedef {readonly [number, number, number]} Rgb
 */
type Rgb = readonly [number, number, number];

/**
 * A theme palette's accent colors as RGB triples, mirroring the `primary` and
 * `secondary` hex values of each theme in src/renderer/colors.ts.
 * @interface CliThemePalette
 * @property {Rgb} primary - The theme's primary accent color (darker).
 * @property {Rgb} secondary - The theme's secondary accent color (brighter).
 */
interface CliThemePalette {
  primary: Rgb;
  secondary: Rgb;
}

/**
 * RGB triples for every selectable theme, sourced from the `THEMES` palette
 * definitions in src/renderer/colors.ts (primary/secondary per theme).
 * @const {Readonly<Record<CliThemeId, CliThemePalette>>} THEME_PALETTES
 */
const THEME_PALETTES: Readonly<Record<CliThemeId, CliThemePalette>> = {
  light: { primary: [15, 155, 142], secondary: [13, 191, 176] },
  ocean: { primary: [25, 118, 210], secondary: [66, 165, 245] },
  sunset: { primary: [230, 81, 0], secondary: [251, 140, 0] },
  forest: { primary: [46, 125, 50], secondary: [102, 187, 106] },
  lavender: { primary: [123, 31, 162], secondary: [171, 71, 188] },
  rose: { primary: [194, 24, 91], secondary: [236, 64, 122] },
  slate: { primary: [69, 90, 100], secondary: [120, 144, 156] },
  dark: { primary: [15, 155, 142], secondary: [13, 191, 176] },
};

/**
 * Type guard that checks whether a value is a registered CLI theme id.
 * @param {string | null | undefined} value - The value to test; undefined and
 *   unknown strings are rejected.
 * @returns {boolean} True when `value` is a known theme id.
 */
export function isCliThemeId(value: string | null | undefined): value is CliThemeId {
  return typeof value === 'string' && (CLI_THEME_IDS as readonly string[]).includes(value);
}

/**
 * How far each texture character sits along the primary -> secondary ramp,
 * from the densest shading (`@` = 0, primary) to the lightest detail
 * (`-` = 1, secondary).
 * @const {Readonly<Record<string, number>>} CHAR_GRADIENT
 */
const CHAR_GRADIENT: Readonly<Record<string, number>> = {
  '@': 0,
  '%': 0.18,
  '#': 0.35,
  '*': 0.5,
  '+': 0.65,
  '=': 0.82,
  '-': 1,
};

/**
 * The logo art, one row per entry. Dense `@`/`%` shading forms the outline
 * while `#`/`*`/`+`/`=`/- carve out the inner glyph detail.
 * @const {readonly string[]} LOGO_ART
 */
const LOGO_ART = [
  '@@@@%@@@%@@@@%@@@@@@%@@@@@@@@@@@@@@@@@@@@@@@@%@@@@@@%@@@@%@@@%@@@@',
  '@@@@@@%@@@%@@@@@%@@@@@@%@@@@@@@@@@@@@@@@@@%@@@@@@%@@@@@@@@@%@@@%@@',
  '%@@@%@@@%@@@@%@@@@%@@@@@@@%%@@@@@@@@@@%%@@@@@@@%@@@@%@@@@%@@@%@@@%',
  '@@%@@@%@@@%@@@@%@@@@%%@@@@@@@%%%%%%%%@@@@@@@%@@@@@%@@@%@@@@%@@@%@@',
  '@@@@%@@@%@@@@@@@@%@@@@%%@@@@@@@@@@@@@@@@@@%%@@@@%@@@%@@@@@@@@@@@%@',
  '@@@@@@%@@@@@@@@@@@@%@@@@@%@@@@@@@@@@@@@@%@@@@@%@@@%@@@@@@@%@@@%@@@',
  '@%@@@%@@@@@@%@@@%@@@@%@@@@@@%%%@@@@%%%@@@@@@%@@@@%@@@@@@%@@@%@@@@@',
  '%@@@@@@%@@@@@@%@@@%@@@@%@@@@@@@@@@@@@@@@@@%@@@@%@@@%@@%@@@@@@%@@@@',
  '@@@@@@%@@%@@@@@@%@#+*****+#@@@@@@@@@@@%*=======*@%@@@@@@%@@%@@%@@@',
  '@@@@@%@@%@@%@@%***********++++=@@@@%===============+@@%@@%@@%@@%@@',
  '@%@@%@@%@@%@+************++++++%@#+++=================@%@@%@@%@@%@',
  '%@@%@@%@@%@********@@@@%@@#+++@@++++++==%@%@@@@#=======%%@@@@@@@@%',
  '%@@@@@@@%%******%@%@@@@@@%@@@@+++++++*@@%@@@@@@%@@======*@@%@@%@@%',
  '@@%@@%@@@******@@@@@@@@%@@@@%+++++++@@@@@@=#@@@@@@@======%@@%@%@@@',
  '@@%@@%@@%*****%@@%@@@@%@@%**++++++@@@@@@@@====@@%@@%======@@%@@%@@',
  '@@@@@@@%*#******************++++%@@@@%==========#@@%%=====@@%@@%@@',
  '@@%@@%@%##*******************+@@@@@+++++=========@@%%=====%@%@%%%@',
  '@@%@@@@%*##***#########**@@@@@@@@++++++++=====+@%@@%-=====@@%@%%@@',
  '@%%@@%@@@##****@@%@@%@%%@@@@@@@%+++++++@@@==%%@@%@@@=====+@@%@@%@@',
  '@@%@%%%@%###****@@@@@%@@%@@@@@*++++++@@@@%@@%@@%@@#======%@@@@@@@@',
  '%@@%@@%@@@###*****@%@@%@@@%%****+++%@#+#%@@%@@%@#=======@@@%@%%@@%',
  '%@@@@@%@@%@@********************+*@%++++++++++========+%%%@%@@@@@@',
  '@%@@%@@%@%%@@%*****************+@@@+++++++++++=======@@%@%%@@@@@%@',
  '@@%@@%@%%%@@@@%%%************@@@@@@@@@+++++++++==*%@@%@@@%@@%@%%@@',
  '%@%%@@%%%%%@%%%%%%@@@%@@@@@@%%%@@@@%%%@@@@@@%@@@%@@@%@@@@@@%%%%@@%',
  '@%%@%@@@%%@%%@@%%%%%@@@@%%@@@@@@@@@@@@@@%%@@@@%@@@%@@@%@@%%%@%%%%%',
  '%@%@@@@%%%@%@%@@@%@@@@%@@@@@@@@@@@@@@@@@@@@%@@@@%@@@%@%@%%%%%%@%@@',
  '@@%%@%@%@@@%@@@%@@@%%@@@@@%%@@@@@@@@@%%%@@@@@%%@@%%%%@%@@%%@@%%%%%',
  '%%@%%%@%@%@@@%@@@%%@@@@%%@@@@@@@@@@@@@@@@%%@@@@%%@%@%%%%%@%@%%@@%@',
  '%%%@@@%@@@@%@@@@%%%@%%%@@@@@@%@@@@@@@@@@@@@%%%@@@%@@@@%%@%%%%@%@%@',
  '%%%@%@@%%%@@@%%@@@@%%@@@@@@%%%%%%%%%%%@@@@@@@%%@%%@%%%@@%%%@%%%%%',
  '%%%@@@%@@%@%@@@@%%@@@%@%%%@@%@%@@@@@@@%@%%%%@@@@%%@@%%%@@@%%%@%%%%',
  '%%@%%@@@@%@%%@%%@%@@@%@@@%%@@@@@@@@@@%%%%%%%%%@%%%%%%%@%%@%%%%%%%%',
];

/**
 * Tagline printed beneath the logo, muted to stay secondary to the art.
 * @const {string} TAGLINE
 */
const TAGLINE = 'EncodeX - Multimedia conversion tool';

/**
 * Linearly interpolates between two channel values.
 * @param {number} start - Channel value at `t = 0`.
 * @param {number} end - Channel value at `t = 1`.
 * @param {number} t - Progress from 0 (start) to 1 (end).
 * @returns {number} The interpolated, rounded channel value.
 */
function interpolate(start: number, end: number, t: number): number {
  return Math.round(start + (end - start) * t);
}

/**
 * Builds the colorized ASCII logo art.
 *
 * Renders each row of {@link LOGO_ART}, colorizing every texture character
 * with a color blended from the given theme's primary to secondary accent
 * ({@link CHAR_GRADIENT} maps each character onto that ramp), so the art reads
 * in the app's theme colors. The string contains ANSI 24-bit color escape
 * codes and ends with a trailing newline. The muted tagline is not part of the
 * art so callers can place text (like the CLI description) beneath it.
 *
 * @param {CliThemeId} [themeId] - Theme whose accent colors color the logo
 *   (defaults to {@link DEFAULT_CLI_THEME}).
 * @returns {string} The complete colored logo art, ready to print.
 */
export function getCliLogo(themeId: CliThemeId = DEFAULT_CLI_THEME): string {
  const palette = THEME_PALETTES[themeId];
  const rows = LOGO_ART.map((row) => {
    let colored = '';
    for (const ch of row) {
      const t = CHAR_GRADIENT[ch];
      if (t === undefined) {
        colored += ch;
        continue;
      }
      const red = interpolate(palette.primary[0], palette.secondary[0], t);
      const green = interpolate(palette.primary[1], palette.secondary[1], t);
      const blue = interpolate(palette.primary[2], palette.secondary[2], t);
      colored += `${ANSI.FG}${red};${green};${blue}m${ch}`;
    }
    return `${colored}${ANSI.RESET}`;
  });
  return `${rows.join('\n')}\n`;
}

/**
 * Prints the ASCII logo banner (art plus muted tagline) to the given stream.
 *
 * Always writes the banner (no TTY gating) so it is visible whenever the CLI
 * is invoked, including in wrapped/spawned terminals where `isTTY` is not
 * reliably reported. Output goes to stderr by default so stdout stays clean
 * for data such as `--info` JSON.
 *
 * @param {CliThemeId} [themeId] - Theme whose accent colors color the logo
 *   (defaults to {@link DEFAULT_CLI_THEME}).
 * @param {NodeJS.WriteStream} [stream] - Stream the banner is written to
 *   (defaults to `process.stderr`, keeping stdout free for data).
 * @returns {void}
 */
export function printCliLogo(themeId: CliThemeId = DEFAULT_CLI_THEME, stream: NodeJS.WriteStream = process.stderr): void {
  stream.write(`${getCliLogo(themeId)}\x1b[2m${TAGLINE}\x1b[0m\n`);
}
