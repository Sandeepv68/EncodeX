import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@mui/material';
import PageContainer from '../components/PageContainer';
import AppDialog from '../components/AppDialog';
import HistoryToolbar from '../components/history/HistoryToolbar';
import HistoryList from '../components/history/HistoryList';
import HistoryDetails from '../components/history/HistoryDetails';
import { useHistoryStore } from '../stores/historyStore';
import { callBridgeVoid } from '../utils/bridge-call';
import { filterHistoryEntries } from '../utils/history';
import { pageIcons } from '../pageIcons';
import type { HistoryEntry } from '../../shared/history/types';

export default function History() {
  const { t } = useTranslation();
  const entries = useHistoryStore((state) => state.entries);
  const query = useHistoryStore((state) => state.query);
  const loadState = useHistoryStore((state) => state.loadState);
  const error = useHistoryStore((state) => state.error);
  const selectedId = useHistoryStore((state) => state.selectedId);
  const thumbnails = useHistoryStore((state) => state.thumbnails);
  const setQuery = useHistoryStore((state) => state.setQuery);
  const select = useHistoryStore((state) => state.select);
  const loadThumbnail = useHistoryStore((state) => state.loadThumbnail);
  const [confirmClear, setConfirmClear] = useState(false);

  const visibleEntries = useMemo(() => filterHistoryEntries(entries, query), [entries, query]);
  const selectedEntry = useMemo(() => entries.find((entry) => entry.id === selectedId) ?? null, [entries, selectedId]);

  useEffect(() => {
    void useHistoryStore.getState().load();
    let unsubscribe = () => {};
    callBridgeVoid(() => {
      const result = window.electronAPI?.onHistoryUpdated?.(() => {
        void useHistoryStore.getState().refresh();
      });
      if (typeof result === 'function') unsubscribe = result;
    }, 'onHistoryUpdated');
    return () => {
      callBridgeVoid(unsubscribe, 'unsubscribe onHistoryUpdated');
    };
  }, []);

  const handleLoadThumbnail = useCallback(
    (entry: HistoryEntry) => {
      void loadThumbnail(entry);
    },
    [loadThumbnail],
  );

  const handleConfirmClear = () => {
    setConfirmClear(false);
    void useHistoryStore.getState().clear();
  };

  return (
    <PageContainer title={t('history.title')} icon={pageIcons['/history']} paper={false}>
      <HistoryToolbar
        query={query}
        resultCount={visibleEntries.length}
        totalCount={entries.length}
        onQueryChange={setQuery}
        onRefresh={() => void useHistoryStore.getState().refresh()}
        onClear={() => setConfirmClear(true)}
      />
      <HistoryList
        entries={visibleEntries}
        selectedId={selectedId}
        thumbnails={thumbnails}
        loadState={loadState}
        error={error}
        onSelect={select}
        onRemove={(id) => void useHistoryStore.getState().remove(id)}
        onLoadThumbnail={handleLoadThumbnail}
      />
      <HistoryDetails
        entry={selectedEntry}
        thumbnail={selectedEntry ? thumbnails[selectedEntry.id] : undefined}
        onClose={() => select(null)}
        onRemove={(id) => {
          select(null);
          void useHistoryStore.getState().remove(id);
        }}
      />
      <AppDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title={t('history.clearConfirm')}
        paperTestId="history-clear-dialog"
        actions={
          <>
            <Button onClick={() => setConfirmClear(false)}>{t('mcpViews.common.cancel')}</Button>
            <Button color="error" data-testid="history-clear-confirm" onClick={handleConfirmClear}>
              {t('history.clear')}
            </Button>
          </>
        }
      >
        {t('history.clearConfirm')}
      </AppDialog>
    </PageContainer>
  );
}
