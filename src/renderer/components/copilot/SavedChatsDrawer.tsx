/**
 * @fileoverview Saved-conversations side panel. It floats above the Copilot
 * column: opening it slides it in from the left with a transform, so the
 * conversation content is never resized, re-wrapped or re-laid out. Clicking an
 * entry opens it, the trash button deletes it.
 */

import { IconButton, Tooltip, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import type { SavedCopilotChat } from '../../stores/copilotChats';
import { deriveCopilotChatProvider } from '../../stores/copilotChats';
import ProviderIcon from './ProviderIcon';
import {
  DeleteChatButton,
  DrawerHeader,
  DrawerList,
  DrawerPanel,
  DrawerShell,
  DrawerTitle,
  EmptyChatsText,
  SavedChatBody,
  SavedChatCountChip,
  SavedChatItem,
  SavedChatMeta,
  SavedChatOpen,
  SavedChatProvider,
  SavedChatTitle,
} from '../../styles/copilot/SavedChatsDrawer.styles';

/** Seconds per unit, largest first, used by {@link formatTimeAgo}. */
const TIME_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
];

/**
 * Formats an elapsed time as a relative phrase such as "5 min. ago" or
 * "3 days ago", using the active locale.
 * @param {number} timestamp - Epoch milliseconds of the event.
 * @param {number} now - Epoch milliseconds of the reference time.
 * @param {string} locale - BCP 47 locale used for the wording.
 * @returns {string} The relative time phrase.
 */
export function formatTimeAgo(timestamp: number, now: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'short' });
  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  for (const [unit, size] of TIME_UNITS) {
    if (elapsedSeconds >= size) {
      return rtf.format(-Math.floor(elapsedSeconds / size), unit);
    }
  }
  // Only a sub-second (or future) elapsed time reaches this point. Keep the
  // value negative so `numeric: 'always'` renders "0 sec. ago" not "in 0 sec.".
  return rtf.format(-elapsedSeconds, 'second');
}

interface SavedChatsDrawerProps {
  open: boolean;
  chats: SavedCopilotChat[];
  onClose: () => void;
  onOpen: (chat: SavedCopilotChat) => void;
  onDelete: (id: string) => void;
}

/**
 * Renders the saved-conversations panel as an overlay that slides over the
 * Copilot column.
 * @param {SavedChatsDrawerProps} props - Component props.
 * @param {boolean} props.open - Whether the panel is expanded.
 * @param {SavedCopilotChat[]} props.chats - The saved chats, newest first.
 * @param {() => void} props.onClose - Fired by the close button.
 * @param {(chat: SavedCopilotChat) => void} props.onOpen - Fired with the chat to load.
 * @param {(id: string) => void} props.onDelete - Fired with the id of a chat to remove.
 * @returns {JSX.Element} The panel.
 */
export default function SavedChatsDrawer({ open, chats, onClose, onOpen, onDelete }: SavedChatsDrawerProps) {
  const { t, i18n } = useTranslation();
  const now = Date.now();

  return (
    <DrawerShell $open={open}>
      <DrawerPanel component="aside" aria-label={t('copilot.savedChatsTitle')} data-testid="saved-chats-drawer" $open={open}>
        <DrawerHeader>
          <DrawerTitle variant="subtitle1" component="h2">
            {t('copilot.savedChatsTitle')}
          </DrawerTitle>
          <IconButton size="small" aria-label={t('copilot.savedChatsClose')} onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} />
          </IconButton>
        </DrawerHeader>
        <DrawerList>
          {chats.length === 0 ? (
            <EmptyChatsText variant="body2" color="text.secondary" data-testid="saved-chats-empty">
              {t('copilot.savedChatsEmpty')}
            </EmptyChatsText>
          ) : (
            chats.map((chat) => {
              const providerId = deriveCopilotChatProvider(chat.messages);
              return (
                <SavedChatItem key={chat.id} data-testid="saved-chat-item">
                  <SavedChatOpen data-testid="saved-chat-open" onClick={() => onOpen(chat)}>
                    <SavedChatBody>
                      <SavedChatTitle component="span" variant="body2">
                        {chat.title || t('copilot.savedChatUntitled')}
                      </SavedChatTitle>
                      <SavedChatMeta>
                        <SavedChatCountChip
                          component="span"
                          size="small"
                          variant="outlined"
                          icon={<FontAwesomeIcon icon={faComments} />}
                          label={chat.messages.length}
                          data-testid="saved-chat-count"
                        />
                        <Typography component="span" variant="caption" color="text.secondary" noWrap>
                          {formatTimeAgo(chat.savedAt, now, i18n.language)}
                        </Typography>
                      </SavedChatMeta>
                    </SavedChatBody>
                    <Tooltip
                      title={providerId ? t(`settings.ai.providers.${providerId}`) : ''}
                      disableHoverListener={!providerId}
                      placement="left"
                      arrow
                    >
                      <SavedChatProvider component="span" data-testid="saved-chat-provider">
                        <ProviderIcon providerId={providerId} size={24} />
                      </SavedChatProvider>
                    </Tooltip>
                  </SavedChatOpen>
                  <DeleteChatButton size="small" color="error" aria-label={t('copilot.savedChatDelete')} onClick={() => onDelete(chat.id)}>
                    <FontAwesomeIcon icon={faXmark} />
                  </DeleteChatButton>
                </SavedChatItem>
              );
            })
          )}
        </DrawerList>
      </DrawerPanel>
    </DrawerShell>
  );
}
