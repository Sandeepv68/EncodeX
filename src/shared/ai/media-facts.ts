/**
 * @fileoverview Reduces a full media probe into the compact {@link MediaFacts}
 * a planner is allowed to see (roadmap §7.2 — grounding, not guessing).
 *
 * This is deterministic code, not a model call: it selects the primary video
 * and audio streams, classifies HDR and interlacing, and drops everything a
 * provider has no business reading (raw tags, per-stream bit fields).
 */

import type { MediaInfo, MediaStreamInfo } from '../types';
import type { MediaFacts, MediaFactsAudio, MediaFactsVideo } from './types';

/** Transfer characteristics that mark an HDR (PQ / HLG) signal. */
const HDR_TRANSFERS = new Set(['smpte2084', 'arib-std-b67']);

/**
 * True when a video stream carries high-dynamic-range metadata, judged by its
 * transfer characteristic, BT.2020 primaries, or a 10/12-bit pixel format.
 * @param {MediaStreamInfo} stream - The video stream to inspect.
 * @returns {boolean} True when the stream is HDR.
 */
function isHdr(stream: MediaStreamInfo): boolean {
  const transfer = (stream.colorTransfer ?? '').toLowerCase();
  if (HDR_TRANSFERS.has(transfer)) return true;
  if ((stream.colorPrimaries ?? '').toLowerCase() === 'bt2020') return true;
  const pixelFormat = (stream.pixelFormat ?? '').toLowerCase();
  if (/p(?:010|10|012|12)le?$/.test(pixelFormat) || /p(?:010|10|012|12)$/.test(pixelFormat)) return true;
  return (stream.bitDepth ?? 0) >= 10;
}

/**
 * True when a stream's disposition marks it as attached cover art rather than a
 * playable video track.
 * @param {MediaStreamInfo} stream - The stream to inspect.
 * @returns {boolean} True for cover-art streams.
 */
function isAttachedPicture(stream: MediaStreamInfo): boolean {
  return (stream.disposition ?? []).includes('attached_pic');
}

/**
 * Picks the primary playable video stream, ignoring attached cover art.
 * @param {MediaStreamInfo[]} streams - All probed streams.
 * @returns {MediaStreamInfo | undefined} The primary video stream, if any.
 */
function primaryVideo(streams: MediaStreamInfo[]): MediaStreamInfo | undefined {
  const videos = streams.filter((stream) => stream.type === 'video');
  return videos.find((stream) => !isAttachedPicture(stream)) ?? videos[0];
}

/**
 * Projects a probed video stream into {@link MediaFactsVideo}.
 * @param {MediaStreamInfo} stream - The primary video stream.
 * @returns {MediaFactsVideo} The compact video facts.
 */
function toVideoFacts(stream: MediaStreamInfo): MediaFactsVideo {
  const fieldOrder = (stream.fieldOrder ?? '').toLowerCase();
  const interlaced = fieldOrder !== '' && fieldOrder !== 'progressive' && fieldOrder !== 'unknown';
  return {
    codec: stream.codec,
    width: stream.width,
    height: stream.height,
    frameRate: stream.frameRate ?? stream.avgFrameRate,
    pixelFormat: stream.pixelFormat,
    bitDepth: stream.bitDepth,
    hdr: isHdr(stream),
    colorTransfer: stream.colorTransfer,
    colorPrimaries: stream.colorPrimaries,
    colorSpace: stream.colorSpace,
    interlaced,
  };
}

/**
 * Projects a probed audio stream into {@link MediaFactsAudio}.
 * @param {MediaStreamInfo} stream - The primary audio stream.
 * @returns {MediaFactsAudio} The compact audio facts.
 */
function toAudioFacts(stream: MediaStreamInfo): MediaFactsAudio {
  return {
    codec: stream.codec,
    channels: stream.channels,
    channelLayout: stream.channelLayout,
    sampleRate: stream.sampleRate,
    bitrate: stream.bitrate,
  };
}

/**
 * Builds the {@link MediaFacts} a provider may read from a full probe.
 * @param {MediaInfo} info - The probed media info.
 * @returns {MediaFacts} Compact, structured facts.
 */
export function extractMediaFacts(info: MediaInfo): MediaFacts {
  const streams = Array.isArray(info.streams) ? info.streams : [];
  const video = primaryVideo(streams);
  const audio = streams.find((stream) => stream.type === 'audio');
  const facts: MediaFacts = {
    file: info.file,
    format: info.format,
    sizeBytes: Number(info.size) || 0,
    durationSeconds: Number(info.duration) || 0,
    overallBitrate: info.bitrate || undefined,
    hasVideo: video !== undefined,
    hasAudio: audio !== undefined,
    subtitleCount: streams.filter((stream) => stream.type === 'subtitle').length,
  };
  if (video) facts.video = toVideoFacts(video);
  if (audio) facts.audio = toAudioFacts(audio);
  return facts;
}
