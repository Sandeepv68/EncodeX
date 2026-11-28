import { Tooltip } from '@mui/material';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import type { HistoryRowProps } from '../types';
import {
  HistoryRowBody,
  HistoryRowButton,
  HistoryRowCard,
  HistoryRowMeta,
  HistoryRowRemove,
  HistoryRowTitle,
  HistoryRowTop,
  HistoryStatusChip,
} from '../../styles/History.styles';
import {
  formatHistoryDuration,
  historyBaseName,
  historyFamilyLabelKey,
  historySourceLabelKey,
  historyStatusLabelKey,
} from '../../utils/history';
import HistoryThumbnail from './HistoryThumbnail';

export default function HistoryRow({ entry, selected, thumbnail, onSelect, onRemove, onLoadThumbnail }: HistoryRowProps) {
  const { t } = useTranslation();
  const source = entry.inputs[0] ?? entry.outputs[0] ?? '';
  const title = source ? historyBaseName(source) : '';

  return (
    <HistoryRowCard $selected={selected} data-testid={`history-row-${entry.id}`} role="listitem">
      <HistoryRowButton onClick={() => onSelect(entry.id)} data-testid={`history-select-${entry.id}`} aria-label={title || entry.id}>
        <HistoryThumbnail entry={entry} thumbnail={thumbnail} onLoadThumbnail={onLoadThumbnail} />
        <HistoryRowBody>
          <HistoryRowTop>
            <HistoryStatusChip $status={entry.status}>{t(historyStatusLabelKey(entry.status))}</HistoryStatusChip>
            <HistoryRowTitle variant="body2">{t(historyFamilyLabelKey(entry.family))}</HistoryRowTitle>
            <HistoryRowMeta variant="caption">{t(historySourceLabelKey(entry.source))}</HistoryRowMeta>
          </HistoryRowTop>
          {title ? <HistoryRowTitle variant="body2">{title}</HistoryRowTitle> : null}
          <HistoryRowMeta variant="caption">
            {new Date(entry.startedAt).toLocaleString()} · {formatHistoryDuration(entry.durationMs)}
          </HistoryRowMeta>
          {entry.error?.message ? <HistoryRowMeta variant="caption">{entry.error.message}</HistoryRowMeta> : null}
        </HistoryRowBody>
      </HistoryRowButton>
      <Tooltip title={t('history.remove')}>
        <HistoryRowRemove
          size="small"
          aria-label={t('history.remove')}
          data-testid={`history-remove-${entry.id}`}
          onClick={() => onRemove(entry.id)}
        >
          <FontAwesomeIcon icon={faTrash} />
        </HistoryRowRemove>
      </Tooltip>
    </HistoryRowCard>
  );
}
