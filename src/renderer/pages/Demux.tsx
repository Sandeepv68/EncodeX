/**
 * @fileoverview Demux page. Lets the user extract every selected stream from a
 * media file into its own output file (one `convertFile` per stream), optionally
 * converting each kind to a target container/codec/format instead of streaming
 * it losslessly.
 *
 * Workflow: drop or pick a video -> the file is probed (getMediaInfo) and its
 * streams are listed grouped by kind (video/audio/subtitle) with checkboxes and
 * suggested output names -> pick per-kind conversion targets (or keep stream
 * copy) and the output directory -> Start Demux. While the demux runs a
 * ProgressBar is shown together with the current stream, pause, resume, and
 * cancel controls; completing the run shows a success toast whose reveal action
 * reveals the first extracted file in the output folder.
 *
 * State is centralized in the `useDemuxStore` zustand store (input, streams,
 * selected indices, per-kind media preferences, targets, output directory,
 * converting/paused flags, aggregated progress, current sub-task). All media
 * work is delegated to the main process through `window.electronAPI`
 * (`getMediaInfo`, `selectDirectory`, `convertFile`, `pauseConversion`,
 * `resumeConversion`, `cancelConversion`, `revealFile`). This page owns no
 * long-lived run state and relies on `useTaskRunControls(useDemuxStore)` since
 * the store owns the demux lifecycle.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  TextField,
  MenuItem,
  Button,
  Stack,
  Typography,
  Tooltip,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Checkbox,
} from '@mui/material';
import { faScissors, faPause, faPlay, faXmark, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import FileDropZone from '../components/FileDropZone';
import ProgressBar from '../components/ProgressBar';
import PageContainer from '../components/PageContainer';
import FilePathField from '../components/FilePathField';
import ConfirmDialog from '../components/ConfirmDialog';
import InfoTooltip from '../components/InfoTooltip';
import MediaPreview from '../components/MediaPreview';
import { VideoFiltersSection } from '../components/VideoFiltersSection';
import { pageIcons } from '../pageIcons';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logger } from '../../shared/logger';
import { useTaskRunControls } from '../hooks/useMediaTask';
import { useHotkeys } from '../hooks/useHotkeys';
import { usePreviewThumbnail } from '../hooks/usePreviewThumbnail';
import { SHORTCUT_BY_ID, shortcutHint } from '../constants/shortcuts';
import { openFileDialog } from '../utils/fileDialog';
import { fileName } from '../utils/path-utils';
import { visuallyHidden } from '../utils/a11y';
import { VIDEO_DROPZONE_ACCEPT } from '../../shared/file-extensions';
import { suggestedExtensionForStream, type RemuxWarning } from '../../shared/codec-containers';
import { useDemuxStore } from '../stores/demuxStore';
import type { MediaStreamInfo } from '../../shared/types';
import { FieldBox, FieldLabel } from '../styles/form.styles';
import { StreamTable } from '../styles/StreamTable.styles';
import { SelectedFileName, ActionRow } from '../styles/AudioExtract.styles';
import { LOG_ARROW, LOG_START_CONVERSION } from '../../shared/log-constants';

/**
 * Logger instance scoped to this page. Used to report demux starts.
 * @const {Logger} log
 */
const log = new Logger('renderer/pages/Demux');

/**
 * Per-kind stream table column order. Empty groups are not rendered, so groups
 * appear in video → audio → subtitle order.
 * @const {readonly ['video', 'audio', 'subtitle']} STREAM_KINDS
 */
const STREAM_KINDS = ['video', 'audio', 'subtitle'] as const;

/**
 * Target-container options for re-encoding the video kind. `copy` keeps the
 * lossless stream copy; the remaining extensions re-encode the video.
 * @const {readonly string[]} VIDEO_TARGETS
 */
const VIDEO_TARGETS = ['copy', 'mkv', 'mp4'] as const;

/**
 * Target-encoder options for the audio kind. `copy` keeps the lossless stream
 * copy; the remaining values are FFmpeg encoder names.
 * @const {readonly string[]} AUDIO_TARGETS
 */
