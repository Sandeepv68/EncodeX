/**
 * @fileoverview Tests for the MCP App views.
 *
 * Each view is mounted with a fake host and a payload, and the test asserts
 * what the user sees. The hostile-payload test keeps the XSS guarantee the
 * hand-written HTML views had: untrusted values are rendered as text.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The global test setup mocks react-i18next with a tiny key dictionary; the
// views need the real provider so the real translations are exercised.
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

describe('queue view', () => {
  it('shows the empty state until the host delivers jobs', () => {
    renderView(<QueueView />);
    expect(screen.getByTestId('mcp-view-queue-empty')).toBeTruthy();
  });

  it('renders one row per job with its status and progress', () => {
    renderView(<QueueView />, new FakeViewHost(), {
      jobs: [
        { id: 'a', input: '/in/a.mkv', output: '/out/a.mp4', status: 'running', progress: 42 },
        { id: 'b', input: '/in/b.mkv', output: '/out/b.mp4', status: 'done', progress: 100 },
      ],
    });
    expect(screen.getByText('a.mp4')).toBeTruthy();
    expect(screen.getByText('b.mp4')).toBeTruthy();
    expect(screen.getByText(/running · 42%/)).toBeTruthy();
  });

  it('arms the cancel button before it cancels the job', async () => {
    const host = new FakeViewHost();
    renderView(<QueueView />, host, { jobs: [{ id: 'a', input: '/in/a.mkv', output: '/out/a.mp4', status: 'running', progress: 10 }] });
    const cancel = screen.getByTestId('mcp-view-queue-cancel-a');
    await userEvent.click(cancel);
    expect(host.calls).toHaveLength(0);
    expect(cancel.getAttribute('data-armed')).toBe('1');
    await userEvent.click(cancel);
    await waitFor(() => expect(host.calls).toHaveLength(1));
    expect(host.calls[0]).toEqual({ name: 'cancel_job', args: { jobId: 'a' } });
  });
});

describe('job view', () => {
  it('shows the job paths and status', () => {
    renderView(<JobView />, new FakeViewHost(), {
      job: { id: 'a', input: '/in/a.mkv', output: '/out/a.mp4', status: 'running', progress: 30 },
    });
    expect(screen.getByText('/in/a.mkv')).toBeTruthy();
    expect(screen.getByText('/out/a.mp4')).toBeTruthy();
    expect(screen.getByText(/running · 30%/)).toBeTruthy();
  });

  it('hides the cancel action once the job finished', () => {
    renderView(<JobView />, new FakeViewHost(), {
      job: { id: 'a', input: '/in/a.mkv', output: '/out/a.mp4', status: 'done', progress: 100 },
    });
    expect(screen.queryByTestId('mcp-view-job-cancel')).toBeNull();
  });
});

describe('media-info view', () => {
  it('renders the container facts and the stream table', () => {
    renderView(<MediaInfoView />, new FakeViewHost(), {
      media: {
        format: 'matroska',
        duration: 125,
        size: 2048,
        bitrate: '1200kb/s',
        streams: [{ index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080, frameRate: '30' }],
      },
    });
    expect(screen.getByText('matroska')).toBeTruthy();
    expect(screen.getByText('2:05')).toBeTruthy();
    expect(screen.getByText('h264')).toBeTruthy();
    expect(screen.getByText('1920 x 1080 - 30 fps')).toBeTruthy();
  });
});

describe('inspector view', () => {
  it('renders the findings with their severity', () => {
    renderView(<InspectorView />, new FakeViewHost(), {
      analysis: {
        file: '/in/a.mkv',
        summary: 'Fine for the web.',
        facts: { durationSeconds: 10, sizeBytes: 1024 },
        findings: [{ severity: 'warning', message: 'Audio is loud' }],
        recommendations: ['Lower the volume'],
      },
    });
    expect(screen.getByText('Fine for the web.')).toBeTruthy();
    expect(screen.getByText('Audio is loud')).toBeTruthy();
    expect(screen.getByText('Warning')).toBeTruthy();
    expect(screen.getByText('Lower the volume')).toBeTruthy();
  });
});

describe('plan view', () => {
  it('renders the recommendation with its rationale and settings', () => {
    renderView(<PlanView />, new FakeViewHost(), {
      plan: { profileId: 'web-720p', confidence: 0.8, rationale: ['Small enough for the web'], args: { videoCodec: 'libx264' } },
    });
    expect(screen.getByText('web-720p')).toBeTruthy();
    expect(screen.getByText('80% confidence')).toBeTruthy();
    expect(screen.getByText('Small enough for the web')).toBeTruthy();
    expect(screen.getByText('Video codec')).toBeTruthy();
  });

  it('renders the size estimate', () => {
    renderView(<PlanView />, new FakeViewHost(), {
      estimate: {
        method: 'bitrate',
        estimatedSizeBytes: 1048576,
        estimatedDurationSeconds: 60,
        videoBitrateKbps: 2000,
        audioBitrateKbps: 128,
        copy: false,
      },
    });
    expect(screen.getByText('Size estimate')).toBeTruthy();
    expect(screen.getByText('1.0 MB')).toBeTruthy();
    expect(screen.getByText('2000 kbps')).toBeTruthy();
  });
});

describe('lab view', () => {
  it('renders the candidate ladder and the attempts', () => {
    renderView(<LabView />, new FakeViewHost(), {
      lab: {
        input: '/in/a.mkv',
        maxBytes: 1048576,
        videoCodec: 'libx264',
        audioCodec: 'aac',
        converged: true,
        chosen: { candidate: 'c1', videoBitrateKbps: 1000, audioBitrateKbps: 128, sizeBytes: 900000, output: '/out/a.mp4', fits: true },
        attempts: [{ candidate: 'c1', videoBitrateKbps: 1000, sizeBytes: 900000, fits: true }],
        plan: {
          baselineVideoKbps: 2000,
          audioBitrateKbps: 128,
          candidates: [{ videoBitrateKbps: 1000, percentOfBaseline: 50, rationale: 'half size' }],
        },
      },
    });
    expect(screen.getByText('Compression lab')).toBeTruthy();
    expect(screen.getByText('fits')).toBeTruthy();
    expect(screen.getByText('Best measured fit')).toBeTruthy();
    expect(screen.getByText(/half size/)).toBeTruthy();
  });
});

describe('error view', () => {
  it('renders the explanation, the causes and the fixes', () => {
    renderView(<ErrorView />, new FakeViewHost(), {
      error: {
        code: 'FFMPEG_FAILED',
        title: 'Conversion failed',
        explanation: 'The encoder refused the file.',
        causes: ['Unsupported pixel format'],
        fixes: [
          { label: 'Re-run the conversion', description: 'Try again', kind: 'retry', tool: 'convert_media', args: { input: '/in/a.mkv' } },
        ],
      },
    });
    expect(screen.getByText('Conversion failed')).toBeTruthy();
    expect(screen.getByText('The encoder refused the file.')).toBeTruthy();
    expect(screen.getByText('Unsupported pixel format')).toBeTruthy();
    expect(screen.getByText('Re-run the conversion')).toBeTruthy();
    expect(screen.getByTestId('mcp-view-error-fix')).toBeTruthy();
  });

  it('calls the fix tool when the user applies it', async () => {
    const host = new FakeViewHost();
    renderView(<ErrorView />, host, {
      error: {
        code: 'X',
        explanation: 'boom',
        fixes: [{ label: 'Retry', kind: 'retry', tool: 'convert_media', args: { input: '/in/a.mkv' } }],
      },
    });
    await userEvent.click(screen.getByTestId('mcp-view-error-fix'));
    await waitFor(() => expect(host.calls).toHaveLength(1));
    expect(host.calls[0].name).toBe('convert_media');
  });
});

describe('confirm view', () => {
  it('renders the proposal and runs it only when the user clicks', async () => {
    const host = new FakeViewHost();
    renderView(<ConfirmView />, host, {
      confirmation: {
        operation: 'cut_video',
        title: 'Cut video',
        summary: 'Trims the file to 10 seconds.',
        args: { input: '/in/a.mkv', duration: 10 },
        details: [{ label: 'Input', value: '/in/a.mkv' }],
        warnings: ['Overwrites the output'],
      },
    });
    expect(screen.getByText('Cut video')).toBeTruthy();
    expect(screen.getByText('Trims the file to 10 seconds.')).toBeTruthy();
    expect(screen.getByText('Overwrites the output')).toBeTruthy();
    expect(host.calls).toHaveLength(0);
    await userEvent.click(screen.getByTestId('mcp-view-confirm-run'));
    await waitFor(() => expect(host.calls).toHaveLength(1));
    expect(host.calls[0]).toEqual({ name: 'commit_operation', args: { tool: 'cut_video', args: { input: '/in/a.mkv', duration: 10 } } });
  });
});

describe('convert view', () => {
  it('pre-fills the form from the proposal and starts the conversion on click', async () => {
    const host = new FakeViewHost();
    renderView(<ConvertView />, host, {
      confirmation: {
        operation: 'convert_media',
        title: 'Convert',
        summary: 'Convert to mp4',
        args: { input: '/in/a.mkv', videoCodec: 'libx264' },
      },
    });
    const input = screen.getByTestId('mcp-view-convert-input') as HTMLInputElement;
    expect(input.value).toBe('/in/a.mkv');
    await userEvent.click(screen.getByTestId('mcp-view-convert-submit'));
    await waitFor(() => expect(host.calls).toHaveLength(1));
    expect(host.calls[0].name).toBe('commit_operation');
    expect((host.calls[0].args as { tool: string }).tool).toBe('convert_media');
  });

  it('refuses to start without an input path', async () => {
    const host = new FakeViewHost();
    renderView(<ConvertView />, host);
    await userEvent.click(screen.getByTestId('mcp-view-convert-submit'));
    expect(host.calls).toHaveLength(0);
    expect(screen.getByText('An input path is required.')).toBeTruthy();
  });
});

describe('batch view', () => {
  it('renders the batch proposal and runs it on click', async () => {
    const host = new FakeViewHost();
    renderView(<BatchView />, host, {
      confirmation: { operation: 'batch_convert', title: 'Confirm batch', summary: '12 files', args: { inputs: ['/in'] } },
    });
    expect(screen.getByText('Confirm batch')).toBeTruthy();
    await userEvent.click(screen.getByTestId('mcp-view-batch-run'));
    await waitFor(() => expect(host.calls).toHaveLength(1));
    expect(host.calls[0].name).toBe('commit_operation');
  });

  it('renders the per-file dashboard once the batch ran', () => {
    renderView(<BatchView />, new FakeViewHost(), {
      jobs: [{ id: 'a', input: '/in/a.mkv', output: '/out/a.mp4', status: 'running', progress: 20 }],
    });
    expect(screen.getByText('a.mp4')).toBeTruthy();
    expect(screen.getByText(/running · 20%/)).toBeTruthy();
  });
});

describe('workflow view', () => {
  it('renders the ordered plan and its dependencies', () => {
    renderView(<WorkflowView />, new FakeViewHost(), {
      plan: {
        summary: 'Two steps',
        valid: true,
        steps: [
          { id: 'a', tool: 'convert_media', dependsOn: [] },
          { id: 'b', tool: 'compress_image', dependsOn: ['a'] },
        ],
      },
    });
    expect(screen.getByText('Two steps')).toBeTruthy();
    expect(screen.getByText('valid')).toBeTruthy();
    expect(screen.getByText('convert_media (a)')).toBeTruthy();
    expect(screen.getByText('needs a')).toBeTruthy();
  });

  it('renders the run report', () => {
    renderView(<WorkflowView />, new FakeViewHost(), {
      result: { completed: 1, failed: 0, steps: [{ id: 'a', tool: 'convert_media', status: 'done', output: '/out/a.mp4' }] },
    });
    expect(screen.getByText('Workflow run')).toBeTruthy();
    expect(screen.getByText('completed')).toBeTruthy();
  });
});

describe('profiles view', () => {
  it('lists the profiles and filters them', async () => {
    renderView(<ProfilesView />, new FakeViewHost(), {
      profiles: [
        { id: 'web-720p', name: 'Web 720p', category: 'web', container: 'mp4', videoCodec: 'libx264', audioCodec: 'aac' },
        { id: 'archive-mkv', name: 'Archive', category: 'archive', container: 'mkv', videoCodec: 'libx265', audioCodec: 'flac' },
      ],
    });
    expect(screen.getByText('Web 720p')).toBeTruthy();
    expect(screen.getByText('archive-mkv')).toBeTruthy();
    await userEvent.type(screen.getByTestId('mcp-view-profiles-filter'), 'archive');
    await waitFor(() => expect(screen.queryByText('Web 720p')).toBeNull());
    expect(screen.getByText('Archive')).toBeTruthy();
  });
});

describe('capabilities view', () => {
  it('lists the encoders and the hardware acceleration methods', () => {
    renderView(<CapabilitiesView />, new FakeViewHost(), {
      capabilities: { videoEncoders: ['libx264'], audioEncoders: ['aac'], hwaccels: ['qsv'] },
    });
    expect(screen.getByText('libx264')).toBeTruthy();
    expect(screen.getByText('aac')).toBeTruthy();
    expect(screen.getByText('qsv')).toBeTruthy();
  });
});

describe('hostile payloads', () => {
  it('renders untrusted metadata as inert text', () => {
    const { container } = renderView(<QueueView />, new FakeViewHost(), {
      jobs: [{ id: 'a', input: '/in/a.mkv', output: '<img src=x onerror=alert(1)>.mp4', status: 'running', progress: 1 }],
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>.mp4');
  });
});
