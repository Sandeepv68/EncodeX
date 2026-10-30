/**
 * @fileoverview Small AI-provider icon: the brand logo when one is bundled,
 * otherwise a generic robot glyph.
 */

import { useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { aiProviderLogo } from '../../utils/ai-provider-icons';
import type { ProviderIconProps } from './types';
import { ProviderGlyph, ProviderLogo } from '../../styles/copilot/ProviderIcon.styles';

/**
 * Renders the logo for a provider, or a robot glyph when none is available.
 * @param {ProviderIconProps} props - Component props.
 * @returns {JSX.Element} The icon.
 */
export default function ProviderIcon({ providerId, size = 16 }: ProviderIconProps) {
  const theme = useTheme();
  const logo = providerId ? aiProviderLogo(providerId, theme.palette.mode) : null;

  if (logo) {
    return <ProviderLogo src={logo} alt="" $size={size} />;
  }

  return (
    <ProviderGlyph $size={size}>
      <FontAwesomeIcon icon={faRobot} />
    </ProviderGlyph>
  );
}
