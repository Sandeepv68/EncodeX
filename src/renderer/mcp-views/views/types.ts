/**
 * @fileoverview Type definitions for the MCP App views.
 * Declares the payload and sub-component prop shapes each view reads from the
 * host and passes to its own building blocks, grouped per view module.
 */

import type {
  McpUiAnalysis,
  McpUiBatchEntry,
  McpUiCapabilities,
  McpUiConfirmation,
  McpUiErrorExplanation,
  McpUiErrorFix,
  McpUiEstimate,
  McpUiJob,
  McpUiLab,
  McpUiMediaInfo,
  McpUiPlan,
  McpUiProfile,
  McpUiWorkflowPlan,
  McpUiWorkflowResult,
} from '../../../shared/mcp-ui';

/* ------------------------------------------------------------------ *
 * BatchView
 * ------------------------------------------------------------------ */

/** Payload the batch view receives from the host. */
export interface BatchPayload {
  confirmation?: McpUiConfirmation;
  jobs?: McpUiBatchEntry[];
  total?: number;
}

/** Props of the batch dashboard row. */
export interface BatchRowProps {
  entry: McpUiBatchEntry;
}

/* ------------------------------------------------------------------ *
 * CapabilitiesView
 * ------------------------------------------------------------------ */

/** Payload the capabilities view receives from the host. */
export interface CapabilitiesPayload {
  capabilities?: McpUiCapabilities;
}

/* ------------------------------------------------------------------ *
 * ConfirmView
 * ------------------------------------------------------------------ */

/** Payload the confirmation view receives from the host. */
export interface ConfirmPayload {
  confirmation?: McpUiConfirmation;
  job?: McpUiJob;
  jobs?: Array<{ id?: string; output?: string; file?: string; jobId?: string; status?: string }>;
}

/** Props of the button that commits the confirmed operation. */
export interface ConfirmRunButtonProps {
  operation: string;
  args: Record<string, unknown>;
  onError: (message: string) => void;
}

/** Props of the progress card shown after the operation was committed. */
export interface JobProgressCardProps {
  job: McpUiJob;
}

/* ------------------------------------------------------------------ *
 * ConvertView
 * ------------------------------------------------------------------ */

/** Payload the convert view receives from the host. */
export interface ConvertPayload {
  confirmation?: McpUiConfirmation;
  job?: McpUiJob;
}

/** The editable settings of the conversion form. */
export interface ConvertForm {
  input: string;
  output: string;
  videoCodec: string;
  audioCodec: string;
  videoBitrate: string;
  audioBitrate: string;
  qscale: string;
  scale: string;
  copy: boolean;
}

/* ------------------------------------------------------------------ *
 * ErrorView
 * ------------------------------------------------------------------ */

/** Payload the error view receives from the host. */
export interface ErrorPayload {
  error?: McpUiErrorExplanation;
}

/** Props of a single suggested fix row. */
export interface FixRowProps {
  fix: McpUiErrorFix;
}

/* ------------------------------------------------------------------ *
 * InspectorView
 * ------------------------------------------------------------------ */

/** Payload the inspector view receives from the host. */
export interface InspectorPayload {
  analysis?: McpUiAnalysis;
}

/* ------------------------------------------------------------------ *
 * JobView
 * ------------------------------------------------------------------ */

/** Payload the job view receives from the host. */
export interface JobPayload {
  job?: McpUiJob;
}

/** Props of the armed cancel action of the job view. */
export interface JobCancelButtonProps {
  jobId: string;
  onCancel: (jobId: string) => Promise<void>;
}

/* ------------------------------------------------------------------ *
 * LabView
 * ------------------------------------------------------------------ */

/** Payload the lab view receives from the host. */
export interface LabPayload {
  lab?: McpUiLab;
}

/* ------------------------------------------------------------------ *
 * MediaInfoView
 * ------------------------------------------------------------------ */

/** Payload the media-info view receives from the host. */
export interface MediaInfoPayload {
  media?: McpUiMediaInfo;
}

/* ------------------------------------------------------------------ *
 * PlanView
 * ------------------------------------------------------------------ */

/** Payload the plan view receives from the host. */
export interface PlanPayload {
  plan?: McpUiPlan;
  estimate?: McpUiEstimate;
}

/** Props of the recommended-settings card. */
export interface PlanCardProps {
  plan: McpUiPlan;
}

/** Props of the size-estimate card. */
export interface EstimateCardProps {
  estimate: McpUiEstimate;
}

/* ------------------------------------------------------------------ *
 * ProfilesView
 * ------------------------------------------------------------------ */

/** Payload the profiles view receives from the host. */
export interface ProfilesPayload {
  profiles?: McpUiProfile[];
}

/* ------------------------------------------------------------------ *
 * QueueView
 * ------------------------------------------------------------------ */

/** Payload the queue view receives from the host. */
export interface QueuePayload {
  jobs?: McpUiJob[];
}

/** Props of a single queue row. */
export interface QueueRowProps {
  job: McpUiJob;
  onCancel: (jobId: string) => Promise<void>;
}

/* ------------------------------------------------------------------ *
 * WorkflowView
 * ------------------------------------------------------------------ */

/** Payload the workflow view receives from the host. */
export interface WorkflowPayload {
  plan?: McpUiWorkflowPlan;
  result?: McpUiWorkflowResult;
}

/** Props of the workflow plan card. */
export interface WorkflowPlanCardProps {
  plan: McpUiWorkflowPlan;
}

/** Props of the workflow run report card. */
export interface ResultCardProps {
  result: McpUiWorkflowResult;
}
