import { useEffect, useCallback } from 'react';
import { Logger } from '../../shared/logger';
import { useConversionStore } from '../stores/conversionStore';
import { useErrorStore } from '../stores/errorStore';
import { ConversionProgress } from '../../shared/types';
import { COMPLETED_PROGRESS } from '../../shared/transcoder-constants';
import { ErrorCode } from '../../shared/errors';

const log = new Logger('renderer/hooks/useConversion');

export function useConversion() {
  const store = useConversionStore();
  const showError = useErrorStore((s) => s.showError);

  useEffect(() => {
    log.debug('Subscribing to conversion progress');
    const cleanup = window.electronAPI?.onConversionProgress((data: { input: string; output: string; progress: ConversionProgress }) => {
      store.setProgress(data.progress);
    });
    return () => {
      log.debug('Unsubscribing from conversion progress');
      cleanup?.();
    };
  }, []);

  const startConversion = useCallback(async () => {
    if (!store.inputFile) {
      log.warn('startConversion: no input file');
      showError({ code: ErrorCode.INPUT_NOT_SPECIFIED, message: 'Please select an input file.' });
      return;
    }
    if (!store.outputFile) {
      log.warn('startConversion: no output file');
      showError({ code: ErrorCode.OUTPUT_NOT_SPECIFIED, message: 'Please select an output file.' });
      return;
    }
    log.info('startConversion:', store.inputFile, '->', store.outputFile, 'copyMode:', store.copyMode);
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
      log.info('Conversion completed successfully');
      store.setProgress(COMPLETED_PROGRESS);
    } catch (err: unknown) {
      log.error('Conversion failed:', err);
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
    log.info('cancelConversion called');
    await window.electronAPI?.cancelConversion();
    store.setIsConverting(false);
  }, []);

  const selectInput = useCallback(async () => {
    try {
      const file = await window.electronAPI?.selectFile();
      if (file) {
        log.info('selectInput:', file);
        store.setInputFile(file);
      }
    } catch (err: unknown) {
      log.error('selectInput failed:', err);
      showError(err);
    }
  }, [showError]);

  const selectOutput = useCallback(async () => {
    try {
      const file = await window.electronAPI?.selectOutput();
      if (file) {
        log.info('selectOutput:', file);
        store.setOutputFile(file);
      }
    } catch (err: unknown) {
      log.error('selectOutput failed:', err);
      showError(err);
    }
  }, [showError]);

  return { ...store, startConversion, cancelConversion, selectInput, selectOutput };
}
