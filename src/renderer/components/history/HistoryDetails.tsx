import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AppDialog from '../AppDialog';
import type { HistoryDetailsProps } from '../types';
import {
  HistoryDetailGrid,
  HistoryDetailLabel,
  HistoryDetailValue,
  HistoryMetadataGrid,
  HistoryMetadataItem,
  HistoryPathItem,
  HistoryPathList,
} from '../../styles/History.styles';
import { formatHistoryDuration, historyFamilyLabelKey, historySourceLabelKey, historyStatusLabelKey } from '../../utils/history';
import HistoryThumbnail from './HistoryThumbnail';

export default function HistoryDetails({ entry, thumbnail, onClose, onRemove }: HistoryDetailsProps) {
  const { t } = useTranslation();

  if (!entry) return <HistoryDetailValue variant="body2">{t('history.noSelection')}</HistoryDetailValue>;

  return (
    <AppDialog
      open
      onClose={onClose}
      title={t('history.details')}
      maxWidth="md"
      fullWidth
      showCloseButton
      closeButtonAriaLabel={t('shortcuts.close')}
      closeButtonTestId="history-details-close"
      paperTestId="history-details-dialog"
      actions={
        <>
          <Button onClick={onClose}>{t('shortcuts.close')}</Button>
          <Button color="error" data-testid="history-details-remove" onClick={() => onRemove(entry.id)}>
            {t('history.remove')}
          </Button>
        </>
      }
    >
      <HistoryDetailGrid>
        <HistoryDetailLabel variant="body2">{t('history.status')}</HistoryDetailLabel>
        <HistoryDetailValue variant="body2">{t(historyStatusLabelKey(entry.status))}</HistoryDetailValue>
        <HistoryDetailLabel variant="body2">{t('history.family')}</HistoryDetailLabel>
        <HistoryDetailValue variant="body2">{t(historyFamilyLabelKey(entry.family))}</HistoryDetailValue>
        <HistoryDetailLabel variant="body2">{t('history.source')}</HistoryDetailLabel>
        <HistoryDetailValue variant="body2">{t(historySourceLabelKey(entry.source))}</HistoryDetailValue>
        <HistoryDetailLabel variant="body2">{t('history.started')}</HistoryDetailLabel>
        <HistoryDetailValue variant="body2">{new Date(entry.startedAt).toLocaleString()}</HistoryDetailValue>
        <HistoryDetailLabel variant="body2">{t('history.duration')}</HistoryDetailLabel>
        <HistoryDetailValue variant="body2">{formatHistoryDuration(entry.durationMs)}</HistoryDetailValue>
        <HistoryThumbnail entry={entry} thumbnail={thumbnail} onLoadThumbnail={() => undefined} />
        <HistoryDetailValue variant="body2" />
      </HistoryDetailGrid>
      <HistoryDetailLabel variant="body2">{t('history.input')}</HistoryDetailLabel>
      <HistoryPathList>
        {entry.inputs.map((input, index) => (
          <HistoryPathItem key={`${entry.id}-input-${index}`} variant="body2">
            {input}
          </HistoryPathItem>
        ))}
      </HistoryPathList>
      <HistoryDetailLabel variant="body2">{t('history.outputs')}</HistoryDetailLabel>
      <HistoryPathList>
        {entry.outputs.map((output, index) => (
          <HistoryPathItem key={`${entry.id}-output-${index}`} variant="body2">
            {output}
          </HistoryPathItem>
        ))}
      </HistoryPathList>
      {entry.error ? (
        <>
          <HistoryDetailLabel variant="body2">{t('history.error')}</HistoryDetailLabel>
          <HistoryDetailValue variant="body2">{entry.error.message}</HistoryDetailValue>
        </>
      ) : null}
      {Object.keys(entry.metadata).length > 0 ? (
        <>
          <HistoryDetailLabel variant="body2">{t('history.metadata')}</HistoryDetailLabel>
          <HistoryMetadataGrid>
            {Object.entries(entry.metadata).map(([key, value]) => (
              <HistoryMetadataItem key={`${entry.id}-metadata-${key}`} data-testid={`history-metadata-${key}`}>
                <HistoryDetailLabel variant="caption">{key}</HistoryDetailLabel>
                <HistoryDetailValue variant="body2">{String(value)}</HistoryDetailValue>
              </HistoryMetadataItem>
            ))}
          </HistoryMetadataGrid>
        </>
      ) : null}
    </AppDialog>
  );
}
