import { describe, it, expect } from 'vitest';
import { IPC } from '../ipc-channels';
import {
  TRANSCODER_TYPES,
  TRANSCODER_LABELS,
  FFMPEG_FLAGS,
  FFPROBE_FLAGS,
  PROGRESS_PATTERNS,
  TRANSCODER_COMMANDS,
  KILL_SIGNAL,
  TRANSCODER_DEFAULTS,
  COMPLETED_PROGRESS,
  EMPTY_PROGRESS,
  CONVERSION_DEFAULTS,
} from '../transcoder-constants';
import {
  DRAWER_WIDTH,
  DEV_SERVER_URL,
  WINDOW_SIZE,
  APP_NAME,
  FILE_EXTENSIONS,
  PIXEL_FORMATS,
  VIDEO_CODECS,
  AUDIO_CODECS,
  QUEUE_STATUS,
  NAV_ITEMS,
} from '../ui-constants';

describe('IPC channels', () => {
  it('all channels are kebab-case strings', () => {
    const values = Object.values(IPC);
    for (const v of values) {
      expect(v).toEqual(expect.stringMatching(/^[a-z][a-z0-9-]*$/));
    }
  });

  it('has unique channel names', () => {
    const values = Object.values(IPC);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('TRANSCODER_TYPES', () => {
  it('contains the three expected types', () => {
    expect(TRANSCODER_TYPES).toEqual(['FFMPEG', 'FFTOOL', 'BMF']);
  });

  it('has labels for every type', () => {
    for (const t of TRANSCODER_TYPES) {
      expect(TRANSCODER_LABELS[t]).toBeDefined();
    }
  });
});

describe('FFMPEG_FLAGS', () => {
  it('all flags start with -', () => {
    const flagValues = Object.values(FFMPEG_FLAGS).filter((v) => typeof v === 'string');
    for (const f of flagValues) {
      if (f.startsWith('-')) continue;
      expect(f).not.toMatch(/^-/);
    }
  });
});

describe('PROGRESS_PATTERNS', () => {
  it('TIME regex matches time strings', () => {
    const match = 'time=01:23:45.67'.match(PROGRESS_PATTERNS.TIME_SINGLE);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('01:23:45.67');
  });

  it('TIME regex does not match malformed strings', () => {
    expect('time=abc'.match(PROGRESS_PATTERNS.TIME_SINGLE)).toBeNull();
  });
});

describe('TRANSCODER_COMMANDS', () => {
  it('has all required commands', () => {
    expect(TRANSCODER_COMMANDS.FFMPEG).toBe('ffmpeg');
    expect(TRANSCODER_COMMANDS.FFPROBE).toBe('ffprobe');
    expect(TRANSCODER_COMMANDS.BMF_FFMPEG).toBe('bmf_ffmpeg');
    expect(TRANSCODER_COMMANDS.BMF_FFPROBE).toBe('bmf_ffprobe');
  });
});

describe('TRANSCODER_DEFAULTS', () => {
  it('all timeout values are positive numbers', () => {
    expect(TRANSCODER_DEFAULTS.PROGRESS_INTERVAL_MS).toBeGreaterThan(0);
    expect(TRANSCODER_DEFAULTS.BMF_TIMEOUT_MS).toBeGreaterThan(0);
    expect(TRANSCODER_DEFAULTS.PLAYER_FRAME_TIMEOUT_MS).toBeGreaterThan(0);
    expect(TRANSCODER_DEFAULTS.FFPROBE_TIMEOUT_MS).toBeGreaterThan(0);
  });
});

describe('COMPLETED_PROGRESS', () => {
  it('has percent 100', () => {
    expect(COMPLETED_PROGRESS.percent).toBe(100);
  });
});

describe('EMPTY_PROGRESS', () => {
  it('has percent 0', () => {
    expect(EMPTY_PROGRESS.percent).toBe(0);
  });
});

describe('CONVERSION_DEFAULTS', () => {
  it('defaults to libx264 and aac', () => {
    expect(CONVERSION_DEFAULTS.VIDEO_CODEC).toBe('libx264');
    expect(CONVERSION_DEFAULTS.AUDIO_CODEC).toBe('aac');
    expect(CONVERSION_DEFAULTS.QSCALE).toBe(23);
    expect(CONVERSION_DEFAULTS.PIXEL_FORMAT).toBe('yuv420p');
  });
});

describe('UI constants', () => {
  it('DRAWER_WIDTH is positive', () => {
    expect(DRAWER_WIDTH).toBeGreaterThan(0);
  });

  it('DEV_SERVER_URL is a valid URL', () => {
    expect(DEV_SERVER_URL).toMatch(/^http:\/\/localhost:\d+/);
  });

  it('WINDOW_SIZE has valid dimensions', () => {
    expect(WINDOW_SIZE.WIDTH).toBeGreaterThan(WINDOW_SIZE.MIN_WIDTH);
    expect(WINDOW_SIZE.HEIGHT).toBeGreaterThan(WINDOW_SIZE.MIN_HEIGHT);
  });

  it('APP_NAME is EncodeX', () => {
    expect(APP_NAME).toBe('EncodeX');
  });
});

describe('FILE_EXTENSIONS', () => {
  it('MEDIA_INPUT includes common formats', () => {
    expect(FILE_EXTENSIONS.MEDIA_INPUT).toContain('mp4');
    expect(FILE_EXTENSIONS.MEDIA_INPUT).toContain('avi');
    expect(FILE_EXTENSIONS.MEDIA_INPUT).toContain('mp3');
  });

  it('MEDIA_INPUT includes video, audio, image, and subtitle formats', () => {
    expect(FILE_EXTENSIONS.MEDIA_INPUT.length).toBeGreaterThan(50);
  });

  it('MEDIA_OUTPUT includes common video, audio, and image output formats', () => {
    expect(FILE_EXTENSIONS.MEDIA_OUTPUT).toContain('mp4');
    expect(FILE_EXTENSIONS.MEDIA_OUTPUT).toContain('avi');
    expect(FILE_EXTENSIONS.MEDIA_OUTPUT).toContain('flv');
    expect(FILE_EXTENSIONS.MEDIA_OUTPUT).toContain('mp3');
    expect(FILE_EXTENSIONS.MEDIA_OUTPUT).toContain('wav');
    expect(FILE_EXTENSIONS.MEDIA_OUTPUT).toContain('webp');
  });
});

describe('PIXEL_FORMATS', () => {
  it('includes common pixel formats', () => {
    expect(PIXEL_FORMATS.some((f) => f.value === 'yuv420p')).toBe(true);
    expect(PIXEL_FORMATS.some((f) => f.value === 'rgb24')).toBe(true);
  });
});

describe('VIDEO_CODECS', () => {
  it('has entries with value, label, and group', () => {
    for (const c of VIDEO_CODECS) {
      expect(c.value).toBeDefined();
      expect(c.label).toBeDefined();
      expect(c.group).toBeDefined();
      expect(typeof c.value).toBe('string');
      expect(typeof c.label).toBe('string');
      expect(typeof c.group).toBe('string');
    }
  });
});

describe('AUDIO_CODECS', () => {
  it('includes AAC and MP3', () => {
    expect(AUDIO_CODECS.some((c) => c.value === 'aac')).toBe(true);
    expect(AUDIO_CODECS.some((c) => c.value === 'libmp3lame')).toBe(true);
  });

  it('has entries with value, label, and group', () => {
    for (const c of AUDIO_CODECS) {
      expect(c.group).toBeDefined();
      expect(typeof c.group).toBe('string');
    }
  });
});

describe('PIXEL_FORMATS', () => {
  it('has entries with value and group', () => {
    for (const f of PIXEL_FORMATS) {
      expect(f.value).toBeDefined();
      expect(f.group).toBeDefined();
      expect(typeof f.value).toBe('string');
      expect(typeof f.group).toBe('string');
    }
  });
});

describe('QUEUE_STATUS', () => {
  it('has the four expected states', () => {
    expect(QUEUE_STATUS.QUEUED).toBe('queued');
    expect(QUEUE_STATUS.RUNNING).toBe('running');
    expect(QUEUE_STATUS.DONE).toBe('done');
    expect(QUEUE_STATUS.ERROR).toBe('error');
  });
});

describe('NAV_ITEMS', () => {
  it('has Dashboard and Convert routes', () => {
    expect(NAV_ITEMS.some((n) => n.to === '/')).toBe(true);
    expect(NAV_ITEMS.some((n) => n.to === '/convert')).toBe(true);
    expect(NAV_ITEMS.some((n) => n.to === '/batch')).toBe(true);
  });

  it('all routes start with /', () => {
    for (const n of NAV_ITEMS) {
      expect(n.to).toMatch(/^\//);
    }
  });
});
