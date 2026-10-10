/**
 * @fileoverview Deterministic rules-based planner (`recommend_settings`, F1).
 *
 * Implements {@link AIProvider} with **no model call**: it maps a natural-language
 * intent plus {@link MediaFacts} onto one of the 115 built-in profiles and emits
 * the exact `convert_media` arguments for it. This is the default provider and
 * the honest baseline the remote adapters (7.1) must beat — the model selects
 * and configures profiles, it never invents FFmpeg flags (7.2).
 *
 * The argument mapping mirrors the renderer's `applyProfileToConversionStore`
 * (videoCodec, audioCodec, videoBitrate, audioBitrate, qscale←crf, scale,
 * pixelFormat) so an MCP plan produces the same encode as picking the profile
 * in the desktop app.
 */

import type { ConversionProfile, ProfileCategory } from '../types';
import type { ConversionConstraints, MediaFacts, PlanRequest, RecommendedSettings } from './types';
import { formatBytesHuman, parseBitrateKbps, parseResolution } from './units';

/**
 * Signals mined from a natural-language intent and optional constraints.
 * @interface IntentSignals
 * @property {ProfileCategory[]} categories - Profile categories the intent points at.
 * @property {string[]} profileHints - Profile-id prefixes the intent names (e.g. 'iphone').
 * @property {string[]} codecs - Codec families requested (h264, hevc, av1, vp9, vp8).
 * @property {string[]} containers - Container names requested.
 * @property {number} [targetClass] - Requested resolution class (long edge in px).
 * @property {boolean} audioOnly - The intent is to extract audio.
 * @property {boolean} copyOnly - The intent asks for a lossless/remux-style copy.
 * @property {boolean} wantsSmall - The intent prioritises small file size.
 * @property {boolean} wantsQuality - The intent prioritises quality.
 */
export interface IntentSignals {
  categories: ProfileCategory[];
  profileHints: string[];
  codecs: string[];
  containers: string[];
  targetClass?: number;
  audioOnly: boolean;
  copyOnly: boolean;
  wantsSmall: boolean;
  wantsQuality: boolean;
}

/**
 * Maps a keyword group to the signal it raises. Kept as data so the vocabulary
 * is easy to extend without touching the parser logic.
 * @const {Array<{ test: RegExp; categories?: ProfileCategory[]; hints?: string[]; codecs?: string[]; containers?: string[]; class?: number; flag?: keyof IntentSignals }>}
 */
