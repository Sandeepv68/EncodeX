import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Checkbox, CircularProgress, Skeleton, Tooltip, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlassPlus, faMagnifyingGlassMinus, faVideo, faMusic, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import {
  TimelineRoot,
  TimelineToolbar,
  TimelineTimeText,
  ZoomButton,
  TrackLabelPanel,
  TrackLabel,
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
import { MediaStreamInfo, ThumbnailStrip, WaveformData } from '../../shared/types';
import {
  DEFAULT_TIMELINE_WIDTH,
  TIMELINE_MIN_ZOOM,
  TIMELINE_MAX_ZOOM,
  TIMELINE_ZOOM_STEP,
  TIMELINE_MIN_GAP,
  TIMELINE_LABEL_MIN_GAP,
  TIMELINE_MIN_BAR_PITCH,
  TIMELINE_THUMB_MONTAGE_CLASS,
  TIMELINE_TICK_STEPS,
} from '../../shared/constants';

interface Props {
  duration: number;
  currentTime: number;
  start: number;
  end: number;
  waveform?: WaveformData | null;
  thumbnails?: ThumbnailStrip | null;
  waveformLoading?: boolean;
  thumbnailsLoading?: boolean;
  audioEnabled?: boolean;
  videoStream?: MediaStreamInfo | null;
  audioStream?: MediaStreamInfo | null;
  onSeek: (time: number) => void;
  onStartChange: (time: number) => void;
  onEndChange: (time: number) => void;
  onAudioEnabledChange?: (enabled: boolean) => void;
}

type DragKind = 'playhead' | 'start' | 'end' | 'move' | 'scrub';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function initialZoom(duration: number): number {
  return clamp(DEFAULT_TIMELINE_WIDTH / Math.max(duration, 1), TIMELINE_MIN_ZOOM, TIMELINE_MAX_ZOOM);
}

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
  onSeek,
  onStartChange,
  onEndChange,
  onAudioEnabledChange,
}: Props) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragKind | null>(null);
  const dragOriginRef = useRef(0);
  const dragBaseStartRef = useRef(0);
  const dragBaseEndRef = useRef(0);
  const prevTimeRef = useRef(currentTime);
  const [zoom, setZoomState] = useState<number>(() => initialZoom(duration));
  const [viewState, setViewState] = useState({ scrollLeft: 0, viewportWidth: 600 });
  const prevDurationRef = useRef(duration);
  if (prevDurationRef.current !== duration) {
    prevDurationRef.current = duration;
    setZoomState(initialZoom(duration));
  }
  const stateRef = useRef({ zoom: 1, duration: 0, start: 0, end: 0, onSeek, onStartChange, onEndChange });
  stateRef.current = { zoom, duration, start, end, onSeek, onStartChange, onEndChange };

  const timeFromEvent = (clientX: number): number => {
    const el = scrollerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return clamp((clientX - rect.left) / zoom, 0, duration);
  };

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

  const onWindowPointerUp = () => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onWindowPointerMove);
    window.removeEventListener('pointerup', onWindowPointerUp);
  };

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

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      setViewState((prev) => {
        const next = { scrollLeft: viewport.scrollLeft, viewportWidth: viewport.clientWidth };
        if (prev.scrollLeft === next.scrollLeft && prev.viewportWidth === next.viewportWidth) return prev;
        return next;
      });
    };
    update();
    let raf = 0;
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

  const changeZoom = (factor: number) => {
    const viewport = viewportRef.current;
    const next = clamp(zoom * factor, TIMELINE_MIN_ZOOM, TIMELINE_MAX_ZOOM);
    const centerTime = viewport ? (viewport.scrollLeft + viewport.clientWidth / 2) / zoom : currentTime;
    setZoomState(next);
    if (viewport && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        viewport.scrollLeft = Math.max(0, centerTime * next - viewport.clientWidth / 2);
      });
    }
  };

  const rulerEls = useMemo(() => {
    const step = TIMELINE_TICK_STEPS.find((candidate) => candidate * zoom >= 50) ?? TIMELINE_TICK_STEPS[TIMELINE_TICK_STEPS.length - 1];
    const margin = viewState.viewportWidth / zoom / 2;
    const startTime = Math.max(0, viewState.scrollLeft / zoom - margin);
    const endTime = Math.min(duration, (viewState.scrollLeft + viewState.viewportWidth) / zoom + margin);

    const majorEls: ReactElement[] = [];
    const labelEls: ReactElement[] = [];
    let lastLabelX = -Infinity;
    const firstMajor = Math.max(0, Math.floor(startTime / step) * step);
    for (let value = firstMajor; value <= endTime + 1e-9; value += step) {
      majorEls.push(<RulerTick key={`major-${value}`} sx={{ left: value * zoom }} />);
      const x = value * zoom;
      if (x - lastLabelX >= TIMELINE_LABEL_MIN_GAP) {
        lastLabelX = x;
        labelEls.push(
          <RulerLabel key={`label-${value}`} sx={{ left: x }}>
            {formatClockTime(value)}
          </RulerLabel>,
        );
      }
    }

    const minorEls: ReactElement[] = [];
    let sub = 0;
    if ((step * zoom) / 5 >= 5) sub = step / 5;
    else if ((step * zoom) / 2 >= 5) sub = step / 2;
    if (sub > 0) {
      const firstMinor = Math.max(0, Math.floor(startTime / sub) * sub);
      for (let value = firstMinor; value <= endTime + 1e-9; value += sub) {
        if (Math.abs(value / step - Math.round(value / step)) > 1e-9) {
          minorEls.push(<RulerMinorTick key={`minor-${value}`} sx={{ left: value * zoom }} />);
        }
      }
    }

    return { minorEls, majorEls, labelEls };
  }, [duration, zoom, viewState.scrollLeft, viewState.viewportWidth]);

  const waveformBars = useMemo(() => {
    if (!waveform || waveform.buckets.length === 0 || duration <= 0) return [];
    const totalWidth = duration * zoom;
    const bucketWidth = totalWidth / waveform.buckets.length;
    const slotWidth = Math.max(bucketWidth, TIMELINE_MIN_BAR_PITCH);
    const barWidth = Math.max(2, slotWidth - 1);
    const barHeight = TIMELINE_LAYOUT.TRACK_CONTENT_HEIGHT;
    const envelopeTop = TIMELINE_LAYOUT.TRACK_CONTENT_TOP;
    const virtualize = viewState.viewportWidth > 0;
    const bucketsPerSec = waveform.buckets.length / duration;
    const margin = virtualize ? viewState.viewportWidth / zoom / 2 : 0;
    const startTime = virtualize ? Math.max(0, viewState.scrollLeft / zoom - margin) : 0;
    const endTime = virtualize ? Math.min(duration, (viewState.scrollLeft + viewState.viewportWidth) / zoom + margin) : duration;
    const bucketsPerSlot = slotWidth / bucketWidth;
    const bars: ReactElement[] = [];
    const pushBar = (left: number, bucket: { min: number; max: number }) => {
      const topFraction = (1 - bucket.max) / 2;
      const heightFraction = Math.max(0, bucket.max - bucket.min) / 2;
      const height = Math.max(2, heightFraction * barHeight);
      const top = Math.max(envelopeTop, Math.min(envelopeTop + barHeight - height, envelopeTop + topFraction * barHeight));
      bars.push(<WaveformBar key={left} data-testid="timeline-waveform-bar" sx={{ left, top, width: barWidth, height }} />);
    };

    const firstSlot = Math.max(0, Math.floor((startTime * zoom) / slotWidth));
    const lastSlot = Math.min(Math.ceil(totalWidth / slotWidth) - 1, Math.ceil((endTime * zoom) / slotWidth));
    for (let slot = firstSlot; slot <= lastSlot; slot++) {
      const left = slot * slotWidth;
      const i0 = Math.min(waveform.buckets.length - 1, Math.max(0, Math.floor(slot * bucketsPerSlot)));
      const i1 = Math.min(waveform.buckets.length - 1, Math.max(0, Math.ceil((slot + 1) * bucketsPerSlot) - 1));
      if (bucketsPerSlot <= 1.001) {
        pushBar(left, waveform.buckets[i0]);
      } else {
        let peakSum = 0;
        let maxSum = 0;
        for (let i = i0; i <= i1; i++) {
          const b = waveform.buckets[i];
          peakSum += (b.max - b.min) / 2;
          maxSum += b.max;
        }
        const count = i1 - i0 + 1;
        const avgMax = maxSum / count;
        const avgPeak = peakSum / count;
        pushBar(left, { min: avgMax - avgPeak * 2, max: avgMax });
      }
    }
    return bars;
  }, [waveform, duration, zoom, viewState.scrollLeft, viewState.viewportWidth]);

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }} role="status" aria-live="polite">
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary" data-testid="timeline-generating">
              {t('videoCut.generatingPreview')}
            </Typography>
          </Box>
        ) : (
          <Box />
        )}
        <Box sx={{ display: 'flex', gap: 0.25 }}>
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
        </Box>
      </TimelineToolbar>
      <Box sx={{ display: 'flex' }}>
        <TrackLabelPanel>
          <Box sx={{ height: TIMELINE_LAYOUT.RULER_HEIGHT }} />
          <Tooltip title={t('videoTimeline.videoTrack')} arrow placement="right">
            <TrackLabel
              data-testid="timeline-video-label"
              sx={{ height: TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT, borderBottom: 1, borderColor: 'divider' }}
            >
              <FontAwesomeIcon icon={faVideo} size="xs" />
            </TrackLabel>
          </Tooltip>
          <TrackLabel data-testid="timeline-audio-label" sx={{ height: TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT }}>
            <Tooltip title={t('videoTimeline.audioTrack')} arrow placement="right">
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FontAwesomeIcon icon={faMusic} size="xs" />
              </Box>
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
          </TrackLabel>
        </TrackLabelPanel>
        <Viewport ref={viewportRef} sx={{ flex: 1, minWidth: 0 }}>
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
                  <Skeleton
                    variant="rectangular"
                    data-testid="timeline-thumb-skeleton"
                    animation="wave"
                    sx={{ position: 'absolute', top: 2, bottom: 2, left: 0, right: 0, borderRadius: 1 }}
                  />
                ) : (
                  <>
                    {thumbnails && <style>{thumbMontageCss}</style>}
                    {thumbCells}
                  </>
                )}
              </VideoTrack>
              <AudioTrack data-testid="timeline-audio-track">
                {waveformLoading ? (
                  <Skeleton
                    variant="rectangular"
                    data-testid="timeline-waveform-skeleton"
                    animation="wave"
                    sx={{ position: 'absolute', top: 2, bottom: 2, left: 0, right: 0, borderRadius: 1 }}
                  />
                ) : (
                  waveformBars
                )}
              </AudioTrack>
              <DimmedRegion data-testid="timeline-dimmed-region" sx={{ left: 0, width: startX }} />
              <KeptRegion data-kind="move" data-testid="timeline-kept-region" sx={{ left: startX, width: Math.max(0, endX - startX) }}>
                <Box
                  className="timeline-move-indicator"
                  data-testid="timeline-move-indicator"
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: 0,
                    transition: 'opacity 120ms ease',
                    pointerEvents: 'none',
                    backgroundColor: 'rgba(0, 0, 0, 0.45)',
                    color: '#fff',
                    borderRadius: '6px',
                    padding: '6px',
                  }}
                >
                  <FontAwesomeIcon icon={faGripVertical} size="xs" />
                </Box>
              </KeptRegion>
              <DimmedRegion data-testid="timeline-dimmed-region" sx={{ left: endX, width: Math.max(0, duration * zoom - endX) }} />
              {videoStream && (
                <TrackBubbleAnchor sx={{ top: 0, height: TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT, pt: '2px' }}>
                  <TrackInfoBubble data-testid="timeline-video-tooltip">{formatStreamSummary(videoStream)}</TrackInfoBubble>
                </TrackBubbleAnchor>
              )}
              {audioStream && (
                <TrackBubbleAnchor sx={{ top: TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT, height: TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT, pt: '2px' }}>
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
      </Box>
    </TimelineRoot>
  );
}
