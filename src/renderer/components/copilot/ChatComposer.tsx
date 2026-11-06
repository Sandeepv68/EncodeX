/**
 * @fileoverview Chat composer: attachments, Lexical input, secondary actions and
 * the discreet advanced-options popover (operation, transcript query, translate
 * target language).
 */

import { useState } from 'react';
import { Box, Button, ClickAwayListener, MenuItem, Popover, TextField, Tooltip, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClockRotateLeft,
  faFile,
  faFileImport,
  faFloppyDisk,
  faFolder,
  faFolderOpen,
  faGear,
  faSliders,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import ChatInput from './ChatInput';
import AiConnectionStatus from '../AiConnectionStatus';
import type { CopilotOperationChoice } from '../../../shared/copilot';
import { COPILOT_QUEUE_OPERATIONS, COPILOT_INTELLIGENCE_OPERATIONS } from '../../../shared/copilot';
import { basename } from '../../utils/path-utils';
import type { ChatComposerProps, ComposerAttachment } from './types';
import {
  ActionsRow,
  AdvancedPanel,
  AttachmentCard,
  AttachmentCardProgress,
  AttachmentCardRow,
  AttachmentCountChip,
  AttachmentFileList,
  AttachmentFileListArrow,
  AttachmentFileListItem,
  AttachmentFileListPopper,
  AttachmentIcon,
  AttachmentLoadingLabel,
  AttachmentName,
  AttachmentRemoveButton,
  AttachmentRow,
  ChipProgress,
  ComposerActionLabel,
  ComposerBar,
  ComposerStack,
  InputLayer,
  LeftActions,
  RightActions,
} from '../../styles/copilot/ChatComposer.styles';

/** The selectable operations, in menu order (auto first, then queue, then read-only). */
const OPERATION_CHOICES: CopilotOperationChoice[] = ['auto', ...COPILOT_QUEUE_OPERATIONS, ...COPILOT_INTELLIGENCE_OPERATIONS];

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
  attachments,
  operation,
  onOperationChange,
  query,
  onQueryChange,
  targetLanguage,
  onTargetLanguageChange,
  onRemoveAttachment,
  disabled = false,
  busy = false,
  hasInputs = false,
  connection,
  onResetConversation,
  showReset = false,
  onSaveAndResetConversation,
  showSaveAndReset = false,
  onSaveChat,
  showSave = false,
  onOpenSavedChats,
  inputsLoading = false,
}: ChatComposerProps) {
  const { t } = useTranslation();
  const [advancedAnchor, setAdvancedAnchor] = useState<HTMLElement | null>(null);
  /** The attachment whose file list is currently shown in the popover. */
  const [selectedAttachment, setSelectedAttachment] = useState<ComposerAttachment | null>(null);
  /** Anchor element of the file list popover. */
  const [fileListAnchor, setFileListAnchor] = useState<HTMLElement | null>(null);
  /** Arrow element of the file list popover. */
  const [fileListArrow, setFileListArrow] = useState<HTMLElement | null>(null);

  /**
   * Opens/closes the file list popover on click, anchored to the card.
   * @param {ComposerAttachment} attachment - The clicked attachment.
   * @param {HTMLElement} anchor - The card element the popover points at.
   * @returns {void}
   */
  const toggleFileList = (attachment: ComposerAttachment, anchor: HTMLElement): void => {
    if (selectedAttachment?.id === attachment.id && fileListAnchor === anchor) {
      setSelectedAttachment(null);
      setFileListAnchor(null);
      return;
    }
    setFileListAnchor(anchor);
    setSelectedAttachment(attachment);
  };

  /** Closes the file list popover. */
  const closeFileList = (): void => {
    setSelectedAttachment(null);
    setFileListAnchor(null);
  };

  return (
    <ComposerBar>
      <ComposerStack>
        {(attachments.length > 0 || inputsLoading) && (
          <AttachmentRow>
            {attachments.length === 0 && inputsLoading && (
              <AttachmentCard data-testid="copilot-attachment-loading">
                <AttachmentCardRow>
                  <AttachmentLoadingLabel>{t('copilot.loadingFiles')}</AttachmentLoadingLabel>
                </AttachmentCardRow>
                <ChipProgress />
              </AttachmentCard>
            )}
            {attachments.map((attachment, index) => {
              const hasFileList = attachment.isFolder || attachment.paths.length > 1;
              return (
                <AttachmentCard
                  key={attachment.id}
                  data-testid="copilot-attachment-card"
                  onClick={
                    hasFileList
                      ? (event) => {
                          event.stopPropagation();
                          toggleFileList(attachment, event.currentTarget);
                        }
                      : undefined
                  }
                  onKeyDown={
                    hasFileList
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleFileList(attachment, event.currentTarget);
                          }
                        }
                      : undefined
                  }
                  role={hasFileList ? 'button' : undefined}
                  tabIndex={hasFileList ? 0 : undefined}
                  aria-haspopup={hasFileList ? 'dialog' : undefined}
                  aria-expanded={hasFileList ? selectedAttachment?.id === attachment.id : undefined}
                >
                  {inputsLoading && index === attachments.length - 1 && <AttachmentCardProgress data-testid="copilot-attachment-loading" />}
                  <AttachmentCardRow>
                    <AttachmentIcon>
                      <FontAwesomeIcon icon={attachment.isFolder ? faFolder : faFile} size="sm" />
                    </AttachmentIcon>
                    <AttachmentName title={attachment.paths.join('\n')}>{attachment.label}</AttachmentName>
                    {(attachment.isFolder || attachment.paths.length > 1) && (
                      <AttachmentCountChip size="small" label={t('mcpViews.common.fileCount', { count: attachment.paths.length })} />
                    )}
                    {onRemoveAttachment && (
                      <AttachmentRemoveButton
                        size="small"
                        aria-label={t('copilot.removeAttachment')}
                        data-testid="copilot-remove-attachment"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (selectedAttachment?.id === attachment.id) closeFileList();
                          onRemoveAttachment(attachment.id);
                        }}
                      >
                        <FontAwesomeIcon icon={faXmark} size="xs" />
                      </AttachmentRemoveButton>
                    )}
                  </AttachmentCardRow>
                </AttachmentCard>
              );
            })}
          </AttachmentRow>
        )}
        <InputLayer>
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
            showSaveAndReset={showSaveAndReset}
            onSaveAndResetConversation={onSaveAndResetConversation}
          />
        </InputLayer>
      </ComposerStack>
      <AttachmentFileListPopper
        open={selectedAttachment !== null && fileListAnchor !== null}
        anchorEl={fileListAnchor}
        placement="top"
        modifiers={[
          {
            name: 'offset',
            options: { offset: [0, 12] },
          },
          {
            name: 'arrow',
            options: { element: fileListArrow },
          },
          {
            name: 'preventOverflow',
            options: { padding: 8 },
          },
          {
            name: 'flip',
            options: { padding: 8 },
          },
        ]}
      >
        <ClickAwayListener onClickAway={closeFileList}>
          <AttachmentFileList data-testid="copilot-folder-file-list" tabIndex={0}>
            {selectedAttachment?.paths.map((path) => (
              <AttachmentFileListItem key={path} title={path}>
                {basename(path)}
              </AttachmentFileListItem>
            ))}
          </AttachmentFileList>
        </ClickAwayListener>
        <AttachmentFileListArrow ref={setFileListArrow} data-popper-arrow />
      </AttachmentFileListPopper>
      <ActionsRow>
        <LeftActions>
          <Tooltip title={t('copilot.chooseFiles')} placement="top" arrow>
            <Button
              size="small"
              startIcon={<FontAwesomeIcon icon={faFileImport} />}
              onClick={onChooseFiles}
              disabled={busy}
              aria-label={t('copilot.chooseFiles')}
              data-testid="copilot-choose-files"
            >
              <ComposerActionLabel>{t('copilot.chooseFiles')}</ComposerActionLabel>
            </Button>
          </Tooltip>
          <Tooltip title={t('copilot.chooseFolder')} placement="top" arrow>
            <Button
              size="small"
              startIcon={<FontAwesomeIcon icon={faFolderOpen} />}
              onClick={onChooseFolder}
              disabled={busy}
              aria-label={t('copilot.chooseFolder')}
              data-testid="copilot-choose-folder"
            >
              <ComposerActionLabel>{t('copilot.chooseFolder')}</ComposerActionLabel>
            </Button>
          </Tooltip>
          <Tooltip title={t('copilot.advanced')} placement="top" arrow>
            <Button
              size="small"
              startIcon={<FontAwesomeIcon icon={faSliders} />}
              onClick={(event) => setAdvancedAnchor(event.currentTarget)}
              disabled={busy}
              aria-label={t('copilot.advanced')}
              aria-haspopup="dialog"
              aria-expanded={advancedAnchor ? 'true' : undefined}
              data-testid="copilot-advanced"
            >
              <ComposerActionLabel>{t('copilot.advanced')}</ComposerActionLabel>
            </Button>
          </Tooltip>
          {showSave && (
            <Tooltip title={t('copilot.saveChat')} placement="top" arrow>
              <Button
                size="small"
                startIcon={<FontAwesomeIcon icon={faFloppyDisk} />}
                onClick={onSaveChat}
                disabled={busy}
                aria-label={t('copilot.saveChat')}
                data-testid="copilot-save-chat"
              >
                <ComposerActionLabel>{t('copilot.saveChat')}</ComposerActionLabel>
              </Button>
            </Tooltip>
          )}
          {onOpenSavedChats && (
            <Tooltip title={t('copilot.savedChats')} placement="top" arrow>
              <Button
                size="small"
                startIcon={<FontAwesomeIcon icon={faClockRotateLeft} />}
                onClick={onOpenSavedChats}
                disabled={busy}
                aria-label={t('copilot.savedChats')}
                data-testid="copilot-saved-chats"
              >
                <ComposerActionLabel>{t('copilot.savedChats')}</ComposerActionLabel>
              </Button>
            </Tooltip>
          )}
        </LeftActions>
        <RightActions $plain>
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
                aria-label={t('copilot.ai.configure')}
                data-testid="copilot-ai-settings"
              >
                <ComposerActionLabel>{t('copilot.ai.configure')}</ComposerActionLabel>
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
