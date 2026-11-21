/**
 * @fileoverview Zod schemas for persisted automation definitions and imports.
 *
 * Used on load, save, and import so untrusted JSON never reaches native code
 * unvalidated. Parsing returns the canonical `AutomationDefinition` type.
 */

import * as z from 'zod';
import type {
  AutomationCancelRequest,
  AutomationDefinition,
  AutomationDuplicateRequest,
  AutomationExport,
  AutomationRuntime,
  AutomationStartRequest,
  AutomationStore,
} from './types';
import { AUTOMATION_NODE_KINDS } from './node-kinds';
import { AUTOMATION_BACKENDS } from './defaults';
import { AUTOMATION_LIMITS, isBoundedAutomationJsonValue } from './limits';

const requiredText = (max: number): z.ZodString => z.string().min(1).max(max);
const optionalText = (max: number): z.ZodOptional<z.ZodString> => z.string().max(max).optional();
const timestampSchema = z.number().finite().min(0).max(AUTOMATION_LIMITS.maxTimestamp);

function isRelativeAutomationTempRoot(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length === 0 || /^[a-zA-Z]:/.test(normalized) || normalized.includes('\0')) return false;
  const segments = normalized.split(/[\\/]+/);
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

/** Schema for the reusable conversion options payload. */
export const conversionOptionsSchema = z
  .record(z.string(), z.unknown())
  .refine(isBoundedAutomationJsonValue, { message: 'Conversion options exceed the automation JSON bounds' });

/** Schema for a canvas position. */
export const automationPositionSchema = z.object({
  x: z.number().finite().min(-AUTOMATION_LIMITS.maxPositionMagnitude).max(AUTOMATION_LIMITS.maxPositionMagnitude),
  y: z.number().finite().min(-AUTOMATION_LIMITS.maxPositionMagnitude).max(AUTOMATION_LIMITS.maxPositionMagnitude),
});

/** Schema for the discriminated node data union. */
export const automationNodeDataSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('input'),
    path: optionalText(AUTOMATION_LIMITS.maxStringLength),
    mediaKind: z.enum(['video', 'audio', 'image', 'unknown']).optional(),
  }),
  z.object({ kind: z.literal('stage'), name: requiredText(AUTOMATION_LIMITS.maxStringLength) }),
  z.object({
    kind: z.enum(['transcode', 'extractAudio', 'cut', 'remux', 'demux', 'compressImage']),
    backend: z.enum(AUTOMATION_BACKENDS as [string, ...string[]]).optional(),
    options: conversionOptionsSchema,
    outputTemplate: optionalText(AUTOMATION_LIMITS.maxStringLength),
  }),
  z.object({
    kind: z.literal('output'),
    path: z.string().max(AUTOMATION_LIMITS.maxStringLength),
    extension: optionalText(AUTOMATION_LIMITS.maxStringLength),
  }),
]);

/** Schema for a graph node. */
export const automationNodeSchema = z.object({
  id: requiredText(AUTOMATION_LIMITS.maxStringLength),
  kind: z.enum(AUTOMATION_NODE_KINDS),
  label: requiredText(AUTOMATION_LIMITS.maxNameLength),
  stageId: optionalText(AUTOMATION_LIMITS.maxStringLength),
  position: automationPositionSchema,
  data: automationNodeDataSchema,
});

/** Schema for a graph edge. */
export const automationEdgeSchema = z.object({
  id: requiredText(AUTOMATION_LIMITS.maxStringLength),
  source: requiredText(AUTOMATION_LIMITS.maxStringLength),
  target: requiredText(AUTOMATION_LIMITS.maxStringLength),
  sourceHandle: optionalText(AUTOMATION_LIMITS.maxStringLength),
  targetHandle: optionalText(AUTOMATION_LIMITS.maxStringLength),
});

/** Schema for a visual graph. */
export const automationGraphSchema = z.object({
  nodes: z.array(automationNodeSchema).max(AUTOMATION_LIMITS.maxNodesPerGraph),
  edges: z.array(automationEdgeSchema).max(AUTOMATION_LIMITS.maxEdgesPerGraph),
});

/** Schema for persisted execution settings. */
export const automationSettingsSchema = z.object({
  defaultBackend: z.enum(AUTOMATION_BACKENDS as [string, ...string[]]),
  tempDirectoryMode: z.enum(['app-data', 'system-temp']),
  keepIntermediateFiles: z.boolean(),
  conflictPolicy: z.enum(['overwrite', 'unique-suffix', 'prompt']),
});

function rejectUnboundedAutomationJson(value: unknown): unknown {
  if (!isBoundedAutomationJsonValue(value)) {
    throw new Error('Automation payload exceeds the automation JSON bounds');
  }
  return value;
}

