/**
 * @fileoverview Chat composer: attachments, Lexical input, secondary actions and
 * the discreet advanced-options popover (operation, transcript query, translate
 * target language).
 */

import { useState } from 'react';
import { Box, Button, Chip, LinearProgress, MenuItem, Popover, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClockRotateLeft, faFileImport, faFloppyDisk, faFolderOpen, faGear, faSliders } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import ChatInput from './ChatInput';
import AiConnectionStatus from '../AiConnectionStatus';
import type { CopilotOperationChoice } from '../../../shared/copilot';
import { COPILOT_QUEUE_OPERATIONS, COPILOT_INTELLIGENCE_OPERATIONS } from '../../../shared/copilot';
import type { AIProviderId } from '../../../shared/ai/types';
import { SHADOWS } from '../../colors';
import { ActionsRow, AdvancedPanel, AttachmentRow, ComposerBar, LeftActions, RightActions } from '../../styles/copilot/ChatComposer.styles';

/** The selectable operations, in menu order (auto first, then queue, then read-only). */
const OPERATION_CHOICES: CopilotOperationChoice[] = ['auto', ...COPILOT_QUEUE_OPERATIONS, ...COPILOT_INTELLIGENCE_OPERATIONS];

/** The active AI connection shown under the composer, when known. */
interface ComposerConnection {
  connected: boolean;
  providerId?: AIProviderId;
  model?: string;
}

interface ChatComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onChooseFiles: () => void;
  onChooseFolder: () => void;
  onOpenSettings: () => void;
  inputs: string[];
  operation: CopilotOperationChoice;
  onOperationChange: (value: CopilotOperationChoice) => void;
  query: string;
  onQueryChange: (value: string) => void;
  targetLanguage: string;
  onTargetLanguageChange: (value: string) => void;
  onRemoveInput?: (path: string) => void;
  disabled?: boolean;
  busy?: boolean;
  hasInputs?: boolean;
  connection?: ComposerConnection;
  onResetConversation?: () => void;
  showReset?: boolean;
  /** Saves the current transcript; only shown when `showSave` is true. */
  onSaveChat?: () => void;
  showSave?: boolean;
  /** Opens the saved-conversations drawer. */
  onOpenSavedChats?: () => void;
  inputsLoading?: boolean;
}

/**
 * Renders the bottom composer with attachments, input, actions and advanced
 * options.
 * @param {ChatComposerProps} props - Component props.
 * @returns {JSX.Element} The composer.
 */
