import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderPage } from '../../../test-utils/page-render';
import { useAutomationStore } from '../../stores/automationStore';

describe('Automations page', () => {
  it('renders the editor shell and creates an empty definition', async () => {
    useAutomationStore.setState({ activeDefinition: null, definitions: [], runs: {} });
    renderPage('Automations');
    expect(screen.getByRole('heading', { name: 'automations.title' })).toBeInTheDocument();
    expect(screen.getByLabelText('automations.paletteLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('automations.inspectorLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('automations.runPanelLabel')).toBeInTheDocument();
    await waitFor(() => expect(useAutomationStore.getState().activeDefinition).not.toBeNull());
  });

  it('adds a node from the palette', async () => {
    useAutomationStore.setState({ activeDefinition: null, definitions: [], runs: {} });
    renderPage('Automations');
    await waitFor(() => expect(useAutomationStore.getState().activeDefinition).not.toBeNull());
    const input = screen.getAllByText('automations.node.input')[0];
    fireEvent.click(input);
    await waitFor(() => expect(useAutomationStore.getState().activeDefinition?.graph.nodes).toHaveLength(1));
  });
});
