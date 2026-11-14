/**
 * @fileoverview Page-level options that apply to every queue.
 *
 * Renders the "Action when done" setting in a dedicated bar that is placed
 * above the queue tab bar. Because the bar sits outside the tab boundary it
 * is visible for every queue and reads as a global setting: the main process
 * performs the selected power action once any queue drains.
 *
 * The setting is a single dropdown. Its options are the power actions the
 * queue can trigger when it finishes - sleep, hibernate, shutdown, or
 * force-close open programs and shut down - plus "none", which leaves the
 * machine alone.
 *
 * The component is fully controlled: every change is reported through
 * `onWhenDoneChange` with the newly selected action.
 *
 * Props (see {@link GlobalQueueOptionsProps}):
 *  - whenDone: the currently selected action.
 *  - onWhenDoneChange: fired with the new action whenever the selection
 *    changes.
 */

import { MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { WHEN_DONE_ACTIONS } from '../../shared/constants';
import type { WhenDoneAction } from '../../shared/types';
import type { GlobalQueueOptionsProps } from './types';
import { FieldLabel } from '../styles/form.styles';
import { GlobalOptionsBar, GlobalOptionsFieldBox, GlobalOptionsSelect } from '../styles/GlobalQueueOptions.styles';

/**
 * Renders the options that apply to every queue.
 * @param {GlobalQueueOptionsProps} props - Component props.
 * @param {WhenDoneAction} props.whenDone - The currently selected power
 *   action.
 * @param {(action: WhenDoneAction) => void} props.onWhenDoneChange - Fired
 *   with the new action when the dropdown changes.
 * @returns {JSX.Element} The global options bar.
 */
export default function GlobalQueueOptions({ whenDone, onWhenDoneChange }: GlobalQueueOptionsProps) {
  const { t } = useTranslation();

  /**
   * Localized display labels keyed by when-done action value.
   * @const {Record<WhenDoneAction, string>} whenDoneActionLabels
   */
  const whenDoneActionLabels: Record<WhenDoneAction, string> = {
    none: t('status.none'),
    sleep: t('batchQueue.whenDoneSleep'),
    hibernate: t('batchQueue.whenDoneHibernate'),
    shutdown: t('batchQueue.whenDoneShutdown'),
    shutdown_force: t('batchQueue.whenDoneShutdownForce'),
  };

  return (
    <GlobalOptionsBar data-testid="batch-global-options">
      <GlobalOptionsFieldBox>
        <FieldLabel htmlFor="global-when-done-action">{t('batchQueue.whenDone')}</FieldLabel>
        <GlobalOptionsSelect
          id="global-when-done-action"
          select
          size="small"
          slotProps={{ input: { 'aria-label': t('batchQueue.whenDone') } }}
          value={whenDone}
          onChange={(e) => {
            onWhenDoneChange(e.target.value as WhenDoneAction);
          }}
        >
          {WHEN_DONE_ACTIONS.map((a) => (
            <MenuItem key={a} value={a}>
              {whenDoneActionLabels[a]}
            </MenuItem>
          ))}
        </GlobalOptionsSelect>
      </GlobalOptionsFieldBox>
    </GlobalOptionsBar>
  );
}