/** Schema for a versioned automation definition. */
export const automationDefinitionSchema = z.preprocess(
  rejectUnboundedAutomationJson,
  z.object({
    id: requiredText(AUTOMATION_LIMITS.maxIdLength),
    name: requiredText(AUTOMATION_LIMITS.maxNameLength),
    description: z.string().max(AUTOMATION_LIMITS.maxDescriptionLength).optional(),
    version: z.literal(1),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    graph: automationGraphSchema,
    settings: automationSettingsSchema,
  }),
);

/** Schema for the persisted definitions file. */
export const automationStoreSchema = z.preprocess(
  rejectUnboundedAutomationJson,
  z.object({
    version: z.literal(1),
    automations: z.array(automationDefinitionSchema).max(AUTOMATION_LIMITS.maxAutomations),
  }),
);

/** Schema for a portable JSON export. */
export const automationExportSchema = z.preprocess(
  rejectUnboundedAutomationJson,
  z.object({
    format: z.literal('automation'),
    version: z.literal(1),
    exportedAt: timestampSchema,
    automation: automationDefinitionSchema,
  }),
);

/** Schema for the id argument of library operations. */
export const automationIdSchema = requiredText(AUTOMATION_LIMITS.maxIdLength);

/** Schema for runtime overrides supplied at execution time. */
export const automationRuntimeSchema = z
  .strictObject({
    inputPath: optionalText(AUTOMATION_LIMITS.maxStringLength),
    outputPath: optionalText(AUTOMATION_LIMITS.maxStringLength),
    availableBackends: z
      .array(z.enum(AUTOMATION_BACKENDS as [string, ...string[]]))
      .max(AUTOMATION_BACKENDS.length)
      .optional(),
    mediaKind: z.enum(['video', 'audio', 'image', 'unknown']).optional(),
    tempRoot: requiredText(AUTOMATION_LIMITS.maxStringLength)
      .refine(isRelativeAutomationTempRoot, { message: 'Automation temp root must be a relative directory name' })
      .optional(),
  })
  .refine(isBoundedAutomationJsonValue, { message: 'Automation runtime exceeds the automation JSON bounds' });

/** Schema for the duplicate-library argument. */
export const automationDuplicateRequestSchema = z.strictObject({
  id: automationIdSchema,
  name: requiredText(AUTOMATION_LIMITS.maxNameLength).optional(),
});

/** Schema for the start-run IPC request. */
export const automationStartRequestSchema = z.preprocess(
  rejectUnboundedAutomationJson,
  z.strictObject({
    definition: automationDefinitionSchema,
    runtime: automationRuntimeSchema.optional(),
  }),
);

/** Schema for the cancel-run IPC request. */
export const automationCancelRequestSchema = z.preprocess(
  rejectUnboundedAutomationJson,
  z.strictObject({
    runId: automationIdSchema,
  }),
);

function parseBoundedJson(raw: string): unknown {
  if (typeof raw !== 'string' || raw.length > AUTOMATION_LIMITS.maxJsonChars) {
    throw new Error('Automation JSON exceeds the size limit');
  }
  return JSON.parse(raw) as unknown;
}

/** Parses an unknown value into an automation definition, throwing on invalid input. */
export function parseAutomationDefinition(value: unknown): AutomationDefinition {
  return automationDefinitionSchema.parse(value) as AutomationDefinition;
}

/** Parses the persisted definitions file. */
export function parseAutomationStore(value: unknown): AutomationStore {
  return automationStoreSchema.parse(value) as AutomationStore;
}

/** Parses a serialized definitions file within the untrusted-JSON bounds. */
export function parseAutomationStoreJson(raw: string): AutomationStore {
  return parseAutomationStore(parseBoundedJson(raw));
}

/** Parses a portable export envelope. */
export function parseAutomationExport(value: unknown): AutomationExport {
  return automationExportSchema.parse(value) as AutomationExport;
}

/** Parses a serialized portable export within the untrusted-JSON bounds. */
export function parseAutomationExportJson(raw: string): AutomationExport {
  return parseAutomationExport(parseBoundedJson(raw));
}

/** Parses a library-operation id argument. */
export function parseAutomationId(value: unknown): string {
  return automationIdSchema.parse(value) as string;
}

/** Parses a duplicate-library argument. */
export function parseAutomationDuplicateRequest(value: unknown): AutomationDuplicateRequest {
  return automationDuplicateRequestSchema.parse(value) as AutomationDuplicateRequest;
}

/** Parses a start-run IPC request. */
export function parseAutomationStartRequest(value: unknown): AutomationStartRequest {
  return automationStartRequestSchema.parse(value) as AutomationStartRequest;
}

/** Parses a cancel-run IPC request. */
export function parseAutomationCancelRequest(value: unknown): AutomationCancelRequest {
  return automationCancelRequestSchema.parse(value) as AutomationCancelRequest;
}

/** True when an unknown value is a valid automation definition. */
export function isAutomationDefinition(value: unknown): value is AutomationDefinition {
  return automationDefinitionSchema.safeParse(value).success;
}
