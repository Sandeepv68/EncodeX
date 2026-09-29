/**
 * @fileoverview Remux page. Lets the user repackage streams losslessly into a
 * new container with full stream composition (added subtitles, audio tracks,
 * cover art, chapters), matching the `/remux` route and the Dashboard "Remux"
 * feature card.
 *
 * Workflow: drop or pick a video -> a still frame is previewed and the file is
 * probed (getMediaInfo) and its streams are listed in a table of codec,
 * resolution, frame rate, bitrate, language, sample rate, channels, title, and
 * disposition flags -> choose the target container, tick the streams to keep,
 * and set the output path -> Start Remux. While the remux runs a ProgressBar is
 * shown together with pause, resume, and cancel controls.
 *
 * State is centralized in the `useRemuxStore` zustand store (input, container,
 * probed streams, selected `-map` specs, added assets, chapters, audio sync,
 * output, live compatibility warnings, converting/paused flags, progress);
 * form-level validation errors live in `useFormErrors`. All media work is
 * delegated to the main process through `window.electronAPI` (`getMediaInfo`,
 * `selectOutput`, `convertFile`, `pauseConversion`, `resumeConversion`,
 * `cancelConversion`, `revealFile`).
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
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  faClone,
  faPause,
  faPlay,
  faXmark,
  faCircleInfo,
  faTriangleExclamation,
  faCircleExclamation,
  faPlus,
  faTrashCan,
  faImage,
} from '@fortawesome/free-solid-svg-icons';
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
import { useFormErrors } from '../hooks/useFormErrors';
import { useTaskRunControls } from '../hooks/useMediaTask';
import { useHotkeys } from '../hooks/useHotkeys';
import { SHORTCUT_BY_ID, shortcutHint } from '../constants/shortcuts';
import { focusFirstError } from '../utils/focusFirstError';
import { openFileDialog } from '../utils/fileDialog';
import { fileName } from '../utils/path-utils';
import { SUBTITLE_EXTENSIONS } from '../../shared/file-extensions';
import { VIDEO_DROPZONE_ACCEPT, OUTPUT_VIDEO_EXTENSIONS, AUDIO_EXTENSIONS } from '../../shared/file-extensions';
import { ATTACHED_PIC_DISPOSITION, SUBTITLE_CODEC_CONTAINERS, TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import {
  withExtension,
  isContainerCompatibleWithCover,
  isContainerCompatibleWithChapters,
  type RemuxWarning,
} from '../../shared/codec-containers';
import { useRemuxStore } from '../stores/remuxStore';
import { usePreviewThumbnail } from '../hooks/usePreviewThumbnail';
import { formatBitrate, formatSampleRate } from '../utils/formatters';
import type { MediaStreamInfo, RemuxInput } from '../../shared/types';
import { FieldBox, FieldLabel } from '../styles/form.styles';
import { CompatAlert } from '../styles/Convert.styles';
import { DispositionChip, DispositionRow } from '../styles/StreamDetails.styles';
import { StreamTable } from '../styles/StreamTable.styles';
import { SelectedFileName, ActionRow } from '../styles/AudioExtract.styles';
import { LOG_ARROW, LOG_START_CONVERSION, LOG_VALIDATION_FAILED, LOG_FAILED_TO_GET_MEDIA_INFO } from '../../shared/log-constants';

/**
 * Logger instance scoped to this page. Used to report validation failures and
 * remux starts.
 * @const {Logger} log
 */
const log = new Logger('renderer/pages/Remux');

/**
 * Cover-art image extensions the thumbnail picker accepts.
 * @const {readonly string[]} THUMBNAIL_EXTENSIONS
 */
const THUMBNAIL_EXTENSIONS: readonly string[] = ['jpg', 'jpeg', 'png'];

/**
 * Placeholder shown in a source-stream table cell whose property the probed
 * media does not declare (a video has no sample rate, a subtitle has no
 * resolution). An em dash keeps the cell from collapsing the row's rhythm.
 * @const {string} EMPTY_CELL
 */
const EMPTY_CELL = '—';

