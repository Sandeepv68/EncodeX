/**
 * @fileoverview Constants shared by the dashboard page, its layout store and
 * the Quick Links page. Keeping the canonical card route list here means the
 * grid, the layout reconciliation and future card additions cannot drift.
 */

import { NAV_ITEMS } from '../../shared/app-constants';
import type { QuickLink } from '../stores/types';

/** localStorage key holding the serialized dashboard layout. */
export const DASHBOARD_LAYOUT_STORAGE_KEY = 'encodex-dashboard-layout';

/** Built-in group id shown before every custom group. */
export const FAVOURITES_GROUP_ID = 'favourites';

/** Sentinel for cards that are not in any group. */
export const UNGROUPED_GROUP_ID = 'ungrouped';

/** Maximum number of custom groups a user can create. */
export const MAX_CUSTOM_GROUPS = 12;

/** Maximum length of a custom group name. */
export const MAX_GROUP_NAME_LENGTH = 40;

/** Routes that are reachable from the drawer and therefore have no card. */
const EXCLUDED_DASHBOARD_ROUTES = new Set<string>(['/', '/logs', '/settings', '/about']);

/** Canonical order of every route that may appear as a dashboard card. */
export const DEFAULT_DASHBOARD_ROUTES: readonly string[] = NAV_ITEMS.filter((item) => !EXCLUDED_DASHBOARD_ROUTES.has(item.to)).map(
  (item) => item.to,
);

/** Nav translation key suffix for each dashboard card. */
export const DASHBOARD_CARD_TITLES: Readonly<Record<string, string>> = {
  '/copilot': 'copilot',
  '/convert': 'convert',
  '/remux': 'remux',
  '/demux': 'demux',
  '/video-cut': 'cut',
  '/audio-extract': 'audio',
  '/image-compress': 'image',
  '/batch': 'batchQueue',
  '/automations': 'automations',
  '/media-info': 'mediaInfo',
};

/** Dashboard translation key suffix for each card description. */
export const DASHBOARD_CARD_DESCRIPTIONS: Readonly<Record<string, string>> = {
  '/copilot': 'descCopilot',
  '/convert': 'descConvert',
  '/remux': 'descRemux',
  '/demux': 'descDemux',
  '/video-cut': 'descCut',
  '/audio-extract': 'descAudio',
  '/image-compress': 'descImage',
  '/batch': 'descBatch',
  '/automations': 'descAutomations',
  '/media-info': 'descMediaInfo',
};

