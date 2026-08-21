/**
 * @fileoverview Hover/focus popover for the navigation drawer activity blips.
 *
 * Renders a compact card (via MUI Popover) describing the in-progress job on a
 * nav page: the page title, a localized status line (with an optional paused
 * tag), the source file basename, and a live progress bar. When the job's input
 * path is supplied in `content.input`, a small thumbnail of the source file is
 * lazily resolved through the shared preview cache and shown beside the text.
 * It is fully presentational - the host (AppDrawer) resolves the content from
 * the relevant store and hands it in via the `content` prop - so the popover
 * can be reused and unit-tested in isolation.
 *
 * The popover is anchored to the activity blip and is left-open while the
 * pointer rests on the blip, its nav row, or the card: the host drives `open`
 * via the `active` prop and forwards `onMouseEnter` / `onMouseLeave` to the
 * paper so the close can be deferred while the cursor is over the card. Escape
 * and focus-out close it through `onClose`.
 *
 * The full-screen Modal overlay MUI Popover mounts while open would otherwise
 * sit above the nav rows and steal their hover and click events (flickering the
 * popover and blocking navigation), so the overlay root and backdrop are set to
 * `pointer-events: none`; only the paper card itself stays interactive.
 *
 * Props (see {@link NavJobPopoverProps}):
 *  - active: the blip id the popover is open for, or null when closed.
 *  - anchorEl: the blip element the popover pins to.
 *  - onClose: closes the popover.
 *  - content: resolved title / status / fileName / progress / input, or null.
 *  - onMouseEnter / onMouseLeave: forwarded to the popover paper.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Popover, Typography } from '@mui/material';
import ProgressBar from './ProgressBar';
import { getPreviewThumbnail, getResolvedPreviewThumbnail } from '../utils/preview-cache';
import type { NavJobPopoverProps } from './types';
import { SHADOWS } from '../colors';
import { PopoverArrow, PopoverParallelBadge, PopoverPileThumb, PopoverThumb } from '../styles/NavJobPopover.styles';

/**
 * Lazily resolves a preview data URL for an input path through the shared
 * preview cache: a previously generated thumbnail (e.g. from the batch queue
 * card) seeds the first render synchronously, otherwise the image/video preview
 * IPC is called once per path. Audio files and other sources without a usable
 * preview resolve to `null`.
 *
 * Callers key this hook's component by the input path so that changing the
 * running job fully remounts the thumbnail (replaying its swap animation)
 * instead of briefly showing the previous file's preview against the new one.
 * @param {string} [input] - Absolute input path, or undefined when unknown.
 * @returns {string | null} The preview data URL, or null.
 */