const INTENT_RULES: Array<{
  test: RegExp;
  categories?: ProfileCategory[];
  hints?: string[];
  codecs?: string[];
  containers?: string[];
  class?: number;
  flag?: 'audioOnly' | 'copyOnly' | 'wantsSmall' | 'wantsQuality';
}> = [
  { test: /\b(iphone|ios|apple phone)\b/, categories: ['devices'], hints: ['iphone'] },
  { test: /\b(ipad)\b/, categories: ['devices'], hints: ['ipad'] },
  { test: /\b(apple ?tv|appletv)\b/, categories: ['devices'], hints: ['appletv'] },
  { test: /\b(android|pixel|galaxy)\b/, categories: ['devices'], hints: ['android'] },
  { test: /\b(playstation|ps4|ps5)\b/, categories: ['devices'], hints: ['ps4', 'ps5'] },
  { test: /\b(xbox)\b/, categories: ['devices'], hints: ['xbox'] },
  { test: /\b(nintendo|switch)\b/, categories: ['devices'], hints: ['switch'] },
  { test: /\b(youtube|yt)\b/, categories: ['web-social'], hints: ['yt'] },
  { test: /\b(facebook|fb)\b/, categories: ['web-social'], hints: ['fb'] },
  { test: /\b(instagram|reel|ig)\b/, categories: ['web-social'], hints: ['ig'] },
  { test: /\b(tiktok)\b/, categories: ['web-social'], hints: ['tiktok'] },
  { test: /\b(twitter|x\.com)\b/, categories: ['web-social'], hints: ['x-'] },
  { test: /\b(webm)\b/, categories: ['video'], containers: ['webm'] },
  { test: /\b(vp9)\b/, categories: ['video'], codecs: ['vp9'] },
  { test: /\b(vp8)\b/, categories: ['video'], codecs: ['vp8'] },
  { test: /\b(av1)\b/, categories: ['video'], codecs: ['av1'] },
  { test: /\b(hevc|h\.?265)\b/, codecs: ['hevc'] },
  { test: /\b(avc|h\.?264)\b/, codecs: ['h264'] },
  { test: /\b(mp4)\b/, containers: ['mp4'] },
  { test: /\b(mkv|matroska)\b/, containers: ['mkv'] },
  { test: /\b(mov|quicktime)\b/, containers: ['mov'] },
  { test: /\b(prores|prores)\b/, categories: ['professional'], hints: ['prores'] },
  { test: /\b(dnxhd|dnxhr)\b/, categories: ['professional'], hints: ['dnxhr'] },
  { test: /\b(stream|hls|dash|broadcast)\b/, categories: ['streaming'] },
  { test: /\b(gif)\b/, categories: ['images'], hints: ['gif'] },
  { test: /\b(webp)\b/, categories: ['images'], hints: ['webp'] },
  { test: /\b(avif)\b/, categories: ['images'], hints: ['avif'] },
  { test: /\b(png)\b/, categories: ['images'], hints: ['png'] },
  { test: /\b(jpe?g)\b/, categories: ['images'], hints: ['jpeg'] },
  { test: /\b(mp3)\b/, categories: ['audio'], hints: ['mp3'] },
  { test: /\b(aac|m4a)\b/, categories: ['audio'], hints: ['aac'] },
  { test: /\b(flac)\b/, categories: ['audio'], hints: ['flac'] },
  { test: /\b(opus)\b/, categories: ['audio'], hints: ['opus'] },
  { test: /\b(wav|pcm)\b/, categories: ['audio'], hints: ['wav'] },
  { test: /\b(extract|rip|strip).{0,20}(audio|sound|music)\b/, categories: ['audio'], flag: 'audioOnly' },
  { test: /\b(audio|sound|music) only\b/, categories: ['audio'], flag: 'audioOnly' },
  { test: /\b(compress|smaller|shrink|reduce|downsiz|save space|small)\b/, flag: 'wantsSmall' },
  { test: /\b(best|highest|high[ -]?quality|lossless|archive|master|professional)\b/, flag: 'wantsQuality' },
  { test: /\b(copy|remux|no re[ -]?encode|stream copy)\b/, flag: 'copyOnly' },
  { test: /\b(4k|uhd|2160p?)\b/, class: 2160 },
  { test: /\b(1440p?|qhd)\b/, class: 1440 },
  { test: /\b(1080p?|full[ -]?hd|fhd)\b/, class: 1080 },
  { test: /\b(720p?)\b/, class: 720 },
  { test: /\b(480p?|sd)\b/, class: 480 },
  { test: /\b(360p?)\b/, class: 360 },
];

/**
 * Normalises an FFmpeg encoder name into a codec family used for matching.
 * @param {string} videoCodec - Encoder name (e.g. 'libx264').
 * @returns {string} Codec family (e.g. 'h264').
 */
export function codecFamily(videoCodec: string): string {
  const codec = videoCodec.toLowerCase();
  if (codec.includes('265') || codec.includes('hevc')) return 'hevc';
  if (codec.includes('264')) return 'h264';
  if (codec.includes('av1')) return 'av1';
  if (codec.includes('vp9')) return 'vp9';
  if (codec.includes('vp8')) return 'vp8';
  if (codec.includes('prores')) return 'prores';
  if (codec.includes('dnx')) return 'dnxhr';
  return codec;
}

/**
 * Mines intent and constraint signals from free text.
 * @param {string} intent - The user's natural-language goal.
 * @param {ConversionConstraints} [constraints] - Optional hard constraints.
 * @returns {IntentSignals} The parsed signals.
 */
