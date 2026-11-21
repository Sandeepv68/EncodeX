# Automations Feature Plan — Visual Media Pipelines for EncodeX

> **Status:** In progress — Phase 0, Phase 1, Phase 2, and Phase 3 implemented (runtime engine complete); Phase 4 not started
> **Last updated:** 2026-11-21
> **Owner:** EncodeX core
> **Related docs:** [`ARCHITECTURE.md`](ARCHITECTURE.md), [`ARCHITECTURE_PROCESSES.md`](ARCHITECTURE_PROCESSES.md), [`ARCHITECTURE_RENDERER.md`](ARCHITECTURE_RENDERER.md), [`ARCHITECTURE_TRANSCODERS.md`](ARCHITECTURE_TRANSCODERS.md), [`IPC.md`](IPC.md), [`FEATURES.md`](FEATURES.md), [`TESTING.md`](TESTING.md), [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md)

---

## Implementation Progress

| Phase | Status | Progress |
|---|---|---|
| Phase 0 — Foundation | **Complete** | `@xyflow/react` installed; shared automation model, defaults, references, validator, compiler, zod schema, and progress-event guard implemented with 42 passing unit tests. IPC channel constants intentionally deferred to the IPC-wiring phase (see note below). |
| Phase 1 — Page shell and static editor | **Complete** | `/automations` route/nav/icon/skeleton/i18n and React Flow editor implemented with in-memory store, palette/canvas/inspector/toolbar/stage list/run panel/library drawer, validation display, and local run placeholder. |
| Phase 2 — Save/load library | **Complete** | Persisted definition library with seven IPC channels, atomic JSON storage plus backup recovery, bounded schema validation, native import/export, Save As/Duplicate, dirty state, and toast feedback. |
| Phase 3 — Runtime engine | **Complete** | Sequential main-process runner, FFmpeg/FFTool/BMF step execution, five runtime IPC channels, progress/status events, cancellation, run-scoped temp files, and renderer start/cancel wiring. |
| Phase 4 — Run UX and cascading stages | Not started | — |
| Phase 5 — Hardening and release | Not started | — |

### Phase 0 notes and deviations

- Added supporting types not enumerated in §4.2: `AutomationIssue`, `AutomationReference`, `AutomationPlan`, `AutomationRuntime`, and `AutomationExport` (§10.1 and §7.3 already imply them).
- `AutomationBackend` is derived from the existing `TRANSCODER_TYPES` constant instead of duplicating the union.
- Intermediate step paths currently use a deterministic `step-NNN-<nodeId>.bin` template under `automations/`; the final step writes the resolved output-node path.
- The 12 `AUTOMATION_*` IPC channel constants are **not** added yet. The existing `channel-contract` test requires every `IPC` value to be registered in main and exposed in preload/typings; adding unregistered constants now would break CI. The `AutomationProgressEvent` type and `isAutomationProgressEvent` guard are already in place in `src/shared/ipc-guards.ts`.
- Added `src/shared/automations/index.ts` as a public barrel for the model.
- Verification completed for Phase 0: `npm run audit:gate`, `npm run typecheck`, `npm run lint`, `npm run lint:types`, `npm run format:check`, `npm test` (**368 files / 5438 tests passing**), and `npm run doc:drift` all pass. The doc-drift `test-files` markers were synced from 375 to 379 across docs/wiki/site.

### Phase 1 notes and deviations

- Added exported prop/type modules (`*.types.ts`) alongside stores, hooks, styles, and automation components to satisfy the renderer `no-local-types` lint rule.
- The Phase 1 store is in-memory only. Save/Open/Load actions operate on renderer state; persistent library, Save As, Duplicate, Import, and Export are deferred to Phase 2.
- Run/Cancel is a renderer-local placeholder with run records and status updates. Native execution, progress-event subscriptions, and IPC channels remain deferred to Phase 3.
- Input selection uses `openFileDialog()` and writes the path to the input node. Media probing, dynamic operation filtering, and runtime file overrides are deferred to Phase 4.
- Stage reordering is not implemented in the Phase 1 stage list; add/rename/select are available now.
- React Flow CSS is imported as `@xyflow/react/dist/style.css` (the installed package path) rather than the plan's placeholder `reactflow/dist/style.css`.
- Route-count, Dashboard, skeleton, a11y, i18n, hostile-bridge, RTL, longest-string, route-change-stress, and E2E route matrices were updated from 13 to 14 pages.
- `npm run sync:locales` added 64 keys per locale; `validate:locale-usage` reports 1226 base keys with 0 unused and 0 unknown keys, and `validate:locales` reports 55 locales matching en-US.
- Verification completed for Phase 1: `npm run format:check`, `npm run lint`, `npm run lint:types`, `npm run validate:locale-usage`, `npm run validate:locales`, `npm run typecheck`, `npm test -- --reporter=default` (**370 files / 5449 tests passing**), `npm run audit:gate`, and `npm run doc:drift` all pass.
- Doc-drift markers were synced from `test-files=379` to `381`, `renderer-pages=13` to `14`, `renderer-components=72` to `84`, `renderer-stores=21` to `22`, and `renderer-styles=76` to `78`.

