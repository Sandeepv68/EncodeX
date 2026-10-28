/**
 * @fileoverview Error view: a plain-language error explanation with fixes.
 *
 * A fix may carry a tool; clicking it calls that tool through the host. When
 * the tool answers with a confirmation, the view says so - the operation still
 * waits for the user to approve it in the confirmation view.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import { useMcpView, useMcpViewData } from '../McpViewProvider';
import { resultErrorText } from '../host';
import ViewBadge from '../kit/ViewBadge';
import ViewButton from '../kit/ViewButton';
import ViewCard from '../kit/ViewCard';
import ViewEmptyState from '../kit/ViewEmptyState';
import { ViewBulletList, ViewDetail, ViewParagraph, ViewSectionTitle, ViewStack } from '../kit/styles';
import type { McpUiErrorExplanation, McpUiErrorFix } from '../../../shared/mcp-ui';

interface ErrorPayload {
  error?: McpUiErrorExplanation;
}

/**
 * Renders the error view.
 * @returns {JSX.Element} The view.
 */
export default function ErrorView() {
  const { t } = useTranslation();
  const payload = useMcpViewData<ErrorPayload>();
  // The explanation is latched: a fix the user triggers answers with its own
  // payload, which must not wipe the card the user is reading.
  const [explanation, setExplanation] = useState<McpUiErrorExplanation | undefined>(
    payload?.error ?? (payload && 'code' in payload ? (payload as unknown as McpUiErrorExplanation) : undefined),
  );
  useEffect(() => {
    if (payload?.error) setExplanation(payload.error);
  }, [payload?.error]);

  if (!explanation?.code) {
    return (
      <ViewCard testId="mcp-view-error">
        <ViewEmptyState message={t('mcpViews.error.waiting')} testId="mcp-view-error-empty" />
      </ViewCard>
    );
  }

  const causes = explanation.causes ?? [];
  const fixes = explanation.fixes ?? [];

  return (
    <ViewCard
      title={explanation.title || t('mcpViews.error.title')}
      actions={<ViewBadge tone="danger">{explanation.code}</ViewBadge>}
      testId="mcp-view-error"
    >
      <ViewStack>
        <ViewParagraph>{explanation.explanation ?? ''}</ViewParagraph>
        {explanation.detail && <ViewDetail variant="caption">{explanation.detail}</ViewDetail>}
        {causes.length > 0 && (
          <>
            <ViewSectionTitle variant="caption">{t('mcpViews.common.causes')}</ViewSectionTitle>
            <ViewBulletList as="ul">
              {causes.map((cause) => (
                <li key={cause}>
                  <Typography variant="body2" color="text.secondary">
                    {cause}
                  </Typography>
                </li>
              ))}
            </ViewBulletList>
          </>
        )}
        {fixes.length > 0 && (
          <>
            <ViewSectionTitle variant="caption">{t('mcpViews.common.fixes')}</ViewSectionTitle>
            <ViewStack>
              {fixes.map((fix, index) => (
                <FixRow key={`${fix.label ?? 'fix'}:${index}`} fix={fix} />
              ))}
            </ViewStack>
          </>
        )}
      </ViewStack>
    </ViewCard>
  );
}

interface FixRowProps {
  fix: McpUiErrorFix;
}

/**
 * Renders one suggested fix and its action button.
 * @param {FixRowProps} props - Component props.
 * @returns {JSX.Element} The fix.
 */
function FixRow({ fix }: FixRowProps) {
  const { t } = useTranslation();
  const { callTool } = useMcpView();
  const [action, setAction] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const canApply = Boolean(fix.tool && fix.args && typeof callTool === 'function');

  const apply = async () => {
    if (!fix.tool) return;
    setBusy(true);
    try {
      const result = await callTool(fix.tool, fix.args);
      const failure = resultErrorText(result);
      if (failure) {
        setAction(t('mcpViews.common.fixFailed', { message: failure }));
        return;
      }
      if (result.structuredContent?.confirmation) {
        setAction(t('mcpViews.common.sentForConfirmation', { label: fix.label ?? '' }));
      } else {
        setAction(t('mcpViews.common.requested', { label: fix.label ?? '' }));
      }
    } catch (err) {
      setAction(t('mcpViews.common.fixFailed', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ViewStack>
      <Typography variant="body2">{fix.label ?? ''}</Typography>
      {fix.description && <ViewDetail variant="caption">{fix.description}</ViewDetail>}
      {canApply && (
        <ViewButton
          label={fix.kind === 'retry' ? t('mcpViews.common.retry') : t('mcpViews.common.applyFix')}
          variant="primary"
          disabled={busy}
          onClick={() => void apply()}
          testId="mcp-view-error-fix"
        />
      )}
      {action && <ViewDetail variant="caption">{action}</ViewDetail>}
    </ViewStack>
  );
}
