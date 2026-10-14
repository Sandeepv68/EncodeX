/**
 * @fileoverview Label + info-tooltip row shared by the Settings sections.
 */

import InfoTooltip from '../InfoTooltip';
import { SettingsLabel, SettingsLabelRow } from '../../styles/Settings.styles';

/**
 * Renders a settings row consisting of a label and its info tooltip. Used to
 * keep label + hint layout consistent across every settings section.
 * @param {Object} props - Component props.
 * @param {string} props.text - The translated label text.
 * @param {string} props.hint - The translated hint shown in the tooltip.
 * @returns {JSX.Element} A label row with an info tooltip.
 */
export default function SettingLabel({ text, hint }: { text: string; hint: string }) {
  return (
    <SettingsLabelRow>
      <SettingsLabel variant="body1">{text}</SettingsLabel>
      <InfoTooltip title={hint} />
    </SettingsLabelRow>
  );
}
