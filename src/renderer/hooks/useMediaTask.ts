import { useCallback, useState } from 'react';
import { COMPLETED_PROGRESS } from '../../shared/transcoder-constants';
import type { ConversionProgress } from '../../shared/types';
import { useErrorStore } from '../stores/errorStore';

export type TaskProgress = Pick<ConversionProgress, 'percent' | 'time' | 'speed' | 'eta'>;

export function useMediaTask() {
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const showError = useErrorStore((s) => s.showError);

  const runTask = useCallback(
    async (task: () => Promise<void>) => {
      setIsConverting(true);
      try {
        await task();
        setProgress(COMPLETED_PROGRESS);
      } catch (err: unknown) {
        showError(err);
      } finally {
        setIsConverting(false);
      }
    },
    [showError],
  );

  return { progress, setProgress, isConverting, runTask };
}