### Phase 2 notes and deviations

- Added seven Phase 2 IPC channels (`AUTOMATION_LIST`, `AUTOMATION_GET`, `AUTOMATION_SAVE`, `AUTOMATION_DELETE`, `AUTOMATION_DUPLICATE`, `AUTOMATION_IMPORT`, `AUTOMATION_EXPORT`). Runtime `START`, `CANCEL`, and progress channels remain deferred to Phase 3.
- Added `src/main/automations/store.ts`: versioned JSON persistence under `userData/automations/definitions.json`, atomic writes, `.bak` recovery, bounded definition counts, and size guards.
- Added shared limit constants and stricter schema parsing for every IPC argument, persisted file, and portable import envelope; invalid imports map to `INVALID_AUTOMATION_FILE`.
- Renderer store/hook actions now bridge list/get/save/delete/duplicate/import/export with in-memory fallbacks, in addition to Save As and dirty-state handling.
- Native file dialogs are used for import/export; the renderer shows success/error toasts for every library action.
- `npm run sync:locales` added 23 keys per locale; `validate:locale-usage` reports 1249 base keys with 0 unused and 0 unknown keys, and `validate:locales` reports 55 locales matching en-US.
- Verification completed for Phase 2: `npm run format:check`, `npm run lint`, `npm run lint:types`, `npm run validate:locale-usage`, `npm run validate:locales`, `npm run typecheck`, `npm test -- --reporter=default` (**372 files / 5487 tests passing**), `npm run audit:gate`, and `npm run doc:drift` all pass.

### Phase 3 notes and deviations

- Added five runtime IPC channels (`AUTOMATION_START`, `AUTOMATION_CANCEL`, `AUTOMATION_STATUS`, `AUTOMATION_PROGRESS`, `AUTOMATION_EVENT`) with request schemas, log constants, channel-contract coverage, preload guards, and E2E mock updates.
- Added `src/main/automations/runner.ts`, `step-executors.ts`, `temp-files.ts`, `events.ts`, `types.ts`, and an `index.ts` barrel. The runner validates and compiles definitions again in main, checks BMF availability, executes sequential steps, cancels the active transcoder, forwards status/progress/event pushes, and cleans intermediate files.
- Intermediate outputs are isolated under a per-run temp directory; runtime `tempRoot` overrides are limited to relative directory names and constrained by main to stay inside the app-owned automation temp area.
- Renderer `useAutomations` now subscribes once to runtime events, buffers events emitted before a run record exists, applies runtime input/output/path overrides, and exposes `run`/`startRun` plus `cancel`.
- Strengthened `isAutomationProgressEvent` to reject wrong-typed `message`, `error`, and `outputPath` fields in addition to routing keys, status, progress, and `stageId`.
- `npm run sync:locales` added 5 keys per locale; `validate:locale-usage` reports 1254 base keys with 0 unused and 0 unknown keys, and `validate:locales` reports 55 locales matching en-US.
- Verification completed for Phase 3: `npm run format:check`, `npm run lint`, `npm run lint:types`, `npm run validate:locale-usage`, `npm run validate:locales`, `npm run typecheck`, `npm test -- --reporter=default` (**374 files / 5513 tests passing**), `npm run audit:gate`, `npm run doc:drift` (facts: 26, doc files: 168, markers: 629), and `git diff --check` all pass.

---

## 1. Overview

Add a new **Automations** page that lets users visually build, save, rerun, and monitor multi-stage media processing pipelines. Users will drag nodes onto a React Flow canvas, connect them into stages, configure each operation, choose an input file, run the pipeline through the existing Electron main-process transcoding engine, and save the pipeline for later reuse.

The feature should feel like a media "graph builder":

