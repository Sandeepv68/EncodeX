/**
 * @fileoverview Edge-case tests for the MCP App views.
 *
 * The views render whatever the host delivers, which may be a full payload or
 * almost nothing. These tests walk both sides of every optional field, so a
 * view can never crash on a partial payload - and so the optional-field
 * branches are covered.
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
import { structuredPayload, resultText } from '../host';
import { findMcpViewComponent, mcpViewUri } from '../registry';

describe('host helpers', () => {
  it('reads the structured payload of a result', () => {
    expect(structuredPayload({ structuredContent: { a: 1 } })).toEqual({ a: 1 });
    expect(structuredPayload({ content: [{ type: 'text', text: 'x' }] })).toBeUndefined();
    expect(structuredPayload(undefined)).toBeUndefined();
  });

  it('concatenates the text blocks of a result', () => {
    expect(
      resultText({
        content: [
          { type: 'text', text: 'a' },
          { type: 'text', text: 'b' },
        ],
      }),
    ).toBe('ab');
    expect(resultText({ content: [{ type: 'image' }] })).toBe('');
    expect(resultText(undefined)).toBe('');
  });
});

describe('view registry', () => {
  it('resolves a known view and refuses an unknown one', () => {
    expect(findMcpViewComponent('queue')).toBeTruthy();
    expect(findMcpViewComponent('nope')).toBeUndefined();
    expect(mcpViewUri('queue')).toBe('ui://encodex/queue');
  });
});

describe('views with a partial payload', () => {
  it('renders the queue view without jobs', () => {
    renderView(<QueueView />, new FakeViewHost(), {});
    expect(screen.getByTestId('mcp-view-queue-empty')).toBeTruthy();
  });

  it('renders the job view without a job', () => {
    renderView(<JobView />, new FakeViewHost(), {});
    expect(screen.getByTestId('mcp-view-job-empty')).toBeTruthy();
  });

  it('renders the job view without paths', () => {
    renderView(<JobView />, new FakeViewHost(), { job: { id: 'a', status: 'queued', progress: 0 } });
    expect(screen.getByTestId('mcp-view-job')).toBeTruthy();
  });

  it('renders the media-info view without streams', () => {
    renderView(<MediaInfoView />, new FakeViewHost(), { media: { format: 'mp4' } });
    expect(screen.getByTestId('mcp-view-media-info')).toBeTruthy();
  });

  it('renders the inspector view without findings', () => {
    renderView(<InspectorView />, new FakeViewHost(), { analysis: { file: '/a.mkv' } });
    expect(screen.getByTestId('mcp-view-inspector')).toBeTruthy();
  });

  it('renders the plan view without a plan', () => {
    renderView(<PlanView />, new FakeViewHost(), {});
    expect(screen.getByTestId('mcp-view-plan-empty')).toBeTruthy();
  });

  it('renders the plan view with a plan that has no rationale or settings', () => {
    renderView(<PlanView />, new FakeViewHost(), { plan: { profileId: 'web' } });
    expect(screen.getByTestId('mcp-view-plan-card')).toBeTruthy();
  });

  it('renders the estimate card without notes or hardware', () => {
    renderView(<PlanView />, new FakeViewHost(), { estimate: { method: 'bitrate' } });
    expect(screen.getByTestId('mcp-view-plan-estimate')).toBeTruthy();
  });

  it('renders the lab view without attempts or a plan', () => {
    renderView(<LabView />, new FakeViewHost(), { lab: { input: '/a.mkv' } });
    expect(screen.getByTestId('mcp-view-lab-summary')).toBeTruthy();
  });

  it('renders the lab view with attempts but no chosen fit', () => {
    renderView(<LabView />, new FakeViewHost(), {
      lab: { converged: false, attempts: [{ candidate: 'c1', videoBitrateKbps: 900, status: 'error' }] },
    });
    expect(screen.getByTestId('mcp-view-lab-attempts')).toBeTruthy();
    expect(screen.queryByTestId('mcp-view-lab-chosen')).toBeNull();
  });

  it('renders the error view without causes or fixes', () => {
    renderView(<ErrorView />, new FakeViewHost(), { error: { code: 'X', explanation: 'boom' } });
    expect(screen.getByTestId('mcp-view-error')).toBeTruthy();
  });

  it('renders a fix that carries no tool as plain text', () => {
    renderView(<ErrorView />, new FakeViewHost(), {
      error: { code: 'X', explanation: 'boom', fixes: [{ label: 'Read the docs', description: 'no tool' }] },
    });
    expect(screen.getByText('Read the docs')).toBeTruthy();
    expect(screen.queryByTestId('mcp-view-error-fix')).toBeNull();
  });

  it('renders the batch view without jobs', () => {
    renderView(<BatchView />, new FakeViewHost(), { jobs: [] });
    expect(screen.getByTestId('mcp-view-batch-empty')).toBeTruthy();
  });

  it('renders the workflow view without a plan or a result', () => {
    renderView(<WorkflowView />, new FakeViewHost(), {});
    expect(screen.getByTestId('mcp-view-workflow-empty')).toBeTruthy();
  });

  it('renders the workflow plan with issues', () => {
    renderView(<WorkflowView />, new FakeViewHost(), {
      plan: { valid: false, issues: [{ message: 'step a is unknown' }], steps: [] },
    });
    expect(screen.getByText('step a is unknown')).toBeTruthy();
    expect(screen.getByText('invalid')).toBeTruthy();
  });

  it('renders the profiles view with a profile that has no codecs', () => {
    renderView(<ProfilesView />, new FakeViewHost(), { profiles: [{ id: 'x', name: 'X' }] });
    expect(screen.getByText('X')).toBeTruthy();
  });

  it('renders the capabilities view without encoders', () => {
    renderView(<CapabilitiesView />, new FakeViewHost(), { capabilities: {} });
    expect(screen.getByTestId('mcp-view-capabilities')).toBeTruthy();
  });

  it('renders the capabilities view without hardware acceleration', () => {
    renderView(<CapabilitiesView />, new FakeViewHost(), { capabilities: { videoEncoders: ['libx264'], audioEncoders: [], hwaccels: [] } });
    expect(screen.getByText('Software only')).toBeTruthy();
  });

  it('renders the confirm view without details or warnings', () => {
    renderView(<ConfirmView />, new FakeViewHost(), {
      confirmation: { operation: 'cut_video', title: 'Cut', summary: 'Trims', args: {} },
    });
    expect(screen.getByTestId('mcp-view-confirm')).toBeTruthy();
  });

  it('renders the convert view without a proposal', () => {
    renderView(<ConvertView />, new FakeViewHost(), {});
    expect(screen.getByTestId('mcp-view-convert')).toBeTruthy();
  });
});

describe('view error handling', () => {
  it('shows the failure of a tool call the view made', async () => {
    const host = new FakeViewHost();
    host.result = { isError: true, content: [{ type: 'text', text: 'the tool said no' }] };
    renderView(<ErrorView />, host, {
      error: {
        code: 'X',
        explanation: 'boom',
        fixes: [{ label: 'Retry', kind: 'retry', tool: 'convert_media', args: { input: '/a.mkv' } }],
      },
    });
    await userEvent.click(screen.getByTestId('mcp-view-error-fix'));
    await waitFor(() => expect(screen.getByText(/the tool said no/)).toBeTruthy());
  });

  it('shows the failure of a confirmation that returned no job', async () => {
    const host = new FakeViewHost();
    host.result = { content: [], structuredContent: {} };
    renderView(<ConfirmView />, host, {
      confirmation: { operation: 'cut_video', title: 'Cut', summary: 'Trims', args: {} },
    });
    await userEvent.click(screen.getByTestId('mcp-view-confirm-run'));
    await waitFor(() => expect(screen.getByText('The operation did not return a job.')).toBeTruthy());
  });

  it('shows the failure of a batch that needed re-approval', async () => {
    const host = new FakeViewHost();
    host.result = { content: [], structuredContent: { confirmation: { operation: 'batch_convert' } } };
    renderView(<BatchView />, host, {
      confirmation: { operation: 'batch_convert', title: 'Confirm batch', summary: '12 files', args: {} },
    });
    await userEvent.click(screen.getByTestId('mcp-view-batch-run'));
    await waitFor(() => expect(screen.getByText('This batch changed and needs re-approval.')).toBeTruthy());
  });
});
