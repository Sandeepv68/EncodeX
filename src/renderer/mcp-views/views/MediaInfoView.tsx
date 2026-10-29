/**
 * @fileoverview Media-info view: container facts and the per-stream table.
 */

import { useTranslation } from 'react-i18next';
import { formatDuration, formatSize } from '../format';
import { useMcpViewData } from '../McpViewProvider';
import ViewCard from '../kit/ViewCard';
import ViewEmptyState from '../kit/ViewEmptyState';
import ViewFactsList from '../kit/ViewFactsList';
import ViewTable from '../kit/ViewTable';
import { ViewStack } from '../kit/styles';
import type { McpUiStream } from '../../../shared/mcp-ui';
import type { MediaInfoPayload } from './types';

/**
 * Builds the detail column of a stream row.
 * @param {McpUiStream} stream - The stream to describe.
 * @returns {string} The detail text.
 */
function streamDetails(stream: McpUiStream): string {
  if (stream.type === 'video') {
    return [
      stream.width && stream.height ? `${stream.width} x ${stream.height}` : '',
      stream.frameRate ? `${stream.frameRate} fps` : '',
      stream.pixelFormat ?? '',
    ]
      .filter(Boolean)
      .join(' - ');
  }
  if (stream.type === 'audio') {
    return [stream.channelLayout || (stream.channels ? `${stream.channels} ch` : ''), stream.sampleRate ? `${stream.sampleRate} Hz` : '']
      .filter(Boolean)
      .join(' - ');
  }
  return stream.title || stream.language || '';
}

/**
 * Renders the media-info view.
 * @returns {JSX.Element} The view.
 */
export default function MediaInfoView() {
  const { t } = useTranslation();
  const payload = useMcpViewData<MediaInfoPayload>();
  const media = payload?.media;

  if (!media) {
    return (
      <ViewCard testId="mcp-view-media-info">
        <ViewEmptyState message={t('mcpViews.mediaInfo.waiting')} testId="mcp-view-media-info-empty" />
      </ViewCard>
    );
  }

  const streams = media.streams ?? [];
  return (
    <ViewCard title={media.format ?? t('mcpViews.mediaInfo.title')} testId="mcp-view-media-info">
      <ViewStack>
        <ViewFactsList
          facts={[
            { label: t('mcpViews.common.duration'), value: formatDuration(media.duration) },
            { label: t('mcpViews.common.size'), value: formatSize(media.size) },
            {
              label: t('mcpViews.common.bitrate'),
              value: media.bitrate === undefined ? t('mcpViews.common.unknown') : String(media.bitrate),
            },
          ]}
        />
        <ViewTable
          columns={[
            t('mcpViews.mediaInfo.columnIndex'),
            t('mcpViews.mediaInfo.columnType'),
            t('mcpViews.mediaInfo.columnCodec'),
            t('mcpViews.mediaInfo.columnDetails'),
          ]}
          rows={streams.map((stream, index) => [
            String(stream.index ?? index),
            stream.type ?? '',
            stream.codec ?? '',
            streamDetails(stream),
          ])}
        />
      </ViewStack>
    </ViewCard>
  );
}
