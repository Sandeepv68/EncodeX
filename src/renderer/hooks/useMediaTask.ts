import { useCallback, useEffect, useRef, useState } from 'react';
import { Logger } from '../../shared/logger';
import { COMPLETED_PROGRESS } from '../../shared/transcoder-constants';
import type { ConversionProgress } from '../../shared/types';
import { useErrorStore } from '../stores/errorStore';

const log = new Logger('renderer/hooks/useMediaTask');

export type TaskProgress = Pick<ConversionProgress, 'percent' | 'time' | 'speed' | 'eta'>;

export function useMediaTask() {
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const isConvertingRef = useRef(false);
  const showError = useErrorStore((s) => s.showError);

  useEffect(() => {
    log.debug('Subscribing to conversion progress');
    const cleanup = window.electronAPI?.onConversionProgress((data: { input: string; output: string; progress: ConversionProgress }) => {
      if (!isConvertingRef.current) return;
      const p = data.progress;
      setProgress({ percent: p.percent, time: p.time, speed: p.speed, eta: p.eta });
    });
    return () => {
      log.debug('Unsubscribing from conversion progress');
      cleanup?.();
    };
  }, []);

  const runTask = useCallback(
    async (task: () => Promise<void>) => {
      isConvertingRef.current = true;
      setIsConverting(true);
      try {
        await task();
        setProgress(COMPLETED_PROGRESS);
      } catch (err: unknown) {
        showError(err);
      } finally {
        isConvertingRef.current = false;
        setIsConverting(false);
      }
    },
    [showError],
  );

  return { progress, setProgress, isConverting, runTask };
}
