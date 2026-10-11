/**
 * @fileoverview Natural-language editing planner (roadmap 2.0, R6 — F18).
 *
 * Resolves a structured {@link EditIntent} (intro/outro/silence trim, or an
 * explicit keep range) against a transcript and/or detected scene boundaries
 * into a single, runnable `cut_video` span. Interpreting the *words* is the
 * model's job (§7.3); turning the chosen intent into exact timestamps is plain
 * deterministic code here, so every decided boundary is explainable and
 * testable without a model or an FFmpeg run. The module never touches the
 * filesystem, matching the Electron-free `src/shared/ai` rule.
 */

import type { Transcript, TranscriptSegment } from './transcript';
import type { SceneBoundary } from './highlight';

/**
 * A structured editing intent. The model maps free text ("cut the sponsor
 * intro") onto one of these kinds; every kind resolves to a single keep-range.
 * @typedef {object} EditIntent
 */
export type EditIntent =
  | { kind: 'remove-intro'; maxSeconds?: number }
  | { kind: 'remove-outro'; maxSeconds?: number }
  | { kind: 'remove-silence'; minGapSeconds?: number }
  | { kind: 'keep-range'; start: number; end: number }
  | { kind: 'keep-first'; seconds: number }
  | { kind: 'keep-last'; seconds: number };

/**
 * The evidence an intent is resolved against. A transcript and/or scene
 * boundaries sharpen the result; a bare `durationSeconds` is always required.
 * @interface EditContext
 * @property {number} durationSeconds - Source duration in seconds.
 * @property {Transcript} [transcript] - Optional speech timing.
 * @property {SceneBoundary[]} [scenes] - Optional scene boundaries.
 */
export interface EditContext {
  durationSeconds: number;
  transcript?: Transcript;
  scenes?: SceneBoundary[];
}

/**
 * A resolved edit: the keep span and the `cut_video` arguments that produce it.
 * @interface EditPlan
 * @property {EditIntent} intent - The intent that was resolved.
 * @property {boolean} valid - False when the span could not be determined.
 * @property {number} start - Keep-span start in seconds.
 * @property {number} end - Keep-span end in seconds.
 * @property {number} duration - Keep-span duration in seconds.
 * @property {Record<string, unknown>} args - `cut_video` arguments.
 * @property {string[]} rationale - Human-readable explanations.
 * @property {string[]} issues - Problems that made the plan invalid.
 * @property {string[]} notes - Caveats that do not block the plan.
 */
export interface EditPlan {
  intent: EditIntent;
  valid: boolean;
  start: number;
  end: number;
  duration: number;
  args: Record<string, unknown>;
  rationale: string[];
  issues: string[];
  notes: string[];
}

/** Default cap (seconds) for an "intro"/"outro" region when none is given. */
const DEFAULT_REGION_SECONDS = 30;

/** Clamps a value into `[0, max]`, coercing non-finite input to 0. */
function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, value));
}

/** Speech segments with a usable, positive duration, ordered by start. */
function speechSegments(context: EditContext): TranscriptSegment[] {
  return (context.transcript?.segments ?? [])
    .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start)
    .slice()
    .sort((a, b) => a.start - b.start);
}

/** The end of the last speech segment, or undefined when there is no speech. */
function lastSpeechEnd(segments: TranscriptSegment[]): number | undefined {
  return segments.length > 0 ? segments[segments.length - 1].end : undefined;
}

/** The start of the first speech segment, or undefined when there is no speech. */
function firstSpeechStart(segments: TranscriptSegment[]): number | undefined {
  return segments.length > 0 ? segments[0].start : undefined;
}

/** Builds a `cut_video` args object for a keep span (lossless by default). */
function cutArgs(start: number, end: number): Record<string, unknown> {
  const args: Record<string, unknown> = { startTime: start.toFixed(3), endTime: end.toFixed(3), copy: true };
  return args;
}

/** Assembles an EditPlan from a candidate span, guarding against `end <= start`. */
function finish(intent: EditIntent, context: EditContext, start: number, end: number, rationale: string[], notes: string[]): EditPlan {
  const duration = context.durationSeconds;
  const s = clamp(start, duration);
  const e = clamp(end, duration);
  if (e <= s) {
    return {
      intent,
      valid: false,
      start: s,
      end: e,
      duration: 0,
      args: {},
      rationale,
      issues: ['The resolved keep range is empty; nothing would remain after the cut.'],
      notes,
    };
  }
  return { intent, valid: true, start: s, end: e, duration: e - s, args: cutArgs(s, e), rationale, issues: [], notes };
}

/**
 * Finds where an intro ends: the first scene boundary within the allowed region,
 * otherwise the start of the first speech (skipping leading music/silence). When
 * neither signal gives a boundary inside the region, the intro is not trimmed.
 * @param {EditContext} context - The edit context.
 * @param {number} maxSeconds - How far in an intro may end.
 * @returns {{ end: number; evidence: string } | undefined} The boundary + why.
 */
