/**
 * @fileoverview Page-level options that apply to every queue.
 *
 * Renders the "Action when done" setting inline in the queue header row, to
 * the right of the queue tab list. Because the setting sits outside the tab
 * boundary it is visible for every queue and reads as a global setting: the
 * main process performs the selected power action once any queue drains.
 *
 * The control is a compact icon button showing the selected action's icon. Its
 * tooltip names both the setting and the current action. Clicking it expands
 * into a dropdown whose options carry a matching icon; picking one applies it
 * and collapses the dropdown back into the button.
 *
 * The setting is a single value. Its options are the power actions the queue
 * can trigger when it finishes - sleep, hibernate, shutdown, or force-close
 * open programs and shut down - plus "none", which leaves the machine alone.
 *
 * The component is fully controlled: every change is reported through
 * `onWhenDoneChange` with the newly selected action.
 *
 * Props (see {@link GlobalQueueOptionsProps}):
 *  - whenDone: the currently selected action.
 *  - onWhenDoneChange: fired with the new action whenever the selection
 *    changes.
 */

import { useRef, useState } from 'react';
import { Collapse, IconButton, MenuItem, Tooltip } from '@mui/material';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faMoon, faPlugCircleXmark, faPowerOff, faSnowflake, faToggleOff } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import { WHEN_DONE_ACTIONS } from '../../shared/constants';
import type { WhenDoneAction } from '../../shared/types';
import type { GlobalQueueOptionsProps } from './types';
import {
  GlobalOptionsGroup,
  GlobalOptionsInputRow,
  GlobalOptionsLabel,
  GlobalOptionsSelect,
  WhenDoneOptionIcon,
} from '../styles/GlobalQueueOptions.styles';

/** Icon shown for each when-done action in the button and its dropdown. @const WHEN_DONE_ICONS */
const WHEN_DONE_ICONS: Record<WhenDoneAction, IconDefinition> = {
  none: faToggleOff,
  sleep: faMoon,
  hibernate: faSnowflake,
  shutdown: faPowerOff,
  shutdown_force: faPlugCircleXmark,
};

/**
 * Renders the options that apply to every queue.
 * @param {GlobalQueueOptionsProps} props - Component props.
 * @param {WhenDoneAction} props.whenDone - The currently selected power
 *   action.
 * @param {(action: WhenDoneAction) => void} props.onWhenDoneChange - Fired
 *   with the new action when the dropdown changes.
 * @returns {JSX.Element} The global options control.
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

  /**
   * True while the dropdown is expanded in place of the action button.
   * @type {[boolean, (value: boolean) => void]}
   */
  const [expanded, setExpanded] = useState<boolean>(false);
  /**
   * True while the expanded select's menu is open. The menu is opened once the
   * expand animation has finished so it anchors to the fully sized field.
   * @type {[boolean, (value: boolean) => void]}
   */
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  /** The collapsed action button, focused again when the dropdown closes. @type {React.RefObject<HTMLButtonElement>} */
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedLabel = whenDoneActionLabels[whenDone];
  const controlLabel = `${t('batchQueue.whenDone')}: ${selectedLabel}`;

  /**
   * Collapses the dropdown back into the action button after the menu closes,
   * whether an option was picked or the menu was dismissed.
   * @returns {void}
   */
  const handleMenuClose = () => {
    setMenuOpen(false);
    setExpanded(false);
  };

  return (
    <GlobalOptionsGroup data-testid="batch-global-options">
      <GlobalOptionsLabel htmlFor="global-when-done-action" $visible={expanded}>
        {t('batchQueue.whenDone')}
      </GlobalOptionsLabel>
      <GlobalOptionsInputRow>
        <Collapse in={!expanded} orientation="horizontal" unmountOnExit>
          <Tooltip title={controlLabel} placement="bottom">
            <IconButton
              ref={buttonRef}
              size="small"
              aria-label={controlLabel}
              aria-haspopup="listbox"
              onClick={() => {
                setExpanded(true);
              }}
              data-testid="when-done-button"
            >
              <FontAwesomeIcon icon={WHEN_DONE_ICONS[whenDone]} />
            </IconButton>
          </Tooltip>
        </Collapse>
        <Collapse
          in={expanded}
          orientation="horizontal"
          unmountOnExit
          onEntered={() => {
            setMenuOpen(true);
          }}
          onExited={() => {
            buttonRef.current?.focus();
          }}
        >
          <GlobalOptionsSelect
            id="global-when-done-action"
            select
            size="small"
            value={whenDone}
            onChange={(e) => {
              onWhenDoneChange(e.target.value as WhenDoneAction);
            }}
            slotProps={{
              input: { 'aria-label': t('batchQueue.whenDone') },
              select: { open: menuOpen, onOpen: () => setMenuOpen(true), onClose: handleMenuClose },
            }}
          >
            {WHEN_DONE_ACTIONS.map((a) => (
              <MenuItem key={a} value={a} data-testid={`when-done-option-${a}`}>
                <WhenDoneOptionIcon>
                  <FontAwesomeIcon icon={WHEN_DONE_ICONS[a]} />
                </WhenDoneOptionIcon>
                {whenDoneActionLabels[a]}
              </MenuItem>
            ))}
          </GlobalOptionsSelect>
        </Collapse>
      </GlobalOptionsInputRow>
    </GlobalOptionsGroup>
  );
}
