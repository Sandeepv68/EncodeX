/**
 * @fileoverview Page icon registry.
 *
 * Maps each top-level route path to the Font Awesome icon rendered for it in
 * the navigation drawer. Every route declared in App.tsx has a matching entry,
 * so the drawer can look up the right icon for the active page.
 *
 * Route -> icon mapping:
 *  - '/'              -> faHouse (dashboard)
 *  - '/convert'       -> faRightLeft (media conversion)
 *  - '/media-info'    -> faCircleInfo (media metadata)
 *  - '/image-compress'-> faImage (image compression)
 *  - '/audio-extract' -> faMusic (audio extraction)
 *  - '/video-cut'     -> faScissors (video trimming/cutting)
 *  - '/remux'         -> faLayerGroup (lossless remux)
 *  - '/demux'         -> faFileExport (stream demux/splitting)
 *  - '/batch'         -> faListCheck (batch queue)
 *  - '/automations'   -> faDiagramProject (automation pipelines)
 *  - '/copilot'       -> EncodeX logo (AI copilot)
 *  - '/logs'          -> faFileLines (log console)
 *  - '/settings'      -> faGear (settings)
 *  - '/about'         -> faCircleQuestion (about)
 */

import type { ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleInfo,
  faCircleQuestion,
  faClock,
  faClockRotateLeft,
  faClosedCaptioning,
  faCompactDisc,
  faCompress,
  faComments,
  faDiagramProject,
  faDownload,
  faFileAudio,
  faFileExport,
  faFileImport,
  faFileLines,
  faFolderOpen,
  faGear,
  faHouse,
  faImage,
  faLanguage,
  faLayerGroup,
  faListCheck,
  faMagnifyingGlass,
  faMusic,
  faPalette,
  faPen,
  faPlay,
  faPlug,
  faPlus,
  faPowerOff,
  faRightLeft,
  faRotateRight,
  faSave,
  faScissors,
  faSliders,
  faTag,
  faTriangleExclamation,
  faVideo,
  faVolumeXmark,
  faWandMagicSparkles,
  faBolt,
  faBullseye,
} from '@fortawesome/free-solid-svg-icons';
import EncodexLogoIcon from './components/EncodexLogoIcon';
import type { QuickLinkIconKey } from './stores/types';

/**
 * Registry of Font Awesome icons keyed by route path. Looked up by the
 * navigation drawer to render the icon beside each page label.
 * @const {Record<string, ReactNode>} pageIcons
 */
export const pageIcons: Record<string, ReactNode> = {
  '/': <FontAwesomeIcon icon={faHouse} />,
  '/convert': <FontAwesomeIcon icon={faRightLeft} />,
  '/media-info': <FontAwesomeIcon icon={faCircleInfo} />,
  '/image-compress': <FontAwesomeIcon icon={faImage} />,
  '/audio-extract': <FontAwesomeIcon icon={faMusic} />,
  '/video-cut': <FontAwesomeIcon icon={faScissors} />,
  '/remux': <FontAwesomeIcon icon={faLayerGroup} />,
  '/demux': <FontAwesomeIcon icon={faFileExport} />,
  '/batch': <FontAwesomeIcon icon={faListCheck} />,
  '/automations': <FontAwesomeIcon icon={faDiagramProject} />,
  '/copilot': <EncodexLogoIcon />,
  '/logs': <FontAwesomeIcon icon={faFileLines} />,
  '/settings': <FontAwesomeIcon icon={faGear} />,
  '/about': <FontAwesomeIcon icon={faCircleQuestion} />,
  '/history': <FontAwesomeIcon icon={faClockRotateLeft} />,
};

export const quickLinkIcons: Record<QuickLinkIconKey, ReactNode> = {
  about: <FontAwesomeIcon icon={faCircleQuestion} />,
  ai: <FontAwesomeIcon icon={faWandMagicSparkles} />,
  audio: <FontAwesomeIcon icon={faMusic} />,
  automation: <FontAwesomeIcon icon={faDiagramProject} />,
  bolt: <FontAwesomeIcon icon={faBolt} />,
  caption: <FontAwesomeIcon icon={faClosedCaptioning} />,
  chat: <FontAwesomeIcon icon={faComments} />,
  clock: <FontAwesomeIcon icon={faClock} />,
  compress: <FontAwesomeIcon icon={faCompress} />,
  container: <FontAwesomeIcon icon={faLayerGroup} />,
  copy: <FontAwesomeIcon icon={faCompactDisc} />,
  cut: <FontAwesomeIcon icon={faScissors} />,
  download: <FontAwesomeIcon icon={faDownload} />,
  edit: <FontAwesomeIcon icon={faPen} />,
  errors: <FontAwesomeIcon icon={faTriangleExclamation} />,
  export: <FontAwesomeIcon icon={faFileExport} />,
  file: <FontAwesomeIcon icon={faFileAudio} />,
  folder: <FontAwesomeIcon icon={faFolderOpen} />,
  format: <FontAwesomeIcon icon={faRightLeft} />,
  goal: <FontAwesomeIcon icon={faBullseye} />,
  history: <FontAwesomeIcon icon={faClockRotateLeft} />,
  import: <FontAwesomeIcon icon={faFileImport} />,
  inspect: <FontAwesomeIcon icon={faCircleInfo} />,
  language: <FontAwesomeIcon icon={faLanguage} />,
  list: <FontAwesomeIcon icon={faListCheck} />,
  logs: <FontAwesomeIcon icon={faFileLines} />,
  merge: <FontAwesomeIcon icon={faFileAudio} />,
  metadata: <FontAwesomeIcon icon={faFileLines} />,
  mute: <FontAwesomeIcon icon={faVolumeXmark} />,
  play: <FontAwesomeIcon icon={faPlay} />,
  plug: <FontAwesomeIcon icon={faPlug} />,
  plus: <FontAwesomeIcon icon={faPlus} />,
  power: <FontAwesomeIcon icon={faPowerOff} />,
  quality: <FontAwesomeIcon icon={faSliders} />,
  queue: <FontAwesomeIcon icon={faListCheck} />,
  redo: <FontAwesomeIcon icon={faRotateRight} />,
  resize: <FontAwesomeIcon icon={faCompress} />,
  run: <FontAwesomeIcon icon={faPlay} />,
  save: <FontAwesomeIcon icon={faSave} />,
  search: <FontAwesomeIcon icon={faMagnifyingGlass} />,
  split: <FontAwesomeIcon icon={faScissors} />,
  streams: <FontAwesomeIcon icon={faLayerGroup} />,
  sync: <FontAwesomeIcon icon={faClockRotateLeft} />,
  theme: <FontAwesomeIcon icon={faPalette} />,
  transcript: <FontAwesomeIcon icon={faFileLines} />,
  version: <FontAwesomeIcon icon={faTag} />,
  video: <FontAwesomeIcon icon={faVideo} />,
};
