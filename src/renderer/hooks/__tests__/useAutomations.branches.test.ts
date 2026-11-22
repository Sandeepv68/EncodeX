import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { AUTOMATION_KIND } from '../../../shared/automations/types';
import type { AutomationBackend, AutomationDefinition, AutomationProgressEvent } from '../../../shared/automations/types';

const automationStartMock = vi.mocked(window.electronAPI.automationStart);
const automationCancelMock = vi.mocked(window.electronAPI.automationCancel);
const onAutomationStatusMock = vi.mocked(window.electronAPI.onAutomationStatus);
const onAutomationProgressMock = vi.mocked(window.electronAPI.onAutomationProgress);
const onAutomationEventMock = vi.mocked(window.electronAPI.onAutomationEvent);
const getMediaInfoMock = vi.mocked(window.electronAPI.getMediaInfo);
const getBmfStatusMock = vi.mocked(window.electronAPI.getBmfStatus);
const selectFileMock = vi.mocked(window.electronAPI.selectFile);

const api = window.electronAPI as unknown as Record<string, unknown>;
const originalApi = { ...api };

function backendStatus(): Record<AutomationBackend, boolean> {
  return AUTOMATION_BACKENDS.reduce<Record<AutomationBackend, boolean>>(
    (status, backend) => {
      status[backend] = true;
      return status;
    },
    {} as Record<AutomationBackend, boolean>,
  );
}

function validDefinition(): AutomationDefinition {
  return createAutomationDefinition('auto-1', 'Alpha', 1, {
    graph: {
      nodes: [
        createAutomationNode('n1', AUTOMATION_KIND.INPUT, { x: 0, y: 0 }, { data: { kind: AUTOMATION_KIND.INPUT, path: '/in.mp4' } }),
        createAutomationNode('n2', AUTOMATION_KIND.OUTPUT, { x: 1, y: 0 }, { data: { kind: AUTOMATION_KIND.OUTPUT, path: '/out.mp4' } }),
      ],
      edges: [createAutomationEdge('n1', 'n2')],
    },
  });
}

function progressEvent(runId: string): AutomationProgressEvent {
  return { runId, automationId: 'auto-1', nodeId: 'n1', status: 'running', progress: 1 };
}

function hasToast(message: string): boolean {
  return useToastStore.getState().toasts.some((toast) => toast.message === message);
}

