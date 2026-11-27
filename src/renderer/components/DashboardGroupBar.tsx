import { useState } from 'react';
import { Button } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faStar } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { FAVOURITES_GROUP_ID } from '../constants/dashboard';
import { EditHintAlert, GroupBar, GroupChip } from '../styles/DashboardEditing.styles';
import type { DashboardGroupBarProps } from './types';

/** Icon identifying a built-in or custom dashboard group. */
export function DashboardGroupIcon({ groupId }: { groupId: string | null }) {
  return <FontAwesomeIcon icon={groupId === FAVOURITES_GROUP_ID ? faStar : faFolder} aria-hidden="true" />;
}

/** Edit-mode bar showing existing groups and layout actions. */
export default function DashboardGroupBar({ groups, onGroupMenu, onNewGroup, onReset }: DashboardGroupBarProps) {
  const { t } = useTranslation();
  const [hintVisible, setHintVisible] = useState(true);
  const favourites = groups.find((group) => group.id === FAVOURITES_GROUP_ID);

  return (
    <>
      {hintVisible && (
        <EditHintAlert
          severity="info"
          onClose={() => setHintVisible(false)}
          closeText={t('gettingStarted.dismiss')}
          data-testid="dashboard-edit-hint"
        >
          {t('dashboard.edit.hint')}
        </EditHintAlert>
      )}
      <GroupBar data-testid="dashboard-group-bar">
        {favourites && (
          <GroupChip
            icon={<DashboardGroupIcon groupId={favourites.id} />}
            label={`${t('dashboard.groups.favourites')} (${favourites.count})`}
            color="primary"
            variant="outlined"
            data-testid="dashboard-group-favourites"
          />
        )}
        {groups
          .filter((group) => group.id !== FAVOURITES_GROUP_ID)
          .map((group) => (
            <GroupChip
              key={group.id}
              icon={<DashboardGroupIcon groupId={group.id} />}
              label={`${group.name} (${group.count})`}
              variant="outlined"
              onClick={(event) => onGroupMenu(event, group.id)}
              data-testid={`dashboard-group-${group.id}`}
            />
          ))}
        <Button size="small" onClick={onNewGroup} data-testid="dashboard-new-group-button">
          {t('dashboard.edit.newGroup')}
        </Button>
        <Button size="small" onClick={onReset} data-testid="dashboard-reset-layout-button">
          {t('dashboard.edit.resetLayout')}
        </Button>
      </GroupBar>
    </>
  );
}
