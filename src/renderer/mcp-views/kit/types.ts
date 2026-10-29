/**
 * @fileoverview Type definitions for the MCP App view kit.
 * Declares the prop shapes of the shared primitives (card, button, badge,
 * field, progress, steps, table, lists) and the two-step armed-action
 * controller every view uses for destructive actions.
 */

import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ *
 * useArmedAction
 * ------------------------------------------------------------------ */

/** The state of an armed (two-step confirm) action. */
export interface ArmedAction {
  /** True while the action is waiting for its confirming click. */
  armed: boolean;
  /** True while the confirmed action is running. */
  busy: boolean;
  /** Message of the last failure, if any. */
  error?: string;
  /** Handles a click: arms on the first call, runs the action on the second. */
  trigger: () => void;
  /** Disarms the action and clears the error. */
  reset: () => void;
}

/* ------------------------------------------------------------------ *
 * ViewBadge
 * ------------------------------------------------------------------ */

/** Visual tone of a status badge. */
export type ViewBadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';

/** Props of the status badge primitive. */
export interface ViewBadgeProps {
  /** Badge text. */
  children: string;
  /** Visual tone. Defaults to `neutral`. */
  tone?: ViewBadgeTone;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/* ------------------------------------------------------------------ *
 * ViewButton
 * ------------------------------------------------------------------ */

/** Visual variant of a view button. */
export type ViewButtonVariant = 'primary' | 'secondary' | 'danger';

/** Props of the button primitive. */
export interface ViewButtonProps {
  /** Button label. */
  label: string;
  /** Called on every click; armed actions receive the second click only. */
  onClick: () => void;
  /** Visual variant. Defaults to `secondary`. */
  variant?: ViewButtonVariant;
  /** Label shown while the action is armed. */
  confirmLabel?: string;
  /** True while the action is armed. */
  armed?: boolean;
  /** Disables the button. */
  disabled?: boolean;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/* ------------------------------------------------------------------ *
 * ViewCard
 * ------------------------------------------------------------------ */

/** Props of the card primitive. */
export interface ViewCardProps {
  /** Card heading. Rendered as a truncated single line. */
  title?: ReactNode;
  /** Controls rendered on the trailing edge of the header. */
  actions?: ReactNode;
  /** Card body. */
  children: ReactNode;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/* ------------------------------------------------------------------ *
 * ViewDefinitionList
 * ------------------------------------------------------------------ */

/** One label/value row of a definition list. */
export interface ViewDefinitionRow {
  /** Row label. */
  label: string;
  /** Row value; rendered verbatim as text. */
  value: string;
}

/** Props of the definition-list primitive. */
export interface ViewDefinitionListProps {
  /** Rows to render, in order. */
  rows: ViewDefinitionRow[];
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/* ------------------------------------------------------------------ *
 * ViewEmptyState
 * ------------------------------------------------------------------ */

/** Props of the empty-state primitive. */
export interface ViewEmptyStateProps {
  /** Message describing what is being waited for. */
  message: string;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/* ------------------------------------------------------------------ *
 * ViewFactsList
 * ------------------------------------------------------------------ */

/** One fact of the inline fact list. */
export interface ViewFactItem {
  /** Fact name. */
  label: string;
  /** Fact value; rendered verbatim as text. */
  value: string;
}

/** Props of the inline fact-list primitive. */
export interface ViewFactsListProps {
  /** Facts to render, in order. */
  facts: ViewFactItem[];
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/* ------------------------------------------------------------------ *
 * ViewField
 * ------------------------------------------------------------------ */

/** Props of the form-field primitive. */
export interface ViewFieldProps {
  /** Field label. */
  label: string;
  /** Current value. */
  value: string;
  /** Called with the next value whenever the user edits the field. */
  onChange: (value: string) => void;
  /** Input type; defaults to `text`. */
  type?: 'text' | 'number';
  /** Optional placeholder. */
  placeholder?: string;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/* ------------------------------------------------------------------ *
 * ViewFinding
 * ------------------------------------------------------------------ */

/** Severity of an inspector finding. */
export type ViewFindingSeverity = 'info' | 'warning' | 'error';

/** Props of the finding primitive. */
export interface ViewFindingProps {
  /** Severity of the finding. */
  severity: ViewFindingSeverity;
  /** Human-readable severity name shown as the tag. */
  severityLabel: string;
  /** The finding text. */
  message: string;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/* ------------------------------------------------------------------ *
 * ViewProgress
 * ------------------------------------------------------------------ */

/** Props of the progress-track primitive. */
export interface ViewProgressProps {
  /** Completion percentage; clamped to 0-100. */
  percent: number;
  /** Accessible label for the track. */
  label: string;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/* ------------------------------------------------------------------ *
 * ViewSteps
 * ------------------------------------------------------------------ */

/** One numbered step of a step list. */
export interface ViewStep {
  /** Primary text of the step (the tool and its id). */
  primary: string;
  /** Optional secondary text (dependencies, status, output). */
  secondary?: string;
}

/** Props of the step-list primitive. */
export interface ViewStepsProps {
  /** Steps to render, in order. */
  steps: ViewStep[];
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/* ------------------------------------------------------------------ *
 * ViewTable
 * ------------------------------------------------------------------ */

/** Props of the table primitive. */
export interface ViewTableProps {
  /** Column headers. */
  columns: string[];
  /** Rows; each cell is rendered as text. */
  rows: string[][];
  /** Test hook for the host-rendering checks. */
  testId?: string;
}
