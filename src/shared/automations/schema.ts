/**
 * @fileoverview Zod schemas for persisted automation definitions and imports.
 *
 * Used on load, save, and import so untrusted JSON never reaches native code
 * unvalidated. Parsing returns the canonical `AutomationDefinition` type.
 */

import * as z from 'zod';
import type { AutomationDefinition, AutomationExport } from './types';
import { AUTOMATION_NODE_KINDS } from './node-kinds';
import { AUTOMATION_BACKENDS } from './defaults';

/** Schema for the reusable conversion options payload. */
export const conversionOptionsSchema = z.record(z.string(), z.unknown());

/** Schema for a canvas position. */
export const automationPositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

/** Schema for the discriminated node data union. */
export const automationNodeDataSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('input'),
    path: z.string().optional(),
    mediaKind: z.enum(['video', 'audio', 'image', 'unknown']).optional(),
  }),
  z.object({ kind: z.literal('stage'), name: z.string().min(1) }),
  z.object({
    kind: z.enum(['transcode', 'extractAudio', 'cut', 'remux', 'demux', 'compressImage']),
    backend: z.enum(AUTOMATION_BACKENDS as [string, ...string[]]).optional(),
    options: conversionOptionsSchema,
    outputTemplate: z.string().optional(),
  }),
  z.object({ kind: z.literal('output'), path: z.string(), extension: z.string().optional() }),
]);

/** Schema for a graph node. */
export const automationNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(AUTOMATION_NODE_KINDS),
  label: z.string().min(1),
  stageId: z.string().optional(),
  position: automationPositionSchema,
  data: automationNodeDataSchema,
});

/** Schema for a graph edge. */
export const automationEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

/** Schema for a visual graph. */
export const automationGraphSchema = z.object({
  nodes: z.array(automationNodeSchema),
  edges: z.array(automationEdgeSchema),
});

/** Schema for persisted execution settings. */
export const automationSettingsSchema = z.object({
  defaultBackend: z.enum(AUTOMATION_BACKENDS as [string, ...string[]]),
  tempDirectoryMode: z.enum(['app-data', 'system-temp']),
  keepIntermediateFiles: z.boolean(),
  conflictPolicy: z.enum(['overwrite', 'unique-suffix', 'prompt']),
});

/** Schema for a versioned automation definition. */
export const automationDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.literal(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  graph: automationGraphSchema,
  settings: automationSettingsSchema,
});

/** Schema for the persisted definitions file. */
export const automationStoreSchema = z.object({
  version: z.literal(1),
  automations: z.array(automationDefinitionSchema),
});

/** Schema for a portable JSON export. */
export const automationExportSchema = z.object({
  format: z.literal('automation'),
  version: z.literal(1),
  exportedAt: z.number(),
  automation: automationDefinitionSchema,
});

/** Parses an unknown value into an automation definition, throwing on invalid input. */
export function parseAutomationDefinition(value: unknown): AutomationDefinition {
  return automationDefinitionSchema.parse(value) as AutomationDefinition;
}

/** Parses the persisted definitions file. */
export function parseAutomationStore(value: unknown): { version: 1; automations: AutomationDefinition[] } {
  return automationStoreSchema.parse(value) as { version: 1; automations: AutomationDefinition[] };
}

/** Parses a portable export envelope. */
export function parseAutomationExport(value: unknown): AutomationExport {
  return automationExportSchema.parse(value) as AutomationExport;
}

/** True when an unknown value is a valid automation definition. */
export function isAutomationDefinition(value: unknown): value is AutomationDefinition {
  return automationDefinitionSchema.safeParse(value).success;
}
