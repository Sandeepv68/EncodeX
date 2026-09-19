/**
 * @fileoverview Interactive video cutting timeline.
 *
 * Renders a zoomable, scrollable timeline for trimming a video. A ruler shows
 * time ticks and start/end marker bubbles, the video track shows a thumbnail
 * strip, and the audio track renders an amplitude waveform. The region between
 * the start and end markers is kept, while dimmed regions highlight the
 * portions trimmed away.
 *
 * The timeline supports pointer interactions: dragging the playhead scrubs,
 * dragging the start/end handles trims, and dragging the kept region moves the
 * whole selection. Zoom is controlled via toolbar buttons that keep the view
 * centered on the current position, and the viewport auto-scrolls to follow
 * the playhead during playback. Waveform bars, thumbnails, and ruler ticks are
 * virtualized to the visible range for performance.
 *
 * Props (see {@link VideoTimelineProps}):
 *  - duration: total clip duration in seconds.
 *  - currentTime: playhead position in seconds.
 *  - start/end: current in/out trim points in seconds.
 *  - waveform/thumbnails: optional visualization data plus loading flags.
 *  - audioEnabled: whether the audio track is retained in the cut.
 *  - videoStream/audioStream: stream summaries shown in info bubbles.
 *  - onSeek/onStartChange/onEndChange/onAudioEnabledChange: change callbacks.
 */

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Checkbox, CircularProgress, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlassPlus, faMagnifyingGlassMinus, faVideo, faMusic, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import {
  TimelineRoot,
  TimelineToolbar,
  TimelineTimeText,
  PreviewBadge,
  ZoomButton,
  ZoomControls,
  TrackLabelPanel,
  TrackLabel,
  VideoTrackLabel,
  AudioTrackLabel,
  TrackRow,
  RulerSpacer,
  TrackIconBox,
  TrackSkeleton,
  MoveIndicator,
  Viewport,
  Scroller,
  Ruler,
  RulerTick,
  RulerMinorTick,
  RulerLabel,
  MarkerBubble,
  Lane,
  VideoTrack,
  AudioTrack,
  ThumbCell,
  WaveformBar,
  KeptRegion,
  DimmedRegion,
  TrimHandle,
  PlayheadLine,
  PlayheadHead,
  TrackBubbleAnchor,
  TrackInfoBubble,
  ScrollShadowAnchor,
  ScrollShadow,
  TIMELINE_LAYOUT,
} from '../styles/VideoTimeline.styles';
import { formatClockTime, formatStreamSummary } from '../utils/formatters';
import type { DragKind, VideoTimelineProps } from './types';
import {
  DEFAULT_TIMELINE_WIDTH,
  TIMELINE_MIN_ZOOM,
  TIMELINE_MAX_ZOOM,
  TIMELINE_ZOOM_STEP,
  TIMELINE_MIN_GAP,
  TIMELINE_THUMB_MONTAGE_CLASS,
} from '../../shared/constants';
import { clamp } from '../../shared/math';
import {
  initialZoom,
  timeFromEvent as timeFromEventAt,
  computeTimelineZoom,
  zoomCenterScrollLeft,
  computeRulerTicks,
  computeWaveformBars,
} from '../utils/timeline-utils';

