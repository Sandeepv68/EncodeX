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
