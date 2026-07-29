import { useEffect, useCallback } from 'react';
import { useConversionStore } from '../stores/conversionStore';
import { useErrorStore } from '../stores/errorStore';
import { ConversionProgress } from '../../shared/types';
import { COMPLETED_PROGRESS } from '../../shared/transcoder-constants';
import { ErrorCode } from '../../shared/errors';

export function useConversion() {
  const store = useConversionStore();
  const showError = useErrorStore((s) => s.showError);

  useEffect(() => {
    const cleanup = window.electronAPI?.onConversionProgress((data: { input: string; output: string; progress: ConversionProgress }) => {
      store.setProgress(data.progress);
    });
    return cleanup;
  }, []);

  const startConversion = useCallback(async () => {
    if (!store.inputFile) {
      showError({ code: ErrorCode.INPUT_NOT_SPECIFIED, message: 'Please select an input file.' });
      return;
    }
    if (!store.outputFile) {
      showError({ code: ErrorCode.OUTPUT_NOT_SPECIFIED, message: 'Please select an output file.' });
      return;
    }
    store.setIsConverting(true);
    try {
      await window.electronAPI.convertFile(
        store.inputFile,
        store.outputFile,
        {
          videoCodec: store.copyMode ? undefined : store.videoCodec,
          audioCodec: store.copyMode ? undefined : store.audioCodec,
          videoBitrate: store.videoBitrate || undefined,
          audioBitrate: store.audioBitrate || undefined,
          qscale: store.qscale || undefined,
          scale: store.scale || undefined,
          pixelFormat: store.pixelFormat || undefined,
          copy: store.copyMode,
        },
        store.transcoder,
      );
      store.setProgress(COMPLETED_PROGRESS);
    } catch (err: unknown) {
      showError(err);
    } finally {
      store.setIsConverting(false);
    }
  }, [
    store.inputFile,
    store.outputFile,
    store.videoCodec,
    store.audioCodec,
    store.videoBitrate,
    store.audioBitrate,
    store.qscale,
    store.scale,
    store.pixelFormat,
    store.copyMode,
    store.transcoder,
    showError,
  ]);

  const cancelConversion = useCallback(async () => {
    await window.electronAPI?.cancelConversion();
    store.setIsConverting(false);
  }, []);

  const selectInput = useCallback(async () => {
    try {
      const file = await window.electronAPI?.selectFile();
      if (file) store.setInputFile(file);
    } catch (err: unknown) {
      showError(err);
    }
  }, [showError]);

  const selectOutput = useCallback(async () => {
    try {
      const file = await window.electronAPI?.selectOutput();
      if (file) store.setOutputFile(file);
    } catch (err: unknown) {
      showError(err);
    }
  }, [showError]);

  return { ...store, startConversion, cancelConversion, selectInput, selectOutput };
}
