/**
 * @fileoverview Renders every route skeleton once to cover its layout tree and
 * checks that each one exposes a busy status region for assistive tech.
 */

import type { ComponentType } from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ColorModeProvider } from '../../ColorModeContext';
import {
  AboutSkeleton,
  AudioExtractSkeleton,
  BatchQueueSkeleton,
  ConvertSkeleton,
  CopilotSkeleton,
  DemuxSkeleton,
  ImageCompressSkeleton,
  LogsSkeleton,
  MediaInfoSkeleton,
  RemuxSkeleton,
  SettingsSkeleton,
  VideoCutSkeleton,
} from '../PageSkeletons';

const SKELETONS: Array<[string, ComponentType]> = [
  ['Convert', ConvertSkeleton],
  ['Remux', RemuxSkeleton],
  ['Demux', DemuxSkeleton],
  ['AudioExtract', AudioExtractSkeleton],
  ['ImageCompress', ImageCompressSkeleton],
  ['VideoCut', VideoCutSkeleton],
  ['BatchQueue', BatchQueueSkeleton],
  ['Logs', LogsSkeleton],
  ['Settings', SettingsSkeleton],
  ['About', AboutSkeleton],
  ['MediaInfo', MediaInfoSkeleton],
  ['Copilot', CopilotSkeleton],
];

describe('PageSkeletons', () => {
  it.each(SKELETONS)('%s renders a busy status region with skeleton bones', (_name, Skeleton) => {
    const { container } = render(
      <ColorModeProvider>
        <Skeleton />
      </ColorModeProvider>,
    );
    const region = container.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });
});
