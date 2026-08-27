/**
 * @fileoverview Dialog for creating and editing custom conversion profiles.
 * Reuses MUI form components and validates codec-container compatibility.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Button,
  Stack,
  Box,
  IconButton,
  Collapse,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { ConversionProfile, ProfileCategory } from '../../shared/types';
import { CATEGORY_ORDER, PROFILE_CATEGORIES } from '../../shared/profiles/categories';
import { useProfileStore } from '../stores/profileStore';
import { useToastStore } from '../stores/toastStore';
import { FieldBox, FieldLabel } from '../styles/form.styles';
import CodecSelect from './CodecSelect';
import { ErrorBoundary } from './ErrorBoundary';
import {
  SCALE_OPTIONS,
  BITRATE_OPTIONS,
  VIDEO_BITRATE_OPTIONS,
  PIXEL_FORMATS,
} from '../../shared/media-options';

const CONTAINER_OPTIONS = [
  'mp4',
  'mkv',
  'mov',
  'webm',
  'avi',
  'mpg',
  'm4v',
  'flv',
  'ogg',
  'opus',
  'm4a',
  'mp3',
  'flac',
  'wav',
  'aiff',
  'ac3',
  'eac3',
  'mxf',
];
const PRESET_OPTIONS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'];
const CRF_OPTIONS = Array.from({ length: 32 }, (_, i) => i);

interface ProfileEditorDialogProps {
  open: boolean;
  onClose: () => void;
  editProfile?: ConversionProfile | null;
}

export default function ProfileEditorDialog({ open, onClose, editProfile }: ProfileEditorDialogProps) {
  const { t } = useTranslation();
  const saveCustomProfile = useProfileStore((s) => s.saveCustomProfile);
  const updateCustomProfile = useProfileStore((s) => s.updateCustomProfile);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProfileCategory>('video');
  const [container, setContainer] = useState('mp4');
  const [videoCodec, setVideoCodec] = useState('libx264');
  const [audioCodec, setAudioCodec] = useState('aac');
  const [videoBitrate, setVideoBitrate] = useState('');
  const [audioBitrate, setAudioBitrate] = useState('192k');
  const [crf, setCrf] = useState<number>(23);
  const [preset, setPreset] = useState('medium');
  const [scale, setScale] = useState('');
  const [pixelFormat, setPixelFormat] = useState('yuv420p');
  const [extension, setExtension] = useState('');
  const [extraArgsStr, setExtraArgsStr] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (editProfile) {
      setName(editProfile.name);
      setCategory(editProfile.category);
      setContainer(editProfile.container);
      setVideoCodec(editProfile.videoCodec);
      setAudioCodec(editProfile.audioCodec);
      setVideoBitrate(editProfile.videoBitrate ?? '');
      setAudioBitrate(editProfile.audioBitrate ?? '');
      setCrf(editProfile.crf ?? 23);
      setPreset(editProfile.preset ?? 'medium');
      setScale(editProfile.scale ?? '');
      setPixelFormat(editProfile.pixelFormat ?? 'yuv420p');
      setExtension(editProfile.extension ?? '');
      setExtraArgsStr((editProfile.extraArgs ?? []).join(' '));
      setDescription(editProfile.description ?? '');
    } else {
      setName('');
      setCategory('video');
      setContainer('mp4');
      setVideoCodec('libx264');
      setAudioCodec('aac');
      setVideoBitrate('');
      setAudioBitrate('192k');
      setCrf(23);
      setPreset('medium');
      setScale('');
      setPixelFormat('yuv420p');
      setExtension('');
      setExtraArgsStr('');
      setDescription('');
    }
    setShowAdvanced(false);
  }, [editProfile, open]);

  const handleSave = () => {
    const extraArgs = extraArgsStr.trim() ? extraArgsStr.trim().split(/\s+/) : undefined;
    const data: Omit<ConversionProfile, 'id' | 'builtin'> = {
      name: name.trim() || t('profiles.untitledProfile'),
      category,
      container,
      videoCodec,
      audioCodec,
      videoBitrate: videoBitrate || undefined,
      audioBitrate: audioBitrate || undefined,
      crf,
      preset,
      scale: scale || undefined,
      pixelFormat: pixelFormat || undefined,
      extension: extension || undefined,
      extraArgs,
      description: description || undefined,
    };

    if (editProfile) {
      updateCustomProfile(editProfile.id, data);
      useToastStore.getState().success(t('profiles.updated', { name: data.name }));
    } else {
      saveCustomProfile(data);
      useToastStore.getState().success(t('profiles.created', { name: data.name }));
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {editProfile ? t('profiles.editTitle') : t('profiles.createTitle')}
        <IconButton size="small" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FieldBox>
            <FieldLabel htmlFor="profile-name">{t('profiles.nameLabel')}</FieldLabel>
            <TextField
              id="profile-name"
              fullWidth
              size="small"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profiles.namePlaceholder')}
            />
          </FieldBox>

          <FieldBox>
            <FieldLabel htmlFor="profile-description">{t('profiles.descriptionLabel')}</FieldLabel>
            <TextField
              id="profile-description"
              fullWidth
              size="small"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('profiles.descriptionPlaceholder')}
            />
          </FieldBox>

          <Stack direction="row" spacing={2}>
            <FieldBox>
              <FieldLabel htmlFor="profile-category">{t('profiles.categoryLabel')}</FieldLabel>
              <TextField
                id="profile-category"
                select
                fullWidth
                size="small"
                value={category}
                onChange={(e) => setCategory(e.target.value as ProfileCategory)}
              >
                {CATEGORY_ORDER.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {PROFILE_CATEGORIES[cat].label}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>

            <FieldBox>
              <FieldLabel htmlFor="profile-container">{t('profiles.containerLabel')}</FieldLabel>
              <TextField
                id="profile-container"
                select
                fullWidth
                size="small"
                value={container}
                onChange={(e) => setContainer(e.target.value)}
              >
                {CONTAINER_OPTIONS.map((c) => (
                  <MenuItem key={c} value={c}>
                    .{c}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
          </Stack>

          <Stack direction="row" spacing={2}>
            <FieldBox>
              <FieldLabel htmlFor="profile-video-codec">{t('profiles.videoCodecLabel')}</FieldLabel>
              <ErrorBoundary fallback={null}>
                <CodecSelect
                  id="profile-video-codec"
                  type="video"
                  value={videoCodec}
                  onChange={setVideoCodec}
                  ariaLabel={t('profiles.videoCodecLabel')}
                />
              </ErrorBoundary>
            </FieldBox>

            <FieldBox>
              <FieldLabel htmlFor="profile-audio-codec">{t('profiles.audioCodecLabel')}</FieldLabel>
              <ErrorBoundary fallback={null}>
                <CodecSelect
                  id="profile-audio-codec"
                  type="audio"
                  value={audioCodec}
                  onChange={setAudioCodec}
                  ariaLabel={t('profiles.audioCodecLabel')}
                />
              </ErrorBoundary>
            </FieldBox>
          </Stack>

          <Stack direction="row" spacing={2}>
            <FieldBox>
              <FieldLabel htmlFor="profile-quality">{t('profiles.qualityLabel')}</FieldLabel>
              <TextField
                id="profile-quality"
                select
                fullWidth
                size="small"
                value={crf}
                onChange={(e) => setCrf(Number(e.target.value))}
              >
                {CRF_OPTIONS.map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>

            <FieldBox>
              <FieldLabel htmlFor="profile-preset">{t('profiles.presetLabel')}</FieldLabel>
              <TextField
                id="profile-preset"
                select
                fullWidth
                size="small"
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
              >
                {PRESET_OPTIONS.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
          </Stack>

          <Stack direction="row" spacing={2}>
            <FieldBox>
              <FieldLabel htmlFor="profile-scale">{t('profiles.resolutionLabel')}</FieldLabel>
              <TextField
                id="profile-scale"
                select
                fullWidth
                size="small"
                value={scale}
                onChange={(e) => setScale(e.target.value)}
              >
                <MenuItem value="">{t('profiles.original')}</MenuItem>
                {SCALE_OPTIONS.filter((s) => s !== '').map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>

            <FieldBox>
              <FieldLabel htmlFor="profile-pixel-format">{t('profiles.pixelFormatLabel')}</FieldLabel>
              <TextField
                id="profile-pixel-format"
                select
                fullWidth
                size="small"
                value={pixelFormat}
                onChange={(e) => setPixelFormat(e.target.value)}
              >
                {PIXEL_FORMATS.map((f) => (
                  <MenuItem key={f.value} value={f.value}>
                    {f.value}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
          </Stack>

          <Stack direction="row" spacing={2}>
            <FieldBox>
              <FieldLabel htmlFor="profile-video-bitrate">{t('profiles.videoBitrateLabel')}</FieldLabel>
              <TextField
                id="profile-video-bitrate"
                select
                fullWidth
                size="small"
                value={videoBitrate}
                onChange={(e) => setVideoBitrate(e.target.value)}
              >
                <MenuItem value="">{t('profiles.autoCrf')}</MenuItem>
                {VIDEO_BITRATE_OPTIONS.filter((b) => b !== '').map((b) => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>

            <FieldBox>
              <FieldLabel htmlFor="profile-audio-bitrate">{t('profiles.audioBitrateLabel')}</FieldLabel>
              <TextField
                id="profile-audio-bitrate"
                select
                fullWidth
                size="small"
                value={audioBitrate}
                onChange={(e) => setAudioBitrate(e.target.value)}
              >
                {BITRATE_OPTIONS.map((b) => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
          </Stack>

          <Box>
            <Button
              size="small"
              onClick={() => setShowAdvanced(!showAdvanced)}
              endIcon={
                <Box
                  component="span"
                  sx={(theme) => ({
                    display: 'inline-flex',
                    transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: theme.transitions.create('transform', { duration: theme.transitions.duration.short }),
                  })}
                >
                  <FontAwesomeIcon icon={faChevronDown} />
                </Box>
              }
            >
              {t('profiles.advancedOptions')}
            </Button>
            <Collapse in={showAdvanced}>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <FieldBox>
                  <FieldLabel htmlFor="profile-extension">{t('profiles.extensionOverrideLabel')}</FieldLabel>
                  <TextField
                    id="profile-extension"
                    fullWidth
                    size="small"
                    value={extension}
                    onChange={(e) => setExtension(e.target.value)}
                    placeholder={t('profiles.extensionPlaceholder')}
                  />
                </FieldBox>
                <FieldBox>
                  <FieldLabel htmlFor="profile-extra-args">{t('profiles.extraArgsLabel')}</FieldLabel>
                  <TextField
                    id="profile-extra-args"
                    fullWidth
                    size="small"
                    value={extraArgsStr}
                    onChange={(e) => setExtraArgsStr(e.target.value)}
                    placeholder="-movflags +faststart"
                    helperText={t('profiles.extraArgsHelp')}
                  />
                </FieldBox>
              </Stack>
            </Collapse>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t('profiles.cancel')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={!name.trim()}>
          {editProfile ? t('profiles.saveChanges') : t('profiles.createProfile')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
