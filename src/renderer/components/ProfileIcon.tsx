/**
 * @fileoverview Resolves and renders the leading icon for each profile in the
 * profile selector dropdown.
 *
 * Profiles fall into three visual categories:
 *   1. Brand logos rendered from the `simple-icons` package (YouTube, Instagram,
 *      TikTok, Facebook, X, Apple, Android, PlayStation, Dolby) using their
 *      official brand colors. Near-black brands (Apple, X, TikTok, Dolby) fall
 *      back to the theme text color in dark mode so they stay legible.
 *   2. A small set of FontAwesome glyphs for brands that `simple-icons` does not
 *      ship (Xbox, Nintendo/Switch) and for Apple device variants (iPhone, iPad,
 *      Apple TV), keeping their existing brand colors.
 *   3. Custom "format badges" — a small monochrome chip with the format
 *      abbreviation (MP4, MKV, FLAC, ...) — for codecs/containers/formats that
 *      have no official logo, using the existing per-format brand colors.
 */

import type { SimpleIcon } from 'simple-icons';
import { siYoutube, siInstagram, siTiktok, siFacebook, siX, siApple, siAndroid, siPlaystation, siDolby } from 'simple-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMobileScreen, faTabletScreenButton, faTv, faGamepad } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
import { PROFILE_ICON_COLORS } from '../colors';
import { OptionIcon, FormatBadge, BrandSvg } from '../styles/ProfileSelector.styles';

/** A resolved profile icon, rendered by <ProfileIcon />. */
type ResolvedIcon =
  | { kind: 'brand'; icon: SimpleIcon }
  | { kind: 'fa'; icon: IconDefinition; color: string }
  | { kind: 'badge'; label: string; color: string };

/** Fallback FontAwesome entry (brand has no simple-icons glyph). */
interface FallbackEntry {
  test: (name: string) => boolean;
  icon: IconDefinition;
  color: string;
}

/** Format-badge entry: matches a profile name and renders its abbreviation. */
interface BadgeEntry {
  test: (name: string) => boolean;
  label: string;
  color: string;
}

/** Better-fit brands of `simple-icons` that offer per-generation console glyphs. */
const PLAYSTATION_SPECIFIC: Array<{ test: RegExp; icon: SimpleIcon }> = [
  { test: /PS5|PlayStation 5/i, icon: siPlaystation },
  { test: /PS4|PlayStation 4|PlayStation 3|PlayStation 2/i, icon: siPlaystation },
];

const BRANDS: Array<{ test: (name: string) => boolean; icon: SimpleIcon }> = [
  { test: (n) => n.includes('YouTube'), icon: siYoutube },
  { test: (n) => n.includes('Instagram'), icon: siInstagram },
  { test: (n) => n.includes('TikTok'), icon: siTiktok },
  { test: (n) => n.includes('Facebook'), icon: siFacebook },
  { test: (n) => /^X\s/.test(n), icon: siX },
  { test: (n) => n.includes('Android'), icon: siAndroid },
  { test: (n) => n.includes('Dolby'), icon: siDolby },
];

const FALLBACKS: FallbackEntry[] = [
  // Devices — Apple (no device-specific simple-icons glyph).
  { test: (n) => n.includes('iPhone'), icon: faMobileScreen, color: PROFILE_ICON_COLORS.apple },
  { test: (n) => n.includes('iPad'), icon: faTabletScreenButton, color: PROFILE_ICON_COLORS.apple },
  { test: (n) => n.includes('Apple TV'), icon: faTv, color: PROFILE_ICON_COLORS.appleTv },
  // Devices — Gaming brands not present in simple-icons.
  { test: (n) => n.includes('Xbox'), icon: faGamepad, color: PROFILE_ICON_COLORS.xbox },
  { test: (n) => n.includes('Nintendo') || n.includes('Switch'), icon: faGamepad, color: PROFILE_ICON_COLORS.nintendo },
];

