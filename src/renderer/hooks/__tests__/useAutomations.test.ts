import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAutomations } from '../useAutomations';
import { useAutomationStore } from '../../stores/automationStore';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';
import {
  AUTOMATION_BACKENDS,
  createAutomationDefinition,
  createAutomationEdge,
  createAutomationNode,
} from '../../../shared/automations/defaults';
import { AUTOMATION_KIND, AUTOMATION_RUN_STATUS } from '../../../shared/automations/types';
import type { AutomationBackend, AutomationDefinition, AutomationProgressEvent } from '../../../shared/automations/types';
import type { MediaInfo } from '../../../shared/types';

const automationStartMock = vi.mocked(window.electronAPI.automationStart);
const automationCancelMock = vi.mocked(window.electronAPI.automationCancel);
const onAutomationStatusMock = vi.mocked(window.electronAPI.onAutomationStatus);
const onAutomationProgressMock = vi.mocked(window.electronAPI.onAutomationProgress);
const onAutomationEventMock = vi.mocked(window.electronAPI.onAutomationEvent);
const getMediaInfoMock = vi.mocked(window.electronAPI.getMediaInfo);
const getBmfStatusMock = vi.mocked(window.electronAPI.getBmfStatus);
const selectFileMock = vi.mocked(window.electronAPI.selectFile);

function validDefinition(): AutomationDefinition {
  const definition = createAutomationDefinition('auto-1', 'Alpha', 1);
  definition.graph = {
    nodes: [
      createAutomationNode(
        'n1',
        AUTOMATION_KIND.INPUT,
        { x: 0, y: 0 },
        {
          data: { kind: AUTOMATION_KIND.INPUT, path: '/in.mp4', mediaKind: 'video' },
        },
      ),
      createAutomationNode(
        'n2',
        AUTOMATION_KIND.OUTPUT,
        { x: 1, y: 0 },
        {
          data: { kind: AUTOMATION_KIND.OUTPUT, path: '/out.mp4' },
        },
      ),
    ],
    edges: [createAutomationEdge('n1', 'n2')],
  };
  return definition;
}

function event(overrides: Partial<AutomationProgressEvent> = {}): AutomationProgressEvent {
  return {
    runId: 'run-1',
    automationId: 'auto-1',
    nodeId: 'n1',
    status: AUTOMATION_RUN_STATUS.RUNNING,
    progress: 42,
    message: 'working',
    ...overrides,
  };
}

function mediaInfo(streams: MediaInfo['streams']): MediaInfo {
  return { file: '/in.mp4', format: 'mp4', size: 1024, duration: 60, bitrate: '1000k', streams };
}

function hasToast(message: string): boolean {
  return useToastStore.getState().toasts.some((toast) => toast.message === message);
}

