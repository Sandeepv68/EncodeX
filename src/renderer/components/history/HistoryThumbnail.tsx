import { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage } from '@fortawesome/free-solid-svg-icons';
import type { HistoryThumbnailProps } from '../types';
import { HistoryThumbnailFrame, HistoryThumbnailImage } from '../../styles/History.styles';

export default function HistoryThumbnail({ entry, thumbnail, onLoadThumbnail }: HistoryThumbnailProps) {
  useEffect(() => {
    if (entry.thumbnail && thumbnail === undefined) onLoadThumbnail(entry);
  }, [entry, thumbnail, onLoadThumbnail]);

  if (thumbnail) {
    return (
      <HistoryThumbnailFrame data-testid={`history-thumbnail-${entry.id}`}>
        <HistoryThumbnailImage src={thumbnail} alt="" />
      </HistoryThumbnailFrame>
    );
  }

  return (
    <HistoryThumbnailFrame data-testid={`history-thumbnail-empty-${entry.id}`} aria-hidden="true">
      <FontAwesomeIcon icon={faImage} />
    </HistoryThumbnailFrame>
  );
}
