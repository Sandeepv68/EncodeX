/**
 * @fileoverview AI tab of the Settings page.
 *
 * Groups the two AI surfaces: the Copilot provider editor first, then the
 * embedded MCP server that external AI assistants connect to.
 */

import AiProviderSettingsSection from './AiProviderSettingsSection';
import McpSettingsSection from './McpSettingsSection';

/**
 * Renders the AI settings tab.
 *
 * The provider editor is rendered first because it is the primary AI surface;
 * the MCP server follows so it stays discoverable without a separate tab.
 * @param {Object} props - Component props.
 * @param {boolean} [props.autoOpen] - Open and reveal the provider editor.
 * @returns {JSX.Element} The AI tab content.
 */
export default function AiSettingsTab({ autoOpen = false }: { autoOpen?: boolean }) {
  return (
    <>
      <AiProviderSettingsSection autoOpen={autoOpen} />
      <McpSettingsSection />
    </>
  );
}
