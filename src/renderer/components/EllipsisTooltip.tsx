/**
 * @fileoverview Tooltip that only appears when its child content overflows.
 *
 * Wraps a child element (typically a text value such as a file path, metadata
 * tag, or summary field) in a MUI Tooltip whose visibility is gated on actual
 * text overflow. While the mouse hovers the box, the tooltip opens only when
 * the child's `scrollWidth` exceeds its `clientWidth` by more than one pixel,
 * i.e. only when the content is visually truncated. Moving the mouse away
 * closes the tooltip.
 *
 * A clone of the child receives the measuring ref, so the child must forward
 * refs to its DOM node (MUI components and plain DOM elements do). The wrapper
 * box uses `minWidth: 0` so long content can shrink inside flex/grid parents.
 *
 * Props (see {@link EllipsisTooltipProps}):
 *  - title: the full text shown inside the tooltip.
 *  - children: the element to measure; its ref is forwarded internally.
 */

import { cloneElement, useCallback, useEffect, useRef, useState } from 'react';
import { Box, Tooltip } from '@mui/material';
import type { EllipsisTooltipProps } from './types';

/**
 * Renders an overflow-aware tooltip wrapper.
 *
 * Attaches mouse enter/focus handlers that drive the local `open` state based
 * on whether the child content overflows its box. The tooltip renders above
 * the child, pointing at it via `placement="top"` with an arrow.
 * @param {EllipsisTooltipProps} props - Component props.
 * @param {string} props.title - Full text displayed in the tooltip.
 * @param {React.ReactElement} props.children - Child element whose overflow is
 *   measured; a ref is injected into it via cloneElement.
 * @returns {JSX.Element} The wrapped child with its conditional tooltip.
 */
export default function EllipsisTooltip({ title, children }: EllipsisTooltipProps) {
  const ref = useRef<HTMLElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [open, setOpen] = useState(false);

  /**
   * Measures whether the child's content currently overflows its box and
   * returns whether it does. Called on mount, resize, mouse-enter, and focus so
   * the tooltip stays accurate as the layout changes.
   * @returns {boolean} True when the content is visually truncated.
   */
  const measure = useCallback((): boolean => {
    const el = ref.current;
    const isOverflowing = !!el && el.scrollWidth > el.clientWidth + 1;
    setOverflowing(isOverflowing);
    return isOverflowing;
  }, []);

  /**
   * Re-measures on mount and on window resize so the focusable state tracks
   * the current layout (e.g. after fonts load or the panel is resized).
   * @returns {void}
   */
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  /**
   * Opens the tooltip only when the measured element actually overflows.
   * Compares the element's scrollWidth (full content width) against its
   * clientWidth (visible width) with a one-pixel tolerance to avoid flapping
   * on sub-pixel rounding.
   * @returns {void}
   */
  const handleEnter = () => {
    if (measure()) {
      setOpen(true);
    }
  };

  const child = cloneElement(
    children as React.ReactElement<Partial<{ ref?: React.Ref<HTMLElement> } & React.HTMLAttributes<HTMLElement>>>,
    { ref, tabIndex: overflowing ? 0 : -1 },
  );

  return (
    <Box
      onMouseEnter={handleEnter}
      onMouseLeave={() => setOpen(false)}
      onFocus={handleEnter}
      onBlur={() => setOpen(false)}
      sx={{ minWidth: 0 }}
    >
      <Tooltip title={title} placement="top" arrow open={open} onClose={() => setOpen(false)}>
        {child}
      </Tooltip>
    </Box>
  );
}
