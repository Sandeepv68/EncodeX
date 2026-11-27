import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faGrip, faLink, faPen } from '@fortawesome/free-solid-svg-icons';
import { IconButton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import { ActionsRow } from '../styles/DashboardActionsRow.styles';
import type { DashboardActionsRowProps } from './types';

/** Renders the icon-only panel switcher plus the conditional icon-only Edit button. */
export default function DashboardActionsRow({ view, editing = false, onToggleView, onToggleEdit }: DashboardActionsRowProps) {
  const { t } = useTranslation();
  const viewLabel = view === 'dashboard' ? t('quickLinks.title') : t('nav.dashboard');
  const editLabel = editing ? t('dashboard.edit.done') : t('dashboard.edit.edit');

  function handleToggleView(): void {
    const next = view === 'dashboard' ? 'quick-links' : 'dashboard';
    recordAnalyticsEvent(createAnalyticsEvent('dashboard_view_changed', { route: next }));
    onToggleView();
  }

  return (
    <ActionsRow data-testid="dashboard-actions-row">
      <Tooltip title={viewLabel} placement="bottom">
        <IconButton size="small" onClick={handleToggleView} aria-label={viewLabel} data-testid="dashboard-view-toggle-button">
          <FontAwesomeIcon icon={view === 'dashboard' ? faLink : faGrip} />
        </IconButton>
      </Tooltip>
      {view === 'dashboard' && onToggleEdit && (
        <Tooltip title={editLabel} placement="bottom">
          <IconButton size="small" onClick={onToggleEdit} aria-label={editLabel} aria-pressed={editing} data-testid="dashboard-edit-button">
            <FontAwesomeIcon icon={editing ? faCheck : faPen} />
          </IconButton>
        </Tooltip>
      )}
    </ActionsRow>
  );
}
