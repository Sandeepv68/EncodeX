/**
 * @fileoverview Small AI-provider icon: the brand logo when one is bundled,
 * otherwise the provider's stand-in glyph (a server for the local runtime).
 */

import { useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { aiProviderFallbackIcon, aiProviderLogo } from '../../utils/ai-provider-icons';
import type { ProviderIconProps } from './types';
import { ProviderGlyph, ProviderLogo } from '../../styles/copilot/ProviderIcon.styles';

/**
 * Renders the logo for a provider, or the provider's stand-in glyph when no
 * logo is available.
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
      <FontAwesomeIcon icon={aiProviderFallbackIcon(providerId)} />
    </ProviderGlyph>
  );
}
