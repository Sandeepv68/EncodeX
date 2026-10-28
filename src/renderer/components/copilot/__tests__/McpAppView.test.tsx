/**
 * @fileoverview Tests for the in-app MCP App host and the transcript view.
 *
 * The Copilot renders the MCP App views; the views call tools back through the
 * in-app host, which forwards the call to the main process. These tests cover
 * that path and the two edges of the view component: an unknown view id and a
 * call without arguments.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18next from 'i18next';

// The global test setup mocks react-i18next with a tiny key dictionary; the
// views need the real provider so the real translations are exercised.
vi.unmock('react-i18next');

import { AppIpcHost } from '../../../mcp-views/AppIpcHost';
import AssistantMessage from '../AssistantMessage';
import { createAppTheme } from '../../../../shared/theme/theme';
import enUS from '../../../i18n/locales/en-US.json';
import type { McpViewAttachment } from '../../../../shared/mcp-ui';
import type { CopilotPlan } from '../../../../shared/copilot';
import McpAppView from '../McpAppView';

void i18next.use(initReactI18next).init({
  resources: { 'en-US': { translation: enUS } },
  lng: 'en-US',
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

/**
 * Renders the transcript view with the app providers.
 * @param {McpViewAttachment} attachment - The view to render.
 * @returns {import('@testing-library/react').RenderResult} The render result.
 */
function renderViewFor(attachment: McpViewAttachment) {
  return render(
    <ThemeProvider theme={createAppTheme('light', 'ltr')}>
      <I18nextProvider i18n={i18next}>
        <McpAppView attachment={attachment} />
      </I18nextProvider>
    </ThemeProvider>,
  );
}

describe('AppIpcHost', () => {
  it('calls a tool through the main process', async () => {
    const callTool = vi.fn().mockResolvedValue({ content: [], structuredContent: { ok: true } });
    window.electronAPI.mcpUiCallTool = callTool as unknown as typeof window.electronAPI.mcpUiCallTool;
    const host = new AppIpcHost();
    const result = await host.callTool('list_jobs', { a: 1 });
    expect(callTool).toHaveBeenCalledWith('list_jobs', { a: 1 });
    expect(result.structuredContent).toEqual({ ok: true });
  });

  it('calls a tool without arguments', async () => {
    const callTool = vi.fn().mockResolvedValue({});
    window.electronAPI.mcpUiCallTool = callTool as unknown as typeof window.electronAPI.mcpUiCallTool;
    await new AppIpcHost().callTool('list_jobs');
    expect(callTool).toHaveBeenCalledWith('list_jobs', {});
  });

  it('answers with an empty result when the main process returns nothing', async () => {
    const callTool = vi.fn().mockResolvedValue(undefined);
    window.electronAPI.mcpUiCallTool = callTool as unknown as typeof window.electronAPI.mcpUiCallTool;
    const result = await new AppIpcHost().callTool('list_jobs');
    expect(result).toEqual({});
  });

  it('reports a host that can proxy tool calls', () => {
    const host = new AppIpcHost();
    expect(host.context.supportsServerTools).toBe(true);
    expect(host.context.variables).toEqual({});
  });

  it('has no push channel, so subscribing is a no-op', () => {
    const host = new AppIpcHost();
    const unsubscribe = host.subscribe(() => undefined);
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe('McpAppView', () => {
  it('renders nothing for an unknown view', () => {
    const { container } = renderViewFor({
      viewId: 'nope',
      uri: 'ui://encodex/nope',
      toolName: 'nope',
      structuredContent: {},
    } as unknown as McpViewAttachment);
    expect(container.innerHTML).toBe('');
  });

  it('renders the view the attachment names', async () => {
    const callTool = vi.fn().mockResolvedValue({ content: [], structuredContent: {} });
    window.electronAPI.mcpUiCallTool = callTool as unknown as typeof window.electronAPI.mcpUiCallTool;
    renderViewFor({
      viewId: 'queue',
      uri: 'ui://encodex/queue',
      toolName: 'list_jobs',
      structuredContent: { jobs: [{ id: 'a', input: '/a.mkv', output: '/a.mp4', status: 'running', progress: 5 }] },
    });
    expect(screen.getByTestId('mcp-view-queue')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('a.mp4')).toBeTruthy());
  });
});

describe('AssistantMessage', () => {
  /**
   * Builds a plan for the tests.
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

  it('renders the views the plan carries', () => {
    const callTool = vi.fn().mockResolvedValue({ content: [], structuredContent: {} });
    window.electronAPI.mcpUiCallTool = callTool as unknown as typeof window.electronAPI.mcpUiCallTool;
    render(
      <ThemeProvider theme={createAppTheme('light', 'ltr')}>
        <I18nextProvider i18n={i18next}>
          <AssistantMessage
            plan={makePlan([
              {
                viewId: 'queue',
                uri: 'ui://encodex/queue',
                toolName: 'list_jobs',
                structuredContent: { jobs: [{ id: 'a', input: '/a.mkv', output: '/a.mp4', status: 'running', progress: 5 }] },
              },
            ])}
            onAddToQueue={() => undefined}
          />
        </I18nextProvider>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('copilot-mcp-views')).toBeTruthy();
    expect(screen.getByTestId('mcp-view-queue')).toBeTruthy();
  });

  it('renders no view slot when the plan carries none', () => {
    render(
      <ThemeProvider theme={createAppTheme('light', 'ltr')}>
        <I18nextProvider i18n={i18next}>
          <AssistantMessage plan={makePlan()} onAddToQueue={() => undefined} />
        </I18nextProvider>
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('copilot-mcp-views')).toBeNull();
  });
});
