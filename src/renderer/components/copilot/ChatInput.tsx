/**
 * @fileoverview Lexical-based chat composer input for the Copilot conversation.
 *
 * The editor is a controlled component: `onChange` streams the plain-text
 * content up to the page, and the page clears `value` to `''` after a submit,
 * which this component mirrors back into the editor. Enter submits; Shift+Enter
 * inserts a line break.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, COMMAND_PRIORITY_LOW, INSERT_LINE_BREAK_COMMAND, KEY_ENTER_COMMAND } from 'lexical';
import type { EditorState } from 'lexical';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faPlus, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
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
  busy?: boolean;
  hasInputs?: boolean;
  onResetConversation?: () => void;
  showReset?: boolean;
  onResetConfirm?: () => void;
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
 * Wraps the composer shell and routes a click anywhere in it to the editor, so
 * pressing the padding around the single-line field still focuses the input
 * instead of doing nothing.
 * @param {object} props - Plugin props.
 * @param {ReactNode} props.children - The shell content.
 * @returns {JSX.Element} The focusable composer shell.
 */
function FocusableShell({ children }: { children: ReactNode }) {
  const [editor] = useLexicalComposerContext();

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    const root = editor.getRootElement();
    if (root && !root.contains(target)) editor.focus();
  };

  return <ComposerShell onMouseDown={handleMouseDown}>{children}</ComposerShell>;
}

/**
 * Renders the Lexical composer input with its inline send and plan buttons.
 * @param {ChatInputProps} props - Component props.
 * @returns {JSX.Element} The composer input.
 */
export default function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder,
  busy = false,
  hasInputs = false,
  onResetConversation,
  showReset = false,
}: ChatInputProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const placeholderText = placeholder ?? t('copilot.placeholder');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const handleResetClick = () => {
    if (busy || disabled) return;
    setResetDialogOpen(true);
  };

  const handleResetConfirm = () => {
    setResetDialogOpen(false);
    if (onResetConversation) {
      onResetConversation();
    }
  };

  const initialConfig = {
    namespace: 'CopilotInput',
    theme: editorTheme,
    onError,
    editable: !disabled,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <FocusableShell>
        <EditorArea
          sx={{
            alignItems: 'center',
            flexWrap: 'nowrap',
            gap: theme.spacing(0.5),
            display: showReset && onResetConversation ? 'flex' : 'flex',
          }}
        >
          {showReset && onResetConversation && (
            <Tooltip title={t('copilot.resetConversation')} placement="top" arrow>
              <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, lineHeight: 0 }}>
                <IconButton
                  size="small"
                  onClick={handleResetClick}
                  disabled={busy || disabled}
                  aria-label={t('copilot.resetConversation')}
                  data-testid="copilot-reset-conversation"
                  sx={{
                    color: 'text.secondary',
                    flexShrink: 0,
                    padding: theme.spacing(0.25),
                    '&:hover': {
                      color: 'primary.main',
                    },
                  }}
                >
                  <FontAwesomeIcon icon={faPlus} style={{ fontSize: theme.typography.pxToRem(14), display: 'block' }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Box
            sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', position: 'relative', height: theme.typography.pxToRem(28) }}
          >
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  tabIndex={0}
                  aria-label={t('copilot.inputAria')}
                  style={{
                    width: '100%',
                    outline: 'none',
                    lineHeight: theme.typography.pxToRem(28),
                    height: theme.typography.pxToRem(28),
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                    margin: 0,
                  }}
                />
              }
              placeholder={
                <EditorPlaceholder
                  style={{
                    lineHeight: theme.typography.pxToRem(28),
                    height: theme.typography.pxToRem(28),
                    display: 'flex',
                    alignItems: 'center',
                    margin: 0,
                    padding: 0,
                    top: 0,
                  }}
                >
                  {placeholderText}
                </EditorPlaceholder>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </Box>
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
        >
          <FontAwesomeIcon icon={faPaperPlane} aria-hidden />
        </IconButton>
        <Button
          variant="contained"
          size="small"
          startIcon={<FontAwesomeIcon icon={faWandMagicSparkles} />}
          onClick={onSubmit}
          disabled={disabled || busy || value.trim() === '' || !hasInputs}
          data-testid="copilot-plan"
        >
          {busy ? t('copilot.planning') : t('copilot.plan')}
        </Button>
      </FocusableShell>
      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        aria-labelledby="copilot-reset-dialog-title"
        aria-describedby="copilot-reset-dialog-description"
      >
        <DialogTitle id="copilot-reset-dialog-title">{t('copilot.resetConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText id="copilot-reset-dialog-description">{t('copilot.resetConfirmMessage')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>{t('closeConfirm.cancelLabel')}</Button>
          <Button onClick={handleResetConfirm} color="error" variant="contained" autoFocus>
            {t('copilot.resetConfirmAction')}
          </Button>
        </DialogActions>
      </Dialog>
    </LexicalComposer>
  );
}
