import { describe, it, expect } from 'vitest';
import { basename, basenameOrEmpty, fileName, dirname, stem, normalizePath, getExtension, replaceExtension } from '../path-utils';

describe('basename', () => {
  it('handles POSIX separators and falls back to the path', () => {
    expect(basename('/home/user/file.mp4')).toBe('file.mp4');
    expect(basename('file.mp4')).toBe('file.mp4');
  });

  it('handles Windows separators and a trailing separator', () => {
    expect(basename('C:\\Media\\clip.avi')).toBe('clip.avi');
    expect(basename('C:\\Media\\')).toBe('C:\\Media\\');
  });
});

describe('basenameOrEmpty', () => {
  it('returns the last segment', () => {
    expect(basenameOrEmpty('/a/b/c.txt')).toBe('c.txt');
    expect(basenameOrEmpty('C:\\a\\b\\c.txt')).toBe('c.txt');
  });

  it('returns empty string for undefined/empty and separator-terminated paths', () => {
    expect(basenameOrEmpty(undefined)).toBe('');
    expect(basenameOrEmpty('')).toBe('');
    expect(basenameOrEmpty('/a/b/')).toBe('');
  });
});

describe('fileName', () => {
  it('extracts the last segment via pop', () => {
    expect(fileName('/home/user/file.mp4')).toBe('file.mp4');
    expect(fileName('C:\\Media\\clip.avi')).toBe('clip.avi');
  });

  it('falls back to the original path when empty', () => {
    expect(fileName('file.mp4')).toBe('file.mp4');
    expect(fileName('/a/b/')).toBe(''); // trailing separator yields an empty final segment
    expect(fileName('\\')).toBe('');
  });
});

describe('dirname', () => {
  it('extracts the directory for both separator types', () => {
    expect(dirname('/home/user/file.mp4')).toBe('/home/user');
    expect(dirname('C:\\Media\\clip.avi')).toBe('C:\\Media');
    expect(dirname('C:\\Media\\sub\\clip.avi')).toBe('C:\\Media\\sub');
  });

  it('returns empty string when no separator exists', () => {
    expect(dirname('clip.avi')).toBe('');
  });
});

describe('stem', () => {
  it('strips the final extension from the basename', () => {
    expect(stem('/home/user/file.mp4')).toBe('file');
    expect(stem('C:\\Media\\clip.avi')).toBe('clip');
  });

  it('keeps dotfiles whole', () => {
    expect(stem('/home/user/.env')).toBe('.env');
  });

  it('returns the basename when there is no extension', () => {
    expect(stem('/home/user/movie')).toBe('movie');
  });
});

describe('normalizePath', () => {
  it('lowercases and unifies separators for comparison', () => {
    expect(normalizePath('C:\\Media\\Clip.AVI')).toBe('c:/media/clip.avi');
    expect(normalizePath('/HOME/User/File.MP4')).toBe('/home/user/file.mp4');
  });
});

describe('re-exports from codec-containers', () => {
  it('re-exports getExtension', () => {
    expect(getExtension('/a/b/video.MP4')).toBe('mp4');
    expect(getExtension('/a/b/none')).toBe('');
  });

  it('re-exports replaceExtension', () => {
    expect(replaceExtension('/a/b/video.mp4', 'mkv')).toBe('/a/b/video.mkv');
  });
});
