export interface CodecContainerInfo {
  extension: string;
  containers: string[];
}

const CONTAINERS: Record<string, CodecContainerInfo> = {
  h264: { extension: 'mp4', containers: ['mp4', 'mkv', 'mov', 'm4v', 'avi', 'ts', 'm2ts', '3gp', 'flv', 'f4v', 'mpg', 'mpeg'] },
  h265: { extension: 'mp4', containers: ['mp4', 'mkv', 'mov', 'm4v', 'ts', 'm2ts'] },
  vp8: { extension: 'webm', containers: ['webm', 'mkv', 'avi'] },
  vp9: { extension: 'webm', containers: ['webm', 'mkv', 'mp4', 'mov', 'avi'] },
  av1: { extension: 'webm', containers: ['webm', 'mkv', 'mp4', 'mov'] },
  theora: { extension: 'ogv', containers: ['ogv', 'ogg', 'mkv'] },
  prores: { extension: 'mov', containers: ['mov', 'mkv'] },
  dnx: { extension: 'mxf', containers: ['mxf', 'mov', 'mkv'] },
  mpeg1: { extension: 'mpg', containers: ['mpg', 'mpeg'] },
  mpeg2: { extension: 'mpg', containers: ['mpg', 'mpeg', 'ts', 'vob', 'm2ts'] },
  mpeg4: { extension: 'avi', containers: ['avi', 'mp4', 'mkv', 'mov', 'wmv', 'asf'] },
  mjpeg: { extension: 'avi', containers: ['avi', 'mpg', 'mpeg', 'mov', 'mkv'] },
  other: { extension: 'mkv', containers: ['mkv', 'mp4', 'mov', 'avi'] },
};

export function classifyVideoCodec(codec?: string): string {
  const c = (codec ?? '').toLowerCase();
  if (c.includes('theora')) return 'theora';
  if (c.includes('av1') || c.includes('libaom') || c.includes('svtav1')) return 'av1';
  if (c.includes('vp9')) return 'vp9';
  if (c.includes('vp8') || c.includes('libvpx')) return 'vp8';
  if (c.includes('prores')) return 'prores';
  if (c.includes('dnxhd') || c.includes('dnxhr')) return 'dnx';
  if (c.includes('mpeg2')) return 'mpeg2';
  if (c.includes('mpeg1')) return 'mpeg1';
  if (c.includes('mjpeg')) return 'mjpeg';
  if (c.includes('mpeg4')) return 'mpeg4';
  if (c.includes('265') || c.includes('hevc')) return 'h265';
  if (c.includes('264') || c.includes('x264')) return 'h264';
  return 'other';
}

export function getVideoCodecContainer(codec?: string): CodecContainerInfo {
  return CONTAINERS[classifyVideoCodec(codec)];
}

export function suggestedExtensionForVideoCodec(codec?: string): string {
  return getVideoCodecContainer(codec).extension;
}

export function isExtensionCompatibleWithVideoCodec(extension: string, codec?: string): boolean {
  const ext = extension.toLowerCase().replace(/^\./, '');
  return getVideoCodecContainer(codec).containers.includes(ext);
}

const AUDIO_CONTAINERS: Record<string, string> = {
  aac: 'm4a',
  libfdk_aac: 'm4a',
  libmp3lame: 'mp3',
  libshine: 'mp3',
  libtwolame: 'mp2',
  ac3: 'ac3',
  eac3: 'eac3',
  truehd: 'mka',
  dts: 'dts',
  mlp: 'mlp',
  flac: 'flac',
  alac: 'm4a',
  libwavpack: 'wv',
  libvorbis: 'ogg',
  libopus: 'opus',
  libspeex: 'spx',
  libvo_amrwbenc: 'amr',
  pcm_s16le: 'wav',
  pcm_s24le: 'wav',
  pcm_f32le: 'wav',
  pcm_s16be: 'wav',
  pcm_u8: 'wav',
  pcm_alaw: 'wav',
  pcm_mulaw: 'wav',
  wmav1: 'wma',
  wmav2: 'wma',
  adpcm_ima_wav: 'wav',
};

export function suggestedExtensionForAudioCodec(codec?: string): string {
  if (!codec) return '';
  return AUDIO_CONTAINERS[codec] ?? '';
}

export function getExtension(path?: string): string {
  const match = /\.([^./\\]+)$/.exec(path ?? '');
  return match ? match[1].toLowerCase() : '';
}

export function replaceExtension(path: string, newExtension: string): string {
  const ext = newExtension.replace(/^\./, '');
  return path.replace(/\.[^./\\]+$/, `.${ext}`);
}