describe('useAutomations branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(api, originalApi);
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
      backendStatus: backendStatus(),
    });
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    useToastStore.setState({ toasts: [] });
    automationStartMock.mockResolvedValue('run-42');
    automationCancelMock.mockResolvedValue(true);
    onAutomationStatusMock.mockReturnValue(vi.fn());
    onAutomationProgressMock.mockReturnValue(vi.fn());
    onAutomationEventMock.mockReturnValue(vi.fn());
    getMediaInfoMock.mockResolvedValue({ file: '/in', format: '', size: 0, duration: 0, bitrate: '', streams: [] });
    getBmfStatusMock.mockResolvedValue({ available: true, missing: [] });
    selectFileMock.mockResolvedValue(null);
  });

  afterEach(() => {
    Object.assign(api, originalApi);
  });

  it('infers image, audio, and unknown media kinds', async () => {
    useAutomationStore.setState({ activeDefinition: validDefinition() });
    const { result } = renderHook(() => useAutomations());
    const kinds: (string | null)[] = [];

    await act(async () => {
      kinds.push(await result.current.probeInput('/clip.png'));
    });
    getMediaInfoMock.mockResolvedValue({
      file: '/clip.mkv',
      format: '',
      size: 0,
      duration: 0,
      bitrate: '',
      streams: [{ index: 0, type: 'audio', codec: 'aac' }],
    });
    await act(async () => {
      kinds.push(await result.current.probeInput('/clip.mkv'));
    });
    getMediaInfoMock.mockResolvedValue({ file: '/clip.bin', format: '', size: 0, duration: 0, bitrate: '', streams: [] });
    await act(async () => {
      kinds.push(await result.current.probeInput('/clip.bin'));
    });

    expect(kinds).toEqual(['image', 'audio', 'unknown']);
  });

  it('evicts old pending run ids and tolerates subscription failures', () => {
    let statusCallback: ((event: AutomationProgressEvent) => void) | undefined;
    onAutomationStatusMock.mockImplementation((callback) => {
      statusCallback = callback;
      throw new Error('subscribe failed');
    });
    onAutomationProgressMock.mockImplementation(() => {
      throw new Error('subscribe failed');
    });
    renderHook(() => useAutomations());

    act(() => {
      for (let index = 0; index < 20; index += 1) statusCallback?.(progressEvent(`pending-${index}`));
    });

    expect(statusCallback).toBeTypeOf('function');
  });

  it('marks BMF unavailable when the status bridge rejects', async () => {
    getBmfStatusMock.mockRejectedValue(new Error('bmf failed'));
    const { result } = renderHook(() => useAutomations());

    await act(async () => {
      await result.current.initialize();
    });

    expect(useAutomationStore.getState().backendStatus.BMF).toBe(false);
  });

  it('reports failed library operations through error toasts', async () => {
    const { result } = renderHook(() => useAutomations());

    await act(async () => {
      expect(await result.current.saveAutomation()).toBeNull();
      expect(await result.current.saveAutomationAs('')).toBeNull();
      expect(await result.current.loadAutomation('missing')).toBeNull();
      expect(await result.current.deleteAutomation('missing')).toBe(false);
      expect(await result.current.duplicateAutomation('missing')).toBeNull();
      expect(await result.current.importAutomation()).toBeNull();
    });

    expect(hasToast('automations.saveFailed')).toBe(true);
    expect(hasToast('automations.saveAsFailed')).toBe(true);
    expect(hasToast('automations.loadFailed')).toBe(true);
    expect(hasToast('automations.deleteFailed')).toBe(true);
    expect(hasToast('automations.duplicateFailed')).toBe(true);
    expect(hasToast('automations.importFailed')).toBe(true);
  });

  it('warns when probing without an input and when the probe bridge is missing', async () => {
    const { result } = renderHook(() => useAutomations());

    await act(async () => {
      expect(await result.current.probeInput()).toBeNull();
    });
    expect(hasToast('automations.probeNoInput')).toBe(true);

    delete api.getMediaInfo;
    await act(async () => {
      expect(await result.current.probeInput('/in.mp4')).toBeNull();
    });
    expect(hasToast('automations.probeUnavailable')).toBe(true);
  });

  it('selects an input file with and without an input node', async () => {
    selectFileMock.mockResolvedValue('/selected.mp4');
    const { result } = renderHook(() => useAutomations());

    await act(async () => {
      await result.current.selectInput();
    });
    expect(useToastStore.getState().toasts).toEqual([]);

    act(() => {
      useAutomationStore.setState({ activeDefinition: validDefinition() });
    });
    await act(async () => {
      await result.current.selectInput();
    });

    expect(useAutomationStore.getState().activeDefinition?.graph.nodes[0].data).toEqual({
      kind: AUTOMATION_KIND.INPUT,
      path: '/selected.mp4',
    });
    expect(getMediaInfoMock).toHaveBeenCalledWith('/selected.mp4', 'FFMPEG');
  });

  it('returns null when no runtime input file is selected', async () => {
    const { result } = renderHook(() => useAutomations());

    await act(async () => {
      expect(await result.current.selectRuntimeInput()).toBeNull();
    });
    expect(getMediaInfoMock).not.toHaveBeenCalled();
  });

  it('warns when running without a definition and rejects invalid run ids', async () => {
    const { result } = renderHook(() => useAutomations());

    await act(async () => {
      expect(await result.current.run()).toBeNull();
    });
    expect(hasToast('automations.runNoDefinition')).toBe(true);

    automationStartMock.mockResolvedValueOnce('');
    act(() => {
      useAutomationStore.setState({ activeDefinition: validDefinition() });
    });
    await act(async () => {
      expect(await result.current.run()).toBeNull();
    });
    expect(useErrorStore.getState().currentError).not.toBeNull();
  });

  it('reports unavailable and failed cancellation bridges', async () => {
    const { result } = renderHook(() => useAutomations());

    delete api.automationCancel;
    await act(async () => {
      expect(await result.current.cancel('run-1')).toBe(false);
    });
    expect(hasToast('automations.cancelUnavailable')).toBe(true);

    api.automationCancel = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const { result: second } = renderHook(() => useAutomations());
    await act(async () => {
      expect(await second.current.cancel('run-1')).toBe(false);
    });
    expect(hasToast('automations.cancelFailed')).toBe(true);
  });
});
