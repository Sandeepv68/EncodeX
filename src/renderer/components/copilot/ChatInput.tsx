/**
 * @fileoverview Lexical-based chat composer input for the Copilot conversation.
 *
 * The editor is a controlled component: `onChange` streams the plain-text
 * content up to the page, and the page clears `value` to `''` after a submit,
 * which this component mirrors back into the editor. Enter submits; Shift+Enter
 * inserts a line break.
 */

import { useCallback, useEffect, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getRoot,
  COMMAND_PRIORITY_LOW,
  INSERT_LINE_BREAK_COMMAND,
  KEY_ENTER_COMMAND,
} from 'lexical';
import type { EditorState } from 'lexical';
import { IconButton } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { ComposerShell, EditorArea, EditorPlaceholder } from '../../styles/copilot/ChatInput.styles';

/** Lexical editor theme; the paragraph class is available for descendant styling. */
const editorTheme = { paragraph: 'copilot-input-paragraph' };

/**
 * Reports an unrecoverable editor error.
 * @param {Error} error - The error raised by Lexical.
 * @returns {void}
 */
function onError(error: Error): void {
  console.error(error);
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Submits on Enter and inserts a line break on Shift+Enter.
 * @param {object} props - Plugin props.
 * @param {() => void} props.onSubmit - Called when plain Enter is pressed.
 * @returns {null} This plugin renders nothing.
 */
function SubmitOnEnterPlugin({ onSubmit }: { onSubmit: () => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event: KeyboardEvent | null) => {
          if (event?.shiftKey) {
            editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
            return true;
          }
          onSubmit();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor, onSubmit],
  );

  return null;
}

/**
 * Keeps the editor's editable flag in sync with the `disabled` prop after mount.
 * @param {object} props - Plugin props.
 * @param {boolean} props.disabled - Whether the editor should be read-only.
 * @returns {null} This plugin renders nothing.
 */
function EditablePlugin({ disabled }: { disabled: boolean }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  return null;
}

/**
 * Streams editor text up on change and clears the editor when the controlled
 * value is reset to empty.
 * @param {object} props - Plugin props.
 * @param {string} props.value - The controlled value.
 * @param {(value: string) => void} props.onChange - Change callback.
 * @returns {JSX.Element} The Lexical `OnChangePlugin`.
 */
function ValueSyncPlugin({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editor] = useLexicalComposerContext();
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (value !== '') return;
    const current = editor.getEditorState().read(() => $getRoot().getTextContent());
    if (current !== '') {
      editor.update(() => {
        $getRoot().clear();
      });
    }
    lastEmittedRef.current = '';
  }, [editor, value]);

  const handleChange = useCallback(
    (state: EditorState) => {
      state.read(() => {
        const text = $getRoot().getTextContent();
        if (text !== lastEmittedRef.current) {
          lastEmittedRef.current = text;
          onChange(text);
        }
      });
    },
    [onChange],
  );

  return <OnChangePlugin onChange={handleChange} />;
}

/**
 * Renders the Lexical composer input and its send button.
 * @param {ChatInputProps} props - Component props.
 * @returns {JSX.Element} The composer input.
 */
export default function ChatInput({ value, onChange, onSubmit, disabled = false, placeholder }: ChatInputProps) {
  const { t } = useTranslation();
  const placeholderText = placeholder ?? t('copilot.placeholder');

  const initialConfig = {
    namespace: 'CopilotInput',
    theme: editorTheme,
    onError,
    editable: !disabled,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <ComposerShell>
        <EditorArea>
          <RichTextPlugin
            contentEditable={<ContentEditable tabIndex={0} aria-label={t('copilot.inputAria')} />}
            placeholder={<EditorPlaceholder>{placeholderText}</EditorPlaceholder>}
            ErrorBoundary={({ children }) => <>{children}</>}
          />
          <HistoryPlugin />
          <SubmitOnEnterPlugin onSubmit={onSubmit} />
          <EditablePlugin disabled={disabled} />
          <ValueSyncPlugin value={value} onChange={onChange} />
        </EditorArea>
        <IconButton
          color="primary"
          size="small"
          onClick={onSubmit}
          disabled={disabled || value.trim() === ''}
          aria-label={t('copilot.send')}
          title={t('copilot.send')}
          data-testid="copilot-send"
          sx={{ marginBottom: 0.25 }}
        >
          <FontAwesomeIcon icon={faPaperPlane} aria-hidden />
        </IconButton>
      </ComposerShell>
    </LexicalComposer>
  );
}