/**
 * Renders the interactive video cutting timeline.
 *
 * Layers the ruler (top), the video thumbnail track, and the audio waveform
 * track onto a scrollable scroller. Pointer drags are dispatched by data-kind
 * to scrub the playhead, trim the start/end handles, or move the whole kept
 * selection; the kept region between start/end is highlighted while the
 * trimmed portions are dimmed. Track info bubbles summarize the video and
 * audio streams, and an audio-enabled checkbox controls whether the audio
 * track is kept in the cut. Returns null while the duration is not yet known
 * (<= 0).
 *
 * @param {VideoTimelineProps} props - Component props.
 * @param {number} props.duration - Clip duration in seconds.
 * @param {number} props.currentTime - Current playhead time in seconds.
 * @param {number} props.start - Start (in) trim point in seconds.
 * @param {number} props.end - End (out) trim point in seconds.
 * @param {WaveformData | null} [props.waveform] - Waveform data for the audio
 *   track.
 * @param {ThumbnailStrip | null} [props.thumbnails] - Thumbnail strip data for
 *   the video track.
 * @param {boolean} [props.waveformLoading] - Shows a skeleton while true.
 * @param {boolean} [props.thumbnailsLoading] - Shows a skeleton while true.
 * @param {boolean} [props.audioEnabled] - Whether the audio track is retained
 *   in the cut.
 * @param {MediaStreamInfo | null} [props.videoStream] - Video stream summary
 *   bubble.
 * @param {MediaStreamInfo | null} [props.audioStream] - Audio stream summary
 *   bubble.
 * @param {number | null} [props.zoom] - Controlled zoom level (pixels per
 *   second). When a number is provided the timeline is zoom-controlled by the
 *   parent (its internal duration-based auto-fit is disabled); null keeps the
 *   auto-fit behavior.
 * @param {(zoom: number) => void} [props.onZoomChange] - Called with the next
 *   zoom level when the zoom buttons are used in controlled mode.
 * @param {(time: number) => void} props.onSeek - Called when the playhead is
 *   scrubbed.
 * @param {(time: number) => void} props.onStartChange - Called when the start
 *   trim point changes.
 * @param {(time: number) => void} props.onEndChange - Called when the end trim
 *   point changes.
 * @param {(enabled: boolean) => void} [props.onAudioEnabledChange] - Called
 *   when the audio-enabled checkbox is toggled.
 * @returns {JSX.Element | null} The timeline, or null when duration <= 0.
 */