```text
[Input File]
     |
     v
[Stage 1: Normalize]  -> Transcode (FFmpeg)
     |
     v
[Stage 2: Derive]     -> Extract Audio / Cut / Remux / BMF filter
     |
     v
[Stage 3: Deliver]    -> Transcode / Compress Image -> Output
```

Each stage consumes the output of the previous stage. Users can cascade operations by adding more stages and connecting them.

### 1.1 Goals

- G1. Add an `/automations` route with navigation, icon, skeleton, i18n, and test coverage.
- G2. Provide a React Flow canvas with drag-and-drop node creation and connection drawing.
- G3. Support staged, multi-step media operations with FFmpeg, FFTool, and BMF backends.
- G4. Let users configure each node through an inspector using existing `ConversionOptions`.
- G5. Validate graphs before save and before run.
- G6. Execute pipelines in the Electron main process using existing transcoder/factory code.
- G7. Save, list, load, rerun, import, and export automations.
- G8. Show live per-run, per-stage, and per-node progress in the UI.
- G9. Keep renderer/main security boundaries intact.

### 1.2 Non-goals for the first release

- Free-form scripting or arbitrary shell commands.
- Parallel branch execution; initial runtime is sequential/topological.
- Multi-input joins or complex conditional branching.
- Cloud sync or sharing.
- Replacing the Batch Queue or existing single-file pages.
- Making BMF a required dependency; BMF remains optional and detected at runtime.

---

## 2. Requirement Traceability

| Requirement | Plan coverage |
|---|---|
| 1. New page called Automations | Section 5, Section 11 |
| 2. Area to build, run, save, perform automations | Sections 5, 7, 8, 9 |
| 3. Drag and drop / draw UI using react-flow | Section 5; add `@xyflow/react` |
| 4. Multi-stage video/audio transcoding with ffmpeg, bmf, etc. | Sections 4, 8 |
| 5. Visually build via drag-and-drop node UI | Sections 5, 6 |
| 6. Save automation and rerun later | Sections 7, 9 |
| 7. Stages/operations based on chosen input; cascade more stages | Sections 4, 5, 6, 8 |

---

## 3. Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| React Flow package | `@xyflow/react` | Official current React Flow package for React 19; no React Flow dependency exists today. |
| Route | `/automations` | Consistent with existing route style. |
| UI kit | MUI + Emotion + `.styles.ts` | Matches existing renderer conventions. |
| State | New `automationStore` Zustand store | Matches queue/conversion state patterns. |
| Canonical graph format | Shared, versioned, plain JSON in `src/shared/automations` | Keeps persisted data independent of React Flow view-model and MCP UI types. |
| Execution location | Electron main process only | Renderer must not spawn FFmpeg/BMF or access the filesystem directly. |
| Execution engine | Reuse `ITranscoder`, `createTranscoder()`, backend factory, and media info helpers | Avoids duplicating proven conversion logic. |
| Stage model | Stage nodes group executable operation nodes | Supports visual grouping and ordered cascading stages. |
| Runtime file data flow | Each node consumes a resolved input path and emits an output path | Simple, testable cascade model that fits FFmpeg-style processing. |
| Validation | Pure shared validator, re-run in main before execution | Prevents invalid or hostile graphs from reaching native code. |
| Persistence | Versioned JSON under Electron `userData` | Matches existing queue persistence pattern and survives restarts. |
| Initial scheduling | Sequential topological execution | Deterministic progress/cancellation; parallel branches can be added later. |

---

## 4. Shared Automation Model

### 4.1 New shared module

Create:

```text
src/shared/automations/
├── types.ts
├── node-kinds.ts
├── schema.ts
├── validate.ts
├── compile.ts
├── references.ts
├── defaults.ts
└── __tests__/
```

Keep these types separate from React Flow's `Node`/`Edge` types. The renderer maps between them.

### 4.2 Core types

