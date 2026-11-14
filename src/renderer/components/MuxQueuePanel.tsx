/**
 * @fileoverview Panel for the dedicated remux/demux mux queue.
 *
 * Renders the Mux Queue tab of the Batch Queue page: a toolbar with the queue
 * actions (Start, Pause/Resume, Cancel all, Clear completed, and the
 * parallel-jobs selector), a status filter row with a filename search, and the
 * list of mux jobs.
 *
 * The panel owns no state of its own - it reads the jobs and the queue state
 * from {@link useMuxQueueStore} (kept in sync by the global `MuxQueueSync`
 * component) and drives the main process through the `muxQueue*` bridge
 * methods.
 *
 * When the queue is empty the panel explains where mux jobs come from and
 * links to the Remux and Demux pages, so a new user can find the entry point
 * without knowing it exists.
 *
 * The page can condense the mux tab independently of the general tab: while
 * `condensed` is true the toolbar collapses with the same animation the
 * general queue sections use, leaving the filter row and the job list visible
 * so the queue stays searchable while condensed.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Collapse, MenuItem, Stack } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faBroom, faCheckDouble } from '@fortawesome/free-solid-svg-icons';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMuxQueueStore } from '../stores/muxQueueStore';
import { useMuxQueueStatus } from '../hooks/useMuxQueueStatus';
import { computeQueuedTargetPosition, reorderJob } from '../utils/queue-reorder';
import { fireAndForgetBridge } from '../utils/bridge-call';
import { useToastStore } from '../stores/toastStore';
import { formatError } from '../../shared/errors';
import { basename } from '../utils/path-utils';
import MuxQueueJobCard from './MuxQueueJobCard';
import { QUEUE_STATUS } from '../../shared/media-options';
import { MAX_QUEUE_CONCURRENCY } from '../../shared/constants';
import type { MuxQueueJob } from '../../shared/types';
import type { MuxQueuePanelProps } from './types';
import { ControlsPaper, AlignedIconButton, ToolbarRow, ConcurrencySelect } from '../styles/BatchControls.styles';
import { FieldBox, FieldLabel } from '../styles/form.styles';
import {
  AnimatedSection,
  EmptyStack,
  EmptyActionGroup,
  EmptyHeadingText,
  EmptyHintText,
  FilterRow,
  FilterChip,
  SearchField,
} from '../styles/BatchQueue.styles';
import TooltipIfEnabled from './TooltipIfEnabled';

/**
 * Renders the mux queue panel: controls, filters, search, and the job list.
 * @param {MuxQueuePanelProps} props - Component props.
 * @param {React.RefObject<HTMLInputElement | null>} [props.searchRef] - Ref
 *   forwarded to the filename search input.
 * @param {boolean} [props.condensed] - True while the mux tab is condensed.
 * @returns {JSX.Element} The panel content.
 */