/**
 * Renders the channel count of an audio stream together with its declared
 * layout (e.g. `6 (5.1)`), falling back to whichever of the two the probe
 * reported. Returns the empty-cell placeholder when neither is present.
 * @param {MediaStreamInfo} stream - The probed stream to describe.
 * @returns {string} The channel cell text.
 */
function channelCell(stream: MediaStreamInfo): string {
  const layout = stream.channelLayout?.trim();
  if (stream.channels == null) return layout || EMPTY_CELL;
  return layout ? `${stream.channels} (${layout})` : String(stream.channels);
}

/**
 * Renders the remux page (`/remux`).
 *
 * Layout: a drop zone / selected-video box at the top (showing a cached still
 * frame of the chosen file), a target-container select and a source stream
 * table (with checkboxes bound to `selectedMaps`), a live
 * compatibility-warnings panel, the output file field, and the Remux action
 * buttons. While a remux runs a ProgressBar is shown together with
 * pause/resume/cancel buttons; a ConfirmDialog guards cancellation.
 *
 * Local state: only `cancelConfirmOpen` (whether the cancel dialog is open).
 * Everything else lives in `useRemuxStore`: `input`, `container`, `streams`,
 * `selectedMaps`, `output`, `warnings`, `isConverting`, `isPaused`, and
 * `progress`. Run controls come from `useTaskRunControls(useRemuxStore)` since
 * the store owns the remux lifecycle (see REMUX_DEMUX_PLAN Task 14 note).
 *
 * @returns {JSX.Element} The page content inside a PageContainer.
 */