```ts
export type AutomationNodeKind =
  | 'input'
  | 'stage'
  | 'transcode'
  | 'extractAudio'
  | 'cut'
  | 'remux'
  | 'demux'
  | 'compressImage'
  | 'output';

export type AutomationBackend = 'FFMPEG' | 'FFTOOL' | 'BMF';
export type AutomationRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface AutomationPosition {
  x: number;
  y: number;
}

export interface AutomationNode {
  id: string;
  kind: AutomationNodeKind;
  label: string;
  stageId?: string;
  position: AutomationPosition;
  data: AutomationNodeData;
}

export interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface AutomationGraph {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
}

export interface AutomationDefinition {
  id: string;
  name: string;
  description?: string;
  version: 1;
  createdAt: number;
  updatedAt: number;
  graph: AutomationGraph;
  settings: AutomationSettings;
}

export interface AutomationSettings {
  defaultBackend: AutomationBackend;
  tempDirectoryMode: 'app-data' | 'system-temp';
  keepIntermediateFiles: boolean;
  conflictPolicy: 'overwrite' | 'unique-suffix' | 'prompt';
}
```

`AutomationNodeData` is a discriminated union by `kind`. Reuse `ConversionOptions` from `src/shared/types.ts` for operation payloads wherever possible.

### 4.3 Node semantics

| Node kind | Purpose | Executable |
|---|---|---|
| `input` | Chooses source media; may store a default path but supports runtime override | No |
| `stage` | Visual/logical grouping of operations | No |
| `transcode` | Video/audio conversion via selected backend | Yes |
| `extractAudio` | Audio extraction from video | Yes |
| `cut` | Time-range trimming | Yes |
| `remux` | Container remux via mux runner or transcoder backend | Yes |
| `demux` | Stream/container split via mux runner | Yes |
| `compressImage` | Image compression operation | Yes |
| `output` | Final destination/path template | Yes |

### 4.4 Stage and cascade rules

- A stage is a group with a stable `stageId`; operation nodes reference it.
- Edges define media/data flow between executable nodes.
- By default an operation consumes `{{previous.output}}`; explicit references such as `{{transcode1.output}}` and `{{probe1.mediaInfo}}` are also supported.
- The last executable node in a stage becomes the stage output.
- Connecting stage A to stage B automatically maps A's output into B's first operation.
- Adding a node from the palette while a node/stage is selected inserts it downstream by default, so users can quickly cascade operations.

### 4.5 Validation rules

`validateAutomation(definition)` returns stable issues with codes:

- `empty_graph`
- `missing_input`
- `missing_output`
- `duplicate_node_id`
- `invalid_node_kind`
- `invalid_stage_reference`
- `unknown_dependency`
- `self_dependency`
- `cycle`
- `disconnected_node`
- `unsupported_operation_for_media_kind`
- `backend_unavailable`
- `invalid_reference`
- `invalid_output_path_template`
- `missing_required_option`

The validator should reuse algorithms/patterns from `src/shared/ai/workflow.ts` but remain Automations-specific.

### 4.6 Compiler

`compileAutomation(definition, runtime)` produces an executable plan:

```ts
export interface AutomationStep {
  nodeId: string;
  stageId?: string;
  kind: AutomationNodeKind;
  backend?: AutomationBackend;
  inputRef: string;
  outputPath: string;
  options: Record<string, unknown>;
}
```

Compiler responsibilities:

1. Validate the graph.
2. Topologically order executable nodes.
3. Resolve stage boundaries and output references.
4. Resolve runtime input file override.
5. Generate deterministic temporary output paths for intermediate steps.
6. Resolve final output from `output` nodes.
7. Return normalized steps for the main-process runner.

---

## 5. Renderer Page and Editor UI

### 5.1 New route wiring

Add `/automations` to:

- `src/renderer/App.tsx` — lazy import, route, skeleton, error boundary.
- `src/shared/app-constants.ts` — `NAV_ITEMS`.
- `src/renderer/pageIcons.tsx` — route icon.
- `src/renderer/components/PageSkeletons.tsx` — loading skeleton.
- `src/test-utils/page-render.tsx` — `PAGE_ROUTES`.
- Route-count/a11y/i18n/hostile-bridge/E2E route matrices.
- `docs/PROJECT_STRUCTURE.md` drift marker `renderer-pages=14`.
- `docs/ARCHITECTURE_RENDERER.md` page-count text.

### 5.2 New files

```text
src/renderer/pages/Automations.tsx
src/renderer/styles/Automations.styles.ts
src/renderer/components/automations/
├── AutomationCanvas.tsx
├── AutomationToolbar.tsx
├── AutomationNodePalette.tsx
├── AutomationInspector.tsx
├── AutomationStageList.tsx
├── AutomationRunPanel.tsx
├── AutomationLibraryDrawer.tsx
├── nodes/
│   ├── InputNode.tsx
│   ├── StageNode.tsx
│   ├── OperationNode.tsx
│   └── OutputNode.tsx
└── AutomationNode.types.ts
src/renderer/hooks/useAutomations.ts
src/renderer/stores/automationStore.ts
```

