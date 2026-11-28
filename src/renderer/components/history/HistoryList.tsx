import { useTranslation } from 'react-i18next';
import { CircularProgress } from '@mui/material';
import type { HistoryListProps } from '../types';
import { HistoryEmptyText, HistoryErrorText, HistoryList as HistoryListBox, HistoryRoot } from '../../styles/History.styles';
import HistoryRow from './HistoryRow';

export default function HistoryList({
  entries,
  selectedId,
  thumbnails,
  loadState,
  error,
  onSelect,
  onRemove,
  onLoadThumbnail,
}: HistoryListProps) {
  const { t } = useTranslation();

  return (
    <HistoryRoot>
      <HistoryListBox data-testid="history-list" role={loadState === 'ready' && entries.length > 0 ? 'list' : undefined}>
        {loadState === 'loading' ? <CircularProgress aria-label={t('app.loading')} /> : null}
        {loadState === 'error' ? <HistoryErrorText role="alert">{error ?? t('history.error')}</HistoryErrorText> : null}
        {loadState === 'ready' && entries.length === 0 ? <HistoryEmptyText>{t('history.empty')}</HistoryEmptyText> : null}
        {entries.map((entry) => (
          <HistoryRow
            key={entry.id}
            entry={entry}
            selected={entry.id === selectedId}
            thumbnail={thumbnails[entry.id]}
            onSelect={onSelect}
            onRemove={onRemove}
            onLoadThumbnail={onLoadThumbnail}
          />
        ))}
      </HistoryListBox>
    </HistoryRoot>
  );
}