export default function MuxQueuePanel({ searchRef, condensed = false }: MuxQueuePanelProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const jobs = useMuxQueueStore((s) => s.jobs);
  const progress = useMuxQueueStore((s) => s.progress);
  const paused = useMuxQueueStore((s) => s.paused);
  const concurrency = useMuxQueueStore((s) => s.concurrency);
  const status = useMuxQueueStatus();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | (typeof QUEUE_STATUS)[keyof typeof QUEUE_STATUS]>('all');

  /**
   * Filename search term; jobs whose input basename includes it
   * (case-insensitive) are shown, mirroring the general queue's search.
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [search, setSearch] = useState('');

  /**
   * True once the collapse animation of the condensed sections has fully
   * completed. Removes the wrappers from the layout (display: none) so a
   * condensed mux tab leaves no leftover empty space behind; seeded from the
   * prop so switching to an already-condensed tab renders without a flash.
   * @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]}
   */
  const [sectionsGone, setSectionsGone] = useState(condensed);

  /**
   * Jobs shown after applying the active status filter and search term.
   * Filtering preserves the queue's relative order.
   */
  const visibleJobs = jobs
    .filter((job: MuxQueueJob) => filter === 'all' || job.status === filter)
    .filter((job: MuxQueueJob) => !search || basename(job.input).toLowerCase().includes(search.toLowerCase()));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Records which job is being dragged so the overlay can preview it.
   * @param {DragStartEvent} event - The dnd-kit drag start event.
   * @returns {void}
   */
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  /**
   * Commits a drag-and-drop reorder: the visible list is reordered locally,
   * the target position within the QUEUED subsequence is derived, and the main
   * process is told to commit it. The `MUX_QUEUE_MOVED` echo confirms it.
   * @param {DragEndEvent} event - The dnd-kit drag end event.
   * @returns {void}
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const visibleIds = jobs.map((job: MuxQueueJob) => job.id);
    const from = visibleIds.indexOf(activeId);
    const to = visibleIds.indexOf(overId);
    if (from === -1 || to === -1) return;
    const newVisibleIds = arrayMove(visibleIds, from, to);
    const toPosition = computeQueuedTargetPosition(jobs, activeId, newVisibleIds);
    useMuxQueueStore.setState((state) => {
      const reordered = reorderJob(state.jobs, activeId, toPosition);
      return reordered === state.jobs ? {} : { jobs: reordered };
    });
    fireAndForgetBridge(() => window.electronAPI.muxQueueMoveTo(activeId, toPosition), 'muxQueueMoveTo');
  };

  /**
   * Re-queues a failed job with the same targets.
   *
   * The failed job is removed first: the mux queue refuses to enqueue an
   * output that another job already claims, and the failed job still claims
   * its own outputs until it leaves the queue.
   * @param {MuxQueueJob} job - The failed job to retry.
   * @returns {Promise<void>} Resolves once the retry was enqueued.
   */
  const handleRetry = async (job: MuxQueueJob) => {
    try {
      fireAndForgetBridge(() => window.electronAPI.muxQueueRemove(job.id), 'muxQueueRemove');
      await window.electronAPI.muxQueueAdd({
        kind: job.kind,
        input: job.input,
        output: job.output,
        targets: job.targets,
        transcoder: job.transcoder,
        overwrite: true,
      });
      useToastStore.getState().success(t('toast.jobAdded'));
    } catch (err: unknown) {
      const appError = formatError(err);
      useToastStore.getState().error(appError.message, appError.detail);
    }
  };

  const activeJob = activeDragId ? jobs.find((job: MuxQueueJob) => job.id === activeDragId) : null;

  return (
    <Stack spacing={2} role="region" aria-label={t('muxQueue.tabMux')}>
      <AnimatedSection id="mux-queue-controls-section" $hidden={condensed} $gone={sectionsGone} aria-hidden={condensed}>
        <Collapse in={!condensed} onEntering={() => setSectionsGone(false)} onExited={() => setSectionsGone(true)}>
          <ControlsPaper>
            <ToolbarRow>
              {paused ? (
                <TooltipIfEnabled title={t('muxQueue.resume')}>
                  <AlignedIconButton
                    size="small"
                    color="success"
                    aria-label={t('muxQueue.resume')}
                    onClick={() => {
                      useMuxQueueStore.getState().setPaused(false);
                      fireAndForgetBridge(() => window.electronAPI.muxQueueResume(), 'muxQueueResume');
                    }}
                  >
                    <FontAwesomeIcon icon={faPlay} />
                  </AlignedIconButton>
                </TooltipIfEnabled>
              ) : status.running > 0 ? (
                <TooltipIfEnabled title={t('muxQueue.pause')}>
                  <AlignedIconButton
                    size="small"
                    color="warning"
                    aria-label={t('muxQueue.pause')}
                    onClick={() => {
                      useMuxQueueStore.getState().setPaused(true);
                      fireAndForgetBridge(() => window.electronAPI.muxQueuePause(), 'muxQueuePause');
                    }}
                    disabled={status.active === 0}
                  >
                    <FontAwesomeIcon icon={faPause} />
                  </AlignedIconButton>
                </TooltipIfEnabled>
              ) : (
                <TooltipIfEnabled title={t('muxQueue.start')}>
                  <AlignedIconButton
                    size="small"
                    color="success"
                    aria-label={t('muxQueue.start')}
                    onClick={() => fireAndForgetBridge(() => window.electronAPI.muxQueueStart(), 'muxQueueStart')}
                    disabled={status.queued === 0}
                  >
                    <FontAwesomeIcon icon={faPlay} />
                  </AlignedIconButton>
                </TooltipIfEnabled>
              )}
              <TooltipIfEnabled title={t('muxQueue.cancelAll')}>
                <AlignedIconButton
                  size="small"
                  color="error"
                  aria-label={t('muxQueue.cancelAll')}
                  onClick={() => fireAndForgetBridge(() => window.electronAPI.muxQueueCancelAll(), 'muxQueueCancelAll')}
                  disabled={status.total === 0}
                >
                  <FontAwesomeIcon icon={faBroom} />
                </AlignedIconButton>
              </TooltipIfEnabled>
              <TooltipIfEnabled title={t('muxQueue.clearCompleted')}>
                <AlignedIconButton
                  size="small"
                  aria-label={t('muxQueue.clearCompleted')}
                  onClick={() => fireAndForgetBridge(() => window.electronAPI.muxQueueClearCompleted(), 'muxQueueClearCompleted')}
                  disabled={status.done + status.failed === 0}
                >
                  <FontAwesomeIcon icon={faCheckDouble} />
                </AlignedIconButton>
              </TooltipIfEnabled>
              <FieldBox>
                <FieldLabel htmlFor="mux-queue-concurrency">{t('muxQueue.concurrency')}</FieldLabel>
                <ConcurrencySelect
                  id="mux-queue-concurrency"
                  select
                  size="small"
                  slotProps={{ input: { 'aria-label': t('muxQueue.concurrency') } }}
                  value={concurrency}
                  onChange={(e) =>
                    fireAndForgetBridge(() => window.electronAPI.muxQueueSetConcurrency(Number(e.target.value)), 'muxQueueSetConcurrency')
                  }
                >
                  {Array.from({ length: MAX_QUEUE_CONCURRENCY }, (_, i) => i + 1).map((n) => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
                </ConcurrencySelect>
              </FieldBox>
            </ToolbarRow>
          </ControlsPaper>
        </Collapse>
      </AnimatedSection>

      {jobs.length === 0 ? (
        <EmptyStack spacing={1} data-testid="mux-queue-empty">
          <EmptyHeadingText>{t('muxQueue.empty')}</EmptyHeadingText>
          <EmptyHintText>{t('muxQueue.emptyHint')}</EmptyHintText>
          <EmptyActionGroup size="small" variant="outlined" aria-label={t('muxQueue.tabMux')}>
            <Button onClick={() => navigate('/remux')}>{t('muxQueue.openRemux')}</Button>
            <Button onClick={() => navigate('/demux')}>{t('muxQueue.openDemux')}</Button>
          </EmptyActionGroup>
        </EmptyStack>
      ) : (
        <>
          <FilterRow>
            {(['all', QUEUE_STATUS.QUEUED, QUEUE_STATUS.RUNNING, QUEUE_STATUS.DONE, QUEUE_STATUS.ERROR] as const).map((value) => {
              const count = value === 'all' ? jobs.length : jobs.filter((job: MuxQueueJob) => job.status === value).length;
              const labelKey = value === 'all' ? 'all' : value === QUEUE_STATUS.ERROR ? 'failed' : value;
              return (
                <FilterChip
                  key={value}
                  size="small"
                  label={`${t(`muxQueue.filters.${labelKey}`)} (${count})`}
                  color={filter === value ? 'primary' : 'default'}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                />
              );
            })}
            <SearchField
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('batchQueue.search')}
              slotProps={{ htmlInput: { 'aria-label': t('batchQueue.search'), ref: searchRef } }}
            />
          </FilterRow>
          {visibleJobs.length === 0 ? (
            <EmptyStack spacing={1} data-testid="mux-queue-no-results">
              <EmptyHeadingText>{t('batchQueue.noResults')}</EmptyHeadingText>
            </EmptyStack>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveDragId(null)}
            >
              <SortableContext items={visibleJobs.map((job: MuxQueueJob) => job.id)} strategy={verticalListSortingStrategy}>
                <Stack spacing={2}>
                  {visibleJobs.map((job: MuxQueueJob) => (
                    <MuxQueueJobCard
                      key={job.id}
                      job={job}
                      progress={progress[job.id]}
                      onRemove={(id) => fireAndForgetBridge(() => window.electronAPI.muxQueueRemove(id), 'muxQueueRemove')}
                      onRetry={handleRetry}
                    />
                  ))}
                </Stack>
              </SortableContext>
              <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }}>
                {activeJob ? <MuxQueueJobCard job={activeJob} onRemove={() => {}} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </>
      )}
    </Stack>
  );
}
