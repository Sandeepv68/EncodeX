/**
 * @fileoverview Inline chip shown in place of the profile selector when a
 * conversion profile is active. Renders the profile's icon (matching the
 * selector options), its name and description, and a clear button to deselect,
 * inside a larger, neutral chip.
 */

import { Tooltip, Stack } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { ProfileChipIcon } from './ProfileIcon';
import type { ProfileBadgeProps } from './types';
import { BadgeName, BadgeDescription, ProfileChip } from '../styles/ProfileBadge.styles';

export default function ProfileBadge({ profile, onClear, testId }: ProfileBadgeProps) {
  return (
    <Tooltip title={`${profile.container.toUpperCase()} / ${profile.videoCodec} / ${profile.audioCodec}`} arrow>
      <ProfileChip
        data-testid={testId ?? 'profile-badge'}
        icon={<ProfileChipIcon name={profile.name} />}
        label={
          <Stack>
            <BadgeName variant="body2">{profile.name}</BadgeName>
            {profile.description && <BadgeDescription variant="caption">{profile.description}</BadgeDescription>}
          </Stack>
        }
        variant="outlined"
        onDelete={onClear}
        deleteIcon={<FontAwesomeIcon icon={faXmark} size="xs" />}
      />
    </Tooltip>
  );
}
