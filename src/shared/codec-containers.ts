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

export function getExtension(path?: string): string {
  const match = /\.([^./\\]+)$/.exec(path ?? '');
  return match ? match[1].toLowerCase() : '';
}

export function replaceExtension(path: string, newExtension: string): string {
  const ext = newExtension.replace(/^\./, '');
  return path.replace(/\.[^./\\]+$/, `.${ext}`);
}
