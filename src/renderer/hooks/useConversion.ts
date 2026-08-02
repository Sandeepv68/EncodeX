import { useEffect, useCallback } from 'react';
import { Logger } from '../../shared/logger';
import { useConversionStore } from '../stores/conversionStore';
import { useErrorStore } from '../stores/errorStore';
import { useToastStore } from '../stores/toastStore';
import { ConversionProgress } from '../../shared/types';
import { ErrorCode } from '../../shared/errors';
import i18n from '../i18n/config';
import { useSettingsStore } from '../stores/settingsStore';
import { getExtension, suggestedExtensionForVideoCodec } from '../../shared/codec-containers';
import { DEFAULT_SUFFIX } from '../../shared/media-options';

const log = new Logger('renderer/hooks/useConversion');

export function useConversion() {
  const store = useConversionStore();
  const showError = useErrorStore((s) => s.showError);
  const showErrorMessage = useErrorStore((s) => s.showErrorMessage);

  useEffect(() => {
    log.debug('Subscribing to conversion progress');
    const cleanup = window.electronAPI?.onConversionProgress((data: { input: string; output: string; progress: ConversionProgress }) => {
      if (!useConversionStore.getState().isConverting) return;
      store.setProgress(data.progress);
    });
    return () => {
      log.debug('Unsubscribing from conversion progress');
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    const { inputFile, outputFile, videoCodec, copyMode, outputUserSet, isConverting } = store;
    if (isConverting || !inputFile || outputUserSet) return;
    const inputExt = getExtension(inputFile);
    const outputExt = copyMode ? inputExt : suggestedExtensionForVideoCodec(videoCodec);
    if (!outputExt) return;
    const stem = inputFile.replace(/\.[^./\\]+$/, '');
    const suggested = `${stem}${DEFAULT_SUFFIX}.${outputExt}`;
    if (suggested === outputFile) return;
    log.debug('Auto-suggesting output file:', suggested);
    store.setOutputAuto(suggested);
  }, [store.inputFile, store.outputFile, store.videoCodec, store.copyMode, store.outputUserSet, store.isConverting]);

  const startConversion = useCallback(async () => {
    if (!store.inputFile) {
      log.warn('startConversion: no input file');
      showErrorMessage(ErrorCode.INPUT_NOT_SPECIFIED);
      return;
    }
    if (!store.outputFile) {
      log.warn('startConversion: no output file');
      showErrorMessage(ErrorCode.OUTPUT_NOT_SPECIFIED);
      return;
    }
    log.info('startConversion:', store.inputFile, '->', store.outputFile, 'copyMode:', store.copyMode);
    useErrorStore.getState().clearError();
    store.setIsConverting(true);
    try {
      const { hardwareAcceleration, hwaccelMode } = useSettingsStore.getState();
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
          hardwareAcceleration,
          hwaccelMode,
        },
        store.transcoder,
      );
      log.info('Conversion completed successfully');
      store.resetForm();
      useToastStore.getState().success(i18n.t('toast.conversionComplete'));
    } catch (err: unknown) {
      log.error('Conversion failed:', err);
      store.setProgress(null);
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
    showErrorMessage,
  ]);

  const pauseConversion = useCallback(async () => {
    log.info('pauseConversion called');
    await window.electronAPI?.pauseConversion();
    store.setIsPaused(true);
  }, []);

  const resumeConversion = useCallback(async () => {
    log.info('resumeConversion called');
    await window.electronAPI?.resumeConversion();
    store.setIsPaused(false);
  }, []);

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

  return { ...store, startConversion, pauseConversion, resumeConversion, cancelConversion, selectInput, selectOutput };
}
