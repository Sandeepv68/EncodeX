/**
 * @fileoverview Path tests for the MCP App views.
 *
 * Each view renders whatever the host delivers, and every optional field is a
 * branch. These tests walk the paths a real host produces: a video stream, an
 * audio stream, a subtitle stream, a job, a batch, a full conversion form.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('react-i18next');

import BatchView from '../views/BatchView';
import CapabilitiesView from '../views/CapabilitiesView';
import ConfirmView from '../views/ConfirmView';
import ConvertView from '../views/ConvertView';
import ErrorView from '../views/ErrorView';
import InspectorView from '../views/InspectorView';
import JobView from '../views/JobView';
import LabView from '../views/LabView';
import MediaInfoView from '../views/MediaInfoView';
import PlanView from '../views/PlanView';
import ProfilesView from '../views/ProfilesView';
import QueueView from '../views/QueueView';
import WorkflowView from '../views/WorkflowView';
import { FakeViewHost, renderView } from './harness';

describe('media-info view streams', () => {
  it('describes an audio stream', () => {
    renderView(<MediaInfoView />, new FakeViewHost(), {
      media: { streams: [{ index: 1, type: 'audio', codec: 'aac', channelLayout: 'stereo', sampleRate: 48000 }] },
    });
    expect(screen.getByText('stereo - 48000 Hz')).toBeTruthy();
  });

  it('falls back to the channel count when there is no layout', () => {
    renderView(<MediaInfoView />, new FakeViewHost(), {
      media: { streams: [{ index: 1, type: 'audio', codec: 'aac', channels: 2 }] },
    });
    expect(screen.getByText('2 ch')).toBeTruthy();
  });

  it('describes a subtitle stream by its title or language', () => {
    renderView(<MediaInfoView />, new FakeViewHost(), {
      media: {
        streams: [
          { index: 2, type: 'subtitle', title: 'English' },
          { index: 3, type: 'subtitle', language: 'de' },
        ],
      },
    });
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('de')).toBeTruthy();
  });

  it('describes a video stream without a resolution', () => {
    renderView(<MediaInfoView />, new FakeViewHost(), {
      media: { streams: [{ index: 0, type: 'video', codec: 'h264' }] },
    });
    expect(screen.getByText('h264')).toBeTruthy();
  });
});

describe('inspector view facts', () => {
  it('describes the video stream with its tags', () => {
    renderView(<InspectorView />, new FakeViewHost(), {
      analysis: {
        facts: { video: { codec: 'h264', width: 1920, height: 1080, hdr: true, interlaced: true } },
        findings: [],
      },
    });
    expect(screen.getByText(/h264 1920x1080 \(HDR, interlaced\)/)).toBeTruthy();
  });

  it('describes the audio stream', () => {
    renderView(<InspectorView />, new FakeViewHost(), {
      analysis: { facts: { audio: { codec: 'aac', channelLayout: 'stereo' } }, findings: [] },
    });
    expect(screen.getByText('aac stereo')).toBeTruthy();
  });

  it('reports a missing video or audio stream', () => {
    renderView(<InspectorView />, new FakeViewHost(), { analysis: { facts: {}, findings: [] } });
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });
});

describe('job view paths', () => {
  it('shows the failure of a job', () => {
    renderView(<JobView />, new FakeViewHost(), {
      job: { id: 'a', input: '/a.mkv', output: '/a.mp4', status: 'error', progress: 0, error: 'the encoder gave up' },
    });
    expect(screen.getByText('the encoder gave up')).toBeTruthy();
  });

  it('offers the cancel action while the job runs', () => {
    renderView(<JobView />, new FakeViewHost(), {
      job: { id: 'a', input: '/a.mkv', output: '/a.mp4', status: 'running', progress: 5 },
    });
    expect(screen.getByTestId('mcp-view-job-cancel')).toBeTruthy();
  });
});

describe('queue view counts', () => {
  it('uses the singular form for one job', () => {
    renderView(<QueueView />, new FakeViewHost(), {
      jobs: [{ id: 'a', input: '/a.mkv', output: '/a.mp4', status: 'queued', progress: 0 }],
    });
    expect(screen.getByText('1 job')).toBeTruthy();
  });
});

describe('confirm view paths', () => {
  it('tracks the job a committed operation returned', () => {
    renderView(<ConfirmView />, new FakeViewHost(), {
      job: { id: 'a', input: '/a.mkv', output: '/a.mp4', status: 'running', progress: 20 },
    });
    expect(screen.getByText('/a.mp4')).toBeTruthy();
    expect(screen.getByTestId('mcp-view-confirm-cancel')).toBeTruthy();
  });

  it('lists the jobs a batch queued', () => {
    renderView(<ConfirmView />, new FakeViewHost(), {
      jobs: [{ id: 'a', output: '/a.mp4', status: 'queued' }],
    });
    expect(screen.getByText('a.mp4')).toBeTruthy();
    expect(screen.getByText('1 jobs')).toBeTruthy();
  });

  it('cancels the job it tracks', async () => {
    const host = new FakeViewHost();
    renderView(<ConfirmView />, host, {
      job: { id: 'a', input: '/a.mkv', output: '/a.mp4', status: 'running', progress: 20 },
    });
    await userEvent.click(screen.getByTestId('mcp-view-confirm-cancel'));
    await userEvent.click(screen.getByTestId('mcp-view-confirm-cancel'));
    await waitFor(() => expect(host.calls).toHaveLength(1));
    expect(host.calls[0]).toEqual({ name: 'cancel_job', args: { jobId: 'a' } });
  });
});

describe('convert view paths', () => {
  it('collects every setting the user typed', async () => {
    const host = new FakeViewHost();
    renderView(<ConvertView />, host, {
      confirmation: { operation: 'convert_media', title: 'Convert', summary: 'Convert it', args: { input: '/a.mkv' } },
    });
    const input = screen.getByTestId('mcp-view-convert-input') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, 'C:/media/clip.mkv');
    const fields = screen.getAllByRole('textbox');
    for (const field of fields.slice(1)) await userEvent.type(field, 'x');
    await userEvent.click(screen.getByTestId('mcp-view-convert-submit'));
    await waitFor(() => expect(host.calls).toHaveLength(1));
    const args = (host.calls[0].args as { args: Record<string, unknown> }).args;
    expect(args.input).toBe('C:/media/clip.mkv');
    expect(args.videoCodec).toBe('x');
  });

  it('shows the failure of a conversion that could not start', async () => {
    const host = new FakeViewHost();
    host.result = { isError: true, content: [{ type: 'text', text: 'the server refused' }] };
    renderView(<ConvertView />, host, {
      confirmation: { operation: 'convert_media', title: 'Convert', summary: 'Convert it', args: { input: '/a.mkv' } },
    });
    await userEvent.click(screen.getByTestId('mcp-view-convert-submit'));
    await waitFor(() => expect(screen.getByText(/the server refused/)).toBeTruthy());
  });

  it('tracks the job the conversion produced', () => {
    renderView(<ConvertView />, new FakeViewHost(), {
      job: { id: 'a', input: '/a.mkv', output: '/a.mp4', status: 'running', progress: 30 },
    });
    expect(screen.getByText('/a.mp4')).toBeTruthy();
    expect(screen.getByTestId('mcp-view-convert-cancel')).toBeTruthy();
  });
});

describe('batch view paths', () => {
  it('renders the dashboard of a running batch', () => {
    renderView(<BatchView />, new FakeViewHost(), {
      jobs: [{ id: 'a', input: '/a.mkv', output: '/a.mp4', status: 'done', progress: 100 }],
    });
    expect(screen.getByText('a.mp4')).toBeTruthy();
    expect(screen.getByText('1 file')).toBeTruthy();
  });

  it('shows the failure of a batch whose commit threw', async () => {
    const host = new FakeViewHost();
    host.result = { isError: true, content: [{ type: 'text', text: 'no files matched' }] };
    renderView(<BatchView />, host, {
      confirmation: { operation: 'batch_convert', title: 'Confirm batch', summary: '12 files', args: {} },
    });
    await userEvent.click(screen.getByTestId('mcp-view-batch-run'));
    await waitFor(() => expect(screen.getByText('no files matched')).toBeTruthy());
  });

  it('shows the details and the warnings of a batch proposal', () => {
    renderView(<BatchView />, new FakeViewHost(), {
      confirmation: {
        operation: 'batch_convert',
        title: 'Confirm batch',
        summary: '12 files',
        args: {},
        details: [{ label: 'Destination', value: 'C:/out' }],
        warnings: ['the output folder is not empty'],
      },
    });
    expect(screen.getByText('C:/out')).toBeTruthy();
    expect(screen.getByText('the output folder is not empty')).toBeTruthy();
  });

  it('renders a batch of several files with the plural count', () => {
    renderView(<BatchView />, new FakeViewHost(), {
      jobs: [
        { id: 'a', output: '/a.mp4', status: 'queued', progress: 0 },
        { id: 'b', output: '/b.mp4', status: 'queued', progress: 0 },
      ],
    });
    expect(screen.getByText('2 files')).toBeTruthy();
  });

  it('shows the failure of a batch that could not start', async () => {
    const host = new FakeViewHost();
    host.result = { isError: true, content: [{ type: 'text', text: 'no files matched' }] };
    renderView(<BatchView />, host, {
      confirmation: { operation: 'batch_convert', title: 'Confirm batch', summary: '12 files', args: {} },
    });
    await userEvent.click(screen.getByTestId('mcp-view-batch-run'));
    await waitFor(() => expect(screen.getByText('no files matched')).toBeTruthy());
  });
});

describe('lab view paths', () => {
  it('lists the candidate ladder and the plan notes', () => {
    renderView(<LabView />, new FakeViewHost(), {
      lab: {
        converged: false,
        plan: { baselineVideoKbps: 2000, audioBitrateKbps: 128, candidates: [], notes: ['the source has no audio'] },
      },
    });
    expect(screen.getByText(/Size-derived baseline/)).toBeTruthy();
    expect(screen.getByText('the source has no audio')).toBeTruthy();
  });

  it('reports a run that found no fit', () => {
    renderView(<LabView />, new FakeViewHost(), { lab: { converged: false, attempts: [] } });
    expect(screen.getByText('no fit')).toBeTruthy();
  });
});

describe('error view paths', () => {
  it('reports a fix that was sent for confirmation', async () => {
    const host = new FakeViewHost();
    host.result = { content: [], structuredContent: { confirmation: { operation: 'convert_media' } } };
    renderView(<ErrorView />, host, {
      error: { code: 'X', explanation: 'boom', fixes: [{ label: 'Retry', kind: 'retry', tool: 'convert_media', args: {} }] },
    });
    await userEvent.click(screen.getByTestId('mcp-view-error-fix'));
    await waitFor(() => expect(screen.getByText(/Sent for confirmation: Retry/)).toBeTruthy());
  });

  it('reports a fix that was applied', async () => {
    const host = new FakeViewHost();
    renderView(<ErrorView />, host, {
      error: { code: 'X', explanation: 'boom', fixes: [{ label: 'Retry', kind: 'retry', tool: 'convert_media', args: {} }] },
    });
    await userEvent.click(screen.getByTestId('mcp-view-error-fix'));
    await waitFor(() => expect(screen.getByText(/Requested: Retry/)).toBeTruthy());
  });
});

describe('plan view paths', () => {
  it('names the hardware acceleration methods', () => {
    renderView(<PlanView />, new FakeViewHost(), {
      estimate: { method: 'bitrate', hardwareAcceleration: { available: true, methods: ['qsv', 'vaapi'] } },
    });
    expect(screen.getByText('qsv, vaapi')).toBeTruthy();
  });

  it('reports hardware acceleration without a method', () => {
    renderView(<PlanView />, new FakeViewHost(), {
      estimate: { method: 'bitrate', hardwareAcceleration: { available: true, methods: [] } },
    });
    expect(screen.getByText('available')).toBeTruthy();
  });
});

describe('profiles view paths', () => {
  it('reports that no profile matches the filter', async () => {
    renderView(<ProfilesView />, new FakeViewHost(), { profiles: [{ id: 'web', name: 'Web' }] });
    await userEvent.type(screen.getByTestId('mcp-view-profiles-filter'), 'zzz');
    await waitFor(() => expect(screen.getByTestId('mcp-view-profiles-no-match')).toBeTruthy());
  });
});

describe('capabilities view paths', () => {
  it('lists the audio encoders', () => {
    renderView(<CapabilitiesView />, new FakeViewHost(), {
      capabilities: { videoEncoders: ['libx264'], audioEncoders: ['aac'], hwaccels: [] },
    });
    expect(screen.getByText('aac')).toBeTruthy();
  });
});

describe('workflow view paths', () => {
  it('accepts a plan that arrives without its wrapper', () => {
    renderView(<WorkflowView />, new FakeViewHost(), { valid: true, steps: [] });
    expect(screen.getByTestId('mcp-view-workflow-plan')).toBeTruthy();
  });

  it('accepts a result that arrives without its wrapper', () => {
    renderView(<WorkflowView />, new FakeViewHost(), { steps: [], completed: 1 });
    expect(screen.getByTestId('mcp-view-workflow-result')).toBeTruthy();
  });

  it('reports a run that failed', () => {
    renderView(<WorkflowView />, new FakeViewHost(), { result: { completed: 0, failed: 1, steps: [] } });
    expect(screen.getByText('failed')).toBeTruthy();
  });
});
