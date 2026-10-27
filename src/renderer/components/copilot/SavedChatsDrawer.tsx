/**
 * @fileoverview Saved-conversations side panel. It floats above the Copilot
 * column: opening it slides it in from the left with a transform, so the
 * conversation content is never resized, re-wrapped or re-laid out. Clicking an
 * entry opens it, the trash button deletes it.
 */

import { Box, ButtonBase, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import type { SavedCopilotChat } from '../../stores/copilotChats';
import { deriveCopilotChatProvider } from '../../stores/copilotChats';
import ProviderIcon from './ProviderIcon';
import { SHADOWS } from '../../colors';

/** Width of the panel when open, in pixels. */
const PANEL_WIDTH_PX = 320;

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
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 1,
        width: PANEL_WIDTH_PX,
        maxWidth: '100%',
        display: 'flex',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        visibility: open ? 'visible' : 'hidden',
        transition: 'transform 225ms ease, visibility 225ms',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Box
        component="aside"
        aria-label={t('copilot.savedChatsTitle')}
        data-testid="saved-chats-drawer"
        sx={{
          width: PANEL_WIDTH_PX,
          maxWidth: '100%',
          height: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          boxShadow: open ? 6 : 0,
          transition: 'box-shadow 225ms ease',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
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
            chats.map((chat) => {
              const providerId = deriveCopilotChatProvider(chat.messages);
              return (
                <Box
                  key={chat.id}
                  data-testid="saved-chat-item"
                  sx={(theme) => ({
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
                    transition: 'background-color 150ms ease, box-shadow 150ms ease',
                    '&:hover': {
                      bgcolor: 'action.selected',
                      boxShadow:
                        theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_HOVER_DARK : SHADOWS(theme).SOFT_HOVER_LIGHT,
                    },
                    '&:focus-within': { bgcolor: 'action.selected' },
                  })}
                >
                  <ButtonBase
                    data-testid="saved-chat-open"
                    onClick={() => onOpen(chat)}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      gap: 1,
                      p: 1,
                      borderRadius: 1,
                      textAlign: 'start',
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {chat.title || t('copilot.savedChatUntitled')}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, minWidth: 0 }}>
                        <Chip
                          component="span"
                          size="small"
                          variant="outlined"
                          icon={<FontAwesomeIcon icon={faComments} />}
                          label={chat.messages.length}
                          data-testid="saved-chat-count"
                          sx={{
                            height: 24,
                            flexShrink: 0,
                            px: 0.5,
                            fontWeight: 600,
                            '& .MuiChip-icon': { fontSize: 11, ml: 0.75, mr: -0.25 },
                            '& .MuiChip-label': { px: 0.75, lineHeight: 1 },
                          }}
                        />
                        <Typography component="span" variant="caption" color="text.secondary" noWrap>
                          {formatTimeAgo(chat.savedAt, now, i18n.language)}
                        </Typography>
                      </Box>
                    </Box>
                    <Tooltip
                      title={providerId ? t(`settings.ai.providers.${providerId}`) : ''}
                      disableHoverListener={!providerId}
                      placement="left"
                      arrow
                    >
                      <Box
                        component="span"
                        data-testid="saved-chat-provider"
                        sx={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'center', flexShrink: 0 }}
                      >
                        <ProviderIcon providerId={providerId} size={24} />
                      </Box>
                    </Tooltip>
                  </ButtonBase>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={t('copilot.savedChatDelete')}
                    onClick={() => onDelete(chat.id)}
                    sx={{ mr: 0.5, flexShrink: 0 }}
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </IconButton>
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    </Box>
  );
}
