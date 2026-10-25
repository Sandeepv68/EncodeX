/**
 * @fileoverview Small AI-provider icon: the brand logo when one is bundled,
 * otherwise a generic robot glyph.
 */

import { Box, useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { aiProviderLogo } from '../../utils/ai-provider-icons';
import type { AIProviderId } from '../../../shared/ai/types';

interface ProviderIconProps {
  providerId?: AIProviderId | null;
  /** Edge length of the icon in pixels. */
  size?: number;
}

/**
 * Renders the logo for a provider, or a robot glyph when none is available.
 * @param {ProviderIconProps} props - Component props.
 * @returns {JSX.Element} The icon.
 */
export default function ProviderIcon({ providerId, size = 16 }: ProviderIconProps) {
  const theme = useTheme();
  const logo = providerId ? aiProviderLogo(providerId, theme.palette.mode) : null;
  const edge = theme.typography.pxToRem(size);

  if (logo) {
    return <Box component="img" src={logo} alt="" sx={{ width: edge, height: edge, flexShrink: 0 }} />;
  }

  return (
    <Box component="span" sx={{ display: 'inline-flex', fontSize: edge, flexShrink: 0 }}>
      <FontAwesomeIcon icon={faRobot} />
    </Box>
  );
}