export function parseIntent(intent: string, constraints?: ConversionConstraints): IntentSignals {
  const text = ` ${intent.toLowerCase()} `;
  const signals: IntentSignals = {
    categories: [],
    profileHints: [],
    codecs: [],
    containers: [],
    audioOnly: false,
    copyOnly: false,
    wantsSmall: false,
    wantsQuality: false,
  };
  for (const rule of INTENT_RULES) {
    if (!rule.test.test(text)) continue;
    for (const category of rule.categories ?? []) if (!signals.categories.includes(category)) signals.categories.push(category);
    for (const hint of rule.hints ?? []) if (!signals.profileHints.includes(hint)) signals.profileHints.push(hint);
    for (const codec of rule.codecs ?? []) if (!signals.codecs.includes(codec)) signals.codecs.push(codec);
    for (const container of rule.containers ?? []) if (!signals.containers.includes(container)) signals.containers.push(container);
    if (rule.class !== undefined && (signals.targetClass === undefined || rule.class > signals.targetClass)) {
      signals.targetClass = rule.class;
    }
    if (rule.flag) signals[rule.flag] = true;
  }
  applyConstraintSignals(signals, constraints);
  return signals;
}

/**
 * Folds explicit constraints into the parsed signals.
 * @param {IntentSignals} signals - Signals to mutate.
 * @param {ConversionConstraints} [constraints] - Optional hard constraints.
 */
function applyConstraintSignals(signals: IntentSignals, constraints?: ConversionConstraints): void {
  if (!constraints) return;
  const device = (constraints.targetDevice ?? '').toLowerCase();
  const platform = (constraints.platform ?? '').toLowerCase();
  const push = <T>(list: T[], value: T): void => {
    if (!list.includes(value)) list.push(value);
  };
  if (device) {
    push(signals.categories, 'devices');
    if (/iphone|ios|apple phone/.test(device)) push(signals.profileHints, 'iphone');
    else if (/ipad/.test(device)) push(signals.profileHints, 'ipad');
    else if (/tv/.test(device)) push(signals.profileHints, 'appletv');
    else if (/android/.test(device)) push(signals.profileHints, 'android');
    else if (/ps5/.test(device)) push(signals.profileHints, 'ps5');
    else if (/ps4/.test(device)) push(signals.profileHints, 'ps4');
    else if (/xbox/.test(device)) push(signals.profileHints, 'xbox');
  }
  if (platform) {
    if (/youtube/.test(platform)) {
      push(signals.categories, 'web-social');
      push(signals.profileHints, 'yt');
    } else if (/facebook|instagram|tiktok|twitter|x\b/.test(platform)) {
      push(signals.categories, 'web-social');
    } else if (/web/.test(platform)) {
      push(signals.categories, 'web-social');
    }
  }
  const caps: number[] = [];
  const maxW = constraints.maxWidth;
  const maxH = constraints.maxHeight;
  if (maxW !== undefined && maxW > 0) caps.push(maxW);
  if (maxH !== undefined && maxH > 0) caps.push(maxH);
  if (caps.length > 0) {
    const cap = Math.min(...caps);
    signals.targetClass = signals.targetClass === undefined ? cap : Math.min(signals.targetClass, cap);
  }
  if (constraints.maxBytes !== undefined && constraints.maxBytes > 0) signals.wantsSmall = true;
}

/**
 * Returns the resolution class of a media file: the short edge, which is what
 * a "1080p"/"720p" label refers to in both landscape and portrait video.
 * @param {MediaFacts} facts - The source facts.
 * @returns {number} Short-edge pixels, defaulting to 1080 when unknown.
 */
export function sourceClass(facts: MediaFacts): number {
  const width = facts.video?.width;
  const height = facts.video?.height;
  if (width && height) return Math.min(width, height);
  return 1080;
}

/**
 * Returns a profile's resolution class, falling back to the source.
 * @param {ConversionProfile} profile - The profile to measure.
 * @param {MediaFacts} facts - The source facts.
 * @returns {number} Short-edge pixels.
 */
function profileClass(profile: ConversionProfile, facts: MediaFacts): number {
  const resolution = parseResolution(profile.scale);
  if (!resolution) return sourceClass(facts);
  return Math.min(resolution.width, resolution.height);
}

/**
 * Picks the default output resolution class when the intent does not name one.
 * @param {MediaFacts} facts - The source facts.
 * @param {IntentSignals} signals - Parsed signals.
 * @returns {number} Target long edge in pixels.
 */
function defaultTarget(facts: MediaFacts, signals: IntentSignals): number {
  if (signals.audioOnly) return 0;
  const source = sourceClass(facts);
  if (signals.wantsSmall) return Math.min(source, 720);
  return Math.min(source, 1080);
}

