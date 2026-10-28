/**
 * @fileoverview Inspector view: a plain-language media diagnosis.
 */

import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import { formatDuration, formatSize } from '../format';
import { useMcpViewData } from '../McpViewProvider';
import ViewCard from '../kit/ViewCard';
import ViewEmptyState from '../kit/ViewEmptyState';
import ViewFactsList from '../kit/ViewFactsList';
import ViewFinding from '../kit/ViewFinding';
import type { ViewFindingSeverity } from '../kit/ViewFinding';
import { ViewBulletList, ViewParagraph, ViewSectionTitle, ViewStack } from '../kit/styles';
import type { McpUiAnalysis } from '../../../shared/mcp-ui';

interface InspectorPayload {
  analysis?: McpUiAnalysis;
}

/**
 * Reads a nested fact from the analysis payload.
 * @param {McpUiAnalysis | undefined} analysis - The analysis.
 * @param {string} path - Dot-separated path of the fact.
 * @returns {unknown} The fact value.
 */
function fact(analysis: McpUiAnalysis | undefined, path: string): unknown {
  if (!analysis?.facts) return undefined;
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, analysis.facts);
}

/**
 * Builds the video summary of the analysis.
 * @param {McpUiAnalysis | undefined} analysis - The analysis.
 * @returns {string} The video summary.
 */
function videoLabel(analysis: McpUiAnalysis | undefined): string {
  const video = fact(analysis, 'video') as
    { codec?: string; width?: number; height?: number; hdr?: boolean; interlaced?: boolean } | undefined;
  if (!video?.codec) return '-';
  const tags = [video.hdr ? 'HDR' : '', video.interlaced ? 'interlaced' : ''].filter(Boolean);
  const base = `${video.codec}${video.width && video.height ? ` ${video.width}x${video.height}` : ''}`;
  return tags.length > 0 ? `${base} (${tags.join(', ')})` : base;
}

/**
 * Builds the audio summary of the analysis.
 * @param {McpUiAnalysis | undefined} analysis - The analysis.
 * @returns {string} The audio summary.
 */
function audioLabel(analysis: McpUiAnalysis | undefined): string {
  const audio = fact(analysis, 'audio') as { codec?: string; channels?: number; channelLayout?: string } | undefined;
  if (!audio?.codec) return '-';
  return `${audio.codec} ${audio.channelLayout || (audio.channels ? `${audio.channels} ch` : '')}`.trim();
}

/**
 * Renders the inspector view.
 * @returns {JSX.Element} The view.
 */
export default function InspectorView() {
  const { t } = useTranslation();
  const payload = useMcpViewData<InspectorPayload>();
  const analysis = payload?.analysis;

  if (!analysis) {
    return (
      <ViewCard testId="mcp-view-inspector">
        <ViewEmptyState message={t('mcpViews.inspector.waiting')} testId="mcp-view-inspector-empty" />
      </ViewCard>
    );
  }

  const findings = analysis.findings ?? [];
  const recommendations = analysis.recommendations ?? [];

  return (
    <ViewCard title={analysis.file ?? t('mcpViews.inspector.title')} testId="mcp-view-inspector">
      <ViewStack>
        <ViewParagraph>{analysis.summary}</ViewParagraph>
        <ViewFactsList
          facts={[
            { label: t('mcpViews.common.duration'), value: formatDuration(fact(analysis, 'durationSeconds') as number) },
            { label: t('mcpViews.common.size'), value: formatSize(fact(analysis, 'sizeBytes') as number) },
            { label: t('mcpViews.common.video'), value: videoLabel(analysis) },
            { label: t('mcpViews.common.audio'), value: audioLabel(analysis) },
          ]}
        />
        {findings.length > 0 && (
          <>
            <ViewSectionTitle variant="caption">{t('mcpViews.common.findings')}</ViewSectionTitle>
            <ViewStack>
              {findings.map((finding, index) => (
                <ViewFinding
                  key={`${finding.severity ?? 'info'}:${index}`}
                  severity={normalizeSeverity(finding.severity)}
                  severityLabel={t(`mcpViews.inspector.severity${capitalize(normalizeSeverity(finding.severity))}`)}
                  message={finding.message ?? ''}
                />
              ))}
            </ViewStack>
          </>
        )}
        {recommendations.length > 0 && (
          <>
            <ViewSectionTitle variant="caption">{t('mcpViews.common.nextSteps')}</ViewSectionTitle>
            <ViewBulletList as="ul">
              {recommendations.map((recommendation) => (
                <li key={recommendation}>
                  <Typography variant="body2">{recommendation}</Typography>
                </li>
              ))}
            </ViewBulletList>
          </>
        )}
      </ViewStack>
    </ViewCard>
  );
}

/**
 * Maps a raw severity to one the finding primitive understands.
 * @param {string | undefined} severity - The raw severity.
 * @returns {ViewFindingSeverity} The normalized severity.
 */
function normalizeSeverity(severity: string | undefined): ViewFindingSeverity {
  if (severity === 'warning' || severity === 'error') return severity;
  return 'info';
}

/**
 * Capitalizes a severity name for the translation key suffix.
 * @param {string} value - The severity name.
 * @returns {string} The capitalized name.
 */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
