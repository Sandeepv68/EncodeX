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