export default function ChatComposer({
  input,
  onInputChange,
  onSubmit,
  onChooseFiles,
  onChooseFolder,
  onOpenSettings,
  inputs,
  operation,
  onOperationChange,
  query,
  onQueryChange,
  targetLanguage,
  onTargetLanguageChange,
  onRemoveInput,
  disabled = false,
  busy = false,
  hasInputs = false,
  connection,
  onResetConversation,
  showReset = false,
  onSaveChat,
  showSave = false,
  onOpenSavedChats,
  inputsLoading = false,
}: ChatComposerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [advancedAnchor, setAdvancedAnchor] = useState<HTMLElement | null>(null);
  const chipShadow = theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT;

  return (
    <ComposerBar>
          {(inputs.length > 0 || inputsLoading) && (
        <AttachmentRow>
          {inputsLoading && inputs.length === 0 && (
            <Chip
              label={t('copilot.loadingFiles')}
              size="small"
              sx={{ maxWidth: '100%', boxShadow: chipShadow }}
              deleteIcon={
                <Box sx={{ display: 'flex', alignItems: 'center', width: theme.typography.pxToRem(40) }}>
                  <LinearProgress sx={{ width: '100%' }} />
                </Box>
              }
              onDelete={() => {}}
            />
          )}
          {inputs.map((path) => (
            <Chip
              key={path}
              label={path.split(/[/\\]/).pop() || path}
              size="small"
              sx={{ boxShadow: chipShadow }}
              onDelete={onRemoveInput ? () => onRemoveInput(path) : undefined}
            />
          ))}
        </AttachmentRow>
      )}
      <ChatInput
        value={input}
        onChange={onInputChange}
        onSubmit={onSubmit}
        disabled={busy || disabled}
        placeholder={t('copilot.placeholder')}
        busy={busy}
        hasInputs={hasInputs}
        showReset={showReset}
        onResetConversation={onResetConversation}
      />
      <ActionsRow>
        <LeftActions>
          <Button
            size="small"
            startIcon={<FontAwesomeIcon icon={faFileImport} />}
            onClick={onChooseFiles}
            disabled={busy}
            data-testid="copilot-choose-files"
          >
            {t('copilot.chooseFiles')}
          </Button>
          <Button
            size="small"
            startIcon={<FontAwesomeIcon icon={faFolderOpen} />}
            onClick={onChooseFolder}
            disabled={busy}
            data-testid="copilot-choose-folder"
          >
            {t('copilot.chooseFolder')}
          </Button>
          <Button
            size="small"
            startIcon={<FontAwesomeIcon icon={faSliders} />}
            onClick={(event) => setAdvancedAnchor(event.currentTarget)}
            disabled={busy}
            aria-haspopup="dialog"
            aria-expanded={advancedAnchor ? 'true' : undefined}
            data-testid="copilot-advanced"
          >
            {t('copilot.advanced')}
          </Button>
          {showSave && (
            <Button
              size="small"
              startIcon={<FontAwesomeIcon icon={faFloppyDisk} />}
              onClick={onSaveChat}
              disabled={busy}
              data-testid="copilot-save-chat"
            >
              {t('copilot.saveChat')}
            </Button>
          )}
          {onOpenSavedChats && (
            <Button
              size="small"
              startIcon={<FontAwesomeIcon icon={faClockRotateLeft} />}
              onClick={onOpenSavedChats}
              disabled={busy}
              data-testid="copilot-saved-chats"
            >
              {t('copilot.savedChats')}
            </Button>
          )}
        </LeftActions>
        <RightActions sx={{ backgroundColor: 'transparent', border: 0, paddingInline: 0, paddingBlock: 0, '&:hover': { paddingInline: 0 } }}>
          {connection && (
            <AiConnectionStatus
              connected={connection.connected}
              providerId={connection.providerId}
              model={connection.model}
              testId="copilot-ai-status"
              elevated
            />
          )}
          <Tooltip title={t('copilot.ai.locationNote')} placement="top" arrow>
            <span>
              <Button
                size="small"
                startIcon={<FontAwesomeIcon icon={faGear} />}
                onClick={onOpenSettings}
                disabled={busy}
                data-testid="copilot-ai-settings"
              >
                {t('copilot.ai.configure')}
              </Button>
            </span>
          </Tooltip>
        </RightActions>
      </ActionsRow>
      {/* Location note moved to tooltip on the AI configure button. */}
      <Popover
        open={Boolean(advancedAnchor)}
        anchorEl={advancedAnchor}
        onClose={() => setAdvancedAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <AdvancedPanel>
          <Typography variant="subtitle2">{t('copilot.advancedTitle')}</Typography>
          <TextField
            select
            size="small"
            label={t('copilot.operationLabel')}
            value={operation}
            onChange={(event) => onOperationChange(event.target.value as CopilotOperationChoice)}
            data-testid="copilot-operation"
          >
            {OPERATION_CHOICES.map((choice) => (
              <MenuItem key={choice} value={choice}>
                {t(`copilot.op.${choice}`)}
              </MenuItem>
            ))}
          </TextField>
          {operation === 'search_transcript' && (
            <TextField
              size="small"
              label={t('copilot.queryLabel')}
              placeholder={t('copilot.queryPlaceholder')}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              data-testid="copilot-query"
            />
          )}
          {operation === 'translate' && (
            <TextField
              size="small"
              label={t('copilot.targetLanguageLabel')}
              placeholder={t('copilot.targetLanguagePlaceholder')}
              value={targetLanguage}
              onChange={(event) => onTargetLanguageChange(event.target.value)}
              data-testid="copilot-target-language"
            />
          )}
          <Box>
            <Button size="small" onClick={() => setAdvancedAnchor(null)} data-testid="copilot-advanced-close">
              {t('closeConfirm.cancelLabel')}
            </Button>
          </Box>
        </AdvancedPanel>
      </Popover>
    </ComposerBar>
  );
}