const BADGES: BadgeEntry[] = [
  // Video — containers
  { test: (n) => /^MP4\b/.test(n), label: 'MP4', color: PROFILE_ICON_COLORS.mp4 },
  { test: (n) => /^MKV\b/.test(n), label: 'MKV', color: PROFILE_ICON_COLORS.mkv },
  { test: (n) => /^MOV\b/.test(n), label: 'MOV', color: PROFILE_ICON_COLORS.mov },
  { test: (n) => /^WebM\b/.test(n), label: 'WEBM', color: PROFILE_ICON_COLORS.webm },
  { test: (n) => /^AVI\b/.test(n), label: 'AVI', color: PROFILE_ICON_COLORS.avi },
  { test: (n) => /^MPEG/.test(n), label: 'MPEG', color: PROFILE_ICON_COLORS.mpeg },
  // Professional
  { test: (n) => n.includes('ProRes'), label: 'ProRes', color: PROFILE_ICON_COLORS.proRes },
  { test: (n) => n.includes('DNxHR'), label: 'DNxHR', color: PROFILE_ICON_COLORS.dnxhr },
  { test: (n) => n.includes('CineForm'), label: 'CineForm', color: PROFILE_ICON_COLORS.cineform },
  { test: (n) => n.includes('FFV1'), label: 'FFV1', color: PROFILE_ICON_COLORS.lossless },
  { test: (n) => n.includes('HuffYUV'), label: 'HuffYUV', color: PROFILE_ICON_COLORS.lossless },
  { test: (n) => n.includes('Uncompressed'), label: 'RAW', color: PROFILE_ICON_COLORS.lossless },
  // Streaming
  { test: (n) => n.startsWith('HLS'), label: 'HLS', color: PROFILE_ICON_COLORS.hls },
  { test: (n) => n.startsWith('DASH'), label: 'DASH', color: PROFILE_ICON_COLORS.dash },
  // Audio — lossy
  { test: (n) => /^MP3\b/.test(n), label: 'MP3', color: PROFILE_ICON_COLORS.mp3 },
  { test: (n) => /^AAC\b/.test(n), label: 'AAC', color: PROFILE_ICON_COLORS.aac },
  { test: (n) => n.includes('Opus'), label: 'Opus', color: PROFILE_ICON_COLORS.opus },
  { test: (n) => n.includes('Vorbis'), label: 'Vorbis', color: PROFILE_ICON_COLORS.vorbis },
  // Audio — lossless
  { test: (n) => /^FLAC/.test(n), label: 'FLAC', color: PROFILE_ICON_COLORS.flac },
  { test: (n) => n.includes('ALAC'), label: 'ALAC', color: PROFILE_ICON_COLORS.alac },
  { test: (n) => n.includes('WAV'), label: 'WAV', color: PROFILE_ICON_COLORS.wav },
  { test: (n) => n.includes('AIFF'), label: 'AIFF', color: PROFILE_ICON_COLORS.aiff },
  // Images
  { test: (n) => n === 'JPEG', label: 'JPEG', color: PROFILE_ICON_COLORS.jpeg },
  { test: (n) => n === 'PNG', label: 'PNG', color: PROFILE_ICON_COLORS.png },
  { test: (n) => n === 'WebP', label: 'WEBP', color: PROFILE_ICON_COLORS.webp },
  { test: (n) => n === 'AVIF', label: 'AVIF', color: PROFILE_ICON_COLORS.avif },
  { test: (n) => n === 'TIFF', label: 'TIFF', color: PROFILE_ICON_COLORS.tiff },
  { test: (n) => n === 'BMP', label: 'BMP', color: PROFILE_ICON_COLORS.bmp },
  { test: (n) => n === 'GIF', label: 'GIF', color: PROFILE_ICON_COLORS.gif },
];

/** Apple brand fallback applied when a profile name won't otherwise resolve. */
const APPLE_BRAND: SimpleIcon = siApple;

