/**
 * @fileoverview Component tests for the Copilot conversation building blocks:
 * the Lexical `ChatInput` composer and the `Conversation` transcript.
 *
 * These are driven the way the browser drives them -- an `input` event carrying
 * inserted text and `keydown` for Enter/Shift+Enter -- so they cover the editor
 * wiring that the page suite exercises only indirectly.
 */

import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ColorModeProvider } from '../ColorModeContext';
import ChatInput from '../components/copilot/ChatInput';
import ChatComposer from '../components/copilot/ChatComposer';
import AssistantMessage from '../components/copilot/AssistantMessage';
import Conversation, { type ConversationMessage } from '../components/copilot/Conversation';
import type { CopilotPlan, CopilotOperationChoice } from '../../shared/copilot';

const PLAN: CopilotPlan = {
  goal: 'compress for web',
  operation: 'convert',
  actions: [
    {
      id: 'convert_0',
      operation: 'convert',
      input: '/in/one.mp4',
      output: '/in/one_optimized.mp4',
      confidence: 0.8,
      rationale: ['Re-encodes to a web-friendly size.'],
      estimatedSizeBytes: 500_000,
      estimatedSavings: 0.5,
      options: { videoCodec: 'libx264' },
    },
  ],
  results: [],
  skips: [],
  rationale: ['Planned 1 conversion.'],
  notes: [],
  plan: { valid: true, order: ['convert_0'], steps: [], issues: [], summary: '1 step' },
  providerId: 'rules',
  isEstimated: true,
};

/** Returns the Lexical contenteditable root. */
function getEditor(): HTMLElement {
  const el = document.querySelector('[data-lexical-editor="true"]');
  if (!el) throw new Error('Lexical editor not found');
  return el as HTMLElement;
}

/**
 * Types text into the Lexical composer the way the browser does.
 * @param {string} text - The text to insert.
 * @returns {Promise<void>} Resolves once the change has settled.
 */
async function typeText(text: string): Promise<void> {
  const editor = getEditor();
  await act(async () => {
    editor.focus();
    fireEvent.input(editor, { data: text, inputType: 'insertText' });
  });
}

/**
 * Controlled harness around {@link ChatInput} so typing flows through a parent
 * the way the real page does, plus a button to reset the value.
 * @param {object} props - Harness props.
 * @param {() => void} props.onSubmit - Submit callback.
 * @param {string} [props.startValue] - Initial controlled value.
 * @param {boolean} [props.disabled] - Whether the composer is disabled.
 * @param {boolean} [props.busy] - Whether a plan request is in flight.
 * @param {boolean} [props.hasInputs] - Whether any inputs are attached.
 * @returns {JSX.Element} The harness.
 */
function Harness({
  onSubmit,
  startValue = '',
  disabled = false,
  busy = false,
  hasInputs = false,
}: {
  onSubmit: () => void;
  startValue?: string;
  disabled?: boolean;
  busy?: boolean;
  hasInputs?: boolean;
}) {
  const [value, setValue] = useState(startValue);
  return (
    <ColorModeProvider>
      <ChatInput value={value} onChange={setValue} onSubmit={onSubmit} disabled={disabled} busy={busy} hasInputs={hasInputs} />
      <button type="button" onClick={() => setValue('')}>
        clear
      </button>
    </ColorModeProvider>
  );
}

