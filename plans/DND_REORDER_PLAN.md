# Drag-and-Drop Queue Reordering Plan

Replaces the move up/down arrow buttons on `QueueJobCard` with a full drag-and-drop
reorder interface powered by `@dnd-kit`, and swaps the one-step `queueMove(id, direction)`
IPC contract for a position-based `queueMoveTo(id, toPosition)` contract.

The batch queue's order lives in the main process. Non-queued jobs (running/done/errored)
keep their slots; only QUEUED jobs may be rearranged, exactly like the old arrow buttons.

## Checkpoints

Status legend: `[ ]` pending, `[x]` done.

- [x] C0. Create this plan document.
- [x] C1. Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (React 19 compatible: core ^6.3.1, sortable ^10.0.0).
- [x] C2. Main queue: replace `moveJob(id, direction)` with `moveJobTo(id, toPosition)` (target index within the QUEUED subsequence, clamped; emits `moved { id, toPosition }`).
- [x] C3. Channels + log constants: `QUEUE_MOVE` -> `QUEUE_MOVE_TO ('queue-move-to')`; `QUEUE_MOVED` payload becomes `{ id, toPosition }`; rename log constants.
- [x] C4. IPC handler: `queue.ts` handles `QUEUE_MOVE_TO (id, toPosition)`, forwards `moved` as `QUEUE_MOVED { id, toPosition }`.
- [x] C5. Preload: `queueMove(id, direction)` -> `queueMoveTo(id, toPosition)`; `onQueueMoved` callback payload `{ id, toPosition }`.
- [x] C6. Component types: `QueueJobCardProps` drops `onMove`, gains dnd-kit-driven draggable props.
- [x] C7. `QueueJobCard`: use `useSortable` (disabled for non-queued), `faGripVertical` drag handle, dnd-kit transform/transition, isDragging style. Arrow buttons removed.
- [x] C8. Card styles: `DragHandleButton`, dragging accent, `DragOverlay` elevation.
- [x] C9. `BatchQueue`: `DndContext` + `SortableContext` + `DragOverlay` around the card stack; on drag end compute target queued position and call `queueMoveTo`; mirror `onQueueMoved { id, toPosition }` in the store.
- [x] C10. Pure helper to compute the dragged job's queued-subsequence position after a visible `arrayMove` (unit-testable).
- [x] C11. i18n: remove `batchQueue.moveUp`/`moveDown`, add `batchQueue.dragHandle` (all 20 locales).
- [x] C12. Tests: `job-queue`, `ipc/queue`, `preload/index`, `ipc-channels`, `QueueJobCard`, `BatchQueue`, new helper test.
- [x] C13. Docs: update `docs/BATCH_QUEUE_PLAN.md` row B2.
- [x] C14. Verify: `vitest run` (1068 passed), `prettier --check` (2 files reformatted), tsc builds (main/renderer/preload).

## Semantics: `moveJobTo(id, toPosition)`

`toPosition` is a 0-based index into the QUEUED subsequence of the queue, clamped to
`[0, queuedCount - 1]`. Implementation (a pure permutation of the QUEUED slots):

1. Build `queuedIndexes` = indexes of QUEUED jobs (in queue order).
2. `fromPos` = position of `id` within `queuedIndexes`; if missing -> `false`.
3. Clamp `toPosition`; if `fromPos === toPosition` -> `false` (no-op).
4. Take the ordered QUEUED jobs, splice the moved job out and re-insert it at
   `toPosition`, then write the reordered list back into `queuedIndexes`. This
   keeps every non-queued job at its absolute slot (the old "keep slots" rule).
5. Emit `moved { id, toPosition }`, `schedulePersist()`.

The renderer mirrors this exact algorithm (`reorderJob` in
`src/renderer/utils/queue-reorder.ts`) on `onQueueMoved { id, toPosition }` so the
store stays in sync with the main process.

## Drop position mapping

The visible list may be filtered (status filter + search), but visible order preserves
the relative order of queued jobs. On drag end:

1. `arrayMove` the visible list (dnd-kit gives `active`/`over`).
2. Apply the same permutation to the full jobs array by identity of the visible items
   (non-queued jobs keep their slots).
3. `toPosition` = the dragged job's index within the QUEUED subsequence of the permuted
   full array.
4. Call `window.electronAPI.queueMoveTo(id, toPosition)`; the store updates via the
   `onQueueMoved` echo.

## Files touched

| Area | File |
| --- | --- |
| Deps | `package.json` |
| Main queue | `src/main/queue/job-queue.ts` |
| IPC channels | `src/shared/ipc-channels.ts`, `src/shared/log-constants.ts` |
| IPC handler | `src/main/ipc/queue.ts` |
| Preload | `src/preload/index.ts` |
| Renderer | `src/renderer/components/types.ts`, `QueueJobCard.tsx`, `styles/QueueJobCard.styles.ts` |
| Renderer page | `src/renderer/pages/BatchQueue.tsx` |
| Helper | `src/renderer/utils/queue-reorder.ts` (new) |
| i18n | `src/renderer/i18n/locales/*.json` (20 files) |
| Tests | `src/main/__tests__/job-queue.test.ts`, `src/main/ipc/__tests__/queue.test.ts`, `src/preload/__tests__/index.test.ts`, `src/shared/__tests__/ipc-channels.test.ts`, `src/renderer/components/__tests__/QueueJobCard.test.tsx`, `src/renderer/pages/__tests__/BatchQueue.test.tsx`, `src/renderer/utils/__tests__/queue-reorder.test.ts` (new) |
| Docs | `docs/BATCH_QUEUE_PLAN.md` |

## Verification

- `npx vitest run` (full suite)
- `npx prettier --check "src/**/*.{ts,tsx,json}"`
- `npm run build:main`, `npm run build:renderer`, `npm run build:preload`