function resolveProfileIcon(name: string): ResolvedIcon {
  // Platform / service brands with official simple-icons glyphs.
  for (const entry of BRANDS) {
    if (entry.test(name)) return { kind: 'brand', icon: entry.icon };
  }

  // PlayStation family (generic console glyph from simple-icons).
  if (name.includes('PlayStation') || /^PS\d/.test(name)) {
    const specific = PLAYSTATION_SPECIFIC.find((e) => e.test.test(name));
    return { kind: 'brand', icon: specific?.icon ?? siPlaystation };
  }

  // Device / gaming brands without a simple-icons glyph.
  for (const entry of FALLBACKS) {
    if (entry.test(name)) return { kind: 'fa', icon: entry.icon, color: entry.color };
  }

  // Format / codec badges.
  for (const entry of BADGES) {
    if (entry.test(name)) return { kind: 'badge', label: entry.label, color: entry.color };
  }

  // iPhone/iPad before other devices map through the shared Apple badge logo.
  if (name.includes('Apple') || name.includes('iPhone') || name.includes('iPad')) {
    return { kind: 'brand', icon: APPLE_BRAND };
  }

  // eslint-disable-next-line encodex/no-hardcoded-strings -- Generic fallback badge for unknown profiles; content-free icon abbreviation, not localizable UI copy.
  return { kind: 'badge', label: 'FILE', color: PROFILE_ICON_COLORS.fallback };
}

/** True when a hex brand color is too dark to render as a fill in dark mode. */
function isNearBlack(hex: string): boolean {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 40;
}

/** An inline SVG rendering of a `simple-icons` brand glyph. */
function BrandGlyph({ icon }: { icon: SimpleIcon }) {
  const theme = useTheme();
  const fill = isNearBlack(icon.hex) ? theme.palette.text.primary : `#${icon.hex}`;
  return (
    <BrandSvg viewBox="0 0 24 24" role="img" aria-label={icon.title}>
      <path d={icon.path} fill={fill} />
    </BrandSvg>
  );
}

/**
 * Renders the icon column for a profile option. Brand SVGs and format badges
 * carry their own color; FontAwesome glyphs are tinted by their resolved color.
 */
export default function ProfileIcon({ name }: { name: string }) {
  const resolved = resolveProfileIcon(name);

  if (resolved.kind === 'brand') {
    return (
      <OptionIcon>
        <BrandGlyph icon={resolved.icon} />
      </OptionIcon>
    );
  }

  if (resolved.kind === 'fa') {
    return (
      <OptionIcon sx={{ color: resolved.color }}>
        <FontAwesomeIcon icon={resolved.icon} />
      </OptionIcon>
    );
  }

  return (
    <OptionIcon>
      <FormatBadge $color={resolved.color}>{resolved.label}</FormatBadge>
    </OptionIcon>
  );
}

export { resolveProfileIcon };

/**
 * Compact version of the profile icon sized for the active-profile chip in the
 * page header. Reuses the same resolution as the autocomplete options so the
 * badge always matches the icon shown for the selected profile.
 */
export function ProfileChipIcon({ name }: { name: string }) {
  const resolved = resolveProfileIcon(name);

  if (resolved.kind === 'brand') {
    return (
      <Box
        component="span"
        sx={(theme) => ({
          display: 'inline-flex',
          alignItems: 'center',
          alignSelf: 'stretch',
          fontSize: theme.typography.pxToRem(30),
          lineHeight: 1,
        })}
      >
        <BrandGlyph icon={resolved.icon} />
      </Box>
    );
  }

  if (resolved.kind === 'fa') {
    return (
      <Box
        component="span"
        sx={(theme) => ({
          display: 'inline-flex',
          alignItems: 'center',
          alignSelf: 'stretch',
          fontSize: theme.typography.pxToRem(30),
          lineHeight: 1,
          color: resolved.color,
        })}
      >
        <FontAwesomeIcon icon={resolved.icon} />
      </Box>
    );
  }

  return (
    <FormatBadge $large $color={resolved.color}>
      {resolved.label}
    </FormatBadge>
  );
}
