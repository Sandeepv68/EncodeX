/**
 * @fileoverview Social-repurposing planner (roadmap 2.0, R6 — F17).
 *
 * Turns one source file into a per-platform pack of `convert_media` steps
 * (aspect-ratio crop, resolution, codec, and a duration cap for short-form
 * platforms), assembled into a validated {@link Workflow} so the model can
 * propose the pack and the R5 execution gate can commit it. All of it is plain
 * arithmetic over preset constants — no model call (roadmap §7.3) — and the
 * module is Electron-/FFmpeg-free, so it is trivially unit-testable.
 */

import type { SocialClip, SocialPack, SocialPackOptions, SocialPreset, Workflow, WorkflowStep } from './types';

export type { SocialClip, SocialPack, SocialPackOptions, SocialPreset };

/**
 * Every shipped platform preset, in a stable, intentional order.
 * @const {readonly SocialPreset[]}
 */
export const SOCIAL_PRESETS: readonly SocialPreset[] = [
  {
    id: 'youtube',
    label: 'YouTube (landscape)',
    width: 1920,
    height: 1080,
    aspect: '16:9',
    videoCodec: 'libx264',
    qscale: 20,
    audioCodec: 'aac',
    audioBitrate: '192k',
    container: 'mp4',
    tags: ['landscape', 'long-form'],
  },
  {
    id: 'youtube-shorts',
    label: 'YouTube Shorts',
    width: 1080,
    height: 1920,
    aspect: '9:16',
    maxDurationSeconds: 60,
    videoCodec: 'libx264',
    qscale: 21,
    audioCodec: 'aac',
    audioBitrate: '128k',
    container: 'mp4',
    tags: ['vertical', 'short-form'],
  },
  {
    id: 'instagram-reels',
    label: 'Instagram Reels',
    width: 1080,
    height: 1920,
    aspect: '9:16',
    maxDurationSeconds: 90,
    videoCodec: 'libx264',
    qscale: 21,
    audioCodec: 'aac',
    audioBitrate: '128k',
    container: 'mp4',
    tags: ['vertical', 'short-form'],
  },
  {
    id: 'instagram-feed',
    label: 'Instagram Feed (square)',
    width: 1080,
    height: 1080,
    aspect: '1:1',
    maxDurationSeconds: 60,
    videoCodec: 'libx264',
    qscale: 21,
    audioCodec: 'aac',
    audioBitrate: '128k',
    container: 'mp4',
    tags: ['square'],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    width: 1080,
    height: 1920,
    aspect: '9:16',
    maxDurationSeconds: 60,
    videoCodec: 'libx264',
    qscale: 21,
    audioCodec: 'aac',
    audioBitrate: '128k',
    container: 'mp4',
    tags: ['vertical', 'short-form'],
  },
  {
    id: 'x',
    label: 'X / Twitter',
    width: 1280,
    height: 720,
    aspect: '16:9',
    maxDurationSeconds: 140,
    videoCodec: 'libx264',
    qscale: 21,
    audioCodec: 'aac',
    audioBitrate: '128k',
    container: 'mp4',
    tags: ['landscape'],
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    width: 1920,
    height: 1080,
    aspect: '16:9',
    maxDurationSeconds: 600,
    videoCodec: 'libx264',
    qscale: 21,
    audioCodec: 'aac',
    audioBitrate: '192k',
    container: 'mp4',
    tags: ['landscape'],
  },
  {
    id: 'square',
    label: 'Square (1:1)',
    width: 1080,
    height: 1080,
    aspect: '1:1',
    videoCodec: 'libx264',
    qscale: 21,
    audioCodec: 'aac',
    audioBitrate: '128k',
    container: 'mp4',
    tags: ['square'],
  },
  {
    id: 'vertical',
    label: 'Vertical (9:16)',
    width: 1080,
    height: 1920,
    aspect: '9:16',
    videoCodec: 'libx264',
    qscale: 21,
    audioCodec: 'aac',
    audioBitrate: '128k',
    container: 'mp4',
    tags: ['vertical'],
  },
] as const;

