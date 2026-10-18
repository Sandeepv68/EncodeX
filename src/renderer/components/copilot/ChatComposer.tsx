/**
 * @fileoverview Chat composer: attachments, Lexical input, secondary actions and
 * the discreet advanced-options popover (operation, transcript query, translate
 * target language).
 */

import { useState } from 'react';
import { Box, Button, Chip, MenuItem, Popover, TextField, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport, faFolderOpen, faGear, faSliders } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import ChatInput from './ChatInput';
import type { CopilotOperationChoice } from '../../../shared/copilot';
import { COPILOT_QUEUE_OPERATIONS, COPILOT_INTELLIGENCE_OPERATIONS } from '../../../shared/copilot';
import type { AIProviderId } from '../../../shared/ai/types';
import {
  ActionsRow,
  AdvancedPanel,
  AttachmentRow,
  ComposerBar,
  ConnectionDot,
  ConnectionStatus,
  LeftActions,
  RightActions,
} from '../../styles/copilot/ChatComposer.styles';

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
}: ChatComposerProps) {
  const { t } = useTranslation();
  const [advancedAnchor, setAdvancedAnchor] = useState<HTMLElement | null>(null);

  return (
    <ComposerBar>
      {inputs.length > 0 && (
        <AttachmentRow>
          {inputs.map((path) => (
            <Chip
              key={path}
              label={path.split(/[/\\]/).pop() || path}
              size="small"
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
          <Button
            size="small"
            startIcon={<FontAwesomeIcon icon={faGear} />}
            onClick={onOpenSettings}
            disabled={busy}
            data-testid="copilot-ai-settings"
          >
            {t('copilot.ai.configure')}
          </Button>
        </LeftActions>
        {connection && (
          <RightActions data-testid="copilot-ai-status">
            <ConnectionStatus $connected={connection.connected}>
              <ConnectionDot $connected={connection.connected} aria-hidden="true" />
              {connection.connected
                ? t('settings.ai.headerConnected', {
                    provider: t(`settings.ai.providers.${connection.providerId}`),
                    model: connection.model || t('settings.ai.modelPlaceholder'),
                  })
                : t('copilot.ai.notConnected')}
            </ConnectionStatus>
          </RightActions>
        )}
      </ActionsRow>
      <Typography variant="caption" color="text.secondary" sx={{ paddingInline: 0.5 }}>
        {t('copilot.ai.locationNote')}
      </Typography>
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
