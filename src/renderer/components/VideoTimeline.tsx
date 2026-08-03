import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, CircularProgress, Skeleton, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlassPlus, faMagnifyingGlassMinus } from '@fortawesome/free-solid-svg-icons';
import {
  TimelineRoot,
  TimelineToolbar,
  TimelineTimeText,
  ZoomButton,
  Viewport,
  Scroller,
  Ruler,
  RulerTick,
  RulerMinorTick,
  RulerLabel,
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
  TIMELINE_LAYOUT,
} from '../styles/VideoTimeline.styles';
import { formatClockTime } from '../utils/formatters';
import { WaveformData, ThumbnailStrip } from '../../shared/types';

const DEFAULT_TIMELINE_WIDTH = 600;
const MIN_ZOOM = 2;
const MAX_ZOOM = 300;
const ZOOM_STEP = 1.5;
const MIN_GAP = 0.1;
const LABEL_MIN_GAP = 56;
const THUMB_MONTAGE_CLASS = 'timeline-thumb-montage';
const TICK_STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600] as const;

interface Props {
  duration: number;
  currentTime: number;
  start: number;
  end: number;
  waveform?: WaveformData | null;
  thumbnails?: ThumbnailStrip | null;
  waveformLoading?: boolean;
  thumbnailsLoading?: boolean;
  onSeek: (time: number) => void;
  onStartChange: (time: number) => void;
  onEndChange: (time: number) => void;
}

type DragKind = 'playhead' | 'start' | 'end' | 'scrub';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function initialZoom(duration: number): number {
  return clamp(DEFAULT_TIMELINE_WIDTH / Math.max(duration, 1), MIN_ZOOM, MAX_ZOOM);
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
  onSeek,
  onStartChange,
  onEndChange,
}: Props) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragKind | null>(null);
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
    if (kind === 'start') s.onStartChange(clamp(time, 0, Math.max(0, s.end - MIN_GAP)));
    else if (kind === 'end') s.onEndChange(clamp(time, Math.min(s.duration, s.start + MIN_GAP), s.duration));
    else s.onSeek(time);
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
    const next = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const centerTime = viewport ? (viewport.scrollLeft + viewport.clientWidth / 2) / zoom : currentTime;
    setZoomState(next);
    if (viewport && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        viewport.scrollLeft = Math.max(0, centerTime * next - viewport.clientWidth / 2);
      });
    }
  };

  const rulerEls = useMemo(() => {
    const step = TICK_STEPS.find((candidate) => candidate * zoom >= 50) ?? TICK_STEPS[TICK_STEPS.length - 1];
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
      if (x - lastLabelX >= LABEL_MIN_GAP) {
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
    const bucketWidth = (duration * zoom) / waveform.buckets.length;
    const barWidth = Math.max(1, bucketWidth - 1);
    const barHeight = TIMELINE_LAYOUT.TRACK_CONTENT_HEIGHT;
    const envelopeTop = TIMELINE_LAYOUT.TRACK_CONTENT_TOP;
    const virtualize = viewState.viewportWidth > 0;
    const bucketsPerSec = waveform.buckets.length / duration;
    const margin = virtualize ? viewState.viewportWidth / zoom / 2 : 0;
    const startTime = Math.max(0, viewState.scrollLeft / zoom - margin);
    const endTime = Math.min(duration, (viewState.scrollLeft + viewState.viewportWidth) / zoom + margin);
    const firstIdx = virtualize ? Math.max(0, Math.floor(startTime * bucketsPerSec)) : 0;
    const lastIdx = virtualize ? Math.min(waveform.buckets.length - 1, Math.ceil(endTime * bucketsPerSec)) : waveform.buckets.length - 1;
    const bars: ReactElement[] = [];
    for (let i = firstIdx; i <= lastIdx; i++) {
      const b = waveform.buckets[i];
      const topFraction = (1 - b.max) / 2;
      const heightFraction = Math.max(0, b.max - b.min) / 2;
      const height = Math.max(2, heightFraction * barHeight);
      const top = Math.max(envelopeTop, Math.min(envelopeTop + barHeight - height, envelopeTop + topFraction * barHeight));
      bars.push(<WaveformBar key={i} data-testid="timeline-waveform-bar" sx={{ left: i * bucketWidth, top, width: barWidth, height }} />);
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
          className={THUMB_MONTAGE_CLASS}
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
    return `.${THUMB_MONTAGE_CLASS} { background-image: url("${thumbnails.dataUrl}"); background-repeat: no-repeat; }`;
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
            onClick={() => changeZoom(1 / ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
          >
            <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
          </ZoomButton>
          <ZoomButton size="small" aria-label={t('videoTimeline.zoomIn')} onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM}>
            <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
          </ZoomButton>
        </Box>
      </TimelineToolbar>
      <Viewport ref={viewportRef}>
        <Scroller
          ref={scrollerRef}
          data-testid="timeline-scroller"
          style={{ width: Math.max(duration * zoom, 600) }}
          onPointerDown={handlePointerDown}
        >
          <Ruler>
            {rulerEls.minorEls}
            {rulerEls.majorEls}
            {rulerEls.labelEls}
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
            <KeptRegion data-testid="timeline-kept-region" sx={{ left: startX, width: Math.max(0, endX - startX) }} />
            <DimmedRegion data-testid="timeline-dimmed-region" sx={{ left: endX, width: Math.max(0, duration * zoom - endX) }} />
            <TrimHandle data-kind="start" data-testid="timeline-start-handle" sx={{ left: startX }} />
            <TrimHandle data-kind="end" data-testid="timeline-end-handle" sx={{ left: endX }} />
          </Lane>
          <PlayheadLine data-kind="playhead" data-testid="timeline-playhead" sx={{ left: playheadX }}>
            <PlayheadHead />
          </PlayheadLine>
        </Scroller>
      </Viewport>
    </TimelineRoot>
  );
}