function usePreviewSrc(input?: string): string | null {
  const [src, setSrc] = useState<string | null>(() => (input ? getResolvedPreviewThumbnail(input) : null));
  useEffect(() => {
    if (!input) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    setSrc(getResolvedPreviewThumbnail(input));
    getPreviewThumbnail(input).then((dataUrl) => {
      if (!cancelled) setSrc(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [input]);
  return src;
}

/**
 * Extracts the file name portion of an absolute path, handling both forward and
 * Windows back slashes (no Node `path` import in the renderer).
 * @param {string} filePath - Absolute file path.
 * @returns {string} The basename, or '' when the path is empty.
 */
function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? '';
}

/**
 * Lazy-loaded thumbnail of the job's source file.
 * @param {string} [input] - Absolute input path, or undefined when unknown.
 * @returns {JSX.Element | null} The thumbnail image, or null.
 */
function Thumbnail({ input }: { input?: string }) {
  const src = usePreviewSrc(input);
  if (!src) return null;
  return <PopoverThumb src={src} alt="" data-testid="nav-job-popover-thumbnail" />;
}

/**
 * Fixed width of the popover card in theme px units; must match the paper `sx`
 * width below. The pending-job pile is sized against the resulting content width
 * so it fills the available space on the card.
 * @const {number} POPOVER_PAPER_WIDTH
 */
const POPOVER_PAPER_WIDTH = 260;

/**
 * Horizontal padding of the popover card in theme spacing units; must match the
 * paper `sx` `p` value below.
 * @const {number} POPOVER_PAPER_PADDING
 */
const POPOVER_PAPER_PADDING = 2;

/**
 * Width of one pile slot in px and the overlap to the previous slot; must match
 * `PopoverPileThumb` (32px slot, 10px overlap => 22px consumed per extra slot).
 * @const {number} PILE_SLOT_WIDTH
 * @const {number} PILE_SLOT_STEP
 */
const PILE_SLOT_WIDTH = 32;
const PILE_SLOT_STEP = PILE_SLOT_WIDTH - 10;

/**
 * Delay in ms added per pile slot position for the entrance animation, so pile
 * thumbnails slide in one after the other rather than all at once.
 * @const {number} PILE_SLOT_STAGGER_MS
 */
const PILE_SLOT_STAGGER_MS = 40;

/**
 * Horizontal space reserved for the "+N" count badge, in px, so a truncated pile
 * never overflows the card edge.
 * @const {number} PILE_COUNT_RESERVE
 */
const PILE_COUNT_RESERVE = 40;

/**
 * Largest number of pending-job thumbnails that fit on one row of the card. The
 * card content width is the fixed paper width minus its horizontal padding
 * (2 units of the 8px theme spacing); past the first slot each thumbnail
 * consumes only the non-overlapped step, and room for the "+N" badge is
 * reserved up front so the pile fills the row without overflowing.
 * @const {number} PILE_CAPACITY
 */
const PILE_CAPACITY = Math.max(
  1,
  Math.floor((POPOVER_PAPER_WIDTH - POPOVER_PAPER_PADDING * 8 * 2 - PILE_SLOT_WIDTH - PILE_COUNT_RESERVE) / PILE_SLOT_STEP) + 1,
);

/**
 * One slot in the overlapping pending-job thumbnail pile: a fixed-size rounded
 * box that holds the resolved preview (or a neutral placeholder while loading /
 * when the file has no usable preview), overlapping the previous slot. The
 * slot's entrance animation is staggered by its pile position (`index`) so new
 * thumbnails slide in one after the other as the batch advances.
 * @param {{ input: string, index: number }} props - The pending job's input
 *   path and its position in the pile.
 * @returns {JSX.Element} The pile thumbnail slot.
 */
function PileThumb({ input, index }: { input: string; index: number }) {
  const src = usePreviewSrc(input);
  return (
    <PopoverPileThumb $src={src} $delay={index * PILE_SLOT_STAGGER_MS} data-testid="nav-job-popover-pile-thumb" title={basename(input)} />
  );
}

/**
 * Renders the navigation job popover card.
 *
 * When `active` and `content` are set, mounts a Popover anchored to the
 * activity blip showing the job status and a determinate progress bar (or a
 * localized "starting" caption while progress is not yet available). A paused
 * job is annotated with the localized paused label and passed through to the
 * ProgressBar for paused styling. `data-testid="nav-job-popover"` marks the
 * card for tests.
 *
 * @param {NavJobPopoverProps} props - Component props.
 * @returns {JSX.Element | null} The popover, or null when closed.
 */
export default function NavJobPopover({ active, anchorEl, onClose, content, onMouseEnter, onMouseLeave }: NavJobPopoverProps) {
  const { t } = useTranslation();
  const open = active !== null && Boolean(anchorEl) && Boolean(content);

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      disableAutoFocus
      disableEnforceFocus
      anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
      transformOrigin={{ vertical: 'center', horizontal: 'left' }}
      slotProps={{
        root: { style: { pointerEvents: 'none' } },
        backdrop: { style: { pointerEvents: 'none' } },
        paper: {
          onMouseEnter,
          onMouseLeave,
          'data-testid': 'nav-job-popover',
          sx: (theme) => ({
            width: POPOVER_PAPER_WIDTH,
            maxWidth: `calc(100vw - ${theme.typography.pxToRem(32)})`,
            p: POPOVER_PAPER_PADDING,
            ml: 1,
            borderRadius: 2,
            pointerEvents: 'auto',
            overflow: 'visible',
            boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
          }),
        },
      }}
    >
      {content && (
        <>
          <PopoverArrow data-testid="nav-job-popover-arrow" />
          <Typography variant="subtitle2" component="div" sx={{ mb: 1 }}>
            {content.title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Thumbnail key={content.input} input={content.input} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {content.status}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  {content.parallel && content.parallel > 1 && (
                    <PopoverParallelBadge title={t('nav.blip.parallel', { count: content.parallel })}>
                      {'\u00d7'}
                      {content.parallel}
                    </PopoverParallelBadge>
                  )}
                  {content.paused && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {t('nav.blip.paused')}
                    </Typography>
                  )}
                </Box>
              </Box>
              {content.fileName && (
                <Typography variant="caption" color="text.secondary" title={content.fileName} noWrap sx={{ display: 'block', mt: 0.25 }}>
                  {content.fileName}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ mt: 1 }}>
            {content.progress ? (
              <ProgressBar
                key={content.jobId ?? content.input}
                percent={content.progress.percent}
                time={content.progress.time}
                speed={content.progress.speed}
                eta={content.progress.eta}
                paused={content.paused}
                minimal
                shadowed
              />
            ) : (
              <Typography variant="caption" color="text.secondary">
                {t('nav.blip.starting')}
              </Typography>
            )}
          </Box>
          {content.pendingThumbnails && content.pendingThumbnails.length > 0 && (
            <Box data-testid="nav-job-popover-pile" sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              {content.pendingThumbnails.slice(0, PILE_CAPACITY).map((input, index) => (
                <PileThumb key={input} input={input} index={index} />
              ))}
              {content.pendingThumbnails.length > PILE_CAPACITY && (
                <Typography variant="caption" color="text.secondary" data-testid="nav-job-popover-pile-count" sx={{ ml: 1 }}>
                  +{content.pendingThumbnails.length - PILE_CAPACITY}
                </Typography>
              )}
            </Box>
          )}
        </>
      )}
    </Popover>
  );
}
