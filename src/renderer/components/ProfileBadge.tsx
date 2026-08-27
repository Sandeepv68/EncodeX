/**
 * @fileoverview Inline badge shown when a conversion profile is active.
 * Displays the profile name with a clear button to deselect.
 */

import { Chip, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { useProfileStore } from '../stores/profileStore';

interface ProfileBadgeProps {
  testId?: string;
}

export default function ProfileBadge({ testId }: ProfileBadgeProps) {
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const profiles = useProfileStore((s) => s.profiles);
  const clearActiveProfile = useProfileStore((s) => s.clearActiveProfile);

  if (!activeProfileId) return null;

  const profile = profiles.find((p) => p.id === activeProfileId);
  if (!profile) return null;

  return (
    <Tooltip title={`${profile.container.toUpperCase()} / ${profile.videoCodec} / ${profile.audioCodec}`} arrow>
      <Chip
        data-testid={testId ?? 'profile-badge'}
        label={profile.name}
        size="small"
        color="primary"
        variant="outlined"
        onDelete={clearActiveProfile}
        deleteIcon={<FontAwesomeIcon icon={faXmark} size="xs" />}
        sx={{ ml: 1 }}
      />
    </Tooltip>
  );
}
