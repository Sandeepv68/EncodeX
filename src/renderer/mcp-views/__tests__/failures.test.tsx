/**
 * @fileoverview Tests for the failure paths of the MCP App views.
 *
 * A view that renders a payload it never received, or whose tool call fails,
 * must degrade instead of crashing: the user sees a placeholder or a message,
 * never a broken frame.
 */

import type { ReactElement } from 'react';
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

/**
 * A host whose tool calls always fail.
 * @returns {FakeViewHost} The failing host.
 */
function failingHost(): FakeViewHost {
  const host = new FakeViewHost();
  host.callTool = vi.fn().mockRejectedValue(new Error('the server refused'));
  return host;
}

describe('views without a payload', () => {
  it('shows the placeholder of every view that needs one', () => {
    const cases: Array<[() => ReactElement, string]> = [
      [() => <QueueView />, 'mcp-view-queue-empty'],
      [() => <JobView />, 'mcp-view-job-empty'],
      [() => <MediaInfoView />, 'mcp-view-media-info-empty'],
      [() => <ConvertView />, 'mcp-view-convert'],
      [() => <ConfirmView />, 'mcp-view-confirm-empty'],
      [() => <InspectorView />, 'mcp-view-inspector-empty'],
      [() => <PlanView />, 'mcp-view-plan-empty'],
      [() => <LabView />, 'mcp-view-lab-empty'],
      [() => <ErrorView />, 'mcp-view-error-empty'],
      [() => <BatchView />, 'mcp-view-batch-empty'],
      [() => <WorkflowView />, 'mcp-view-workflow-empty'],
      [() => <ProfilesView />, 'mcp-view-profiles-empty'],
      [() => <CapabilitiesView />, 'mcp-view-capabilities-empty'],
    ];
    for (const [view, testId] of cases) {
      const { unmount } = renderView(view());
      expect(screen.getByTestId(testId), testId).toBeTruthy();
      unmount();
    }
  });
});

describe('views whose tool call fails', () => {
  it('reports the failure of a confirmation', async () => {
    renderView(<ConfirmView />, failingHost(), { confirmation: { operation: 'cut_video', title: 'Cut', summary: 'Trims', args: {} } });
    await userEvent.click(screen.getByTestId('mcp-view-confirm-run'));
    await waitFor(() => expect(screen.getByText(/the server refused/)).toBeTruthy());
  });

  it('reports the failure of a conversion', async () => {
    renderView(<ConvertView />, failingHost(), {
      confirmation: { operation: 'convert_media', title: 'Convert', summary: 'Convert it', args: { input: '/a.mkv' } },
    });
    await userEvent.click(screen.getByTestId('mcp-view-convert-submit'));
    await waitFor(() => expect(screen.getByText(/the server refused/)).toBeTruthy());
  });

  it('reports the failure of a batch whose commit threw', async () => {
    renderView(<BatchView />, failingHost(), {
      confirmation: { operation: 'batch_convert', title: 'Confirm batch', summary: '12 files', args: {} },
    });
    await userEvent.click(screen.getByTestId('mcp-view-batch-run'));
    await waitFor(() => expect(screen.getByText(/the server refused/)).toBeTruthy());
  });

  it('reports the failure of a fix', async () => {
    renderView(<ErrorView />, failingHost(), {
      error: { code: 'X', explanation: 'boom', fixes: [{ label: 'Retry', kind: 'retry', tool: 'convert_media', args: {} }] },
    });
    await userEvent.click(screen.getByTestId('mcp-view-error-fix'));
    await waitFor(() => expect(screen.getByText(/the server refused/)).toBeTruthy());
  });
});

describe('views whose destructive action is armed', () => {
  it('cancels the job the convert view tracks', async () => {
    const host = new FakeViewHost();
    renderView(<ConvertView />, host, { job: { id: 'a', input: '/a.mkv', output: '/a.mp4', status: 'running', progress: 10 } });
    await userEvent.click(screen.getByTestId('mcp-view-convert-cancel'));
    await userEvent.click(screen.getByTestId('mcp-view-convert-cancel'));
    await waitFor(() => expect(host.calls).toHaveLength(1));
    expect(host.calls[0]).toEqual({ name: 'cancel_job', args: { jobId: 'a' } });
  });

  it('cancels the job the job view tracks', async () => {
    const host = new FakeViewHost();
    renderView(<JobView />, host, { job: { id: 'a', input: '/a.mkv', output: '/a.mp4', status: 'running', progress: 10 } });
    await userEvent.click(screen.getByTestId('mcp-view-job-cancel'));
    await userEvent.click(screen.getByTestId('mcp-view-job-cancel'));
    await waitFor(() => expect(host.calls).toHaveLength(1));
    expect(host.calls[0]).toEqual({ name: 'cancel_job', args: { jobId: 'a' } });
  });
});

describe('the lossless copy option', () => {
  it('sends the copy flag with the conversion', async () => {
    const host = new FakeViewHost();
    renderView(<ConvertView />, host, {
      confirmation: { operation: 'convert_media', title: 'Convert', summary: 'Convert it', args: { input: '/a.mkv' } },
    });
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByTestId('mcp-view-convert-submit'));
    await waitFor(() => expect(host.calls).toHaveLength(1));
    const args = (host.calls[0].args as { args: Record<string, unknown> }).args;
    expect(args.copy).toBe(true);
  });
});

describe('the severity of a finding', () => {
  it('falls back to info for an unknown severity', () => {
    renderView(<InspectorView />, new FakeViewHost(), {
      analysis: { findings: [{ severity: 'critical', message: 'odd severity' }] },
    });
    expect(screen.getByText('Info')).toBeTruthy();
  });
});

describe('the notes of an estimate', () => {
  it('lists the assumptions of the estimate', () => {
    renderView(<PlanView />, new FakeViewHost(), {
      estimate: { method: 'bitrate', notes: ['the source has no audio'] },
    });
    expect(screen.getByText('the source has no audio')).toBeTruthy();
  });
});