### 5.3 Layout

```text
+-------------------------------------------------------------------+
| Automations   [New] [Open] [Save] [Save As] [Import] [Export]       |
|               [Validate] [Run] [Cancel]          [Backend status]  |
+-------------+--------------------------------------+----------------+
| Palette     | React Flow canvas                    | Inspector      |
|             |                                      |                |
| Input       |   [Input] -> [Stage 1] -> [Stage 2]   | Node label     |
| Stages      |                  |                    | Backend        |
| Transcode   |              [Operation nodes]        | Options        |
| Audio       |                                      | Output         |
| Cut         |                                      |                |
| Remux/Demux |                                      |                |
| Output      |                                      |                |
+-------------+--------------------------------------+----------------+
| Stage list / validation issues / run progress console               |
+-------------------------------------------------------------------+
```

### 5.4 Interactions

- Drag a node from the palette onto the canvas to create it.
- Drag from source handles to target handles to draw connections.
- Click a node to edit it in the inspector.
- Add a stage, then add operations into/after that stage.
- Rename stages, reorder them, and inspect stage outputs.
- Choose an input file via existing `FileDropZone` and `openFileDialog()` helpers.
- Probe input media and dynamically enable/disable compatible operations:
  - video input shows video transcode, cut, extract-audio, remux, demux;
  - audio-only input hides video-only options;
  - image input shows compress-image;
  - BMF nodes are disabled with an explanatory message when BMF is unavailable.
- Validate shows issues inline on nodes and in the bottom panel.
- Run streams status/progress back into node badges and stage rows.
- Save persists the graph and settings; Open loads a saved graph; Rerun uses the selected saved automation with a chosen input.

### 5.5 React Flow mapping

- Map `AutomationNode` to React Flow nodes in the store/selectors.
- Store only semantic data in `AutomationDefinition`; React Flow selection and transient drag state stay in renderer state.
- Use custom node components for consistent MUI styling.
- Add `reactflow/dist/style.css` via the Vite entry point or a dedicated style import, following project import conventions.

---

## 6. Dependency and Build Changes

1. Add dependency:

```bash
npm install @xyflow/react
```

2. Update any package allowlists, dependency audit baselines, or license reports if present.
3. Verify React 19 compatibility and Vite build output.
4. Add any required CSP/style allowances only if needed; avoid loosening CSP unnecessarily.
5. Keep app-owned styles compliant with custom ESLint rules:
   - no hardcoded `px`, `rem`, or colors;
   - no inline styles;
   - use theme spacing/typography helpers and centralized color constants.

---

## 7. Persistence and Library Management

### 7.1 Location

Follow the JSON snapshot pattern in `src/main/queue/persistence.ts`.

```text
userData/
└── automations/
    ├── definitions.json
    └── runs.json        # optional run history
```

### 7.2 API

Support:

- list automations
- get one automation
- create/update automation
- delete automation
- duplicate automation
- import/export JSON
- optional run history list/get

### 7.3 File safety

- Version persisted JSON with `{ version: 1, automations: [...] }`.
- Validate with zod schema on load, save, and import.
- Use atomic writes with temp-file + rename and backup recovery.
- Do not blindly trust absolute input/output paths from imported JSON; treat them as untrusted defaults that must be reselected or confirmed before run.
- Imported definitions with missing/unavailable backends load but degrade gracefully.

---

## 8. Main-Process Runtime

### 8.1 New modules

```text
src/main/automations/
├── index.ts
├── runner.ts
├── step-executors.ts
├── temp-files.ts
├── events.ts
├── store.ts
└── __tests__/
```

### 8.2 Execution flow

1. Renderer sends `AutomationDefinition` plus runtime overrides to `AUTOMATION_START`.
2. Main validates and compiles the graph.
3. A new `runId` is created.
4. Runner iterates compiled steps in topological order:
   - resolve input path from prior step output or runtime input;
   - select backend with `createTranscoder()`;
   - create an `EventEmitter` via `ITranscoder.convert()`;
   - forward `progress`, `end`, `error` as automation events;
   - write output to a temp path for intermediate steps;
   - resolve final output via output node.
5. Runner emits final succeeded/failed/cancelled status.
6. Cancel stops the active transcoder and marks remaining steps cancelled.
7. Optional run history is appended.

