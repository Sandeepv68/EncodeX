/**
 * @fileoverview Constants describing the automation node kinds and the
 * executable/media-aware capabilities of each kind.
 */

import type { AutomationNodeKind, AutomationMediaKind } from './types';

/** All node kinds in the canonical automation model. */
export const AUTOMATION_NODE_KINDS = [
  'input',
  'stage',
  'transcode',
  'extractAudio',
  'cut',
  'remux',
  'demux',
  'compressImage',
  'output',
] as const;

/** Operation node kinds that the main-process runner can execute. */
export const EXECUTABLE_AUTOMATION_NODE_KINDS = ['transcode', 'extractAudio', 'cut', 'remux', 'demux', 'compressImage'] as const;

/** Media kinds each executable operation supports. */
export const AUTOMATION_OPERATION_MEDIA_KINDS: Record<(typeof EXECUTABLE_AUTOMATION_NODE_KINDS)[number], readonly AutomationMediaKind[]> = {
  transcode: ['video', 'audio', 'image', 'unknown'],
  extractAudio: ['video', 'audio', 'unknown'],
  cut: ['video', 'audio', 'unknown'],
  remux: ['video', 'audio', 'unknown'],
  demux: ['video', 'audio', 'unknown'],
  compressImage: ['image', 'unknown'],
};

/** True when a node kind is executable by the automation runner. */
export function isExecutableAutomationNodeKind(kind: AutomationNodeKind): boolean {
  return (EXECUTABLE_AUTOMATION_NODE_KINDS as readonly string[]).includes(kind);
}

/** True when an operation supports the supplied media kind. */
export function automationOperationSupportsMedia(kind: AutomationNodeKind, mediaKind: AutomationMediaKind): boolean {
  if (!isExecutableAutomationNodeKind(kind)) return false;
  return AUTOMATION_OPERATION_MEDIA_KINDS[kind as (typeof EXECUTABLE_AUTOMATION_NODE_KINDS)[number]].includes(mediaKind);
}
