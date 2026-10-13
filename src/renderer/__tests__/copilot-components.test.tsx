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
import Conversation, { type ConversationMessage } from '../components/copilot/Conversation';
import type { CopilotPlan } from '../../shared/copilot';

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
 * @returns {JSX.Element} The harness.
 */
function Harness({ onSubmit, startValue = '', disabled = false }: { onSubmit: () => void; startValue?: string; disabled?: boolean }) {
  const [value, setValue] = useState(startValue);
  return (
    <ColorModeProvider>
      <ChatInput value={value} onChange={setValue} onSubmit={onSubmit} disabled={disabled} />
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
    expect(screen.getByText('copilot.planning')).toBeInTheDocument();
  });

  it('renders an assistant plan and invokes onAddToQueue', () => {
    const onAddToQueue = vi.fn();
    const messages: ConversationMessage[] = [
      { id: 'a1', role: 'assistant', plan: PLAN, timestamp: 2, ...baseMessage },
    ];
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
    expect(screen.getByText('copilot.errorNoGoal')).toBeInTheDocument();
    expect(screen.getByText('copilot.noticeNoFiles')).toBeInTheDocument();
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
});
