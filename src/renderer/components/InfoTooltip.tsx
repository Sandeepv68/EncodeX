/**
 * @fileoverview Info icon with a hover tooltip.
 *
 * Renders a small circular-info icon that, when hovered, displays the passed
 * `title` in an MUI {@link Tooltip}. Used to surface helper text next to form
 * labels (e.g. in {@link FilePathField}) without taking up persistent layout
 * space.
 *
 * Props (see {@link InfoTooltipProps}):
 *  - title: the text shown in the tooltip on hover.
 */

import { Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import type { InfoTooltipProps } from './types';
import { InfoIconWrapper, InfoIcon } from '../styles/InfoTooltip.styles';

/**
 * Renders the info icon tooltip.
 *
 * Wraps a styled {@link InfoIconWrapper} containing a {@link FontAwesomeIcon}
 * circle-info glyph in an MUI {@link Tooltip}. The wrapper carries the
 * `info-tooltip` test id so tests can target the trigger.
 *
 * @param {InfoTooltipProps} props - Component props.
 * @param {string} props.title - The tooltip text displayed on hover.
 * @returns {JSX.Element} The tooltip-wrapped info icon.
 */
export default function InfoTooltip({ title }: InfoTooltipProps) {
  return (
    <Tooltip title={title}>
      <InfoIconWrapper role="button" tabIndex={0} aria-label={title} data-testid="info-tooltip">
        <InfoIcon icon={faCircleInfo} aria-hidden="true" />
      </InfoIconWrapper>
    </Tooltip>
  );
}