export const QUICK_LINKS: readonly QuickLink[] = [
  {
    id: 'chat-with-copilot',
    to: '/copilot',
    iconKey: 'chat',
    labelKey: 'quickLinks.links.chatWithCopilot.title',
    descriptionKey: 'quickLinks.links.chatWithCopilot.description',
  },
  {
    id: 'describe-goal',
    to: '/copilot',
    iconKey: 'goal',
    labelKey: 'quickLinks.links.describeGoal.title',
    descriptionKey: 'quickLinks.links.describeGoal.description',
  },
  {
    id: 'plan-conversion',
    to: '/copilot',
    iconKey: 'ai',
    labelKey: 'quickLinks.links.planConversion.title',
    descriptionKey: 'quickLinks.links.planConversion.description',
  },
  {
    id: 'find-moment-in-video',
    to: '/copilot',
    iconKey: 'search',
    labelKey: 'quickLinks.links.findMomentInVideo.title',
    descriptionKey: 'quickLinks.links.findMomentInVideo.description',
  },
  {
    id: 'search-transcript',
    to: '/copilot',
    iconKey: 'transcript',
    labelKey: 'quickLinks.links.searchTranscript.title',
    descriptionKey: 'quickLinks.links.searchTranscript.description',
  },
  {
    id: 'translate-subtitles',
    to: '/copilot',
    iconKey: 'language',
    labelKey: 'quickLinks.links.translateSubtitles.title',
    descriptionKey: 'quickLinks.links.translateSubtitles.description',
  },
  {
    id: 'save-chat',
    to: '/copilot',
    iconKey: 'save',
    labelKey: 'quickLinks.links.saveChat.title',
    descriptionKey: 'quickLinks.links.saveChat.description',
  },
  {
    id: 'convert-video',
    to: '/convert',
    iconKey: 'video',
    labelKey: 'quickLinks.links.convertVideo.title',
    descriptionKey: 'quickLinks.links.convertVideo.description',
  },
  {
    id: 'convert-audio',
    to: '/convert',
    iconKey: 'audio',
    labelKey: 'quickLinks.links.convertAudio.title',
    descriptionKey: 'quickLinks.links.convertAudio.description',
  },
  {
    id: 'compress-video',
    to: '/convert',
    iconKey: 'compress',
    labelKey: 'quickLinks.links.compressVideo.title',
    descriptionKey: 'quickLinks.links.compressVideo.description',
  },
  {
    id: 'use-conversion-profile',
    to: '/convert',
    iconKey: 'quality',
    labelKey: 'quickLinks.links.useConversionProfile.title',
    descriptionKey: 'quickLinks.links.useConversionProfile.description',
  },
  {
    id: 'create-custom-profile',
    to: '/convert',
    iconKey: 'plus',
    labelKey: 'quickLinks.links.createCustomProfile.title',
    descriptionKey: 'quickLinks.links.createCustomProfile.description',
  },
  {
    id: 'lossless-copy',
    to: '/convert',
    iconKey: 'copy',
    labelKey: 'quickLinks.links.losslessCopy.title',
    descriptionKey: 'quickLinks.links.losslessCopy.description',
  },
  {
    id: 'speed-up-with-gpu',
    to: '/convert',
    iconKey: 'bolt',
    labelKey: 'quickLinks.links.speedUpWithGpu.title',
    descriptionKey: 'quickLinks.links.speedUpWithGpu.description',
  },
  {
    id: 'change-container',
    to: '/remux',
    iconKey: 'container',
    labelKey: 'quickLinks.links.changeContainer.title',
    descriptionKey: 'quickLinks.links.changeContainer.description',
  },
  {
    id: 'add-audio-to-video',
    to: '/remux',
    iconKey: 'audio',
    labelKey: 'quickLinks.links.addAudioToVideo.title',
    descriptionKey: 'quickLinks.links.addAudioToVideo.description',
  },
  {
    id: 'merge-audio-and-video',
    to: '/remux',
    iconKey: 'merge',
    labelKey: 'quickLinks.links.mergeAudioAndVideo.title',
    descriptionKey: 'quickLinks.links.mergeAudioAndVideo.description',
  },
  {
    id: 'add-subtitles',
    to: '/remux',
    iconKey: 'caption',
    labelKey: 'quickLinks.links.addSubtitles.title',
    descriptionKey: 'quickLinks.links.addSubtitles.description',
  },
  {
    id: 'sync-audio-delay',
    to: '/remux',
    iconKey: 'sync',
    labelKey: 'quickLinks.links.syncAudioDelay.title',
    descriptionKey: 'quickLinks.links.syncAudioDelay.description',
  },
  {
    id: 'copy-streams',
    to: '/remux',
    iconKey: 'streams',
    labelKey: 'quickLinks.links.copyStreams.title',
    descriptionKey: 'quickLinks.links.copyStreams.description',
  },
  {
    id: 'extract-streams',
    to: '/demux',
    iconKey: 'export',
    labelKey: 'quickLinks.links.extractStreams.title',
    descriptionKey: 'quickLinks.links.extractStreams.description',
  },
  {
    id: 'split-audio-channels',
    to: '/demux',
    iconKey: 'split',
    labelKey: 'quickLinks.links.splitAudioChannels.title',
    descriptionKey: 'quickLinks.links.splitAudioChannels.description',
  },
  {
    id: 'save-subtitles',
    to: '/demux',
    iconKey: 'caption',
    labelKey: 'quickLinks.links.saveSubtitles.title',
    descriptionKey: 'quickLinks.links.saveSubtitles.description',
  },
  {
    id: 'export-tracks-separately',
    to: '/demux',
    iconKey: 'export',
    labelKey: 'quickLinks.links.exportTracksSeparately.title',
    descriptionKey: 'quickLinks.links.exportTracksSeparately.description',
  },
  {
    id: 'trim-video',
    to: '/video-cut',
    iconKey: 'cut',
    labelKey: 'quickLinks.links.trimVideo.title',
    descriptionKey: 'quickLinks.links.trimVideo.description',
  },
  {
    id: 'cut-clip-by-time',
    to: '/video-cut',
    iconKey: 'clock',
    labelKey: 'quickLinks.links.cutClipByTime.title',
    descriptionKey: 'quickLinks.links.cutClipByTime.description',
  },
  {
    id: 'cut-by-duration',
    to: '/video-cut',
    iconKey: 'clock',
    labelKey: 'quickLinks.links.cutByDuration.title',
    descriptionKey: 'quickLinks.links.cutByDuration.description',
  },
  {
    id: 'preview-clip',
    to: '/video-cut',
    iconKey: 'play',
    labelKey: 'quickLinks.links.previewClip.title',
    descriptionKey: 'quickLinks.links.previewClip.description',
  },
  {
    id: 'play-clip',
    to: '/video-cut',
    iconKey: 'play',
    labelKey: 'quickLinks.links.playClip.title',
    descriptionKey: 'quickLinks.links.playClip.description',
  },
  {
    id: 'remove-audio-from-clip',
    to: '/video-cut',
    iconKey: 'mute',
    labelKey: 'quickLinks.links.removeAudioFromClip.title',
    descriptionKey: 'quickLinks.links.removeAudioFromClip.description',
  },
  {
    id: 'extract-audio-from-video',
    to: '/audio-extract',
    iconKey: 'audio',
    labelKey: 'quickLinks.links.extractAudioFromVideo.title',
    descriptionKey: 'quickLinks.links.extractAudioFromVideo.description',
  },
  {
    id: 'save-audio-as-mp3',
    to: '/audio-extract',
    iconKey: 'file',
    labelKey: 'quickLinks.links.saveAudioAsMp3.title',
    descriptionKey: 'quickLinks.links.saveAudioAsMp3.description',
  },
  {
    id: 'choose-audio-quality',
    to: '/audio-extract',
    iconKey: 'quality',
    labelKey: 'quickLinks.links.chooseAudioQuality.title',
    descriptionKey: 'quickLinks.links.chooseAudioQuality.description',
  },
  {
    id: 'compress-image',
    to: '/image-compress',
    iconKey: 'compress',
    labelKey: 'quickLinks.links.compressImage.title',
    descriptionKey: 'quickLinks.links.compressImage.description',
  },
  {
    id: 'resize-image',
    to: '/image-compress',
    iconKey: 'resize',
    labelKey: 'quickLinks.links.resizeImage.title',
    descriptionKey: 'quickLinks.links.resizeImage.description',
  },
  {
    id: 'change-image-format',
    to: '/image-compress',
    iconKey: 'format',
    labelKey: 'quickLinks.links.changeImageFormat.title',
    descriptionKey: 'quickLinks.links.changeImageFormat.description',
  },
  {
    id: 'new-batch-task',
    to: '/batch',
    iconKey: 'plus',
    labelKey: 'quickLinks.links.newBatchTask.title',
    descriptionKey: 'quickLinks.links.newBatchTask.description',
  },
  {
    id: 'run-batch-jobs',
    to: '/batch',
    iconKey: 'queue',
    labelKey: 'quickLinks.links.runBatchJobs.title',
    descriptionKey: 'quickLinks.links.runBatchJobs.description',
  },
  {
    id: 'queue-files',
    to: '/batch',
    iconKey: 'folder',
    labelKey: 'quickLinks.links.queueFiles.title',
    descriptionKey: 'quickLinks.links.queueFiles.description',
  },
  {
    id: 'retry-failed-jobs',
    to: '/batch',
    iconKey: 'redo',
    labelKey: 'quickLinks.links.retryFailedJobs.title',
    descriptionKey: 'quickLinks.links.retryFailedJobs.description',
  },
  {
    id: 'import-queue',
    to: '/batch',
    iconKey: 'import',
    labelKey: 'quickLinks.links.importQueue.title',
    descriptionKey: 'quickLinks.links.importQueue.description',
  },
  {
    id: 'edit-job-options',
    to: '/batch',
    iconKey: 'edit',
    labelKey: 'quickLinks.links.editJobOptions.title',
    descriptionKey: 'quickLinks.links.editJobOptions.description',
  },
  {
    id: 'run-jobs-then-shut-down',
    to: '/batch',
    iconKey: 'power',
    labelKey: 'quickLinks.links.runJobsThenShutDown.title',
    descriptionKey: 'quickLinks.links.runJobsThenShutDown.description',
  },
  {
    id: 'build-automation',
    to: '/automations',
    iconKey: 'automation',
    labelKey: 'quickLinks.links.buildAutomation.title',
    descriptionKey: 'quickLinks.links.buildAutomation.description',
  },
  {
    id: 'run-automation',
    to: '/automations',
    iconKey: 'run',
    labelKey: 'quickLinks.links.runAutomation.title',
    descriptionKey: 'quickLinks.links.runAutomation.description',
  },
  {
    id: 'view-run-history',
    to: '/automations',
    iconKey: 'history',
    labelKey: 'quickLinks.links.viewRunHistory.title',
    descriptionKey: 'quickLinks.links.viewRunHistory.description',
  },
  {
    id: 'save-automation-pipeline',
    to: '/automations',
    iconKey: 'save',
    labelKey: 'quickLinks.links.saveAutomationPipeline.title',
    descriptionKey: 'quickLinks.links.saveAutomationPipeline.description',
  },
  {
    id: 'inspect-media-file',
    to: '/media-info',
    iconKey: 'inspect',
    labelKey: 'quickLinks.links.inspectMediaFile.title',
    descriptionKey: 'quickLinks.links.inspectMediaFile.description',
  },
  {
    id: 'view-stream-details',
    to: '/media-info',
    iconKey: 'streams',
    labelKey: 'quickLinks.links.viewStreamDetails.title',
    descriptionKey: 'quickLinks.links.viewStreamDetails.description',
  },
  {
    id: 'check-codecs',
    to: '/media-info',
    iconKey: 'list',
    labelKey: 'quickLinks.links.checkCodecs.title',
    descriptionKey: 'quickLinks.links.checkCodecs.description',
  },
  {
    id: 'read-file-metadata',
    to: '/media-info',
    iconKey: 'metadata',
    labelKey: 'quickLinks.links.readFileMetadata.title',
    descriptionKey: 'quickLinks.links.readFileMetadata.description',
  },
  {
    id: 'change-theme',
    to: '/settings',
    iconKey: 'theme',
    labelKey: 'quickLinks.links.changeTheme.title',
    descriptionKey: 'quickLinks.links.changeTheme.description',
  },
  {
    id: 'set-up-ai-provider',
    to: '/settings',
    iconKey: 'ai',
    labelKey: 'quickLinks.links.setUpAiProvider.title',
    descriptionKey: 'quickLinks.links.setUpAiProvider.description',
  },
  {
    id: 'configure-hardware-acceleration',
    to: '/settings',
    iconKey: 'bolt',
    labelKey: 'quickLinks.links.configureHardwareAcceleration.title',
    descriptionKey: 'quickLinks.links.configureHardwareAcceleration.description',
  },
  {
    id: 'enable-mcp-server',
    to: '/settings',
    iconKey: 'plug',
    labelKey: 'quickLinks.links.enableMcpServer.title',
    descriptionKey: 'quickLinks.links.enableMcpServer.description',
  },
  {
    id: 'manage-startup-notifications',
    to: '/settings',
    iconKey: 'power',
    labelKey: 'quickLinks.links.manageStartupNotifications.title',
    descriptionKey: 'quickLinks.links.manageStartupNotifications.description',
  },
  {
    id: 'view-logs',
    to: '/logs',
    iconKey: 'logs',
    labelKey: 'quickLinks.links.viewLogs.title',
    descriptionKey: 'quickLinks.links.viewLogs.description',
  },
  {
    id: 'search-errors',
    to: '/logs',
    iconKey: 'errors',
    labelKey: 'quickLinks.links.searchErrors.title',
    descriptionKey: 'quickLinks.links.searchErrors.description',
  },
  {
    id: 'review-operation-history',
    to: '/logs',
    iconKey: 'history',
    labelKey: 'quickLinks.links.reviewOperationHistory.title',
    descriptionKey: 'quickLinks.links.reviewOperationHistory.description',
  },
  {
    id: 'download-logs',
    to: '/logs',
    iconKey: 'download',
    labelKey: 'quickLinks.links.downloadLogs.title',
    descriptionKey: 'quickLinks.links.downloadLogs.description',
  },
  {
    id: 'check-version',
    to: '/about',
    iconKey: 'version',
    labelKey: 'quickLinks.links.checkVersion.title',
    descriptionKey: 'quickLinks.links.checkVersion.description',
  },
  {
    id: 'view-build-info',
    to: '/about',
    iconKey: 'inspect',
    labelKey: 'quickLinks.links.viewBuildInfo.title',
    descriptionKey: 'quickLinks.links.viewBuildInfo.description',
  },
  {
    id: 'read-about-encodex',
    to: '/about',
    iconKey: 'about',
    labelKey: 'quickLinks.links.readAboutEncodeX.title',
    descriptionKey: 'quickLinks.links.readAboutEncodeX.description',
  },
];