function findIntroEnd(context: EditContext, maxSeconds: number): { end: number; evidence: string } | undefined {
  const boundaries = (context.scenes ?? [])
    .map((scene) => scene.atSeconds)
    .filter((at) => at > 0 && at <= maxSeconds)
    .sort((a, b) => a - b);
  if (boundaries.length > 0) {
    return { end: boundaries[0], evidence: `first scene change at ${boundaries[0].toFixed(1)}s` };
  }
  const firstSpeech = firstSpeechStart(speechSegments(context));
  if (firstSpeech !== undefined && firstSpeech > 0 && firstSpeech <= maxSeconds) {
    return { end: firstSpeech, evidence: `speech starts at ${firstSpeech.toFixed(1)}s` };
  }
  return undefined;
}

/**
 * Finds where an outro begins: the end of the last speech segment when it is
 * inside the trailing region and before the end of the file.
 * @param {EditContext} context - The edit context.
 * @param {number} maxSeconds - How far back an outro may start.
 * @returns {{ start: number; evidence: string } | undefined} The boundary + why.
 */
function findOutroStart(context: EditContext, maxSeconds: number): { start: number; evidence: string } | undefined {
  const lastEnd = lastSpeechEnd(speechSegments(context));
  if (lastEnd === undefined) return undefined;
  const earliest = Math.max(0, context.durationSeconds - maxSeconds);
  if (lastEnd >= earliest && lastEnd < context.durationSeconds) {
    return { start: lastEnd, evidence: `speech ends at ${lastEnd.toFixed(1)}s` };
  }
  return undefined;
}

/**
 * Resolves an edit intent against its context into a runnable plan. Deterministic
 * and total: an intent that cannot be resolved returns `valid: false` with an
 * explanation instead of throwing.
 * @param {EditContext} context - Duration and optional transcript/scenes.
 * @param {EditIntent} intent - The structured intent to resolve.
 * @returns {EditPlan} The resolved keep span and `cut_video` arguments.
 */
export function resolveEdit(context: EditContext, intent: EditIntent): EditPlan {
  const duration = Math.max(0, Number(context.durationSeconds) || 0);
  const notes: string[] = [];
  if (duration <= 0) {
    return {
      intent,
      valid: false,
      start: 0,
      end: 0,
      duration: 0,
      args: {},
      rationale: [],
      issues: ['The source duration is unknown; a cut range cannot be derived.'],
      notes,
    };
  }

  switch (intent.kind) {
    case 'keep-range': {
      const rationale = [`Keep the requested range ${intent.start}s–${intent.end}s.`];
      return finish(intent, context, intent.start, intent.end, rationale, notes);
    }
    case 'keep-first': {
      const end = Math.min(intent.seconds, duration);
      return finish(intent, context, 0, end, [`Keep the first ${end}s of the clip.`], notes);
    }
    case 'keep-last': {
      const start = Math.max(0, duration - intent.seconds);
      return finish(intent, context, start, duration, [`Keep the last ${duration - start}s of the clip.`], notes);
    }
    case 'remove-intro': {
      const region = intent.maxSeconds ?? DEFAULT_REGION_SECONDS;
      const found = findIntroEnd(context, region);
      if (!found) {
        notes.push('No scene change or leading speech was found in the intro region; the intro was left in place.');
        return finish(intent, context, 0, duration, ['No intro boundary could be detected; nothing was removed.'], notes);
      }
      return finish(intent, context, found.end, duration, [`Trim the intro up to the ${found.evidence}.`], notes);
    }
    case 'remove-outro': {
      const region = intent.maxSeconds ?? DEFAULT_REGION_SECONDS;
      const found = findOutroStart(context, region);
      if (!found) {
        notes.push('No trailing speech was found in the outro region; the outro was left in place.');
        return finish(intent, context, 0, duration, ['No outro boundary could be detected; nothing was removed.'], notes);
      }
      return finish(intent, context, 0, found.start, [`Trim the outro from the ${found.evidence}.`], notes);
    }
    case 'remove-silence': {
      const segments = speechSegments(context);
      const first = firstSpeechStart(segments);
      const last = lastSpeechEnd(segments);
      if (first === undefined || last === undefined) {
        notes.push('No speech timing was available; leading/trailing silence cannot be identified.');
        return finish(intent, context, 0, duration, ['No speech timing was available; nothing was removed.'], notes);
      }
      const minGap = intent.minGapSeconds ?? 0;
      if (first < minGap && duration - last < minGap) {
        notes.push(`Leading (${first.toFixed(1)}s) and trailing silence are below the ${minGap}s threshold; nothing was removed.`);
        return finish(intent, context, 0, duration, ['No silence exceeded the threshold; nothing was removed.'], notes);
      }
      notes.push('Only leading and trailing silence are trimmed; gaps between speech segments are preserved.');
      return finish(intent, context, first, last, [`Keep speech from ${first.toFixed(1)}s to ${last.toFixed(1)}s.`], notes);
    }
    default: {
      return {
        intent,
        valid: false,
        start: 0,
        end: 0,
        duration: 0,
        args: {},
        rationale: [],
        issues: [`Unsupported edit intent "${(intent as { kind?: string }).kind ?? 'unknown'}".`],
        notes,
      };
    }
  }
}
