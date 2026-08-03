import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
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
  ClipTrack,
  KeptRegion,
  DimmedRegion,
  TrimHandle,
  PlayheadLine,
  PlayheadHead,
} from '../styles/VideoTimeline.styles';
import { formatClockTime } from '../utils/formatters';

const DEFAULT_TIMELINE_WIDTH = 600;
const MIN_ZOOM = 2;
const MAX_ZOOM = 300;
const ZOOM_STEP = 1.5;
const MIN_GAP = 0.1;
const LABEL_MIN_GAP = 56;
const TICK_STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600] as const;

interface Props {
  duration: number;
  currentTime: number;
  start: number;
  end: number;
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

export default function VideoTimeline({ duration, currentTime, start, end, onSeek, onStartChange, onEndChange }: Props) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragKind | null>(null);
  const prevTimeRef = useRef(currentTime);
  const [zoom, setZoomState] = useState<number>(() => initialZoom(duration));
  const prevDurationRef = useRef(duration);
  if (prevDurationRef.current !== duration) {
    prevDurationRef.current = duration;
    setZoomState(initialZoom(duration));
  }
  const stateRef = useRef({ zoom: 1, duration: 0, start: 0, end: 0, onSeek, onStartChange, onEndChange });
  stateRef.current = { zoom, duration, start, end, onSeek, onStartChange, onEndChange };

  const timeFromEvent = (clientX: number): number => {
    const el = scrollerRef.current;
    const viewport = viewportRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const scrollLeft = viewport?.scrollLeft ?? 0;
    return clamp((clientX - rect.left + scrollLeft) / zoom, 0, duration);
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

  const { majors, minors, labels } = useMemo(() => {
    const step = TICK_STEPS.find((candidate) => candidate * zoom >= 50) ?? TICK_STEPS[TICK_STEPS.length - 1];
    const majors: number[] = [];
    for (let value = 0; value <= duration + 1e-9; value += step) majors.push(value);
    let sub = 0;
    if ((step * zoom) / 5 >= 5) sub = step / 5;
    else if ((step * zoom) / 2 >= 5) sub = step / 2;
    const minors: number[] = [];
    if (sub > 0) {
      for (let value = 0; value <= duration + 1e-9; value += sub) {
        if (Math.abs(value / step - Math.round(value / step)) > 1e-9) minors.push(value);
      }
    }
    const labels: { value: number; x: number; show: boolean }[] = [];
    let lastLabelX = -Infinity;
    for (const value of majors) {
      const x = value * zoom;
      const show = x - lastLabelX >= LABEL_MIN_GAP;
      if (show) lastLabelX = x;
      labels.push({ value, x, show });
    }
    return { majors, minors, labels };
  }, [duration, zoom]);

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
            {minors.map((value) => (
              <RulerMinorTick key={`minor-${value}`} sx={{ left: value * zoom }} />
            ))}
            {majors.map((value) => (
              <RulerTick key={`major-${value}`} sx={{ left: value * zoom }} />
            ))}
            {labels.map(
              (label) =>
                label.show && (
                  <RulerLabel key={`label-${label.value}`} sx={{ left: label.x }}>
                    {formatClockTime(label.value)}
                  </RulerLabel>
                ),
            )}
          </Ruler>
          <Lane>
            <ClipTrack />
            <DimmedRegion sx={{ left: 0, width: startX }} />
            <KeptRegion sx={{ left: startX, width: Math.max(0, endX - startX) }} />
            <DimmedRegion sx={{ left: endX, width: Math.max(0, duration * zoom - endX) }} />
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
