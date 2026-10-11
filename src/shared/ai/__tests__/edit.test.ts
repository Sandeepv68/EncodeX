/**
 * @fileoverview Unit tests for the natural-language editing planner (F18).
 */

import { describe, it, expect } from 'vitest';
import { resolveEdit, type EditContext, type EditIntent } from '../edit';
import { buildTranscript } from '../transcript';

describe('resolveEdit', () => {
  it('keeps an explicit range losslessly', () => {
    const plan = resolveEdit({ durationSeconds: 100 }, { kind: 'keep-range', start: 10, end: 40 });
    expect(plan.valid).toBe(true);
    expect(plan).toMatchObject({ start: 10, end: 40, duration: 30 });
    expect(plan.args).toMatchObject({ startTime: '10.000', endTime: '40.000', copy: true });
  });

  it('keeps the first/last N seconds, clamped to the duration', () => {
    expect(resolveEdit({ durationSeconds: 50 }, { kind: 'keep-first', seconds: 30 })).toMatchObject({ start: 0, end: 30 });
    expect(resolveEdit({ durationSeconds: 50 }, { kind: 'keep-first', seconds: 999 })).toMatchObject({ start: 0, end: 50 });
    expect(resolveEdit({ durationSeconds: 50 }, { kind: 'keep-last', seconds: 20 })).toMatchObject({ start: 30, end: 50 });
  });

  it('rejects an empty range', () => {
    const plan = resolveEdit({ durationSeconds: 100 }, { kind: 'keep-range', start: 40, end: 40 });
    expect(plan.valid).toBe(false);
    expect(plan.issues[0]).toMatch(/empty/i);
  });

  it('rejects an unknown duration', () => {
    const plan = resolveEdit({ durationSeconds: 0 }, { kind: 'keep-first', seconds: 10 });
    expect(plan.valid).toBe(false);
  });

  it('trims an intro at the first scene change', () => {
    const context: EditContext = {
      durationSeconds: 120,
      scenes: [
        { atSeconds: 8, change: 0.5 },
        { atSeconds: 20, change: 0.4 },
      ],
    };
    const plan = resolveEdit(context, { kind: 'remove-intro', maxSeconds: 30 });
    expect(plan).toMatchObject({ valid: true, start: 8, end: 120 });
    expect(plan.rationale[0]).toMatch(/scene change/);
  });

  it('trims an intro at the first speech when there is no scene', () => {
    const transcript = buildTranscript(
      [
        { start: 6, end: 10, text: 'hello' },
        { start: 10, end: 14, text: 'world' },
      ],
      { engine: 'test', durationSeconds: 60 },
    );
    const plan = resolveEdit({ durationSeconds: 60, transcript }, { kind: 'remove-intro' });
    expect(plan).toMatchObject({ valid: true, start: 6, end: 60 });
    expect(plan.rationale[0]).toMatch(/speech/);
  });

  it('leaves the intro in place when there is no boundary in range', () => {
    const plan = resolveEdit({ durationSeconds: 120 }, { kind: 'remove-intro' });
    expect(plan).toMatchObject({ valid: true, start: 0, end: 120 });
    expect(plan.notes[0]).toMatch(/left in place/);
  });

  it('trims an outro at the end of the last speech', () => {
    const transcript = buildTranscript(
      [
        { start: 0, end: 10, text: 'a' },
        { start: 80, end: 88, text: 'bye' },
      ],
      { engine: 'test', durationSeconds: 100 },
    );
    const plan = resolveEdit({ durationSeconds: 100, transcript }, { kind: 'remove-outro' });
    expect(plan).toMatchObject({ valid: true, start: 0, end: 88 });
  });

  it('keeps only speech for remove-silence', () => {
    const transcript = buildTranscript(
      [
        { start: 3, end: 10, text: 'a' },
        { start: 10, end: 95, text: 'b' },
      ],
      { engine: 'test', durationSeconds: 100 },
    );
    const plan = resolveEdit({ durationSeconds: 100, transcript }, { kind: 'remove-silence' });
    expect(plan).toMatchObject({ valid: true, start: 3, end: 95 });
    expect(plan.notes.some((note) => note.includes('gaps between speech'))).toBe(true);
  });

  it('does nothing when silence is below the threshold', () => {
    const transcript = buildTranscript(
      [
        { start: 1, end: 50, text: 'a' },
        { start: 50, end: 99, text: 'b' },
      ],
      { engine: 'test', durationSeconds: 100 },
    );
    const plan = resolveEdit({ durationSeconds: 100, transcript }, { kind: 'remove-silence', minGapSeconds: 5 });
    expect(plan).toMatchObject({ valid: true, start: 0, end: 100 });
    expect(plan.notes[0]).toMatch(/threshold/);
  });

  it('cannot trim silence without transcript timing', () => {
    const intent: EditIntent = { kind: 'remove-silence' };
    const plan = resolveEdit({ durationSeconds: 100 }, intent);
    expect(plan).toMatchObject({ valid: true, start: 0, end: 100 });
    expect(plan.rationale[0]).toMatch(/no speech timing/i);
  });
});
