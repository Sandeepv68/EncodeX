import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Convert from '../Convert';
import { useConversionStore } from '../../stores/conversionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';
import { useDismissedAlertsStore } from '../../stores/dismissedAlertsStore';

/**
 * @fileoverview Phase 8 DoS budget: 10 000 rapid clicks on the Convert start
 * button must produce exactly one conversion. The guard is `isConverting` being
 * set synchronously inside `startConversion` (before the bridge await) plus the
 * button's `disabled` attribute, so a burst of clicks cannot double-submit.
 */

const convertFileMock = vi.mocked(window.electronAPI.convertFile);

describe('Convert double-submit budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConversionStore.setState({
      inputFile: null,
      outputFile: null,
      outputUserSet: true,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '2000k',
      audioBitrate: '192k',
      qscale: 23,
      scale: '1920x1080',
      rotate: '',
      flipH: false,
      flipV: false,
      pixelFormat: 'yuv420p',
      videoFilters: [],
      copyMode: false,
      transcoder: 'FFMPEG',
      encoderType: 'auto',
      isConverting: false,
      isPaused: false,
      isDirty: false,
      progress: null,
    });
    useSettingsStore.setState({ hardwareAcceleration: true, hwaccelMode: 'auto', encoderType: 'auto' });
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    useToastStore.setState({ toasts: [] });
    useDismissedAlertsStore.setState({ dismissed: [] });
  });

  it('turns 10,000 rapid clicks on the start button into exactly one conversion', async () => {
    useConversionStore.setState({
      inputFile: '/in/video.mp4',
      outputFile: '/out/video.mkv',
      isConverting: false,
    });
    convertFileMock.mockReturnValue(new Promise(() => {}));

    render(<Convert />);
    await act(async () => {});

    fireEvent.click(screen.getByText('convert.startConversion'));
    await screen.findByText('convert.converting');
    const convertingButton = screen.getByText('convert.converting');
    for (let i = 0; i < 10_000; i++) {
      fireEvent.click(convertingButton);
    }
    expect(convertFileMock).toHaveBeenCalledTimes(1);
  });
});
