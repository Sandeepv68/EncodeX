/**
 * @fileoverview Hook orchestrating the video conversion workflow.
 *
 * Wires the conversion form store (useConversionStore) to the main process via
 * `window.electronAPI`: selecting input/output files, starting, pausing,
 * resuming and cancelling a conversion, and auto-suggesting the output path.
 * Conversion progress events are subscribed to once per mount and forwarded to
 * the store; errors are routed to the global error store and success is
 * announced with a toast.
 */

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
import {
  LOG_ARROW,
  LOG_AUTO_SUGGESTING_OUTPUT_FILE,
  LOG_CANCEL_CONVERSION_CALLED,
  LOG_CONVERSION_COMPLETED_SUCCESSFULLY,
  LOG_CONVERSION_FAILED,
  LOG_COPY_MODE,
  LOG_PAUSE_CONVERSION_CALLED,
  LOG_RESUME_CONVERSION_CALLED,
  LOG_SELECT_INPUT,
  LOG_SELECT_INPUT_FAILED,
  LOG_SELECT_OUTPUT,
  LOG_SELECT_OUTPUT_FAILED,
  LOG_START_CONVERSION,
  LOG_START_CONVERSION_NO_INPUT_FILE,
  LOG_START_CONVERSION_NO_OUTPUT_FILE,
  LOG_SUBSCRIBING_TO_CONVERSION_PROGRESS,
  LOG_UNSUBSCRIBING_FROM_CONVERSION_PROGRESS,
} from '../../shared/log-constants';

const log = new Logger('renderer/hooks/useConversion');

/**
 * React hook that drives the full conversion workflow.
 *
 * Returns the entire conversion store state (see ConversionState in
 * stores/types.ts) spread together with six action callbacks, so it can be used
 * as the single source of truth for a conversion form.
 *
 * Effects:
 *  1. Progress subscription (runs once on mount): registers a listener via
 *     `window.electronAPI?.onConversionProgress()`. Each event is forwarded to
 *     `store.setProgress()` only while `useConversionStore.getState().isConverting`
 *     is true, so stale events never update the UI. The listener is removed on
 *     unmount via the returned cleanup function.
 *  2. Auto-suggested output path (re-runs whenever inputFile, outputFile,
 *     videoCodec, copyMode, outputUserSet or isConverting change): while no
 *     conversion is running, an input is selected and the user has not manually
 *     set the output, the hook computes a suggested path by stripping the input
 *     extension and appending `DEFAULT_SUFFIX` (e.g. '_encodex_converted') plus the
 *     extension suggested for the active video codec (or the input extension in
 *     copy mode), and stores it via `store.setOutputAuto()`.
 *
 * @returns {Object} The full conversion store state spread together with the
 *   action callbacks:
 * @property {Object} store - Spread ConversionState from useConversionStore
 *   (inputFile, outputFile, outputUserSet, videoCodec, audioCodec,
 *   videoBitrate, audioBitrate, qscale, scale, pixelFormat, copyMode,
 *   transcoder, encoderType, isConverting, isPaused, isDirty, progress, and all
 *   setter/reset actions).
 * @property {() => Promise<void>} startConversion - Validates that input and
 *   output files are selected, then starts the conversion through
 *   `window.electronAPI.convertFile()` with options built from the store and the
 *   hardware acceleration settings; resets the form and shows a success toast on
 *   completion, or routes the failure to the error store.
 * @property {() => Promise<void>} pauseConversion - Asks the main process to
 *   pause the running conversion and marks the store as paused.
 * @property {() => Promise<void>} resumeConversion - Asks the main process to
 *   resume the paused conversion and clears the paused flag.
 * @property {() => Promise<void>} cancelConversion - Asks the main process to
 *   cancel the running conversion and clears the converting flag.
 * @property {() => Promise<void>} selectInput - Opens the native file dialog via
 *   `window.electronAPI?.selectFile()` and stores the chosen input file.
 * @property {() => Promise<void>} selectOutput - Opens the native save dialog via
 *   `window.electronAPI?.selectOutput()` and stores the chosen output file.
 */
export function useConversion() {
  const store = useConversionStore();
  const showError = useErrorStore((s) => s.showError);
  const showErrorMessage = useErrorStore((s) => s.showErrorMessage);

  useEffect(() => {
    log.debug(LOG_SUBSCRIBING_TO_CONVERSION_PROGRESS);
    const cleanup = window.electronAPI?.onConversionProgress((data: { input: string; output: string; progress: ConversionProgress }) => {
      if (!useConversionStore.getState().isConverting) return;
      store.setProgress(data.progress);
    });
    return () => {
      log.debug(LOG_UNSUBSCRIBING_FROM_CONVERSION_PROGRESS);
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
    log.debug(LOG_AUTO_SUGGESTING_OUTPUT_FILE, suggested);
    store.setOutputAuto(suggested);
  }, [store.inputFile, store.outputFile, store.videoCodec, store.copyMode, store.outputUserSet, store.isConverting]);

  const startConversion = useCallback(async () => {
    if (!store.inputFile) {
      log.warn(LOG_START_CONVERSION_NO_INPUT_FILE);
      showErrorMessage(ErrorCode.INPUT_NOT_SPECIFIED);
      return;
    }
    if (!store.outputFile) {
      log.warn(LOG_START_CONVERSION_NO_OUTPUT_FILE);
      showErrorMessage(ErrorCode.OUTPUT_NOT_SPECIFIED);
      return;
    }
    log.info(LOG_START_CONVERSION, store.inputFile, LOG_ARROW, store.outputFile, LOG_COPY_MODE, store.copyMode);
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
      log.info(LOG_CONVERSION_COMPLETED_SUCCESSFULLY);
      store.resetForm();
      useToastStore.getState().success(i18n.t('toast.conversionComplete'));
    } catch (err: unknown) {
      log.error(LOG_CONVERSION_FAILED, err);
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
    log.info(LOG_PAUSE_CONVERSION_CALLED);
    await window.electronAPI?.pauseConversion();
    store.setIsPaused(true);
  }, []);

  const resumeConversion = useCallback(async () => {
    log.info(LOG_RESUME_CONVERSION_CALLED);
    await window.electronAPI?.resumeConversion();
    store.setIsPaused(false);
  }, []);

  const cancelConversion = useCallback(async () => {
    log.info(LOG_CANCEL_CONVERSION_CALLED);
    await window.electronAPI?.cancelConversion();
    store.setIsConverting(false);
  }, []);

  const selectInput = useCallback(async () => {
    try {
      const file = await window.electronAPI?.selectFile();
      if (file) {
        log.info(LOG_SELECT_INPUT, file);
        store.setInputFile(file);
      }
    } catch (err: unknown) {
      log.error(LOG_SELECT_INPUT_FAILED, err);
      showError(err);
    }
  }, [showError]);

  const selectOutput = useCallback(async () => {
    try {
      const file = await window.electronAPI?.selectOutput();
      if (file) {
        log.info(LOG_SELECT_OUTPUT, file);
        store.setOutputFile(file);
      }
    } catch (err: unknown) {
      log.error(LOG_SELECT_OUTPUT_FAILED, err);
      showError(err);
    }
  }, [showError]);

  return { ...store, startConversion, pauseConversion, resumeConversion, cancelConversion, selectInput, selectOutput };
}
