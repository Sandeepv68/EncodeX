import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircularProgress, InputAdornment, MenuItem, Tooltip } from '@mui/material';
import { faArrowsRotate, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { HISTORY_FAMILIES, HISTORY_SOURCES, HISTORY_STATUSES } from '../../../shared/history/types';
import type { HistoryFamily, HistorySource, HistoryStatus } from '../../../shared/history/types';
import type { HistoryToolbarProps } from '../types';
import {
  HistoryActionButton,
  HistoryCountText,
  HistorySearchField,
  HistorySelect,
  HistoryToolbar as HistoryToolbarContainer,
} from '../../styles/History.styles';
import {
  historyFamilyLabelKey,
  historySortKeys,
  historySortLabelKey,
  historySourceLabelKey,
  historyStatusLabelKey,
  isHistoryFamily,
  isHistorySortKey,
  isHistorySource,
  isHistoryStatus,
} from '../../utils/history';

export default function HistoryToolbar({ query, resultCount, totalCount, onQueryChange, onRefresh, onClear }: HistoryToolbarProps) {
  const { t } = useTranslation();
  const [clearing, setClearing] = useState(false);

  return (
    <HistoryToolbarContainer data-testid="history-toolbar">
      <HistorySearchField
        size="small"
        label={t('history.search')}
        value={query.search}
        onChange={(event) => onQueryChange({ search: event.target.value })}
        slotProps={{
          htmlInput: { 'data-testid': 'history-search', 'aria-label': t('history.search') },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <FontAwesomeIcon icon={faMagnifyingGlass} />
              </InputAdornment>
            ),
          },
        }}
      />
      <HistorySelect
        value={query.status}
        onChange={(event) => {
          const value = String(event.target.value);
          onQueryChange({ status: isHistoryStatus(value) || value === 'all' ? (value as HistoryStatus | 'all') : 'all' });
        }}
        inputProps={{ 'data-testid': 'history-status-filter', 'aria-label': t('history.status') }}
      >
        <MenuItem value="all">{t('history.allStatuses')}</MenuItem>
        {HISTORY_STATUSES.map((status) => (
          <MenuItem key={status} value={status}>
            {t(historyStatusLabelKey(status))}
          </MenuItem>
        ))}
      </HistorySelect>
      <HistorySelect
        value={query.family}
        onChange={(event) => {
          const value = String(event.target.value);
          onQueryChange({ family: isHistoryFamily(value) || value === 'all' ? (value as HistoryFamily | 'all') : 'all' });
        }}
        inputProps={{ 'data-testid': 'history-family-filter', 'aria-label': t('history.family') }}
      >
        <MenuItem value="all">{t('history.allFamilies')}</MenuItem>
        {HISTORY_FAMILIES.map((family) => (
          <MenuItem key={family} value={family}>
            {t(historyFamilyLabelKey(family))}
          </MenuItem>
        ))}
      </HistorySelect>
      <HistorySelect
        value={query.source}
        onChange={(event) => {
          const value = String(event.target.value);
          onQueryChange({ source: isHistorySource(value) || value === 'all' ? (value as HistorySource | 'all') : 'all' });
        }}
        inputProps={{ 'data-testid': 'history-source-filter', 'aria-label': t('history.source') }}
      >
        <MenuItem value="all">{t('history.allSources')}</MenuItem>
        {HISTORY_SOURCES.map((source) => (
          <MenuItem key={source} value={source}>
            {t(historySourceLabelKey(source))}
          </MenuItem>
        ))}
      </HistorySelect>
      <HistorySelect
        value={query.sort}
        onChange={(event) => {
          const value = String(event.target.value);
          onQueryChange({ sort: isHistorySortKey(value) ? value : 'newest' });
        }}
        inputProps={{ 'data-testid': 'history-sort', 'aria-label': t('history.sort') }}
      >
        {historySortKeys().map((sort) => (
          <MenuItem key={sort} value={sort}>
            {t(historySortLabelKey(sort))}
          </MenuItem>
        ))}
      </HistorySelect>
      <Tooltip title={t('history.refresh')}>
        <HistoryActionButton
          aria-label={t('history.refresh')}
          data-testid="history-refresh"
          onClick={() => {
            setClearing(false);
            onRefresh();
          }}
        >
          {clearing ? <CircularProgress size={16} aria-label={t('app.loading')} /> : <FontAwesomeIcon icon={faArrowsRotate} />}
        </HistoryActionButton>
      </Tooltip>
      <HistoryActionButton aria-label={t('history.clear')} data-testid="history-clear" onClick={onClear}>
        {t('history.clear')}
      </HistoryActionButton>
      <HistoryCountText variant="caption" data-testid="history-count">
        {resultCount === totalCount
          ? t('history.count', { count: totalCount })
          : t('history.filteredCount', { count: resultCount, total: totalCount })}
      </HistoryCountText>
    </HistoryToolbarContainer>
  );
}
