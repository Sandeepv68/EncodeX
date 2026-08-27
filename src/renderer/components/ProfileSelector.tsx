/**
 * @fileoverview Profile selector with search and grouped categories.
 * Uses MUI Autocomplete for type-to-search across all profiles.
 * Shows built-in and user-created conversion profiles organized by category.
 * Selecting a profile applies it to the conversion store.
 */

import { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Autocomplete, InputAdornment, Stack, Typography, Paper, Box, Grow } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMagnifyingGlass,
  faCheck,
  faChevronDown,
  faPlus,
  faGlobe,
  faMobileScreen,
  faFilm,
  faClapperboard,
  faSatelliteDish,
  faMusic,
  faImage,
  faCode,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ConversionProfile, ProfileCategory } from '../../shared/types';
import type { AutocompleteRenderGroupParams } from '@mui/material/Autocomplete';
import { CATEGORY_ORDER, PROFILE_CATEGORIES } from '../../shared/profiles/categories';
import { useProfileStore } from '../stores/profileStore';
import { useToastStore } from '../stores/toastStore';
import ProfileIcon from './ProfileIcon';
import ProfileBadge from './ProfileBadge';
import {
  HighlightMark,
  OptionContent,
  OptionDescription,
  ActiveCheck,
  DeleteIcon,
  GroupHeader,
  GroupIcon,
  CreateNewCard,
  CreateNewIcon,
  PopupIcon,
  GroupList,
  SearchTextField,
} from '../styles/ProfileSelector.styles';
import ConfirmDialog from './ConfirmDialog';

const HIDDEN_PROFILE_IDS = new Set(['null-output', 'custom-ffmpeg']);

const CATEGORY_ICONS: Record<ProfileCategory, IconDefinition> = {
  'web-social': faGlobe,
  devices: faMobileScreen,
  video: faFilm,
  professional: faClapperboard,
  streaming: faSatelliteDish,
  audio: faMusic,
  images: faImage,
  advanced: faCode,
};

