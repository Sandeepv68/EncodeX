/**
 * @fileoverview Deterministic encoding advisor (roadmap R2 / F7).
 *
 * Picks a target video codec and whether to use the GPU, using the real encoder
 * and hwaccel capabilities detected on this machine (see `capabilities.ts`).
 * Every recommendation is code, never a model call (roadmap §7.3), and states
 * the trade-offs honestly: hardware encoders are faster but usually lose some
 * quality or size efficiency versus their software counterparts.
 */

import type { EncoderCapabilities } from '../types';
import type { AnalysisFinding, MediaFacts } from './types';
import { codecFamily } from './recommend';
import { detectHardwareAcceleration } from './estimate';

/**
 * The advisor's recommendation plus the reasoning behind it.
 * @interface EncodingAdvice
 * @property {string} sourceCodecFamily - Normalized source codec family.
 * @property {string} recommendedVideoCodec - Encoder to use (software or GPU).
 * @property {boolean} useHardware - Whether a GPU encoder is recommended.
 * @property {string} [hardwareMethod] - The chosen hardware method, when used.
 * @property {string[]} rationale - Human-readable reasons, one per line.
 * @property {AnalysisFinding[]} findings - Ordered, plain-language findings.
 * @property {string[]} notes - Assumptions and caveats.
 * @property {{ available: boolean; methods: string[] }} hardware - Availability.
 */
export interface EncodingAdvice {
  sourceCodecFamily: string;
  recommendedVideoCodec: string;
  useHardware: boolean;
  hardwareMethod?: string;
  rationale: string[];
  findings: AnalysisFinding[];
  notes: string[];
  hardware: { available: boolean; methods: string[] };
}

/** Software encoder per codec family. */
const SOFTWARE_ENCODERS: Record<string, string> = {
  h264: 'libx264',
  hevc: 'libx265',
  vp9: 'libvpx-vp9',
  av1: 'libaom-av1',
};

/**
 * The software encoder for a codec family, defaulting to libx264.
 * @param {string} family - Codec family.
 * @returns {string} The software encoder name.
 */
function softwareEncoder(family: string): string {
  return SOFTWARE_ENCODERS[family] ?? 'libx264';
}

/**
 * Finds a hardware encoder matching a codec family in the detected encoders.
 * @param {string} family - Codec family (e.g. 'h264').
 * @param {EncoderCapabilities} capabilities - Detected capabilities.
 * @returns {string | undefined} The hardware encoder name, when present.
 */
function hardwareEncoder(family: string, capabilities: EncoderCapabilities): string | undefined {
  const aliases = family === 'hevc' ? ['hevc', 'h265'] : [family];
  return (capabilities.videoEncoders ?? []).find((encoder) => {
    const lower = encoder.toLowerCase();
    const marker = ['nvenc', 'qsv', 'amf', 'videotoolbox', 'vaapi', 'v4l2m2m', '_mf', 'mf_'].some((m) => lower.includes(m));
    return marker && aliases.some((alias) => lower.includes(alias));
  });
}

/**
 * Advises a target encoder using the source facts and the real hardware caps.
 * @param {MediaFacts} facts - Source media facts.
 * @param {EncoderCapabilities} capabilities - Detected encoder capabilities.
 * @returns {EncodingAdvice} The recommendation and reasoning.
 */
export function adviseEncoding(facts: MediaFacts, capabilities: EncoderCapabilities): EncodingAdvice {
  const hardware = detectHardwareAcceleration(capabilities);
  const sourceCodec = facts.video?.codec ?? '';
  const family = codecFamily(sourceCodec);
  const rationale: string[] = [];
  const findings: AnalysisFinding[] = [];
  const notes: string[] = [];

  const gpuEncoder = hardwareEncoder(family, capabilities);
  const useHardware = Boolean(gpuEncoder);
  const recommendedVideoCodec = gpuEncoder ?? softwareEncoder(family);

  rationale.push(`Source video codec is ${sourceCodec || 'unknown'} (${family} family).`);
  if (useHardware && gpuEncoder) {
    rationale.push(`Using the detected hardware encoder ${gpuEncoder} will be substantially faster.`);
    findings.push({ severity: 'info', code: 'hardware_encoder_available', message: `Hardware encoder available: ${gpuEncoder}.` });
    notes.push('Hardware encoders are faster but can produce a slightly larger file or lower quality at the same bitrate than libx264/libx265.');
  } else if (hardware.available) {
    rationale.push(`Hardware acceleration is available (${hardware.methods.join(', ')}) but no ${family} GPU encoder was detected; using the software encoder.`);
    findings.push({ severity: 'info', code: 'hardware_available_no_match', message: `Hardware acceleration exists (${hardware.methods.join(', ')}), but not for ${family}.` });
  } else {
    rationale.push('No hardware encoder was detected; using the software encoder.');
    findings.push({ severity: 'info', code: 'software_only', message: 'No hardware encoder detected; encoding will use the CPU.' });
  }

  if (facts.video?.hdr) {
    findings.push({ severity: 'warning', code: 'hdr_source', message: 'The source is HDR; make sure the target codec and container preserve HDR metadata.' });
    notes.push('HDR will be lost unless the output codec/container carry the color metadata through.');
  }
  if (sourceCodec && family && recommendedVideoCodec.startsWith(family)) {
    notes.push(`Re-encoding ${family} to ${family} is only worthwhile for size or editing changes; a stream copy avoids generational loss.`);
  }

  return {
    sourceCodecFamily: family,
    recommendedVideoCodec,
    useHardware,
    ...(useHardware && gpuEncoder ? { hardwareMethod: gpuEncoder } : {}),
    rationale,
    findings,
    notes,
    hardware,
  };
}