### 8.3 Backend handling

- `FFMPEG` — default, uses existing FFmpeg core.
- `FFTOOL` — raw CLI backend where appropriate.
- `BMF` — check `src/main/transcoders/bmf-availability.ts`; emit clear failure/disabled status if unavailable.
- `remux`/`demux` — prefer existing mux/demux runner helpers; fall back to backend-specific implementation where already supported.
- Use existing media info/probe paths to populate input-aware operation choices.

### 8.4 Outputs and temp files

- Intermediate files go to app-controlled temp directories.
- Use output templates such as `{{automationName}}/{{inputName}}-{{stageId}}-{{nodeId}}.<ext>`.
- Preserve extension selection from output node options.
- Reuse output-collision safeguards from the queue where possible.
- Clean intermediate files unless `keepIntermediateFiles` is enabled.

---

## 9. IPC Surface

Add constants in `src/shared/ipc-channels.ts`:

```text
AUTOMATION_LIST
AUTOMATION_GET
AUTOMATION_SAVE
AUTOMATION_DELETE
AUTOMATION_DUPLICATE
AUTOMATION_IMPORT
AUTOMATION_EXPORT
AUTOMATION_START
AUTOMATION_CANCEL
AUTOMATION_STATUS
AUTOMATION_PROGRESS
AUTOMATION_EVENT
```

Implementation checklist:

- `src/main/ipc/automations.ts` — handlers.
- `src/main/ipc/handlers.ts` — register handlers.
- `src/preload/index.ts` — expose guarded API and subscriptions.
- `src/renderer/electron-api.d.ts` — renderer typings.
- `src/shared/ipc-guards.ts` — validate all push payloads, especially `runId`, `automationId`, `nodeId`, `stageId`, and `status`.
- `docs/IPC.md` — document channels and payloads.

Progress event shape:

```ts
export interface AutomationProgressEvent {
  runId: string;
  automationId: string;
  nodeId: string;
  stageId?: string;
  status: AutomationRunStatus;
  progress?: number;
  message?: string;
  outputPath?: string;
  error?: string;
}
```

---

## 10. Renderer State and Hooks

### 10.1 `automationStore`

State:

- `definitions: AutomationDefinition[]`
- `activeDefinition: AutomationDefinition | null`
- `selectedNodeId: string | null`
- `validationIssues: AutomationIssue[]`
- `isDirty: boolean`
- `runs: Record<string, AutomationRunState>`
- `backendStatus: Record<AutomationBackend, boolean>`

Actions:

- `newAutomation()`
- `loadAutomation(id)`
- `saveAutomation()`
- `updateNode(id, patch)`
- `addNode(kind, position)`
- `removeNode(id)`
- `addEdge(edge)`
- `removeEdge(id)`
- `addStage(name)`
- `validate()`
- `run(inputPath, runtimeOverrides)`
- `cancel(runId)`

### 10.2 `useAutomations`

Mirrors `useConversion.ts`:

- subscribes once to automation progress events;
- routes failures through `useErrorStore`;
- shows success through `useToastStore`;
- handles file dialogs through existing helpers;
- unsubscribes on unmount;
- ignores stale run events.

---

## 11. Internationalization

- Add all new user-facing strings through i18n keys.
- Add source strings first, then run:

```bash
npm run sync:locales
npm run validate:locales
npm run validate:locale-usage
```

- Ensure all 56 locale files stay structurally valid.
- Update `docs/PROJECT_STRUCTURE.md` markers as needed.

---

## 12. Testing Strategy

### 12.1 Unit tests

- graph validation: cycles, duplicates, missing input/output, invalid references;
- compiler: topological order, stage output resolution, reference resolution;
- schema: versioned persistence and import validation;
- temp path/output template generation;
- runner with fake transcoders: success, failure, cancel, progress relay;
- backend availability handling.

### 12.2 Renderer tests

- Automations page renders with mocked bridge;
- drag-and-drop palette creates nodes;
- connecting nodes creates edges;
- inspector updates node data;
- validation issues render;
- run progress updates node/stage status;
- saved automation can be loaded;
- keyboard/a11y navigation of canvas controls.

### 12.3 Integration/E2E

- Run a small two-stage pipeline against a tiny generated media file where CI supports FFmpeg.
- Verify saved automation can be reopened and rerun.
- Verify BMF-unavailable path is reported without crashing.
- Add `/automations` to existing route/a11y/hostile-bridge/i18n matrices.

