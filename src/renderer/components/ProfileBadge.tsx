/**
 * @fileoverview Inline chip shown in place of the profile selector when a
 * conversion profile is active. Renders the profile's icon (matching the
 * selector options), its name and description, and a clear button to deselect,
 * inside a larger, neutral chip.
 */

import { Chip, Tooltip, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { useProfileStore } from '../stores/profileStore';
import { ProfileChipIcon } from './ProfileIcon';

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
        icon={<ProfileChipIcon name={profile.name} />}
        label={
          <Stack>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
              {profile.name}
            </Typography>
            {profile.description && (
              <Typography variant="caption" sx={{ lineHeight: 1.3, color: 'text.secondary' }}>
                {profile.description}
              </Typography>
            )}
          </Stack>
        }
        variant="outlined"
        onDelete={clearActiveProfile}
        deleteIcon={<FontAwesomeIcon icon={faXmark} size="xs" />}
        sx={(theme) => ({
          height: 'auto',
          position: 'relative',
          py: 1,
          pl: 0.75,
          pr: 2.25,
          '& .MuiChip-icon': {
            display: 'flex',
            alignItems: 'center',
            alignSelf: 'stretch',
            margin: 0,
          },
          '& .MuiChip-label': {
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
            paddingTop: 0.5,
            paddingBottom: 0.5,
          },
          '& .MuiChip-deleteIcon': {
            position: 'absolute',
            top: 0,
            right: 0,
            color: 'error.main',
            fontSize: theme.typography.pxToRem(13),
            margin: 0,
            padding: theme.spacing(0.75),
            '&:hover': { color: 'error.main' },
            '& svg': {
              display: 'block',
            },
          },
        })}
      />
    </Tooltip>
  );
}
