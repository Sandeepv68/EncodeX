# Batch Queue Controls — Labels & Layout Plan

## Goal

Improve the Batch Queue page toolbar (`BatchControls`) and the encoding options
panel (`BatchEncodingPanel`):

1. Move the action buttons to the top row of the `BatchControls` toolbar.
2. Give every input field in `BatchControls` and `BatchEncodingPanel` its own
   label.
3. Use the same label style already used in the other pages' forms
   (`FieldBox` / `FieldLabel` from `src/renderer/styles/form.styles.ts`).

## Current State

### BatchControls (`src/renderer/components/BatchControls.tsx`)
Grid order (single `Grid container` inside `ControlsPaper`):

| # | Control            | Grid size          | Label today          |
|---|--------------------|--------------------|----------------------|
| 1 | Operation select   | xs12 sm6 md4 lg3   | none                 |
| 2 | Transcoder select  | xs12 sm6 md4 lg3   | none                 |
| 3 | Suffix text field  | xs12 sm6 md4 lg3   | none (placeholder)   |
| 4 | Concurrency select | xs12 sm6 md4 lg3   | MUI `label` prop     |
| 5 | Output dir field   | xs12 sm9 md10      | none (placeholder)   |
| 6 | Browse + overwrite | xs12 sm3 md2       | overwrite checkbox   |
| 7 | Action buttons     | xs12 (last row)    | tooltips only        |

The action buttons are currently on the **last** row.

### BatchEncodingPanel (`src/renderer/components/BatchEncodingPanel.tsx`)
Every field already renders a label, but through a **local** `FieldLabel`
(rendered as `Typography`, not bold, not a real `<label>`) and a local
`FieldBox` defined in `src/renderer/styles/BatchEncodingPanel.styles.ts`. These
do not match the shared form-label style used elsewhere.

### Shared label style (`src/renderer/styles/form.styles.ts`)
- `FieldBox` — flex wrapper for one labeled field.
- `FieldLabel` — a real `<label>` element: `display: block`, bold 12px,
  `text.secondary` color, `marginBottom: 0.5`. Supports `htmlFor` association.
- Used by `Convert.tsx`, `AudioExtract.tsx`, `ImageCompress.tsx`,
  `VideoCut.tsx`, and `FormField.tsx`.

## New Keys

Add to the `batchQueue` section of every locale file
(`src/renderer/i18n/locales/*.json`, enforced by `validate:locales`):

- `batchQueue.operation` → `"Operation"`
- `batchQueue.outputDir` → `"Output folder"`

Reused existing keys (already present in all locales, translated):
- `batchQueue.suffix` → `"Suffix"` (label; placeholder removed)
- `batchQueue.concurrency` → `"Parallel jobs"`
- `batchQueue.detailsTranscoder` → `"Transcoder"`

## Changes

### 1. BatchControls layout (buttons to the top)
Move the action-buttons `<Grid size={12}>` to be the **first** child of the
`Grid container`, so the toolbar reads:

1. Action buttons (top row)
2. Operation
3. Transcoder
4. Suffix
5. Concurrency
6. Output folder + Browse + overwrite

### 2. BatchControls labels
Wrap each control in `FieldBox` + `FieldLabel` (from `../styles/form.styles`),
associating each label with its input via `id` / `htmlFor`:

- Operation: label `batchQueue.operation`, id `batch-operation`
- Transcoder: label `batchQueue.detailsTranscoder`, id `batch-transcoder`
- Suffix: label `batchQueue.suffix`, id `batch-suffix` (drop the placeholder)
- Concurrency: label `batchQueue.concurrency`, id `batch-concurrency`
  (drop the MUI `label` prop — the FieldLabel replaces it)
- Output folder: label `batchQueue.outputDir`, id `batch-output-dir`
  (keep the existing placeholder)

### 3. BatchEncodingPanel labels
Swap the local `FieldBox` / `FieldLabel` for the shared ones from
`../styles/form.styles`. Remove the now-unused `FieldBox` / `FieldLabel`
exports from `BatchEncodingPanel.styles.ts` (keep `EncodingPaper`,
`EncodingTitle`). Field order and markup stay the same.

### 4. Tests
- `BatchControls.test.tsx`: suffix assertions move from
  `getByPlaceholderText` to `getByLabelText('batchQueue.suffix')`; label
  presence assertions updated for the new labels.
- `BatchEncodingPanel.test.tsx`: no structural change expected (labels were
  already present); verify still green.
- `BatchQueue.test.tsx`: relies on `combobox` order — unchanged since the
  select order is preserved.

## Checkpoints & Completion Status

| # | Checkpoint                                                     | Status |
|---|----------------------------------------------------------------|--------|
| C1 | Plan file written with checkpoints                             | ✅ Done |
| C2 | New i18n keys added to all 56 locale files; `validate:locales` passes | ✅ Done |
| C3 | `BatchControls` action buttons moved to the top row             | ✅ Done |
| C4 | `BatchControls` fields wrapped with `FieldLabel`/`FieldBox`     | ✅ Done |
| C5 | `BatchEncodingPanel` uses shared `FieldLabel`/`FieldBox` style  | ✅ Done |
| C6 | Tests updated and passing (`BatchControls`, `BatchEncodingPanel`, `BatchQueue`) | ✅ Done |
| C7 | Typecheck passes; prettier format check clean                   | ✅ Done |
