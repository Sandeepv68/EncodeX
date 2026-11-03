/**
 * @fileoverview Compact summary of the target settings a planned Copilot action
 * will encode with: the chosen profile, resolution, video and audio settings,
 * and the output container.
 */

import { useTranslation } from 'react-i18next';
import { useProfileStore } from '../../stores/profileStore';
import { TargetRow } from '../../styles/copilot/AssistantMessage.styles';
import { codecDisplayName, containerDisplayName, formatTargetBitrate, formatTargetResolution } from '../../utils/plan-target';
import type { PlanTargetSummaryProps } from './types';

export default function PlanTargetSummary({ action }: PlanTargetSummaryProps) {
  const { t } = useTranslation();
  const getProfileById = useProfileStore((state) => state.getProfileById);
  const options = action.options;
  const profile = action.profileId ? getProfileById(action.profileId) : undefined;

  const describeVideo = (): string | undefined => {
    if (options.video === false) return undefined;
    if (options.copy) return t('copilot.target.losslessCopy');
    const parts: string[] = [];
    const codec = codecDisplayName(options.videoCodec);
    if (codec) parts.push(codec);
    const explicit = formatTargetBitrate(options.videoBitrate);
    if (options.qscale !== undefined) parts.push(t('copilot.target.crf', { value: options.qscale }));
    else if (explicit) parts.push(explicit);
    const modelled = formatTargetBitrate(action.estimatedVideoBitrateKbps);
    if (modelled && !explicit) parts.push(`≈ ${modelled}`);
    return parts.length > 0 ? parts.join(' · ') : undefined;
  };

  const describeAudio = (): string | undefined => {
    if (options.audio === false) return undefined;
    const parts: string[] = [];
    const codec = codecDisplayName(options.audioCodec);
    if (codec) parts.push(codec);
    const bitrate = formatTargetBitrate(options.audioBitrate) ?? formatTargetBitrate(action.estimatedAudioBitrateKbps);
    if (bitrate) parts.push(bitrate);
    return parts.length > 0 ? parts.join(' · ') : undefined;
  };

  const rows: string[] = [];
  if (profile) rows.push(`${t('copilot.target.profile')}: ${profile.name}`);
  const resolution = formatTargetResolution(options.scale) ?? t('copilot.target.sameAsSource');
  rows.push(`${t('copilot.target.resolution')}: ${resolution}`);
  const video = describeVideo();
  if (video) rows.push(`${t('copilot.target.video')}: ${video}`);
  const audio = describeAudio();
  if (audio) rows.push(`${t('copilot.target.audio')}: ${audio}`);
  const container = containerDisplayName(action.output, profile?.container);
  if (container) rows.push(`${t('copilot.target.container')}: ${container}`);

  return (
    <TargetRow variant="caption" component="span" color="text.secondary" data-testid={`copilot-target-${action.id}`}>
      {rows.join(' · ')}
    </TargetRow>
  );
}
