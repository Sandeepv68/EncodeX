/**
 * @fileoverview Saved-conversations side panel. It is laid out beside the
 * Copilot column (not over it): opening it animates its width in and the
 * conversation column shrinks to make room. Opening an entry replaces the
 * current transcript; deleting removes it.
 */

import { Box, Button, IconButton, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import type { SavedCopilotChat } from '../../stores/copilotChats';

/** Width of the panel when open, in pixels. */
const PANEL_WIDTH_PX = 320;

interface SavedChatsDrawerProps {
  open: boolean;
  chats: SavedCopilotChat[];
  onClose: () => void;
  onOpen: (chat: SavedCopilotChat) => void;
  onDelete: (id: string) => void;
}

/**
 * Renders the saved-conversations panel as a flex sibling of the Copilot column.
 * @param {SavedChatsDrawerProps} props - Component props.
 * @param {boolean} props.open - Whether the panel is expanded.
 * @param {SavedCopilotChat[]} props.chats - The saved chats, newest first.
 * @param {() => void} props.onClose - Fired by the close button.
 * @param {(chat: SavedCopilotChat) => void} props.onOpen - Fired with the chat to load.
 * @param {(id: string) => void} props.onDelete - Fired with the id of a chat to remove.
 * @returns {JSX.Element} The panel.
 */
export default function SavedChatsDrawer({ open, chats, onClose, onOpen, onDelete }: SavedChatsDrawerProps) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        flexShrink: 0,
        alignSelf: 'stretch',
        display: 'flex',
        width: open ? PANEL_WIDTH_PX : 0,
        overflow: 'hidden',
        visibility: open ? 'visible' : 'hidden',
        transition: 'width 225ms ease, visibility 225ms',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Box
        component="aside"
        aria-label={t('copilot.savedChatsTitle')}
        data-testid="saved-chats-drawer"
        sx={{
          width: PANEL_WIDTH_PX,
          flex: 1,
          alignSelf: 'stretch',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
            {t('copilot.savedChatsTitle')}
          </Typography>
          <IconButton size="small" aria-label={t('copilot.savedChatsClose')} onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
          {chats.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 1 }} data-testid="saved-chats-empty">
              {t('copilot.savedChatsEmpty')}
            </Typography>
          ) : (
            chats.map((chat) => (
              <Box
                key={chat.id}
                data-testid="saved-chat-item"
                sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {chat.title || t('copilot.savedChatUntitled')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('copilot.savedChatMeta', {
                      count: chat.messages.length,
                      date: new Date(chat.savedAt).toLocaleString(),
                    })}
                  </Typography>
                </Box>
                <Button size="small" variant="outlined" onClick={() => onOpen(chat)}>
                  {t('copilot.savedChatOpen')}
                </Button>
                <IconButton size="small" aria-label={t('copilot.savedChatDelete')} onClick={() => onDelete(chat.id)}>
                  <FontAwesomeIcon icon={faTrash} />
                </IconButton>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}