const LABEL_TO_CATEGORY: Record<string, ProfileCategory> = {};
for (const cat of CATEGORY_ORDER) {
  LABEL_TO_CATEGORY[PROFILE_CATEGORIES[cat].label] = cat;
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let idx = lower.indexOf(lowerQuery, lastIndex);
  while (idx !== -1) {
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
    parts.push(<HighlightMark key={idx}>{text.slice(idx, idx + query.length)}</HighlightMark>);
    lastIndex = idx + query.length;
    idx = lower.indexOf(lowerQuery, lastIndex);
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

interface ProfileSelectorProps {
  onCreateNew?: () => void;
  onApplyProfile?: (profile: ConversionProfile) => void;
  testId?: string;
}

export default function ProfileSelector({ onCreateNew, onApplyProfile, testId }: ProfileSelectorProps) {
  const { t } = useTranslation();
  const profiles = useProfileStore((s) => s.profiles);
  const applyProfileToConversionStore = useProfileStore((s) => s.applyProfileToConversionStore);
  const deleteCustomProfile = useProfileStore((s) => s.deleteCustomProfile);

  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingProfile, setDeletingProfile] = useState<ConversionProfile | null>(null);

  const visibleProfiles = useMemo(() => profiles.filter((p) => !HIDDEN_PROFILE_IDS.has(p.id)), [profiles]);

  const activeProfile = useMemo(() => profiles.find((p) => p.id === activeProfileId) ?? null, [profiles, activeProfileId]);

  const getOptionLabel = useCallback(
    (option: ConversionProfile) => (option.description ? `${option.name} — ${option.description}` : option.name),
    [],
  );

  const groupBy = useCallback((option: ConversionProfile) => {
    const meta = PROFILE_CATEGORIES[option.category];
    return meta?.label ?? option.category;
  }, []);

  const renderOption = useCallback(
    (props: React.HTMLAttributes<HTMLLIElement>, option: ConversionProfile) => {
      const isActive = option.id === activeProfileId;
      return (
        // eslint-disable-next-line encodex/no-inline-styles -- MUI Autocomplete passes runtime positioning via props.style
        <li {...props} key={option.id} style={{ ...props.style, position: 'relative', alignItems: 'flex-start' }}>
          <ProfileIcon name={option.name} />
          <OptionContent>
            <Typography variant="body2" noWrap>
              <HighlightText text={option.name} query={searchQuery} />
            </Typography>
            {option.description && (
              <OptionDescription variant="caption" noWrap>
                <HighlightText text={option.description} query={searchQuery} />
              </OptionDescription>
            )}
          </OptionContent>
          {isActive && (
            <ActiveCheck $inlineEndPx={!option.builtin ? 36 : 14}>
              <FontAwesomeIcon icon={faCheck} />
            </ActiveCheck>
          )}
          {!option.builtin && (
            <DeleteIcon
              role="button"
              tabIndex={-1}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setDeletingProfile(option);
              }}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  setDeletingProfile(option);
                }
              }}
            >
              <FontAwesomeIcon icon={faTrashCan} />
            </DeleteIcon>
          )}
        </li>
      );
    },
    [activeProfileId, searchQuery],
  );

  const renderGroup = useCallback((params: AutocompleteRenderGroupParams) => {
    const cat = LABEL_TO_CATEGORY[params.group];
    const icon = cat ? CATEGORY_ICONS[cat] : null;
    return (
      <li key={params.key}>
        <GroupHeader>
          {icon && (
            <GroupIcon>
              <FontAwesomeIcon icon={icon} />
            </GroupIcon>
          )}
          {params.group}
        </GroupHeader>
        <GroupList>{params.children}</GroupList>
      </li>
    );
  }, []);

  const handleChange = useCallback(
    (_: React.SyntheticEvent, value: ConversionProfile | null) => {
      if (value) {
        setActiveProfileId(value.id);
        try {
          const apply = onApplyProfile ?? applyProfileToConversionStore;
          apply(value);
        } catch (err) {
          console.error('Failed to apply profile:', err);
        }
      }
    },
    [onApplyProfile, applyProfileToConversionStore],
  );

  const dropdownPaper = useCallback(
    (props: React.HTMLAttributes<HTMLDivElement>) => (
      <Paper {...props}>
        {props.children}
        {onCreateNew && (
          <CreateNewCard
            role="button"
            tabIndex={-1}
            onMouseDown={(e: React.MouseEvent) => {
              // MUI Autocomplete swallows the click that follows this mousedown
              // (it treats the card as part of the popup's dismiss handling), so
              // trigger the action here to guarantee the dialog opens.
              e.preventDefault();
              e.stopPropagation();
              onCreateNew();
            }}
            onClick={onCreateNew}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onCreateNew();
              }
            }}
          >
            <CreateNewIcon>
              <FontAwesomeIcon icon={faPlus} />
            </CreateNewIcon>
            {t('profiles.createCustom')}
          </CreateNewCard>
        )}
      </Paper>
    ),
    [onCreateNew, t],
  );

  const filterOptions = useCallback((options: ConversionProfile[], state: { inputValue: string }) => {
    const query = state.inputValue.toLowerCase();
    if (!query) return options;
    return options.filter((p) => p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query)));
  }, []);

  return (
    <Stack spacing={0.5}>
      {!activeProfile ? (
        <Grow in timeout={350}>
          <Box sx={{ width: '100%' }}>
            <Autocomplete
              key={activeProfileId ?? 'none'}
              fullWidth
              size="small"
              disableClearable
              data-testid={testId ?? 'profile-selector'}
              options={visibleProfiles}
              getOptionLabel={getOptionLabel}
              groupBy={groupBy}
              value={activeProfile ?? undefined}
              onChange={handleChange}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onInputChange={(_, value) => setSearchQuery(value)}
              renderOption={renderOption}
              renderGroup={renderGroup}
              filterOptions={filterOptions}
              slots={{ paper: dropdownPaper }}
              popupIcon={
                <PopupIcon>
                  <FontAwesomeIcon icon={faChevronDown} />
                </PopupIcon>
              }
              slotProps={{
                paper: {
                  sx: {
                    '& .MuiAutocomplete-listbox': {
                      maxHeight: 360,
                    },
                  },
                },
                popupIndicator: {
                  sx: {
                    color: 'text.secondary',
                    p: 0.5,
                  },
                },
              }}
              renderInput={(params) => (
                <SearchTextField
                  {...params}
                  placeholder={t('profiles.searchPlaceholder')}
                  slotProps={{
                    ...params.slotProps,
                    input: {
                      ...params.slotProps.input,
                      startAdornment: (
                        <InputAdornment position="start">
                          <FontAwesomeIcon icon={faMagnifyingGlass} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              )}
            />
          </Box>
        </Grow>
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 1,
            pl: 1.5,
          }}
        >
          <Grow in timeout={350}>
            <Box sx={{ width: '100%' }}>
              <ProfileBadge profile={activeProfile} onClear={() => setActiveProfileId(null)} />
            </Box>
          </Grow>
        </Box>
      )}
      <ConfirmDialog
        open={!!deletingProfile}
        title={t('profiles.deleteTitle')}
        message={t('profiles.deleteMessage', { name: deletingProfile?.name ?? '' })}
        confirmLabel={t('profiles.deleteConfirm')}
        cancelLabel={t('profiles.cancel')}
        onClose={() => setDeletingProfile(null)}
        onConfirm={() => {
          if (deletingProfile) {
            const name = deletingProfile.name;
            deleteCustomProfile(deletingProfile.id);
            if (deletingProfile.id === activeProfileId) setActiveProfileId(null);
            setDeletingProfile(null);
            useToastStore.getState().error(t('profiles.deleted', { name }));
          }
        }}
      />
    </Stack>
  );
}