/**
 * Scores a single profile against the parsed signals. Higher is better.
 * @param {ConversionProfile} profile - Candidate profile.
 * @param {MediaFacts} facts - Source facts.
 * @param {IntentSignals} signals - Parsed signals.
 * @param {number} target - Target resolution class.
 * @returns {number} The score.
 */
function scoreProfile(profile: ConversionProfile, facts: MediaFacts, signals: IntentSignals, target: number): number {
  let score = 0;
  if (signals.profileHints.some((hint) => profile.id === hint || profile.id.startsWith(`${hint}-`))) score += 8;
  if (signals.categories.includes(profile.category)) score += 5;
  if (signals.codecs.some((codec) => codecFamily(profile.videoCodec) === codec)) score += 4;
  if (signals.containers.includes(profile.container)) score += 3;

  const cls = profileClass(profile, facts);
  if (target > 0) score -= Math.abs(cls - target) / 120;
  if (cls > sourceClass(facts) + 1) score -= 8;
  if (signals.wantsSmall && signals.targetClass === undefined) score += (sourceClass(facts) - cls) / 240;
  if (signals.wantsQuality) score += cls / 240 + (profile.crf !== undefined ? (51 - profile.crf) / 12 : 0);
  if (signals.audioOnly) score += profile.category === 'audio' ? 12 : -25;
  return score;
}

/**
 * Selects the best-matching profile, breaking ties by catalogue order.
 * @param {ConversionProfile[]} profiles - Candidate profiles.
 * @param {MediaFacts} facts - Source facts.
 * @param {IntentSignals} signals - Parsed signals.
 * @returns {ConversionProfile | undefined} The chosen profile.
 */
export function selectProfile(profiles: ConversionProfile[], facts: MediaFacts, signals: IntentSignals): ConversionProfile | undefined {
  const source = sourceClass(facts);
  const requested = signals.targetClass ?? defaultTarget(facts, signals);
  const target = requested > 0 ? Math.min(requested, source) : 0;
  let best: ConversionProfile | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  profiles.forEach((profile) => {
    const score = scoreProfile(profile, facts, signals, target);
    if (score > bestScore + 1e-9) {
      best = profile;
      bestScore = score;
    }
  });
  return best;
}

/**
 * Rescales a profile's `WxH` scale so neither edge exceeds the constraints,
 * preserving aspect ratio. Returns the original string when no cap applies.
 * @param {string} scale - The profile scale (e.g. '1920x1080').
 * @param {ConversionConstraints} [constraints] - Optional size constraints.
 * @returns {string} The (possibly reduced) scale.
 */
function capScale(scale: string, constraints?: ConversionConstraints): string {
  if (!constraints || (constraints.maxWidth === undefined && constraints.maxHeight === undefined)) return scale;
  const resolution = parseResolution(scale);
  if (!resolution) return scale;
  const ratio = Math.min(
    constraints.maxWidth !== undefined && constraints.maxWidth > 0 ? constraints.maxWidth / resolution.width : 1,
    constraints.maxHeight !== undefined && constraints.maxHeight > 0 ? constraints.maxHeight / resolution.height : 1,
    1,
  );
  if (ratio >= 1) return scale;
  const width = Math.max(2, Math.round((resolution.width * ratio) / 2) * 2);
  const height = Math.max(2, Math.round((resolution.height * ratio) / 2) * 2);
  return `${width}x${height}`;
}

/**
 * Builds the `convert_media`-shaped arguments for a chosen profile, mirroring
 * the renderer's `applyProfileToConversionStore`.
 * @param {ConversionProfile} profile - The chosen profile.
 * @param {PlanRequest} request - The original plan request.
 * @returns {Record<string, unknown>} The conversion arguments.
 */
function buildArgs(profile: ConversionProfile, request: PlanRequest): Record<string, unknown> {
  const args: Record<string, unknown> = { input: request.input };
  if (profile.videoCodec) args.videoCodec = profile.videoCodec;
  if (profile.audioCodec) args.audioCodec = profile.audioCodec;
  if (profile.videoBitrate) args.videoBitrate = profile.videoBitrate;
  if (profile.audioBitrate) args.audioBitrate = profile.audioBitrate;
  if (profile.crf !== undefined) args.qscale = profile.crf;
  if (profile.scale) args.scale = capScale(profile.scale, request.constraints);
  if (profile.pixelFormat) args.pixelFormat = profile.pixelFormat;
  return args;
}

