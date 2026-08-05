/**
 * @fileoverview Type definitions for the FFmpeg frame/audio decoder.
 * Defines decoded frame and audio structures plus decoder configuration.
 */

/**
 * A decoded video frame with presentation timestamp.
 * @interface DecodedFrame
 * @property {Buffer} buffer - Raw RGB24 pixel data
 * @property {number} width - Frame width in pixels
 * @property {number} height - Frame height in pixels
 * @property {number} pts - Presentation timestamp in seconds
 * @property {number} generation - Decoder generation ID for cache invalidation
 */
export interface DecodedFrame {
  buffer: Buffer;
  width: number;
  height: number;
  pts: number;
  generation: number;
}

/**
 * A decoded audio chunk with sample rate and channel info.
 * @interface DecodedAudio
 * @property {Buffer} buffer - Raw S16LE PCM audio data
 * @property {number} sampleRate - Sample rate in Hz
 * @property {number} channels - Number of audio channels
 * @property {number} generation - Decoder generation ID for cache invalidation
 */
export interface DecodedAudio {
  buffer: Buffer;
  sampleRate: number;
  channels: number;
  generation: number;
}

/**
 * Audio decoding configuration.
 * @interface AudioDecodeConfig
 * @property {number} sampleRate - Requested audio sample rate
 * @property {number} channels - Requested number of channels
 */
export interface AudioDecodeConfig {
  sampleRate: number;
  channels: number;
}

/**
 * Options for the frame decoder.
 * @interface FrameDecoderOptions
 * @property {boolean} [realtime=true] - Enable realtime mode (-re flag)
 * @property {boolean} [audioOnly=false] - Decode audio stream only
 * @property {number} [fpsCap=0] - Cap decoded video frame rate (0 disables)
 */
export interface FrameDecoderOptions {
  realtime?: boolean;
  audioOnly?: boolean;
  fpsCap?: number;
}
