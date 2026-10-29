/**
 * @fileoverview Capabilities view: what this machine can encode with.
 *
 * The view lists the available video and audio encoders and the hardware
 * acceleration methods, so an agent can check the machine before proposing a
 * codec.
 */

import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import { useMcpViewData } from '../McpViewProvider';
import ViewCard from '../kit/ViewCard';
import ViewEmptyState from '../kit/ViewEmptyState';
import ViewTable from '../kit/ViewTable';
import { ViewDotList, ViewSectionTitle, ViewStack } from '../kit/styles';
import type { McpUiCapabilities } from '../../../shared/mcp-ui';
import type { CapabilitiesPayload } from './types';

/**
 * Renders the capabilities view.
 * @returns {JSX.Element} The view.
 */
export default function CapabilitiesView() {
  const { t } = useTranslation();
  const payload = useMcpViewData<CapabilitiesPayload>();
  const capabilities =
    payload?.capabilities ?? (payload && 'videoEncoders' in payload ? (payload as unknown as McpUiCapabilities) : undefined);

  if (!capabilities) {
    return (
      <ViewCard testId="mcp-view-capabilities">
        <ViewEmptyState message={t('mcpViews.capabilities.waiting')} testId="mcp-view-capabilities-empty" />
      </ViewCard>
    );
  }

  const videoEncoders = capabilities.videoEncoders ?? [];
  const audioEncoders = capabilities.audioEncoders ?? [];
  const hwaccels = capabilities.hwaccels ?? [];

  return (
    <ViewCard title={t('mcpViews.capabilities.title')} testId="mcp-view-capabilities">
      <ViewStack>
        {videoEncoders.length > 0 && (
          <>
            <ViewSectionTitle variant="caption">{t('mcpViews.capabilities.encoderVideo')}</ViewSectionTitle>
            <ViewTable columns={[t('mcpViews.capabilities.encoders')]} rows={videoEncoders.map((encoder) => [encoder])} />
          </>
        )}
        {audioEncoders.length > 0 && (
          <>
            <ViewSectionTitle variant="caption">{t('mcpViews.capabilities.encoderAudio')}</ViewSectionTitle>
            <ViewTable columns={[t('mcpViews.capabilities.encoders')]} rows={audioEncoders.map((encoder) => [encoder])} />
          </>
        )}
        <ViewSectionTitle variant="caption">{t('mcpViews.capabilities.hardware')}</ViewSectionTitle>
        {hwaccels.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('mcpViews.capabilities.hardwareNone')}
          </Typography>
        ) : (
          <ViewDotList as="ul">
            {hwaccels.map((method) => (
              <li key={method}>
                <Typography variant="body2">{method}</Typography>
              </li>
            ))}
          </ViewDotList>
        )}
      </ViewStack>
    </ViewCard>
  );
}