/**
 * Re-targets the plan at a hard byte ceiling by computing a video bitrate from
 * the target size and the (known) duration, replacing any CRF-based quality.
 * @param {Record<string, unknown>} args - Mutable conversion arguments.
 * @param {ConversionProfile} profile - The chosen profile.
 * @param {PlanRequest} request - The original plan request.
 * @returns {string | undefined} Rationale note, when the constraint was applied.
 */
function applyByteCeiling(args: Record<string, unknown>, profile: ConversionProfile, request: PlanRequest): string | undefined {
  const maxBytes = request.constraints?.maxBytes;
  const seconds = request.facts.durationSeconds;
  if (maxBytes === undefined || maxBytes <= 0) return undefined;
  if (seconds <= 0) {
    return `A ${formatBytesHuman(maxBytes)} ceiling was requested, but the duration is unknown; size cannot be targeted.`;
  }
  const audioKbps = request.facts.hasAudio
    ? (parseBitrateKbps(profile.audioBitrate) ?? parseBitrateKbps(args.audioBitrate as string) ?? 128)
    : 0;
  const totalKbps = (maxBytes * 8) / seconds / 1000;
  const videoKbps = Math.max(100, Math.floor(totalKbps - audioKbps));
  args.videoBitrate = `${videoKbps}k`;
  delete args.qscale;
  return `Targeted ~${videoKbps} kbps video to stay at or under ${formatBytesHuman(maxBytes)}.`;
}

/**
 * Plans a conversion from a natural-language intent. Deterministic: identical
 * inputs always yield identical arguments.
 * @param {PlanRequest} request - The planning request.
 * @returns {RecommendedSettings} The typed, reviewable plan.
 */
export function recommendSettings(request: PlanRequest): RecommendedSettings {
  const signals = parseIntent(request.intent, request.constraints);
  const profile = selectProfile(request.profiles, request.facts, signals);
  const rationale: string[] = [];

  if (!profile) {
    return {
      args: { input: request.input },
      rationale: ['No built-in profile matched the request; no settings were inferred.'],
      confidence: 0,
      providerId: 'rules',
      isEstimated: true,
    };
  }

  const args = buildArgs(profile, request);
  rationale.push(`Selected the built-in "${profile.name}" profile (${profile.category}).`);
  if (profile.description) rationale.push(profile.description);

  const byteNote = applyByteCeiling(args, profile, request);
  if (byteNote) rationale.push(byteNote);

  const cappedScale = args.scale as string | undefined;
  if (cappedScale && cappedScale !== profile.scale) {
    rationale.push(`Reduced the output to ${cappedScale} to honour the size constraints.`);
  }
  if (signals.audioOnly) {
    rationale.push('The request is audio-only; the plan strips video and re-encodes the audio stream.');
  }
  if (signals.wantsQuality && profile.crf !== undefined) {
    rationale.push(`Quality-first encode (qscale ${profile.crf}).`);
  }

  return {
    args,
    profileId: profile.id,
    rationale,
    confidence: confidenceFor(signals, profile),
    providerId: 'rules',
    isEstimated: true,
  };
}

/**
 * Derives a confidence score in [0, 0.95] from how strongly the intent matched.
 * @param {IntentSignals} signals - Parsed signals.
 * @param {ConversionProfile} profile - The chosen profile.
 * @returns {number} Confidence in [0, 0.95].
 */
function confidenceFor(signals: IntentSignals, profile: ConversionProfile): number {
  let confidence = 0.5;
  if (signals.profileHints.some((hint) => profile.id.startsWith(hint))) confidence += 0.2;
  else if (signals.categories.includes(profile.category)) confidence += 0.15;
  if (signals.codecs.some((codec) => codecFamily(profile.videoCodec) === codec)) confidence += 0.1;
  if (signals.targetClass !== undefined) confidence += 0.05;
  if (signals.audioOnly && profile.category === 'audio') confidence += 0.1;
  if (signals.categories.length === 0 && signals.profileHints.length === 0) confidence = 0.4;
  return Math.min(0.95, Number(confidence.toFixed(2)));
}