/**
 * Lists the shipped presets.
 * @returns {SocialPreset[]} A copy of the preset list.
 */
export function listSocialPresets(): SocialPreset[] {
  return SOCIAL_PRESETS.map((preset) => ({ ...preset, tags: [...preset.tags] }));
}

/**
 * Looks a preset up by id (case-insensitive).
 * @param {string} id - The preset id.
 * @returns {SocialPreset | undefined} The preset, if known.
 */
export function socialPresetById(id: string): SocialPreset | undefined {
  const wanted = String(id ?? '')
    .trim()
    .toLowerCase();
  return SOCIAL_PRESETS.find((preset) => preset.id === wanted);
}

/** Builds the replace-then-crop filter chain that frames a target aspect. */
function aspectFilters(preset: SocialPreset): string[] {
  return [`scale=${preset.width}:${preset.height}:force_original_aspect_ratio=increase`, `crop=${preset.width}:${preset.height}`];
}

/** Builds one clip from a preset and the pack options. */
function clipFor(source: string, preset: SocialPreset, options: SocialPackOptions, index: number): SocialClip {
  const cap = options.maxDurationSeconds ?? preset.maxDurationSeconds;
  const filters = aspectFilters(preset);
  const args: Record<string, unknown> = {
    input: source,
    videoCodec: preset.videoCodec,
    audioCodec: preset.audioCodec,
    audioBitrate: preset.audioBitrate,
    qscale: preset.qscale,
    videoFilters: filters,
  };
  if (cap !== undefined) args.duration = String(cap);
  const clip: SocialClip = {
    platform: preset.id,
    label: preset.label,
    aspect: preset.aspect,
    width: preset.width,
    height: preset.height,
    ...(cap !== undefined ? { maxDurationSeconds: cap } : {}),
    container: preset.container,
    filters,
    args,
    rationale:
      `Crop/scale to ${preset.width}x${preset.height} (${preset.aspect}) and re-encode with ${preset.videoCodec}` +
      (cap !== undefined ? `, trimmed to ${cap}s.` : '.'),
  };
  if (options.resolveOutput) clip.args.output = options.resolveOutput(clip, index);
  return clip;
}

/** Normalizes a preset id into a safe workflow step id. */
function stepIdFor(platform: string): string {
  return `clip_${platform.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

/**
 * Builds a social pack for one source and the requested platforms. Unknown
 * platform ids are ignored (recorded in `notes`); the result always contains a
 * workflow the R5 planner can validate and the execution gate can run.
 * @param {string} source - Input file path.
 * @param {SocialPackOptions} [options] - Platform selection and output naming.
 * @returns {SocialPack} The per-platform clips and their workflow.
 */
export function buildSocialPack(source: string, options: SocialPackOptions = {}): SocialPack {
  const notes: string[] = [];
  const requested = options.platforms?.length
    ? options.platforms.map((id) => String(id).trim().toLowerCase())
    : SOCIAL_PRESETS.map((preset) => preset.id);
  const seen = new Set<string>();
  const presets: SocialPreset[] = [];
  for (const id of requested) {
    if (seen.has(id)) continue;
    seen.add(id);
    const preset = socialPresetById(id);
    if (preset) presets.push(preset);
    else notes.push(`Unknown platform "${id}" was skipped.`);
  }
  if (presets.length === 0) notes.push('No known platforms were requested; the pack is empty.');

  const clips = presets.map((preset, index) => clipFor(source, preset, options, index));
  const steps: WorkflowStep[] = clips.map((clip) => ({
    id: stepIdFor(clip.platform),
    tool: 'convert_media',
    args: { ...clip.args },
  }));
  const workflow: Workflow = { steps };
  const summary = clips.map((clip) => clip.label).join(', ');
  return {
    source,
    clips,
    workflow,
    rationale: clips.length > 0 ? `Repurpose for ${clips.length} platform(s): ${summary}.` : 'No platforms selected.',
    notes,
  };
}
