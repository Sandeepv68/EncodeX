/**
 * @fileoverview Structured media diagnosis (`analyze_media`, roadmap §4.2).
 *
 * Turns a probe into plain-language findings and next steps — HDR, interlacing,
 * uncommon codecs, multichannel audio, resolution and size — so the model can
 * explain a file and the Media Inspector view can render it. Deterministic; no
 * model call.
 */

import type { MediaInfo } from '../types';
import type { AnalysisFinding, MediaAnalysis, MediaFacts } from './types';
import { extractMediaFacts } from './media-facts';
import { formatBytesHuman } from './units';

/**
 * Which lens the analysis is framed through.
 * @typedef {('compat' | 'quality' | 'size')} AnalysisFocus
 */
export type AnalysisFocus = 'compat' | 'quality' | 'size';

/** Codecs that need a re-encode to play broadly. */
const NON_BROAD_VIDEO_CODECS: Record<string, string> = {
  hevc: 'H.265/HEVC needs a modern player; some browsers and older devices cannot play it.',
  h265: 'H.265/HEVC needs a modern player; some browsers and older devices cannot play it.',
  av1: 'AV1 playback is not universal yet; re-encode to H.264 for maximum compatibility.',
  vp9: 'VP9 is well supported on the web but not by all standalone players.',
  mpeg4: 'MPEG-4 Part 2 is legacy and plays poorly in browsers.',
  msmpeg4v3: 'MS MPEG-4 v3 is legacy and poorly supported.',
  wmv3: 'WMV is legacy and poorly supported on non-Windows devices.',
  mpeg2video: 'MPEG-2 is legacy; re-encode to H.264 for modern devices.',
};

/** Audio codecs that some players cannot decode. */
const NON_BROAD_AUDIO_CODECS: Record<string, string> = {
  dts: 'DTS audio is not supported by many players; AAC is safer.',
  eac3: 'E-AC-3 (Dolby Digital Plus) may not play everywhere; AAC is safer.',
  ac3: 'AC-3 may not play in browsers; AAC is safer.',
  truehd: 'TrueHD is not widely supported outside dedicated players.',
  flac: 'FLAC plays in many but not all players; convert to AAC for broad support.',
};

/**
 * Renders a compact human summary of the file from its facts.
 * @param {MediaFacts} facts - The extracted facts.
 * @returns {string} One-sentence summary.
 */
function summarize(facts: MediaFacts): string {
  const parts: string[] = [];
  if (facts.video) {
    const resolution = facts.video.width && facts.video.height ? `${facts.video.width}x${facts.video.height}` : 'video';
    const hdr = facts.video.hdr ? ' HDR' : '';
    parts.push(`${resolution}${hdr} ${(facts.video.codec ?? '').toUpperCase()}`.trim());
  }
  if (facts.audio) {
    const layout = facts.audio.channelLayout ?? (facts.audio.channels ? `${facts.audio.channels}ch` : '');
    parts.push(`${layout} ${(facts.audio.codec ?? '').toUpperCase()}`.trim());
  }
  if (!facts.hasVideo && !facts.hasAudio) parts.push('no readable streams');
  const duration = facts.durationSeconds ? `, ${Math.round(facts.durationSeconds)}s` : '';
  return `${parts.join(' + ')}${duration}, ${formatBytesHuman(facts.sizeBytes)}.`;
}

/**
 * Analyses a probed media file into plain-language findings and next steps.
 * @param {MediaInfo} info - The probed media info.
 * @param {AnalysisFocus} [focus='compat'] - The lens to frame the analysis through.
 * @returns {MediaAnalysis} The structured diagnosis.
 */
export function analyzeMedia(info: MediaInfo, focus: AnalysisFocus = 'compat'): MediaAnalysis {
  const facts = extractMediaFacts(info);
  const findings: AnalysisFinding[] = [];
  const recommendations: string[] = [];

  if (!facts.hasVideo && !facts.hasAudio) {
    findings.push({ severity: 'error', code: 'NO_STREAMS', message: 'No readable audio or video streams were found.' });
    recommendations.push('The file may be corrupt or unsupported; try re-exporting the source.');
    return { file: info.file, format: info.format, summary: summarize(facts), facts, findings, recommendations };
  }

  if (facts.video) {
    const video = facts.video;
    const codec = (video.codec ?? '').toLowerCase();
    const note = NON_BROAD_VIDEO_CODECS[codec];
    if (note) {
      findings.push({ severity: 'warning', code: 'VIDEO_CODEC_COMPAT', message: note });
      recommendations.push('Re-encode to H.264 (libx264) for broad playback.');
    }
    if (video.hdr) {
      findings.push({
        severity: 'warning',
        code: 'HDR',
        message: 'HDR content: SDR displays will look washed out without tone-mapping.',
      });
      recommendations.push('Apply an HDR-to-SDR tonemap when the target does not support HDR.');
    }
    if (video.interlaced) {
      findings.push({ severity: 'warning', code: 'INTERLACED', message: 'Interlaced video: motion can show combing artefacts.' });
      recommendations.push('Deinterlace (yadif) when re-encoding.');
    }
    if (video.width && video.height && (video.width >= 3840 || video.height >= 2160)) {
      findings.push({ severity: 'info', code: 'HIGH_RESOLUTION', message: '4K or larger: encode times and file sizes grow quickly.' });
    }
    if (focus === 'quality' && video.bitDepth && video.bitDepth >= 10) {
      findings.push({ severity: 'info', code: 'HIGH_BIT_DEPTH', message: `${video.bitDepth}-bit video preserves more gradients.` });
    }
  } else {
    findings.push({ severity: 'warning', code: 'NO_VIDEO', message: 'The file has no video stream.' });
  }

  if (facts.audio) {
    const codec = (facts.audio.codec ?? '').toLowerCase();
    const note = NON_BROAD_AUDIO_CODECS[codec];
    if (note) {
      findings.push({ severity: 'warning', code: 'AUDIO_CODEC_COMPAT', message: note });
      recommendations.push('Re-encode audio to AAC for broad support.');
    }
    if ((facts.audio.channels ?? 0) > 2) {
      findings.push({
        severity: 'info',
        code: 'MULTICHANNEL_AUDIO',
        message: `Multichannel audio (${facts.audio.channelLayout ?? `${facts.audio.channels} channels`}).`,
      });
    }
  } else {
    findings.push({ severity: 'info', code: 'NO_AUDIO', message: 'The file has no audio stream.' });
  }

  if (focus === 'size') {
    const large = facts.sizeBytes >= 1024 * 1024 * 1024;
    findings.push({
      severity: 'info',
      code: 'SIZE_REPORT',
      message: `Current size ${formatBytesHuman(facts.sizeBytes)}${large ? ' — consider re-encoding to shrink it.' : '.'}`,
    });
    if (large) recommendations.push('Re-encode at a target bitrate to reduce the size.');
  }

  if (focus === 'compat' && findings.every((finding) => finding.severity === 'info')) {
    findings.push({ severity: 'info', code: 'BROAD_COMPAT', message: 'Streams are broadly compatible; a remux may be enough.' });
  }

  return { file: info.file, format: info.format, summary: summarize(facts), facts, findings, recommendations };
}
