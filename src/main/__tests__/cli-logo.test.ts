import { describe, it, expect, vi } from 'vitest';
import { getCliLogo, printCliLogo, DEFAULT_CLI_THEME, isCliThemeId, CLI_THEME_IDS } from '../cli-logo';

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

describe('getCliLogo', () => {
  it('contains the logo art', () => {
    const logo = stripAnsi(getCliLogo());
    expect(logo).toContain('@@@@%@@@%@@@@%@@@@@@%');
    expect(logo).toContain('%%@%%@@@@%@%%@%%@%@@@%@@@%%');
  });

  it('excludes the muted tagline so text can follow the art', () => {
    expect(getCliLogo()).not.toContain('Multimedia conversion tool');
  });

  it('colorizes the art with the default theme palette', () => {
    const logo = getCliLogo();
    expect(logo).toContain('\x1b[38;2;15;155;142m');
    expect(logo).toContain('\x1b[38;2;13;191;176m');
    expect(logo).toContain('\x1b[0m');
  });

  it('colorizes the art with the selected theme palette', () => {
    expect(getCliLogo('ocean')).toContain('\x1b[38;2;25;118;210m');
    expect(getCliLogo('sunset')).toContain('\x1b[38;2;230;81;0m');
    expect(getCliLogo('lavender')).toContain('\x1b[38;2;123;31;162m');
  });

  it('renders every art row', () => {
    expect(getCliLogo().split('\n').length).toBe(34);
  });
});

describe('theme id helpers', () => {
  it('defaults to the light brand theme', () => {
    expect(DEFAULT_CLI_THEME).toBe('light');
  });

  it('lists every supported theme id', () => {
    expect(CLI_THEME_IDS).toEqual(['light', 'ocean', 'sunset', 'forest', 'lavender', 'rose', 'slate', 'dark']);
  });

  it('validates theme ids', () => {
    expect(isCliThemeId('sunset')).toBe(true);
    expect(isCliThemeId('light')).toBe(true);
    expect(isCliThemeId('unknown')).toBe(false);
    expect(isCliThemeId(undefined)).toBe(false);
    expect(isCliThemeId(null)).toBe(false);
  });
});

describe('printCliLogo', () => {
  it('writes the art and muted tagline to the given stream', () => {
    const write = vi.fn();
    printCliLogo(DEFAULT_CLI_THEME, { write } as unknown as NodeJS.WriteStream);
    const output = write.mock.calls[0][0] as string;
    expect(stripAnsi(output)).toContain('@@@@%@@@%@@@@%@@@@@@%');
    expect(output).toContain('Multimedia conversion tool');
  });
});
