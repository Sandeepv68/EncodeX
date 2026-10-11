/**
 * @fileoverview Unit tests for the social-repurposing planner (F17).
 */

import { describe, it, expect } from 'vitest';
import { buildSocialPack, listSocialPresets, socialPresetById } from '../social';
import { planWorkflow } from '../workflow';

describe('presets', () => {
  it('lists stable presets including vertical short-form targets', () => {
    const presets = listSocialPresets();
    expect(presets.length).toBeGreaterThan(0);
    const shorts = presets.find((preset) => preset.id === 'youtube-shorts');
    expect(shorts).toMatchObject({ width: 1080, height: 1920, maxDurationSeconds: 60 });
  });

  it('looks up presets case-insensitively', () => {
    expect(socialPresetById('TikTok')?.id).toBe('tiktok');
    expect(socialPresetById('nope')).toBeUndefined();
  });
});

describe('buildSocialPack', () => {
  it('builds one crop/scale clip and workflow step per platform', () => {
    const pack = buildSocialPack('C:/media/clip.mp4', { platforms: ['youtube-shorts', 'tiktok'] });
    expect(pack.clips).toHaveLength(2);
    expect(pack.workflow.steps.map((step) => step.id)).toEqual(['clip_youtube-shorts', 'clip_tiktok']);
    for (const clip of pack.clips) {
      expect(clip.args.input).toBe('C:/media/clip.mp4');
      expect(clip.args.duration).toBe('60');
      expect(clip.filters).toEqual(['scale=1080:1920:force_original_aspect_ratio=increase', 'crop=1080:1920']);
    }
    expect(pack.clips[0].container).toBe('mp4');
  });

  it('produces a workflow the planner validates as runnable', () => {
    const pack = buildSocialPack('C:/media/clip.mp4', { platforms: ['youtube', 'square'] });
    const plan = planWorkflow(pack.workflow);
    expect(plan.valid).toBe(true);
    expect(plan.order).toEqual(['clip_youtube', 'clip_square']);
  });

  it('records unknown platforms as notes', () => {
    const pack = buildSocialPack('C:/media/clip.mp4', { platforms: ['mastodon'] });
    expect(pack.clips).toHaveLength(0);
    expect(pack.notes.some((note) => note.includes('mastodon'))).toBe(true);
  });

  it('applies an explicit duration override', () => {
    const pack = buildSocialPack('C:/media/clip.mp4', { platforms: ['youtube'], maxDurationSeconds: 30 });
    expect(pack.clips[0].args.duration).toBe('30');
  });

  it('fills output paths via the resolveOutput callback', () => {
    const pack = buildSocialPack('C:/media/clip.mp4', {
      platforms: ['youtube'],
      resolveOutput: (clip) => `C:/out/clip_${clip.platform}.mp4`,
    });
    expect(pack.clips[0].args.output).toBe('C:/out/clip_youtube.mp4');
    expect(pack.workflow.steps[0].args?.output).toBe('C:/out/clip_youtube.mp4');
  });

  it('defaults to every preset when none are requested', () => {
    const pack = buildSocialPack('C:/media/clip.mp4');
    expect(pack.clips.length).toBe(listSocialPresets().length);
  });
});
