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
 *  - '/batch'         -> faListCheck (batch queue)
 *  - '/logs'          -> faFileLines (log console)
 *  - '/settings'      -> faGear (settings)
 */

import type { ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHouse,
  faRightLeft,
  faCircleInfo,
  faImage,
  faMusic,
  faScissors,
  faListCheck,
  faFileLines,
  faGear,
} from '@fortawesome/free-solid-svg-icons';

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
  '/batch': <FontAwesomeIcon icon={faListCheck} />,
  '/logs': <FontAwesomeIcon icon={faFileLines} />,
  '/settings': <FontAwesomeIcon icon={faGear} />,
};
