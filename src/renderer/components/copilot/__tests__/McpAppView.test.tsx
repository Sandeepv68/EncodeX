/**
 * @fileoverview Tests for the MCP App views rendered inside the Copilot.
 *
 * The transcript renders the same React components an external MCP Apps host
 * renders, so these tests check that a plan carrying a view attachment mounts
 * the right component and that the view can call tools back through the
 * in-app host.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('react-i18next');

import { render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import AssistantMessage from '../AssistantMessage';
import { createAppTheme } from '../../../../shared/theme/theme';
import enUS from '../../../i18n/locales/en-US.json';
import type { CopilotPlan } from '../../../../shared/copilot';

void i18next.use(initReactI18next).init({
  resources: { 'en-US': { translation: enUS } },
  lng: 'en-US',
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

/**
 * Builds a minimal plan for the tests.
 * @param {CopilotPlan['views']} views - The views the plan carries.
 * @returns {CopilotPlan} The plan.
 */
function makePlan(views?: CopilotPlan['views']): CopilotPlan {
  return {
    goal: 'inspect this file',
    operation: 'analyze',
    actions: [],
    results: [],
    skips: [],
    rationale: [],
    notes: [],
    plan: { valid: true, order: [], steps: [], issues: [], summary: '' },
    providerId: 'rules',
    isEstimated: true,
    ...(views ? { views } : {}),
  };
}

/**
 * Renders the assistant message.
 * @param {CopilotPlan} plan - The plan to render.
 * @returns {ReturnType<typeof render>} The render result.
 */
function renderMessage(plan: CopilotPlan) {
  return render(
    <ThemeProvider theme={createAppTheme('light', 'ltr')}>
      <I18nextProvider i18n={i18next}>
        <AssistantMessage plan={plan} onAddToQueue={() => undefined} />
      </I18nextProvider>
    </ThemeProvider>,
  );
}

describe('Copilot MCP App views', () => {
  it('renders the inspector view attached to an analyze plan', () => {
    renderMessage(
      makePlan([
        {
          viewId: 'inspector',
          uri: 'ui://encodex/inspector',
          toolName: 'analyze_media',
          structuredContent: {
            analysis: {
              file: '/in/a.mkv',
              summary: 'Fine for the web.',
              findings: [{ severity: 'warning', message: 'Audio is loud' }],
              recommendations: ['Lower the volume'],
            },
          },
        },
      ]),
    );
    expect(screen.getByTestId('copilot-mcp-views')).toBeTruthy();
    expect(screen.getByText('Fine for the web.')).toBeTruthy();
    expect(screen.getByText('Audio is loud')).toBeTruthy();
  });

  it('renders nothing extra when the plan carries no view', () => {
    renderMessage(makePlan());
    expect(screen.queryByTestId('copilot-mcp-views')).toBeNull();
  });

  it('lets the view call a tool through the in-app host', async () => {
    const callTool = vi.fn().mockResolvedValue({ content: [], structuredContent: {} });
    window.electronAPI.mcpUiCallTool = callTool as unknown as typeof window.electronAPI.mcpUiCallTool;
    renderMessage(
      makePlan([
        {
          viewId: 'queue',
          uri: 'ui://encodex/queue',
          toolName: 'list_jobs',
          structuredContent: { jobs: [{ id: 'a', input: '/in/a.mkv', output: '/out/a.mp4', status: 'running', progress: 5 }] },
        },
      ]),
    );
    const cancel = screen.getByTestId('mcp-view-queue-cancel-a');
    await userEvent.click(cancel);
    await userEvent.click(cancel);
    await waitFor(() => expect(callTool).toHaveBeenCalled());
    expect(callTool).toHaveBeenCalledWith('cancel_job', { jobId: 'a' });
  });
});