### 12.4 Required verification commands

```bash
npm run typecheck
npm run lint
npm run test
npm run test:route-changes
npm run test:a11y
npm run test:locale-matrix
npm run validate:locales
npm run validate:locale-usage
npm run doc:drift
npm run build
```

---

## 13. Documentation Updates

- `docs/FEATURES.md` — Automations feature overview and screenshots placeholder.
- `docs/IPC.md` — new channels, payloads, events.
- `docs/ARCHITECTURE_PROCESSES.md` — automation runtime and event flow.
- `docs/ARCHITECTURE_RENDERER.md` — new page/store/components.
- `docs/ARCHITECTURE_TRANSCODERS.md` — how automation nodes map to backends.
- `docs/PROJECT_STRUCTURE.md` — page/component/style/store counts.
- `docs/TESTING.md` — automation test suites.

---

## 14. Implementation Phases

### Phase 0 — Foundation ✅ Complete

- [x] Add `@xyflow/react`.
- [x] Add shared automation types, schema, validator, compiler, defaults.
- [x] Add unit tests for model/validator/compiler.
- [x] Define IPC progress payload guard (channel constants deferred with IPC wiring, see progress notes).
- [x] Verify targeted typecheck, lint:types, and unit tests.

**Exit criteria:** pure automation model is implemented and tested; no UI yet.

### Phase 1 — Page shell and static editor ✅ Complete

- [x] Add `/automations` route, nav, icon, skeleton, i18n.
- [x] Build page layout, canvas, palette, inspector, toolbar with mocked/local state.
- [x] Render custom React Flow nodes and edges.
- [x] Add validation display.
- [x] Add in-memory automation store and renderer-local run placeholder.

**Exit criteria:** users can visually build a graph in the UI without execution.

### Phase 2 — Save/load library ✅ Complete

- [x] Implement main-process persistence and IPC handlers.
- [x] Wire store/hooks to list/save/load/delete/import/export.
- [x] Add dirty state, Save As, and Duplicate.

**Exit criteria:** automations persist across app restarts and can be reopened.

### Phase 3 — Runtime engine ✅ Complete

- [x] Implement main-process runner, step executors, temp files, events.
- [x] Wire `AUTOMATION_START`, cancel, and progress events.
- [x] Integrate FFmpeg/FFTool/BMF backends and availability checks.

**Exit criteria:** a two-stage pipeline executes end to end with progress events.

### Phase 4 — Run UX and cascading stages

- Wire node badges, stage timeline, run console, error details.
- Add runtime file picker override.
- Add dynamic operation filtering based on probed input media.
- Add rerun, cancel, and run history.

**Exit criteria:** users can build, run, monitor, and rerun staged automations fully in the UI.

### Phase 5 — Hardening and release

- Complete docs, i18n sync, a11y, route matrices, and E2E coverage.
- Clean up temp files and cancellation edge cases.
- Run full verification command set.

**Exit criteria:** feature passes the same quality gates as existing pages.

---

## 15. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| React Flow styles conflict with MUI/theme | Use custom node components and theme-based styles; import library CSS once. |
| Strict lint rules reject hardcoded design values | Use theme spacing, palette constants, and shared style files. |
| BMF not installed on user machine | Detect at runtime, disable node option, emit clear status instead of failing silently. |
| Long-running pipelines block UI | Execute only in main process; stream progress events. |
| Cancellation leaves orphaned processes | Track active emitter per run; cancel active transcoder and mark remaining steps cancelled. |
| Saved paths become invalid after restart | Treat stored paths as defaults; allow runtime file override and surface missing-file validation. |
| Invalid imported JSON reaches native code | zod validation plus main-side revalidation before execution. |
| Output collisions/overwrites | Use output templates, conflict policy, and existing queue safeguards where possible. |
| Route-count/i18n tests break | Update all route matrices and run locale validation early. |

---

## 16. Open Questions

1. Should run history be persisted permanently or only for the current session? Recommendation: persist a bounded recent-history list.
2. Should independent branches execute in parallel? Recommendation: defer to a later phase; sequential execution first.
3. Should the first release support multiple input nodes? Recommendation: no; one runtime input with optional multi-output.
4. Should the palette expose raw `extraArgs`? Recommendation: keep behind an Advanced section with validation.
5. Should automation definitions be exportable to CLI commands? Recommendation: consider as a follow-up using the existing CLI helpers.