const AUDIO_TARGETS = ['copy', 'mp3', 'm4a', 'flac', 'wav'] as const;

/**
 * Target-format options for the subtitle kind. `copy` keeps the lossless stream
 * copy; the remaining values are FFmpeg subtitle format names.
 * @const {readonly string[]} SUBTITLE_TARGETS
 */
const SUBTITLE_TARGETS = ['copy', 'srt', 'ass'] as const;

/**
 * Renders the demux page (`/demux`).
 *
 * Layout: a drop zone / selected-video box at the top, the probed streams
 * grouped by kind (checkbox per stream plus its suggested output name), the
 * per-kind conversion target selectors, the output-directory field, a
 * per-stream summary showing copy-vs-convert, and the action button row
 * (Start Demux / pause / resume / cancel). While a demux runs a ProgressBar and
 * the current stream label are shown; a ConfirmDialog guards cancellation.
 *
 * Local state: only `cancelConfirmOpen` (whether the cancel dialog is open).
 * Everything else lives in `useDemuxStore`. Run controls come from
 * `useTaskRunControls(useDemuxStore)` since the store owns the demux lifecycle.
 *
 * @returns {JSX.Element} The page content inside a PageContainer.
 */
export default function DemuxPage() {
  const { t } = useTranslation();
  const store = useDemuxStore();
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const run = useTaskRunControls(useDemuxStore);

  /**
   * Data URL of a still frame from the selected video, or null while no input
   * is chosen or the frame has not loaded. Lets the user confirm they picked
   * the right container source before demuxing.
   * @type {string | null}
   */
  const inputPreview = usePreviewThumbnail(store.input);

  /**
   * Probed streams grouped by kind, each stream paired with the suggested
   * output file name for the stream. The name resolves from the store's live
   * targets (which already reflect the selected conversion prefs) so rows stay
   * in sync with the extraction plan; unselected streams fall back to the
   * extension their lossless copy would get.
   * @type {Array<{kind: 'video' | 'audio' | 'subtitle'; rows: Array<{stream: MediaStreamInfo; output?: string}>}>}
   */
  const groups: Array<{ kind: (typeof STREAM_KINDS)[number]; rows: Array<{ stream: MediaStreamInfo; output: string }> }> = useMemo(() => {
    const targetsByIndex = new Map(store.targets.map((target) => [target.index, target.output]));
    return STREAM_KINDS.map((kind) => ({
      kind,
      rows: store.streams
        .filter((s) => s.type === kind)
        .map((stream): { stream: MediaStreamInfo; output: string } => ({
          stream,
          output: targetsByIndex.get(stream.index) ?? suggestedExtensionForStream(stream),
        })),
    })).filter((group) => group.rows.length > 0);
  }, [store.streams, store.targets]);

  /**
   * Handles a newly selected or dropped video file by letting the store probe
   * it (populating `streams`, `selectedIndices`, the output directory, and the
   * extraction targets).
   * @param {string} path - Absolute path of the selected video file.
   * @returns {Promise<void>} Resolves once the probe settles.
   */
  const handleFileSelect = async (path: string) => {
    await store.setInput(path);
  };

  /**
   * Clears the current demux form (input, streams, selection, targets, output
   * directory) via the store.
   * @returns {void}
   */
  const clearSelection = () => {
    store.clearSelection();
  };

  /**
   * Updates the video-kind conversion target and regenerates the targets.
   * `copy` clears the preference so the video is extracted losslessly.
   * @param {string} value - The selected video target (`copy` or a container).
   * @returns {void}
   */
  const handleVideoTarget = (value: string) => {
    store.setMedia({ ...store.media, videoContainer: value === 'copy' ? undefined : value });
  };

  /**
   * Updates the audio-kind conversion target and regenerates the targets.
   * `copy` clears the preference so the audio is extracted losslessly.
   * @param {string} value - The selected audio target (`copy` or an encoder).
   * @returns {void}
   */
  const handleAudioTarget = (value: string) => {
    store.setMedia({ ...store.media, audioCodec: value === 'copy' ? undefined : value });
  };

  /**
   * Updates the subtitle-kind conversion target and regenerates the targets.
   * `copy` clears the preference so the subtitle is extracted losslessly.
   * @param {string} value - The selected subtitle target (`copy` or a format).
   * @returns {void}
   */
  const handleSubtitleTarget = (value: string) => {
    store.setMedia({ ...store.media, subtitleCodec: value === 'copy' ? undefined : value });
  };

  /**
   * Replaces the video filter chain. Only a video target that re-encodes
   * (a `--video-container` differing from the stream's native format) consumes
   * it; a stream copy ignores it and the warnings panel says so.
   * @param {string[]} entries - Ordered filter expressions.
   * @returns {void}
   */
  const handleVideoFilters = (entries: string[]) => {
    store.setMedia({ ...store.media, videoFilters: entries });
  };

  /**
   * True when at least one selected video stream is re-encoded, which is the
   * only case where the video filter chain has any effect. Gates the Filters
   * section so it is not offered for a plain stream copy.
   * @type {boolean}
   */
  const reencodesVideo = store.targets.some((target) => target.kind === 'video' && !target.copy);

  /**
   * Starts the demux through the store's `startDemux` (which calls
   * `window.electronAPI.convertFile` once per selected stream). The store
   * guards against a missing input or empty target list and reports its own
   * errors, so this page only logs the start parameters.
   * @returns {Promise<void>} Resolves when the whole demux finishes or fails.
   */
  const handleStart = async () => {
    log.info(LOG_START_CONVERSION, store.input, LOG_ARROW, store.targets.length, 'targets');
    await store.startDemux();
  };

  /**
   * Registers the page keyboard shortcuts (Ctrl+O input, Ctrl+Enter start).
   * Bindings mirror the enabled state of the equivalent on-page controls.
   * @returns {void}
   */
  useHotkeys([
    {
      id: 'demux.input',
      handler: async () => {
        const file = await openFileDialog(VIDEO_DROPZONE_ACCEPT);
        if (file) handleFileSelect(file);
      },
    },
    { id: 'demux.start', handler: () => handleStart(), enabled: !!store.input && store.targets.length > 0 && !store.isConverting },
  ]);

  return (
    <PageContainer title={t('demux.title')} icon={pageIcons['/demux']}>
      <Box>
        <FieldLabel>
          {t('demux.videoFile')}
          <InfoTooltip title={t('demux.videoFileHint')} />
        </FieldLabel>
        {!store.input && (
          <ErrorBoundary fallback={null}>
            <FileDropZone onFileSelect={handleFileSelect} label={t('demux.dropLabel')} accept={VIDEO_DROPZONE_ACCEPT} />
          </ErrorBoundary>
        )}
        {store.input && (
          <MediaPreview
            imageSrc={inputPreview}
            alt={fileName(store.input)}
            removeLabel={t('batchQueue.remove')}
            testId="demux-video"
            removeTestId="remove-demux-video"
            variant="wide"
            onRemove={clearSelection}
          >
            <Typography variant="body2" color="text.secondary" data-testid="selected-video">
              {(() => {
                const template = t('demux.selectedVideo', { file: '{{file}}' });
                const [before, after] = template.split('{{file}}');
                return (
                  <>
                    {before}
                    <SelectedFileName component="span">{fileName(store.input)}</SelectedFileName>
                    {after}
                  </>
                );
              })()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {store.streams.length > 0
                ? t('demux.streamCount', { selected: store.selectedIndices.length, total: store.streams.length })
                : ''}
            </Typography>
          </MediaPreview>
        )}
      </Box>

      {store.input && (
        <>
          <FieldBox>
            <FieldLabel>
              {t('demux.streams')}
              <InfoTooltip title={t('demux.streamsHint')} />
            </FieldLabel>
            <ErrorBoundary fallback={null}>
              <Stack spacing={2}>
                {groups.map(({ kind, rows }) => (
                  <Box key={kind} data-testid={`demux-stream-group-${kind}`}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('demux.streamGroup', { kind: t(`mediaInfo.${kind}`) })}
                    </Typography>
                    <StreamTable size="small" aria-label={t(`mediaInfo.${kind}`)}>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox">
                            <span style={visuallyHidden}>{t('demux.extractStreams')}</span>
                          </TableCell>
                          <TableCell>{t('remux.streamIndex')}</TableCell>
                          <TableCell>{t('mediaInfo.codec')}</TableCell>
                          <TableCell>{t('mediaInfo.language')}</TableCell>
                          <TableCell>{t('mediaInfo.channels')}</TableCell>
                          <TableCell>{t('demux.suggestedOutput')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map(({ stream, output }) => {
                          const selected = store.selectedIndices.includes(stream.index);
                          return (
                            <TableRow key={stream.index} data-testid="demux-stream-row">
                              <TableCell padding="checkbox">
                                <Checkbox
                                  size="small"
                                  checked={selected}
                                  onChange={() => store.toggleStream(stream.index)}
                                  disabled={store.isConverting}
                                  aria-label={t('demux.selectStream', { kind: t(`mediaInfo.${stream.type}`), index: stream.index })}
                                />
                              </TableCell>
                              <TableCell>{stream.index}</TableCell>
                              <TableCell>{stream.codec}</TableCell>
                              <TableCell>{stream.language ?? '—'}</TableCell>
                              <TableCell>{stream.channels != null ? stream.channels : '—'}</TableCell>
                              <TableCell>
                                <Typography variant="body2" data-testid={`demux-output-${stream.index}`}>
                                  {output}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </StreamTable>
                  </Box>
                ))}
              </Stack>
            </ErrorBoundary>
          </FieldBox>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FieldBox>
              <FieldLabel>
                {t('demux.videoContainer')}
                <InfoTooltip title={t('demux.videoContainerHint')} />
              </FieldLabel>
              <TextField
                select
                fullWidth
                size="small"
                value={store.media.videoContainer ?? 'copy'}
                onChange={(e) => handleVideoTarget(e.target.value)}
                disabled={store.isConverting}
                data-testid="demux-video-target"
                slotProps={{ htmlInput: { 'aria-label': t('demux.videoContainer') } }}
              >
                {VIDEO_TARGETS.map((target) => (
                  <MenuItem key={target} value={target}>
                    {target === 'copy' ? t('demux.copyOption') : `.${target}`}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
            <FieldBox>
              <FieldLabel>
                {t('demux.audioCodec')}
                <InfoTooltip title={t('demux.audioCodecHint')} />
              </FieldLabel>
              <TextField
                select
                fullWidth
                size="small"
                value={store.media.audioCodec ?? 'copy'}
                onChange={(e) => handleAudioTarget(e.target.value)}
                disabled={store.isConverting}
                data-testid="demux-audio-target"
                slotProps={{ htmlInput: { 'aria-label': t('demux.audioCodec') } }}
              >
                {AUDIO_TARGETS.map((target) => (
                  <MenuItem key={target} value={target}>
                    {target === 'copy' ? t('demux.copyOption') : target}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
            <FieldBox>
              <FieldLabel>
                {t('demux.subtitleFormat')}
                <InfoTooltip title={t('demux.subtitleFormatHint')} />
              </FieldLabel>
              <TextField
                select
                fullWidth
                size="small"
                value={store.media.subtitleCodec ?? 'copy'}
                onChange={(e) => handleSubtitleTarget(e.target.value)}
                disabled={store.isConverting}
                data-testid="demux-subtitle-target"
                slotProps={{ htmlInput: { 'aria-label': t('demux.subtitleFormat') } }}
              >
                {SUBTITLE_TARGETS.map((target) => (
                  <MenuItem key={target} value={target}>
                    {target === 'copy' ? t('demux.copyOption') : target}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
          </Stack>

          {reencodesVideo && (
            <FieldBox>
              <FieldLabel>
                {t('demux.filtersTitle')}
                <InfoTooltip title={t('demux.filtersHint')} />
              </FieldLabel>
              <VideoFiltersSection
                filterEntries={store.media.videoFilters ?? []}
                onChange={handleVideoFilters}
                disabled={store.isConverting}
              />
            </FieldBox>
          )}

          {store.warnings.length > 0 && (
            <FieldBox>
              <FieldLabel>
                {t('demux.subtitleWarning')}
                <InfoTooltip title={t('demux.subtitleWarningHint')} />
              </FieldLabel>
              <Stack spacing={1} data-testid="demux-warnings">
                {store.warnings.map((warning: RemuxWarning, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }} data-testid="demux-warning">
                    <FontAwesomeIcon icon={faTriangleExclamation} color="warning" />
                    <Typography variant="body2" color="text.secondary">
                      {warning.code === 'bitmapSubtitleWarning'
                        ? t('demux.bitmapSubtitleWarning')
                        : warning.code === 'filtersIgnoredCopy'
                          ? t('demux.filtersIgnoredCopy')
                          : warning.message}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </FieldBox>
          )}

          <FilePathField
            label={t('demux.outputDir')}
            hint={t('demux.outputDirHint')}
            value={store.outputDir}
            placeholder={t('demux.outputDirPlaceholder')}
            buttonLabel={t('convert.browse')}
            onChange={(value) => store.setOutputDir(value)}
            testId="demux-output-dir"
            onBrowse={async () => {
              const dir = await window.electronAPI.selectDirectory();
              if (dir) store.setOutputDir(dir);
            }}
          />

          <FieldBox>
            <FieldLabel>
              {t('demux.summary')}
              <InfoTooltip title={t('demux.summaryHint')} />
            </FieldLabel>
            <Stack spacing={1} data-testid="demux-summary">
              {store.targets.map((target) => (
                <Box key={target.index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="demux-target">
                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                    {fileName(target.output)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {target.copy ? t('demux.copyLabel') : t('demux.convertLabel', { target: target.codec ?? target.container ?? '' })}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </FieldBox>

          <ActionRow direction="row" spacing={1} useFlexGap>
            <Tooltip title={shortcutHint(t, 'demux.start', SHORTCUT_BY_ID['demux.start'].keys)} arrow>
              <span>
                <Button
                  variant="contained"
                  startIcon={<FontAwesomeIcon icon={faScissors} />}
                  onClick={handleStart}
                  disabled={!store.input || store.targets.length === 0 || store.isConverting}
                  data-testid="demux-start"
                >
                  {store.isConverting ? t('demux.demuxing') : t('demux.start')}
                </Button>
              </span>
            </Tooltip>
            {run.isConverting && !run.isPaused && (
              <Button variant="contained" color="warning" startIcon={<FontAwesomeIcon icon={faPause} />} onClick={() => run.pause()}>
                {t('demux.pause')}
              </Button>
            )}
            {run.isConverting && run.isPaused && (
              <Button variant="contained" color="success" startIcon={<FontAwesomeIcon icon={faPlay} />} onClick={() => run.resume()}>
                {t('demux.resume')}
              </Button>
            )}
            {run.isConverting && (
              <Button
                variant="contained"
                color="error"
                startIcon={<FontAwesomeIcon icon={faXmark} />}
                onClick={() => setCancelConfirmOpen(true)}
              >
                {t('demux.cancel')}
              </Button>
            )}
          </ActionRow>

          {run.progress && (
            <ErrorBoundary fallback={null}>
              <ProgressBar
                percent={run.progress.percent}
                time={run.progress.time}
                speed={run.progress.speed}
                eta={run.progress.eta}
                paused={run.isPaused}
              />
              {store.current && (
                <Typography variant="caption" color="text.secondary" data-testid="demux-current">
                  {(() => {
                    const [kind, index] = store.current.split(':');
                    return t('demux.currentStream', { kind: t(`mediaInfo.${kind}`), index: Number(index) });
                  })()}
                </Typography>
              )}
            </ErrorBoundary>
          )}

          <ConfirmDialog
            open={cancelConfirmOpen}
            title={t('demux.cancelTitle')}
            message={t('demux.cancelMessage')}
            confirmLabel={t('demux.yes')}
            cancelLabel={t('demux.no')}
            onClose={() => setCancelConfirmOpen(false)}
            onConfirm={() => {
              setCancelConfirmOpen(false);
              run.cancel();
            }}
          />
        </>
      )}
    </PageContainer>
  );
}
