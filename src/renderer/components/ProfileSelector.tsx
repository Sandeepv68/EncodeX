/**
 * @fileoverview Profile selector with search and grouped categories.
 * Uses MUI Autocomplete for type-to-search across all profiles.
 * Shows built-in and user-created conversion profiles organized by category.
 * Selecting a profile applies it to the conversion store.
 */

import { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Autocomplete, InputAdornment, Stack, Typography, Paper } from '@mui/material';
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
  faPlay,
  faCamera,
  faThumbsUp,
  faAt,
  faTabletScreenButton,
  faTv,
  faRobot,
  faGamepad,
  faFileVideo,
  faTowerBroadcast,
  faHeadphonesSimple,
  faCompactDisc,
  faWaveSquare,
  faVolumeHigh,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ConversionProfile, ProfileCategory } from '../../shared/types';
import type { AutocompleteRenderGroupParams } from '@mui/material/Autocomplete';
import { CATEGORY_ORDER, PROFILE_CATEGORIES } from '../../shared/profiles/categories';
import { useProfileStore } from '../stores/profileStore';
import { useToastStore } from '../stores/toastStore';
import { PROFILE_ICON_COLORS } from '../colors';
import {
  HighlightMark,
  OptionIcon,
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

interface ProfileIconEntry {
  test: (name: string) => boolean;
  icon: IconDefinition;
  color: string;
}

const PROFILE_ICON_MAP: ProfileIconEntry[] = [
  // Web & Social — brands
  { test: (n) => n.includes('YouTube'), icon: faPlay, color: PROFILE_ICON_COLORS.youtube },
  { test: (n) => n.includes('Instagram'), icon: faCamera, color: PROFILE_ICON_COLORS.instagram },
  { test: (n) => n.includes('TikTok'), icon: faMusic, color: PROFILE_ICON_COLORS.tiktok },
  { test: (n) => n.includes('Facebook'), icon: faThumbsUp, color: PROFILE_ICON_COLORS.facebook },
  { test: (n) => /^X\s/.test(n), icon: faAt, color: PROFILE_ICON_COLORS.x },

  // Devices — Apple
  { test: (n) => n.includes('iPhone'), icon: faMobileScreen, color: PROFILE_ICON_COLORS.apple },
  { test: (n) => n.includes('iPad'), icon: faTabletScreenButton, color: PROFILE_ICON_COLORS.apple },
  { test: (n) => n.includes('Apple TV'), icon: faTv, color: PROFILE_ICON_COLORS.appleTv },

  // Devices — Android
  { test: (n) => n.includes('Android'), icon: faRobot, color: PROFILE_ICON_COLORS.android },

  // Devices — Gaming
  { test: (n) => n.includes('PlayStation') || /^PS\d/.test(n), icon: faGamepad, color: PROFILE_ICON_COLORS.playstation },
  { test: (n) => n.includes('Xbox'), icon: faGamepad, color: PROFILE_ICON_COLORS.xbox },
  { test: (n) => n.includes('Nintendo') || n.includes('Switch'), icon: faGamepad, color: PROFILE_ICON_COLORS.nintendo },

  // Video — containers
  { test: (n) => /^MP4\b/.test(n), icon: faFileVideo, color: PROFILE_ICON_COLORS.mp4 },
  { test: (n) => /^MKV\b/.test(n), icon: faFileVideo, color: PROFILE_ICON_COLORS.mkv },
  { test: (n) => /^MOV\b/.test(n), icon: faFileVideo, color: PROFILE_ICON_COLORS.mov },
  { test: (n) => /^WebM\b/.test(n), icon: faGlobe, color: PROFILE_ICON_COLORS.webm },
  { test: (n) => /^AVI\b/.test(n), icon: faFileVideo, color: PROFILE_ICON_COLORS.avi },
  { test: (n) => /^MPEG/.test(n), icon: faFilm, color: PROFILE_ICON_COLORS.mpeg },

  // Professional
  { test: (n) => n.includes('ProRes'), icon: faClapperboard, color: PROFILE_ICON_COLORS.proRes },
  { test: (n) => n.includes('DNxHR'), icon: faClapperboard, color: PROFILE_ICON_COLORS.dnxhr },
  { test: (n) => n.includes('CineForm'), icon: faClapperboard, color: PROFILE_ICON_COLORS.cineform },
  {
    test: (n) => n.includes('FFV1') || n.includes('HuffYUV') || n.includes('Uncompressed'),
    icon: faFileVideo,
    color: PROFILE_ICON_COLORS.lossless,
  },

  // Streaming
  { test: (n) => n.startsWith('HLS'), icon: faSatelliteDish, color: PROFILE_ICON_COLORS.hls },
  { test: (n) => n.startsWith('DASH'), icon: faTowerBroadcast, color: PROFILE_ICON_COLORS.dash },

  // Audio — lossy
  { test: (n) => /^MP3\b/.test(n), icon: faMusic, color: PROFILE_ICON_COLORS.mp3 },
  { test: (n) => /^AAC\b/.test(n), icon: faMusic, color: PROFILE_ICON_COLORS.aac },
  { test: (n) => n.includes('Opus'), icon: faHeadphonesSimple, color: PROFILE_ICON_COLORS.opus },
  { test: (n) => n.includes('Vorbis'), icon: faHeadphonesSimple, color: PROFILE_ICON_COLORS.vorbis },

  // Audio — lossless
  { test: (n) => /^FLAC/.test(n), icon: faCompactDisc, color: PROFILE_ICON_COLORS.flac },
  { test: (n) => n.includes('ALAC'), icon: faCompactDisc, color: PROFILE_ICON_COLORS.alac },
  { test: (n) => n.includes('WAV'), icon: faWaveSquare, color: PROFILE_ICON_COLORS.wav },
  { test: (n) => n.includes('AIFF'), icon: faWaveSquare, color: PROFILE_ICON_COLORS.aiff },

  // Audio — Dolby
  { test: (n) => n.includes('Dolby'), icon: faVolumeHigh, color: PROFILE_ICON_COLORS.dolby },

  // Images
  { test: (n) => n === 'JPEG', icon: faImage, color: PROFILE_ICON_COLORS.jpeg },
  { test: (n) => n === 'PNG', icon: faImage, color: PROFILE_ICON_COLORS.png },
  { test: (n) => n === 'WebP', icon: faImage, color: PROFILE_ICON_COLORS.webp },
  { test: (n) => n === 'AVIF', icon: faImage, color: PROFILE_ICON_COLORS.avif },
  { test: (n) => n === 'TIFF', icon: faImage, color: PROFILE_ICON_COLORS.tiff },
  { test: (n) => n === 'BMP', icon: faImage, color: PROFILE_ICON_COLORS.bmp },
  { test: (n) => n === 'GIF', icon: faImage, color: PROFILE_ICON_COLORS.gif },
];

const DEFAULT_PROFILE_ICON = { icon: faFileVideo, color: PROFILE_ICON_COLORS.fallback };

function getProfileIcon(name: string): { icon: IconDefinition; color: string } {
  for (const entry of PROFILE_ICON_MAP) {
    if (entry.test(name)) return { icon: entry.icon, color: entry.color };
  }
  return DEFAULT_PROFILE_ICON;
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
  testId?: string;
}

export default function ProfileSelector({ onCreateNew, testId }: ProfileSelectorProps) {
  const { t } = useTranslation();
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const applyProfile = useProfileStore((s) => s.applyProfileToConversionStore);
  const deleteCustomProfile = useProfileStore((s) => s.deleteCustomProfile);

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
      const profileIcon = getProfileIcon(option.name);
      return (
        // eslint-disable-next-line encodex/no-inline-styles -- MUI Autocomplete passes runtime positioning via props.style
        <li {...props} key={option.id} style={{ ...props.style, position: 'relative' }}>
          <OptionIcon sx={{ color: profileIcon.color }}>
            <FontAwesomeIcon icon={profileIcon.icon} />
          </OptionIcon>
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
        try {
          applyProfile(value);
        } catch (err) {
          console.error('Failed to apply profile:', err);
        }
      }
    },
    [applyProfile],
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
      <Autocomplete
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
            setDeletingProfile(null);
            useToastStore.getState().error(t('profiles.deleted', { name }));
          }
        }}
      />
    </Stack>
  );
}
