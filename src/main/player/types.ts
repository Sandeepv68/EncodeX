/**
 * @fileoverview Type definitions for the FFmpeg frame/audio decoder.
 * Defines the decoded frame and audio structures emitted by the FrameDecoder
 * as well as the configuration objects used to control decoding. These types
 * are shared between the FrameDecoder implementation and its callers in the
 * player layer (renderer preview window and timeline scrubber).
 */

/**
 * A decoded video frame with presentation timestamp.
 *
 * Represents one raw, uncompressed video frame produced by the FrameDecoder.
 * The pixel data is always RGB24 (3 bytes per pixel) so it can be blitted
 * directly into an HTML canvas without further color-space conversion.
 * @interface DecodedFrame
 * @property {Buffer} buffer - Raw RGB24 pixel data, `width * height * 3` bytes long
 * @property {number} width - Frame width in pixels
 * @property {number} height - Frame height in pixels
 * @property {number} pts - Presentation timestamp in seconds, either parsed from
 *   the ffmpeg `showinfo` filter or estimated monotonically on emergency flushes
 * @property {number} generation - Decoder generation ID for cache invalidation;
 *   increments on every (re)spawn of the ffmpeg process, letting consumers discard
 *   frames that belong to a previous seek/open session
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
 *
 * Represents a fixed-size block of raw PCM audio produced by the FrameDecoder.
 * The data is always signed 16-bit little-endian (S16LE) interleaved samples,
 * sized so that each chunk spans roughly `AUDIO_CHUNK_SECONDS` of audio.
 * @interface DecodedAudio
 * @property {Buffer} buffer - Raw S16LE PCM audio data
 * @property {number} sampleRate - Sample rate in Hz (as requested via AudioDecodeConfig)
 * @property {number} channels - Number of audio channels (1 = mono, 2 = stereo, etc.)
 * @property {number} generation - Decoder generation ID for cache invalidation;
 *   matches the generation of the ffmpeg process that produced the chunk
 */
export interface DecodedAudio {
  buffer: Buffer;
  sampleRate: number;
  channels: number;
  generation: number;
}

/**
 * Audio decoding configuration.
 *
 * Controls the shape of the PCM stream ffmpeg is asked to emit. The FFmpeg
 * process is instructed to resample the source audio to these exact values,
 * so the consumer can rely on a fixed byte size per sample (`2` bytes) and
 * per second (`sampleRate * channels * 2`).
 * @interface AudioDecodeConfig
 * @property {number} sampleRate - Requested audio sample rate in Hz (e.g. 48000)
 * @property {number} channels - Requested number of audio channels (e.g. 2)
 */
export interface AudioDecodeConfig {
  sampleRate: number;
  channels: number;
}

/**
 * Options for the frame decoder.
 *
 * Controls the behavior of a decode session. All properties are optional; the
 * decoder fills in defaults (`realtime: true`, `audioOnly: false`,
 * `fpsCap: 0`). Note that the raw ffmpeg command-line arguments used for
 * video filtering are decided here, not in the type.
 * @interface FrameDecoderOptions
 * @property {boolean} [realtime=true] - Enable realtime mode (`-re` flag), which
 *   makes ffmpeg read input at its natural rate instead of as fast as possible
 * @property {boolean} [audioOnly=false] - Decode the audio stream only; when true
 *   no video frame pipe is opened and no `frame` events are emitted
 * @property {number} [fpsCap=0] - Cap decoded video frame rate via the `fps`
 *   video filter (e.g. 30); a value of 0 disables the cap
 */
export interface FrameDecoderOptions {
  realtime?: boolean;
  audioOnly?: boolean;
  fpsCap?: number;
}
