import { useEffect, useState } from 'react';
import RemoveIcon from '@mui/icons-material/Remove';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import FilterNoneIcon from '@mui/icons-material/FilterNone';
import CloseIcon from '@mui/icons-material/Close';
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
          <RemoveIcon fontSize="small" />
        </WindowControlButton>
        <WindowControlButton
          aria-label={maximized ? 'Restore' : 'Maximize'}
          size="small"
          onClick={() => window.electronAPI.windowMaximizeToggle()}
        >
          {maximized ? <FilterNoneIcon fontSize="small" /> : <CropSquareIcon fontSize="small" />}
        </WindowControlButton>
        <WindowCloseButton aria-label="Close" size="small" onClick={() => window.electronAPI.windowClose()}>
          <CloseIcon fontSize="small" />
        </WindowCloseButton>
      </WindowControls>
    </TitleBarRoot>
  );
}