export default function VideoTimeline({
  duration,
  currentTime,
  start,
  end,
  waveform = null,
  thumbnails = null,
  waveformLoading = false,
  thumbnailsLoading = false,
  audioEnabled = true,
  videoStream = null,
  audioStream = null,
  zoom: zoomProp = null,
  onZoomChange,
  onSeek,
  onStartChange,
  onEndChange,
  onAudioEnabledChange,
}: VideoTimelineProps) {
  const { t } = useTranslation();
  /**
   * Reference to the scrollable viewport element; used for scroll/zoom math
   * and scroll listening.
   * @type {React.RefObject<HTMLDivElement>}
   */
  const viewportRef = useRef<HTMLDivElement>(null);
  /**
   * Reference to the scroller (track surface) element; used to map pointer
   * client X coordinates to media time.
   * @type {React.RefObject<HTMLDivElement>}
   */
  const scrollerRef = useRef<HTMLDivElement>(null);
  /**
   * Kind of drag currently active (playhead, start, end, move, scrub), or null
   * when idle.
   * @type {React.MutableRefObject<DragKind | null>}
   */
  const dragRef = useRef<DragKind | null>(null);
  /**
   * Media time at which a 'move' drag started.
   * @type {React.MutableRefObject<number>}
   */
  const dragOriginRef = useRef(0);
  /**
   * Start trim point captured when a 'move' drag began, used to compute the
   * delta.
   * @type {React.MutableRefObject<number>}
   */
  const dragBaseStartRef = useRef(0);
  /**
   * End trim point captured when a 'move' drag began, used to compute the
   * delta.
   * @type {React.MutableRefObject<number>}
   */
  const dragBaseEndRef = useRef(0);
  /**
   * Previous currentTime, used by the auto-scroll effect to detect forward
   * playhead motion.
   * @type {React.MutableRefObject<number>}
   */
  const prevTimeRef = useRef(currentTime);
  /**
   * Internal zoom state, used only in uncontrolled mode (when the `zoom` prop is
   * null). Initialized to fit the full clip at the default timeline width.
   * @type {number}
   */
  const [zoomState, setZoomState] = useState<number>(() => initialZoom(duration));
  /**
   * Whether the zoom is controlled by the parent (a numeric `zoom` prop).
   * @type {boolean}
   */
  const isControlledZoom = zoomProp !== null;
  /**
   * Active zoom in pixels per second: the controlled prop when provided,
   * otherwise the internal auto-fit state.
   * @type {number}
   */
  const zoom = isControlledZoom ? (zoomProp as number) : zoomState;
  const [viewState, setViewState] = useState({ scrollLeft: 0, viewportWidth: 600 });
  /**
   * Previous duration, used to re-initialize the zoom whenever the clip
   * duration changes. Skipped in controlled mode so the parent's cached zoom is
   * never reset.
   * @type {React.MutableRefObject<number>}
   */
  const prevDurationRef = useRef(duration);
  if (prevDurationRef.current !== duration) {
    prevDurationRef.current = duration;
    if (!isControlledZoom) setZoomState(initialZoom(duration));
  }
  /**
   * Live snapshot of zoom/duration/trim points and the change callbacks, kept
   * in a ref so window-level pointer handlers always read current values
   * without re-binding.
   * @type {React.MutableRefObject<{ zoom: number; duration: number; start: number; end: number; onSeek: (time: number) => void; onStartChange: (time: number) => void; onEndChange: (time: number) => void }>}
   */
  const stateRef = useRef({ zoom: 1, duration: 0, start: 0, end: 0, onSeek, onStartChange, onEndChange });
  stateRef.current = { zoom, duration, start, end, onSeek, onStartChange, onEndChange };

  /**
   * Converts a pointer client X position into a media time by offsetting it
   * from the scroller's left edge and dividing by the current zoom.
   * @param {number} clientX - Pointer X coordinate relative to the viewport.
   * @returns {number} Time in seconds clamped to [0, duration].
   */
  const timeFromEvent = (clientX: number): number => {
    const el = scrollerRef.current;
    if (!el) return 0;
    return timeFromEventAt(clientX, el.getBoundingClientRect().left, zoom, duration);
  };

  /**
   * Window-level pointermove handler active during a drag. Dispatches by drag
   * kind: trims the start/end handles (respecting TIMELINE_MIN_GAP), shifts
   * the whole selection for 'move', or seeks for 'playhead'/'scrub'.
   * @param {PointerEvent} e - The window pointermove event.
   * @returns {void}
   */
  const onWindowPointerMove = (e: PointerEvent) => {
    const kind = dragRef.current;
    if (!kind) return;
    const s = stateRef.current;
    const time = timeFromEvent(e.clientX);
    if (kind === 'start') s.onStartChange(clamp(time, 0, Math.max(0, s.end - TIMELINE_MIN_GAP)));
    else if (kind === 'end') s.onEndChange(clamp(time, Math.min(s.duration, s.start + TIMELINE_MIN_GAP), s.duration));
    else if (kind === 'move') {
      const width = dragBaseEndRef.current - dragBaseStartRef.current;
      const newStart = clamp(dragBaseStartRef.current + (time - dragOriginRef.current), 0, Math.max(0, s.duration - width));
      s.onStartChange(newStart);
      s.onEndChange(newStart + width);
    } else s.onSeek(time);
  };

  /**
   * Ends the active drag: clears dragRef and removes the window pointer
   * listeners.
   * @returns {void}
   */
  const onWindowPointerUp = () => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onWindowPointerMove);
    window.removeEventListener('pointerup', onWindowPointerUp);
  };

  /**
   * Begins a pointer interaction on the scroller. If the target has a
   * data-kind attribute, starts a trim or move drag (capturing the move
   * baselines); otherwise starts a scrub and seeks immediately. Attaches
   * window pointer listeners and prevents the default text-selection
   * behavior.
   * @param {React.PointerEvent} e - The pointerdown event.
   * @returns {void}
   */
  const handlePointerDown = (e: React.PointerEvent) => {
    const kind = (e.target as HTMLElement).closest('[data-kind]')?.getAttribute('data-kind') as DragKind | null;
    if (kind) {
      dragRef.current = kind;
      if (kind === 'move') {
        dragOriginRef.current = timeFromEvent(e.clientX);
        dragBaseStartRef.current = stateRef.current.start;
        dragBaseEndRef.current = stateRef.current.end;
      }
    } else {
      dragRef.current = 'scrub';
      onSeek(timeFromEvent(e.clientX));
    }
    e.preventDefault();
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
  };

  /**
   * Cleanup effect that removes any window pointer listeners on unmount.
   * @returns {void}
   */
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
    };
  }, []);

  /**
   * Tracks the viewport's scroll position and size (via a passive scroll
   * listener and a ResizeObserver) into viewState so the ruler, waveform,
   * and thumbnails can virtualize to the visible range.
   * @returns {void}
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    /**
     * Snapshots the viewport's current scrollLeft and clientWidth into
     * viewState, skipping redundant updates.
     * @returns {void}
     */
    const update = () => {
      setViewState((prev) => {
        const next = { scrollLeft: viewport.scrollLeft, viewportWidth: viewport.clientWidth };
        if (prev.scrollLeft === next.scrollLeft && prev.viewportWidth === next.viewportWidth) return prev;
        return next;
      });
    };
    update();
    let raf = 0;
    /**
     * RAF-throttled scroll handler that calls update once per scroll frame.
     * @returns {void}
     */
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };
    viewport.addEventListener('scroll', onScroll, { passive: true });
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(viewport);
    }
    return () => {
      viewport.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [duration]);

  /**
   * Auto-scrolls the viewport to keep the playhead visible when currentTime
   * advances (forward motion only), leaving a 40px gutter at the right edge.
   * @returns {void}
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const prev = prevTimeRef.current;
    prevTimeRef.current = currentTime;
    if (currentTime <= prev) return;
    const x = currentTime * zoom;
    const left = viewport.scrollLeft;
    if (x < left || x > left + viewport.clientWidth - 40) {
      viewport.scrollLeft = Math.max(0, x - 40);
    }
  }, [currentTime, zoom]);

  /**
   * Changes the zoom by a factor, clamping to the allowed range, and
   * re-centers the viewport on the media time under the viewport's center. The
   * internal state is always updated; when an `onZoomChange` callback is
   * provided (controlled mode) the new value is also reported to the parent so
   * it can be persisted.
   * @param {number} factor - Zoom multiplier (e.g. TIMELINE_ZOOM_STEP zooms
   *   in, its reciprocal zooms out).
   * @returns {void}
   */
  const changeZoom = (factor: number) => {
    const viewport = viewportRef.current;
    const next = computeTimelineZoom(zoom, factor);
    const centerTime = viewport ? (viewport.scrollLeft + viewport.clientWidth / 2) / zoom : currentTime;
    setZoomState(next);
    onZoomChange?.(next);
    if (viewport && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        viewport.scrollLeft = zoomCenterScrollLeft(centerTime, next, viewport.clientWidth);
      });
    }
  };

  /**
   * Builds the ruler tick and label elements for the visible time range via the
   * shared {@link computeRulerTicks} geometry helper.
   * @returns {{ minorEls: ReactElement[]; majorEls: ReactElement[]; labelEls: ReactElement[] }}
   */
  const rulerEls = useMemo(() => {
    const ticks = computeRulerTicks({
      duration,
      zoom,
      scrollLeft: viewState.scrollLeft,
      viewportWidth: viewState.viewportWidth,
    });

    const majorEls = ticks.major.map((value) => <RulerTick key={`major-${value}`} sx={{ left: value * zoom }} />);
    const labelEls = ticks.labels.map((value) => (
      <RulerLabel key={`label-${value}`} sx={{ left: value * zoom }}>
        {formatClockTime(value)}
      </RulerLabel>
    ));
    const minorEls = ticks.minor.map((value) => <RulerMinorTick key={`minor-${value}`} sx={{ left: value * zoom }} />);

    return { minorEls, majorEls, labelEls };
  }, [duration, zoom, viewState.scrollLeft, viewState.viewportWidth]);

  /**
   * Builds the waveform bar elements for the visible range, virtualized to
   * the viewport, from the shared {@link computeWaveformBars} geometry helper.
   * @returns {ReactElement[]} Array of WaveformBar elements.
   */
  const waveformBars = useMemo(() => {
    if (!waveform || waveform.buckets.length === 0 || duration <= 0) return [];
    const bars = computeWaveformBars({
      buckets: waveform.buckets,
      duration,
      zoom,
      scrollLeft: viewState.scrollLeft,
      viewportWidth: viewState.viewportWidth,
      trackContentHeight: TIMELINE_LAYOUT.TRACK_CONTENT_HEIGHT,
      trackContentTop: TIMELINE_LAYOUT.TRACK_CONTENT_TOP,
    });
    return bars.map((bar) => (
      <WaveformBar
        key={bar.left}
        data-testid="timeline-waveform-bar"
        sx={{ left: bar.left, top: bar.top, width: bar.width, height: bar.height }}
      />
    ));
  }, [waveform, duration, zoom, viewState.scrollLeft, viewState.viewportWidth]);

  /**
   * Builds the thumbnail cell elements for the visible range, virtualized to
   * the viewport. Each cell is a background-slice of the montage strip
   * positioned and scaled to fill its time interval.
   * @returns {ReactElement[]} Array of ThumbCell elements.
   */
  const thumbCells = useMemo(() => {
    if (!thumbnails || thumbnails.count <= 0 || duration <= 0) return [];
    const cellHeight = TIMELINE_LAYOUT.TRACK_CONTENT_HEIGHT;
    const virtualize = viewState.viewportWidth > 0;
    const margin = virtualize ? viewState.viewportWidth / zoom / 2 : 0;
    const startTime = Math.max(0, viewState.scrollLeft / zoom - margin);
    const endTime = Math.min(duration, (viewState.scrollLeft + viewState.viewportWidth) / zoom + margin);
    const firstIdx = virtualize ? Math.max(0, Math.floor(startTime / thumbnails.interval)) : 0;
    const lastIdx = virtualize ? Math.min(thumbnails.count - 1, Math.ceil(endTime / thumbnails.interval)) : thumbnails.count - 1;
    const cells: ReactElement[] = [];
    for (let i = firstIdx; i <= lastIdx; i++) {
      const col = i % thumbnails.cols;
      const row = Math.floor(i / thumbnails.cols);
      const left = i * thumbnails.interval * zoom;
      const width = Math.max(1, thumbnails.interval * zoom);
      const scaleX = width / thumbnails.thumbWidth;
      const scaleY = cellHeight / thumbnails.thumbHeight;
      cells.push(
        <ThumbCell
          key={i}
          className={TIMELINE_THUMB_MONTAGE_CLASS}
          data-testid="timeline-thumb"
          sx={{
            left,
            width,
            backgroundSize: `${thumbnails.cols * thumbnails.thumbWidth * scaleX}px ${thumbnails.rows * thumbnails.thumbHeight * scaleY}px`,
            backgroundPosition: `${-(col * thumbnails.thumbWidth * scaleX)}px ${-(row * thumbnails.thumbHeight * scaleY)}px`,
          }}
        />,
      );
    }
    return cells;
  }, [thumbnails, duration, zoom, viewState.scrollLeft, viewState.viewportWidth]);

  /**
   * Builds the CSS rule that attaches the thumbnail montage data URL to cells
   * carrying the TIMELINE_THUMB_MONTAGE_CLASS.
   * @returns {string} A CSS rule string, or '' when no thumbnails exist.
   */
  const thumbMontageCss = useMemo(() => {
    if (!thumbnails) return '';
    return `.${TIMELINE_THUMB_MONTAGE_CLASS} { background-image: url("${thumbnails.dataUrl}"); background-repeat: no-repeat; }`;
  }, [thumbnails]);

  if (duration <= 0) return null;

  const playheadX = currentTime * zoom;
  const startX = start * zoom;
  const endX = end * zoom;

  return (
    <TimelineRoot>
      <TimelineToolbar>
        <TimelineTimeText data-testid="timeline-current-time">
          {formatClockTime(currentTime)} / {formatClockTime(duration)}
        </TimelineTimeText>
        {waveformLoading || thumbnailsLoading ? (
          <PreviewBadge
            size="small"
            variant="outlined"
            color="warning"
            icon={<CircularProgress size={12} color="inherit" />}
            label={t('videoCut.generatingPreview')}
            data-testid="timeline-generating"
            role="status"
            aria-live="polite"
          />
        ) : (
          <Box />
        )}
        <ZoomControls>
          <ZoomButton
            size="small"
            aria-label={t('videoTimeline.zoomOut')}
            onClick={() => changeZoom(1 / TIMELINE_ZOOM_STEP)}
            disabled={zoom <= TIMELINE_MIN_ZOOM}
          >
            <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
          </ZoomButton>
          <ZoomButton
            size="small"
            aria-label={t('videoTimeline.zoomIn')}
            onClick={() => changeZoom(TIMELINE_ZOOM_STEP)}
            disabled={zoom >= TIMELINE_MAX_ZOOM}
          >
            <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
          </ZoomButton>
        </ZoomControls>
      </TimelineToolbar>
      <TrackRow>
        <TrackLabelPanel>
          <RulerSpacer />
          <Tooltip title={t('videoTimeline.videoTrack')} arrow placement="right">
            <VideoTrackLabel data-testid="timeline-video-label">
              <FontAwesomeIcon icon={faVideo} size="xs" />
            </VideoTrackLabel>
          </Tooltip>
          <AudioTrackLabel data-testid="timeline-audio-label">
            <Tooltip title={t('videoTimeline.audioTrack')} arrow placement="right">
              <TrackIconBox>
                <FontAwesomeIcon icon={faMusic} size="xs" />
              </TrackIconBox>
            </Tooltip>
            <Tooltip title={t('videoTimeline.audioEnabledHint')} arrow placement="right">
              <Checkbox
                size="small"
                checked={audioEnabled}
                onChange={(e) => onAudioEnabledChange?.(e.target.checked)}
                slotProps={{
                  input: {
                    'aria-label': t('videoTimeline.audioEnabled'),
                    'data-testid': 'timeline-audio-enabled',
                  },
                }}
              />
            </Tooltip>
          </AudioTrackLabel>
        </TrackLabelPanel>
        <Viewport ref={viewportRef}>
          <Scroller
            ref={scrollerRef}
            data-testid="timeline-scroller"
            $width={Math.max(duration * zoom, DEFAULT_TIMELINE_WIDTH)}
            onPointerDown={handlePointerDown}
          >
            <Ruler>
              {rulerEls.minorEls}
              {rulerEls.majorEls}
              {rulerEls.labelEls}
              <MarkerBubble data-testid="timeline-start-time" sx={{ left: startX }}>
                {formatClockTime(start)}
              </MarkerBubble>
              <MarkerBubble data-testid="timeline-end-time" sx={{ left: endX }}>
                {formatClockTime(end)}
              </MarkerBubble>
            </Ruler>
            <Lane>
              <VideoTrack data-testid="timeline-video-track">
                {thumbnailsLoading ? (
                  <TrackSkeleton variant="rectangular" data-testid="timeline-thumb-skeleton" animation="wave" />
                ) : (
                  <>
                    {thumbnails && <style>{thumbMontageCss}</style>}
                    {thumbCells}
                  </>
                )}
              </VideoTrack>
              <AudioTrack data-testid="timeline-audio-track" $width={Math.max(0, duration * zoom)}>
                {waveformLoading ? (
                  <TrackSkeleton variant="rectangular" data-testid="timeline-waveform-skeleton" animation="wave" />
                ) : (
                  waveformBars
                )}
              </AudioTrack>
              <DimmedRegion data-testid="timeline-dimmed-region" sx={{ left: 0, width: startX }} />
              <KeptRegion data-kind="move" data-testid="timeline-kept-region" sx={{ left: startX, width: Math.max(0, endX - startX) }}>
                <MoveIndicator className="timeline-move-indicator" data-testid="timeline-move-indicator">
                  <FontAwesomeIcon icon={faGripVertical} size="xs" />
                </MoveIndicator>
              </KeptRegion>
              <DimmedRegion data-testid="timeline-dimmed-region" sx={{ left: endX, width: Math.max(0, duration * zoom - endX) }} />
              {videoStream && (
                <TrackBubbleAnchor sx={{ top: 0, height: TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT }}>
                  <TrackInfoBubble data-testid="timeline-video-tooltip">{formatStreamSummary(videoStream)}</TrackInfoBubble>
                </TrackBubbleAnchor>
              )}
              {audioStream && (
                <TrackBubbleAnchor sx={{ top: TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT, height: TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT }}>
                  <TrackInfoBubble data-testid="timeline-audio-tooltip">{formatStreamSummary(audioStream)}</TrackInfoBubble>
                </TrackBubbleAnchor>
              )}
              <TrimHandle data-kind="start" data-testid="timeline-start-handle" sx={{ left: startX }} />
              <TrimHandle data-kind="end" data-testid="timeline-end-handle" sx={{ left: endX }} />
            </Lane>
            <PlayheadLine data-kind="playhead" data-testid="timeline-playhead" sx={{ left: playheadX }}>
              <PlayheadHead />
            </PlayheadLine>
            <ScrollShadowAnchor>
              <ScrollShadow data-testid="timeline-scroll-shadow" />
            </ScrollShadowAnchor>
          </Scroller>
        </Viewport>
      </TrackRow>
    </TimelineRoot>
  );
}