describe('useAutomations runtime bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAutomationStore.setState({
      definitions: [],
      activeDefinition: null,
      selectedNodeId: null,
      validationIssues: [],
      isDirty: false,
      isInitialized: false,
      runs: {},
      runtimeInputPath: null,
      detectedMediaKind: null,
      selectedRunId: null,
      backendStatus: AUTOMATION_BACKENDS.reduce<Record<AutomationBackend, boolean>>(
        (status, backend) => ({ ...status, [backend]: true }),
        {} as Record<AutomationBackend, boolean>,
      ),
    });
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    useToastStore.setState({ toasts: [] });
    automationStartMock.mockResolvedValue('run-42');
    automationCancelMock.mockResolvedValue(true);
    onAutomationStatusMock.mockReturnValue(vi.fn());
    onAutomationProgressMock.mockReturnValue(vi.fn());
    onAutomationEventMock.mockReturnValue(vi.fn());
    getMediaInfoMock.mockReset().mockResolvedValue(mediaInfo([{ index: 0, type: 'video', codec: 'h264' }]));
    getBmfStatusMock.mockReset().mockResolvedValue({ available: true, missing: [] });
    selectFileMock.mockReset().mockResolvedValue(null);
  });

  it('subscribes to all automation push channels and cleans them up on unmount', () => {
    const offStatus = vi.fn();
    const offProgress = vi.fn();
    const offEvent = vi.fn();
    onAutomationStatusMock.mockReturnValue(offStatus);
    onAutomationProgressMock.mockReturnValue(offProgress);
    onAutomationEventMock.mockReturnValue(offEvent);

    const { unmount } = renderHook(() => useAutomations());
    expect(onAutomationStatusMock).toHaveBeenCalledOnce();
    expect(onAutomationProgressMock).toHaveBeenCalledOnce();
    expect(onAutomationEventMock).toHaveBeenCalledOnce();

    unmount();
    expect(offStatus).toHaveBeenCalledOnce();
    expect(offProgress).toHaveBeenCalledOnce();
    expect(offEvent).toHaveBeenCalledOnce();
  });

  it('buffers push events received before the run exists', () => {
    let statusCb: ((data: AutomationProgressEvent) => void) | undefined;
    onAutomationStatusMock.mockImplementation((cb) => {
      statusCb = cb;
      return vi.fn();
    });
    const { result } = renderHook(() => useAutomations());

    act(() => {
      statusCb?.(event());
    });
    expect(useAutomationStore.getState().runs).toEqual({});

    act(() => {
      result.current.startRun('run-1');
    });
    expect(useAutomationStore.getState().runs['run-1']).toMatchObject({
      runId: 'run-1',
      status: AUTOMATION_RUN_STATUS.RUNNING,
      progress: 42,
      message: 'working',
    });
  });

  it('starts a run with the active definition and resolved runtime', async () => {
    useAutomationStore.setState({ activeDefinition: validDefinition() });
    const { result } = renderHook(() => useAutomations());
    const ids: (string | null)[] = [];

    await act(async () => {
      ids.push(await result.current.run());
    });

    expect(ids).toEqual(['run-42']);
    expect(automationStartMock).toHaveBeenCalledWith({
      definition: expect.objectContaining({ id: 'auto-1' }),
      runtime: {
        inputPath: '/in.mp4',
        outputPath: '/out.mp4',
        mediaKind: 'video',
        availableBackends: AUTOMATION_BACKENDS,
      },
    });
    expect(useAutomationStore.getState().runs['run-42']).toMatchObject({ runId: 'run-42', status: AUTOMATION_RUN_STATUS.QUEUED });
    expect(hasToast('automations.runQueued')).toBe(true);
  });

  it('reports a failed start through both sinks', async () => {
    automationStartMock.mockRejectedValue(new Error('boom'));
    useAutomationStore.setState({ activeDefinition: validDefinition() });
    const { result } = renderHook(() => useAutomations());
    const ids: (string | null)[] = [];

    await act(async () => {
      ids.push(await result.current.run());
    });

    expect(ids).toEqual([null]);
    expect(hasToast('automations.runFailed')).toBe(true);
    expect(useErrorStore.getState().currentError).not.toBeNull();
  });

  it('cancels a run and marks it cancelled locally', async () => {
    useAutomationStore.setState({ activeDefinition: validDefinition() });
    const { result } = renderHook(() => useAutomations());
    const results: boolean[] = [];

    await act(async () => {
      result.current.startRun('run-1');
      results.push(await result.current.cancel('run-1'));
    });

    expect(results).toEqual([true]);
    expect(automationCancelMock).toHaveBeenCalledWith('run-1');
    expect(useAutomationStore.getState().runs['run-1']).toMatchObject({ status: AUTOMATION_RUN_STATUS.CANCELLED });
    expect(hasToast('automations.runCancelled')).toBe(true);
  });

  it('reports a false cancel result', async () => {
    automationCancelMock.mockResolvedValue(false);
    const { result } = renderHook(() => useAutomations());
    const results: boolean[] = [];

    await act(async () => {
      results.push(await result.current.cancel('run-1'));
    });

    expect(results).toEqual([false]);
    expect(hasToast('automations.cancelFailed')).toBe(true);
  });

  it('reports an unavailable start bridge', async () => {
    const api = window.electronAPI as unknown as Record<string, unknown>;
    const original = api.automationStart;
    api.automationStart = undefined;
    useAutomationStore.setState({ activeDefinition: validDefinition() });
    const { result } = renderHook(() => useAutomations());
    const ids: (string | null)[] = [];

    try {
      await act(async () => {
        ids.push(await result.current.run());
      });
      expect(ids).toEqual([null]);
      expect(hasToast('automations.runUnavailable')).toBe(true);
    } finally {
      api.automationStart = original;
    }
  });

  it('probes the active input and stores the inferred media kind', async () => {
    useAutomationStore.setState({ activeDefinition: validDefinition() });
    const { result } = renderHook(() => useAutomations());
    let kind: string | null = null;

    await act(async () => {
      kind = await result.current.probeInput();
    });

    expect(kind).toBe('video');
    expect(getMediaInfoMock).toHaveBeenCalledWith('/in.mp4', 'FFMPEG');
    expect(useAutomationStore.getState().detectedMediaKind).toBe('video');
    expect(hasToast('automations.inputProbed')).toBe(true);
  });

  it('uses runtime overrides for input path and media kind', async () => {
    useAutomationStore.setState({
      activeDefinition: validDefinition(),
      runtimeInputPath: '/override.png',
      detectedMediaKind: 'image',
    });
    const { result } = renderHook(() => useAutomations());

    await act(async () => {
      await result.current.run();
    });

    expect(automationStartMock).toHaveBeenCalledWith({
      definition: expect.objectContaining({ id: 'auto-1' }),
      runtime: expect.objectContaining({ inputPath: '/override.png', mediaKind: 'image' }),
    });
  });

  it('selects a runtime input file and probes it', async () => {
    selectFileMock.mockResolvedValue('/override.mov');
    getMediaInfoMock.mockResolvedValue(mediaInfo([{ index: 0, type: 'video', codec: 'h264' }]));
    useAutomationStore.setState({ activeDefinition: validDefinition() });
    const { result } = renderHook(() => useAutomations());

    await act(async () => {
      await result.current.selectRuntimeInput();
    });

    expect(selectFileMock).toHaveBeenCalled();
    expect(useAutomationStore.getState().runtimeInputPath).toBe('/override.mov');
    expect(useAutomationStore.getState().detectedMediaKind).toBe('video');
  });

  it('clears stale media detection when a probe fails', async () => {
    getMediaInfoMock.mockRejectedValue(new Error('probe failed'));
    useAutomationStore.setState({ activeDefinition: validDefinition(), detectedMediaKind: 'image' });
    const { result } = renderHook(() => useAutomations());

    await act(async () => {
      await result.current.probeInput();
    });

    expect(useAutomationStore.getState().detectedMediaKind).toBeNull();
    expect(hasToast('automations.probeFailed')).toBe(true);
  });

  it('applies backend availability during initialization', async () => {
    getBmfStatusMock.mockResolvedValue({ available: false, missing: ['bmf'] });
    const { result } = renderHook(() => useAutomations());

    await act(async () => {
      await result.current.initialize();
    });

    expect(useAutomationStore.getState().backendStatus.BMF).toBe(false);
  });
});
