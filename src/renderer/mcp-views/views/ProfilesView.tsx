/**
 * @fileoverview Profiles view: the built-in conversion profiles.
 *
 * The profile catalogue is what an agent reads before proposing a conversion,
 * so the view makes it browsable: every profile with its id, category,
 * container and codecs, filterable by a free-text query.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import { useMcpViewData } from '../McpViewProvider';
import ViewBadge from '../kit/ViewBadge';
import ViewCard from '../kit/ViewCard';
import ViewEmptyState from '../kit/ViewEmptyState';
import ViewField from '../kit/ViewField';
import ViewTable from '../kit/ViewTable';
import { ViewStack } from '../kit/styles';
import type { McpUiProfile } from '../../../shared/mcp-ui';

interface ProfilesPayload {
  profiles?: McpUiProfile[];
}

/**
 * Renders the profiles view.
 * @returns {JSX.Element} The view.
 */
export default function ProfilesView() {
  const { t } = useTranslation();
  const payload = useMcpViewData<ProfilesPayload>();
  const profiles = payload?.profiles ?? [];
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter((profile) =>
      [profile.id, profile.name, profile.category, profile.container, profile.videoCodec, profile.audioCodec]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [filter, profiles]);

  if (profiles.length === 0) {
    return (
      <ViewCard testId="mcp-view-profiles">
        <ViewEmptyState message={t('mcpViews.profiles.waiting')} testId="mcp-view-profiles-empty" />
      </ViewCard>
    );
  }

  return (
    <ViewCard
      title={t('mcpViews.profiles.title')}
      actions={<ViewBadge tone="info">{t('mcpViews.profiles.count', { count: profiles.length })}</ViewBadge>}
      testId="mcp-view-profiles"
    >
      <ViewStack>
        <ViewField
          label={t('mcpViews.profiles.filterLabel')}
          value={filter}
          onChange={setFilter}
          placeholder={t('mcpViews.profiles.filterPlaceholder')}
          testId="mcp-view-profiles-filter"
        />
        {filtered.length === 0 ? (
          <ViewEmptyState message={t('mcpViews.profiles.empty')} testId="mcp-view-profiles-no-match" />
        ) : (
          <ViewTable
            columns={[
              t('mcpViews.profiles.columnName'),
              t('mcpViews.profiles.columnId'),
              t('mcpViews.profiles.columnCategory'),
              t('mcpViews.profiles.columnContainer'),
              t('mcpViews.profiles.columnVideo'),
              t('mcpViews.profiles.columnAudio'),
            ]}
            rows={filtered.map((profile) => [
              profile.name ?? '',
              profile.id ?? '',
              profile.category ?? '',
              profile.container ?? '',
              profile.videoCodec ?? '',
              profile.audioCodec ?? '',
            ])}
          />
        )}
        <Typography variant="caption" color="text.secondary">
          {t('mcpViews.profiles.count', { count: filtered.length })}
        </Typography>
      </ViewStack>
    </ViewCard>
  );
}
