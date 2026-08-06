/**
 * @fileoverview Custom application window title bar.
 *
 * Renders the top drag region of the frameless app window with the app name
 * on the left and the standard minimize, maximize/restore, and close controls
 * on the right. The maximize button swaps its icon between square and copy
 * glyphs based on the live window state reported by the main process.
 *
 * All actions are forwarded to the window.electronAPI window commands. The
 * maximized state is tracked by subscribing to onWindowMaximizedChange so the
 * restore icon stays in sync with the OS window manager.
 */

import { useEffect, useState } from 'react';
import { faMinus, faSquare, faCopy, faXmark } from '@fortawesome/free-solid-svg-icons';
import { APP_NAME } from '../../shared/app-constants';
import {
  TitleBarRoot,
  TitleBarTitle,
  WindowControls,
  WindowControlButton,
  WindowCloseButton,
  WindowControlIcon,
} from '../styles/TitleBar.styles';

/**
 * Renders the custom window title bar.
 *
 * Shows the APP_NAME in the title area and three window control buttons
 * (minimize, maximize/restore, close). Subscribes to the maximized-change IPC
 * event so the maximize button reflects the current window state, and calls
 * the matching window.electronAPI method for each control.
 * @returns {JSX.Element} The title bar with window controls.
 */
export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  /**
   * Subscribes to the main process's window-maximized-change event so the
   * maximize/restore button icon stays in sync with the OS window state.
   * @returns {void}
   */
  useEffect(() => {
    const cleanup = window.electronAPI?.onWindowMaximizedChange(setMaximized);
    return () => cleanup?.();
  }, []);

  return (
    <TitleBarRoot>
      <TitleBarTitle variant="body2">{APP_NAME}</TitleBarTitle>
      <WindowControls>
        <WindowControlButton aria-label="Minimize" size="small" onClick={() => window.electronAPI.windowMinimize()}>
          <WindowControlIcon icon={faMinus} />
        </WindowControlButton>
        <WindowControlButton
          aria-label={maximized ? 'Restore' : 'Maximize'}
          size="small"
          onClick={() => window.electronAPI.windowMaximizeToggle()}
        >
          {maximized ? <WindowControlIcon icon={faCopy} /> : <WindowControlIcon icon={faSquare} />}
        </WindowControlButton>
        <WindowCloseButton aria-label="Close" size="small" onClick={() => window.electronAPI.windowClose()}>
          <WindowControlIcon icon={faXmark} />
        </WindowCloseButton>
      </WindowControls>
    </TitleBarRoot>
  );
}
