import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildCompressPlan, buildExtractAudioPlan, buildCutPlan, buildBatchPlan } from '../operations';

function tempMedia(ext: string, name = 'clip'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-'));
  const file = path.join(dir, `${name}.${ext}`);
  fs.writeFileSync(file, 'fake');
  return file;
}

describe('buildCompressPlan', () => {
  it('defaults the format to the source extension and maps the image codec', () => {
    const input = tempMedia('jpg');
    const plan = buildCompressPlan(input, {});
    expect(plan.format).toBe('jpg');
    expect(plan.options.videoCodec).toBe('mjpeg');
    expect(plan.options.qscale).toBe(23);
    expect(plan.output).toBe(path.join(path.dirname(input), 'clip_compressed.jpg'));
  });

  it('maps png/webp formats and honors explicit quality and scale', () => {
    const input = tempMedia('png');
    const plan = buildCompressPlan(input, { format: 'WEBP', quality: 15, scale: '50%' });
    expect(plan.format).toBe('webp');
    expect(plan.options.videoCodec).toBe('libwebp');
    expect(plan.options.qscale).toBe(15);
    expect(plan.options.scale).toBe('50%');
    expect(plan.output.endsWith('.webp')).toBe(true);
  });

  it('drops out-of-range quality and uses an explicit output when given', () => {
    const input = tempMedia('jpg');
    const plan = buildCompressPlan(input, { quality: 99 });
    expect(plan.options.qscale).toBeUndefined();
    const explicit = buildCompressPlan(input, { output: 'C:\\out\\thumb.webp', format: 'webp' });
    expect(explicit.output).toBe('C:\\out\\thumb.webp');
  });
});

describe('buildExtractAudioPlan', () => {
  it('defaults to mp3 with 192k and drops the video stream', () => {
    const input = tempMedia('mp4');
    const plan = buildExtractAudioPlan(input, {});
    expect(plan.audioCodec).toBe('libmp3lame');
    expect(plan.ext).toBe('mp3');
    expect(plan.options).toMatchObject({ audioCodec: 'libmp3lame', audioBitrate: '192k', video: false });
    expect(plan.output).toBe(path.join(path.dirname(input), 'clip.mp3'));
  });

  it('derives the extension and bitrate from explicit fields', () => {
    const input = tempMedia('mkv');
    const plan = buildExtractAudioPlan(input, { audioCodec: 'aac', bitrate: '128k' });
    expect(plan.ext).toBe('m4a');
    expect(plan.options.audioCodec).toBe('aac');
    expect(plan.options.audioBitrate).toBe('128k');
    expect(plan.output.endsWith('.m4a')).toBe(true);
  });

  it('uses an explicit output when given', () => {
    const input = tempMedia('mp4');
    const plan = buildExtractAudioPlan(input, { output: 'C:\\out\\sound.wav', audioCodec: 'pcm_s16le' });
    expect(plan.output).toBe('C:\\out\\sound.wav');
    expect(plan.ext).toBe('wav');
  });
});

describe('buildCutPlan', () => {
  it('defaults to lossless stream copy with a _cut suffix and the source extension', () => {
    const input = tempMedia('mp4');
    const plan = buildCutPlan(input, { startTime: '00:01:00', endTime: '00:02:00' });
    expect(plan.options.copy).toBe(true);
    expect(plan.options.startTime).toBe('00:01:00');
    expect(plan.options.endTime).toBe('00:02:00');
    expect(plan.output).toBe(path.join(path.dirname(input), 'clip_cut.mp4'));
  });

  it('honors duration, audio exclusion, and re-encode mode', () => {
    const input = tempMedia('mkv');
    const plan = buildCutPlan(input, { duration: '30', copy: false, audio: false });
    expect(plan.options.copy).toBe(false);
    expect(plan.options.duration).toBe('30');
    expect(plan.options.audio).toBe(false);
  });

  it('uses an explicit output when given', () => {
    const input = tempMedia('mp4');
    const plan = buildCutPlan(input, { output: 'C:\\out\\segment.mp4' });
    expect(plan.output).toBe('C:\\out\\segment.mp4');
  });
});

describe('buildBatchPlan', () => {
  it('expands inputs and derives per-file outputs with the default suffix', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-'));
    fs.writeFileSync(path.join(dir, 'a.mp4'), 'x');
    fs.writeFileSync(path.join(dir, 'b.mp4'), 'x');
    const plan = buildBatchPlan([`${dir}/*.mp4`], { videoCodec: 'libx264' });
    expect(plan.jobs).toHaveLength(2);
    expect(plan.suffix).toBe('_encodex_converted');
    for (const job of plan.jobs) {
      expect(job.output).toContain('_encodex_converted');
      expect(job.output.endsWith('.mp4')).toBe(true);
      expect(job.options.videoCodec).toBe('libx264');
    }
  });

  it('projects outputs into outputDir with a custom suffix', () => {
    const input = tempMedia('mp4');
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-out-'));
    const plan = buildBatchPlan([input], { videoCodec: 'libx264' }, outDir, '_done');
    expect(plan.jobs[0].output).toBe(path.join(outDir, 'clip_done.mp4'));
  });

  it('keeps the source extension in copy mode and audio-only mode', () => {
    const inputA = tempMedia('mp4');
    const planCopy = buildBatchPlan([inputA], { copy: true });
    expect(planCopy.jobs[0].output.endsWith('.mp4')).toBe(true);
    const inputB = tempMedia('flac', 'song');
    const planAudio = buildBatchPlan([inputB], { video: false, audioCodec: 'flac' });
    expect(planAudio.jobs[0].output.endsWith('.flac')).toBe(true);
  });

  it('returns an empty plan when nothing matches', () => {
    const plan = buildBatchPlan(['C:\\no-such-dir\\**\\*.mp4'], {});
    expect(plan.jobs).toHaveLength(0);
  });
});
