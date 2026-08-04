import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { FfmpegCore } from '../ffmpeg-core';
import { getFfmpegPath } from '../ffmpeg-utils';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-integration-audio-'));
const INPUT = path.join(TMP, 'test-with-audio.mp4');
const OUTPUT = path.join(TMP, 'integration-cut.mp4');
const FF = getFfmpegPath();

function probeStreams(file: string): string[] {
  try {
    const out = execFileSync(FF, ['-i', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return out
      .split('\n')
      .filter((l) => /Stream #/.test(l))
      .map((l) => l.trim());
  } catch (err) {
    const out = (err as { stderr?: Buffer | string }).stderr?.toString?.() ?? '';
    return out
      .split('\n')
      .filter((l) => /Stream #/.test(l))
      .map((l) => l.trim());
  }
}

describe('FfmpegCore audio-omit integration', () => {
  beforeAll(() => {
    if (!fs.existsSync(INPUT)) {
      execFileSync(
        FF,
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'testsrc=size=320x240:rate=10',
          '-f',
          'lavfi',
          '-i',
          'sine=frequency=440:duration=3',
          '-shortest',
          '-c:v',
          'libx264',
          '-c:a',
          'aac',
          INPUT,
        ],
        { stdio: 'ignore' },
      );
    }
  });

  it('produces a video-only output when audio: false', async () => {
    const transcoder = new FfmpegCore();
    await new Promise<void>((resolve, reject) => {
      const emitter = transcoder.convert(INPUT, OUTPUT, { copy: true, startTime: '00:00:00', endTime: '00:00:02', audio: false });
      emitter.on('error', reject);
      emitter.on('end', resolve);
    });
    const streams = probeStreams(OUTPUT);
    expect(streams).toHaveLength(1);
    expect(streams[0]).toContain('Video');
  });
});
