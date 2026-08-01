import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faSquare, faCopy, faXmark } from '@fortawesome/free-solid-svg-icons';
import { APP_NAME } from '../../shared/app-constants';
import { TitleBarRoot, TitleBarTitle, WindowControls, WindowControlButton, WindowCloseButton } from '../styles/TitleBar.styles';

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const cleanup = window.electronAPI?.onWindowMaximizedChange(setMaximized);
    return () => cleanup?.();
  }, []);

  return (
    <TitleBarRoot>
      <TitleBarTitle variant="body2">{APP_NAME}</TitleBarTitle>
      <WindowControls>
        <WindowControlButton aria-label="Minimize" size="small" onClick={() => window.electronAPI.windowMinimize()}>
          <FontAwesomeIcon icon={faMinus} style={{ fontSize: 16 }} />
        </WindowControlButton>
        <WindowControlButton
          aria-label={maximized ? 'Restore' : 'Maximize'}
          size="small"
          onClick={() => window.electronAPI.windowMaximizeToggle()}
        >
          {maximized ? (
            <FontAwesomeIcon icon={faCopy} style={{ fontSize: 16 }} />
          ) : (
            <FontAwesomeIcon icon={faSquare} style={{ fontSize: 16 }} />
          )}
        </WindowControlButton>
        <WindowCloseButton aria-label="Close" size="small" onClick={() => window.electronAPI.windowClose()}>
          <FontAwesomeIcon icon={faXmark} style={{ fontSize: 16 }} />
        </WindowCloseButton>
      </WindowControls>
    </TitleBarRoot>
  );
}
