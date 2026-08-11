/**
 * @fileoverview FontAwesome chevron used as the MUI Select dropdown arrow.
 *
 * Swaps the default MUI arrow for a `faChevronDown` icon. MUI clones this as
 * the Select's `IconComponent`, so it must forward `className` (the emotion
 * styles / `MuiSelect-icon` slot class land on the rendered `<svg>`). The
 * rotation on open/close is handled by the theme's `MuiSelect` icon overrides
 * (see theme.ts).
 */

import { forwardRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

/**
 * Select arrow icon that forwards the emotion/MUI `className` to the
 * FontAwesome `<svg>`.
 * @param {object} props - Component props.
 * @param {string} [props.className] - MUI select icon slot class.
 * @returns {JSX.Element} The chevron-down icon.
 */
const SelectArrowIcon = forwardRef<SVGSVGElement, { className?: string }>(function SelectArrowIcon({ className }, ref) {
  return <FontAwesomeIcon ref={ref} icon={faChevronDown} className={className} size="xs" />;
});

export default SelectArrowIcon;