describe('ChatInput', () => {
  it('streams typed text up to the controlled value', async () => {
    render(<Harness onSubmit={vi.fn()} />);
    expect((screen.getByTestId('copilot-send') as HTMLButtonElement).disabled).toBe(true);
    await typeText('hello world');
    expect(getEditor().textContent).toBe('hello world');
    expect((screen.getByTestId('copilot-send') as HTMLButtonElement).disabled).toBe(false);
  });

  it('submits on Enter', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await typeText('compress for web');
    await act(async () => {
      fireEvent.keyDown(getEditor(), { key: 'Enter' });
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('inserts a line break on Shift+Enter instead of submitting', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await typeText('line one');
    await act(async () => {
      fireEvent.keyDown(getEditor(), { key: 'Enter', shiftKey: true });
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(getEditor().innerHTML).toContain('<br>');
  });

  it('clears the editor when the controlled value returns to empty', async () => {
    render(<Harness onSubmit={vi.fn()} />);
    await typeText('hello');
    expect(getEditor().textContent).toBe('hello');
    fireEvent.click(screen.getByText('clear'));
    await waitFor(() => expect(getEditor().textContent).toBe(''));
  });

  it('makes the editor read-only when disabled', async () => {
    render(<Harness onSubmit={vi.fn()} disabled />);
    expect((screen.getByTestId('copilot-send') as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(getEditor().getAttribute('contenteditable')).toBe('false'));
  });

  it('focuses the editor when the composer shell is pressed', async () => {
    render(<Harness onSubmit={vi.fn()} />);
    const editor = getEditor();
    const lexical = (editor as unknown as { __lexicalEditor: { focus: () => void } }).__lexicalEditor;
    const focusSpy = vi.spyOn(lexical, 'focus');
    const shell = editor.parentElement as HTMLElement;
    await act(async () => {
      fireEvent.mouseDown(shell);
    });
    expect(focusSpy).toHaveBeenCalled();
  });

  it('reports an editor error through console.error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Harness onSubmit={vi.fn()} />);
    const editor = (getEditor() as unknown as { __lexicalEditor: { update: (fn: () => void) => void } }).__lexicalEditor;
    await act(async () => {
      editor.update(() => {
        throw new Error('boom');
      });
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('swaps the plan-button label and disables it while busy', () => {
    render(<Harness onSubmit={vi.fn()} startValue="go" hasInputs busy />);
    const plan = screen.getByTestId('copilot-plan') as HTMLButtonElement;
    expect(plan).toHaveTextContent('copilot.planning');
    expect(plan.disabled).toBe(true);
  });

  it('disables the plan button until inputs are attached', () => {
    render(<Harness onSubmit={vi.fn()} startValue="go" />);
    expect((screen.getByTestId('copilot-plan') as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not steal focus when a button inside the shell is pressed', async () => {
    render(<Harness onSubmit={vi.fn()} />);
    const editor = getEditor();
    const lexical = (editor as unknown as { __lexicalEditor: { focus: () => void } }).__lexicalEditor;
    const focusSpy = vi.spyOn(lexical, 'focus').mockImplementation(() => {});
    await act(async () => {
      fireEvent.mouseDown(screen.getByTestId('copilot-send'));
    });
    expect(focusSpy).not.toHaveBeenCalled();
    focusSpy.mockRestore();
  });
});

describe('Conversation', () => {
  const baseMessage: Omit<ConversationMessage, 'id' | 'role' | 'timestamp'> = {};

  it('shows the welcome hero before the first message', () => {
    render(
      <ColorModeProvider>
        <Conversation messages={[]} onAddToQueue={vi.fn()} />
      </ColorModeProvider>,
    );
    expect(screen.getByText('copilot.welcome')).toBeInTheDocument();
    expect(screen.getByText('copilot.goal')).toBeInTheDocument();
  });

  it('renders user messages and a thinking indicator', () => {
    const messages: ConversationMessage[] = [{ id: 'u1', role: 'user', content: 'compress for web', timestamp: 1 }];
    render(
      <ColorModeProvider>
        <Conversation messages={messages} isThinking onAddToQueue={vi.fn()} />
      </ColorModeProvider>,
    );
    expect(screen.getByText('compress for web')).toBeInTheDocument();
    expect(screen.getAllByText(/copilot.thinking/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByTestId('copilot-typing-dots').children).toHaveLength(3);
  });

  it('renders an assistant plan and invokes onAddToQueue', () => {
    const onAddToQueue = vi.fn();
    const messages: ConversationMessage[] = [{ id: 'a1', role: 'assistant', plan: PLAN, timestamp: 2, ...baseMessage }];
    render(
      <ColorModeProvider>
        <Conversation messages={messages} onAddToQueue={onAddToQueue} />
      </ColorModeProvider>,
    );
    expect(screen.getByTestId('copilot-plan-summary')).toBeInTheDocument();
    expect(screen.getByTestId('copilot-action-convert_0')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('copilot-add-to-queue'));
    expect(onAddToQueue).toHaveBeenCalledWith(PLAN);
  });

  it('renders inline errors and notices', () => {
    const messages: ConversationMessage[] = [
      { id: 'a1', role: 'assistant', error: 'copilot.errorNoGoal', timestamp: 1 },
      { id: 'a2', role: 'assistant', notice: 'copilot.noticeNoFiles', timestamp: 2 },
    ];
    render(
      <ColorModeProvider>
        <Conversation messages={messages} onAddToQueue={vi.fn()} />
      </ColorModeProvider>,
    );
    expect(screen.getAllByText(/copilot.errorNoGoal/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/copilot.noticeNoFiles/).length).toBeGreaterThan(0);
  });

  it('skips assistant messages that carry no plan, error or notice', () => {
    const messages: ConversationMessage[] = [{ id: 'a1', role: 'assistant', timestamp: 1 }];
    render(
      <ColorModeProvider>
        <Conversation messages={messages} onAddToQueue={vi.fn()} />
      </ColorModeProvider>,
    );
    expect(screen.queryByTestId('copilot-plan-summary')).toBeNull();
    expect(screen.queryByText('copilot.welcome')).toBeNull();
  });

  it('shows the selected attachment count on a user message', () => {
    const messages: ConversationMessage[] = [
      { id: 'u1', role: 'user', content: 'go', attachments: ['/in/a.mp4', '/in/b.mkv'], timestamp: 1 },
    ];
    render(
      <ColorModeProvider>
        <Conversation messages={messages} onAddToQueue={vi.fn()} />
      </ColorModeProvider>,
    );
    expect(screen.getByText('copilot.selectedCount')).toBeInTheDocument();
  });

  it('scrolls the transcript to the bottom when messages arrive', () => {
    const { rerender } = render(
      <ColorModeProvider>
        <Conversation messages={[]} onAddToQueue={vi.fn()} />
      </ColorModeProvider>,
    );
    const scroll = screen.getByTestId('copilot-conversation');
    Object.defineProperty(scroll, 'scrollHeight', { configurable: true, value: 480 });
    const messages: ConversationMessage[] = [{ id: 'u1', role: 'user', content: 'hi', timestamp: 1 }];
    rerender(
      <ColorModeProvider>
        <Conversation messages={messages} onAddToQueue={vi.fn()} />
      </ColorModeProvider>,
    );
    expect(scroll.scrollTop).toBe(480);
  });

  it('renders only a window of a long transcript', () => {
    const messages: ConversationMessage[] = Array.from({ length: 1_000 }, (_, index) => ({
      id: `u${index}`,
      role: 'user',
      content: `message ${index}`,
      timestamp: index,
    }));
    render(
      <ColorModeProvider>
        <Conversation messages={messages} onAddToQueue={vi.fn()} />
      </ColorModeProvider>,
    );
    expect(screen.getByText('message 0')).toBeInTheDocument();
    expect(screen.queryByText('message 999')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('copilot-message-row').length).toBeLessThan(50);

    const conversation = screen.getByTestId('copilot-conversation');
    conversation.scrollTop = 104_000;
    fireEvent.scroll(conversation);
    expect(screen.getByText('message 999')).toBeInTheDocument();
    expect(screen.getAllByTestId('copilot-message-row').length).toBeLessThan(50);
  });

  it('disables the add-to-queue button while busy', () => {
    const messages: ConversationMessage[] = [{ id: 'a1', role: 'assistant', plan: PLAN, timestamp: 2 }];
    render(
      <ColorModeProvider>
        <Conversation messages={messages} onAddToQueue={vi.fn()} busy />
      </ColorModeProvider>,
    );
    expect((screen.getByTestId('copilot-add-to-queue') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('AssistantMessage', () => {
  /**
   * Renders an AssistantMessage with sensible defaults.
   * @param {object} [props] - Overrides for the component props.
   * @returns {void}
   */
  function renderMessage(props: Partial<Parameters<typeof AssistantMessage>[0]> = {}): void {
    render(
      <ColorModeProvider>
        <AssistantMessage plan={null} onAddToQueue={vi.fn()} {...props} />
      </ColorModeProvider>,
    );
  }

  it('returns nothing without a plan, error or notice', () => {
    const { container } = render(
      <ColorModeProvider>
        <AssistantMessage plan={null} onAddToQueue={vi.fn()} />
      </ColorModeProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the routed-as chip and rationale list', () => {
    renderMessage({ plan: PLAN });
    expect(screen.getByTestId('copilot-plan-summary')).toBeInTheDocument();
    expect(screen.getByTestId('copilot-routed-as').textContent).toMatch(/copilot.routedAs/);
    expect(screen.getAllByText(/copilot.rationaleTitle/).length).toBeGreaterThan(0);
    expect(screen.getByText('Planned 1 conversion.')).toBeInTheDocument();
  });

  it('renders the assistant body with semantic headings and lists', () => {
    renderMessage({ plan: PLAN });
    expect(screen.getByTestId('copilot-plan-summary')).toBeInTheDocument();
    expect(screen.getAllByText(/copilot.actionsTitle/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('list').length).toBeGreaterThan(0);
  });

  it('omits the routed-as chip when no operation was resolved', () => {
    renderMessage({ plan: { ...PLAN, operation: null } });
    expect(screen.queryByTestId('copilot-routed-as')).toBeNull();
  });

  it('shows a warning when the AI provider fell back to the rules engine', () => {
    renderMessage({ plan: { ...PLAN, routingWarning: 'AI routing failed; rules were used.' } });
    expect(screen.getByTestId('copilot-routing-warning')).toHaveTextContent('AI routing failed; rules were used.');
  });

  it('does not show a routing warning for a provider-chosen plan', () => {
    renderMessage({ plan: { ...PLAN, providerId: 'gemini' } });
    expect(screen.queryByTestId('copilot-routing-warning')).toBeNull();
  });

  it('renders savings and output for each action', () => {
    renderMessage({ plan: PLAN });
    expect(screen.getByText('copilot.savings')).toBeInTheDocument();
    expect(screen.getByText('copilot.output')).toBeInTheDocument();
  });

  it('renders the apply note alongside the add-to-queue button', () => {
    renderMessage({ plan: PLAN });
    expect(screen.getByTestId('copilot-add-to-queue')).toBeInTheDocument();
    expect(screen.getByText('copilot.applyNote')).toBeInTheDocument();
  });

  it('shows the no-actions note and hides the add-to-queue button', () => {
    renderMessage({ plan: { ...PLAN, actions: [], plan: { ...PLAN.plan, steps: [] } } });
    expect(screen.getByText(/copilot.noActions/)).toBeInTheDocument();
    expect(screen.queryByTestId('copilot-add-to-queue')).toBeNull();
    expect(screen.queryByText('copilot.applyNote')).toBeNull();
  });

  it('renders read-only results and skips', () => {
    renderMessage({
      plan: {
        ...PLAN,
        actions: [],
        results: [{ input: '/in/one.mp4', operation: 'analyze', title: 'Transcript', summary: 'Found 2 mentions' }],
        skips: [{ input: '/in/two.mp4', reason: 'Already web-optimized' }],
      },
    });
    expect(screen.getAllByText(/copilot.resultsTitle/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('copilot-result')).toBeInTheDocument();
    expect(screen.getAllByText(/copilot.skipsTitle/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('copilot-skip')).toBeInTheDocument();
    expect(screen.getByText('Already web-optimized')).toBeInTheDocument();
  });

  it('gives an error precedence over a notice and a plan', () => {
    renderMessage({ plan: PLAN, error: 'copilot.planFailed', notice: 'copilot.noticeNoFiles' });
    expect(screen.getByText(/copilot.planFailed/)).toBeInTheDocument();
    expect(screen.queryByText(/copilot.noticeNoFiles/)).toBeNull();
    expect(screen.queryByTestId('copilot-plan-summary')).toBeNull();
  });

  it('gives a notice precedence over a plan', () => {
    renderMessage({ plan: PLAN, notice: 'copilot.noticeNoFiles' });
    expect(screen.getAllByText(/copilot.noticeNoFiles/).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('copilot-plan-summary')).toBeNull();
  });
});

describe('ChatComposer', () => {
  /**
   * Renders a ChatComposer with spy callbacks.
   * @param {object} [overrides] - Prop overrides.
   * @returns {object} The spy callbacks used by the test.
   */
  function renderComposer(overrides: Partial<Parameters<typeof ChatComposer>[0]> = {}) {
    const props = {
      input: '',
      onInputChange: vi.fn(),
      onSubmit: vi.fn(),
      onChooseFiles: vi.fn(),
      onChooseFolder: vi.fn(),
      onOpenSettings: vi.fn(),
      inputs: [] as string[],
      operation: 'auto' as CopilotOperationChoice,
      onOperationChange: vi.fn(),
      query: '',
      onQueryChange: vi.fn(),
      targetLanguage: '',
      onTargetLanguageChange: vi.fn(),
      ...overrides,
    };
    render(
      <ColorModeProvider>
        <ChatComposer {...props} />
      </ColorModeProvider>,
    );
    return props;
  }

  it('invokes the file, folder and settings actions', () => {
    const props = renderComposer();
    fireEvent.click(screen.getByTestId('copilot-choose-files'));
    fireEvent.click(screen.getByTestId('copilot-choose-folder'));
    fireEvent.click(screen.getByTestId('copilot-ai-settings'));
    expect(props.onChooseFiles).toHaveBeenCalledTimes(1);
    expect(props.onChooseFolder).toHaveBeenCalledTimes(1);
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('disables every secondary action while busy', () => {
    renderComposer({ busy: true });
    for (const id of ['copilot-choose-files', 'copilot-choose-folder', 'copilot-advanced', 'copilot-ai-settings']) {
      expect((screen.getByTestId(id) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('opens the advanced popover and closes it again', async () => {
    renderComposer();
    fireEvent.click(screen.getByTestId('copilot-advanced'));
    expect(await screen.findByTestId('copilot-operation')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('copilot-advanced-close'));
    await waitFor(() => expect(screen.queryByTestId('copilot-operation')).toBeNull());
  });

  it('reports an operation change', async () => {
    const props = renderComposer();
    fireEvent.click(screen.getByTestId('copilot-advanced'));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'copilot.operationLabel' }));
    fireEvent.click(await screen.findByText('copilot.op.remux'));
    expect(props.onOperationChange).toHaveBeenCalledWith('remux');
  });

  it('reveals the transcript-query field for the search operation', async () => {
    const props = renderComposer({ operation: 'search_transcript' });
    fireEvent.click(screen.getByTestId('copilot-advanced'));
    const field = await screen.findByRole('textbox', { name: 'copilot.queryLabel' });
    fireEvent.change(field, { target: { value: 'pricing' } });
    expect(props.onQueryChange).toHaveBeenCalledWith('pricing');
  });

  it('reveals the target-language field for the translate operation', async () => {
    const props = renderComposer({ operation: 'translate' });
    fireEvent.click(screen.getByTestId('copilot-advanced'));
    const field = await screen.findByRole('textbox', { name: 'copilot.targetLanguageLabel' });
    fireEvent.change(field, { target: { value: 'es' } });
    expect(props.onTargetLanguageChange).toHaveBeenCalledWith('es');
  });

  it('removes an attachment through its chip delete icon', () => {
    const onRemoveInput = vi.fn();
    renderComposer({ inputs: ['/in/a.mp4'], onRemoveInput });
    fireEvent.click(screen.getByTestId('CancelIcon'));
    expect(onRemoveInput).toHaveBeenCalledWith('/in/a.mp4');
  });

  it('renders a non-removable chip when no remove handler is given', () => {
    renderComposer({ inputs: ['/in/a.mp4'] });
    expect(screen.getByText('a.mp4')).toBeInTheDocument();
    expect(screen.queryByTestId('CancelIcon')).toBeNull();
  });
});