export default function RemuxPage() {
  const { t } = useTranslation();
  const store = useRemuxStore();
  const { errors, setErrors, clearFieldError, setFieldError } = useFormErrors();
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  /**
   * Data URL of the chosen cover-art image, or null while none is picked or the
   * preview has not loaded.
   * @type {string | null}
   */
  const thumbnailPreview = usePreviewThumbnail(store.thumbnail?.path);

  /**
   * Data URL of a still frame from the selected video, or null while no input
   * is chosen or the frame has not loaded. Rendered as the wide preview above
   * the stream table so the user can confirm they picked the right file before
   * remuxing.
   * @type {string | null}
   */
  const inputPreview = usePreviewThumbnail(store.input);

  const run = useTaskRunControls(useRemuxStore);

  /**
   * Row data for the source stream table: each non-cover stream paired with the
   * `-map` spec (0:v:0 / 0:a:1 / 0:s:0) it contributes. The ordinal replicates
   * the store's buildStreamMaps convention so checkbox state and the remux plan
   * always agree.
   * @type {Array<{stream: MediaStreamInfo; spec: string}>}
   */
  const streamRows = useMemo(() => {
    const ordinals: Record<string, number> = { video: 0, audio: 0, subtitle: 0 };
    const rows: { stream: MediaStreamInfo; spec: string }[] = [];
    for (const stream of store.streams) {
      if (stream.disposition?.includes(ATTACHED_PIC_DISPOSITION)) continue;
      const spec = `0:${stream.type[0]}:${ordinals[stream.type]++}`;
      rows.push({ stream, spec });
    }
    return rows;
  }, [store.streams]);

  /**
   * Whether at least one audio stream from the primary input is currently
   * selected. The primary-audio sync control (lossless re-read shift) only
   * makes sense while such a stream is present.
   * @type {boolean}
   */
  const hasSelectedAudio = useMemo(
    () => streamRows.some(({ stream, spec }) => stream.type === 'audio' && store.selectedMaps.includes(spec)),
    [streamRows, store.selectedMaps],
  );

  /**
   * Target-codec options for added subtitle tracks, derived from the chosen
   * container's `SUBTITLE_CODEC_CONTAINERS` guidance plus stream copy. The
   * container-specific codecs come first and the default is their first entry.
   * @type {string[]}
   */
  const subtitleCodecOptions = useMemo(() => {
    const allowed = SUBTITLE_CODEC_CONTAINERS[store.container] ?? ['subrip'];
    return [...allowed, 'copy'];
  }, [store.container]);

  /**
   * Handles a newly selected or dropped video file by letting the store probe
   * it (populating `streams`, `selectedMaps`, and the auto-suggested output).
   * @param {string} path - Absolute path of the selected video file.
   * @returns {Promise<void>} Resolves once the probe settles.
   */
  const handleFileSelect = async (path: string) => {
    await store.setInput(path);
  };

  /**
   * Opens a multi-file subtitle picker (.srt/.ass/.vtt) and adds every chosen
   * file as an extra-input subtitle track. Each entry's `map` targets its own
   * input index (`N:0`, 1-based) and its codec defaults to the container's
   * first allowed subtitle codec (stream copy is offered but not the default).
   * @returns {Promise<void>} Resolves once the picker settles.
   */
  const handleAddSubtitles = async () => {
    const files = await window.electronAPI.selectFiles([{ name: 'Subtitle Files', extensions: [...SUBTITLE_EXTENSIONS] }]);
    if (!files || files.length === 0) return;
    const baseIndex = store.addedSubtitles.length;
    const defaultCodec = SUBTITLE_CODEC_CONTAINERS[store.container]?.[0] ?? 'subrip';
    files.forEach((file, i) => {
      const input: RemuxInput = {
        path: file,
        map: [`${baseIndex + i + 1}:0`],
        codec: defaultCodec,
      };
      store.addSubtitleFile(input);
    });
  };

  /**
   * Opens a multi-file audio picker (.m4a/.aac/.mp3/.flac/.opus/.ogg/.wav) and
   * adds every chosen file as an extra-input audio track. Each entry's `map`
   * targets its own input index (`N:0`, 1-based, after subtitles) with
   * `codec: 'copy'`, and the track's stream-0 info is probed via
   * `getMediaInfo` so the UI can display codec/channels next to it.
   * @returns {Promise<void>} Resolves once the picker and probes settle.
   */
  const handleAddAudio = async () => {
    const files = await window.electronAPI.selectFiles([{ name: 'Audio Files', extensions: [...AUDIO_EXTENSIONS] }]);
    if (!files || files.length === 0) return;
    const baseIndex = store.addedSubtitles.length + store.addedAudio.length;
    for (let i = 0; i < files.length; i += 1) {
      const path = files[i];
      const input: RemuxInput = { path, map: [`${baseIndex + i + 1}:0`], codec: 'copy' };
      let info: MediaStreamInfo | undefined;
      try {
        const media = await window.electronAPI.getMediaInfo(path, TRANSCODER_TYPES[0]);
        info = media.streams?.find((s) => s.type === 'audio');
      } catch (err: unknown) {
        log.error(LOG_FAILED_TO_GET_MEDIA_INFO, err);
      }
      store.addAudioFile(input, info);
    }
  };

  /**
   * Opens a single-image picker (.jpg/.jpeg/.png) and stores the cover art as
   * the `thumbnail` RemuxInput, composed container-aware: MKV/WebM entries
   * attach the picture (`attachment: true`, no `-map`), while MP4/MOV entries
   * map the image as an extra video stream with the `attached_pic` disposition.
   * Containers supporting neither get the picker disabled and an inline hint.
   * @returns {Promise<void>} Resolves once the picker settles.
   */
  const handleAddThumbnail = async () => {
    const file = await window.electronAPI.selectFile([{ name: 'Thumbnail / Cover Art', extensions: [...THUMBNAIL_EXTENSIONS] }]);
    if (!file) return;
    const attachment = store.container === 'mkv' || store.container === 'webm';
    const input: RemuxInput = attachment
      ? { path: file, map: [], attachment: true }
      : { path: file, map: [`${1 + store.addedSubtitles.length + store.addedAudio.length}:0`], disposition: ATTACHED_PIC_DISPOSITION };
    store.setThumbnail(input);
  };

  /**
   * Whether the currently selected target container can store cover art.
   * MKV/WebM accept an attached picture; MP4/MOV accept an `attached_pic`
   * disposition; other containers expose neither (picker disabled + hint).
   * @type {boolean}
   */
  const thumbnailSupported = useMemo(() => isContainerCompatibleWithCover(store.container), [store.container]);

  /**
   * Whether the selected target container stores chapter metadata. Containers
   * outside the MP4/MOV/MKV set drop chapters on remux, so the import chapter
   * picker is disabled and an inline hint is shown.
   * @type {boolean}
   */
  const chaptersSupported = useMemo(() => isContainerCompatibleWithChapters(store.container), [store.container]);

  /**
   * Opens a single FFMETADATA picker (.ffmeta/.txt) and stores it as the
   * `chaptersFile`, which replaces the source-chapter copy emission with `-map_chapters N+1`.
   * @returns {Promise<void>} Resolves once the picker settles.
   */
  const handleAddChapters = async () => {
    const file = await window.electronAPI.selectFile([{ name: 'Chapters (FFMETADATA)', extensions: ['ffmeta', 'txt'] }]);
    if (!file) return;
    store.setChaptersFile(file);
  };

  /**
   * Clears the current selection (input, streams, maps, added assets, output)
   * via the store and resets all field errors.
   * @returns {void}
   */
  const clearSelection = () => {
    store.clearSelection();
    setErrors({});
  };

  /**
   * Normalizes a typed output path to carry the target container extension.
   * Empty values clear the field. The `output` field error is cleared.
   * @param {string} value - The raw output path typed by the user.
   * @returns {void}
   */
  const handleOutputChange = (value: string) => {
    store.setOutput(value.trim() ? withExtension(value, store.container) : '');
    clearFieldError('output');
  };

  /**
   * Applies the container extension to a browsed output file and stores it.
   * @param {string} f - The absolute output path from the save dialog.
   * @returns {void}
   */
  const applyBrowsedOutput = (f: string) => {
    store.setOutput(withExtension(f, store.container));
    clearFieldError('output');
  };

  /**
   * Validates the remux form. Currently only requires a non-empty output path;
   * on failure an `output` error is registered and false is returned.
   * @returns {boolean} True when validation passes and the remux may start.
   */
  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!store.output.trim()) next.output = t('validation.outputRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) focusFirstError(next, ['output'], { output: 'remux-output' });
    return Object.keys(next).length === 0;
  };

  /**
   * Validates the form and, when valid, logs the parameters and starts the
   * remux through the store's `startRemux` (which calls
   * `window.electronAPI.convertFile`). On validation failure a warning is
   * logged and nothing is started.
   * @returns {Promise<void>} Resolves when the remux finishes or fails.
   */
  const handleStart = async () => {
    if (!validate()) {
      log.warn(LOG_VALIDATION_FAILED);
      return;
    }
    log.info(LOG_START_CONVERSION, store.input, LOG_ARROW, store.output, 'container', store.container);
    await store.startRemux();
  };

  /**
   * Registers the page keyboard shortcuts (Ctrl+O input, Ctrl+Enter start).
   * Bindings mirror the enabled state of the equivalent on-page controls.
   * @returns {void}
   */
  useHotkeys([
    {
      id: 'remux.input',
      handler: async () => {
        const file = await openFileDialog(VIDEO_DROPZONE_ACCEPT);
        if (file) handleFileSelect(file);
      },
    },
    { id: 'remux.start', handler: () => handleStart(), enabled: !!store.input && !!store.output && !store.isConverting },
  ]);

  return (
    <PageContainer title={t('remux.title')} icon={pageIcons['/remux']}>
      <Box>
        <FieldLabel>
          {t('remux.videoFile')}
          <InfoTooltip title={t('remux.videoFileHint')} />
        </FieldLabel>
        {!store.input && (
          <ErrorBoundary fallback={null}>
            <FileDropZone onFileSelect={handleFileSelect} label={t('remux.dropLabel')} accept={VIDEO_DROPZONE_ACCEPT} />
          </ErrorBoundary>
        )}
        {store.input && (
          <MediaPreview
            imageSrc={inputPreview}
            alt={fileName(store.input)}
            removeLabel={t('batchQueue.remove')}
            testId="remux-video"
            removeTestId="remove-remux-video"
            variant="wide"
            onRemove={clearSelection}
          >
            <Typography variant="body2" color="text.secondary" data-testid="selected-video">
              {(() => {
                const template = t('remux.selectedVideo', { file: '{{file}}' });
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
              {store.streams.length > 0 ? t('remux.streamCount', { selected: store.selectedMaps.length, total: store.streams.length }) : ''}
            </Typography>
          </MediaPreview>
        )}
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <FieldBox>
          <FieldLabel>
            {t('remux.container')}
            <InfoTooltip title={t('remux.containerHint')} />
          </FieldLabel>
          <TextField
            select
            fullWidth
            size="small"
            value={store.container}
            onChange={(e) => store.setContainer(e.target.value)}
            data-testid="remux-container"
            slotProps={{ htmlInput: { 'aria-label': t('remux.container') } }}
          >
            {OUTPUT_VIDEO_EXTENSIONS.map((ext) => (
              <MenuItem key={ext} value={ext}>
                {ext}
              </MenuItem>
            ))}
          </TextField>
        </FieldBox>
      </Stack>

      <FieldBox>
        <FieldLabel>
          {t('remux.streams')}
          <InfoTooltip title={t('remux.streamsHint')} />
        </FieldLabel>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 1 }}>
            <Button
              size="small"
              variant="outlined"
              disabled={store.isConverting}
              onClick={() => store.setAllStreamsSelected(true)}
              data-testid="remux-select-all"
            >
              {t('remux.selectAll')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={store.isConverting}
              onClick={() => store.setAllStreamsSelected(false)}
              data-testid="remux-select-none"
            >
              {t('remux.selectNone')}
            </Button>
          </Stack>
        </Box>
        <ErrorBoundary fallback={null}>
          <TableContainer>
            <StreamTable size="small" aria-label={t('remux.streams')}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>{t('remux.streamIndex')}</TableCell>
                  <TableCell>{t('remux.kind')}</TableCell>
                  <TableCell>{t('mediaInfo.codec')}</TableCell>
                  <TableCell>{t('mediaInfo.resolution')}</TableCell>
                  <TableCell>{t('mediaInfo.frameRate')}</TableCell>
                  <TableCell>{t('mediaInfo.bitrate')}</TableCell>
                  <TableCell>{t('mediaInfo.language')}</TableCell>
                  <TableCell>{t('mediaInfo.sampleRate')}</TableCell>
                  <TableCell>{t('mediaInfo.channels')}</TableCell>
                  <TableCell>{t('mediaInfo.streamTitle')}</TableCell>
                  <TableCell>{t('mediaInfo.disposition')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {streamRows.map(({ stream, spec }) => (
                  <TableRow key={stream.index} data-testid="remux-stream-row">
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={store.selectedMaps.includes(spec)}
                        onChange={() => store.toggleStream(spec)}
                        aria-label={t('remux.selectStream', { kind: t(`mediaInfo.${stream.type}`), index: stream.index })}
                      />
                    </TableCell>
                    <TableCell>{stream.index}</TableCell>
                    <TableCell>{t(`mediaInfo.${stream.type}`)}</TableCell>
                    <TableCell>{stream.codec}</TableCell>
                    <TableCell>{stream.width && stream.height ? `${stream.width}×${stream.height}` : EMPTY_CELL}</TableCell>
                    <TableCell>{stream.frameRate ? `${stream.frameRate} fps` : EMPTY_CELL}</TableCell>
                    <TableCell>{stream.bitrate ? formatBitrate(stream.bitrate) : EMPTY_CELL}</TableCell>
                    <TableCell>{stream.language ?? EMPTY_CELL}</TableCell>
                    <TableCell>{formatSampleRate(stream.sampleRate) || EMPTY_CELL}</TableCell>
                    <TableCell>{channelCell(stream)}</TableCell>
                    <TableCell>{stream.title ?? EMPTY_CELL}</TableCell>
                    <TableCell>
                      {stream.disposition && stream.disposition.length > 0 ? (
                        <DispositionRow>
                          {stream.disposition.map((flag) => (
                            <DispositionChip
                              key={flag}
                              label={t(`mediaInfo.dispositionFlags.${flag}`, { defaultValue: flag })}
                              size="small"
                            />
                          ))}
                        </DispositionRow>
                      ) : (
                        EMPTY_CELL
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </StreamTable>
          </TableContainer>
        </ErrorBoundary>
      </FieldBox>

      <FieldBox>
        <FieldLabel>
          {t('remux.subtitles')}
          <InfoTooltip title={t('remux.subtitlesHint')} />
        </FieldLabel>
        <Button
          size="small"
          variant="outlined"
          startIcon={<FontAwesomeIcon icon={faPlus} />}
          disabled={store.isConverting}
          onClick={handleAddSubtitles}
          data-testid="remux-add-subtitle"
        >
          {t('remux.addSubtitle')}
        </Button>
        {store.addedSubtitles.length > 0 && (
          <Stack spacing={1} sx={{ mt: 1 }} data-testid="remux-subtitles">
            {store.addedSubtitles.map((entry, index) => (
              <Box key={entry.path} sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="remux-added-subtitle">
                <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                  {fileName(entry.path)}
                </Typography>
                <TextField
                  select
                  size="small"
                  value={entry.codec ?? 'copy'}
                  onChange={(e) => store.setAddedStreamCodec(index, e.target.value)}
                  disabled={store.isConverting}
                  sx={{ minWidth: 140 }}
                  slotProps={{
                    htmlInput: { 'data-testid': `remux-subtitle-codec-${index}`, 'aria-label': t('remux.subtitleCodec') },
                  }}
                >
                  {subtitleCodecOptions.map((codec) => (
                    <MenuItem key={codec} value={codec}>
                      {codec}
                    </MenuItem>
                  ))}
                </TextField>
                <Tooltip title={t('remux.subtitleCodecHint')} arrow>
                  <span>
                    <FontAwesomeIcon icon={faCircleInfo} size="sm" />
                  </span>
                </Tooltip>
                <Tooltip title={t('remux.removeSubtitle')} arrow>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => store.removeAddedStream(index)}
                    disabled={store.isConverting}
                    data-testid={`remux-remove-subtitle-${index}`}
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Stack>
        )}
      </FieldBox>

      <FieldBox>
        <FieldLabel>
          {t('remux.audioTracks')}
          <InfoTooltip title={t('remux.audioTracksHint')} />
        </FieldLabel>
        <Button
          size="small"
          variant="outlined"
          startIcon={<FontAwesomeIcon icon={faPlus} />}
          disabled={store.isConverting}
          onClick={handleAddAudio}
          data-testid="remux-add-audio"
        >
          {t('remux.addAudioTrack')}
        </Button>
        {store.addedAudio.length > 0 && (
          <Stack spacing={1} sx={{ mt: 1 }} data-testid="remux-audio-tracks">
            {store.addedAudio.map((entry, index) => {
              const info = store.addedAudioInfo[index];
              const combinedIndex = store.addedSubtitles.length + index;
              return (
                <Box key={entry.path} sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="remux-added-audio">
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ flex: 1 }}
                    title={`${fileName(entry.path)}${info ? ` • ${info.codec} ${info.channels != null ? `${info.channels}ch` : ''}` : ''}`}
                  >
                    {fileName(entry.path)}
                  </Typography>
                  {info && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {info.codec}
                      {info.channels != null ? ` • ${info.channels}ch` : ''}
                      {info.language ? ` • ${info.language}` : ''}
                    </Typography>
                  )}
                  <TextField
                    type="number"
                    size="small"
                    value={entry.syncOffsetSeconds ?? ''}
                    disabled={store.isConverting}
                    onChange={(e) => {
                      const raw = e.target.value;
                      store.setAddedStreamSync(combinedIndex, raw === '' ? 0 : Number(raw));
                    }}
                    sx={{ minWidth: 130, maxWidth: 170 }}
                    slotProps={{
                      htmlInput: {
                        'aria-label': t('remux.addedTrackDelay'),
                        step: '0.1',
                        'data-testid': `remux-audio-delay-${index}`,
                      },
                      input: {
                        endAdornment: <InputAdornment position="end">s</InputAdornment>,
                      },
                    }}
                  />
                  <Tooltip title={t('remux.removeAudioTrack')} arrow>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => store.removeAddedStream(combinedIndex)}
                      disabled={store.isConverting}
                      data-testid={`remux-remove-audio-${index}`}
                    >
                      <FontAwesomeIcon icon={faTrashCan} />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
          </Stack>
        )}
      </FieldBox>

      <FieldBox>
        <FieldLabel>
          {t('remux.thumbnail')}
          <InfoTooltip title={t('remux.thumbnailHint')} />
        </FieldLabel>
        <Button
          size="small"
          variant="outlined"
          startIcon={<FontAwesomeIcon icon={faImage} />}
          disabled={store.isConverting || !thumbnailSupported}
          onClick={handleAddThumbnail}
          data-testid="remux-add-thumbnail"
        >
          {t('remux.addThumbnail')}
        </Button>
        {!thumbnailSupported && (
          <Typography variant="caption" color="text.secondary" data-testid="remux-thumbnail-unsupported">
            {t('remux.thumbnailUnsupported', { container: store.container })}
          </Typography>
        )}
        {store.thumbnail && (
          <MediaPreview
            imageSrc={thumbnailPreview}
            alt={fileName(store.thumbnail.path)}
            removeLabel={t('remux.removeThumbnail')}
            testId="remux-thumbnail"
            removeTestId="remux-remove-thumbnail"
            variant="square"
            onRemove={() => store.setThumbnail(null)}
          >
            <Typography variant="body2" color="text.secondary" data-testid="selected-thumbnail">
              {fileName(store.thumbnail.path)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('remux.thumbnailMode', {
                mode: store.thumbnail.attachment ? t('remux.thumbnailAttached') : t('remux.thumbnailDisposition'),
              })}
            </Typography>
          </MediaPreview>
        )}
      </FieldBox>

      <FieldBox>
        <FieldLabel>
          {t('remux.chapters')}
          <InfoTooltip title={t('remux.chaptersHint')} />
        </FieldLabel>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Tooltip title={t('remux.copyChaptersHint')} arrow>
            <span>
              <Button
                size="small"
                variant={store.copyChapters && !store.chaptersFile ? 'contained' : 'outlined'}
                disabled={store.isConverting || !!store.chaptersFile}
                onClick={() => store.setCopyChapters(!store.copyChapters)}
                data-testid="remux-copy-chapters"
              >
                {t('remux.copyChapters')}
              </Button>
            </span>
          </Tooltip>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FontAwesomeIcon icon={faPlus} />}
            disabled={store.isConverting || !chaptersSupported}
            onClick={handleAddChapters}
            data-testid="remux-add-chapters"
          >
            {t('remux.importChapters')}
          </Button>
          {!chaptersSupported && (
            <Typography variant="caption" color="text.secondary" data-testid="remux-chapters-unsupported">
              {t('remux.chaptersUnsupported', { container: store.container })}
            </Typography>
          )}
          {store.chaptersFile && (
            <Box key={store.chaptersFile} sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="remux-chapters-file">
              <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                {fileName(store.chaptersFile)}
              </Typography>
              <Tooltip title={t('remux.removeChapters')} arrow>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => store.setChaptersFile(null)}
                  disabled={store.isConverting}
                  data-testid="remux-remove-chapters"
                >
                  <FontAwesomeIcon icon={faTrashCan} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
      </FieldBox>

      {hasSelectedAudio && (
        <FieldBox>
          <FieldLabel>
            {t('remux.audioSync')}
            <InfoTooltip title={t('remux.audioSyncHint')} />
          </FieldLabel>
          <TextField
            type="number"
            size="small"
            fullWidth
            disabled={store.isConverting}
            value={store.audioSyncSeconds ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              store.setAudioSync(raw === '' ? null : Number(raw));
            }}
            slotProps={{
              htmlInput: {
                'aria-label': t('remux.audioSync'),
                step: '0.1',
                'data-testid': 'remux-audio-sync',
              },
              input: {
                endAdornment: <InputAdornment position="end">s</InputAdornment>,
              },
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {t('remux.audioSyncLossless')}
          </Typography>
        </FieldBox>
      )}

      <FieldBox>
        <FieldLabel>
          {t('remux.filtersTitle')}
          <InfoTooltip title={t('remux.filtersHint')} />
        </FieldLabel>
        <VideoFiltersSection filterEntries={store.videoFilters} onChange={store.setVideoFilters} disabled={store.isConverting} />
      </FieldBox>

      {store.videoFilters.length > 0 && (
        <CompatAlert severity="warning" data-testid="remux-filters-reencode">
          {t('remux.filtersReencodeWarning', { count: store.videoFilters.length })}
        </CompatAlert>
      )}

      {store.warnings.length > 0 && (
        <FieldBox>
          <FieldLabel>
            {t('remux.warnings')}
            <InfoTooltip title={t('remux.warningsHint')} />
          </FieldLabel>
          <Stack spacing={1} data-testid="remux-warnings">
            {store.warnings.map((warning: RemuxWarning, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }} data-testid="remux-warning">
                <FontAwesomeIcon
                  icon={warning.icon === 'error' ? faCircleExclamation : warning.icon === 'warning' ? faTriangleExclamation : faCircleInfo}
                  color={warning.icon === 'error' ? 'error' : warning.icon === 'warning' ? 'warning' : undefined}
                />
                <Typography variant="body2" color="text.secondary">
                  {warning.message}
                </Typography>
              </Box>
            ))}
          </Stack>
        </FieldBox>
      )}

      <FilePathField
        label={t('remux.outputFile')}
        hint={t('remux.outputFileHint')}
        required
        value={store.output}
        placeholder={t('remux.placeholderOutput')}
        buttonLabel={t('convert.browse')}
        onChange={handleOutputChange}
        testId="remux-output"
        onBlur={() => {
          if (!store.output.trim()) setFieldError('output', t('validation.outputRequired'));
        }}
        error={errors.output}
        onBrowse={async () => {
          const f = await window.electronAPI.selectOutput();
          if (f) applyBrowsedOutput(f);
        }}
      />

      <ActionRow direction="row" spacing={1} useFlexGap>
        <Tooltip title={shortcutHint(t, 'remux.start', SHORTCUT_BY_ID['remux.start'].keys)} arrow>
          <span>
            <Button
              variant="contained"
              startIcon={<FontAwesomeIcon icon={faClone} />}
              onClick={handleStart}
              disabled={!store.input || !store.output || store.isConverting}
              data-testid="remux-start"
            >
              {store.isConverting ? t('remux.remuxing') : t('remux.start')}
            </Button>
          </span>
        </Tooltip>
        {run.isConverting && !run.isPaused && (
          <Button variant="contained" color="warning" startIcon={<FontAwesomeIcon icon={faPause} />} onClick={() => run.pause()}>
            {t('remux.pause')}
          </Button>
        )}
        {run.isConverting && run.isPaused && (
          <Button variant="contained" color="success" startIcon={<FontAwesomeIcon icon={faPlay} />} onClick={() => run.resume()}>
            {t('remux.resume')}
          </Button>
        )}
        {run.isConverting && (
          <Button
            variant="contained"
            color="error"
            startIcon={<FontAwesomeIcon icon={faXmark} />}
            onClick={() => setCancelConfirmOpen(true)}
          >
            {t('remux.cancel')}
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
        </ErrorBoundary>
      )}

      <ConfirmDialog
        open={cancelConfirmOpen}
        title={t('remux.cancelTitle')}
        message={t('remux.cancelMessage')}
        confirmLabel={t('remux.yes')}
        cancelLabel={t('remux.no')}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={() => {
          setCancelConfirmOpen(false);
          run.cancel();
        }}
      />
    </PageContainer>
  );
}
