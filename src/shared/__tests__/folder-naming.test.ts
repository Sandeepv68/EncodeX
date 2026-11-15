import { describe, it, expect } from 'vitest';
import { sanitizeFolderName, defaultFolderNameForFile } from '../folder-naming';

describe('sanitizeFolderName', () => {
  it('keeps a plain label unchanged', () => {
    expect(sanitizeFolderName('My Movie')).toBe('My Movie');
  });

  it('replaces characters that are not allowed in folder names', () => {
    expect(sanitizeFolderName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
  });

  it('removes control characters', () => {
    expect(sanitizeFolderName(`na${String.fromCharCode(7)}me`)).toBe('na-me');
  });

  it('collapses runs of dashes and whitespace', () => {
    expect(sanitizeFolderName('my   movie')).toBe('my movie');
    expect(sanitizeFolderName('my///movie')).toBe('my-movie');
  });

  it('strips trailing dots and spaces', () => {
    expect(sanitizeFolderName('movie.')).toBe('movie');
    expect(sanitizeFolderName('movie  ')).toBe('movie');
  });

  it('escapes reserved device names', () => {
    expect(sanitizeFolderName('CON')).toBe('CON_');
    expect(sanitizeFolderName('com1')).toBe('com1_');
    expect(sanitizeFolderName('console')).toBe('console');
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(sanitizeFolderName('')).toBe('');
    expect(sanitizeFolderName('///')).toBe('');
  });

  it('truncates very long names', () => {
    expect(sanitizeFolderName('a'.repeat(200))).toHaveLength(120);
  });
});

describe('defaultFolderNameForFile', () => {
  it('uses the file name without its extension', () => {
    expect(defaultFolderNameForFile('/movies/My Movie.mkv')).toBe('My Movie');
  });

  it('handles Windows paths', () => {
    expect(defaultFolderNameForFile('C:\\videos\\movie.2024.mp4')).toBe('movie.2024');
  });

  it('sanitizes illegal characters of the file name', () => {
    expect(defaultFolderNameForFile('/videos/a:b.mkv')).toBe('a-b');
  });

  it('falls back to a default when the name has no usable characters', () => {
    expect(defaultFolderNameForFile('')).toBe('extracted');
    expect(defaultFolderNameForFile('///')).toBe('extracted');
  });
});
