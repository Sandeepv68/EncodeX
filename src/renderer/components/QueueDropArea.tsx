/**
 * @fileoverview Drop-area overlay for the batch queue reorder drag.
 *
 * Wraps the sortable job list and, while a reorder drag is active, marks the
 * whole list as the drop area (a soft primary-tinted frame) and draws a solid
 * accent line in the exact gap the dragged card would land in.
 *
 * The insertion position is derived from dnd-kit's `over` rect and the active
 * item's translated rect: when the dragged card's center is above the hovered
 * card's center the slot is the gap before it, otherwise the gap after it. The
 * line sits in the 16px Stack gap, so it never overlaps a card and needs no
 * extra layout. All layers are `pointer-events: none` so they never intercept
 * the drag.
 */

import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useDndContext } from '@dnd-kit/core';

const INDICATOR_HEIGHT = 3;

/**
 * Overlay that highlights the reorder drop area and the current insertion gap.
 * @param {Object} props - Component props.
 * @param {ReactNode} props.children - The sortable job list to overlay.
 * @returns {JSX.Element} The wrapped list plus the drop-area overlay layers.
 */
export default function QueueDropArea({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { active, over } = useDndContext();
  const isDragActive = Boolean(active);

  let indicatorTop: number | null = null;
  if (isDragActive && over && containerRef.current) {
    const activeRect = active?.rect.current.translated;
    const overRect = over.rect;
    if (activeRect && overRect) {
      const containerTop = containerRef.current.getBoundingClientRect().top;
      const gap = parseFloat(theme.spacing(2));
      const insertBefore = activeRect.top + activeRect.height / 2 < overRect.top + overRect.height / 2;
      const lineCenterY = insertBefore ? overRect.top - containerTop - gap / 2 : overRect.bottom - containerTop + gap / 2;
      indicatorTop = lineCenterY - INDICATOR_HEIGHT / 2;
    }
  }

  return (
    <Box ref={containerRef} sx={{ position: 'relative' }}>
      {isDragActive && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            borderRadius: theme.typography.pxToRem(2),
            border: `1px dashed ${alpha(theme.palette.primary.main, 0.5)}`,
            backgroundColor: alpha(theme.palette.primary.main, 0.06),
            pointerEvents: 'none',
          }}
        />
      )}
      <Box sx={{ position: 'relative', zIndex: 1 }}>{children}</Box>
      {indicatorTop !== null && (
        <Box
          sx={{
            position: 'absolute',
            zIndex: 2,
            left: 0,
            right: 0,
            top: indicatorTop,
            height: INDICATOR_HEIGHT,
            backgroundColor: theme.palette.primary.main,
            borderRadius: INDICATOR_HEIGHT / 2,
            boxShadow: `0 0 ${theme.typography.pxToRem(6)} ${alpha(theme.palette.primary.main, 0.6)}`,
            pointerEvents: 'none',
          }}
        />
      )}
    </Box>
  );
}
